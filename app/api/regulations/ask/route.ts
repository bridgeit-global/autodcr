import { NextRequest, NextResponse } from "next/server";
import {
  assertApiKey,
  assertPinecone,
  ragErrorStatus,
} from "@/app/lib/regulationsRag/config";
import { askQuestion } from "@/app/lib/regulationsRag/rag";
import { normalizeAuthorities } from "@/app/lib/regulationsRag/regulations";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    assertApiKey();
    assertPinecone();
    const body = (await req.json()) as {
      question?: unknown;
      authorities?: unknown;
      authority?: unknown;
    };
    const authorities = normalizeAuthorities(
      body.authorities ?? body.authority
    );
    const result = await askQuestion(body.question, { authorities });
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Request failed";
    console.error("[regulations/ask]", message);
    return NextResponse.json(
      { error: message },
      { status: ragErrorStatus(err) }
    );
  }
}
