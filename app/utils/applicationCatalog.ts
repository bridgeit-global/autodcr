import { rememberCatalogDocumentSlug } from "@/app/utils/applicationPdfUrlKeys";
import type { TemplateType } from "@/app/templates/templateGenerators";
import { formatCoaExpiryDisplay } from "@/app/utils/coaMetadataDisplay";
import { findConsultantApplicantInList } from "@/app/utils/consultantTemplateTokens";
import {
  inferLocationFromWard,
  normalizeWard,
} from "@/app/lib/projectDocumentAutofill/utils";
import { primaryApplicantLabelFromRoster } from "@/app/utils/projectAccess";

/**
 * Fact-sheet / concession "Name of Consultants" tokens — pick by role, not the
 * document's applicant_type (e.g. Architect on Concession).
 */
const CONSULTANT_NAME_PLACEHOLDER_TEMPLATE_TYPE: Record<string, TemplateType> = {
  structural_engineer: "Structural Engineer",
  site_supervisor: "Site Supervisor",
  licensed_plumber: "Plumber",
  me_consultant: "M&E Consultant",
  fire_safety_consultant: "Fire Safety Consultant",
  traffic_parking_consultant: "Parking Consultant",
  horticulturist: "Horticulturist",
};

const CONSULTANT_NAME_PLACEHOLDER_KEYWORDS: Record<string, string[]> = {
  road_construction_consultant: ["road"],
  // Do not reuse Plumber — only match an explicit PH / public health applicant type.
  ph_consultant: ["public health", "ph consultant", "p.h.", "p.h "],
};

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
  planning_authorities: string[];
  requires_roster_match: boolean;
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
  /** Catalog flag: preview paints a letterhead image. */
  show_letterhead: boolean;
  /**
   * Whose letterhead image: owner | architect_or_ls | consultant
   * (same tokens as sign[]). Ignored when show_letterhead is false.
   * Null = legacy infer from letter_variant/sign.
   */
  letterhead_source: "owner" | "architect_or_ls" | "consultant" | null;
  /** Catalog flag: preview injects the saved-PDF QR. */
  show_qrcode: boolean;
  is_active: boolean;
  sort_order: number;
};

const DOCUMENT_COLUMNS =
  "id, slug, application_type_id, category, sub_category, html, sign, letter_variant, show_letterhead, letterhead_source, show_qrcode, is_active, sort_order";
const DOCUMENT_COLUMNS_LEGACY =
  "id, application_type_id, category, sub_category, html, sign, letter_variant, is_active, sort_order";
const DOCUMENT_COLUMNS_NO_LETTERHEAD_SOURCE =
  "id, slug, application_type_id, category, sub_category, html, sign, letter_variant, show_letterhead, show_qrcode, is_active, sort_order";

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
  /** Heading on this document only (`application_document_placeholders.section_label`). */
  sectionLabel?: string | null;
};

/** One row in Application Details “Letter fields” (catalog-driven). */
export type CatalogLetterFieldRow = {
  id: string;
  token: string;
  /** Legacy key without leading `$`, when present. */
  legacyToken: string | null;
  label: string;
  value: string;
  required: boolean;
  uiGroup: string;
  /** Document heading from `section_label`, when set in Supabase. */
  sectionLabel?: string | null;
  /** Value came from project/applicant data (or a resolved computed token). Not typed on this screen. */
  readOnly: boolean;
};

const LETTER_FIELD_SKIP_TOKENS = new Set([
  "{{SAVED_PDF_QR}}",
  "{{LETTERHEAD_URL}}",
  "$project_Saved_Pdf_QR",
  "project_Saved_Pdf_QR",
  "project_Letterhead_Image_Url",
]);

export function catalogPlaceholderLegacyKey(
  ph: Pick<ApplicationCatalogPlaceholder, "legacy_token">
): string | null {
  if (!ph.legacy_token?.trim()) return null;
  return ph.legacy_token.startsWith("$")
    ? ph.legacy_token.slice(1)
    : ph.legacy_token;
}

export function shouldSkipCatalogPlaceholderForLetterFields(
  ph: CatalogLinkedPlaceholder
): boolean {
  if (ph.ui_group === "letterhead") return true;
  if (LETTER_FIELD_SKIP_TOKENS.has(ph.token)) return true;
  const legacy = catalogPlaceholderLegacyKey(ph);
  if (legacy && LETTER_FIELD_SKIP_TOKENS.has(legacy)) return true;
  if (ph.legacy_token && LETTER_FIELD_SKIP_TOKENS.has(ph.legacy_token)) return true;
  if (/letterhead/i.test(ph.id) || /letterhead/i.test(ph.token)) return true;
  // Derived C.C. label (Owner vs Developer) — not a typed Letter field.
  if (ph.id === "owner_or_developer" || ph.token === "{{OWNER_OR_DEVELOPER}}") return true;
  // Derived Architect vs L.S. role / reg label from roster — not typed fields.
  if (
    ph.id === "architect_or_ls_role" ||
    ph.token === "{{ARCHITECT_OR_LS_ROLE}}" ||
    ph.id === "architect_or_ls_reg_label" ||
    ph.token === "{{ARCHITECT_OR_LS_REG_LABEL}}"
  ) {
    return true;
  }
  return false;
}

const SURVEY_NUMBER_PLACEHOLDER_IDS = new Set([
  "plot_no",
  "cs_no",
  "cts_no",
  "fp_no",
]);
const PLACE_VALUE_PLACEHOLDER_IDS = new Set([
  "division",
  "village",
  "tps_no",
]);

function surveyNumberPlaceholderIdForPlot(plotBelongs: unknown): string {
  switch (String(plotBelongs ?? "").trim()) {
    case "CS No.":
      return "cs_no";
    case "F.P.No":
      return "fp_no";
    case "CTS No.":
    default:
      return "cts_no";
  }
}

function placeValuePlaceholderIdForPlot(plotBelongs: unknown): string {
  switch (String(plotBelongs ?? "").trim()) {
    case "CS No.":
      return "division";
    case "F.P.No":
      return "tps_no";
    case "CTS No.":
    default:
      return "village";
  }
}

/**
 * Letter fields: show one survey row + one place row (plotBelongsTo-aware),
 * same as meta-table keys (C.T.S. No. / Village) — not all four slash tokens.
 */
