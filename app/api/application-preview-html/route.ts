import { NextRequest, NextResponse } from "next/server";
import type { TemplateType } from "@/app/templates/templateGenerators";
import { createClient } from "@supabase/supabase-js";
import QRCode from "qrcode";

import { PROJECT_SAVED_PDF_QR_SENTINEL } from "./constants";

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

async function injectSavedPdfQrHtml(
  html: string,
  opts: {
    projectId?: string | null;
    templateType: TemplateType;
    authorizationToken: string | null;
  }
): Promise<string> {
  let pdfUrl: string | undefined;

  if (opts.projectId?.trim() && opts.authorizationToken) {
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: { Authorization: `Bearer ${opts.authorizationToken}` },
      },
    });

    const { data, error } = await supabase
      .from("projects")
      .select("application_urls")
      .eq("id", opts.projectId.trim())
      .maybeSingle();

    if (!error && data) {
      const raw = data.application_urls;
      if (raw && typeof raw === "object" && !Array.isArray(raw)) {
        const v = (raw as Record<string, unknown>)[opts.templateType];
        if (typeof v === "string" && v.trim()) pdfUrl = v.trim();
      }
    }
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

async function downloadGlobalTemplateHtml(opts: {
  templateType: TemplateType;
  authorizationToken?: string | null;
}): Promise<string | null> {
  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: opts.authorizationToken
        ? { Authorization: `Bearer ${opts.authorizationToken}` }
        : {},
    },
  });

  const objectPath = TEMPLATE_PATH_MAP[opts.templateType]?.trim() || "";
  if (!objectPath) return null;

  const { data: file, error: downloadError } = await supabase.storage
    .from(TEMPLATE_BUCKET)
    .download(objectPath);

  if (downloadError) throw new Error(downloadError.message);
  if (!file) return null;
  return await file.text();
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
    };

    if (!body.templateType || !body.fields) {
      return NextResponse.json(
        { error: "templateType and fields are required." },
        { status: 400 }
      );
    }

    const authHeader = request.headers.get("Authorization");
    const token = authHeader?.replace("Bearer ", "").trim() || null;

    const htmlTemplate = await downloadGlobalTemplateHtml({
      templateType: body.templateType,
      authorizationToken: token,
    });

    if (!htmlTemplate) {
      return NextResponse.json(
        {
          error: `No global HTML template found for "${body.templateType}" in bucket "${TEMPLATE_BUCKET}". Expected path: "${TEMPLATE_PATH_MAP[body.templateType]}".`,
        },
        { status: 400 }
      );
    }

    let finalHtml = replaceTemplateTokens(htmlTemplate, body.fields);
    finalHtml = await injectSavedPdfQrHtml(finalHtml, {
      projectId: body.projectId,
      templateType: body.templateType,
      authorizationToken: token,
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
    const message = error instanceof Error ? error.message : "Failed to render HTML preview.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
