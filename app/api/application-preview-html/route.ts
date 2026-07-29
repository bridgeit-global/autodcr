import { NextRequest, NextResponse } from "next/server";
import type { TemplateType } from "@/app/templates/templateGenerators";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import QRCode from "qrcode";
import path from "node:path";
import { readFile } from "node:fs/promises";

import { PROJECT_SAVED_PDF_QR_SENTINEL } from "./constants";
import {
  CLEAN_APPOINTMENT_HTML_TYPES,
  isLegacySubAppointmentHtml,
  mergeBuildingProposalOfficerZoneParagraphs,
} from "@/app/utils/cleanAppointmentLetterTypes";
import { enrichConsultantAppointmentFields } from "@/app/utils/enrichConsultantAppointmentFields";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || "";
const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() || "";

const TEMPLATE_BUCKET =
  process.env.SUPABASE_APPLICATION_TEMPLATE_BUCKET?.trim() ||
  process.env.NEXT_PUBLIC_APPLICATION_TEMPLATE_BUCKET?.trim() ||
  "Application_Templates";

const TEMPLATE_PATH_MAP: Record<TemplateType, string> = {
  Architect: "architect.html",
  "Licensed Surveyor": "licensed-surveyor.html",
  "Structural Engineer": "structural-engineer.html",
  "Fire Safety Consultant": "fire-safety-consultant.html",
  "M&E Consultant": "me-consultant.html",
  Plumber: "plumber.html",
  "Parking Consultant": "parking-consultant.html",
  "Rainwater Consultant": "rainwater-consultant.html",
  "Site Supervisor": "site-supervisor.html",
  Horticulturist: "horticulturist.html",
  "Landscape Consultant": "landscape-consultant.html",
  "Geotechnical Consultant": "geotechnical-consultant.html",
  "Environmental Consultant": "environmental-consultant.html",
  "Town Planner": "town-planner.html",
  "PMC / Project Manager": "pmc-project-manager.html",
};

/** Storage errors sometimes expose `message` as JSON (e.g. `{ "url": "..." }`) — normalize for UI. */
function describeStorageTemplateDownloadError(
  err: { message?: string; statusCode?: string },
  objectPath: string,
  bucket: string
): string {
  const raw = (err.message ?? "").trim();
  let parsed: Record<string, unknown> | null = null;
  if (raw.startsWith("{")) {
    try {
      parsed = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      parsed = null;
    }
  }

  const status = err.statusCode ?? (parsed?.statusCode as string | undefined);
  const nestedMsg =
    parsed && typeof parsed.message === "string" ? parsed.message.trim() : "";
  const looksLikeJsonOnlyUrl =
    parsed &&
    typeof parsed.url === "string" &&
    Object.keys(parsed).length <= 2 &&
    !nestedMsg;

  const combined = `${raw} ${nestedMsg}`.toLowerCase();
  const likelyMissing =
    status === "404" ||
    /not\s*found|does\s*not\s*exist|object\s+not\s*found/i.test(combined) ||
    looksLikeJsonOnlyUrl;

  if (likelyMissing) {
    return `Missing template "${objectPath}" in Storage bucket "${bucket}". Upload it from your repo (e.g. html/architect_acceptance.html) or confirm the file name matches exactly.`;
  }

  if (nestedMsg) return nestedMsg;
  if (raw && !raw.startsWith("{")) return raw;

  return `Could not download "${objectPath}" from bucket "${bucket}". Check Storage policies and that the file exists.`;
}

const SHARED_CSS_STORAGE_PATH = "_shared/application-templates.css";

/**
 * When true, HTML/CSS is read from the repo `html/` folder before Storage.
 * Default: Supabase Storage bucket `Application_Templates` first; repo is fallback only.
 */
function preferLocalApplicationTemplates(): boolean {
  const local = process.env.USE_LOCAL_APPLICATION_TEMPLATES?.trim().toLowerCase();
  if (local === "1" || local === "true" || local === "yes" || local === "on") {
    return true;
  }
  // Legacy opt-out of Storage-first (local first when explicitly disabled).
  const legacy = process.env.USE_SUPABASE_APPLICATION_TEMPLATES?.trim().toLowerCase();
  if (legacy === "0" || legacy === "false" || legacy === "off") {
    return true;
  }
  return false;
}

