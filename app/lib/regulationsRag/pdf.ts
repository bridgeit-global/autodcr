import fs from "node:fs/promises";
import pdfParse from "pdf-parse/lib/pdf-parse.js";
import { getConfig } from "./config";
import type { PdfChunk } from "./types";

export function splitText(
  text: string,
  chunkSize: number,
  overlap: number
): string[] {
  const clean = text.replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  if (!clean) return [];

  const chunks: string[] = [];
  let start = 0;
  while (start < clean.length) {
    let end = Math.min(start + chunkSize, clean.length);
    if (end < clean.length) {
      const slice = clean.slice(start, end);
      const breakAt = Math.max(
        slice.lastIndexOf("\n\n"),
        slice.lastIndexOf("\n"),
        slice.lastIndexOf(". "),
        slice.lastIndexOf(" ")
      );
      if (breakAt > chunkSize * 0.4) end = start + breakAt + 1;
    }
    const piece = clean.slice(start, end).trim();
    if (piece) chunks.push(piece);
    if (end >= clean.length) break;
    start = Math.max(0, end - overlap);
  }
  return chunks;
}

export async function extractPdf(pdfPathOrBuffer: string | Buffer): Promise<{
  text: string;
  pages: number;
}> {
  const buffer = Buffer.isBuffer(pdfPathOrBuffer)
    ? pdfPathOrBuffer
    : await fs.readFile(pdfPathOrBuffer);
  const data = await pdfParse(buffer);
  return {
    text: data.text || "",
    pages: data.numpages || 0,
  };
}

export function chunkWithMeta(
  text: string,
  source: string,
  numPages: number,
  extraMeta: Omit<Partial<PdfChunk>, "text" | "source" | "page"> = {}
): PdfChunk[] {
  const config = getConfig();
  const parts = text.includes("\f") ? text.split("\f") : [text];
  const records: PdfChunk[] = [];

  if (parts.length > 1) {
    parts.forEach((pageText, idx) => {
      const page = idx + 1;
      for (const chunk of splitText(
        pageText,
        config.chunkSize,
        config.chunkOverlap
      )) {
        records.push({ text: chunk, source, page, ...extraMeta });
      }
    });
    return records;
  }

  const chunks = splitText(text, config.chunkSize, config.chunkOverlap);
  const pages = Math.max(numPages || 1, 1);
  chunks.forEach((chunk, i) => {
    const page = Math.min(
      pages,
      Math.floor((i / Math.max(chunks.length, 1)) * pages) + 1
    );
    records.push({ text: chunk, source, page, ...extraMeta });
  });
  return records;
}
