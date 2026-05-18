/**
 * Maps applicant types (Applicant Details form) to General department appointment-letter permission ids.
 * Must match strings in `APPLICANT_TYPE_OPTIONS` in app/dashboard/applicant/page.tsx
 * and keys in permissionLibrary on create-application.
 */
export const APPLICANT_TYPE_TO_APPOINTMENT_PERMISSION_ID: Record<string, string> = {
  Architect: "Appointment_Letter_for_Architect",
  "Licensed Surveyor": "Appointment_Letter_for_Licensed_Surveyor",
  "Fire Consultant": "Appointment_Letter_for_Fire_Consultant",
  "Landscape Consultant": "Appointment_Letter_for_Landscape_Consultant",
  "Geotechnical Consultant": "Appointment_Letter_for_Geotechnical_Consultant",
  "PMC / Project Manager": "Appointment_Letter_for_PMC_Project_Manager",
  "MEP Consultant": "Appointment_Letter_for_MEP_Consultant",
  Plumber: "Appointment_Letter_for_Plumber",
  "Town Planner": "Appointment_Letter_for_Town_Planner",
  "Structural Engineer": "Appointment_Letter_for_Structural_Engineer",
  "Environmental Consultant": "Appointment_Letter_for_Environmental_Consultant",
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

/** Human-readable `applications.permission_type` for General appointment letters. */
export const APPOINTMENT_PERMISSION_ID_TO_TITLE: Record<string, string> = {
  Appointment_Letter_for_Architect: "Appointment Letter for Architect",
  Appointment_Letter_for_Licensed_Surveyor: "Appointment Letter for Licensed Surveyor",
  Appointment_Letter_for_Fire_Consultant: "Appointment Letter for Fire Consultant",
  Appointment_Letter_for_Landscape_Consultant: "Appointment Letter for Landscape Consultant",
  Appointment_Letter_for_Geotechnical_Consultant: "Appointment Letter for Geotechnical Consultant",
  Appointment_Letter_for_PMC_Project_Manager: "Appointment Letter for PMC / Project Manager",
  Appointment_Letter_for_MEP_Consultant: "Appointment Letter for MEP Consultant",
  Appointment_Letter_for_Plumber: "Appointment Letter for Plumber",
  Appointment_Letter_for_Town_Planner: "Appointment Letter for Town Planner",
  Appointment_Letter_for_Structural_Engineer: "Appointment Letter for Structural Engineer",
  Appointment_Letter_for_Environmental_Consultant: "Appointment Letter for Environmental Consultant",
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

/** Keys in `projects.application_urls` cleared when an application is fully removed. */
export function applicationUrlKeysForPermissionType(permissionType: string): string[] {
  const title = permissionType.trim();
  if (!title) return [];

  for (const [type, permId] of Object.entries(APPLICANT_TYPE_TO_APPOINTMENT_PERMISSION_ID)) {
    const permTitle = APPOINTMENT_PERMISSION_ID_TO_TITLE[permId];
    if (permTitle && permissionTypeMatchesTitle(title, permTitle)) {
      if (type === "Architect") return ["Architect", ARCHITECT_ACCEPTANCE_URL_KEY];
      return [type];
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
  // Loose match: "Appointment Letter for Architect" contains "architect"
  const typeWord = b.replace(/^appointment letter for\s+/i, "").trim();
  return typeWord.length > 0 && a.includes(typeWord);
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
