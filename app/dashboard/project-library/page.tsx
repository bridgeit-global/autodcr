"use client";

import { useRef, useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { loadDraft, saveDraft, markPageSaved, isPageSaved, clearPageSaved } from "@/app/utils/draftStorage";
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

const DOCUMENT_NAMES = PROJECT_LIBRARY_DOCUMENT_NAMES;
const MAX_FILES = PROJECT_LIBRARY_MAX_FILES;
const ACCEPTED_TYPES = [".pdf"];

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

type DocumentRowProps = {
  serial: string;
  label: string;
  upload?: UploadRecord;
  isReadOnlyMode: boolean;
  onAttach: () => void;
  onClear?: () => void;
  onPreview: () => void;
  onRemove?: () => void;
  rowClassName?: string;
};

function DocumentRow({
  serial,
  label,
  upload,
  isReadOnlyMode,
  onAttach,
  onClear,
  onPreview,
  onRemove,
  rowClassName = "bg-white",
}: DocumentRowProps) {
  return (
    <tr className={`border-b border-gray-200 last:border-b-0 ${rowClassName}`}>
      <td className="px-3 py-3 border-r border-gray-200 align-top text-gray-700">{serial}</td>
      <td className="px-3 py-3 border-r border-gray-200 align-top">
        <div className="flex items-start justify-between gap-3">
          <span>{label}</span>
          {onRemove && !isReadOnlyMode && (
            <button
              type="button"
              onClick={onRemove}
              className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-red-200 bg-red-50 px-2 py-1 text-[11px] font-medium text-red-700 transition-colors hover:border-red-300 hover:bg-red-100"
              aria-label="Remove row"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                className="h-3.5 w-3.5"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6h14z" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M10 11v6M14 11v6" strokeLinecap="round" />
              </svg>
              Delete
            </button>
          )}
        </div>
      </td>
      <td className="px-3 py-3 border-r border-gray-200 align-top">
        <div className="flex flex-col items-center gap-1">
          <button
            type="button"
            onClick={onAttach}
            disabled={isReadOnlyMode}
            className={`inline-flex items-center justify-center w-9 h-9 rounded-lg border border-brand-blue/20 bg-blue-50 hover:bg-blue-100 text-brand-blue leading-none shadow-sm transition-colors ${
              isReadOnlyMode ? "cursor-not-allowed opacity-70" : ""
            }`}
            aria-label="Attach document"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor">
              <path d="M3 7a2 2 0 0 1 2-2h5.172a2 2 0 0 1 1.414.586l1.828 1.828H19a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z" />
            </svg>
          </button>
          {upload && !onRemove && onClear && (
            <button
              type="button"
              className={`text-[11px] text-red-600 hover:underline ${
                isReadOnlyMode ? "cursor-not-allowed opacity-70" : ""
              }`}
              onClick={onClear}
              disabled={isReadOnlyMode}
            >
              Clear
            </button>
          )}
        </div>
      </td>
      <td className="px-3 py-3 text-center align-top">
        {upload ? (
          <button
            type="button"
            onClick={onPreview}
            className="inline-flex items-center justify-center w-9 h-9 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-brand-blue hover:text-brand-navy shadow-sm transition-colors cursor-pointer"
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
        ) : (
          <span className="text-xs text-gray-400">-</span>
        )}
      </td>
    </tr>
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
      loadDraft<(UploadRecord | undefined)[]>("draft-project-library-uploads", Array(MAX_FILES).fill(undefined))
    )
  );
  const [extraPrSlots, setExtraPrSlots] = useState<ExtraPrSlot[]>(() => loadExtraPrSlots());
  const [isSaved, setIsSaved] = useState(false);
  const fixedInputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const extraInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewTitle, setPreviewTitle] = useState<string | undefined>(undefined);
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
        const uploadsData = ((projectData.project_library || {}).uploads || []) as UploadRecord[];
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
      const reconciled = normalizeFixedUploads(await reconcileFixedLibraryUploads(draft, MAX_FILES));
      if (cancelled) return;

      setUploads(reconciled);
      saveDraft("draft-project-library-uploads", reconciled);

      const attached = reconciled.filter(Boolean).length;
      const flagged = isPageSaved("saved-project-library");
      const verified = loadDraft<{ count?: number } | null>("saved-project-library-files", null);

      if (attached < MAX_FILES || verified?.count !== MAX_FILES) {
        markLibraryDirty();
        return;
      }

      if (flagged) {
        setIsSaved(true);
      } else {
        setIsSaved(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isEditMode, isLoading, projectData]);

  const openPreview = async (
    title: string,
    loadBlob: () => Promise<{ blob: Blob } | null | undefined>,
    fallbackUrl?: string
  ) => {
    setPreviewTitle(title);
    try {
      const local = await loadBlob();
      if (local?.blob) {
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
    if (fallbackUrl) {
      setPreviewUrl(fallbackUrl);
      setPreviewOpen(true);
    }
  };

  const handleFixedFileChange =
    (index: number) => async (event: React.ChangeEvent<HTMLInputElement>) => {
      if (isReadOnlyMode) return;
      const file = event.target.files?.[0];
      if (!file) return;

      if (!ACCEPTED_TYPES.some((type) => file.name.toLowerCase().endsWith(type))) {
        showAlert({ title: "Invalid file type", message: "Only PDF files are supported." });
        event.target.value = "";
        return;
      }

      const safeDocName = (DOCUMENT_NAMES[index] || file.name)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 50);
      const extension = file.name.split(".").pop() || "pdf";
      const localUrl = URL.createObjectURL(file);

      try {
        await saveProjectLibraryFile(index, file);
      } catch (e) {
        console.error("Error saving file locally:", e);
        showAlert({
          title: "Could not save file",
          message: "Failed to save document locally. Please try again.",
        });
        event.target.value = "";
        return;
      }

      const record: UploadRecord = {
        id: createId(),
        name: file.name,
        url: localUrl,
        uploadedAt: new Date().toISOString(),
        path: `${safeDocName}-${index + 1}.${extension}`,
      };

      setUploads((prev) => {
        const next = [...prev];
        next[index] = record;
        return next;
      });
      markLibraryDirty();
    };

  const handleExtraFileChange =
    (slotId: string) => async (event: React.ChangeEvent<HTMLInputElement>) => {
      if (isReadOnlyMode) return;
      const file = event.target.files?.[0];
      if (!file) return;

      if (!ACCEPTED_TYPES.some((type) => file.name.toLowerCase().endsWith(type))) {
        showAlert({ title: "Invalid file type", message: "Only PDF files are supported." });
        event.target.value = "";
        return;
      }

      const safeDocName = PROJECT_LIBRARY_EXTRA_PR_LABEL.toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 50);
      const extension = file.name.split(".").pop() || "pdf";
      const localUrl = URL.createObjectURL(file);

      try {
        await saveExtraPrCard(slotId, file);
      } catch (e) {
        console.error("Error saving extra PR file locally:", e);
        showAlert({
          title: "Could not save file",
          message: "Failed to save document locally. Please try again.",
        });
        event.target.value = "";
        return;
      }

      const record: UploadRecord = {
        id: createId(),
        name: file.name,
        url: localUrl,
        uploadedAt: new Date().toISOString(),
        path: `${safeDocName}-${slotId.slice(0, 8)}.${extension}`,
      };

      setExtraPrSlots((prev) =>
        prev.map((slot) => (slot.id === slotId ? { ...slot, upload: record } : slot))
      );
      markLibraryDirty();
    };

  const handleClearFixed = (index: number) => () => {
    if (isReadOnlyMode) return;
    setUploads((prev) => {
      const next = [...prev];
      const existing = next[index];
      if (existing) URL.revokeObjectURL(existing.url);
      next[index] = undefined;
      return next;
    });
    deleteProjectLibraryFile(index).catch((e) => console.error("Failed to delete local file:", e));
    const input = fixedInputRefs.current[index];
    if (input) input.value = "";
    markLibraryDirty();
  };

  const handleRemoveExtra = (slotId: string) => () => {
    if (isReadOnlyMode) return;
    setExtraPrSlots((prev) => {
      const slot = prev.find((s) => s.id === slotId);
      if (slot?.upload) URL.revokeObjectURL(slot.upload.url);
      return prev.filter((s) => s.id !== slotId);
    });
    deleteExtraPrCard(slotId).catch((e) => console.error("Failed to delete extra PR file:", e));
    delete extraInputRefs.current[slotId];
    markLibraryDirty();
  };

  const handleAddExtraPr = () => {
    if (isReadOnlyMode) return;
    if (extraPrSlots.length >= PROJECT_LIBRARY_MAX_EXTRA_PR_CARDS) {
      showAlert({
        title: "Maximum reached",
        message: `You can add up to ${PROJECT_LIBRARY_MAX_EXTRA_PR_CARDS} additional PR / PRC cards.`,
      });
      return;
    }
    setExtraPrSlots((prev) => [...prev, createExtraSlot()]);
  };

  const attachedExtraCount = extraPrSlots.filter((s) => s.upload).length;
  const totalAttached =
    uploads.filter(Boolean).length + attachedExtraCount;

  const attachedRequiredCount = uploads.filter(Boolean).length;
  const showSavedButton =
    isSaved && attachedRequiredCount >= MAX_FILES && isPageSaved("saved-project-library");

  useEffect(() => {
    if (attachedRequiredCount < MAX_FILES && isSaved) {
      markLibraryDirty();
    }
  }, [attachedRequiredCount, isSaved]);

  const handleSave = async () => {
    if (isReadOnlyMode || isExtracting) return;
    const ok = await hasAllProjectLibraryFiles(MAX_FILES);
    if (!ok) {
      showAlert({
        title: "Project library",
        message: "Please upload all four required documents before saving the Project Library.",
      });
      return;
    }

    const extraSlotIds = extraPrSlots.filter((s) => s.upload).map((s) => s.id);
    const outcome = await runExtraction(extraSlotIds);

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

    const optionalFailures = outcome.failures.filter((f) => f.label !== "Primary PR / PRC");
    let message =
      "Documents saved. Area Details, Project Details, and Applicant pre-filled — please review.";
    if (attachedExtraCount > 0) {
      message = `Project library saved with ${attachedExtraCount} additional PR / PRC card${attachedExtraCount === 1 ? "" : "s"}. Area Details, Project Details, and Applicant pre-filled — please review.`;
    }
    if (optionalFailures.length > 0) {
      const lines = optionalFailures.map((f) => {
        if (f.error) return `${f.label}: ${f.error}`;
        const fields = (f.missingFields ?? []).map((field) => getFieldLabel(field)).join(", ");
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
        open={previewOpen}
        onClose={() => {
          setPreviewOpen(false);
          if (previewBlobUrl) URL.revokeObjectURL(previewBlobUrl);
          setPreviewBlobUrl(null);
          setPreviewUrl(null);
          setPreviewTitle(undefined);
        }}
        fileUrl={previewUrl}
        title={previewTitle}
      />

      <div>
        <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
          <p className="max-w-xl text-sm text-gray-500">
            Upload project documents for this project. Add extra PR / PRC cards only if your
            project spans multiple CTS numbers or properties.
          </p>
          <button
            type="button"
            onClick={handleSave}
            disabled={isReadOnlyMode || isExtracting}
            className={`rounded-lg px-5 py-2 text-sm font-semibold ${
              showSavedButton ? BTN_PRIMARY : BTN_SAVE_UNSAVED
            } ${isReadOnlyMode || isExtracting ? "cursor-not-allowed opacity-70" : ""}`}
          >
            {isExtracting ? (
              <span className="inline-flex items-center gap-2">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                Saving & extracting…
              </span>
            ) : showSavedButton ? (
              "Saved"
            ) : (
              "Save"
            )}
          </button>
        </div>

        <div className="space-y-4">
          <div className="overflow-hidden rounded-xl border border-gray-100">
            <table className="min-w-full text-sm text-left text-gray-900">
              <thead className="bg-gray-50 border-b border-gray-200 text-xs uppercase text-gray-600">
                <tr>
                  <th className="px-3 py-3 border-r border-gray-200 w-20">Sr. No.</th>
                  <th className="px-3 py-3 border-r border-gray-200">Document&apos;s Name</th>
                  <th className="px-3 py-3 border-r border-gray-200 w-32 text-center">Attach Here</th>
                  <th className="px-3 py-3 w-24 text-center">Preview</th>
                </tr>
              </thead>
              <tbody>
                <DocumentRow
                  key="fixed-0"
                  serial="1"
                  label={DOCUMENT_NAMES[0]}
                  upload={uploads[0]}
                  isReadOnlyMode={isReadOnlyMode}
                  rowClassName="bg-white"
                  onAttach={() => fixedInputRefs.current[0]?.click()}
                  onClear={handleClearFixed(0)}
                  onPreview={() =>
                    void openPreview(
                      DOCUMENT_NAMES[0] || uploads[0]?.name || "Document 1",
                      () => getProjectLibraryFile(0),
                      uploads[0]?.url
                    )
                  }
                />

                {extraPrSlots.map((slot, slotIndex) => (
                  <DocumentRow
                    key={slot.id}
                    serial={`1.${slotIndex + 1}`}
                    label={PROJECT_LIBRARY_EXTRA_PR_LABEL}
                    upload={slot.upload}
                    isReadOnlyMode={isReadOnlyMode}
                    rowClassName="bg-emerald-50/30"
                    onAttach={() => extraInputRefs.current[slot.id]?.click()}
                    onRemove={handleRemoveExtra(slot.id)}
                    onPreview={() =>
                      void openPreview(
                        `${PROJECT_LIBRARY_EXTRA_PR_LABEL} ${slotIndex + 1}`,
                        () => getExtraPrCard(slot.id),
                        slot.upload?.url
                      )
                    }
                  />
                ))}

                {!isReadOnlyMode && (
                  <tr className="border-b border-gray-200 bg-gradient-to-r from-emerald-50/40 to-blue-50/30">
                    <td colSpan={4} className="px-3 py-3">
                      <button
                        type="button"
                        onClick={handleAddExtraPr}
                        disabled={extraPrSlots.length >= PROJECT_LIBRARY_MAX_EXTRA_PR_CARDS}
                        className="group flex w-full items-center justify-center gap-3 rounded-xl border-2 border-dashed border-emerald-200 bg-white/80 px-4 py-3 text-left transition-all hover:border-emerald-400 hover:bg-white hover:shadow-sm disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 ring-4 ring-emerald-50 transition-colors group-hover:bg-emerald-200">
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <path d="M12 5v14M5 12h14" strokeLinecap="round" />
                          </svg>
                        </span>
                        <span className="flex min-w-0 flex-1 flex-col sm:flex-row sm:items-baseline sm:gap-2">
                          <span className="text-sm font-semibold text-emerald-900">
                            Add another PR / PRC card
                          </span>
                          <span className="text-xs text-gray-500">
                            For multiple CTS numbers or properties
                          </span>
                        </span>
                      </button>
                    </td>
                  </tr>
                )}

                {uploads.slice(1).map((upload, offsetIndex) => {
                  const index = offsetIndex + 1;
                  return (
                    <DocumentRow
                      key={`fixed-${index}`}
                      serial={String(index + 1)}
                      label={DOCUMENT_NAMES[index] || `Document ${index + 1}`}
                      upload={upload}
                      isReadOnlyMode={isReadOnlyMode}
                      rowClassName={index % 2 === 0 ? "bg-white" : "bg-gray-50/40"}
                      onAttach={() => fixedInputRefs.current[index]?.click()}
                      onClear={handleClearFixed(index)}
                      onPreview={() =>
                        void openPreview(
                          DOCUMENT_NAMES[index] || upload?.name || `Document ${index + 1}`,
                          () => getProjectLibraryFile(index),
                          upload?.url
                        )
                      }
                    />
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Hidden file inputs */}
          {uploads.map((_, index) => (
            <input
              key={`fixed-input-${index}`}
              type="file"
              accept={ACCEPTED_TYPES.join(",")}
              onChange={handleFixedFileChange(index)}
              disabled={isReadOnlyMode}
              ref={(el) => {
                fixedInputRefs.current[index] = el;
              }}
              className="hidden"
            />
          ))}
          {extraPrSlots.map((slot) => (
            <input
              key={`extra-input-${slot.id}`}
              type="file"
              accept={ACCEPTED_TYPES.join(",")}
              onChange={handleExtraFileChange(slot.id)}
              disabled={isReadOnlyMode}
              ref={(el) => {
                extraInputRefs.current[slot.id] = el;
              }}
              className="hidden"
            />
          ))}

          <div className="text-sm text-gray-700">
            {totalAttached} file{totalAttached === 1 ? "" : "s"} attached
            {attachedExtraCount > 0 && (
              <span className="text-gray-500">
                {" "}
                (including {attachedExtraCount} additional PR / PRC)
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
