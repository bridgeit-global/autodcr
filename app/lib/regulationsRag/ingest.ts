import fs from "node:fs/promises";
import path from "node:path";
import { assertApiKey, assertPinecone, getConfig } from "./config";
import { chunkWithMeta, extractPdf } from "./pdf";
import { lookupRegulation } from "./regulations";
import {
  countDocuments,
  deleteDocuments,
  embedTexts,
  ensureIndex,
  getLLM,
  saveStore,
} from "./vectorstore";
import type { PdfChunk, StoreRecord } from "./types";

async function listPdfFiles(dir: string): Promise<string[]> {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  return entries
    .filter((e) => e.isFile() && e.name.toLowerCase().endsWith(".pdf"))
    .map((e) => path.join(dir, e.name))
    .sort();
}

export async function ingest({
  force = false,
  only = null,
}: {
  force?: boolean;
  only?: string[] | null;
} = {}): Promise<void> {
  const config = getConfig();
  assertApiKey(config);
  assertPinecone(config);
  await ensureIndex();

  let pdfPaths = await listPdfFiles(config.docsDir);
  if (only?.length) {
    const wanted = new Set(only.map((n) => n.toLowerCase()));
    pdfPaths = pdfPaths.filter((p) =>
      wanted.has(path.basename(p).toLowerCase())
    );
  }
  if (!pdfPaths.length) {
    throw new Error(
      only?.length
        ? `No matching PDFs for --only=${only.join(",")}`
        : `No PDF files found in ${config.docsDir}`
    );
  }

  const sourceNames = pdfPaths.map((p) => path.basename(p));
  const existing = await countDocuments(only?.length ? sourceNames : null);

  if (!force && existing > 0) {
    console.log(
      `Pinecone already has ${existing} document chunk(s)` +
        (only?.length ? ` for selected sources` : "") +
        `.\nRe-index with: npm run ingest:regulations -- --force` +
        (only?.length ? ` --only=${only.join(",")}` : "")
    );
    return;
  }

  if (force && existing > 0) {
    console.log(
      `Clearing ${existing} existing chunk(s)` +
        (only?.length ? ` for: ${sourceNames.join(", ")}` : " (all)") +
        "…"
    );
    await deleteDocuments({ sources: only?.length ? sourceNames : null });
  }

  console.log(`Found ${pdfPaths.length} PDF(s) in ${config.docsDir}`);
  const chunks: PdfChunk[] = [];

  for (const pdfPath of pdfPaths) {
    const name = path.basename(pdfPath);
    const meta = lookupRegulation(name);
    console.log(
      `Loading: ${name} → ${meta.authority}/${meta.docType} (${meta.title})`
    );
    try {
      const { text, pages } = await extractPdf(pdfPath);
      const docs = chunkWithMeta(text, name, pages, {
        authority: meta.authority,
        docType: meta.docType,
        areas: meta.areas,
        title: meta.title,
      });
      console.log(`  → ${pages} page(s), ${docs.length} chunk(s)`);
      chunks.push(...docs);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.warn(`  Skipping ${name}: ${message}`);
    }
  }

  if (!chunks.length) {
    throw new Error("No text extracted from PDFs.");
  }

  console.log(
    `Embedding ${chunks.length} chunks with ${config.embedModel} (${config.embedDimensions}d)…`
  );
  const llm = getLLM();
  const embeddings = await embedTexts(
    llm,
    chunks.map((c) => c.text),
    { verbose: true }
  );

  const records: StoreRecord[] = chunks.map((c, i) => ({
    text: c.text,
    source: c.source,
    page: c.page,
    authority: c.authority,
    docType: c.docType,
    areas: c.areas,
    title: c.title,
    embedding: embeddings[i],
  }));

  console.log(`Uploading embeddings to Pinecone (${config.pineconeIndex})…`);
  await saveStore(records, { verbose: true });
  console.log(`Saved ${records.length} chunks to Pinecone.`);
}
