"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  CheckCircle2,
  CircleAlert,
  FileText,
  FileUp,
  Loader2,
  Upload,
} from "lucide-react";
import CustomSelect from "@/app/components/CustomSelect";
import type { DocumentValidationResult } from "@/app/components/DocumentValidationResultModal";
import { useDashboardAlertModal } from "@/app/dashboard/context/DashboardAlertModalContext";
import { useDashboardProjects } from "@/app/hooks/useDashboardProjects";
import { getFieldLabel } from "@/app/lib/documentValidation/fieldLabels";
import { mapSelectedApplicationToTemplate } from "@/app/templates/applicationPreview";
import {
  buildApplicationDetailsPath,
  resolveApplicationNo,
} from "@/app/utils/applicationDeepLink";
import { BTN_PRIMARY, BTN_SECONDARY } from "@/app/utils/buttonClasses";
import {
  createApplicationForOwner,
  fetchExistingPermissionTypesForProject,
  getAuthUserId,
} from "@/app/utils/ownerApplicationRpc";
import { getProjectBaseTitle } from "@/app/utils/projectTitleProposal";
import { supabase } from "@/app/utils/supabase";
import {
  filterApplicationDocumentOptionsByApplicantDetails,
  listApplicationDocumentOptions,
  resolveDocumentTypeOptions,
  validateDocumentUpload,
  type ApplicationDocumentOption,
} from "@/app/userdashboard/documentValidationClient";

const GENERAL_DEPARTMENT = "General";

const ApplicationStoredPdfViewer = dynamic(
  () => import("@/app/components/ApplicationStoredPdfViewer"),
  { ssr: false }
);

function isDraftStatus(status: string | null | undefined) {
  return (status ?? "").trim().toLowerCase() === "draft";
}

function getProjectLabel(project: {
  title: string;
  project_info?: { proposalNo?: string; title?: string } | null;
}) {
  const proposalNo = project.project_info?.proposalNo?.trim() || "";
  const cleanTitle = getProjectBaseTitle(
    project.title,
    proposalNo,
    project.project_info?.title
  );
  return proposalNo ? `${cleanTitle} (${proposalNo})` : cleanTitle;
}

function getPlanningAuthority(project: {
  save_plot_details?: { planningAuthority?: string } | null | unknown;
}): string {
  const plot = project.save_plot_details as
    | { planningAuthority?: string }
    | null
    | undefined;
  return plot?.planningAuthority?.trim().toUpperCase() || "—";
}

function DocumentGeneratorContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { showAlert } = useDashboardAlertModal();
  const { projects, loading: projectsLoading } = useDashboardProjects();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const allApplicationOptions = useMemo(() => listApplicationDocumentOptions(), []);
  const selectableProjects = useMemo(
    () => projects.filter((p) => !isDraftStatus(p.status)),
    [projects]
  );

  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [selectedApplicationType, setSelectedApplicationType] = useState("");
  const [applicantDetails, setApplicantDetails] = useState<unknown>(null);
  const [loadingApplicantDetails, setLoadingApplicantDetails] = useState(false);
  const [existingPermissionTypes, setExistingPermissionTypes] = useState<
    string[]
  >([]);
  const [loadingExistingTypes, setLoadingExistingTypes] = useState(false);
  const [selectedDocumentType, setSelectedDocumentType] = useState("");
  const [uploaded, setUploaded] = useState<{ name: string; file: File } | null>(
    null
  );
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [validating, setValidating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [validationResult, setValidationResult] =
    useState<DocumentValidationResult | null>(null);
  const [editableFields, setEditableFields] = useState<
    Record<string, string>
  >({});

  const rosterApplicationOptions = useMemo(
    () =>
      selectedProjectId
        ? filterApplicationDocumentOptionsByApplicantDetails(
            allApplicationOptions,
            applicantDetails
          )
        : [],
    [allApplicationOptions, applicantDetails, selectedProjectId]
  );

  const existingTypeSet = useMemo(
    () => new Set(existingPermissionTypes.map((t) => t.trim().toLowerCase())),
    [existingPermissionTypes]
  );

  /** Roster matches that are not already created for this project (same as Create Application). */
  const visibleApplicationOptions = useMemo(
    () =>
      rosterApplicationOptions.filter(
        (o) => !existingTypeSet.has(o.applicationType.trim().toLowerCase())
      ),
    [rosterApplicationOptions, existingTypeSet]
  );

  const loadingTypeOptions = loadingApplicantDetails || loadingExistingTypes;

  const selectedOption: ApplicationDocumentOption | undefined =
    visibleApplicationOptions.find((o) => o.applicationType === selectedApplicationType);

  const documentTypeOptions = useMemo(() => {
    if (selectedOption) return selectedOption.documentTypes;
    return resolveDocumentTypeOptions(selectedApplicationType);
  }, [selectedOption, selectedApplicationType]);

  const selectedProject = selectableProjects.find(
    (p) => p.id === selectedProjectId
  );

  // Prefill project from ?projectId=
  useEffect(() => {
    const fromQuery = searchParams.get("projectId")?.trim() || "";
    if (!fromQuery || projectsLoading) return;
    if (selectableProjects.some((p) => p.id === fromQuery)) {
      setSelectedProjectId(fromQuery);
    }
  }, [searchParams, projectsLoading, selectableProjects]);

  // Load applicant roster when project changes (same as Create Application)
  useEffect(() => {
    if (!selectedProjectId) {
      setApplicantDetails(null);
      setLoadingApplicantDetails(false);
      return;
    }

    let cancelled = false;
    setLoadingApplicantDetails(true);

    (async () => {
      const { data: rpcData, error: rpcError } = await supabase.rpc(
        "get_project_for_preview",
        { p_project_id: selectedProjectId }
      );

      if (cancelled) return;

      let details: unknown = null;

      if (!rpcError && rpcData && typeof rpcData === "object" && !Array.isArray(rpcData)) {
        details = (rpcData as { applicant_details?: unknown }).applicant_details ?? null;
      } else {
        const { data: rosterData, error: rosterError } = await supabase.rpc(
          "get_applicant_details_for_project",
          { p_project_id: selectedProjectId }
        );
        if (cancelled) return;
        if (!rosterError) details = rosterData;
      }

      if (!cancelled) {
        setApplicantDetails(details);
        setLoadingApplicantDetails(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [selectedProjectId]);

  // Exclude permission types already created for this project (same as Create Application)
  useEffect(() => {
    if (!selectedProjectId) {
      setExistingPermissionTypes([]);
      setLoadingExistingTypes(false);
      return;
    }

    let cancelled = false;
    setLoadingExistingTypes(true);

    (async () => {
      const ownerId = await getAuthUserId();
      if (cancelled) return;
      if (!ownerId) {
        setExistingPermissionTypes([]);
        setLoadingExistingTypes(false);
        return;
      }

      const titles = await fetchExistingPermissionTypesForProject(
        selectedProjectId,
        GENERAL_DEPARTMENT,
        ownerId
      );
      if (!cancelled) {
        setExistingPermissionTypes(titles);
        setLoadingExistingTypes(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [selectedProjectId]);

  const handleProjectChange = (projectId: string) => {
    setSelectedProjectId(projectId);
    setSelectedApplicationType("");
    setValidationResult(null);
    setEditableFields({});
  };

  // Keep application type in sync with project-filtered options
  useEffect(() => {
    if (loadingTypeOptions) return;

    if (visibleApplicationOptions.length === 0) {
      if (selectedApplicationType) setSelectedApplicationType("");
      return;
    }

    const stillVisible = visibleApplicationOptions.some(
      (o) => o.applicationType === selectedApplicationType
    );
    if (!stillVisible) {
      setSelectedApplicationType(
        visibleApplicationOptions[0]?.applicationType ?? ""
      );
    }
  }, [
    visibleApplicationOptions,
    selectedApplicationType,
    loadingTypeOptions,
  ]);

  // Keep documentType in sync when application type changes
  useEffect(() => {
    const first = documentTypeOptions[0]?.id ?? "";
    setSelectedDocumentType((prev) =>
      documentTypeOptions.some((d) => d.id === prev) ? prev : first
    );
  }, [documentTypeOptions]);

  // Blob URL for preview
  useEffect(() => {
    if (!uploaded) {
      setPreviewUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
      return;
    }
    const url = URL.createObjectURL(uploaded.file);
    setPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return url;
    });
    return () => URL.revokeObjectURL(url);
  }, [uploaded]);

  const handleFileChange = (file: File | undefined) => {
    if (!file) return;
    const ok =
      file.type === "application/pdf" ||
      file.type.startsWith("image/");
    if (!ok) {
      showAlert({
        title: "Invalid file",
        message: "Please upload a PDF or image file (JPEG, PNG, or WebP).",
      });
      return;
    }
    setUploaded({ name: file.name, file });
    setValidationResult(null);
    setEditableFields({});
  };

  const missingSet = new Set(validationResult?.missingFields ?? []);
  const allMandatoryFilled = Boolean(
    validationResult && validationResult.missingFields.length === 0
  );
  const formatOk = Boolean(validationResult?.valid);
  const readyForReview = allMandatoryFilled && formatOk;
  const canSubmitApplication =
    Boolean(selectedProjectId && selectedApplicationType && uploaded) &&
    readyForReview &&
    !submitting &&
    !validating;

  const handleValidate = async () => {
    if (!uploaded) {
      showAlert({
        title: "Upload required",
        message: "Please upload a PDF before validating with the bot.",
      });
      return;
    }
    if (!selectedDocumentType && !selectedApplicationType) {
      showAlert({
        title: "Selection required",
        message: "Please select a document type.",
      });
      return;
    }

    setValidating(true);
    try {
      const response = await validateDocumentUpload({
        file: uploaded.file,
        applicationType: selectedApplicationType || undefined,
        documentType: selectedDocumentType || undefined,
      });
      if (!response.ok) {
        showAlert({ title: "Validation failed", message: response.error });
        return;
      }
      setValidationResult(response.result);
      const next: Record<string, string> = {};
      for (const [key, value] of Object.entries(response.result.extracted)) {
        next[key] = value ?? "";
      }
      setEditableFields(next);
    } finally {
      setValidating(false);
    }
  };

  const handleSubmitApplication = async () => {
    if (!selectedProject) {
      showAlert({
        title: "Selection required",
        message: "Please select a project first.",
      });
      return;
    }
    if (!selectedApplicationType) {
      showAlert({
        title: "Selection required",
        message: "Please select an application type.",
      });
      return;
    }
    if (!uploaded) {
      showAlert({
        title: "Upload required",
        message: "Please upload the application PDF before submitting.",
      });
      return;
    }
    if (uploaded.file.type !== "application/pdf") {
      showAlert({
        title: "PDF required",
        message: "Submit Application requires a PDF file (not an image).",
      });
      return;
    }
    if (!readyForReview) {
      showAlert({
        title: "Validation required",
        message:
          "Validate with Bot and resolve any missing fields before submitting.",
      });
      return;
    }
    if (
      existingTypeSet.has(selectedApplicationType.trim().toLowerCase())
    ) {
      showAlert({
        title: "Already created",
        message:
          "This application type is already created for the selected project.",
      });
      return;
    }

    setSubmitting(true);
    try {
      const ownerId = await getAuthUserId();
      if (!ownerId) {
        showAlert({
          title: "Sign in required",
          message: "You must be signed in to submit an application.",
        });
        return;
      }

      const {
        data: { session },
      } = await supabase.auth.getSession();
      const authToken = session?.access_token;
      if (!authToken) {
        showAlert({
          title: "Sign in required",
          message: "Your session expired. Please sign in again.",
        });
        return;
      }

      const result = await createApplicationForOwner(ownerId, {
        projectId: selectedProject.id,
        projectTitle: selectedProject.title,
        department: GENERAL_DEPARTMENT,
        permissionType: selectedApplicationType,
        workflowStage: "draft",
      });

      if ("error" in result) {
        if (result.code === "23505") {
          setExistingPermissionTypes((prev) =>
            prev.includes(selectedApplicationType)
              ? prev
              : [...prev, selectedApplicationType]
          );
          showAlert({
            title: "Already created",
            message:
              result.error ||
              "This application type is already added for the selected project.",
          });
          return;
        }
        showAlert({
          title: "Could not create application",
          message: result.error || "Failed to create application. Please try again.",
        });
        return;
      }

      const applicationId = result.applicationId;
      const templateType = mapSelectedApplicationToTemplate(
        selectedApplicationType
      );

      const formData = new FormData();
      formData.append("projectId", selectedProject.id);
      formData.append("templateType", templateType);
      formData.append("user_id", ownerId);
      formData.append("applicationUrlsKey", templateType);
      formData.append(
        "pdf",
        uploaded.file,
        uploaded.name.endsWith(".pdf") ? uploaded.name : `${templateType}.pdf`
      );

      const saveResponse = await fetch("/api/save-application-pdf", {
        method: "POST",
        headers: { Authorization: `Bearer ${authToken}` },
        body: formData,
      });

      if (!saveResponse.ok) {
        const errBody = (await saveResponse.json().catch(() => null)) as {
          error?: string;
          details?: string;
        } | null;
        const msg =
          typeof errBody?.error === "string"
            ? errBody.error +
              (errBody.details ? ` (${errBody.details})` : "")
            : `Could not save PDF (${saveResponse.status}).`;
        showAlert({
          title: "Application created, PDF save failed",
          message: `${msg} Open the application to retry saving the document.`,
        });
      }

      fetch(`/api/applications/${applicationId}/notify`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({ stage: "draft" }),
      }).catch((err) =>
        console.error("Application notification request failed:", err)
      );

      setExistingPermissionTypes((prev) =>
        prev.includes(selectedApplicationType)
          ? prev
          : [...prev, selectedApplicationType]
      );

      const applicationNo = resolveApplicationNo(
        {
          project_info: selectedProject.project_info ?? null,
          save_plot_details: selectedProject.save_plot_details ?? null,
        },
        {
          id: applicationId,
          project_title: selectedProject.title,
        }
      );

      router.push(
        buildApplicationDetailsPath({
          projectId: selectedProject.id,
          applicationId,
          applicationNo,
          selectedApplication: selectedApplicationType,
        })
      );
    } finally {
      setSubmitting(false);
    }
  };

  const documentTitle =
    validationResult?.documentLabel ||
    documentTypeOptions.find((d) => d.id === selectedDocumentType)?.label ||
    selectedOption?.label ||
    "Document Generator";

  const authorityBadge = selectedProject
    ? getPlanningAuthority(selectedProject)
    : "—";

  const fieldEntries = Object.entries(editableFields);

  const emptyTypeMessage =
    rosterApplicationOptions.length === 0
      ? (
          <>
            No consultant roles match an appointment letter yet. Add matching roles in{" "}
            <Link
              href={`/dashboard/applicant?projectId=${encodeURIComponent(selectedProjectId)}`}
              className="font-medium text-brand-blue underline underline-offset-2 hover:text-brand-navy"
            >
              Applicant Details
            </Link>
            .
          </>
        )
      : (
          <>
            All matching appointment letters are already created for this project.
            Open{" "}
            <Link
              href="/userdashboard/applications"
              className="font-medium text-brand-blue underline underline-offset-2 hover:text-brand-navy"
            >
              Applications
            </Link>{" "}
            to continue signing.
          </>
        );

  return (
    <div className="mx-auto flex min-h-0 w-full max-w-7xl flex-1 flex-col gap-4 overflow-hidden px-4 py-4 md:px-6 md:py-6">
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        {/* Header */}
        <div className="flex shrink-0 flex-col gap-4 border-b border-gray-100 px-5 py-4 sm:flex-row sm:items-start sm:justify-between md:px-6">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
              Document Generator
            </p>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-brand-blue">
                <FileText className="h-4 w-4" />
              </div>
              <h1 className="text-lg font-semibold tracking-tight text-brand-navy md:text-xl">
                {documentTitle}
              </h1>
              <span className="rounded-full bg-sky-50 px-2.5 py-0.5 text-[11px] font-semibold text-sky-800 ring-1 ring-inset ring-sky-200">
                {authorityBadge}
              </span>
              {selectedApplicationType && (
                <span className="rounded-full bg-gray-50 px-2.5 py-0.5 text-[11px] font-semibold text-gray-700 ring-1 ring-inset ring-gray-200">
                  {selectedOption?.label ?? selectedApplicationType}
                </span>
              )}
              <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-[11px] font-semibold text-amber-800 ring-1 ring-inset ring-amber-200">
                Bot
              </span>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf,image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(e) => {
                handleFileChange(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold ${BTN_SECONDARY}`}
            >
              <Upload className="h-4 w-4" />
              {uploaded ? "Replace PDF" : "Upload PDF"}
            </button>
            <button
              type="button"
              disabled={validating || !uploaded}
              onClick={() => void handleValidate()}
              className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50 ${BTN_PRIMARY}`}
            >
              {validating ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Validating…
                </>
              ) : (
                <>
                  <FileUp className="h-4 w-4" />
                  Validate with Bot
                </>
              )}
            </button>
          </div>
        </div>

        {/* Selectors */}
        <div className="grid shrink-0 gap-3 border-b border-gray-100 px-5 py-4 sm:grid-cols-2 lg:grid-cols-3 md:px-6">
          <div>
            <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-gray-500">
              Project
            </label>
            <CustomSelect
              value={selectedProjectId}
              onChange={handleProjectChange}
              options={selectableProjects.map((p) => ({
                value: p.id,
                label: getProjectLabel(p),
              }))}
              placeholder={
                projectsLoading ? "Loading projects…" : "Select project"
              }
              disabled={projectsLoading || selectableProjects.length === 0}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-gray-500">
              Document / Application type
            </label>
            {selectedProjectId &&
            !loadingTypeOptions &&
            visibleApplicationOptions.length === 0 ? (
              <p className="rounded-lg border border-amber-100 bg-amber-50 px-3 py-2.5 text-sm text-gray-700">
                {emptyTypeMessage}
              </p>
            ) : (
              <CustomSelect
                value={selectedApplicationType}
                onChange={(val) => {
                  setSelectedApplicationType(val);
                  setValidationResult(null);
                  setEditableFields({});
                }}
                options={visibleApplicationOptions.map((o) => ({
                  value: o.applicationType,
                  label: o.label,
                }))}
                placeholder={
                  !selectedProjectId
                    ? "Select a project first"
                    : loadingTypeOptions
                      ? "Loading types…"
                      : "Select type"
                }
                disabled={
                  !selectedProjectId ||
                  loadingTypeOptions ||
                  visibleApplicationOptions.length === 0
                }
              />
            )}
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-gray-500">
              Document schema
            </label>
            <CustomSelect
              value={selectedDocumentType}
              onChange={(val) => {
                setSelectedDocumentType(val);
                setValidationResult(null);
                setEditableFields({});
              }}
              options={documentTypeOptions.map((d) => ({
                value: d.id,
                label: d.label,
              }))}
              placeholder="Select schema"
              disabled={documentTypeOptions.length === 0}
            />
          </div>
        </div>

        {uploaded && (
          <p className="shrink-0 truncate border-b border-gray-50 bg-gray-50/80 px-5 py-2 text-xs text-gray-500 md:px-6">
            Uploaded: <span className="font-medium text-gray-700">{uploaded.name}</span>
          </p>
        )}

        {/* Three columns */}
        <div className="grid min-h-0 flex-1 grid-cols-1 gap-0 overflow-hidden lg:grid-cols-12">
          {/* Preview */}
          <section className="flex min-h-0 flex-col border-b border-gray-100 lg:col-span-5 lg:border-b-0 lg:border-r">
            <div className="flex shrink-0 items-center justify-between border-b border-gray-100 px-4 py-3">
              <h2 className="text-sm font-bold text-brand-navy">Preview</h2>
            </div>
            <div className="min-h-0 flex-1 overflow-auto bg-gray-50 p-3">
              {!previewUrl ? (
                <div className="flex h-full min-h-[280px] flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-gray-200 bg-white text-center">
                  <FileText className="h-8 w-8 text-gray-300" />
                  <p className="text-sm text-gray-500">Upload a PDF to preview</p>
                </div>
              ) : uploaded?.file.type.startsWith("image/") ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={previewUrl}
                  alt="Uploaded document"
                  className="mx-auto max-h-full max-w-full rounded-lg border border-gray-200 bg-white object-contain"
                />
              ) : (
                <div className="min-h-[280px] overflow-hidden rounded-xl border border-gray-200 bg-white">
                  <ApplicationStoredPdfViewer fileUrl={previewUrl} />
                </div>
              )}
            </div>
          </section>

          {/* Editable Fields */}
          <section className="flex min-h-0 flex-col border-b border-gray-100 lg:col-span-4 lg:border-b-0 lg:border-r">
            <div className="flex shrink-0 items-center justify-between border-b border-gray-100 px-4 py-3">
              <h2 className="text-sm font-bold text-brand-navy">Editable Fields</h2>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
              {!validationResult ? (
                <p className="py-10 text-center text-sm text-gray-500">
                  Validate with Bot to extract editable fields.
                </p>
              ) : fieldEntries.length === 0 ? (
                <p className="py-10 text-center text-sm text-gray-500">
                  No fields extracted.
                </p>
              ) : (
                <div className="space-y-3">
                  {fieldEntries.map(([key, value]) => {
                    const missing = missingSet.has(key);
                    return (
                      <div key={key}>
                        <label className="mb-1 block text-xs font-medium text-gray-600">
                          {getFieldLabel(key)}
                          {missing && (
                            <span className="ml-1 text-status-danger">(missing)</span>
                          )}
                        </label>
                        <input
                          type="text"
                          value={value}
                          onChange={(e) =>
                            setEditableFields((prev) => ({
                              ...prev,
                              [key]: e.target.value,
                            }))
                          }
                          className={[
                            "h-10 w-full rounded-lg border px-3 text-sm text-gray-900 outline-none transition-colors",
                            "bg-gray-50 hover:border-gray-300 focus:border-brand-blue focus:bg-white focus:ring-2 focus:ring-brand-blue/20",
                            missing ? "border-rose-300" : "border-gray-200",
                          ].join(" ")}
                        />
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </section>

          {/* AI Analysis */}
          <section className="flex min-h-0 flex-col lg:col-span-3">
            <div className="flex shrink-0 items-center justify-between border-b border-gray-100 px-4 py-3">
              <h2 className="text-sm font-bold text-brand-navy">AI Analysis</h2>
            </div>
            <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-4 py-4">
              {!validationResult ? (
                <p className="py-8 text-center text-sm text-gray-500">
                  Run validation to see AI analysis.
                </p>
              ) : (
                <>
                  <ul className="space-y-3">
                    <AnalysisItem
                      ok={allMandatoryFilled}
                      label="All mandatory fields filled"
                    />
                    <AnalysisItem
                      ok={formatOk}
                      label="Format verified by bot"
                    />
                    <AnalysisItem
                      ok={validationResult.missingFields.length === 0}
                      label={
                        validationResult.missingFields.length === 0
                          ? "Wording / fields verified"
                          : `${validationResult.missingFields.length} field(s) missing`
                      }
                    />
                    <AnalysisItem ok={readyForReview} label="Ready for review" />
                  </ul>

                  {validationResult.missingFields.length > 0 && (
                    <div>
                      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-rose-700">
                        Missing
                      </p>
                      <ul className="space-y-1 rounded-lg border border-rose-100 bg-rose-50/70 px-3 py-2">
                        {validationResult.missingFields.map((key) => (
                          <li key={key} className="text-xs text-rose-900">
                            {getFieldLabel(key)}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <div>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                      References
                    </p>
                    <ul className="space-y-2">
                      <li className="flex items-center gap-2 rounded-lg border border-gray-100 bg-gray-50 px-3 py-2 text-xs text-gray-700">
                        <FileText className="h-3.5 w-3.5 shrink-0 text-brand-blue" />
                        DCPR 2034 – document checklist
                      </li>
                      <li className="flex items-center gap-2 rounded-lg border border-gray-100 bg-gray-50 px-3 py-2 text-xs text-gray-700">
                        <FileText className="h-3.5 w-3.5 shrink-0 text-brand-blue" />
                        Authority circular (placeholder)
                      </li>
                    </ul>
                  </div>
                </>
              )}

              <button
                type="button"
                disabled={!canSubmitApplication}
                title={
                  canSubmitApplication
                    ? "Create application and continue to signing"
                    : "Validate the document first, then submit"
                }
                onClick={() => void handleSubmitApplication()}
                className={`mt-auto w-full rounded-lg px-4 py-2.5 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-55 ${BTN_PRIMARY}`}
              >
                {submitting ? (
                  <span className="inline-flex items-center justify-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Submitting…
                  </span>
                ) : (
                  "Submit Application"
                )}
              </button>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function AnalysisItem({ ok, label }: { ok: boolean; label: string }) {
  return (
    <li className="flex items-start gap-2 text-sm">
      {ok ? (
        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-status-success" />
      ) : (
        <CircleAlert className="mt-0.5 h-4 w-4 shrink-0 text-status-warning" />
      )}
      <span className={ok ? "text-gray-800" : "text-gray-600"}>{label}</span>
    </li>
  );
}

export default function DocumentsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex flex-1 items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-brand-blue" />
        </div>
      }
    >
      <DocumentGeneratorContent />
    </Suspense>
  );
}
