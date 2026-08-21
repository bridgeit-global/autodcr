import ctsMappingData from "@/app/utils/villageToCtsMapping.json";
import { LOCATION_KEYS } from "./types";

type WardVillageMapping = Record<string, Record<string, string[]>>;
const ctsMapping = ctsMappingData as unknown as WardVillageMapping;

const ZERO = "0";

export function uid(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2, 9);
}

export function parsePincode(...parts: Array<string | null | undefined>): string {
  for (const part of parts) {
    if (!part) continue;
    const match = part.match(/(?:^|\D)(\d{6})(?:\D|$)/);
    if (match?.[1]) return match[1];
  }
  return "";
}

export function leaseAreaOf(row: {
  prcArea: string;
  ulcArea: string;
  bFormArea: string;
  conveyanceArea: string;
  attorneyArea: string;
  dilrMapArea: string;
}): string {
  const values = [
    row.prcArea,
    row.ulcArea,
    row.bFormArea,
    row.conveyanceArea,
    row.attorneyArea,
    row.dilrMapArea,
  ]
    .map((v) => Number(v) || 0)
    .filter((v) => v > 0);
  if (!values.length) return ZERO;
  return Math.min(...values).toString();
}

/** True when a token looks like a CTS / CS survey number (not a zone letter or village name). */
export function isValidCtsToken(value: string): boolean {
  const v = value.trim();
  if (!v || v.length > 32) return false;
  if (/^[A-Za-z]$/.test(v)) return false;
  if (!/\d/.test(v)) return false;
  if (/^[A-Za-z][A-Za-z\s-]*$/.test(v)) return false;
  return /^[\dA-Za-z./-]+$/.test(v);
}

/** Strip village/ward suffix accidentally joined with slash (e.g. 1112/C → 1112). */
function normalizeCtsToken(token: string): string {
  const t = token.trim();
  const villageSuffix = t.match(/^(\d+(?:\/\d+[A-Za-z]?)?)\/([A-Za-z][A-Za-z-]*.*)$/);
  if (villageSuffix?.[1]) return villageSuffix[1];
  return t;
}

/** Village division letter from CTS tokens like 1112/C, BANDRA-C, or a stray "C" chip. */
export function villageDivisionLetterFromCts(raw: unknown): string {
  const tokens = Array.isArray(raw)
    ? raw.flatMap((item) => String(item ?? "").split(/[,;]+/))
    : String(raw ?? "").split(/[,;]+/);

  for (const token of tokens) {
    const t = token.trim();
    if (!t) continue;
    const bandra = t.match(/bandra\s*[-/ ]\s*([A-H])\b/i);
    if (bandra?.[1]) return bandra[1].toUpperCase();
    const slashLetter = t.match(/^\d+(?:\/\d+[A-Za-z]?)?\/([A-H])$/i);
    if (slashLetter?.[1]) return slashLetter[1].toUpperCase();
    if (/^[A-H]$/i.test(t)) return t.toUpperCase();
  }
  return "";
}

export function splitCtsNumbers(raw: string | null | undefined): string[] {
  if (!raw?.trim()) return [];
  const tokens = raw
    .split(/[,;]+/)
    .map((part) => normalizeCtsToken(part.trim()))
    .filter(isValidCtsToken);
  return [...new Set(tokens)];
}

/** Normalize CTS arrays/strings from drafts or AI extraction. */
export function sanitizeCtsNumbers(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return [
      ...new Set(
        raw.flatMap((item) =>
          typeof item === "string" && /[,;]/.test(item)
            ? splitCtsNumbers(item)
            : splitCtsNumbers(String(item))
        )
      ),
    ];
  }
  return splitCtsNumbers(typeof raw === "string" ? raw : String(raw ?? ""));
}

export function normalizePlanningAuthority(
  value: string | null | undefined
): "BMC" | "SRA" | "MHADA" | "MMRDA" | "CIDCO" | "MIDC" | "" {
  const v = (value ?? "").trim().toUpperCase();
  if (v.includes("BMC") || v.includes("MCGM")) return "BMC";
  if (v.includes("SRA")) return "SRA";
  if (v.includes("MHADA")) return "MHADA";
  if (v.includes("MMRDA")) return "MMRDA";
  if (v.includes("CIDCO")) return "CIDCO";
  if (v.includes("MIDC")) return "MIDC";
  return "";
}

