import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  createServiceRoleClient,
  findConsultantByEmail,
  findConsultantByPhone,
  findConsultantByRegistrationNumber,
} from "@/app/utils/consultantLookupServer";
import {
  buildPartialConsultantMetadata,
  EXTRA_REG_REQUIRED_BY_TYPE,
  getPrimaryRegNoFromPayload,
  normalizePhone,
  REGISTRATION_NUMBER_META_BY_TYPE,
  type PartialConsultantPayload,
} from "@/app/utils/consultantRegistrationShared";
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
 * Create a partial consultant (Basic Details + Registration Numbers only).
 * Requires authenticated caller. Sets registration_status = incomplete.
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

    const body = await request.json();
    const consultantType = requiredString(body.consultantType, "Consultant type");
    const firstName = requiredString(body.firstName, "First name");
    const lastName = requiredString(body.lastName, "Last name");
    const email = requiredString(body.email, "Email").toLowerCase();
    const city = requiredString(body.city, "City");
    const pincode = requiredString(body.pincode, "Pincode");
    const alternatePhone = normalizePhone(
      requiredString(body.alternatePhone, "Phone number")
    );
    const pan = requiredString(body.pan, "PAN").toUpperCase();
    const addressLine1 = requiredString(body.addressLine1, "Address line 1");
    const registrationDate = requiredString(
      body.registrationDate,
      "Registration date"
    );

    if (alternatePhone.length !== 10) {
      return NextResponse.json(
        { error: "Enter a valid 10-digit phone number" },
        { status: 400 }
      );
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "Enter a valid email" }, { status: 400 });
    }
    if (!/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(pan)) {
      return NextResponse.json(
        { error: "Enter a valid PAN (e.g. ABCDE1234F)" },
        { status: 400 }
      );
    }

    const mapping = REGISTRATION_NUMBER_META_BY_TYPE[consultantType];
    if (!mapping) {
      return NextResponse.json(
        { error: "Invalid consultant type" },
        { status: 400 }
      );
    }

    const primaryReg = requiredString(
      body[mapping.formField],
      mapping.label
    );
    for (const field of EXTRA_REG_REQUIRED_BY_TYPE[consultantType] || []) {
      requiredString(body[field], field);
    }

    const payload: PartialConsultantPayload = {
      consultantType,
      firstName,
      middleName: String(body.middleName || "").trim(),
      lastName,
      email,
      city,
      pincode,
      alternatePhone,
      pan,
      addressLine1,
      addressLine2: String(body.addressLine2 || "").trim(),
      addressLine3: String(body.addressLine3 || "").trim(),
      registrationDate,
      coaRegNo: body.coaRegNo,
      coaExpiryDate: body.coaExpiryDate,
      structuralLicenseNo: body.structuralLicenseNo,
      structuralValidity: body.structuralValidity,
      qualification: body.qualification,
      lbsLicenseNo: body.lbsLicenseNo,
      competencyClass: body.competencyClass,
      lbsExpiryDate: body.lbsExpiryDate,
      electricalLicenseNo: body.electricalLicenseNo,
      electricalExpiryDate: body.electricalExpiryDate,
      pwdAccreditation: body.pwdAccreditation,
      plumberLicenseNo: body.plumberLicenseNo,
      plumberExpiryDate: body.plumberExpiryDate,
      fireLicenseNo: body.fireLicenseNo,
      fireValidityDate: body.fireValidityDate,
      landscapeLicenseNo: body.landscapeLicenseNo,
      landscapeExpiryDate: body.landscapeExpiryDate,
      pmcRegistrationNo: body.pmcRegistrationNo,
      pmcExpiryDate: body.pmcExpiryDate,
      nablAccreditationNo: body.nablAccreditationNo,
      nablExpiryDate: body.nablExpiryDate,
      geotechQualification: body.geotechQualification,
      envLicenseNo: body.envLicenseNo,
      envExpiryDate: body.envExpiryDate,
      townPlannerLicenseNo: body.townPlannerLicenseNo,
      townPlannerExpiryDate: body.townPlannerExpiryDate,
    };

    // Ensure primary reg is on payload for uniqueness
    (payload as Record<string, string>)[mapping.formField] = primaryReg;

    const admin = createServiceRoleClient();

    const phoneMatch = await findConsultantByPhone(admin, alternatePhone);
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
            "This phone number is already registered. Finish remaining login creation and other sections on the Consultant Registration page.",
          status: "incomplete",
          user_id: phoneMatch.user_id,
          email: phoneMatch.email,
          metadata: phoneMatch.metadata,
        },
        { status: 409 }
      );
    }

    const regMatch = await findConsultantByRegistrationNumber(
      admin,
      getPrimaryRegNoFromPayload(payload),
      consultantType
    );
    if (regMatch) {
      return NextResponse.json(
        {
          error: "This registration number is already registered",
          status: regMatch.status,
          user_id: regMatch.user_id,
        },
        { status: 409 }
      );
    }

    const emailMatch = await findConsultantByEmail(admin, email);
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

    const metadata = buildPartialConsultantMetadata(payload);
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
      console.error("[consultants/partial] createUser", createError);
      return NextResponse.json(
        {
          error: createError?.message || "Failed to create consultant user",
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      user_id: created.user.id,
      email: created.user.email,
      metadata,
      message: "Partial consultant created",
    });
  } catch (err) {
    console.error("[consultants/partial]", err);
    const message = err instanceof Error ? err.message : "Internal server error";
    const status = message.includes("required") ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
