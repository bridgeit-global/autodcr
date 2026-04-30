'use client';

import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useForm } from "react-hook-form";
import { supabase } from "@/app/utils/supabase";
import EmailOTPVerificationModal from "./EmailOTPVerificationModal";

interface Props {
  open: boolean;
  onClose: () => void;
}

type FormValues = {
  loginName: string;
  captcha: string;
  newPassword: string;
  confirmPassword: string;
};

type Step = "enterDetails" | "sendingOtp" | "setNewPassword" | "success";

type Captcha = { display: string; value: string };
const generateCaptcha = (): Captcha => {
  const num1 = Math.floor(Math.random() * 90 + 10);
  const num2 = Math.floor(Math.random() * 90 + 10);
  return { display: `${num1}•${num2}`, value: `${num1}${num2}` };
};

const ForgotPasswordModal: React.FC<Props> = ({ open, onClose }) => {
  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    setError,
    setValue,
    watch,
  } = useForm<FormValues>();

  const [step, setStep] = useState<Step>("enterDetails");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [captcha, setCaptcha] = useState<Captcha>(() => generateCaptcha());

  const [registeredEmail, setRegisteredEmail] = useState<string>("");
  const [consultantUserId, setConsultantUserId] = useState<string>("");

  const [showEmailOTPModal, setShowEmailOTPModal] = useState(false);
  const [isOTPVerified, setIsOTPVerified] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const newPassword = watch("newPassword");
  const confirmPassword = watch("confirmPassword");

  const resetAll = () => {
    setStep("enterDetails");
    setIsSubmitting(false);
    setSubmitError(null);
    setCaptcha(generateCaptcha());
    setRegisteredEmail("");
    setConsultantUserId("");
    setShowEmailOTPModal(false);
    setIsOTPVerified(false);
    setShowNewPassword(false);
    setShowConfirmPassword(false);
    reset();
  };

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
  }, [open, reset]);

  useEffect(() => {
    if (open) resetAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const regenerateCaptcha = () => setCaptcha(generateCaptcha());

  const validateNewPassword = (): string | null => {
    const pwd = (newPassword || "").toString();
    if (!pwd) return "New password is required";
    if (pwd.length < 8) return "Password must be at least 8 characters";
    if (!/[A-Z]/.test(pwd)) return "Password must contain at least 1 uppercase letter";
    if (!/[a-z]/.test(pwd)) return "Password must contain at least 1 lowercase letter";
    if (!/[0-9]/.test(pwd)) return "Password must contain at least 1 number";
    if (!/[!@#$%^&*(),.?\":{}|<>]/.test(pwd))
      return "Password must contain at least 1 special character";
    if (pwd !== (confirmPassword || "").toString()) return "Passwords do not match";
    return null;
  };

  const handleDetailsSubmit = async (data: FormValues) => {
    setSubmitError(null);
    setIsSubmitting(true);

    if (data.captcha !== captcha.value) {
      setError("captcha", { type: "validate", message: "Invalid captcha. Please try again." });
      regenerateCaptcha();
      setIsSubmitting(false);
      return;
    }

    try {
      const loginName = data.loginName.trim();

      const { data: rows, error: rpcError } = await supabase.rpc("get_user_email_by_user_id", {
        lookup_user_id: loginName,
      });

      if (rpcError || !rows || !Array.isArray(rows) || rows.length === 0) {
        setSubmitError("Invalid details. Please try again.");
        regenerateCaptcha();
        setIsSubmitting(false);
        return;
      }

      const row = rows[0] as {
        email?: string | null;
        user_id?: string | null;
      };

      const regEmail = (row.email || "").trim().toLowerCase();

      if (!regEmail) {
        setSubmitError("Invalid details. Please try again.");
        regenerateCaptcha();
        setIsSubmitting(false);
        return;
      }

      setRegisteredEmail(regEmail);
      setConsultantUserId(row.user_id || loginName);
      setIsOTPVerified(false);
      setStep("sendingOtp");
      setShowEmailOTPModal(true);
    } catch {
      setSubmitError("An error occurred. Please try again.");
      regenerateCaptcha();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePasswordSubmit = async () => {
    setSubmitError(null);

    if (!isOTPVerified) {
      setSubmitError("Please verify OTP first.");
      return;
    }

    const pwdErr = validateNewPassword();
    if (pwdErr) {
      setError("newPassword", { type: "validate", message: pwdErr });
      setError("confirmPassword", { type: "validate", message: pwdErr });
      return;
    }

    setIsSubmitting(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password: (newPassword || "").toString(),
      });

      if (updateError) {
        setSubmitError(updateError.message || "Failed to update password. Please try again.");
        setIsSubmitting(false);
        return;
      }

      await supabase.auth.signOut();
      setStep("success");
      setTimeout(() => onClose(), 1400);
    } catch {
      setSubmitError("An error occurred. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
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
              <h2 className="text-2xl font-bold text-black">Forgot Password</h2>
              <button
                onClick={onClose}
                className="text-2xl font-bold text-gray-700 hover:text-black"
              >
                ×
              </button>
            </div>

            {submitError && (
              <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {submitError}
              </div>
            )}

            {step === "enterDetails" && (
              <form onSubmit={handleSubmit(handleDetailsSubmit)} className="space-y-6">
                <div>
                  <label className="block font-medium text-black mb-1">
                    Login Name <span className="text-red-500 text-2xl">*</span>
                  </label>
                  <input
                    {...register("loginName", { required: "Login Name is required" })}
                    className="border rounded-lg px-3 py-2 w-full text-black focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder="Enter Login Name"
                  />
                  {errors.loginName && (
                    <p className="text-red-600 text-sm mt-1">{errors.loginName.message}</p>
                  )}
                </div>

                <div>
                  <label className="block font-medium text-black mb-2">Captcha</label>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
                    <div className="flex items-center gap-3">
                      <div className="h-12 w-40 select-none rounded border border-gray-300 bg-gray-100 p-2 text-center font-mono text-lg tracking-widest text-gray-800 flex items-center justify-center shadow-sm">
                        {captcha.display}
                      </div>
                      <button
                        type="button"
                        onClick={regenerateCaptcha}
                        className="rounded border border-gray-300 bg-white px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50"
                      >
                        Refresh
                      </button>
                    </div>
                    <input
                      {...register("captcha", { required: "Captcha is required" })}
                      className="border rounded-lg px-3 py-2 text-black focus:ring-2 focus:ring-blue-500 outline-none w-40"
                      placeholder="Enter code"
                    />
                  </div>
                  {errors.captcha && (
                    <p className="text-red-600 text-sm mt-1">{errors.captcha.message}</p>
                  )}
                  <p className="text-xs text-gray-600 mt-1">Type the code from above</p>
                </div>

                <div className="text-center mt-4">
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="bg-blue-600 disabled:bg-blue-400 disabled:cursor-not-allowed text-white px-8 py-2 rounded-lg font-medium shadow hover:bg-blue-700 transition"
                  >
                    {isSubmitting ? "Checking..." : "Submit"}
                  </button>
                </div>
              </form>
            )}

            {step === "sendingOtp" && (
              <div className="space-y-3">
                <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-700">
                  Sending OTP to the registered email for{" "}
                  <span className="font-medium text-gray-900">{consultantUserId}</span>.
                </div>
                <div className="text-xs text-gray-600">{registeredEmail}</div>
              </div>
            )}

            {step === "setNewPassword" && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handlePasswordSubmit();
                }}
                className="space-y-5"
              >
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                  OTP verified. Set a new password.
                </div>

                <div>
                  <label className="block font-medium text-black mb-1">
                    New Password <span className="text-red-500 text-2xl">*</span>
                  </label>
                  <div className="relative">
                    <input
                      {...register("newPassword", { required: "New password is required" })}
                      type={showNewPassword ? "text" : "password"}
                      className="border rounded-lg px-3 py-2 w-full pr-10 text-black focus:ring-2 focus:ring-blue-500 outline-none"
                      placeholder="Enter new password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword((v) => !v)}
                      className="absolute inset-y-0 right-0 flex items-center px-3 text-gray-600 hover:text-gray-900"
                      aria-label={showNewPassword ? "Hide password" : "Show password"}
                    >
                      {showNewPassword ? (
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          className="h-5 w-5"
                        >
                          <path d="M17.94 17.94A10.94 10.94 0 0 1 12 20C7 20 2.73 16.11 1 12c.74-1.76 2-3.63 3.73-5.27" />
                          <path d="M10.58 10.58a2 2 0 0 0 2.83 2.83" />
                          <path d="M9.88 4.24A10.94 10.94 0 0 1 12 4c5 0 9.27 3.89 11 8a16.6 16.6 0 0 1-2.11 3.27" />
                          <path d="M1 1l22 22" />
                        </svg>
                      ) : (
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          className="h-5 w-5"
                        >
                          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12Z" />
                          <circle cx="12" cy="12" r="3" />
                        </svg>
                      )}
                    </button>
                  </div>
                  {errors.newPassword && (
                    <p className="text-red-600 text-sm mt-1">{errors.newPassword.message}</p>
                  )}
                </div>

                <div>
                  <label className="block font-medium text-black mb-1">
                    Confirm Password <span className="text-red-500 text-2xl">*</span>
                  </label>
                  <div className="relative">
                    <input
                      {...register("confirmPassword", { required: "Confirm password is required" })}
                      type={showConfirmPassword ? "text" : "password"}
                      className="border rounded-lg px-3 py-2 w-full pr-10 text-black focus:ring-2 focus:ring-blue-500 outline-none"
                      placeholder="Re-enter new password"
                      onPaste={(e) => e.preventDefault()}
                      onDrop={(e) => e.preventDefault()}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword((v) => !v)}
                      className="absolute inset-y-0 right-0 flex items-center px-3 text-gray-600 hover:text-gray-900"
                      aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                    >
                      {showConfirmPassword ? (
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          className="h-5 w-5"
                        >
                          <path d="M17.94 17.94A10.94 10.94 0 0 1 12 20C7 20 2.73 16.11 1 12c.74-1.76 2-3.63 3.73-5.27" />
                          <path d="M10.58 10.58a2 2 0 0 0 2.83 2.83" />
                          <path d="M9.88 4.24A10.94 10.94 0 0 1 12 4c5 0 9.27 3.89 11 8a16.6 16.6 0 0 1-2.11 3.27" />
                          <path d="M1 1l22 22" />
                        </svg>
                      ) : (
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          className="h-5 w-5"
                        >
                          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12Z" />
                          <circle cx="12" cy="12" r="3" />
                        </svg>
                      )}
                    </button>
                  </div>
                  {errors.confirmPassword && (
                    <p className="text-red-600 text-sm mt-1">{errors.confirmPassword.message}</p>
                  )}
                </div>

                <div className="flex items-center justify-between pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setIsOTPVerified(false);
                      setStep("enterDetails");
                      regenerateCaptcha();
                      setValue("captcha", "");
                    }}
                    className="text-sm font-medium text-gray-700 hover:text-gray-900"
                  >
                    Back
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="rounded bg-blue-600 px-6 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed"
                  >
                    {isSubmitting ? "Updating..." : "Update Password"}
                  </button>
                </div>
              </form>
            )}

            {step === "success" && (
              <div className="space-y-3">
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                  Password updated successfully. Please login with your new password.
                </div>
                <div className="text-xs text-gray-600">Closing…</div>
              </div>
            )}

            <EmailOTPVerificationModal
              open={showEmailOTPModal}
              onClose={() => {
                setShowEmailOTPModal(false);
                if (!isOTPVerified) {
                  setStep("enterDetails");
                  regenerateCaptcha();
                  setValue("captcha", "");
                }
              }}
              onVerified={() => {
                setIsOTPVerified(true);
                setShowEmailOTPModal(false);
                setStep("setNewPassword");
              }}
              email={registeredEmail}
              title="Verify via Email"
              shouldCreateUser={false}
            />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default ForgotPasswordModal;
