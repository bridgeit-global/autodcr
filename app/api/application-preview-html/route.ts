import { NextRequest, NextResponse } from "next/server";
import type { TemplateType } from "@/app/templates/templateGenerators";
import { createClient } from "@supabase/supabase-js";

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
    if (raw === undefined) continue;
    const token = key.startsWith("$") ? key : `$${key}`;
    const escaped = escapeHtml(raw);
    // First try fast exact replacement.
    out = out.split(token).join(escaped);
    // Then replace whitespace-variant tokens often produced by Word HTML exports.
    const whitespaceTolerantTokenRegex = new RegExp(
      escapeRegex(token).replace(/\\ /g, "\\s+"),
      "g"
    );
    out = out.replace(whitespaceTolerantTokenRegex, escaped);
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

    const finalHtml = replaceTemplateTokens(htmlTemplate, body.fields);

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
