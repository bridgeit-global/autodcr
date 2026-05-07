"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import DocumentPreviewModal from "@/app/components/DocumentPreviewModal";
import { useUserMetadata } from "@/app/contexts/UserContext";
import { supabase } from "@/app/utils/supabase";
import {
  generateApplicationPreviewHtml,
  mapApplicationPreviewFields,
  mapToPdfFieldValues,
  mapSelectedApplicationToTemplate,
  pickConsultantLookupUserIdsFromProject,
  prewarmPreviewPdfRuntime,
} from "@/app/templates/applicationPreview";

type PreviewProjectData = {
  title?: string;
  project_info?: {
    proposalNo?: string;
    fullNameOfApplicant?: string;
    propertyAddress?: string;
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

export default function ApplicationDetailsPage() {
  const { userMetadata } = useUserMetadata();
  const searchParams = useSearchParams();
  const selectedApplication = searchParams.get("selectedApplication");
  const applicationNo = searchParams.get("applicationNo");
  const applicationId = searchParams.get("applicationId");
  const projectId = searchParams.get("projectId");
  const isReadOnlyMode = searchParams.get("mode") === "readonly";
  const [projectData, setProjectData] = useState<PreviewProjectData | null>(null);
  const [applicationCreatedAt, setApplicationCreatedAt] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [previewFieldMapping, setPreviewFieldMapping] = useState<Record<string, string | undefined> | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);

  useEffect(() => {
    if (!isReadOnlyMode || !projectId) return;
    const loadProject = async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("title,project_info,save_plot_details,applicant_details")
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
        .select("created_at")
        .eq("id", applicationId)
        .single();
      if (error) {
        console.error("Failed to load application created_at for preview mapping:", error);
        return;
      }
      setApplicationCreatedAt(data?.created_at ?? null);
    };
    void loadApplication();
  }, [isReadOnlyMode, applicationId]);

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
      setIsPreviewLoading(true);

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
      };

      // Always release the previous blob URL before opening a new preview.
      if (previewUrl?.startsWith("blob:")) {
        URL.revokeObjectURL(previewUrl);
      }

      // Global HTML iframe path for all consultant templates.
      const fieldMapping = mapToPdfFieldValues(fields, previewSource, templateType);
      const html = await generateApplicationPreviewHtml(
        fields,
        templateType,
        previewSource
      );
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
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-xl font-bold text-gray-900">Application Details</h2>
          <button
            type="button"
            onClick={handlePreview}
            disabled={isPreviewLoading}
            className="px-4 py-2 rounded-lg border border-emerald-300 bg-emerald-50 text-emerald-700 text-sm font-semibold hover:bg-emerald-100 transition-colors"
          >
            {isPreviewLoading ? "Generating..." : "Preview"}
          </button>
        </div>
        <p className="text-sm text-gray-600 mt-1">
          Read-only details for the selected application.
        </p>
        {previewError && (
          <p className="text-sm text-red-600 mt-3">{previewError}</p>
        )}

        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Application</p>
            <p className="text-sm font-semibold text-gray-900 mt-1 break-words">
              {selectedApplication || "-"}
            </p>
          </div>

          <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Application No</p>
            <p className="text-sm font-semibold text-gray-900 mt-1 break-all">
              {applicationNo || "-"}
            </p>
          </div>

          <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 md:col-span-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Application ID</p>
            <p className="text-sm text-gray-800 mt-1 break-all">{applicationId || "-"}</p>
          </div>
        </div>
      </section>

      <DocumentPreviewModal
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        fileUrl={previewUrl}
        htmlContent={previewHtml}
        fieldMapping={previewFieldMapping}
        title={selectedApplication ? `${selectedApplication} Preview` : "Application Preview"}
      />
    </div>
  );
}

