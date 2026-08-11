import { NextRequest, NextResponse } from "next/server";
import {
  isSupportedDocumentMediaType,
  listDocumentTypes,
  resolveDocumentType,
  validateDocumentFile,
  type DocumentType,
} from "@/app/lib/documentValidation";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file");
    const applicationType =
      typeof formData.get("applicationType") === "string"
        ? String(formData.get("applicationType"))
        : "";
    const documentTypeParam =
      typeof formData.get("documentType") === "string"
        ? String(formData.get("documentType"))
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

    const documentType: DocumentType | null = resolveDocumentType({
      documentType: documentTypeParam || undefined,
      applicationType: applicationType || undefined,
    });

    if (!documentType) {
      const supported = listDocumentTypes().join(", ");
      const error = documentTypeParam
        ? `Unknown documentType "${documentTypeParam}". Supported: ${supported || "(none)"}.`
        : applicationType
          ? `Bot validation for "${applicationType}" requires an explicit documentType (supported: ${supported || "(none)"}).`
          : "Missing applicationType or documentType.";

      return NextResponse.json({ error }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const result = await validateDocumentFile(buffer, documentType, mediaType);

    return NextResponse.json(result);
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Failed to validate document";
    console.error("[validate-document]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
