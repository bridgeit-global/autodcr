import { NextRequest, NextResponse } from "next/server";
import {
  createServiceRoleClient,
  findLoginUserIdByEmail,
} from "@/app/utils/consultantLookupServer";
import { sendUsernameRecoveryEmail } from "@/app/utils/email";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const action = String(body.action || "lookup");
    const email = String(body.email || "").trim().toLowerCase();

    if (!email || !EMAIL_PATTERN.test(email)) {
      return NextResponse.json(
        { error: "A valid email address is required." },
        { status: 400 }
      );
    }

    const admin = createServiceRoleClient();
    const match = await findLoginUserIdByEmail(admin, email);

    if (!match) {
      return NextResponse.json(
        { error: "No account found for this email. Please check and try again." },
        { status: 404 }
      );
    }

    if (action === "lookup") {
      return NextResponse.json({ success: true, email: match.email });
    }

    if (action === "complete") {
      const emailResult = await sendUsernameRecoveryEmail({
        to: match.email,
        userId: match.login_user_id,
      });

      return NextResponse.json({
        success: true,
        user_id: match.login_user_id,
        email_sent: emailResult.success,
      });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (err) {
    console.error("[recover-username]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to recover username" },
      { status: 500 }
    );
  }
}
