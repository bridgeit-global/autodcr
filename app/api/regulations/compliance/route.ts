import { NextRequest, NextResponse } from "next/server";
import {
  MAX_PROPOSAL_FILES,
  joinExtractedDocuments,
} from "@/app/lib/regulationsRag/chatStore";
import { analyzeCompliance } from "@/app/lib/regulationsRag/compliance";
import {
  assertApiKey,
  assertPinecone,
  getConfig,
  ragErrorStatus,
} from "@/app/lib/regulationsRag/config";
import { extractPdf } from "@/app/lib/regulationsRag/pdf";
import { normalizeAuthorities } from "@/app/lib/regulationsRag/regulations";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(req: NextRequest) {
  try {
    assertApiKey();
    assertPinecone();

    const formData = await req.formData();
    const uploaded = formData
      .getAll("proposal")
      .filter((item): item is File => item instanceof File && item.size > 0);
    if (!uploaded.length) {
      return NextResponse.json(
        { error: "Upload a proposal PDF as 'proposal'." },
        { status: 400 }
      );
    }
    if (uploaded.length > MAX_PROPOSAL_FILES) {
      return NextResponse.json(
        { error: `You can upload up to ${MAX_PROPOSAL_FILES} PDFs at a time.` },
        { status: 400 }
      );
    }

    const config = getConfig();
    const maxBytes = config.uploadMaxMb * 1024 * 1024;
    const parts: { filename: string; text: string; pages: number }[] = [];
    for (const file of uploaded) {
      const filename = file.name || "proposal.pdf";
      const mime = file.type || "";
      if (mime !== "application/pdf" && !filename.toLowerCase().endsWith(".pdf")) {
        return NextResponse.json(
          { error: `Only PDF proposals are supported (${filename}).` },
          { status: 400 }
        );
      }
      if (file.size > maxBytes) {
        return NextResponse.json(
          { error: `${filename} must be under ${config.uploadMaxMb} MB.` },
          { status: 400 }
        );
      }
      const extracted = await extractPdf(Buffer.from(await file.arrayBuffer()));
      const text = extracted.text.trim();
      if (!text) {
        return NextResponse.json(
          {
            error: `Could not extract text from ${filename}. Scanned/image-only PDFs need OCR (not supported yet).`,
          },
          { status: 400 }
        );
      }
      parts.push({ filename, text, pages: extracted.pages });
    }

    const combined = joinExtractedDocuments(parts);
    const authorities = normalizeAuthorities(
      formData.get("authorities") ?? formData.get("authority")
    );
    const notes = String(formData.get("notes") || "").trim();

    const result = await analyzeCompliance({
      proposalText: combined.text,
      filename: combined.filename,
      pages: combined.pages,
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
