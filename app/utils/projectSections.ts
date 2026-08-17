import { isPageSaved, loadDraft, saveDraft } from "@/app/utils/draftStorage";

export type CreateProjectSection = {
  id: string;
  label: string;
  path: string;
  savedKey: string;
};

export const PROJECT_LIBRARY_PATH = "/dashboard/project-library";

export const CREATE_PROJECT_SECTIONS: CreateProjectSection[] = [
  {
    id: "project-library",
    label: "Project Library",
    path: PROJECT_LIBRARY_PATH,
    savedKey: "saved-project-library",
  },
  {
    id: "project-details",
    label: "Project Details",
    path: "/dashboard/project-details",
    savedKey: "saved-project-details",
  },
  {
    id: "applicant-details",
    label: "Applicant Details",
    path: "/dashboard/applicant",
    savedKey: "saved-applicant-details",
  },
  {
    id: "area-details",
    label: "Area Details",
    path: "/dashboard/area",
    savedKey: "saved-area-details",
  },
  {
    id: "building-details",
    label: "Building Details",
    path: "/dashboard/building",
    savedKey: "saved-building-details",
  },
];

export const PROJECT_LIBRARY_DOCUMENT_NAMES = [
  "Property Register Card (PR / PRC)",
  "D.P. Remarks",
  "C.R.Z. Remarks",
  "Power of Attorney",
] as const;

export const PROJECT_LIBRARY_PR_CARD_LABEL = PROJECT_LIBRARY_DOCUMENT_NAMES[0];

export const PROJECT_LIBRARY_EXTRA_PR_LABEL =
  "Additional Property Register Card (PR / PRC)";

/** Cap optional extra PR/PRC uploads (beyond the required first card). */
export const PROJECT_LIBRARY_MAX_EXTRA_PR_CARDS = 9;

export const PROJECT_LIBRARY_MAX_FILES = PROJECT_LIBRARY_DOCUMENT_NAMES.length;

export const DRAFT_PROJECT_LIBRARY_EXTRA_PR_KEY = "draft-project-library-extra-pr-uploads";

export const LIBRARY_GATE_ALERT = {
  title: "Project Library required",
  message: "Upload and save Project Library first",
};

export function isProjectLibraryComplete(): boolean {
  if (!isPageSaved("saved-project-library")) return false;
  const fixed = loadDraft<unknown[]>("draft-project-library-uploads", []);
  if (!Array.isArray(fixed)) return false;
  const attached = fixed.filter(Boolean).length;
  if (attached < PROJECT_LIBRARY_MAX_FILES) return false;
  // Ignore stale saved flags when draft slots exist without backing files.
  const verified = loadDraft<{ count?: number } | null>("saved-project-library-files", null);
  return verified?.count === PROJECT_LIBRARY_MAX_FILES;
}

export function shouldGateCreateProjectSections(options: {
  isEditMode: boolean;
  isReadOnlyMode: boolean;
}): boolean {
  if (options.isReadOnlyMode || options.isEditMode) return false;
  return !isProjectLibraryComplete();
}

export function normalizeDashboardPath(path: string): string {
  return path.replace(/\/$/, "").split("?")[0] ?? path;
}

export function isGatedCreateProjectPath(path: string): boolean {
  const normalized = normalizeDashboardPath(path);
  if (normalized === PROJECT_LIBRARY_PATH) return false;
  return CREATE_PROJECT_SECTIONS.some((section) => section.path === normalized);
}

export type ProjectLibraryDraftBundle = {
  fixed: unknown[];
  extraPr: unknown[];
};

export function loadProjectLibraryDraftBundle(): ProjectLibraryDraftBundle {
  return {
    fixed: loadDraft("draft-project-library-uploads", []),
    extraPr: loadDraft(DRAFT_PROJECT_LIBRARY_EXTRA_PR_KEY, []),
  };
}

export function normalizeProjectLibrarySnapshot(snapshot: unknown): ProjectLibraryDraftBundle {
  if (snapshot && typeof snapshot === "object" && !Array.isArray(snapshot) && "fixed" in snapshot) {
    const s = snapshot as { fixed?: unknown[]; extraPr?: unknown[] };
    return {
      fixed: Array.isArray(s.fixed) ? s.fixed : [],
      extraPr: Array.isArray(s.extraPr) ? s.extraPr : [],
    };
  }
  if (Array.isArray(snapshot)) {
    return { fixed: snapshot, extraPr: [] };
  }
  return { fixed: [], extraPr: [] };
}

export function restoreProjectLibraryDraft(snapshot: unknown): void {
  const normalized = normalizeProjectLibrarySnapshot(snapshot);
  saveDraft("draft-project-library-uploads", normalized.fixed);
  saveDraft(DRAFT_PROJECT_LIBRARY_EXTRA_PR_KEY, normalized.extraPr);
}
