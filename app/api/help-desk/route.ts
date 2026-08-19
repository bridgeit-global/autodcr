import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

import { sendHelpDeskEmail } from "@/app/utils/email";
import { isHelpDeskCategory } from "@/app/utils/helpDesk";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() || "";

const SUBJECT_MAX = 200;
const MESSAGE_MAX = 4000;

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export async function POST(request: NextRequest) {
  try {
    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.json(
        { error: "Supabase environment variables are missing." },
        { status: 500 }
      );
    }

    const authHeader = request.headers.get("Authorization");
    const token = authHeader?.replace("Bearer ", "").trim();
    if (!token) {
      return NextResponse.json({ error: "Authorization required." }, { status: 401 });
    }

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });

    const {
      data: { user },
      error: authErr,
    } = await userClient.auth.getUser();

    if (authErr || !user?.id) {
      return NextResponse.json({ error: "Invalid or expired session." }, { status: 401 });
    }

    const body = (await request.json()) as {
      category?: unknown;
      subject?: unknown;
      message?: unknown;
    };

    const category = typeof body.category === "string" ? body.category.trim() : "";
    const subject = typeof body.subject === "string" ? body.subject.trim() : "";
    const message = typeof body.message === "string" ? body.message.trim() : "";

    if (!isHelpDeskCategory(category)) {
      return NextResponse.json({ error: "A valid category is required." }, { status: 400 });
    }
    if (!subject || subject.length > SUBJECT_MAX) {
      return NextResponse.json(
        { error: `Subject is required (max ${SUBJECT_MAX} characters).` },
        { status: 400 }
      );
    }
    if (!message || message.length > MESSAGE_MAX) {
      return NextResponse.json(
        { error: `Message is required (max ${MESSAGE_MAX} characters).` },
        { status: 400 }
      );
    }

    const metadata = (user.user_metadata || {}) as Record<string, unknown>;
    const nameParts = [
      String(metadata.first_name || "").trim(),
      String(metadata.middle_name || "").trim(),
      String(metadata.last_name || "").trim(),
    ].filter(Boolean);
    const senderName = nameParts.length > 0 ? nameParts.join(" ") : "User";
    const senderEmail = String(user.email || metadata.email || "").trim();

    if (!isValidEmail(senderEmail)) {
      return NextResponse.json(
        { error: "Your account does not have a valid email address." },
        { status: 400 }
      );
    }

    const result = await sendHelpDeskEmail({
      category,
      subject,
      message,
      senderName,
      senderEmail,
    });

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || "Failed to send message." },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    console.error("[help-desk] Error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
