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
import {
  collectOwnerSignerUserIds,
  isAnySameUserId,
  resolveAppointedArchitectUserId,
  resolveAppointedSecondSignerUserId,
  sameUserId,
} from "@/app/utils/applicationSigning";
import { canUserAccessApplication } from "@/app/utils/applicationAccess";
import {
  consultantSignsAppointmentLetter,
  dualLetterPdfNeedsQrFreeFirstPass,
  isCleanAppointmentLetterType,
  prefersLiveHtmlApplicationPreview,
  shouldPreviewStoredApplicationPdf,
  shouldRunLegacyDualLetterQrRepass,
  shouldUseStoredPdfPreview,
} from "@/app/utils/cleanAppointmentLetterTypes";
import {
  fetchBuildingProposalOffices,
  fetchFireConsultantOffices,
} from "@/app/utils/fetchBuildingProposalOffices";
import {
  fetchApplicantDetailsFromTable,
  mergeApplicantDetailsPreferTable,
} from "@/app/utils/resolveApplicantDetailsForProject";
import {
  fetchApplicationForSigning,
  getAuthUserId,
  updateApplicationForSigning,
} from "@/app/utils/ownerApplicationRpc";
import {
  readApplicationUrlFromUrls,
  resolveSavedPdfUrlForQr,
} from "@/app/utils/projectSavedApplicationPdfUrl";
import { resolveOwnerEntityTypeForDesignation } from "@/app/utils/applicantRecordFields";
import type { TemplateFields, TemplateType } from "@/app/templates/templateGenerators";
import {
  type ApplicationPreviewSource,
  buildDetailsFieldRowsForUi,
  generateApplicationPreviewHtml,
  generateApplicationPreviewHtmlBatch,
  generateApplicationPreviewPdfBatchFromHtml,
  generateApplicationPreviewPdfFromHtml,
  injectMockConsultantSignatureIntoPreviewHtml,
  injectMockOwnerSignatureIntoPreviewHtml,
  mockSecondSignerLabel,
  mapApplicationPreviewFields,
  mapToPdfFieldValues,
  mapSelectedApplicationToTemplate,
  pickConsultantLookupUserIdsFromProject,
  prewarmPreviewPdfRuntime,
  type PdfDetailsFieldRow,
} from "@/app/templates/applicationPreview";
import { base64ToBlob, blobToBase64 } from "@/app/lib/bridge/pdfChunker";
import {
  resolveDscStampRectFromPdf,
  type DscStampLayout,
  type DscStampRole,
} from "@/app/lib/bridge/dscStampPlacement";
import {
  pdfHasCompletedSignature,
  pdfHasUnsignedSignaturePlaceholder,
  assertPdfPriorSignaturesPreserved,
  assertPdfOriginalPrefixPreserved,
  countCompletedSignatures,
  pdfHasByteRangeMarker,
  preparePdfForNativeSigning,
} from "@/app/lib/bridge/pdfSigningPrep";
import { listCertsForSlot, listSlots, pingHost, signPdf } from "@/app/lib/bridge/signingOrchestrator";
import { mapBridgeError } from "@/app/lib/bridge/errorMapper";

type PreviewProjectData = {
  title?: string;
  user_id?: string | null;
  architect_user_id?: string | null;
  application_urls?: Record<string, unknown> | null;
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
      address_line1?: string;
      address_line2?: string;
      address_line3?: string;
      addressLine1?: string;
      addressLine2?: string;
      addressLine3?: string;
      residentialAddress?: string;
    }>;
  } | null;
};

type MockSignAvailability = {
  actionAvailable: boolean;
  idleReason?: string;
  subtitle: string;
};

function resolveDscStampRole(templateType: TemplateType, signingAcceptance: boolean): DscStampRole {
  if (signingAcceptance && isDualLetterType(templateType)) {
    return "consultant";
  }
  return "owner";
}

function resolveDscStampLayout(templateType: TemplateType, signingAcceptance: boolean): DscStampLayout {
  if (isCleanAppointmentLetterType(templateType) && !signingAcceptance) {
    return "cleanRight";
  }
  return "dualColumn";
}

function resolveSlotIdForSigning(slot: Record<string, unknown>, fallbackIndex: number): number | null {
  const raw = slot.slotId ?? slot.id ?? slot.slot ?? slot.slotID;
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  if (typeof raw === "string" && raw.trim() && !Number.isNaN(Number(raw))) return Number(raw);
  if (Number.isInteger(fallbackIndex) && fallbackIndex >= 0) return fallbackIndex;
  return null;
}

function pickSignerLabel(cert: { subject?: string; label?: string; id: string }): string {
  const match = cert.subject?.match(/CN\s*=\s*([^,]+)/i);
  return (
    match?.[1]?.trim() ||
    cert.label?.trim() ||
    cert.subject?.trim() ||
    `Cert ${cert.id.slice(0, 8)}`
  );
}

async function signPdfBlobWithDsc(
  blob: Blob,
  fileName: string,
  pinHint: string | undefined,
  templateType: TemplateType,
  signingAcceptance: boolean,
  stampOptions?: { role?: DscStampRole; layout?: DscStampLayout }
): Promise<Blob> {
  await pingHost();
  const slots = await listSlots();
  const usableSlots = slots
    .map((slot, index) => {
      const slotId = resolveSlotIdForSigning(slot as unknown as Record<string, unknown>, index);
      return slotId === null ? null : { ...slot, slotId };
    })
    .filter((slot): slot is (typeof slots)[number] & { slotId: number } => slot !== null);
  if (usableSlots.length === 0) {
    throw new Error("No DSC slot detected. Insert token and retry.");
  }
  const preferred = usableSlots.find((s) => s.tokenPresent) ?? usableSlots[0];
  const certs = await listCertsForSlot(preferred.slotId);
  const cert = certs[0];
  if (!cert) {
    throw new Error("No DSC certificate found on the selected token.");
  }

  const sourceBuffer = await blob.arrayBuffer();
  const sourceBytes = new Uint8Array(sourceBuffer);
  const hadPriorSignatureMarkers = pdfHasByteRangeMarker(sourceBytes);
  const ownerSignedInput = pdfHasCompletedSignature(sourceBytes);
  const role = stampOptions?.role ?? resolveDscStampRole(templateType, signingAcceptance);
  const layout = stampOptions?.layout ?? resolveDscStampLayout(templateType, signingAcceptance);
  const stampRect = await resolveDscStampRectFromPdf(sourceBuffer, role, layout);

  const prepared = await preparePdfForNativeSigning(sourceBuffer, {
    stamp: {
      ...stampRect,
      signerLabel: pickSignerLabel(cert),
      signedAt: new Date(),
      reason: "Document approval",
    },
  });
  const preparedBlob = new Blob([new Uint8Array(prepared)], {
    type: blob.type || "application/pdf",
  });
  const signed = await signPdf({
    pdfBase64: await blobToBase64(preparedBlob),
    slotId: preferred.slotId,
    certId: cert.id,
    fileName,
    contentType: preparedBlob.type,
    pinHint,
    certSource: "fresh_slot_lookup",
  });
  if (!signed.signedPdfBase64) {
    throw new Error("DSC signing failed: connector returned empty payload.");
  }
  const signedBlob = base64ToBlob(signed.signedPdfBase64, "application/pdf");
  const signedBytes = new Uint8Array(await signedBlob.arrayBuffer());
  const priorSigCount = countCompletedSignatures(sourceBytes);
  const afterSigCount = countCompletedSignatures(signedBytes);
  if (afterSigCount !== priorSigCount + 1) {
    throw new Error(
      `DSC signing did not add exactly one signature (before: ${priorSigCount}, after: ${afterSigCount}).`
    );
  }
  if (hadPriorSignatureMarkers) {
    assertPdfOriginalPrefixPreserved(sourceBytes, signedBytes);
    if (ownerSignedInput) {
      assertPdfPriorSignaturesPreserved(sourceBytes, signedBytes);
    }
  }
  return signedBlob;
}

