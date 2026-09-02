import type { ChatLlmOptions } from "./chatModels";
import { createChatCompletion, isReasoningChatModel, parseModelJsonObject } from "./llm";
import { AUTHORITIES, normalizeAuthorities } from "./regulations";
import type { JurisdictionDetection } from "./types";

const KEYWORD_RULES: { authority: string; patterns: RegExp[] }[] = [
  {
    authority: "cidco",
    patterns: [
      /\bcidco\b/i,
      /\bnavi\s*mumbai\b/i,
      /\bcity\s+and\s+industrial\s+development\b/i,
    ],
  },
  {
    authority: "midc",
    patterns: [
      /\bmidc\b/i,
      /\bmaharashtra\s+industrial\s+development\b/i,
      /\bindustrial\s+area\b/i,
    ],
  },
  {
    authority: "sra",
    patterns: [
      /\bsra\b/i,
      /\bslum\s+rehab/i,
      /\bslum\s+rehabilitation\b/i,
      /\bredevelopment\s+of\s+slum/i,
    ],
  },
  {
    authority: "mcgm",
    patterns: [
      /\bmcgm\b/i,
      /\bbmc\b/i,
      /\bdCPR\s*2034\b/i,
      /\bdCPR\b/i,
      /\bmunicipal\s+corporation\s+of\s+greater\s+mumbai\b/i,
      /\bmumbai\s+municipal\b/i,
      /\bgreater\s+mumbai\b/i,
    ],
  },
  {
    authority: "udcpr",
    patterns: [/\budcpr\b/i, /\bunified\s+development\s+control\b/i],
  },
  {
    authority: "stamp_duty",
    patterns: [
      /\bstamp\s*duty\b/i,
      /\bready\s*reckoner\b/i,
      /\bguideline\s+value\b/i,
    ],
  },
];

function keywordDetect(text: string): { authority: string; score: number }[] {
  const scores = new Map<string, number>();
  for (const rule of KEYWORD_RULES) {
    let hits = 0;
    for (const p of rule.patterns) {
      if (p.test(text)) hits += 1;
    }
    if (hits) scores.set(rule.authority, hits);
  }
  return [...scores.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([authority, score]) => ({ authority, score }));
}

export async function detectJurisdiction(
  proposalText: string,
  { useLlm = true, llm }: { useLlm?: boolean; llm?: Partial<ChatLlmOptions> } = {}
): Promise<JurisdictionDetection> {
  const excerpt = String(proposalText || "").slice(0, 12000);
  const keywordHits = keywordDetect(excerpt);
  let detected = keywordHits.map((h) => h.authority);
  let confidence = detected.length
    ? keywordHits[0].score >= 2
      ? "high"
      : "medium"
    : "low";
  let rationale = detected.length
    ? `Matched keywords for: ${detected.join(", ")}`
    : "No clear authority keywords found in the proposal text.";

  if (useLlm && excerpt.trim()) {
    try {
      const labels = AUTHORITIES.map((a) => `${a.id} (${a.label})`).join(", ");
      const completion = await createChatCompletion(
        {
          temperature: 0.2,
          max_tokens: isReasoningChatModel(llm?.model) ? 1024 : 400,
          response_format: { type: "json_object" },
          messages: [
            {
              role: "system",
              content: `You identify which Indian planning authorities apply to a real-estate / development project proposal.
Valid authority ids: ${labels}.
Return JSON only: { "authorities": ["cidco"], "confidence": "high"|"medium"|"low", "rationale": "..." }
Pick only authorities clearly supported by the text. Prefer specific agencies (CIDCO/MIDC/SRA) over stamp_duty alone.`,
            },
            {
              role: "user",
              content: `Proposal excerpt:\n${excerpt}`,
            },
          ],
        },
        llm ? { ...llm, thinking: false } : llm
      );
      const raw = completion.choices[0]?.message?.content || "{}";
      const parsed = parseModelJsonObject(raw) as {
        authorities?: unknown;
        confidence?: string;
        rationale?: string;
      };
      const llmAuth = normalizeAuthorities(parsed.authorities || []);
      if (llmAuth.length) {
        const merged = [
          ...llmAuth,
          ...detected.filter((d) => !llmAuth.includes(d)),
        ];
        detected = merged;
        confidence = parsed.confidence || confidence;
        rationale = parsed.rationale || rationale;
      }
    } catch {
      // Keep keyword-only result
    }
  }

  return {
    detected,
    confidence,
    rationale,
    keywordHits,
  };
}

export function resolveAuthorities({
  override,
  detected,
}: {
  override: unknown;
  detected: unknown;
}): { authorities: string[]; source: "user_override" | "auto_detect" | "none" } {
  const fromUser = normalizeAuthorities(override);
  if (fromUser.length) {
    return { authorities: fromUser, source: "user_override" };
  }
  const fromDetect = normalizeAuthorities(detected);
  if (fromDetect.length) {
    return { authorities: fromDetect, source: "auto_detect" };
  }
  return { authorities: [], source: "none" };
}
