import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  createServiceRoleClient,
  findOwnerByEmail,
  findOwnerByPhone,
  findOwnerByRegistrationNumber,
} from "@/app/utils/consultantLookupServer";
import {
  buildPartialOwnerMetadata,
  getPrimaryOwnerRegNoFromPayload,
  isIndividualType,
  normalizePhone,
  OWNER_EXTRA_REG_REQUIRED_BY_TYPE,
  OWNER_REGISTRATION_META_BY_TYPE,
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
 * Create a partial owner (Basic Details + Registration Numbers + Letterhead).
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

    const entityType = requiredString(body.entityType, "Entity type");
    const entityName = isIndividualType(entityType)
      ? ""
      : requiredString(body.entityName, "Entity name");
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

    const mapping = OWNER_REGISTRATION_META_BY_TYPE[entityType];
    if (!mapping) {
      return NextResponse.json({ error: "Invalid entity type" }, { status: 400 });
    }

    const primaryReg = requiredString(body[mapping.formField], mapping.label);
    requiredString(body[mapping.dateField], "Registration date");
    if (entityType === "Proprietorship" || isIndividualType(entityType)) {
      requiredString(body.gstNo, "GSTIN No.");
    }
    for (const field of OWNER_EXTRA_REG_REQUIRED_BY_TYPE[entityType] || []) {
      requiredString(body[field], field);
    }

    const payload: PartialOwnerPayload = {
      entityType,
      entityName,
      firstName,
      middleName: String(body.middleName || "").trim(),
      lastName,
      email,
      city,
      pincode,
      alternatePhone,
      pan,
      gstNo: String(body.gstNo || "").trim(),
      addressLine1,
      addressLine2: String(body.addressLine2 || "").trim(),
      addressLine3: String(body.addressLine3 || "").trim(),
      fullNameProprietor: body.fullNameProprietor as string | undefined,
      proprietorshipRegistrationNo: body.proprietorshipRegistrationNo as string | undefined,
      proprietorshipRegistrationDate: body.proprietorshipRegistrationDate as string | undefined,
      firmRegistrationNo: body.firmRegistrationNo as string | undefined,
      partnershipRegistrationDate: body.partnershipRegistrationDate as string | undefined,
      numberOfPartners: body.numberOfPartners as string | undefined,
      cin: body.cin as string | undefined,
      rocRegistrationDate: body.rocRegistrationDate as string | undefined,
      numberOfDirectors: body.numberOfDirectors as string | undefined,
      llpin: body.llpin as string | undefined,
      llpIncorporationDate: body.llpIncorporationDate as string | undefined,
      numberOfDesignatedPartners: body.numberOfDesignatedPartners as string | undefined,
      trustRegistrationNo: body.trustRegistrationNo as string | undefined,
      trustRegistrationDate: body.trustRegistrationDate as string | undefined,
      numberOfTrustees: body.numberOfTrustees as string | undefined,
      departmentName: body.departmentName as string | undefined,
      govtRegistrationNo: body.govtRegistrationNo as string | undefined,
      govtRegistrationDate: body.govtRegistrationDate as string | undefined,
    };
    (payload as Record<string, string>)[mapping.formField] = primaryReg;

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

    const regMatch = await findOwnerByRegistrationNumber(
      admin,
      getPrimaryOwnerRegNoFromPayload(payload),
      entityType
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
      console.error("[owners/partial] letterhead upload", uploadError);
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
      console.error("[owners/partial] metadata update", metaError);
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
