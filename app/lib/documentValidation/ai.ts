/**
 * Generic AI extraction engine using Vercel AI SDK + Google Gemini.
 */
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { generateObject, NoObjectGeneratedError } from "ai";
import type { z } from "zod";
import type { DocumentDefinition } from "./types";

const DEFAULT_MODEL = "gemini-flash-latest";
const MAX_DOCUMENT_TEXT_CHARS = 80_000;

function getGeminiProvider() {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error(
      "GEMINI_API_KEY is not set. Add it to .env.local. Get a key at https://aistudio.google.com/apikey"
    );
  }

  return createGoogleGenerativeAI({ apiKey });
}

function getModelName(): string {
  return process.env.GEMINI_MODEL ?? DEFAULT_MODEL;
}

export function truncateDocumentText(documentText: string): string {
  const trimmed = documentText.trim();
  if (trimmed.length <= MAX_DOCUMENT_TEXT_CHARS) return trimmed;

  const head = trimmed.slice(0, 60_000);
  const tail = trimmed.slice(-15_000);
  return `${head}\n\n...[document text truncated for extraction]...\n\n${tail}`;
}

function formatExtractionError(error: unknown, label: string): Error {
  if (NoObjectGeneratedError.isInstance(error)) {
    const detail = error.cause instanceof Error ? error.cause.message : error.message;
    return new Error(
      `Could not extract structured data from ${label}. ${detail}`
    );
  }

  if (error instanceof Error) {
    return new Error(`AI extraction failed for ${label}: ${error.message}`);
  }

  return new Error(`AI extraction failed for ${label}.`);
}

async function runGenerateObject<T extends z.ZodTypeAny>(
  definition: DocumentDefinition<T>,
  options: Parameters<typeof generateObject>[0]
): Promise<z.infer<T>> {
  try {
    const { object } = await generateObject({
      maxRetries: 4,
      temperature: 0,
      schemaName: definition.id.replace(/[^a-zA-Z0-9_-]/g, "_"),
      schemaDescription: definition.label,
      ...options,
    });

    if (!object) {
      throw new Error(
        `AI extraction failed: no structured object was generated for ${definition.label}.`
      );
    }

    return object as z.infer<T>;
  } catch (error) {
    throw formatExtractionError(error, definition.label);
  }
}

export async function extractDocument<T extends z.ZodTypeAny>(
  definition: DocumentDefinition<T>,
  documentText: string
): Promise<z.infer<T>> {
  const google = getGeminiProvider();
  const prompt = definition.buildPrompt(truncateDocumentText(documentText));

  return runGenerateObject(definition, {
    model: google(getModelName()),
    schema: definition.schema,
    prompt,
  });
}

export type DocumentMediaInput = {
  data: Buffer;
  mediaType: string;
};

/**
 * Multimodal extraction for images / scanned PDFs.
 */
export async function extractDocumentFromMedia<T extends z.ZodTypeAny>(
  definition: DocumentDefinition<T>,
  media: DocumentMediaInput,
  documentText = ""
): Promise<z.infer<T>> {
  const google = getGeminiProvider();
  const prompt = definition.buildPrompt(truncateDocumentText(documentText));

  const content: Array<
    | { type: "text"; text: string }
    | { type: "image"; image: Buffer }
    | { type: "file"; data: Buffer; mediaType: string }
  > = [{ type: "text", text: prompt }];

  if (media.mediaType.startsWith("image/")) {
    content.push({ type: "image", image: media.data });
  } else {
    content.push({
      type: "file",
      data: media.data,
      mediaType: media.mediaType,
    });
  }

  return runGenerateObject(definition, {
    model: google(getModelName()),
    schema: definition.schema,
    messages: [{ role: "user", content }],
  });
}