export function normalizeRegion(value: string | null | undefined): string {
  const v = (value ?? "").trim();
  if (!v) return "";
  // Ward mis-filed under region (e.g. "H/W Ward") — handled by normalizeWard instead.
  if (/\bward\b/i.test(v)) return "";
  if (/western/i.test(v)) return "Western";
  if (/eastern/i.test(v)) return "Eastern";
  if (/city/i.test(v)) return "City";
  return v;
}

export function normalizeZone(value: string | null | undefined): string {
  const v = (value ?? "").trim();
  if (!v) return "";

  const zoneLabel = v.match(/zone\s*([IVXLC]+|\d+)/i);
  if (zoneLabel?.[1]) {
    const token = zoneLabel[1].toUpperCase();
    const numToRoman: Record<string, string> = {
      "1": "I",
      "2": "II",
      "3": "III",
      "4": "IV",
      "5": "V",
      "6": "VI",
      "7": "VII",
    };
    const roman = numToRoman[token] ?? token;
    return `Zone ${roman}`;
  }

  if (/^[IVXLC]+$/i.test(v)) return `Zone ${v.toUpperCase()}`;
  if (v.startsWith("Zone ")) return v.replace(/\s+/g, " ");

  return v;
}

export function normalizeWard(value: string | null | undefined): string {
  const v = (value ?? "").trim();
  if (!v) return "";
  if (WARD_TO_ZONE[v]) return v;

  const upper = v.toUpperCase();
  const aliases: Record<string, string> = {
    "H/W": "H/W Ward",
    HW: "H/W Ward",
    "H.W.": "H/W Ward",
    "H/W WARD": "H/W Ward",
    "H/E": "H/E Ward",
    HE: "H/E Ward",
    "H/E WARD": "H/E Ward",
    L: "L Ward",
    "L WARD": "L Ward",
  };

  if (aliases[upper]) return aliases[upper];
  if (/^H\s*\/?\s*W/i.test(v)) return "H/W Ward";
  if (/^H\s*\/?\s*E/i.test(v)) return "H/E Ward";

  if (!/\bward\b/i.test(v)) {
    const withSuffix = `${v} Ward`.replace(/\s+/g, " ");
    if (WARD_TO_ZONE[withSuffix]) return withSuffix;
  }

  return v.replace(/\s+/g, " ");
}

export function normalizeVillageName(value: string | null | undefined): string {
  const v = (value ?? "").trim();
  if (!v) return "";
  return v.replace(/[.,;]+$/, "").trim();
}

/** Map extracted village names to Project Details dropdown labels for a ward. */
export function normalizeVillageForWard(
  ward: string | null | undefined,
  village: string | null | undefined
): string {
  const w = (ward ?? "").trim();
  let v = normalizeVillageName(village);
  if (!v) return "";

  const kurlaPart = v.match(/kurla\s*(?:part[\s-]*)?(\d+)/i);
  if (kurlaPart?.[1]) {
    v = `KURLA - ${kurlaPart[1]}`;
  }

  const bandraPart = v.match(/^bandra\s*[-/ ]\s*([A-H])$/i);
  if (bandraPart?.[1]) {
    v = `BANDRA-${bandraPart[1].toUpperCase()}`;
  } else if (/^bandra-[a-z]$/i.test(v)) {
    v = v.toUpperCase();
  }

  if (w === "L Ward" && /kurla/i.test(v)) {
    const digit = v.match(/(\d+)/);
    if (digit?.[1]) v = `KURLA - ${digit[1]}`;
  }

  if (w) return matchVillageToWardOptions(w, v);
  if (looksLikeRoadOrAddress(v)) return "";
  return v;
}

/** True when village is an exact CS/CTS dropdown option for the ward. */
export function isKnownVillageForWard(
  ward: string | null | undefined,
  village: string | null | undefined
): boolean {
  const w = (ward ?? "").trim();
  const v = normalizeVillageName(village);
  if (!w || !v) return false;
  return Object.keys(ctsMapping[w] ?? {}).includes(v);
}

function looksLikeRoadOrAddress(value: string): boolean {
  return /\b(road|rd\.?|street|st\.?|marg|lane|nagar|property|west|east)\b/i.test(value);
}

