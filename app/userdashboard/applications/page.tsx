"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  CheckCircle2,
  ChevronRight,
  CircleDashed,
  FilePlus2,
  FileStack,
  FileText,
  Folder,
  Loader2,
  RotateCcw,
  Trash2,
  XCircle,
} from "lucide-react";
import MetricCard from "@/app/components/ui/MetricCard";
import Modal from "@/app/components/ui/Modal";
import { useDashboardAlertModal } from "@/app/dashboard/context/DashboardAlertModalContext";
import { useDashboardProjects } from "@/app/hooks/useDashboardProjects";
import { supabase } from "@/app/utils/supabase";
import {
  catalogDocumentOptionLabel,
  fetchApplicationCatalogTypes,
  fetchDocumentsForApplicationType,
  type ApplicationCatalogDocument,
  type ApplicationCatalogType,
} from "@/app/utils/applicationCatalog";
import { BTN_PRIMARY } from "@/app/utils/buttonClasses";
import { normalizeProjectId } from "@/app/utils/applicantAppointmentPermissions";
import { canCreateApplicationsRole } from "@/app/utils/projectAccess";
import {
  applicationHref,
  bucketApplicationHealth,
  fetchApplicationsList,
  filterApplicationsByStage,
  getApplicationStage,
  type ApplicationStageFilter,
  type DashboardApplication,
} from "@/app/userdashboard/applicationsList";
import type { ApplicationWorkflowStage } from "@/app/components/DraftApplicationsModal";

const STAGE_LABELS: Record<ApplicationWorkflowStage, string> = {
  draft: "Draft",
  in_process: "In Process",
  approved_verified: "Approved",
  rejected: "Rejected",
};

const STAGE_BADGE_CLASSES: Record<ApplicationWorkflowStage, string> = {
  draft: "bg-amber-50 text-amber-800 ring-amber-200",
  in_process: "bg-blue-50 text-blue-800 ring-blue-200",
  approved_verified: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  rejected: "bg-rose-50 text-rose-800 ring-rose-200",
};

type PendingAction = {
  type: "reject" | "delete" | "back_to_draft";
  app: DashboardApplication;
};

function formatCreatedAt(value?: string) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function parseStageFilter(value: string | null): ApplicationStageFilter | null {
  if (
    value === "all" ||
    value === "draft" ||
    value === "in_process" ||
    value === "approved_verified" ||
    value === "rejected"
  ) {
    return value;
  }
  return null;
}

function apiErrorMessage(errBody: { error?: string; details?: string } | null, fallback: string) {
  if (typeof errBody?.error === "string") {
    return errBody.error + (errBody.details ? ` (${errBody.details})` : "");
  }
  return fallback;
}

function ApplicationsHubContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { showAlert } = useDashboardAlertModal();
  const {
    projects,
    loading: projectsLoading,
    isConsultant,
    isArchitectConsultant,
    architectDelegateProjectIds,
    consultantType,
  } = useDashboardProjects();
  const [applications, setApplications] = useState<DashboardApplication[]>([]);
  const [applicationsLoading, setApplicationsLoading] = useState(true);
  const [stageFilter, setStageFilter] = useState<ApplicationStageFilter>(
    () => parseStageFilter(searchParams.get("stage")) ?? "all"
  );
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [catalogTypes, setCatalogTypes] = useState<ApplicationCatalogType[]>([]);
  const [documentsByTypeId, setDocumentsByTypeId] = useState<
    Record<string, ApplicationCatalogDocument[]>
  >({});
  const [selectedDepartmentKey, setSelectedDepartmentKey] = useState<string | null>(null);
  const [selectedTypeKey, setSelectedTypeKey] = useState<string | null>(null);
  const [selectedDocumentId, setSelectedDocumentId] = useState<string | null>(null);

  const canCreateApplications = canCreateApplicationsRole({
    role: isConsultant ? "Consultant" : "Owner",
    consultant_type: consultantType ?? "",
  });

  useEffect(() => {
    const fromQuery = parseStageFilter(searchParams.get("stage"));
    if (fromQuery) setStageFilter(fromQuery);
  }, [searchParams]);

  const canManageProjectApps = useCallback(
    (projectId: string) => {
      if (!isConsultant) return true;
      if (!isArchitectConsultant) return false;
      return architectDelegateProjectIds.has(normalizeProjectId(projectId));
    },
    [isConsultant, isArchitectConsultant, architectDelegateProjectIds]
  );

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (projectsLoading) return;

      setApplicationsLoading(true);
      try {
        const { data: authData } = await supabase.auth.getUser();
        const userId = authData.user?.id;
        if (!userId) {
          if (!cancelled) setApplications([]);
          return;
        }

        const rows = await fetchApplicationsList({
          userId,
          isConsultant,
          projectIds: projects.map((p) => String(p.id)),
        });
        if (!cancelled) setApplications(rows);
      } catch (err) {
        console.error("Failed to load applications:", err);
        if (!cancelled) setApplications([]);
      } finally {
        if (!cancelled) setApplicationsLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [projects, projectsLoading, isConsultant]);

  const health = useMemo(() => bucketApplicationHealth(applications), [applications]);

  const filtered = useMemo(
    () => filterApplicationsByStage(applications, stageFilter),
    [applications, stageFilter]
  );

  useEffect(() => {
    let cancelled = false;
    void fetchApplicationCatalogTypes().then((types) => {
      if (!cancelled) setCatalogTypes(types);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const titles = new Set(
      applications.map((app) => app.permissionType.trim().toLowerCase()).filter(Boolean)
    );
    const typeIds = catalogTypes
      .filter((type) => titles.has(type.application_title.trim().toLowerCase()))
      .map((type) => type.id);
    if (typeIds.length === 0) {
      setDocumentsByTypeId({});
      return;
    }
    let cancelled = false;
    void Promise.all(
      typeIds.map(async (id) => [id, await fetchDocumentsForApplicationType(id)] as const)
    ).then((pairs) => {
      if (cancelled) return;
      const next: Record<string, ApplicationCatalogDocument[]> = {};
      for (const [id, docs] of pairs) next[id] = docs;
      setDocumentsByTypeId(next);
    });
    return () => {
      cancelled = true;
    };
  }, [applications, catalogTypes]);

  const typeByTitle = useMemo(
    () =>
      new Map(catalogTypes.map((type) => [type.application_title.trim().toLowerCase(), type])),
    [catalogTypes]
  );

  const departmentFolders = useMemo(() => {
    const departments = new Map<
      string,
      {
        key: string;
        title: string;
        types: Map<
          string,
          {
            key: string;
            title: string;
            typeId: string | null;
            applications: DashboardApplication[];
            direct: boolean;
          }
        >;
      }
    >();
    for (const app of filtered) {
      const title = app.permissionType.trim() || "Application";
      const typeKey = title.toLowerCase();
      const type = typeByTitle.get(typeKey);
      if (type?.category === "appointment_letter") continue;
      const departmentTitle =
        type?.department?.trim() ||
        (app.department && app.department !== "—" ? app.department.trim() : "") ||
        "Other";
      const departmentKey = departmentTitle.toLowerCase();
      const department = departments.get(departmentKey) ?? {
        key: departmentKey,
        title: departmentTitle,
        types: new Map(),
      };
      const entry = department.types.get(typeKey) ?? {
        key: typeKey,
        title: type?.application_title?.trim() || title,
        typeId: type?.id ?? null,
        applications: [],
        direct: false,
      };
      entry.applications.push(app);
      department.types.set(typeKey, entry);
      departments.set(departmentKey, department);
    }
    const appointment: DashboardApplication[] = [];
    const acceptance: DashboardApplication[] = [];
    let letterDepartment = "General";
    for (const app of filtered) {
      const type = typeByTitle.get(app.permissionType.trim().toLowerCase());
      if (!type || type.category !== "appointment_letter") continue;
      if (type.department?.trim()) letterDepartment = type.department.trim();
      appointment.push(app);
      const docs = documentsByTypeId[type.id] ?? [];
      if (docs.some((doc) => doc.letter_variant === "acceptance")) acceptance.push(app);
    }
    const letterFolders: {
      key: string;
      title: string;
      typeId: string | null;
      applications: DashboardApplication[];
      direct: boolean;
    }[] = [];
    if (appointment.length > 0) {
      letterFolders.push({
        key: "letter:appointment",
        title: "Appointment",
        typeId: null,
        applications: appointment,
        direct: true,
      });
    }
    if (acceptance.length > 0) {
      letterFolders.push({
        key: "letter:acceptance",
        title: "Acceptance",
        typeId: null,
        applications: acceptance,
        direct: true,
      });
    }
    if (letterFolders.length > 0) {
      const letterKey = letterDepartment.toLowerCase();
      const existing = departments.get(letterKey) ?? {
        key: letterKey,
        title: letterDepartment,
        types: new Map(),
      };
      for (const folder of letterFolders) {
        existing.types.set(folder.key, folder);
      }
      departments.set(letterKey, existing);
    }

    return [...departments.values()]
      .map((department) => ({
        key: department.key,
        title: department.title,
        types: [...department.types.values()].sort((a, b) => {
          const rank = (title: string) =>
            title === "Appointment" ? 0 : title === "Acceptance" ? 1 : 2;
          const diff = rank(a.title) - rank(b.title);
          return diff !== 0 ? diff : a.title.localeCompare(b.title);
        }),
      }))
      .sort((a, b) => {
        if (a.title === "Building Permission") return -1;
        if (b.title === "Building Permission") return 1;
        return a.title.localeCompare(b.title);
      });
  }, [filtered, typeByTitle, documentsByTypeId]);

  const selectedDepartment =
    departmentFolders.find((folder) => folder.key === selectedDepartmentKey) ?? null;
  const selectedTypeFolder =
    selectedDepartment?.types.find((folder) => folder.key === selectedTypeKey) ?? null;
  const selectedTypeDocuments =
    selectedTypeFolder?.direct || !selectedTypeFolder?.typeId
      ? []
      : (documentsByTypeId[selectedTypeFolder.typeId] ?? []);
  const selectedDocument =
    selectedTypeDocuments.find((doc) => doc.id === selectedDocumentId) ?? null;

  useEffect(() => {
    if (!selectedDepartmentKey) return;
    if (!departmentFolders.some((folder) => folder.key === selectedDepartmentKey)) {
      setSelectedDepartmentKey(null);
      setSelectedTypeKey(null);
      setSelectedDocumentId(null);
    }
  }, [departmentFolders, selectedDepartmentKey]);

  useEffect(() => {
    if (!selectedTypeKey) return;
    const typeStillVisible = selectedDepartment?.types.some(
      (folder) => folder.key === selectedTypeKey
    );
    if (!typeStillVisible) {
      setSelectedTypeKey(null);
      setSelectedDocumentId(null);
    }
  }, [selectedDepartment, selectedTypeKey]);

  useEffect(() => {
    if (!selectedDocumentId) return;
    if (!selectedTypeDocuments.some((doc) => doc.id === selectedDocumentId)) {
      setSelectedDocumentId(null);
    }
  }, [selectedTypeDocuments, selectedDocumentId]);

  const loading = projectsLoading || applicationsLoading;
  const listTitle =
    stageFilter === "all" ? "All Applications" : `${STAGE_LABELS[stageFilter]} Applications`;
  const actionBusy = Boolean(busyId);

  const getAuthToken = useCallback(async () => {
    const { data: sessionData } = await supabase.auth.getSession();
    return sessionData.session?.access_token ?? null;
  }, []);

  const confirmPendingAction = useCallback(async () => {
    if (!pendingAction || busyId) return;

    const { type, app } = pendingAction;
    const authToken = await getAuthToken();
    if (!authToken) {
      const actionVerb =
        type === "delete"
          ? "delete"
          : type === "back_to_draft"
            ? "move"
            : "reject";
      showAlert({
        title: "Sign in required",
        message: `You must be signed in to ${actionVerb} an application.`,
      });
      return;
    }

    setBusyId(app.id);
    try {
      const endpoint =
        type === "delete"
          ? `/api/applications/${encodeURIComponent(app.id)}`
          : type === "back_to_draft"
            ? `/api/applications/${encodeURIComponent(app.id)}/back-to-draft`
            : `/api/applications/${encodeURIComponent(app.id)}/reject`;
      const response = await fetch(endpoint, {
        method: type === "delete" ? "DELETE" : "POST",
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });

      if (!response.ok) {
        const errBody = (await response.json().catch(() => null)) as {
          error?: string;
          details?: string;
        } | null;
        const failTitle =
          type === "delete"
            ? "Could not delete application"
            : type === "back_to_draft"
              ? "Could not move to draft"
              : "Could not reject application";
        showAlert({
          title: failTitle,
          message: apiErrorMessage(
            errBody,
            type === "delete"
              ? "Failed to delete application. Please try again."
              : type === "back_to_draft"
                ? "Failed to move application back to draft. Please try again."
                : "Failed to reject application. Please try again."
          ),
        });
        return;
      }

      setPendingAction(null);
      if (type === "delete") {
        setApplications((prev) => prev.filter((row) => row.id !== app.id));
      } else if (type === "back_to_draft") {
        setApplications((prev) =>
          prev.map((row) =>
            row.id === app.id ? { ...row, workflowStage: "draft" } : row
          )
        );
        setStageFilter("draft");
      } else {
        setApplications((prev) =>
          prev.map((row) =>
            row.id === app.id ? { ...row, workflowStage: "rejected" } : row
          )
        );
        setStageFilter("rejected");
      }
    } catch (err) {
      console.error(`Failed to ${type} application:`, err);
      showAlert({
        title:
          type === "delete"
            ? "Could not delete application"
            : type === "back_to_draft"
              ? "Could not move to draft"
              : "Could not reject application",
        message: "Something went wrong. Please try again.",
      });
    } finally {
      setBusyId(null);
    }
  }, [pendingAction, busyId, getAuthToken, showAlert]);

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 md:px-6 md:py-8 xl:min-h-0 xl:flex-1 xl:overflow-hidden">
      <div className="flex shrink-0 flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-brand-navy md:text-2xl">
            Applications
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Track draft, in-process, approved, and rejected applications across your projects.
          </p>
        </div>
        {canCreateApplications ? (
          <Link
            href="/create-application"
            className={`inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold ${BTN_PRIMARY}`}
          >
            <FilePlus2 className="h-4 w-4" />
            Create Application
          </Link>
        ) : (
          <button
            type="button"
            disabled
            aria-disabled="true"
            title="Only owners, developers, architects, and licensed surveyors can create applications"
            className={`inline-flex cursor-not-allowed items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold opacity-50 ${BTN_PRIMARY}`}
          >
            <FilePlus2 className="h-4 w-4" />
            Create Application
          </button>
        )}
      </div>

      <div className="grid shrink-0 grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <MetricCard
          label="Total Applications"
          value={loading ? "…" : health.total}
          hint={{ text: "All applications", tone: "neutral" }}
          icon={<FileStack className="h-5 w-5" />}
          onClick={() => setStageFilter("all")}
          className={stageFilter === "all" ? "ring-2 ring-brand-blue/30" : ""}
        />
        <MetricCard
          label="Draft"
          value={loading ? "…" : health.draft}
          hint={{ text: "Not yet submitted", tone: "neutral" }}
          icon={<FileText className="h-5 w-5" />}
          onClick={() => setStageFilter("draft")}
          className={stageFilter === "draft" ? "ring-2 ring-brand-blue/30" : ""}
        />
        <MetricCard
          label="In Process"
          value={loading ? "…" : health.inProcess}
          hint={{ text: "Under review", tone: "neutral" }}
          icon={<Loader2 className="h-5 w-5" />}
          onClick={() => setStageFilter("in_process")}
          className={stageFilter === "in_process" ? "ring-2 ring-brand-blue/30" : ""}
        />
        <MetricCard
          label="Rejected"
          value={loading ? "…" : health.rejected}
          hint={{ text: "Needs attention", tone: "danger" }}
          icon={<XCircle className="h-5 w-5" />}
          onClick={() => setStageFilter("rejected")}
          className={stageFilter === "rejected" ? "ring-2 ring-brand-blue/30" : ""}
        />
        <MetricCard
          label="Approved"
          value={loading ? "…" : health.approved}
          hint={{ text: "Verified / approved", tone: "up" }}
          icon={<CheckCircle2 className="h-5 w-5" />}
          onClick={() => setStageFilter("approved_verified")}
          className={stageFilter === "approved_verified" ? "ring-2 ring-brand-blue/30" : ""}
        />
      </div>

      <div className="flex min-h-0 flex-1 flex-col">
          <div className="flex flex-col rounded-xl border border-gray-100 bg-white shadow-sm xl:min-h-0 xl:flex-1 xl:overflow-hidden">
            <div className="flex shrink-0 items-center justify-between gap-3 border-b border-gray-100 px-5 py-4">
              <div className="min-w-0">
                {selectedDepartment || selectedTypeFolder ? (
                  <button
                    type="button"
                    onClick={() => {
                      if (selectedDocument) {
                        setSelectedDocumentId(null);
                        return;
                      }
                      if (selectedTypeFolder) {
                        setSelectedTypeKey(null);
                        return;
                      }
                      setSelectedDepartmentKey(null);
                    }}
                    className="mb-1 inline-flex items-center gap-1 text-xs font-semibold text-brand-blue hover:text-brand-navy"
                  >
                    <ArrowLeft className="h-3.5 w-3.5" />
                    {selectedDocument
                      ? selectedTypeFolder?.title
                      : selectedTypeFolder
                        ? selectedDepartment?.title ?? listTitle
                        : listTitle}
                  </button>
                ) : null}
                <h2 className="truncate text-sm font-bold text-brand-navy">
                  {selectedDocument
                    ? catalogDocumentOptionLabel(selectedDocument)
                    : selectedTypeFolder
                      ? selectedTypeFolder.title
                      : selectedDepartment
                        ? selectedDepartment.title
                        : listTitle}
                </h2>
                <p className="mt-0.5 text-xs text-gray-500">
                  {loading
                    ? "Loading…"
                    : selectedTypeFolder && selectedTypeDocuments.length > 0 && !selectedDocument
                      ? `${selectedTypeDocuments.length} document${selectedTypeDocuments.length === 1 ? "" : "s"}`
                      : selectedTypeFolder
                        ? `${selectedTypeFolder.applications.length} application${
                            selectedTypeFolder.applications.length === 1 ? "" : "s"
                          }`
                        : selectedDepartment
                          ? `${selectedDepartment.types.length} type${
                              selectedDepartment.types.length === 1 ? "" : "s"
                            }`
                          : `${filtered.length} application${filtered.length === 1 ? "" : "s"}`}
                </p>
              </div>
              {stageFilter !== "all" && (
                <button
                  type="button"
                  onClick={() => setStageFilter("all")}
                  className="text-xs font-semibold text-brand-blue hover:text-brand-navy"
                >
                  Clear filter
                </button>
              )}
            </div>

            <div className="bg-slate-50/70 xl:min-h-0 xl:flex-1 xl:overflow-y-auto xl:overscroll-contain">
              {loading ? (
                <p className="px-5 py-12 text-center text-sm text-gray-500">
                  Loading applications…
                </p>
              ) : filtered.length === 0 ? (
                <div className="flex flex-col items-center gap-3 px-5 py-12 text-center">
                  <CircleDashed className="h-8 w-8 text-gray-300" />
                  <p className="text-sm text-gray-500">
                    {applications.length === 0
                      ? "No applications yet. Create one to get started."
                      : "No applications in this stage."}
                  </p>
                  {applications.length === 0 &&
                    (canCreateApplications ? (
                      <Link
                        href="/create-application"
                        className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold ${BTN_PRIMARY}`}
                      >
                        <FilePlus2 className="h-4 w-4" />
                        Create Application
                      </Link>
                    ) : (
                      <button
                        type="button"
                        disabled
                        aria-disabled="true"
                        title="Only owners, developers, architects, and licensed surveyors can create applications"
                        className={`inline-flex cursor-not-allowed items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold opacity-50 ${BTN_PRIMARY}`}
                      >
                        <FilePlus2 className="h-4 w-4" />
                        Create Application
                      </button>
                    ))}
                </div>
              ) : !selectedDepartment && !selectedTypeFolder ? (
                <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3">
                  {departmentFolders.map((folder) => {
                    const applicationCount = new Set(
                      folder.types.flatMap((type) => type.applications.map((app) => app.id))
                    ).size;
                    return (
                      <button
                        key={folder.key}
                        type="button"
                        onClick={() => {
                          setSelectedDocumentId(null);
                          setSelectedTypeKey(null);
                          setSelectedDepartmentKey(folder.key);
                        }}
                        className="flex w-full items-center gap-3 rounded-xl border border-gray-100 bg-white p-4 text-left shadow-sm transition-all hover:border-brand-blue/30 hover:shadow-md"
                      >
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-brand-blue ring-1 ring-blue-100/80">
                          <Folder className="h-5 w-5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-brand-navy">
                            {folder.title}
                          </p>
                          <p className="mt-0.5 text-xs text-gray-500">
                          {applicationCount} application{applicationCount === 1 ? "" : "s"}
                          </p>
                        </div>
                        <ChevronRight className="h-4 w-4 shrink-0 text-gray-300" />
                      </button>
                    );
                  })}
                </div>
              ) : selectedDepartment && !selectedTypeFolder ? (
                <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3">
                  {selectedDepartment.types.map((folder) => (
                    <button
                      key={folder.key}
                      type="button"
                      onClick={() => {
                        setSelectedDocumentId(null);
                        setSelectedTypeKey(folder.key);
                      }}
                      className="flex w-full items-center gap-3 rounded-xl border border-gray-100 bg-white p-4 text-left shadow-sm transition-all hover:border-brand-blue/30 hover:shadow-md"
                    >
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-brand-blue ring-1 ring-blue-100/80">
                        <Folder className="h-5 w-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-brand-navy">
                          {folder.title}
                        </p>
                        <p className="mt-0.5 text-xs text-gray-500">
                          {folder.applications.length} application{folder.applications.length === 1 ? "" : "s"}
                        </p>
                      </div>
                      <ChevronRight className="h-4 w-4 shrink-0 text-gray-300" />
                    </button>
                  ))}
                </div>
              ) : selectedTypeDocuments.length > 0 && !selectedDocument && selectedTypeFolder ? (
                <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3">
                  {selectedTypeDocuments.map((doc) => (
                    <button
                      key={doc.id}
                      type="button"
                      onClick={() => setSelectedDocumentId(doc.id)}
                      className="flex w-full items-center gap-3 rounded-xl border border-gray-100 bg-white p-4 text-left shadow-sm transition-all hover:border-brand-blue/30 hover:shadow-md"
                    >
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-brand-blue ring-1 ring-blue-100/80">
                        <Folder className="h-5 w-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-brand-navy">
                          {catalogDocumentOptionLabel(doc)}
                        </p>
                        <p className="mt-0.5 text-xs text-gray-500">
                          {selectedTypeFolder.applications.length} application{selectedTypeFolder.applications.length === 1 ? "" : "s"}
                        </p>
                      </div>
                      <ChevronRight className="h-4 w-4 shrink-0 text-gray-300" />
                    </button>
                  ))}
                </div>
              ) : selectedTypeFolder ? (
                <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3">
                  {selectedTypeFolder.applications.map((app) => {
                    const stage = getApplicationStage(app);
                    const canManage = canManageProjectApps(app.projectId);
                    const canReject = canManage && stage === "in_process";
                    const canDelete =
                      canManage && (stage === "draft" || stage === "in_process");
                    const canBackToDraft = canManage && stage === "in_process";
                    const rowBusy = busyId === app.id;
                    const rejecting = rowBusy && pendingAction?.type === "reject";
                    const deleting = rowBusy && pendingAction?.type === "delete";
                    const backingToDraft =
                      rowBusy && pendingAction?.type === "back_to_draft";

                    return (
                      <div
                        key={app.id}
                        className="flex flex-col rounded-xl border border-gray-100 bg-white p-4 shadow-sm transition-all hover:border-brand-blue/30 hover:shadow-md"
                      >
                        <button
                          type="button"
                          onClick={() => router.push(applicationHref(app))}
                          className="flex min-w-0 items-start gap-3 text-left"
                        >
                          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-brand-blue ring-1 ring-blue-100/80">
                            <FileText className="h-5 w-5" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-start justify-between gap-2">
                              <p className="line-clamp-2 text-sm font-semibold text-brand-navy">
                                {app.projectTitle || app.permissionType}
                              </p>
                              <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-gray-300" />
                            </div>
                            <span
                              className={`mt-2 inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ring-1 ring-inset ${STAGE_BADGE_CLASSES[stage]}`}
                            >
                              {STAGE_LABELS[stage]}
                            </span>
                            {selectedTypeFolder.direct && app.permissionType ? (
                              <p className="mt-2 truncate text-xs text-gray-500">
                                {app.permissionType}
                              </p>
                            ) : null}
                            <p className="mt-1 truncate text-xs text-gray-500">
                              {app.department && app.department !== "—"
                                ? app.department
                                : "No department"}
                            </p>
                            <p className="mt-0.5 text-xs text-gray-400">
                              {formatCreatedAt(app.createdAt)}
                            </p>
                          </div>
                        </button>

                        {(canReject || canDelete || canBackToDraft) && (
                          <div className="mt-3 flex flex-wrap gap-1.5 border-t border-gray-100 pt-3">
                            {canBackToDraft && (
                              <button
                                type="button"
                                onClick={() =>
                                  setPendingAction({ type: "back_to_draft", app })
                                }
                                disabled={rowBusy || actionBusy}
                                title="Back to draft"
                                aria-label={`Back to draft ${app.permissionType}`}
                                className="inline-flex h-8 items-center gap-1.5 rounded-full border border-gray-200 bg-white px-2.5 text-xs font-medium text-gray-500 transition-colors hover:bg-slate-50 hover:text-brand-navy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue/40 disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                {backingToDraft ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <RotateCcw className="h-3.5 w-3.5" />
                                )}
                                {backingToDraft ? "Moving…" : "Back to draft"}
                              </button>
                            )}
                            {canReject && (
                              <button
                                type="button"
                                onClick={() => setPendingAction({ type: "reject", app })}
                                disabled={rowBusy || actionBusy}
                                title="Reject application"
                                aria-label={`Reject ${app.permissionType}`}
                                className="inline-flex h-8 items-center gap-1.5 rounded-full border border-gray-200 bg-white px-2.5 text-xs font-medium text-gray-500 transition-colors hover:bg-amber-50 hover:text-amber-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/40 disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                {rejecting ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <XCircle className="h-3.5 w-3.5" />
                                )}
                                {rejecting ? "Rejecting…" : "Reject"}
                              </button>
                            )}
                            {canDelete && (
                              <button
                                type="button"
                                onClick={() => setPendingAction({ type: "delete", app })}
                                disabled={rowBusy || actionBusy}
                                title="Delete application"
                                aria-label={`Delete ${app.permissionType}`}
                                className="inline-flex h-8 items-center gap-1.5 rounded-full border border-gray-200 bg-white px-2.5 text-xs font-medium text-gray-500 transition-colors hover:bg-rose-50 hover:text-rose-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400/40 disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                {deleting ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <Trash2 className="h-3.5 w-3.5" />
                                )}
                                {deleting ? "Deleting…" : "Delete"}
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : null}
            </div>
          </div>
      </div>

      <Modal
        open={Boolean(pendingAction)}
        onClose={() => {
          if (!actionBusy) setPendingAction(null);
        }}
        title={
          pendingAction?.type === "delete"
            ? "Delete application?"
            : pendingAction?.type === "back_to_draft"
              ? "Move back to draft?"
              : "Reject this application?"
        }
        maxWidth="sm"
      >
        {pendingAction && (
          <div className="space-y-5">
            <div className="flex items-start gap-3">
              <div
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
                  pendingAction.type === "delete"
                    ? "bg-rose-50 text-rose-600"
                    : pendingAction.type === "back_to_draft"
                      ? "bg-slate-100 text-brand-navy"
                      : "bg-amber-50 text-amber-600"
                }`}
              >
                {pendingAction.type === "delete" ? (
                  <Trash2 className="h-4 w-4" />
                ) : pendingAction.type === "back_to_draft" ? (
                  <RotateCcw className="h-4 w-4" />
                ) : (
                  <XCircle className="h-4 w-4" />
                )}
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-brand-navy">
                  {pendingAction.app.permissionType}
                </p>
                <p className="mt-0.5 truncate text-xs text-gray-500">
                  {pendingAction.app.projectTitle}
                </p>
                <p className="mt-2 text-sm leading-relaxed text-gray-600">
                  {pendingAction.type === "delete"
                    ? "This application will be permanently removed. This cannot be undone."
                    : pendingAction.type === "back_to_draft"
                      ? "This application will return to Draft and existing signatures will be cleared."
                      : "This application will move to Rejected. Owner and consultant will be notified."}
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setPendingAction(null)}
                disabled={actionBusy}
                className="rounded-lg border border-gray-200 px-3.5 py-2 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void confirmPendingAction()}
                disabled={actionBusy}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-sm font-semibold text-white shadow-sm transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                  pendingAction.type === "delete"
                    ? "bg-rose-600 hover:bg-rose-700"
                    : pendingAction.type === "back_to_draft"
                      ? "bg-brand-navy hover:bg-brand-navy/90"
                      : "bg-amber-600 hover:bg-amber-700"
                }`}
              >
                {actionBusy ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : pendingAction.type === "delete" ? (
                  <Trash2 className="h-4 w-4" />
                ) : pendingAction.type === "back_to_draft" ? (
                  <RotateCcw className="h-4 w-4" />
                ) : (
                  <XCircle className="h-4 w-4" />
                )}
                {actionBusy
                  ? pendingAction.type === "delete"
                    ? "Deleting…"
                    : pendingAction.type === "back_to_draft"
                      ? "Moving…"
                      : "Rejecting…"
                  : pendingAction.type === "delete"
                    ? "Yes, delete"
                    : pendingAction.type === "back_to_draft"
                      ? "Yes, move to draft"
                      : "Yes, reject"}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

export default function ApplicationsHubPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto flex min-h-0 w-full max-w-7xl flex-1 items-center justify-center px-4 py-12">
          <p className="text-sm text-gray-500">Loading applications…</p>
        </div>
      }
    >
      <ApplicationsHubContent />
    </Suspense>
  );
}
