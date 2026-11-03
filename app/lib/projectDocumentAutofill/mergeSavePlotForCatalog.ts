import { loadDraft } from "@/app/utils/draftStorage";

/**
 * Library-owned Save Plot keys that Document Checklist must see even when the
 * DB row is stale (Edit Project draft / autofill not yet PUT).
 */
const LIBRARY_CATALOG_KEYS = [
  "prcDownloadDate",
  "proposedCtsNumber",
  "sacNo",
  "grossPlotArea",
  "villageName",
  "ward",
  "zone",
  "region",
  "planningAuthority",
  "plotBelongsTo",
] as const;

function nonEmpty(value: unknown): boolean {
  if (value == null) return false;
  if (typeof value === "string") return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  return true;
}

/**
 * Merge local Save Plot draft over DB `save_plot_details` for catalog/preview.
 * Prefers non-empty DigiSatbara `prcDownloadDate` from either source.
 */
export function mergeSavePlotDetailsForCatalog(
  dbSavePlot: Record<string, unknown> | null | undefined
): Record<string, unknown> {
  const db = (dbSavePlot && typeof dbSavePlot === "object" ? dbSavePlot : {}) as Record<
    string,
    unknown
  >;
  const draft =
    (typeof window !== "undefined"
      ? (loadDraft("draft-project-details-save-plot", null) as Record<
          string,
          unknown
        > | null)
      : null) || {};

  const merged: Record<string, unknown> = { ...db, ...draft };

  for (const key of LIBRARY_CATALOG_KEYS) {
    const fromDraft = draft[key];
    const fromDb = db[key];
    if (nonEmpty(fromDraft)) {
      merged[key] = fromDraft;
    } else if (nonEmpty(fromDb)) {
      merged[key] = fromDb;
    } else if (key === "prcDownloadDate") {
      merged[key] =
        String(fromDraft || fromDb || db.prc_download_date || "").trim() || "";
    }
  }

  // Explicit DigiSatbara date preference (draft first, then DB).
  const date =
    String(
      draft.prcDownloadDate ||
        db.prcDownloadDate ||
        db.prc_download_date ||
        ""
    ).trim() || "";
  if (date) merged.prcDownloadDate = date;

  return merged;
}
