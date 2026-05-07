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
