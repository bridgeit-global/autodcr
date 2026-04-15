"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import DocumentPreviewModal from "@/app/components/DocumentPreviewModal";
import { supabase } from "@/app/utils/supabase";
import {
  generateApplicationPreviewPdf,
  mapApplicationPreviewFields,
  mapSelectedApplicationToTemplate,
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
    proposedCtsNumber?: string[];
    villageName?: string;
    roadName?: string;
  } | null;
  applicant_details?: {
    applicants?: Array<{
      applicantType?: string;
      residentialAddress?: string;
    }>;
  } | null;
};

export default function ApplicationDetailsPage() {
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
      const fields = mapApplicationPreviewFields({
        selectedApplication,
        applicationNo,
        applicationCreatedAt,
        projectData,
      });
      const templateType = mapSelectedApplicationToTemplate(selectedApplication);
      const blob = await generateApplicationPreviewPdf(fields, templateType, {
        selectedApplication,
        applicationNo,
        applicationCreatedAt,
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

