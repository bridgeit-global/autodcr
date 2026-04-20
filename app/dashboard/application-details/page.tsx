"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import DocumentPreviewModal from "@/app/components/DocumentPreviewModal";
import { useUserMetadata } from "@/app/contexts/UserContext";
import { supabase } from "@/app/utils/supabase";
import {
  generateApplicationPreviewPdf,
  mapApplicationPreviewFields,
  mapSelectedApplicationToTemplate,
  pickConsultantLookupUserIdsFromProject,
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
      applicantType?: string;
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
  preferredPortalIds?: string[]
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
        body: JSON.stringify({ user_id }),
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

  const handlePreview = async () => {
    try {
      setPreviewError(null);
      setIsPreviewLoading(true);

      const localMeta = readLocalStoredUserMetadata();

      let coaRegNo =
        pickCoaRegNoFromMeta(userMetadata) ||
        pickCoaRegNoFromMeta(localMeta);
      let coaExpiryDate =
        pickCoaExpiryFromMeta(userMetadata) ||
        pickCoaExpiryFromMeta(localMeta);

      const mergeConsultantMeta = (meta: unknown) => {
        if (!coaRegNo) coaRegNo = pickCoaRegNoFromMeta(meta);
        if (!coaExpiryDate) coaExpiryDate = pickCoaExpiryFromMeta(meta);
      };

      const templateType = mapSelectedApplicationToTemplate(selectedApplication);
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
            if (payload.metadata) mergeConsultantMeta(payload.metadata);
          }
        }
      } catch {
        /* fall through to client-only sources */
      }

      mergeConsultantMeta((await supabase.auth.getUser()).data.user?.user_metadata);

      if (!coaRegNo || !coaExpiryDate) {
        await supabase.auth.refreshSession();
        mergeConsultantMeta((await supabase.auth.getUser()).data.user?.user_metadata);
      }

      if (!coaRegNo || !coaExpiryDate) {
        const serverMeta = await fetchRawUserMetadataFromApi(userMetadata, consultantLookupUserIds);
        if (serverMeta) mergeConsultantMeta(serverMeta);
      }

      const fields = mapApplicationPreviewFields({
        selectedApplication,
        applicationNo,
        applicationCreatedAt,
        coaRegNo,
        coaExpiryDate,
        projectData,
      });
      const blob = await generateApplicationPreviewPdf(fields, templateType, {
        selectedApplication,
        applicationNo,
        applicationCreatedAt,
        coaRegNo,
        coaExpiryDate,
        consultantLookupUserIds,
        projectData,
      });
      if (previewUrl?.startsWith("blob:")) {
        URL.revokeObjectURL(previewUrl);
      }
      const url = URL.createObjectURL(blob);
      setPreviewUrl(url);
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
        title={selectedApplication ? `${selectedApplication} Preview` : "Application Preview"}
      />
    </div>
  );
}

