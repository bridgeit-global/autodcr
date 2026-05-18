import { isPageSaved, loadDraft } from "@/app/utils/draftStorage";
import type { ProjectRecord } from "@/app/utils/fetchProjectForEdit";

function hasMeaningfulValue(val: unknown): boolean {
  if (val === null || val === undefined) return false;
  if (typeof val === "string") return val.trim().length > 0;
  if (typeof val === "number") return !Number.isNaN(val);
  if (typeof val === "boolean") return val;
  if (Array.isArray(val)) return val.length > 0 && val.some(hasMeaningfulValue);
  if (typeof val === "object") return Object.values(val as Record<string, unknown>).some(hasMeaningfulValue);
  return false;
}

export const deepEqual = (a: unknown, b: unknown): boolean => {
  if (a === b) return true;
  if (a == null || b == null) return a === b;
  if (typeof a !== typeof b) return false;
  if (typeof a !== "object") return a === b;
  if (Array.isArray(a) !== Array.isArray(b)) return false;

  if (Array.isArray(a)) {
    if (a.length !== (b as unknown[]).length) return false;
    return a.every((val, idx) => deepEqual(val, (b as unknown[])[idx]));
  }

  const keysA = Object.keys(a as object);
  const keysB = Object.keys(b as object);
  if (keysA.length !== keysB.length) return false;
  return keysA.every((key) => deepEqual((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key]));
};

type SectionGate = {
  savedKey: string;
  dirtyKey: string;
};

function sectionWasTouched({ savedKey, dirtyKey }: SectionGate): boolean {
  return isPageSaved(savedKey) || loadDraft<boolean>(dirtyKey, false) === true;
}

function includeIfChanged(
  draft: unknown,
  existing: unknown,
  gate: SectionGate,
  partialUpdate: boolean
): boolean {
  if (partialUpdate && !sectionWasTouched(gate)) {
    return false;
  }
  if (!hasMeaningfulValue(draft) && !hasMeaningfulValue(existing)) {
    return false;
  }
  return !deepEqual(draft, existing);
}

export type ProjectUpdatePayload = {
  user_id: string;
  title: string;
  status: string;
  project_info?: Record<string, unknown>;
  save_plot_details?: Record<string, unknown>;
  applicant_details?: { applicants: unknown[] };
  building_details?: Record<string, unknown>;
  area_details?: { plots: unknown[]; totals: unknown | null };
  project_library?: { uploads: unknown[] };
  bg_details?: { entries: unknown[] };
};

type BuildPayloadInput = {
  userId: string;
  finalProjectTitle: string;
  existingData: ProjectRecord | null;
  partialUpdate: boolean;
  projectInfo: Record<string, unknown>;
  savePlotDetails: Record<string, unknown>;
  applicantsList: unknown[];
  buildingDetails: Record<string, unknown>;
  areaPlots: unknown[];
  areaTotals: unknown | null;
  projectLibraryUploads: unknown[];
  bgEntries: unknown[];
};

export function buildProjectUpdatePayload(input: BuildPayloadInput): ProjectUpdatePayload {
  const {
    userId,
    finalProjectTitle,
    existingData,
    partialUpdate,
    projectInfo,
    savePlotDetails,
    applicantsList,
    buildingDetails,
    areaPlots,
    areaTotals,
    projectLibraryUploads,
    bgEntries,
  } = input;

  const payload: ProjectUpdatePayload = {
    user_id: userId,
    title: finalProjectTitle,
    status: partialUpdate ? (existingData?.status as string) || "submitted" : "submitted",
  };

  const existing = existingData ?? null;

  if (
    includeIfChanged(projectInfo, existing?.project_info ?? {}, {
      savedKey: "saved-project-info",
      dirtyKey: "dirty-project-details",
    }, partialUpdate)
  ) {
    payload.project_info = projectInfo;
  }

  if (
    includeIfChanged(savePlotDetails, existing?.save_plot_details ?? {}, {
      savedKey: "saved-save-plot-details",
      dirtyKey: "dirty-project-details",
    }, partialUpdate)
  ) {
    payload.save_plot_details = savePlotDetails;
  }

  if (
    includeIfChanged(
      applicantsList,
      existing?.applicant_details?.applicants ?? [],
      { savedKey: "saved-applicant-details", dirtyKey: "dirty-applicant-details" },
      partialUpdate
    )
  ) {
    payload.applicant_details = { applicants: applicantsList };
  }

  if (
    includeIfChanged(buildingDetails, existing?.building_details ?? {}, {
      savedKey: "saved-building-details",
      dirtyKey: "dirty-building-details",
    }, partialUpdate)
  ) {
    payload.building_details = buildingDetails;
  }

  const existingArea = (existing?.area_details as { plots?: unknown[] }) ?? {};
  if (
    includeIfChanged(
      areaPlots,
      existingArea.plots ?? [],
      { savedKey: "saved-area-details", dirtyKey: "dirty-area-details" },
      partialUpdate
    )
  ) {
    payload.area_details = { plots: areaPlots, totals: areaTotals };
  }

  const filteredUploads = (projectLibraryUploads as unknown[]).filter(
    (u) => u !== null && u !== undefined && u !== ""
  );
  const existingLibrary = (existing?.project_library as { uploads?: unknown[] }) ?? {};
  const normalizedNew = filteredUploads.map((u: unknown) => {
    const row = u as Record<string, unknown>;
    return { name: row?.name, path: row?.path, url: row?.url };
  });
  const normalizedExisting = (existingLibrary.uploads ?? []).map((u: unknown) => {
    const row = u as Record<string, unknown>;
    return { name: row?.name, path: row?.path, url: row?.url };
  });
  if (
    includeIfChanged(
      normalizedNew,
      normalizedExisting,
      { savedKey: "saved-project-library", dirtyKey: "dirty-project-library" },
      partialUpdate
    ) &&
    filteredUploads.length > 0
  ) {
    payload.project_library = { uploads: filteredUploads };
  }

  const existingBg = (existing?.bg_details as { entries?: unknown[] }) ?? {};
  if (
    includeIfChanged(bgEntries, existingBg.entries ?? [], {
      savedKey: "saved-bg-details",
      dirtyKey: "dirty-bg-details",
    }, partialUpdate)
  ) {
    payload.bg_details = { entries: bgEntries };
  }

  return payload;
}

export function countPayloadSections(payload: ProjectUpdatePayload): number {
  const keys = [
    "project_info",
    "save_plot_details",
    "applicant_details",
    "building_details",
    "area_details",
    "project_library",
    "bg_details",
  ] as const;
  return keys.filter((k) => payload[k] !== undefined).length;
}
