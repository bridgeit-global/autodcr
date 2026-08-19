import { assertApiKey, getConfig } from "./config";
import { normalizeAuthorities } from "./regulations";
import type { AskResult, SearchHit } from "./types";
import { embedTexts, getLLM, similaritySearch } from "./vectorstore";

const SYSTEM_PROMPT = `You are a helpful assistant that answers questions using only the provided context from regulation PDF documents.

Rules:
- Base your answer strictly on the context below.
- If the context is insufficient, say you don't have enough information in the documents.
- Cite the source PDF filename(s), authority, and page number(s) when possible.
- Be concise and accurate. Prefer quoting or paraphrasing regulations carefully.`;

function formatContext(hits: SearchHit[]): string {
  return hits
    .map(
      (h, i) =>
        `[Excerpt ${i + 1}] (authority: ${h.authority || "?"}, source: ${h.source}, page: ${h.page ?? "?"})\n${h.text}`
    )
    .join("\n\n---\n\n");
}

export async function askQuestion(
  question: unknown,
  { authorities = null }: { authorities?: unknown } = {}
): Promise<AskResult> {
  assertApiKey();
  const q = String(question || "").trim();
  if (!q) throw new Error("Question is required.");

  const config = getConfig();
  const filterAuth = normalizeAuthorities(authorities);
  const llm = getLLM();
  const [queryEmbedding] = await embedTexts(llm, [q]);
  const hits = await similaritySearch(queryEmbedding, config.topK, {
    authorities: filterAuth.length ? filterAuth : null,
  });

  if (!hits.length) {
    return {
      answer: filterAuth.length
        ? `No relevant passages were found for authorities: ${filterAuth.join(", ")}.`
        : "No relevant passages were found in the indexed documents.",
      sources: [],
      authorities: filterAuth,
    };
  }

  const completion = await llm.chat.completions.create({
    model: config.chatModel,
    temperature: 0,
    max_tokens: config.maxTokens,
    messages: [
      {
        role: "system",
        content: `${SYSTEM_PROMPT}\n\nContext:\n${formatContext(hits)}`,
      },
      { role: "user", content: q },
    ],
  });

  const answer =
    completion.choices[0]?.message?.content?.trim() || "No answer generated.";

  return {
    answer,
    authorities: filterAuth,
    sources: hits.map((h) => ({
      source: h.source,
      page: h.page ?? null,
      authority: h.authority,
      score: Number(h.score?.toFixed?.(4) ?? h.score ?? 0),
      snippet: h.text.slice(0, 240).replace(/\s+/g, " ").trim(),
    })),
  };
}
