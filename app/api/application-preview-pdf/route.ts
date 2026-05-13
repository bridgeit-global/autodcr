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
    await page.setDefaultNavigationTimeout(120_000);
    await page.setDefaultTimeout(120_000);
    await page.setViewport({ width: 1240, height: 1754 });
    await page.setContent(html, PDF_CONTENT_WAIT);

    const hasPagedScript = html.includes("paged.polyfill.js");
    if (hasPagedScript) {
      // Let Paged.js (chunker + polisher) finish and paint `.pagedjs_page` boxes.
      await page.waitForSelector(".pagedjs_page", { timeout: 10000 });

      /**
       * Paged.js often leaves the **original** letter DOM in place (same wrapper as
       * `.pagedjs_pages`, or as a sibling). Removing only direct `body` children misses that.
       * Re-mount **only** `.pagedjs_pages` + stylesheets into a fresh document so Puppeteer
       * prints a single layer (fixes “two PDFs overlapping” in saved bucket objects).
       */
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
        await page.waitForSelector(".pagedjs_page", { timeout: 10_000 }).catch(() => undefined);
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

