"use client";

import { useRef, useState, useEffect } from "react";
import { loadDraft, saveDraft, markPageSaved } from "@/app/utils/draftStorage";

type UploadRecord = {
  id: string;
  name: string;
  url: string;
  uploadedAt: string;
};

const MAX_FILES = 4;
const ACCEPTED_TYPES = [".pdf"];
const createId = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : Math.random().toString(36).slice(2));

export default function ProjectLibraryPage() {
  const [uploads, setUploads] = useState<(UploadRecord | undefined)[]>(
    () => loadDraft<(UploadRecord | undefined)[]>("draft-project-library-uploads", Array(MAX_FILES).fill(undefined))
  );
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const handleFileChange = (index: number) => (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    if (!ACCEPTED_TYPES.some((type) => file.name.toLowerCase().endsWith(type))) {
      alert("Only PDF files are supported.");
      event.target.value = "";
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    const record: UploadRecord = {
      id: createId(),
      name: file.name,
      url: objectUrl,
      uploadedAt: new Date().toISOString(),
    };

    setUploads((prev) => {
      const next = [...prev];
      const existing = next[index];
      if (existing) {
        URL.revokeObjectURL(existing.url);
      }
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

  const handleSave = () => {
    // uploads are already in state and mirrored to localStorage
    console.log("Project Library uploads:", filteredUploads);
    alert("Project library documents saved successfully!");
    markPageSaved("saved-project-library");
  };

  return (
    <div className="max-w-6xl mx-auto px-6 pt-8 space-y-6">
      <section className="border border-black rounded-lg bg-white flex flex-col max-h-[70vh] overflow-hidden">
        <div className="sticky top-0 z-10 flex flex-wrap items-start justify-between gap-4 border-b border-black px-6 py-4 bg-white">
          <div>
            <h2 className="text-xl font-bold text-black">Project Library</h2>
            <p className="text-sm text-gray-700 mt-1">
              Upload up to {MAX_FILES} PDF documents from your system. Use the view action to open each file in a new tab.
            </p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <div className="text-xs text-gray-500 border border-gray-300 rounded-md px-3 py-2 bg-gray-50">
              Supported format: PDF. File size depends on your browser limits.
            </div>
            <button
              type="button"
              onClick={handleSave}
              className="bg-sky-700 hover:bg-sky-800 text-white px-6 py-2 rounded-lg font-semibold text-sm shadow transition-colors"
            >
              Save
            </button>
          </div>
        </div>

        <div className="p-6 space-y-4 overflow-y-auto pb-6">
          <div className="grid grid-cols-1 gap-3 max-w-3xl mx-auto">
            {uploads.map((upload, index) => (
              <div
                key={index}
                className="border border-gray-200 rounded-lg px-4 py-3 bg-gray-50 space-y-2"
              >
                <div className="flex justify-between items-center">
                  <span className="text-sm font-semibold text-gray-700">Slot {index + 1}</span>
                  {upload && (
                    <button type="button" className="text-xs text-red-600 hover:underline" onClick={handleClearFile(index)}>
                      Clear
                    </button>
                  )}
                </div>
                <input
                  type="file"
                  accept={ACCEPTED_TYPES.join(",")}
                  onChange={handleFileChange(index)}
                  ref={(el) => {
                    inputRefs.current[index] = el;
                  }}
                  className="block w-full text-sm text-gray-600 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:bg-sky-50 file:text-sky-700 hover:file:bg-sky-100"
                />
                {upload && (
                  <div className="text-xs text-gray-600 space-y-1">
                    <p className="font-medium text-black truncate">{upload.name}</p>
                    <p>Uploaded {new Date(upload.uploadedAt).toLocaleString()}</p>
                  </div>
                )}
                {upload && (
                  <div className="flex items-center gap-3 border-t border-gray-200 pt-3">
                    <a
                      href={upload.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sky-700 font-semibold hover:underline text-sm"
                    >
                      View
                    </a>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

