'use client';

import React, { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useForm } from "react-hook-form";

interface Props {
  open: boolean;
  onClose: () => void;
}

type FormValues = {
  email: string;
  mobile: string;
  captcha: string;
};

const ForgotUsernameModal: React.FC<Props> = ({ open, onClose }) => {
  const {
    register,
    handleSubmit,
    formState: { errors },
    reset
  } = useForm<FormValues>();

  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";

      setTimeout(() => {
        window.scrollTo(0, 0);
      }, 10);

      const modal = document.getElementById("modal-content");
      if (modal) modal.scrollTop = 0;
    } else {
      document.body.style.overflow = "auto";
      reset();    
    }

    return () => {
      document.body.style.overflow = "auto";
    };
  }, [open, reset]);

  const onSubmit = (data: FormValues) => {
    console.log("Username Recovery Data:", data);
  };

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
            id="modal-content"
            className="bg-white w-[90%] max-w-xl rounded-xl shadow-2xl p-8 relative"
            onClick={(e) => e.stopPropagation()}
            initial={{ y: -40, opacity: 0, scale: 0.95 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: -40, opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.25 }}
          >
            {/* Header */}
            <div className="flex justify-between items-center mb-6 pb-3 border-b">
              <h2 className="text-2xl font-bold text-black">Forgot Username</h2>
              <button
                onClick={onClose}
                className="text-2xl font-bold text-gray-700 hover:text-black"
              >
                ×
              </button>
            </div>

            {/* Body */}
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">

              {/* Email ID */}
              <div>
                <label className="block font-medium text-black mb-1">
                  E-mail ID <span className="text-red-500 text-2xl">*</span>
                </label>

                <input
                  type="email"
                  {...register("email", {
                    required: "Email is required",
                    pattern: {
                      value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                      message: "Invalid email format"
                    }
                  })}
                  className="border rounded-lg px-3 py-2 w-full text-black focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="Enter Email-ID"
                />

                {errors.email && (
                  <p className="text-red-600 text-sm mt-1">{errors.email.message}</p>
                )}
              </div>

              {/* Mobile No */}
              <div>
                <label className="block font-medium text-black mb-1">
                  Mobile No. <span className="text-red-500 text-2xl">*</span>
                </label>

                <input
                  {...register("mobile", {
                    required: "Mobile number is required",
                    pattern: {
                      value: /^[0-9]{10}$/,
                      message: "Mobile number must be 10 digits"
                    }
                  })}
                  className="border rounded-lg px-3 py-2 w-full text-black focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="Enter Mobile Number"
                  type="number"
                />

                {errors.mobile && (
                  <p className="text-red-600 text-sm mt-1">{errors.mobile.message}</p>
                )}
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
                    {...register("captcha", {
                      required: "Captcha is required"
                    })}
                    className="border rounded-lg px-3 py-2 text-black focus:ring-2 focus:ring-blue-500 outline-none w-40"
                    placeholder="Enter code"
                  />
                </div>

                {errors.captcha && (
                  <p className="text-red-600 text-sm mt-1">{errors.captcha.message}</p>
                )}

                <p className="text-xs text-gray-600 mt-1">Type the code from above</p>
              </div>

              {/* Submit */}
              <div className="text-center mt-4">
                <button
                  type="submit"
                  className="bg-blue-600 text-white px-8 py-2 rounded-lg font-medium shadow hover:bg-blue-700 transition"
                >
                  Submit
                </button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default ForgotUsernameModal;
