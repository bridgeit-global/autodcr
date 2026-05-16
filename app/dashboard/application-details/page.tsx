"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import DocumentPreviewModal from "@/app/components/DocumentPreviewModal";
import { useApplicationPdfSaveSlot } from "@/app/dashboard/context/ApplicationPdfSaveSlotContext";
import { useApplicationSignSlot } from "@/app/dashboard/context/ApplicationSignSlotContext";
import {
  normalizeApplicationWorkflowStage,
  type ApplicationWorkflowStage,
} from "@/app/components/DraftApplicationsModal";
import { useUserMetadata } from "@/app/contexts/UserContext";
import { supabase } from "@/app/utils/supabase";
import type { TemplateFields, TemplateType } from "@/app/templates/templateGenerators";
import {
  type ApplicationPreviewSource,
  buildDetailsFieldRowsForUi,
  generateApplicationPreviewHtml,
  generateApplicationPreviewPdf,
  generateApplicationPreviewPdfFromHtml,
  injectMockArchitectSignatureIntoPreviewHtml,
  injectMockOwnerSignatureIntoPreviewHtml,
  mapApplicationPreviewFields,
  mapToPdfFieldValues,
  mapSelectedApplicationToTemplate,
  pickConsultantLookupUserIdsFromProject,
  prewarmPreviewPdfRuntime,
  type PdfDetailsFieldRow,
} from "@/app/templates/applicationPreview";

type PreviewProjectData = {
  title?: string;
  user_id?: string | null;
  architect_user_id?: string | null;
  project_info?: {
    proposalNo?: string;
    fullNameOfApplicant?: string;
    propertyAddress?: string;
    pincode?: string;
  } | null;
  save_plot_details?: {
    ward?: string;
    zone?: string;
    plotBelongsTo?: "" | "CTS No." | "CS No." | "F.P.No";
    proposedCtsNumber?: string[] | string;
    villageName?: string;
    roadName?: string;
  } | null;
  applicant_details?: {
    applicants?: Array<{
      user_id?: string;
      userId?: string;
      id?: string;
      owner_id?: string;
      applicantType?: string;
      applicant_type?: string;
      email?: string;
      entity_name?: string;
      entityName?: string;
      letterhead_url?: string;
      letterheadUrl?: string;
      name?: string;
      entity_type?: string;
      entityType?: string;
      residentialAddress?: string;
    }>;
  } | null;
};

/** Who may act as “owner” for signing: project row + Owner applicants (auth id may match applicant, not `projects.user_id`). */
function collectOwnerSignerUserIds(
  proj: PreviewProjectData | null,
  projectRowUserId: string | null | undefined
): string[] {
  const raw: string[] = [];
  if (typeof projectRowUserId === "string" && projectRowUserId.trim()) {
    raw.push(projectRowUserId.trim());
  }
  if (typeof proj?.user_id === "string" && proj.user_id.trim()) {
    raw.push(proj.user_id.trim());
  }
  const applicants = proj?.applicant_details?.applicants ?? [];
  for (const a of applicants) {
    const type = (a.applicantType || a.applicant_type || "").toLowerCase();
    if (!type.includes("owner")) continue;
    for (const v of [a.user_id, a.userId, a.id, a.owner_id]) {
      if (typeof v === "string" && v.trim()) raw.push(v.trim());
    }
  }
  const seen = new Set<string>();
  const out: string[] = [];
  for (const r of raw) {
    const k = r.trim().toLowerCase();
    if (!k || seen.has(k)) continue;
    seen.add(k);
    out.push(r.trim());
  }
  return out;
}

function isAnySameUserId(uid: string, candidates: string[]): boolean {
  const u = uid.trim().toLowerCase();
  if (!u) return false;
  return candidates.some((c) => c.trim().toLowerCase() === u);
}

function sameUserIdStr(
  a: string | null | undefined,
  b: string | null | undefined
): boolean {
  const x = typeof a === "string" ? a.trim().toLowerCase() : "";
  const y = typeof b === "string" ? b.trim().toLowerCase() : "";
  return x.length > 0 && y.length > 0 && x === y;
}

type MockSignAvailability = {
  actionAvailable: boolean;
  idleReason?: string;
  subtitle: string;
};

function computeMockSignAvailability(args: {
  templateType: TemplateType;
  authUserId: string | null;
  ownerSignedAt: string | null;
  architectSignedAt: string | null;
  projectData: PreviewProjectData | null;
  projectRowUserId: string | null | undefined;
  architectUserId: string | null | undefined;
}): MockSignAvailability {
  const {
    templateType,
    authUserId,
    ownerSignedAt,
    architectSignedAt,
    projectData,
    projectRowUserId,
    architectUserId,
  } = args;
  const uid = typeof authUserId === "string" ? authUserId.trim() : "";
  if (!uid) {
    return {
      actionAvailable: false,
      idleReason: "Sign in to use signing.",
      subtitle: "Opens preview and saves the signed application (demo).",
    };
  }

  const ownerSigned = Boolean(ownerSignedAt?.trim());
  const architectSigned = Boolean(architectSignedAt?.trim());
  const ownerSignerIds = collectOwnerSignerUserIds(projectData, projectRowUserId);
  const isOwner = isAnySameUserId(uid, ownerSignerIds);
  const isArchitect = sameUserIdStr(uid, architectUserId);

  if (templateType === "Architect") {
    if (ownerSigned && architectSigned) {
      return {
        actionAvailable: false,
        idleReason: "Signing is already complete.",
        subtitle: "This application has been fully signed.",
      };
    }
    if (!ownerSigned) {
      if (isOwner) {
        return {
          actionAvailable: true,
          subtitle: "Opens preview, applies mock owner signature, then saves.",
        };
      }
      return {
        actionAvailable: false,
        idleReason: "Waiting for the project owner to sign first.",
        subtitle: "Only the owner signs first on the Architect appointment.",
      };
    }
    if (isArchitect) {
      return {
        actionAvailable: true,
        subtitle: "Opens preview, applies mock architect signature, then saves.",
      };
    }
    return {
      actionAvailable: false,
      idleReason: "Waiting for the appointed architect to sign.",
      subtitle: "Your owner signature is saved. The architect completes the next step.",
    };
  }

  if (ownerSigned) {
    return {
      actionAvailable: false,
      idleReason: "This application is already signed.",
      subtitle: "This application has already been signed.",
    };
  }
  if (isOwner) {
    return {
      actionAvailable: true,
      subtitle: "Opens preview, applies mock owner signature, then saves.",
    };
  }
  return {
    actionAvailable: false,
    idleReason: "Only the project owner can sign.",
    subtitle: "Only the project owner can sign this application.",
  };
}

