"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { isPageSaved, loadDraft, saveDraft } from "@/app/utils/draftStorage";

export function useProjectSectionNavigation() {
  const pathname = usePathname() || "";
  const router = useRouter();
  const searchParams = useSearchParams();

  const projectId = searchParams.get("projectId");
  const isReadOnlyMode = searchParams.get("mode") === "readonly";
  const mode = searchParams.get("mode");
  const applicationId = searchParams.get("applicationId");
  const selectedApplication = searchParams.get("selectedApplication");
  const selectedApplicationNo = searchParams.get("applicationNo");
  const isEditMode = !!projectId;

  const [showUnsavedWarning, setShowUnsavedWarning] = useState(false);
  const [pendingPath, setPendingPath] = useState<string | null>(null);

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
        draft: loadDraft<Record<string, unknown>[]>("draft-project-library-uploads", []),
        snapshot: loadDraft<Record<string, unknown>[] | null>("saved-project-library-snapshot", null),
        baseline: loadDraft<Record<string, unknown>[] | null>(getBaselineKey(path), null),
        isSaved: isPageSaved("saved-project-library"),
        restore: () => {
          const snapshot = loadDraft<Record<string, unknown>[] | null>("saved-project-library-snapshot", null);
          const baseline = loadDraft<Record<string, unknown>[] | null>(getBaselineKey(path), null);
          saveDraft("draft-project-library-uploads", snapshot ?? baseline ?? []);
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

  // Helper function to navigate while preserving projectId
  const handleNavigation = (path: string) => {
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


  const confirmLeaveWithoutSaving = () => {
    const target = pendingPath;
    restoreSectionDraftToLastSaved(pathname.replace(/\/$/, ""));
    setShowUnsavedWarning(false);
    setPendingPath(null);
    if (target) navigateWithProjectId(target);
  };

  const cancelLeave = () => {
    setShowUnsavedWarning(false);
    setPendingPath(null);
  };

  return {
    pathname,
    isReadOnlyMode,
    isEditMode,
    selectedApplication,
    selectedApplicationNo,
    showUnsavedWarning,
    handleNavigation,
    confirmLeaveWithoutSaving,
    cancelLeave,
    navigateWithProjectId,
  };
}
