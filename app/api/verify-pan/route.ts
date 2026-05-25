import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";

export async function POST(req: NextRequest) {
  try {
    const { pan, certSerialNumber } = await req.json();

    if (!pan || !certSerialNumber) {
      return NextResponse.json({ error: "PAN and certificate serial number are required" }, { status: 400 });
    }

    const panHash = createHash("sha256").update(pan.toUpperCase().trim()).digest("hex");
    const isMatch = panHash === certSerialNumber.toLowerCase().trim();

    return NextResponse.json({ isMatch, panHash });
  } catch {
    return NextResponse.json({ error: "Failed to verify PAN" }, { status: 500 });
  }
}
