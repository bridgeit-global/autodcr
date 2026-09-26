import { rememberCatalogDocumentSlug } from "@/app/utils/applicationPdfUrlKeys";

/** Browser or server Supabase client — `from()` only. Avoids importing the browser client in Node APIs. */
export type CatalogDb = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  from: (table: string) => any;
};

async function resolveClient(client?: CatalogDb): Promise<CatalogDb> {
  if (client) return client;
  const { supabase } = await import("@/app/utils/supabase");
  return supabase;
}

export type ApplicationCatalogCategory = "appointment_letter" | "department_permission";

export type ApplicationCatalogType = {
  id: string;
  /** Stable snake_case key. `id` is a uuid. */
  slug: string;
  department: string;
  application_title: string;
  description: string;
  category: ApplicationCatalogCategory;
  applicant_type: string | null;
  token_suffix: string | null;
  planning_authorities: string[];
  requires_roster_match: boolean;
  show_building_permission_fields: boolean;
  is_active: boolean;
  sort_order: number;
  icon_key: string;
};

export type ApplicationCatalogDocument = {
  id: string;
  /** Stable snake_case key used as the saved-PDF URL key. `id` is a uuid. */
  slug: string;
  application_type_id: string;
  category: string;
  sub_category: string | null;
  html: string | null;
  sign: string[];
  letter_variant: "appointment" | "acceptance" | null;
  /** Catalog flag: preview paints owner/consultant letterhead. */
  show_letterhead: boolean;
  /** Catalog flag: preview injects the saved-PDF QR. */
  show_qrcode: boolean;
  is_active: boolean;
  sort_order: number;
};

const DOCUMENT_COLUMNS =
  "id, slug, application_type_id, category, sub_category, html, sign, letter_variant, show_letterhead, show_qrcode, is_active, sort_order";
const DOCUMENT_COLUMNS_LEGACY =
  "id, application_type_id, category, sub_category, html, sign, letter_variant, is_active, sort_order";

export type ApplicationCatalogPlaceholder = {
  id: string;
  token: string;
  legacy_token: string | null;
  label: string;
  source_table: string;
  source_column: string | null;
  ui_group: string;
  is_active: boolean;
  required?: boolean;
  sort_order?: number;
};

export type CatalogLinkedPlaceholder = ApplicationCatalogPlaceholder & {
  required: boolean;
  sort_order: number;
};

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

function mapTypeRow(row: Record<string, unknown>): ApplicationCatalogType {
  const id = String(row.id ?? "");
  const slug =
    typeof row.slug === "string" && row.slug.trim()
      ? row.slug.trim()
      : id;
  return {
    id,
    slug,
    department: String(row.department ?? ""),
    application_title: String(row.application_title ?? ""),
    description: String(row.description ?? ""),
    category:
      row.category === "appointment_letter" ? "appointment_letter" : "department_permission",
    applicant_type: typeof row.applicant_type === "string" ? row.applicant_type : null,
    token_suffix: typeof row.token_suffix === "string" ? row.token_suffix : null,
    planning_authorities: asStringArray(row.planning_authorities),
    requires_roster_match: Boolean(row.requires_roster_match),
    show_building_permission_fields: Boolean(row.show_building_permission_fields),
    is_active: row.is_active !== false,
    sort_order: typeof row.sort_order === "number" ? row.sort_order : 100,
    icon_key: typeof row.icon_key === "string" && row.icon_key ? row.icon_key : "document",
  };
}

function mapDocumentRow(row: Record<string, unknown>): ApplicationCatalogDocument {
  const variant = row.letter_variant;
  const id = String(row.id ?? "");
  const slug =
    typeof row.slug === "string" && row.slug.trim()
      ? row.slug.trim()
      : id;
  rememberCatalogDocumentSlug(id, slug);
  return {
    id,
    slug,
    application_type_id: String(row.application_type_id ?? ""),
    category: String(row.category ?? ""),
    sub_category: typeof row.sub_category === "string" ? row.sub_category : null,
    html: typeof row.html === "string" && row.html.trim() ? row.html.trim() : null,
    sign: asStringArray(row.sign),
    letter_variant: variant === "acceptance" || variant === "appointment" ? variant : null,
    // Missing columns (pre-migration) keep current always-on preview behavior.
    show_letterhead: row.show_letterhead === undefined ? true : Boolean(row.show_letterhead),
    show_qrcode: row.show_qrcode === undefined ? true : Boolean(row.show_qrcode),
    is_active: row.is_active !== false,
    sort_order: typeof row.sort_order === "number" ? row.sort_order : 100,
  };
}