export function collapsePlotBelongsPlaceholdersForLetterFields(
  placeholders: CatalogLinkedPlaceholder[],
  plotBelongs?: unknown
): CatalogLinkedPlaceholder[] {
  const ids = new Set(placeholders.map((ph) => ph.id));
  const hasSurveySlash = [...SURVEY_NUMBER_PLACEHOLDER_IDS].some((id) => ids.has(id));
  const hasPlaceSlash = [...PLACE_VALUE_PLACEHOLDER_IDS].some((id) => ids.has(id));
  const activeSurveyId = surveyNumberPlaceholderIdForPlot(plotBelongs);
  const activePlaceId = placeValuePlaceholderIdForPlot(plotBelongs);
  const surveyLabel = surveyKindLabelForPlot(plotBelongs);
  const placeLabel = placeKindLabelForPlot(plotBelongs);

  return placeholders
    .filter((ph) => {
      if (hasSurveySlash && SURVEY_NUMBER_PLACEHOLDER_IDS.has(ph.id) && ph.id !== activeSurveyId) {
        return false;
      }
      // Combined prose token duplicates the active number once slash tokens exist.
      if (hasSurveySlash && ph.id === "plot_cs_cts_no") return false;
      if (hasPlaceSlash && PLACE_VALUE_PLACEHOLDER_IDS.has(ph.id) && ph.id !== activePlaceId) {
        return false;
      }
      if (hasPlaceSlash && ph.id === "village_division") return false;
      return true;
    })
    .map((ph) => {
      if (ph.id === activeSurveyId || (!hasSurveySlash && ph.id === "plot_cs_cts_no")) {
        return { ...ph, label: surveyLabel };
      }
      if (ph.id === activePlaceId || (!hasPlaceSlash && ph.id === "village_division")) {
        return { ...ph, label: placeLabel };
      }
      return ph;
    });
}

/** Strip kind prefix from combined tokens so the field value is number/name only. */
function letterFieldDisplayValue(
  ph: CatalogLinkedPlaceholder,
  raw: string,
  plotBelongs?: unknown
): string {
  const cleaned = raw.trim();
  if (!cleaned) return "";
  if (ph.id === "plot_cs_cts_no") {
    const kind = surveyKindLabelForPlot(plotBelongs);
    const stripped = cleaned.replace(
      new RegExp(`^${kind.replace(/\./g, "\\.")}\\s*`, "i"),
      ""
    );
    return stripped || cleaned;
  }
  if (ph.id === "village_division") {
    return cleaned.replace(/^(?:Village|Division|TPS schema)\s+/i, "").trim() || cleaned;
  }
  return cleaned;
}

/** Address line 1/2/3 tokens — omit from Letter fields when the value is empty. */
function isOptionalAddressLinePlaceholder(
  ph: Pick<ApplicationCatalogPlaceholder, "id" | "token">
): boolean {
  if (/_address_line_[123]$/i.test(ph.id)) return true;
  if (/ADDRESS_LINE_[123]\}\}?$/i.test(ph.token)) return true;
  return false;
}

/**
 * Default accordion title when `section_label` is unset — from `placeholders.ui_group`.
 * Explicit document `section_label` always wins in `buildCatalogLetterFieldRows`.
 */
export function sectionTitleFromUiGroup(uiGroup: string | null | undefined): string | null {
  switch (String(uiGroup ?? "").trim().toLowerCase()) {
    case "subject":
      return "Subject";
    case "reference":
      return "Reference";
    case "consultant":
      return "Consultant";
    case "client":
      return "Client";
    case "office":
      return "Addressee";
    case "other":
      return "Other fields";
    case "letterhead":
      return null;
    default:
      return null;
  }
}

/**
 * Build Letter fields panel rows from type ∪ document placeholders.
 * Includes empty values (unlike Create Application Key Variables), except
 * optional address lines 1/2/3 which are hidden when blank.
 */
export function buildCatalogLetterFieldRows(
  placeholders: CatalogLinkedPlaceholder[],
  mappedValues: Record<string, string>,
  overrides?: Record<string, string> | null,
  plotBelongs?: unknown
): CatalogLetterFieldRow[] {
  const rows: CatalogLetterFieldRow[] = [];
  const collapsed = collapsePlotBelongsPlaceholdersForLetterFields(
    placeholders,
    plotBelongs
  );
  for (const ph of collapsed) {
    if (shouldSkipCatalogPlaceholderForLetterFields(ph)) continue;
    const legacyToken = catalogPlaceholderLegacyKey(ph);
    const mapped =
      (mappedValues[ph.token] ?? "").trim() ||
      (legacyToken ? (mappedValues[legacyToken] ?? "").trim() : "");
    // A value already taken from the project, applicant, or a resolved token stays
    // locked. A blank field stays editable, including when a project column is empty.
    const readOnly = Boolean(mapped);
    const overrideRaw =
      overrides?.[ph.token] ??
      (legacyToken ? overrides?.[legacyToken] : undefined) ??
      (ph.legacy_token ? overrides?.[ph.legacy_token] : undefined);
    const rawValue = !readOnly && overrideRaw !== undefined ? String(overrideRaw) : mapped;
    const value = letterFieldDisplayValue(ph, rawValue, plotBelongs);
    // Don't show Owner/Architect/BP address line 1–3 inputs when that line is empty.
    if (isOptionalAddressLinePlaceholder(ph) && !value.trim()) continue;
    rows.push({
      id: ph.id,
      token: ph.token,
      legacyToken,
      label: ph.label?.trim() || ph.token,
      value,
      required: ph.required,
      uiGroup: ph.ui_group,
      // Document section_label wins; otherwise group by ui_group (Subject / Reference / …).
      sectionLabel:
        ph.sectionLabel?.trim() || sectionTitleFromUiGroup(ph.ui_group) || null,
      readOnly,
    });
  }
  return rows;
}

/** Tokens referenced in a template (`{{FOO}}` and `$project_…`). */
export function extractTemplateTokensFromHtml(html: string): Set<string> {
  const found = new Set<string>();
  if (!html) return found;
  for (const match of html.matchAll(/\{\{[A-Za-z0-9_]+\}\}/g)) {
    found.add(match[0]);
  }
  for (const match of html.matchAll(/\$project_[A-Za-z0-9_./-]+/g)) {
    found.add(match[0]);
    found.add(match[0].slice(1)); // without `$`
  }
  return found;
}

/**
 * Keep placeholders that appear in the selected document HTML so Letter fields
 * are document-wise (not the full application-type union).
 */
export function filterCatalogPlaceholdersUsedInTemplate(
  placeholders: CatalogLinkedPlaceholder[],
  html: string | null | undefined
): CatalogLinkedPlaceholder[] {
  if (!html?.trim()) return placeholders;
  const used = extractTemplateTokensFromHtml(html);
  if (used.size === 0) return placeholders;
  const filtered = placeholders.filter((ph) => {
    if (used.has(ph.token)) return true;
    if (ph.legacy_token && used.has(ph.legacy_token)) return true;
    const legacy = catalogPlaceholderLegacyKey(ph);
    if (legacy && used.has(legacy)) return true;
    return false;
  });
  return filtered.length > 0 ? filtered : placeholders;
}

export type CatalogLetterFieldSection = {
  title: string;
  rows: CatalogLetterFieldRow[];
};

