import { NextRequest, NextResponse } from "next/server";
import {
  classifyAndValidateDocumentFile,
  isDocumentType,
  isSupportedDocumentMediaType,
  type DocumentType,
} from "@/app/lib/documentValidation";

export const runtime = "nodejs";
export const maxDuration = 60;

function parseAllowedTypes(raw: string): DocumentType[] {
  const trimmed = raw.trim();
  if (!trimmed) return [];

  let parts: string[] = [];
  if (trimmed.startsWith("[")) {
    try {
      const parsed = JSON.parse(trimmed) as unknown;
      if (Array.isArray(parsed)) {
        parts = parsed.map((v) => String(v));
      }
    } catch {
      parts = [];
    }
  } else {
    parts = trimmed.split(",").map((s) => s.trim()).filter(Boolean);
  }

  return parts.filter(isDocumentType);
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file");
    const allowedTypesRaw =
      typeof formData.get("allowedTypes") === "string"
        ? String(formData.get("allowedTypes"))
        : "";

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    const mediaType = file.type || "application/octet-stream";
    if (!isSupportedDocumentMediaType(mediaType)) {
      return NextResponse.json(
        {
          error:
            "Please upload a valid PDF or image file (JPEG, PNG, or WebP).",
        },
        { status: 400 }
      );
    }

    const allowedTypes = parseAllowedTypes(allowedTypesRaw);
    if (allowedTypes.length === 0) {
      return NextResponse.json(
        {
          error:
            'Missing or invalid allowedTypes. Pass a comma-separated list or JSON array of document type ids (e.g. "aadhaar,pan,technical-person-license").',
        },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const result = await classifyAndValidateDocumentFile(
      buffer,
      allowedTypes,
      mediaType
    );

    return NextResponse.json(result);
  } catch (error: unknown) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to classify and validate document";
    console.error("[classify-and-validate-document]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
