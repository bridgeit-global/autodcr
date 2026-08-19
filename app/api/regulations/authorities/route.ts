import { NextResponse } from "next/server";
import { listAuthorities } from "@/app/lib/regulationsRag/regulations";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({ authorities: listAuthorities() });
}
