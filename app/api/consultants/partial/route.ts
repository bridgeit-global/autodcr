import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  createServiceRoleClient,
  findConsultantByEmail,
  findConsultantByPhone,
  findConsultantByRegistrationNumber,
  generateCompletionToken,
  buildCompletionTokenMetadata,
} from "@/app/utils/consultantLookupServer";
import {
  buildPartialConsultantMetadata,
  buildConsultantCompletionUrl,
  canSkipConsultantIdentityDocExtractionServer,
  EXTRA_REG_REQUIRED_BY_TYPE,
  getPrimaryRegNoFromPayload,
  normalizePhone,
  REGISTRATION_NUMBER_META_BY_TYPE,
  type PartialConsultantPayload,
} from "@/app/utils/consultantRegistrationShared";
import { sendConsultantCompletionInviteEmail } from "@/app/utils/email";
import {
  getSupabasePublicAnonKey,
  getSupabasePublicUrl,
} from "@/app/utils/supabaseEnv";

const CONSULTANT_CERTIFICATE_STORAGE_BY_TYPE: Record<string, string> = {
  Architect: "coa_certificate",
  "Structural Engineer": "structural_license",
  "Site Supervisor": "site_supervisor_license",
  "Licensed Surveyor": "lbs_certificate",
  "MEP Consultant": "mep_experience",
  Plumber: "phe_accreditation",
  "Fire Consultant": "fire_noc",
  "Landscape Consultant": "landscape_certificate",
  "PMC / Project Manager": "pmc_certificate",
  "Geotechnical Consultant": "lab_registration",
  "Environmental Consultant": "env_certificate",
  "Town Planner": "town_planner_certificate",
};

const CONSULTANT_CERTIFICATE_URL_BY_TYPE: Record<string, string> = {
  Architect: "coa_certificate_url",
  "Structural Engineer": "structural_license_url",
  "Site Supervisor": "site_supervisor_license_url",
  "Licensed Surveyor": "lbs_certificate_url",
  "MEP Consultant": "mep_experience_url",
  Plumber: "phe_accreditation_url",
  "Fire Consultant": "fire_noc_url",
  "Landscape Consultant": "landscape_certificate_url",
  "PMC / Project Manager": "pmc_certificate_url",
  "Geotechnical Consultant": "lab_registration_url",
  "Environmental Consultant": "env_certificate_url",
  "Town Planner": "town_planner_certificate_url",
};

async function uploadConsultantDocument(
  admin: ReturnType<typeof createServiceRoleClient>,
  userId: string,
  file: File,
  storageBaseName: string
): Promise<{ url: string; path: string }> {
  const fileExt = file.name.split(".").pop()?.toLowerCase() || "pdf";
  const storagePath = `${userId}/${storageBaseName}.${fileExt === "jpeg" ? "jpg" : fileExt}`;
  const arrayBuffer = await file.arrayBuffer();
  const { error: uploadError } = await admin.storage
    .from("consultant-documents")
    .upload(storagePath, arrayBuffer, {
      contentType: file.type || "application/octet-stream",
      upsert: true,
      cacheControl: "3600",
    });

  if (uploadError) {
    throw new Error(`Failed to upload ${storageBaseName}`);
  }

  const { data: urlData } = admin.storage
    .from("consultant-documents")
    .getPublicUrl(storagePath);

  return { url: urlData.publicUrl, path: storagePath };
}

function requiredString(value: unknown, label: string): string {
  const v = String(value ?? "").trim();
  if (!v) throw new Error(`${label} is required`);
  return v;
}

