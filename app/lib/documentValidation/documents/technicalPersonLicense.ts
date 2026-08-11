import { z } from "zod";
import { wrapDocumentPrompt } from "../promptBase";
import type { DocumentDefinition } from "../types";

export const technicalPersonLicenseSchema = z.object({
  certificateNumber: z.string().nullable(),
  coaCertificateNumber: z.string().nullable(),
  coaLicenseExpiryDate: z.string().nullable(),
  approvalDate: z.string().nullable(),
  validityDate: z.string().nullable(),
  technicalPersonName: z.string().nullable(),
  organizationName: z.string().nullable(),
  address: z.string().nullable(),
  applicationDate: z.string().nullable(),
  profession: z.string().nullable(),
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
This document is typically titled similar to:
"License Registration of Technical Person"
issued by "Government of Maharashtra" and/or
"Town Planning & Valuation Department".

1. certificateNumber
- Extract the license / registration / certificate number of this technical person license.
- Often near labels such as "Certificate No.", "License No.", "Registration No.", or "No.".
- Preserve exact characters and formatting.
Example:
TP/ARCH/2024/12345

2. coaCertificateNumber
- Extract the Council of Architecture (COA) certificate / registration number if present.
- Often near labels such as "COA", "COA Registration", "COA Certificate No.", or "CA/…".
- Do not confuse with the state license certificateNumber.
Example:
CA/2020/12345

3. coaLicenseExpiryDate
- Extract the COA license / registration validity or expiry date if present.
- Often near "COA Valid Upto", "COA Expiry", or similar.
- Preserve the date exactly as written. Do not normalize.
Example:
31/12/2026

4. approvalDate
- Extract the date the license / registration was approved or issued.
- Often near "Approved on", "Date of Approval", "Issued on", or the approval stamp date.
- Preserve exactly as written.
Example:
15/03/2024

5. validityDate
- Extract the validity / expiry date of THIS technical person license (not COA, unless they are the same and only one date exists with a clear "valid upto" for the license).
- Often near "Valid upto", "Validity", "Valid till".
- Preserve exactly as written.
Example:
14/03/2029

6. technicalPersonName
- Extract the full name of the technical person / licensee.
- Often near "Name", "Name of Technical Person", "Shri/Smt".
- Do not use the signatory name.
Example:
Riyaz Shamsuddin Ansari

7. organizationName
- Extract the firm / company / organization name if present.
- Often near "Organization", "Firm", "Company", "Name of Firm".
- If absent, return null.
Example:
ABC Architects Pvt. Ltd.

8. address
- Extract the full address of the technical person / organization as written.
- Include all address lines that clearly belong to the address block.
- Prefer joining multi-line address with newlines.
Example:
F-53, Kohinoor City Mall, Kirol Road, Kurla (W), Mumbai-400070

9. applicationDate
- Extract the application / applied-on date if present.
- Often near "Application Date", "Date of Application", "Applied on".
- Preserve exactly as written.
Example:
01/02/2024

10. profession
- Extract the profession / category of technical person.
- Examples: Architect, Engineer, Structural Engineer, Supervisor, etc.
- Often near "Profession", "Category", "Licensed as".
Example:
Architect

11. regulationNumber
- Extract the regulation / rule / section reference under which the license is granted, if present.
- Often near "Regulation", "Rule", "u/s", "under".
Example:
Regulation 5(3)

12. city
- Extract the city / town / locality of the technical person / organization address ONLY if
  explicitly printed on the document (address block or City label).
- Do NOT use officeLocation as a substitute unless it is clearly the holder's city.
- Preserve exactly as written. Do not invent from external geography.
- If not present or not confidently identifiable, return null.
Example:
Mumbai

13. state
- Extract the state name ONLY if explicitly present or clearly printed as the issuing /
  address state on the certificate.
- Preserve exactly as written. Do not assume Maharashtra just because of the department title
  unless the state name itself is printed.
Example:
Maharashtra

14. pincode
- Extract a 6-digit Indian PIN / postal code ONLY if it is explicitly printed on the document
  (often in the address block).
- Preserve digits exactly as written. Do not invent a PIN.
- If not present or not confidently identifiable, return null.
Example:
400070

15. signatoryName
- Extract the name of the approving / signing officer.
- Usually near the signature block at the bottom.
- Do not use the technical person's name.
Example:
S. K. Patil

16. signatoryDesignation
- Extract the designation of the signing officer.
- Often near or under the signatory name (e.g. Director, Joint Director, Town Planner).
Example:
Director of Town Planning

17. department
- Extract the department name.
- Often "Town Planning & Valuation Department" or similar printed header/footer text.
Example:
Town Planning & Valuation Department

18. officeLocation
- Extract the office / city location of the issuing office if present.
- Often near the signatory block or letterhead (e.g. Pune, Mumbai, Nagpur).
- This is the ISSUING office location — distinct from city when both appear.
Example:
Pune

19. qrCode
- If a QR code is clearly visible on the certificate, return exactly: present
- Do not invent decoded QR payload text unless that payload is also printed as readable text.
- If no QR code is clearly visible, return null.

SPECIAL INSTRUCTIONS

- Distinguish certificateNumber (state license) from coaCertificateNumber (COA).
- Distinguish validityDate (this license) from coaLicenseExpiryDate (COA).
- Distinguish technicalPersonName from signatoryName.
- Distinguish city (holder/organization address) from officeLocation (issuing office).
- city / state / pincode must come from printed text only — never from external knowledge.
- Preserve all values exactly as written. Never guess. If unsure, return null.
`;

function buildTechnicalPersonLicensePrompt(documentText: string): string {
  return wrapDocumentPrompt({
    task: 'a "Government of Maharashtra - Town Planning & Valuation Department - License Registration of Technical Person" certificate',
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
};
