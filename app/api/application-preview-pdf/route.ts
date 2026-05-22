import { NextRequest, NextResponse } from "next/server";
import chromium from "@sparticuz/chromium";
import puppeteer from "puppeteer-core";
import { existsSync } from "node:fs";
import { access, mkdir, mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
/** PDF + Paged.js can exceed the default 10s on Vercel Hobby; Pro allows up to 300. */
export const maxDuration = 60;

type PdfRenderItem = {
  html?: string;
  templateType?: string;
};

type RequestBody = {
  html?: string;
  templateType?: string;
  /** Render multiple letters in one browser session (faster than separate POSTs). */
  renders?: PdfRenderItem[];
};

const isLambdaLikeRuntime = Boolean(process.env.VERCEL || process.env.AWS_REGION);

/** Puppeteer default launch timeout (30s) is too low on slow Macs / cold starts. */
const BROWSER_LAUNCH_TIMEOUT_MS = 120_000;

function localChromeCandidates(): string[] {
  const fromEnv = process.env.PUPPETEER_EXECUTABLE_PATH?.trim();
  if (process.platform === "darwin") {
    return [
      fromEnv,
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
      "/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary",
      "/Applications/Chromium.app/Contents/MacOS/Chromium",
      "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
      "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser",
    ].filter((value): value is string => Boolean(value));
  }
  return [
    fromEnv,
    "/usr/bin/google-chrome-stable",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
  ].filter((value): value is string => Boolean(value));
}

/** Where @sparticuz/chromium keeps chromium.br (must ship with the serverless bundle). */
function resolveChromiumBinDir(): string {
  const candidates = [
    path.join(process.cwd(), "node_modules/@sparticuz/chromium/bin"),
    path.join(process.cwd(), ".next/server/node_modules/@sparticuz/chromium/bin"),
  ];
  for (const dir of candidates) {
    if (existsSync(path.join(dir, "chromium.br"))) return dir;
  }
  throw new Error(
    `Chromium binaries not found (checked: ${candidates.join(", ")}). ` +
      "Ensure next.config outputFileTracingIncludes bundles @sparticuz/chromium and redeploy."
  );
}

/** One decompression at a time — parallel calls on a warm instance can cause spawn ETXTBSY. */
let serverChromiumPathPromise: Promise<string> | null = null;

async function resolveServerChromiumPath(): Promise<string> {
  if (!serverChromiumPathPromise) {
    serverChromiumPathPromise = (async () => {
      chromium.setGraphicsMode = false;
      return chromium.executablePath(resolveChromiumBinDir());
    })();
  }
  return serverChromiumPathPromise;
}

async function pickLocalExecutablePath(): Promise<string> {
  for (const candidate of localChromeCandidates()) {
    try {
      await access(candidate);
      return candidate;
    } catch {
      // try next local candidate
    }
  }

  throw new Error(
    "No Chrome/Chromium found for PDF generation. Install Google Chrome or set PUPPETEER_EXECUTABLE_PATH in .env.local to your browser executable."
  );
}

async function pickExecutablePath(): Promise<string> {
  if (isLambdaLikeRuntime) {
    return resolveServerChromiumPath();
  }
  return pickLocalExecutablePath();
}

function formatPdfRenderError(error: unknown): string {
  const msg = error instanceof Error ? error.message : String(error);
  if (/ENOSPC|no space left on device/i.test(msg)) {
    return "PDF generation failed: your disk is full. Free some space and try again.";
  }
  if (/Waiting for selector.*pagedjs_page/i.test(msg)) {
    return (
      "PDF layout timed out while preparing the letter pages. Try Save again; " +
      "if it persists, check your network (Paged.js loads from CDN) or refresh the page."
    );
  }
  if (/WS endpoint URL/i.test(msg)) {
    return (
      "PDF generation could not start the browser (timed out). " +
      "Install Google Chrome, set PUPPETEER_EXECUTABLE_PATH in .env.local if Chrome is non-standard, " +
      "and ensure you have free disk space."
    );
  }
  if (/No Chrome\/Chromium found/i.test(msg)) {
    return msg;
  }
  return msg;
}

/** Prefer workspace `.puppeteer-*` when OS temp is on a full volume. */
async function createBrowserUserDataDir(): Promise<string | undefined> {
  const bases = [
    path.join(process.cwd(), ".puppeteer-profiles"),
    os.tmpdir(),
  ];
  for (const base of bases) {
    try {
      await mkdir(base, { recursive: true });
      return await mkdtemp(path.join(base, "run-"));
    } catch {
      continue;
    }
  }
  return undefined;
}

function pickLaunchArgs(): string[] {
  if (isLambdaLikeRuntime) {
    return chromium.args;
  }
  return ["--no-sandbox", "--disable-setuid-sandbox"];
}

/** `networkidle0` often never settles (fonts/CDN keep-alives) → 30s “Navigation timeout”. */
const PDF_CONTENT_WAIT = { waitUntil: "load" as const, timeout: 120_000 };

/** Slim doc has no scripts — DOM ready is enough; fonts finish via `fonts.ready`. */
const PDF_SLIM_WAIT = { waitUntil: "domcontentloaded" as const, timeout: 120_000 };

async function waitFontsAndRasterSettle(page: import("puppeteer-core").Page): Promise<void> {
  await page.evaluate(async () => {
    try {
      await Promise.race([
        document.fonts.ready,
        new Promise<void>((r) => setTimeout(() => r(), 900)),
      ]);
    } catch {
      /* ignore */
    }
  });
  await new Promise<void>((r) => setTimeout(() => r(), 100));
}

/** Letterhead uses CSS background-image on `.pagedjs_page` — not in `document.images`; preload before print. */
async function waitCssBackgroundImagesLoaded(
  page: import("puppeteer-core").Page
): Promise<void> {
  await page.evaluate(async () => {
    const urls = new Set<string>();
    document.querySelectorAll("*").forEach((el) => {
      const bg = getComputedStyle(el).backgroundImage;
      if (!bg || bg === "none") return;
      const m = bg.match(/url\(\s*["']?([^"')]+)["']?\s*\)/);
      if (m?.[1]) urls.add(m[1].trim());
    });
    await Promise.all(
      [...urls].map(
        (src) =>
          new Promise<void>((resolve) => {
            const img = new Image();
            img.onload = () => resolve();
            img.onerror = () => resolve();
            img.src = src;
            window.setTimeout(() => resolve(), 12_000);
          })
      )
    );
  });
  await new Promise<void>((r) => setTimeout(() => r(), 200));
}

async function waitImgElementsLoaded(page: import("puppeteer-core").Page): Promise<void> {
  await page.evaluate(async () => {
    await Promise.all(
      Array.from(document.images).map(
        (img) =>
          new Promise<void>((resolve) => {
            if (img.complete && img.naturalWidth > 0) {
              resolve();
              return;
            }
            img.addEventListener("load", () => resolve(), { once: true });
            img.addEventListener("error", () => resolve(), { once: true });
            window.setTimeout(() => resolve(), 12_000);
          })
      )
    );
  });
}

async function waitNextPaintFrames(page: import("puppeteer-core").Page): Promise<void> {
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
      })
  );
}

