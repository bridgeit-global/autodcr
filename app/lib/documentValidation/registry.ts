import { getDocumentIdsForApplication } from "./applications";
import {
  aadhaarCard,
  architectAppointmentLetter,
  panCard,
  technicalPersonLicense,
} from "./documents";

export const documents = {
  "architect-appointment-letter": architectAppointmentLetter,
  pan: panCard,
  "technical-person-license": technicalPersonLicense,
  aadhaar: aadhaarCard,
} as const;

export type DocumentType = keyof typeof documents;

export function isDocumentType(id: string): id is DocumentType {
  return Object.prototype.hasOwnProperty.call(documents, id);
}

export function listDocumentTypes(): DocumentType[] {
  return Object.keys(documents) as DocumentType[];
}

export function getDocumentDefinition(documentType: DocumentType) {
  return documents[documentType];
}

export function getDocumentsForApplication(
  applicationTypeName: string
): DocumentType[] {
  return getDocumentIdsForApplication(applicationTypeName).filter(
    isDocumentType
  );
}

/**
 * Auto-resolve only when the application maps to exactly one document type.
 * Multi-doc applications require an explicit documentType from the caller.
 */
export function resolveDocumentTypeFromApplication(
  applicationTypeName: string
): DocumentType | null {
  const docs = getDocumentsForApplication(applicationTypeName);
  return docs.length === 1 ? docs[0]! : null;
}

/**
 * Prefer explicit documentType; fall back to applicationType only when that
 * application maps to exactly one document.
 * An unknown explicit documentType does not fall back.
 */
export function resolveDocumentType(options: {
  documentType?: string;
  applicationType?: string;
}): DocumentType | null {
  const { documentType, applicationType } = options;

  if (documentType) {
    return isDocumentType(documentType) ? documentType : null;
  }

  if (applicationType) {
    return resolveDocumentTypeFromApplication(applicationType);
  }

  return null;
}
