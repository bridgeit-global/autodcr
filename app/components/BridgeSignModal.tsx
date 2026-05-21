"use client";

/**
 * DSC signing modal: PING → LIST_SLOTS → pick slot → LIST_CERTS → pick cert →
 * optional visible stamp on PDF preview → SIGN_PDF_* (chunked).
 */

import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { createPortal } from "react-dom";

import CustomSelect from "@/app/components/CustomSelect";
import DscStampPdfViewer, { StampRect } from "@/app/components/DscStampPdfViewer";
import { base64ToBlob } from "@/app/lib/bridge/pdfChunker";
import { CertInfo } from "@/app/lib/bridge/protocol";
import { useStepwiseSigning } from "@/app/lib/bridge/useStepwiseSigning";

const MAX_SIGN_PDF_BLOB_SIZE = 8 * 1024 * 1024;

const CN_RE = /CN\s*=\s*([^,]+)/i;

function certDisplayLabel(cert: CertInfo): string {
  if (cert.subject) {
    const match = CN_RE.exec(cert.subject);
    if (match?.[1]) return match[1].trim();
    return cert.subject.length > 72 ? `${cert.subject.slice(0, 69)}…` : cert.subject;
  }
  if (cert.label?.trim()) return cert.label.trim();
  const id = cert.id;
  if (id.length > 28) return `${id.slice(0, 12)}…${id.slice(-10)}`;
  return id || "Certificate";
}

function extractCommonName(subject?: string): string | undefined {
  if (!subject) return undefined;
  const match = subject.match(/CN\s*=\s*([^,]+)/i);
  return match?.[1]?.trim();
}

function resolveSignerLabel(cert: CertInfo | undefined): string {
  if (!cert) return "AutoDCR Signer";
  return (
    extractCommonName(cert.subject) ||
    cert.label?.trim() ||
    cert.subject?.trim() ||
    `Cert ${cert.id.slice(0, 8)}`
  );
}