/**
 * Read `html/<objectPath>` from the repo (committed on GitHub, deployed with the app).
 */
async function readRepoApplicationTemplateHtml(
  objectPath: string
): Promise<string | null> {
  const rawBase =
    process.env.APPLICATION_TEMPLATES_LOCAL_DIR?.trim() ||
    path.join("html");
  const base = path.isAbsolute(rawBase)
    ? path.resolve(rawBase)
    : path.resolve(process.cwd(), rawBase);
  const abs = path.resolve(base, objectPath);
  const rel = path.relative(base, abs);
  if (rel.startsWith("..") || path.isAbsolute(rel)) return null;

  try {
    const text = await readFile(abs, "utf8");
    if (process.env.NODE_ENV === "development") {
      console.log("[application-preview-html] using repo template:", abs);
    }
    return text;
  } catch {
    return null;
  }
}

async function downloadStorageTemplateText(
  supabase: SupabaseClient,
  objectPath: string
): Promise<string | null> {
  const { data: file, error: downloadError } = await supabase.storage
    .from(TEMPLATE_BUCKET)
    .download(objectPath);

  if (downloadError) {
    throw new Error(
      describeStorageTemplateDownloadError(downloadError, objectPath, TEMPLATE_BUCKET)
    );
  }
  if (!file) return null;
  return await file.text();
}

/** Bundled shared CSS shipped with the app (letterhead, layout, typography). */
async function readBundledSharedApplicationCss(): Promise<string> {
  const rawBase =
    process.env.APPLICATION_TEMPLATES_LOCAL_DIR?.trim() ||
    path.join("html");
  const base = path.isAbsolute(rawBase)
    ? path.resolve(rawBase)
    : path.resolve(process.cwd(), rawBase);
  const abs = path.resolve(base, "_shared", "application-templates.css");
  const rel = path.relative(base, abs);
  if (rel.startsWith("..") || path.isAbsolute(rel)) return "";
  try {
    return await readFile(abs, "utf8");
  } catch {
    return "";
  }
}

/** Shared letter chrome — Storage `_shared/application-templates.css`, then repo fallback. */
async function loadSharedArchitectApplicationCss(
  supabase?: SupabaseClient,
  opts?: { preferBundledCss?: boolean }
): Promise<string> {
  if (opts?.preferBundledCss) {
    const bundled = await readBundledSharedApplicationCss();
    if (bundled.trim()) {
      if (process.env.NODE_ENV === "development") {
        console.log(
          "[application-preview-html] using bundled shared CSS (clean appointment)"
        );
      }
      return bundled;
    }
  }

  if (supabase && !preferLocalApplicationTemplates()) {
    try {
      const fromStorage = await downloadStorageTemplateText(
        supabase,
        SHARED_CSS_STORAGE_PATH
      );
      if (fromStorage?.trim()) {
        if (process.env.NODE_ENV === "development") {
          console.log(
            "[application-preview-html] using Storage shared CSS:",
            SHARED_CSS_STORAGE_PATH
          );
        }
        return fromStorage;
      }
    } catch (error) {
      if (process.env.NODE_ENV === "development") {
        console.warn(
          "[application-preview-html] Storage shared CSS failed; using repo fallback.",
          error
        );
      }
    }
  }
  return readBundledSharedApplicationCss();
}

