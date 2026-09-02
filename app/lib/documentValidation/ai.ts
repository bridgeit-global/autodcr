/**
 * Generic AI extraction engine using Vercel AI SDK + OpenRouter.
 */
import { createOpenAI } from "@ai-sdk/openai";
import { generateObject, NoObjectGeneratedError } from "ai";
import { z } from "zod";
import type { DocumentDefinition } from "./types";
import type { DocumentType } from "./registry";

const DEFAULT_MODEL = "google/gemini-2.5-flash";
const MAX_DOCUMENT_TEXT_CHARS = 80_000;

const CLASSIFY_TYPE_HINTS: Partial<Record<DocumentType, string>> = {
  aadhaar:
    "Indian Aadhaar / UIDAI identity card or e-Aadhaar (आधार) — 12-digit Aadhaar number, QR code, UIDAI branding",
  pan: "Indian PAN card issued by Income Tax Department — Permanent Account Number (10-char alphanumeric), Income Tax Dept / NSDL / Protean branding",
  "entity-pan":
    "Entity/firm/LLP PAN card — organization name (not individual), Income Tax Department PAN for company/LLP/partnership",
  "gst-certificate":
    "GST Registration Certificate (Form GST REG-06) — GSTIN, Legal Name, Address of Principal Place of Business",
  "llp-incorporation-certificate":
    "Certificate of Incorporation for Limited Liability Partnership (LLP) — LLPIN, LLP name, incorporation date from MCA",
  "signatory-photo":
    "Standalone passport-style portrait / headshot photo of a person (authorized signatory photograph) — face photo only, NOT a document scan or signature",
  "signatory-signature":
    "Standalone handwritten signature image (authorized signatory signature) — cursive sign on plain or dark background, NOT a face photo or full document",
  "technical-person-license":
    "Technical person / professional license or registration certificate (architect, surveyor, engineer, COA, municipal license, etc.) — not Aadhaar or PAN",
  "pr-card":
    "Property Register Card / PR Card / PRC / मालमत्ता पत्रक — City Survey register with CTS numbers, holder/owner name, area in sq.m.",
  "dp-remarks":
    "D.P. Remarks LETTER only (BMC/MCGM Development Plan remarks letter/report) — titled DP 2034 Remarks or Remark_Report, with CTS/zone/reservation table and applicant letter. NOT a map or road-line plan.",
  "dp-remarks-map":
    "D.P. Remarks Map Plan — BMC Development Plan BLOCK PLAN / LOCATION PLAN (Map_Report). Esri/ArcGIS map to be read with the DP remarks letter. Not the remarks letter itself, even if the map mentions DP Remarks.",
  "dp-remarks-rl":
    "D.P. Remarks Road Line Plan — BMC DP Traffic RoadLines / Survey RoadLines sheet (RL_Report). Companion to the DP remarks letter, not the letter itself.",
  "crz-remarks":
    "C.R.Z. Remarks / Coastal Regulation Zone remarks (CZMP) — CRZ I/II/III/IV category for a plot. Includes the remarks letter even when an accompanying site plan is attached. Not a DP Map Plan.",
  "power-of-attorney":
    "Power of Attorney (POA) — legal deed granting authority over property (principal / attorney names, property details)",
};

function getDocumentLlmProvider() {
  const apiKey = process.env.OPENROUTER_API_KEY;

  if (!apiKey) {
    throw new Error(
      "OPENROUTER_API_KEY is not set. Add it to .env.local. Get a key at https://openrouter.ai/keys"
    );
  }

  return createOpenAI({
    apiKey,
    baseURL:
      process.env.OPENROUTER_BASE_URL ?? "https://openrouter.ai/api/v1",
    headers: {
      "HTTP-Referer":
        process.env.OPENROUTER_SITE_URL ?? "http://localhost:3000",
      "X-Title": process.env.OPENROUTER_SITE_NAME ?? "autodcr",
    },
  });
}

