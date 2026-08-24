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

/** Cap total PR/PRC card uploads (primary + extras). */
export const PROJECT_LIBRARY_MAX_PR_CARDS = 100;

/** @deprecated Use PROJECT_LIBRARY_MAX_PR_CARDS (total cap). Kept as max extras = total − 1. */
export const PROJECT_LIBRARY_MAX_EXTRA_PR_CARDS = PROJECT_LIBRARY_MAX_PR_CARDS - 1;

export const PROJECT_LIBRARY_MAX_FILES = PROJECT_LIBRARY_DOCUMENT_NAMES.length;

/** Overall cap on Project Library PDFs of every type. */
export const PROJECT_LIBRARY_MAX_TOTAL_FILES = 100;

/** @deprecated Use PROJECT_LIBRARY_MAX_TOTAL_FILES. */
export const PROJECT_LIBRARY_MAX_OTHER_DOCS = PROJECT_LIBRARY_MAX_TOTAL_FILES;

export const DRAFT_PROJECT_LIBRARY_EXTRA_PR_KEY = "draft-project-library-extra-pr-uploads";

export const DRAFT_PROJECT_LIBRARY_DP_ATTACHMENTS_KEY =
  "draft-project-library-dp-attachments";

export const DRAFT_PROJECT_LIBRARY_EXTRA_DOCS_KEY =
  "draft-project-library-extra-docs";

export const PROJECT_LIBRARY_DP_MAP_LABEL = "D.P. Remarks — Map Plan";
export const PROJECT_LIBRARY_DP_RL_LABEL = "D.P. Remarks — Road Line Plan";

export type ProjectLibraryExtraDocType =
  | "pr-card"
  | "dp-remarks"
  | "dp-remarks-map"
  | "dp-remarks-rl"
  | "crz-remarks"
  | "power-of-attorney";

export const EXTRA_DOC_STORAGE_PREFIX: Record<ProjectLibraryExtraDocType, string> = {
  "pr-card": "extra-pr",
  "dp-remarks": "extra-dp-remarks",
  "dp-remarks-map": "extra-dp-map",
  "dp-remarks-rl": "extra-dp-rl",
  "crz-remarks": "extra-crz-remarks",
  "power-of-attorney": "extra-power-of-attorney",
};

export const PROJECT_LIBRARY_STORAGE_FOLDERS = {
  "pr-card": "pr-card",
  "dp-remarks": "dp-remarks",
  "crz-remarks": "crz-remarks",
  "power-of-attorney": "power-of-attorney",
} as const;

const FIXED_SLOT_RELATIVE_STEM: Record<number, string> = {
  0: "pr-card/primary",
  1: "dp-remarks/letter",
  2: "crz-remarks/primary",
  3: "power-of-attorney/primary",
};

const EXTRA_RELATIVE_STEM: Record<ProjectLibraryExtraDocType, string> = {
  "pr-card": "pr-card/extra",
  "dp-remarks": "dp-remarks/extra-letter",
  "dp-remarks-map": "dp-remarks/map",
  "dp-remarks-rl": "dp-remarks/road-line",
  "crz-remarks": "crz-remarks/extra",
  "power-of-attorney": "power-of-attorney/extra",
};

export type ProjectLibraryStorageKind =
  | { role: "fixed"; slot: number }
  | { role: "extra"; type: ProjectLibraryExtraDocType };

function stripFileExtension(fileName: string): string {
  return fileName.replace(/\.[^.]+$/, "");
}

function libraryPathAfterBucketPrefix(path: string): string {
  const normalized = path.replace(/\\/g, "/");
  const marker = "project-library/";
  const index = normalized.indexOf(marker);
  if (index >= 0) {
    return normalized.slice(index + marker.length);
  }
  return normalized.replace(/^\/+/, "");
}

export function projectLibraryFixedRelativeStem(slotIndex: number): string {
  return FIXED_SLOT_RELATIVE_STEM[slotIndex] ?? `document-${slotIndex + 1}`;
}

export function projectLibraryExtraRelativeStem(
  type: ProjectLibraryExtraDocType,
  indexOrId: number | string
): string {
  return `${EXTRA_RELATIVE_STEM[type]}-${indexOrId}`;
}

export function projectLibraryFixedStoragePath(
  projectId: string,
  slotIndex: number,
  extension: string
): string {
  const ext = extension.replace(/^\./, "").toLowerCase() || "pdf";
  return `${projectId}/project-library/${projectLibraryFixedRelativeStem(slotIndex)}.${ext}`;
}

export function projectLibraryExtraStoragePath(
  projectId: string,
  type: ProjectLibraryExtraDocType,
  index: number,
  extension: string
): string {
  const ext = extension.replace(/^\./, "").toLowerCase() || "pdf";
  return `${projectId}/project-library/${projectLibraryExtraRelativeStem(type, index)}.${ext}`;
}

