"use client";

import { useRef, useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import {
  loadDraft,
  saveDraft,
  markPageSaved,
  isPageSaved,
  clearPageSaved,
} from "@/app/utils/draftStorage";
import { useProjectData } from "@/app/hooks/useProjectData";
import {
  deleteProjectLibraryFile,
  deleteExtraPrCard,
  getProjectLibraryFile,
  getExtraPrCard,
  hasAllProjectLibraryFiles,
  reconcileFixedLibraryUploads,
  saveProjectLibraryFile,
  saveExtraPrCard,
} from "@/app/utils/projectLibraryFiles";
import { useDashboardAlertModal } from "@/app/dashboard/context/DashboardAlertModalContext";
import DocumentPreviewModal from "@/app/components/DocumentPreviewModal";
import { BTN_PRIMARY, BTN_SAVE_UNSAVED } from "@/app/utils/buttonClasses";
import {
  DRAFT_PROJECT_LIBRARY_EXTRA_PR_KEY,
  PROJECT_LIBRARY_DOCUMENT_NAMES,
  PROJECT_LIBRARY_EXTRA_PR_LABEL,
  PROJECT_LIBRARY_MAX_EXTRA_PR_CARDS,
  PROJECT_LIBRARY_MAX_FILES,
} from "@/app/utils/projectSections";
import { applyProjectAutofillDrafts } from "@/app/lib/projectDocumentAutofill";
import { getFieldLabel } from "@/app/lib/documentValidation/fieldLabels";
import { useProjectLibraryExtraction } from "@/app/hooks/useProjectLibraryExtraction";
import { classifyDocumentFile } from "@/app/utils/validateDocumentApi";
import type { DocumentType } from "@/app/lib/documentValidation/registry";

type UploadRecord = {
  id: string;
  name: string;
  url: string;
  uploadedAt: string;
  path: string;
};

type ExtraPrSlot = {
  id: string;
  upload?: UploadRecord;
};

type LibrarySnapshot = {
  fixed: (UploadRecord | undefined)[];
  extraPr: ExtraPrSlot[];
};

type StagingItem = {
  id: string;
  file: File;
  detectedType: LibraryDocType | null;
  overrideType: LibraryDocType | null;
  loading: boolean;
  error: string | null;
};

type LibraryDocType =
  | "pr-card"
  | "dp-remarks"
  | "crz-remarks"
  | "power-of-attorney";

const DOCUMENT_NAMES = PROJECT_LIBRARY_DOCUMENT_NAMES;
const MAX_FILES = PROJECT_LIBRARY_MAX_FILES;
const ACCEPTED_TYPES = [".pdf"];
const MAX_TOTAL_FILES = MAX_FILES + PROJECT_LIBRARY_MAX_EXTRA_PR_CARDS;

const LIBRARY_ALLOWED_TYPES: LibraryDocType[] = [
  "pr-card",
  "dp-remarks",
  "crz-remarks",
  "power-of-attorney",
];

const LABEL_BY_TYPE: Record<LibraryDocType, string> = {
  "pr-card": DOCUMENT_NAMES[0],
  "dp-remarks": DOCUMENT_NAMES[1],
  "crz-remarks": DOCUMENT_NAMES[2],
  "power-of-attorney": DOCUMENT_NAMES[3],
};

const createId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);

const createExtraSlot = (upload?: UploadRecord): ExtraPrSlot => ({
  id: createId(),
  upload,
});

function normalizeFixedUploads(saved: (UploadRecord | undefined)[]) {
  if (saved.length < MAX_FILES) {
    return [...saved, ...Array(MAX_FILES - saved.length).fill(undefined)];
  }
  if (saved.length > MAX_FILES) {
    return saved.slice(0, MAX_FILES);
  }
  return saved;
}

function loadExtraPrSlots(): ExtraPrSlot[] {
  const saved = loadDraft<ExtraPrSlot[]>(DRAFT_PROJECT_LIBRARY_EXTRA_PR_KEY, []);
  if (!Array.isArray(saved)) return [];
  return saved.map((slot) =>
    slot?.upload
      ? { id: slot.id || createId(), upload: slot.upload }
      : createExtraSlot()
  );
}

