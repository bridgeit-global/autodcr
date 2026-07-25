export type BuildingProposalAddressBlock = {
  officerName: string;
  organisation: string;
  line1: string;
  line2: string;
  line3: string;
};

export type BuildingProposalOfficeKey =
  | "city"
  | "western_i"
  | "western_ii"
  | "eastern"
  | "special_cell";

function normalizeWardPrefix(ward?: string): string {
  const s = (ward || "").trim().toUpperCase();
  if (!s) return "";
  return s.charAt(0);
}

function resolveOfficeKey(
  region?: string,
  ward?: string
): BuildingProposalOfficeKey | undefined {
  const normalizedRegion = (region || "").trim().toLowerCase();
  if (normalizedRegion === "city") return "city";
  if (normalizedRegion === "eastern") return "eastern";
  if (normalizedRegion.includes("special")) return "special_cell";
  if (normalizedRegion === "western") {
    const wardPrefix = normalizeWardPrefix(ward);
    if (wardPrefix === "R" || wardPrefix === "T") return "western_ii";
    return "western_i";
  }
  return undefined;
}

/**
 * Resolve BMC Building Proposal office address from plot region/ward.
 * Rows must come from `building_proposal_offices` where correspondence_type = building_proposal.
 */
export function resolveBuildingProposalOffice(
  region?: string,
  ward?: string,
  officesByKey?: Record<string, BuildingProposalAddressBlock>
): BuildingProposalAddressBlock | undefined {
  if (!officesByKey || Object.keys(officesByKey).length === 0) return undefined;
  const key = resolveOfficeKey(region, ward);
  if (!key) return undefined;
  return officesByKey[key];
}
