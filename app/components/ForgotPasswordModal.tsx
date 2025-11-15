'use client';

import React,{useEffect} from "react";
import { motion, AnimatePresence } from "framer-motion";

interface Props {
  open: boolean;
  onClose: () => void;
}


const ForgotPasswordModal: React.FC<Props> = ({ open, onClose }) => {
  useEffect(() => {
    if (open) {
      // Lock background scroll
      document.body.style.overflow = "hidden";
  
      // Scroll window to top
      setTimeout(() => {
        window.scrollTo(0, 0);
      }, 10);
  
      // Scroll modal content to top
      const modal = document.getElementById("modal-content");
      if (modal) modal.scrollTop = 0;
  
    } else {
      document.body.style.overflow = "auto";
    }
  
    return () => {
      document.body.style.overflow = "auto";
    };
  }, [open]);

	if (!open) return null;
  return (
    <AnimatePresence>
      {open && (
        <motion.div
        className="fixed inset-0 z-[9999] flex justify-center items-start bg-black/50 backdrop-blur-sm pt-10"
        onClick={onClose}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          {/* Modal Container */}
          <motion.div
            className="bg-white w-[90%] max-w-xl rounded-xl shadow-2xl p-8 relative"
            onClick={(e) => e.stopPropagation()}
            initial={{ y: -40, opacity: 0, scale: 0.95 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: -40, opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.25 }}
          >
            {/* Header */}
            <div className="flex justify-between items-center mb-6 pb-3 border-b">
              <h2 className="text-2xl font-bold text-black">Forgot Password</h2>
              <button
                onClick={onClose}
                className="text-2xl font-bold text-gray-700 hover:text-black"
              >
                ×
              </button>
            </div>

            {/* Body */}
            <div className="space-y-6">
              {/* Login Name */}
              <div>
                <label className="block font-medium text-black mb-1">
                  Login Name <span className="text-red-500 text-2xl">*</span>
                </label>
                <input
                  className="border rounded-lg px-3 py-2 w-full text-black focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="Enter Login Name"
                />
              </div>

              {/* Email ID */}
              <div>
                <label className="block font-medium text-black mb-1">
                  E-mail ID <span className="text-red-500 text-2xl">*</span>
                </label>
                <input
                  className="border rounded-lg px-3 py-2 w-full text-black focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="Enter Email-ID"
                />
              </div>

              {/* Mobile No */}
              <div>
                <label className="block font-medium text-black mb-1">
                  Mobile No. <span className="text-red-500 text-2xl">*</span>
                </label>
                <input
                  className="border rounded-lg px-3 py-2 w-full text-black focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="Enter Mobile Number"
                />
              </div>

              {/* Captcha */}
              <div>
                <label className="block font-medium text-black mb-2">
                  Captcha
                </label>

                <div className="flex items-center gap-4">
                  <div className="h-12 w-40 select-none rounded border border-gray-300 bg-gray-100 p-2 text-center font-mono text-lg tracking-widest text-gray-800 flex items-center justify-center shadow-sm">
                    98•22
                  </div>

                  <input
                    className="border rounded-lg px-3 py-2 text-black focus:ring-2 focus:ring-blue-500 outline-none w-40"
                    placeholder="Enter code"
                  />
                </div>

                <p className="text-xs text-gray-600 mt-1">Type the code from above</p>
              </div>

              {/* Submit */}
              <div className="text-center mt-4">
                <button className="bg-blue-600 text-white px-8 py-2 rounded-lg font-medium shadow hover:bg-blue-700 transition">
                  Submit
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default ForgotPasswordModal;


