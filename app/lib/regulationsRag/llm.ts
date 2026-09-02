import type OpenAI from "openai";
import {
  effortToThinkingBudget,
  getChatModel,
  modelSupportsReasoning,
  modelSupportsThinking,
  modelSupportsThinkingBudget,
  parseChatModelId,
  parseReasoningEffort,
  parseThinking,
  type ChatLlmOptions,
  type ReasoningEffort,
} from "./chatModels";
import { getConfig } from "./config";
import { getLLM } from "./vectorstore";

export type { ChatLlmOptions, ReasoningEffort };

type StreamParams = OpenAI.ChatCompletionCreateParamsStreaming;
type NonStreamParams = OpenAI.ChatCompletionCreateParamsNonStreaming;

export function isReasoningChatModel(model = getConfig().chatModel): boolean {
  return modelSupportsReasoning(model);
}

export function envReasoningEffort(): ReasoningEffort {
  return parseReasoningEffort(process.env.CHAT_REASONING_EFFORT) || "low";
}

export function resolveChatLlmOptions(
  input: {
    model?: unknown;
    reasoningEffort?: unknown;
    thinking?: unknown;
  } = {}
): ChatLlmOptions {
  const config = getConfig();
  const model = parseChatModelId(input.model) || config.chatModel;
  const spec = getChatModel(model);
  const supportsReason = spec?.reasoning ?? modelSupportsReasoning(model);
  const supportsThinking = spec?.thinking ?? modelSupportsThinking(model);
  return {
    model,
    reasoningEffort: supportsReason
      ? parseReasoningEffort(input.reasoningEffort) || envReasoningEffort()
      : "none",
    thinking: supportsThinking ? Boolean(parseThinking(input.thinking) ?? false) : false,
  };
}

function providerExtras(
  model: string,
  options?: Partial<ChatLlmOptions>
): Record<string, unknown> {
  const spec = getChatModel(model);
  const supportsReason = spec?.reasoning ?? modelSupportsReasoning(model);
  const supportsThinking = spec?.thinking ?? modelSupportsThinking(model);
  if (!supportsReason && !supportsThinking) return {};

  const effort = options?.reasoningEffort ?? envReasoningEffort();
  const thinking = Boolean(options?.thinking);
  const enabled = thinking || (supportsReason && effort !== "none");
  if (!enabled) {
    return {
      reasoning: { enabled: false, effort: "none", exclude: true },
    };
  }

  // OpenRouter/AI Gateway: only one of reasoning.effort or reasoning.max_tokens.
  const useTokenBudget = modelSupportsThinkingBudget(model);
  const reasoning: Record<string, unknown> = {
    exclude: !thinking,
  };
  if (useTokenBudget) {
    reasoning.max_tokens = effortToThinkingBudget(effort);
  } else if (supportsReason && effort !== "none") {
    reasoning.effort = effort;
  } else {
    reasoning.enabled = true;
  }

  return { reasoning };
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

function withModelOptions(
  params: Record<string, unknown>,
  options?: Partial<ChatLlmOptions>
): Record<string, unknown> {
  const config = getConfig();
  const model =
    options?.model || (params.model as string | undefined) || config.chatModel;
  const extras = providerExtras(model, options);
  const requestedMax = params.max_tokens ?? params.max_completion_tokens;
  const thinkingBudget =
    typeof (extras.reasoning as { max_tokens?: number } | undefined)?.max_tokens ===
    "number"
      ? (extras.reasoning as { max_tokens: number }).max_tokens
      : 0;
  const max =
    typeof requestedMax === "number"
      ? Math.max(requestedMax, thinkingBudget ? thinkingBudget + 2048 : requestedMax)
      : requestedMax;
  return {
    ...params,
    model,
    ...(typeof max === "number" ? { max_completion_tokens: max } : {}),
    ...extras,
  };
}

export function createChatCompletion(
  params: Omit<NonStreamParams, "model"> & { model?: string },
  options?: Partial<ChatLlmOptions>
) {
  return getLLM().chat.completions.create(
    withModelOptions({ ...params, stream: false }, options) as unknown as NonStreamParams
  );
}

export function streamChatCompletion(
  params: Omit<StreamParams, "model" | "stream"> & { model?: string },
  options?: Partial<ChatLlmOptions>
) {
  return getLLM().chat.completions.create(
    withModelOptions({ ...params, stream: true }, options) as unknown as StreamParams
  );
}
