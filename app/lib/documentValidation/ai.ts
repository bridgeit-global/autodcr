/**
 * Generic AI extraction engine using Vercel AI SDK + Google Gemini.
 */
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { generateObject } from "ai";
import type { z } from "zod";
import type { DocumentDefinition } from "./types";

const DEFAULT_MODEL = "gemini-flash-latest";

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

export async function extractDocument<T extends z.ZodTypeAny>(
  definition: DocumentDefinition<T>,
  documentText: string
): Promise<z.infer<T>> {
  const google = getGeminiProvider();

  const { object } = await generateObject({
    model: google(getModelName()),
    schema: definition.schema,
    prompt: definition.buildPrompt(documentText),
  });

  if (!object) {
    throw new Error(
      `AI extraction failed: no structured object was generated for ${definition.label}.`
    );
  }

  return object as z.infer<T>;
}

export type DocumentMediaInput = {
  data: Buffer;
  mediaType: string;
};

/**
 * Multimodal extraction for images / scanned PDFs.
 * Existing text-only extractDocument() is unchanged for Architect Letter.
 */
export async function extractDocumentFromMedia<T extends z.ZodTypeAny>(
  definition: DocumentDefinition<T>,
  media: DocumentMediaInput,
  documentText = ""
): Promise<z.infer<T>> {
  const google = getGeminiProvider();
  const prompt = definition.buildPrompt(documentText);

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

  const { object } = await generateObject({
    model: google(getModelName()),
    schema: definition.schema,
    messages: [{ role: "user", content }],
  });

  if (!object) {
    throw new Error(
      `AI extraction failed: no structured object was generated for ${definition.label}.`
    );
  }

  return object as z.infer<T>;
}
