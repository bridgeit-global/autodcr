/** Human-readable labels for extracted field keys. */
export const FIELD_LABELS: Record<string, string> = {
  date: "Date",
  architectName: "Architect Name",
  address: "Address",
  ctsNumber: "CTS Number",
  area: "Area",
  propertyIdentifier: "Property Identifier",
  ward: "Ward",
  proposalNumber: "Proposal Number",
  directorName: "Director Name",
  coaRegistrationNumber: "COA Registration Number",
  coaValidUpto: "COA Valid Upto",
  ccTo: "C. C. to",
};

export function getFieldLabel(key: string): string {
  return FIELD_LABELS[key] ?? key;
}
