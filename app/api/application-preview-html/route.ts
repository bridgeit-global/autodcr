import { NextRequest, NextResponse } from "next/server";
import type { TemplateType } from "@/app/templates/templateGenerators";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  "https://mgxbetsxswaislwhtygw.supabase.co";
const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1neGJldHN4c3dhaXNsd2h0eWd3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ2NzcwNjksImV4cCI6MjA4MDI1MzA2OX0.tJPN5_q4EMrQHjAZpGT4_NSzxIvLMyLiotjbkTltavs";

const TEMPLATE_BUCKET =
  process.env.SUPABASE_TEMPLATE_BUCKET?.trim() ||
  process.env.NEXT_PUBLIC_TEMPLATE_BUCKET?.trim() ||
  "consultant-documents";

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
  for (const [key, raw] of Object.entries(fields)) {
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

async function downloadProjectTemplateHtml(opts: {
  projectId: string;
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

  const { data: project, error } = await supabase
    .from("projects")
    .select("owner_html_templates")
    .eq("id", opts.projectId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!project) return null;

  const map = (project as { owner_html_templates?: unknown }).owner_html_templates;
  if (!map || typeof map !== "object") return null;

  const raw = (map as Record<string, unknown>)[opts.templateType];
  const objectPath = typeof raw === "string" ? raw.trim() : "";
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

    let htmlTemplate: string | null = null;
    if (typeof body.projectId === "string" && body.projectId.trim()) {
      htmlTemplate = await downloadProjectTemplateHtml({
        projectId: body.projectId.trim(),
        templateType: body.templateType,
        authorizationToken: token,
      });
    }

    if (!htmlTemplate) {
      return NextResponse.json(
        { error: `No owner HTML template configured for "${body.templateType}".` },
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
