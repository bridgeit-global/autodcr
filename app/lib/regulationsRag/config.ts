import path from "node:path";

export type LlmProviderName = "ai-gateway" | "openrouter";

type ProviderResolved = {
  name: LlmProviderName;
  apiKey: string;
  baseURL: string;
  defaultHeaders: Record<string, string> | undefined;
  keyName: string;
  keyHelp: string;
};

export type RagConfig = {
  llmProvider: LlmProviderName;
  apiKey: string;
  baseURL: string;
  defaultHeaders: Record<string, string> | undefined;
  chatModel: string;
  embedModel: string;
  embedDimensions: number;
  docsDir: string;
  chunkSize: number;
  chunkOverlap: number;
  topK: number;
  maxTokens: number;
  embedBatchSize: number;
  pineconeApiKey: string;
  pineconeIndex: string;
  pineconeNamespace: string;
  pineconeCloud: string;
  pineconeRegion: string;
  pineconeUpsertBatchSize: number;
  complianceTopK: number;
  complianceMaxTokens: number;
  uploadMaxMb: number;
  keyName: string;
  keyHelp: string;
};

function resolveProvider(raw: string | undefined): ProviderResolved {
  const value = String(raw || "ai-gateway")
    .toLowerCase()
    .trim();
  if (["openrouter", "or"].includes(value)) {
    return {
      name: "openrouter",
      apiKey: process.env.OPENROUTER_API_KEY || process.env.OPENAI_API_KEY || "",
      baseURL:
        process.env.OPENROUTER_BASE_URL ||
        process.env.OPENAI_BASE_URL ||
        "https://openrouter.ai/api/v1",
      defaultHeaders: {
        "HTTP-Referer":
          process.env.OPENROUTER_SITE_URL || "http://localhost:3000",
        "X-Title": process.env.OPENROUTER_SITE_NAME || "autodcr",
      },
      keyName: "OPENROUTER_API_KEY",
      keyHelp: "Get one at https://openrouter.ai/ and set it in .env",
    };
  }
  if (["ai-gateway", "aigateway", "vercel", "gateway"].includes(value)) {
    return {
      name: "ai-gateway",
      apiKey:
        process.env.AI_GATEWAY_API_KEY ||
        process.env.VERCEL_OIDC_TOKEN ||
        process.env.OPENAI_API_KEY ||
        "",
      baseURL:
        process.env.AI_GATEWAY_BASE_URL ||
        process.env.OPENAI_BASE_URL ||
        "https://ai-gateway.vercel.sh/v1",
      defaultHeaders: undefined,
      keyName: "AI_GATEWAY_API_KEY",
      keyHelp:
        "Create one at https://vercel.com/d?to=%2F%5Bteam%5D%2F%7E%2Fai-gateway%2Fapi-keys and set it in .env",
    };
  }
  throw new Error(
    `Unknown LLM_PROVIDER "${raw}". Use "ai-gateway" or "openrouter".`
  );
}

export function getConfig(): RagConfig {
  const llmProvider = resolveProvider(process.env.LLM_PROVIDER);
  return {
    llmProvider: llmProvider.name,
    apiKey: llmProvider.apiKey,
    baseURL: llmProvider.baseURL,
    defaultHeaders: llmProvider.defaultHeaders,
    chatModel:
      process.env.CHAT_MODEL ||
      process.env.OPENAI_CHAT_MODEL ||
      "z-ai/glm-5.3-flash",
    embedModel:
      process.env.EMBED_MODEL ||
      process.env.OPENAI_EMBED_MODEL ||
      "openai/text-embedding-3-small",
    embedDimensions: Number(process.env.EMBED_DIMENSIONS || 1536),
    docsDir: path.resolve(process.cwd(), process.env.DOCS_DIR || "doc"),
    chunkSize: Number(process.env.CHUNK_SIZE || 1000),
    chunkOverlap: Number(process.env.CHUNK_OVERLAP || 200),
    topK: Number(process.env.TOP_K || 5),
    maxTokens: Number(process.env.MAX_TOKENS || 1024),
    embedBatchSize: Number(process.env.EMBED_BATCH_SIZE || 16),
    pineconeApiKey: process.env.PINECONE_API_KEY || "",
    pineconeIndex: process.env.PINECONE_INDEX || "rag-poc-openai",
    pineconeNamespace: process.env.PINECONE_NAMESPACE || "default",
    pineconeCloud: process.env.PINECONE_CLOUD || "aws",
    pineconeRegion: process.env.PINECONE_REGION || "ap-south-1",
    pineconeUpsertBatchSize: Number(process.env.PINECONE_UPSERT_BATCH || 100),
    complianceTopK: Number(process.env.COMPLIANCE_TOP_K || 8),
    complianceMaxTokens: Number(process.env.COMPLIANCE_MAX_TOKENS || 4096),
    uploadMaxMb: Number(process.env.UPLOAD_MAX_MB || 25),
    keyName: llmProvider.keyName,
    keyHelp: llmProvider.keyHelp,
  };
}

export function assertApiKey(cfg = getConfig()) {
  if (
    !cfg.apiKey ||
    cfg.apiKey.includes("your-key") ||
    cfg.apiKey.includes("REPLACE") ||
    cfg.apiKey.includes("sk-your")
  ) {
    throw new Error(`Missing ${cfg.keyName}. ${cfg.keyHelp}`);
  }
}

export function assertPinecone(cfg = getConfig()) {
  if (!cfg.pineconeApiKey || cfg.pineconeApiKey.includes("REPLACE")) {
    throw new Error(
      "Missing PINECONE_API_KEY. Get one at https://app.pinecone.io/ and set it in .env"
    );
  }
}

export function ragErrorStatus(err: unknown, extraPattern?: RegExp): number {
  const message = err instanceof Error ? err.message : String(err);
  const base =
    /AI_GATEWAY_API_KEY|OPENROUTER_API_KEY|OPENAI_API_KEY|LLM_PROVIDER|PINECONE_|required|No vector/i;
  if (base.test(message) || extraPattern?.test(message)) return 400;
  return 500;
}