/** Fuzzy-match a village label to the ward's dropdown options (from CS/CTS mapping). */
export function matchVillageToWardOptions(ward: string, village: string): string {
  const v = normalizeVillageName(village);
  if (!v || !ward) return v;

  const wardVillages = Object.keys(ctsMapping[ward] ?? {});
  if (!wardVillages.length) return v;
  if (wardVillages.includes(v)) return v;

  const upper = v.toUpperCase();
  const exactCi = wardVillages.find((option) => option.toUpperCase() === upper);
  if (exactCi) return exactCi;

  // Only map a bare locality when the ward has a single matching option.
  if (/^kurla$/i.test(v.trim())) {
    const kurlaOpts = wardVillages.filter((option) => /^KURLA - \d+$/.test(option));
    if (kurlaOpts.length === 1) return kurlaOpts[0];
    return v;
  }

  if (/^bandra$/i.test(v.trim())) {
    const bandraOpts = wardVillages.filter((option) => /^BANDRA-[A-H]$/.test(option));
    if (bandraOpts.length === 1) return bandraOpts[0];
    return v;
  }

  if (v.includes("-")) {
    const partial = wardVillages.find(
      (option) =>
        option.toUpperCase() === upper || option.toUpperCase().startsWith(`${upper}-`)
    );
    if (partial) return partial;
  }

  if (looksLikeRoadOrAddress(v)) return "";
  return "";
}

/** Infer village from CTS numbers using the static ward → village → CTS map. */
export function inferVillageFromCts(ward: string, ctsNumbers: string[]): string {
  if (!ward || !ctsNumbers.length) return "";

  const wardData = ctsMapping[ward];
  if (!wardData) return "";

  let candidates: Set<string> | null = null;

  for (const cts of ctsNumbers) {
    const root = cts.split("/")[0]?.trim();
    const hits = new Set<string>();
    for (const [village, numbers] of Object.entries(wardData)) {
      if (numbers.includes(cts) || (root && numbers.includes(root))) {
        hits.add(village);
      }
    }
    if (hits.size === 0) continue;
    candidates = candidates
      ? new Set([...candidates].filter((village: string) => hits.has(village)))
      : hits;
  }

  if (!candidates || candidates.size !== 1) return "";
  return [...candidates][0];
}

