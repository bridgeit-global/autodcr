import { applicationUrlKeyToCatalogType } from "@/app/utils/applicantAppointmentPermissions";
import type { CatalogDb } from "@/app/utils/applicationCatalog";
import { supabase } from "@/app/utils/supabase";

export const PROJECT_LIBRARY_BUCKET = "project-library";

const STORAGE_PUBLIC_MARKER = `/object/public/${PROJECT_LIBRARY_BUCKET}/`;

/** `YYYYMMDDTHHmmssZ` — safe in object keys. */
export const SAVED_APPLICATION_TIMESTAMP_RE = /^\d{8}T\d{6}Z$/;

export type SavedApplicationStorageLocation = {
  /** `application_types.department` */
  department: string;
  /** `application_types.slug` */
  slug: string;
  /** `application_documents.category` */
  category: string;
};

/** Matches legacy `save-application-pdf` object names (`{projectId}/saved-applications/{key}.pdf`). */
export function applicationUrlsKeyToStorageSlug(applicationUrlsKey: string): string {
  return applicationUrlsKey.replace(/[/\\]/g, "-").replace(/\s+/g, "_");
}

export function isSavedApplicationTimestamp(value: string): boolean {
  return SAVED_APPLICATION_TIMESTAMP_RE.test(value.trim());
}

export function formatSavedApplicationTimestamp(date: Date = new Date()): string {
  const y = date.getUTCFullYear().toString().padStart(4, "0");
  const m = (date.getUTCMonth() + 1).toString().padStart(2, "0");
  const d = date.getUTCDate().toString().padStart(2, "0");
  const h = date.getUTCHours().toString().padStart(2, "0");
  const min = date.getUTCMinutes().toString().padStart(2, "0");
  const s = date.getUTCSeconds().toString().padStart(2, "0");
  return `${y}${m}${d}T${h}${min}${s}Z`;
}

/** Path-segment safe, keeping spaces so department and category stay readable. */
export function sanitizeStorageSegment(value: string): string {
  const cleaned = value
    .trim()
    .replace(/[/\\]+/g, "-")
    .replace(/\s+/g, " ")
    .replace(/^\.+/, "")
    .replace(/[\u0000-\u001f]/g, "");
  return cleaned || "unknown";
}

/**
 * `{projectId}/saved-applications/{department}/{slug}/{category}/{category}+{datetime}.pdf`
 * Department and slug come from `application_types`. Category comes from `application_documents`.
 * `projectId` stays the bucket prefix so projects do not share objects.
 */
export function savedApplicationPdfStoragePath(params: {
  projectId: string;
  department: string;
  slug: string;
  category: string;
  savedAt: string;
}): string {
  const projectId = params.projectId.trim();
  const department = sanitizeStorageSegment(params.department);
  const slug = sanitizeStorageSegment(params.slug);
  const category = sanitizeStorageSegment(params.category);
  const savedAt = params.savedAt.trim();
  return `${projectId}/saved-applications/${department}/${slug}/${category}/${category}+${savedAt}.pdf`;
}

export function savedApplicationCategoryFolder(params: {
  projectId: string;
  department: string;
  slug: string;
  category: string;
}): string {
  const projectId = params.projectId.trim();
  const department = sanitizeStorageSegment(params.department);
  const slug = sanitizeStorageSegment(params.slug);
  const category = sanitizeStorageSegment(params.category);
  return `${projectId}/saved-applications/${department}/${slug}/${category}`;
}

export function legacySavedApplicationPdfStoragePath(
  projectId: string,
  applicationUrlsKey: string
): string {
  return `${projectId.trim()}/saved-applications/${applicationUrlsKeyToStorageSlug(applicationUrlsKey)}.pdf`;
}

/** @deprecated Use `savedApplicationPdfStoragePath` for new uploads. */
export function projectSavedApplicationPdfStoragePath(
  projectId: string,
  applicationUrlsKey: string
): string {
  return legacySavedApplicationPdfStoragePath(projectId, applicationUrlsKey);
}

export type SavedApplicationPdfParts = {
  storagePath: string | null;
  department: string | null;
  slug: string | null;
  category: string | null;
  /** ISO time parsed from `{category}+YYYYMMDDTHHmmssZ.pdf`, when present. */
  savedAtIso: string | null;
};