/** Legacy templates with no catalog row keep letterhead on. */
export function catalogDocumentShowsLetterhead(
  doc?: ApplicationCatalogDocument | null
): boolean {
  return doc ? doc.show_letterhead : true;
}

/** Legacy templates with no catalog row keep saved-PDF QR on. */
export function catalogDocumentShowsQrcode(
  doc?: ApplicationCatalogDocument | null
): boolean {
  return doc ? doc.show_qrcode : true;
}

/**
 * Appointment letters stay on the owner's letterhead. Acceptance letters and
 * architect/LS building-permission applications use the consultant letterhead.
 */
export function catalogDocumentPrefersConsultantLetterhead(
  doc?: ApplicationCatalogDocument | null
): boolean {
  if (!doc) return false;
  if (doc.letter_variant === "acceptance") return true;
  if (doc.letter_variant === "appointment") return false;
  return doc.sign.some((item) => {
    const role = item.trim().toLowerCase();
    return role === "architect_or_ls" || role === "consultant";
  });
}

function mapPlaceholderRow(row: Record<string, unknown>): ApplicationCatalogPlaceholder {
  return {
    id: String(row.id ?? ""),
    token: String(row.token ?? ""),
    legacy_token: typeof row.legacy_token === "string" ? row.legacy_token : null,
    label: String(row.label ?? ""),
    source_table: String(row.source_table ?? ""),
    source_column: typeof row.source_column === "string" ? row.source_column : null,
    ui_group: String(row.ui_group ?? "other"),
    is_active: row.is_active !== false,
  };
}

const TYPE_COLUMNS =
  "id, slug, department, application_title, description, category, applicant_type, token_suffix, planning_authorities, requires_roster_match, show_building_permission_fields, is_active, sort_order, icon_key";
const TYPE_COLUMNS_LEGACY =
  "id, department, application_title, description, category, applicant_type, token_suffix, planning_authorities, requires_roster_match, show_building_permission_fields, is_active, sort_order, icon_key";

export async function fetchApplicationCatalogTypes(
  client?: CatalogDb
): Promise<ApplicationCatalogType[]> {
  const db = await resolveClient(client);
  let { data, error } = await db
    .from("application_types")
    .select(TYPE_COLUMNS)
    .eq("is_active", true)
    .order("department")
    .order("sort_order");
  if (error) {
    const retry = await db
      .from("application_types")
      .select(TYPE_COLUMNS_LEGACY)
      .eq("is_active", true)
      .order("department")
      .order("sort_order");
    data = retry.data;
    error = retry.error;
  }

  if (error || !Array.isArray(data)) {
    console.warn("fetchApplicationCatalogTypes failed:", error?.message);
    return [];
  }
  return data.map((row) => mapTypeRow(row as Record<string, unknown>));
}

export async function fetchApplicationCatalogTypeByTitle(
  applicationTitle: string,
  client?: CatalogDb
): Promise<ApplicationCatalogType | null> {
  const title = applicationTitle.trim();
  if (!title) return null;
  const db = await resolveClient(client);
  let { data, error } = await db
    .from("application_types")
    .select(TYPE_COLUMNS)
    .eq("is_active", true)
    .ilike("application_title", title)
    .maybeSingle();
  if (error) {
    const retry = await db
      .from("application_types")
      .select(TYPE_COLUMNS_LEGACY)
      .eq("is_active", true)
      .ilike("application_title", title)
      .maybeSingle();
    data = retry.data;
    error = retry.error;
  }

  if (error || !data) return null;
  return mapTypeRow(data as Record<string, unknown>);
}

async function selectDocumentsForType(
  db: CatalogDb,
  applicationTypeId: string,
  columns: string
) {
  return db
    .from("application_documents")
    .select(columns)
    .eq("application_type_id", applicationTypeId)
    .eq("is_active", true)
    .order("sort_order");
}

export async function fetchDocumentsForApplicationType(
  applicationTypeId: string,
  client?: CatalogDb
): Promise<ApplicationCatalogDocument[]> {
  const db = await resolveClient(client);
  let { data, error } = await selectDocumentsForType(db, applicationTypeId, DOCUMENT_COLUMNS);
  if (error) {
    const retry = await selectDocumentsForType(db, applicationTypeId, DOCUMENT_COLUMNS_LEGACY);
    data = retry.data;
    error = retry.error;
  }
  if (error || !Array.isArray(data)) return [];
  return data.map((row) => mapDocumentRow(row as Record<string, unknown>));
}

