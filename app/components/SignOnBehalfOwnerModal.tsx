"use client";

type SignOnBehalfOwnerModalProps = {
  open: boolean;
  onContinue: () => void;
  onCancel: () => void;
};

export default function SignOnBehalfOwnerModal({
  open,
  onContinue,
  onCancel,
}: SignOnBehalfOwnerModalProps) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="sign-on-behalf-title"
    >
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 border border-gray-200">
        <h2 id="sign-on-behalf-title" className="text-lg font-semibold text-gray-900">
          Sign on behalf of the owner?
        </h2>
        <p className="text-sm text-gray-600 mt-3">
          You are about to complete the owner signature step using the{" "}
          <span className="font-medium text-gray-800">owner&apos;s DSC token</span>. Plug in the
          owner&apos;s token — the certificate must match the owner&apos;s registered PAN. Your own
          architect signature on the acceptance letter will still be required afterward.
        </p>
        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="px-5 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors text-sm font-semibold"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onContinue}
            className="px-5 py-2 rounded-lg bg-gradient-to-r from-emerald-800 to-emerald-500 hover:from-emerald-900 hover:to-emerald-600 text-white shadow-sm hover:shadow-md transition-all text-sm font-semibold"
          >
            Continue with owner&apos;s DSC
          </button>
        </div>
      </div>
    </div>
  );
}
