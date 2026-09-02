import { z } from "zod";
import { wrapDocumentPrompt } from "../promptBase";
import type { DocumentDefinition } from "../types";

export const technicalPersonLicenseSchema = z.object({
  certificateNumber: z.string().nullable(),
  coaCertificateNumber: z.string().nullable(),
  coaLicenseExpiryDate: z.string().nullable(),
  approvalDate: z.string().nullable(),
  validityDate: z.string().nullable(),
  validityStartDate: z.string().nullable(),
  validityEndDate: z.string().nullable(),
  technicalPersonName: z.string().nullable(),
  organizationName: z.string().nullable(),
  address: z.string().nullable(),
  applicationDate: z.string().nullable(),
  profession: z.string().nullable(),
  grade: z.string().nullable(),
  regulationNumber: z.string().nullable(),
  city: z.string().nullable(),
  state: z.string().nullable(),
  pincode: z.string().nullable(),
  signatoryName: z.string().nullable(),
  signatoryDesignation: z.string().nullable(),
  department: z.string().nullable(),
  officeLocation: z.string().nullable(),
  qrCode: z.string().nullable(),
});

/** Alias matching the requested schema name. */
export const TechnicalPersonLicenseSchema = technicalPersonLicenseSchema;

export type TechnicalPersonLicense = z.infer<
  typeof technicalPersonLicenseSchema
>;

const FIELD_RULES = `
This document may be one of THREE formats. Identify which format applies and extract accordingly.

FORMAT A — Maharashtra TP&V "License Registration of Technical Person"
Issued by Government of Maharashtra / Town Planning & Valuation Department.

FORMAT B — BMC/MCGM "Structural Engineer License"
Issued by Brihanmumbai Municipal Corporation, Office Of City Engineer.
Title contains "Structural Engineer License".

FORMAT C — BMC/MCGM "Site Supervisor License"
Issued by Brihanmumbai Municipal Corporation, Office Of City Engineer.
Title contains "Site Supervisor License".

---

1. certificateNumber
- Extract the license / registration / certificate number.
- FORMAT A: near "Certificate No.", "License No.", "Registration No." (state license, NOT COA).
  Example: TP/ARCH/2024/12345
- FORMAT B: near "License No." — often starts with STR/
  Example: STR/G/42
- FORMAT C: near "License No." — often numeric
  Example: 840006731

2. coaCertificateNumber (FORMAT A only — return null for FORMAT B/C)
- Council of Architecture (COA) certificate / registration number if present.
- Near "COA", "COA Registration", "COA Certificate No.", or "CA/…".
- Do not confuse with certificateNumber.
Example: CA/2020/12345

3. coaLicenseExpiryDate (FORMAT A only — return null for FORMAT B/C)
- COA license validity or expiry date if present.
- Near "COA Valid Upto", "COA Expiry".
Example: 31/12/2026

4. approvalDate
- Date the license was approved, issued, or granted.
- FORMAT A: near "Approved on", "Date of Approval", "Issued on".
- FORMAT B/C: near "Date." or "Date :" at top of certificate (issue date, NOT validity range).
Example: 29.04.2026 or 15/03/2024

5. validityDate
- Single validity / expiry date when only one date is given (FORMAT A).
- For FORMAT B/C with a date range, put the FULL range string here AND also split into validityStartDate / validityEndDate.
Example: 14/03/2029 or 01.04.2026 To 31.03.2031

6. validityStartDate (FORMAT B/C — return null for FORMAT A unless a range is present)
- Start date of license validity period when a range is printed.
- From "License Validity:" block or "valid from … To …" text.
Example: 01.04.2026

7. validityEndDate (FORMAT B/C — return null for FORMAT A unless a range is present)
- End date of license validity period when a range is printed.
- From "License Validity:" block or "valid from … To …" / "granted up to" text.
Example: 31.03.2031

8. technicalPersonName
- Full name of the technical person / licensee.
- FORMAT A: near "Name", "Name of Technical Person", "Shri/Smt".
- FORMAT B: near "Structural Engineer's Name :".
- FORMAT C: near "Site Supervisor's Name :".
- Do not use the signatory name.
Example: Vikas V. Gokhale

9. organizationName
- Firm / company / organization name if present (FORMAT A mainly).
- If absent, return null.

10. address
- Full address of the technical person as written in the address block.
- Include all address lines. Prefer joining multi-line address with newlines.
Example: 13, Anupam Society Panch Pakhadi, Nawpada, Thane 602

11. applicationDate (FORMAT A mainly — return null for FORMAT B/C unless present)
- Application / applied-on date if present.

12. profession
- Map to the closest of: Architect, Structural Engineer, Site Supervisor, Licensed Surveyor,
  MEP Consultant, Plumber, Fire Consultant, Landscape Consultant,
  PMC / Project Manager, Geotechnical Consultant, Environmental Consultant, Town Planner.
- FORMAT A: near "Profession", "Category", "Licensed as".
- FORMAT B: set to "Structural Engineer" (from document title).
- FORMAT C: set to "Site Supervisor" (from document title).
Example: Architect

13. grade (FORMAT C only — return null for FORMAT A/B unless present)
- Site Supervisor grade/class if printed.
- Near "Grade :" label.
Example: II

14. regulationNumber
- Regulation / rule / section reference if present (FORMAT A mainly).

15. city
- City / town from address block ONLY if explicitly printed.
- If not present, return null.

16. state
- State name ONLY if explicitly printed on the certificate.

17. pincode
- 6-digit Indian PIN if explicitly printed in the address block.

18. signatoryName
- Name of approving / signing officer (FORMAT A mainly). Return null for system-generated BMC certificates.

19. signatoryDesignation
- Designation of signing officer (FORMAT A mainly).

20. department
- Department name from header/footer if present.

21. officeLocation
- Issuing office location if present (e.g. Wadala, Mumbai).

22. qrCode
- If a QR code is clearly visible, return exactly: present
- Otherwise return null.

SPECIAL INSTRUCTIONS

- Identify document format first (A, B, or C) using the title/header.
- For FORMAT B/C: coaCertificateNumber, coaLicenseExpiryDate, organizationName, signatoryName must be null unless clearly printed.
- Distinguish certificateNumber (license no.) from coaCertificateNumber (COA, Architect only).
- Distinguish approvalDate (issue date) from validityEndDate (license expiry).
- For BMC validity ranges like "01.04.2026 To 31.03.2031", populate validityDate with the full range AND split into validityStartDate and validityEndDate.
- Distinguish technicalPersonName from signatoryName.
- Preserve all values exactly as written. Never guess. If unsure, return null.
`;

