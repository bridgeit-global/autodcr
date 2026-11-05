/**
 * Maps applicant types (Applicant Details form) to General department appointment-letter catalog ids.
 * Must match strings in `APPLICANT_TYPE_OPTIONS` in app/dashboard/applicant/page.tsx
 * and `application_types.slug` in the catalog. Create Application roster filter prefers catalog
 * `requires_roster_match` + `applicant_type`.
 */
export const APPLICANT_TYPE_TO_APPOINTMENT_PERMISSION_ID: Record<string, string> = {
  Architect: "appointment_letter_for_architect",
  "Licensed Surveyor": "appointment_letter_for_licensed_surveyor",
  "Fire Consultant": "appointment_letter_for_fire_consultant",
  "Landscape Consultant": "appointment_letter_for_landscape_consultant",
  "Geotechnical Consultant": "appointment_letter_for_geotechnical_consultant",
  "PMC / Project Manager": "appointment_letter_for_pmc_project_manager",
  "MEP Consultant": "appointment_letter_for_mep_consultant",
  Plumber: "appointment_letter_for_plumber",
  "Town Planner": "appointment_letter_for_town_planner",
  "Structural Engineer": "appointment_letter_for_structural_engineer",
  "Site Supervisor": "appointment_letter_for_site_supervisor",
  "Environmental Consultant": "appointment_letter_for_environmental_consultant",
};

const NORMALIZED_APPOINTMENT_PERMISSION_ID: Record<string, string> = Object.fromEntries(
  Object.entries(APPLICANT_TYPE_TO_APPOINTMENT_PERMISSION_ID).map(([k, v]) => [k.toLowerCase(), v])
);

type ApplicantRow = {
  applicantType?: string;
  applicant_type?: string;
};

type ApplicantDetailsShape = {
  applicants?: ApplicantRow[];
};

/** Human-readable `applications.permission_type` for consultant document packs. */
export const APPOINTMENT_PERMISSION_ID_TO_TITLE: Record<string, string> = {
  appointment_letter_for_architect: "Documents of Architect",
  appointment_letter_for_licensed_surveyor: "Documents of Licensed Surveyor",
  appointment_letter_for_fire_consultant: "Documents of Fire Consultant",
  appointment_letter_for_landscape_consultant: "Documents of Landscape Consultant",
  appointment_letter_for_geotechnical_consultant: "Documents of Geotechnical Consultant",
  appointment_letter_for_pmc_project_manager: "Documents of PMC / Project Manager",
  appointment_letter_for_mep_consultant: "Documents of MEP Consultant",
  appointment_letter_for_plumber: "Documents of Plumber",
  appointment_letter_for_town_planner: "Documents of Town Planner",
  appointment_letter_for_structural_engineer: "Documents of Structural Engineer",
  appointment_letter_for_site_supervisor: "Documents of Site Supervisor",
  appointment_letter_for_environmental_consultant: "Documents of Environmental Consultant",
  // Legacy Pascal ids still resolve titles for older client caches.
  Appointment_Letter_for_Architect: "Documents of Architect",
  Appointment_Letter_for_Licensed_Surveyor: "Documents of Licensed Surveyor",
  Appointment_Letter_for_Fire_Consultant: "Documents of Fire Consultant",
  Appointment_Letter_for_Landscape_Consultant: "Documents of Landscape Consultant",
  Appointment_Letter_for_Geotechnical_Consultant: "Documents of Geotechnical Consultant",
  Appointment_Letter_for_PMC_Project_Manager: "Documents of PMC / Project Manager",
  Appointment_Letter_for_MEP_Consultant: "Documents of MEP Consultant",
  Appointment_Letter_for_Plumber: "Documents of Plumber",
  Appointment_Letter_for_Town_Planner: "Documents of Town Planner",
  Appointment_Letter_for_Structural_Engineer: "Documents of Structural Engineer",
  Appointment_Letter_for_Site_Supervisor: "Documents of Site Supervisor",
  Appointment_Letter_for_Environmental_Consultant: "Documents of Environmental Consultant",
};

const NORMALIZED_APPLICANT_TYPE_TO_PERMISSION_TITLE: Record<string, string> = Object.fromEntries(
  Object.entries(APPLICANT_TYPE_TO_APPOINTMENT_PERMISSION_ID).map(([type, permId]) => [
    type.toLowerCase(),
    APPOINTMENT_PERMISSION_ID_TO_TITLE[permId] ?? "",
  ])
);

export function applicantTypeToPermissionTitle(applicantType: string): string | null {
  const title = NORMALIZED_APPLICANT_TYPE_TO_PERMISSION_TITLE[applicantType.trim().toLowerCase()];
  return title || null;
}

/** Reverse map: `applications.permission_type` title → applicant roster type (e.g. Architect). */
export function permissionTitleToApplicantType(permissionType: string): string | null {
  const normalized = permissionType.trim().toLowerCase();
  if (!normalized) return null;

  for (const [type, permId] of Object.entries(APPLICANT_TYPE_TO_APPOINTMENT_PERMISSION_ID)) {
    const title = APPOINTMENT_PERMISSION_ID_TO_TITLE[permId];
    if (title && title.trim().toLowerCase() === normalized) return type;
  }

  for (const [type, permId] of Object.entries(APPLICANT_TYPE_TO_APPOINTMENT_PERMISSION_ID)) {
    const title = APPOINTMENT_PERMISSION_ID_TO_TITLE[permId];
    if (title && permissionTypeMatchesTitle(permissionType, title)) return type;
  }

  return null;
}

export const ARCHITECT_ACCEPTANCE_URL_KEY = "Architect_acceptance";

