"use client";

import React, { useEffect } from "react";
import dynamic from "next/dynamic";
import { motion, AnimatePresence } from "framer-motion";
import { createPortal } from "react-dom";

const PlainPDFViewer = dynamic(() => import("./PlainPDFViewer"), {
  ssr: false,
}) as React.ComponentType<{ fileUrl: string }>;

type DocumentPreviewModalProps = {
  open: boolean;
  onClose: () => void;
  fileUrl: string | null;
  title?: string;
};

export default function DocumentPreviewModal({ open, onClose, fileUrl, title }: DocumentPreviewModalProps) {
  useEffect(() => {
    if (open) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "auto";
    return () => {
      document.body.style.overflow = "auto";
    };
  }, [open]);

  if (!open || !fileUrl) return null;
  if (typeof window === "undefined") return null;

  const modalContent = (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[9999] flex justify-center items-start bg-black/50 backdrop-blur-sm p-4 pt-10"
          onClick={onClose}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            className="bg-white w-full max-w-5xl rounded-2xl shadow-2xl relative max-h-[90vh] flex flex-col overflow-hidden border border-gray-200"
            onClick={(e) => e.stopPropagation()}
            initial={{ y: -20, opacity: 0, scale: 0.98 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: -20, opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.2 }}
          >
            {/* Clean top bar (no big header box) */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200 bg-white">
              <div className="text-sm font-semibold text-gray-900 truncate">{title || "Document Preview"}</div>
              <button
                onClick={onClose}
                className="h-9 w-9 rounded-lg hover:bg-gray-100 text-gray-700 transition-colors flex items-center justify-center"
                aria-label="Close preview"
                type="button"
              >
                <span className="text-2xl leading-none">×</span>
              </button>
            </div>

            <div className="flex-1 overflow-auto p-4 bg-gray-50">
              <div className="rounded-xl bg-white border border-gray-200 overflow-hidden" style={{ minHeight: "600px" }}>
                <PlainPDFViewer fileUrl={fileUrl} />
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  return createPortal(modalContent, document.body);
}


