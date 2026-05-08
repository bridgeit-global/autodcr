"use client";

import React, { useEffect, useRef, useState } from "react";
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
  /**
   * Optional async generator that produces the PDF blob to sign. When
   * provided, the modal exposes a "Sign with DSC" button that lazily
   * resolves the PDF and routes it through the bridge-poc signing flow.
   * Used by the application creation / draft preview to demo signing the
   * generated application PDF.
   */
  getPdfBlob?: () => Promise<Blob>;
  /** File name forwarded to the native host when signing. */
  signingFileName?: string;
};

export default function DocumentPreviewModal({
  open,
  onClose,
  fileUrl,
  htmlContent,
  fieldMapping,
  title,
  getPdfBlob,
  signingFileName,
}: DocumentPreviewModalProps) {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const [signModalOpen, setSignModalOpen] = useState(false);

  useEffect(() => {
    if (open) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "auto";
    return () => {
      document.body.style.overflow = "auto";
    };
  }, [open]);

  const hasContent = Boolean(fileUrl) || Boolean(htmlContent);
  if (!open || !hasContent) return null;
  if (typeof window === "undefined") return null;

  const isHtmlPreview = Boolean(htmlContent) && !fileUrl;
  const canSign = Boolean(getPdfBlob);

  const handleCloseAll = () => {
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
                    className="h-9 px-3 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold transition-colors flex items-center gap-1.5"
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
                    className="h-9 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold transition-colors flex items-center gap-1.5"
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
                <button
                  onClick={handleCloseAll}
                  className="h-9 w-9 rounded-lg hover:bg-gray-100 text-gray-700 transition-colors flex items-center justify-center"
                  aria-label="Close preview"
                  type="button"
                >
                  <span className="text-2xl leading-none">×</span>
                </button>
              </div>
            </div>

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
                      srcDoc={htmlContent}
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