/** Insert shared CSS at top of `<head>` so `$project_*` tokens in that file are still replaced later. */
function injectSharedApplicationTemplateStyle(html: string, css: string): string {
  const trimmed = css.trim();
  if (!trimmed) return html;
  const block = `<style id="application-templates-shared">\n${trimmed}\n</style>`;
  if (/<head[^>]*>/i.test(html)) {
    return html.replace(/<head[^>]*>/i, (open) => `${open}\n${block}\n`);
  }
  return `<head>${block}</head>\n${html}`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function replaceTemplateTokens(
  html: string,
  fields: Record<string, string | undefined>
): string {
  let out = html;
  // Replace longer tokens first so `$foo` doesn't partially replace `$foo_bar`.
  const entries = Object.entries(fields).sort(([a], [b]) => b.length - a.length);
  for (const [key, raw] of entries) {
    const safeRaw = raw ?? "";
    const token = key.startsWith("$") ? key : `$${key}`;
    const escaped = escapeHtml(safeRaw);
    // First try fast exact replacement.
    out = out.split(token).join(escaped);
    // Then replace whitespace-variant tokens often produced by Word HTML exports.
    const whitespaceTolerantTokenRegex = new RegExp(
      escapeRegex(token).replace(/\\ /g, "\\s+"),
      "g"
    );
    out = out.replace(whitespaceTolerantTokenRegex, escaped);
  }
  // Final safety: remove any leftover $project_* tokens so placeholders never leak.
  // Keep PROJECT_SAVED_PDF_QR_SENTINEL — replaced later with a QR <img> after DB lookup.
  out = out.replace(/\$project_[A-Za-z0-9_./-]+/g, (match) =>
    match === PROJECT_SAVED_PDF_QR_SENTINEL ? match : ""
  );
  return out;
}

function paragraphVisibleText(innerHtml: string): string {
  return innerHtml
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Removes empty address-line paragraphs after token substitution (e.g. unused line 3). */
function removeEmptyAddressParagraphs(html: string): string {
  return html.replace(/<p(\s[^>]*)?>([\s\S]*?)<\/p>/gi, (full, attrs, inner) => {
    const visible = paragraphVisibleText(inner);
    if (visible) {
      // Drop leftover "For ," when firm name token was empty.
      if (/^for\s*,?$/i.test(visible)) return "";
      return full;
    }
    const attrStr = attrs ?? "";
    const isAddressLike =
      /\bbold\b|MsoNormal|value-bold|to-content|signature-company/i.test(attrStr) ||
      /value-bold|class=['"]?bold|signature-company/i.test(inner);
    return isAddressLike ? "" : full;
  });
}

/**
 * Places the saved-PDF QR beside the client/owner address on page 1.
 * Word letters usually look like: `<p>To,</p>` … address lines … `<p><b>Sub :</b>…`.
 * Fallback injection before `</body>` lands at the document end → last page after Paged.js.
 */
function insertSavedPdfQrBesideClientBlock(html: string, qrRightColumn: string): string | null {
  /* Non-greedy middle captures address lines; third group is first subject / body paragraph.
     Word often splits “Sub” and “:” across spans — allow markup between. */
  const subOrSubject =
    "(?:Sub[\\s\\S]{0,60}:|Subject[\\s\\S]{0,60}:|Letter\\s+of\\s+Appointment)";
  const letterPatterns: RegExp[] = [
    new RegExp(
      `(<p[^>]*>[\\s\\S]*?To\\s*,?\\s*<\\/p>)([\\s\\S]*?)(<p[^>]*>[\\s\\S]*?${subOrSubject})`,
      "i"
    ),
  ];
  for (const re of letterPatterns) {
    const m = html.match(re);
    if (m && typeof m.index === "number") {
      const full = m[0];
      const idx = m.index;
      const before = html.slice(0, idx);
      const after = html.slice(idx + full.length);
      const row = `<div class="app-saved-pdf-qr-row" style="display:flex!important;flex-direction:row!important;flex-wrap:nowrap!important;align-items:flex-start!important;justify-content:space-between!important;gap:16px!important;width:100%!important;max-width:100%!important;box-sizing:border-box!important;page-break-inside:avoid!important;margin:0!important;padding:0!important;"><div style="flex:1!important;min-width:0!important;max-width:none!important;">${m[1]}${m[2]}</div><div style="flex:none!important;flex-shrink:0!important;align-self:flex-start!important;width:auto!important;max-width:140px!important;">${qrRightColumn}</div></div>${m[3]}`;
      return before + row + after;
    }
  }
  return null;
}

function readApplicationUrlFromUrlsJson(
  raw: unknown,
  urlsKey: string
): string | undefined {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return undefined;
  const v = (raw as Record<string, unknown>)[urlsKey];
  return typeof v === "string" && v.trim() ? v.trim() : undefined;
}

async function loadSavedPdfUrlForQr(
  supabase: SupabaseClient,
  projectId: string,
  urlsKey: string
): Promise<string | undefined> {
  const { data, error } = await supabase
    .from("projects")
    .select("application_urls")
    .eq("id", projectId)
    .maybeSingle();

  if (!error && data) {
    const fromRow = readApplicationUrlFromUrlsJson(data.application_urls, urlsKey);
    if (fromRow) return fromRow;
  }

  const { data: rpcData, error: rpcError } = await supabase.rpc("get_project_for_preview", {
    p_project_id: projectId,
  });

  if (!rpcError && rpcData && typeof rpcData === "object" && !Array.isArray(rpcData)) {
    return readApplicationUrlFromUrlsJson(
      (rpcData as { application_urls?: unknown }).application_urls,
      urlsKey
    );
  }

  return undefined;
}

async function injectSavedPdfQrHtml(
  html: string,
  opts: {
    projectId?: string | null;
    templateType: TemplateType;
    authorizationToken: string | null;
    /** `projects.application_urls` key to encode in the QR (defaults to `templateType`). */
    applicationUrlsKey?: string;
    /** When set (e.g. predicted Storage public URL before first upload), skips DB lookup. */
    savedPdfUrlForQr?: string | null;
  }
): Promise<string> {
  let pdfUrl: string | undefined =
    typeof opts.savedPdfUrlForQr === "string" && opts.savedPdfUrlForQr.trim()
      ? opts.savedPdfUrlForQr.trim()
      : undefined;
  const urlsKey =
    typeof opts.applicationUrlsKey === "string" && opts.applicationUrlsKey.trim()
      ? opts.applicationUrlsKey.trim()
      : opts.templateType;

  if (!pdfUrl && opts.projectId?.trim() && opts.authorizationToken) {
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: { Authorization: `Bearer ${opts.authorizationToken}` },
      },
    });

    pdfUrl = await loadSavedPdfUrlForQr(supabase, opts.projectId.trim(), urlsKey);
  }

  const stripSentinel = (s: string) => s.split(PROJECT_SAVED_PDF_QR_SENTINEL).join("");

  if (!pdfUrl) {
    return stripSentinel(html);
  }

  let qrDataUrl: string;
  try {
    qrDataUrl = await QRCode.toDataURL(pdfUrl, {
      width: 112,
      margin: 1,
      errorCorrectionLevel: "M",
    });
  } catch {
    return stripSentinel(html);
  }

  /* Word exports often use `img { width:100% !important }`. Use a fixed-size div +
     background-image so those rules never apply (see injectPaginatedStyles #app-saved-pdf-qr). */
  const qrBox = `<div id="app-saved-pdf-qr" class="application-saved-pdf-qr-pixel" role="img" aria-label="Scan to open saved application PDF" style='width:112px!important;height:112px!important;max-width:112px!important;max-height:112px!important;min-width:112px!important;min-height:112px!important;flex:none!important;flex-grow:0!important;flex-shrink:0!important;align-self:flex-start!important;box-sizing:border-box!important;display:inline-block!important;overflow:hidden!important;line-height:0!important;background-image:url(${JSON.stringify(qrDataUrl)})!important;background-size:contain!important;background-repeat:no-repeat!important;background-position:center!important;background-color:#ffffff!important;vertical-align:top!important;'></div>`;

  const qrRightColumn = `<div class="application-saved-pdf-qr-fallback" style="display:flex!important;flex-direction:column!important;align-items:flex-end!important;gap:4px!important;margin:0!important;padding:0!important;border:none!important;width:132px!important;max-width:132px!important;min-width:0!important;box-sizing:border-box!important;"><span style="font-size:9px;color:#374151;">Saved application PDF</span>${qrBox}</div>`;

  const hadSentinel = html.includes(PROJECT_SAVED_PDF_QR_SENTINEL);

  /** Match layout on HTML without sentinel / QR — avoids EOF sentinel forcing last page. */
  const stripExistingQrBlocks = (s: string) =>
    s
      .replace(/<div[^>]*\bid\s*=\s*["']app-saved-pdf-qr["'][^>]*>\s*<\/div>/gi, "")
      .replace(
        /<div[^>]*class\s*=\s*["'][^"']*application-saved-pdf-qr-fallback[^"']*["'][^>]*>[\s\S]*?<\/div>/gi,
        ""
      );

  const baseForLayout = stripExistingQrBlocks(
    hadSentinel ? html.split(PROJECT_SAVED_PDF_QR_SENTINEL).join("") : html
  );

  const beside = insertSavedPdfQrBesideClientBlock(baseForLayout, qrRightColumn);
  if (beside) {
    return beside;
  }

  /* No To/Sub structure found (e.g. Plumber): keep sentinel replacement or append fallback. */
  let out = hadSentinel ? html.split(PROJECT_SAVED_PDF_QR_SENTINEL).join(qrBox) : html;
  if (!hadSentinel) {
    const fallback = `<div class="application-saved-pdf-qr-fallback" style="display:flex!important;flex-direction:column!important;align-items:flex-end!important;gap:4px!important;margin-top:12px!important;padding:8px 0!important;border-top:1px solid #e5e7eb!important;width:132px!important;max-width:132px!important;min-width:0!important;margin-left:auto!important;margin-right:0!important;clear:both!important;flex-shrink:0!important;box-sizing:border-box!important;"><span style="font-size:9px;color:#374151;">Saved application PDF</span>${qrBox}</div>`;
    if (out.includes("</body>")) {
      out = out.replace(/<\/body>/i, `${fallback}</body>`);
    } else {
      out = `${out}${fallback}`;
    }
  }

  return out;
}

/** Maps each template type to its acceptance HTML file name. */
const ACCEPTANCE_TEMPLATE_PATH_MAP: Partial<Record<TemplateType, string>> = {
  Architect: "architect_acceptance.html",
  "Licensed Surveyor": "licensed-surveyor_acceptance.html",
  "Fire Safety Consultant": "fire-safety-consultant_acceptance.html",
  "Landscape Consultant": "landscape-consultant_acceptance.html",
  "Geotechnical Consultant": "geotechnical-consultant_acceptance.html",
  "M&E Consultant": "me-consultant_acceptance.html",
  Plumber: "plumber_acceptance.html",
  "Town Planner": "town-planner_acceptance.html",
  "Structural Engineer": "structural-engineer_acceptance.html",
  "Environmental Consultant": "environmental-consultant_acceptance.html",
  "PMC / Project Manager": "pmc-project-manager_acceptance.html",
};

/** Maps template type to its `application_urls` acceptance key for QR injection. */
const ACCEPTANCE_APPLICATION_URL_KEY_MAP: Partial<Record<TemplateType, string>> = {
  Architect: "Architect_acceptance",
  "Licensed Surveyor": "Licensed_Surveyor_acceptance",
  "Fire Safety Consultant": "Fire_Safety_acceptance",
  "Landscape Consultant": "Landscape_Consultant_acceptance",
  "Geotechnical Consultant": "Geotechnical_Consultant_acceptance",
  "M&E Consultant": "ME_Consultant_acceptance",
  Plumber: "Plumber_acceptance",
  "Town Planner": "Town_Planner_acceptance",
  "Structural Engineer": "Structural_Engineer_acceptance",
  "Environmental Consultant": "Environmental_Consultant_acceptance",
  "PMC / Project Manager": "PMC_Project_Manager_acceptance",
};

async function loadApplicationTemplateHtml(
  supabase: SupabaseClient,
  objectPath: string,
  opts?: { templateType?: TemplateType; letterVariant?: "appointment" | "acceptance" }
): Promise<string | null> {
  const loadFromRepo = async (): Promise<string | null> =>
    readRepoApplicationTemplateHtml(objectPath);

  const loadFromStorage = async (): Promise<string | null> => {
    const text = await downloadStorageTemplateText(supabase, objectPath);
    if (text !== null && process.env.NODE_ENV === "development") {
      console.log(
        `[application-preview-html] using Storage template: ${TEMPLATE_BUCKET}/${objectPath}`
      );
    }
    return text;
  };

  const preferRepoFirst =
    preferLocalApplicationTemplates() ||
    (opts?.letterVariant !== "acceptance" &&
      opts?.templateType != null &&
      CLEAN_APPOINTMENT_HTML_TYPES.has(opts.templateType));

  if (preferRepoFirst) {
    const repoHtml = await loadFromRepo();
    if (repoHtml !== null) return repoHtml;
    return loadFromStorage();
  }

  try {
    const fromStorage = await loadFromStorage();
    if (fromStorage !== null) return fromStorage;
  } catch (error) {
    const repoHtml = await loadFromRepo();
    if (repoHtml !== null) {
      if (process.env.NODE_ENV === "development") {
        console.warn(
          `[application-preview-html] Storage failed for "${objectPath}"; using repo fallback.`
        );
      }
      return repoHtml;
    }
    throw error;
  }

  const repoHtml = await loadFromRepo();
  if (repoHtml !== null) {
    if (process.env.NODE_ENV === "development") {
      console.warn(
        `[application-preview-html] Storage object missing for "${objectPath}"; using repo fallback.`
      );
    }
    return repoHtml;
  }

  return loadFromStorage();
}

function createTemplateSupabaseClient(authorizationToken?: string | null): SupabaseClient {
  return createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: authorizationToken
        ? { Authorization: `Bearer ${authorizationToken}` }
        : {},
    },
  });
}

