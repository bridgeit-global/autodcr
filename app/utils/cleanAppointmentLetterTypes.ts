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
