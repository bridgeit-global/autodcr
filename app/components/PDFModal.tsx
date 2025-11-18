"use client";

import React, { useEffect } from "react";
import dynamic from "next/dynamic";
import { motion, AnimatePresence } from "framer-motion";
import { createPortal } from "react-dom";

const PDFViewer = dynamic(() => import("./PDFViewer"), {
  ssr: false,
}) as React.ComponentType<{ fileUrl: string }>;

interface PDFModalProps {
  open: boolean;
  onClose: () => void;
  fileUrl: string | null;
}

const PDFModal: React.FC<PDFModalProps> = ({ open, onClose, fileUrl }) => {

  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "auto";
    }

    return () => {
      document.body.style.overflow = "auto";
    };
  }, [open]);

  const handleClose = () => {
    onClose();
  };

  if (!open || !fileUrl) return null;

  const modalContent = (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[9999] flex justify-center items-start bg-black/50 backdrop-blur-sm p-4 pt-10"
          onClick={handleClose}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            id="letterhead-modal"
            className="bg-white w-full max-w-5xl rounded-xl shadow-2xl relative max-h-[90vh] flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
            initial={{ y: -40, opacity: 0, scale: 0.95 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: -40, opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.25 }}
          >
            <div className="flex justify-between items-center p-6 border-b">
              <div>
                <h2 className="text-2xl font-bold text-black">Letterhead Preview - Assigned Placement Demo</h2>
                <p className="text-sm text-gray-600 mt-1">
                  This is a demo showing where your letterhead will be placed in the system.
                </p>
              </div>
              <button
                onClick={handleClose}
                className="text-2xl font-bold text-gray-700 hover:text-black transition-colors"
                aria-label="Close modal"
              >
                ×
              </button>
            </div>

            <div className="flex-1 overflow-auto p-6 space-y-4">
              <div className="border rounded-lg bg-white" style={{ minHeight: "600px" }}>
                <PDFViewer fileUrl={fileUrl} />
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  if (typeof window === "undefined") {
    return null;
  }

  return createPortal(modalContent, document.body);
};

export default PDFModal;