function computeMockSignAvailability(args: {
  templateType: TemplateType;
  authUserId: string | null;
  ownerSignedAt: string | null;
  architectSignedAt: string | null;
  projectData: PreviewProjectData | null;
  projectRowUserId: string | null | undefined;
}): MockSignAvailability {
  const {
    templateType,
    authUserId,
    ownerSignedAt,
    architectSignedAt,
    projectData,
    projectRowUserId,
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
  const secondSigned = Boolean(architectSignedAt?.trim());
  const ownerSignerIds = collectOwnerSignerUserIds(projectData, projectRowUserId);
  const isOwner = isAnySameUserId(uid, ownerSignerIds);
  const appointedSecondId = resolveAppointedSecondSignerUserId(projectData, templateType);
  const isSecondSigner = sameUserId(uid, appointedSecondId);
  const secondRoleLabel =
    templateType === "Architect" ? "architect" : mockSecondSignerLabel(templateType).toLowerCase();

  if (isDualLetterType(templateType)) {
    if (ownerSigned && secondSigned) {
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
        subtitle: `Only the owner signs first on the ${templateType} appointment.`,
      };
    }
    if (isSecondSigner) {
      return {
        actionAvailable: true,
        subtitle: `Adds your signature on the acceptance letter (appointment is owner-signed only).`,
      };
    }
    return {
      actionAvailable: false,
      idleReason: `Waiting for the appointed ${secondRoleLabel} to sign.`,
      subtitle: `Your owner signature is saved. The ${secondRoleLabel} completes the acceptance letter.`,
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

type DirectSignPermissionOutcome =
  | { allowed: true }
  | { allowed: false; softMessage: string };

function checkDirectSignPermissions(args: {
  templateType: TemplateType;
  authUserId: string;
  ownerSigned: boolean;
  architectSigned: boolean;
  projectData: PreviewProjectData | null;
  projectRowUserId: string | null | undefined;
  appointedSecondId: string | null | undefined;
}): DirectSignPermissionOutcome {
  const {
    templateType,
    authUserId,
    ownerSigned,
    architectSigned,
    projectData,
    projectRowUserId,
    appointedSecondId,
  } = args;
  const hasDualLetters = isDualLetterType(templateType);
  const uid = authUserId.trim();
  const ownerSignerIds = collectOwnerSignerUserIds(projectData, projectRowUserId);
  const secondRoleLabel =
    templateType === "Architect"
      ? "architect"
      : mockSecondSignerLabel(templateType).toLowerCase();

  if (hasDualLetters && architectSigned) {
    throw new Error("This application is already fully signed.");
  }

  if (hasDualLetters && !ownerSigned) {
    if (sameUserId(uid, appointedSecondId) && !isAnySameUserId(uid, ownerSignerIds)) {
      throw new Error("The owner has not signed yet.");
    }
    if (!isAnySameUserId(uid, ownerSignerIds)) {
      throw new Error("Only the project owner can sign at this step.");
    }
  } else if (hasDualLetters && ownerSigned && !architectSigned) {
    if (isAnySameUserId(uid, ownerSignerIds) && !sameUserId(uid, appointedSecondId)) {
      return {
        allowed: false,
        softMessage: `Your signature is already saved. The ${secondRoleLabel} will complete the acceptance letter.`,
      };
    }
    if (!sameUserId(uid, appointedSecondId)) {
      throw new Error(`Only the appointed ${secondRoleLabel} can complete this signature step.`);
    }
    if (!appointedSecondId?.trim()) {
      throw new Error(
        `This project has no appointed ${secondRoleLabel}. Add them on Applicant Details before signing.`
      );
    }
  } else if (!hasDualLetters) {
    if (!isAnySameUserId(uid, ownerSignerIds)) {
      throw new Error("Only the project owner can sign this application.");
    }
  }

  return { allowed: true };
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
  /** For all dual-letter types: `appointment` → default template, `acceptance` → acceptance template. */
  letterVariant?: "appointment" | "acceptance";
  /** @deprecated Use `letterVariant`. */
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
    letterVariant: inputLetterVariant,
    architectHtmlVariant,
  } = input;

  const localMeta = readLocalStoredUserMetadata();
  const templateType = mapSelectedApplicationToTemplate(selectedApplication);

  const [applicantDetailsFromTable, buildingProposalOfficesByKey, fireConsultantOfficesByKey] =
    await Promise.all([
      projectId ? fetchApplicantDetailsFromTable(supabase, projectId) : null,
      fetchBuildingProposalOffices(supabase),
      fetchFireConsultantOffices(supabase),
    ]);
  const effectiveProjectData =
    mergeApplicantDetailsPreferTable(projectData, applicantDetailsFromTable) ?? projectData;

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
  // Owner company: auth.users raw_user_meta_data.entity_name (loaded below), not applicants.entity_name.
  let clientCompanyName = "";
  let clientName =
    (typeof ownerApplicant?.name === "string" ? ownerApplicant.name.trim() : "") ||
    pickPersonFullNameFromMeta(ownerApplicant);
  let clientCompanyDesignation = resolveOwnerEntityTypeForDesignation({
    applicantEntityType:
      ownerApplicant?.entity_type?.trim() ||
      ownerApplicant?.entityType?.trim() ||
      pickEntityTypeFromMeta(ownerApplicant),
    companyName: clientCompanyName,
  });
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

  let consultantLookupUserIds = pickConsultantLookupUserIdsFromProject(
    templateType,
    effectiveProjectData
  );
  if (consultantLookupUserIds.length === 0) {
    const { data: authRow } = await supabase.auth.getUser();
    const role =
      typeof authRow.user?.user_metadata?.role === "string"
        ? authRow.user.user_metadata.role
        : "";
    if (role === "Consultant" && authRow.user?.id) {
      consultantLookupUserIds = [authRow.user.id];
    }
  }

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

  // Always load the appointed consultant profile from server when we know their user id.
  // JWT may have COA/reg only while address/company live in admin user_metadata.
  const consultantProfileLookupIds =
    consultantLookupUserIds.length > 0
      ? consultantLookupUserIds
      : pickConsultantLookupUserIdsFromProject(templateType, effectiveProjectData);
  if (consultantProfileLookupIds.length > 0) {
    const serverMeta = await fetchRawUserMetadataFromApi(
      userMetadata,
      consultantProfileLookupIds
    );
    if (serverMeta) mergeConsultantMeta(serverMeta, true);
  } else if (
    templateType === "Licensed Surveyor"
      ? !lbsLicenseNo || !lbsExpiryDate
      : !coaRegNo || !coaExpiryDate
  ) {
    const serverMeta = await fetchRawUserMetadataFromApi(userMetadata, consultantLookupUserIds);
    if (serverMeta) mergeConsultantMeta(serverMeta);
  }

  const ownerLookupUserIds = [
    ...new Set(
      [
        normalizeLookupId(effectiveProjectData?.user_id),
        ...ownerApplicants.flatMap((owner) => [
          normalizeLookupId(owner.user_id),
          normalizeLookupId(owner.userId),
          normalizeLookupId(owner.id),
          normalizeLookupId((owner as { owner_id?: unknown }).owner_id),
          normalizeLookupId((owner as { ownerId?: unknown }).ownerId),
        ]),
      ].filter(Boolean)
    ),
  ];
  let ownerMetaSnapshot: unknown = null;
  const ownerMetaResults = await Promise.all(
    ownerLookupUserIds.map((ownerLookupUserId) =>
      fetchRawUserMetadataFromApi(userMetadata, [ownerLookupUserId], ownerApplicant?.email)
    )
  );
  for (const ownerMeta of ownerMetaResults) {
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
    const resolvedCompany = pickEntityNameFromMeta(ownerMeta);
    if (resolvedCompany) {
      clientCompanyName = resolvedCompany;
    }
    if (
      clientCompanyDesignation &&
      resolvedCompany &&
      clientCompanyDesignation.trim().toLowerCase() === resolvedCompany.trim().toLowerCase()
    ) {
      clientCompanyDesignation = "";
    }
    const resolvedType = pickEntityTypeFromMeta(ownerMeta);
    if (resolvedType) {
      clientCompanyDesignation = resolveOwnerEntityTypeForDesignation({
        applicantEntityType: clientCompanyDesignation || resolvedType,
        ownerMeta: ownerMeta as Record<string, unknown>,
        companyName: resolvedCompany || clientCompanyName,
      });
    }
    if (clientCompanyDesignation && clientName && clientCompanyName) break;
  }

  if (!clientCompanyDesignation && ownerMetaSnapshot) {
    clientCompanyDesignation = resolveOwnerEntityTypeForDesignation({
      applicantEntityType: pickEntityTypeFromMeta(ownerMetaSnapshot),
      ownerMeta: ownerMetaSnapshot as Record<string, unknown>,
      companyName: clientCompanyName,
    });
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
      ...(fireConsultantOfficesByKey ? { fireConsultantOfficesByKey } : {}),
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
    projectData: effectiveProjectData,
    ...(buildingProposalOfficesByKey
      ? { buildingProposalOfficesByKey }
      : {}),
    ...(fireConsultantOfficesByKey
      ? { fireConsultantOfficesByKey }
      : {}),
    // Pass letterVariant for all types that have an acceptance template.
    ...(TYPES_WITH_ACCEPTANCE.has(templateType)
      ? {
          letterVariant: (inputLetterVariant ?? architectHtmlVariant) ?? "appointment",
        }
      : {}),
  };

  const fieldMapping = mapToPdfFieldValues(fields, previewSource, templateType);
  // #region agent log
  if (templateType === "Architect") {
    const archApplicant = (effectiveProjectData?.applicant_details?.applicants || []).find((a) =>
      (a.applicantType || a.applicant_type || "").toLowerCase().includes("architect")
    );
    fetch("http://127.0.0.1:7676/ingest/9114059f-cf91-488c-b3e8-ff96cf74a24d", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "9d94e9" },
      body: JSON.stringify({
        sessionId: "9d94e9",
        runId: "post-fix",
        hypothesisId: "C",
        location: "application-details/page.tsx:buildApplicationPreviewContext",
        message: "Architect preview context built",
        data: {
          templateType,
          architectUserId: effectiveProjectData?.architect_user_id ?? null,
          consultantLookupUserIds,
          architectApplicantHasUserId: Boolean(archApplicant?.user_id || archApplicant?.userId),
          architectApplicantHasName: Boolean(archApplicant?.name?.trim()),
          architectApplicantHasAddr1: Boolean(archApplicant?.address_line1?.trim()),
          fieldNameArchitect: Boolean(fieldMapping["project_Name_Architect."]?.trim()),
          fieldCompanyArchitect: Boolean(fieldMapping.project_Company_Name_Architect?.trim()),
          fieldAddr1Architect: Boolean(fieldMapping["project_Address_line1_Architect"]?.trim()),
          fieldRegNoArchitect: Boolean(fieldMapping.project_RegNo_Architect?.trim()),
        },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
  }
  // #endregion
  return { fields, previewSource, templateType, fieldMapping };
}

/** All consultant types that have both appointment and acceptance letter templates. */
const TYPES_WITH_ACCEPTANCE = new Set<TemplateType>([
  "Architect",
  "Licensed Surveyor",
  "Fire Safety Consultant",
  "Landscape Consultant",
  "Geotechnical Consultant",
  "M&E Consultant",
  "Plumber",
  "Town Planner",
  "Structural Engineer",
  "Environmental Consultant",
  "PMC / Project Manager",
]);

/** `application_urls` key for each type's acceptance PDF. */
const ACCEPTANCE_URL_KEY_BY_TEMPLATE_TYPE: Partial<Record<TemplateType, string>> = {
  Architect: "Architect_acceptance",
  "Licensed Surveyor": "Licensed_Surveyor_acceptance",
  "Fire Safety Consultant": "Fire_Safety_acceptance",
  "Landscape Consultant": "Landscape_Consultant_acceptance",
  "Geotechnical Consultant": "Geotechnical_Consultant_acceptance",
  "M&E Consultant": "ME_Consultant_acceptance",
  Plumber: "Plumber_acceptance",
  "Town Planner": "Town_Planner_acceptance",
  "Structural Engineer": "Structural_Engineer_acceptance",
  "Environmental Consultant": "Environmental_Consultant_acceptance",
  "PMC / Project Manager": "PMC_Project_Manager_acceptance",
};

const ARCHITECT_ACCEPTANCE_URL_KEY = "Architect_acceptance";

/** Whether this type uses dual letters (appointment + acceptance). */
const isDualLetterType = (t: TemplateType) => TYPES_WITH_ACCEPTANCE.has(t);

function applicationTemplateSavedInUrls(
  raw: unknown,
  templateType: TemplateType
): boolean {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return false;
  const o = raw as Record<string, unknown>;
  const acceptanceKey = ACCEPTANCE_URL_KEY_BY_TEMPLATE_TYPE[templateType];
  if (acceptanceKey) {
    const a = o[templateType];
    const b = o[acceptanceKey];
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

/** Stored PDF URL for preview (dual-letter types: appointment vs acceptance). */
async function fetchProjectApplicationUrls(
  projectId: string,
  seed?: unknown,
  opts?: { forceFresh?: boolean }
): Promise<unknown> {
  if (
    !opts?.forceFresh &&
    seed &&
    typeof seed === "object" &&
    !Array.isArray(seed)
  ) {
    return seed;
  }
  const { data: urlsRow } = await supabase
    .from("projects")
    .select("application_urls")
    .eq("id", projectId)
    .maybeSingle();
  const fromRow = urlsRow?.application_urls;
  if (fromRow && typeof fromRow === "object" && !Array.isArray(fromRow)) {
    return fromRow;
  }
  const { data: rpcData } = await supabase.rpc("get_project_for_preview", {
    p_project_id: projectId,
  });
  if (rpcData && typeof rpcData === "object" && !Array.isArray(rpcData)) {
    return (rpcData as PreviewProjectData).application_urls;
  }
  return undefined;
}

function getStoredApplicationPdfUrl(
  raw: unknown,
  templateType: TemplateType,
  letterVariant: "appointment" | "acceptance" = "appointment"
): string | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  const key =
    letterVariant === "acceptance"
      ? (ACCEPTANCE_URL_KEY_BY_TEMPLATE_TYPE[templateType] ?? templateType)
      : templateType;
  const v = o[key];
  return typeof v === "string" && v.trim().length > 0 ? v.trim() : null;
}

/** Avoid browser showing a cached PDF after owner/architect re-sign overwrites storage. */
function storedPdfUrlWithCacheBuster(
  url: string,
  opts?: { ownerSignedAt?: string | null; architectSignedAt?: string | null }
): string {
  const version = opts?.architectSignedAt?.trim() || opts?.ownerSignedAt?.trim();
  if (!version) return url;
  const sep = url.includes("?") ? "&" : "?";
  return `${url}${sep}v=${encodeURIComponent(version)}`;
}

function resolveStoredPreviewPdfUrl(
  urlsRaw: unknown,
  templateType: TemplateType,
  letterVariant: "appointment" | "acceptance",
  opts?: { ownerSignedAt?: string | null; architectSignedAt?: string | null }
): string | null {
  const storedUrl = getStoredApplicationPdfUrl(urlsRaw, templateType, letterVariant);
  if (!storedUrl) return null;
  return storedPdfUrlWithCacheBuster(storedUrl, opts);
}

type BuiltApplicationPreview = {
  fields: TemplateFields;
  templateType: TemplateType;
  previewSource: ApplicationPreviewSource;
};

/** HTML for save/sign PDFs with QR (stored or predicted public URL). */
async function buildApplicationSavePdfHtml(
  built: BuiltApplicationPreview,
  applicationUrlsKey: string,
  urlsRaw: unknown,
  projectId: string,
  signatures?: { owner: boolean; consultant: boolean; variant?: "appointment" | "acceptance" }
): Promise<string> {
  const savedPdfUrlForQr = resolveSavedPdfUrlForQr(projectId, applicationUrlsKey, urlsRaw);
  let html = await generateApplicationPreviewHtml(built.fields, built.templateType, {
    ...built.previewSource,
    savedPdfUrlForQr,
  });
  if (signatures?.owner) {
    html = injectMockOwnerSignatureIntoPreviewHtml(html, built.templateType);
  }
  if (signatures?.consultant) {
    const variant = signatures.variant ?? built.previewSource.letterVariant ?? "appointment";
    const injectSecondColumn =
      variant === "acceptance" || built.templateType === "Architect";
    if (injectSecondColumn) {
      html = injectMockConsultantSignatureIntoPreviewHtml(html, built.templateType);
    }
  }
  return html;
}

/** One Chromium PDF pass with QR (stored or predicted public URL). */
async function buildApplicationSavePdfBlob(
  built: BuiltApplicationPreview,
  applicationUrlsKey: string,
  urlsRaw: unknown,
  projectId: string,
  signatures?: { owner: boolean; consultant: boolean; variant?: "appointment" | "acceptance" }
): Promise<Blob> {
  const html = await buildApplicationSavePdfHtml(
    built,
    applicationUrlsKey,
    urlsRaw,
    projectId,
    signatures
  );
  return generateApplicationPreviewPdfFromHtml(html, built.templateType);
}

/** Load the PDF for signing for a specific letter (appointment vs acceptance). */
async function loadUnsignedLetterPdfForSigning(params: {
  urlsRaw: unknown;
  urlsKey: string;
  letterVariant: "appointment" | "acceptance";
  previewBase: BuildApplicationPreviewContextInput;
  projectId: string;
  /** Consultant step: must load owner-signed acceptance from storage; never rebuild unsigned. */
  requireOwnerSignedPdf?: boolean;
  /** Bust CDN/browser cache when loading stored PDF (match preview URL versioning). */
  cacheVersion?: string | null;
}): Promise<{ blob: Blob; builtFresh: boolean }> {
  let storedUrl = readApplicationUrlFromUrls(params.urlsRaw, params.urlsKey);
  if (storedUrl && params.cacheVersion?.trim()) {
    storedUrl = storedPdfUrlWithCacheBuster(storedUrl, {
      ownerSignedAt: params.cacheVersion,
    });
  }
  if (storedUrl && /^https?:\/\//.test(storedUrl)) {
    const res = await fetch(storedUrl, { cache: "no-store" });
    if (res.ok) {
      const blob = await res.blob();
      if (params.requireOwnerSignedPdf) {
        const bytes = new Uint8Array(await blob.arrayBuffer());
        const completedSigCount = countCompletedSignatures(bytes);
        if (completedSigCount >= 2) {
          throw new Error(
            "This acceptance PDF already has two digital signatures baked in. " +
              "If Adobe shows Rev. 1 as invalid, that file was produced by an older signing build and cannot be repaired in place. " +
              "Reset the application to draft, save fresh unsigned letters, then have the owner and consultant sign again."
          );
        }
        if (!pdfHasCompletedSignature(bytes)) {
          if (pdfHasUnsignedSignaturePlaceholder(bytes)) {
            throw new Error(
              "The acceptance letter PDF was prepared but the owner's digital signature is not complete. Ask the owner to sign again from IN Process."
            );
          }
          throw new Error(
            "The acceptance letter PDF does not contain the owner's digital signature. " +
              "Use Preview → switch Letter to Acceptance to verify (Appointment may already be signed). " +
              "If the acceptance letter is unsigned, ask the owner to sign again from IN Process — both letters are saved together."
          );
        }
      }
      return { blob, builtFresh: false };
    }
    if (params.requireOwnerSignedPdf) {
      throw new Error(
        "Could not load the owner-signed acceptance PDF. Save and sign as owner first, then try again."
      );
    }
  } else if (params.requireOwnerSignedPdf) {
    throw new Error(
      "Owner-signed acceptance PDF not found. Ask the owner to sign first, then try again."
    );
  }

  const built = await buildApplicationPreviewContext({
    ...params.previewBase,
    letterVariant: params.letterVariant,
  });
  const blob = await buildApplicationSavePdfBlob(
    built,
    params.urlsKey,
    params.urlsRaw,
    params.projectId
  );
  return { blob, builtFresh: true };
}

function dualLetterBuiltContexts(
  base: BuiltApplicationPreview,
  _templateType: TemplateType
): { appointment: BuiltApplicationPreview; acceptance: BuiltApplicationPreview } {
  return {
    appointment: {
      fields: base.fields,
      templateType: base.templateType,
      previewSource: {
        ...base.previewSource,
        letterVariant: "appointment",
        architectHtmlVariant: undefined,
      },
    },
    acceptance: {
      fields: base.fields,
      templateType: base.templateType,
      previewSource: {
        ...base.previewSource,
        letterVariant: "acceptance",
        architectHtmlVariant: "acceptance",
      },
    },
  };
}

/** Appointment + acceptance: one context build, parallel HTML, parallel PDF pages, one upload. */
async function buildDualLetterPdfBlobs(
  previewBase: BuildApplicationPreviewContextInput,
  templateType: TemplateType,
  urlsRaw: unknown,
  signatures?: { owner: boolean; consultant: boolean },
  cachedBase?: BuiltApplicationPreview | null,
  accessToken?: string,
  opts?: { omitSavedPdfQr?: boolean }
): Promise<{
  appointmentBlob: Blob;
  acceptanceBlob: Blob;
  acceptanceKey: string;
}> {
  if (!previewBase.projectId?.trim()) {
    throw new Error("Missing project for PDF save.");
  }
  const projectId = previewBase.projectId;
  const acceptanceKey =
    ACCEPTANCE_URL_KEY_BY_TEMPLATE_TYPE[templateType] ?? `${templateType}_acceptance`;

  const base =
    cachedBase ??
    (await buildApplicationPreviewContext({
      ...previewBase,
      letterVariant: "appointment",
    }));
  const { appointment: appointmentBuilt, acceptance: acceptanceBuilt } =
    dualLetterBuiltContexts(base, templateType);

  const appointmentQr = opts?.omitSavedPdfQr
    ? undefined
    : resolveSavedPdfUrlForQr(projectId, templateType, urlsRaw);
  const acceptanceQr = opts?.omitSavedPdfQr
    ? undefined
    : resolveSavedPdfUrlForQr(projectId, acceptanceKey, urlsRaw);

  const applySignatures = (
    html: string,
    variant: "appointment" | "acceptance"
  ): string => {
    if (!signatures?.owner && !signatures?.consultant) return html;
    let out = html;
    if (signatures.owner) {
      out = injectMockOwnerSignatureIntoPreviewHtml(out, templateType);
    }
    if (
      signatures.consultant &&
      (variant === "acceptance" || consultantSignsAppointmentLetter(templateType))
    ) {
      out = injectMockConsultantSignatureIntoPreviewHtml(out, templateType);
    }
    return out;
  };

  let [appointmentHtml, acceptanceHtml] = await generateApplicationPreviewHtmlBatch(
    [
      {
        fields: appointmentBuilt.fields,
        templateType,
        source: {
          ...appointmentBuilt.previewSource,
          ...(appointmentQr ? { savedPdfUrlForQr: appointmentQr } : {}),
        },
      },
      {
        fields: acceptanceBuilt.fields,
        templateType,
        source: {
          ...acceptanceBuilt.previewSource,
          ...(acceptanceQr ? { savedPdfUrlForQr: acceptanceQr } : {}),
        },
      },
    ],
    accessToken
  );
  appointmentHtml = applySignatures(appointmentHtml, "appointment");
  acceptanceHtml = applySignatures(acceptanceHtml, "acceptance");

  const [appointmentBlob, acceptanceBlob] = await generateApplicationPreviewPdfBatchFromHtml([
    { html: appointmentHtml, templateType },
    { html: acceptanceHtml, templateType },
  ]);

  return { appointmentBlob, acceptanceBlob, acceptanceKey };
}

/** Consultant acceptance step: one PDF + one upload (owner step already saved appointment). */
async function buildAcceptanceLetterPdfBlob(
  previewBase: BuildApplicationPreviewContextInput,
  templateType: TemplateType,
  urlsRaw: unknown,
  signatures: { owner: boolean; consultant: boolean },
  opts?: { omitSavedPdfQr?: boolean }
): Promise<{ acceptanceBlob: Blob; acceptanceKey: string }> {
  if (!previewBase.projectId?.trim()) {
    throw new Error("Missing project for PDF save.");
  }
  const acceptanceKey =
    ACCEPTANCE_URL_KEY_BY_TEMPLATE_TYPE[templateType] ?? `${templateType}_acceptance`;
  const base = await buildApplicationPreviewContext({
    ...previewBase,
    letterVariant: "acceptance",
  });
  const { acceptance: acceptanceBuilt } = dualLetterBuiltContexts(base, templateType);
  const acceptanceQr = opts?.omitSavedPdfQr
    ? undefined
    : resolveSavedPdfUrlForQr(
        previewBase.projectId,
        acceptanceKey,
        urlsRaw
      );
  let acceptanceHtml = await generateApplicationPreviewHtml(
    acceptanceBuilt.fields,
    templateType,
    {
      ...acceptanceBuilt.previewSource,
      ...(acceptanceQr ? { savedPdfUrlForQr: acceptanceQr } : {}),
    }
  );
  if (signatures.owner) {
    acceptanceHtml = injectMockOwnerSignatureIntoPreviewHtml(acceptanceHtml, templateType);
  }
  if (signatures.consultant) {
    acceptanceHtml = injectMockConsultantSignatureIntoPreviewHtml(acceptanceHtml, templateType);
  }
  const [acceptanceBlob] = await generateApplicationPreviewPdfBatchFromHtml([
    { html: acceptanceHtml, templateType },
  ]);
  return { acceptanceBlob, acceptanceKey };
}

async function submitSavedApplicationPdfs(params: {
  projectId: string;
  templateType: TemplateType;
  authToken: string;
  authUserId: string;
  applicationUrlsKey: string;
  appointmentBlob?: Blob;
  acceptanceBlob?: Blob | null;
  acceptanceUrlsKey?: string;
}): Promise<{ publicUrl?: string; publicUrls?: Record<string, string> }> {
  const slug = (key: string) => key.replace(/[/\\]/g, "-").replace(/\s+/g, "_");
  const formData = new FormData();
  formData.append("projectId", params.projectId);
  formData.append("templateType", params.templateType);
  formData.append("user_id", params.authUserId);
  if (params.appointmentBlob) {
    formData.append("pdf", params.appointmentBlob, `${slug(params.applicationUrlsKey)}.pdf`);
    formData.append("applicationUrlsKey", params.applicationUrlsKey);
  }
  if (params.acceptanceBlob && params.acceptanceUrlsKey) {
    formData.append("pdf_acceptance", params.acceptanceBlob, `${slug(params.acceptanceUrlsKey)}.pdf`);
    formData.append("applicationUrlsKey_acceptance", params.acceptanceUrlsKey);
  }

  const response = await fetch("/api/save-application-pdf", {
    method: "POST",
    headers: { Authorization: `Bearer ${params.authToken}` },
    body: formData,
  });

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
    publicUrls?: Record<string, string>;
  } | null;
  return {
    publicUrl:
      typeof jsonBody?.publicUrl === "string" && jsonBody.publicUrl.trim()
        ? jsonBody.publicUrl.trim()
        : undefined,
    publicUrls:
      jsonBody?.publicUrls && typeof jsonBody.publicUrls === "object"
        ? jsonBody.publicUrls
        : undefined,
  };
}

/** Persist appointment + acceptance PDFs for any dual-letter consultant type. */
async function persistDualLetterPdfs(
  previewBase: BuildApplicationPreviewContextInput,
  templateType: TemplateType,
  signatures: { owner: boolean; consultant: boolean },
  auth: { token: string; userId: string },
  opts?: { acceptanceOnly?: boolean },
  cachedBase?: BuiltApplicationPreview | null
): Promise<{ appointmentUrl: string | null; acceptanceUrl: string | null }> {
  let urlsRaw: unknown = previewBase.projectData?.application_urls;
  if (previewBase.projectId?.trim()) {
    const { data: urlsRow } = await supabase
      .from("projects")
      .select("application_urls")
      .eq("id", previewBase.projectId)
      .maybeSingle();
    if (urlsRow?.application_urls != null) urlsRaw = urlsRow.application_urls;
  }

  if (!previewBase.projectId?.trim()) {
    throw new Error("Missing project for PDF save.");
  }

  if (opts?.acceptanceOnly) {
    const qrFreeFirst = dualLetterPdfNeedsQrFreeFirstPass(templateType);
    const runQrRepass = shouldRunLegacyDualLetterQrRepass(templateType, signatures);
    const { acceptanceBlob, acceptanceKey } = await buildAcceptanceLetterPdfBlob(
      previewBase,
      templateType,
      urlsRaw,
      signatures,
      { omitSavedPdfQr: qrFreeFirst }
    );
    await submitSavedApplicationPdfs({
      projectId: previewBase.projectId,
      templateType,
      authToken: auth.token,
      authUserId: auth.userId,
      applicationUrlsKey: templateType,
      acceptanceBlob,
      acceptanceUrlsKey: acceptanceKey,
    });
    if (runQrRepass) {
      const { data: urlsRow } = await supabase
        .from("projects")
        .select("application_urls")
        .eq("id", previewBase.projectId)
        .maybeSingle();
      const urlsAfter = urlsRow?.application_urls;
      const { acceptanceBlob: acceptanceWithQr, acceptanceKey: key2 } =
        await buildAcceptanceLetterPdfBlob(
          previewBase,
          templateType,
          urlsAfter,
          signatures
        );
      await submitSavedApplicationPdfs({
        projectId: previewBase.projectId,
        templateType,
        authToken: auth.token,
        authUserId: auth.userId,
        applicationUrlsKey: templateType,
        acceptanceBlob: acceptanceWithQr,
        acceptanceUrlsKey: key2,
      });
    }
    return { appointmentUrl: null, acceptanceUrl: null };
  }

  const qrFreeFirst = dualLetterPdfNeedsQrFreeFirstPass(templateType);
  const runQrRepass = shouldRunLegacyDualLetterQrRepass(templateType, signatures);
  const { appointmentBlob, acceptanceBlob, acceptanceKey } = await buildDualLetterPdfBlobs(
    previewBase,
    templateType,
    urlsRaw,
    signatures,
    cachedBase,
    auth.token,
    { omitSavedPdfQr: qrFreeFirst }
  );

  const { publicUrl } = await submitSavedApplicationPdfs({
    projectId: previewBase.projectId,
    templateType,
    authToken: auth.token,
    authUserId: auth.userId,
    appointmentBlob,
    applicationUrlsKey: templateType,
    acceptanceBlob,
    acceptanceUrlsKey: acceptanceKey,
  });

  if (runQrRepass) {
    const { data: urlsRow } = await supabase
      .from("projects")
      .select("application_urls")
      .eq("id", previewBase.projectId)
      .maybeSingle();
    const urlsAfter = urlsRow?.application_urls;
    const repass = await buildDualLetterPdfBlobs(
      previewBase,
      templateType,
      urlsAfter,
      undefined,
      cachedBase,
      auth.token
    );
    await submitSavedApplicationPdfs({
      projectId: previewBase.projectId,
      templateType,
      authToken: auth.token,
      authUserId: auth.userId,
      appointmentBlob: repass.appointmentBlob,
      applicationUrlsKey: templateType,
      acceptanceBlob: repass.acceptanceBlob,
      acceptanceUrlsKey: repass.acceptanceKey,
    });
  } else if (qrFreeFirst && (signatures.owner || signatures.consultant)) {
    // #region agent log
    fetch("http://127.0.0.1:7676/ingest/9114059f-cf91-488c-b3e8-ff96cf74a24d", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "9d94e9" },
      body: JSON.stringify({
        sessionId: "9d94e9",
        runId: "post-fix",
        hypothesisId: "G",
        location: "application-details/page.tsx:persistDualLetterPdfs",
        message: "Skipped QR repass on sign (signatures + QR breaks legacy PDF)",
        data: {
          templateType,
          ownerSig: signatures.owner,
          consultantSig: signatures.consultant,
        },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
    // #endregion
  }

  const appointmentUrl =
    typeof publicUrl === "string" && publicUrl.trim() ? publicUrl.trim() : null;

  return { appointmentUrl, acceptanceUrl: null };
}

function fireApplicationNotification(
  appId: string,
  stage: "draft" | "saved" | "in_process" | "approved_verified"
) {
  supabase.auth.getSession().then(({ data: { session } }) => {
    const token = session?.access_token;
    if (token) {
      fetch(`/api/applications/${appId}/notify`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ stage }),
      }).catch((err) =>
        console.error("Application notification request failed:", err)
      );
    }
  });
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
  const [letterVariant, setLetterVariant] = useState<
    "appointment" | "acceptance"
  >("appointment");
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [previewFieldMapping, setPreviewFieldMapping] = useState<Record<string, string | undefined> | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [isSavingPdf, setIsSavingPdf] = useState(false);
  const [isSigningPdf, setIsSigningPdf] = useState(false);
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
  const [applicationAccessState, setApplicationAccessState] = useState<
    "loading" | "granted" | "denied"
  >("loading");
  const [saveSuccessDialogOpen, setSaveSuccessDialogOpen] = useState(false);
  const [applicationPdfSavedDialogOpen, setApplicationPdfSavedDialogOpen] =
    useState(false);
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
  const saveInFlightRef = useRef(false);
  const signInFlightRef = useRef(false);
  const openPreviewForSignRef = useRef<() => Promise<void>>(async () => Promise.resolve());
  const signDirectlyRef = useRef<() => Promise<void>>(async () => Promise.resolve());
  const buildApplicationPreviewPdfBlob = async (
    urlsRaw?: unknown,
    accessToken?: string
  ): Promise<Blob> => {
    const ctx = previewPdfContextRef.current;
    if (!ctx) {
      throw new Error("Preview data is missing. Close the preview and click Preview again.");
    }
    if (!projectId?.trim()) {
      throw new Error("Missing project.");
    }
    const savedPdfUrlForQr = resolveSavedPdfUrlForQr(
      projectId,
      ctx.templateType,
      urlsRaw
    );
    const html = await generateApplicationPreviewHtml(
      ctx.fields,
      ctx.templateType,
      { ...ctx.previewSource, savedPdfUrlForQr },
      accessToken
    );
    return generateApplicationPreviewPdfFromHtml(html, ctx.templateType);
  };

  useEffect(() => {
    if (!isReadOnlyMode || !projectId) return;
    const loadProject = async () => {
      const coreSelect =
        "title,project_info,save_plot_details,applicant_details,user_id,architect_user_id,application_urls";

      const { data: directData, error: directError } = await supabase
        .from("projects")
        .select(coreSelect)
        .eq("id", projectId)
        .single();

      if (!directError && directData) {
        setProjectData(directData as PreviewProjectData);
        return;
      }

      if (directError) {
        console.warn("Direct project select failed, trying get_project_for_preview:", directError.message);
      }

      const { data: rpcData, error: rpcError } = await supabase.rpc("get_project_for_preview", {
        p_project_id: projectId,
      });

      if (rpcData && typeof rpcData === "object" && !Array.isArray(rpcData)) {
        setProjectData(rpcData as PreviewProjectData);
        return;
      }

      if (rpcError) {
        console.error("Failed to load project for preview mapping:", rpcError);
      }
      setProjectData(null);
    };
    void loadProject();
  }, [isReadOnlyMode, projectId]);

  useEffect(() => {
    if (!isReadOnlyMode || !applicationId) return;
    const loadApplication = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.id) {
        console.error("Failed to load application: not authenticated");
        return;
      }

      const { data, error } = await fetchApplicationForSigning(applicationId);
      if (error || !data) {
        console.error("Failed to load application for preview mapping:", error);
        return;
      }
      setApplicationCreatedAt(data.created_at ?? null);
      setApplicationWorkflowStage(normalizeApplicationWorkflowStage(data.workflow_stage));
      setOwnerSignedAt(
        typeof data.owner_signed_at === "string" && data.owner_signed_at.trim()
          ? data.owner_signed_at.trim()
          : null
      );
      setArchitectSignedAt(
        typeof data.architect_signed_at === "string" && data.architect_signed_at.trim()
          ? data.architect_signed_at.trim()
          : null
      );
    };
    void loadApplication();
  }, [isReadOnlyMode, applicationId]);

  useEffect(() => {
    if (!isReadOnlyMode || !applicationId || !projectId) {
      setApplicationAccessState("granted");
      return;
    }
    if (!projectData) return;

    let cancelled = false;
    const verifyAccess = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (cancelled) return;
      if (!user?.id) {
        setApplicationAccessState("denied");
        return;
      }

      const { data, error } = await fetchApplicationForSigning(applicationId);
      if (cancelled) return;
      if (error || !data) {
        setApplicationAccessState("denied");
        return;
      }

      const applicants = projectData?.applicant_details?.applicants ?? [];
      const granted = canUserAccessApplication({
        authUserId: user.id,
        project: projectData,
        applicants,
        permissionType: selectedApplication || data.permission_type || "",
      });
      setApplicationAccessState(granted ? "granted" : "denied");
    };

    setApplicationAccessState("loading");
    void verifyAccess();
    return () => {
      cancelled = true;
    };
  }, [
    isReadOnlyMode,
    applicationId,
    projectId,
    projectData,
    selectedApplication,
  ]);

  const handleAccessDeniedLogout = async () => {
    const returnPath =
      typeof window !== "undefined"
        ? `${window.location.pathname}${window.location.search}`
        : "/userdashboard";
    try {
      await supabase.auth.signOut({ scope: "global" });
      ["consultantId", "consultantUserId", "consultantType", "userMetadata"].forEach(
        (key) => localStorage.removeItem(key)
      );
      sessionStorage.clear();
    } catch (err) {
      console.error("Logout failed:", err);
    }
    router.replace(`/?returnUrl=${encodeURIComponent(returnPath)}`);
  };

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
      }),
    [
      previewTemplateType,
      authUserId,
      ownerSignedAt,
      architectSignedAt,
      projectData,
    ]
  );

  const mockSignMode = useMemo((): "owner_only" | "owner_and_architect" => {
    if (!isDualLetterType(previewTemplateType)) return "owner_only";
    const ownerSigned = Boolean(ownerSignedAt?.trim());
    const secondSigned = Boolean(architectSignedAt?.trim());
    const appointedId = resolveAppointedSecondSignerUserId(projectData, previewTemplateType);
    if (ownerSigned && !secondSigned && authUserId && sameUserId(authUserId, appointedId)) {
      return "owner_and_architect";
    }
    return "owner_only";
  }, [
    previewTemplateType,
    ownerSignedAt,
    architectSignedAt,
    projectData,
    authUserId,
  ]);

  useEffect(() => {
    if (!isReadOnlyMode || !isDualLetterType(previewTemplateType)) return;
    if (applicationWorkflowStage !== "in_process") return;
    if (!ownerSignedAt?.trim() || architectSignedAt?.trim()) return;
    const appointedId = resolveAppointedSecondSignerUserId(projectData, previewTemplateType);
    if (authUserId && sameUserId(authUserId, appointedId)) {
      setLetterVariant("acceptance");
    }
  }, [
    isReadOnlyMode,
    previewTemplateType,
    applicationWorkflowStage,
    ownerSignedAt,
    architectSignedAt,
    projectData,
    authUserId,
  ]);

  const mockSecondSignLabel = useMemo(
    () => mockSecondSignerLabel(previewTemplateType),
    [previewTemplateType]
  );

  const loadPreviewContent = async (
    variant: "appointment" | "acceptance",
    opts?: { keepModalOpen?: boolean; resetSaveState?: boolean }
  ) => {
    const keepModalOpen = opts?.keepModalOpen ?? false;
    const resetSaveState = opts?.resetSaveState ?? !keepModalOpen;

    try {
      setPreviewError(null);
      if (resetSaveState) {
        setSavePdfMessage(null);
        setSavePdfError(null);
        setPreviewReadyForSave(false);
        setPdfSavedForCurrentPreview(false);
        setStoredSigningPdfUrl(null);
        previewPdfContextRef.current = null;
      }

      if (!keepModalOpen) {
        setPreviewOpen(false);
        setPreviewHtml(null);
        setPreviewUrl((prev) => {
          if (prev?.startsWith("blob:")) URL.revokeObjectURL(prev);
          return null;
        });
      }

      setIsPreviewLoading(true);
      if (!keepModalOpen) setPreviewOpen(true);

      let projectForPreview = projectData;
      if (!projectForPreview && projectId) {
        const coreSelect =
          "title,project_info,save_plot_details,applicant_details,user_id,architect_user_id,application_urls";
        const { data: directData } = await supabase
          .from("projects")
          .select(coreSelect)
          .eq("id", projectId)
          .single();
        if (directData) {
          projectForPreview = directData as PreviewProjectData;
          setProjectData(projectForPreview);
        } else {
          const { data: rpcData } = await supabase.rpc("get_project_for_preview", {
            p_project_id: projectId,
          });
          if (rpcData && typeof rpcData === "object" && !Array.isArray(rpcData)) {
            projectForPreview = rpcData as PreviewProjectData;
            setProjectData(projectForPreview);
          }
        }
      }

      if (!projectForPreview) {
        setPreviewError(
          "Project data could not be loaded. Confirm you have access to this project and try again."
        );
        setPreviewOpen(true);
        return;
      }

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
          projectData: projectForPreview,
          selectedApplication,
          applicationNo,
          applicationCreatedAt,
          projectId,
          letterVariant: variant,
        });

      const preferLiveHtmlPreview = prefersLiveHtmlApplicationPreview(templateType);
      const useStoredPdfPreview = shouldUseStoredPdfPreview(
        templateType,
        workflowStageForPreview
      );
      const previewStoredPdf = shouldPreviewStoredApplicationPdf(
        templateType,
        workflowStageForPreview,
        { ownerSignedAt, architectSignedAt }
      );

      // #region agent log
      if (templateType === "Architect") {
        fetch("http://127.0.0.1:7676/ingest/9114059f-cf91-488c-b3e8-ff96cf74a24d", {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "9d94e9" },
          body: JSON.stringify({
            sessionId: "9d94e9",
            runId: "post-fix",
            hypothesisId: "D",
            location: "application-details/page.tsx:loadPreviewContent",
            message: "Architect preview load decision",
            data: {
              workflowStageForPreview,
              preferLiveHtmlPreview,
              useStoredPdfPreview,
              fieldNameArchitect: Boolean(fieldMapping["project_Name_Architect."]?.trim()),
              fieldCompanyArchitect: Boolean(fieldMapping.project_Company_Name_Architect?.trim()),
              fieldAddr1Architect: Boolean(fieldMapping["project_Address_line1_Architect"]?.trim()),
              projectArchitectUserId: projectForPreview?.architect_user_id ?? null,
            },
            timestamp: Date.now(),
          }),
        }).catch(() => {});
      }
      // #endregion

      if (useStoredPdfPreview && projectId) {
        const raw = await fetchProjectApplicationUrls(projectId, projectForPreview.application_urls, {
          forceFresh: true,
        });
        const resolvedVariant = isDualLetterType(templateType) ? variant : "appointment";
        const savedPdfUrl = getStoredApplicationPdfUrl(raw, templateType, resolvedVariant);

        if (savedPdfUrl && previewStoredPdf) {
          const pdfUrl = storedPdfUrlWithCacheBuster(savedPdfUrl, {
            ownerSignedAt,
            architectSignedAt,
          });
          // #region agent log
          if (templateType === "Architect") {
            fetch("http://127.0.0.1:7676/ingest/9114059f-cf91-488c-b3e8-ff96cf74a24d", {
              method: "POST",
              headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "9d94e9" },
              body: JSON.stringify({
                sessionId: "9d94e9",
                runId: "post-fix",
                hypothesisId: "E",
                location: "application-details/page.tsx:loadPreviewContent:storedPdf",
                message: "Using stored PDF for architect preview",
                data: {
                  workflowStageForPreview,
                  resolvedVariant,
                  hasSavedPdfUrl: Boolean(savedPdfUrl),
                  liveFieldNameArchitect: Boolean(fieldMapping["project_Name_Architect."]?.trim()),
                  liveFieldAddr1Architect: Boolean(
                    fieldMapping["project_Address_line1_Architect"]?.trim()
                  ),
                },
                timestamp: Date.now(),
              }),
            }).catch(() => {});
          }
          // #endregion
          previewPdfContextRef.current = { fields, templateType, previewSource };
          setPdfSavedForCurrentPreview(true);
          setPreviewReadyForSave(true);
          setStoredSigningPdfUrl(pdfUrl);
          setPreviewHtml(null);
          setPreviewUrl((prev) => {
            if (prev?.startsWith("blob:")) URL.revokeObjectURL(prev);
            return pdfUrl;
          });
          setPreviewFieldMapping(fieldMapping);
          setPreviewOpen(true);
          return;
        }

        if (workflowStageForPreview === "approved_verified") {
          setPreviewError(
            isDualLetterType(templateType)
              ? `No signed PDF on file for the ${resolvedVariant} letter.`
              : "No signed PDF on file for this application."
          );
          return;
        }
      }

      const resolvedPreviewVariant = isDualLetterType(templateType)
        ? variant
        : "appointment";
      const urlsRawForQr =
        workflowStageForPreview !== "draft" && projectId
          ? await fetchProjectApplicationUrls(projectId, projectForPreview.application_urls, {
              forceFresh: true,
            })
          : undefined;
      const qrKey =
        resolvedPreviewVariant === "acceptance"
          ? (ACCEPTANCE_URL_KEY_BY_TEMPLATE_TYPE[templateType] ?? `${templateType}_acceptance`)
          : templateType;
      const savedPdfUrlForQr =
        projectId && urlsRawForQr
          ? resolveSavedPdfUrlForQr(projectId, qrKey, urlsRawForQr)
          : undefined;
      const storedPdfUrl = urlsRawForQr
        ? getStoredApplicationPdfUrl(urlsRawForQr, templateType, resolvedPreviewVariant)
        : null;
      if (storedPdfUrl) {
        const resolvedStoredUrl = storedPdfUrlWithCacheBuster(storedPdfUrl, {
          ownerSignedAt,
          architectSignedAt,
        });
        setStoredSigningPdfUrl(resolvedStoredUrl);
        if (previewStoredPdf) {
          previewPdfContextRef.current = { fields, templateType, previewSource };
          setPdfSavedForCurrentPreview(true);
          setPreviewReadyForSave(true);
          setPreviewHtml(null);
          setPreviewUrl((prev) => {
            if (prev?.startsWith("blob:")) URL.revokeObjectURL(prev);
            return resolvedStoredUrl;
          });
          setPreviewFieldMapping(fieldMapping);
          setPreviewOpen(true);
          return;
        }
      }

      const { data: previewSessionData } = await supabase.auth.getSession();
      const previewAuthToken = previewSessionData.session?.access_token;

      let html = await generateApplicationPreviewHtml(
        fields,
        templateType,
        savedPdfUrlForQr
          ? { ...previewSource, savedPdfUrlForQr }
          : previewSource,
        previewAuthToken
      );

      if (ownerSignedAt?.trim()) {
        html = injectMockOwnerSignatureIntoPreviewHtml(html, templateType);
      }
      if (
        architectSignedAt?.trim() &&
        (resolvedPreviewVariant === "acceptance" || templateType === "Architect")
      ) {
        html = injectMockConsultantSignatureIntoPreviewHtml(html, templateType);
      }

      if (!html || !html.trim()) {
        setPreviewError("Preview HTML was empty. Check that the template file exists under html/.");
        setPreviewOpen(true);
        return;
      }

      previewPdfContextRef.current = { fields, templateType, previewSource };
      const pdfAlreadySaved =
        workflowStageForPreview !== "draft" && Boolean(storedPdfUrl);
      if (resetSaveState && !pdfAlreadySaved) {
        setPdfSavedForCurrentPreview(false);
      } else if (pdfAlreadySaved) {
        setPdfSavedForCurrentPreview(true);
      }
      setPreviewReadyForSave(true);
      setPreviewUrl((prev) => {
        if (prev?.startsWith("blob:")) URL.revokeObjectURL(prev);
        return null;
      });
      setPreviewHtml(html);
      // #region agent log
      if (templateType === "Architect") {
        fetch("http://127.0.0.1:7676/ingest/9114059f-cf91-488c-b3e8-ff96cf74a24d", {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "9d94e9" },
          body: JSON.stringify({
            sessionId: "9d94e9",
            runId: "post-fix",
            hypothesisId: "E",
            location: "application-details/page.tsx:loadPreviewContent:liveHtml",
            message: "Using live HTML for architect preview",
            data: {
              workflowStageForPreview,
              hasSavedPdfUrlForQr: Boolean(savedPdfUrlForQr),
              pdfAlreadySaved,
            },
            timestamp: Date.now(),
          }),
        }).catch(() => {});
      }
      // #endregion
      setPreviewFieldMapping(fieldMapping);
      setPreviewOpen(true);
    } catch (error: unknown) {
      console.error("Preview generation failed:", error);
      const message = error instanceof Error ? error.message : "Failed to generate preview.";
      setPreviewError(message);
      setPreviewOpen(true);
    } finally {
      setIsPreviewLoading(false);
    }
  };

  const handlePreview = async () => {
    await loadPreviewContent(letterVariant, {
      keepModalOpen: false,
      resetSaveState: true,
    });
  };

  const handleLetterVariantChange = (next: "appointment" | "acceptance") => {
    if (next === letterVariant) return;
    setLetterVariant(next);
    if (previewOpen) {
      void loadPreviewContent(next, { keepModalOpen: true, resetSaveState: false });
    }
  };

  openPreviewForSignRef.current = handlePreview;

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
          letterVariant,
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
    letterVariant,
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
    if (!projectId) return;
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
  }, [projectId]);

  const handleMockSignComplete = async () => {
    if (!projectId) {
      setSavePdfError("Missing project. Open Application Details from your dashboard with a project selected.");
      return;
    }
    if (signInFlightRef.current || isSigningPdf) {
      return;
    }
    signInFlightRef.current = true;

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
      signInFlightRef.current = false;
      return;
    }

    const ctx = previewPdfContextRef.current;
    if (!ctx) {
      setSavePdfError("Preview context is missing. Close the preview and open Preview again.");
      signInFlightRef.current = false;
      return;
    }

    setIsSigningPdf(true);
    setSavePdfMessage(null);
    setSavePdfError(null);
    setSidebarPdfStatus(null);

    try {
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

      const { data: appSignRow, error: appSignErr } = await fetchApplicationForSigning(
        resolvedApplicationId
      );
      if (appSignErr || !appSignRow) {
        throw new Error("Could not load application signing state.");
      }

      let projectRowUserId: string | null =
        typeof projectData?.user_id === "string" ? projectData.user_id : null;
      const hasDualLetters = isDualLetterType(ctx.templateType);
      let appointedSecondId = resolveAppointedSecondSignerUserId(projectData, ctx.templateType);

      if (!projectRowUserId || (hasDualLetters && !appointedSecondId)) {
        const { data: rpcProj } = await supabase.rpc("get_project_for_preview", {
          p_project_id: projectId,
        });
        if (rpcProj && typeof rpcProj === "object" && !Array.isArray(rpcProj)) {
          const rp = rpcProj as PreviewProjectData;
          if (!projectRowUserId && typeof rp.user_id === "string") projectRowUserId = rp.user_id;
          if (!projectData) setProjectData(rp);
          appointedSecondId = resolveAppointedSecondSignerUserId(rp, ctx.templateType) ?? appointedSecondId;
        } else {
          const { data: projSignRow, error: projSignErr } = await supabase
            .from("projects")
            .select("user_id, architect_user_id")
            .eq("id", projectId)
            .single();
          if (projSignErr || !projSignRow) {
            throw new Error("Could not load project for signing permissions.");
          }
          projectRowUserId =
            typeof projSignRow.user_id === "string" ? projSignRow.user_id : projectRowUserId;
          if (!projectData) {
            setProjectData({
              user_id: projSignRow.user_id,
              architect_user_id: projSignRow.architect_user_id,
            } as PreviewProjectData);
          }
          appointedSecondId =
            resolveAppointedSecondSignerUserId(projectData, ctx.templateType) ?? appointedSecondId;
        }
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
      const ownerSignerIds = collectOwnerSignerUserIds(projectData, projectRowUserId);

      const uid = authUser.id;
      const secondRoleLabel =
        ctx.templateType === "Architect"
          ? "architect"
          : mockSecondSignerLabel(ctx.templateType).toLowerCase();

      if (hasDualLetters && architectSigned) {
        throw new Error("This application is already fully signed.");
      }

      if (hasDualLetters && !ownerSigned) {
        if (sameUserId(uid, appointedSecondId) && !isAnySameUserId(uid, ownerSignerIds)) {
          throw new Error("The owner has not signed yet.");
        }
        if (!isAnySameUserId(uid, ownerSignerIds)) {
          throw new Error("Only the project owner can sign at this step.");
        }
      } else if (hasDualLetters && ownerSigned && !architectSigned) {
        if (isAnySameUserId(uid, ownerSignerIds) && !sameUserId(uid, appointedSecondId)) {
          setSavePdfMessage(
            `Your signature is already saved. The ${secondRoleLabel} will complete the acceptance letter.`
          );
          signInFlightRef.current = false;
          setIsSigningPdf(false);
          return;
        }
        if (!sameUserId(uid, appointedSecondId)) {
          throw new Error(
            `Only the appointed ${secondRoleLabel} can complete this signature step.`
          );
        }
        if (!appointedSecondId?.trim()) {
          throw new Error(
            `This project has no appointed ${secondRoleLabel}. Add them on Applicant Details before signing.`
          );
        }
      } else if (!hasDualLetters) {
        if (!isAnySameUserId(uid, ownerSignerIds)) {
          throw new Error("Only the project owner can sign this application.");
        }
      }

      let publicUrl: string | null = null;

      // When the same person is both project owner and the appointed architect,
      // sign both steps in one pass to save time.
      const canSignBoth =
        hasDualLetters &&
        !ownerSigned &&
        Boolean(appointedSecondId) &&
        sameUserId(uid, appointedSecondId) &&
        isAnySameUserId(uid, ownerSignerIds);

      let projectForPdf = projectData;
      if (
        !projectForPdf?.applicant_details ||
        (hasDualLetters && ctx.templateType === "Architect" && !projectForPdf?.architect_user_id)
      ) {
        const coreSelect =
          "title,project_info,save_plot_details,applicant_details,user_id,architect_user_id,application_urls";
        const { data: directData } = await supabase
          .from("projects")
          .select(coreSelect)
          .eq("id", projectId)
          .single();
        if (directData) {
          projectForPdf = directData as PreviewProjectData;
          setProjectData(projectForPdf);
        } else {
          const { data: rpcData } = await supabase.rpc("get_project_for_preview", {
            p_project_id: projectId,
          });
          if (rpcData && typeof rpcData === "object" && !Array.isArray(rpcData)) {
            projectForPdf = rpcData as PreviewProjectData;
            setProjectData(projectForPdf);
          }
        }
      }

      const previewBase: BuildApplicationPreviewContextInput = {
        userMetadata,
        projectData: projectForPdf,
        selectedApplication,
        applicationNo,
        applicationCreatedAt,
        projectId,
      };

      if (hasDualLetters) {
        const consultantSigning = ownerSigned && !architectSigned;
        const consultantDualAppointment =
          consultantSigning && consultantSignsAppointmentLetter(ctx.templateType);
        setSidebarPdfStatus(
          consultantDualAppointment
            ? "Signing acceptance & appointment…"
            : consultantSigning
              ? "Signing acceptance letter…"
              : "Signing appointment & acceptance…"
        );
        const { appointmentUrl } = await persistDualLetterPdfs(
          previewBase,
          ctx.templateType,
          {
            owner: true,
            consultant: consultantSigning || canSignBoth,
          },
          { token: authToken, userId: authUser.id },
          consultantDualAppointment
            ? undefined
            : { acceptanceOnly: consultantSigning },
          {
            fields: ctx.fields,
            templateType: ctx.templateType,
            previewSource: ctx.previewSource,
          }
        );
        publicUrl = appointmentUrl;
        setSidebarPdfStatus(null);

        const nowIso = new Date().toISOString();

        if (!ownerSigned) {
          const signingPatch = canSignBoth
            ? {
                owner_signed_at: nowIso,
                owner_signed_by: uid,
                architect_signed_at: nowIso,
                architect_signed_by: uid,
                workflow_stage: "approved_verified",
              }
            : {
                owner_signed_at: nowIso,
                owner_signed_by: uid,
                workflow_stage: "in_process",
              };

          const { ok, error: updErr } = await updateApplicationForSigning(
            resolvedApplicationId,
            uid,
            signingPatch
          );
          if (updErr || !ok) {
            console.error("Failed to record signature:", updErr);
            throw new Error("PDF saved but signature could not be recorded (check permissions).");
          }

          if (canSignBoth) {
            setApplicationWorkflowStage("approved_verified");
            setOwnerSignedAt(nowIso);
            setArchitectSignedAt(nowIso);
            if (resolvedApplicationId) fireApplicationNotification(resolvedApplicationId, "approved_verified");
          } else {
            setApplicationWorkflowStage("in_process");
            setOwnerSignedAt(nowIso);
            if (resolvedApplicationId) fireApplicationNotification(resolvedApplicationId, "in_process");
          }
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
          const deptOwner =
            typeof appSignRow.department === "string" ? appSignRow.department.trim() : "";
          const dashboardUrlOwner =
            deptOwner.length > 0
              ? `/userdashboard?department=${encodeURIComponent(deptOwner)}`
              : "/userdashboard";
          setPendingDashboardUrl(dashboardUrlOwner);
          if (canSignBoth) {
            setSignedDocSuccessDialogOpen(true);
          } else {
            setSaveSuccessDialogOpen(true);
          }
          return;
        }

        if (ownerSigned && !architectSigned) {
          const { ok, error: updErr } = await updateApplicationForSigning(resolvedApplicationId, uid, {
            architect_signed_at: nowIso,
            architect_signed_by: uid,
            workflow_stage: "approved_verified",
          });
          if (updErr || !ok) {
            console.error("Failed to record consultant signature / stage:", updErr);
            throw new Error(
              "Signed PDF was saved, but the application could not be moved to Approved or Verified (check permissions)."
            );
          }
          setApplicationWorkflowStage("approved_verified");
          setArchitectSignedAt(nowIso);
          if (resolvedApplicationId) fireApplicationNotification(resolvedApplicationId, "approved_verified");
          setPdfSavedForCurrentPreview(true);
          setSavePdfMessage(null);
          if (previewUrl?.startsWith("blob:")) {
            URL.revokeObjectURL(previewUrl);
          }
          if (publicUrl) {
            setPreviewUrl(publicUrl);
            setPreviewHtml(null);
          }
          const dept =
            typeof appSignRow.department === "string" ? appSignRow.department.trim() : "";
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
      } else {
        setSidebarPdfStatus("Signing application…");
        let urlsRawSign: unknown = projectForPdf?.application_urls;
        if (!urlsRawSign && projectId) {
          const { data: urlsRow } = await supabase
            .from("projects")
            .select("application_urls")
            .eq("id", projectId)
            .maybeSingle();
          urlsRawSign = urlsRow?.application_urls;
        }
        const savedPdfUrlForQr = resolveSavedPdfUrlForQr(
          projectId,
          ctx.templateType,
          urlsRawSign
        );
        let signHtml = await generateApplicationPreviewHtml(
          ctx.fields,
          ctx.templateType,
          { ...ctx.previewSource, savedPdfUrlForQr },
          authToken
        );
        signHtml = injectMockOwnerSignatureIntoPreviewHtml(signHtml, ctx.templateType);
        const signedBlob = await generateApplicationPreviewPdfFromHtml(signHtml, ctx.templateType);
        const uploaded = await submitSavedApplicationPdfs({
          projectId,
          templateType: ctx.templateType,
          authToken,
          authUserId: authUser.id,
          appointmentBlob: signedBlob,
          applicationUrlsKey: ctx.templateType,
        });
        publicUrl = uploaded.publicUrl ?? null;
        setSidebarPdfStatus(null);
      }

      if (hasDualLetters) {
        return;
      }

      const nowIso = new Date().toISOString();
      const { ok: signedOk, error: stageErr } = await updateApplicationForSigning(
        resolvedApplicationId,
        uid,
        {
          owner_signed_at: nowIso,
          owner_signed_by: uid,
          workflow_stage: "approved_verified",
        }
      );

      if (stageErr || !signedOk) {
        console.error("Failed to update application workflow_stage:", stageErr);
        setSavePdfError(
          "Signed PDF was saved, but the application could not be moved to Approved or Verified (check permissions)."
        );
        return;
      }

      setApplicationWorkflowStage("approved_verified");
      setOwnerSignedAt(nowIso);
      if (applicationId) fireApplicationNotification(applicationId, "approved_verified");
      setPdfSavedForCurrentPreview(true);
      setSavePdfMessage(null);

      if (previewUrl?.startsWith("blob:")) {
        URL.revokeObjectURL(previewUrl);
      }
      if (publicUrl) {
        setPreviewUrl(publicUrl);
        setPreviewHtml(null);
      }

      const dept =
        typeof appSignRow.department === "string" ? appSignRow.department.trim() : "";
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
      signInFlightRef.current = false;
      setIsSigningPdf(false);
      setSidebarPdfStatus(null);
    }
  };

  /** Sign silently (no preview modal): build context then run the signing pipeline. */
  const handleSignDirectly = async () => {
    if (!projectId) {
      setSavePdfError("Missing project. Open Application Details from your dashboard with a project selected.");
      return;
    }
    if (signInFlightRef.current || isSigningPdf) {
      return;
    }
    signInFlightRef.current = true;
    setIsSigningPdf(true);
    setSavePdfError(null);
    setSavePdfMessage(null);

    let resolvedApplicationId = applicationId;
    try {
      let projectForSign = projectData;
      if (!projectForSign) {
        const coreSelect =
          "title,project_info,save_plot_details,applicant_details,user_id,architect_user_id,application_urls";
        const { data: directData } = await supabase
          .from("projects")
          .select(coreSelect)
          .eq("id", projectId)
          .single();
        if (directData) {
          projectForSign = directData as PreviewProjectData;
          setProjectData(projectForSign);
        } else {
          const { data: rpcData } = await supabase.rpc("get_project_for_preview", {
            p_project_id: projectId,
          });
          if (rpcData && typeof rpcData === "object" && !Array.isArray(rpcData)) {
            projectForSign = rpcData as PreviewProjectData;
            setProjectData(projectForSign);
          }
        }
      }
      if (!projectForSign) {
        throw new Error("Project data could not be loaded.");
      }

      resolvedApplicationId = applicationId;
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
        throw new Error(
          "Missing application id. Use Application Details from the user dashboard (application number link)."
        );
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
      if (!authToken) throw new Error("Missing session token. Please log in again.");

      const { data: appSignRow, error: appSignErr } = await fetchApplicationForSigning(
        resolvedApplicationId
      );
      if (appSignErr || !appSignRow) {
        throw new Error("Could not load application signing state.");
      }

      const templateTypeForSign = mapSelectedApplicationToTemplate(selectedApplication);
      const isDualForSign = isDualLetterType(templateTypeForSign);
      const ownerAlreadySignedForContext =
        typeof appSignRow.owner_signed_at === "string" &&
        appSignRow.owner_signed_at.trim().length > 0;
      const signingLetterVariant: "appointment" | "acceptance" =
        isDualForSign && ownerAlreadySignedForContext ? "acceptance" : "appointment";

      const previewBase: BuildApplicationPreviewContextInput = {
        userMetadata,
        projectData: projectForSign,
        selectedApplication,
        applicationNo,
        applicationCreatedAt,
        projectId,
      };

      const { fields, previewSource, templateType } = await buildApplicationPreviewContext({
        ...previewBase,
        letterVariant: signingLetterVariant,
      });

      previewPdfContextRef.current = { fields, templateType, previewSource };

      const ctx = previewPdfContextRef.current;
      let urlsRaw: unknown = projectForSign.application_urls;
      if (projectId) {
        const { data: urlsRow } = await supabase
          .from("projects")
          .select("application_urls")
          .eq("id", projectId)
          .maybeSingle();
        urlsRaw = urlsRow?.application_urls ?? urlsRaw;
      }

      const ownerSignedAtRow =
        typeof appSignRow.owner_signed_at === "string" && appSignRow.owner_signed_at.trim().length > 0
          ? appSignRow.owner_signed_at
          : null;
      const architectSignedAtRow =
        typeof appSignRow.architect_signed_at === "string" &&
        appSignRow.architect_signed_at.trim().length > 0
          ? appSignRow.architect_signed_at
          : null;
      const appointedSecondId = resolveAppointedSecondSignerUserId(
        projectForSign,
        ctx.templateType
      );
      const permission = checkDirectSignPermissions({
        templateType: ctx.templateType,
        authUserId: authUser.id,
        ownerSigned: Boolean(ownerSignedAtRow),
        architectSigned: Boolean(architectSignedAtRow),
        projectData: projectForSign,
        projectRowUserId: projectForSign.user_id,
        appointedSecondId,
      });
      if (!permission.allowed) {
        setSavePdfMessage(permission.softMessage);
        signInFlightRef.current = false;
        setIsSigningPdf(false);
        setSidebarPdfStatus(null);
        return;
      }

      const isDual = isDualLetterType(ctx.templateType);
      const ownerAlreadySigned = Boolean(ownerSignedAtRow);
      const signingAcceptance = isDual && ownerAlreadySigned;
      const consultantDualAppointment =
        signingAcceptance && consultantSignsAppointmentLetter(ctx.templateType);
      setSidebarPdfStatus(
        consultantDualAppointment
          ? "Signing acceptance & appointment with DSC…"
          : "Signing application with DSC…"
      );
      const primaryLetterVariant: "appointment" | "acceptance" = signingAcceptance
        ? "acceptance"
        : "appointment";
      const key = signingAcceptance
        ? (ACCEPTANCE_URL_KEY_BY_TEMPLATE_TYPE[ctx.templateType] ?? `${ctx.templateType}_acceptance`)
        : ctx.templateType;

      const { blob: unsignedBlob, builtFresh: primaryBuiltFresh } =
        await loadUnsignedLetterPdfForSigning({
          urlsRaw,
          urlsKey: key,
          letterVariant: primaryLetterVariant,
          previewBase,
          projectId,
          requireOwnerSignedPdf: signingAcceptance,
          cacheVersion: ownerSignedAtRow,
        });
      if (primaryBuiltFresh && !signingAcceptance) {
        const seeded = await submitSavedApplicationPdfs({
          projectId,
          templateType: ctx.templateType,
          authToken,
          authUserId: authUser.id,
          appointmentBlob: unsignedBlob,
          applicationUrlsKey: key,
        });
        if (seeded.publicUrl) {
          urlsRaw = {
            ...(urlsRaw && typeof urlsRaw === "object" && !Array.isArray(urlsRaw)
              ? (urlsRaw as Record<string, string>)
              : {}),
            ...(seeded.publicUrls ?? { [key]: seeded.publicUrl }),
          };
        }
      }
      const signFileName = signingAcceptance
        ? `${ctx.templateType.replace(/[/\\]/g, "-")}-acceptance-consultant.pdf`
        : `${ctx.templateType.replace(/[/\\]/g, "-")}-application.pdf`;
      const signedBlob = await signPdfBlobWithDsc(
        unsignedBlob,
        signFileName,
        undefined,
        ctx.templateType,
        signingAcceptance,
        signingAcceptance ? { role: "consultant", layout: "dualColumn" } : undefined
      );

      let acceptanceUpload: { acceptanceBlob?: Blob; acceptanceUrlsKey?: string } = {};
      let appointmentUpload: { appointmentBlob?: Blob; applicationUrlsKey?: string } = {};

      if (consultantDualAppointment) {
        const acceptanceKey =
          ACCEPTANCE_URL_KEY_BY_TEMPLATE_TYPE[ctx.templateType] ?? `${ctx.templateType}_acceptance`;
        acceptanceUpload = {
          acceptanceBlob: signedBlob,
          acceptanceUrlsKey: acceptanceKey,
        };
        const { blob: appointmentUnsigned } = await loadUnsignedLetterPdfForSigning({
          urlsRaw,
          urlsKey: ctx.templateType,
          letterVariant: "appointment",
          previewBase,
          projectId,
          requireOwnerSignedPdf: true,
          cacheVersion: ownerSignedAtRow,
        });
        const signedAppointment = await signPdfBlobWithDsc(
          appointmentUnsigned,
          `${ctx.templateType.replace(/[/\\]/g, "-")}-appointment-consultant.pdf`,
          undefined,
          ctx.templateType,
          false,
          { role: "consultant", layout: "dualColumn" }
        );
        appointmentUpload = {
          appointmentBlob: signedAppointment,
          applicationUrlsKey: ctx.templateType,
        };
      } else if (isDual && !signingAcceptance) {
        const acceptanceKey =
          ACCEPTANCE_URL_KEY_BY_TEMPLATE_TYPE[ctx.templateType] ?? `${ctx.templateType}_acceptance`;
        const { blob: acceptanceUnsigned, builtFresh: acceptanceBuiltFresh } =
          await loadUnsignedLetterPdfForSigning({
            urlsRaw,
            urlsKey: acceptanceKey,
            letterVariant: "acceptance",
            previewBase,
            projectId,
          });
        if (acceptanceBuiltFresh) {
          const seededAcceptance = await submitSavedApplicationPdfs({
            projectId,
            templateType: ctx.templateType,
            authToken,
            authUserId: authUser.id,
            applicationUrlsKey: ctx.templateType,
            acceptanceBlob: acceptanceUnsigned,
            acceptanceUrlsKey: acceptanceKey,
          });
          if (seededAcceptance.publicUrls) {
            urlsRaw = {
              ...(urlsRaw && typeof urlsRaw === "object" && !Array.isArray(urlsRaw)
                ? (urlsRaw as Record<string, string>)
                : {}),
              ...seededAcceptance.publicUrls,
            };
          }
        }
        const signedAcceptance = await signPdfBlobWithDsc(
          acceptanceUnsigned,
          `${ctx.templateType.replace(/[/\\]/g, "-")}-acceptance.pdf`,
          undefined,
          ctx.templateType,
          false,
          { role: "owner", layout: "dualColumn" }
        );
        acceptanceUpload = {
          acceptanceBlob: signedAcceptance,
          acceptanceUrlsKey: acceptanceKey,
        };
      }

      const uploaded = await submitSavedApplicationPdfs({
        projectId,
        templateType: ctx.templateType,
        authToken,
        authUserId: authUser.id,
        appointmentBlob: consultantDualAppointment
          ? appointmentUpload.appointmentBlob
          : signedBlob,
        applicationUrlsKey: consultantDualAppointment
          ? appointmentUpload.applicationUrlsKey!
          : key,
        ...acceptanceUpload,
      });

      const nowIso = new Date().toISOString();
      const patch = signingAcceptance
        ? {
            architect_signed_at: nowIso,
            architect_signed_by: authUser.id,
            workflow_stage: "approved_verified" as const,
          }
        : isDual
          ? {
              owner_signed_at: nowIso,
              owner_signed_by: authUser.id,
              workflow_stage: "in_process" as const,
            }
          : {
              owner_signed_at: nowIso,
              owner_signed_by: authUser.id,
              workflow_stage: "approved_verified" as const,
            };

      const { ok, error } = await updateApplicationForSigning(resolvedApplicationId, authUser.id, patch);
      if (!ok || error) {
        throw new Error(
          "Signed PDF was saved, but application stage update failed. Please retry once."
        );
      }

      setPdfSavedForCurrentPreview(true);
      setSavePdfMessage(null);
      setSavePdfError(null);
      const mergedUrls =
        uploaded.publicUrls ??
        (uploaded.publicUrl ? { [key]: uploaded.publicUrl } : undefined);
      const previewVariant = signingAcceptance
        ? "acceptance"
        : isDual
          ? letterVariant
          : "appointment";
      const previewStoredUrl =
        mergedUrls != null
          ? getStoredApplicationPdfUrl(mergedUrls, ctx.templateType, previewVariant)
          : uploaded.publicUrl;
      if (previewStoredUrl) {
        const pdfUrl = storedPdfUrlWithCacheBuster(previewStoredUrl, {
          ownerSignedAt: patch.workflow_stage === "in_process" ? nowIso : ownerSignedAt,
          architectSignedAt:
            patch.workflow_stage === "approved_verified" && signingAcceptance
              ? nowIso
              : architectSignedAt,
        });
        setStoredSigningPdfUrl(pdfUrl);
        setPreviewHtml(null);
        setPreviewUrl((prev) => {
          if (prev?.startsWith("blob:")) URL.revokeObjectURL(prev);
          return pdfUrl;
        });
      }
      if (signingAcceptance) {
        setLetterVariant("acceptance");
      }

      if (patch.workflow_stage === "in_process") {
        setApplicationWorkflowStage("in_process");
        setOwnerSignedAt(nowIso);
        fireApplicationNotification(resolvedApplicationId, "in_process");
        setSaveSuccessDialogOpen(true);
      } else {
        setApplicationWorkflowStage("approved_verified");
        if (signingAcceptance) setArchitectSignedAt(nowIso);
        else setOwnerSignedAt(nowIso);
        fireApplicationNotification(resolvedApplicationId, "approved_verified");
        setSignedDocSuccessDialogOpen(true);
      }
      setPreviewOpen(false);
    } catch (err: unknown) {
      const mapped = mapBridgeError(err);
      const message = mapped.hint ? `${mapped.message} ${mapped.hint}` : mapped.message;
      setSavePdfError(message);
      throw err;
    } finally {
      signInFlightRef.current = false;
      setIsSigningPdf(false);
      setSidebarPdfStatus(null);
    }
  };

  signDirectlyRef.current = handleSignDirectly;

  const handleSaveApplicationPdf = async () => {
    if (!projectId) {
      setSavePdfError("Missing project.");
      return;
    }
    if (saveInFlightRef.current || isSavingPdf) {
      return;
    }
    saveInFlightRef.current = true;
    setIsSavingPdf(true);
    setSavePdfMessage(null);
    setSavePdfError(null);
    setSidebarPdfStatus(null);
    const stageBeforeSave = applicationWorkflowStage;
    try {
      let ctx = previewPdfContextRef.current;
      // #region agent log
      fetch("http://127.0.0.1:7676/ingest/9114059f-cf91-488c-b3e8-ff96cf74a24d", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "9d94e9" },
        body: JSON.stringify({
          sessionId: "9d94e9",
          runId: "post-fix",
          hypothesisId: "A",
          location: "application-details/page.tsx:handleSaveApplicationPdf:entry",
          message: "Save application clicked",
          data: {
            stageBeforeSave,
            ctxCached: Boolean(ctx),
            projectArchitectUserId: projectData?.architect_user_id ?? null,
            stateHasApplicantDetails: Boolean(projectData?.applicant_details?.applicants?.length),
            selectedApplication,
          },
          timestamp: Date.now(),
        }),
      }).catch(() => {});
      // #endregion
      const saveTemplateType = mapSelectedApplicationToTemplate(selectedApplication);
      const mustRefreshContextForSave =
        stageBeforeSave === "draft" && isDualLetterType(saveTemplateType);
      if (mustRefreshContextForSave || !ctx) {
        let projectForSave = projectData;
        if (projectId) {
          const coreSelect =
            "title,project_info,save_plot_details,applicant_details,user_id,architect_user_id,application_urls";
          const { data: directData } = await supabase
            .from("projects")
            .select(coreSelect)
            .eq("id", projectId)
            .single();
          if (directData) {
            projectForSave = directData as PreviewProjectData;
            setProjectData(projectForSave);
          } else {
            const { data: rpcData } = await supabase.rpc("get_project_for_preview", {
              p_project_id: projectId,
            });
            if (rpcData && typeof rpcData === "object" && !Array.isArray(rpcData)) {
              projectForSave = rpcData as PreviewProjectData;
              setProjectData(projectForSave);
            }
          }
        }
        const built = await buildApplicationPreviewContext({
          userMetadata,
          projectData: projectForSave,
          selectedApplication,
          applicationNo,
          applicationCreatedAt,
          projectId,
          letterVariant,
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

      // #region agent log
      if (ctx.templateType === "Architect") {
        const saveFieldMapping = mapToPdfFieldValues(ctx.fields, ctx.previewSource, ctx.templateType);
        fetch("http://127.0.0.1:7676/ingest/9114059f-cf91-488c-b3e8-ff96cf74a24d", {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "9d94e9" },
          body: JSON.stringify({
            sessionId: "9d94e9",
            runId: "post-fix",
            hypothesisId: "B",
            location: "application-details/page.tsx:handleSaveApplicationPdf:preUpload",
            message: "Architect fields at save time",
            data: {
              ctxCachedAtSave: Boolean(previewPdfContextRef.current === ctx),
              previewSourceArchitectUserId: ctx.previewSource.projectData?.architect_user_id ?? null,
              consultantLookupUserIds: ctx.previewSource.consultantLookupUserIds ?? [],
              fieldNameArchitect: Boolean(saveFieldMapping["project_Name_Architect."]?.trim()),
              fieldCompanyArchitect: Boolean(saveFieldMapping.project_Company_Name_Architect?.trim()),
              fieldAddr1Architect: Boolean(saveFieldMapping["project_Address_line1_Architect"]?.trim()),
              fieldRegNoArchitect: Boolean(saveFieldMapping.project_RegNo_Architect?.trim()),
              isDualLetterDraft: stageBeforeSave === "draft" && isDualLetterType(ctx.templateType),
            },
            timestamp: Date.now(),
          }),
        }).catch(() => {});
      }
      // #endregion

      const uploadPdfBlob = async (pdfBlob: Blob, applicationUrlsKey: string) => {
        await submitSavedApplicationPdfs({
          projectId,
          templateType: ctx.templateType,
          authToken,
          authUserId: authUser.id,
          appointmentBlob: pdfBlob,
          applicationUrlsKey,
        });
      };

      const fetchApplicationUrls = async (): Promise<unknown> => {
        const { data: urlsRow } = await supabase
          .from("projects")
          .select("application_urls")
          .eq("id", projectId)
          .maybeSingle();
        return urlsRow?.application_urls;
      };

      if (stageBeforeSave === "draft" && isDualLetterType(ctx.templateType)) {
        setSidebarPdfStatus("Saving appointment & acceptance…");
        const urlsBeforeSave = await fetchApplicationUrls();

        const previewBase: BuildApplicationPreviewContextInput = {
          userMetadata,
          projectData,
          selectedApplication,
          applicationNo,
          applicationCreatedAt,
          projectId,
        };

        const cachedBase: BuiltApplicationPreview = {
          fields: ctx.fields,
          templateType: ctx.templateType,
          previewSource: ctx.previewSource,
        };

        const { appointment: appointmentCtx, acceptance: acceptanceCtx } = dualLetterBuiltContexts(
          cachedBase,
          ctx.templateType
        );
        // Save appointment first using the same single-pass renderer as the
        // stable in-process flow, then save acceptance against fresh URLs.
        const appointmentBlob = await buildApplicationSavePdfBlob(
          appointmentCtx,
          ctx.templateType,
          urlsBeforeSave,
          projectId
        );
        await submitSavedApplicationPdfs({
          projectId,
          templateType: ctx.templateType,
          authToken,
          authUserId: authUser.id,
          appointmentBlob,
          applicationUrlsKey: ctx.templateType,
        });

        const urlsAfterAppointment = await fetchApplicationUrls();
        const acceptanceKey =
          ACCEPTANCE_URL_KEY_BY_TEMPLATE_TYPE[ctx.templateType] ?? `${ctx.templateType}_acceptance`;
        const acceptanceBlob = await buildApplicationSavePdfBlob(
          acceptanceCtx,
          acceptanceKey,
          urlsAfterAppointment,
          projectId
        );
        await submitSavedApplicationPdfs({
          projectId,
          templateType: ctx.templateType,
          authToken,
          authUserId: authUser.id,
          applicationUrlsKey: ctx.templateType,
          acceptanceBlob,
          acceptanceUrlsKey: acceptanceKey,
        });

        setPdfSavedForCurrentPreview(true);
        setSidebarPdfStatus(null);

        void (async () => {
          const urlsAfterSave = await fetchApplicationUrls();
          const pdfUrl = resolveStoredPreviewPdfUrl(
            urlsAfterSave,
            ctx.templateType,
            letterVariant,
            { ownerSignedAt, architectSignedAt }
          );
          if (!pdfUrl) return;
          setStoredSigningPdfUrl(pdfUrl);
          setPreviewHtml(null);
          setPreviewUrl((prev) => {
            if (prev?.startsWith("blob:")) URL.revokeObjectURL(prev);
            return pdfUrl;
          });
        })();
      } else {
        const urlsRaw = await fetchApplicationUrls();
        const blob = await buildApplicationPreviewPdfBlob(urlsRaw, authToken);
        await uploadPdfBlob(blob, ctx.templateType);
        setPdfSavedForCurrentPreview(true);

        void (async () => {
          const urlsAfterSave = await fetchApplicationUrls();
          const pdfUrl = resolveStoredPreviewPdfUrl(
            urlsAfterSave,
            ctx.templateType,
            "appointment",
            { ownerSignedAt, architectSignedAt }
          );
          if (!pdfUrl) return;
          setStoredSigningPdfUrl(pdfUrl);
          setPreviewHtml(null);
          setPreviewUrl((prev) => {
            if (prev?.startsWith("blob:")) URL.revokeObjectURL(prev);
            return pdfUrl;
          });
        })();
      }

      if (applicationId && stageBeforeSave === "draft") {
        setPreviewOpen(false);
        setSavePdfMessage(null);

        const ownerIdForStage = await getAuthUserId();
        const { ok: stageOk, error: stageErr } = ownerIdForStage
          ? await updateApplicationForSigning(applicationId, ownerIdForStage, {
              workflow_stage: "in_process",
            })
          : { ok: false, error: new Error("Not signed in") };

        if (stageErr || !stageOk) {
          console.error("Failed to update application workflow_stage:", stageErr);
          setSavePdfMessage(
            "Application PDF saved. Could not move application to In Process (check DB migration / permissions)."
          );
        } else {
          setApplicationWorkflowStage("in_process");
          fireApplicationNotification(applicationId, "saved");

          let deptApp: { department?: string } | null = null;
          if (ownerIdForStage) {
            const deptFetch = await fetchApplicationForSigning(applicationId);
            deptApp = deptFetch.data;
          }
          const dept =
            typeof deptApp?.department === "string" ? deptApp.department.trim() : "";
          const dashboardUrl =
            dept.length > 0
              ? `/userdashboard?department=${encodeURIComponent(dept)}`
              : "/userdashboard";
          setPendingDashboardUrl(dashboardUrl);
          setApplicationPdfSavedDialogOpen(true);
        }
      } else {
        setSavePdfMessage("Application PDF saved to project.");
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to save PDF.";
      setSavePdfError(message);
    } finally {
      saveInFlightRef.current = false;
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
        isDualLetterType(previewTemplateType)
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
        await signDirectlyRef.current();
      },
      disabled: isSavingPdf || isSigningPdf,
      busy: isSigningPdf,
      subtitle: avail.subtitle,
      statusText: sidebarPdfStatus ?? undefined,
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
    isSavingPdf,
    isSigningPdf,
    sidebarPdfStatus,
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

  if (applicationAccessState === "loading") {
    return (
      <div className="max-w-6xl mx-auto px-6 pt-8 flex justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-emerald-600" />
      </div>
    );
  }

  if (applicationAccessState === "denied") {
    return (
      <div className="max-w-6xl mx-auto px-6 pt-8 space-y-6">
        <section className="border border-red-200 rounded-2xl bg-white shadow-sm p-6">
          <h2 className="text-xl font-bold text-gray-900">Access denied</h2>
          <p className="text-sm text-gray-600 mt-2">
            You do not have permission to view this application, or you may be signed in with the
            wrong account. Please log in with the owner or consultant account that received the
            notification email.
          </p>
          <button
            type="button"
            onClick={() => void handleAccessDeniedLogout()}
            className="mt-4 px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 transition-colors"
          >
            Log out and sign in with another account
          </button>
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
            {isDualLetterType(previewTemplateType) && (
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <span className="whitespace-nowrap">Letter</span>
                <select
                  value={letterVariant}
                  onChange={(e) =>
                    handleLetterVariantChange(
                      e.target.value === "acceptance" ? "acceptance" : "appointment"
                    )
                  }
                  className="rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-900 min-w-[11rem]"
                  aria-label="Letter type"
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
        isLoading={isPreviewLoading}
        loadError={previewError}
        title={selectedApplication ? `${selectedApplication} Preview` : "Application Preview"}
        autoMockSignAfterOpen={autoMockSignAfterPreviewOpen}
        mockSignMode={mockSignMode}
        mockSecondSignLabel={mockSecondSignLabel}
        onSave={projectId ? handleSaveApplicationPdf : undefined}
        isSaving={isSavingPdf}
        saveDisabled={!projectId || !previewReadyForSave}
        saveCompleted={pdfSavedForCurrentPreview}
        storedPdfDownloadUrl={storedSigningPdfUrl}
        saveFeedbackError={savePdfError}
        saveFeedbackSuccess={savePdfError ? null : savePdfMessage}
        hideSaveButton={true}
        showMockSignButton={
          applicationWorkflowStage === "in_process" && mockSignAvailability.actionAvailable
        }
        onMockSignComplete={handleMockSignComplete}
        mockSignBusy={isSigningPdf}
        showLetterVariantSelector={isDualLetterType(previewTemplateType)}
        letterVariant={letterVariant}
        onLetterVariantChange={handleLetterVariantChange}
        letterVariantDisabled={isPreviewLoading || isSavingPdf || isSigningPdf}
      />

      {applicationPdfSavedDialogOpen && (
        <div
          className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="application-pdf-saved-title"
        >
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 border border-gray-200">
            <h2 id="application-pdf-saved-title" className="text-lg font-semibold text-gray-900">
              Application saved
            </h2>
            <p className="text-sm text-gray-600 mt-3">
              Your application PDF has been saved to the project. The application is now in{" "}
              <span className="font-medium text-gray-800">In Process</span>.
            </p>
            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={() => {
                  setApplicationPdfSavedDialogOpen(false);
                  const url = pendingDashboardUrl ?? "/userdashboard";
                  setPendingDashboardUrl(null);
                  router.push(url);
                }}
                className="px-5 py-2 rounded-lg bg-gradient-to-r from-emerald-800 to-emerald-500 hover:from-emerald-900 hover:to-emerald-600 text-white shadow-sm hover:shadow-md transition-all text-sm font-semibold"
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}

      {saveSuccessDialogOpen && (
        <div
          className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="save-success-title"
        >
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 border border-gray-200">
            <h2 id="save-success-title" className="text-lg font-semibold text-gray-900">
              Application signed
            </h2>
            <p className="text-sm text-gray-600 mt-3">
              Your application has been signed and saved. The application is now in{" "}
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
                className="px-5 py-2 rounded-lg bg-gradient-to-r from-emerald-800 to-emerald-500 hover:from-emerald-900 hover:to-emerald-600 text-white shadow-sm hover:shadow-md transition-all text-sm font-semibold"
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
                className="px-5 py-2 rounded-lg bg-gradient-to-r from-emerald-800 to-emerald-500 hover:from-emerald-900 hover:to-emerald-600 text-white shadow-sm hover:shadow-md transition-all text-sm font-semibold"
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

