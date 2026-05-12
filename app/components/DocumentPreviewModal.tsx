"use client";

import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { motion, AnimatePresence } from "framer-motion";
import { createPortal } from "react-dom";

const PlainPDFViewer = dynamic(() => import("./PlainPDFViewer"), {
  ssr: false,
}) as React.ComponentType<{ fileUrl: string }>;

const BridgeSignModal = dynamic(() => import("./BridgeSignModal"), {
  ssr: false,
});

type DocumentPreviewModalProps = {
  open: boolean;
  onClose: () => void;
  /** When provided, renders a PDF preview via PlainPDFViewer. */
  fileUrl?: string | null;
  /**
   * When provided (and `fileUrl` is not), renders the HTML directly in an
   * iframe — gives crisp native text and instant load. Use this for templates
   * that have a clean HTML source (e.g. the Architect appointment letter).
   */
  htmlContent?: string | null;
  /** Optional debug: token -> resolved value map used for replacement. */
  fieldMapping?: Record<string, string | undefined> | null;
  title?: string;
  /** HTML preview only: persist generated PDF (e.g. upload + DB update). */
  onSave?: () => void | Promise<void>;
  isSaving?: boolean;
  saveDisabled?: boolean;
  /** After a successful save for this preview — shows “Saved” instead of Save. */
  saveCompleted?: boolean;
  /** Shown inside the modal so save errors/success are visible over the backdrop. */
  saveFeedbackError?: string | null;
  saveFeedbackSuccess?: string | null;
  /** When set, enables “Sign with DSC” (same PDF bytes as upload/save flow). */
  getPdfBlob?: () => Promise<Blob>;
  /** Default download/filename for signing (optional). */
  signingFileName?: string;
  /** Hide the Save / Saved toolbar control (e.g. preview-only flows). */
  hideSaveButton?: boolean;
  /** Show a mock “Sign” control that injects “Owner” + a dummy signature into the HTML iframe (first client signature column). */
  showMockSignButton?: boolean;
  /** After mock sign is injected (and fonts settle), parent can persist PDF / update workflow. */
  onMockSignComplete?: () => void | Promise<void>;
  /** Disables mock Sign while parent is saving (e.g. generating/uploading PDF). */
  mockSignBusy?: boolean;
};

