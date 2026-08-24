import type { DocumentType } from "./registry";

const CRZ = "crz-remarks";
const DP_LETTER = "dp-remarks";
const DP_MAP = "dp-remarks-map";
const DP_RL = "dp-remarks-rl";
const PR = "pr-card";

function allowedHas(allowedTypes: readonly string[], id: string): boolean {
  return allowedTypes.includes(id);
}

function head(text: string, n = 2500): string {
  return text.slice(0, n);
}

/** CRZ remarks letter/report — not a DP map, even if later pages are a plan. */
export function isCrzRemarksText(documentText: string): boolean {
  const t = documentText;
  const h = head(t);
  return (
    /^\s*CRZ Remarks\b/im.test(t) ||
    /\bC\.?R\.?Z\.?\s+Remarks\b/i.test(h) ||
    /\bSub:\s*C\.?R\.?Z\.?\s+Remarks/i.test(t) ||
    /Ch\.E\.\/CZMP/i.test(h) ||
    /CRZ-[IVX]+ affecting the Land/i.test(t)
  );
}

export function isDpRemarksLetterText(documentText: string): boolean {
  const t = documentText;
  return (
    /^\s*DP 2034 Remarks\b/im.test(t) ||
    /Development Plan 2034 remarks in respect/i.test(t) ||
    (/Zone \[as shown on plan\]/i.test(t) &&
      /Reservation affecting the Land/i.test(t))
  );
}

export function isDpMapPlanText(documentText: string): boolean {
  if (isCrzRemarksText(documentText) || isDpRemarksLetterText(documentText)) {
    return false;
  }
  return (
    /\bBLOCK PLAN\b/i.test(documentText) &&
    /\bLOCATION PLAN\b/i.test(documentText)
  );
}

export function isDpRoadLineText(documentText: string): boolean {
  if (isCrzRemarksText(documentText) || isDpRemarksLetterText(documentText)) {
    return false;
  }
  return (
    /\bTraffic RoadLines\b/i.test(documentText) ||
    /\bSurvey RoadLines\b/i.test(documentText)
  );
}

export function isPrCardText(documentText: string): boolean {
  if (
    isCrzRemarksText(documentText) ||
    isDpRemarksLetterText(documentText) ||
    isDpMapPlanText(documentText)
  ) {
    return false;
  }
  return (
    (/मालम/.test(documentText) && /भूमापन/.test(documentText)) ||
    /\bProperty Register Card\b/i.test(documentText)
  );
}

function typeFromText(documentText: string): DocumentType | null {
  const text = documentText.replace(/\u0000/g, " ");
  if (!text.trim()) return null;
  if (isCrzRemarksText(text)) return CRZ;
  if (isDpRoadLineText(text)) return DP_RL;
  if (isDpMapPlanText(text)) return DP_MAP;
  if (isDpRemarksLetterText(text)) return DP_LETTER;
  if (isPrCardText(text)) return PR;
  return null;
}

/**
 * Override Gemini using extracted PDF text only. Filenames are ignored.
 * CRZ packets include plan pages — those stay crz-remarks, not dp-remarks-map.
 */
export function refineLibraryDocumentType(
  allowedTypes: readonly string[],
  current: DocumentType | "unknown" | string,
  documentText = ""
): DocumentType | "unknown" | string {
  const fromText = typeFromText(documentText);
  if (fromText && allowedHas(allowedTypes, fromText)) return fromText;
  return current;
}

/** @deprecated Use refineLibraryDocumentType — filenames are not used. */
export function refineDpRemarksSubtype(
  allowedTypes: readonly string[],
  current: DocumentType | "unknown" | string,
  options: { fileName?: string; documentText?: string } = {}
): DocumentType | "unknown" | string {
  return refineLibraryDocumentType(
    allowedTypes,
    current,
    options.documentText ?? ""
  );
}
