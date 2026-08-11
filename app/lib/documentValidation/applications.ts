/**
 * Maps dashboard application type names to the document type ids they accept.
 * Multi-doc apps list multiple ids; callers must send documentType when uploading.
 * Ids must match keys registered in registry.ts.
 */
export const APPLICATION_DOCUMENTS: Record<string, readonly string[]> = {
  "Appointment Letter for Architect": ["architect-appointment-letter"],
  "PAN Card": ["pan"],
  "License Registration of Technical Person": ["technical-person-license"],
  "Aadhaar Card": ["aadhaar"],
  Registration: ["aadhaar", "pan", "technical-person-license"],
  "Owner Registration": ["aadhaar", "pan"],
  "Consultant Registration": ["aadhaar", "pan", "technical-person-license"],
};

export function getDocumentIdsForApplication(
  applicationTypeName: string
): readonly string[] {
  return APPLICATION_DOCUMENTS[applicationTypeName] ?? [];
}