function mapLinkedPlaceholderRows(data: unknown[]): CatalogLinkedPlaceholder[] {
  const rows: CatalogLinkedPlaceholder[] = [];
  for (const raw of data) {
    const rec = raw as Record<string, unknown>;
    const nested = rec.placeholders as Record<string, unknown> | Record<string, unknown>[] | null;
    const ph = Array.isArray(nested) ? nested[0] : nested;
    if (!ph || ph.is_active === false) continue;
    rows.push({
      ...mapPlaceholderRow(ph),
      required: rec.required !== false,
      sort_order: typeof rec.sort_order === "number" ? rec.sort_order : 100,
    });
  }
  return rows;
}

export async function fetchPlaceholdersForApplicationType(
  applicationTypeId: string,
  client?: CatalogDb
): Promise<CatalogLinkedPlaceholder[]> {
  const db = await resolveClient(client);
  const { data, error } = await db
    .from("application_type_placeholders")
    .select(
      "required, sort_order, placeholders ( id, token, legacy_token, label, source_table, source_column, ui_group, is_active )"
    )
    .eq("application_type_id", applicationTypeId)
    .order("sort_order");

  if (error || !Array.isArray(data)) {
    console.warn("fetchPlaceholdersForApplicationType failed:", error?.message);
    return [];
  }
  return mapLinkedPlaceholderRows(data);
}

export async function fetchPlaceholdersForDocument(
  documentId: string,
  client?: CatalogDb
): Promise<CatalogLinkedPlaceholder[]> {
  const db = await resolveClient(client);
  const { data, error } = await db
    .from("application_document_placeholders")
    .select(
      "required, sort_order, placeholders ( id, token, legacy_token, label, source_table, source_column, ui_group, is_active )"
    )
    .eq("document_id", documentId)
    .order("sort_order");

  if (error || !Array.isArray(data)) return [];
  return mapLinkedPlaceholderRows(data);
}

/** Type-level placeholders UNION document-only links (same master row is not duplicated). */
export async function fetchResolvedPlaceholdersForApplication(
  applicationTypeId: string,
  documentId?: string | null,
  client?: CatalogDb
): Promise<CatalogLinkedPlaceholder[]> {
  const typeRows = await fetchPlaceholdersForApplicationType(applicationTypeId, client);
  const byId = new Map<string, CatalogLinkedPlaceholder>();
  for (const row of typeRows) byId.set(row.id, row);
  if (documentId) {
    const docRows = await fetchPlaceholdersForDocument(documentId, client);
    for (const row of docRows) {
      const existing = byId.get(row.id);
      if (existing) {
        byId.set(row.id, {
          ...existing,
          required: existing.required || row.required,
          sort_order: Math.min(existing.sort_order, row.sort_order),
        });
      } else {
        byId.set(row.id, row);
      }
    }
  }
  return [...byId.values()].sort(
    (a, b) => a.sort_order - b.sort_order || a.label.localeCompare(b.label)
  );
}

export function catalogTypeVisibleForAuthority(
  type: ApplicationCatalogType,
  authorityId: string
): boolean {
  if (!type.planning_authorities.length) return true;
  return type.planning_authorities.includes(authorityId.trim().toLowerCase());
}

export function departmentsFromCatalog(
  types: ApplicationCatalogType[],
  authorityId: string
): string[] {
  const seen = new Set<string>();
  const departments: string[] = [];
  for (const type of types) {
    if (!catalogTypeVisibleForAuthority(type, authorityId)) continue;
    if (seen.has(type.department)) continue;
    seen.add(type.department);
    departments.push(type.department);
  }
  return departments.sort((a, b) => a.localeCompare(b));
}

export function typesForDepartment(
  types: ApplicationCatalogType[],
  department: string,
  authorityId: string
): ApplicationCatalogType[] {
  return types
    .filter(
      (type) =>
        type.department === department && catalogTypeVisibleForAuthority(type, authorityId)
    )
    .sort((a, b) => a.sort_order - b.sort_order || a.application_title.localeCompare(b.application_title));
}

type JsonRecord = Record<string, unknown>;

function asRecord(value: unknown): JsonRecord | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as JsonRecord;
}

function jsonPathValue(root: unknown, path: string): unknown {
  if (!path.trim()) return undefined;
  if (!path.includes("->>")) {
    const rec = asRecord(root);
    return rec ? rec[path] : undefined;
  }
  const [column, ...rest] = path.split("->>");
  const rec = asRecord(root);
  if (!rec) return undefined;
  let current: unknown = rec[column.trim()];
  for (const key of rest) {
    const nested = asRecord(current);
    if (!nested) return undefined;
    current = nested[key.trim()];
  }
  return current;
}