/** One browser launch at a time — parallel saves on a full/slow disk caused spawn failures. */
let pdfRenderChain: Promise<unknown> = Promise.resolve();

export async function POST(request: NextRequest) {
  return new Promise<NextResponse>((resolve) => {
    pdfRenderChain = pdfRenderChain
      .then(() => renderPreviewPdf(request))
      .then(resolve)
      .catch((error: unknown) => {
        const message = formatPdfRenderError(error);
        resolve(NextResponse.json({ error: message }, { status: 500 }));
      });
  });
}

/** Paged.js loads from CDN and can exceed 10s; never hard-fail the whole save. */
const PAGEDJS_LAYOUT_TIMEOUT_MS = 60_000;

async function waitForLetterLayoutReady(
  page: import("puppeteer-core").Page
): Promise<"pagedjs" | "preview-sheet" | "none"> {
  try {
    await page.waitForFunction(
      () =>
        document.querySelector(".pagedjs_page") !== null ||
        document.querySelector(".preview-sheet") !== null,
      { timeout: PAGEDJS_LAYOUT_TIMEOUT_MS }
    );
  } catch {
    return "none";
  }
  const mode = await page.evaluate(() => {
    if (document.querySelector(".pagedjs_page")) return "pagedjs";
    if (document.querySelector(".preview-sheet")) return "preview-sheet";
    return "none";
  });
  return mode as "pagedjs" | "preview-sheet" | "none";
}

