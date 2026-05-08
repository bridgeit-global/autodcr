"use client";

/**
 * Reusable DSC signing modal that drives the bridge-poc signing flow
 * (PING / LIST_SLOTS / LIST_CERTS / SIGN_PDF_*) for any PDF blob produced
 * elsewhere in the app (e.g. an application preview PDF generated from the
 * draft / application creation flow).
 *
 * Caller responsibilities:
 *   - Generate the PDF and pass it as `pdfBlob` (or pass `getPdfBlob` and
 *     this modal will resolve the blob lazily after it opens).
 *   - Decide what to do with the signed blob via `onSigned` (typically
 *     download or replace the preview).
 *
 * This is a demo wrapper; it does not implement visible DSC stamp placement.
 */

import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { createPortal } from "react-dom";

import CustomSelect from "@/app/components/CustomSelect";
import { base64ToBlob } from "@/app/lib/bridge/pdfChunker";
import { useSigningStore } from "@/app/lib/bridge/signingStore";

const MAX_SIGN_PDF_BLOB_SIZE = 8 * 1024 * 1024;

type Props = {
  open: boolean;
  onClose: () => void;
  /** Pre-generated PDF blob to sign. Mutually exclusive with `getPdfBlob`. */
  pdfBlob?: Blob | null;
  /**
   * Async generator invoked once the modal opens. Useful when the PDF is
   * expensive to produce (e.g. html2canvas + jsPDF) and we don't want to
   * generate it until the user actually intends to sign.
   */
  getPdfBlob?: () => Promise<Blob>;
  /** File name forwarded to the native host (SIGN_PDF_START.fileName). */
  fileName?: string;
  /** Modal title / heading. */
  title?: string;
  /** Invoked once the signed PDF is ready (in addition to in-modal download). */
  onSigned?: (signedBlob: Blob, fileName: string) => void;
};