function pickCoaRegNoFromMeta(meta: unknown): string | undefined {
  if (!meta || typeof meta !== "object") return undefined;
  const m = meta as Record<string, unknown>;
  for (const key of ["coa_reg_no", "COA_reg_no", "coaRegNo"]) {
    const v = m[key];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return undefined;
}

function pickCoaExpiryFromMeta(meta: unknown): string | undefined {
  if (!meta || typeof meta !== "object") return undefined;
  const m = meta as Record<string, unknown>;
  for (const key of ["coa_expiry_date", "COA_expiry_date", "coaExpiryDate"]) {
    const v = m[key];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return undefined;
}

function pickLbsLicenseFromMeta(meta: unknown): string | undefined {
  if (!meta || typeof meta !== "object") return undefined;
  const m = meta as Record<string, unknown>;
  for (const key of ["lbs_license_no", "LBS_license_no", "lbsLicenseNo"]) {
    const v = m[key];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return undefined;
}

function pickLbsExpiryFromMeta(meta: unknown): string | undefined {
  if (!meta || typeof meta !== "object") return undefined;
  const m = meta as Record<string, unknown>;
  for (const key of ["lbs_expiry_date", "LBS_expiry_date", "lbsExpiryDate"]) {
    const v = m[key];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return undefined;
}

function pickAddressLineFromMeta(meta: unknown, index: 1 | 2 | 3): string | undefined {
  if (!meta || typeof meta !== "object") return undefined;
  const m = meta as Record<string, unknown>;

  // Address is read strictly from explicit address_line1/2/3 keys
  // (with camelCase / PascalCase variants). We deliberately do NOT split
  // combined `address` / `residentialAddress` strings — the data layer is
  // expected to store each line separately.
  const keys =
    index === 1
      ? ["address_line1", "addressLine1", "AddressLine1"]
      : index === 2
        ? ["address_line2", "addressLine2", "AddressLine2"]
        : ["address_line3", "addressLine3", "AddressLine3"];
  for (const key of keys) {
    const v = m[key];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return undefined;
}

function pickConsultantCompanyFromMeta(meta: unknown): string | undefined {
  if (!meta || typeof meta !== "object") return undefined;
  const m = meta as Record<string, unknown>;
  for (const key of ["entity_name", "firm_name", "company_name", "name"]) {
    const v = m[key];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return undefined;
}

function pickConsultantNameFromMeta(meta: unknown): string | undefined {
  if (!meta || typeof meta !== "object") return undefined;
  const m = meta as Record<string, unknown>;
  const explicit =
    (typeof m.name === "string" && m.name.trim()) ? m.name.trim() : "";
  if (explicit) return explicit;
  const first = typeof m.first_name === "string" ? m.first_name.trim() : "";
  const middle = typeof m.middle_name === "string" ? m.middle_name.trim() : "";
  const last = typeof m.last_name === "string" ? m.last_name.trim() : "";
  const full = [first, middle, last].filter(Boolean).join(" ").trim();
  return full || undefined;
}

function pickConsultantMobileFromMeta(meta: unknown): string | undefined {
  if (!meta || typeof meta !== "object") return undefined;
  const m = meta as Record<string, unknown>;
  for (const key of ["alternate_phone", "alternatePhone", "mobile", "phone"]) {
    const v = m[key];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return undefined;
}

function pickConsultantEmailFromMeta(meta: unknown): string | undefined {
  if (!meta || typeof meta !== "object") return undefined;
  const m = meta as Record<string, unknown>;
  for (const key of ["email", "Email"]) {
    const v = m[key];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return undefined;
}

function pickEntityNameFromMeta(meta: unknown): string | undefined {
  if (!meta || typeof meta !== "object") return undefined;
  const m = meta as Record<string, unknown>;
  for (const key of ["entity_name", "entityName", "company_name", "companyName", "firm_name"]) {
    const v = m[key];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return undefined;
}

function pickEntityTypeFromMeta(meta: unknown): string | undefined {
  if (!meta || typeof meta !== "object") return undefined;
  const m = meta as Record<string, unknown>;
  for (const key of ["entity_type", "entityType"]) {
    const v = m[key];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return undefined;
}

function pickPersonFullNameFromMeta(meta: unknown): string | undefined {
  if (!meta || typeof meta !== "object") return undefined;
  const m = meta as Record<string, unknown>;
  const first = typeof m.first_name === "string" ? m.first_name.trim() : "";
  const middle = typeof m.middle_name === "string" ? m.middle_name.trim() : "";
  const last = typeof m.last_name === "string" ? m.last_name.trim() : "";
  const full = [first, middle, last].filter(Boolean).join(" ").trim();
  if (full) return full;
  const fallback = typeof m.name === "string" ? m.name.trim() : "";
  return fallback || undefined;
}

function pickLetterheadUrlFromMeta(meta: unknown): string | undefined {
  if (!meta || typeof meta !== "object") return undefined;
  const m = meta as Record<string, unknown>;
  for (const key of ["letterhead_url", "letterheadUrl"]) {
    const v = m[key];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return undefined;
}

function normalizeLookupId(value: unknown): string {
  if (value === null || value === undefined) return "";
  const s = String(value).trim();
  return s;
}

function readLocalStoredUserMetadata(): unknown | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem("userMetadata");
    if (!raw) return null;
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
}

async function fetchRawUserMetadataFromApi(
  userMetadata: unknown,
  preferredPortalIds?: string[],
  preferredEmail?: string
): Promise<unknown | null> {
  const portalFromMeta =
    typeof userMetadata === "object" &&
    userMetadata !== null &&
    typeof (userMetadata as { user_id?: unknown }).user_id === "string"
      ? (userMetadata as { user_id: string }).user_id.trim()
      : undefined;

  let portalFromStorage: string | undefined;
  if (typeof window !== "undefined") {
    portalFromStorage = localStorage.getItem("consultantUserId")?.trim() || undefined;
  }

  const { data: authData } = await supabase.auth.getUser();
  const authUuid = authData.user?.id;

  const candidates = [
    ...new Set(
      [...(preferredPortalIds ?? []).map((s) => String(s).trim()), portalFromMeta, portalFromStorage, authUuid].filter(
        Boolean
      )
    ),
  ] as string[];

  for (const user_id of candidates) {
    try {
      const res = await fetch("/api/get-user-metadata", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id,
          ...(preferredEmail?.trim() ? { email: preferredEmail.trim() } : {}),
        }),
      });
      if (!res.ok) continue;
      const payload = (await res.json()) as { metadata?: unknown };
      if (payload.metadata && typeof payload.metadata === "object") {
        return payload.metadata;
      }
    } catch {
      /* try next */
    }
  }
  return null;
}


type BuildApplicationPreviewContextInput = {
  userMetadata: unknown;
  projectData: PreviewProjectData | null;
  selectedApplication: string | null;
  applicationNo: string | null;
  applicationCreatedAt: string | null;
  projectId: string | null;
  /** Architect: `architect.html` vs `architect_acceptance.html` from Application_Templates. */
  architectHtmlVariant?: "appointment" | "acceptance";
};

async function buildApplicationPreviewContext(
  input: BuildApplicationPreviewContextInput
): Promise<{
  fields: TemplateFields;
  previewSource: ApplicationPreviewSource;
  templateType: TemplateType;
  fieldMapping: Record<string, string | undefined>;
}> {
  const {
    userMetadata,
    projectData,
    selectedApplication,
    applicationNo,
    applicationCreatedAt,
    projectId,
    architectHtmlVariant,
  } = input;

  const localMeta = readLocalStoredUserMetadata();
  const templateType = mapSelectedApplicationToTemplate(selectedApplication);

  let coaRegNo =
    pickCoaRegNoFromMeta(userMetadata) ||
    pickCoaRegNoFromMeta(localMeta);
  let coaExpiryDate =
    pickCoaExpiryFromMeta(userMetadata) ||
    pickCoaExpiryFromMeta(localMeta);
  let lbsLicenseNo =
    pickLbsLicenseFromMeta(userMetadata) || pickLbsLicenseFromMeta(localMeta);
  let lbsExpiryDate =
    pickLbsExpiryFromMeta(userMetadata) || pickLbsExpiryFromMeta(localMeta);
  let consultantAddressLine1 =
    pickAddressLineFromMeta(userMetadata, 1) ||
    pickAddressLineFromMeta(localMeta, 1);
  let consultantAddressLine2 =
    pickAddressLineFromMeta(userMetadata, 2) ||
    pickAddressLineFromMeta(localMeta, 2);
  let consultantAddressLine3 =
    pickAddressLineFromMeta(userMetadata, 3) ||
    pickAddressLineFromMeta(localMeta, 3);
  let consultantCompanyName =
    pickConsultantCompanyFromMeta(userMetadata) ||
    pickConsultantCompanyFromMeta(localMeta);
  let consultantName =
    pickConsultantNameFromMeta(userMetadata) ||
    pickConsultantNameFromMeta(localMeta);
  let consultantMobile =
    pickConsultantMobileFromMeta(userMetadata) ||
    pickConsultantMobileFromMeta(localMeta);
  let consultantEmail =
    pickConsultantEmailFromMeta(userMetadata) ||
    pickConsultantEmailFromMeta(localMeta);
  const ownerApplicants = (projectData?.applicant_details?.applicants || []).filter((a) =>
    (a.applicantType || a.applicant_type || "").toLowerCase().includes("owner")
  );
  const ownerApplicant = ownerApplicants[0];
  let clientCompanyName =
    ownerApplicant?.entity_name?.trim() ||
    ownerApplicant?.entityName?.trim() ||
    pickEntityNameFromMeta(ownerApplicant);
  let clientName =
    (typeof ownerApplicant?.name === "string" ? ownerApplicant.name.trim() : "") ||
    pickPersonFullNameFromMeta(ownerApplicant);
  let clientCompanyDesignation =
    ownerApplicant?.entity_type?.trim() ||
    ownerApplicant?.entityType?.trim() ||
    pickEntityTypeFromMeta(ownerApplicant);
  let ownerLetterheadUrl =
    ownerApplicant?.letterhead_url?.trim() ||
    ownerApplicant?.letterheadUrl?.trim() ||
    pickLetterheadUrlFromMeta(ownerApplicant);
  let clientAddressLine1 =
    ownerApplicant?.address_line1?.trim() ||
    (ownerApplicant as { addressLine1?: string } | undefined)?.addressLine1?.trim() ||
    "";
  let clientAddressLine2 =
    ownerApplicant?.address_line2?.trim() ||
    (ownerApplicant as { addressLine2?: string } | undefined)?.addressLine2?.trim() ||
    "";
  let clientAddressLine3 =
    ownerApplicant?.address_line3?.trim() ||
    (ownerApplicant as { addressLine3?: string } | undefined)?.addressLine3?.trim() ||
    "";

  const mergeConsultantMeta = (meta: unknown, prefer = false) => {
    const nextCoaRegNo = pickCoaRegNoFromMeta(meta);
    const nextCoaExpiryDate = pickCoaExpiryFromMeta(meta);
    const nextLbsLicenseNo = pickLbsLicenseFromMeta(meta);
    const nextLbsExpiryDate = pickLbsExpiryFromMeta(meta);
    const nextAddressLine1 = pickAddressLineFromMeta(meta, 1);
    const nextAddressLine2 = pickAddressLineFromMeta(meta, 2);
    const nextAddressLine3 = pickAddressLineFromMeta(meta, 3);
    const nextCompanyName = pickConsultantCompanyFromMeta(meta);
    const nextConsultantName = pickConsultantNameFromMeta(meta);
    const nextConsultantMobile = pickConsultantMobileFromMeta(meta);
    const nextConsultantEmail = pickConsultantEmailFromMeta(meta);

    if ((prefer || !coaRegNo) && nextCoaRegNo) coaRegNo = nextCoaRegNo;
    if ((prefer || !coaExpiryDate) && nextCoaExpiryDate) coaExpiryDate = nextCoaExpiryDate;
    if ((prefer || !lbsLicenseNo) && nextLbsLicenseNo) lbsLicenseNo = nextLbsLicenseNo;
    if ((prefer || !lbsExpiryDate) && nextLbsExpiryDate) lbsExpiryDate = nextLbsExpiryDate;
    if ((prefer || !consultantAddressLine1) && nextAddressLine1) consultantAddressLine1 = nextAddressLine1;
    if ((prefer || !consultantAddressLine2) && nextAddressLine2) consultantAddressLine2 = nextAddressLine2;
    if ((prefer || !consultantAddressLine3) && nextAddressLine3) consultantAddressLine3 = nextAddressLine3;
    if ((prefer || !consultantCompanyName) && nextCompanyName) consultantCompanyName = nextCompanyName;
    if ((prefer || !consultantName) && nextConsultantName) consultantName = nextConsultantName;
    if ((prefer || !consultantMobile) && nextConsultantMobile) consultantMobile = nextConsultantMobile;
    if ((prefer || !consultantEmail) && nextConsultantEmail) consultantEmail = nextConsultantEmail;
  };

  const consultantLookupUserIds = pickConsultantLookupUserIdsFromProject(
    templateType,
    projectData
  );

  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    if (token) {
      const res = await fetch("/api/preview-consultant-metadata", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          access_token: token,
          ...(consultantLookupUserIds.length
            ? { consultant_lookup_user_ids: consultantLookupUserIds }
            : {}),
        }),
      });
      if (res.ok) {
        const payload = (await res.json()) as { metadata?: unknown };
        if (
          process.env.NODE_ENV === "development" &&
          templateType === "Fire Safety Consultant"
        ) {
          console.log("[fire-preview-metadata-api]", payload.metadata ?? null);
        }
        if (payload.metadata) mergeConsultantMeta(payload.metadata, true);
      }
    }
  } catch {
    /* fall through to client-only sources */
  }

  mergeConsultantMeta((await supabase.auth.getUser()).data.user?.user_metadata);

  const needsConsultantRegRefresh =
    templateType === "Licensed Surveyor"
      ? !lbsLicenseNo || !lbsExpiryDate
      : !coaRegNo || !coaExpiryDate;

  if (needsConsultantRegRefresh) {
    await supabase.auth.refreshSession();
    mergeConsultantMeta((await supabase.auth.getUser()).data.user?.user_metadata);
  }

  if (
    templateType === "Licensed Surveyor"
      ? !lbsLicenseNo || !lbsExpiryDate
      : !coaRegNo || !coaExpiryDate
  ) {
    const serverMeta = await fetchRawUserMetadataFromApi(userMetadata, consultantLookupUserIds);
    if (serverMeta) mergeConsultantMeta(serverMeta);
  }

  const ownerLookupUserIds = [
    ...new Set(
      ownerApplicants
        .flatMap((owner) => [
          normalizeLookupId(owner.user_id),
          normalizeLookupId(owner.userId),
          normalizeLookupId(owner.id),
          normalizeLookupId((owner as { owner_id?: unknown }).owner_id),
          normalizeLookupId((owner as { ownerId?: unknown }).ownerId),
        ])
        .filter(Boolean)
    ),
  ];
  let ownerMetaSnapshot: unknown = null;
  for (const ownerLookupUserId of ownerLookupUserIds) {
    const ownerMeta = await fetchRawUserMetadataFromApi(
      userMetadata,
      [ownerLookupUserId],
      ownerApplicant?.email
    );
    if (!ownerMeta) continue;
    ownerMetaSnapshot = ownerMeta;
    if (!clientCompanyDesignation) {
      const resolvedType = pickEntityTypeFromMeta(ownerMeta);
      if (resolvedType) clientCompanyDesignation = resolvedType;
    }
    if (!clientName) {
      const resolvedClientName = pickPersonFullNameFromMeta(ownerMeta);
      if (resolvedClientName) clientName = resolvedClientName;
    }
    if (!ownerLetterheadUrl) {
      const resolvedLetterheadUrl = pickLetterheadUrlFromMeta(ownerMeta);
      if (resolvedLetterheadUrl) ownerLetterheadUrl = resolvedLetterheadUrl;
    }
    if (!clientAddressLine1) {
      const resolved = pickAddressLineFromMeta(ownerMeta, 1);
      if (resolved) clientAddressLine1 = resolved;
    }
    if (!clientAddressLine2) {
      const resolved = pickAddressLineFromMeta(ownerMeta, 2);
      if (resolved) clientAddressLine2 = resolved;
    }
    if (!clientAddressLine3) {
      const resolved = pickAddressLineFromMeta(ownerMeta, 3);
      if (resolved) clientAddressLine3 = resolved;
    }
    const resolved = pickEntityNameFromMeta(ownerMeta);
    if (resolved) {
      clientCompanyName = resolved;
      if (clientCompanyDesignation && clientName) break;
    }
  }

  if (process.env.NODE_ENV === "development") {
    console.log("[preview-owner-debug]", {
      ownerApplicants,
      ownerLookupUserIds,
      clientCompanyName,
      clientName,
      clientCompanyDesignation,
      ownerMeta: ownerMetaSnapshot,
    });
    console.log("[preview-owner-raw_user_meta_data]", ownerMetaSnapshot);
  }

  const fields = mapApplicationPreviewFields(
    {
      selectedApplication,
      applicationNo,
      applicationCreatedAt,
      coaRegNo,
      coaExpiryDate,
      lbsLicenseNo,
      lbsExpiryDate,
      consultantAddressLine1,
      consultantAddressLine2,
      consultantAddressLine3,
      consultantName,
      consultantCompanyName,
      consultantMobile,
      consultantEmail,
      clientCompanyName,
      clientName,
      clientCompanyDesignation,
      clientAddressLine1,
      clientAddressLine2,
      clientAddressLine3,
      projectData,
    },
    templateType
  );
  const previewSource = {
    projectId,
    selectedApplication,
    applicationNo,
    applicationCreatedAt,
    coaRegNo,
    coaExpiryDate,
    lbsLicenseNo,
    lbsExpiryDate,
    consultantAddressLine1,
    consultantAddressLine2,
    consultantAddressLine3,
    consultantName,
    consultantCompanyName,
    consultantMobile,
    consultantEmail,
    clientCompanyName,
    clientName,
    clientCompanyDesignation,
    clientAddressLine1,
    clientAddressLine2,
    clientAddressLine3,
    ownerLetterheadUrl,
    ownerDebug: {
      ownerApplicants,
      ownerLookupUserIds,
      ownerMetaSnapshot,
      resolvedClientCompanyName: clientCompanyName,
      resolvedClientName: clientName,
      resolvedClientCompanyDesignation: clientCompanyDesignation,
      resolvedOwnerLetterheadUrl: ownerLetterheadUrl,
    },
    consultantLookupUserIds,
    projectData,
    ...(templateType === "Architect"
      ? {
          architectHtmlVariant: architectHtmlVariant ?? "appointment",
        }
      : {}),
  };

  const fieldMapping = mapToPdfFieldValues(fields, previewSource, templateType);
  return { fields, previewSource, templateType, fieldMapping };
}

const ARCHITECT_ACCEPTANCE_URL_KEY = "Architect_acceptance";

function applicationTemplateSavedInUrls(
  raw: unknown,
  templateType: TemplateType
): boolean {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return false;
  const o = raw as Record<string, unknown>;
  if (templateType === "Architect") {
    const a = o["Architect"];
    const b = o[ARCHITECT_ACCEPTANCE_URL_KEY];
    return (
      typeof a === "string" &&
      a.trim().length > 0 &&
      typeof b === "string" &&
      b.trim().length > 0
    );
  }
  const e = o[templateType];
  return typeof e === "string" && e.trim().length > 0;
}

function hasApplicationUrlKey(raw: unknown, key: string): boolean {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return false;
  const v = (raw as Record<string, unknown>)[key];
  return typeof v === "string" && v.trim().length > 0;
}

export default function ApplicationDetailsPage() {
  const { userMetadata } = useUserMetadata();
  const router = useRouter();
  const searchParams = useSearchParams();
  const selectedApplication = searchParams.get("selectedApplication");
  const applicationNo = searchParams.get("applicationNo");
  const applicationId = searchParams.get("applicationId");
  const projectId = searchParams.get("projectId");
  const isReadOnlyMode = searchParams.get("mode") === "readonly";
  const previewTemplateType = mapSelectedApplicationToTemplate(selectedApplication);
  const [projectData, setProjectData] = useState<PreviewProjectData | null>(null);
  const [applicationCreatedAt, setApplicationCreatedAt] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  /** When Approved preview uses HTML iframe (letterhead), DSC/sign still loads bytes from this Storage URL. */
  const [storedSigningPdfUrl, setStoredSigningPdfUrl] = useState<string | null>(null);
  const [architectPreviewVariant, setArchitectPreviewVariant] = useState<
    "appointment" | "acceptance"
  >("appointment");
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [previewFieldMapping, setPreviewFieldMapping] = useState<Record<string, string | undefined> | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [isSavingPdf, setIsSavingPdf] = useState(false);
  const [savePdfMessage, setSavePdfMessage] = useState<string | null>(null);
  const [savePdfError, setSavePdfError] = useState<string | null>(null);
  const [previewReadyForSave, setPreviewReadyForSave] = useState(false);
  const [pdfSavedForCurrentPreview, setPdfSavedForCurrentPreview] = useState(false);
  const [detailsFieldRows, setDetailsFieldRows] = useState<PdfDetailsFieldRow[]>([]);
  const [detailsFieldsLoading, setDetailsFieldsLoading] = useState(false);
  const [detailsFieldsError, setDetailsFieldsError] = useState<string | null>(null);
  const [applicationWorkflowStage, setApplicationWorkflowStage] =
    useState<ApplicationWorkflowStage>("draft");
  const [ownerSignedAt, setOwnerSignedAt] = useState<string | null>(null);
  const [architectSignedAt, setArchitectSignedAt] = useState<string | null>(null);
  const [authUserId, setAuthUserId] = useState<string | null>(null);
  const [saveSuccessDialogOpen, setSaveSuccessDialogOpen] = useState(false);
  const [signedDocSuccessDialogOpen, setSignedDocSuccessDialogOpen] = useState(false);
  const [pendingDashboardUrl, setPendingDashboardUrl] = useState<string | null>(null);
  const { setSlot } = useApplicationPdfSaveSlot();
  const { setSlot: setSignApplicationSlot } = useApplicationSignSlot();
  const [autoMockSignAfterPreviewOpen, setAutoMockSignAfterPreviewOpen] = useState(false);
  const [sidebarPdfStatus, setSidebarPdfStatus] = useState<string | null>(null);
  const previewPdfContextRef = useRef<{
    fields: TemplateFields;
    templateType: TemplateType;
    previewSource: ApplicationPreviewSource;
  } | null>(null);
  const saveApplicationPdfRef = useRef<() => Promise<void>>(async () => Promise.resolve());
  const openPreviewForSignRef = useRef<() => Promise<void>>(async () => Promise.resolve());
  const buildApplicationPreviewPdfBlob = async (): Promise<Blob> => {
    const ctx = previewPdfContextRef.current;
    if (!ctx) {
      throw new Error("Preview data is missing. Close the preview and click Preview again.");
    }
    return generateApplicationPreviewPdf(
      ctx.fields,
      ctx.templateType,
      ctx.previewSource
    );
  };

  useEffect(() => {
    if (!isReadOnlyMode || !projectId) return;
    const loadProject = async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("title,project_info,save_plot_details,applicant_details,user_id,architect_user_id")
        .eq("id", projectId)
        .single();
      if (error) {
        console.error("Failed to load project for preview mapping:", error);
        return;
      }
      setProjectData(data);
    };
    void loadProject();
  }, [isReadOnlyMode, projectId]);

  useEffect(() => {
    if (!isReadOnlyMode || !applicationId) return;
    const loadApplication = async () => {
      const { data, error } = await supabase
        .from("applications")
        .select("created_at, workflow_stage, owner_signed_at, architect_signed_at")
        .eq("id", applicationId)
        .single();
      if (error) {
        console.error("Failed to load application for preview mapping:", error);
        return;
      }
      setApplicationCreatedAt(data?.created_at ?? null);
      setApplicationWorkflowStage(normalizeApplicationWorkflowStage(data?.workflow_stage));
      setOwnerSignedAt(
        typeof data?.owner_signed_at === "string" && data.owner_signed_at.trim()
          ? data.owner_signed_at.trim()
          : null
      );
      setArchitectSignedAt(
        typeof data?.architect_signed_at === "string" && data.architect_signed_at.trim()
          ? data.architect_signed_at.trim()
          : null
      );
    };
    void loadApplication();
  }, [isReadOnlyMode, applicationId]);

  useEffect(() => {
    if (!isReadOnlyMode || !applicationId) {
      setAuthUserId(null);
      return;
    }
    let cancelled = false;
    void supabase.auth.getUser().then(({ data, error }) => {
      if (cancelled) return;
      if (error || !data.user?.id) {
        setAuthUserId(null);
        return;
      }
      setAuthUserId(data.user.id);
    });
    return () => {
      cancelled = true;
    };
  }, [isReadOnlyMode, applicationId]);

  const mockSignAvailability = useMemo(
    () =>
      computeMockSignAvailability({
        templateType: previewTemplateType,
        authUserId,
        ownerSignedAt,
        architectSignedAt,
        projectData,
        projectRowUserId: projectData?.user_id,
        architectUserId: projectData?.architect_user_id,
      }),
    [
      previewTemplateType,
      authUserId,
      ownerSignedAt,
      architectSignedAt,
      projectData,
    ]
  );

  useEffect(() => {
    if (!isReadOnlyMode || !projectId) return;
    let cancelled = false;
    setDetailsFieldsLoading(true);
    setDetailsFieldsError(null);
    void (async () => {
      try {
        const ctx = await buildApplicationPreviewContext({
          userMetadata,
          projectData,
          selectedApplication,
          applicationNo,
          applicationCreatedAt,
          projectId,
          architectHtmlVariant:
            mapSelectedApplicationToTemplate(selectedApplication) === "Architect"
              ? architectPreviewVariant
              : undefined,
        });
        if (cancelled) return;
        setDetailsFieldRows(buildDetailsFieldRowsForUi(ctx.fieldMapping, ctx.templateType));
      } catch (err: unknown) {
        if (!cancelled) {
          const message =
            err instanceof Error ? err.message : "Failed to resolve application fields.";
          setDetailsFieldsError(message);
          setDetailsFieldRows([]);
        }
      } finally {
        if (!cancelled) setDetailsFieldsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [
    isReadOnlyMode,
    projectId,
    projectData,
    applicationCreatedAt,
    selectedApplication,
    applicationNo,
    userMetadata,
    architectPreviewVariant,
  ]);

  useEffect(() => {
    return () => {
      if (previewUrl?.startsWith("blob:")) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  // Pre-load the html2canvas + jsPDF chunks while the user reads the page so
  // the first Preview click feels instant rather than spending ~300-500ms on
  // dynamic imports.
  useEffect(() => {
    if (!isReadOnlyMode) return;
    type IdleHandle = number;
    type IdleWindow = Window & {
      requestIdleCallback?: (cb: IdleRequestCallback, opts?: { timeout: number }) => IdleHandle;
      cancelIdleCallback?: (handle: IdleHandle) => void;
    };
    const w = window as IdleWindow;
    const handle = w.requestIdleCallback
      ? w.requestIdleCallback(() => prewarmPreviewPdfRuntime(), { timeout: 2000 })
      : (window.setTimeout(prewarmPreviewPdfRuntime, 800) as unknown as IdleHandle);
    return () => {
      if (w.cancelIdleCallback) w.cancelIdleCallback(handle);
      else window.clearTimeout(handle as unknown as number);
    };
  }, [isReadOnlyMode]);

  const handlePreview = async () => {
    try {
      setPreviewError(null);
      setSavePdfMessage(null);
      setSavePdfError(null);
      setPreviewReadyForSave(false);
      setPdfSavedForCurrentPreview(false);
      setStoredSigningPdfUrl(null);
      previewPdfContextRef.current = null;
      setIsPreviewLoading(true);

      let workflowStageForPreview = applicationWorkflowStage;
      if (applicationId) {
        const { data: appRow } = await supabase
          .from("applications")
          .select("workflow_stage")
          .eq("id", applicationId)
          .maybeSingle();
        if (appRow?.workflow_stage != null && appRow.workflow_stage !== "") {
          workflowStageForPreview = normalizeApplicationWorkflowStage(
            String(appRow.workflow_stage)
          );
          setApplicationWorkflowStage(workflowStageForPreview);
        }
      }

      const { fields, previewSource, templateType, fieldMapping } =
        await buildApplicationPreviewContext({
          userMetadata,
          projectData,
          selectedApplication,
          applicationNo,
          applicationCreatedAt,
          projectId,
          architectHtmlVariant:
            mapSelectedApplicationToTemplate(selectedApplication) === "Architect"
              ? architectPreviewVariant
              : undefined,
        });

      // Always release the previous blob URL before opening a new preview.
      if (previewUrl?.startsWith("blob:")) {
        URL.revokeObjectURL(previewUrl);
      }

      if (workflowStageForPreview === "approved_verified" && projectId) {
        const { data: urlsRow } = await supabase
          .from("projects")
          .select("application_urls")
          .eq("id", projectId)
          .maybeSingle();
        const raw = urlsRow?.application_urls;
        const entry =
          raw && typeof raw === "object" && !Array.isArray(raw)
            ? (raw as Record<string, unknown>)[templateType]
            : undefined;
        const savedPdfUrl =
          typeof entry === "string" && entry.trim().length > 0 ? entry.trim() : null;

        if (savedPdfUrl) {
          // Same HTML path as In process so letterhead (CSS/Paged.js) renders in the iframe.
          // Stored PDF alone often lacks painted backgrounds; signing still uses `storedSigningPdfUrl`.
          const rawHtml = await generateApplicationPreviewHtml(
            fields,
            templateType,
            previewSource
          );
          // Match the mock-sign save pipeline so the owner script signature appears (fresh HTML omits it).
          const html = injectMockOwnerSignatureIntoPreviewHtml(rawHtml, templateType);
          previewPdfContextRef.current = { fields, templateType, previewSource };
          setPdfSavedForCurrentPreview(true);
          setPreviewReadyForSave(true);
          setStoredSigningPdfUrl(savedPdfUrl);
          setPreviewUrl(null);
          setPreviewHtml(html);
          setPreviewFieldMapping(fieldMapping);
          setPreviewOpen(true);
          return;
        }
      }

      const html = await generateApplicationPreviewHtml(
        fields,
        templateType,
        previewSource
      );

      let alreadySavedForTemplate = false;
      if (projectId) {
        const { data: urlsRow } = await supabase
          .from("projects")
          .select("application_urls")
          .eq("id", projectId)
          .maybeSingle();
        alreadySavedForTemplate = applicationTemplateSavedInUrls(
          urlsRow?.application_urls,
          templateType
        );
      }

      previewPdfContextRef.current = { fields, templateType, previewSource };
      setPdfSavedForCurrentPreview(alreadySavedForTemplate);
      setPreviewReadyForSave(true);
      setPreviewUrl(null);
      setPreviewHtml(html);
      setPreviewFieldMapping(fieldMapping);
      setPreviewOpen(true);
    } catch (error: unknown) {
      console.error("Preview generation failed:", error);
      const message = error instanceof Error ? error.message : "Failed to generate preview.";
      setPreviewError(message);
    } finally {
      setIsPreviewLoading(false);
    }
  };

  openPreviewForSignRef.current = handlePreview;

  const handleMockSignComplete = async () => {
    if (!projectId) {
      setSavePdfError("Missing project. Open Application Details from your dashboard with a project selected.");
      return;
    }

    let resolvedApplicationId = applicationId;
    if (!resolvedApplicationId?.trim() && selectedApplication) {
      const { data: appLookup } = await supabase
        .from("applications")
        .select("id")
        .eq("project_id", projectId)
        .eq("permission_type", selectedApplication)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (appLookup?.id) resolvedApplicationId = appLookup.id;
    }

    if (!resolvedApplicationId?.trim()) {
      setSavePdfError(
        "Missing application id. Use Application Details from the user dashboard (application number link) so signing can update your application."
      );
      return;
    }

    const ctx = previewPdfContextRef.current;
    if (!ctx) {
      setSavePdfError("Preview context is missing. Close the preview and open Preview again.");
      return;
    }

    setIsSavingPdf(true);
    setSavePdfMessage(null);
    setSavePdfError(null);

    const sameUserId = (a: string | null | undefined, b: string | null | undefined) => {
      const x = typeof a === "string" ? a.trim().toLowerCase() : "";
      const y = typeof b === "string" ? b.trim().toLowerCase() : "";
      return x.length > 0 && y.length > 0 && x === y;
    };

    try {
      const slug = ctx.templateType.replace(/[/\\]/g, "-").replace(/\s+/g, "_");

      const {
        data: { user: authUser },
        error: authUserErr,
      } = await supabase.auth.getUser();
      if (authUserErr || !authUser?.id) {
        throw new Error("Not signed in. Please log in again.");
      }

      const { data: sessionData } = await supabase.auth.getSession();
      const authToken = sessionData.session?.access_token;
      if (!authToken) {
        throw new Error("Missing session token. Please log in again.");
      }

      const [{ data: appSignRow, error: appSignErr }, { data: projSignRow, error: projSignErr }] =
        await Promise.all([
          supabase
            .from("applications")
            .select("owner_signed_at, architect_signed_at, workflow_stage")
            .eq("id", resolvedApplicationId)
            .single(),
          supabase.from("projects").select("user_id, architect_user_id").eq("id", projectId).single(),
        ]);

      if (appSignErr || !appSignRow) {
        throw new Error("Could not load application signing state.");
      }
      if (projSignErr || !projSignRow) {
        throw new Error("Could not load project for signing permissions.");
      }

      const ownerSignedAt =
        typeof appSignRow.owner_signed_at === "string" && appSignRow.owner_signed_at.trim().length > 0
          ? appSignRow.owner_signed_at
          : null;
      const architectSignedAt =
        typeof appSignRow.architect_signed_at === "string" &&
        appSignRow.architect_signed_at.trim().length > 0
          ? appSignRow.architect_signed_at
          : null;
      const ownerSigned = Boolean(ownerSignedAt);
      const architectSigned = Boolean(architectSignedAt);
      const appointedArchitectId =
        typeof projSignRow.architect_user_id === "string" ? projSignRow.architect_user_id : null;
      const ownerSignerIds = collectOwnerSignerUserIds(projectData, projSignRow.user_id);

      const isArchitectLetter = ctx.templateType === "Architect";
      const uid = authUser.id;

      if (isArchitectLetter && architectSigned) {
        throw new Error("This application is already fully signed.");
      }

      if (isArchitectLetter && !ownerSigned) {
        if (sameUserId(uid, appointedArchitectId) && !isAnySameUserId(uid, ownerSignerIds)) {
          throw new Error("The owner has not signed yet.");
        }
        if (!isAnySameUserId(uid, ownerSignerIds)) {
          throw new Error("Only the project owner can sign at this step.");
        }
      } else if (isArchitectLetter && ownerSigned && !architectSigned) {
        if (isAnySameUserId(uid, ownerSignerIds) && !sameUserId(uid, appointedArchitectId)) {
          setSavePdfMessage("Your signature is already saved. The architect will complete the next step.");
          return;
        }
        if (!sameUserId(uid, appointedArchitectId)) {
          throw new Error("Only the appointed architect can complete this signature step.");
        }
        if (!appointedArchitectId?.trim()) {
          throw new Error("This project has no appointed architect. Assign one before architect signing.");
        }
      } else if (!isArchitectLetter) {
        if (!isAnySameUserId(uid, ownerSignerIds)) {
          throw new Error("Only the project owner can sign this application.");
        }
      }

      const baseHtml = await generateApplicationPreviewHtml(
        ctx.fields,
        ctx.templateType,
        ctx.previewSource
      );

      let htmlWithSign: string;
      if (isArchitectLetter && ownerSigned && !architectSigned) {
        const withOwner = injectMockOwnerSignatureIntoPreviewHtml(baseHtml, ctx.templateType);
        htmlWithSign = injectMockArchitectSignatureIntoPreviewHtml(withOwner, ctx.templateType);
      } else {
        htmlWithSign = injectMockOwnerSignatureIntoPreviewHtml(baseHtml, ctx.templateType);
      }

      const pdfBlob = await generateApplicationPreviewPdfFromHtml(htmlWithSign, ctx.templateType);

      const formData = new FormData();
      formData.append("pdf", pdfBlob, `${slug}.pdf`);
      formData.append("templateType", ctx.templateType);
      formData.append("user_id", authUser.id);

      const response = await fetch(
        `/api/projects/${encodeURIComponent(projectId)}/save-application-pdf`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${authToken}`,
          },
          body: formData,
        }
      );

      if (!response.ok) {
        const errBody = (await response.json().catch(() => null)) as {
          error?: string;
          details?: string;
        } | null;
        const msg =
          typeof errBody?.error === "string"
            ? errBody.error + (errBody.details ? ` (${errBody.details})` : "")
            : `Save failed (${response.status}).`;
        throw new Error(msg);
      }

      const jsonBody = (await response.json().catch(() => null)) as {
        publicUrl?: string;
      } | null;
      const publicUrl =
        typeof jsonBody?.publicUrl === "string" && jsonBody.publicUrl.trim()
          ? jsonBody.publicUrl.trim()
          : null;

      const nowIso = new Date().toISOString();

      if (isArchitectLetter && !ownerSigned) {
        const { error: updErr } = await supabase
          .from("applications")
          .update({
            owner_signed_at: nowIso,
            owner_signed_by: uid,
            workflow_stage: "in_process",
          })
          .eq("id", resolvedApplicationId);
        if (updErr) {
          console.error("Failed to record owner signature:", updErr);
          throw new Error("PDF saved but owner signature could not be recorded (check permissions).");
        }
        setApplicationWorkflowStage("in_process");
        setOwnerSignedAt(nowIso);
        setPdfSavedForCurrentPreview(true);
        setSavePdfMessage(null);
        if (previewUrl?.startsWith("blob:")) {
          URL.revokeObjectURL(previewUrl);
        }
        if (publicUrl) {
          setPreviewUrl(publicUrl);
          setPreviewHtml(null);
        }
        setPreviewOpen(false);
        const { data: deptRowOwner } = await supabase
          .from("applications")
          .select("department")
          .eq("id", resolvedApplicationId)
          .maybeSingle();
        const deptOwner =
          typeof deptRowOwner?.department === "string" ? deptRowOwner.department.trim() : "";
        const dashboardUrlOwner =
          deptOwner.length > 0
            ? `/userdashboard?department=${encodeURIComponent(deptOwner)}`
            : "/userdashboard";
        router.push(dashboardUrlOwner);
        return;
      }

      if (isArchitectLetter && ownerSigned && !architectSigned) {
        const { error: updErr } = await supabase
          .from("applications")
          .update({
            architect_signed_at: nowIso,
            architect_signed_by: uid,
            workflow_stage: "approved_verified",
          })
          .eq("id", resolvedApplicationId);
        if (updErr) {
          console.error("Failed to record architect signature / stage:", updErr);
          throw new Error(
            "Signed PDF was saved, but the application could not be moved to Approved or Verified (check permissions)."
          );
        }
        setApplicationWorkflowStage("approved_verified");
        setArchitectSignedAt(nowIso);
        setPdfSavedForCurrentPreview(true);
        setSavePdfMessage(null);
        if (previewUrl?.startsWith("blob:")) {
          URL.revokeObjectURL(previewUrl);
        }
        if (publicUrl) {
          setPreviewUrl(publicUrl);
          setPreviewHtml(null);
        }
        const { data: deptRow } = await supabase
          .from("applications")
          .select("department")
          .eq("id", resolvedApplicationId)
          .maybeSingle();
        const dept = typeof deptRow?.department === "string" ? deptRow.department.trim() : "";
        const dashboardUrl =
          dept.length > 0
            ? `/userdashboard?department=${encodeURIComponent(dept)}`
            : "/userdashboard";
        setPendingDashboardUrl(dashboardUrl);
        setPreviewOpen(false);
        setSignedDocSuccessDialogOpen(true);
        if (!publicUrl && projectId) {
          const { data: urlsRow } = await supabase
            .from("projects")
            .select("application_urls")
            .eq("id", projectId)
            .maybeSingle();
          const raw = urlsRow?.application_urls;
          const entry =
            raw && typeof raw === "object" && !Array.isArray(raw)
              ? (raw as Record<string, unknown>)[ctx.templateType]
              : undefined;
          const fallback =
            typeof entry === "string" && entry.trim().length > 0 ? entry.trim() : null;
          if (fallback) {
            setPreviewUrl(fallback);
            setPreviewHtml(null);
          }
        }
        return;
      }

      const { error: stageErr } = await supabase
        .from("applications")
        .update({
          owner_signed_at: nowIso,
          owner_signed_by: uid,
          workflow_stage: "approved_verified",
        })
        .eq("id", resolvedApplicationId);

      if (stageErr) {
        console.error("Failed to update application workflow_stage:", stageErr);
        setSavePdfError(
          "Signed PDF was saved, but the application could not be moved to Approved or Verified (check permissions)."
        );
        return;
      }

      setApplicationWorkflowStage("approved_verified");
      setOwnerSignedAt(nowIso);
      setPdfSavedForCurrentPreview(true);
      setSavePdfMessage(null);

      if (previewUrl?.startsWith("blob:")) {
        URL.revokeObjectURL(previewUrl);
      }
      if (publicUrl) {
        setPreviewUrl(publicUrl);
        setPreviewHtml(null);
      }

      const { data: deptRow } = await supabase
        .from("applications")
        .select("department")
        .eq("id", resolvedApplicationId)
        .maybeSingle();
      const dept = typeof deptRow?.department === "string" ? deptRow.department.trim() : "";
      const dashboardUrl =
        dept.length > 0
          ? `/userdashboard?department=${encodeURIComponent(dept)}`
          : "/userdashboard";
      setPendingDashboardUrl(dashboardUrl);
      setPreviewOpen(false);
      setSignedDocSuccessDialogOpen(true);

      if (!publicUrl && projectId) {
        const { data: urlsRow } = await supabase
          .from("projects")
          .select("application_urls")
          .eq("id", projectId)
          .maybeSingle();
        const raw = urlsRow?.application_urls;
        const entry =
          raw && typeof raw === "object" && !Array.isArray(raw)
            ? (raw as Record<string, unknown>)[ctx.templateType]
            : undefined;
        const fallback =
          typeof entry === "string" && entry.trim().length > 0 ? entry.trim() : null;
        if (fallback) {
          setPreviewUrl(fallback);
          setPreviewHtml(null);
        }
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to save signed PDF.";
      setSavePdfError(message);
    } finally {
      setIsSavingPdf(false);
    }
  };

  const handleSaveApplicationPdf = async () => {
    if (!projectId) {
      setSavePdfError("Missing project.");
      return;
    }
    setIsSavingPdf(true);
    setSavePdfMessage(null);
    setSavePdfError(null);
    setSidebarPdfStatus(null);
    const stageBeforeSave = applicationWorkflowStage;
    try {
      let ctx = previewPdfContextRef.current;
      if (!ctx) {
        const built = await buildApplicationPreviewContext({
          userMetadata,
          projectData,
          selectedApplication,
          applicationNo,
          applicationCreatedAt,
          projectId,
          architectHtmlVariant:
            mapSelectedApplicationToTemplate(selectedApplication) === "Architect"
              ? architectPreviewVariant
              : undefined,
        });
        previewPdfContextRef.current = {
          fields: built.fields,
          templateType: built.templateType,
          previewSource: built.previewSource,
        };
        setPreviewFieldMapping(built.fieldMapping);
        setPreviewReadyForSave(true);
        ctx = previewPdfContextRef.current;
      }
      if (!ctx) {
        throw new Error("Could not prepare application data for saving.");
      }

      const {
        data: { user: authUser },
        error: authUserErr,
      } = await supabase.auth.getUser();
      if (authUserErr || !authUser?.id) {
        throw new Error("Not signed in. Please log in again.");
      }

      const { data: sessionData } = await supabase.auth.getSession();
      const authToken = sessionData.session?.access_token;
      if (!authToken) {
        throw new Error("Missing session token. Please log in again.");
      }

      const uploadPdfBlob = async (pdfBlob: Blob, applicationUrlsKey: string) => {
        const keySlug = applicationUrlsKey.replace(/[/\\]/g, "-").replace(/\s+/g, "_");
        const formData = new FormData();
        formData.append("pdf", pdfBlob, `${keySlug}.pdf`);
        formData.append("templateType", ctx.templateType);
        formData.append("applicationUrlsKey", applicationUrlsKey);
        formData.append("user_id", authUser.id);

        const response = await fetch(
          `/api/projects/${encodeURIComponent(projectId)}/save-application-pdf`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${authToken}`,
            },
            body: formData,
          }
        );

        if (!response.ok) {
          const errBody = (await response.json().catch(() => null)) as {
            error?: string;
            details?: string;
          } | null;
          const msg =
            typeof errBody?.error === "string"
              ? errBody.error + (errBody.details ? ` (${errBody.details})` : "")
              : `Save failed (${response.status}).`;
          throw new Error(msg);
        }
      };

      const fetchApplicationUrls = async (): Promise<unknown> => {
        const { data: urlsRow } = await supabase
          .from("projects")
          .select("application_urls")
          .eq("id", projectId)
          .maybeSingle();
        return urlsRow?.application_urls;
      };

      if (stageBeforeSave === "draft" && ctx.templateType === "Architect") {
        const saveArchitectVariant = async (
          variant: "appointment" | "acceptance",
          applicationUrlsKey: string
        ) => {
          let urlsRaw = await fetchApplicationUrls();
          const hadKey = hasApplicationUrlKey(urlsRaw, applicationUrlsKey);
          const built = await buildApplicationPreviewContext({
            userMetadata,
            projectData,
            selectedApplication,
            applicationNo,
            applicationCreatedAt,
            projectId,
            architectHtmlVariant: variant,
          });
          const blob1 = await generateApplicationPreviewPdf(
            built.fields,
            built.templateType,
            built.previewSource
          );
          if (hadKey) {
            await uploadPdfBlob(blob1, applicationUrlsKey);
          } else {
            await uploadPdfBlob(blob1, applicationUrlsKey);
            const blob2 = await generateApplicationPreviewPdf(
              built.fields,
              built.templateType,
              built.previewSource
            );
            await uploadPdfBlob(blob2, applicationUrlsKey);
          }
        };

        setSidebarPdfStatus("Saving appointment…");
        await saveArchitectVariant("appointment", "Architect");
        setSidebarPdfStatus("Saving acceptance…");
        await saveArchitectVariant("acceptance", ARCHITECT_ACCEPTANCE_URL_KEY);

        const refreshed = await buildApplicationPreviewContext({
          userMetadata,
          projectData,
          selectedApplication,
          applicationNo,
          applicationCreatedAt,
          projectId,
          architectHtmlVariant: architectPreviewVariant,
        });
        previewPdfContextRef.current = {
          fields: refreshed.fields,
          templateType: refreshed.templateType,
          previewSource: refreshed.previewSource,
        };
        const htmlWithQr = await generateApplicationPreviewHtml(
          refreshed.fields,
          refreshed.templateType,
          refreshed.previewSource
        );
        setPreviewHtml(htmlWithQr);
        const urlsAfterSave = await fetchApplicationUrls();
        setPdfSavedForCurrentPreview(
          applicationTemplateSavedInUrls(urlsAfterSave, "Architect")
        );
        setSidebarPdfStatus(null);
      } else {
        const urlsRaw = await fetchApplicationUrls();
        const hadTemplateUrl =
          urlsRaw &&
          typeof urlsRaw === "object" &&
          !Array.isArray(urlsRaw) &&
          typeof (urlsRaw as Record<string, unknown>)[ctx.templateType] === "string" &&
          String((urlsRaw as Record<string, unknown>)[ctx.templateType]).trim().length > 0;

        if (hadTemplateUrl) {
          const blobWithQr = await buildApplicationPreviewPdfBlob();
          await uploadPdfBlob(blobWithQr, ctx.templateType);
        } else {
          const blob = await buildApplicationPreviewPdfBlob();
          await uploadPdfBlob(blob, ctx.templateType);
          const blobWithQr = await buildApplicationPreviewPdfBlob();
          await uploadPdfBlob(blobWithQr, ctx.templateType);
        }

        const htmlWithQr = await generateApplicationPreviewHtml(
          ctx.fields,
          ctx.templateType,
          ctx.previewSource
        );
        setPreviewHtml(htmlWithQr);
        setPdfSavedForCurrentPreview(true);
      }

      if (applicationId) {
        const { error: stageErr } = await supabase
          .from("applications")
          .update({ workflow_stage: "in_process" })
          .eq("id", applicationId);
        if (stageErr) {
          console.error("Failed to update application workflow_stage:", stageErr);
          setSavePdfMessage(
            "Application PDF saved. Could not move application to In Process (check DB migration / permissions)."
          );
        } else {
          setApplicationWorkflowStage("in_process");
          if (stageBeforeSave === "draft") {
            setPreviewOpen(false);
            setSavePdfMessage(null);
            const { data: deptRow } = await supabase
              .from("applications")
              .select("department")
              .eq("id", applicationId)
              .maybeSingle();
            const dept =
              typeof deptRow?.department === "string" ? deptRow.department.trim() : "";
            const dashboardUrl =
              dept.length > 0
                ? `/userdashboard?department=${encodeURIComponent(dept)}`
                : "/userdashboard";
            setPendingDashboardUrl(dashboardUrl);
            setSaveSuccessDialogOpen(true);
          } else {
            setSavePdfMessage("Application PDF saved to project.");
          }
        }
      } else {
        setSavePdfMessage("Application PDF saved to project.");
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to save PDF.";
      setSavePdfError(message);
    } finally {
      setIsSavingPdf(false);
      setSidebarPdfStatus(null);
    }
  };

  saveApplicationPdfRef.current = handleSaveApplicationPdf;

  useEffect(() => {
    if (!isReadOnlyMode || !projectId) {
      setSlot(null);
      return;
    }
    if (applicationWorkflowStage !== "draft") {
      setSlot(null);
      return;
    }
    setSlot({
      onSave: () => saveApplicationPdfRef.current(),
      disabled: pdfSavedForCurrentPreview,
      busy: isSavingPdf,
      done: pdfSavedForCurrentPreview,
      subtitle:
        previewTemplateType === "Architect"
          ? "Saves appointment and acceptance PDFs to the project."
          : undefined,
      statusText: sidebarPdfStatus ?? undefined,
    });
    return () => {
      setSlot(null);
    };
  }, [
    isReadOnlyMode,
    projectId,
    applicationWorkflowStage,
    pdfSavedForCurrentPreview,
    isSavingPdf,
    previewTemplateType,
    sidebarPdfStatus,
    setSlot,
  ]);

  useEffect(() => {
    if (!previewOpen) {
      setAutoMockSignAfterPreviewOpen(false);
    }
  }, [previewOpen]);

  useEffect(() => {
    if (!isReadOnlyMode || !projectId) {
      setSignApplicationSlot(null);
      return;
    }
    if (applicationWorkflowStage !== "in_process") {
      setSignApplicationSlot(null);
      return;
    }
    const avail = mockSignAvailability;
    setSignApplicationSlot({
      onSign: async () => {
        if (!avail.actionAvailable) return;
        setAutoMockSignAfterPreviewOpen(true);
        await openPreviewForSignRef.current();
      },
      disabled: isSavingPdf,
      busy: isPreviewLoading,
      subtitle: avail.subtitle,
      actionAvailable: avail.actionAvailable,
      unavailableHint: avail.idleReason,
    });
    return () => {
      setSignApplicationSlot(null);
    };
  }, [
    isReadOnlyMode,
    projectId,
    applicationWorkflowStage,
    isPreviewLoading,
    isSavingPdf,
    setSignApplicationSlot,
    mockSignAvailability,
  ]);

  if (!isReadOnlyMode) {
    return (
      <div className="max-w-6xl mx-auto px-6 pt-8 space-y-6">
        <section className="border border-gray-200 rounded-2xl bg-white shadow-sm p-6">
          <h2 className="text-xl font-bold text-gray-900">Application Details</h2>
          <p className="text-sm text-gray-600 mt-2">
            This section is available only when opening a project from an application number.
          </p>
        </section>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-6 pt-8 space-y-6">
      <section className="border border-gray-200 rounded-2xl bg-white shadow-sm p-6">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <h2 className="text-xl font-bold text-gray-900">Application Details</h2>
          <div className="flex items-center gap-2 flex-wrap">
            {previewTemplateType === "Architect" && (
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <span className="whitespace-nowrap">Letter</span>
                <select
                  value={architectPreviewVariant}
                  onChange={(e) =>
                    setArchitectPreviewVariant(
                      e.target.value === "acceptance" ? "acceptance" : "appointment"
                    )
                  }
                  className="rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-900 min-w-[11rem]"
                  aria-label="Architect letter type"
                >
                  <option value="appointment">Appointment</option>
                  <option value="acceptance">Acceptance</option>
                </select>
              </label>
            )}
            <button
              type="button"
              onClick={handlePreview}
              disabled={isPreviewLoading}
              className="px-4 py-2 rounded-lg border border-emerald-300 bg-emerald-50 text-emerald-700 text-sm font-semibold hover:bg-emerald-100 transition-colors"
            >
              {isPreviewLoading ? "Generating..." : "Preview"}
            </button>
            {projectId &&
              previewReadyForSave &&
              applicationWorkflowStage !== "draft" && (
              <button
                type="button"
                onClick={() => void handleSaveApplicationPdf()}
                disabled={
                  isSavingPdf ||
                  pdfSavedForCurrentPreview ||
                  applicationWorkflowStage === "approved_verified"
                }
                className={
                  pdfSavedForCurrentPreview && !isSavingPdf
                    ? "px-4 py-2 rounded-lg border border-emerald-500 bg-emerald-50 text-emerald-800 text-sm font-semibold cursor-default"
                    : "px-4 py-2 rounded-lg border border-blue-600 bg-white text-blue-700 text-sm font-semibold hover:bg-blue-50 transition-colors disabled:opacity-50 disabled:pointer-events-none"
                }
              >
                {isSavingPdf ? (
                  <span className="inline-flex items-center gap-2">
                    <span
                      className="inline-block h-4 w-4 shrink-0 rounded-full border-2 border-blue-600 border-t-transparent animate-spin"
                      aria-hidden
                    />
                    Saving PDF…
                  </span>
                ) : applicationWorkflowStage === "approved_verified"
                    ? "Signed PDF on file"
                    : pdfSavedForCurrentPreview
                      ? "Saved"
                      : "Save PDF to project"}
              </button>
            )}
          </div>
        </div>
        <p className="text-sm text-gray-600 mt-1">
          Read-only details for the selected application.
        </p>
        {previewError && (
          <p className="text-sm text-red-600 mt-3">{previewError}</p>
        )}
        {detailsFieldsError && (
          <p className="text-sm text-red-600 mt-2">{detailsFieldsError}</p>
        )}
        {savePdfMessage && (
          <p className="text-sm text-emerald-700 mt-2">{savePdfMessage}</p>
        )}
        {savePdfError && (
          <p className="text-sm text-red-600 mt-2">{savePdfError}</p>
        )}

        <div className="mt-6">
          {detailsFieldsLoading ? (
            <p className="text-sm text-gray-500">Resolving fields…</p>
          ) : detailsFieldRows.length === 0 && !detailsFieldsError ? (
            <p className="text-sm text-gray-500">No letter fields to show yet.</p>
          ) : (
            <div className="rounded-xl border border-gray-200 overflow-hidden bg-white divide-y divide-gray-200">
              {detailsFieldRows.map((row) => (
                <div
                  key={row.key}
                  className="grid grid-cols-1 sm:grid-cols-[minmax(160px,38%)_1fr] gap-1 sm:gap-4 px-4 py-3"
                >
                  <div className="text-sm text-gray-600 font-medium">{row.label}</div>
                  <div
                    className="text-sm text-gray-900 break-words sm:break-all sm:min-w-0"
                    title={row.value.length > 120 ? row.value : undefined}
                  >
                    {row.value}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      <DocumentPreviewModal
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        fileUrl={previewUrl}
        htmlContent={previewHtml}
        fieldMapping={previewFieldMapping}
        title={selectedApplication ? `${selectedApplication} Preview` : "Application Preview"}
        autoMockSignAfterOpen={autoMockSignAfterPreviewOpen}
        onSave={projectId ? handleSaveApplicationPdf : undefined}
        isSaving={isSavingPdf}
        saveDisabled={!projectId || !previewReadyForSave}
        saveCompleted={pdfSavedForCurrentPreview}
        saveFeedbackError={savePdfError}
        saveFeedbackSuccess={savePdfError ? null : savePdfMessage}
        getPdfBlob={
          storedSigningPdfUrl &&
          (storedSigningPdfUrl.startsWith("https://") ||
            storedSigningPdfUrl.startsWith("http://") ||
            storedSigningPdfUrl.startsWith("/"))
            ? async () => {
                const res = await fetch(storedSigningPdfUrl);
                if (!res.ok) throw new Error("Could not load the saved PDF.");
                return res.blob();
              }
            : previewUrl &&
                (previewUrl.startsWith("https://") ||
                  previewUrl.startsWith("http://") ||
                  previewUrl.startsWith("/"))
              ? async () => {
                  const res = await fetch(previewUrl);
                  if (!res.ok) throw new Error("Could not load the saved PDF.");
                  return res.blob();
                }
              : previewHtml && applicationWorkflowStage !== "draft"
                ? () => buildApplicationPreviewPdfBlob()
                : undefined
        }
        signingFileName={
          previewPdfContextRef.current
            ? `${previewPdfContextRef.current.templateType.replace(/[/\\]/g, "-").replace(/\s+/g, "_")}-application.pdf`
            : undefined
        }
        hideSaveButton={applicationWorkflowStage === "draft"}
        showMockSignButton={
          applicationWorkflowStage === "in_process" && mockSignAvailability.actionAvailable
        }
        onMockSignComplete={handleMockSignComplete}
        mockSignBusy={isSavingPdf}
      />

      {saveSuccessDialogOpen && (
        <div
          className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="save-success-title"
        >
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 border border-gray-200">
            <h2 id="save-success-title" className="text-lg font-semibold text-gray-900">
              Saved successfully
            </h2>
            <p className="text-sm text-gray-600 mt-3">
              Your application PDF has been saved. The application is now in{" "}
              <span className="font-medium text-gray-800">In Process</span>.
            </p>
            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={() => {
                  setSaveSuccessDialogOpen(false);
                  const url = pendingDashboardUrl ?? "/userdashboard";
                  setPendingDashboardUrl(null);
                  router.push(url);
                }}
                className="px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold"
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}

      {signedDocSuccessDialogOpen && (
        <div
          className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="signed-doc-success-title"
        >
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 border border-gray-200">
            <h2 id="signed-doc-success-title" className="text-lg font-semibold text-gray-900">
              Signed document saved
            </h2>
            <p className="text-sm text-gray-600 mt-3">
              Your signed application PDF has been saved to the project. The application is now in{" "}
              <span className="font-medium text-gray-800">Approved or Verified</span>.
            </p>
            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={() => {
                  setSignedDocSuccessDialogOpen(false);
                  const url = pendingDashboardUrl ?? "/userdashboard";
                  setPendingDashboardUrl(null);
                  router.push(url);
                }}
                className="px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold"
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

