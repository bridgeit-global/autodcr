"use client";

import { useRouter } from "next/navigation";

type RequiredPage = {
  key: string;
  label: string;
  path: string;
};

interface SaveBeforeSubmitModalProps {
  open: boolean;
  missingPages: RequiredPage[];
  onClose: () => void;
}

export const SaveBeforeSubmitModal = ({
  open,
  missingPages,
  onClose,
}: SaveBeforeSubmitModalProps) => {
  const router = useRouter();

  if (!open || missingPages.length === 0) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full mx-4 p-6 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Save required before submitting</h3>
            <p className="text-sm text-gray-600 mt-1">
              Please save the following pages before you submit your project:
            </p>
          </div>
        </div>
        <ul className="space-y-2">
          {missingPages.map((page) => (
            <li key={page.key}>
              <button
                type="button"
                onClick={() => {
                  router.push(page.path);
                  onClose();
                }}
                className="w-full flex items-center justify-between px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-800 hover:border-sky-500 hover:bg-sky-50"
              >
                <span>{page.label}</span>
                <span className="text-xs text-sky-700 font-medium">Go to page</span>
              </button>
            </li>
          ))}
        </ul>
        <div className="flex justify-end pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 rounded-lg border border-gray-300 hover:bg-gray-50"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};


