import {
  classifyDocumentType,
  extractDocument,
  extractDocumentFromMedia,
  type ClassifyDocumentResult,
} from "./ai";
import { extractTextFromPdfBuffer } from "./extractText";
import { documents, isDocumentType, type DocumentType } from "./registry";
import { refineLibraryDocumentType, refineDpRemarksSubtype } from "./dpRemarksSubtype";
import type { DocumentDefinition } from "./types";
import { validateExtractedFields } from "./validate";
import type { ValidationResult } from "./validate";
import type { z } from "zod";

export type DocumentValidationResponse = ValidationResult<
  Record<string, string | null>
> & {
  documentType: DocumentType;
  documentLabel: string;
};

export type ClassifyAndValidateResponse = DocumentValidationResponse & {
  classification: ClassifyDocumentResult;
};

const IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/bmp",
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

/** True when text-path AI returned no usable field values (common for scanned PDFs). */
function hasMeaningfulExtraction(
  extracted: Record<string, string | null>
): boolean {
  return Object.values(extracted).some(
    (value) => typeof value === "string" && value.trim().length > 0
  );
}

function applySignatoryClassificationRules(
  documentType: DocumentType,
  extracted: Record<string, string | null>,
  validation: ValidationResult<Record<string, string | null>>
): ValidationResult<Record<string, string | null>> {
  if (documentType === "signatory-photo") {
    const ok = (extracted.isPortraitPhoto || "").trim().toLowerCase() === "yes";
    if (!ok) {
      return {
        valid: false,
        missingFields: validation.missingFields.includes("isPortraitPhoto")
          ? validation.missingFields
          : [...validation.missingFields, "isPortraitPhoto"],
        extracted,
      };
    }
  }

  if (documentType === "signatory-signature") {
    const ok =
      (extracted.isHandwrittenSignature || "").trim().toLowerCase() === "yes";
    if (!ok) {
      return {
        valid: false,
        missingFields: validation.missingFields.includes("isHandwrittenSignature")
          ? validation.missingFields
          : [...validation.missingFields, "isHandwrittenSignature"],
        extracted,
      };
    }
  }

  return validation;
}

async function runValidation(
  documentType: DocumentType,
  extracted: Record<string, string | null>
): Promise<DocumentValidationResponse> {
  const definition = documents[documentType];
  const baseValidation = validateExtractedFields(
    extracted,
    definition.validation
  );
  const validation = applySignatoryClassificationRules(
    documentType,
    extracted,
    baseValidation
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
        const flat = flattenExtracted(extracted);
        if (hasMeaningfulExtraction(flat)) {
          return runValidation(documentType, flat);
        }
        console.warn(
          `[validate-document] Text-path returned empty fields for ${documentType}, trying multimodal`
        );
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

/**
 * Classify an unlabeled file into one of allowedTypes, then extract + validate.
 */
export async function classifyAndValidateDocumentFile(
  buffer: Buffer,
  allowedTypes: DocumentType[],
  mediaType: string
): Promise<ClassifyAndValidateResponse> {
  if (allowedTypes.length === 0) {
    throw new Error("At least one allowed document type is required.");
  }

  if (!isSupportedDocumentMediaType(mediaType)) {
    throw new Error(
      `Unsupported file type "${mediaType}". Upload a PDF or image (JPEG/PNG/WebP).`
    );
  }

  let documentText = "";
  if (mediaType === "application/pdf") {
    try {
      documentText = await extractTextFromPdfBuffer(buffer);
    } catch {
      // Scanned / image-only PDF — classify from media alone.
    }
  }

  const classification = await classifyDocumentType(
    { data: buffer, mediaType },
    allowedTypes,
    documentText
  );

  const refinedType = refineLibraryDocumentType(
    allowedTypes,
    classification.documentType,
    documentText
  );
  classification.documentType =
    refinedType === "unknown" ||
    !isDocumentType(refinedType) ||
    !allowedTypes.includes(refinedType)
      ? classification.documentType
      : refinedType;

  if (
    classification.documentType === "unknown" ||
    !isDocumentType(classification.documentType) ||
    !allowedTypes.includes(classification.documentType)
  ) {
    const expected = allowedTypes
      .map((id) => documents[id]?.label ?? id)
      .join(", ");
    throw new Error(
      `Could not identify this document. Expected one of: ${expected}. Please upload a clearer file or choose the type manually.`
    );
  }

  const result = await validateDocumentFile(
    buffer,
    classification.documentType,
    mediaType
  );

  return {
    ...result,
    classification,
  };
}

/**
 * Classify an unlabeled file without extracting fields (for slot assignment).
 */
export async function classifyDocumentFileOnly(
  buffer: Buffer,
  allowedTypes: DocumentType[],
  mediaType: string
): Promise<ClassifyDocumentResult> {
  if (allowedTypes.length === 0) {
    throw new Error("At least one allowed document type is required.");
  }

  if (!isSupportedDocumentMediaType(mediaType)) {
    throw new Error(
      `Unsupported file type "${mediaType}". Upload a PDF or image (JPEG/PNG/WebP).`
    );
  }

  let documentText = "";
  if (mediaType === "application/pdf") {
    try {
      documentText = await extractTextFromPdfBuffer(buffer);
    } catch {
      // Scanned / image-only PDF — classify from media alone.
    }
  }

  const classification = await classifyDocumentType(
    { data: buffer, mediaType },
    allowedTypes,
    documentText
  );

  const refinedType = refineLibraryDocumentType(
    allowedTypes,
    classification.documentType,
    documentText
  );
  if (
    refinedType !== "unknown" &&
    isDocumentType(refinedType) &&
    allowedTypes.includes(refinedType)
  ) {
    return {
      documentType: refinedType,
      confidence:
        refinedType === classification.documentType
          ? classification.confidence
          : "high",
    };
  }

  return classification;
}

export { refineLibraryDocumentType, refineDpRemarksSubtype };
export type { DocumentDefinition };
export type { ClassifyDocumentResult };
export { classifyDocumentType };
export {
  documents,
  isDocumentType,
};
export type { DocumentType };
export {
  resolveDocumentType,
  resolveDocumentTypeFromApplication,
  listDocumentTypes,
  getDocumentDefinition,
  getDocumentsForApplication,
} from "./registry";
export { APPLICATION_DOCUMENTS } from "./applications";
export { getFieldLabel, FIELD_LABELS } from "./fieldLabels";
export type { ValidationResult };