export function parseAddressHints(...parts: Array<string | null | undefined>): {
  ward: string;
  village: string;
  cts: string[];
} {
  const text = parts.filter(Boolean).join(" ");
  const wardMatch = text.match(/\bH\s*\/?\s*[WE]\s*Ward\b|\bL\s+Ward\b|\bK\s*\/?\s*[WE]\s+Ward\b/i);

  const villageMatch =
    text.match(/\bof\s+([A-Z][A-Z0-9-]+)\s+Village\b/i) ||
    text.match(/\b(BANDRA\s*[-/ ]\s*[A-H])\b/i) ||
    text.match(/\b(Kurla\s*Part-?\s*\d+)\b/i) ||
    text.match(/\b(KURLA(?:\s+Part-\d+)?)\b/i);

  const ctsMatches = text.match(/\bCTS\s*[:\s#-]*([0-9/,\s]+)/i);

  return {
    ward: wardMatch ? normalizeWard(wardMatch[0]) : "",
    village: villageMatch
      ? normalizeVillageName(villageMatch[1] ?? villageMatch[0])
      : "",
    cts: ctsMatches?.[1] ? splitCtsNumbers(ctsMatches[1]) : [],
  };
}

/** DP Remarks often extract zone letter R/C/I — form stores 1–7. */
export function normalizeDpZoneForForm(value: string | null | undefined): string {
  const v = (value ?? "").trim();
  if (!v) return "";
  if (/^[1-7]$/.test(v)) return v;

  const upper = v.toUpperCase();
  const letterMap: Record<string, string> = {
    R: "1",
    C: "2",
    I: "3",
    SDZ: "4",
    P: "5",
    NA: "6",
    GZ: "7",
  };

  const paren = upper.match(/\(([A-Z]+)\)/);
  if (paren?.[1] && letterMap[paren[1]]) return letterMap[paren[1]];

  if (letterMap[upper]) return letterMap[upper];
  if (upper.includes("RESIDENTIAL")) return "1";
  if (upper.includes("COMMERCIAL")) return "2";
  if (upper.includes("INDUSTRIAL")) return "3";

  return "";
}

export function pickString(...values: Array<string | null | undefined>): string {
  for (const v of values) {
    if (v?.trim()) return v.trim();
  }
  return "";
}

export type RawExtractRow = {
  extractNo?: string | null;
  prcArea?: string | null;
  ulcArea?: string | null;
  bFormArea?: string | null;
  conveyanceArea?: string | null;
  attorneyArea?: string | null;
  dilrMapArea?: string | null;
  isLeaf?: boolean | string | null;
};

export function parseExtractsJson(raw: string | null | undefined): RawExtractRow[] {
  if (!raw?.trim()) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed as RawExtractRow[];
  } catch {
    return [];
  }
}

export function hasLocationData(extracted: Record<string, string | null>): boolean {
  return LOCATION_KEYS.some((key) => Boolean(extracted[key]?.trim()));
}

export function isLeafRow(row: RawExtractRow): boolean {
  if (row.isLeaf === true || row.isLeaf === "true") return true;
  if (row.isLeaf === false || row.isLeaf === "false") return false;
  const no = (row.extractNo ?? "").trim();
  return /\/\d+/.test(no);
}

export function defaultPlotBelongsForRegion(
  region: string
): "CTS No." | "CS No." | "F.P.No" | "" {
  if (region === "City") return "CS No.";
  if (region === "Western" || region === "Eastern") return "CTS No.";
  return "";
}

/** Mumbai ward → zone → region (matches Project Details ward dropdown map). */
const WARD_TO_ZONE: Record<string, string> = {
  "A Ward": "Zone I",
  "B Ward": "Zone I",
  "C Ward": "Zone I",
  "D Ward": "Zone I",
  "E Ward": "Zone I",
  "F/N Ward": "Zone II",
  "F/S Ward": "Zone II",
  "G/N Ward": "Zone II",
  "G/S Ward": "Zone II",
  "H/E Ward": "Zone III",
  "H/W Ward": "Zone III",
  "K/E Ward": "Zone III",
  "K/W Ward": "Zone IV",
  "P/S Ward": "Zone IV",
  "P/N Ward": "Zone IV",
  "L Ward": "Zone V",
  "M/E Ward": "Zone V",
  "M/W Ward": "Zone V",
  "N Ward": "Zone VI",
  "S Ward": "Zone VI",
  "T Ward": "Zone VI",
  "R/N Ward": "Zone VII",
  "R/C Ward": "Zone VII",
  "R/S Ward": "Zone VII",
};

const ZONE_TO_REGION: Record<string, string> = {
  "Zone I": "City",
  "Zone II": "City",
  "Zone III": "Western",
  "Zone IV": "Western",
  "Zone V": "Eastern",
  "Zone VI": "Eastern",
  "Zone VII": "Eastern",
};

/** Find ward from village label using static CS/CTS mapping (unique match only). */
export function inferWardFromVillage(village: string | null | undefined): string {
  const normalized = normalizeVillageName(village);
  if (!normalized) return "";

  const upper = normalized.toUpperCase();
  const matches = new Set<string>();

  for (const [ward, villages] of Object.entries(ctsMapping)) {
    if (villages[normalized] || villages[upper]) {
      matches.add(ward);
    }
  }

  return matches.size === 1 ? [...matches][0] : "";
}

export function inferLocationFromWard(ward: string | null | undefined): {
  region: string;
  zone: string;
} {
  const normalized = (ward ?? "").trim();
  if (!normalized) return { region: "", zone: "" };

  const zone = WARD_TO_ZONE[normalized] ?? "";
  const region = zone ? ZONE_TO_REGION[zone] ?? "" : "";
  return { region, zone };
}

export function enrichSavePlotLocation(patch: Record<string, unknown>): Record<string, unknown> {
  const next = { ...patch };

  // Recover ward/zone mis-filed under region by Gemini.
  const rawRegion = pickString(next.region as string | null | undefined);
  if (rawRegion && /\bward\b/i.test(rawRegion)) {
    next.ward = normalizeWard(rawRegion);
    next.region = "";
  }

  if (next.zone) next.zone = normalizeZone(String(next.zone));
  if (next.ward) next.ward = normalizeWard(String(next.ward));

  if (next.villageName && !next.ward) {
    const village = normalizeVillageForWard(
      pickString(next.ward as string | undefined),
      String(next.villageName)
    );
    if (village) next.villageName = village;
    const inferredWard = inferWardFromVillage(village || String(next.villageName));
    if (inferredWard) next.ward = inferredWard;
  }

  const ward = pickString(next.ward as string | null | undefined);
  const zone = pickString(next.zone as string | null | undefined);

  if (ward && (!next.region || !next.zone)) {
    const inferred = inferLocationFromWard(ward);
    if (!next.region && inferred.region) next.region = inferred.region;
    if (!next.zone && inferred.zone) next.zone = inferred.zone;
  }

  if (zone && !next.region) {
    next.region = ZONE_TO_REGION[zone] ?? next.region;
  }

  const region = pickString(next.region as string | null | undefined);
  if (region && !next.planningAuthority) {
    next.planningAuthority = "BMC";
  }

  if (region && !next.plotBelongsTo) {
    const plotBelongs = defaultPlotBelongsForRegion(region);
    if (plotBelongs) next.plotBelongsTo = plotBelongs;
  }

  const hints = parseAddressHints(
    pickString(next.propertyAddress as string | undefined),
    pickString(next.landmark as string | undefined),
    pickString(next.villageName as string | undefined)
  );
  if (!pickString(next.ward as string | undefined) && hints.ward) {
    next.ward = hints.ward;
  }

  const hintedVillage = hints.village
    ? normalizeVillageForWard(
        pickString(next.ward as string | undefined),
        hints.village
      )
    : "";
  const currentVillageEarly = pickString(next.villageName as string | undefined);
  const wardForVillage = pickString(next.ward as string | undefined);
  const currentValid =
    !!currentVillageEarly &&
    !!wardForVillage &&
    Object.keys(ctsMapping[wardForVillage] ?? {}).includes(currentVillageEarly);
  if (hintedVillage && (!currentVillageEarly || !currentValid)) {
    next.villageName = hintedVillage;
  }
  if (
    hints.cts.length &&
    (!next.proposedCtsNumber ||
      !(Array.isArray(next.proposedCtsNumber) && (next.proposedCtsNumber as string[]).length))
  ) {
    next.proposedCtsNumber = hints.cts;
  }

  if (next.villageName) {
    next.villageName = normalizeVillageForWard(
      pickString(next.ward as string | undefined),
      String(next.villageName)
    );
  }

  const resolvedWard = pickString(next.ward as string | undefined);
  const resolvedVillage = pickString(next.villageName as string | undefined);
  if (
    resolvedWard &&
    resolvedVillage &&
    !isKnownVillageForWard(resolvedWard, resolvedVillage) &&
    !/^bandra$/i.test(resolvedVillage)
  ) {
    next.villageName = "";
  }

  const finalWard = pickString(next.ward as string | undefined);
  const ctsRaw = next.proposedCtsNumber;
  const divisionLetter = villageDivisionLetterFromCts(ctsRaw);
  const currentVillage = pickString(next.villageName as string | undefined);
  if (finalWard && divisionLetter && /^bandra$/i.test(currentVillage)) {
    next.villageName = normalizeVillageForWard(finalWard, `BANDRA-${divisionLetter}`);
  } else if (finalWard && divisionLetter && !currentVillage) {
    const withLetter = matchVillageToWardOptions(finalWard, `BANDRA-${divisionLetter}`);
    if (withLetter) next.villageName = withLetter;
  }

  const ctsList = Array.isArray(ctsRaw)
    ? ctsRaw.map(String)
    : typeof ctsRaw === "string" && ctsRaw
      ? splitCtsNumbers(ctsRaw)
      : [];

  if (finalWard && ctsList.length && !pickString(next.villageName as string | undefined)) {
    const fromCts = inferVillageFromCts(finalWard, ctsList);
    if (fromCts) next.villageName = fromCts;
  }

  if (next.proposedCtsNumber) {
    next.proposedCtsNumber = sanitizeCtsNumbers(next.proposedCtsNumber);
  }

  if (next.dpZone) {
    next.dpZone = normalizeDpZoneForForm(String(next.dpZone));
  }

  return next;
}
