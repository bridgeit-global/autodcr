import { z } from "zod";
import { wrapDocumentPrompt } from "../promptBase";
import type { DocumentDefinition } from "../types";

export const panCardSchema = z.object({
  panNumber: z.string().nullable(),
  name: z.string().nullable(),
  fatherName: z.string().nullable(),
  dateOfBirth: z.string().nullable(),
  signature: z.string().nullable(),
  qrCode: z.string().nullable(),
  city: z.string().nullable(),
  state: z.string().nullable(),
  pincode: z.string().nullable(),
});

export type PanCard = z.infer<typeof panCardSchema>;

const FIELD_RULES = `
1. panNumber
- Extract the Permanent Account Number (PAN).
- Indian PAN format is typically 10 characters: 5 letters, 4 digits, 1 letter (e.g. ABCDE1234F).
- Often appears near labels such as "Permanent Account Number", "PAN", or as a large alphanumeric block on the card.
- Preserve exact characters and capitalization.
- Do not invent or complete a partial PAN.
Example:
ABCDE1234F

2. name
- Extract the card holder's full name.
- Usually appears near or under a "Name" / "नाम" label, or as the primary name block on the card.
- Do not use the father's name as the holder's name.
- Do not rewrite or expand initials.
Example:
RIYAZ SHAMSUDDIN ANSARI

3. fatherName
- Extract the father's name.
- Usually appears near labels such as "Father's Name", "Father Name", or "पिता का नाम".
- If the label cannot be confidently associated with a value, return null.
Example:
SHAMSUDDIN ANSARI

4. dateOfBirth
- Extract the date of birth exactly as printed.
- Usually appears near "Date of Birth", "DOB", or "जन्म तिथि".
- Do not normalize or reformat the date.
Example:
21/04/1990

5. signature
- The signature is typically a handwritten image, not labeled text.
- If a handwritten signature is clearly visible on the card, return exactly: present
- Do not attempt to read or invent the signed name as text.
- If no signature is clearly visible, return null.

6. qrCode
- The QR code is typically a printed square code on the card.
- If a QR code is clearly visible, return exactly: present
- Do not invent decoded QR payload text unless that payload is also printed as readable text on the card.
- If no QR code is clearly visible, return null.

7. city
- Extract the city / town / locality ONLY if it is explicitly printed on the document
  (for example within an address block, or near a City / District label).
- Preserve exactly as written. Do not invent from PAN series knowledge or external geography.
- If not present or not confidently identifiable, return null.
Example:
Mumbai

8. state
- Extract the state / UT ONLY if it is explicitly printed on the document.
- Preserve exactly as written. Do not assume Maharashtra or any other state.
- If not present or not confidently identifiable, return null.
Example:
Maharashtra

9. pincode
- Extract a 6-digit Indian PIN / postal code ONLY if it is explicitly printed on the document.
- Labels may include "PIN", "PIN Code", "Pincode", or it may appear in an address line.
- Preserve digits exactly as written. Do not invent a PIN.
- If not present or not confidently identifiable, return null.
Example:
400070

SPECIAL INSTRUCTIONS

- Indian PAN cards may omit explicit labels next to some values. Use standard PAN layout and nearby labels to identify fields, but NEVER guess.
- city, state, and pincode are often ABSENT on PAN cards — return null rather than inventing them.
- Values may appear in English or Hindi labels; extract the value text as printed.
- Ignore Income Tax Department branding, "GOVT. OF INDIA", and decorative text that is not one of the fields above.
- If any field is absent or not confidently identifiable, return null for that field.
`;

function buildPanCardPrompt(documentText: string): string {
  return wrapDocumentPrompt({
    task: "an Indian PAN Card",
    fieldRules: FIELD_RULES,
    documentText:
      documentText.trim() ||
      "[Document provided as attached image/PDF. Extract fields from the visual layout of the PAN card.]",
  });
}

export const panCard: DocumentDefinition<typeof panCardSchema> = {
  id: "pan",
  label: "PAN Card",
  schema: panCardSchema,
  buildPrompt: buildPanCardPrompt,
  validation: {
    optionalFields: [
      "fatherName",
      "dateOfBirth",
      "signature",
      "qrCode",
      "city",
      "state",
      "pincode",
    ],
  },
};
