/**
 * Generic AI extraction engine using Vercel AI SDK + Google Gemini.
 */
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { generateObject } from "ai";
import type { z } from "zod";
import type { DocumentDefinition } from "./schema";

const DEFAULT_MODEL = "gemini-flash-latest";

function getGeminiProvider() {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error(
      "GEMINI_API_KEY is not set. Add it to .env.local. Get a free key at https://aistudio.google.com/apikey"
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
