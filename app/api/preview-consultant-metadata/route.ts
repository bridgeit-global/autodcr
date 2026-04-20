import { NextRequest, NextResponse } from "next/server";
import { resolveConsultantMetadata } from "@/app/utils/resolveConsultantMetadata";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      access_token?: string;
      consultant_lookup_user_ids?: string[];
    };
    const access_token = body.access_token?.trim();
    if (!access_token) {
      return NextResponse.json({ error: "access_token is required." }, { status: 400 });
    }

    const consultantLookupIds = Array.isArray(body.consultant_lookup_user_ids)
      ? body.consultant_lookup_user_ids.map((s) => String(s).trim()).filter(Boolean)
      : [];
    const resolveOpts =
      consultantLookupIds.length > 0 ? { lookupUserIds: consultantLookupIds } : undefined;

    const meta = await resolveConsultantMetadata(access_token, resolveOpts);
    if (!meta) {
      return NextResponse.json({ error: "Invalid or expired session." }, { status: 401 });
    }

    return NextResponse.json({ metadata: meta });
  } catch (err) {
    console.error("preview-consultant-metadata:", err);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}
