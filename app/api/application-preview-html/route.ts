import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import chromium from "@sparticuz/chromium";
import puppeteer from "puppeteer-core";
import type { TemplateType } from "@/app/templates/templateGenerators";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TEMPLATE_HTML_MAP: Partial<Record<TemplateType, string>> = {
  "Architect Licensed Surveyor": "appointment letter (Architect Licensed Surveyor).html",
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function replaceTemplateTokens(
  html: string,
  fields: Record<string, string | undefined>
): string {
  let out = html;
  for (const [key, raw] of Object.entries(fields)) {
    if (raw === undefined) continue;
    const token = key.startsWith("$") ? key : `$${key}`;
    out = out.split(token).join(escapeHtml(raw));
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

async function launchForPdf() {
  if (process.env.VERCEL) {
    const executablePath = await chromium.executablePath();
    return puppeteer.launch({
      args: chromium.args,
      executablePath,
      headless: true,
    });
  }

  const localChromiumPath = process.env.CHROME_EXECUTABLE_PATH?.trim();
  if (localChromiumPath) {
    return puppeteer.launch({
      executablePath: localChromiumPath,
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
  }

  const puppeteerPkg = await import("puppeteer");
  return puppeteerPkg.launch({ headless: true });
}

export async function POST(request: NextRequest) {
  let browser: Awaited<ReturnType<typeof launchForPdf>> | null = null;
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
      try {
        console.log(
          "[application-preview-html] owner/company debug full",
          JSON.stringify(body.owner_debug ?? null, null, 2)
        );
      } catch {
        // ignore
      }
    }

    browser = await launchForPdf();
    const page = await browser.newPage();
    await page.setContent(finalHtml, { waitUntil: "networkidle0" });
    const pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
      preferCSSPageSize: true,
    });

    return new NextResponse(new Uint8Array(pdfBuffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": 'inline; filename="application-preview.pdf"',
        "Cache-Control": "no-store, no-cache, must-revalidate",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to generate PDF from HTML.";
    return NextResponse.json({ error: message }, { status: 500 });
  } finally {
    if (browser) {
      await browser.close().catch(() => undefined);
    }
  }
}
