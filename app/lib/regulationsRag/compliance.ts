import { assertApiKey, assertPinecone, getConfig } from "./config";
import { detectJurisdiction, resolveAuthorities } from "./jurisdiction";
import { extractPdf } from "./pdf";
import { AUTHORITIES } from "./regulations";
import type {
  ChecklistItem,
  ComplianceGap,
  ComplianceResult,
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

function parseJsonContent(raw: string): {
  summary?: string;
  checklist?: ChecklistItem[];
  gaps?: ComplianceGap[];
} {
  const text = String(raw || "").trim();
  try {
    return JSON.parse(text) as {
      summary?: string;
      checklist?: ChecklistItem[];
      gaps?: ComplianceGap[];
    };
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (match) {
      return JSON.parse(match[0]) as {
        summary?: string;
        checklist?: ChecklistItem[];
        gaps?: ComplianceGap[];
      };
    }
    throw new Error("Model did not return valid JSON for compliance analysis.");
  }
}

export async function analyzeCompliance({
  pdfBuffer,
  filename = "proposal.pdf",
  authoritiesOverride = null,
  notes = "",
}: {
  pdfBuffer: Buffer;
  filename?: string;
  authoritiesOverride?: unknown;
  notes?: string;
}): Promise<ComplianceResult> {
  assertApiKey();
  assertPinecone();

  const { text, pages } = await extractPdf(pdfBuffer);
  const proposalText = text.trim();
  if (!proposalText) {
    throw new Error(
      "Could not extract text from the proposal PDF. Scanned/image-only PDFs need OCR (not supported yet)."
    );
  }

  const detection = await detectJurisdiction(proposalText);
  const resolved = resolveAuthorities({
    override: authoritiesOverride,
    detected: detection.detected,
  });

  if (!resolved.authorities.length) {
    return {
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
  }

  const config = getConfig();
  const llm = getLLM();
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
    proposalText.slice(0, 14000),
  ]
    .filter(Boolean)
    .join("\n");

  const completion = await llm.chat.completions.create({
    model: config.chatModel,
    temperature: 0,
    max_tokens: config.complianceMaxTokens,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: `You are a planning-regulation compliance analyst for Maharashtra / Mumbai region projects.
Use ONLY the regulation excerpts provided. Do not invent clauses.
Compare the project proposal to the regulations for authorities: ${authorityLabels}.

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
Project proposal (${filename}, ~${pages} pages):
${proposalExcerpt}`,
      },
    ],
  });

  const parsed = parseJsonContent(
    completion.choices[0]?.message?.content || "{}"
  );

  const checklist = Array.isArray(parsed.checklist) ? parsed.checklist : [];
  const gaps: ComplianceGap[] = Array.isArray(parsed.gaps)
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
    needsAuthoritySelection: false,
    detection,
    authorities: resolved.authorities,
    authoritySource: resolved.source,
    authorityLabels,
    summary: parsed.summary || "",
    checklist,
    gaps,
    sources: hits.slice(0, 20).map((h) => ({
      source: h.source,
      page: h.page ?? null,
      authority: h.authority,
      docType: h.docType,
      score: Number(h.score?.toFixed?.(4) ?? h.score ?? 0),
      snippet: h.text.slice(0, 240).replace(/\s+/g, " ").trim(),
    })),
    proposal: { filename, pages, chars: proposalText.length },
  };
}
