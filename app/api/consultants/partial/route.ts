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

async function parseRequestBody(request: NextRequest): Promise<{
  body: Record<string, unknown>;
  letterheadFile: File | null;
}> {
  const contentType = request.headers.get("content-type") || "";
  if (contentType.includes("multipart/form-data")) {
    const form = await request.formData();
    const payloadRaw = form.get("payload");
    if (typeof payloadRaw !== "string") {
      throw new Error("Missing form payload");
    }
    const body = JSON.parse(payloadRaw) as Record<string, unknown>;
    const letterhead = form.get("letterhead");
    const letterheadFile =
      letterhead && typeof letterhead !== "string" ? (letterhead as File) : null;
    return { body, letterheadFile };
  }

  const body = (await request.json()) as Record<string, unknown>;
  return { body, letterheadFile: null };
}

/**
 * Create a partial consultant (Basic Details + Registration Numbers + Letterhead).
 * Requires authenticated caller. Sets registration_status = incomplete.
 * Accepts JSON or multipart/form-data with `payload` JSON + optional `letterhead` file.
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

    const { body, letterheadFile } = await parseRequestBody(request);

    if (!letterheadFile || letterheadFile.size === 0) {
      return NextResponse.json(
        { error: "Letterhead image is required" },
        { status: 400 }
      );
    }

    const validImageTypes = ["image/jpeg", "image/jpg", "image/png"];
    const nameLower = letterheadFile.name.toLowerCase();
    const isValidImage =
      validImageTypes.includes(letterheadFile.type) ||
      nameLower.endsWith(".jpg") ||
      nameLower.endsWith(".jpeg") ||
      nameLower.endsWith(".png");
    if (!isValidImage) {
      return NextResponse.json(
        { error: "Letterhead must be a JPG or PNG image" },
        { status: 400 }
      );
    }
    if (letterheadFile.size > 10 * 1024 * 1024) {
      return NextResponse.json(
        { error: "Letterhead must be 10MB or smaller" },
        { status: 400 }
      );
    }

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
      entityName: String(body.entityName || "").trim(),
      email,
      city,
      pincode,
      alternatePhone,
      pan,
      addressLine1,
      addressLine2: String(body.addressLine2 || "").trim(),
      addressLine3: String(body.addressLine3 || "").trim(),
      registrationDate,
      coaRegNo: body.coaRegNo as string | undefined,
      coaExpiryDate: body.coaExpiryDate as string | undefined,
      structuralLicenseNo: body.structuralLicenseNo as string | undefined,
      structuralValidity: body.structuralValidity as string | undefined,
      qualification: body.qualification as string | undefined,
      lbsLicenseNo: body.lbsLicenseNo as string | undefined,
      competencyClass: body.competencyClass as string | undefined,
      lbsExpiryDate: body.lbsExpiryDate as string | undefined,
      electricalLicenseNo: body.electricalLicenseNo as string | undefined,
      electricalExpiryDate: body.electricalExpiryDate as string | undefined,
      pwdAccreditation: body.pwdAccreditation as string | undefined,
      plumberLicenseNo: body.plumberLicenseNo as string | undefined,
      plumberExpiryDate: body.plumberExpiryDate as string | undefined,
      fireLicenseNo: body.fireLicenseNo as string | undefined,
      fireValidityDate: body.fireValidityDate as string | undefined,
      landscapeLicenseNo: body.landscapeLicenseNo as string | undefined,
      landscapeExpiryDate: body.landscapeExpiryDate as string | undefined,
      pmcRegistrationNo: body.pmcRegistrationNo as string | undefined,
      pmcExpiryDate: body.pmcExpiryDate as string | undefined,
      nablAccreditationNo: body.nablAccreditationNo as string | undefined,
      nablExpiryDate: body.nablExpiryDate as string | undefined,
      geotechQualification: body.geotechQualification as string | undefined,
      envLicenseNo: body.envLicenseNo as string | undefined,
      envExpiryDate: body.envExpiryDate as string | undefined,
      townPlannerLicenseNo: body.townPlannerLicenseNo as string | undefined,
      townPlannerExpiryDate: body.townPlannerExpiryDate as string | undefined,
    };

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

    const userId = created.user.id;
    const fileExt =
      letterheadFile.name.split(".").pop()?.toLowerCase() || "png";
    const storagePath = `${userId}/letterhead.${fileExt === "jpeg" ? "jpg" : fileExt}`;

    const arrayBuffer = await letterheadFile.arrayBuffer();
    const { error: uploadError } = await admin.storage
      .from("consultant-documents")
      .upload(storagePath, arrayBuffer, {
        contentType: letterheadFile.type || "image/png",
        upsert: true,
        cacheControl: "3600",
      });

    if (uploadError) {
      console.error("[consultants/partial] letterhead upload", uploadError);
      await admin.auth.admin.deleteUser(userId);
      return NextResponse.json(
        { error: "Failed to upload letterhead. Please try again." },
        { status: 500 }
      );
    }

    const { data: urlData } = admin.storage
      .from("consultant-documents")
      .getPublicUrl(storagePath);
    const letterheadUrl = urlData.publicUrl;

    const metadataWithLetterhead = {
      ...metadata,
      letterhead_url: letterheadUrl,
    };

    const { error: metaError } = await admin.auth.admin.updateUserById(userId, {
      user_metadata: metadataWithLetterhead,
    });

    if (metaError) {
      console.error("[consultants/partial] metadata update", metaError);
      await admin.storage.from("consultant-documents").remove([storagePath]);
      await admin.auth.admin.deleteUser(userId);
      return NextResponse.json(
        { error: "Failed to save letterhead on profile. Please try again." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      user_id: userId,
      email: created.user.email,
      metadata: metadataWithLetterhead,
      message: "Partial consultant created",
    });
  } catch (err) {
    console.error("[consultants/partial]", err);
    const message = err instanceof Error ? err.message : "Internal server error";
    const status = message.includes("required") || message.includes("Missing")
      ? 400
      : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
