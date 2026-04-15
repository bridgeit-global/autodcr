import { NextRequest, NextResponse } from "next/server";
import * as fs from "fs";
import * as path from "path";

function resolveTemplatePdfPath(templateType: string): string {
  const candidateNames =
    templateType === "Architect Licensed Surveyor"
      ? [
          "appointment letter (Architect Licensed Surveyor).pdf",
          "appointment letter (Architect Licensed Surveyor) copy.pdf",
        ]
      : [
          "appointment letter (Architect Licensed Surveyor).pdf",
          "appointment letter (Architect Licensed Surveyor) copy.pdf",
        ];

  const candidatePaths = candidateNames.flatMap((name) => [
    path.join(process.cwd(), name),
    path.join(process.cwd(), "public", name),
  ]);

  const existing = candidatePaths.find((p) => fs.existsSync(p));
  return existing || candidatePaths[0];
}

export async function GET(request: NextRequest) {
  const templateType = request.nextUrl.searchParams.get("templateType") || "";
  const filePath = resolveTemplatePdfPath(templateType);

  if (!fs.existsSync(filePath)) {
    return NextResponse.json(
      {
        error:
          "Preview template PDF not found. Ensure one of these files exists in repo root or public/: `appointment letter (Architect Licensed Surveyor).pdf` or `appointment letter (Architect Licensed Surveyor) copy.pdf`.",
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

