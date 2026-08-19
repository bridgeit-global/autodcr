import { NextRequest, NextResponse } from "next/server";
import { analyzeCompliance } from "@/app/lib/regulationsRag/compliance";
import {
  assertApiKey,
  assertPinecone,
  getConfig,
  ragErrorStatus,
} from "@/app/lib/regulationsRag/config";
import { normalizeAuthorities } from "@/app/lib/regulationsRag/regulations";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(req: NextRequest) {
  try {
    assertApiKey();
    assertPinecone();

    const formData = await req.formData();
    const file = formData.get("proposal");
    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: "Upload a proposal PDF as 'proposal'." },
        { status: 400 }
      );
    }

    const filename = file.name || "proposal.pdf";
    const mime = file.type || "";
    if (
      mime !== "application/pdf" &&
      !filename.toLowerCase().endsWith(".pdf")
    ) {
      return NextResponse.json(
        { error: "Only PDF proposals are supported." },
        { status: 400 }
      );
    }

    const config = getConfig();
    const maxBytes = config.uploadMaxMb * 1024 * 1024;
    if (file.size > maxBytes) {
      return NextResponse.json(
        { error: `Proposal PDF must be under ${config.uploadMaxMb} MB.` },
        { status: 400 }
      );
    }

    const authorities = normalizeAuthorities(
      formData.get("authorities") ?? formData.get("authority")
    );
    const notes = String(formData.get("notes") || "").trim();
    const pdfBuffer = Buffer.from(await file.arrayBuffer());

    const result = await analyzeCompliance({
      pdfBuffer,
      filename,
      authoritiesOverride: authorities.length ? authorities : null,
      notes,
    });
    return NextResponse.json(result);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Compliance analysis failed";
    console.error("[regulations/compliance]", message);
    return NextResponse.json(
      { error: message },
      {
        status: ragErrorStatus(
          err,
          /Only PDF|extract text|No indexed|under \d+ MB/i
        ),
      }
    );
  }
}