function stringifyCatalogValue(value: unknown): string {
  if (value == null) return "";
  if (Array.isArray(value)) {
    return value
      .map((item) => (item == null ? "" : String(item).trim()))
      .filter(Boolean)
      .join(", ");
  }
  if (typeof value === "object") return "";
  return String(value).trim();
}

export type CatalogProjectSource = {
  title?: string | null;
  project_info?: JsonRecord | null;
  save_plot_details?: JsonRecord | null;
  building_details?: JsonRecord | null;
  applicant_details?: { applicants?: JsonRecord[] } | null;
};

function pickApplicant(
  applicants: JsonRecord[] | undefined,
  applicantType: string | null,
  owner: boolean
): JsonRecord | undefined {
  if (!applicants?.length) return undefined;
  if (owner) {
    return applicants.find((row) => {
      const t = String(row.applicantType ?? row.applicant_type ?? "").toLowerCase();
      return t.includes("owner") || t.includes("developer");
    });
  }
  if (!applicantType) return undefined;
  const needle = applicantType.trim().toLowerCase();
  return applicants.find((row) => {
    const t = String(row.applicantType ?? row.applicant_type ?? "").toLowerCase();
    return t === needle || t.includes(needle);
  });
}

export function resolveCatalogPlaceholderValue(
  placeholder: ApplicationCatalogPlaceholder,
  project: CatalogProjectSource | null | undefined,
  opts?: { applicantType?: string | null }
): string {
  const applicants = project?.applicant_details?.applicants;
  if (placeholder.source_table === "computed") {
    if (placeholder.source_column === "current_date") {
      const now = new Date();
      const day = String(now.getDate()).padStart(2, "0");
      const month = String(now.getMonth() + 1).padStart(2, "0");
      return `${day}/${month}/${now.getFullYear()}`;
    }
    if (placeholder.source_column === "applicant_role") {
      return opts?.applicantType?.trim() || "";
    }
    return "";
  }
  if (placeholder.source_table === "owner_applicant") {
    const row = pickApplicant(applicants, null, true);
    if (!row) return "";
    const key = placeholder.source_column || "";
    const alt =
      key === "entity_name"
        ? row.entity_name ?? row.entityName
        : key === "name"
          ? row.name
          : row[key] ?? row[key.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase())];
    return stringifyCatalogValue(alt);
  }
  if (placeholder.source_table === "applicants") {
    const row = pickApplicant(applicants, opts?.applicantType ?? null, false);
    if (!row) return "";
    const key = placeholder.source_column || "name";
    const alt =
      key === "entity_name"
        ? row.entity_name ?? row.entityName
        : key === "registrationNumber"
          ? row.registrationNumber ?? row.registrationNo
          : row[key];
    return stringifyCatalogValue(alt);
  }
  if (placeholder.source_table === "projects") {
    const path = placeholder.source_column || "";
    if (path === "title") return stringifyCatalogValue(project?.title);
    const bag = {
      project_info: project?.project_info ?? {},
      save_plot_details: project?.save_plot_details ?? {},
      building_details: project?.building_details ?? {},
      title: project?.title,
    };
    return stringifyCatalogValue(jsonPathValue(bag, path));
  }
  return "";
}

/** Field map for new {{TOKEN}} HTML plus legacy $project_* aliases from catalog. */
export function catalogPlaceholderFieldMap(
  placeholders: CatalogLinkedPlaceholder[],
  project: CatalogProjectSource | null | undefined,
  applicantType?: string | null
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const ph of placeholders) {
    const value = resolveCatalogPlaceholderValue(ph, project, { applicantType });
    if (!value) continue;
    if (ph.token) out[ph.token] = value;
    if (ph.legacy_token) {
      const legacy = ph.legacy_token.startsWith("$")
        ? ph.legacy_token.slice(1)
        : ph.legacy_token;
      out[legacy] = value;
    }
  }
  return out;
}

export function catalogDocumentOptionLabel(doc: ApplicationCatalogDocument): string {
  const category = doc.category.trim() || doc.slug || doc.id;
  const sub = doc.sub_category?.trim();
  if (sub && sub.toLowerCase() !== category.toLowerCase()) {
    return `${category} — ${sub}`;
  }
  return category;
}