export default function BridgeSignModal({
  open,
  onClose,
  pdfBlob,
  getPdfBlob,
  fileName,
  title = "Sign Document with DSC",
  onSigned,
}: Props) {
  const {
    dscStatus,
    dscCertificates,
    selectedDsc,
    dscPin,
    dscError,
    dscLoading,
    isSigning,
    isPingingConnector,
    connectorPingMessage,
    setSelectedDsc,
    setDscPin,
    setDscError,
    initialize,
    checkConnectorHealth,
    signCurrentPdf,
    cancelPending,
    reset,
  } = useSigningStore();

  const [resolvedBlob, setResolvedBlob] = useState<Blob | null>(null);
  const [blobError, setBlobError] = useState<string | null>(null);
  const [isResolvingBlob, setIsResolvingBlob] = useState(false);
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [signedFileName, setSignedFileName] = useState<string>("signed.pdf");

  useEffect(() => {
    if (!open) return;
    void initialize();
    return () => {
      cancelPending();
    };
  }, [open, initialize, cancelPending]);

  useEffect(() => {
    if (!open) {
      setBlobError(null);
      setResolvedBlob(null);
      return;
    }

    if (pdfBlob) {
      setResolvedBlob(pdfBlob);
      setBlobError(null);
      return;
    }

    if (!getPdfBlob) {
      setBlobError("No PDF was supplied to sign.");
      return;
    }

    let cancelled = false;
    setIsResolvingBlob(true);
    setBlobError(null);
    setResolvedBlob(null);
    (async () => {
      try {
        const blob = await getPdfBlob();
        if (cancelled) return;
        setResolvedBlob(blob);
      } catch (error: unknown) {
        if (cancelled) return;
        const message = error instanceof Error ? error.message : "Failed to generate PDF.";
        setBlobError(message);
      } finally {
        if (!cancelled) setIsResolvingBlob(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, pdfBlob, getPdfBlob]);

  useEffect(
    () => () => {
      if (signedUrl) URL.revokeObjectURL(signedUrl);
    },
    [signedUrl]
  );

  useEffect(() => {
    if (!open) {
      if (signedUrl) {
        URL.revokeObjectURL(signedUrl);
        setSignedUrl(null);
      }
      reset();
    }
  }, [open, reset, signedUrl]);

  const blobTooLarge = Boolean(resolvedBlob && resolvedBlob.size > MAX_SIGN_PDF_BLOB_SIZE);

  const canSign =
    Boolean(dscStatus?.connected) &&
    Boolean(selectedDsc) &&
    Boolean(resolvedBlob) &&
    !isSigning &&
    !blobTooLarge;

  const handleSign = async () => {
    if (!resolvedBlob) {
      setDscError("No PDF available to sign yet.");
      return;
    }
    if (blobTooLarge) {
      setDscError("PDF is too large for connector transport. Please reduce size and retry.");
      return;
    }

    const result = await signCurrentPdf(resolvedBlob, fileName || "generated.pdf");
    if (!result?.signedPdfBase64) return;

    const signedBlob = base64ToBlob(result.signedPdfBase64, "application/pdf");
    if (signedUrl) URL.revokeObjectURL(signedUrl);
    const url = URL.createObjectURL(signedBlob);
    setSignedUrl(url);
    const baseName = (fileName || "generated.pdf").replace(/\.pdf$/i, "");
    const signedName = `${baseName}-signed.pdf`;
    setSignedFileName(signedName);
    onSigned?.(signedBlob, signedName);
  };

  const handleClose = () => {
    if (isSigning) return;
    onClose();
  };

  if (!open) return null;
  if (typeof window === "undefined") return null;

  const certOptions = dscCertificates.map((cert) => ({
    value: `${cert.slotIndex}-${cert.certIndex}`,
    label: cert.cn || cert.label || `Slot ${cert.slotIndex} · Cert ${cert.certIndex + 1}`,
  }));

  const selectedCertValue = selectedDsc
    ? `${selectedDsc.slotIndex}-${selectedDsc.certIndex}`
    : "";

  const modal = (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={handleClose}
        >
          <motion.div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden border border-gray-200"
            initial={{ y: -20, opacity: 0, scale: 0.98 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: -20, opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.2 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200">
              <div>
                <h3 className="text-base font-semibold text-gray-900">{title}</h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  Bridge POC · PING → LIST_SLOTS → LIST_CERTS → SIGN_PDF_START / CHUNK / END
                </p>
              </div>
              <button
                type="button"
                onClick={handleClose}
                disabled={isSigning}
                className="h-9 w-9 rounded-lg hover:bg-gray-100 text-gray-700 transition-colors flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed"
                aria-label="Close signing modal"
              >
                <span className="text-2xl leading-none">×</span>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4 bg-gray-50">
              {dscStatus && (
                <div
                  className={`rounded-lg px-3 py-2 text-sm border ${
                    dscStatus.connected
                      ? "bg-emerald-50 border-emerald-200 text-emerald-900"
                      : "bg-red-50 border-red-200 text-red-900"
                  }`}
                >
                  <p className="font-semibold">
                    Status: {dscStatus.connected ? "Connected" : "Not connected"}
                  </p>
                  <p className="text-xs">{dscStatus.message}</p>
                </div>
              )}

              {connectorPingMessage && (
                <div
                  className={`rounded-lg border px-3 py-2 text-xs ${
                    dscStatus?.connected
                      ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                      : "border-amber-200 bg-amber-50 text-amber-900"
                  }`}
                >
                  {connectorPingMessage}
                </div>
              )}

              <div className="rounded-xl border border-gray-200 bg-white p-4 space-y-3">
                <p className="text-sm font-medium text-gray-800">Document</p>
                {isResolvingBlob ? (
                  <p className="text-xs text-gray-600">Generating PDF for signing...</p>
                ) : blobError ? (
                  <p className="text-xs text-red-700">{blobError}</p>
                ) : resolvedBlob ? (
                  <div className="text-xs text-gray-700">
                    <p>
                      <span className="font-medium">File:</span>{" "}
                      {fileName || "generated.pdf"}
                    </p>
                    <p>
                      <span className="font-medium">Size:</span>{" "}
                      {(resolvedBlob.size / 1024).toFixed(1)} KB
                    </p>
                    {blobTooLarge && (
                      <p className="text-red-700 mt-1">
                        PDF exceeds connector transport limit (8 MB). Reduce size and retry.
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-gray-600">No PDF supplied yet.</p>
                )}
              </div>

              <div className="rounded-xl border border-gray-200 bg-white p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-gray-800">DSC Certificate</p>
                  <button
                    type="button"
                    onClick={() => void initialize()}
                    disabled={dscLoading || isSigning}
                    className="text-xs font-medium text-blue-600 hover:text-blue-700 disabled:text-gray-400 disabled:cursor-not-allowed"
                  >
                    {dscLoading ? "Loading..." : "Reload slots / certs"}
                  </button>
                </div>

                <CustomSelect
                  value={selectedCertValue}
                  onChange={(val) => {
                    if (val === "") {
                      setSelectedDsc(null);
                    } else {
                      const [slot, cert] = val.split("-").map(Number);
                      setSelectedDsc({ slotIndex: slot, certIndex: cert });
                    }
                  }}
                  options={certOptions}
                  placeholder={
                    dscLoading
                      ? "Loading certificates..."
                      : certOptions.length === 0
                        ? "No DSC certificates detected"
                        : "Select DSC certificate"
                  }
                  disabled={dscLoading || isSigning || certOptions.length === 0}
                />

                <div>
                  <label className="text-xs font-medium text-gray-600 block mb-1">
                    DSC PIN (optional — host may still prompt)
                  </label>
                  <input
                    type="password"
                    value={dscPin}
                    onChange={(e) => setDscPin(e.target.value)}
                    disabled={isSigning}
                    placeholder="Enter DSC PIN"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-black focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:bg-gray-100"
                  />
                </div>

                {dscError && (
                  <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-900">
                    {dscError}
                  </div>
                )}
              </div>

              {signedUrl && (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 space-y-2">
                  <p className="text-sm font-semibold text-emerald-900">
                    Signed PDF ready
                  </p>
                  <p className="text-xs text-emerald-900">
                    The native host returned a signed PDF. Use the download link below to
                    save it locally.
                  </p>
                  <a
                    href={signedUrl}
                    download={signedFileName}
                    className="inline-flex items-center rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 transition-colors"
                  >
                    Download {signedFileName}
                  </a>
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2 px-5 py-3 border-t border-gray-200 bg-white">
              <button
                type="button"
                onClick={() => void checkConnectorHealth()}
                disabled={isPingingConnector || isSigning}
                className="px-3 py-2 rounded-lg border border-blue-200 bg-white text-sm font-medium text-blue-700 hover:bg-blue-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isPingingConnector ? "Checking..." : "Check Connector"}
              </button>
              <button
                type="button"
                onClick={handleClose}
                disabled={isSigning}
                className="px-3 py-2 rounded-lg border border-gray-200 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => void handleSign()}
                disabled={!canSign}
                className="px-4 py-2 rounded-lg bg-emerald-600 text-sm font-semibold text-white hover:bg-emerald-700 disabled:bg-emerald-300 disabled:cursor-not-allowed transition-colors"
              >
                {isSigning ? "Signing..." : "Sign with DSC"}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  return createPortal(modal, document.body);
}
