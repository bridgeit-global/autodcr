"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import { isPageSaved, loadDraft, saveDraft } from "@/app/utils/draftStorage";
import { useApplicationPdfSaveSlot } from "@/app/dashboard/context/ApplicationPdfSaveSlotContext";
import { useApplicationSignSlot } from "@/app/dashboard/context/ApplicationSignSlotContext";
import { useDashboardAlertModal } from "@/app/dashboard/context/DashboardAlertModalContext";
import { useEffect, useState, type ReactNode } from "react";
import { BTN_PRIMARY, NAV_ITEM_ACTIVE, NAV_ITEM_ACTIVE_BAR } from "@/app/utils/buttonClasses";
import { TEXT_CAPTION, TEXT_NAV, TEXT_TITLE_MD } from "@/app/utils/typography";
import {
  CREATE_PROJECT_SECTIONS,
  LIBRARY_GATE_ALERT,
  isGatedCreateProjectPath,
  loadProjectLibraryDraftBundle,
  restoreProjectLibraryDraft,
  shouldGateCreateProjectSections,
} from "@/app/utils/projectSections";

type DashboardSidebarProps = {
  collapsed: boolean;
  onToggleSidebar: () => void;
  onSubmitProjectClick: () => void;
  onSaveDraftClick: () => void;
  allPagesSaved: boolean;
  isDraftProject: boolean;
  isProjectDataLoading?: boolean;
  isSubmittingProject?: boolean;
};