export function pickCatalogDocument(
  docs: ApplicationCatalogDocument[],
  opts?: { documentId?: string | null; letterVariant?: "appointment" | "acceptance" }
): ApplicationCatalogDocument | undefined {
  if (opts?.documentId) {
    const byId = docs.find((d) => d.id === opts.documentId || d.slug === opts.documentId);
    if (byId) return byId;
  }
  const variant = opts?.letterVariant ?? "appointment";
  return docs.find((d) => d.letter_variant === variant && d.html) || docs.find((d) => d.html);
}

export async function resolveCatalogDocumentForPreview(opts: {
  applicationTitle?: string | null;
  letterVariant?: "appointment" | "acceptance";
  documentId?: string | null;
  client?: CatalogDb;
}): Promise<ApplicationCatalogDocument | null> {
  const title = opts.applicationTitle?.trim();
  if (!title) return null;
  const type = await fetchApplicationCatalogTypeByTitle(title, opts.client);
  if (!type) return null;
  const docs = await fetchDocumentsForApplicationType(type.id, opts.client);
  return (
    pickCatalogDocument(docs, {
      documentId: opts.documentId,
      letterVariant: opts.letterVariant,
    }) ?? null
  );
}

export async function resolveHtmlPathForApplication(opts: {
  applicationTitle?: string | null;
  letterVariant?: "appointment" | "acceptance";
  documentId?: string | null;
  client?: CatalogDb;
}): Promise<string | null> {
  const doc = await resolveCatalogDocumentForPreview(opts);
  return doc?.html ?? null;
}

export type CatalogSigningInfo = {
  applicationTitle: string;
  applicantType: string | null;
  appointmentSign: string[];
  acceptanceSign: string[];
  hasAcceptanceHtml: boolean;
};

function signIncludes(sign: string[], role: string): boolean {
  return sign.some((item) => item.trim().toLowerCase() === role);
}

export function catalogConsultantSignsAppointment(info: CatalogSigningInfo | undefined): boolean {
  if (!info) return false;
  return signIncludes(info.appointmentSign, "consultant");
}

export async function fetchCatalogSigningByTitle(
  client?: CatalogDb
): Promise<Map<string, CatalogSigningInfo>> {
  const types = await fetchApplicationCatalogTypes(client);
  const db = await resolveClient(client);
  const { data, error } = await db
    .from("application_documents")
    .select("application_type_id, html, sign, letter_variant, is_active")
    .eq("is_active", true);

  const docsByType = new Map<string, ApplicationCatalogDocument[]>();
  if (!error && Array.isArray(data)) {
    for (const row of data) {
      const mapped = mapDocumentRow(row as Record<string, unknown>);
      const list = docsByType.get(mapped.application_type_id) ?? [];
      list.push(mapped);
      docsByType.set(mapped.application_type_id, list);
    }
  }

  const out = new Map<string, CatalogSigningInfo>();
  for (const type of types) {
    const docs = docsByType.get(type.id) ?? [];
    const appointment = docs.find((d) => d.letter_variant === "appointment");
    const acceptance = docs.find((d) => d.letter_variant === "acceptance");
    const titleKey = type.application_title.trim().toLowerCase();
    if (!titleKey) continue;
    out.set(titleKey, {
      applicationTitle: type.application_title,
      applicantType: type.applicant_type,
      appointmentSign: appointment?.sign ?? [],
      acceptanceSign: acceptance?.sign ?? [],
      hasAcceptanceHtml: Boolean(acceptance?.html),
    });
  }
  return out;
}

export async function fetchAcceptanceApplicationTitles(
  client?: CatalogDb
): Promise<Set<string>> {
  const signing = await fetchCatalogSigningByTitle(client);
  const titles = new Set<string>();
  for (const [key, info] of signing) {
    if (info.hasAcceptanceHtml) titles.add(key);
  }
  return titles;
}

export function appointmentTypeIdsMatchingRoster(
  types: ApplicationCatalogType[],
  applicantDetails: unknown
): Set<string> {
  const details = (applicantDetails ?? {}) as { applicants?: { applicantType?: string; applicant_type?: string }[] };
  const roster = new Set(
    (details.applicants ?? [])
      .map((row) => (row.applicantType || row.applicant_type || "").trim().toLowerCase())
      .filter(Boolean)
  );
  const ids = new Set<string>();
  for (const type of types) {
    if (!type.requires_roster_match) continue;
    const applicant = (type.applicant_type || "").trim().toLowerCase();
    if (!applicant) continue;
    for (const rosterType of roster) {
      if (rosterType === applicant || rosterType.includes(applicant) || applicant.includes(rosterType)) {
        ids.add(type.id);
        break;
      }
    }
  }
  return ids;
}