/** Group letter fields by `section_label` from Supabase. */
export function groupCatalogLetterFieldRows(
  rows: CatalogLetterFieldRow[]
): CatalogLetterFieldSection[] {
  if (!rows.length) return [];
  if (!rows.some((row) => row.sectionLabel?.trim())) {
    return [{ title: "Details", rows }];
  }
  const sections: CatalogLetterFieldSection[] = [];
  for (const row of rows) {
    const title = row.sectionLabel?.trim() || "Other fields";
    const existing = sections.find((section) => section.title === title);
    if (existing) existing.rows.push(row);
    else sections.push({ title, rows: [row] });
  }
  return sections;
}

const templateHtmlByFile = new Map<string, Promise<string | null>>();

/** Load catalog template HTML from repo via API (for token scanning). */
export async function fetchCatalogTemplateHtmlForFields(
  htmlFileName: string | null | undefined
): Promise<string | null> {
  const file = htmlFileName?.trim() || "";
  if (!file) return null;
  const cached = templateHtmlByFile.get(file);
  if (cached) return cached;
  const pending = (async () => {
    try {
      const res = await fetch(
        `/api/application-template-html?file=${encodeURIComponent(file)}`
      );
      if (!res.ok) return null;
      return await res.text();
    } catch {
      return null;
    }
  })();
  templateHtmlByFile.set(file, pending);
  const html = await pending;
  if (html == null) templateHtmlByFile.delete(file);
  return html;
}

/**
 * Apply session overrides onto a preview field map.
 * Writes both `{{TOKEN}}` and legacy keys when the placeholder set is provided.
 */
export function applyCatalogFieldOverrides(
  formValues: Record<string, string | undefined>,
  overrides: Record<string, string> | null | undefined,
  placeholders?: CatalogLinkedPlaceholder[] | null
): void {
  if (!overrides) return;
  for (const [key, raw] of Object.entries(overrides)) {
    formValues[key] = raw;
  }
  if (!placeholders?.length) return;
  for (const ph of placeholders) {
    const legacy = catalogPlaceholderLegacyKey(ph);
    const fromToken = overrides[ph.token];
    const fromLegacy = legacy ? overrides[legacy] : undefined;
    const fromLegacyDollar = ph.legacy_token ? overrides[ph.legacy_token] : undefined;
    const value = fromToken ?? fromLegacy ?? fromLegacyDollar;
    if (value === undefined) continue;
    formValues[ph.token] = value;
    if (legacy) formValues[legacy] = value;
    if (ph.legacy_token) formValues[ph.legacy_token] = value;
  }
}

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
    planning_authorities: asStringArray(row.planning_authorities),
    requires_roster_match: Boolean(row.requires_roster_match),
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
  const letterheadRaw =
    typeof row.letterhead_source === "string"
      ? row.letterhead_source.trim().toLowerCase()
      : "";
  const letterhead_source =
    letterheadRaw === "owner" ||
    letterheadRaw === "architect_or_ls" ||
    letterheadRaw === "consultant"
      ? letterheadRaw
      : null;
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
    letterhead_source,
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

export type CatalogLetterheadSource = "owner" | "architect_or_ls" | "consultant";

/**
 * Whose letterhead image to use for this catalog document.
 * Prefers explicit `letterhead_source` from Supabase; falls back to sign[] when unset.
 */
export function catalogDocumentLetterheadSource(
  doc?: ApplicationCatalogDocument | null
): CatalogLetterheadSource {
  if (!doc) return "owner";
  if (doc.letterhead_source === "owner") return "owner";
  if (doc.letterhead_source === "architect_or_ls") return "architect_or_ls";
  if (doc.letterhead_source === "consultant") return "consultant";

  // Legacy: infer from sign only (no letter_variant). Order matches migration backfill.
  const roles = doc.sign.map((item) => item.trim().toLowerCase());
  if (
    roles.some(
      (role) =>
        role === "architect_or_ls" ||
        role === "architect" ||
        role === "licensed surveyor" ||
        role === "ls"
    )
  ) {
    return "architect_or_ls";
  }
  if (roles.some((role) => role === "owner")) return "owner";
  if (roles.some((role) => role === "consultant")) return "consultant";
  return "owner";
}

/**
 * True when the document should use architect/consultant letterhead
 * (not the project owner's). Driven by letterhead_source when set.
 */