async function parseRequestBody(request: NextRequest): Promise<{
  body: Record<string, unknown>;
  letterheadFile: File | null;
  aadhaarFile: File | null;
  panFile: File | null;
  licenseFile: File | null;
  signatoryPhotoFile: File | null;
  signatorySignatureFile: File | null;
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
    const aadhaar = form.get("aadhaar_card");
    const aadhaarFile =
      aadhaar && typeof aadhaar !== "string" ? (aadhaar as File) : null;
    const pan = form.get("pan_card");
    const panFile = pan && typeof pan !== "string" ? (pan as File) : null;
    const license = form.get("license_certificate");
    const licenseFile =
      license && typeof license !== "string" ? (license as File) : null;
    const signatoryPhoto = form.get("signatory_photo");
    const signatoryPhotoFile =
      signatoryPhoto && typeof signatoryPhoto !== "string"
        ? (signatoryPhoto as File)
        : null;
    const signatorySignature = form.get("signatory_signature");
    const signatorySignatureFile =
      signatorySignature && typeof signatorySignature !== "string"
        ? (signatorySignature as File)
        : null;
    return {
      body,
      letterheadFile,
      aadhaarFile,
      panFile,
      licenseFile,
      signatoryPhotoFile,
      signatorySignatureFile,
    };
  }

  const body = (await request.json()) as Record<string, unknown>;
  return {
    body,
    letterheadFile: null,
    aadhaarFile: null,
    panFile: null,
    licenseFile: null,
    signatoryPhotoFile: null,
    signatorySignatureFile: null,
  };
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

    const {
      body,
      letterheadFile,
      aadhaarFile,
      panFile,
      licenseFile,
      signatoryPhotoFile,
      signatorySignatureFile,
    } = await parseRequestBody(request);

    const skipIdentityDocuments =
      body.skipIdentityDocuments === true &&
      canSkipConsultantIdentityDocExtractionServer();

    if (!skipIdentityDocuments) {
      if (!aadhaarFile || aadhaarFile.size === 0) {
        return NextResponse.json(
          { error: "Aadhaar card document is required" },
          { status: 400 }
        );
      }
      if (!panFile || panFile.size === 0) {
        return NextResponse.json(
          { error: "PAN card document is required" },
          { status: 400 }
        );
      }
      if (!licenseFile || licenseFile.size === 0) {
        return NextResponse.json(
          { error: "Technical person license document is required" },
          { status: 400 }
        );
      }
      if (!signatoryPhotoFile || signatoryPhotoFile.size === 0) {
        return NextResponse.json(
          { error: "Authorized signatory photograph is required" },
          { status: 400 }
        );
      }
      if (!signatorySignatureFile || signatorySignatureFile.size === 0) {
        return NextResponse.json(
          { error: "Authorized signatory signature is required" },
          { status: 400 }
        );
      }
    }

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
    const uploadedPaths: string[] = [];

    try {
      const letterheadUpload = await uploadConsultantDocument(
        admin,
        userId,
        letterheadFile,
        "letterhead"
      );
      uploadedPaths.push(letterheadUpload.path);

      let metadataWithDocuments: Record<string, unknown> = {
        ...metadata,
        letterhead_url: letterheadUpload.url,
      };

      if (!skipIdentityDocuments) {
        const aadhaarUpload = await uploadConsultantDocument(
          admin,
          userId,
          aadhaarFile!,
          "aadhaar_card"
        );
        uploadedPaths.push(aadhaarUpload.path);

        const panUpload = await uploadConsultantDocument(
          admin,
          userId,
          panFile!,
          "pan_card"
        );
        uploadedPaths.push(panUpload.path);

        const certStorageType =
          CONSULTANT_CERTIFICATE_STORAGE_BY_TYPE[consultantType] ??
          "license_certificate";
        const licenseUpload = await uploadConsultantDocument(
          admin,
          userId,
          licenseFile!,
          certStorageType
        );
        uploadedPaths.push(licenseUpload.path);

        const signatoryPhotoUpload = await uploadConsultantDocument(
          admin,
          userId,
          signatoryPhotoFile!,
          "signatory_photo"
        );
        uploadedPaths.push(signatoryPhotoUpload.path);

        const signatorySignatureUpload = await uploadConsultantDocument(
          admin,
          userId,
          signatorySignatureFile!,
          "signatory_signature"
        );
        uploadedPaths.push(signatorySignatureUpload.path);

        const certUrlKey =
          CONSULTANT_CERTIFICATE_URL_BY_TYPE[consultantType] ??
          "license_certificate_url";

        metadataWithDocuments = {
          ...metadataWithDocuments,
          aadhaar_card_url: aadhaarUpload.url,
          pan_card_url: panUpload.url,
          license_certificate_url: licenseUpload.url,
          [certUrlKey]: licenseUpload.url,
          authorized_signatory_photo_url: signatoryPhotoUpload.url,
          authorized_signatory_signature_url: signatorySignatureUpload.url,
          identity_documents_uploaded: true,
        };
      }

      const completionToken = generateCompletionToken();
      const tokenMetadata = buildCompletionTokenMetadata(completionToken);
      const metadataWithToken = {
        ...metadataWithDocuments,
        ...tokenMetadata,
      };

      const { error: metaError } = await admin.auth.admin.updateUserById(userId, {
        user_metadata: metadataWithToken,
      });

      if (metaError) {
        throw new Error("Failed to save consultant profile metadata");
      }

      const callerMeta = (caller.user_metadata || {}) as Record<string, unknown>;
      const callerFirst = String(callerMeta.first_name || "").trim();
      const callerLast = String(callerMeta.last_name || "").trim();
      const invitedByName =
        [callerFirst, callerLast].filter(Boolean).join(" ") ||
        String(callerMeta.entity_name || "").trim() ||
        undefined;
      const consultantName =
        [firstName, String(body.middleName || "").trim(), lastName]
          .filter(Boolean)
          .join(" ") || email;

      const emailResult = await sendConsultantCompletionInviteEmail({
        to: email,
        consultantName,
        consultantType,
        completionUrl: buildConsultantCompletionUrl(completionToken),
        invitedByName,
      });

      if (!emailResult.success) {
        console.warn(
          "[consultants/partial] invite email failed:",
          emailResult.error
        );
      }

      return NextResponse.json({
        success: true,
        user_id: userId,
        email: created.user.email,
        metadata: metadataWithToken,
        message: "Partial consultant created",
        inviteEmailSent: emailResult.success,
      });
    } catch (uploadErr) {
      console.error("[consultants/partial] document upload", uploadErr);
      if (uploadedPaths.length > 0) {
        await admin.storage.from("consultant-documents").remove(uploadedPaths);
      }
      await admin.auth.admin.deleteUser(userId);
      return NextResponse.json(
        {
          error:
            uploadErr instanceof Error
              ? uploadErr.message
              : "Failed to upload documents. Please try again.",
        },
        { status: 500 }
      );
    }
  } catch (err) {
    console.error("[consultants/partial]", err);
    const message = err instanceof Error ? err.message : "Internal server error";
    const status = message.includes("required") || message.includes("Missing")
      ? 400
      : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
