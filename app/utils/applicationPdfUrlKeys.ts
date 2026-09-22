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

/**
 * Catalog `application_documents.id` shape (e.g. `proposal_full_potential`, `fact_sheet`).
 * Used as `projects.application_urls` keys for multi-document department permissions.
 */
export const CATALOG_APPLICATION_URL_KEY_RE = /^[a-z][a-z0-9_]{0,127}$/;

export function isCatalogApplicationUrlsKey(applicationUrlsKey: string): boolean {
  return CATALOG_APPLICATION_URL_KEY_RE.test(applicationUrlsKey);
}

export function isValidApplicationUrlsKey(
  applicationUrlsKey: string,
  templateType: string
): boolean {
  return (
    applicationUrlsKey === templateType ||
    VALID_ACCEPTANCE_APPLICATION_URL_KEYS.has(applicationUrlsKey) ||
    isCatalogApplicationUrlsKey(applicationUrlsKey)
  );
}

/**
 * Storage / QR key for a saved application PDF.
 * Multi-doc department permissions use `catalogDocumentId`.
 * Dual-letter consultants keep `templateType` / `*_acceptance` keys.
 */
export function resolveApplicationUrlsKey(params: {
  templateType: string;
  letterVariant?: "appointment" | "acceptance" | null;
  catalogDocumentId?: string | null;
  /** Dual-letter consultant apps must not key by catalog document id. */
  isDualLetter?: boolean;
  acceptanceKeyByTemplateType?: Partial<Record<string, string>>;
}): string {
  const catalogId = params.catalogDocumentId?.trim() || "";
  if (catalogId && !params.isDualLetter) {
    return catalogId;
  }
  if (params.letterVariant === "acceptance") {
    return (
      params.acceptanceKeyByTemplateType?.[params.templateType] ??
      `${params.templateType}_acceptance`
    );
  }
  return params.templateType;
}