export default function DocumentPreviewModal({
  open,
  onClose,
  fileUrl,
  htmlContent,
  fieldMapping,
  title,
  onSave,
  isSaving,
  saveDisabled,
  saveCompleted,
  saveFeedbackError,
  saveFeedbackSuccess,
  getPdfBlob,
  signingFileName,
  hideSaveButton = false,
  showMockSignButton = false,
  onMockSignComplete,
  mockSignBusy = false,
}: DocumentPreviewModalProps) {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const previewBlobUrlRef = useRef<string | null>(null);
  const [signModalOpen, setSignModalOpen] = useState(false);
  const [mockSignApplied, setMockSignApplied] = useState(false);
  /** Mock Sign: covers inject + fonts + parent upload until the pipeline finishes. */
  const [signPipelineBusy, setSignPipelineBusy] = useState(false);

  useEffect(() => {
    if (open) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "auto";
    return () => {
      document.body.style.overflow = "auto";
    };
  }, [open]);

  // Blob URL navigation gives a real `Window` on `contentDocument.defaultView`
  // (unlike `srcDoc` / `document.write`, which break html2canvas on some browsers).
  useLayoutEffect(() => {
    if (!open || !htmlContent || fileUrl) {
      if (previewBlobUrlRef.current) {
        URL.revokeObjectURL(previewBlobUrlRef.current);
        previewBlobUrlRef.current = null;
      }
      if (iframeRef.current && !fileUrl) {
        iframeRef.current.src = "about:blank";
      }
      return;
    }
    const frame = iframeRef.current;
    if (!frame) return;

    if (previewBlobUrlRef.current) {
      URL.revokeObjectURL(previewBlobUrlRef.current);
      previewBlobUrlRef.current = null;
    }
    const url = URL.createObjectURL(
      new Blob([htmlContent], { type: "text/html;charset=utf-8" })
    );
    previewBlobUrlRef.current = url;
    frame.src = url;

    return () => {
      URL.revokeObjectURL(url);
      if (previewBlobUrlRef.current === url) {
        previewBlobUrlRef.current = null;
      }
    };
  }, [open, htmlContent, fileUrl]);

  useEffect(() => {
    if (!open) {
      setMockSignApplied(false);
      setSignPipelineBusy(false);
    }
  }, [open, htmlContent]);

  const injectMockOwnerSignature = async () => {
    setSignPipelineBusy(true);
    try {
      const tryInject = () => {
      const doc = iframeRef.current?.contentDocument;
      if (!doc) return false;
      const firstCell = doc.querySelector(".signature-table tr td");
      if (!firstCell) return false;
      if (firstCell.querySelector("#preview-dummy-owner-sign")) return true;
      const signatureLine = firstCell.querySelector(".signature-line");
      if (!signatureLine) return false;

      const fontLinkId = "preview-owner-signature-font-link";
      if (!doc.getElementById(fontLinkId)) {
        const link = doc.createElement("link");
        link.id = fontLinkId;
        link.rel = "stylesheet";
        link.href =
          "https://fonts.googleapis.com/css2?family=Great+Vibes&display=swap";
        doc.head.appendChild(link);
      }

      const wrap = doc.createElement("div");
      wrap.id = "preview-dummy-owner-sign";
      wrap.setAttribute(
        "style",
        "margin-bottom:10px;padding-bottom:2px;display:inline-block;"
      );
      wrap.innerHTML = `
        <span style="
          font-family:'Great Vibes','Segoe Script','Brush Script MT',cursive;
          font-size:clamp(28px,4.2vw,36px);
          font-weight:400;
          line-height:1.15;
          color:#0f172a;
          letter-spacing:0.02em;
          display:inline-block;
          transform:rotate(-2deg);
          text-shadow:0 1px 0 rgba(255,255,255,0.6);
        ">Owner</span>
      `;
      firstCell.insertBefore(wrap, signatureLine);
      // Template `.signature-line` uses a large margin-top for blank signing space; once
      // “Owner” is injected above it, that margin reads as an awkward gap before designation.
      (signatureLine as HTMLElement).style.marginTop = "4px";
      return true;
    };

      const afterInject = async () => {
        setMockSignApplied(true);
        const doc = iframeRef.current?.contentDocument;
        if (doc?.fonts?.ready) {
          try {
            await doc.fonts.ready;
          } catch {
            /* ignore */
          }
        }
        await new Promise<void>((r) => window.setTimeout(() => r(), 250));
        if (onMockSignComplete) {
          await onMockSignComplete();
        }
      };

      if (tryInject()) {
        await afterInject();
        return;
      }
      await new Promise<void>((resolve, reject) => {
        window.setTimeout(() => {
          void (async () => {
            try {
              if (tryInject()) await afterInject();
              resolve();
            } catch (e) {
              reject(e instanceof Error ? e : new Error(String(e)));
            }
          })();
        }, 400);
      });
    } finally {
      setSignPipelineBusy(false);
    }
  };

  const hasContent = Boolean(fileUrl) || Boolean(htmlContent);
  if (!open || !hasContent) return null;
  if (typeof window === "undefined") return null;

  const isHtmlPreview = Boolean(htmlContent) && !fileUrl;
  const canSign = Boolean(getPdfBlob);

  const saveUiBusy = Boolean(isSaving) || signPipelineBusy;

  const handleCloseAll = () => {
    if (saveUiBusy) return;
    setSignModalOpen(false);
    onClose();
  };

  const handlePrint = () => {
    const win = iframeRef.current?.contentWindow;
    if (!win) return;
    try {
      win.focus();
      win.print();
    } catch {
      // Some browsers throw if the iframe document is still loading; retry once.
      window.setTimeout(() => {
        try {
          win.focus();
          win.print();
        } catch {
          /* ignore */
        }
      }, 200);
    }
  };

  const modalContent = (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[9999] flex justify-center items-start bg-black/50 backdrop-blur-sm p-4 pt-10"
          onClick={handleCloseAll}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            className={
              isHtmlPreview
                ? "bg-white w-fit max-w-[calc(100vw-2rem)] rounded-2xl shadow-2xl relative max-h-[90vh] flex flex-col overflow-hidden border border-gray-200"
                : "bg-white w-full max-w-5xl rounded-2xl shadow-2xl relative max-h-[90vh] flex flex-col overflow-hidden border border-gray-200"
            }
            onClick={(e) => e.stopPropagation()}
            initial={{ y: -20, opacity: 0, scale: 0.98 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: -20, opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.2 }}
          >
            <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200 bg-white">
              <div className="text-sm font-semibold text-gray-900 truncate">
                {title || "Document Preview"}
              </div>
              <div className="flex items-center gap-2">
                {canSign && (
                  <button
                    onClick={() => setSignModalOpen(true)}
                    disabled={saveUiBusy}
                    className="h-9 px-3 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold transition-colors flex items-center gap-1.5 disabled:opacity-50 disabled:pointer-events-none"
                    aria-label="Sign with DSC"
                    type="button"
                  >
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <path d="M12 2v8" />
                      <path d="M5 10h14" />
                      <path d="M5 14a4 4 0 0 0 4 4h6a4 4 0 0 0 4-4" />
                      <path d="M9 22h6" />
                    </svg>
                    Sign with DSC
                  </button>
                )}
                {htmlContent && !fileUrl && (
                  <button
                    onClick={handlePrint}
                    disabled={saveUiBusy}
                    className="h-9 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold transition-colors flex items-center gap-1.5 disabled:opacity-50 disabled:pointer-events-none"
                    aria-label="Print or save as PDF"
                    type="button"
                  >
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <polyline points="6 9 6 2 18 2 18 9" />
                      <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
                      <rect x="6" y="14" width="12" height="8" />
                    </svg>
                    Print / Save as PDF
                  </button>
                )}
                {htmlContent && !fileUrl && showMockSignButton && (
                  <button
                    type="button"
                    onClick={() => void injectMockOwnerSignature()}
                    disabled={mockSignApplied || mockSignBusy || signPipelineBusy}
                    className="h-9 px-3 rounded-lg border border-violet-600 bg-violet-50 hover:bg-violet-100 text-violet-800 text-sm font-semibold transition-colors disabled:opacity-50 disabled:pointer-events-none"
                    aria-label={mockSignApplied ? "Signed" : "Sign preview"}
                  >
                    {mockSignApplied ? "Signed" : "Sign"}
                  </button>
                )}
                {htmlContent && !fileUrl && onSave && !hideSaveButton && (
                  <button
                    onClick={() => {
                      if (saveCompleted || isSaving || saveDisabled) return;
                      void onSave();
                    }}
                    disabled={saveDisabled || isSaving || Boolean(saveCompleted) || signPipelineBusy}
                    className={
                      saveCompleted && !isSaving
                        ? "h-9 px-3 rounded-lg border border-emerald-500 bg-emerald-50 text-emerald-800 text-sm font-semibold flex items-center gap-1.5 cursor-default"
                        : "h-9 px-3 rounded-lg border border-blue-600 bg-white hover:bg-blue-50 text-blue-700 text-sm font-semibold transition-colors flex items-center gap-1.5 disabled:opacity-50 disabled:pointer-events-none"
                    }
                    aria-label={
                      saveCompleted && !isSaving
                        ? "Application PDF saved to project"
                        : "Save PDF to project"
                    }
                    type="button"
                  >
                    {isSaving ? (
                      "Saving…"
                    ) : saveCompleted ? (
                      <>
                        <svg
                          width="16"
                          height="16"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          aria-hidden="true"
                        >
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                        Saved
                      </>
                    ) : (
                      <>
                        <svg
                          width="16"
                          height="16"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          aria-hidden="true"
                        >
                          <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                          <polyline points="17 21 17 13 7 13 7 21" />
                          <polyline points="7 3 7 8 15 8" />
                        </svg>
                        Save
                      </>
                    )}
                  </button>
                )}
                <button
                  onClick={handleCloseAll}
                  disabled={saveUiBusy}
                  className="h-9 w-9 rounded-lg hover:bg-gray-100 text-gray-700 transition-colors flex items-center justify-center disabled:opacity-40 disabled:pointer-events-none"
                  aria-label="Close preview"
                  type="button"
                >
                  <span className="text-2xl leading-none">×</span>
                </button>
              </div>
            </div>
            {(saveFeedbackError || saveFeedbackSuccess) && (
              <div className="px-5 py-2 border-b border-gray-200 bg-white shrink-0">
                {saveFeedbackError ? (
                  <p className="text-sm text-red-600">{saveFeedbackError}</p>
                ) : (
                  <p className="text-sm text-emerald-700">{saveFeedbackSuccess}</p>
                )}
              </div>
            )}

            <div className="flex-1 overflow-auto p-3 bg-gray-50">
              {htmlContent && !fileUrl ? (
                <div className="flex justify-center">
                  <div
                    className="rounded-xl bg-white border border-gray-200 overflow-hidden"
                    style={{ width: "min(800px, calc(100vw - 2rem))", minHeight: "600px" }}
                  >
                    <iframe
                      ref={iframeRef}
                      title={title || "Document Preview"}
                      src="about:blank"
                      className="block w-full bg-white border-0"
                      style={{ height: "78vh" }}
                    />
                  </div>
                </div>
              ) : fileUrl ? (
                <div
                  className="rounded-xl bg-white border border-gray-200 overflow-hidden"
                  style={{ minHeight: "600px" }}
                >
                  <PlainPDFViewer fileUrl={fileUrl} />
                </div>
              ) : null}
            </div>

            {saveUiBusy && (
              <div
                className="absolute inset-0 z-[70] flex flex-col items-center justify-center rounded-2xl bg-white/90 backdrop-blur-[3px]"
                role="status"
                aria-live="polite"
                aria-busy="true"
              >
                <div
                  className="h-10 w-10 rounded-full border-[3px] border-blue-600 border-t-transparent animate-spin"
                  aria-hidden
                />
                <p className="mt-4 text-sm font-semibold text-gray-900">
                  {isSaving ? "Saving PDF…" : "Preparing signature…"}
                </p>
                <p className="mt-1 max-w-[240px] text-center text-xs text-gray-500">
                  Generating and uploading — this can take a moment
                </p>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  return (
    <>
      {createPortal(modalContent, document.body)}
      {canSign && (
        <BridgeSignModal
          open={signModalOpen}
          onClose={() => setSignModalOpen(false)}
          getPdfBlob={getPdfBlob}
          fileName={signingFileName || "application-preview.pdf"}
          title={title ? `Sign "${title}" with DSC` : "Sign Document with DSC"}
        />
      )}
    </>
  );
}
