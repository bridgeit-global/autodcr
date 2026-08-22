import { z } from "zod";
import { wrapDocumentPrompt } from "../promptBase";
import type { DocumentDefinition } from "../types";

export const gstCertificateSchema = z.object({
  registrationNumber: z.string().nullable(),
  legalName: z.string().nullable(),
  tradeName: z.string().nullable(),
  constitutionOfBusiness: z.string().nullable(),
  principalPlaceOfBusiness: z.string().nullable(),
  dateOfIssue: z.string().nullable(),
  city: z.string().nullable(),
  state: z.string().nullable(),
  pincode: z.string().nullable(),
});

export type GstCertificate = z.infer<typeof gstCertificateSchema>;

const FIELD_RULES = `
1. registrationNumber
- Extract the GSTIN / GST Registration Number.
- Indian GSTIN format is 15 characters (e.g. 27AAPFD4553J1Z1).
- Often appears near "Registration Number", "GSTIN", or in the certificate header.
- Preserve exact characters and capitalization.

2. legalName
- Extract the Legal Name of Business as printed on the certificate.
- Usually appears near "Legal Name" label on Form GST REG-06.
- Do not use trade name unless legal name is absent.

3. tradeName
- Extract the Trade Name if separately printed.
- Return null if not present.

4. constitutionOfBusiness
- Extract constitution type (e.g. Limited Liability Partnership, Private Limited Company).
- Return null if not present.

5. principalPlaceOfBusiness
- Extract the FULL address from "Address of Principal Place of Business".
- Include all lines that belong to this address block; prefer newlines between lines.
- Do NOT use Annexure A additional place(s) of business.
- Do NOT use registered office address from other documents.
Example:
1ST FLOOR, F-53, KOHINOOR CITY MALL, KIROL ROAD, KURLA WEST, Mumbai Suburban, Maharashtra, 400070

6. dateOfIssue
- Extract date of issue / certificate date if printed.
- Preserve exactly as written.

7. city
- Extract city/locality ONLY if explicitly printed in the principal place of business address or as a separate labeled field.
- If only present within the address block, you may still extract it here when clearly identifiable.

8. state
- Extract state/UT ONLY if explicitly printed in the principal place of business address or as a separate labeled field.

9. pincode
- Extract 6-digit Indian PIN from the principal place of business address when present.

SPECIAL INSTRUCTIONS
- This is typically Form GST REG-06 (Registration Certificate).
- Focus on "Address of Principal Place of Business", not additional places in Annexure A.
- If any field is absent or not confidently identifiable, return null for that field.
`;

function buildGstCertificatePrompt(documentText: string): string {
  return wrapDocumentPrompt({
    task: "an Indian GST Registration Certificate (Form GST REG-06)",
    fieldRules: FIELD_RULES,
    documentText:
      documentText.trim() ||
      "[Document provided as attached image/PDF. Extract fields from the GST registration certificate layout.]",
  });
}

export const gstCertificate: DocumentDefinition<typeof gstCertificateSchema> = {
  id: "gst-certificate",
  label: "GST Registration Certificate",
  schema: gstCertificateSchema,
  buildPrompt: buildGstCertificatePrompt,
};
