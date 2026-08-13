"use client";

import { useRef, useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { loadDraft, saveDraft, markPageSaved, isPageSaved } from "@/app/utils/draftStorage";
import { supabase } from "@/app/utils/supabase";
import { useProjectData } from "@/app/hooks/useProjectData";
import {
  deleteProjectLibraryFile,
  getProjectLibraryFile,
  hasAllProjectLibraryFiles,
  saveProjectLibraryFile,
} from "@/app/utils/projectLibraryFiles";
import { useDashboardAlertModal } from "@/app/dashboard/context/DashboardAlertModalContext";
import DocumentPreviewModal from "@/app/components/DocumentPreviewModal";
import { BTN_PRIMARY, BTN_SAVE_UNSAVED } from "@/app/utils/buttonClasses";

type UploadRecord = {
  id: string;
  name: string;
  url: string;
  uploadedAt: string;
  path: string;
};

const DOCUMENT_NAMES = [
  "Appointment letter for Licensed Architect / Licensed Surveyor / Licensed Plumber from Owner/ CA to Owner along with copy of valid License",
  "D.P. remark",
  "R.L remark",
  "Appointment letter of structural/consulting engineer",
  "Appointment letter of Architects/Licensed surveyor",
];

const MAX_FILES = DOCUMENT_NAMES.length;
const ACCEPTED_TYPES = [".pdf"];
const createId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);