async function htmlToPdfBuffer(
  page: import("puppeteer-core").Page,
  html: string
): Promise<Uint8Array> {
  const pdfContentBase =
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    (process.env.VERCEL_URL?.trim() ? `https://${process.env.VERCEL_URL.trim()}` : "") ||
    "http://127.0.0.1:3000";
  await page.setContent(html, {
    ...PDF_CONTENT_WAIT,
    // Load /pagedjs/paged.polyfill.js from the running app instead of unpkg (saves 10–20s).
    url: pdfContentBase,
  } as Parameters<typeof page.setContent>[1]);

  const hasPagedScript = html.includes("paged.polyfill.js");
  if (hasPagedScript) {
    const layout = await waitForLetterLayoutReady(page);
    if (layout === "none") {
      console.warn(
        "[application-preview-pdf] Paged.js layout not ready in time; printing document as loaded."
      );
    } else if (layout === "preview-sheet") {
      // Plumber-style preview sheets — no .pagedjs_page to extract.
    } else {
    const slimHtml = await page.evaluate(() => {
      const pagesRoot = document.querySelector(".pagedjs_pages");
      if (!pagesRoot) return null;

      const headPieces: string[] = [];
      document.head.querySelectorAll('meta[charset], meta[name="viewport"]').forEach((n) => {
        headPieces.push(n.outerHTML);
      });
      document.head.querySelectorAll('link[rel="preconnect"]').forEach((n) => {
        headPieces.push(n.outerHTML);
      });
      document.head.querySelectorAll('link[rel="stylesheet"]').forEach((n) => {
        headPieces.push(n.outerHTML);
      });
      document.head.querySelectorAll("style").forEach((n) => {
        headPieces.push(n.outerHTML);
      });

      const headHtml = headPieces.join("");
      return `<!DOCTYPE html><html><head><meta charset="utf-8">${headHtml}</head><body style="margin:0;padding:0;background:#ffffff">${pagesRoot.outerHTML}</body></html>`;
    });

    if (slimHtml) {
      await page.setContent(slimHtml, PDF_SLIM_WAIT);
      await waitForLetterLayoutReady(page);
    } else {
      await page.evaluate(() => {
        const pagesRoot = document.querySelector(".pagedjs_pages");
        const body = document.body;
        if (!pagesRoot || !body) return;
        const keepTags = new Set(["SCRIPT", "STYLE", "LINK", "NOSCRIPT"]);
        Array.from(body.children).forEach((child) => {
          if (keepTags.has(child.tagName)) return;
          if (child === pagesRoot || child.contains(pagesRoot)) return;
          child.remove();
        });
        document.querySelectorAll(".WordSection1, main.page").forEach((el) => {
          if (!el.closest(".pagedjs_page")) el.remove();
        });
      });
    }
    }
  }

  await page.emulateMediaType("print");
  await waitFontsAndRasterSettle(page);
  await waitCssBackgroundImagesLoaded(page);
  await waitImgElementsLoaded(page);
  await waitNextPaintFrames(page);

  const pdf = await page.pdf({
    format: "A4",
    printBackground: true,
    preferCSSPageSize: true,
    margin: { top: "0", right: "0", bottom: "0", left: "0" },
  });
  return new Uint8Array(pdf);
}

async function withBrowser<T>(
  fn: (browser: Awaited<ReturnType<typeof puppeteer.launch>>) => Promise<T>
): Promise<T> {
  let browser: Awaited<ReturnType<typeof puppeteer.launch>> | null = null;
  let userDataDir: string | undefined;
  try {
    const executablePath = await pickExecutablePath();
    if (!isLambdaLikeRuntime) {
      userDataDir = await createBrowserUserDataDir();
    }
    const launchArgs = [...pickLaunchArgs()];
    if (userDataDir) {
      launchArgs.push(`--user-data-dir=${userDataDir}`);
    }
    browser = await puppeteer.launch({
      args: launchArgs,
      executablePath,
      timeout: BROWSER_LAUNCH_TIMEOUT_MS,
      headless: isLambdaLikeRuntime ? ("shell" as const) : true,
      ...(isLambdaLikeRuntime
        ? {
            defaultViewport: {
              width: 1240,
              height: 1754,
              deviceScaleFactor: 1,
            },
          }
        : {}),
    });
    return await fn(browser);
  } finally {
    if (browser) {
      await browser.close().catch(() => undefined);
    }
    if (userDataDir) {
      await rm(userDataDir, { recursive: true, force: true }).catch(() => undefined);
    }
  }
}

async function renderPreviewPdf(request: NextRequest): Promise<NextResponse> {
  try {
    const body = (await request.json()) as RequestBody;

    if (Array.isArray(body.renders) && body.renders.length > 0) {
      const items = body.renders.map((item) => ({
        html: typeof item.html === "string" ? item.html : "",
      }));
      if (items.some((item) => !item.html.trim())) {
        return NextResponse.json({ error: "Each render item requires non-empty html." }, { status: 400 });
      }
      if (items.length > 4) {
        return NextResponse.json({ error: "At most 4 PDFs per batch request." }, { status: 400 });
      }

      const buffers = await withBrowser(async (browser) => {
        return Promise.all(
          items.map(async (item) => {
            const page = await browser.newPage();
            try {
              await page.setDefaultNavigationTimeout(120_000);
              await page.setDefaultTimeout(120_000);
              await page.setViewport({ width: 1240, height: 1754 });
              return await htmlToPdfBuffer(page, item.html);
            } finally {
              await page.close().catch(() => undefined);
            }
          })
        );
      });

      return NextResponse.json({
        pdfs: buffers.map((buf) => Buffer.from(buf).toString("base64")),
      });
    }

    const html = typeof body.html === "string" ? body.html : "";
    if (!html.trim()) {
      return NextResponse.json({ error: "html is required." }, { status: 400 });
    }

    const pdf = await withBrowser(async (browser) => {
      const page = await browser.newPage();
      try {
        await page.setDefaultNavigationTimeout(120_000);
        await page.setDefaultTimeout(120_000);
        await page.setViewport({ width: 1240, height: 1754 });
        return await htmlToPdfBuffer(page, html);
      } finally {
        await page.close().catch(() => undefined);
      }
    });

    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    const message = formatPdfRenderError(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
