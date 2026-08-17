import { extractDocument, extractDocumentFromMedia } from "./ai";
import { extractTextFromPdfBuffer } from "./extractText";
import { documents, type DocumentType } from "./registry";
import type { DocumentDefinition } from "./types";
import { validateExtractedFields, type ValidationResult } from "./validate";
import type { z } from "zod";

export type DocumentValidationResponse = ValidationResult<
  Record<string, string | null>
> & {
  documentType: DocumentType;
  documentLabel: string;
};

const IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
]);

export function isSupportedDocumentMediaType(mediaType: string): boolean {
  return mediaType === "application/pdf" || IMAGE_TYPES.has(mediaType);
}

function flattenExtracted(raw: unknown): Record<string, string | null> {
  if (!raw || typeof raw !== "object") return {};
  const out: Record<string, string | null> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (value === null || value === undefined) {
      out[key] = null;
    } else if (typeof value === "string") {
      out[key] = value;
    } else if (typeof value === "boolean" || typeof value === "number") {
      out[key] = String(value);
    } else {
      out[key] = JSON.stringify(value);
    }
  }
  return out;
}

async function runValidation(
  documentType: DocumentType,
  extracted: Record<string, string | null>
): Promise<DocumentValidationResponse> {
  const definition = documents[documentType];
  const validation = validateExtractedFields(
    extracted,
    definition.validation
  );

  return {
    valid: validation.valid,
    missingFields: validation.missingFields,
    extracted: validation.extracted,
    documentType,
    documentLabel: definition.label,
  };
}

/**
 * Text-based PDF validation (Architect Appointment Letter path).
 * Unchanged behavior: requires extractable PDF text.
 */
export async function validateDocumentPdf(
  buffer: Buffer,
  documentType: DocumentType
): Promise<DocumentValidationResponse> {
  const definition = documents[documentType];

  if (!definition) {
    const availableTypes = Object.keys(documents).join(", ");
    throw new Error(
      `Unknown document type "${documentType}". Available types: ${availableTypes}`
    );
  }

  const documentText = await extractTextFromPdfBuffer(buffer);
  const extracted = await extractDocument(
    definition as DocumentDefinition<z.ZodTypeAny>,
    documentText
  );

  return runValidation(documentType, flattenExtracted(extracted));
}

/**
 * PDF or image validation. Uses text extraction when available;
 * falls back to multimodal Gemini for images / scanned PDFs.
 */
export async function validateDocumentFile(
  buffer: Buffer,
  documentType: DocumentType,
  mediaType: string
): Promise<DocumentValidationResponse> {
  const definition = documents[documentType];

  if (!definition) {
    const availableTypes = Object.keys(documents).join(", ");
    throw new Error(
      `Unknown document type "${documentType}". Available types: ${availableTypes}`
    );
  }

  if (!isSupportedDocumentMediaType(mediaType)) {
    throw new Error(
      `Unsupported file type "${mediaType}". Upload a PDF or image (JPEG/PNG/WebP).`
    );
  }

  if (mediaType === "application/pdf") {
    let documentText = "";
    let textExtracted = false;

    try {
      documentText = await extractTextFromPdfBuffer(buffer);
      textExtracted = true;
    } catch {
      // Scanned / image-only PDF — use multimodal extraction below.
    }

    if (textExtracted) {
      try {
        const extracted = await extractDocument(
          definition as DocumentDefinition<z.ZodTypeAny>,
          documentText
        );
        return runValidation(documentType, flattenExtracted(extracted));
      } catch (textError) {
        console.warn(
          `[validate-document] Text-path extraction failed for ${documentType}, trying multimodal:`,
          textError instanceof Error ? textError.message : textError
        );
      }
    }

    const extracted = await extractDocumentFromMedia(
      definition as DocumentDefinition<z.ZodTypeAny>,
      {
        data: buffer,
        mediaType,
      },
      documentText
    );
    return runValidation(documentType, flattenExtracted(extracted));
  }

  const extracted = await extractDocumentFromMedia(
    definition as DocumentDefinition<z.ZodTypeAny>,
    {
      data: buffer,
      mediaType,
    }
  );

  return runValidation(documentType, flattenExtracted(extracted));
}

export type { DocumentDefinition } from "./types";
export {
  documents,
  resolveDocumentType,
  resolveDocumentTypeFromApplication,
  isDocumentType,
  listDocumentTypes,
  getDocumentDefinition,
  getDocumentsForApplication,
  type DocumentType,
} from "./registry";
export { APPLICATION_DOCUMENTS } from "./applications";
export { getFieldLabel, FIELD_LABELS } from "./fieldLabels";
export type { ValidationResult } from "./validate";
