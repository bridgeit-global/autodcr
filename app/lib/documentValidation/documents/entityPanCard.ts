import { z } from "zod";
import { wrapDocumentPrompt } from "../promptBase";
import type { DocumentDefinition } from "../types";

export const entityPanCardSchema = z.object({
  panNumber: z.string().nullable(),
  name: z.string().nullable(),
  dateOfIncorporation: z.string().nullable(),
  city: z.string().nullable(),
  state: z.string().nullable(),
  pincode: z.string().nullable(),
});

export type EntityPanCard = z.infer<typeof entityPanCardSchema>;

const FIELD_RULES = `
1. panNumber
- Extract the Permanent Account Number (PAN) for the entity/firm/LLP.
- Indian PAN format is 10 characters: 5 letters, 4 digits, 1 letter (e.g. AAPFD4553J).
- Preserve exact characters and capitalization.

2. name
- Extract the entity / firm / LLP name printed on the PAN card.
- This is the organization name, NOT an individual person's name.
- Usually appears as the primary name block on an entity PAN card.

3. dateOfIncorporation
- Extract date of incorporation / registration if printed on the entity PAN.
- Return null if not present.

4. city, state, pincode
- Extract ONLY if explicitly printed on the document.
- Return null if absent.

SPECIAL INSTRUCTIONS
- This is an entity/firm/LLP PAN card issued by the Income Tax Department, not an individual PAN.
- Do not extract an individual's personal name as the entity name.
- If any field is absent or not confidently identifiable, return null for that field.
`;

function buildEntityPanCardPrompt(documentText: string): string {
  return wrapDocumentPrompt({
    task: "an Indian entity/firm/LLP PAN Card",
    fieldRules: FIELD_RULES,
    documentText:
      documentText.trim() ||
      "[Document provided as attached image/PDF. Extract fields from the entity PAN card layout.]",
  });
}

export const entityPanCard: DocumentDefinition<typeof entityPanCardSchema> = {
  id: "entity-pan",
  label: "Entity PAN Card",
  schema: entityPanCardSchema,
  buildPrompt: buildEntityPanCardPrompt,
  validation: {
    optionalFields: ["dateOfIncorporation", "city", "state", "pincode"],
  },
};