/**
 * Maps applicant types to their `application_urls` acceptance key.
 * All types that have an acceptance letter template are listed here.
 */
export const ACCEPTANCE_URL_KEY_MAP: Partial<Record<string, string>> = {
  Architect: "Architect_acceptance",
  "Licensed Surveyor": "Licensed_Surveyor_acceptance",
  "Fire Consultant": "Fire_Safety_acceptance",
  "Landscape Consultant": "Landscape_Consultant_acceptance",
  "Geotechnical Consultant": "Geotechnical_Consultant_acceptance",
  "M&E Consultant": "ME_Consultant_acceptance",
  Plumber: "Plumber_acceptance",
  "Town Planner": "Town_Planner_acceptance",
  "Structural Engineer": "Structural_Engineer_acceptance",
  "Environmental Consultant": "Environmental_Consultant_acceptance",
  "PMC / Project Manager": "PMC_Project_Manager_acceptance",
  "Site Supervisor": "Site_Supervisor_acceptance",
};

/** All valid acceptance URL keys (for server-side validation). */
export const VALID_ACCEPTANCE_URL_KEYS = new Set(Object.values(ACCEPTANCE_URL_KEY_MAP) as string[]);

/**
 * Maps applicant roster types to `projects.application_urls` / Storage appointment keys
 * (must match TemplateType used by save-application-pdf).
 */
const APPLICANT_TYPE_TO_APPLICATION_URL_KEY: Record<string, string> = {
  Architect: "Architect",
  "Licensed Surveyor": "Licensed Surveyor",
  "Fire Consultant": "Fire Safety Consultant",
  "Landscape Consultant": "Landscape Consultant",
  "Geotechnical Consultant": "Geotechnical Consultant",
  "MEP Consultant": "M&E Consultant",
  Plumber: "Plumber",
  "Town Planner": "Town Planner",
  "Structural Engineer": "Structural Engineer",
  "Site Supervisor": "Site Supervisor",
  "Environmental Consultant": "Environmental Consultant",
  "PMC / Project Manager": "PMC / Project Manager",
};

/**
 * Legacy `projects.application_urls` keys (`Architect`, `Architect_acceptance`) are not
 * `application_documents.slug`. Map them to the catalog type slug and letter variant.
 */
export function applicationUrlKeyToCatalogType(urlsKey: string): {
  typeSlug: string;
  letterVariant: "appointment" | "acceptance";
} | null {
  const key = urlsKey.trim();
  if (!key) return null;

  for (const [applicantType, appointmentKey] of Object.entries(
    APPLICANT_TYPE_TO_APPLICATION_URL_KEY
  )) {
    if (appointmentKey !== key) continue;
    const typeSlug = APPLICANT_TYPE_TO_APPOINTMENT_PERMISSION_ID[applicantType];
    if (!typeSlug) return null;
    return { typeSlug, letterVariant: "appointment" };
  }

  for (const [applicantType, acceptanceKey] of Object.entries(ACCEPTANCE_URL_KEY_MAP)) {
    if (acceptanceKey !== key) continue;
    const typeSlug = APPLICANT_TYPE_TO_APPOINTMENT_PERMISSION_ID[applicantType];
    if (!typeSlug) return null;
    return { typeSlug, letterVariant: "acceptance" };
  }

  return null;
}

/** Keys in `projects.application_urls` cleared when an application is fully removed. */
export function applicationUrlKeysForPermissionType(permissionType: string): string[] {
  const title = permissionType.trim();
  if (!title) return [];

  for (const [type, permId] of Object.entries(APPLICANT_TYPE_TO_APPOINTMENT_PERMISSION_ID)) {
    const permTitle = APPOINTMENT_PERMISSION_ID_TO_TITLE[permId];
    if (permTitle && permissionTypeMatchesTitle(title, permTitle)) {
      const urlKey = APPLICANT_TYPE_TO_APPLICATION_URL_KEY[type] ?? type;
      const acceptanceKey = ACCEPTANCE_URL_KEY_MAP[type];
      if (acceptanceKey) return [urlKey, acceptanceKey];
      return [urlKey];
    }
  }

  return [title];
}

/** Normalize project ids for map keys (uuid/text from mixed Supabase columns). */
export function normalizeProjectId(projectId: string | null | undefined): string {
  return String(projectId ?? "").trim().toLowerCase();
}

export function permissionTypeMatchesTitle(
  permissionType: string,
  allowedTitle: string | null | undefined
): boolean {
  if (!allowedTitle) return false;
  const a = permissionType.trim().toLowerCase();
  const b = allowedTitle.trim().toLowerCase();
  if (a === b) return true;
  // Loose match: "Documents of Architect" / legacy "Appointment Letter for Architect"
  const typeWord = b
    .replace(/^documents of\s+/i, "")
    .replace(/^appointment letter for\s+/i, "")
    .trim();
  if (typeWord.length > 0 && a.includes(typeWord)) return true;
  // Legacy permission_type still on older rows
  const legacy = `appointment letter for ${typeWord}`;
  return typeWord.length > 0 && a === legacy;
}

export function getAppointmentPermissionIdsFromApplicantDetails(
  applicantDetails: unknown
): Set<string> {
  const details = (applicantDetails ?? {}) as ApplicantDetailsShape;
  const applicants = details.applicants ?? [];
  const ids = new Set<string>();
  for (const row of applicants) {
    const type = row.applicantType || row.applicant_type;
    if (typeof type !== "string" || !type) continue;
    const permId = NORMALIZED_APPOINTMENT_PERMISSION_ID[type.trim().toLowerCase()];
    if (permId) ids.add(permId);
  }
  return ids;
}