async function downloadGlobalTemplateHtml(opts: {
  supabase: SupabaseClient;
  templateType: TemplateType;
  /** When `acceptance`, loads the type-specific `*_acceptance.html` template. */
  letterVariant?: "appointment" | "acceptance";
}): Promise<string | null> {
  let objectPath = TEMPLATE_PATH_MAP[opts.templateType]?.trim() || "";
  if (opts.letterVariant === "acceptance") {
    const acceptancePath = ACCEPTANCE_TEMPLATE_PATH_MAP[opts.templateType];
    if (acceptancePath) objectPath = acceptancePath;
  }
  if (!objectPath) return null;

  return loadApplicationTemplateHtml(opts.supabase, objectPath, {
    templateType: opts.templateType,
    letterVariant: opts.letterVariant,
  });
}

export async function POST(request: NextRequest) {
  try {
    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.json(
        { error: "Supabase environment variables are missing on server." },
        { status: 500 }
      );
    }

    const body = (await request.json()) as {
      templateType?: TemplateType;
      fields?: Record<string, string | undefined>;
      owner_debug?: unknown;
      projectId?: string;
      /** Preferred variant field — works for all types with acceptance letters. */
      letterVariant?: "appointment" | "acceptance";
      /** @deprecated Back-compat alias for `letterVariant`. */
      architectHtmlVariant?: "appointment" | "acceptance";
      /** Pre-known PDF URL for QR (e.g. deterministic Storage URL before first upload). */
      savedPdfUrlForQr?: string;
    };

    if (!body.templateType || !body.fields) {
      return NextResponse.json(
        { error: "templateType and fields are required." },
        { status: 400 }
      );
    }

    const authHeader = request.headers.get("Authorization");
    const token = authHeader?.replace("Bearer ", "").trim() || null;

    // Accept both `letterVariant` and the legacy `architectHtmlVariant`.
    const letterVariant: "appointment" | "acceptance" | undefined =
      body.letterVariant === "acceptance" || body.architectHtmlVariant === "acceptance"
        ? "acceptance"
        : undefined;

    const supabase = createTemplateSupabaseClient(token);

    let htmlTemplate = await downloadGlobalTemplateHtml({
      supabase,
      templateType: body.templateType,
      letterVariant,
    });

    const expectedPath =
      letterVariant === "acceptance"
        ? (ACCEPTANCE_TEMPLATE_PATH_MAP[body.templateType] ?? TEMPLATE_PATH_MAP[body.templateType])
        : TEMPLATE_PATH_MAP[body.templateType];

    if (!htmlTemplate) {
      return NextResponse.json(
        {
          error: `No HTML template found for "${body.templateType}". Upload "${expectedPath ?? "(unknown)"}" to Storage bucket "${TEMPLATE_BUCKET}" (or add html/${expectedPath} locally for fallback).`,
        },
        { status: 400 }
      );
    }

    const isCleanAppointmentLetter =
      letterVariant !== "acceptance" &&
      CLEAN_APPOINTMENT_HTML_TYPES.has(body.templateType);

    if (
      isCleanAppointmentLetter &&
      isLegacySubAppointmentHtml(htmlTemplate) &&
      expectedPath
    ) {
      const repoHtml = await readRepoApplicationTemplateHtml(expectedPath);
      if (repoHtml?.includes("subject-reference-table")) {
        if (process.env.NODE_ENV === "development") {
          console.warn(
            `[application-preview-html] Replaced legacy Storage "${expectedPath}" with repo template.`
          );
        }
        htmlTemplate = repoHtml;
      }
    }

    // Inject shared CSS for all templates that use the clean acceptance HTML format.
    const needsSharedCss =
      body.templateType === "Architect" ||
      isCleanAppointmentLetter ||
      (letterVariant === "acceptance" && body.templateType in ACCEPTANCE_TEMPLATE_PATH_MAP);
    let mergedHtml = htmlTemplate;
    if (needsSharedCss) {
      const sharedCss = await loadSharedArchitectApplicationCss(supabase, {
        preferBundledCss: isCleanAppointmentLetter,
      });
      mergedHtml = injectSharedApplicationTemplateStyle(htmlTemplate, sharedCss);
      if (!sharedCss.trim()) {
        console.error(
          `[application-preview-html] Missing shared CSS in Storage (${SHARED_CSS_STORAGE_PATH}) and repo html/_shared/ — letters will render unstyled.`
        );
      }
    }

    let fieldsForTemplate = body.fields;
    if (letterVariant !== "acceptance" && body.projectId?.trim() && token) {
      fieldsForTemplate = await enrichConsultantAppointmentFields(body.fields, {
        projectId: body.projectId.trim(),
        token,
        templateType: body.templateType,
      });
    }

    let finalHtml = removeEmptyAddressParagraphs(
      mergeBuildingProposalOfficerZoneParagraphs(
        replaceTemplateTokens(mergedHtml, fieldsForTemplate)
      )
    );

    const acceptanceUrlsKey =
      letterVariant === "acceptance"
        ? ACCEPTANCE_APPLICATION_URL_KEY_MAP[body.templateType]
        : undefined;

    finalHtml = await injectSavedPdfQrHtml(finalHtml, {
      projectId: body.projectId,
      templateType: body.templateType,
      authorizationToken: token,
      applicationUrlsKey: acceptanceUrlsKey,
      savedPdfUrlForQr: body.savedPdfUrlForQr,
    });

    if (process.env.NODE_ENV === "development") {
      console.log("[application-preview-html] owner/company debug", {
        project_Client_Company_Name: body.fields["project_Client_Company_Name"] ?? "",
        project_Client_Name: body.fields["project_Client_Name"] ?? "",
        project_Name_Architect_LS: body.fields["project_Name_Architect/L.S"] ?? "",
        owner_debug: body.owner_debug ?? null,
      });
      if (body.templateType === "Fire Safety Consultant") {
        console.log("[application-preview-html] fire token debug", {
          project_Name_Fire_Safety: body.fields["project_Name_Fire_Safety."] ?? "",
          project_Address_line1_Fire_Safety:
            body.fields["project_Address_line1_Fire_Safety"] ?? "",
          project_Address_line2_Fire_Safety:
            body.fields["project_Address_line2_Fire_Safety"] ?? "",
          project_Address_line3_Fire_Safety:
            body.fields["project_Address_line3_Fire_Safety"] ?? "",
          project_Name_Architect: body.fields["project_Name_Architect."] ?? "",
          project_Address_line1_Architect:
            body.fields["project_Address_line1_Architect"] ?? "",
          project_Address_line2_Architect:
            body.fields["project_Address_line2_Architect"] ?? "",
          project_Address_line3Architect:
            body.fields["project_Address_line3Architect"] ?? "",
        });
      }
    }

    // Return the populated HTML; the client converts it to PDF using html2pdf.js
    // (no server-side Chromium / Puppeteer needed).
    return new NextResponse(finalHtml, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store, no-cache, must-revalidate",
      },
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : typeof error === "string"
          ? error
          : "Failed to render HTML preview.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
