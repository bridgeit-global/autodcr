/**
 * DOCX placeholder replacement + PDF conversion.
 *
 * Vercel cannot run LibreOffice inside serverless functions. Production setup:
 * - Deploy Gotenberg (or any LibreOffice headless service) on Docker/VPS/free-tier host.
 * - Set DOCX_CONVERTER_URL to the convert endpoint (e.g. .../forms/libreoffice/convert).
 * - Set DOCX_CONVERTER_MODE=gotenberg when using Gotenberg.
 *
 * Local dev: if DOCX_CONVERTER_URL is unset, falls back to `soffice` when installed.
 *
 * Speed: identical template+fields are cached in-memory (default TTL 180000 ms). Optional env:
 * APPLICATION_PREVIEW_CACHE_TTL_MS, APPLICATION_PREVIEW_CACHE_MAX_ENTRIES, DOCX_CONVERTER_TIMEOUT_MS.
 */
import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import os from "os";
import { execFile } from "child_process";
import { promisify } from "util";
import { createHash } from "crypto";
import PizZip from "pizzip";
import { convertDocxToPdf as convertDocxToPdfViaPackage } from "docx-pdf-converter";
import type { TemplateType } from "@/app/templates/templateGenerators";
import { enrichPreviewDocxFields } from "@/app/utils/enrichPreviewDocxFields";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** In-process cache: same inputs → skip LibreOffice/Gotenberg (repeat preview, warm lambda). TTL in ms. */
const PREVIEW_CACHE_TTL_MS = Math.max(
  0,
  Number.parseInt(process.env.APPLICATION_PREVIEW_CACHE_TTL_MS || "180000", 10) || 180000
);
const PREVIEW_CACHE_MAX_ENTRIES = Math.max(
  4,
  Math.min(200, Number.parseInt(process.env.APPLICATION_PREVIEW_CACHE_MAX_ENTRIES || "40", 10) || 40)
);

type CacheEntry = { expires: number; pdf: Buffer };
const pdfResultCache = new Map<string, CacheEntry>();
const templateBufferCache = new Map<TemplateType, Buffer>();

function stableSerializeFields(fields: Record<string, string | undefined>): string {
  const keys = Object.keys(fields).sort();
  const obj: Record<string, string | undefined> = {};
  keys.forEach((k) => {
    obj[k] = fields[k];
  });
  return JSON.stringify(obj);
}

function previewCacheKey(templateType: string, fields: Record<string, string | undefined>): string {
  return createHash("sha256").update(templateType).update("\0").update(stableSerializeFields(fields)).digest("hex");
}

function getCachedPdf(key: string): Buffer | null {
  if (PREVIEW_CACHE_TTL_MS <= 0) return null;
  const entry = pdfResultCache.get(key);
  if (!entry || Date.now() > entry.expires) {
    if (entry) pdfResultCache.delete(key);
    return null;
  }
  return entry.pdf;
}

function setCachedPdf(key: string, pdf: Buffer): void {
  if (PREVIEW_CACHE_TTL_MS <= 0) return;
  while (pdfResultCache.size >= PREVIEW_CACHE_MAX_ENTRIES) {
    const first = pdfResultCache.keys().next().value;
    if (first !== undefined) pdfResultCache.delete(first);
    else break;
  }
  pdfResultCache.set(key, {
    expires: Date.now() + PREVIEW_CACHE_TTL_MS,
    pdf: Buffer.from(pdf),
  });
}

const execFileAsync = promisify(execFile);
const DOCX_MIME =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

