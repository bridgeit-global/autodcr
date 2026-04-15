import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import os from "os";
import { execFile } from "child_process";
import { promisify } from "util";
import PizZip from "pizzip";
import type { TemplateType } from "@/app/templates/templateGenerators";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const execFileAsync = promisify(execFile);
const DOCX_MIME =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

const TEMPLATE_DOCX_MAP: Record<TemplateType, string> = {
  "Architect Licensed Surveyor": "appointment letter (Architect Licensed Surveyor).docx",
  "Structural Engineer": "appointment letter (Structural Engineer).docx",
  "Fire Safety Consultant": "appointment letter (Fire Safety Consultant).docx",
  "M&E Consultant": "appointment letter (M&E Consultant).docx",
  Plumber: "appointment letter (Plumber).docx",
  "Parking Consultant": "appointment letter (Parking Consultant).docx",
  "Rainwater Consultant": "appointment letter (Rainwater Consultant).docx",
  "Site Supervisor": "appointment letter (Site Supervisor).docx",
  Horticulturist: "appointment letter (Horticulturist).docx",
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

function replaceInDocxXml(docxBuffer: Buffer, fields: Record<string, string | undefined>): Buffer {
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

async function convertDocxToPdf(docxPath: string, outDir: string): Promise<string> {
  const officeBinary = await resolveOfficeBinary();
  if (!officeBinary) {
    throw new Error(
      "LibreOffice is not installed on the server. Install it to enable DOCX to PDF preview generation."
    );
  }

  await execFileAsync(
    officeBinary,
    ["--headless", "--convert-to", "pdf:writer_pdf_Export", "--outdir", outDir, docxPath],
    { timeout: 120000 }
  );

  const pdfPath = path.join(
    outDir,
    `${path.basename(docxPath, path.extname(docxPath))}.pdf`
  );
  await fs.access(pdfPath);
  return pdfPath;
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

async function convertWithExternalService(
  docxBuffer: Buffer,
  fileName: string
): Promise<Buffer> {
  const url = getExternalConverterUrl();
  if (!url) throw new Error("DOCX_CONVERTER_URL is not configured.");

  const mode = getExternalConverterMode(url);
  const authHeaders = getExternalAuthHeaders();
  let response: Response;

  if (mode === "gotenberg") {
    const form = new FormData();
    form.append("files", new Blob([docxBuffer], { type: DOCX_MIME }), fileName);
    response = await fetch(url, {
      method: "POST",
      headers: authHeaders,
      body: form,
    });
  } else {
    response = await fetch(url, {
      method: "POST",
      headers: {
        ...authHeaders,
        "Content-Type": DOCX_MIME,
        Accept: "application/pdf",
      },
      body: docxBuffer,
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
    };

    const templateType = body.templateType;
    const fields = body.fields;

    if (!templateType || !fields) {
      return NextResponse.json(
        { error: "templateType and fields are required." },
        { status: 400 }
      );
    }

    const templateFileName = TEMPLATE_DOCX_MAP[templateType];
    if (!templateFileName) {
      return NextResponse.json({ error: "Unsupported template type." }, { status: 400 });
    }

    const templatePath = path.join(process.cwd(), templateFileName);
    const templateBuffer = await fs.readFile(templatePath);
    const replacedDocx = replaceInDocxXml(templateBuffer, fields);

    const externalConverterUrl = getExternalConverterUrl();
    if (externalConverterUrl) {
      const pdfBuffer = await convertWithExternalService(
        replacedDocx,
        "application-preview-output.docx"
      );
      return new NextResponse(pdfBuffer, {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": 'inline; filename="application-preview.pdf"',
          "Cache-Control": "no-store",
        },
      });
    }

    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "application-preview-"));
    const outputDocxPath = path.join(tempDir, "application-preview-output.docx");
    await fs.writeFile(outputDocxPath, replacedDocx);

    const outputPdfPath = await convertDocxToPdf(outputDocxPath, tempDir);
    const pdfBuffer = await fs.readFile(outputPdfPath);

    return new NextResponse(pdfBuffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": 'inline; filename="application-preview.pdf"',
        "Cache-Control": "no-store",
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
