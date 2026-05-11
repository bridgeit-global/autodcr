import { NextRequest, NextResponse } from "next/server";
import chromium from "@sparticuz/chromium";
import puppeteer from "puppeteer-core";
import { access } from "node:fs/promises";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RequestBody = {
  html?: string;
  templateType?: string;
};

const LOCAL_CHROME_PATHS = [
  process.env.PUPPETEER_EXECUTABLE_PATH,
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Chromium.app/Contents/MacOS/Chromium",
].filter((value): value is string => Boolean(value));

const isLambdaLikeRuntime = Boolean(process.env.VERCEL || process.env.AWS_REGION);

async function pickExecutablePath(): Promise<string> {
  if (isLambdaLikeRuntime) {
    return chromium.executablePath();
  }

  for (const candidate of LOCAL_CHROME_PATHS) {
    try {
      await access(candidate);
      return candidate;
    } catch {
      // try next local candidate
    }
  }

  return chromium.executablePath();
}

function pickLaunchArgs(): string[] {
  if (isLambdaLikeRuntime) {
    return chromium.args;
  }
  return ["--no-sandbox", "--disable-setuid-sandbox"];
}

export async function POST(request: NextRequest) {
  let browser: Awaited<ReturnType<typeof puppeteer.launch>> | null = null;
  try {
    const body = (await request.json()) as RequestBody;
    const html = typeof body.html === "string" ? body.html : "";
    const templateType =
      typeof body.templateType === "string" ? body.templateType.trim() : "";
    if (!html.trim()) {
      return NextResponse.json({ error: "html is required." }, { status: 400 });
    }

    const executablePath = await pickExecutablePath();
    browser = await puppeteer.launch({
      args: pickLaunchArgs(),
      executablePath,
      headless: true,
    });
    const page = await browser.newPage();
    await page.setViewport({ width: 1240, height: 1754 });
    await page.setContent(html, { waitUntil: "networkidle0" });
    await page.emulateMediaType("print");
    // If this is preview-wrapped HTML (Paged.js), wait for pagination output.
    // This avoids printing pre-pagination state that causes footer/letterhead drift.
    const hasPagedScript = html.includes("paged.polyfill.js");
    if (hasPagedScript) {
      await page.waitForSelector(".pagedjs_page", { timeout: 10000 });
    }
    // Let fonts and late layout settle.
    await new Promise((resolve) => setTimeout(resolve, 450));

    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      preferCSSPageSize: true,
      margin: { top: "0", right: "0", bottom: "0", left: "0" },
    });

    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to render preview PDF.";
    return NextResponse.json({ error: message }, { status: 500 });
  } finally {
    if (browser) {
      await browser.close().catch(() => undefined);
    }
  }
}