const TEMPLATE_DOCX_MAP: Record<TemplateType, string> = {
  Architect: "appointment letter (Architect Licensed Surveyor).docx",
  "Licensed Surveyor": "appointment letter (Architect Licensed Surveyor).docx",
  "Structural Engineer": "appointment letter (Structural Engineer).docx",
  "Fire Safety Consultant": "appointment letter (Fire Safety Consultant).docx",
  "M&E Consultant": "appointment letter (M&E Consultant).docx",
  Plumber: "appointment letter (Plumber).docx",
  "Parking Consultant": "appointment letter (Parking Consultant).docx",
  "Rainwater Consultant": "appointment letter (Rainwater Consultant).docx",
  "Site Supervisor": "appointment letter (Site Supervisor).docx",
  Horticulturist: "appointment letter (Horticulturist).docx",
  "Landscape Consultant": "appointment letter (Architect Licensed Surveyor).docx",
  "Geotechnical Consultant": "appointment letter (Architect Licensed Surveyor).docx",
  "Environmental Consultant": "appointment letter (Architect Licensed Surveyor).docx",
  "Town Planner": "appointment letter (Architect Licensed Surveyor).docx",
  "PMC / Project Manager": "appointment letter (Architect Licensed Surveyor).docx",
};

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function buildSplitTokenRegex(token: string): RegExp {
  const betweenChars = "(?:<[^>]+>)*";
  const chars = token.split("");
  const pattern = chars
    .map((ch, idx) =>
      idx < chars.length - 1 ? `${escapeRegExp(ch)}${betweenChars}` : escapeRegExp(ch)
    )
    .join("");
  return new RegExp(pattern, "g");
}

function normalizeReplacements(
  fields: Record<string, string | undefined>
): Array<{ token: string; value: string }> {
  return Object.entries(fields)
    .filter(([, value]) => value !== undefined)
    .map(([key, value]) => {
      const token = key.startsWith("$") ? key : `$${key}`;
      return { token, value: escapeXml(value ?? "") };
    });
}

/** Hard-coded label "Architect/L.S." in body/subject lines → "Architect" for this template only. */
function applyArchitectLetterStaticLabels(xml: string): string {
  return xml
    .replace(/<w:t([^>]*)>Architect\/L\.S\.<\/w:t>/gi, "<w:t$1>Architect</w:t>")
    .replace(/<w:t([^>]*)>Architect\/L\.S<\/w:t>/gi, "<w:t$1>Architect</w:t>");
}

/** Same Word-run pattern as architect path, but emit "Licensed Surveyor" for the shared DOCX. */
function applyLicensedSurveyorLetterStaticLabels(xml: string): string {
  return xml
    .replace(/<w:t([^>]*)>Architect\/L\.S\.<\/w:t>/gi, "<w:t$1>Licensed Surveyor</w:t>")
    .replace(/<w:t([^>]*)>Architect\/L\.S<\/w:t>/gi, "<w:t$1>Licensed Surveyor</w:t>");
}

function replaceInDocxXml(
  docxBuffer: Buffer,
  fields: Record<string, string | undefined>,
  templateType: TemplateType
): Buffer {
  const zip = new PizZip(docxBuffer);
  const replacements = normalizeReplacements(fields);
  const xmlFiles = Object.keys(zip.files).filter(
    (fileName) =>
      fileName.startsWith("word/") &&
      fileName.endsWith(".xml") &&
      !zip.files[fileName].dir
  );

  xmlFiles.forEach((fileName) => {
    const file = zip.file(fileName);
    if (!file) return;
    let xml = file.asText();

    replacements.forEach(({ token, value }) => {
      // Direct replacement for contiguous placeholders.
      if (xml.includes(token)) {
        xml = xml.split(token).join(value);
        return;
      }
      // Fallback replacement for placeholders split across Word XML runs.
      const splitTokenRegex = buildSplitTokenRegex(token);
      xml = xml.replace(splitTokenRegex, value);
    });

    if (templateType === "Architect") {
      xml = applyArchitectLetterStaticLabels(xml);
    } else if (templateType === "Licensed Surveyor") {
      xml = applyLicensedSurveyorLetterStaticLabels(xml);
    }

    zip.file(fileName, xml);
  });

  return zip.generate({ type: "nodebuffer", compression: "DEFLATE" });
}

async function resolveOfficeBinary(): Promise<string | null> {
  for (const candidate of ["soffice", "libreoffice"]) {
    try {
      await execFileAsync(candidate, ["--version"], { timeout: 5000 });
      return candidate;
    } catch {
      // Try next binary name.
    }
  }
  return null;
}

