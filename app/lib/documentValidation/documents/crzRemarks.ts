import { z } from "zod";
import { wrapDocumentPrompt } from "../promptBase";
import type { DocumentDefinition } from "../types";

const field = () => z.string().nullish();

export const crzRemarksSchema = z.object({
  crzCategory: field(),
  planningAuthority: field(),
  region: field(),
  zone: field(),
  ward: field(),
  villageName: field(),
  propertyAddress: field(),
  proposedCtsNumber: field(),
});

export type CrzRemarks = z.infer<typeof crzRemarksSchema>;

const FIELD_RULES = `
Extract from C.R.Z. Remarks (Coastal Regulation Zone remarks).

1. crzCategory — e.g. CRZ I, CRZ II, CRZ III, CRZ IV. Prefer checkbox/label on form; if only in body text, extract best match.

2. planningAuthority, region, zone, ward — Location fields if printed (often matches DP remarks).

3. villageName, propertyAddress, proposedCtsNumber — Property identifiers if present. villageName must be the exact division (e.g. BANDRA-C, not Bandra).
`;

function buildCrzRemarksPrompt(documentText: string): string {
  return wrapDocumentPrompt({
    task: "C.R.Z. Remarks (Coastal Regulation Zone remarks)",
    fieldRules: FIELD_RULES,
    documentText:
      documentText.trim() ||
      "[Document provided as attached PDF. Extract CRZ category and location fields.]",
  });
}

export const crzRemarks: DocumentDefinition<typeof crzRemarksSchema> = {
  id: "crz-remarks",
  label: "C.R.Z. Remarks",
  schema: crzRemarksSchema,
  buildPrompt: buildCrzRemarksPrompt,
  validation: {
    alternativeFieldGroups: [
      {
        fields: ["crzCategory", "ward", "villageName"],
        missingLabel: "crzCategory or ward or villageName",
      },
    ],
    optionalFields: [
      "planningAuthority",
      "region",
      "zone",
      "propertyAddress",
      "proposedCtsNumber",
    ],
  },
};
