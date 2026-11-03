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
  /**
   * DigiSatbara footer: मिळकत पत्रिका डाउनलोड दिनांक DD/MM/YYYY.
   * Not the digital-signature timestamp on the same card.
   */
  downloadDate: field(),
  /** JSON array: [{ extractNo, prcArea, ulcArea, bFormArea, conveyanceArea, attorneyArea, dilrMapArea, isLeaf }] */
  extractsJson: field(),
});

export type PrCard = z.infer<typeof prCardSchema>;

const DMY_RE = /\b(\d{2})\/(\d{2})\/(\d{4})\b/;

/**
 * DigiSatbara / महाराष्ट्र भूमि PR card footer:
 * `मिळकत पत्रिका डाउनलोड दिनांक 12/02/2025 05:02:56 PM`
 * pdf-parse often garbles Devanagari; anchor on डाउनलोड / "download" then DD/MM/YYYY.
 * Do not use the digital-signature date line.
 */
export function parsePrCardDownloadDate(documentText: string): string | null {
  const text = documentText?.trim();
  if (!text) return null;

  const anchors: RegExp[] = [
    /डाउनलोड[^\d]{0,40}?(\d{2}\/\d{2}\/\d{4})/u,
    /download\s*(?:date|दिनांक|िदनांक)?[^\d]{0,40}?(\d{2}\/\d{2}\/\d{4})/iu,
    /पत्रिका[^\d]{0,60}?डाउनलोड[^\d]{0,40}?(\d{2}\/\d{2}\/\d{4})/u,
  ];

  for (const re of anchors) {
    const m = text.match(re);
    if (!m?.[1]) continue;
    const normalized = normalizeDmy(m[1]);
    if (normalized) return normalized;
  }

  return null;
}

function normalizeDmy(raw: string): string | null {
  const m = raw.trim().match(DMY_RE);
  if (!m) return null;
  const day = Number(m[1]);
  const month = Number(m[2]);
  const year = Number(m[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31 || year < 1990 || year > 2100) {
    return null;
  }
  return `${m[1]}/${m[2]}/${m[3]}`;
}

/** Prefer deterministic DigiSatbara parse over model when PDF text is available. */
export function enrichPrCardDownloadDate(
  extracted: Record<string, string | null>,
  documentText: string
): Record<string, string | null> {
  const fromText = parsePrCardDownloadDate(documentText);
  if (!fromText) return extracted;
  const existing = extracted.downloadDate?.trim() || "";
  if (existing && normalizeDmy(existing) === fromText) return extracted;
  return { ...extracted, downloadDate: fromText };
}

const FIELD_RULES = `
1. ownerName — Latest owner / धारक name from the register card. Preserve exact spelling.

2. plotName / villageName — Exact CS village / division as printed (e.g. BANDRA-C, Kurla Part-4). Never shorten BANDRA-C to Bandra.

3. propertyAddress — Full address as printed on the card.

4. landmark — Nearby landmark if printed; else null.

5. proposedCtsNumber — CTS numbers comma-separated. Convert Devanagari digits ०–९ to 0–9. Use hyphen separators (e.g. "177-30, 177-31" or "338-1"). Never truncate digits after the separator (१७७/३० → "177-30", not "177-3").

6. grossPlotArea — Total plot area in sq.m. if a single gross total is shown; else null.

7. planningAuthority, region, zone, ward — ONLY if explicitly printed on this card (e.g. BMC, CIDCO, MIDC, Western, Zone III, H/W Ward). For standard PR cards without planning data, return null for all four.

8. downloadDate — DigiSatbara footer "मिळकत पत्रिका डाउनलोड दिनांक" as DD/MM/YYYY only (ignore time). Do NOT use the digital-signature timestamp. Null if absent.

9. extractsJson — REQUIRED JSON string (not markdown). Array of objects, one per CTS row/subdivision on the card:
   [{ "extractNo": "177-30", "prcArea": "55.70", "ulcArea": "0", "bFormArea": "0", "conveyanceArea": "0", "attorneyArea": "0", "dilrMapArea": "0", "isLeaf": true }]
   Rules:
   - extractNo = नगर भूमापन क्रमांक / CTS / City Survey number from the card
   - Convert Devanagari numerals ०–९ → ASCII 0–9
   - Normalize / or other separators to hyphen (१७७/३० → "177-30"; ३३८/१ → "338-1")
   - Include EVERY digit after the separator — never drop trailing zeros (३० is "30", not "3")
   - prcArea = क्षेत्र चौ.मी. or equivalent area column in sq.m.
   - isLeaf = true for subdivision rows (177-30, 338-1); false for parent row if subdivisions exist
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
      "downloadDate",
    ],
  },
};
