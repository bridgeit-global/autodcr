import { createClient } from "@supabase/supabase-js";
import { englishVillageToMarathi } from "./reckonerVillageMapping";
import {
  getSurveyLookupCandidates,
  normalizeSurveyNo,
  type ReadyReckonerEntry,
  type ReadyReckonerLookupResult,
} from "./readyReckoner";

type ReadyReckonerRateRow = {
  english_village: string;
  marathi_village: string;
  survey_no: string;
  open_land: number;
  residential: number;
  office: number;
  commercial: number;
  industrial: number;
  address: string;
  rate_unit: string;
  district_id: string;
};

function getSupabaseServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !serviceKey) {
    throw new Error("Supabase service credentials are not configured.");
  }
  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function rowToEntry(row: ReadyReckonerRateRow): ReadyReckonerEntry {
  return {
    openLand: Number(row.open_land) || 0,
    residential: Number(row.residential) || 0,
    office: Number(row.office) || 0,
    commercial: Number(row.commercial) || 0,
    industrial: Number(row.industrial) || 0,
    address: row.address ?? "",
    rateUnit: row.rate_unit ?? "चौरस मीटर",
    districtId: row.district_id ?? "",
  };
}

function getVillageLookupCandidates(village: string): string[] {
  const trimmed = village.trim();
  if (!trimmed) return [];

  const seen = new Set<string>();
  const add = (value: string) => {
    const v = value.trim();
    if (v) seen.add(v);
  };

  add(trimmed);
  add(trimmed.replace(/\s*-\s*/g, " - "));
  add(trimmed.replace(/\s*-\s*/g, "-"));
  add(trimmed.toUpperCase());
  add(trimmed.toUpperCase().replace(/\s*-\s*/g, "-"));

  return [...seen];
}

function pickResolvedVillage(
  rows: ReadyReckonerRateRow[],
  villageCandidates: string[]
): string | null {
  const present = new Set(rows.map((row) => row.english_village));
  for (const candidate of villageCandidates) {
    if (present.has(candidate)) return candidate;
  }
  return rows[0]?.english_village ?? null;
}

/**
 * Look up ready reckoner rates from Supabase by English village + survey/CTS number.
 */
export async function lookupReadyReckonerRatesFromSupabase(
  englishVillage: string,
  surveyNo: string
): Promise<ReadyReckonerLookupResult | null> {
  const client = getSupabaseServiceClient();
  const villageCandidates = getVillageLookupCandidates(englishVillage);
  if (villageCandidates.length === 0) return null;

  const candidates = getSurveyLookupCandidates(surveyNo);
  if (candidates.length === 0) return null;

  const { data, error } = await client
    .from("ready_reckoner_rates")
    .select(
      "english_village, marathi_village, survey_no, open_land, residential, office, commercial, industrial, address, rate_unit, district_id"
    )
    .in("english_village", villageCandidates)
    .in("survey_no", candidates);

  if (error) {
    throw new Error(error.message);
  }

  const rows = (data ?? []) as ReadyReckonerRateRow[];
  if (rows.length === 0) return null;

  const resolvedVillage = pickResolvedVillage(rows, villageCandidates);
  const villageRows = resolvedVillage
    ? rows.filter((row) => row.english_village === resolvedVillage)
    : rows;

  const bySurvey = new Map(villageRows.map((row) => [row.survey_no, row]));
  const requestedSurveyNo = normalizeSurveyNo(surveyNo);

  for (const surveyKey of candidates) {
    const row = bySurvey.get(surveyKey);
    if (!row) continue;

    return {
      village: row.english_village,
      surveyNo: row.survey_no,
      requestedSurveyNo:
        requestedSurveyNo && requestedSurveyNo !== row.survey_no
          ? requestedSurveyNo
          : undefined,
      marathiVillage: row.marathi_village || englishVillageToMarathi(row.english_village),
      entry: rowToEntry(row),
    };
  }

  return null;
}
