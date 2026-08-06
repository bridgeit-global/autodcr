import { extractDocument } from "./ai";
import { extractTextFromPdfBuffer } from "./extractText";
import { documents, type DocumentType } from "./schema";
import { validateExtractedFields, type ValidationResult } from "./validate";

export type DocumentValidationResponse = ValidationResult<
  Record<string, string | null>
> & {
  documentType: DocumentType;
  documentLabel: string;
};

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
  const extracted = await extractDocument(definition, documentText);
  const validation = validateExtractedFields(
    extracted as Record<string, string | null>
  );

  return {
    valid: validation.valid,
    missingFields: validation.missingFields,
    extracted: validation.extracted,
    documentType,
    documentLabel: definition.label,
  };
}

export {
  documents,
  resolveDocumentType,
  APPLICATION_TYPE_TO_DOCUMENT_TYPE,
  type DocumentType,
} from "./schema";
export { getFieldLabel, FIELD_LABELS } from "./fieldLabels";
export type { ValidationResult } from "./validate";
