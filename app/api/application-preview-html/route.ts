import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import type { TemplateType } from "@/app/templates/templateGenerators";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TEMPLATE_HTML_MAP: Partial<Record<TemplateType, string>> = {
  "Architect Licensed Surveyor": "appointment letter (Architect Licensed Surveyor).html",
  "Licensed Surveyor": "appointment letter (Architect Licensed Surveyor).html",
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

async function resolveHtmlTemplate(templateType: TemplateType): Promise<string> {
  const fileName = TEMPLATE_HTML_MAP[templateType];
  if (!fileName) {
    throw new Error(`No HTML template configured for "${templateType}".`);
  }

  const rootPath = path.join(process.cwd(), fileName);
  const publicPath = path.join(process.cwd(), "public", fileName);

  for (const candidate of [rootPath, publicPath]) {
    try {
      await fs.access(candidate);
      return candidate;
    } catch {
      // Try next path.
    }
  }

  throw new Error(`HTML template not found: ${fileName}`);
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      templateType?: TemplateType;
      fields?: Record<string, string | undefined>;
      owner_debug?: unknown;
    };

    if (!body.templateType || !body.fields) {
      return NextResponse.json(
        { error: "templateType and fields are required." },
        { status: 400 }
      );
    }

    const htmlPath = await resolveHtmlTemplate(body.templateType);
    const htmlTemplate = await fs.readFile(htmlPath, "utf8");
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
