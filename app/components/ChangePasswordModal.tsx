'use client';

import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useForm } from "react-hook-form";
import {
  Check,
  CheckCircle2,
  CircleX,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  Lock,
  ShieldCheck,
  X,
} from "lucide-react";
import { supabase } from "@/app/utils/supabase";
import Button from "@/app/components/ui/Button";
import OTPVerificationModal from "./OTPVerificationModal";

interface Props {
  open: boolean;
  onClose: () => void;
}

type FormValues = {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
};

type PasswordStrength = {
  score: number;
  label: string;
  colorClass: string;
  barColor: string;
  checks: {
    length: boolean;
    uppercase: boolean;
    lowercase: boolean;
    number: boolean;
    special: boolean;
  };
};

function getPasswordStrength(password: string): PasswordStrength {
  const checks = {
    length: password.length >= 8,
    uppercase: /[A-Z]/.test(password),
    lowercase: /[a-z]/.test(password),
    number: /[0-9]/.test(password),
    special: /[!@#$%^&*(),.?":{}|<>]/.test(password),
  };
  const score = Object.values(checks).filter(Boolean).length;
  const tiers = [
    { label: "Very Weak", colorClass: "text-red-600", barColor: "bg-red-500" },
    { label: "Weak", colorClass: "text-orange-600", barColor: "bg-orange-500" },
    { label: "Fair", colorClass: "text-amber-600", barColor: "bg-amber-500" },
    { label: "Good", colorClass: "text-lime-600", barColor: "bg-lime-500" },
    { label: "Strong", colorClass: "text-emerald-600", barColor: "bg-emerald-500" },
  ];
  const tier = tiers[Math.max(score - 1, 0)] ?? tiers[0];

  return { score, checks, ...tier };
}

function PasswordSection({
  title,
  subtitle,
  icon,
  children,
}: {
  title: string;
  subtitle?: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-brand-blue">
          {icon}
        </span>
        <div>
          <h3 className="text-base font-semibold text-brand-navy">{title}</h3>
          {subtitle ? <p className="mt-0.5 text-sm text-gray-500">{subtitle}</p> : null}
        </div>
      </div>
      {children}
    </section>
  );
}

function PasswordField({
  label,
  placeholder,
  show,
  onToggleShow,
  disabled,
  status = "default",
  trailing,
  error,
  success,
  registerProps,
}: {
  label: string;
  placeholder: string;
  show: boolean;
  onToggleShow: () => void;
  disabled?: boolean;
  status?: "default" | "success" | "error";
  trailing?: React.ReactNode;
  error?: string | null;
  success?: string | null;
  registerProps: React.InputHTMLAttributes<HTMLInputElement>;
}) {
  const borderClass =
    status === "success"
      ? "border-emerald-300 focus:border-emerald-400 focus:ring-emerald-200"
      : status === "error"
        ? "border-red-300 focus:border-red-400 focus:ring-red-200"
        : "border-gray-200 focus:border-brand-blue focus:ring-brand-blue/20";

  return (
    <div className="space-y-2">
      <label className="text-xs font-semibold uppercase tracking-wide text-gray-400">{label}</label>
      <div className="relative">
        <input
          {...registerProps}
          type={show ? "text" : "password"}
          placeholder={placeholder}
          disabled={disabled}
          className={[
            "w-full rounded-xl border bg-white px-3.5 py-2.5 pr-20 text-sm text-gray-900",
            "placeholder:text-gray-400 focus:outline-none focus:ring-2",
            "disabled:cursor-not-allowed disabled:bg-gray-50",
            borderClass,
          ].join(" ")}
        />
        <div className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-1">
          {trailing}
          <button
            type="button"
            onClick={onToggleShow}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 disabled:opacity-50"
            tabIndex={-1}
            disabled={disabled}
            aria-label={show ? "Hide password" : "Show password"}
          >
            {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
      </div>
      {error ? <p className="text-xs font-medium text-red-600">{error}</p> : null}
      {success ? (
        <p className="flex items-center gap-1 text-xs font-medium text-emerald-600">
          <Check className="h-3.5 w-3.5" strokeWidth={3} />
          {success}
        </p>
      ) : null}
    </div>
  );
}

function RequirementItem({ met, label }: { met: boolean; label: string }) {
  return (
    <div className={`flex items-center gap-2 text-xs ${met ? "text-emerald-600" : "text-gray-500"}`}>
      {met ? (
        <Check className="h-3.5 w-3.5 shrink-0" strokeWidth={3} />
      ) : (
        <CircleX className="h-3.5 w-3.5 shrink-0 text-gray-300" />
      )}
      <span>{label}</span>
    </div>
  );
}

const ChangePasswordModal: React.FC<Props> = ({ open, onClose }) => {
  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    watch,
  } = useForm<FormValues>();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  
  // Password validation states
  const [isCurrentPasswordVerified, setIsCurrentPasswordVerified] = useState(false);
  const [isVerifyingCurrentPassword, setIsVerifyingCurrentPassword] = useState(false);
  const [currentPasswordError, setCurrentPasswordError] = useState<string | null>(null);
  
  // OTP verification states
  const [showOTPModal, setShowOTPModal] = useState(false);
  const [isOTPVerified, setIsOTPVerified] = useState(false);
  const [userPhone, setUserPhone] = useState<string>('');
  const [userEmail, setUserEmail] = useState<string>('');

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
      setIsOTPVerified(false);
      
      // Load user phone and email from metadata
      const loadUserData = async () => {
        try {
          // Helper to extract phone from metadata object
          const getPhoneFromMetadata = (metadata: any): string | null => {
            if (!metadata) return null;
            // Try different possible field names
            return metadata.alternate_phone || 
                   metadata.mobile || 
                   metadata.phone || 
                   metadata.phone_number ||
                   metadata.mobileNo ||
                   null;
          };
          
          // Try from localStorage first
          const storedMetadata = localStorage.getItem("userMetadata");
          if (storedMetadata) {
            const metadata = JSON.parse(storedMetadata);
            const phone = getPhoneFromMetadata(metadata);
            if (phone) {
              setUserPhone(phone);
              console.log("Loaded phone from localStorage:", phone);
            }
            // Also get email from localStorage metadata
            if (metadata.email) {
              setUserEmail(metadata.email);
              console.log("Loaded email from localStorage:", metadata.email);
              return;
            }
          }
          
          // Fallback to Supabase user metadata
          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
            // Store email before any OTP operations
            if (user.email) {
              setUserEmail(user.email);
              console.log("Loaded email from Supabase:", user.email);
            }
            
            const phone = getPhoneFromMetadata(user?.user_metadata);
            if (phone && !userPhone) {
              setUserPhone(phone);
              console.log("Loaded phone from Supabase:", phone);
            }
          }
        } catch (err) {
          console.error("Error loading user data:", err);
        }
      };
      
      loadUserData();
    } else {
      document.body.style.overflow = "auto";
      reset(); // clear fields when modal closes
      setSubmitError(null);
      setSubmitSuccess(false);
      setShowCurrentPassword(false);
      setShowNewPassword(false);
      setShowConfirmPassword(false);
      setIsOTPVerified(false);
      setShowOTPModal(false);
      setUserEmail('');
      setUserPhone('');
      setIsCurrentPasswordVerified(false);
      setCurrentPasswordError(null);
    }

    return () => {
      document.body.style.overflow = "auto";
    };
  }, [open, reset]);

  const newPassword = watch("newPassword");
  const confirmPassword = watch("confirmPassword");
  const currentPassword = watch("currentPassword");

  // Validate new password meets all requirements
  const isNewPasswordValid = () => {
    if (!newPassword) return false;
    const pwd = newPassword as string;
    return (
      pwd.length >= 8 &&
      /[A-Z]/.test(pwd) &&
      /[a-z]/.test(pwd) &&
      /[0-9]/.test(pwd) &&
      /[!@#$%^&*(),.?":{}|<>]/.test(pwd) &&
      newPassword === confirmPassword
    );
  };

  // Verify current password
  const verifyCurrentPassword = async (password: string) => {
    if (!password || !userEmail) {
      setIsCurrentPasswordVerified(false);
      return;
    }

    setIsVerifyingCurrentPassword(true);
    setCurrentPasswordError(null);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: userEmail,
        password: password,
      });

      if (error) {
        setIsCurrentPasswordVerified(false);
        setCurrentPasswordError("Current password is incorrect");
      } else {
        setIsCurrentPasswordVerified(true);
        setCurrentPasswordError(null);
      }
    } catch (err) {
      setIsCurrentPasswordVerified(false);
      setCurrentPasswordError("Error verifying password");
    } finally {
      setIsVerifyingCurrentPassword(false);
    }
  };

  // Debounced current password verification
  useEffect(() => {
    if (!currentPassword || !userEmail) {
      setIsCurrentPasswordVerified(false);
      setCurrentPasswordError(null);
      return;
    }

    const timer = setTimeout(() => {
      verifyCurrentPassword(currentPassword);
    }, 1000); // Wait 1 second after user stops typing

    return () => clearTimeout(timer);
  }, [currentPassword, userEmail]);

  const onSubmit = async (data: FormValues) => {
    // Step 0: Require OTP verification first
    if (!isOTPVerified) {
      setShowOTPModal(true);
      return;
    }
    
    setIsSubmitting(true);
    setSubmitError(null);
    setSubmitSuccess(false);

    try {
      // Step 1: Use stored email (saved before OTP verification)
      if (!userEmail) {
        setSubmitError("User email not found. Please close and reopen this modal.");
        setIsSubmitting(false);
        return;
      }

      // Step 2: Verify current password by attempting to sign in
      const { error: verifyError } = await supabase.auth.signInWithPassword({
        email: userEmail,
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
  
  const handleOTPVerified = () => {
    setIsOTPVerified(true);
    setShowOTPModal(false);
    setSubmitError(null);
  };

  const handleClear = () => {
    reset();
    setSubmitError(null);
    setSubmitSuccess(false);
    setIsOTPVerified(false);
    setIsCurrentPasswordVerified(false);
    setCurrentPasswordError(null);
  };

  if (!open) return null;

  const strength = newPassword ? getPasswordStrength(newPassword) : null;
  const canVerifyOtp = isCurrentPasswordVerified && isNewPasswordValid();
  const passwordsMatch = Boolean(confirmPassword && newPassword === confirmPassword);

  // Step 1: current password only. Step 2: revealed after verified.
  const showNewPasswordStep = isCurrentPasswordVerified;

  return (
    <>
      <AnimatePresence>
        {open && (
          <motion.div
            className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              id="change-password-modal-content"
              className="flex max-h-[calc(100dvh-2rem)] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
              onClick={(e) => e.stopPropagation()}
              initial={{ y: -24, opacity: 0, scale: 0.97 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: -24, opacity: 0, scale: 0.97 }}
              transition={{ duration: 0.2 }}
            >
              <div className="flex shrink-0 items-center justify-between border-b border-gray-100 px-5 py-4 md:px-6">
                <div className="flex items-start gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-brand-blue">
                    <KeyRound className="h-5 w-5" />
                  </span>
                  <div>
                    <h2 className="text-lg font-semibold tracking-tight text-brand-navy md:text-xl">
                      Change Password
                    </h2>
                    <p className="mt-0.5 text-sm text-gray-500">
                      Verify your identity, then set a new secure password
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  className="flex h-9 w-9 items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700"
                  aria-label="Close change password"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <form
                onSubmit={handleSubmit(onSubmit)}
                className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-5 py-5 md:px-6"
              >
                {submitSuccess && (
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
                    Password updated successfully!
                  </div>
                )}

                {submitError && (
                  <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-800">
                    {submitError}
                  </div>
                )}

                <PasswordSection
                  title="Current Password"
                  subtitle="Confirm your existing password to continue"
                  icon={<Lock className="h-4 w-4" />}
                >
                  <PasswordField
                    label="Current password"
                    placeholder="Enter current password"
                    show={showCurrentPassword}
                    onToggleShow={() => setShowCurrentPassword((v) => !v)}
                    disabled={isSubmitting || submitSuccess}
                    status={
                      isCurrentPasswordVerified
                        ? "success"
                        : currentPasswordError
                          ? "error"
                          : "default"
                    }
                    trailing={
                      isVerifyingCurrentPassword ? (
                        <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
                      ) : isCurrentPasswordVerified ? (
                        <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                      ) : null
                    }
                    error={
                      currentPasswordError ||
                      (errors.currentPassword?.message && !currentPasswordError
                        ? errors.currentPassword.message
                        : null)
                    }
                    success={isCurrentPasswordVerified ? "Current password verified" : null}
                    registerProps={register("currentPassword", {
                      required: "Current password is required",
                    })}
                  />
                </PasswordSection>

                <AnimatePresence initial={false}>
                  {showNewPasswordStep && (
                    <motion.div
                      key="new-password-step"
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 8 }}
                      transition={{ duration: 0.22 }}
                      className="space-y-4"
                    >
                      <PasswordSection
                        title="New Password"
                        subtitle="Choose a strong password that meets all requirements"
                        icon={<KeyRound className="h-4 w-4" />}
                      >
                        <div className="space-y-4">
                          <PasswordField
                            label="New password"
                            placeholder="Enter new password"
                            show={showNewPassword}
                            onToggleShow={() => setShowNewPassword((v) => !v)}
                            disabled={isSubmitting || submitSuccess}
                            error={errors.newPassword?.message}
                            registerProps={register("newPassword", {
                              required: "New password is required",
                              validate: (value) => {
                                if (!value) return "New password is required";
                                const pwd = value as string;
                                if (pwd.length < 8) return "Password must be at least 8 characters";
                                if (!/[A-Z]/.test(pwd))
                                  return "Password must contain at least one uppercase letter";
                                if (!/[a-z]/.test(pwd))
                                  return "Password must contain at least one lowercase letter";
                                if (!/[0-9]/.test(pwd))
                                  return "Password must contain at least one number";
                                if (!/[!@#$%^&*(),.?":{}|<>]/.test(pwd))
                                  return "Password must contain at least one special character";
                                return true;
                              },
                            })}
                          />

                          {strength ? (
                            <div className="rounded-xl border border-gray-100 bg-surface px-4 py-3">
                              <div className="mb-2 flex items-center justify-between gap-2">
                                <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                                  Password strength
                                </p>
                                <p className={`text-xs font-semibold ${strength.colorClass}`}>
                                  {strength.label}
                                </p>
                              </div>
                              <div className="mb-3 flex gap-1">
                                {[1, 2, 3, 4, 5].map((level) => (
                                  <div
                                    key={level}
                                    className={[
                                      "h-1.5 flex-1 rounded-full transition-all",
                                      level <= strength.score ? strength.barColor : "bg-gray-200",
                                    ].join(" ")}
                                  />
                                ))}
                              </div>
                              <div className="grid gap-1.5 sm:grid-cols-2">
                                <RequirementItem met={strength.checks.length} label="At least 8 characters" />
                                <RequirementItem met={strength.checks.uppercase} label="One uppercase letter" />
                                <RequirementItem met={strength.checks.lowercase} label="One lowercase letter" />
                                <RequirementItem met={strength.checks.number} label="One number" />
                                <RequirementItem met={strength.checks.special} label="One special character" />
                              </div>
                            </div>
                          ) : null}

                          <PasswordField
                            label="Confirm password"
                            placeholder="Re-enter new password"
                            show={showConfirmPassword}
                            onToggleShow={() => setShowConfirmPassword((v) => !v)}
                            disabled={isSubmitting || submitSuccess}
                            status={passwordsMatch ? "success" : errors.confirmPassword ? "error" : "default"}
                            error={errors.confirmPassword?.message}
                            success={passwordsMatch ? "Passwords match" : null}
                            registerProps={register("confirmPassword", {
                              required: "Please confirm your password",
                              validate: (value) => value === newPassword || "Passwords do not match",
                            })}
                          />
                        </div>
                      </PasswordSection>

                      <PasswordSection
                        title="Identity Verification"
                        subtitle="OTP verification is required before saving your new password"
                        icon={<ShieldCheck className="h-4 w-4" />}
                      >
                        {!isOTPVerified ? (
                          <div
                            className={[
                              "rounded-xl border px-4 py-4",
                              canVerifyOtp
                                ? "border-brand-blue/20 bg-gradient-to-r from-blue-50/80 to-white"
                                : "border-gray-100 bg-surface",
                            ].join(" ")}
                          >
                            <div className="flex items-start gap-3">
                              <span
                                className={[
                                  "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
                                  canVerifyOtp ? "bg-blue-100 text-brand-blue" : "bg-gray-100 text-gray-400",
                                ].join(" ")}
                              >
                                <ShieldCheck className="h-4 w-4" />
                              </span>
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-semibold text-brand-navy">OTP verification required</p>
                                <p className="mt-1 text-xs leading-relaxed text-gray-500">
                                  {canVerifyOtp
                                    ? "Your password details look good. Tap below to receive an OTP on your registered mobile number."
                                    : "Please fill in a valid new password and confirmation first."}
                                </p>
                                {canVerifyOtp && userPhone && (
                                  <p className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-brand-blue/20 bg-blue-50 px-2.5 py-1 text-xs font-semibold text-brand-blue">
                                    <svg className="h-3.5 w-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                      <rect x="5" y="2" width="14" height="20" rx="2" ry="2"/><line x1="12" y1="18" x2="12.01" y2="18"/>
                                    </svg>
                                    OTP will be sent to ••••••{userPhone.slice(-4)}
                                  </p>
                                )}
                              </div>
                            </div>
                            <Button
                              type="button"
                              fullWidth
                              className="mt-4"
                              disabled={!canVerifyOtp}
                              onClick={() => setShowOTPModal(true)}
                            >
                              Send OTP &amp; Verify
                            </Button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
                            <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />
                            <p className="text-sm font-medium text-emerald-800">
                              Identity verified. You can now save your new password.
                            </p>
                          </div>
                        )}
                      </PasswordSection>

                      <div className="sticky bottom-0 flex justify-end gap-3 border-t border-gray-100 bg-white pt-4">
                        <Button
                          type="button"
                          variant="ghost"
                          onClick={handleClear}
                          disabled={isSubmitting || submitSuccess}
                        >
                          Clear
                        </Button>
                        <Button type="submit" disabled={isSubmitting || submitSuccess || !isOTPVerified}>
                          {isSubmitting ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Updating…
                            </>
                          ) : submitSuccess ? (
                            "Saved!"
                          ) : (
                            "Save Changes"
                          )}
                        </Button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <OTPVerificationModal
        open={showOTPModal}
        onClose={() => setShowOTPModal(false)}
        onVerified={handleOTPVerified}
        phoneNumber={userPhone}
        title="Verify Identity for Password Change"
      />
    </>
  );
};

export default ChangePasswordModal;

