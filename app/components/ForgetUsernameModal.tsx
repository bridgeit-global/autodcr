"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { CheckCircle2 } from "lucide-react";
import Modal from "./ui/Modal";
import Button from "./ui/Button";
import Input from "./ui/Input";
import CaptchaBox, { generateCaptchaValue } from "./ui/CaptchaBox";
import EmailOTPVerificationModal from "./EmailOTPVerificationModal";

interface Props {
  open: boolean;
  onClose: () => void;
}

type FormValues = {
  email: string;
  captcha: string;
};

type Step = "enterDetails" | "sendingOtp" | "success";

const ForgetUsernameModal: React.FC<Props> = ({ open, onClose }) => {
  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    setError,
    getValues,
  } = useForm<FormValues>();

  const [step, setStep] = useState<Step>("enterDetails");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [captcha, setCaptcha] = useState<string>(generateCaptchaValue);
  const [registeredEmail, setRegisteredEmail] = useState("");
  const [recoveredUserId, setRecoveredUserId] = useState("");
  const [emailSent, setEmailSent] = useState(false);
  const [showEmailOTPModal, setShowEmailOTPModal] = useState(false);

  const resetAll = () => {
    setStep("enterDetails");
    setIsSubmitting(false);
    setSubmitError(null);
    setCaptcha(generateCaptchaValue());
    setRegisteredEmail("");
    setRecoveredUserId("");
    setEmailSent(false);
    setShowEmailOTPModal(false);
    reset();
  };

  useEffect(() => {
    if (open) resetAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const regenerateCaptcha = () => setCaptcha(generateCaptchaValue());

  const completeRecovery = async () => {
    const email = getValues("email").trim().toLowerCase();

    try {
      const res = await fetch("/api/recover-username", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "complete", email }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setSubmitError(data.error || "Failed to recover username. Please try again.");
        setStep("enterDetails");
        return;
      }

      setRecoveredUserId(data.user_id || "");
      setEmailSent(Boolean(data.email_sent));
      setStep("success");
    } catch {
      setSubmitError("An error occurred. Please try again.");
      setStep("enterDetails");
    }
  };

  const onSubmit = async (data: FormValues) => {
    setSubmitError(null);
    setIsSubmitting(true);

    if (data.captcha.trim() !== captcha) {
      setError("captcha", { type: "validate", message: "Invalid captcha. Please try again." });
      regenerateCaptcha();
      setIsSubmitting(false);
      return;
    }

    try {
      const res = await fetch("/api/recover-username", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "lookup",
          email: data.email.trim().toLowerCase(),
        }),
      });

      const result = await res.json().catch(() => ({}));
      if (!res.ok) {
        setSubmitError(result.error || "No account found for this email.");
        regenerateCaptcha();
        setIsSubmitting(false);
        return;
      }

      setRegisteredEmail(result.email || data.email.trim().toLowerCase());
      setStep("sendingOtp");
      setShowEmailOTPModal(true);
    } catch {
      setSubmitError("An error occurred. Please try again.");
      regenerateCaptcha();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <Modal open={open} onClose={onClose} title="Forgot Username" maxWidth="md">
        {submitError && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-status-danger">
            {submitError}
          </div>
        )}

        {step === "enterDetails" && (
          <>
            <p className="mb-4 text-sm text-gray-600">
              Enter your registered email address. We&apos;ll verify it with an OTP and then send
              your User ID to that email.
            </p>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <Input
                label="Email ID"
                type="email"
                placeholder="Enter your registered email"
                autoComplete="email"
                error={errors.email?.message}
                {...register("email", {
                  required: "Email is required",
                  pattern: {
                    value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                    message: "Invalid email format",
                  },
                })}
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
            Sending OTP to{" "}
            <span className="font-medium text-brand-navy">{registeredEmail}</span>…
          </div>
        )}

        {step === "success" && (
          <div className="space-y-4 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-green-50">
              <CheckCircle2 className="h-6 w-6 text-status-success" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Your User ID is</p>
              <p className="mt-2 rounded-lg bg-gray-50 px-4 py-3 font-mono text-xl font-bold tracking-wide text-brand-navy">
                {recoveredUserId}
              </p>
            </div>
            {emailSent ? (
              <p className="text-xs text-gray-500">
                A copy has also been sent to {registeredEmail}.
              </p>
            ) : (
              <p className="text-xs text-amber-600">
                Please note your User ID above. Email delivery is currently unavailable.
              </p>
            )}
            <Button type="button" fullWidth onClick={onClose}>
              Back to Sign In
            </Button>
          </div>
        )}
      </Modal>

      <EmailOTPVerificationModal
        open={showEmailOTPModal}
        onClose={() => {
          setShowEmailOTPModal(false);
          if (step !== "success") {
            setStep("enterDetails");
            regenerateCaptcha();
          }
        }}
        onVerified={() => {
          setShowEmailOTPModal(false);
          void completeRecovery();
        }}
        email={registeredEmail}
        title="Verify Your Email"
        shouldCreateUser={false}
      />
    </>
  );
};

export default ForgetUsernameModal;
