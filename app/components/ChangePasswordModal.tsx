'use client';

import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useForm } from "react-hook-form";
import { supabase } from "@/app/utils/supabase";

interface Props {
  open: boolean;
  onClose: () => void;
}

type FormValues = {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
};

const ChangePasswordModal: React.FC<Props> = ({ open, onClose }) => {
  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    watch,
    setError
  } = useForm<FormValues>();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  useEffect(() => {
    if (open) {
      // Lock background scroll
      document.body.style.overflow = "hidden";
  
      // Scroll window to top
      setTimeout(() => {
        window.scrollTo(0, 0);
      }, 10);

      // Scroll modal content to top
      const modal = document.getElementById("change-password-modal-content");
      if (modal) modal.scrollTop = 0;
      
      // Reset state when modal opens
      setSubmitError(null);
      setSubmitSuccess(false);
      setShowCurrentPassword(false);
      setShowNewPassword(false);
      setShowConfirmPassword(false);
    } else {
      document.body.style.overflow = "auto";
      reset(); // clear fields when modal closes
      setSubmitError(null);
      setSubmitSuccess(false);
      setShowCurrentPassword(false);
      setShowNewPassword(false);
      setShowConfirmPassword(false);
    }

    return () => {
      document.body.style.overflow = "auto";
    };
  }, [open, reset]);

  const newPassword = watch("newPassword");
  const confirmPassword = watch("confirmPassword");

  const onSubmit = async (data: FormValues) => {
    setIsSubmitting(true);
    setSubmitError(null);
    setSubmitSuccess(false);

    try {
      // Step 1: Get current user's email
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user || !user.email) {
        setSubmitError("User not found. Please log in again.");
        setIsSubmitting(false);
        return;
      }

      // Step 2: Verify current password by attempting to sign in
      const { error: verifyError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: data.currentPassword,
      });

      if (verifyError) {
        setSubmitError("Current password is incorrect. Please try again.");
        setIsSubmitting(false);
        return;
      }

      // Step 3: Update password
      const { error: updateError } = await supabase.auth.updateUser({
        password: data.newPassword
      });

      if (updateError) {
        setSubmitError(updateError.message || "Failed to update password. Please try again.");
        setIsSubmitting(false);
        return;
      }

      // Success!
      setSubmitSuccess(true);
      reset();
      
      // Close modal after 1.5 seconds
      setTimeout(() => {
        onClose();
      }, 1500);

    } catch (err: any) {
      setSubmitError(err.message || "An error occurred. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClear = () => {
    reset();
    setSubmitError(null);
    setSubmitSuccess(false);
  };

  if (!open) return null;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[9999] flex justify-center items-center bg-black/50 backdrop-blur-sm"
          onClick={onClose}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          {/* Modal Container */}
          <motion.div
            id="change-password-modal-content"
            className="bg-white w-[90%] max-w-lg rounded-xl shadow-2xl p-6 relative"
            onClick={(e) => e.stopPropagation()}
            initial={{ y: -40, opacity: 0, scale: 0.95 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: -40, opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.25 }}
          >
            {/* Header */}
            <div className="flex justify-between items-center mb-6 pb-3 border-b">
              <h2 className="text-xl font-bold text-black">Change Password</h2>
              <button
                onClick={onClose}
                className="text-2xl font-bold text-gray-700 hover:text-black"
              >
                ×
              </button>
            </div>

            {/* Body */}
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
              {/* Success Message */}
              {submitSuccess && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-green-800 text-sm">
                  Password updated successfully!
                </div>
              )}

              {/* Error Message */}
              {submitError && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-800 text-sm">
                  {submitError}
                </div>
              )}

              {/* Current Password */}
              <div>
                <label className="block font-medium text-black mb-1">
                  Current Password:
                </label>
                <div className="relative">
                  <input
                    {...register("currentPassword", {
                      required: "Current password is required"
                    })}
                    type={showCurrentPassword ? "text" : "password"}
                    className="border rounded-lg px-3 py-2 pr-10 w-full text-black focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder="Enter current password"
                    disabled={isSubmitting || submitSuccess}
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 focus:outline-none"
                    tabIndex={-1}
                    disabled={isSubmitting || submitSuccess}
                  >
                    {showCurrentPassword ? (
                      <svg
                        className="w-5 h-5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"
                        />
                      </svg>
                    ) : (
                      <svg
                        className="w-5 h-5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                        />
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                        />
                      </svg>
                    )}
                  </button>
                </div>
                {errors.currentPassword && (
                  <p className="text-red-600 text-sm mt-1">{errors.currentPassword.message}</p>
                )}
              </div>

              {/* New Password */}
              <div>
                <label className="block font-medium text-black mb-1">
                  New Password:
                </label>
                <div className="relative">
                  <input
                    {...register("newPassword", {
                      required: "New password is required",
                      validate: (value) => {
                        if (!value) return "New password is required";
                        const pwd = value as string;
                        if (pwd.length < 8) return "Password must be at least 8 characters";
                        if (!/[A-Z]/.test(pwd)) return "Password must contain at least one uppercase letter";
                        if (!/[a-z]/.test(pwd)) return "Password must contain at least one lowercase letter";
                        if (!/[0-9]/.test(pwd)) return "Password must contain at least one number";
                        if (!/[!@#$%^&*(),.?":{}|<>]/.test(pwd)) return "Password must contain at least one special character (!@#$%^&*...)";
                        return true;
                      }
                    })}
                    type={showNewPassword ? "text" : "password"}
                    className="border rounded-lg px-3 py-2 pr-10 w-full text-black focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder="Enter new password"
                    disabled={isSubmitting || submitSuccess}
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 focus:outline-none"
                    tabIndex={-1}
                    disabled={isSubmitting || submitSuccess}
                  >
                    {showNewPassword ? (
                      <svg
                        className="w-5 h-5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"
                        />
                      </svg>
                    ) : (
                      <svg
                        className="w-5 h-5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                        />
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                        />
                      </svg>
                    )}
                  </button>
                </div>
                
                {/* Password Strength Indicator */}
                {newPassword && (
                  <div className="mt-2">
                    {/* Strength Bar */}
                    <div className="flex gap-1 mb-2">
                      {[1, 2, 3, 4, 5].map((level) => {
                        const strength = [
                          newPassword.length >= 8,
                          /[A-Z]/.test(newPassword),
                          /[a-z]/.test(newPassword),
                          /[0-9]/.test(newPassword),
                          /[!@#$%^&*(),.?":{}|<>]/.test(newPassword),
                        ].filter(Boolean).length;
                        
                        const colors = ['bg-red-500', 'bg-orange-500', 'bg-yellow-500', 'bg-lime-500', 'bg-green-500'];
                        const isActive = level <= strength && strength > 0;
                        const colorIndex = strength > 0 ? strength - 1 : 0;
                        
                        return (
                          <div
                            key={level}
                            className={`h-1.5 flex-1 rounded-full transition-all ${
                              isActive ? colors[colorIndex] : 'bg-gray-200'
                            }`}
                          />
                        );
                      })}
                    </div>
                    
                    {/* Password Strength Label */}
                    <p className={`text-xs font-medium mb-2 ${
                      (() => {
                        const strength = [
                          newPassword.length >= 8,
                          /[A-Z]/.test(newPassword),
                          /[a-z]/.test(newPassword),
                          /[0-9]/.test(newPassword),
                          /[!@#$%^&*(),.?":{}|<>]/.test(newPassword),
                        ].filter(Boolean).length;
                        if (strength <= 1) return 'text-red-600';
                        if (strength <= 2) return 'text-orange-600';
                        if (strength <= 3) return 'text-yellow-600';
                        if (strength <= 4) return 'text-lime-600';
                        return 'text-green-600';
                      })()
                    }`}>
                      {(() => {
                        const strength = [
                          newPassword.length >= 8,
                          /[A-Z]/.test(newPassword),
                          /[a-z]/.test(newPassword),
                          /[0-9]/.test(newPassword),
                          /[!@#$%^&*(),.?":{}|<>]/.test(newPassword),
                        ].filter(Boolean).length;
                        const labels = ['Very Weak', 'Weak', 'Fair', 'Good', 'Strong'];
                        return labels[strength - 1] || 'Very Weak';
                      })()}
                    </p>
                    
                    {/* Requirements Checklist */}
                    <div className="grid grid-cols-1 gap-1 text-xs">
                      <div className={`flex items-center gap-1.5 ${newPassword.length >= 8 ? 'text-green-600' : 'text-gray-500'}`}>
                        {newPassword.length >= 8 ? (
                          <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        ) : (
                          <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                          </svg>
                        )}
                        <span>At least 8 characters</span>
                      </div>
                      <div className={`flex items-center gap-1.5 ${/[A-Z]/.test(newPassword) ? 'text-green-600' : 'text-gray-500'}`}>
                        {/[A-Z]/.test(newPassword) ? (
                          <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        ) : (
                          <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                          </svg>
                        )}
                        <span>One uppercase letter (A-Z)</span>
                      </div>
                      <div className={`flex items-center gap-1.5 ${/[a-z]/.test(newPassword) ? 'text-green-600' : 'text-gray-500'}`}>
                        {/[a-z]/.test(newPassword) ? (
                          <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        ) : (
                          <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                          </svg>
                        )}
                        <span>One lowercase letter (a-z)</span>
                      </div>
                      <div className={`flex items-center gap-1.5 ${/[0-9]/.test(newPassword) ? 'text-green-600' : 'text-gray-500'}`}>
                        {/[0-9]/.test(newPassword) ? (
                          <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        ) : (
                          <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                          </svg>
                        )}
                        <span>One number (0-9)</span>
                      </div>
                      <div className={`flex items-center gap-1.5 ${/[!@#$%^&*(),.?":{}|<>]/.test(newPassword) ? 'text-green-600' : 'text-gray-500'}`}>
                        {/[!@#$%^&*(),.?":{}|<>]/.test(newPassword) ? (
                          <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        ) : (
                          <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                          </svg>
                        )}
                        <span>One special character (!@#$%^&*...)</span>
                      </div>
                    </div>
                  </div>
                )}
                
                {errors.newPassword && (
                  <p className="text-red-600 text-sm mt-1">{errors.newPassword.message}</p>
                )}
              </div>

              {/* Confirm Password */}
              <div>
                <label className="block font-medium text-black mb-1">
                  Confirm Password:
                </label>
                <div className="relative">
                  <input
                    {...register("confirmPassword", {
                      required: "Please confirm your password",
                      validate: (value) =>
                        value === newPassword || "Passwords do not match"
                    })}
                    type={showConfirmPassword ? "text" : "password"}
                    className="border rounded-lg px-3 py-2 pr-10 w-full text-black focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder="Confirm new password"
                    disabled={isSubmitting || submitSuccess}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 focus:outline-none"
                    tabIndex={-1}
                    disabled={isSubmitting || submitSuccess}
                  >
                    {showConfirmPassword ? (
                      <svg
                        className="w-5 h-5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"
                        />
                      </svg>
                    ) : (
                      <svg
                        className="w-5 h-5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                        />
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                        />
                      </svg>
                    )}
                  </button>
                </div>
                {confirmPassword && newPassword === confirmPassword && (
                  <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
                    <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    Passwords match
                  </p>
                )}
                {errors.confirmPassword && (
                  <p className="text-red-600 text-sm mt-1">{errors.confirmPassword.message}</p>
                )}
              </div>

              {/* Buttons */}
              <div className="flex justify-end gap-3 pt-4 border-t">
                <button
                  type="button"
                  onClick={handleClear}
                  className="px-6 py-2 bg-white text-blue-600 border border-blue-600 rounded-lg font-medium hover:bg-blue-50 transition disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={isSubmitting || submitSuccess}
                >
                  Clear
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg font-medium shadow hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  disabled={isSubmitting || submitSuccess}
                >
                  {isSubmitting ? (
                    <>
                      <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Updating...
                    </>
                  ) : submitSuccess ? (
                    "Success!"
                  ) : (
                    "Save Changes"
                  )}
                </button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default ChangePasswordModal;