async function convertDocxToPdfWithLibreOffice(docxPath: string, outDir: string): Promise<string> {
  const officeBinary = await resolveOfficeBinary();
  if (!officeBinary) {
    throw new Error(
      "LibreOffice is not installed on the server. Install it to enable DOCX to PDF preview generation."
    );
  }

  await execFileAsync(
    officeBinary,
    [
      "--headless",
      "--norestore",
      "--nologo",
      "--nolockcheck",
      "--convert-to",
      "pdf:writer_pdf_Export",
      "--outdir",
      outDir,
      docxPath,
    ],
    { timeout: 120000 }
  );

  const pdfPath = path.join(
    outDir,
    `${path.basename(docxPath, path.extname(docxPath))}.pdf`
  );
  await fs.access(pdfPath);
  return pdfPath;
}

type DocxPdfConverterResult = {
  buffer: ArrayBuffer | Uint8Array | Buffer;
};

function toPdfBuffer(result: DocxPdfConverterResult): Buffer {
  const out = result.buffer;
  if (Buffer.isBuffer(out)) return out;
  if (out instanceof Uint8Array) return Buffer.from(out);
  return Buffer.from(out);
}

async function convertWithDocxPdfConverter(
  docxBuffer: Buffer,
  fileName = "application-preview-output.docx"
): Promise<Buffer> {
  const result = (await convertDocxToPdfViaPackage(
    docxBuffer,
    fileName
  )) as DocxPdfConverterResult;
  return toPdfBuffer(result);
}

type ConverterMode = "raw" | "gotenberg";

function getExternalConverterUrl(): string | null {
  const url = process.env.DOCX_CONVERTER_URL?.trim();
  return url || null;
}

function getExternalConverterMode(url: string): ConverterMode {
  const configured = process.env.DOCX_CONVERTER_MODE?.trim().toLowerCase();
  if (configured === "raw" || configured === "gotenberg") return configured;
  if (url.includes("/forms/libreoffice/convert")) return "gotenberg";
  return "raw";
}

function getExternalAuthHeaders(): Record<string, string> {
  const token = process.env.DOCX_CONVERTER_BEARER_TOKEN?.trim();
  if (!token) return {};
  return { Authorization: `Bearer ${token}` };
}

const EXTERNAL_CONVERT_MS = Math.max(
  15000,
  Number.parseInt(process.env.DOCX_CONVERTER_TIMEOUT_MS || "90000", 10) || 90000
);

async function convertWithExternalService(
  docxBuffer: Buffer,
  fileName: string
): Promise<Buffer> {
  const url = getExternalConverterUrl();
  if (!url) throw new Error("DOCX_CONVERTER_URL is not configured.");

  const mode = getExternalConverterMode(url);
  const authHeaders = getExternalAuthHeaders();
  const abortSignal = AbortSignal.timeout(EXTERNAL_CONVERT_MS);
  let response: Response;

  if (mode === "gotenberg") {
    const form = new FormData();
    const docxBytes = new Uint8Array(docxBuffer);
    form.append("files", new Blob([docxBytes], { type: DOCX_MIME }), fileName);
    response = await fetch(url, {
      method: "POST",
      headers: authHeaders,
      body: form,
      signal: abortSignal,
    });
  } else {
    response = await fetch(url, {
      method: "POST",
      headers: {
        ...authHeaders,
        "Content-Type": DOCX_MIME,
        Accept: "application/pdf",
      },
      body: new Uint8Array(docxBuffer),
      signal: abortSignal,
    });
  }

  if (!response.ok) {
    const message = await response.text().catch(() => "");
    throw new Error(
      `External DOCX converter failed (${response.status}). ${message.slice(0, 300)}`
    );
  }

  const pdfBytes = await response.arrayBuffer();
  return Buffer.from(pdfBytes);
}

