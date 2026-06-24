"use client";

import React from "react";
import { AnimatePresence, motion } from "framer-motion";

type DscPinModalProps = {
  open: boolean;
  pin: string;
  busy?: boolean;
  error?: string | null;
  onPinChange: (pin: string) => void;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
};

export default function DscPinModal({
  open,
  pin,
  busy = false,
  error = null,
  onPinChange,
  onClose,
  onConfirm,
}: DscPinModalProps) {
  if (typeof window === "undefined") return null;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[10010] flex items-center justify-center bg-black/45 p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={busy ? undefined : onClose}
        >
          <motion.div
            className="w-full max-w-sm rounded-2xl border border-gray-200 bg-white shadow-2xl"
            initial={{ y: -10, opacity: 0, scale: 0.98 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: -10, opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.2 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="border-b border-gray-200 px-5 py-4">
              <h3 className="text-base font-semibold text-gray-900">Verify DSC PIN</h3>
              <p className="mt-1 text-xs text-gray-500">
                Enter your token PIN to continue signing this application.
              </p>
            </div>
            <div className="space-y-3 px-5 py-4">
              <input
                type="password"
                value={pin}
                onChange={(e) => onPinChange(e.target.value)}
                placeholder="Enter DSC PIN"
                disabled={busy}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-black focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:bg-gray-100"
              />
              {error ? <p className="text-xs text-red-600">{error}</p> : null}
            </div>
            <div className="flex justify-end gap-2 border-t border-gray-200 px-5 py-3">
              <button
                type="button"
                onClick={onClose}
                disabled={busy}
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void onConfirm()}
                disabled={busy || pin.trim().length === 0}
                className="rounded-lg bg-gradient-to-r from-emerald-800 to-emerald-500 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                {busy ? "Signing..." : "Verify & Sign"}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
