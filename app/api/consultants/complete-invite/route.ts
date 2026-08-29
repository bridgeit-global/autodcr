import { NextRequest, NextResponse } from "next/server";
import {
  COMPLETION_TOKEN_EXPIRES_META_KEY,
  COMPLETION_TOKEN_HASH_META_KEY,
} from "@/app/utils/consultantRegistrationShared";
import {
  createServiceRoleClient,
  findConsultantByCompletionToken,
} from "@/app/utils/consultantLookupServer";

function sanitizeMetadataForClient(
  metadata: Record<string, unknown>
): Record<string, unknown> {
  const sanitized = { ...metadata };
  delete sanitized[COMPLETION_TOKEN_HASH_META_KEY];
  delete sanitized[COMPLETION_TOKEN_EXPIRES_META_KEY];
  return sanitized;
}

/**
 * Validate a consultant completion invite token and return profile data.
 */
export async function GET(request: NextRequest) {
  try {
    const token = request.nextUrl.searchParams.get("token")?.trim();
    if (!token) {
      return NextResponse.json(
        { error: "Invalid or expired link" },
        { status: 400 }
      );
    }

    const admin = createServiceRoleClient();
    const match = await findConsultantByCompletionToken(admin, token);

    if ("reason" in match) {
      if (match.reason === "complete") {
        return NextResponse.json(
          { error: "Registration already completed", code: "complete" },
          { status: 410 }
        );
      }
      return NextResponse.json(
        { error: "Invalid or expired link", code: match.reason },
        { status: 404 }
      );
    }

    return NextResponse.json({
      user_id: match.user_id,
      email: match.email,
      metadata: sanitizeMetadataForClient(match.metadata),
    });
  } catch (err) {
    console.error("[consultants/complete-invite]", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