export function catalogDocumentPrefersConsultantLetterhead(
  doc?: ApplicationCatalogDocument | null
): boolean {
  const source = catalogDocumentLetterheadSource(doc);
  return source === "architect_or_ls" || source === "consultant";
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
  "id, slug, department, application_title, description, category, applicant_type, planning_authorities, requires_roster_match, is_active, sort_order, icon_key";
const TYPE_COLUMNS_LEGACY =
  "id, department, application_title, description, category, applicant_type, planning_authorities, requires_roster_match, is_active, sort_order, icon_key";

const catalogTypesCache = new Map<string, Promise<ApplicationCatalogType[]>>();

export async function fetchApplicationCatalogTypes(
  client?: CatalogDb
): Promise<ApplicationCatalogType[]> {
  if (client) return loadApplicationCatalogTypes(client);
  const cached = catalogTypesCache.get("default");
  if (cached) return cached;
  const pending = loadApplicationCatalogTypes()
    .then((types) => {
      if (types.length === 0) catalogTypesCache.delete("default");
      return types;
    })
    .catch((err) => {
      catalogTypesCache.delete("default");
      throw err;
    });
  catalogTypesCache.set("default", pending);
  return pending;
}

async function loadApplicationCatalogTypes(
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

const catalogTypeByTitle = new Map<string, Promise<ApplicationCatalogType | null>>();
const catalogDocsByType = new Map<string, Promise<ApplicationCatalogDocument[]>>();
const placeholdersByType = new Map<string, Promise<CatalogLinkedPlaceholder[]>>();
const placeholdersByDocument = new Map<string, Promise<CatalogLinkedPlaceholder[]>>();

export async function fetchApplicationCatalogTypeByTitle(
  applicationTitle: string,
  client?: CatalogDb
): Promise<ApplicationCatalogType | null> {
  const title = applicationTitle.trim();
  if (!title) return null;
  const cacheKey = title.toLowerCase();
  const cached = catalogTypeByTitle.get(cacheKey);
  if (cached) return cached;
  const pending = loadApplicationCatalogTypeByTitle(title, client).then((type) => {
    if (!type) catalogTypeByTitle.delete(cacheKey);
    return type;
  });
  catalogTypeByTitle.set(cacheKey, pending);
  return pending;
}

async function loadApplicationCatalogTypeByTitle(
  title: string,
  client?: CatalogDb
): Promise<ApplicationCatalogType | null> {
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
  const cached = catalogDocsByType.get(applicationTypeId);
  if (cached) return cached;
  const pending = loadDocumentsForApplicationType(applicationTypeId, client).then((docs) => {
    // An empty list is often "not migrated yet" or a request that could not see rows.
    // Do not pin that result for the life of the dev server.
    if (docs.length === 0) catalogDocsByType.delete(applicationTypeId);
    return docs;
  });
  catalogDocsByType.set(applicationTypeId, pending);
  return pending;
}

async function loadCatalogDocumentByIdOrSlug(
  documentId: string,
  client?: CatalogDb
): Promise<ApplicationCatalogDocument | null> {
  const db = await resolveClient(client);
  const id = documentId.trim();
  if (!id) return null;

  const selectOne = async (column: "id" | "slug", columns: string) =>
    db.from("application_documents").select(columns).eq(column, id).eq("is_active", true).maybeSingle();

  let { data, error } = await selectOne("id", DOCUMENT_COLUMNS);
  if (error || !data) {
    const bySlug = await selectOne("slug", DOCUMENT_COLUMNS);
    if (!bySlug.error && bySlug.data) {
      data = bySlug.data;
      error = null;
    } else if (error) {
      const legacy = await selectOne("id", DOCUMENT_COLUMNS_NO_LETTERHEAD_SOURCE);
      const legacySlug = legacy.error || !legacy.data
        ? await selectOne("slug", DOCUMENT_COLUMNS_NO_LETTERHEAD_SOURCE)
        : legacy;
      if (!legacySlug.error && legacySlug.data) {
        data = legacySlug.data;
        error = null;
      }
    }
  }
  if (error || !data) return null;
  return mapDocumentRow(data as Record<string, unknown>);
}

async function loadDocumentsForApplicationType(
  applicationTypeId: string,
  client?: CatalogDb
): Promise<ApplicationCatalogDocument[]> {
  const db = await resolveClient(client);
  let { data, error } = await selectDocumentsForType(db, applicationTypeId, DOCUMENT_COLUMNS);
  if (error) {
    // Column letterhead_source not migrated yet — keep show_letterhead/qrcode.
    const mid = await selectDocumentsForType(
      db,
      applicationTypeId,
      DOCUMENT_COLUMNS_NO_LETTERHEAD_SOURCE
    );
    if (!mid.error && Array.isArray(mid.data)) {
      data = mid.data;
      error = null;
    } else {
      const retry = await selectDocumentsForType(db, applicationTypeId, DOCUMENT_COLUMNS_LEGACY);
      data = retry.data;
      error = retry.error;
    }
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
      sectionLabel: typeof rec.section_label === "string" ? rec.section_label.trim() || null : null,
    });
  }
  return rows;
}

export async function fetchPlaceholdersForApplicationType(
  applicationTypeId: string,
  client?: CatalogDb
): Promise<CatalogLinkedPlaceholder[]> {
  const cached = placeholdersByType.get(applicationTypeId);
  if (cached) return cached;
  const pending = loadPlaceholdersForApplicationType(applicationTypeId, client);
  placeholdersByType.set(applicationTypeId, pending);
  return pending;
}

async function loadPlaceholdersForApplicationType(
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
  const cached = placeholdersByDocument.get(documentId);
  if (cached) return cached;
  const pending = loadPlaceholdersForDocument(documentId, client);
  placeholdersByDocument.set(documentId, pending);
  return pending;
}

async function loadPlaceholdersForDocument(
  documentId: string,
  client?: CatalogDb
): Promise<CatalogLinkedPlaceholder[]> {
  const db = await resolveClient(client);
  const withSection = await db
    .from("application_document_placeholders")
    .select(
      "required, sort_order, section_label, placeholders ( id, token, legacy_token, label, source_table, source_column, ui_group, is_active )"
    )
    .eq("document_id", documentId)
    .order("sort_order");

  const missingSectionColumn = /section_label/i.test(withSection.error?.message ?? "");
  const { data, error } = missingSectionColumn
    ? await db
        .from("application_document_placeholders")
        .select(
          "required, sort_order, placeholders ( id, token, legacy_token, label, source_table, source_column, ui_group, is_active )"
        )
        .eq("document_id", documentId)
        .order("sort_order")
    : withSection;

  if (error || !Array.isArray(data)) return [];
  return mapLinkedPlaceholderRows(data);
}

