import { Pinecone, type Index } from "@pinecone-database/pinecone";
import OpenAI from "openai";
import { assertPinecone, getConfig } from "./config";
import type { SearchHit, StoreRecord } from "./types";

type RagMetadata = {
  text: string;
  source: string;
  page: number;
  authority: string;
  docType: string;
  areas: string;
  title: string;
};

let pinecone: Pinecone | undefined;
let index: Index<RagMetadata> | undefined;
let llm: OpenAI | undefined;
let indexReady: Promise<Index<RagMetadata>> | undefined;

export function getLLM(): OpenAI {
  if (!llm) {
    const config = getConfig();
    llm = new OpenAI({
      apiKey: config.apiKey,
      baseURL: config.baseURL,
      ...(config.defaultHeaders
        ? { defaultHeaders: config.defaultHeaders }
        : {}),
    });
  }
  return llm;
}

export function getOpenAI(): OpenAI {
  return getLLM();
}

export function getPinecone(): Pinecone {
  const config = getConfig();
  assertPinecone(config);
  if (!pinecone) {
    pinecone = new Pinecone({ apiKey: config.pineconeApiKey });
  }
  return pinecone;
}

export function sourceKey(source: string): string {
  return String(source).replace(/[^a-zA-Z0-9._-]/g, "_");
}

function logProgress(message: string, verbose: boolean) {
  if (!verbose) return;
  process.stdout.write(message);
}

export async function ensureIndex(): Promise<Index<RagMetadata>> {
  if (indexReady) return indexReady;

  indexReady = (async () => {
    const config = getConfig();
    const pc = getPinecone();
    const name = config.pineconeIndex;

    try {
      await pc.describeIndex(name);
    } catch {
      console.log(
        `Creating Pinecone index "${name}" (${config.embedDimensions}d, cosine)…`
      );
      await pc.createIndex({
        name,
        dimension: config.embedDimensions,
        metric: "cosine",
        spec: {
          serverless: {
            cloud: config.pineconeCloud,
            region: config.pineconeRegion,
          },
        },
        waitUntilReady: true,
      });
    }

    index = pc.index<RagMetadata>({
      name,
      namespace: config.pineconeNamespace,
    });
    return index;
  })();

  return indexReady;
}

export async function getIndex(): Promise<Index<RagMetadata>> {
  return ensureIndex();
}

export async function embedTexts(
  client: OpenAI,
  texts: string[],
  { verbose = false }: { verbose?: boolean } = {}
): Promise<number[][]> {
  const config = getConfig();
  const vectors: number[][] = [];
  for (let i = 0; i < texts.length; i += config.embedBatchSize) {
    const batch = texts.slice(i, i + config.embedBatchSize);
    const payload: {
      model: string;
      input: string[];
      encoding_format: "float";
      dimensions?: number;
    } = {
      model: config.embedModel,
      input: batch,
      encoding_format: "float",
    };
    if (config.embedDimensions > 0) {
      payload.dimensions = config.embedDimensions;
    }
    const res = await client.embeddings.create(payload);
    const sorted = res.data.slice().sort((x, y) => x.index - y.index);
    for (const item of sorted) {
      if (
        config.embedDimensions > 0 &&
        item.embedding.length !== config.embedDimensions
      ) {
        vectors.push(item.embedding.slice(0, config.embedDimensions));
      } else {
        vectors.push(item.embedding);
      }
    }
    logProgress(
      `\r  Embedded ${Math.min(i + batch.length, texts.length)}/${texts.length}`,
      verbose
    );
  }
  if (texts.length && verbose) process.stdout.write("\n");
  return vectors;
}

async function listIdsByPrefix(prefix: string): Promise<string[]> {
  const idx = await getIndex();
  const ids: string[] = [];
  let paginationToken: string | undefined;

  do {
    const page = await idx.listPaginated({
      prefix,
      limit: 100,
      ...(paginationToken ? { paginationToken } : {}),
    });
    for (const v of page.vectors || []) {
      if (v.id) ids.push(v.id);
    }
    paginationToken = page.pagination?.next;
  } while (paginationToken);

  return ids;
}

export async function countDocuments(
  sources: string[] | null = null
): Promise<number> {
  const config = getConfig();
  const idx = await getIndex();

  if (!sources?.length) {
    const stats = await idx.describeIndexStats();
    const ns =
      stats.namespaces?.[config.pineconeNamespace] ||
      stats.namespaces?.[""] ||
      null;
    return ns?.recordCount ?? stats.totalRecordCount ?? 0;
  }

  let total = 0;
  for (const source of sources) {
    const ids = await listIdsByPrefix(`${sourceKey(source)}#`);
    total += ids.length;
  }
  return total;
}

export async function storeExists(): Promise<boolean> {
  return (await countDocuments()) > 0;
}

export async function deleteDocuments({
  sources = null,
}: {
  sources?: string[] | null;
} = {}): Promise<void> {
  const idx = await getIndex();

  if (!sources?.length) {
    await idx.deleteAll();
    return;
  }

  for (const source of sources) {
    const ids = await listIdsByPrefix(`${sourceKey(source)}#`);
    for (let i = 0; i < ids.length; i += 1000) {
      const batch = ids.slice(i, i + 1000);
      if (batch.length) await idx.deleteMany({ ids: batch });
    }
  }
}

export async function saveStore(
  records: StoreRecord[],
  { verbose = false }: { verbose?: boolean } = {}
): Promise<void> {
  const config = getConfig();
  const idx = await getIndex();
  const batchSize = config.pineconeUpsertBatchSize;

  for (let i = 0; i < records.length; i += batchSize) {
    const batch = records.slice(i, i + batchSize).map((r, j) => {
      const n = i + j;
      return {
        id: `${sourceKey(r.source)}#${n}`,
        values: r.embedding,
        metadata: {
          text: r.text,
          source: r.source,
          page: r.page ?? 0,
          authority: r.authority || "unknown",
          docType: r.docType || "regulation",
          areas: Array.isArray(r.areas) ? r.areas.join(",") : r.areas || "",
          title: r.title || r.source,
        },
      };
    });

    await idx.upsert({ records: batch });
    logProgress(
      `\r  Uploaded ${Math.min(i + batch.length, records.length)}/${records.length}`,
      verbose
    );
  }
  if (records.length && verbose) process.stdout.write("\n");
}

export function authorityFilter(authorities: string[] | null | undefined) {
  if (!authorities?.length) return undefined;
  if (authorities.length === 1) return { authority: { $eq: authorities[0] } };
  return { authority: { $in: authorities } };
}

export async function similaritySearch(
  queryEmbedding: number[],
  topK = getConfig().topK,
  { authorities = null }: { authorities?: string[] | null } = {}
): Promise<SearchHit[]> {
  const idx = await getIndex();
  const filter = authorityFilter(authorities);
  const result = await idx.query({
    vector: queryEmbedding,
    topK,
    includeMetadata: true,
    ...(filter ? { filter } : {}),
  });

  return (result.matches || []).map((m) => ({
    id: m.id,
    text: m.metadata?.text || "",
    source: m.metadata?.source || "",
    page: m.metadata?.page ?? null,
    authority: m.metadata?.authority || null,
    docType: m.metadata?.docType || null,
    title: m.metadata?.title || null,
    score: m.score,
  }));
}