export function classifyProjectLibraryStoragePath(
  path: string
): ProjectLibraryStorageKind | null {
  const relative = libraryPathAfterBucketPrefix(path);
  const parts = relative.split("/").filter(Boolean);
  const fileName = parts[parts.length - 1] ?? relative;
  const folder = parts.length >= 2 ? parts[parts.length - 2] : null;
  const stem = stripFileExtension(fileName).toLowerCase();

  if (folder === PROJECT_LIBRARY_STORAGE_FOLDERS["pr-card"]) {
    if (stem === "primary") return { role: "fixed", slot: 0 };
    return { role: "extra", type: "pr-card" };
  }
  if (folder === PROJECT_LIBRARY_STORAGE_FOLDERS["dp-remarks"]) {
    if (stem === "letter") return { role: "fixed", slot: 1 };
    if (stem.startsWith("extra-letter")) return { role: "extra", type: "dp-remarks" };
    if (stem.startsWith("road-line")) return { role: "extra", type: "dp-remarks-rl" };
    if (stem.startsWith("map")) return { role: "extra", type: "dp-remarks-map" };
    return { role: "extra", type: "dp-remarks" };
  }
  if (folder === PROJECT_LIBRARY_STORAGE_FOLDERS["crz-remarks"]) {
    if (stem === "primary") return { role: "fixed", slot: 2 };
    return { role: "extra", type: "crz-remarks" };
  }
  if (folder === PROJECT_LIBRARY_STORAGE_FOLDERS["power-of-attorney"]) {
    if (stem === "primary") return { role: "fixed", slot: 3 };
    return { role: "extra", type: "power-of-attorney" };
  }

  if (stem.startsWith("extra-pr")) return { role: "extra", type: "pr-card" };
  if (stem.startsWith("extra-dp-remarks")) return { role: "extra", type: "dp-remarks" };
  if (stem.startsWith("extra-dp-map") || stem.startsWith("dp-map")) {
    return { role: "extra", type: "dp-remarks-map" };
  }
  if (stem.startsWith("extra-dp-rl") || stem.startsWith("dp-rl")) {
    return { role: "extra", type: "dp-remarks-rl" };
  }
  if (stem.startsWith("extra-crz-remarks")) return { role: "extra", type: "crz-remarks" };
  if (stem.startsWith("extra-power-of-attorney")) {
    return { role: "extra", type: "power-of-attorney" };
  }

  const documentMatch = stem.match(/^document-([1-4])(?:-\1)?$/);
  if (documentMatch) {
    return { role: "fixed", slot: Number(documentMatch[1]) - 1 };
  }
  const documentPrefix = stem.match(/^document-([1-4])\b/);
  if (documentPrefix) {
    return { role: "fixed", slot: Number(documentPrefix[1]) - 1 };
  }

  return null;
}

export const LIBRARY_GATE_ALERT = {
  title: "Project Library required",
  message: "Upload and save at least one Project Library document first",
};

