import type { ChatLlmOptions } from "./chatModels";
import { assertApiKey, assertPinecone, getConfig } from "./config";
import { detectJurisdiction, resolveAuthorities } from "./jurisdiction";
import {
  isReasoningChatModel,
  parseModelJsonObject,
  streamChatCompletion,
  streamDeltaContent,
  visibleModelText,
} from "./llm";
import { extractPdf } from "./pdf";
import { AUTHORITIES } from "./regulations";
import type {
  ChecklistItem,
  ComplianceGap,
  ComplianceResult,
  RagSource,
  SearchHit,
} from "./types";
import { embedTexts, getLLM, similaritySearch } from "./vectorstore";

const RETRIEVAL_QUERIES = [
  "FSI FAR floor space index plot potential permissible built-up area",
  "setbacks margins open spaces side rear front building line",
  "parking requirements car parking two-wheeler basement",
  "building height storeys skyline restriction elevation",
  "approvals permissions NOC commencement certificate occupancy",
  "fire safety staircase exit width refuge area",
  "environment tree cutting CRZ pollution consent",
  "documentation submission checklist drawings schedules required documents",
  "land use zoning amenity reservation development plan",
  "circular amendments notifications special regulations",
];

function formatContext(hits: SearchHit[]): string {
  return hits
    .map(
      (h, i) =>
        `[Reg ${i + 1}] (authority: ${h.authority || "?"}, source: ${h.source}, page: ${h.page ?? "?"}, type: ${h.docType || "?"})\n${h.text}`
    )
    .join("\n\n---\n\n");
}