export default function ProjectLibraryPage() {
  const searchParams = useSearchParams();
  const isReadOnlyMode = searchParams.get("mode") === "readonly";
  const { isEditMode, isLoading, projectData } = useProjectData();
  const { showAlert } = useDashboardAlertModal();
  const [uploads, setUploads] = useState<(UploadRecord | undefined)[]>(() => {
    const saved = loadDraft<(UploadRecord | undefined)[]>(
      "draft-project-library-uploads",
      Array(MAX_FILES).fill(undefined)
    );

    // Ensure we always have exactly MAX_FILES slots (e.g., after increasing from 4 to 5)
    if (saved.length < MAX_FILES) {
      return [...saved, ...Array(MAX_FILES - saved.length).fill(undefined)];
    }
    if (saved.length > MAX_FILES) {
      return saved.slice(0, MAX_FILES);
    }
    return saved;
  });
  const [isSaved, setIsSaved] = useState(() => isPageSaved("saved-project-library"));
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewTitle, setPreviewTitle] = useState<string | undefined>(undefined);
  const [previewBlobUrl, setPreviewBlobUrl] = useState<string | null>(null);

  const handleFileChange =
    (index: number) => async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (isReadOnlyMode) return;
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    if (!ACCEPTED_TYPES.some((type) => file.name.toLowerCase().endsWith(type))) {
      showAlert({
        title: "Invalid file type",
        message: "Only PDF files are supported.",
      });
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

      // Save locally (IndexedDB) – actual upload happens on final project submission
      try {
        await saveProjectLibraryFile(index, file);
      } catch (e: any) {
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
        url: localUrl, // local preview until submission uploads to Supabase
      uploadedAt: new Date().toISOString(),
        path: `${safeDocName}-${index + 1}.${extension}`, // final path will be constructed at submit-time using project id
    };

    setUploads((prev) => {
      const next = [...prev];
      next[index] = record;
      return next;
    });
  };

  const handleClearFile = (index: number) => () => {
    if (isReadOnlyMode) return;
    setUploads((prev) => {
      const next = [...prev];
      const existing = next[index];
      if (existing) {
        URL.revokeObjectURL(existing.url);
      }
      next[index] = undefined;
      return next;
    });

    // Remove from local IndexedDB store
    deleteProjectLibraryFile(index).catch((e) => console.error("Failed to delete local file:", e));

    const input = inputRefs.current[index];
    if (input) {
      input.value = "";
    }
  };

  const filteredUploads = uploads.filter((upload): upload is UploadRecord => Boolean(upload));

  // Fetch and populate data when in edit mode
  useEffect(() => {
    if (isEditMode && projectData && !isLoading) {
      const projectLibrary = projectData.project_library || {};
      const uploadsData = (projectLibrary.uploads || []) as (UploadRecord | undefined)[];
      
      if (uploadsData.length > 0) {
        const paddedUploads = [...uploadsData];
        while (paddedUploads.length < MAX_FILES) {
          paddedUploads.push(undefined);
        }
        setUploads(paddedUploads.slice(0, MAX_FILES));
        saveDraft("draft-project-library-uploads", paddedUploads.slice(0, MAX_FILES));
        markPageSaved("saved-project-library");
        setIsSaved(true);
      }
    }
  }, [isEditMode, projectData, isLoading]);

  // Persist uploads draft whenever they change
  useEffect(() => {
    saveDraft("draft-project-library-uploads", uploads);
  }, [uploads]);

  const handleSave = async () => {
    if (isReadOnlyMode) return;
    // Require all five documents to be selected (stored locally)
    const ok = await hasAllProjectLibraryFiles(MAX_FILES);
    if (!ok) {
      showAlert({
        title: "Project library",
        message:
          "Please upload all five required documents before saving the Project Library.",
      });
      return;
    }

    console.log("Project Library (local) uploads:", filteredUploads);
    showAlert({
      title: "Project library",
      message: "Project library documents saved successfully!",
    });
    markPageSaved("saved-project-library");
    saveDraft("dirty-project-library", false);
    saveDraft("saved-project-library-snapshot", uploads);
    setIsSaved(true);
  };

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
            Common documents used across the project are imported automatically into applications.
          </p>
          <button
            type="button"
            onClick={handleSave}
            disabled={isReadOnlyMode}
            className={`rounded-lg px-5 py-2 text-sm font-semibold ${
              isSaved ? BTN_PRIMARY : BTN_SAVE_UNSAVED
            } ${isReadOnlyMode ? "cursor-not-allowed opacity-70" : ""}`}
          >
            {isSaved ? "Saved" : "Save"}
          </button>
        </div>

        <div className="space-y-4">
          <div
            className={
              isReadOnlyMode
                ? "[&_input]:cursor-not-allowed [&_textarea]:cursor-not-allowed [&_select]:cursor-not-allowed"
                : ""
            }
          >
          <div className="overflow-hidden rounded-xl border border-gray-100">
            <table className="min-w-full text-sm text-left text-gray-900">
              <thead className="bg-gray-50 border-b border-gray-200 text-xs uppercase text-gray-600">
                <tr>
                  <th className="px-3 py-3 border-r border-gray-200 w-20">Sr. No.</th>
                  <th className="px-3 py-3 border-r border-gray-200">Document&apos;s Name</th>
                  <th className="px-3 py-3 border-r border-gray-200 w-32 text-center">
                    Attach Here
                  </th>
                  <th className="px-3 py-3 w-24 text-center">Preview</th>
                </tr>
              </thead>
              <tbody>
            {uploads.map((upload, index) => (
                  <tr
                key={index}
                    className={`border-b border-gray-200 last:border-b-0 ${
                      index % 2 === 0 ? "bg-white" : "bg-gray-50/40"
                    }`}
              >
                    <td className="px-3 py-3 border-r border-gray-200 align-top text-gray-700">{index + 1}</td>
                    <td className="px-3 py-3 border-r border-gray-200 align-top">
                      {DOCUMENT_NAMES[index] || `Document ${index + 1}`}
                    </td>
                    <td className="px-3 py-3 border-r border-gray-200 align-top">
                      <div className="flex flex-col items-center gap-1">
                        {/* Hidden file input; triggered by the icon button */}
                <input
                  type="file"
                  accept={ACCEPTED_TYPES.join(",")}
                  onChange={handleFileChange(index)}
                  disabled={isReadOnlyMode}
                  ref={(el) => {
                    inputRefs.current[index] = el;
                  }}
                          className="hidden"
                        />
                        <button
                          type="button"
                          onClick={() => inputRefs.current[index]?.click()}
                          disabled={isReadOnlyMode}
                          className={`inline-flex items-center justify-center w-9 h-9 rounded-lg border border-brand-blue/20 bg-blue-50 hover:bg-blue-100 text-brand-blue leading-none shadow-sm transition-colors ${
                            isReadOnlyMode ? "cursor-not-allowed opacity-70" : ""
                          }`}
                          aria-label="Attach document"
                        >
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 24 24"
                            className="w-5 h-5"
                            fill="currentColor"
                          >
                            <path d="M3 7a2 2 0 0 1 2-2h5.172a2 2 0 0 1 1.414.586l1.828 1.828H19a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z" />
                          </svg>
                        </button>
                {upload && (
                          <button
                            type="button"
                            className={`text-[11px] text-red-600 hover:underline ${
                              isReadOnlyMode ? "cursor-not-allowed opacity-70" : ""
                            }`}
                            onClick={handleClearFile(index)}
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
                          onClick={() => {
                            (async () => {
                              setPreviewTitle(DOCUMENT_NAMES[index] || upload.name || `Document ${index + 1}`);

                              // Always recreate a fresh blob URL from IndexedDB for reliable preview
                              try {
                                const local = await getProjectLibraryFile(index);
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

                              // Fallback to saved URL (might be public URL after submission)
                              setPreviewUrl(upload.url);
                              setPreviewOpen(true);
                            })();
                          }}
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
            ))}
              </tbody>
            </table>
          </div>
          <div className="text-sm text-gray-700 mt-2">Total Number : {MAX_FILES}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