function buildTechnicalPersonLicensePrompt(documentText: string): string {
  return wrapDocumentPrompt({
    task:
      'a professional license certificate — either (A) Maharashtra TP&V "License Registration of Technical Person", (B) BMC "Structural Engineer License", or (C) BMC "Site Supervisor License"',
    fieldRules: FIELD_RULES,
    documentText:
      documentText.trim() ||
      "[Document provided as attached image/PDF. Extract fields from the visual layout of the license certificate.]",
  });
}

export const technicalPersonLicense: DocumentDefinition<
  typeof technicalPersonLicenseSchema
> = {
  id: "technical-person-license",
  label: "Technical Person License Certificate",
  schema: technicalPersonLicenseSchema,
  buildPrompt: buildTechnicalPersonLicensePrompt,
  validation: {
    optionalFields: [
      "coaCertificateNumber",
      "coaLicenseExpiryDate",
      "organizationName",
      "applicationDate",
      "regulationNumber",
      "signatoryName",
      "signatoryDesignation",
      "department",
      "officeLocation",
      "qrCode",
      "city",
      "state",
      "pincode",
      "grade",
      "validityStartDate",
    ],
    alternativeFieldGroups: [
      {
        fields: ["validityDate", "validityEndDate"],
        missingLabel: "validityDate",
      },
      {
        fields: ["approvalDate", "applicationDate"],
        missingLabel: "approvalDate",
      },
    ],
  },
};