/** Type-level placeholders UNION document-only links (same master row is not duplicated). */
export async function fetchResolvedPlaceholdersForApplication(
  applicationTypeId: string,
  documentId?: string | null,
  client?: CatalogDb
): Promise<CatalogLinkedPlaceholder[]> {
  const [typeRows, docRows] = await Promise.all([
    fetchPlaceholdersForApplicationType(applicationTypeId, client),
    documentId
      ? fetchPlaceholdersForDocument(documentId, client)
      : Promise.resolve([] as CatalogLinkedPlaceholder[]),
  ]);
  const byId = new Map<string, CatalogLinkedPlaceholder>();
  for (const row of typeRows) byId.set(row.id, row);
  if (documentId) {
    for (const row of docRows) {
      const existing = byId.get(row.id);
      if (existing) {
        byId.set(row.id, {
          ...existing,
          required: existing.required || row.required,
          sort_order: Math.min(existing.sort_order, row.sort_order),
          sectionLabel: row.sectionLabel?.trim() || existing.sectionLabel || null,
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
  /** Session / auth COA expiry (ISO) when applicant rows omit it — fills `{{VALIDITY}}`. */
  consultant_coa_expiry?: string | null;
  /** Session / auth LBS expiry when applicant rows omit it. */
  consultant_lbs_expiry?: string | null;
  /**
   * Application `created_at` (ISO) → `{{APPOINTMENT_DATE}}` on consultant /
   * supervision memos (date the application was created).
   */
  application_created_at?: string | null;
};

/** Format ISO / Date-parseable value as DD/MM/YYYY for catalog letter dates. */
export function formatCatalogDateDmy(value?: string | null): string {
  if (!value?.trim()) return "";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    const m = value.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    return m ? value.trim() : "";
  }
  const day = String(parsed.getDate()).padStart(2, "0");
  const month = String(parsed.getMonth() + 1).padStart(2, "0");
  const year = parsed.getFullYear();
  return `${day}/${month}/${year}`;
}

/** Prefer Architect on the roster; else Licensed Surveyor. */
function findArchitectOrLsApplicant(
  applicants: JsonRecord[] | undefined
): JsonRecord | undefined {
  return (
    (findConsultantApplicantInList(applicants, "Architect") as JsonRecord | undefined) ||
    (findConsultantApplicantInList(applicants, "Licensed Surveyor") as
      | JsonRecord
      | undefined)
  );
}

/** Role title from project roster — never the combined "Architect/ Licensed Surveyor". */
export function resolveArchitectOrLsRoleLabel(
  applicants: JsonRecord[] | undefined
): string {
  if (findConsultantApplicantInList(applicants, "Architect")) return "Architect";
  if (findConsultantApplicantInList(applicants, "Licensed Surveyor")) {
    return "Licensed Surveyor";
  }
  return "";
}

function resolveArchitectOrLsRegLabel(applicants: JsonRecord[] | undefined): string {
  const role = resolveArchitectOrLsRoleLabel(applicants);
  if (role === "Licensed Surveyor") return "Reg. No.";
  if (role === "Architect") return "COA Reg. No.";
  return "";
}

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

function resolveConsultantNameByPlaceholderId(
  placeholderId: string,
  applicants: JsonRecord[] | undefined
): string | null {
  const roleType = CONSULTANT_NAME_PLACEHOLDER_TEMPLATE_TYPE[placeholderId];
  const roleKeywords = CONSULTANT_NAME_PLACEHOLDER_KEYWORDS[placeholderId];
  let row: JsonRecord | undefined;
  if (roleType) {
    row = findConsultantApplicantInList(applicants, roleType) as JsonRecord | undefined;
  } else if (roleKeywords?.length) {
    row = applicants?.find((a) => {
      const t = String(a.applicantType ?? a.applicant_type ?? "").toLowerCase();
      return roleKeywords.some((kw) => t.includes(kw));
    });
  } else {
    return null;
  }
  return row ? stringifyCatalogValue(row.name) : "";
}

/** BMC To-block suburb/region label (City | Western | Eastern) from plot region or ward. */
export function resolveSuburbFromPlotDetails(
  savePlotDetails: Record<string, unknown> | null | undefined
): string {
  const regionRaw = String(savePlotDetails?.region ?? "").trim();
  const wardRaw = String(savePlotDetails?.ward ?? "").trim();
  const region =
    regionRaw ||
    inferLocationFromWard(normalizeWard(wardRaw) || wardRaw).region ||
    "";
  // Print region only (City / Western / Eastern) — no "Suburb" suffix.
  if (region === "City" || region === "Western" || region === "Eastern") {
    return region;
  }
  return "";
}

/** English words for plot area (e.g. 1453 → "One Thousand Four Hundred Fifty Three"). */
export function numberToEnglishWords(raw: string | number | null | undefined): string {
  const cleaned = String(raw ?? "")
    .replace(/,/g, "")
    .trim();
  if (!cleaned) return "";
  const num = Number(cleaned);
  if (!Number.isFinite(num) || num < 0) return "";

  const ones = [
    "",
    "One",
    "Two",
    "Three",
    "Four",
    "Five",
    "Six",
    "Seven",
    "Eight",
    "Nine",
    "Ten",
    "Eleven",
    "Twelve",
    "Thirteen",
    "Fourteen",
    "Fifteen",
    "Sixteen",
    "Seventeen",
    "Eighteen",
    "Nineteen",
  ];
  const tens = [
    "",
    "",
    "Twenty",
    "Thirty",
    "Forty",
    "Fifty",
    "Sixty",
    "Seventy",
    "Eighty",
    "Ninety",
  ];

  const underThousand = (n: number): string => {
    if (n === 0) return "";
    if (n < 20) return ones[n];
    if (n < 100) {
      const t = Math.floor(n / 10);
      const o = n % 10;
      return o ? `${tens[t]} ${ones[o]}` : tens[t];
    }
    const h = Math.floor(n / 100);
    const rest = n % 100;
    return rest
      ? `${ones[h]} Hundred ${underThousand(rest)}`
      : `${ones[h]} Hundred`;
  };

  const underMillion = (n: number): string => {
    if (n === 0) return "Zero";
    if (n < 1000) return underThousand(n);
    if (n < 1_000_000) {
      const th = Math.floor(n / 1000);
      const rest = n % 1000;
      const head = `${underThousand(th)} Thousand`;
      return rest ? `${head} ${underThousand(rest)}` : head;
    }
    const mil = Math.floor(n / 1_000_000);
    const rest = n % 1_000_000;
    const head = `${underThousand(mil)} Million`;
    return rest ? `${head} ${underMillion(rest)}` : head;
  };

  const [intPart, fracPart] = cleaned.split(".");
  const whole = underMillion(Math.floor(Math.abs(Number(intPart) || 0)));
  if (!fracPart || /^0+$/.test(fracPart)) return whole;
  const decimals = fracPart
    .split("")
    .map((d) => ones[Number(d)] || "Zero")
    .join(" ");
  return `${whole} Point ${decimals}`;
}

export function resolveCatalogPlaceholderValue(
  placeholder: ApplicationCatalogPlaceholder,
  project: CatalogProjectSource | null | undefined,
  opts?: { applicantType?: string | null }
): string {
  const applicants = project?.applicant_details?.applicants;
  // Role-specific consultant names (fact sheet) — even if catalog row is still "computed".
  const consultantName = resolveConsultantNameByPlaceholderId(placeholder.id, applicants);
  if (consultantName !== null) return consultantName;

  if (placeholder.source_table === "computed") {
    if (
      placeholder.source_column === "current_date" ||
      placeholder.source_column === "current_day" ||
      placeholder.source_column === "current_month_year"
    ) {
      const now = new Date();
      if (placeholder.source_column === "current_day") {
        return String(now.getDate()).padStart(2, "0");
      }
      if (placeholder.source_column === "current_month_year") {
        return now.toLocaleString("en-GB", { month: "long", year: "numeric" });
      }
      const day = String(now.getDate()).padStart(2, "0");
      const month = String(now.getMonth() + 1).padStart(2, "0");
      return `${day}/${month}/${now.getFullYear()}`;
    }
    if (placeholder.source_column === "applicant_role") {
      return opts?.applicantType?.trim() || "";
    }
    // BMC annexure To-block organisation — Word source always prints this literal.
    if (placeholder.id === "bp_organisation" || placeholder.token === "{{BP_ORGANISATION}}") {
      return "Brihanmumbai Municipal Corporation";
    }
    // Suburb/region from plot (City | Western | Eastern) — no "Suburb" suffix.
    if (placeholder.id === "suburb" || placeholder.token === "{{SUBURB}}") {
      return resolveSuburbFromPlotDetails(project?.save_plot_details);
    }
    // Owner plot-area affidavit — words from numeric {{PLOT_AREA}} / grossPlotArea.
    if (placeholder.id === "plot_area_words" || placeholder.token === "{{PLOT_AREA_WORDS}}") {
      const area = stringifyCatalogValue(
        project?.save_plot_details?.grossPlotArea ??
          project?.save_plot_details?.gross_plot_area ??
          project?.save_plot_details?.plotArea ??
          project?.save_plot_details?.plot_area
      );
      return numberToEnglishWords(area);
    }
    // C.C. / prose: print Owner or Developer only — never "Owner/Developer".
    if (
      placeholder.id === "owner_or_developer" ||
      placeholder.token === "{{OWNER_OR_DEVELOPER}}"
    ) {
      return primaryApplicantLabelFromRoster(applicants);
    }
    // Prefer architect/LS salutation when application type has no applicant_type.
    if (placeholder.id === "salutation" || placeholder.token === "{{SALUTATION}}") {
      const arch =
        findConsultantApplicantInList(applicants, "Architect") ||
        findConsultantApplicantInList(applicants, "Licensed Surveyor");
      if (arch) {
        return stringifyCatalogValue(
          (arch as JsonRecord).salutation ?? (arch as JsonRecord).Salutation
        );
      }
      return "";
    }
    if (placeholder.source_column === "consultant_validity") {
      const arch =
        findConsultantApplicantInList(applicants, "Architect") ||
        findConsultantApplicantInList(applicants, "Licensed Surveyor");
      const fromApplicant = arch
        ? stringifyCatalogValue(
            (arch as JsonRecord).validity ??
              (arch as JsonRecord).registrationValidity ??
              (arch as JsonRecord).registration_validity ??
              (arch as JsonRecord).coa_expiry_date ??
              (arch as JsonRecord).coaExpiryDate ??
              (arch as JsonRecord).lbs_expiry_date ??
              (arch as JsonRecord).lbsExpiryDate
          )
        : "";
      // Applicant roster rarely stores COA expiry — fall back to session metadata.
      const raw =
        fromApplicant ||
        stringifyCatalogValue(project?.consultant_coa_expiry) ||
        stringifyCatalogValue(project?.consultant_lbs_expiry);
      return formatCoaExpiryDisplay(raw) || raw;
    }
    // DigiSatbara primary PR card footer → Plot Area Certificate {{DATE_OF_PRC}}.
    if (placeholder.id === "date_of_prc" || placeholder.token === "{{DATE_OF_PRC}}") {
      return stringifyCatalogValue(
        project?.save_plot_details?.prcDownloadDate ??
          project?.save_plot_details?.prc_download_date
      );
    }
    // Notice / plinth / DCC — Building No. prints Project Details proposalNo.
    if (placeholder.id === "building_no" || placeholder.token === "{{BUILDING_NO}}") {
      return stringifyCatalogValue(
        project?.project_info?.proposalNo ?? project?.project_info?.proposal_no
      );
    }
    // Consultant / supervision memos — appointment letter date = application created_at.
    if (
      placeholder.id === "appointment_date" ||
      placeholder.token === "{{APPOINTMENT_DATE}}"
    ) {
      return (
        formatCatalogDateDmy(project?.application_created_at) ||
        // Fallback: today when the application row has no created_at yet.
        formatCatalogDateDmy(new Date().toISOString())
      );
    }
    // Architect / L.S. firm (C.C. on Structural / Plumber / Site Supervisor memos).
    if (
      placeholder.id === "architect_ls_office" ||
      placeholder.token === "{{ARCHITECT_LS_OFFICE}}"
    ) {
      const arch = findArchitectOrLsApplicant(applicants);
      if (!arch) return "";
      return stringifyCatalogValue(
        arch.entity_name ??
          arch.entityName ??
          arch.firm_name ??
          arch.firmName ??
          arch.company_name ??
          arch.companyName
      );
    }
    // Single role from project — Architect OR Licensed Surveyor (not both).
    if (
      placeholder.id === "architect_or_ls_role" ||
      placeholder.token === "{{ARCHITECT_OR_LS_ROLE}}"
    ) {
      return resolveArchitectOrLsRoleLabel(applicants);
    }
    if (
      placeholder.id === "architect_or_ls_reg_label" ||
      placeholder.token === "{{ARCHITECT_OR_LS_REG_LABEL}}"
    ) {
      return resolveArchitectOrLsRegLabel(applicants);
    }
    // Architect / L.S. registration no. (C.C. block — not the memo signer’s {{REG_NO}}).
    if (
      placeholder.id === "architect_ls_reg_no" ||
      placeholder.token === "{{ARCHITECT_LS_REG_NO}}"
    ) {
      const arch = findArchitectOrLsApplicant(applicants);
      if (!arch) return "";
      return stringifyCatalogValue(
        arch.registrationNumber ??
          arch.registrationNo ??
          arch.registration_number ??
          arch.coa_reg_no ??
          arch.coaRegNo ??
          arch.lbs_license_no ??
          arch.lbsLicenseNo
      );
    }
    // Architect / L.S. validity for C.C. labeled blocks.
    if (
      placeholder.id === "architect_ls_validity" ||
      placeholder.token === "{{ARCHITECT_LS_VALIDITY}}"
    ) {
      const arch = findArchitectOrLsApplicant(applicants);
      const fromApplicant = arch
        ? stringifyCatalogValue(
            arch.validity ??
              arch.registrationValidity ??
              arch.registration_validity ??
              arch.coa_expiry_date ??
              arch.coaExpiryDate ??
              arch.lbs_expiry_date ??
              arch.lbsExpiryDate
          )
        : "";
      const raw =
        fromApplicant ||
        stringifyCatalogValue(project?.consultant_coa_expiry) ||
        stringifyCatalogValue(project?.consultant_lbs_expiry);
      return formatCoaExpiryDisplay(raw) || raw;
    }
    return "";
  }
  if (placeholder.source_table === "owner_applicant") {
    const row = pickApplicant(applicants, null, true);
    if (!row) return "";
    const key = placeholder.source_column || "";
    if (key === "name") {
      const first = stringifyCatalogValue(row.first_name ?? row.firstName);
      const middle = stringifyCatalogValue(row.middle_name ?? row.middleName);
      const last = stringifyCatalogValue(row.last_name ?? row.lastName);
      const person = [first, middle, last].filter(Boolean).join(" ").trim();
      return person || stringifyCatalogValue(row.name);
    }
    const alt =
      key === "entity_name"
        ? row.entity_name ?? row.entityName
        : row[key] ?? row[key.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase())];
    return stringifyCatalogValue(alt);
  }
  if (placeholder.source_table === "applicants") {
    let row = pickApplicant(applicants, opts?.applicantType ?? null, false);
    const wantsArchitectOrLs =
      placeholder.id === "architect_ls_name" ||
      placeholder.id === "architects_name" ||
      placeholder.id === "architect_ls_office" ||
      placeholder.id === "architect_address_line_1" ||
      placeholder.id === "architect_address_line_2" ||
      placeholder.id === "architect_address_line_3" ||
      placeholder.id === "architect_ls_reg_no" ||
      placeholder.token === "{{ARCHITECT_LS_NAME}}" ||
      placeholder.token === "{{ARCHITECTS_NAME}}" ||
      placeholder.token === "{{ARCHITECT_LS_OFFICE}}" ||
      placeholder.token === "{{ARCHITECT_ADDRESS_LINE_1}}" ||
      placeholder.token === "{{ARCHITECT_ADDRESS_LINE_2}}" ||
      placeholder.token === "{{ARCHITECT_ADDRESS_LINE_3}}" ||
      placeholder.token === "{{ARCHITECT_LS_REG_NO}}";
    // Always prefer Architect / L.S. for architect_* tokens (Supervision C.C., etc.) —
    // Document Checklist has no applicant_type; other docs may resolve the signer role first.
    if (wantsArchitectOrLs) {
      row =
        (findConsultantApplicantInList(applicants, "Architect") as JsonRecord | undefined) ||
        (findConsultantApplicantInList(applicants, "Licensed Surveyor") as
          | JsonRecord
          | undefined) ||
        row;
    } else if (
      !row &&
      (placeholder.id === "consultant_firm" ||
        placeholder.id === "consultant_name" ||
        placeholder.id === "reg_no")
    ) {
      row =
        (findConsultantApplicantInList(applicants, "Architect") as JsonRecord | undefined) ||
        (findConsultantApplicantInList(applicants, "Licensed Surveyor") as
          | JsonRecord
          | undefined);
    }
    if (!row) return "";
    const key = placeholder.source_column || "name";
    const camelKey = key.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());
    const alt =
      key === "entity_name"
        ? row.entity_name ?? row.entityName
        : key === "registrationNumber"
          ? row.registrationNumber ?? row.registrationNo
          : row[key] ?? row[camelKey];
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

/** Templates use `(Zone - {{ZONE}})`; stored plot zone is often already `Zone V`. */
function formatZoneTokenForTemplate(value: string): string {
  return value.replace(/^Zone\s+/i, "").trim();
}

/** Same idea as appointment `$project_CS/CTSNos.` — label from Project Details `plotBelongsTo`. */
function surveyKindLabelForPlot(plotBelongs: unknown): string {
  switch (String(plotBelongs ?? "").trim()) {
    case "CS No.":
      return "C.S. No.";
    case "F.P.No":
      return "F.P. No.";
    case "CTS No.":
    default:
      return "C.T.S. No.";
  }
}

/** Road / Street Name. Keep a single "Road" when the saved name already includes it. */
function formatRoadNameToken(roadName: string): string {
  const cleaned = roadName.trim();
  if (!cleaned) return "";
  if (/\broad\b/i.test(cleaned)) return cleaned;
  return `${cleaned} Road`;
}

/**
 * Ward token = code only (e.g. `L`). Templates add the word “Ward” in prose when needed
 * (`{{WARD}} Ward`). Strips a trailing “Ward” if the stored value already includes it.
 */
function formatWardToken(ward: string): string {
  const cleaned = ward.trim().replace(/\s+/g, " ");
  if (!cleaned) return "";
  return cleaned.replace(/\s*\bward\b\.?\s*$/i, "").trim();
}

/** Short place-type label for meta tables (not the value prefix). */
function placeKindLabelForPlot(plotBelongs: unknown): string {
  switch (String(plotBelongs ?? "").trim()) {
    case "CS No.":
      return "Division";
    case "F.P.No":
      return "T.P. Scheme No.";
    case "CTS No.":
    default:
      return "Village";
  }
}

/** Single survey-number mustache for the active plotBelongsTo. */
function surveyNumberTokenForPlot(plotBelongs: unknown): string {
  switch (String(plotBelongs ?? "").trim()) {
    case "CS No.":
      return "{{CS_NO}}";
    case "F.P.No":
      return "{{FP_NO}}";
    case "CTS No.":
    default:
      return "{{CTS_NO}}";
  }
}

/** Single place mustache for the active plotBelongsTo (bare name; label supplies type). */
function placeValueTokenForPlot(plotBelongs: unknown): string {
  switch (String(plotBelongs ?? "").trim()) {
    case "CS No.":
      return "{{DIVISION}}";
    case "F.P.No":
      // Prefer {{VILLAGE}} (villageName / TPS schema) so formatTpsNoToken’s long phrase
      // is not doubled next to a “T.P. Scheme No.” meta label.
      return "{{VILLAGE}}";
    case "CTS No.":
    default:
      return "{{VILLAGE}}";
  }
}

/** Optional plotBelongsTo passed via preview field map (not substituted into HTML). */
export const PLOT_BELONGS_TO_FIELD_KEY = "__plotBelongsTo";

export function plotBelongsToFromPreviewFields(
  fields: Record<string, string | undefined> | null | undefined
): string {
  if (!fields) return "";
  const raw =
    fields[PLOT_BELONGS_TO_FIELD_KEY] ??
    fields.plotBelongsTo ??
    fields["{{PLOT_BELONGS_TO}}"] ??
    "";
  return String(raw).trim();
}

function formatPlotCsCtsToken(
  numbers: string,
  plotBelongs: unknown
): string {
  const cleaned = numbers.trim();
  if (!cleaned) return "";
  if (/^(?:C\.T\.S\.|C\.S\.|F\.P\.)\s*No/i.test(cleaned)) return cleaned;
  return `${surveyKindLabelForPlot(plotBelongs)} ${cleaned}`;
}

/** Same plotBelongsTo rule as Project Details: Village / Division / TPS schema. */
export function formatVillageDivisionForPlot(
  villageOrDivision: string,
  plotBelongs: unknown
): string {
  const cleaned = villageOrDivision.trim();
  if (!cleaned) return "";
  if (/^(?:Village|Division|TPS schema)\b/i.test(cleaned)) return cleaned;
  switch (String(plotBelongs ?? "").trim()) {
    case "CS No.":
      return `Division ${cleaned}`;
    case "F.P.No":
      return `TPS schema ${cleaned}`;
    case "CTS No.":
    default:
      return `Village ${cleaned}`;
  }
}

/**
 * When templates hardcode "Village /Division" (or "of Village") before the token,
 * strip that label so the plotBelongsTo-aware value can supply the correct one.
 * Also collapses Plot/CS/CTS/FP and Division/Village/TPS slash-lists using plotBelongsTo
 * so old Storage HTML does not need per-file edits.
 */
export function normalizePlotTypeLabelsInTemplateHtml(
  html: string,
  plotBelongs?: unknown
): string {
  if (!html) return html;
  let out = html;
  out = out.replace(
    /Village\s*\/\s*Division(?:&nbsp;|\u00a0|\s)*(?=(?:<[^>]+>\s*)*\{\{VILLAGE_DIVISION\}\})/gi,
    ""
  );
  out = out.replace(
    /\bof\s+[Vv]illage(?=\s*(?:<[^>]+>\s*)*\{\{VILLAGE\}\})/g,
    "of "
  );
  out = out.replace(
    /(?:^|[>\s])Village(?=\s*(?:<[^>]+>\s*)*\{\{VILLAGE\}\})/g,
    (match) => match.replace(/Village/i, "")
  );
  out = out.replace(
    /\bof\s+Village-?\s*(?=(?:<[^>]+>\s*)*\$project_Division\/Village)/gi,
    "of "
  );

  const belongs = String(plotBelongs ?? "").trim();
  if (belongs) {
    const surveyLabel = surveyKindLabelForPlot(belongs);
    const placeLabel = placeKindLabelForPlot(belongs);
    const surveyToken = surveyNumberTokenForPlot(belongs);
    const placeToken = placeValueTokenForPlot(belongs);

    // Label: "Plot No./ C.S. No./ C.T.S. No. / F.P No." (flexible punctuation)
    out = out.replace(
      /Plot\s*No\.?\s*\/\s*C\.?\s*S\.?\s*No\.?\s*\/\s*C\.?\s*T\.?\s*S\.?\s*No\.?\s*\/\s*F\.?\s*P\.?\s*No\.?/gi,
      surveyLabel
    );
    // Inline prose variant without spaces around slashes
    out = out.replace(
      /Plot\s*No\.\s*\/C\.S\.\s*No\.\/C\.T\.S\.\s*No\.\/\s*F\.P\s*No\.?/gi,
      surveyLabel
    );

    // Value slash of four plot tokens (optional <span class="value-bold"> wrappers)
    const tok = (name: string) =>
      `(?:<span[^>]*>\\s*)?\\{\\{${name}\\}\\}(?:\\s*<\\/span>)?`;
    out = out.replace(
      new RegExp(
        `${tok("PLOT_NO")}\\s*\\/\\s*${tok("CS_NO")}\\s*\\/\\s*${tok("CTS_NO")}\\s*\\/\\s*${tok("FP_NO")}`,
        "gi"
      ),
      `<span class="value-bold">${surveyToken}</span>`
    );

    // Label: "Division/ Village/ T.P. Scheme No." (+ "of " / "Town Planning Scheme")
    out = out.replace(
      /(?:of\s+)?Division\s*\/\s*Village\s*\/\s*(?:T\.?\s*P\.?\s*Scheme|Town\s+Planning\s+Scheme)\s*No\.?/gi,
      placeLabel
    );
    out = out.replace(
      /Division\s*\/\s*Village\s*\/\s*Town\s+Planning\s+Scheme\s*No\.?/gi,
      placeLabel
    );

    // Value slash Division/Village/TPS
    out = out.replace(
      new RegExp(
        `${tok("DIVISION")}\\s*\\/\\s*${tok("VILLAGE")}\\s*\\/\\s*${tok("TPS_NO")}`,
        "gi"
      ),
      `<span class="value-bold">${placeToken}</span>`
    );
  }

  return out;
}

function formatVillageDivisionToken(
  villageOrDivision: string,
  plotBelongs: unknown
): string {
  return formatVillageDivisionForPlot(villageOrDivision, plotBelongs);
}

/**
 * Work Start Notice: only for F.P./TPS plots. CS/CTS → empty (phrase omitted).
 * Value is villageName / TPS schema from save_plot_details.
 */
function formatTpsNoToken(villageOrTps: string, plotBelongs: unknown): string {
  if (String(plotBelongs ?? "").trim() !== "F.P.No") return "";
  const cleaned = villageOrTps.trim();
  if (!cleaned) return "";
  if (/Town Planning Scheme No/i.test(cleaned)) return cleaned.startsWith(" ")
    ? cleaned
    : ` ${cleaned}`;
  return ` Town Planning Scheme No. ${cleaned}`;
}

function assignCatalogField(
  out: Record<string, string>,
  ph: CatalogLinkedPlaceholder,
  value: string
): void {
  if (ph.token) out[ph.token] = value;
  if (ph.legacy_token) {
    const legacy = ph.legacy_token.startsWith("$")
      ? ph.legacy_token.slice(1)
      : ph.legacy_token;
    out[legacy] = value;
  }
}

/** Field map for new {{TOKEN}} HTML plus legacy $project_* aliases from catalog. */
export function catalogPlaceholderFieldMap(
  placeholders: CatalogLinkedPlaceholder[],
  project: CatalogProjectSource | null | undefined,
  applicantType?: string | null
): Record<string, string> {
  const out: Record<string, string> = {};
  const plotBelongs = project?.save_plot_details?.plotBelongsTo;
  if (plotBelongs != null && String(plotBelongs).trim()) {
    out[PLOT_BELONGS_TO_FIELD_KEY] = String(plotBelongs).trim();
  }
  for (const ph of placeholders) {
    let value = resolveCatalogPlaceholderValue(ph, project, { applicantType });
    if (ph.token === "{{ZONE}}" || ph.id === "zone") {
      if (!value) continue;
      value = formatZoneTokenForTemplate(value);
      if (!value) continue;
      assignCatalogField(out, ph, value);
      continue;
    }
    if (
      ph.token === "{{WARD_NO}}" ||
      ph.id === "ward_no" ||
      ph.token === "{{WARD}}" ||
      ph.id === "ward"
    ) {
      if (!value) continue;
      value = formatWardToken(value);
      if (!value) continue;
      assignCatalogField(out, ph, value);
      continue;
    }
    if (ph.token === "{{ROAD_NAME}}" || ph.id === "road_name") {
      if (!value) continue;
      value = formatRoadNameToken(value);
      if (!value) continue;
      assignCatalogField(out, ph, value);
      continue;
    }
    if (ph.token === "{{PLOT_CS_CTS_NO}}" || ph.id === "plot_cs_cts_no") {
      if (!value) continue;
      value = formatPlotCsCtsToken(value, plotBelongs);
      if (!value) continue;
      assignCatalogField(out, ph, value);
      continue;
    }
    if (ph.token === "{{TPS_NO}}" || ph.id === "tps_no") {
      // Always assign (even "") so CS/CTS clears {{TPS_NO}} and hides the phrase.
      // For slash-collapse value slots use the bare name; formatTpsNoToken keeps
      // the “Town Planning Scheme No.” phrase for inline {{TPS_NO}} prose.
      assignCatalogField(out, ph, formatTpsNoToken(value, plotBelongs));
      continue;
    }
    if (ph.token === "{{VILLAGE_DIVISION}}" || ph.id === "village_division") {
      if (!value) continue;
      value = formatVillageDivisionToken(value, plotBelongs);
      if (!value) continue;
      assignCatalogField(out, ph, value);
      continue;
    }
    // {{VILLAGE}} / {{DIVISION}} stay as bare place names (meta labels supply the type).
    if (!value) continue;
    assignCatalogField(out, ph, value);
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
  const documentId = opts.documentId?.trim();
  if (documentId) {
    const byId = await loadCatalogDocumentByIdOrSlug(documentId, opts.client);
    if (byId?.html) return byId;
  }
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
