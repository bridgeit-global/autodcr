import { NextRequest, NextResponse } from "next/server";
import * as fs from "fs";
import * as path from "path";

function resolveTemplatePdfPath(templateType: string): string {
  // Keep simple for now: one confirmed template source, expand mapping later.
  if (templateType === "Architect Licensed Surveyor") {
    return path.join(process.cwd(), "appointment letter (Architect Licensed Surveyor).pdf");
  }
  // Fallback to same template until additional PDFs are provided/mapped.
  return path.join(process.cwd(), "appointment letter (Architect Licensed Surveyor).pdf");
}

export async function GET(request: NextRequest) {
  const templateType = request.nextUrl.searchParams.get("templateType") || "";
  const filePath = resolveTemplatePdfPath(templateType);

  if (!fs.existsSync(filePath)) {
    return NextResponse.json(
      {
        error:
          "Preview template PDF not found. Please ensure `appointment letter (Architect Licensed Surveyor).pdf` exists in workspace root.",
      },
      { status: 404 }
    );
  }

  const buffer = fs.readFileSync(filePath);
  return new NextResponse(buffer, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Cache-Control": "no-store",
    },
  });
}

