"use client";

type DscExpiryModalProps = {
  open: boolean;
  title?: string;
  message: string;
  /** When true (dev), user can continue signing despite expired/invalid DSC. */
  allowContinue?: boolean;
  onContinue: () => void;
  onCancel: () => void;
};

export default function DscExpiryModal({
  open,
  title = "DSC validity expired",
  message,
  allowContinue = false,
  onContinue,
  onCancel,
}: DscExpiryModalProps) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="dsc-expiry-title"
    >
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 border border-gray-200">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-700 text-lg">
            !
          </div>
          <div className="min-w-0">
            <h2 id="dsc-expiry-title" className="text-lg font-semibold text-gray-900">
              {title}
            </h2>
            <p className="text-sm text-gray-600 mt-2">{message}</p>
            {allowContinue ? (
              <p className="text-xs text-amber-700 mt-2">
                Development only: you can continue signing for testing.
              </p>
            ) : null}
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="px-5 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors text-sm font-semibold"
          >
            {allowContinue ? "Cancel" : "OK"}
          </button>
          {allowContinue ? (
            <button
              type="button"
              onClick={onContinue}
              className="px-5 py-2 rounded-lg bg-gradient-to-r from-emerald-800 to-emerald-500 hover:from-emerald-900 hover:to-emerald-600 text-white shadow-sm hover:shadow-md transition-all text-sm font-semibold"
            >
              Continue anyway
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
