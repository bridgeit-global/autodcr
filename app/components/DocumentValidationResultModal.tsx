"use client";

import { getFieldLabel } from "@/app/lib/documentValidation/fieldLabels";

export type DocumentValidationResult = {
  valid: boolean;
  missingFields: string[];
  extracted: Record<string, string | null>;
  documentType: string;
  documentLabel: string;
};

type DocumentValidationResultModalProps = {
  open: boolean;
  result: DocumentValidationResult | null;
  fileName?: string;
  onClose: () => void;
};

export default function DocumentValidationResultModal({
  open,
  result,
  fileName,
  onClose,
}: DocumentValidationResultModalProps) {
  if (!open || !result) return null;

  const extractedEntries = Object.entries(result.extracted);
  const capturedEntries = extractedEntries.filter(
    ([, value]) => value !== null && value.trim() !== ""
  );
  const missingSet = new Set(result.missingFields);

  return (
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="doc-validation-title"
    >
      <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[85vh] flex flex-col border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 shrink-0">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2
                id="doc-validation-title"
                className="text-lg font-semibold text-gray-900"
              >
                Validation Result
              </h2>
              <p className="text-sm text-gray-600 mt-1">
                {result.documentLabel}
                {fileName ? ` · ${fileName}` : ""}
              </p>
            </div>
            <span
              className={`shrink-0 inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${
                result.valid
                  ? "bg-emerald-100 text-emerald-800"
                  : "bg-amber-100 text-amber-900"
              }`}
            >
              {result.valid ? "All fields found" : "Missing fields"}
            </span>
          </div>
        </div>

        <div className="px-6 py-4 overflow-y-auto flex-1 min-h-0 space-y-5">
          {!result.valid && result.missingFields.length > 0 && (
            <section>
              <h3 className="text-sm font-semibold text-red-800 mb-2">
                Missing fields ({result.missingFields.length})
              </h3>
              <ul className="rounded-xl border border-red-200 bg-red-50 divide-y divide-red-100">
                {result.missingFields.map((key) => (
                  <li
                    key={key}
                    className="px-4 py-2.5 text-sm text-red-900 font-medium"
                  >
                    {getFieldLabel(key)}
                    <span className="ml-2 text-xs font-normal text-red-700/80">
                      ({key})
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section>
            <h3 className="text-sm font-semibold text-gray-900 mb-2">
              Extracted fields ({capturedEntries.length} captured
              {missingSet.size > 0 ? `, ${missingSet.size} missing` : ""})
            </h3>
            <div className="rounded-xl border border-gray-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="px-4 py-2.5 text-left font-semibold text-gray-700 w-[40%]">
                      Field
                    </th>
                    <th className="px-4 py-2.5 text-left font-semibold text-gray-700">
                      Value
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {extractedEntries.map(([key, value]) => {
                    const isMissing = missingSet.has(key);
                    return (
                      <tr
                        key={key}
                        className={`border-b border-gray-100 last:border-b-0 ${
                          isMissing ? "bg-red-50/60" : "bg-white"
                        }`}
                      >
                        <td className="px-4 py-2.5 font-medium text-gray-900 align-top">
                          {getFieldLabel(key)}
                        </td>
                        <td
                          className={`px-4 py-2.5 align-top break-words ${
                            isMissing
                              ? "text-red-700 italic"
                              : "text-gray-800"
                          }`}
                        >
                          {isMissing || value === null || value.trim() === ""
                            ? "—"
                            : value}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        </div>

        <div className="px-6 py-4 border-t border-gray-200 flex justify-end shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-lg bg-gradient-to-r from-emerald-800 to-emerald-500 hover:from-emerald-900 hover:to-emerald-600 text-white shadow-sm hover:shadow-md transition-all text-sm font-semibold"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
