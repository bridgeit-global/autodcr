"use client";

import { useRef, useState, useEffect } from "react";
import { loadDraft, saveDraft, markPageSaved, isPageSaved } from "@/app/utils/draftStorage";
import { supabase } from "@/app/utils/supabase";
import {
  deleteProjectLibraryFile,
  getProjectLibraryFile,
  hasAllProjectLibraryFiles,
  saveProjectLibraryFile,
} from "@/app/utils/projectLibraryFiles";
import DocumentPreviewModal from "@/app/components/DocumentPreviewModal";

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
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    if (!ACCEPTED_TYPES.some((type) => file.name.toLowerCase().endsWith(type))) {
      alert("Only PDF files are supported.");
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
        alert("Failed to save document locally. Please try again.");
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

  // Persist uploads draft whenever they change
  useEffect(() => {
    saveDraft("draft-project-library-uploads", uploads);
  }, [uploads]);

  const handleSave = async () => {
    // Require all five documents to be selected (stored locally)
    const ok = await hasAllProjectLibraryFiles(MAX_FILES);
    if (!ok) {
      alert("Please upload all five required documents before saving the Project Library.");
      return;
    }

    console.log("Project Library (local) uploads:", filteredUploads);
    alert("Project library documents saved successfully!");
    markPageSaved("saved-project-library");
    setIsSaved(true);
  };

  return (
    <div className="max-w-6xl mx-auto px-6 pt-8 space-y-6">
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
      <section className="border border-gray-200 rounded-2xl bg-white flex flex-col shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-gray-200 px-6 py-4 bg-white rounded-t-2xl">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Project Library Document</h2>
            <p className="text-sm text-gray-700 mt-1">
              <span className="text-red-600 font-semibold">*Note :</span>{" "}
              There will be common documents used across project and imported automatically to
              application.
            </p>
          </div>
          <div className="w-full md:w-auto md:ml-auto flex flex-col items-start md:items-end gap-2">
            <button
              type="button"
              onClick={handleSave}
              className={`px-6 py-2 rounded-lg font-semibold text-sm shadow transition-colors ${
                isSaved
                  ? "bg-emerald-700 hover:bg-emerald-800 text-white"
                  : "bg-emerald-200 hover:bg-emerald-300 text-emerald-800"
              }`}
            >
              {isSaved ? "Added" : "Add"}
            </button>
          </div>
        </div>

        <div className="p-6 space-y-4 pb-6">
          <div className="border border-gray-200 rounded-2xl overflow-hidden bg-white shadow-sm">
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
                  ref={(el) => {
                    inputRefs.current[index] = el;
                  }}
                          className="hidden"
                        />
                        <button
                          type="button"
                          onClick={() => inputRefs.current[index]?.click()}
                          className="inline-flex items-center justify-center w-9 h-9 rounded-xl border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 leading-none shadow-sm transition-colors"
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
                            className="text-[11px] text-red-600 hover:underline"
                            onClick={handleClearFile(index)}
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
                          className="inline-flex items-center justify-center w-9 h-9 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-emerald-700 hover:text-emerald-900 shadow-sm transition-colors"
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
      </section>
    </div>
  );
}

