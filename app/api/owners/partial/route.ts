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
  OWNER_DOC_CHECKLIST,
  OWNER_ENTITY_DOC_URL_META_BY_ID,
  OWNER_ENTITY_TYPE_OPTIONS,
  OWNER_EXTRA_REG_REQUIRED_BY_TYPE,
  OWNER_REGISTRATION_META_BY_TYPE,
  ownerUsesEntityPan,
  type PartialOwnerPayload,
  type PrincipalAccountRole,
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

function asFile(value: FormDataEntryValue | null): File | null {
  if (!value || typeof value === "string") return null;
  return value as File;
}

async function uploadOwnerDocument(
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

/**
 * Create a partial Owner/Developer with documents, basic details,
 * registration numbers, and letterhead. Login + declaration remain incomplete.
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
    let form: FormData | null = null;
    if (contentType.includes("multipart/form-data")) {
      form = await request.formData();
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

    const letterheadFile = form ? asFile(form.get("letterhead")) : null;
    const aadhaarFile = form ? asFile(form.get("aadhaar_card")) : null;
    const panFile = form ? asFile(form.get("pan_card")) : null;
    const signatoryPhotoFile = form ? asFile(form.get("signatory_photo")) : null;
    const signatorySignatureFile = form
      ? asFile(form.get("signatory_signature"))
      : null;

    if (!aadhaarFile || aadhaarFile.size === 0) {
      return NextResponse.json(
        { error: "Aadhaar card document is required" },
        { status: 400 }
      );
    }
    if (!ownerUsesEntityPan(entityType) && (!panFile || panFile.size === 0)) {
      return NextResponse.json(
        { error: "PAN card document is required" },
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

    const entityDocs = OWNER_DOC_CHECKLIST[entityType] || [];
    const entityDocFiles: Array<{ id: string; file: File }> = [];
    for (const doc of entityDocs) {
      const file = form ? asFile(form.get(`entity_doc_${doc.id}`)) : null;
      if (!file || file.size === 0) {
        return NextResponse.json(
          { error: `${doc.label} is required` },
          { status: 400 }
        );
      }
      entityDocFiles.push({ id: doc.id, file });
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
    requiredString(body[mapping.dateField], `${mapping.label} date`);
    for (const field of OWNER_EXTRA_REG_REQUIRED_BY_TYPE[entityType] || []) {
      requiredString(body[field], field);
    }

    const accountRoleRaw = String(body.accountRole || body.role || "Owner").trim();
    const accountRole: PrincipalAccountRole =
      accountRoleRaw === "Developer" ? "Developer" : "Owner";

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
      gstNo: String(body.gstNo || "").trim() || undefined,
      addressLine1,
      addressLine2: String(body.addressLine2 || "").trim() || undefined,
      addressLine3: String(body.addressLine3 || "").trim() || undefined,
      fullNameProprietor: String(body.fullNameProprietor || "").trim() || undefined,
      proprietorshipRegistrationNo:
        String(body.proprietorshipRegistrationNo || "").trim() || undefined,
      proprietorshipRegistrationDate:
        String(body.proprietorshipRegistrationDate || "").trim() || undefined,
      firmRegistrationNo: String(body.firmRegistrationNo || "").trim() || undefined,
      partnershipRegistrationDate:
        String(body.partnershipRegistrationDate || "").trim() || undefined,
      numberOfPartners: String(body.numberOfPartners || "").trim() || undefined,
      cin: String(body.cin || "").trim() || undefined,
      rocRegistrationDate: String(body.rocRegistrationDate || "").trim() || undefined,
      numberOfDirectors: String(body.numberOfDirectors || "").trim() || undefined,
      llpin: String(body.llpin || "").trim() || undefined,
      llpIncorporationDate: String(body.llpIncorporationDate || "").trim() || undefined,
      numberOfDesignatedPartners:
        String(body.numberOfDesignatedPartners || "").trim() || undefined,
      trustRegistrationNo: String(body.trustRegistrationNo || "").trim() || undefined,
      trustRegistrationDate:
        String(body.trustRegistrationDate || "").trim() || undefined,
      numberOfTrustees: String(body.numberOfTrustees || "").trim() || undefined,
      departmentName: String(body.departmentName || "").trim() || undefined,
      govtRegistrationNo: String(body.govtRegistrationNo || "").trim() || undefined,
      govtRegistrationDate:
        String(body.govtRegistrationDate || "").trim() || undefined,
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
          error: `This phone number is already registered. Finish remaining login creation and other sections on the ${accountRole} Registration page.`,
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

    const metadata = buildPartialOwnerMetadata(payload, accountRole);
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
        {
          error:
            createError?.message ||
            `Failed to create ${accountRole.toLowerCase()} user`,
        },
        { status: 500 }
      );
    }

    const userId = created.user.id;
    const uploadedPaths: string[] = [];

    try {
      const letterheadUpload = await uploadOwnerDocument(
        admin,
        userId,
        letterheadFile,
        "letterhead"
      );
      uploadedPaths.push(letterheadUpload.path);

      const aadhaarUpload = await uploadOwnerDocument(
        admin,
        userId,
        aadhaarFile,
        "aadhaar_card"
      );
      uploadedPaths.push(aadhaarUpload.path);

      let panUrl = "";
      if (panFile && panFile.size > 0) {
        const panUpload = await uploadOwnerDocument(
          admin,
          userId,
          panFile,
          "pan_card"
        );
        uploadedPaths.push(panUpload.path);
        panUrl = panUpload.url;
      }

      const signatoryPhotoUpload = await uploadOwnerDocument(
        admin,
        userId,
        signatoryPhotoFile,
        "signatory_photo"
      );
      uploadedPaths.push(signatoryPhotoUpload.path);

      const signatorySignatureUpload = await uploadOwnerDocument(
        admin,
        userId,
        signatorySignatureFile,
        "signatory_signature"
      );
      uploadedPaths.push(signatorySignatureUpload.path);

      const entityUrlMeta: Record<string, string> = {};
      for (const { id, file } of entityDocFiles) {
        const upload = await uploadOwnerDocument(admin, userId, file, id);
        uploadedPaths.push(upload.path);
        const metaKey = OWNER_ENTITY_DOC_URL_META_BY_ID[id];
        if (metaKey) entityUrlMeta[metaKey] = upload.url;
        if (id === "llpEntityPan" && !panUrl) {
          panUrl = upload.url;
        }
      }

      const metadataWithDocuments: Record<string, unknown> = {
        ...metadata,
        letterhead_url: letterheadUpload.url,
        aadhaar_card_url: aadhaarUpload.url,
        ...(panUrl ? { pan_card_url: panUrl } : {}),
        authorized_signatory_photo_url: signatoryPhotoUpload.url,
        authorized_signatory_signature_url: signatorySignatureUpload.url,
        ...entityUrlMeta,
      };

      const { error: updateError } = await admin.auth.admin.updateUserById(
        userId,
        { user_metadata: metadataWithDocuments }
      );
      if (updateError) {
        throw new Error(updateError.message || "Failed to save document metadata");
      }

      return NextResponse.json({
        success: true,
        user_id: userId,
        email: created.user.email,
        metadata: metadataWithDocuments,
        message: `Partial ${accountRole.toLowerCase()} created`,
      });
    } catch (uploadErr) {
      console.error("[owners/partial] upload/update", uploadErr);
      if (uploadedPaths.length > 0) {
        await admin.storage.from("consultant-documents").remove(uploadedPaths);
      }
      await admin.auth.admin.deleteUser(userId);
      return NextResponse.json(
        {
          error:
            uploadErr instanceof Error
              ? uploadErr.message
              : "Failed to upload documents",
        },
        { status: 500 }
      );
    }
  } catch (err) {
    console.error("[owners/partial]", err);
    const message = err instanceof Error ? err.message : "Internal server error";
    const status =
      message.includes("required") || message.includes("Missing") ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
