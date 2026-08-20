import { assertApiKey, getConfig } from "./config";
import { normalizeAuthorities } from "./regulations";
import type { AskHistoryTurn, AskResult, SearchHit } from "./types";
import { embedTexts, getLLM, similaritySearch } from "./vectorstore";

const SYSTEM_PROMPT = `You are a helpful assistant that answers questions using only the provided context from regulation PDF documents and, when present, the user's uploaded project document.

Rules:
- Base your answer strictly on the regulation excerpts and uploaded document text below.
- If the user asks about the uploaded document, use that document and cite regulations where they apply.
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
  {
    authorities = null,
    documentText = "",
    documentFilename = "",
    notes = "",
    history = [],
    onStatus,
    onDelta,
  }: {
    authorities?: unknown;
    documentText?: string;
    documentFilename?: string;
    notes?: string;
    history?: AskHistoryTurn[];
    onStatus?: (text: string) => void;
    onDelta?: (text: string) => void;
  } = {}
): Promise<AskResult> {
  assertApiKey();
  const q = String(question || "").trim();
  if (!q) throw new Error("Question is required.");

  const config = getConfig();
  const filterAuth = normalizeAuthorities(authorities);
  const llm = getLLM();
  onStatus?.("Searching the regulation library…");
  const [queryEmbedding] = await embedTexts(llm, [q]);
  const hits = await similaritySearch(queryEmbedding, config.topK, {
    authorities: filterAuth.length ? filterAuth : null,
  });

  const doc = String(documentText || "").trim();
  if (!hits.length && !doc) {
    const answer = filterAuth.length
      ? `No relevant passages were found for authorities: ${filterAuth.join(", ")}.`
      : "No relevant passages were found in the indexed documents.";
    onDelta?.(answer);
    return {
      answer,
      sources: [],
      authorities: filterAuth,
    };
  }

  const extra: string[] = [];
  if (notes.trim()) extra.push(`Project notes:\n${notes.trim()}`);
  if (doc) {
    const name = documentFilename.trim() || "uploaded-document.pdf";
    extra.push(`Uploaded project document (${name}):\n${doc.slice(0, 20000)}`);
  }
  extra.push(
    hits.length
      ? `Regulation excerpts:\n${formatContext(hits)}`
      : "No matching regulation excerpts were found. Answer from the uploaded document if possible."
  );

  const prior = history
    .filter((turn) => turn.content.trim())
    .slice(-8)
    .map((turn) => ({
      role: turn.role === "user" ? ("user" as const) : ("assistant" as const),
      content: turn.content.slice(0, 4000),
    }));

  onStatus?.("Writing answer…");
  const completion = await llm.chat.completions.create({
    model: config.chatModel,
    temperature: 0,
    max_tokens: config.maxTokens,
    stream: true,
    messages: [
      {
        role: "system",
        content: `${SYSTEM_PROMPT}\n\nContext:\n${extra.join("\n\n---\n\n")}`,
      },
      ...prior,
      { role: "user", content: q },
    ],
  });

  let answer = "";
  for await (const chunk of completion) {
    const delta = chunk.choices[0]?.delta?.content || "";
    if (!delta) continue;
    answer += delta;
    onDelta?.(delta);
  }

  return {
    answer: answer.trim() || "No answer generated.",
    authorities: filterAuth,
    sources: hits.map((h) => ({
      source: h.source,
      page: h.page ?? null,
      authority: h.authority,
      score: Number(h.score?.toFixed?.(4) ?? h.score ?? 0),
      snippet: h.text.trim(),
    })),
  };
}