type Props = {
  open: boolean;
  onClose: () => void;
  pdfBlob?: Blob | null;
  getPdfBlob?: () => Promise<Blob>;
  fileName?: string;
  title?: string;
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
    slots,
    selectedSlotId,
    certsForSelectedSlot,
    selectedCertId,
    pin,
    error,
    isLoadingSlots,
    isLoadingCerts,
    isSigning,
    isPingingConnector,
    connectorPingMessage,
    setSelectedSlotId,
    setSelectedCertId,
    setPin,
    setError,
    initialize,
    reloadSlotsAndCerts,
    checkConnectorHealth,
    signCurrentPdf,
    cancelPending,
    reset,
  } = useStepwiseSigning();

  const [resolvedBlob, setResolvedBlob] = useState<Blob | null>(null);
  const [blobError, setBlobError] = useState<string | null>(null);
  const [isResolvingBlob, setIsResolvingBlob] = useState(false);
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [signedFileName, setSignedFileName] = useState<string>("signed.pdf");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [stampRect, setStampRect] = useState<StampRect | null>(null);

  const dscBusy = isLoadingSlots || isLoadingCerts;

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
      } catch (err: unknown) {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : "Failed to generate PDF.";
        setBlobError(message);
      } finally {
        if (!cancelled) setIsResolvingBlob(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, pdfBlob, getPdfBlob]);

  useEffect(() => {
    if (!resolvedBlob || !open) {
      setPreviewUrl(null);
      setStampRect(null);
      return;
    }
    const url = URL.createObjectURL(resolvedBlob);
    setPreviewUrl(url);
    setStampRect(null);
    return () => {
      URL.revokeObjectURL(url);
    };
  }, [resolvedBlob, open]);

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
    selectedSlotId !== null &&
    Boolean(selectedCertId) &&
    Boolean(resolvedBlob) &&
    !isSigning &&
    !blobTooLarge;

  const handleSign = async () => {
    if (!resolvedBlob) {
      setError("No PDF available to sign yet.");
      return;
    }
    if (blobTooLarge) {
      setError("PDF is too large for connector transport. Please reduce size and retry.");
      return;
    }

    const cert = certsForSelectedSlot.find((c) => c.id === selectedCertId);
    const stamp =
      stampRect !== null
        ? {
            pageIndex: stampRect.pageIndex,
            pdfX: stampRect.pdfX,
            pdfY: stampRect.pdfY,
            pdfWidth: stampRect.pdfWidth,
            pdfHeight: stampRect.pdfHeight,
            signerLabel: resolveSignerLabel(cert),
            signedAt: new Date(),
          }
        : undefined;

    const result = await signCurrentPdf(resolvedBlob, {
      fileName: fileName || "generated.pdf",
      stamp,
    });
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

  const slotOptions = slots.map((s) => ({
    value: String(s.slotId),
    label: `Slot ${s.slotId} · ${s.label || s.description || "Token"}`,
  }));

  const selectedSlotValue = selectedSlotId !== null ? String(selectedSlotId) : "";

  const certOptions = certsForSelectedSlot.map((c) => ({
    value: c.id,
    label: certDisplayLabel(c),
  }));

  const certPlaceholder =
    selectedSlotId === null
      ? "Select a slot first"
      : isLoadingCerts
        ? "Loading certificates..."
        : certOptions.length === 0
          ? "No certificates in this slot"
          : "Select certificate";

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
            className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden border border-gray-200"
            initial={{ y: -20, opacity: 0, scale: 0.98 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: -20, opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.2 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200 shrink-0">
              <div>
                <h3 className="text-base font-semibold text-gray-900">{title}</h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  PING → LIST_SLOTS → LIST_CERTS → optional stamp → SIGN_PDF_START / CHUNK / END
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

            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4 bg-gray-50 min-h-0">
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
                  <div className="text-xs text-gray-700 space-y-1">
                    <p>
                      <span className="font-medium">File:</span> {fileName || "generated.pdf"}
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

                {previewUrl && !blobError && resolvedBlob && !blobTooLarge ? (
                  <DscStampPdfViewer
                    key={previewUrl}
                    fileUrl={previewUrl}
                    stampRect={stampRect}
                    onStampChange={setStampRect}
                    disabled={isSigning}
                  />
                ) : null}
              </div>

              <div className="rounded-xl border border-gray-200 bg-white p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-gray-800">DSC slot &amp; certificate</p>
                  <button
                    type="button"
                    onClick={() => void reloadSlotsAndCerts()}
                    disabled={dscBusy || isSigning}
                    className="text-xs font-medium text-blue-600 hover:text-blue-700 disabled:text-gray-400 disabled:cursor-not-allowed"
                  >
                    {dscBusy ? "Loading..." : "Reload slots / certs"}
                  </button>
                </div>

                <div>
                  <label className="text-xs font-medium text-gray-600 block mb-1">PKCS#11 slot</label>
                  <CustomSelect
                    value={selectedSlotValue}
                    onChange={(val) => {
                      if (val === "") setSelectedSlotId(null);
                      else setSelectedSlotId(Number(val));
                    }}
                    options={slotOptions}
                    placeholder={
                      isLoadingSlots ? "Loading slots..." : slotOptions.length === 0 ? "No slots" : "Select slot"
                    }
                    disabled={isLoadingSlots || isSigning || slotOptions.length === 0}
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-gray-600 block mb-1">Certificate</label>
                  <CustomSelect
                    value={selectedCertId}
                    onChange={(val) => setSelectedCertId(val)}
                    options={certOptions}
                    placeholder={certPlaceholder}
                    disabled={
                      selectedSlotId === null || isLoadingCerts || isSigning || certOptions.length === 0
                    }
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-gray-600 block mb-1">
                    DSC PIN (optional — host may still prompt)
                  </label>
                  <input
                    type="password"
                    value={pin}
                    onChange={(e) => setPin(e.target.value)}
                    disabled={isSigning}
                    placeholder="Enter DSC PIN"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-black focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:bg-gray-100"
                  />
                </div>

                {error && (
                  <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-900">
                    {error}
                  </div>
                )}
              </div>

              {signedUrl && (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 space-y-2">
                  <p className="text-sm font-semibold text-emerald-900">Signed PDF ready</p>
                  <p className="text-xs text-emerald-900">
                    The native host returned a signed PDF. Use the download link below to save it
                    locally.
                  </p>
                  <a
                    href={signedUrl}
                    download={signedFileName}
                    className="inline-flex items-center rounded-lg bg-gradient-to-r from-emerald-800 to-emerald-500 hover:from-emerald-900 hover:to-emerald-600 text-white shadow-sm hover:shadow-md transition-all px-3 py-1.5 text-xs font-semibold"
                  >
                    Download {signedFileName}
                  </a>
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2 px-5 py-3 border-t border-gray-200 bg-white shrink-0">
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
                className="px-4 py-2 rounded-lg bg-gradient-to-r from-emerald-800 to-emerald-500 hover:from-emerald-900 hover:to-emerald-600 text-white shadow-sm hover:shadow-md transition-all text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
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
