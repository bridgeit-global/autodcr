import { z } from "zod";
import { wrapDocumentPrompt } from "../promptBase";
import type { DocumentDefinition } from "../types";

const field = () => z.string().nullish();

export const powerOfAttorneySchema = z.object({
  principalName: field(),
  attorneyName: field(),
  panNo: field(),
  propertyAddress: field(),
  roadName: field(),
  pincode: field(),
  villageName: field(),
  proposedCtsNumber: field(),
});

export type PowerOfAttorney = z.infer<typeof powerOfAttorneySchema>;

const FIELD_RULES = `
Extract from a Power of Attorney related to property development.

1. principalName — Property owner / executant who grants the POA.

2. attorneyName — Person receiving authority (attorney / agent).

3. panNo — PAN of principal or attorney if printed.

4. propertyAddress — Full property address in the POA.

5. roadName — Road / street name if mentioned.

6. pincode — 6-digit PIN if in address.

7. villageName — Exact CS village / division if printed (e.g. BANDRA-C). Never use a road or street name (e.g. not Sherly Rajan Road).
`;

function buildPowerOfAttorneyPrompt(documentText: string): string {
  return wrapDocumentPrompt({
    task: "a Power of Attorney for property",
    fieldRules: FIELD_RULES,
    documentText:
      documentText.trim() ||
      "[Document provided as attached PDF. Extract principal, attorney, and property details.]",
  });
}

export const powerOfAttorney: DocumentDefinition<typeof powerOfAttorneySchema> = {
  id: "power-of-attorney",
  label: "Power of Attorney",
  schema: powerOfAttorneySchema,
  buildPrompt: buildPowerOfAttorneyPrompt,
  validation: {
    alternativeFieldGroups: [
      {
        fields: ["principalName", "attorneyName", "propertyAddress"],
        missingLabel: "principalName or attorneyName or propertyAddress",
      },
    ],
    optionalFields: [
      "panNo",
      "roadName",
      "pincode",
      "villageName",
      "proposedCtsNumber",
    ],
  },
};
