"use client";

import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { motion, AnimatePresence } from "framer-motion";
import { createPortal } from "react-dom";

const ApplicationStoredPdfViewer = dynamic(() => import("./ApplicationStoredPdfViewer"), {
  ssr: false,
}) as React.ComponentType<{ fileUrl: string }>;

const BridgeSignModal = dynamic(() => import("./BridgeSignModal"), {
  ssr: false,
});

type DocumentPreviewModalProps = {
  open: boolean;
  onClose: () => void;
  /** When provided, renders a PDF preview via ApplicationStoredPdfViewer. */
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
  /** Show a loading state in the preview body while HTML/PDF is being prepared. */
  isLoading?: boolean;
  /** Error to show inside the modal when preview content could not be loaded. */
  loadError?: string | null;
  /** When true with `showMockSignButton`, iframe loads then mock sign + `onMockSignComplete` run once (sidebar “Sign application”). */
  autoMockSignAfterOpen?: boolean;
  /** `owner_only` = owner signature only; `owner_and_architect` = owner + second signer columns. */
  mockSignMode?: "owner_only" | "owner_and_architect";
  /** Cursive label for the second signature column (e.g. Plumber, Architect). */
  mockSecondSignLabel?: string;
  /** Show a mock “Sign” control that injects “Owner” + a dummy signature into the HTML iframe (first client signature column). */
  showMockSignButton?: boolean;
  /** After mock sign is injected (and fonts settle), parent can persist PDF / update workflow. */
  onMockSignComplete?: () => void | Promise<void>;
  /** While parent is saving after mock sign (e.g. generating/uploading PDF). */
  mockSignBusy?: boolean;
  /** Dual-letter applications: show Appointment / Acceptance selector in the toolbar. */
  showLetterVariantSelector?: boolean;
  letterVariant?: "appointment" | "acceptance";
  onLetterVariantChange?: (variant: "appointment" | "acceptance") => void;
  letterVariantDisabled?: boolean;
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
  isLoading = false,
  loadError = null,
  autoMockSignAfterOpen = false,
  mockSignMode = "owner_only",
  mockSecondSignLabel = "Architect",
  showMockSignButton = false,
  onMockSignComplete,
  mockSignBusy = false,
  showLetterVariantSelector = false,
  letterVariant = "appointment",
  onLetterVariantChange,
  letterVariantDisabled = false,
}: DocumentPreviewModalProps) {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const injectMockOwnerSignatureRef = useRef<() => Promise<void>>(async () => Promise.resolve());
  const previewBlobUrlRef = useRef<string | null>(null);
  /** Sidebar auto-sign: afterInject / onMockSignComplete ran successfully once for this open+html. */
  const sidebarAutoCommitDoneRef = useRef(false);
  /** Prevents parallel afterInject when load + timer both fire. */
  const sidebarAutoAfterInjectLockRef = useRef(false);
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
      sidebarAutoCommitDoneRef.current = false;
      sidebarAutoAfterInjectLockRef.current = false;
      return;
    }
    if (autoMockSignAfterOpen) {
      sidebarAutoCommitDoneRef.current = false;
    }
  }, [open, htmlContent, autoMockSignAfterOpen]);

  const injectMockOwnerSignature = async () => {
    setSignPipelineBusy(true);
    try {
      const tryInject = (): boolean | "already" => {
        const doc = iframeRef.current?.contentDocument;
        if (!doc) return false;
        const fontLinkId = "preview-owner-signature-font-link";
        if (!doc.getElementById(fontLinkId)) {
          const link = doc.createElement("link");
          link.id = fontLinkId;
          link.rel = "stylesheet";
          link.href =
            "https://fonts.googleapis.com/css2?family=Great+Vibes&display=swap";
          doc.head.appendChild(link);
        }

        const injectColumn = (
          cell: Element,
          wrapId: string,
          label: string,
          rotateDeg: string
        ): boolean | "already" => {
          if (cell.querySelector(`#${wrapId}`)) return "already";
          const signatureLine = cell.querySelector(".signature-line");
          if (!signatureLine) return false;
          const wrap = doc.createElement("div");
          wrap.id = wrapId;
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
          transform:rotate(${rotateDeg});
          text-shadow:0 1px 0 rgba(255,255,255,0.6);
        ">${label}</span>
      `;
          cell.insertBefore(wrap, signatureLine);
          (signatureLine as HTMLElement).style.marginTop = "4px";
          return true;
        };

        const needOwner =
          mockSignMode === "owner_only" || mockSignMode === "owner_and_architect";
        const needSecondSigner = mockSignMode === "owner_and_architect";

        const ownerSignatureBlock = doc.querySelector(".owner-signature");
        if (ownerSignatureBlock && needOwner) {
          if (ownerSignatureBlock.querySelector("#preview-dummy-owner-sign")) {
            if (!needSecondSigner) return "already";
          } else {
            const details = ownerSignatureBlock.querySelector(
              ".owner-signature-details"
            ) as HTMLElement | null;
            if (details) {
              details.style.width = "auto";
              details.style.textAlign = "right";
            }
            (ownerSignatureBlock as HTMLElement).style.marginLeft = "auto";
            (ownerSignatureBlock as HTMLElement).style.display = "flex";
            (ownerSignatureBlock as HTMLElement).style.flexDirection = "column";
            (ownerSignatureBlock as HTMLElement).style.alignItems = "flex-end";
            const wrap = doc.createElement("div");
            wrap.id = "preview-dummy-owner-sign";
            wrap.setAttribute(
              "style",
              "display:block;text-align:right;align-self:flex-end;margin:0 0 6px;padding-bottom:2px;"
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
        ">Owner</span>`;
            if (details) {
              ownerSignatureBlock.insertBefore(wrap, details);
            } else {
              ownerSignatureBlock.insertBefore(wrap, ownerSignatureBlock.firstChild);
            }
          }
          if (!needSecondSigner) return true;
        }

        const cells = doc.querySelectorAll(".signature-table tr td");
        const firstCell = cells[0];
        if (!firstCell && !ownerSignatureBlock) return false;

        let ownerResult: boolean | "already" = "already";
        if (needOwner && firstCell) {
          ownerResult = injectColumn(firstCell, "preview-dummy-owner-sign", "Owner", "-2deg");
          if (ownerResult === false) return false;
        }

        if (needSecondSigner) {
          const secondCell = cells[1];
          if (!secondCell) return false;
          const secondResult = injectColumn(
            secondCell,
            "preview-dummy-consultant-sign",
            mockSecondSignLabel,
            "1.5deg"
          );
          if (secondResult === false) return false;
          if (secondResult === true) return true;
        }

        if (ownerResult === true) return true;
        if (
          needSecondSigner &&
          cells[1]?.querySelector("#preview-dummy-consultant-sign") &&
          (ownerResult === "already" || !needOwner)
        ) {
          return "already";
        }
        return ownerResult === "already" ? "already" : false;
      };

      const afterInject = async () => {
        if (autoMockSignAfterOpen) {
          if (sidebarAutoCommitDoneRef.current || sidebarAutoAfterInjectLockRef.current) {
            return;
          }
          sidebarAutoAfterInjectLockRef.current = true;
        }
        try {
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
          if (autoMockSignAfterOpen) {
            sidebarAutoCommitDoneRef.current = true;
          }
        } finally {
          if (autoMockSignAfterOpen) {
            sidebarAutoAfterInjectLockRef.current = false;
          }
        }
      };

      const injected = tryInject();
      if (injected === true) {
        await afterInject();
        return;
      }
      if (injected === "already") {
        // First inject may have run from another handler; sidebar auto-sign must still persist PDF + DB.
        if (autoMockSignAfterOpen) {
          await afterInject();
        }
        return;
      }
      await new Promise<void>((resolve, reject) => {
        window.setTimeout(() => {
          void (async () => {
            try {
              const r = tryInject();
              if (r === true) await afterInject();
              else if (r === "already" && autoMockSignAfterOpen) await afterInject();
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

  injectMockOwnerSignatureRef.current = injectMockOwnerSignature;

  /** Sidebar “Sign application”: after iframe loads, inject mock owner + parent pipeline (no toolbar Sign). */
  useEffect(() => {
    if (
      !open ||
      !htmlContent ||
      fileUrl ||
      !showMockSignButton ||
      !autoMockSignAfterOpen ||
      mockSignApplied
    ) {
      return;
    }
    const frame = iframeRef.current;
    if (!frame) return;

    let cancelled = false;
    let fired = false;
    const runOnce = () => {
      if (cancelled || fired) return;
      fired = true;
      void injectMockOwnerSignatureRef.current();
    };

    const onLoad = () => window.setTimeout(runOnce, 80);
    frame.addEventListener("load", onLoad, { once: true });
    const fallback = window.setTimeout(runOnce, 900);

    return () => {
      cancelled = true;
      window.clearTimeout(fallback);
      frame.removeEventListener("load", onLoad);
    };
  }, [open, htmlContent, fileUrl, showMockSignButton, autoMockSignAfterOpen, mockSignApplied]);

  const hasContent = Boolean(fileUrl) || Boolean(htmlContent);
  if (!open || (!hasContent && !isLoading && !loadError)) return null;
  if (typeof window === "undefined") return null;

  const isHtmlPreview = Boolean(htmlContent) && !fileUrl;
  const isStoredPdfPreview = Boolean(fileUrl) && !htmlContent;
  const useCompactPreviewLayout =
    isHtmlPreview || isStoredPdfPreview || (!hasContent && (isLoading || Boolean(loadError)));
  const canSign = Boolean(getPdfBlob);

  const saveUiBusy = Boolean(isSaving);
  const previewReloadBusy = Boolean(isLoading && hasContent);

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

  const handlePrintStoredPdf = async () => {
    if (!fileUrl) return;
    try {
      const res = await fetch(fileUrl);
      if (!res.ok) throw new Error("Could not load the saved PDF.");
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const iframe = document.createElement("iframe");
      iframe.style.position = "fixed";
      iframe.style.width = "0";
      iframe.style.height = "0";
      iframe.style.border = "0";
      iframe.src = blobUrl;
      document.body.appendChild(iframe);
      iframe.onload = () => {
        try {
          iframe.contentWindow?.focus();
          iframe.contentWindow?.print();
        } finally {
          window.setTimeout(() => {
            URL.revokeObjectURL(blobUrl);
            iframe.remove();
          }, 1500);
        }
      };
    } catch {
      window.open(fileUrl, "_blank", "noopener,noreferrer");
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
              useCompactPreviewLayout
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
                {showLetterVariantSelector && onLetterVariantChange && (
                  <label className="flex items-center gap-2 text-sm text-gray-700">
                    <span className="whitespace-nowrap">Letter</span>
                    <select
                      value={letterVariant}
                      onChange={(e) =>
                        onLetterVariantChange(
                          e.target.value === "acceptance" ? "acceptance" : "appointment"
                        )
                      }
                      disabled={letterVariantDisabled || saveUiBusy}
                      className="h-9 rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-900 min-w-[11rem] disabled:opacity-50"
                      aria-label="Letter type"
                    >
                      <option value="appointment">Appointment</option>
                      <option value="acceptance">Acceptance</option>
                    </select>
                  </label>
                )}
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
                {((htmlContent && !fileUrl) || isStoredPdfPreview) && (
                  <button
                    onClick={() => {
                      if (isStoredPdfPreview) void handlePrintStoredPdf();
                      else handlePrint();
                    }}
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
              {isLoading && !hasContent ? (
                <div className="flex min-h-[600px] items-center justify-center text-sm text-gray-500">
                  Generating preview…
                </div>
              ) : loadError ? (
                <div className="flex min-h-[600px] items-center justify-center px-6 text-center text-sm text-red-600">
                  {loadError}
                </div>
              ) : htmlContent && !fileUrl ? (
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
                <div className="flex justify-center">
                  <div
                    className="rounded-xl bg-white border border-gray-200 overflow-hidden"
                    style={{ width: "min(800px, calc(100vw - 2rem))", minHeight: "600px" }}
                  >
                    <ApplicationStoredPdfViewer fileUrl={fileUrl} />
                  </div>
                </div>
              ) : null}
            </div>

            {(saveUiBusy || previewReloadBusy) && (
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
                  {saveUiBusy
                    ? isSaving
                      ? "Saving PDF…"
                      : "Preparing signature…"
                    : "Loading preview…"}
                </p>
                <p className="mt-1 max-w-[240px] text-center text-xs text-gray-500">
                  {saveUiBusy
                    ? "Generating and uploading — this can take a moment"
                    : "Switching letter type"}
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
