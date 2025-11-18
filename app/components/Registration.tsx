"use client";

import React, { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";

interface Props {
  open: boolean;
  onClose: () => void;
}

const ForgotPasswordModal: React.FC<Props> = ({ open, onClose }) => {
  const router = useRouter();
  
  useEffect(() => {
    if (open) {
      // Lock background scroll
      document.body.style.overflow = "hidden";
      // Ensure modal content starts at the top without altering page scroll
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
          {/* Modal */}
          <motion.div
            id="modal-content"
            className="bg-white w-[90%] max-w-2xl rounded-xl shadow-2xl p-8 relative max-h-[80vh] overflow-y-auto"
            
            onClick={(e) => e.stopPropagation()}
            initial={{ y: -40, opacity: 0, scale: 0.95 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: -40, opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.25 }}
          >
            {/* Header */}
            <div className="mb-6 pb-3 border-b">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-2">
                <h2 className="text-2xl font-bold text-black">Owner Registration</h2>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => {
                      onClose();
                      router.push("/");
                    }}
                    className="flex items-center gap-2 px-4 py-2 text-gray-700 hover:text-gray-900 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                    </svg>
                    <span className="font-medium">Back</span>
                  </button>
                  <button
                    onClick={onClose}
                    className="text-2xl font-bold text-gray-700 hover:text-black"
                  >
                    ×
                  </button>
                </div>
              </div>
            </div>

            {/* Body */}
<div className="space-y-6">

  {/* Row: Firm / Developer Name + Type */}
  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
    <div>
      <label className="block font-medium text-black mb-1">
        Firm / Developer Name
      </label>
      <input
        className="border rounded-lg px-3 py-2 w-full text-black focus:ring-2 focus:ring-blue-500 outline-none"
        placeholder="Enter Firm / Developer Name"
      />
    </div>

    <div>
      <label className="block font-medium text-black mb-1">Type</label>
      <select className="border rounded-lg px-3 py-2 w-full text-black focus:ring-2 focus:ring-blue-500 outline-none">
        <option value="">Select Type</option>
        <option>Developer</option>
        <option>Firm</option>
        <option>Individual</option>
      </select>
    </div>
  </div>

  {/* Row: PAN No + Aadhar No */}
  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
    <div>
      <label className="block font-medium text-black mb-1">
        PAN Card Number
      </label>
      <input
        className="border rounded-lg px-3 py-2 w-full text-black focus:ring-2 focus:ring-blue-500 outline-none"
        placeholder="Enter PAN Number"
      />
    </div>

    <div>
      <label className="block font-medium text-black mb-1">
        Aadhar Number
      </label>
      <input
        className="border rounded-lg px-3 py-2 w-full text-black focus:ring-2 focus:ring-blue-500 outline-none"
        placeholder="Enter Aadhar Number"
      />
    </div>
  </div>

  {/* Row: PAN PDF + Aadhar PDF */}
  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
    <div>
      <label className="block font-medium text-black mb-1">
        Upload PAN (PDF)
      </label>
      <input
        type="file"
        accept="application/pdf"
        className="border rounded-lg px-3 py-2 w-full bg-gray-50 text-black focus:ring-2 focus:ring-blue-500 outline-none"
      />
    </div>

    <div>
      <label className="block font-medium text-black mb-1">
        Upload Aadhar (PDF)
      </label>
      <input
        type="file"
        accept="application/pdf"
        className="border rounded-lg px-3 py-2 w-full bg-gray-50 text-black focus:ring-2 focus:ring-blue-500 outline-none"
      />
    </div>
  </div>

  {/* Row: Telephone + Email */}
  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
    <div>
      <label className="block font-medium text-black mb-1">
        Telephone Number
      </label>
      <input
        className="border rounded-lg px-3 py-2 w-full text-black focus:ring-2 focus:ring-blue-500 outline-none"
        placeholder="Enter Telephone Number"
      />
    </div>

    <div>
      <label className="block font-medium text-black mb-1">
        Email ID
      </label>
      <input
        className="border rounded-lg px-3 py-2 w-full text-black focus:ring-2 focus:ring-blue-500 outline-none"
        placeholder="Enter Email ID"
      />
    </div>
  </div>

  {/* Full Width Address */}
  <div>
    <label className="block font-medium text-black mb-1">Address</label>
    <textarea
      className="border rounded-lg px-3 py-2 w-full h-20 text-black focus:ring-2 focus:ring-blue-500 outline-none"
      placeholder="Enter Address"
    ></textarea>
  </div>

  {/* Row: Pincode + Mobile No */}
  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
    <div>
      <label className="block font-medium text-black mb-1">Pincode</label>
      <input
        className="border rounded-lg px-3 py-2 w-full text-black focus:ring-2 focus:ring-blue-500 outline-none"
        placeholder="Enter Pincode"
      />
    </div>

    <div>
      <label className="block font-medium text-black mb-1">Mobile Number</label>
      <input
        className="border rounded-lg px-3 py-2 w-full text-black focus:ring-2 focus:ring-blue-500 outline-none"
        placeholder="Enter Mobile Number"
      />
    </div>
  </div>

  {/* Row: Photo + Signature */}
  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
    <div>
      <label className="block font-medium text-black mb-1">Photo</label>
      <input
        type="file"
        accept="image/*"
        className="border rounded-lg px-3 py-2 w-full bg-gray-50 text-black focus:ring-2 focus:ring-blue-500 outline-none"
      />
    </div>

    <div>
      <label className="block font-medium text-black mb-1">
        Signature Image
      </label>
      <input
        type="file"
        accept="image/*"
        className="border rounded-lg px-3 py-2 w-full bg-gray-50 text-black focus:ring-2 focus:ring-blue-500 outline-none"
      />
    </div>
  </div>

  {/* Submit */}
  <div className="text-center mt-4">
    <button className="bg-blue-600 text-white px-10 py-2 rounded-lg font-medium shadow hover:bg-blue-700 transition">
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
