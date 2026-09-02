export const REASONING_EFFORTS = ["none", "low", "medium", "high", "max"] as const;
export type ReasoningEffort = (typeof REASONING_EFFORTS)[number];

export type ChatModelOption = {
  id: string;
  label: string;
  provider: string;
  description: string;
  reasoning: boolean;
  thinking: boolean;
  thinkingBudget?: boolean;
};

export type ChatLlmOptions = {
  model: string;
  reasoningEffort: ReasoningEffort;
  thinking: boolean;
};

export const DEFAULT_CHAT_MODEL = "z-ai/glm-5.3-flash";

export const CHAT_MODELS: ChatModelOption[] = [
  {
    id: "z-ai/glm-5.3-flash",
    label: "GLM 5.3 Flash",
    provider: "Zhipu",
    description: "Fast reasoning model for regulation answers",
    reasoning: true,
    thinking: true,
  },
  {
    id: "google/gemini-2.5-flash",
    label: "Gemini 2.5 Flash",
    provider: "Google",
    description: "Fast answers with optional thinking",
    reasoning: true,
    thinking: true,
    thinkingBudget: true,
  },
  {
    id: "google/gemini-2.5-pro",
    label: "Gemini 2.5 Pro",
    provider: "Google",
    description: "Stronger analysis with thinking levels",
    reasoning: true,
    thinking: true,
    thinkingBudget: true,
  },
  {
    id: "openai/gpt-4o-mini",
    label: "GPT-4o mini",
    provider: "OpenAI",
    description: "Lightweight chat without reasoning controls",
    reasoning: false,
    thinking: false,
  },
  {
    id: "openai/gpt-4o",
    label: "GPT-4o",
    provider: "OpenAI",
    description: "General-purpose chat without reasoning controls",
    reasoning: false,
    thinking: false,
  },
  {
    id: "openai/gpt-5-mini",
    label: "GPT-5 mini",
    provider: "OpenAI",
    description: "Smaller GPT-5 with reasoning effort",
    reasoning: true,
    thinking: true,
  },
  {
    id: "anthropic/claude-sonnet-4",
    label: "Claude Sonnet 4",
    provider: "Anthropic",
    description: "Extended thinking with a token budget",
    reasoning: true,
    thinking: true,
    thinkingBudget: true,
  },
  {
    id: "deepseek/deepseek-r1",
    label: "DeepSeek R1",
    provider: "DeepSeek",
    description: "Reasoning-first model",
    reasoning: true,
    thinking: true,
  },
  {
    id: "x-ai/grok-4",
    label: "Grok 4",
    provider: "xAI",
    description: "Reasoning effort control",
    reasoning: true,
    thinking: true,
  },
  {
    id: "qwen/qwen3-235b-a22b",
    label: "Qwen3 235B",
    provider: "Alibaba",
    description: "Large Qwen model with thinking",
    reasoning: true,
    thinking: true,
    thinkingBudget: true,
  },
];

export const REASONING_EFFORT_OPTIONS: { value: ReasoningEffort; label: string }[] = [
  { value: "none", label: "Off" },
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "max", label: "Max" },
];

export const THINKING_OPTIONS: { value: "off" | "on"; label: string }[] = [
  { value: "off", label: "Off" },
  { value: "on", label: "On" },
];

export function getChatModel(id: string | undefined): ChatModelOption | undefined {
  const model = String(id || "").trim();
  if (!model) return undefined;
  return CHAT_MODELS.find((item) => item.id === model);
}

export function modelSupportsReasoning(model: string | undefined): boolean {
  const spec = getChatModel(model);
  if (spec) return spec.reasoning;
  const m = String(model || "").toLowerCase();
  return (
    /glm-?5|glm-4\.[5-9]|glm-4-/.test(m) ||
    /deepseek-r1|qwq|qwen3/.test(m) ||
    /(^|\/)(o1|o3|o4|gpt-5)/.test(m) ||
    /grok/.test(m) ||
    /gemini-2\.[5-9]|gemini-3/.test(m) ||
    /claude/.test(m)
  );
}

export function modelSupportsThinking(model: string | undefined): boolean {
  const spec = getChatModel(model);
  if (spec) return spec.thinking;
  return modelSupportsReasoning(model);
}

export function modelSupportsThinkingBudget(model: string | undefined): boolean {
  const spec = getChatModel(model);
  if (spec) return Boolean(spec.thinkingBudget);
  const m = String(model || "").toLowerCase();
  return /gemini|claude|qwen3/.test(m);
}

export function parseChatModelId(raw: unknown): string | undefined {
  const id = String(raw || "").trim();
  if (!id) return undefined;
  return getChatModel(id)?.id;
}

export function parseReasoningEffort(raw: unknown): ReasoningEffort | undefined {
  const value = String(raw || "")
    .toLowerCase()
    .trim();
  return REASONING_EFFORTS.find((item) => item === value);
}

export function parseThinking(raw: unknown): boolean | undefined {
  if (typeof raw === "boolean") return raw;
  const value = String(raw || "")
    .toLowerCase()
    .trim();
  if (!value) return undefined;
  if (["1", "true", "on", "yes"].includes(value)) return true;
  if (["0", "false", "off", "no"].includes(value)) return false;
  return undefined;
}

export function withServerDefaultModel(serverModel: string | undefined): ChatModelOption[] {
  const id = String(serverModel || "").trim();
  if (!id || getChatModel(id)) return CHAT_MODELS;
  return [
    {
      id,
      label: id.split("/").pop() || id,
      provider: "Server",
      description: "Current server default",
      reasoning: modelSupportsReasoning(id),
      thinking: modelSupportsThinking(id),
      thinkingBudget: modelSupportsThinkingBudget(id),
    },
    ...CHAT_MODELS,
  ];
}

export function effortToThinkingBudget(effort: ReasoningEffort): number {
  switch (effort) {
    case "max":
      return 16000;
    case "high":
      return 8000;
    case "medium":
      return 4000;
    case "low":
      return 2000;
    default:
      return 1024;
  }
}