export function isProjectLibraryComplete(): boolean {
  if (!isPageSaved("saved-project-library")) return false;
  const fixed = loadDraft<unknown[]>("draft-project-library-uploads", []);
  const extraPr = loadDraft<unknown[]>(DRAFT_PROJECT_LIBRARY_EXTRA_PR_KEY, []);
  const extraDocs = loadDraft<unknown[]>(DRAFT_PROJECT_LIBRARY_EXTRA_DOCS_KEY, []);
  const dpAttachments = loadDraft<{ map?: unknown; rl?: unknown }>(
    DRAFT_PROJECT_LIBRARY_DP_ATTACHMENTS_KEY,
    {}
  );
  const extraAttached = Array.isArray(extraDocs) && extraDocs.length > 0
    ? extraDocs.filter((s) => s && typeof s === "object" && "upload" in s && (s as { upload?: unknown }).upload).length
    : Array.isArray(extraPr)
      ? extraPr.filter((s) => s && typeof s === "object" && "upload" in s && (s as { upload?: unknown }).upload).length
      : 0;
  const fixedAttached = Array.isArray(fixed) ? fixed.filter(Boolean).length : 0;
  const dpAttached =
    extraDocs && Array.isArray(extraDocs) && extraDocs.length > 0
      ? 0
      : (dpAttachments?.map ? 1 : 0) + (dpAttachments?.rl ? 1 : 0);
  if (fixedAttached + extraAttached + dpAttached < 1) return false;
  // Ignore stale saved flags when no backing files were verified.
  const verified = loadDraft<{ count?: number } | null>("saved-project-library-files", null);
  return typeof verified?.count === "number" && verified.count >= 1;
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

export type ProjectLibraryDpAttachmentsDraft = {
  map?: unknown;
  rl?: unknown;
};

export type ProjectLibraryExtraDocDraft = {
  id?: string;
  type?: string;
  upload?: unknown;
};

export type ProjectLibraryDraftBundle = {
  fixed: unknown[];
  extraPr: unknown[];
  extraDocs: unknown[];
  dpAttachments: ProjectLibraryDpAttachmentsDraft;
};

function emptyDpAttachments(): ProjectLibraryDpAttachmentsDraft {
  return {};
}

export function loadProjectLibraryDraftBundle(): ProjectLibraryDraftBundle {
  return {
    fixed: loadDraft("draft-project-library-uploads", []),
    extraPr: loadDraft(DRAFT_PROJECT_LIBRARY_EXTRA_PR_KEY, []),
    extraDocs: loadDraft(DRAFT_PROJECT_LIBRARY_EXTRA_DOCS_KEY, []),
    dpAttachments: loadDraft(
      DRAFT_PROJECT_LIBRARY_DP_ATTACHMENTS_KEY,
      emptyDpAttachments()
    ),
  };
}

export function normalizeProjectLibrarySnapshot(snapshot: unknown): ProjectLibraryDraftBundle {
  if (snapshot && typeof snapshot === "object" && !Array.isArray(snapshot) && "fixed" in snapshot) {
    const s = snapshot as {
      fixed?: unknown[];
      extraPr?: unknown[];
      extraDocs?: unknown[];
      dpAttachments?: ProjectLibraryDpAttachmentsDraft;
    };
    return {
      fixed: Array.isArray(s.fixed) ? s.fixed : [],
      extraPr: Array.isArray(s.extraPr) ? s.extraPr : [],
      extraDocs: Array.isArray(s.extraDocs) ? s.extraDocs : [],
      dpAttachments:
        s.dpAttachments && typeof s.dpAttachments === "object"
          ? s.dpAttachments
          : emptyDpAttachments(),
    };
  }
  if (Array.isArray(snapshot)) {
    return { fixed: snapshot, extraPr: [], extraDocs: [], dpAttachments: emptyDpAttachments() };
  }
  return { fixed: [], extraPr: [], extraDocs: [], dpAttachments: emptyDpAttachments() };
}

function extraDocsFromLegacy(
  extraPr: unknown[],
  dpAttachments: ProjectLibraryDpAttachmentsDraft
): ProjectLibraryExtraDocDraft[] {
  const migrated: ProjectLibraryExtraDocDraft[] = [];
  if (Array.isArray(extraPr)) {
    for (const slot of extraPr) {
      if (!slot || typeof slot !== "object") continue;
      const s = slot as { id?: string; upload?: unknown };
      if (!s.upload) continue;
      migrated.push({ id: s.id, type: "pr-card", upload: s.upload });
    }
  }
  if (dpAttachments?.map) {
    migrated.push({ id: "legacy-dp-map", type: "dp-remarks-map", upload: dpAttachments.map });
  }
  if (dpAttachments?.rl) {
    migrated.push({ id: "legacy-dp-rl", type: "dp-remarks-rl", upload: dpAttachments.rl });
  }
  return migrated;
}

export function restoreProjectLibraryDraft(snapshot: unknown): void {
  const normalized = normalizeProjectLibrarySnapshot(snapshot);
  const extraDocs =
    Array.isArray(normalized.extraDocs) && normalized.extraDocs.length > 0
      ? normalized.extraDocs
      : extraDocsFromLegacy(normalized.extraPr, normalized.dpAttachments);
  const extraPr = extraDocs.filter(
    (slot) =>
      slot &&
      typeof slot === "object" &&
      (slot as ProjectLibraryExtraDocDraft).type === "pr-card"
  );
  const maps = extraDocs.filter(
    (slot) =>
      slot &&
      typeof slot === "object" &&
      (slot as ProjectLibraryExtraDocDraft).type === "dp-remarks-map"
  ) as ProjectLibraryExtraDocDraft[];
  const rls = extraDocs.filter(
    (slot) =>
      slot &&
      typeof slot === "object" &&
      (slot as ProjectLibraryExtraDocDraft).type === "dp-remarks-rl"
  ) as ProjectLibraryExtraDocDraft[];
  saveDraft("draft-project-library-uploads", normalized.fixed);
  saveDraft(DRAFT_PROJECT_LIBRARY_EXTRA_PR_KEY, extraPr);
  saveDraft(DRAFT_PROJECT_LIBRARY_EXTRA_DOCS_KEY, extraDocs);
  saveDraft(DRAFT_PROJECT_LIBRARY_DP_ATTACHMENTS_KEY, {
    ...(maps[0]?.upload ? { map: maps[0].upload } : {}),
    ...(rls[0]?.upload ? { rl: rls[0].upload } : {}),
  });
}
