import { supabase } from "@/app/utils/supabase";
import { PROJECT_LIBRARY_BUCKET } from "@/app/utils/projectSavedApplicationPdfUrl";

export function isDurableLibraryUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  const trimmed = url.trim();
  return /^https?:\/\//i.test(trimmed) && !trimmed.startsWith("blob:");
}

/** Resolve object key inside the project-library bucket. */
export function projectLibraryObjectPath(
  projectId: string,
  pathOrRel: string
): string {
  const raw = pathOrRel.trim().replace(/^\/+/, "").replace(/\\/g, "/");
  if (!raw || !projectId) return "";
  if (raw.includes("/saved-applications/") || raw.includes("document-drafts/")) {
    return raw;
  }
  if (raw.includes("project-library/")) {
    if (raw.startsWith(`${projectId}/`)) return raw;
    if (raw.startsWith("project-library/")) return `${projectId}/${raw}`;
    return raw;
  }
  return `${projectId}/project-library/${raw}`;
}

export function publicUrlForProjectLibraryPath(
  projectId: string,
  pathOrRel: string
): string {
  const storagePath = projectLibraryObjectPath(projectId, pathOrRel);
  if (!storagePath) return "";
  const { data } = supabase.storage
    .from(PROJECT_LIBRARY_BUCKET)
    .getPublicUrl(storagePath);
  return data?.publicUrl || "";
}

export function withDurableLibraryUrl<T extends { path?: string; url?: string }>(
  projectId: string | null | undefined,
  upload: T
): T {
  if (isDurableLibraryUrl(upload.url)) return upload;
  const path = upload.path?.trim() || "";
  if (!projectId || !path) {
    return {
      ...upload,
      url: isDurableLibraryUrl(upload.url) ? upload.url : "",
    };
  }
  const url = publicUrlForProjectLibraryPath(projectId, path);
  return { ...upload, url: url || "" };
}

export function sanitizeLibraryUploadsForPersist<
  T extends { path?: string; url?: string; name?: string },
>(projectId: string | null | undefined, uploads: T[]): T[] {
  return uploads
    .filter((u) => u != null)
    .map((u) => withDurableLibraryUrl(projectId, u));
}

/** Download the raw file from project-library storage (edit-mode hydrate). */
export async function downloadProjectLibraryBlob(
  projectId: string,
  pathOrRel: string
): Promise<Blob | null> {
  const storagePath = projectLibraryObjectPath(projectId, pathOrRel);
  if (!storagePath) return null;

  const { data, error } = await supabase.storage
    .from(PROJECT_LIBRARY_BUCKET)
    .download(storagePath);
  if (!error && data) return data;

  const signed = await supabase.storage
    .from(PROJECT_LIBRARY_BUCKET)
    .createSignedUrl(storagePath, 60 * 10);
  if (signed.error || !signed.data?.signedUrl) return null;

  try {
    const res = await fetch(signed.data.signedUrl);
    if (!res.ok) return null;
    return await res.blob();
  } catch {
    return null;
  }
}

export async function downloadProjectLibraryPreviewUrl(
  projectId: string,
  pathOrRel: string
): Promise<string | null> {
  const blob = await downloadProjectLibraryBlob(projectId, pathOrRel);
  if (blob) return URL.createObjectURL(blob);

  const publicUrl = publicUrlForProjectLibraryPath(projectId, pathOrRel);
  return publicUrl || null;
}