export async function POST(request: NextRequest) {
  let tempDir = "";
  try {
    const body = (await request.json()) as {
      templateType?: TemplateType;
      fields?: Record<string, string | undefined>;
      access_token?: string;
      consultant_lookup_user_ids?: string[];
    };

    const templateType = body.templateType;
    const fields: Record<string, string | undefined> = { ...(body.fields || {}) };

    if (!templateType || !body.fields) {
      return NextResponse.json(
        { error: "templateType and fields are required." },
        { status: 400 }
      );
    }

    const token = body.access_token?.trim();
    const consultantLookupIds = Array.isArray(body.consultant_lookup_user_ids)
      ? body.consultant_lookup_user_ids.map((s) => String(s).trim()).filter(Boolean)
      : [];
    const resolveOpts =
      consultantLookupIds.length > 0 ? { lookupUserIds: consultantLookupIds } : undefined;

    if (token) {
      await enrichPreviewDocxFields(fields, token, resolveOpts, templateType);
    }

    const templateFileName = TEMPLATE_DOCX_MAP[templateType];
    if (!templateFileName) {
      return NextResponse.json({ error: "Unsupported template type." }, { status: 400 });
    }

    const cacheKey = previewCacheKey(templateType, fields);
    const cached = getCachedPdf(cacheKey);
    if (cached) {
      return new NextResponse(new Uint8Array(cached), {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": 'inline; filename="application-preview.pdf"',
          "Cache-Control": "private, max-age=120",
          "X-Preview-Cache": "hit",
        },
      });
    }

    let templateBuffer = templateBufferCache.get(templateType);
    if (!templateBuffer) {
      const templatePath = path.join(process.cwd(), templateFileName);
      templateBuffer = await fs.readFile(templatePath);
      templateBufferCache.set(templateType, templateBuffer);
    }

    const replacedDocx = replaceInDocxXml(templateBuffer, fields, templateType);

    let packageConverterError: unknown;
    try {
      const pdfBuffer = await convertWithDocxPdfConverter(
        replacedDocx,
        "application-preview-output.docx"
      );
      setCachedPdf(cacheKey, pdfBuffer);
      return new NextResponse(new Uint8Array(pdfBuffer), {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": 'inline; filename="application-preview.pdf"',
          "Cache-Control": "private, max-age=120",
          "X-Preview-Cache": "miss",
        },
      });
    } catch (pkgError) {
      packageConverterError = pkgError;
      console.warn("docx-pdf-converter failed, falling back:", pkgError);
    }

    const externalConverterUrl = getExternalConverterUrl();
    if (externalConverterUrl) {
      const pdfBuffer = await convertWithExternalService(
        replacedDocx,
        "application-preview-output.docx"
      );
      setCachedPdf(cacheKey, pdfBuffer);
      return new NextResponse(new Uint8Array(pdfBuffer), {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": 'inline; filename="application-preview.pdf"',
          "Cache-Control": "private, max-age=120",
          "X-Preview-Cache": "miss",
        },
      });
    }

    if (process.env.VERCEL && packageConverterError) {
      const packageMessage =
        packageConverterError instanceof Error
          ? packageConverterError.message
          : "docx-pdf-converter failed on Vercel runtime.";
      throw new Error(
        `${packageMessage} Configure DOCX_CONVERTER_URL (and optionally DOCX_CONVERTER_MODE=gotenberg) as fallback on Vercel.`
      );
    }

    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "application-preview-"));
    const outputDocxPath = path.join(tempDir, "application-preview-output.docx");
    await fs.writeFile(outputDocxPath, replacedDocx);

    const outputPdfPath = await convertDocxToPdfWithLibreOffice(outputDocxPath, tempDir);
    const pdfBuffer = await fs.readFile(outputPdfPath);
    setCachedPdf(cacheKey, pdfBuffer);

    return new NextResponse(new Uint8Array(pdfBuffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": 'inline; filename="application-preview.pdf"',
        "Cache-Control": "private, max-age=120",
        "X-Preview-Cache": "miss",
      },
    });
  } catch (error) {
    console.error("application-preview-docx failed:", error);
    const fallbackHint =
      " On Vercel, set DOCX_CONVERTER_URL (and optionally DOCX_CONVERTER_MODE=gotenberg) to use an external DOCX->PDF converter.";
    const message = error instanceof Error
      ? `${error.message}${error.message.includes("DOCX_CONVERTER_URL") ? "" : fallbackHint}`
      : `Failed to generate application preview PDF.${fallbackHint}`;
    return NextResponse.json({ error: message }, { status: 500 });
  } finally {
    if (tempDir) {
      await fs.rm(tempDir, { recursive: true, force: true }).catch(() => undefined);
    }
  }
}
