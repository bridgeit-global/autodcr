import { NextRequest, NextResponse } from "next/server";
import {
  resolveDocumentType,
  validateDocumentPdf,
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

    if (file.type !== "application/pdf") {
      return NextResponse.json(
        { error: "Please upload a valid PDF file" },
        { status: 400 }
      );
    }

    const documentType: DocumentType | null =
      (documentTypeParam as DocumentType) ||
      (applicationType ? resolveDocumentType(applicationType) : null);

    if (!documentType) {
      return NextResponse.json(
        {
          error:
            applicationType
              ? `Bot validation is not yet available for "${applicationType}". Currently supported: Appointment Letter for Architect.`
              : "Missing applicationType or documentType.",
        },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const result = await validateDocumentPdf(buffer, documentType);

    return NextResponse.json(result);
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Failed to validate document";
    console.error("[validate-document]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
