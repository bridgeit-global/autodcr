"use client";

import { Suspense, useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  CheckCircle2,
  ChevronDown,
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
import { useMasterProjectFilter } from "@/app/components/appshell/MasterProjectFilterContext";
import MetricCard from "@/app/components/ui/MetricCard";
import Modal from "@/app/components/ui/Modal";
import { useDashboardAlertModal } from "@/app/dashboard/context/DashboardAlertModalContext";
import {
  readRememberedDashboardProjectIds,
  useDashboardProjects,
} from "@/app/hooks/useDashboardProjects";
import { supabase } from "@/app/utils/supabase";
import {
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
  readCachedApplicationsList,
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

const ALL_DEPARTMENTS = "__all_departments__";

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

type NestedTypeFolder = {
  key: string;
  title: string;
  applications: DashboardApplication[];
  direct?: boolean;
};

type NestedDepartment = {
  key: string;
  title: string;
  types: NestedTypeFolder[];
};

function folderCountLabel(count: number, noun: string) {
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
}

function DropdownRow({
  title,
  subtitle,
  selected = false,
  expandable = false,
  open = false,
  onClick,
}: {
  title: string;
  subtitle?: string;
  selected?: boolean;
  expandable?: boolean;
  open?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors ${
        selected
          ? "border border-slate-300 bg-white shadow-sm"
          : "border border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
      }`}
    >
      <span
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
          selected ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-500"
        }`}
      >
        <Folder className="h-4 w-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold text-slate-900">{title}</span>
        {subtitle ? <span className="block truncate text-xs text-gray-500">{subtitle}</span> : null}
      </span>
      {expandable ? (
        <ChevronDown className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${open ? "" : "-rotate-90"}`} />
      ) : (
        <ChevronRight className="h-4 w-4 shrink-0 text-gray-300" />
      )}
    </button>
  );
}

function ApplicationsBrowse({
  department,
  typeTitle,
  countLabel,
  stageFilter,
  onClearStage,
  onSelectAll,
  onSelectDepartment,
}: {
  department: NestedDepartment | null;
  typeTitle: string | null;
  countLabel: string;
  stageFilter: ApplicationStageFilter;
  onClearStage: () => void;
  onSelectAll: () => void;
  onSelectDepartment: () => void;
}) {
  const steps = [
    { id: "all", label: "All departments", onSelect: onSelectAll },
    ...(department
      ? [{ id: department.key, label: department.title, onSelect: onSelectDepartment }]
      : []),
    ...(department && typeTitle
      ? [{ id: `${department.key}:type`, label: typeTitle, onSelect: () => undefined }]
      : []),
  ];

  return (
    <div className="flex min-w-0 items-center gap-2 overflow-x-auto">
      {steps.map((step, index) => {
        const last = index === steps.length - 1;
        return (
          <div key={step.id} className="flex min-w-0 shrink-0 items-center gap-2">
            {index > 0 ? <ChevronRight className="h-4 w-4 shrink-0 text-slate-300" /> : null}
            <button
              type="button"
              onClick={step.onSelect}
              aria-current={last ? "page" : undefined}
              className={`flex min-w-0 items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition-colors ${
                last
                  ? "border border-slate-300 bg-white shadow-sm"
                  : "border border-slate-200 bg-white shadow-sm hover:border-slate-300"
              }`}
            >
              {index === 0 ? (
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-900 text-white">
                  <Folder className="h-4 w-4" />
                </span>
              ) : null}
              <span className="min-w-0">
                {index === 0 ? (
                  <span className="block text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                    Browse
                  </span>
                ) : null}
                <span className="block max-w-[220px] truncate text-sm font-semibold text-slate-900">
                  {step.label}
                </span>
              </span>
              {last ? (
                <span className="shrink-0 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                  {countLabel}
                </span>
              ) : null}
            </button>
          </div>
        );
      })}
      {stageFilter !== "all" ? (
        <button
          type="button"
          onClick={onClearStage}
          className="shrink-0 text-xs font-semibold text-slate-500 hover:text-slate-900"
        >
          Clear filter
        </button>
      ) : null}
    </div>
  );
}

function ApplicationsDropdown({
  departments,
  selectedDepartment,
  selectedType,
  openSingleApplicationDirectly = false,
  onSelectAll,
  onSelectDepartment,
  onSelectType,
  renderLeaf,
}: {
  departments: NestedDepartment[];
  selectedDepartment: NestedDepartment | null;
  selectedType: NestedTypeFolder | null;
  openSingleApplicationDirectly?: boolean;
  onSelectAll: () => void;
  onSelectDepartment: (key: string) => void;
  onSelectType: (folder: NestedTypeFolder) => boolean;
  renderLeaf: (folder: NestedTypeFolder) => ReactNode;
}) {
  const [rootOpen, setRootOpen] = useState(true);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => {
    const initial = new Set<string>();
    if (selectedDepartment) initial.add(selectedDepartment.key);
    if (selectedType) initial.add(`${selectedDepartment?.key ?? ""}:${selectedType.key}`);
    return initial;
  });

  const selectedPathKey = [
    selectedDepartment?.key ?? "",
    selectedType?.key ?? "",
  ].join("|");

  useEffect(() => {
    const [departmentKey, typeKey] = selectedPathKey.split("|");
    if (!departmentKey) return;
    setRootOpen(true);
    setExpandedIds((prev) => {
      let changed = false;
      const next = new Set(prev);
      if (!next.has(departmentKey)) {
        next.add(departmentKey);
        changed = true;
      }
      if (typeKey) {
        const typeId = `${departmentKey}:${typeKey}`;
        if (!next.has(typeId)) {
          next.add(typeId);
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [selectedPathKey]);

  const toggleExpanded = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="flex flex-col">
      <div className="shrink-0 bg-slate-50/70 px-3 pt-3">
        <DropdownRow
          title="All departments"
          selected={!selectedDepartment}
          expandable
          open={rootOpen}
          onClick={() => {
            if (!selectedDepartment) {
              setRootOpen((open) => !open);
              return;
            }
            onSelectAll();
            setRootOpen(true);
          }}
        />
      </div>
      {rootOpen ? (
        <div className="max-h-[min(60vh,420px)] overflow-y-auto px-3 pb-3">
          <div className="mt-1 ml-6 flex flex-col gap-1 border-l border-slate-200 pl-3">
            {departments.map((department) => {
              const departmentSelected = selectedDepartment?.key === department.key;
              const departmentOpen = expandedIds.has(department.key);

              return (
                <div key={department.key} className="flex flex-col gap-1">
                  <DropdownRow
                    title={department.title}
                    subtitle={folderCountLabel(department.types.length, "folder")}
                    selected={departmentSelected && !selectedType}
                    expandable
                    open={departmentOpen}
                    onClick={() => {
                      onSelectDepartment(department.key);
                      if (departmentSelected && !selectedType && departmentOpen) {
                        toggleExpanded(department.key);
                        return;
                      }
                      setExpandedIds((prev) => new Set(prev).add(department.key));
                    }}
                  />
                  {departmentOpen ? (
                    <div className="ml-6 flex flex-col gap-1 border-l border-slate-200 pl-3">
                      {department.types.map((folder) => {
                        const typeId = `${department.key}:${folder.key}`;
                        const typeSelected =
                          departmentSelected && selectedType?.key === folder.key;
                        const typeOpen = expandedIds.has(typeId);

                        return (
                          <div key={folder.key} className="flex flex-col gap-1">
                            <DropdownRow
                              title={folder.title}
                              subtitle={folderCountLabel(
                                folder.applications.length,
                                "application"
                              )}
                              selected={typeSelected}
                              expandable={
                                !(
                                  openSingleApplicationDirectly &&
                                  folder.applications.length === 1
                                )
                              }
                              open={typeOpen}
                              onClick={() => {
                                const openedDirectly = onSelectType(folder);
                                if (openedDirectly) return;
                                if (typeSelected && typeOpen) {
                                  toggleExpanded(typeId);
                                  return;
                                }
                                setExpandedIds((prev) => {
                                  const next = new Set(prev);
                                  next.add(department.key);
                                  next.add(typeId);
                                  return next;
                                });
                              }}
                            />
                            {typeOpen ? (
                              <div className="ml-6 flex flex-col gap-1 border-l border-slate-200 pl-3">
                                {renderLeaf(folder)}
                              </div>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function ApplicationsHubContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { showAlert } = useDashboardAlertModal();
  const { masterProjectId } = useMasterProjectFilter();
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
  const [selectedDepartmentKey, setSelectedDepartmentKey] = useState<string | null>(
    ALL_DEPARTMENTS
  );
  const [selectedTypeKey, setSelectedTypeKey] = useState<string | null>(null);

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
      const { data: sessionData } = await supabase.auth.getSession();
      let userId = sessionData.session?.user?.id ?? null;
      if (!userId) {
        const { data: authData } = await supabase.auth.getUser();
        userId = authData.user?.id ?? null;
      }
      if (!userId) {
        if (!cancelled) {
          setApplications([]);
          setApplicationsLoading(false);
        }
        return;
      }

      const liveProjectIds = projects.map((project) => String(project.id));
      const projectIds = masterProjectId
        ? [masterProjectId]
        : liveProjectIds.length > 0
          ? liveProjectIds
          : readRememberedDashboardProjectIds(userId);
      if (projectIds.length === 0) {
        if (!projectsLoading && !masterProjectId) {
          setApplications([]);
          setApplicationsLoading(false);
        }
        return;
      }

      const request = {
        userId,
        isConsultant,
        projectIds,
      };
      const cached = readCachedApplicationsList(request);
      if (cached) {
        if (!cancelled) {
          setApplications(cached);
          setApplicationsLoading(false);
        }
      } else if (!cancelled) {
        setApplicationsLoading(true);
      }

      try {
        const rows = await fetchApplicationsList(request);
        if (!cancelled) setApplications(rows);
      } catch (err) {
        console.error("Failed to load applications:", err);
        if (!cancelled && !cached) setApplications([]);
      } finally {
        if (!cancelled) setApplicationsLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [projects, projectsLoading, isConsultant, masterProjectId]);

  const effectiveProjectId = useMemo(() => {
    if (!masterProjectId) return "";
    return projects.some((project) => project.id === masterProjectId) ? masterProjectId : "";
  }, [masterProjectId, projects]);

  const projectScoped = useMemo(() => {
    if (!effectiveProjectId) return applications;
    return applications.filter((app) => app.projectId === effectiveProjectId);
  }, [applications, effectiveProjectId]);

  const health = useMemo(() => bucketApplicationHealth(projectScoped), [projectScoped]);

  const filtered = useMemo(
    () => filterApplicationsByStage(projectScoped, stageFilter),
    [projectScoped, stageFilter]
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
    const openTypeId =
      selectedTypeKey && !selectedTypeKey.startsWith("letter:")
        ? catalogTypes.find(
            (type) => type.application_title.trim().toLowerCase() === selectedTypeKey
          )?.id
        : null;
    const typeIds = catalogTypes
      .filter((type) => {
        const title = type.application_title.trim().toLowerCase();
        if (!titles.has(title)) return false;
        if (type.category === "appointment_letter") return true;
        return Boolean(openTypeId && type.id === openTypeId);
      })
      .map((type) => type.id);
    if (typeIds.length === 0) return;
    let cancelled = false;
    void Promise.all(
      typeIds.map(async (id) => [id, await fetchDocumentsForApplicationType(id)] as const)
    ).then((pairs) => {
      if (cancelled) return;
      setDocumentsByTypeId((current) => {
        const next = { ...current };
        for (const [id, docs] of pairs) next[id] = docs;
        return next;
      });
    });
    return () => {
      cancelled = true;
    };
  }, [applications, catalogTypes, selectedTypeKey]);

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

  useEffect(() => {
    if (!selectedDepartmentKey || selectedDepartmentKey === ALL_DEPARTMENTS) return;
    if (!departmentFolders.some((folder) => folder.key === selectedDepartmentKey)) {
      setSelectedDepartmentKey(null);
      setSelectedTypeKey(null);
    }
  }, [departmentFolders, selectedDepartmentKey]);

  useEffect(() => {
    if (!selectedTypeKey) return;
    const typeStillVisible = selectedDepartment?.types.some(
      (folder) => folder.key === selectedTypeKey
    );
    if (!typeStillVisible) {
      setSelectedTypeKey(null);
    }
  }, [selectedDepartment, selectedTypeKey]);

  const openTypeFolder = useCallback(
    (folder: { key: string; applications: DashboardApplication[] }) => {
      if (effectiveProjectId && folder.applications.length === 1) {
        router.push(applicationHref(folder.applications[0]));
        return true;
      }
      setSelectedTypeKey(folder.key);
      return false;
    },
    [effectiveProjectId, router]
  );

  const loading = projectsLoading || applicationsLoading;
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
    <div className="mx-auto flex min-h-0 w-full max-w-7xl flex-1 flex-col gap-6 overflow-y-auto overscroll-contain px-4 py-6 md:px-6 md:py-8">
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

      <div className="flex flex-col">
          <div className="flex flex-col rounded-xl border border-gray-100 bg-white shadow-sm">
            <div className="shrink-0 border-b border-slate-200/80 bg-slate-50 px-3 py-3">
              <ApplicationsBrowse
                department={selectedDepartment}
                typeTitle={selectedTypeFolder?.title ?? null}
                countLabel={
                  loading
                    ? "Loading…"
                    : selectedTypeFolder
                      ? folderCountLabel(selectedTypeFolder.applications.length, "application")
                      : selectedDepartment
                        ? folderCountLabel(selectedDepartment.types.length, "folder")
                        : folderCountLabel(departmentFolders.length, "folder")
                }
                stageFilter={stageFilter}
                onClearStage={() => setStageFilter("all")}
                onSelectAll={() => {
                  setSelectedTypeKey(null);
                  setSelectedDepartmentKey(ALL_DEPARTMENTS);
                }}
                onSelectDepartment={() => setSelectedTypeKey(null)}
              />
            </div>

            <div className="flex flex-col bg-slate-50/70">
              {loading ? (
                <p className="px-5 py-12 text-center text-sm text-gray-500">
                  Loading applications…
                </p>
              ) : filtered.length === 0 ? (
                <div className="flex flex-col items-center gap-3 px-5 py-12 text-center">
                  <CircleDashed className="h-8 w-8 text-gray-300" />
                  <p className="text-sm text-gray-500">
                    {projectScoped.length === 0
                      ? applications.length === 0
                        ? "No applications yet. Create one to get started."
                        : "No applications for this project."
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
              ) : (
                <ApplicationsDropdown
                  departments={departmentFolders}
                  selectedDepartment={selectedDepartment}
                  selectedType={selectedTypeFolder}
                  openSingleApplicationDirectly={Boolean(effectiveProjectId)}
                  onSelectAll={() => {
                    setSelectedTypeKey(null);
                    setSelectedDepartmentKey(ALL_DEPARTMENTS);
                  }}
                  onSelectDepartment={(key) => {
                    setSelectedTypeKey(null);
                    setSelectedDepartmentKey(key);
                  }}
                  onSelectType={(folder) => {
                    const department = departmentFolders.find((item) =>
                      item.types.some((type) => type.key === folder.key)
                    );
                    if (department) setSelectedDepartmentKey(department.key);
                    return openTypeFolder(folder);
                  }}
                  renderLeaf={(folder) => (
                <div className="flex flex-col gap-2">
                  {folder.applications.map((app) => {
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
                    const projectAlreadySelected = Boolean(effectiveProjectId);
                    const cardTitle = projectAlreadySelected
                      ? app.permissionType || folder.title || "Application"
                      : app.projectTitle || app.permissionType;
                    const showPermissionType =
                      folder.direct &&
                      Boolean(app.permissionType) &&
                      app.permissionType !== cardTitle;
                    const showDepartment =
                      !projectAlreadySelected &&
                      Boolean(app.department && app.department !== "—");

                    return (
                      <div
                        key={app.id}
                        className="flex flex-col rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition-colors hover:border-slate-300"
                      >
                        <button
                          type="button"
                          onClick={() => router.push(applicationHref(app))}
                          className="flex min-w-0 items-start gap-3 text-left"
                        >
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
                            <FileText className="h-5 w-5" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-start justify-between gap-2">
                              <p className="line-clamp-2 text-sm font-semibold text-slate-900">
                                {cardTitle}
                              </p>
                              <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-gray-300" />
                            </div>
                            <span
                              className={`mt-2 inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ring-1 ring-inset ${STAGE_BADGE_CLASSES[stage]}`}
                            >
                              {STAGE_LABELS[stage]}
                            </span>
                            {showPermissionType ? (
                              <p className="mt-2 truncate text-xs text-gray-500">
                                {app.permissionType}
                              </p>
                            ) : null}
                            {showDepartment ? (
                              <p className="mt-1 truncate text-xs text-gray-500">
                                {app.department}
                              </p>
                            ) : null}
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
                  )}
                />
              )}
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
