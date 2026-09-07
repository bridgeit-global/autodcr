import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  createServiceRoleClient,
  findOwnerByEmail,
  findOwnerByPhone,
} from "@/app/utils/consultantLookupServer";
import {
  buildPartialOwnerMetadata,
  isIndividualType,
  normalizePhone,
  OWNER_ENTITY_TYPE_OPTIONS,
  type PartialOwnerPayload,
} from "@/app/utils/ownerRegistrationShared";
import {
  getSupabasePublicAnonKey,
  getSupabasePublicUrl,
} from "@/app/utils/supabaseEnv";

function requiredString(value: unknown, label: string): string {
  const v = String(value ?? "").trim();
  if (!v) throw new Error(`${label} is required`);
  return v;
}

/**
 * Create a partial owner with basic details only.
 * Sets registration_status = incomplete.
 */
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization") || "";
    const token = authHeader.startsWith("Bearer ")
      ? authHeader.slice(7).trim()
      : "";
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userClient = createClient(
      getSupabasePublicUrl(),
      getSupabasePublicAnonKey(),
      {
        global: { headers: { Authorization: `Bearer ${token}` } },
        auth: { persistSession: false, autoRefreshToken: false },
      }
    );
    const {
      data: { user: caller },
      error: callerError,
    } = await userClient.auth.getUser();
    if (callerError || !caller) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const contentType = request.headers.get("content-type") || "";
    let body: Record<string, unknown>;
    if (contentType.includes("multipart/form-data")) {
      const form = await request.formData();
      const payloadRaw = form.get("payload");
      if (typeof payloadRaw !== "string") {
        throw new Error("Missing form payload");
      }
      body = JSON.parse(payloadRaw) as Record<string, unknown>;
    } else {
      body = (await request.json()) as Record<string, unknown>;
    }

    const entityType = requiredString(body.entityType, "Entity type");
    if (
      !(OWNER_ENTITY_TYPE_OPTIONS as readonly string[]).includes(entityType)
    ) {
      return NextResponse.json({ error: "Invalid entity type" }, { status: 400 });
    }

    const entityName = isIndividualType(entityType)
      ? ""
      : requiredString(body.entityName, "Entity name");
    const firstName = requiredString(body.firstName, "First name");
    const lastName = requiredString(body.lastName, "Last name");
    const email = requiredString(body.email, "Email").toLowerCase();
    const alternatePhone = normalizePhone(
      requiredString(body.alternatePhone, "Phone number")
    );
    const addressLine1 = requiredString(body.addressLine1, "Address line 1");

    if (alternatePhone.length !== 10) {
      return NextResponse.json(
        { error: "Enter a valid 10-digit phone number" },
        { status: 400 }
      );
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "Enter a valid email" }, { status: 400 });
    }

    const payload: PartialOwnerPayload = {
      entityType,
      entityName,
      firstName,
      middleName: String(body.middleName || "").trim(),
      lastName,
      email,
      alternatePhone,
      addressLine1,
    };

    const admin = createServiceRoleClient();

    const phoneMatch = await findOwnerByPhone(admin, alternatePhone);
    if (phoneMatch) {
      if (phoneMatch.status === "complete") {
        return NextResponse.json(
          {
            error: "This phone number is already registered",
            status: "complete",
            user_id: phoneMatch.user_id,
          },
          { status: 409 }
        );
      }
      return NextResponse.json(
        {
          error:
            "This phone number is already registered. Finish remaining login creation and other sections on the Owner Registration page.",
          status: "incomplete",
          user_id: phoneMatch.user_id,
          email: phoneMatch.email,
          metadata: phoneMatch.metadata,
        },
        { status: 409 }
      );
    }

    const emailMatch = await findOwnerByEmail(admin, email);
    if (emailMatch) {
      return NextResponse.json(
        {
          error: "This email is already registered",
          status: emailMatch.status,
          user_id: emailMatch.user_id,
        },
        { status: 409 }
      );
    }

    const metadata = buildPartialOwnerMetadata(payload);
    const tempPassword = `Tmp!${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`;

    const { data: created, error: createError } =
      await admin.auth.admin.createUser({
        email,
        password: tempPassword,
        email_confirm: true,
        user_metadata: metadata,
        app_metadata: { role: "authenticated" },
      });

    if (createError || !created?.user) {
      console.error("[owners/partial] createUser", createError);
      return NextResponse.json(
        { error: createError?.message || "Failed to create owner user" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      user_id: created.user.id,
      email: created.user.email,
      metadata,
      message: "Partial owner created",
    });
  } catch (err) {
    console.error("[owners/partial]", err);
    const message = err instanceof Error ? err.message : "Internal server error";
    const status =
      message.includes("required") || message.includes("Missing") ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
