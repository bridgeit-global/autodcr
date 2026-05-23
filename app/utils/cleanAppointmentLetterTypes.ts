import type { TemplateType } from "@/app/templates/templateGenerators";

/** Authority-notification appointment letters (letter-header + Subject/Project/Ref). */
export const CLEAN_APPOINTMENT_HTML_TYPES = new Set<TemplateType>([
  "Plumber",
  "Town Planner",
  "PMC / Project Manager",
  "M&E Consultant",
  "Structural Engineer",
  "Fire Safety Consultant",
  "Environmental Consultant",
  "Geotechnical Consultant",
  "Landscape Consultant",
  "Parking Consultant",
  "Rainwater Consultant",
  "Site Supervisor",
  "Horticulturist",
]);

export function isCleanAppointmentLetterType(templateType: TemplateType): boolean {
  return CLEAN_APPOINTMENT_HTML_TYPES.has(templateType);
}

/** Legacy dual-letter types (Architect, Licensed Surveyor, …) whose Chromium PDF layout diverges from iframe HTML. */
const LEGACY_DUAL_LETTER_HTML_TYPES = new Set<TemplateType>([
  "Architect",
  "Licensed Surveyor",
  "Fire Safety Consultant",
  "Landscape Consultant",
  "Geotechnical Consultant",
  "M&E Consultant",
  "Plumber",
  "Town Planner",
  "Structural Engineer",
  "Environmental Consultant",
  "PMC / Project Manager",
]);

export function isLegacyDualLetterHtmlType(templateType: TemplateType): boolean {
  return LEGACY_DUAL_LETTER_HTML_TYPES.has(templateType);
}

/**
 * Word-export dual letters (Architect, Licensed Surveyor): injecting the saved-PDF QR
 * before Chromium paginates duplicates/overlaps content. Render once without QR, upload,
 * then re-render with QR using the stored URL.
 */
export function dualLetterPdfNeedsQrFreeFirstPass(templateType: TemplateType): boolean {
  return isLegacyDualLetterHtmlType(templateType) && !isCleanAppointmentLetterType(templateType);
}

/** QR repass after upload is for unsigned saves only; QR + mock signatures breaks Chromium layout. */
export function shouldRunLegacyDualLetterQrRepass(
  templateType: TemplateType,
  signatures?: { owner?: boolean; consultant?: boolean }
): boolean {
  if (!dualLetterPdfNeedsQrFreeFirstPass(templateType)) return false;
  return !signatures?.owner && !signatures?.consultant;
}

/**
 * In-process preview: legacy dual-letter letters use live HTML (matches draft iframe).
 * Stored PDF is kept for approved/verified (signed document fidelity).
 */
export function shouldUseStoredPdfPreview(
  templateType: TemplateType,
  workflowStage: string
): boolean {
  if (isCleanAppointmentLetterType(templateType)) return false;
  if (isLegacyDualLetterHtmlType(templateType)) return false;
  if (workflowStage === "approved_verified") return true;
  return workflowStage === "in_process";
}

/** Old Word-style template (Sub: / Letter of Appointment of…) still in Storage. */
export function isLegacySubAppointmentHtml(html: string): boolean {
  if (!html.trim()) return false;
  if (html.includes("subject-reference-table")) return false;
  return (
    html.includes('class="label">Sub:</') ||
    (html.includes("Sub:") && html.includes("Letter of Appointment of"))
  );
}

/**
 * "To," header — two lines (room for QR beside address block):
 * line1: Executive Engineer (E.S./W.S.) - I
 * line2: O/o The Dy. Ch. Eng. (B.P.) (+ zone suffix)
 */
export function buildBuildingProposalToHeaderLines(
  baseDesignation: string,
  officerLine: string
): { line1: string; line2: string } {
  const line1 = baseDesignation.trim().replace(/,\s*$/, "");
  let line2 = officerLine.trim();
  if (line2 && !/,\s*$/.test(line2)) line2 = `${line2},`;
  return { line1, line2 };
}

/**
 * Legacy Word/Storage templates put officer designation and "E. S.," on separate
 * `<p>` lines; merge into one line: "O/o The Dy. Ch. Eng. (B.P.) E. S.,"
 */
export function mergeBuildingProposalOfficerZoneParagraphs(html: string): string {
  return html.replace(
    /(<p(?:\s[^>]*)?>)([\s\S]*?)(<\/p>)\s*<p(?:\s[^>]*)?>\s*(?:<span[^>]*>)?\s*(E\.\s*S\.?,|W\.\s*S\.?,)\s*(?:<\/span>)?\s*<\/p>/gi,
    (match, pOpen, officerInner, pClose, zone) => {
      const plain = officerInner.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
      if (!/Dy\.\s*Ch\.\s*Eng|Ch\.\s*Eng/i.test(plain)) return match;
      return `${pOpen}${officerInner.trim()} ${zone}${pClose}`;
    }
  );
}
