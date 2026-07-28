"use client";

type DscPanVerifyModalProps = {
  open: boolean;
  isMatch: boolean;
  pan: string;
  signerLabel?: string;
  /** When true, mismatch cannot continue (owner on-behalf DSC flow). */
  requireMatch?: boolean;
  /** Possessive phrase before “PAN”, e.g. "your" or "the owner's". */
  panPossessive?: string;
  onContinue: () => void;
  onCancel: () => void;
};

export default function DscPanVerifyModal({
  open,
  isMatch,
  pan,
  signerLabel,
  requireMatch = false,
  panPossessive = "your",
  onContinue,
  onCancel,
}: DscPanVerifyModalProps) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="dsc-pan-verify-title"
    >
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 border border-gray-200">
        {isMatch ? (
          <>
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 text-lg">
                ✓
              </div>
              <div className="min-w-0">
                <h2
                  id="dsc-pan-verify-title"
                  className="text-lg font-semibold text-gray-900"
                >
                  Valid DSC
                </h2>
                <p className="text-sm text-gray-600 mt-2">
                  This certificate matches {panPossessive} PAN{" "}
                  <span className="font-mono font-medium text-gray-800">{pan}</span>.
                  You can continue signing the application.
                </p>
                {signerLabel ? (
                  <p className="text-xs text-gray-500 mt-2 truncate" title={signerLabel}>
                    Signer: {signerLabel}
                  </p>
                ) : null}
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={onContinue}
                className="px-5 py-2 rounded-lg bg-gradient-to-r from-emerald-800 to-emerald-500 hover:from-emerald-900 hover:to-emerald-600 text-white shadow-sm hover:shadow-md transition-all text-sm font-semibold"
              >
                Continue signing
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-700 text-lg">
                !
              </div>
              <div className="min-w-0">
                <h2
                  id="dsc-pan-verify-title"
                  className="text-lg font-semibold text-gray-900"
                >
                  PAN does not match
                </h2>
                <p className="text-sm text-gray-600 mt-2">
                  {requireMatch ? (
                    <>
                      This DSC was not issued for {panPossessive} PAN{" "}
                      <span className="font-mono font-medium text-gray-800">{pan}</span>.
                      Plug in the owner&apos;s DSC token and try again.
                    </>
                  ) : (
                    <>
                      This DSC was not issued for {panPossessive} PAN{" "}
                      <span className="font-mono font-medium text-gray-800">{pan}</span>.
                      You can cancel and try with your own token, or continue anyway.
                    </>
                  )}
                </p>
                {signerLabel ? (
                  <p className="text-xs text-gray-500 mt-2 truncate" title={signerLabel}>
                    Signer: {signerLabel}
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
                Cancel
              </button>
              {!requireMatch ? (
                <button
                  type="button"
                  onClick={onContinue}
                  className="px-5 py-2 rounded-lg bg-gradient-to-r from-emerald-800 to-emerald-500 hover:from-emerald-900 hover:to-emerald-600 text-white shadow-sm hover:shadow-md transition-all text-sm font-semibold"
                >
                  Continue anyway
                </button>
              ) : null}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
