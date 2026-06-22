import type { BuildingProposalAddressBlock } from "@/app/utils/resolveBuildingProposalOffice";

export type FireBrigadeOfficeKey =
  | "rcc_i"
  | "rcc_ii"
  | "rcc_iii"
  | "rcc_iv"
  | "rcc_v"
  | "rcc_vi";

/** "M/E Ward" → "M/E", "A Ward" → "A" */
export function normalizeWardCode(ward?: string): string {
  return (ward || "").trim().replace(/\s+ward\s*$/i, "").toUpperCase();
}

export function resolveFireBrigadeOfficeKey(
  ward?: string
): FireBrigadeOfficeKey | undefined {
  const code = normalizeWardCode(ward);
  if (!code) return undefined;

  if (["A", "B", "C", "D", "E"].includes(code)) return "rcc_i";
  if (["F/N", "F/S", "G/N", "G/S"].includes(code)) return "rcc_ii";
  if (["H/E", "H/W", "K/E", "K/W"].includes(code)) return "rcc_iii";
  if (["P/N", "P/S", "R/C", "R/N", "R/S"].includes(code)) return "rcc_iv";
  if (["L", "M/E", "M/W"].includes(code)) return "rcc_v";
  if (["N", "S", "T"].includes(code)) return "rcc_vi";

  return undefined;
}

/**
 * Resolve Mumbai Fire Brigade RCC office from plot ward (Fire Consultant letters only).
 * Rows must come from `building_proposal_offices` where correspondence_type = fire_consultant.
 */
export function resolveFireBrigadeOffice(
  ward?: string,
  officesByKey?: Record<string, BuildingProposalAddressBlock>
): BuildingProposalAddressBlock | undefined {
  if (!officesByKey || Object.keys(officesByKey).length === 0) return undefined;
  const key = resolveFireBrigadeOfficeKey(ward);
  if (!key) return undefined;
  return officesByKey[key];
}