const DashboardSidebar = ({
  collapsed,
  onToggleSidebar,
  onSubmitProjectClick,
  onSaveDraftClick,
  allPagesSaved,
  isDraftProject,
  isProjectDataLoading = false,
  isSubmittingProject = false,
}: DashboardSidebarProps) => {
  const { slot: applicationPdfSaveSlot } = useApplicationPdfSaveSlot();
  const { slot: applicationSignSlot } = useApplicationSignSlot();
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  
  // Get projectId from URL to preserve it when navigating
  const projectId = searchParams.get("projectId");
  const isReadOnlyMode = searchParams.get("mode") === "readonly";
  const mode = searchParams.get("mode");
  const applicationId = searchParams.get("applicationId");
  const selectedApplication = searchParams.get("selectedApplication");
  const selectedApplicationNo = searchParams.get("applicationNo");
  const isEditMode = !!projectId;
  const { showAlert } = useDashboardAlertModal();
  const [showUnsavedWarning, setShowUnsavedWarning] = useState(false);
  const [pendingPath, setPendingPath] = useState<string | null>(null);
  const [isLibraryGated, setIsLibraryGated] = useState(() =>
    shouldGateCreateProjectSections({ isEditMode, isReadOnlyMode })
  );

  useEffect(() => {
    const check = () => {
      setIsLibraryGated(shouldGateCreateProjectSections({ isEditMode, isReadOnlyMode }));
    };
    check();
    const interval = setInterval(check, 400);
    return () => clearInterval(interval);
  }, [isEditMode, isReadOnlyMode]);

  const hasMeaningfulValue = (value: unknown): boolean => {
    if (value === null || value === undefined) return false;
    if (typeof value === "string") return value.trim().length > 0;
    if (typeof value === "number") return !Number.isNaN(value) && value !== 0;
    if (typeof value === "boolean") return value;
    if (Array.isArray(value)) return value.some(hasMeaningfulValue);
    if (typeof value === "object") {
      return Object.values(value as Record<string, unknown>).some(hasMeaningfulValue);
    }
    return false;
  };

  const normalizeForCompare = (value: unknown): unknown => {
    if (Array.isArray(value)) {
      return value.map((item) => normalizeForCompare(item));
    }
    if (value && typeof value === "object") {
      const obj = value as Record<string, unknown>;
      return Object.keys(obj)
        .sort()
        .reduce<Record<string, unknown>>((acc, key) => {
          acc[key] = normalizeForCompare(obj[key]);
          return acc;
        }, {});
    }
    return value;
  };

  const deepEqual = (a: unknown, b: unknown): boolean => {
    return JSON.stringify(normalizeForCompare(a)) === JSON.stringify(normalizeForCompare(b));
  };

  const getLiveFormValues = () => {
    if (typeof document === "undefined") return {} as Record<string, unknown>;
    const fields = document.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>(
      "main form input[name], main form select[name], main form textarea[name]"
    );

    const values: Record<string, unknown> = {};
    fields.forEach((field) => {
      const name = field.name;
      if (!name) return;

      if (field instanceof HTMLInputElement) {
        if (field.type === "radio") {
          if (field.checked) values[name] = field.value;
          return;
        }
        if (field.type === "checkbox") {
          values[name] = field.checked;
          return;
        }
      }

      values[name] = field.value;
    });

    return values;
  };

  const getBaselineKey = (path: string) => {
    const normalizedPath = path.replace(/\/$/, "");
    const map: Record<string, string> = {
      "/dashboard/project-details": "baseline-project-details-snapshot",
      "/dashboard/applicant": "baseline-applicant-details-snapshot",
      "/dashboard/building": "baseline-building-details-snapshot",
      "/dashboard/area": "baseline-area-details-snapshot",
      "/dashboard/project-library": "baseline-project-library-snapshot",
      "/dashboard/bg": "baseline-bg-details-snapshot",
    };
    return map[normalizedPath] ?? "";
  };

  const getDirtyKey = (path: string) => {
    const normalizedPath = path.replace(/\/$/, "");
    const map: Record<string, string> = {
      "/dashboard/project-details": "dirty-project-details",
      "/dashboard/applicant": "dirty-applicant-details",
      "/dashboard/building": "dirty-building-details",
      "/dashboard/area": "dirty-area-details",
      "/dashboard/project-library": "dirty-project-library",
      "/dashboard/bg": "dirty-bg-details",
    };
    return map[normalizedPath] ?? "";
  };

  const getSectionState = (path: string) => {
    const normalizedPath = path.replace(/\/$/, "");

    if (normalizedPath === "/dashboard/building") {
      const liveValues = getLiveFormValues();
      const storedDraft = loadDraft<Record<string, unknown>>("draft-building-details-form", {});
      const liveChanged = Object.entries(liveValues).some(([key, value]) => {
        const storedValue = storedDraft[key];
        return String(storedValue ?? "") !== String(value ?? "");
      });

      return {
        draft: { ...storedDraft, ...liveValues },
        snapshot: loadDraft<Record<string, unknown> | null>("saved-building-details-snapshot", null),
        baseline: loadDraft<Record<string, unknown> | null>(getBaselineKey(path), null),
        isSaved: isPageSaved("saved-building-details"),
        liveChanged,
        restore: () => {
          const snapshot = loadDraft<Record<string, unknown> | null>("saved-building-details-snapshot", null);
          const baseline = loadDraft<Record<string, unknown> | null>(getBaselineKey(path), null);
          const target = snapshot ?? baseline ?? {};
          saveDraft("draft-building-details-form", target);
        },
      };
    }

    if (normalizedPath === "/dashboard/project-details") {
      const liveValues = getLiveFormValues();
      const isSavePlotTabVisible = Object.prototype.hasOwnProperty.call(liveValues, "region");

      const storedProjectInfo = loadDraft<Record<string, unknown>>("draft-project-details-project", {});
      const storedSavePlot = loadDraft<Record<string, unknown>>("draft-project-details-save-plot", {});
      const liveTarget = isSavePlotTabVisible ? storedSavePlot : storedProjectInfo;
      const liveChanged = Object.entries(liveValues).some(([key, value]) => {
        const storedValue = liveTarget[key];
        return String(storedValue ?? "") !== String(value ?? "");
      });

      return {
        draft: {
          projectInfo: isSavePlotTabVisible ? storedProjectInfo : { ...storedProjectInfo, ...liveValues },
          savePlot: isSavePlotTabVisible ? { ...storedSavePlot, ...liveValues } : storedSavePlot,
        },
        snapshot: {
          projectInfo: loadDraft<Record<string, unknown> | null>("saved-project-info-snapshot", null),
          savePlot: loadDraft<Record<string, unknown> | null>("saved-save-plot-details-snapshot", null),
        },
        baseline: loadDraft<Record<string, unknown> | null>(getBaselineKey(path), null),
        isSaved: isPageSaved("saved-project-info") && isPageSaved("saved-save-plot-details"),
        liveChanged,
        restore: () => {
          const projectInfo = loadDraft<Record<string, unknown> | null>("saved-project-info-snapshot", null);
          const savePlot = loadDraft<Record<string, unknown> | null>("saved-save-plot-details-snapshot", null);
          const baseline = loadDraft<{ projectInfo?: Record<string, unknown>; savePlot?: Record<string, unknown> } | null>(
            getBaselineKey(path),
            null
          );
          saveDraft("draft-project-details-project", projectInfo ?? baseline?.projectInfo ?? {});
          saveDraft("draft-project-details-save-plot", savePlot ?? baseline?.savePlot ?? {});
        },
      };
    }

    if (normalizedPath === "/dashboard/applicant") {
      return {
        draft: {
          form: loadDraft<Record<string, unknown>>("draft-applicant-details-form", {}),
          applicants: loadDraft<Record<string, unknown>[]>("draft-applicant-details-applicants", []),
        },
        snapshot: loadDraft<Record<string, unknown> | null>("saved-applicant-details-snapshot", null),
        baseline: loadDraft<Record<string, unknown> | null>(getBaselineKey(path), null),
        isSaved: isPageSaved("saved-applicant-details"),
        restore: () => {
          const snapshot = loadDraft<{ form?: Record<string, unknown>; applicants?: Record<string, unknown>[] } | null>(
            "saved-applicant-details-snapshot",
            null
          );
          const baseline = loadDraft<{ form?: Record<string, unknown>; applicants?: Record<string, unknown>[] } | null>(
            getBaselineKey(path),
            null
          );
          saveDraft("draft-applicant-details-form", snapshot?.form ?? baseline?.form ?? {});
          saveDraft("draft-applicant-details-applicants", snapshot?.applicants ?? baseline?.applicants ?? []);
        },
      };
    }

    if (normalizedPath === "/dashboard/area") {
      return {
        draft: {
          plots: loadDraft<Record<string, unknown>[]>("draft-area-details-plots", []),
          totals: loadDraft<Record<string, unknown> | null>("draft-area-details-totals", null),
        },
        snapshot: loadDraft<Record<string, unknown> | null>("saved-area-details-snapshot", null),
        baseline: loadDraft<Record<string, unknown> | null>(getBaselineKey(path), null),
        isSaved: isPageSaved("saved-area-details"),
        restore: () => {
          const snapshot = loadDraft<{ plots?: Record<string, unknown>[]; totals?: Record<string, unknown> } | null>(
            "saved-area-details-snapshot",
            null
          );
          const baseline = loadDraft<{ plots?: Record<string, unknown>[]; totals?: Record<string, unknown> } | null>(
            getBaselineKey(path),
            null
          );
          saveDraft("draft-area-details-plots", snapshot?.plots ?? baseline?.plots ?? []);
          saveDraft("draft-area-details-totals", snapshot?.totals ?? baseline?.totals ?? {});
        },
      };
    }

    if (normalizedPath === "/dashboard/project-library") {
      return {
        draft: loadProjectLibraryDraftBundle(),
        snapshot: loadDraft<unknown>("saved-project-library-snapshot", null),
        baseline: loadDraft<unknown>(getBaselineKey(path), null),
        isSaved: isPageSaved("saved-project-library"),
        restore: () => {
          const snapshot = loadDraft<unknown>("saved-project-library-snapshot", null);
          const baseline = loadDraft<unknown>(getBaselineKey(path), null);
          restoreProjectLibraryDraft(
            snapshot ?? baseline ?? { fixed: [], extraPr: [], extraDocs: [], dpAttachments: {} }
          );
        },
      };
    }

    if (normalizedPath === "/dashboard/bg") {
      return {
        draft: {
          form: loadDraft<Record<string, unknown>>("draft-bg-details-form", {}),
          entries: loadDraft<Record<string, unknown>[]>("draft-bg-details-entries", []),
          activeTab: loadDraft<string>("draft-bg-details-active-tab", "new-entry"),
        },
        snapshot: loadDraft<Record<string, unknown> | null>("saved-bg-details-snapshot", null),
        baseline: loadDraft<Record<string, unknown> | null>(getBaselineKey(path), null),
        isSaved: isPageSaved("saved-bg-details"),
        restore: () => {
          const snapshot = loadDraft<{ form?: Record<string, unknown>; entries?: Record<string, unknown>[]; activeTab?: string } | null>(
            "saved-bg-details-snapshot",
            null
          );
          const baseline = loadDraft<{ form?: Record<string, unknown>; entries?: Record<string, unknown>[]; activeTab?: string } | null>(
            getBaselineKey(path),
            null
          );
          saveDraft("draft-bg-details-form", snapshot?.form ?? baseline?.form ?? {});
          saveDraft("draft-bg-details-entries", snapshot?.entries ?? baseline?.entries ?? []);
          saveDraft("draft-bg-details-active-tab", snapshot?.activeTab ?? baseline?.activeTab ?? "new-entry");
        },
      };
    }

    return null;
  };

  const initializeSectionSnapshotBaseline = (path: string, draft: unknown) => {
    const normalizedPath = path.replace(/\/$/, "");
    if (!normalizedPath.startsWith("/dashboard/")) return;
    const baselineKey = getBaselineKey(path);
    if (baselineKey) {
      saveDraft(baselineKey, draft);
    }
  };

  const hasUnsavedSectionChanges = (path: string) => {
    const normalizedPath = path.replace(/\/$/, "");
    const dirtyKey = getDirtyKey(path);
    const isDirty = dirtyKey ? loadDraft<boolean>(dirtyKey, false) : false;
    if (!isDirty) return false;

    // Hard guard for Building Details using live DOM values.
    // This avoids timing/race issues between react-hook-form and localStorage sync.
    if (normalizedPath === "/dashboard/building") {
      const live = getLiveFormValues() as Record<string, unknown>;
      const liveBuilding = {
        buildingType: String(live.buildingType ?? ""),
        height: String(live.height ?? ""),
        fsiBuiltUpArea: String(live.fsiBuiltUpArea ?? ""),
        grossConstructionArea: String(live.grossConstructionArea ?? ""),
      };

      const hasSavedFlag = isPageSaved("saved-building-details");
      const savedSnapshot = loadDraft<Record<string, unknown> | null>("saved-building-details-snapshot", null);
      const baseline = loadDraft<Record<string, unknown> | null>(getBaselineKey(path), null);
      const normalizedTarget = {
        buildingType: String((savedSnapshot as Record<string, unknown> | null)?.buildingType ?? (baseline as Record<string, unknown> | null)?.buildingType ?? ""),
        height: String((savedSnapshot as Record<string, unknown> | null)?.height ?? (baseline as Record<string, unknown> | null)?.height ?? ""),
        fsiBuiltUpArea: String((savedSnapshot as Record<string, unknown> | null)?.fsiBuiltUpArea ?? (baseline as Record<string, unknown> | null)?.fsiBuiltUpArea ?? ""),
        grossConstructionArea: String((savedSnapshot as Record<string, unknown> | null)?.grossConstructionArea ?? (baseline as Record<string, unknown> | null)?.grossConstructionArea ?? ""),
      };
      const emptyDefaults = {
        buildingType: "",
        height: "",
        fsiBuiltUpArea: "",
        grossConstructionArea: "",
      };

      if (!hasSavedFlag) {
        // Create mode first-save case: any non-empty change should warn immediately.
        if (!isEditMode) {
          return !deepEqual(liveBuilding, emptyDefaults);
        }
        // Edit mode first-save case: compare against loaded baseline.
        return !deepEqual(liveBuilding, normalizedTarget);
      }

      // After explicit save, compare against saved snapshot.
      return !deepEqual(liveBuilding, normalizedTarget);
    }

    const sectionState = getSectionState(path);
    if (!sectionState) return false;

    // Global first-save behavior for all sections (create flow):
    // warn only when current state differs from entry baseline.
    if (!sectionState.isSaved && !isEditMode) {
      const hasBaseline = hasMeaningfulValue(sectionState.baseline);
      if (hasBaseline) {
        return !deepEqual(sectionState.draft, sectionState.baseline ?? {});
      }
      // Fallback only when baseline is unavailable.
      return hasMeaningfulValue(sectionState.draft);
    }

    // Treat null/empty snapshots as "no baseline yet".
    const snapshotMissingOrEmpty = !hasMeaningfulValue(sectionState.snapshot);
    const baselineMissingOrEmpty = !hasMeaningfulValue(sectionState.baseline);

    // If neither saved snapshot nor baseline exists yet, we can't reliably diff.
    // Rely on immediate live-change signal when available.
    if (snapshotMissingOrEmpty && baselineMissingOrEmpty) {
      // If user changed a visible Project Details field and draft store hasn't caught up yet,
      // treat that as unsaved immediately.
      if ((sectionState as { liveChanged?: boolean }).liveChanged) {
        return true;
      }
      return false;
    }
    const baseline = snapshotMissingOrEmpty ? sectionState.baseline : sectionState.snapshot;
    return !deepEqual(sectionState.draft, baseline ?? {});
  };

  const restoreSectionDraftToLastSaved = (path: string) => {
    const sectionState = getSectionState(path);
    sectionState?.restore();
    const dirtyKey = getDirtyKey(path);
    if (dirtyKey) {
      saveDraft(dirtyKey, false);
    }
  };

  useEffect(() => {
    const currentPath = pathname.replace(/\/$/, "");
    if (!currentPath.startsWith("/dashboard/")) return;

    const sectionState = getSectionState(currentPath);
    if (!sectionState) return;
    // For unsaved sections, always refresh baseline on section entry
    // so stale baseline values from earlier navigation don't suppress warnings.
    if (!sectionState.isSaved) {
      initializeSectionSnapshotBaseline(currentPath, sectionState.draft);
      return;
    }

    if (!hasMeaningfulValue(sectionState.baseline)) {
      initializeSectionSnapshotBaseline(currentPath, sectionState.draft);
    }
  }, [pathname]);

  useEffect(() => {
    const currentPath = pathname.replace(/\/$/, "");
    if (!currentPath.startsWith("/dashboard/")) return;
    const dirtyKey = getDirtyKey(currentPath);
    if (!dirtyKey) return;

    saveDraft(dirtyKey, false);

    const markDirty = () => {
      saveDraft(dirtyKey, true);
    };

    const container = document.querySelector("main");
    if (!container) return;

    container.addEventListener("input", markDirty, true);
    container.addEventListener("change", markDirty, true);
    return () => {
      container.removeEventListener("input", markDirty, true);
      container.removeEventListener("change", markDirty, true);
    };
  }, [pathname]);

  const navigateWithProjectId = (path: string) => {
    const params = new URLSearchParams();
    if (projectId) params.set("projectId", projectId);
    if (mode) params.set("mode", mode);
    if (applicationId) params.set("applicationId", applicationId);
    if (selectedApplication) params.set("selectedApplication", selectedApplication);
    if (selectedApplicationNo) params.set("applicationNo", selectedApplicationNo);
    const qs = params.toString();
    const url = qs ? `${path}?${qs}` : path;
    router.push(url);
  };

  const isLibraryNavigationBlocked = (path: string) => {
    if (!shouldGateCreateProjectSections({ isEditMode, isReadOnlyMode })) return false;
    return isGatedCreateProjectPath(path);
  };

  // Helper function to navigate while preserving projectId
  const handleNavigation = (path: string) => {
    if (isLibraryNavigationBlocked(path)) {
      showAlert(LIBRARY_GATE_ALERT);
      return;
    }

    const normalizedCurrentPath = pathname.replace(/\/$/, "");
    const normalizedTargetPath = path.replace(/\/$/, "");

    if (normalizedCurrentPath !== normalizedTargetPath && normalizedCurrentPath.startsWith("/dashboard/")) {
      if (hasUnsavedSectionChanges(normalizedCurrentPath)) {
        setPendingPath(path);
        setShowUnsavedWarning(true);
        return;
      }
    }

    navigateWithProjectId(path);
  };

  const sectionIcons: Record<string, ReactNode> = {
    "project-library": (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M7 3h10a2 2 0 012 2v14a2 2 0 01-2 2H7a2 2 0 01-2-2V5a2 2 0 012-2z"
        />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 8h6M9 12h6M9 16h4" />
      </svg>
    ),
    "project-details": (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M3 7a2 2 0 012-2h5.172a2 2 0 011.414.586L13.414 7H19a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z"
        />
      </svg>
    ),
    "applicant-details": (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
        />
      </svg>
    ),
    "area-details": (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M3 10h18M5 10v10a1 1 0 001 1h12a1 1 0 001-1V10"
        />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 14h2M11 14h2M15 14h2M7 17h2M11 17h2M15 17h2" />
      </svg>
    ),
    "building-details": (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M3 21h18M5 21V7a2 2 0 012-2h4v16M13 21V5h4a2 2 0 012 2v14"
        />
      </svg>
    ),
  };

  const menuItems = [
    ...(isReadOnlyMode
      ? [
          {
            id: "application-details",
            label: "Application Details",
            path: "/dashboard/application-details",
            icon: (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12h6m-6 4h6M7 4h10a2 2 0 012 2v12a2 2 0 01-2 2H7a2 2 0 01-2-2V6a2 2 0 012-2z"
                />
              </svg>
            ),
          },
        ]
      : []),
    ...CREATE_PROJECT_SECTIONS.map((section) => ({
      id: section.id,
      label: section.label,
      path: section.path,
      icon: sectionIcons[section.id],
    })),
  ];

  // Narrow sidebar on small screens; expand only on md+ for better mobile layout
  const sidebarWidthClass = collapsed ? "w-12 md:w-16" : "w-16 md:w-64";

  return (
    <aside
      className={`${sidebarWidthClass} bg-white transition-all duration-200 flex flex-col h-full`}
    >
      <div className="p-4 flex flex-col h-full">
        {/* Title + toggle */}
        <div className="flex items-center justify-between mb-4 shrink-0">
          {!collapsed && !isReadOnlyMode && (
            <h2 className={`hidden md:block ${TEXT_TITLE_MD}`}>
              {isEditMode ? "EDIT PROJECT" : "CREATE PROJECT"}
            </h2>
          )}
          {!collapsed && isReadOnlyMode && (
            <div className="hidden md:block min-w-0 pr-2">
              <p className={`font-semibold break-words leading-tight ${TEXT_CAPTION} text-gray-900`}>{selectedApplication || "-"}</p>
              <p className={`break-all leading-tight mt-0.5 ${TEXT_CAPTION}`}>{selectedApplicationNo || "-"}</p>
            </div>
          )}
          <button
            type="button"
            onClick={onToggleSidebar}
            className="flex items-center justify-center hover:opacity-80 transition-opacity"
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            <span
              className="w-8 h-8 flex items-center justify-center bg-emerald-100 rounded-lg text-emerald-700 shrink-0"
              aria-hidden="true"
            >
              <Image
                src="/show-sidebar-horiz.svg"
                alt=""
                width={20}
                height={20}
                className={`transition-transform ${collapsed ? "" : "rotate-180"}`}
              />
            </span>
          </button>
        </div>

        {applicationPdfSaveSlot && isReadOnlyMode && (
          <div className="mb-4 shrink-0 w-full min-w-0">
            {!collapsed && applicationPdfSaveSlot.subtitle && (
              <p className="hidden md:block text-[11px] text-gray-600 leading-snug mb-1">
                {applicationPdfSaveSlot.subtitle}
              </p>
            )}
            {!collapsed && applicationPdfSaveSlot.statusText && (
              <p className="hidden md:block text-[11px] text-amber-900 mb-1.5">
                {applicationPdfSaveSlot.statusText}
              </p>
            )}
            <button
              type="button"
              onClick={() => void applicationPdfSaveSlot.onSave()}
              disabled={
                applicationPdfSaveSlot.disabled ||
                applicationPdfSaveSlot.busy ||
                applicationPdfSaveSlot.done
              }
              className={
                applicationPdfSaveSlot.done && !applicationPdfSaveSlot.busy
                  ? "w-full border-2 border-emerald-500 bg-emerald-50 text-emerald-800 font-semibold py-2 px-4 rounded-xl mb-6 text-xs md:text-sm cursor-default shrink-0 transition-colors shadow-sm"
                  : "w-full border-2 border-emerald-600 text-emerald-700 hover:bg-emerald-50 font-semibold py-2 px-4 rounded-xl mb-6 transition-colors text-xs md:text-sm shadow-sm shrink-0 disabled:opacity-50 disabled:pointer-events-none disabled:hover:bg-transparent"
              }
              aria-label={
                applicationPdfSaveSlot.done && !applicationPdfSaveSlot.busy
                  ? "Application saved"
                  : "Save application"
              }
            >
              {applicationPdfSaveSlot.busy ? (
                <span className="inline-flex items-center justify-center gap-2">
                  <span
                    className="inline-block h-3.5 w-3.5 shrink-0 rounded-full border-2 border-emerald-600 border-t-transparent animate-spin"
                    aria-hidden
                  />
                  {!collapsed && <span>Saving…</span>}
                </span>
              ) : applicationPdfSaveSlot.done ? (
                collapsed ? "✓" : "Saved"
              ) : collapsed ? (
                "Save"
              ) : (
                "Save application"
              )}
            </button>
          </div>
        )}

        {applicationSignSlot && isReadOnlyMode && (() => {
          const signAllowed = applicationSignSlot.actionAvailable !== false;
          const signBusy = applicationSignSlot.disabled || applicationSignSlot.busy;
          const signDisabled = !signAllowed || signBusy;
          const actionLabel = applicationSignSlot.actionLabel || "Approved";
          const busyLabel = applicationSignSlot.busyLabel || "Approving…";
          const compactLabel = actionLabel === "Approved" ? "OK" : actionLabel.slice(0, 3);
          return (
          <div className="mb-4 shrink-0 w-full min-w-0">
            {!collapsed && applicationSignSlot.subtitle && (
              <p className="hidden md:block text-[11px] text-gray-600 leading-snug mb-1">
                {applicationSignSlot.subtitle}
              </p>
            )}
            {!collapsed && !signAllowed && applicationSignSlot.unavailableHint && (
              <p className="hidden md:block text-[11px] text-amber-800/90 leading-snug mb-1.5">
                {applicationSignSlot.unavailableHint}
              </p>
            )}
            {!collapsed && applicationSignSlot.statusText && (
              <p className="hidden md:block text-[11px] text-amber-900 mb-1.5">
                {applicationSignSlot.statusText}
              </p>
            )}
            <button
              type="button"
              onClick={() => {
                if (!signAllowed) return;
                void applicationSignSlot.onSign();
              }}
              disabled={signDisabled}
              className={
                signAllowed
                  ? "w-full border-2 border-emerald-600 text-emerald-700 hover:bg-emerald-50 font-semibold py-2 px-4 rounded-xl mb-6 transition-colors text-xs md:text-sm shadow-sm shrink-0 disabled:opacity-50 disabled:pointer-events-none disabled:hover:bg-transparent"
                  : "w-full border border-gray-200 bg-gray-50 text-gray-400 font-medium py-2 px-4 rounded-xl mb-6 transition-colors text-xs md:text-sm shrink-0 cursor-not-allowed shadow-none"
              }
              aria-label={
                signAllowed
                  ? actionLabel
                  : `${actionLabel} — waiting for signatures or not available`
              }
            >
              {applicationSignSlot.busy ? (
                <span className="inline-flex items-center justify-center gap-2">
                  <span
                    className="inline-block h-3.5 w-3.5 shrink-0 rounded-full border-2 border-emerald-600 border-t-transparent animate-spin"
                    aria-hidden
                  />
                  {!collapsed && <span>{busyLabel}</span>}
                </span>
              ) : collapsed ? (
                signAllowed ? compactLabel : "—"
              ) : (
                actionLabel
              )}
            </button>
          </div>
          );
        })()}

        {/* Action Button (hidden when sidebar is collapsed or on small screens) */}
        {!collapsed && !isReadOnlyMode && (() => {
          const isSubmittedProject = isEditMode && !isDraftProject;
          const updateDisabled = isProjectDataLoading || isSubmittingProject;
          if (isSubmittedProject) {
            return (
              <button
                type="button"
                onClick={onSubmitProjectClick}
                disabled={updateDisabled}
                className={`hidden md:block w-full font-semibold py-2 px-4 rounded-xl mb-6 transition-colors text-sm shadow-sm shrink-0 ${
                  updateDisabled
                    ? "bg-emerald-400 text-white cursor-not-allowed"
                    : BTN_PRIMARY
                }`}
              >
                {isProjectDataLoading
                  ? "Loading…"
                  : isSubmittingProject
                    ? "Updating…"
                    : "Update Project"}
              </button>
            );
          }
          if (allPagesSaved) {
            return (
              <button
                type="button"
                onClick={onSubmitProjectClick}
                className={`hidden md:block w-full ${BTN_PRIMARY} font-semibold py-2 px-4 rounded-xl mb-6 text-sm shrink-0`}
              >
                Submit Project
              </button>
            );
          }
          return (
            <button
              type="button"
              onClick={onSaveDraftClick}
              className="hidden md:block w-full border-2 border-emerald-600 text-emerald-700 hover:bg-emerald-50 font-semibold py-2 px-4 rounded-xl mb-6 transition-colors text-sm shadow-sm shrink-0"
            >
              Save as Draft
            </button>
          );
        })()}

        {/* Navigation Items - Scrollable */}
        <nav className="space-y-1 flex-1 overflow-y-auto min-h-0">
          {menuItems.map((item) => {
            // Normalize paths by removing trailing slashes for comparison
            const normalizedPathname = pathname.replace(/\/$/, "");
            const normalizedItemPath = item.path.replace(/\/$/, "");
            
            const isActive = normalizedPathname === normalizedItemPath;
            const isGated = isLibraryGated && isGatedCreateProjectPath(item.path);

            const justifyClass = collapsed ? "justify-center" : "justify-between";

            return (
              <button
                key={item.id}
                onClick={() => handleNavigation(item.path)}
                aria-disabled={isGated ? true : undefined}
                className={`relative w-full flex items-center ${justifyClass} px-4 py-3 rounded-xl transition-colors ${
                  isActive
                    ? NAV_ITEM_ACTIVE
                    : isGated
                      ? "text-gray-400 cursor-not-allowed"
                      : "text-gray-700 hover:bg-gray-100"
                }`}
              >
                {/* Active indicator bar */}
                {isActive && (
                  <span className={`absolute left-0 top-2 bottom-2 w-1 rounded-r-full ${NAV_ITEM_ACTIVE_BAR}`} />
                )}
                <span className={`${TEXT_NAV} flex items-center gap-2`}>
                  <span
                    className="w-8 h-8 flex items-center justify-center bg-emerald-100 rounded-lg text-emerald-700 shrink-0"
                    aria-hidden="true"
                  >
                    {item.icon}
                  </span>
                  {!collapsed && <span>{item.label}</span>}
                </span>
                {!collapsed && (
                  <svg
                    className="w-4 h-4 text-gray-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 5l7 7-7 7"
                    />
                  </svg>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {showUnsavedWarning && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white w-[90%] max-w-md rounded-xl shadow-2xl p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-2">
              Unsaved Changes
            </h2>
            <p className="text-sm text-gray-600 mb-4">
              You have unsaved changes in this section. Are you sure you want to leave this page without saving?
            </p>
            <div className="flex justify-end gap-3 mt-4">
              <button
                type="button"
                className="px-4 py-2 rounded-lg text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 transition-colors"
                onClick={() => {
                  setShowUnsavedWarning(false);
                  setPendingPath(null);
                }}
              >
                Stay on this page
              </button>
              <button
                type="button"
                className={`px-4 py-2 rounded-lg text-sm font-semibold ${BTN_PRIMARY}`}
                onClick={() => {
                  const target = pendingPath;
                  restoreSectionDraftToLastSaved(pathname.replace(/\/$/, ""));
                  setShowUnsavedWarning(false);
                  setPendingPath(null);
                  if (target && isLibraryNavigationBlocked(target)) {
                    showAlert(LIBRARY_GATE_ALERT);
                    return;
                  }
                  if (target) navigateWithProjectId(target);
                }}
              >
                Leave without saving
              </button>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
};

export default DashboardSidebar;

