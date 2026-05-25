import { NextRequest, NextResponse } from "next/server";
import { getPdfSignatureInfo } from "@/app/utils/pdfSignatureCheck";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    if (file.type !== "application/pdf") {
      return NextResponse.json({ error: "Please upload a valid PDF file" }, { status: 400 });
    }

    const bytes = new Uint8Array(await file.arrayBuffer());
    const info = getPdfSignatureInfo(bytes);

    return NextResponse.json(info);
  } catch {
    return NextResponse.json({ error: "Failed to process PDF" }, { status: 500 });
  }
}
