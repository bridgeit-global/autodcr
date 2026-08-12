"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { Eye, EyeOff, CheckCircle2 } from "lucide-react";
import { supabase } from "@/app/utils/supabase";
import EmailOTPVerificationModal from "./EmailOTPVerificationModal";
import Modal from "./ui/Modal";
import Button from "./ui/Button";
import Input from "./ui/Input";
import CaptchaBox, { generateCaptchaValue } from "./ui/CaptchaBox";

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
  const [captcha, setCaptcha] = useState<string>(generateCaptchaValue);
  const [registeredEmail, setRegisteredEmail] = useState("");
  const [consultantUserId, setConsultantUserId] = useState("");
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
    setCaptcha(generateCaptchaValue());
    setRegisteredEmail("");
    setConsultantUserId("");
    setShowEmailOTPModal(false);
    setIsOTPVerified(false);
    setShowNewPassword(false);
    setShowConfirmPassword(false);
    reset();
  };

  useEffect(() => {
    if (open) resetAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const regenerateCaptcha = () => setCaptcha(generateCaptchaValue());

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

    if (data.captcha.trim() !== captcha) {
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

      const row = rows[0] as { email?: string | null; user_id?: string | null };
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

  return (
    <>
      <Modal open={open} onClose={onClose} title="Forgot Password" maxWidth="md">
        {submitError && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-status-danger">
            {submitError}
          </div>
        )}

        {step === "enterDetails" && (
          <>
            <p className="mb-4 text-sm text-gray-600">
              Enter your User ID. We&apos;ll send an OTP to your registered email to reset your
              password.
            </p>
            <form onSubmit={handleSubmit(handleDetailsSubmit)} className="space-y-4">
              <Input
                label="User ID"
                placeholder="Enter your User ID"
                error={errors.loginName?.message}
                {...register("loginName", { required: "User ID is required" })}
              />

              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">Security Code</label>
                <CaptchaBox value={captcha} onRefresh={regenerateCaptcha} />
                <Input
                  placeholder="Enter the 4-digit code"
                  inputMode="numeric"
                  error={errors.captcha?.message}
                  {...register("captcha", { required: "Captcha is required" })}
                />
              </div>

              <Button type="submit" fullWidth disabled={isSubmitting}>
                {isSubmitting ? "Checking..." : "Continue"}
              </Button>
            </form>
          </>
        )}

        {step === "sendingOtp" && (
          <div className="rounded-lg border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-gray-700">
            Sending OTP to the registered email for{" "}
            <span className="font-medium text-brand-navy">{consultantUserId}</span>.
          </div>
        )}

        {step === "setNewPassword" && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void handlePasswordSubmit();
            }}
            className="space-y-4"
          >
            <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
              OTP verified. Set a new password.
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">New Password</label>
              <div className="relative">
                <input
                  {...register("newPassword", { required: "New password is required" })}
                  type={showNewPassword ? "text" : "password"}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2.5 pr-10 text-sm outline-none focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20"
                  placeholder="Enter new password"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  tabIndex={-1}
                >
                  {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {errors.newPassword && (
                <p className="mt-1 text-sm text-status-danger">{errors.newPassword.message}</p>
              )}
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">
                Confirm Password
              </label>
              <div className="relative">
                <input
                  {...register("confirmPassword", { required: "Confirm password is required" })}
                  type={showConfirmPassword ? "text" : "password"}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2.5 pr-10 text-sm outline-none focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20"
                  placeholder="Re-enter new password"
                  onPaste={(e) => e.preventDefault()}
                  onDrop={(e) => e.preventDefault()}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  tabIndex={-1}
                >
                  {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {errors.confirmPassword && (
                <p className="mt-1 text-sm text-status-danger">{errors.confirmPassword.message}</p>
              )}
            </div>

            <div className="flex items-center justify-between gap-3 pt-1">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setIsOTPVerified(false);
                  setStep("enterDetails");
                  regenerateCaptcha();
                  setValue("captcha", "");
                }}
              >
                Back
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Updating..." : "Update Password"}
              </Button>
            </div>
          </form>
        )}

        {step === "success" && (
          <div className="space-y-4 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-green-50">
              <CheckCircle2 className="h-6 w-6 text-status-success" />
            </div>
            <p className="text-sm text-gray-700">
              Password updated successfully. Please sign in with your new password.
            </p>
            <p className="text-xs text-gray-500">Closing…</p>
          </div>
        )}
      </Modal>

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
    </>
  );
};

export default ForgotPasswordModal;
