import { z } from "zod";
import { wrapDocumentPrompt } from "../promptBase";
import type { DocumentDefinition } from "../types";

export const llpIncorporationCertificateSchema = z.object({
  llpin: z.string().nullable(),
  entityName: z.string().nullable(),
  incorporationDate: z.string().nullable(),
  dateOfRegistration: z.string().nullable(),
  registeredOfficeAddress: z.string().nullable(),
});

export type LlpIncorporationCertificate = z.infer<
  typeof llpIncorporationCertificateSchema
>;

const FIELD_RULES = `
1. llpin
- Extract the LLPIN (Limited Liability Partnership Identification Number).
- Look near labels such as "LLPIN", "LLP Identification Number", "LLPIN allotted", or "Corporate Identity Number".
- Typical format is 3 uppercase letters, hyphen, 4 alphanumeric characters (e.g. AAP-1234 or AAP-1234A).
- If printed without hyphen (e.g. AAP1234), return it exactly as printed — downstream code will normalize.
- Do not confuse with CIN, GSTIN, or PAN.

2. entityName
- Extract the full name of the Limited Liability Partnership as printed on the certificate.
- Usually appears near "Name of Limited Liability Partnership" or as the primary entity name on the MCA certificate.

3. incorporationDate
- Extract the date of incorporation / date of registration / date of issue on the certificate.
- Look near phrases such as "Given under my hand at", "Date of Incorporation", "Date of Registration", or the certificate issue date block.
- Prefer returning a numeric date in DD/MM/YYYY when the certificate shows one (e.g. 24/05/2023).
- If only a written date appears (e.g. "24th May 2023" or "Twenty seventh day of November Two thousand eighteen"), return that text exactly as printed.

4. dateOfRegistration
- If the certificate separately labels "Date of Registration" distinct from incorporationDate, extract it here.
- Otherwise return null (do not duplicate incorporationDate).

5. registeredOfficeAddress
- Extract the registered office address if printed on the certificate.
- Return null if not present or not confidently identifiable.

SPECIAL INSTRUCTIONS
- This is an MCA Certificate of Incorporation for a Limited Liability Partnership (often Form 16).
- The document may be a scanned PDF; read visible text from the certificate layout carefully.
- LLPIN and Date of Registration are critical fields — search the full page before returning null.
- If any field is absent or not confidently identifiable, return null for that field.
`;

function buildLlpIncorporationCertificatePrompt(documentText: string): string {
  return wrapDocumentPrompt({
    task: "an Indian LLP Certificate of Incorporation (MCA)",
    fieldRules: FIELD_RULES,
    documentText:
      documentText.trim() ||
      "[Document provided as attached image/PDF. Extract fields from the LLP incorporation certificate layout.]",
  });
}

export const llpIncorporationCertificate: DocumentDefinition<
  typeof llpIncorporationCertificateSchema
> = {
  id: "llp-incorporation-certificate",
  label: "Certificate of LLP Incorporation",
  schema: llpIncorporationCertificateSchema,
  buildPrompt: buildLlpIncorporationCertificatePrompt,
  validation: {
    optionalFields: ["dateOfRegistration", "registeredOfficeAddress"],
  },
};