function getModelName(): string {
  return process.env.DOCUMENT_LLM_MODEL ?? DEFAULT_MODEL;
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
  const provider = getDocumentLlmProvider();
  const prompt = definition.buildPrompt(truncateDocumentText(documentText));

  return runGenerateObject(definition, {
    model: provider(getModelName()),
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
  const provider = getDocumentLlmProvider();
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
    model: provider(getModelName()),
    schema: definition.schema,
    messages: [{ role: "user", content }],
  });
}

export type ClassifyDocumentResult = {
  documentType: DocumentType | "unknown";
  confidence: "high" | "medium" | "low";
};

/**
 * Classify an identity / registration document into one of the allowed types.
 */
export async function classifyDocumentType(
  media: DocumentMediaInput,
  allowedTypes: DocumentType[],
  documentText = ""
): Promise<ClassifyDocumentResult> {
  if (allowedTypes.length === 0) {
    throw new Error("classifyDocumentType requires at least one allowed type.");
  }

  const typeOptions = [...allowedTypes, "unknown"] as unknown as [
    string,
    ...string[],
  ];
  const schema = z.object({
    documentType: z.enum(typeOptions),
    confidence: z.enum(["high", "medium", "low"]),
  });

  const typeList = allowedTypes
    .map((id) => `- "${id}": ${CLASSIFY_TYPE_HINTS[id] ?? id}`)
    .join("\n");

  const prompt = `You are classifying an Indian municipal, property, or registration document.

Choose exactly one documentType from this list (use the id string only):
${typeList}
- "unknown": the document is none of the above, unreadable, or ambiguous

Rules:
- Prefer the most specific match among the allowed types only.
- Aadhaar is never PAN and never a professional license.
- PAN cards show a Permanent Account Number (format like ABCDE1234F).
- Technical person licenses are professional registration / license certificates (architect, surveyor, structural engineer, etc.).
- Property Register Card (pr-card) shows CTS / city survey numbers and plot area columns — not DP or CRZ remarks forms.
- Ignore the original filename; classify only from the document content.
- If the document is a C.R.Z. / CZMP remarks report (title CRZ Remarks, CRZ I–IV table), type is "crz-remarks" even when later pages include a site plan.
- "dp-remarks" is only the Development Plan remarks LETTER (tabular remarks / "DP 2034 Remarks" report). Map plans and road-line sheets are not the letter.
- "dp-remarks-map" is a DP BLOCK PLAN / LOCATION PLAN sheet that is not CRZ and not the remarks letter — even if the map mentions "DP Remarks".
- "dp-remarks-rl" is a Traffic/Survey RoadLines sheet, not the remarks letter.
- C.R.Z. Remarks are Coastal Regulation Zone remark sheets — do not classify them as DP remarks or DP maps.
- Power of Attorney is a legal deed (principal grants power to attorney), not a register card or remarks sheet.
- If unsure, return "unknown" with low confidence.
- Do not invent a type that is not in the list.

${documentText.trim() ? `Extracted text (may be partial):\n${truncateDocumentText(documentText).slice(0, 8000)}` : "No extractable text — classify from the attached document image/PDF."}`;

  const provider = getDocumentLlmProvider();
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

  try {
    const { object } = await generateObject({
      maxRetries: 2,
      temperature: 0,
      schemaName: "document_classification",
      schemaDescription: "Classify Indian identity / registration document type",
      model: provider(getModelName()),
      schema,
      messages: [{ role: "user", content }],
    });

    if (!object) {
      throw new Error("AI classification returned no result.");
    }

    const documentType =
      object.documentType === "unknown" ||
      !allowedTypes.includes(object.documentType as DocumentType)
        ? "unknown"
        : (object.documentType as DocumentType);

    return {
      documentType,
      confidence: object.confidence,
    };
  } catch (error) {
    if (error instanceof Error && error.message.includes("classification")) {
      throw error;
    }
    throw formatExtractionError(error, "document classification");
  }
}
