import type OpenAI from "openai";
import { getConfig } from "./config";
import { getLLM } from "./vectorstore";

export type ReasoningEffort = "low" | "medium" | "high" | "max";

type StreamParams = OpenAI.ChatCompletionCreateParamsStreaming;
type NonStreamParams = OpenAI.ChatCompletionCreateParamsNonStreaming;

export function isReasoningChatModel(model = getConfig().chatModel): boolean {
  const m = model.toLowerCase();
  return (
    /glm-?5|glm-4\.[5-9]|glm-4-/.test(m) ||
    /deepseek-r1|qwq|qwen3/.test(m) ||
    /(^|\/)(o1|o3|o4|gpt-5)/.test(m) ||
    /grok/.test(m)
  );
}

function reasoningEffort(): ReasoningEffort {
  const raw = String(process.env.CHAT_REASONING_EFFORT || "")
    .toLowerCase()
    .trim();
  if (raw === "low" || raw === "medium" || raw === "high" || raw === "max") {
    return raw;
  }
  return "low";
}

function providerExtras(): Record<string, unknown> {
  if (!isReasoningChatModel()) return {};
  const effort = reasoningEffort();
  return {
    reasoning_effort: effort,
    reasoning: { effort, exclude: true },
  };
}

export function stripReasoningMarkup(text: string): string {
  return String(text || "")
    .replace(/<think>[\s\S]*?<\/think>/gi, "")
    .replace(/<thinking>[\s\S]*?<\/thinking>/gi, "")
    .replace(/```(?:json)?\s*([\s\S]*?)```/gi, "$1")
    .trim();
}

export function visibleModelText(raw: string): string {
  let text = String(raw || "")
    .replace(/<think>[\s\S]*?<\/think>/gi, "")
    .replace(/<thinking>[\s\S]*?<\/thinking>/gi, "");
  const openThink = text.search(/<think(?:ing)?>/i);
  if (openThink >= 0) text = text.slice(0, openThink);
  return text;
}

export function streamDeltaContent(chunk: OpenAI.Chat.Completions.ChatCompletionChunk): string {
  const delta = chunk.choices[0]?.delta as { content?: string | null } | undefined;
  return typeof delta?.content === "string" ? delta.content : "";
}

export function parseModelJsonObject(raw: string): unknown {
  const text = stripReasoningMarkup(raw);
  if (!text) throw new Error("Model did not return JSON.");
  try {
    return JSON.parse(text);
  } catch {
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start >= 0 && end > start) {
      return JSON.parse(text.slice(start, end + 1));
    }
    throw new Error("Model did not return valid JSON.");
  }
}

function withModelOptions(params: Record<string, unknown>): Record<string, unknown> {
  const config = getConfig();
  const max = params.max_tokens ?? params.max_completion_tokens;
  return {
    ...params,
    model: (params.model as string | undefined) || config.chatModel,
    ...(typeof max === "number" ? { max_completion_tokens: max } : {}),
    ...providerExtras(),
  };
}

export function createChatCompletion(
  params: Omit<NonStreamParams, "model"> & { model?: string }
) {
  return getLLM().chat.completions.create(
    withModelOptions({ ...params, stream: false }) as unknown as NonStreamParams
  );
}

export function streamChatCompletion(
  params: Omit<StreamParams, "model" | "stream"> & { model?: string }
) {
  return getLLM().chat.completions.create(
    withModelOptions({ ...params, stream: true }) as unknown as StreamParams
  );
}
