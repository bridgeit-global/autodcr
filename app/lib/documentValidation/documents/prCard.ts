import { z } from "zod";
import { wrapDocumentPrompt } from "../promptBase";
import type { DocumentDefinition } from "../types";

const field = () => z.string().nullish();

export const prCardSchema = z.object({
  ownerName: field(),
  plotName: field(),
  villageName: field(),
  propertyAddress: field(),
  landmark: field(),
  proposedCtsNumber: field(),
  grossPlotArea: field(),
  planningAuthority: field(),
  region: field(),
  zone: field(),
  ward: field(),
  /** JSON array: [{ extractNo, prcArea, ulcArea, bFormArea, conveyanceArea, attorneyArea, dilrMapArea, isLeaf }] */
  extractsJson: field(),
});

export type PrCard = z.infer<typeof prCardSchema>;

const FIELD_RULES = `
1. ownerName — Latest owner / धारक name from the register card. Preserve exact spelling.

2. plotName / villageName — Exact CS village / division as printed (e.g. BANDRA-C, Kurla Part-4). Never shorten BANDRA-C to Bandra.

3. propertyAddress — Full address as printed on the card.

4. landmark — Nearby landmark if printed; else null.

5. proposedCtsNumber — CTS numbers comma-separated (e.g. "338, 338/1, 338/2" or "1112").

6. grossPlotArea — Total plot area in sq.m. if a single gross total is shown; else null.

7. planningAuthority, region, zone, ward — ONLY if explicitly printed on this card (e.g. BMC, Western, Zone III, H/W Ward). For standard PR cards without planning data, return null for all four.

8. extractsJson — REQUIRED JSON string (not markdown). Array of objects, one per CTS row/subdivision on the card:
   [{ "extractNo": "338/1", "prcArea": "19.00", "ulcArea": "0", "bFormArea": "0", "conveyanceArea": "0", "attorneyArea": "0", "dilrMapArea": "0", "isLeaf": true }]
   Rules:
   - extractNo = नगर भूमापन क्रमांक / CTS / City Survey number exactly as printed
   - prcArea = क्षेत्र चौ.मी. or equivalent area column in sq.m.
   - isLeaf = true for subdivision rows (338/1, 340/2); false for parent row if subdivisions exist (338 alone when 338/1.. exist)
   - Use "0" for ulcArea, bFormArea, conveyanceArea, attorneyArea, dilrMapArea unless explicitly printed
   - Return valid JSON only, no code fences
`;

function buildPrCardPrompt(documentText: string): string {
  return wrapDocumentPrompt({
    task: "an Indian Property Register Card (PR Card) or Property Register Card (PRC / मालमत्ता पत्रक)",
    fieldRules: FIELD_RULES,
    documentText:
      documentText.trim() ||
      "[Document provided as attached PDF. Extract all CTS rows and owner from the register card.]",
  });
}

export const prCard: DocumentDefinition<typeof prCardSchema> = {
  id: "pr-card",
  label: "Property Register Card (PR / PRC)",
  schema: prCardSchema,
  buildPrompt: buildPrCardPrompt,
  validation: {
    alternativeFieldGroups: [
      {
        fields: ["ownerName", "plotName", "villageName"],
        missingLabel: "ownerName or plotName or villageName",
      },
      {
        fields: ["extractsJson", "proposedCtsNumber"],
        missingLabel: "extractsJson or proposedCtsNumber",
      },
    ],
    optionalFields: [
      "propertyAddress",
      "landmark",
      "grossPlotArea",
      "planningAuthority",
      "region",
      "zone",
      "ward",
    ],
  },
};
