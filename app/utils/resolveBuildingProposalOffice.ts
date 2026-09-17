export type BuildingProposalAddressBlock = {
  /** Planning authority bucket the row belongs to (`ALL` = fallback for every authority). */
  authority: string;
  officerName: string;
  organisation: string;
  line1: string;
  line2: string;
  line3: string;
};

/** Office rows grouped by planning authority, then by office slug. */
export type CorrespondenceOfficesByAuthority = Record<
  string,
  Record<string, BuildingProposalAddressBlock>
>;

/** Bucket used when an authority has no offices of its own. */
export const CORRESPONDENCE_AUTHORITY_ALL = "ALL";

/** Office slug used by authorities that have one office for every region/ward. */
export const CORRESPONDENCE_OFFICE_DEFAULT = "default";

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

/** "M/E Ward" → "M/E", "L" → "L" */
function normalizeWardCode(ward?: string): string {
  return (ward || "").trim().replace(/\s+ward\s*$/i, "").toUpperCase();
}

/** Planning authority value from Save Plot → offices bucket name. */
export function normalizeCorrespondenceAuthority(
  planningAuthority?: string | null
): string {
  const v = (planningAuthority || "").trim().toUpperCase();
  if (!v) return CORRESPONDENCE_AUTHORITY_ALL;
  if (v.includes("MCGM")) return "BMC";
  return v;
}

/**
 * Offices for one planning authority; authorities without their own rows fall
 * back to the shared `ALL` bucket.
 */
export function selectOfficesForAuthority(
  officesByAuthority?: CorrespondenceOfficesByAuthority | null,
  planningAuthority?: string | null
): Record<string, BuildingProposalAddressBlock> | undefined {
  if (!officesByAuthority) return undefined;
  const authority = normalizeCorrespondenceAuthority(planningAuthority);
  return (
    officesByAuthority[authority] ??
    officesByAuthority[CORRESPONDENCE_AUTHORITY_ALL]
  );
}

/** `Executive Engineer - {ward} Ward` → `Executive Engineer - L Ward`. */
export function applyWardToOfficerName(officerName: string, ward?: string): string {
  if (!officerName.includes("{ward}")) return officerName;
  const code = normalizeWardCode(ward);
  if (!code) return officerName.replace(/\s*-?\s*\{ward\}\s*ward/i, "").trim();
  return officerName.replace(/\{ward\}/g, code);
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
 * Resolve the Building Proposal office address from plot region/ward, falling
 * back to the authority's single `default` office when region routing is BMC-only.
 * Rows must come from `building_proposal_offices` where correspondence_type = building_proposal.
 */
export function resolveBuildingProposalOffice(
  region?: string,
  ward?: string,
  officesByKey?: Record<string, BuildingProposalAddressBlock>
): BuildingProposalAddressBlock | undefined {
  if (!officesByKey || Object.keys(officesByKey).length === 0) return undefined;
  const key = resolveOfficeKey(region, ward);
  return (
    (key ? officesByKey[key] : undefined) ??
    officesByKey[CORRESPONDENCE_OFFICE_DEFAULT]
  );
}