function savedAtIsoFromFileName(fileName: string): string | null {
  const match = fileName.match(
    /\+(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z\.pdf$/i
  );
  if (!match) return null;
  return `${match[1]}-${match[2]}-${match[3]}T${match[4]}:${match[5]}:${match[6]}Z`;
}

function humanizeStorageToken(value: string): string {
  const text = value.replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
  if (!text) return "";
  return text.replace(/\b\w/g, (char) => char.toUpperCase());
}

/** Read department, type slug, and document category out of a saved-application object URL. */
export function parseSavedApplicationPdf(
  urlKey: string,
  publicUrl: string
): SavedApplicationPdfParts {
  const storagePath = storagePathFromPublicUrl(publicUrl);
  const empty: SavedApplicationPdfParts = {
    storagePath,
    department: null,
    slug: null,
    category: null,
    savedAtIso: null,
  };
  if (!storagePath) return empty;
  const marker = "/saved-applications/";
  const idx = storagePath.indexOf(marker);
  if (idx < 0) return empty;
  const rest = storagePath
    .slice(idx + marker.length)
    .split("/")
    .filter(Boolean);
  if (rest.length < 4) {
    const fileName = rest[rest.length - 1] ?? "";
    return { ...empty, savedAtIso: savedAtIsoFromFileName(fileName) };
  }
  const fileName = rest[rest.length - 1] ?? "";
  return {
    storagePath,
    department: rest[0] ?? null,
    slug: rest[1] ?? null,
    category: rest[2] ?? null,
    savedAtIso: savedAtIsoFromFileName(fileName),
  };
}

export function savedApplicationPdfLabel(
  parts: SavedApplicationPdfParts,
  urlKey: string,
  applicationTitle?: string | null
): string {
  const category = parts.category?.trim() || "";
  const title =
    applicationTitle?.trim() ||
    (parts.slug ? humanizeStorageToken(parts.slug) : "") ||
    humanizeStorageToken(urlKey) ||
    "Saved application";
  return category ? `${title} — ${category}` : title;
}

export function storagePathFromPublicUrl(publicUrl: string): string | null {
  const marker = STORAGE_PUBLIC_MARKER;
  const altMarker = `/${PROJECT_LIBRARY_BUCKET}/`;
  let idx = publicUrl.indexOf(marker);
  if (idx >= 0) {
    return decodeURIComponent(publicUrl.slice(idx + marker.length).split("?")[0] ?? "");
  }
  idx = publicUrl.indexOf(altMarker);
  if (idx >= 0) {
    return decodeURIComponent(publicUrl.slice(idx + altMarker.length).split("?")[0] ?? "");
  }
  return null;
}

type LooseRow = Record<string, unknown>;

function asTrimmed(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function locationFromParts(
  department: unknown,
  slug: unknown,
  category: unknown
): SavedApplicationStorageLocation | null {
  const departmentText = asTrimmed(department);
  const slugText = asTrimmed(slug);
  const categoryText = asTrimmed(category);
  if (!departmentText || !slugText || !categoryText) return null;
  return { department: departmentText, slug: slugText, category: categoryText };
}

async function resolveClient(client?: CatalogDb): Promise<CatalogDb> {
  if (client) return client;
  return supabase;
}

async function fetchTypeById(
  db: CatalogDb,
  typeId: string
): Promise<{ department: string; slug: string } | null> {
  const withSlug = await db
    .from("application_types")
    .select("department, slug")
    .eq("id", typeId)
    .maybeSingle();
  if (!withSlug.error && withSlug.data) {
    const row = withSlug.data as LooseRow;
    const department = asTrimmed(row.department);
    const slug = asTrimmed(row.slug) || typeId;
    if (!department) return null;
    return { department, slug };
  }

  const legacy = await db
    .from("application_types")
    .select("department, id")
    .eq("id", typeId)
    .maybeSingle();
  if (legacy.error || !legacy.data) return null;
  const row = legacy.data as LooseRow;
  const department = asTrimmed(row.department);
  const slug = asTrimmed(row.id);
  if (!department || !slug) return null;
  return { department, slug };
}

async function fetchDocumentRow(
  db: CatalogDb,
  urlsKey: string
): Promise<{ category: string; applicationTypeId: string } | null> {
  const bySlug = await db
    .from("application_documents")
    .select("category, application_type_id")
    .eq("slug", urlsKey)
    .maybeSingle();

  if (!bySlug.error && bySlug.data) {
    const row = bySlug.data as LooseRow;
    const category = asTrimmed(row.category);
    const applicationTypeId = asTrimmed(row.application_type_id);
    if (category && applicationTypeId) return { category, applicationTypeId };
  }

  const byId = await db
    .from("application_documents")
    .select("category, application_type_id")
    .eq("id", urlsKey)
    .maybeSingle();
  if (byId.error || !byId.data) return null;
  const row = byId.data as LooseRow;
  const category = asTrimmed(row.category);
  const applicationTypeId = asTrimmed(row.application_type_id);
  if (!category || !applicationTypeId) return null;
  return { category, applicationTypeId };
}

async function fetchTypeBySlug(
  db: CatalogDb,
  typeSlug: string
): Promise<{ id: string; department: string; slug: string } | null> {
  const withSlug = await db
    .from("application_types")
    .select("id, department, slug")
    .eq("slug", typeSlug)
    .maybeSingle();
  if (!withSlug.error && withSlug.data) {
    const row = withSlug.data as LooseRow;
    const id = asTrimmed(row.id);
    const department = asTrimmed(row.department);
    const slug = asTrimmed(row.slug) || typeSlug;
    if (!id || !department) return null;
    return { id, department, slug };
  }

  const legacy = await db
    .from("application_types")
    .select("id, department")
    .eq("id", typeSlug)
    .maybeSingle();
  if (legacy.error || !legacy.data) return null;
  const row = legacy.data as LooseRow;
  const id = asTrimmed(row.id);
  const department = asTrimmed(row.department);
  if (!id || !department) return null;
  return { id, department, slug: id };
}

async function categoryForLetterVariant(
  db: CatalogDb,
  typeId: string,
  letterVariant: "appointment" | "acceptance"
): Promise<string | null> {
  const { data, error } = await db
    .from("application_documents")
    .select("category, letter_variant")
    .eq("application_type_id", typeId);
  if (error || !Array.isArray(data)) return null;
  const match = (data as LooseRow[]).find((row) => row.letter_variant === letterVariant);
  const category = asTrimmed(match?.category);
  return category || null;
}

/**
 * Resolve department (`application_types`), slug (`application_types.slug`),
 * and category (`application_documents.category`) for a saved-PDF url key.
 */
export async function resolveSavedApplicationStorageLocation(
  urlsKey: string,
  client?: CatalogDb
): Promise<SavedApplicationStorageLocation | null> {
  const key = urlsKey.trim();
  if (!key) return null;
  const db = await resolveClient(client);

  const document = await fetchDocumentRow(db, key);
  if (document) {
    const type = await fetchTypeById(db, document.applicationTypeId);
    const location = locationFromParts(type?.department, type?.slug, document.category);
    if (location) return location;
  }

  const legacy = applicationUrlKeyToCatalogType(key);
  if (!legacy) return null;
  const type = await fetchTypeBySlug(db, legacy.typeSlug);
  if (!type) return null;
  const category = await categoryForLetterVariant(db, type.id, legacy.letterVariant);
  return locationFromParts(type.department, type.slug, category);
}

export async function savedApplicationPdfStoragePathForUrlKey(params: {
  projectId: string;
  urlsKey: string;
  savedAt: string;
  client?: CatalogDb;
}): Promise<string> {
  const location = await resolveSavedApplicationStorageLocation(params.urlsKey, params.client);
  return savedApplicationPdfStoragePath({
    projectId: params.projectId,
    department: location?.department ?? "unknown",
    slug: location?.slug ?? params.urlsKey,
    category: location?.category ?? "document",
    savedAt: params.savedAt,
  });
}

function publicUrlForStoragePath(path: string): string {
  const { data } = supabase.storage.from(PROJECT_LIBRARY_BUCKET).getPublicUrl(path);
  const url = data?.publicUrl?.trim();
  if (!url) {
    throw new Error("Could not resolve public URL for saved application PDF.");
  }
  return url;
}

/** Public URL for a new save. `savedAt` must be the same stamp the upload route stores. */
export async function plannedSavedApplicationPdfPublicUrl(
  projectId: string,
  applicationUrlsKey: string,
  savedAt: string,
  client?: CatalogDb
): Promise<string> {
  const path = await savedApplicationPdfStoragePathForUrlKey({
    projectId,
    urlsKey: applicationUrlsKey,
    savedAt,
    client,
  });
  return publicUrlForStoragePath(path);
}

/** Stable public URL for a legacy saved application PDF. */
export function projectSavedApplicationPdfPublicUrl(
  projectId: string,
  applicationUrlsKey: string
): string {
  const path = legacySavedApplicationPdfStoragePath(projectId, applicationUrlsKey);
  return publicUrlForStoragePath(path);
}

export function readApplicationUrlFromUrls(
  raw: unknown,
  key: string
): string | undefined {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return undefined;
  const v = (raw as Record<string, unknown>)[key];
  return typeof v === "string" && v.trim() ? v.trim() : undefined;
}

/** Use stored URL when present; otherwise the legacy stable URL (QR on files already saved). */
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