function dedupeHits(hits: SearchHit[]): SearchHit[] {
  const seen = new Set<string>();
  const out: SearchHit[] = [];
  for (const h of hits) {
    const key = `${h.source}#${h.page}#${h.text.slice(0, 80)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(h);
  }
  return out;
}

async function retrieveRegulations(
  llm: ReturnType<typeof getLLM>,
  authorities: string[]
): Promise<SearchHit[]> {
  const config = getConfig();
  const embeddings = await embedTexts(llm, RETRIEVAL_QUERIES);
  const batches = await Promise.all(
    embeddings.map((emb) =>
      similaritySearch(emb, config.complianceTopK, { authorities })
    )
  );
  return dedupeHits(batches.flat()).slice(0, 40);
}

function skipWs(raw: string, i: number) {
  while (i < raw.length && /\s/.test(raw[i])) i += 1;
  return i;
}

function findJsonKey(raw: string, key: string): number {
  const needle = `"${key}"`;
  let from = 0;
  while (from < raw.length) {
    const idx = raw.indexOf(needle, from);
    if (idx < 0) return -1;
    let i = skipWs(raw, idx + needle.length);
    if (raw[i] === ":") return i + 1;
    from = idx + 1;
  }
  return -1;
}

function extractJsonString(
  raw: string,
  key: string
): { value: string; complete: boolean } | null {
  const afterColon = findJsonKey(raw, key);
  if (afterColon < 0) return null;
  let i = skipWs(raw, afterColon);
  if (raw[i] !== '"') return null;
  i += 1;
  let value = "";
  let escaped = false;
  for (; i < raw.length; i += 1) {
    const ch = raw[i];
    if (escaped) {
      const map: Record<string, string> = {
        n: "\n",
        t: "\t",
        r: "\r",
        b: "\b",
        f: "\f",
        '"': '"',
        "\\": "\\",
        "/": "/",
      };
      value += map[ch] ?? ch;
      escaped = false;
      continue;
    }
    if (ch === "\\") {
      escaped = true;
      continue;
    }
    if (ch === '"') return { value, complete: true };
    value += ch;
  }
  return { value, complete: false };
}

function extractJsonObjectArray(raw: string, key: string): unknown[] {
  const afterColon = findJsonKey(raw, key);
  if (afterColon < 0) return [];
  let i = skipWs(raw, afterColon);
  if (raw[i] !== "[") return [];
  i += 1;
  const items: unknown[] = [];
  while (i < raw.length) {
    i = skipWs(raw, i);
    if (raw[i] === "]") break;
    if (raw[i] === ",") {
      i += 1;
      continue;
    }
    if (raw[i] !== "{") break;
    const start = i;
    let depth = 0;
    let inStr = false;
    let escaped = false;
    let closed = false;
    for (; i < raw.length; i += 1) {
      const ch = raw[i];
      if (inStr) {
        if (escaped) {
          escaped = false;
          continue;
        }
        if (ch === "\\") {
          escaped = true;
          continue;
        }
        if (ch === '"') inStr = false;
        continue;
      }
      if (ch === '"') {
        inStr = true;
        continue;
      }
      if (ch === "{") depth += 1;
      else if (ch === "}") {
        depth -= 1;
        if (depth === 0) {
          i += 1;
          closed = true;
          break;
        }
      }
    }
    if (!closed) break;
    try {
      items.push(JSON.parse(raw.slice(start, i)));
    } catch {
      break;
    }
  }
  return items;
}

function excerptProposal(text: string, maxChars = 18000): string {
  const sections = text.split(/\n(?===== )/);
  if (sections.length <= 1) return text.slice(0, maxChars);
  const per = Math.max(2000, Math.floor(maxChars / sections.length));
  return sections
    .map((section) =>
      section.length > per ? `${section.slice(0, per).trimEnd()}\n[truncated]` : section
    )
    .join("\n\n");
}

function toSources(hits: SearchHit[]): RagSource[] {
  return hits.slice(0, 20).map((h) => ({
    source: h.source,
    page: h.page ?? null,
    authority: h.authority,
    docType: h.docType,
    score: Number(h.score?.toFixed?.(4) ?? h.score ?? 0),
    snippet: h.text.trim(),
  }));
}

function parseJsonContent(raw: string): {
  summary?: string;
  checklist?: ChecklistItem[];
  gaps?: ComplianceGap[];
} {
  const parsed = parseModelJsonObject(raw) as {
    summary?: string;
    checklist?: ChecklistItem[];
    gaps?: ComplianceGap[];
  };
  if (!parsed || typeof parsed !== "object") {
    throw new Error("Model did not return valid JSON for compliance analysis.");
  }
  return parsed;
}

function complianceMaxTokens(model?: string): number {
  const config = getConfig();
  if (!isReasoningChatModel(model || config.chatModel)) return config.complianceMaxTokens;
  return Math.max(config.complianceMaxTokens, 6144);
}

export async function analyzeCompliance({
  pdfBuffer,
  proposalText: proposalTextIn,
  filename = "proposal.pdf",
  authoritiesOverride = null,
  notes = "",
  pages: pagesIn,
  llmOptions,
  onStatus,
  onDelta,
  onPartial,
}: {
  pdfBuffer?: Buffer | null;
  proposalText?: string;
  filename?: string;
  authoritiesOverride?: unknown;
  notes?: string;
  pages?: number | null;
  llmOptions?: Partial<ChatLlmOptions>;
  onStatus?: (text: string) => void;
  onDelta?: (text: string) => void;
  onPartial?: (data: ComplianceResult) => void;
}): Promise<ComplianceResult> {
  assertApiKey();
  assertPinecone();

  let proposalText = String(proposalTextIn || "").trim();
  let pages = pagesIn ?? 0;
  if (pdfBuffer && pdfBuffer.length) {
    onStatus?.("Reading your proposal…");
    const extracted = await extractPdf(pdfBuffer);
    proposalText = extracted.text.trim();
    pages = extracted.pages;
  }
  if (!proposalText) {
    throw new Error(
      "Could not extract text from the proposal PDF. Scanned/image-only PDFs need OCR (not supported yet)."
    );
  }

  onStatus?.("Detecting planning authority…");
  const detection = await detectJurisdiction(proposalText, { llm: llmOptions });
  const resolved = resolveAuthorities({
    override: authoritiesOverride,
    detected: detection.detected,
  });

  if (!resolved.authorities.length) {
    const missing: ComplianceResult = {
      needsAuthoritySelection: true,
      detection,
      authorities: [],
      summary:
        "Could not determine which regulations apply. Select an authority (e.g. CIDCO, MIDC, MCGM/DCPR) and run again.",
      checklist: [],
      gaps: [],
      sources: [],
      proposal: { filename, pages, chars: proposalText.length },
    };
    onDelta?.(missing.summary);
    onPartial?.(missing);
    return missing;
  }

  const llm = getLLM();
  onStatus?.("Matching your proposal to regulations…");
  const hits = await retrieveRegulations(llm, resolved.authorities);
  if (!hits.length) {
    throw new Error(
      `No indexed regulation passages found for: ${resolved.authorities.join(", ")}. Run npm run ingest:regulations -- --force first.`
    );
  }

  const authorityLabels = resolved.authorities
    .map((id) => AUTHORITIES.find((a) => a.id === id)?.label || id)
    .join(", ");

  const proposalExcerpt = [
    notes ? `Project notes from user:\n${notes}\n` : "",
    excerptProposal(proposalText),
  ]
    .filter(Boolean)
    .join("\n");

  const draft: ComplianceResult = {
    needsAuthoritySelection: false,
    detection,
    authorities: resolved.authorities,
    authoritySource: resolved.source,
    authorityLabels,
    summary: "",
    checklist: [],
    gaps: [],
    sources: toSources(hits),
    proposal: { filename, pages, chars: proposalText.length },
  };
  onPartial?.(draft);
  onStatus?.("Writing compliance analysis…");

  const completion = await streamChatCompletion(
    {
      temperature: 0.2,
      max_tokens: complianceMaxTokens(llmOptions?.model),
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `You are a planning-regulation compliance analyst for Maharashtra / Mumbai region projects.
Use ONLY the regulation excerpts provided. Do not invent clauses.
Compare the project proposal to the regulations for authorities: ${authorityLabels}.

Reply with a single JSON object only. No markdown fences, no preamble, no reasoning in the output.

Return JSON with this shape:
{
  "summary": "2-4 sentence overview",
  "checklist": [
    {
      "id": "C1",
      "requirement": "short requirement statement",
      "status": "met" | "gap" | "unclear",
      "evidence_from_proposal": "what the proposal says or 'not mentioned'",
      "regulation_cite": { "source": "filename.pdf", "page": 12 },
      "notes": "brief note"
    }
  ],
  "gaps": [
    {
      "id": "G1",
      "title": "short gap title",
      "severity": "high" | "medium" | "low",
      "detail": "what is missing or non-compliant",
      "regulation_cite": { "source": "filename.pdf", "page": 12 }
    }
  ]
}

Cover FSI/FAR, setbacks/margins, parking, height, open space, approvals/NOCs, fire/safety, environment, and documentation where the excerpts allow.
Mark status "unclear" when the proposal is silent or excerpts are insufficient.
Prefer citing circulars when they amend base regulations.`,
        },
        {
          role: "user",
          content: `Authorities in scope: ${authorityLabels}
Detection rationale: ${detection.rationale}

Regulation excerpts:
${formatContext(hits)}

---
Project proposal documents (${filename}, ~${pages} pages):
${proposalExcerpt}`,
        },
      ],
    },
    llmOptions ? { ...llmOptions, thinking: false } : llmOptions
  );

  let raw = "";
  let summaryLen = 0;
  let checkCount = 0;
  let gapCount = 0;

  for await (const chunk of completion) {
    const delta = streamDeltaContent(chunk);
    if (!delta) continue;
    raw += delta;

    const visible = visibleModelText(raw);
    const summary = extractJsonString(visible, "summary");
    if (summary && summary.value.length > summaryLen) {
      onDelta?.(summary.value.slice(summaryLen));
      summaryLen = summary.value.length;
      draft.summary = summary.value;
    }

    const checklist = extractJsonObjectArray(visible, "checklist") as ChecklistItem[];
    const gaps = extractJsonObjectArray(visible, "gaps") as ComplianceGap[];
    if (checklist.length !== checkCount || gaps.length !== gapCount) {
      checkCount = checklist.length;
      gapCount = gaps.length;
      draft.checklist = checklist;
      if (gaps.length) draft.gaps = gaps;
      onPartial?.({ ...draft, sources: [] });
    }
  }

  let parsed: {
    summary?: string;
    checklist?: ChecklistItem[];
    gaps?: ComplianceGap[];
  };
  try {
    parsed = parseJsonContent(visibleModelText(raw) || "{}");
  } catch {
    parsed = {
      summary: draft.summary,
      checklist: draft.checklist,
      gaps: draft.gaps,
    };
  }

  if (!parsed.summary && !draft.summary && !(parsed.checklist || []).length) {
    throw new Error(
      "The model returned an empty compliance analysis. Try sending the PDF again."
    );
  }

  const checklist = Array.isArray(parsed.checklist) ? parsed.checklist : [];
  const gaps: ComplianceGap[] = Array.isArray(parsed.gaps) && parsed.gaps.length
    ? parsed.gaps
    : checklist
        .filter((c) => c.status === "gap")
        .map((c, i) => ({
          id: `G${i + 1}`,
          title: c.requirement,
          severity: "medium",
          detail: c.notes || c.evidence_from_proposal || "",
          regulation_cite: c.regulation_cite,
        }));

  return {
    ...draft,
    summary: parsed.summary || draft.summary || "",
    checklist,
    gaps,
  };
}