function splitServerUploads(uploadsData: UploadRecord[]) {
  const fixed = normalizeFixedUploads(uploadsData.slice(0, MAX_FILES));
  const extraRecords = uploadsData.slice(MAX_FILES).filter(Boolean) as UploadRecord[];
  const extraPr = extraRecords.map((upload) => createExtraSlot(upload));
  return { fixed, extraPr };
}

function isLibraryDocType(value: string): value is LibraryDocType {
  return (LIBRARY_ALLOWED_TYPES as string[]).includes(value);
}

function effectiveType(item: StagingItem): LibraryDocType | null {
  return item.overrideType ?? item.detectedType;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function makeUploadRecord(file: File, pathStem: string): UploadRecord {
  const extension = file.name.split(".").pop() || "pdf";
  return {
    id: createId(),
    name: file.name,
    url: URL.createObjectURL(file),
    uploadedAt: new Date().toISOString(),
    path: `${pathStem}.${extension}`,
  };
}

type DocumentRowProps = {
  serial: string;
  label: string;
  upload?: UploadRecord;
  isReadOnlyMode: boolean;
  onPreview: () => void;
};

function AttachedSummaryRow({
  serial,
  label,
  upload,
  onPreview,
}: DocumentRowProps) {
  if (!upload) return null;
  return (
    <li className="rounded-xl border border-gray-200 bg-white px-4 py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-gray-900">
            {upload.name}
          </p>
          <p className="mt-1 text-xs text-gray-500">
            Detected as {label}
            {serial ? ` · ${serial}` : ""}
          </p>
        </div>
        <button
          type="button"
          onClick={onPreview}
          className="inline-flex shrink-0 items-center justify-center w-9 h-9 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-brand-blue shadow-sm"
          aria-label="Preview document"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M5 4h9l5 5v11H5z" />
            <path d="M9 12h6" />
            <path d="M9 16h3" />
          </svg>
        </button>
      </div>
    </li>
  );
}

export default function ProjectLibraryPage() {
  const searchParams = useSearchParams();
  const isReadOnlyMode = searchParams.get("mode") === "readonly";
  const { isEditMode, isLoading, projectData } = useProjectData();
  const { showAlert } = useDashboardAlertModal();
  const { isExtracting, runExtraction } = useProjectLibraryExtraction();
  const [uploads, setUploads] = useState<(UploadRecord | undefined)[]>(() =>
    normalizeFixedUploads(
      loadDraft<(UploadRecord | undefined)[]>(
        "draft-project-library-uploads",
        Array(MAX_FILES).fill(undefined)
      )
    )
  );
  const [extraPrSlots, setExtraPrSlots] = useState<ExtraPrSlot[]>(() =>
    loadExtraPrSlots()
  );
  const [staging, setStaging] = useState<StagingItem[]>([]);
  const [isDetecting, setIsDetecting] = useState(false);
  const [detectError, setDetectError] = useState<string | null>(null);
  const [isSaved, setIsSaved] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewTitle, setPreviewTitle] = useState<string | undefined>(
    undefined
  );
  const [previewBlobUrl, setPreviewBlobUrl] = useState<string | null>(null);

  const markLibraryDirty = () => {
    clearPageSaved("saved-project-library");
    clearPageSaved("saved-project-library-files");
    setIsSaved(false);
  };

  useEffect(() => {
    void deleteProjectLibraryFile(4);
  }, []);

  useEffect(() => {
    if (isLoading) return;

    let cancelled = false;

    void (async () => {
      if (isEditMode && projectData) {
        const uploadsData = ((projectData.project_library || {}).uploads ||
          []) as UploadRecord[];
        if (uploadsData.length > 0) {
          const { fixed, extraPr } = splitServerUploads(uploadsData);
          if (cancelled) return;
          setUploads(fixed);
          setExtraPrSlots(extraPr);
          saveDraft("draft-project-library-uploads", fixed);
          saveDraft(DRAFT_PROJECT_LIBRARY_EXTRA_PR_KEY, extraPr);
          if (fixed.filter(Boolean).length >= MAX_FILES) {
            markPageSaved("saved-project-library");
            saveDraft("saved-project-library-files", { count: MAX_FILES });
            setIsSaved(true);
          } else {
            markLibraryDirty();
          }
          return;
        }
      }

      const draft = loadDraft<(UploadRecord | undefined)[]>(
        "draft-project-library-uploads",
        Array(MAX_FILES).fill(undefined)
      );
      const reconciled = normalizeFixedUploads(
        await reconcileFixedLibraryUploads(draft, MAX_FILES)
      );
      if (cancelled) return;

      const attached = reconciled.filter(Boolean).length;
      const flagged = isPageSaved("saved-project-library");
      const verified = loadDraft<{ count?: number } | null>(
        "saved-project-library-files",
        null
      );
      const fullySaved =
        flagged && attached >= MAX_FILES && verified?.count === MAX_FILES;

      // Drop unsaved leftover PDFs so preview/list don't show stale files.
      if (!fullySaved) {
        for (let i = 0; i < MAX_FILES; i++) {
          // eslint-disable-next-line no-await-in-loop
          await deleteProjectLibraryFile(i);
        }
        const extras = loadExtraPrSlots();
        for (const slot of extras) {
          // eslint-disable-next-line no-await-in-loop
          await deleteExtraPrCard(slot.id);
        }
        if (cancelled) return;
        setUploads(normalizeFixedUploads([]));
        setExtraPrSlots([]);
        saveDraft("draft-project-library-uploads", normalizeFixedUploads([]));
        saveDraft(DRAFT_PROJECT_LIBRARY_EXTRA_PR_KEY, []);
        markLibraryDirty();
        return;
      }

      setUploads(reconciled);
      saveDraft("draft-project-library-uploads", reconciled);
      setIsSaved(true);
    })();

    return () => {
      cancelled = true;
    };
  }, [isEditMode, isLoading, projectData]);

  const closePreview = () => {
    setPreviewOpen(false);
    if (previewBlobUrl) URL.revokeObjectURL(previewBlobUrl);
    setPreviewBlobUrl(null);
    setPreviewUrl(null);
    setPreviewTitle(undefined);
  };

  const clearPreviousAttachments = async () => {
    closePreview();
    uploads.forEach((u) => {
      if (u?.url?.startsWith("blob:")) URL.revokeObjectURL(u.url);
    });
    extraPrSlots.forEach((s) => {
      if (s.upload?.url?.startsWith("blob:")) URL.revokeObjectURL(s.upload.url);
    });
    await clearAllLocalFiles();
    setUploads(normalizeFixedUploads([]));
    setExtraPrSlots([]);
    saveDraft("draft-project-library-uploads", normalizeFixedUploads([]));
    saveDraft(DRAFT_PROJECT_LIBRARY_EXTRA_PR_KEY, []);
  };

  const openPreview = async (
    title: string,
    loadBlob: () => Promise<{ blob: Blob } | null | undefined>,
    fallbackUrl?: string
  ) => {
    setPreviewTitle(title);
    try {
      const local = await loadBlob();
      if (local?.blob && local.blob.size > 0) {
        if (previewBlobUrl) URL.revokeObjectURL(previewBlobUrl);
        const freshUrl = URL.createObjectURL(local.blob);
        setPreviewBlobUrl(freshUrl);
        setPreviewUrl(freshUrl);
        setPreviewOpen(true);
        return;
      }
    } catch (e) {
      console.error("Failed to load local file for preview:", e);
    }
    // Never reuse stale draft blob: URLs from a previous page load.
    if (fallbackUrl && !fallbackUrl.startsWith("blob:")) {
      setPreviewBlobUrl(null);
      setPreviewUrl(fallbackUrl);
      setPreviewOpen(true);
      return;
    }
    showAlert({
      title: "Preview unavailable",
      message: "No document file is available to preview. Upload the PDFs again.",
    });
  };

  const clearAllLocalFiles = async () => {
    for (let i = 0; i < MAX_FILES; i++) {
      // eslint-disable-next-line no-await-in-loop
      await deleteProjectLibraryFile(i);
    }
    for (const slot of extraPrSlots) {
      // eslint-disable-next-line no-await-in-loop
      await deleteExtraPrCard(slot.id);
    }
  };

  const applyAssignedFiles = async (
    items: Array<{ file: File; type: LibraryDocType }>
  ): Promise<{ error: string | null; extraSlotIds: string[] }> => {
    const byType: Partial<Record<LibraryDocType, File[]>> = {};
    for (const item of items) {
      byType[item.type] = [...(byType[item.type] ?? []), item.file];
    }

    const prFiles = byType["pr-card"] ?? [];
    const dpFiles = byType["dp-remarks"] ?? [];
    const crzFiles = byType["crz-remarks"] ?? [];
    const poaFiles = byType["power-of-attorney"] ?? [];

    if (prFiles.length < 1) {
      return { error: `Missing ${LABEL_BY_TYPE["pr-card"]}.`, extraSlotIds: [] };
    }
    if (dpFiles.length !== 1) {
      return {
        error:
          dpFiles.length === 0
            ? `Missing ${LABEL_BY_TYPE["dp-remarks"]}.`
            : `Duplicate ${LABEL_BY_TYPE["dp-remarks"]} files — keep only one.`,
        extraSlotIds: [],
      };
    }
    if (crzFiles.length !== 1) {
      return {
        error:
          crzFiles.length === 0
            ? `Missing ${LABEL_BY_TYPE["crz-remarks"]}.`
            : `Duplicate ${LABEL_BY_TYPE["crz-remarks"]} files — keep only one.`,
        extraSlotIds: [],
      };
    }
    if (poaFiles.length !== 1) {
      return {
        error:
          poaFiles.length === 0
            ? `Missing ${LABEL_BY_TYPE["power-of-attorney"]}.`
            : `Duplicate ${LABEL_BY_TYPE["power-of-attorney"]} files — keep only one.`,
        extraSlotIds: [],
      };
    }
    if (prFiles.length - 1 > PROJECT_LIBRARY_MAX_EXTRA_PR_CARDS) {
      return {
        error: `You can add up to ${PROJECT_LIBRARY_MAX_EXTRA_PR_CARDS} additional PR / PRC cards.`,
        extraSlotIds: [],
      };
    }

    uploads.forEach((u) => {
      if (u?.url) URL.revokeObjectURL(u.url);
    });
    extraPrSlots.forEach((s) => {
      if (s.upload?.url) URL.revokeObjectURL(s.upload.url);
    });

    await clearAllLocalFiles();

    const fixedFiles = [
      prFiles[0]!,
      dpFiles[0]!,
      crzFiles[0]!,
      poaFiles[0]!,
    ];
    const nextFixed: (UploadRecord | undefined)[] = [];
    for (let i = 0; i < MAX_FILES; i++) {
      const file = fixedFiles[i]!;
      // eslint-disable-next-line no-await-in-loop
      await saveProjectLibraryFile(i, file);
      const safeDocName = (DOCUMENT_NAMES[i] || file.name)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 50);
      nextFixed.push(makeUploadRecord(file, `${safeDocName}-${i + 1}`));
    }

    const extraFiles = prFiles.slice(1);
    const nextExtra: ExtraPrSlot[] = [];
    for (const file of extraFiles) {
      const slot = createExtraSlot();
      // eslint-disable-next-line no-await-in-loop
      await saveExtraPrCard(slot.id, file);
      const safeDocName = PROJECT_LIBRARY_EXTRA_PR_LABEL.toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 50);
      nextExtra.push({
        ...slot,
        upload: makeUploadRecord(
          file,
          `${safeDocName}-${slot.id.slice(0, 8)}`
        ),
      });
    }

    setUploads(nextFixed);
    setExtraPrSlots(nextExtra);
    markLibraryDirty();
    return { error: null, extraSlotIds: nextExtra.map((s) => s.id) };
  };

  const detectAndAssign = async (
    items: StagingItem[]
  ): Promise<{ ok: boolean; extraSlotIds: string[] }> => {
    const typed = items
      .map((item) => {
        const type = effectiveType(item);
        return type ? { file: item.file, type } : null;
      })
      .filter(Boolean) as Array<{ file: File; type: LibraryDocType }>;

    if (typed.length !== items.length) {
      setDetectError(
        "Could not detect every document. Set the type manually for unknown files, then try again."
      );
      return { ok: false, extraSlotIds: [] };
    }

    const { error, extraSlotIds } = await applyAssignedFiles(typed);
    if (error) {
      setDetectError(error);
      return { ok: false, extraSlotIds: [] };
    }
    setDetectError(null);
    return { ok: true, extraSlotIds };
  };

  const classifyStagingItems = async (
    items: StagingItem[]
  ): Promise<StagingItem[] | null> => {
    setIsDetecting(true);
    setDetectError(null);
    setStaging((prev) =>
      prev.map((item) =>
        items.some((i) => i.id === item.id)
          ? { ...item, loading: true, error: null }
          : item
      )
    );

    try {
      const outcomes = await Promise.all(
        items.map(async (item) => {
          if (item.overrideType) {
            return {
              id: item.id,
              detectedType: item.overrideType,
              error: null as string | null,
            };
          }
          try {
            const result = await classifyDocumentFile(
              item.file,
              LIBRARY_ALLOWED_TYPES as DocumentType[]
            );
            if (!isLibraryDocType(result.documentType)) {
              return {
                id: item.id,
                detectedType: null,
                error:
                  "Could not identify this document. Choose the type manually.",
              };
            }
            return {
              id: item.id,
              detectedType: result.documentType,
              error: null as string | null,
            };
          } catch (err) {
            return {
              id: item.id,
              detectedType: null as LibraryDocType | null,
              error:
                err instanceof Error ? err.message : "Classification failed.",
            };
          }
        })
      );

      const nextStaging = items.map((item) => {
        const outcome = outcomes.find((o) => o.id === item.id);
        if (!outcome) {
          return { ...item, loading: false, error: "Classification failed." };
        }
        return {
          ...item,
          loading: false,
          detectedType: outcome.detectedType ?? item.detectedType,
          error: outcome.error,
        };
      });
      setStaging(nextStaging);

      if (outcomes.some((o) => o.error)) {
        setDetectError(
          "Some documents could not be identified. Set the type manually, then try Save again."
        );
        return null;
      }

      return nextStaging;
    } finally {
      setIsDetecting(false);
    }
  };

  const addFiles = (fileList: FileList | File[]) => {
    if (isReadOnlyMode) return;
    const incoming = Array.from(fileList).filter((file) =>
      ACCEPTED_TYPES.some((type) => file.name.toLowerCase().endsWith(type))
    );

    if (incoming.length === 0) {
      showAlert({
        title: "Invalid file type",
        message: "Only PDF files are supported.",
      });
      return;
    }

    const room = Math.max(0, MAX_TOTAL_FILES - staging.length);
    if (room === 0) {
      showAlert({
        title: "Maximum reached",
        message: `You can attach up to ${MAX_TOTAL_FILES} PDFs (${MAX_FILES} required + up to ${PROJECT_LIBRARY_MAX_EXTRA_PR_CARDS} extra PR / PRC cards).`,
      });
      return;
    }

    const toAdd = incoming.slice(0, room);
    if (toAdd.length < incoming.length) {
      showAlert({
        title: "Some files skipped",
        message: `Only ${toAdd.length} more file${toAdd.length === 1 ? "" : "s"} could be added (max ${MAX_TOTAL_FILES}).`,
      });
    }

    const nextItems: StagingItem[] = toAdd.map((file) => ({
      id: createId(),
      file,
      detectedType: null,
      overrideType: null,
      loading: false,
      error: null,
    }));

    const append = () => {
      setStaging((prev) => [...prev, ...nextItems]);
      setDetectError(null);
      markLibraryDirty();
    };

    // First file(s) in a new selection replace any previously saved library PDFs.
    if (staging.length === 0 && totalAttached > 0) {
      void clearPreviousAttachments().then(append);
      return;
    }

    append();
  };

  const handleTypeOverride = (id: string, nextType: LibraryDocType | "") => {
    setStaging((prev) =>
      prev.map((item) =>
        item.id === id
          ? {
              ...item,
              overrideType: nextType || null,
              error: null,
            }
          : item
      )
    );
    setDetectError(null);
  };

  const removeStagingItem = (id: string) => {
    setStaging((prev) => {
      const next = prev.filter((item) => item.id !== id);
      if (next.length === 0) {
        void clearPreviousAttachments();
      }
      return next;
    });
    setDetectError(null);
    markLibraryDirty();
  };

  const attachedExtraCount = extraPrSlots.filter((s) => s.upload).length;
  const totalAttached = uploads.filter(Boolean).length + attachedExtraCount;
  const attachedRequiredCount = uploads.filter(Boolean).length;
  const showSavedButton =
    isSaved &&
    attachedRequiredCount >= MAX_FILES &&
    isPageSaved("saved-project-library") &&
    staging.length === 0;

  useEffect(() => {
    if (attachedRequiredCount < MAX_FILES && isSaved) {
      markLibraryDirty();
    }
  }, [attachedRequiredCount, isSaved]);

  const handleSave = async () => {
    if (isReadOnlyMode || isExtracting || isDetecting) return;

    let working = staging;
    let extraSlotIdsForExtraction: string[] = [];

    if (working.length > 0) {
      if (working.length < MAX_FILES) {
        showAlert({
          title: "More documents needed",
          message: `Add at least ${MAX_FILES} PDFs (${DOCUMENT_NAMES.join(", ")}). You have ${working.length} so far — you can add them one by one.`,
        });
        return;
      }
      if (working.length > MAX_TOTAL_FILES) {
        showAlert({
          title: "Too many files",
          message: `Remove extras — maximum is ${MAX_TOTAL_FILES} PDFs.`,
        });
        return;
      }

      const needsClassify = working.some(
        (item) => !effectiveType(item) || item.error
      );
      if (needsClassify) {
        const classified = await classifyStagingItems(working);
        if (!classified) return;
        working = classified;
      }

      const assigned = await detectAndAssign(working);
      if (!assigned.ok) return;
      extraSlotIdsForExtraction = assigned.extraSlotIds;
    } else {
      extraSlotIdsForExtraction = extraPrSlots
        .filter((s) => s.upload)
        .map((s) => s.id);
    }

    const ok = await hasAllProjectLibraryFiles(MAX_FILES);
    if (!ok) {
      showAlert({
        title: "Project library",
        message: `Please upload the ${MAX_FILES} required documents (${DOCUMENT_NAMES.join(", ")}). You can add them one by one or all together — we’ll detect each type automatically.`,
      });
      return;
    }

    const outcome = await runExtraction(extraSlotIdsForExtraction);

    if (outcome.primaryPrFailed) {
      const failureLines = outcome.failures
        .filter((f) => f.label === "Primary PR / PRC" || f.error)
        .map((f) => {
          if (f.error) return `${f.label}: ${f.error}`;
          const fields = (f.missingFields ?? [])
            .map((field) => getFieldLabel(field))
            .join(", ");
          return `${f.label}: missing ${fields || "required fields"}`;
        });
      showAlert({
        title: "Extraction failed",
        message:
          failureLines.length > 0
            ? `Could not extract the primary PR / PRC card. Please review the document and try again.\n\n${failureLines.join("\n")}`
            : "Could not extract the primary PR / PRC card. Please review the document and try again.",
      });
      return;
    }

    if (outcome.autofill) {
      applyProjectAutofillDrafts(outcome.autofill);
    }

    const snapshot: LibrarySnapshot = { fixed: uploads, extraPr: extraPrSlots };
    markPageSaved("saved-project-library");
    saveDraft("saved-project-library-files", { count: MAX_FILES });
    saveDraft("dirty-project-library", false);
    saveDraft("saved-project-library-snapshot", snapshot);
    setIsSaved(true);

    const optionalFailures = outcome.failures.filter(
      (f) => f.label !== "Primary PR / PRC"
    );
    let message =
      "Documents saved. Area Details, Project Details, and Applicant pre-filled — please review.";
    if (attachedExtraCount > 0) {
      message = `Project library saved with ${attachedExtraCount} additional PR / PRC card${attachedExtraCount === 1 ? "" : "s"}. Area Details, Project Details, and Applicant pre-filled — please review.`;
    }
    if (optionalFailures.length > 0) {
      const lines = optionalFailures.map((f) => {
        if (f.error) return `${f.label}: ${f.error}`;
        const fields = (f.missingFields ?? [])
          .map((field) => getFieldLabel(field))
          .join(", ");
        return `${f.label}: partial extraction (${fields || "some fields missing"})`;
      });
      message = `${message}\n\nSome documents had extraction issues:\n${lines.join("\n")}`;
    }

    showAlert({
      title: "Project library",
      message,
    });
  };

  useEffect(() => {
    saveDraft("draft-project-library-uploads", uploads);
  }, [uploads]);

  useEffect(() => {
    saveDraft(DRAFT_PROJECT_LIBRARY_EXTRA_PR_KEY, extraPrSlots);
  }, [extraPrSlots]);

  if (isLoading) {
    return (
      <div className="flex min-h-[320px] items-center justify-center py-10">
        <div className="text-center">
          <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-2 border-gray-200 border-t-brand-blue" />
          <p className="text-sm text-gray-500">Loading project data…</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`pb-2 space-y-5 ${
        isReadOnlyMode
          ? "[&_input]:cursor-not-allowed [&_textarea]:cursor-not-allowed [&_select]:cursor-not-allowed"
          : ""
      }`}
    >
      <DocumentPreviewModal
        open={previewOpen && Boolean(previewUrl)}
        onClose={closePreview}
        fileUrl={previewUrl}
        title={previewTitle}
      />

      <div>
        <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
          <p className="max-w-xl text-sm text-gray-500">
            Upload the {MAX_FILES} required project documents — one at a time or
            all together. We’ll detect each type and fill project details. Extra
            PR / PRC cards are optional.
          </p>
          <button
            type="button"
            onClick={handleSave}
            disabled={isReadOnlyMode || isExtracting || isDetecting}
            className={`rounded-lg px-5 py-2 text-sm font-semibold ${
              showSavedButton ? BTN_PRIMARY : BTN_SAVE_UNSAVED
            } ${isReadOnlyMode || isExtracting || isDetecting ? "cursor-not-allowed opacity-70" : ""}`}
          >
            {isExtracting || isDetecting ? (
              <span className="inline-flex items-center gap-2">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                {isDetecting ? "Detecting…" : "Saving & extracting…"}
              </span>
            ) : showSavedButton ? (
              "Saved"
            ) : (
              "Save"
            )}
          </button>
        </div>

        {!isReadOnlyMode && (
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              if (e.dataTransfer.files?.length) {
                addFiles(e.dataTransfer.files);
              }
            }}
            className={`mb-4 rounded-xl border-2 border-dashed px-4 py-6 text-center transition-colors ${
              dragOver
                ? "border-brand-blue bg-blue-50/60"
                : "border-gray-200 bg-gray-50/80 hover:border-gray-300"
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept={ACCEPTED_TYPES.join(",")}
              multiple
              className="hidden"
              onChange={(e) => {
                if (e.target.files?.length) {
                  addFiles(e.target.files);
                }
                e.target.value = "";
              }}
            />
            <p className="text-sm font-medium text-gray-800">
              Drop PDFs here, or{" "}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="text-brand-blue underline-offset-2 hover:underline"
              >
                browse
              </button>
            </p>
            <p className="mt-1 text-xs text-gray-500">
              Add files one by one or several at once. Need {MAX_FILES}:{" "}
              {DOCUMENT_NAMES.join(", ")}. Up to{" "}
              {PROJECT_LIBRARY_MAX_EXTRA_PR_CARDS} extra PR / PRC cards allowed.
              {staging.length > 0
                ? ` (${staging.length}/${MAX_TOTAL_FILES} selected)`
                : ""}
            </p>
          </div>
        )}

        {staging.length > 0 && (
          <ul className="mb-4 space-y-3">
            {staging.map((item) => {
              const type = effectiveType(item);
              return (
                <li
                  key={item.id}
                  className="rounded-xl border border-gray-200 bg-white px-4 py-3"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0 flex-1 space-y-1">
                      <p className="truncate text-sm font-medium text-gray-900">
                        {item.file.name}
                      </p>
                      <p className="text-xs text-gray-500">
                        {formatFileSize(item.file.size)}
                        {item.loading ? " · Detecting…" : ""}
                      </p>
                      {item.error && (
                        <p className="text-xs text-red-600">{item.error}</p>
                      )}
                      {!item.loading && !item.error && type && (
                        <p className="text-xs text-green-700">
                          Detected as {LABEL_BY_TYPE[type]}
                          {item.overrideType ? " (manual)" : ""}
                        </p>
                      )}
                    </div>
                    <div className="flex shrink-0 flex-wrap items-center gap-2">
                      <select
                        value={item.overrideType ?? item.detectedType ?? ""}
                        disabled={item.loading || isDetecting || isExtracting}
                        onChange={(e) => {
                          const value = e.target.value;
                          handleTypeOverride(
                            item.id,
                            isLibraryDocType(value) ? value : ""
                          );
                        }}
                        className="rounded-lg border border-gray-200 bg-gray-50 px-2.5 py-1.5 text-xs text-gray-900 outline-none focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20"
                        aria-label={`Document type for ${item.file.name}`}
                      >
                        <option value="">
                          {item.loading ? "Detecting…" : "Set type…"}
                        </option>
                        {LIBRARY_ALLOWED_TYPES.map((docType) => (
                          <option key={docType} value={docType}>
                            {LABEL_BY_TYPE[docType]}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() =>
                          void openPreview(item.file.name, async () => ({
                            blob: item.file,
                          }))
                        }
                        className="rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-medium text-brand-blue hover:bg-gray-50"
                      >
                        Preview
                      </button>
                      <button
                        type="button"
                        onClick={() => removeStagingItem(item.id)}
                        disabled={item.loading || isDetecting || isExtracting}
                        className="rounded-lg border border-red-200 bg-red-50 px-2.5 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100 disabled:opacity-50"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {staging.length === 0 && totalAttached > 0 && (
          <ul className="mb-4 space-y-3">
            <AttachedSummaryRow
              serial="1"
              label={DOCUMENT_NAMES[0]}
              upload={uploads[0]}
              isReadOnlyMode={isReadOnlyMode}
              onPreview={() =>
                void openPreview(
                  DOCUMENT_NAMES[0] || uploads[0]?.name || "Document 1",
                  () => getProjectLibraryFile(0),
                  uploads[0]?.url
                )
              }
            />
            {extraPrSlots.map((slot, slotIndex) => (
              <AttachedSummaryRow
                key={slot.id}
                serial={`1.${slotIndex + 1}`}
                label={PROJECT_LIBRARY_EXTRA_PR_LABEL}
                upload={slot.upload}
                isReadOnlyMode={isReadOnlyMode}
                onPreview={() =>
                  void openPreview(
                    `${PROJECT_LIBRARY_EXTRA_PR_LABEL} ${slotIndex + 1}`,
                    () => getExtraPrCard(slot.id),
                    slot.upload?.url
                  )
                }
              />
            ))}
            {uploads.slice(1).map((upload, offsetIndex) => {
              const index = offsetIndex + 1;
              return (
                <AttachedSummaryRow
                  key={`fixed-${index}`}
                  serial={String(index + 1)}
                  label={DOCUMENT_NAMES[index] || `Document ${index + 1}`}
                  upload={upload}
                  isReadOnlyMode={isReadOnlyMode}
                  onPreview={() =>
                    void openPreview(
                      DOCUMENT_NAMES[index] ||
                        upload?.name ||
                        `Document ${index + 1}`,
                      () => getProjectLibraryFile(index),
                      upload?.url
                    )
                  }
                />
              );
            })}
          </ul>
        )}

        {detectError && (
          <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {detectError}
          </p>
        )}

        <div className="text-sm text-gray-700">
          {staging.length > 0
            ? `${staging.length} file${staging.length === 1 ? "" : "s"} selected`
            : `${totalAttached} file${totalAttached === 1 ? "" : "s"} attached`}
          {staging.length === 0 && attachedExtraCount > 0 && (
            <span className="text-gray-500">
              {" "}
              (including {attachedExtraCount} additional PR / PRC)
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
