import { z } from "zod";
import { wrapDocumentPrompt } from "../promptBase";
import type { DocumentDefinition } from "../types";

/** Gemini often omits absent fields; nullish avoids schema validation retries. */
const field = () => z.string().nullish();

export const dpRemarksSchema = z.object({
  planningAuthority: field(),
  region: field(),
  zone: field(),
  ward: field(),
  villageName: field(),
  proposedCtsNumber: field(),
  grossPlotArea: field(),
  roadName: field(),
  dpZone: field(),
  crzCategory: field(),
  fullNameOfApplicant: field(),
  addressOfApplicant: field(),
  propertyAddress: field(),
  pincode: field(),
  landmark: field(),
  applicantType: field(),
  applicantName: field(),
  applicantAddress: field(),
  panNo: field(),
});

export type DpRemarks = z.infer<typeof dpRemarksSchema>;

const FIELD_RULES = `
Extract from D.P. Remarks / Development Plan remarks (BMC / MCGM style).

1. planningAuthority — e.g. BMC, MMRDA. Usually BMC for Mumbai.

2. region — Eastern, Western, City (map H/W Ward → Western when document says H/W Ward).

3. zone — Zone I, Zone II, Zone III, etc.

4. ward — Ward code e.g. H/W Ward, L Ward.

5. villageName — Exact village / division on the remark (e.g. BANDRA-C, not Bandra).

6. proposedCtsNumber — CTS number(s) referenced.

7. grossPlotArea — Total area in sq.m. if stated.

8. roadName — Road width / RL traffic remarks (concatenate multiple road lines with "; " if needed).

9. dpZone — DP zone letter e.g. R from "Residential(R)".

10. crzCategory — CRZ category if mentioned in DP body (e.g. CRZ II); else null.

11. fullNameOfApplicant, addressOfApplicant — Owner/applicant if named on remark.

12. propertyAddress, pincode, landmark — Property location on remark.

13. applicantType, applicantName, applicantAddress, panNo — Applicant block if present.
`;

function buildDpRemarksPrompt(documentText: string): string {
  return wrapDocumentPrompt({
    task: "D.P. Remarks (Development Plan remarks for a Mumbai property)",
    fieldRules: FIELD_RULES,
    documentText:
      documentText.trim() ||
      "[Document provided as attached PDF. Extract planning and property fields.]",
  });
}

export const dpRemarks: DocumentDefinition<typeof dpRemarksSchema> = {
  id: "dp-remarks",
  label: "D.P. Remarks",
  schema: dpRemarksSchema,
  buildPrompt: buildDpRemarksPrompt,
  validation: {
    alternativeFieldGroups: [
      {
        fields: ["ward", "villageName", "proposedCtsNumber"],
        missingLabel: "ward or villageName or proposedCtsNumber",
      },
    ],
    optionalFields: [
      "planningAuthority",
      "region",
      "zone",
      "grossPlotArea",
      "roadName",
      "dpZone",
      "crzCategory",
      "fullNameOfApplicant",
      "addressOfApplicant",
      "propertyAddress",
      "pincode",
      "landmark",
      "applicantType",
      "applicantName",
      "applicantAddress",
      "panNo",
    ],
  },
};
