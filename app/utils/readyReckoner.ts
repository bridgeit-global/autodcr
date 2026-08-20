import { englishVillageToMarathi } from "./reckonerVillageMapping";

export type ReadyReckonerEntry = {
  openLand: number;
  residential: number;
  office: number;
  commercial: number;
  industrial: number;
  address: string;
  rateUnit: string;
  districtId: string;
};

export type ReadyReckonerIndex = Record<string, Record<string, ReadyReckonerEntry>>;

export type ReadyReckonerRateType =
  | "openLand"
  | "residential"
  | "office"
  | "commercial"
  | "industrial";

export const RATE_TYPE_LABELS: Record<ReadyReckonerRateType, string> = {
  openLand: "Open Land",
  residential: "Residential",
  office: "Office",
  commercial: "Commercial",
  industrial: "Industrial",
};

/** Normalize survey/CTS token for index lookup. */
export function normalizeSurveyNo(value: string | null | undefined): string {
  return String(value ?? "")
    .trim()
    .replace(/\s+/g, "")
    .toUpperCase();
}

/**
 * Build ordered lookup candidates for composite CTS tokens (e.g. 432A/B → 432A/B, 432A, 432B).
 * Exact key is always tried first; slash variants follow.
 */
export function getSurveyLookupCandidates(surveyNo: string | null | undefined): string[] {
  const normalized = normalizeSurveyNo(surveyNo);
  if (!normalized) return [];

  const seen = new Set<string>();
  const candidates: string[] = [];

  const add = (value: string) => {
    const key = normalizeSurveyNo(value);
    if (!key || seen.has(key)) return;
    seen.add(key);
    candidates.push(key);
  };

  add(normalized);

  if (!normalized.includes("/")) return candidates;

  const parts = normalized.split("/").filter(Boolean);
  if (parts.length === 2) {
    const [left, right] = parts;
    add(left);
    add(right);

    const leftMatch = left.match(/^(\d+)([A-Z]*)$/);
    if (leftMatch && /^[A-Z]+$/i.test(right)) {
      const [, num] = leftMatch;
      add(`${num}${right}`);
    }

    if (/^\d+$/.test(left) && /^[A-Z]$/i.test(right)) {
      add(`${left}${right}`);
    }
  } else {
    for (const part of parts) add(part);
  }

  return candidates;
}

/** Format amount in Indian numbering (₹ 2,16,630). */
export function formatIndianCurrency(amount: number): string {
  if (!Number.isFinite(amount)) return "₹ 0";
  const rounded = Math.round(amount);
  const s = String(Math.abs(rounded));
  if (s.length <= 3) return `₹ ${rounded}`;
  const lastThree = s.slice(-3);
  const rest = s.slice(0, -3);
  const withCommas = rest.replace(/\B(?=(\d{2})+(?!\d))/g, ",") + "," + lastThree;
  return `₹ ${rounded < 0 ? "-" : ""}${withCommas}`;
}

/** Map major use of plot (form value) to reckoner rate field. */
export function majorUseToRateType(majorUse: string | null | undefined): ReadyReckonerRateType {
  const use = String(majorUse ?? "").toLowerCase();
  if (use.includes("commercial")) return "commercial";
  if (use.includes("industrial")) return "industrial";
  if (use.includes("office")) return "office";
  if (use.includes("open") && use.includes("land")) return "openLand";
  if (use.includes("residential") || use.includes("residence")) return "residential";
  return "residential";
}

export type ReadyReckonerLookupResult = {
  village: string;
  /** Survey key that matched in the index. */
  surveyNo: string;
  /** Original survey token from the project form, if different from surveyNo. */
  requestedSurveyNo?: string;
  marathiVillage: string | null;
  entry: ReadyReckonerEntry;
};

/**
 * Look up ready reckoner rates by English village key + survey/CTS number.
 * Index is keyed by English village (e.g. BANDRA-A) and normalized survey (e.g. 268A).
 */
export function lookupReadyReckonerRates(
  index: ReadyReckonerIndex,
  englishVillage: string,
  surveyNo: string
): ReadyReckonerLookupResult | null {
  const villageKey = englishVillage.trim().toUpperCase().replace(/\s*-\s*/g, "-");
  const normalizedVillage = Object.keys(index).find(
    (k) => k.toUpperCase().replace(/\s*-\s*/g, "-") === villageKey.replace(/\s+/g, " ")
  ) ?? englishVillage.trim();

  const villageBucket = index[normalizedVillage] ?? index[englishVillage.trim()];
  if (!villageBucket) return null;

  const candidates = getSurveyLookupCandidates(surveyNo);
  if (candidates.length === 0) return null;

  const requestedSurveyNo = normalizeSurveyNo(surveyNo);

  for (const surveyKey of candidates) {
    const entry = villageBucket[surveyKey];
    if (!entry) continue;

    return {
      village: normalizedVillage,
      surveyNo: surveyKey,
      requestedSurveyNo:
        requestedSurveyNo && requestedSurveyNo !== surveyKey
          ? requestedSurveyNo
          : undefined,
      marathiVillage: englishVillageToMarathi(normalizedVillage),
      entry,
    };
  }

  return null;
}

export function getRateValue(entry: ReadyReckonerEntry, type: ReadyReckonerRateType): number {
  return entry[type] ?? 0;
}
