/** Valid `projects.application_urls` keys for acceptance letters. */
export const VALID_ACCEPTANCE_APPLICATION_URL_KEYS = new Set([
  "Architect_acceptance",
  "Licensed_Surveyor_acceptance",
  "Fire_Safety_acceptance",
  "Landscape_Consultant_acceptance",
  "Geotechnical_Consultant_acceptance",
  "ME_Consultant_acceptance",
  "Plumber_acceptance",
  "Town_Planner_acceptance",
  "Structural_Engineer_acceptance",
  "Environmental_Consultant_acceptance",
  "PMC_Project_Manager_acceptance",
]);

export function isValidApplicationUrlsKey(
  applicationUrlsKey: string,
  templateType: string
): boolean {
  return (
    applicationUrlsKey === templateType ||
    VALID_ACCEPTANCE_APPLICATION_URL_KEYS.has(applicationUrlsKey)
  );
}
