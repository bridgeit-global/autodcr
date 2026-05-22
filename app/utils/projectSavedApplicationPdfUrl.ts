import { supabase } from "@/app/utils/supabase";

export const PROJECT_LIBRARY_BUCKET = "project-library";

/** Matches `save-application-pdf` storage object naming. */
export function applicationUrlsKeyToStorageSlug(applicationUrlsKey: string): string {
  return applicationUrlsKey.replace(/[/\\]/g, "-").replace(/\s+/g, "_");
}

export function projectSavedApplicationPdfStoragePath(
  projectId: string,
  applicationUrlsKey: string
): string {
  return `${projectId.trim()}/saved-applications/${applicationUrlsKeyToStorageSlug(applicationUrlsKey)}.pdf`;
}

/** Stable public URL for a saved application PDF (same path the API uploads to). */
export function projectSavedApplicationPdfPublicUrl(
  projectId: string,
  applicationUrlsKey: string
): string {
  const path = projectSavedApplicationPdfStoragePath(projectId, applicationUrlsKey);
  const { data } = supabase.storage.from(PROJECT_LIBRARY_BUCKET).getPublicUrl(path);
  const url = data?.publicUrl?.trim();
  if (!url) {
    throw new Error("Could not resolve public URL for saved application PDF.");
  }
  return url;
}

export function readApplicationUrlFromUrls(
  raw: unknown,
  key: string
): string | undefined {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return undefined;
  const v = (raw as Record<string, unknown>)[key];
  return typeof v === "string" && v.trim() ? v.trim() : undefined;
}

/** Use stored URL when present; otherwise the URL the upload will write (for QR on first save). */
export function resolveSavedPdfUrlForQr(
  projectId: string,
  applicationUrlsKey: string,
  urlsRaw: unknown
): string {
  return (
    readApplicationUrlFromUrls(urlsRaw, applicationUrlsKey) ??
    projectSavedApplicationPdfPublicUrl(projectId, applicationUrlsKey)
  );
}
