'use client';

import React, { useEffect, useState, useRef } from "react";
import { AlertTriangle, Mail, X } from "lucide-react";
import { supabase } from "@/app/utils/supabase";

interface Props {
  open: boolean;
  onClose: () => void;
  onVerified: (userId?: string) => void;
  email?: string;
  title?: string;
  shouldCreateUser?: boolean;
}

const EmailOTPVerificationModal: React.FC<Props> = ({
  open,
  onClose,
  onVerified,
  email: initialEmail,
  shouldCreateUser = true,
}) => {
  const [step, setStep] = useState<'sending' | 'otp' | 'no_email' | 'error'>('sending');
  const [email, setEmail] = useState(initialEmail || '');
  const [otp, setOtp] = useState(['', '', '', '', '', '', '', '']);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(0);
  const [autoSendTriggered, setAutoSendTriggered] = useState(false);

  // Store original session to restore after OTP verification
  const originalSessionRef = useRef<{ access_token: string; refresh_token: string } | null>(null);

  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Send OTP via Supabase Auth
  const sendOTP = async (emailAddr: string) => {
    setIsLoading(true);
    setError(null);
    setSuccess(null);

    try {
      // Save the original session BEFORE sending OTP
      const { data: sessionData } = await supabase.auth.getSession();
      if (sessionData?.session) {
        originalSessionRef.current = {
          access_token: sessionData.session.access_token,
          refresh_token: sessionData.session.refresh_token,
        };
      }

      const { error: otpError } = await supabase.auth.signInWithOtp({
        email: emailAddr,
        options: {
          shouldCreateUser,
        }
      });

      if (otpError) {
        let errorMessage = otpError.message || "Failed to send OTP. Please try again.";

        if (otpError.message?.includes("Email rate limit exceeded")) {
          errorMessage = "Too many attempts. Please wait a few minutes before trying again.";
        } else if (otpError.message?.includes("invalid")) {
          errorMessage = "Unable to send OTP. Please check the email address or try again later.";
        }

        setError(errorMessage);
        setStep('error');
        setIsLoading(false);
        return;
      }

      setSuccess("Verification code sent successfully!");
      setStep('otp');
      setCountdown(60);

      setTimeout(() => {
        otpRefs.current[0]?.focus();
      }, 100);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "An error occurred. Please try again.");
      setStep('error');
    } finally {
      setIsLoading(false);
    }
  };

  // Auto-send OTP when modal opens
  useEffect(() => {
    if (open && !autoSendTriggered) {
      setAutoSendTriggered(true);

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (initialEmail && emailRegex.test(initialEmail)) {
        setEmail(initialEmail);
        setStep('sending');
        sendOTP(initialEmail);
      } else {
        setStep('no_email');
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialEmail, autoSendTriggered]);

  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
      setError(null);
      setSuccess(null);
    } else {
      document.body.style.overflow = "";
      setStep('sending');
      setOtp(['', '', '', '', '', '', '', '']);
      setError(null);
      setSuccess(null);
      setCountdown(0);
      setAutoSendTriggered(false);

      // Restore original session if modal is closed without completing verification
      if (originalSessionRef.current) {
        void supabase.auth.setSession({
          access_token: originalSessionRef.current.access_token,
          refresh_token: originalSessionRef.current.refresh_token,
        });
        originalSessionRef.current = null;
      }
    }

    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  // Countdown timer for resend
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  const handleResendOTP = async () => {
    if (countdown > 0 || !email) return;

    setIsLoading(true);
    setError(null);

    try {
      const { error: otpError } = await supabase.auth.signInWithOtp({
        email,
        options: {
          shouldCreateUser,
        }
      });

      if (otpError) {
        setError(otpError.message || "Failed to resend OTP.");
        return;
      }

      setSuccess("Code resent successfully!");
      setCountdown(60);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "An error occurred.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleOTPChange = (index: number, value: string) => {
    if (value && !/^\d$/.test(value)) return;

    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);

    if (value && index < 7) {
      otpRefs.current[index + 1]?.focus();
    }

    // Auto-verify when all 8 digits are entered
    if (value && index === 7) {
      const completeOtp = newOtp.join('');
      if (completeOtp.length === 8) {
        setTimeout(() => {
          verifyOTP(completeOtp);
        }, 200);
      }
    }
  };

  const handleOTPKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
  };

  const handleOTPPaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 8);
    const newOtp = [...otp];

    for (let i = 0; i < pastedData.length; i++) {
      newOtp[i] = pastedData[i];
    }

    setOtp(newOtp);
    const nextEmpty = newOtp.findIndex(v => !v);
    otpRefs.current[nextEmpty === -1 ? 7 : nextEmpty]?.focus();

    if (pastedData.length === 8) {
      setTimeout(() => {
        verifyOTP(pastedData);
      }, 200);
    }
  };

  // Core verify function using Supabase Auth
  const verifyOTP = async (otpCode: string) => {
    if (otpCode.length !== 8 || isLoading) return;

    setIsLoading(true);
    setError(null);

    try {
      const { data, error: verifyError } = await supabase.auth.verifyOtp({
        email,
        token: otpCode,
        type: 'email',
      });

      if (verifyError) {
        setError(verifyError.message || "Invalid OTP. Please try again.");
        setIsLoading(false);
        return;
      }

      // Capture user ID BEFORE restoring original session
      const verifiedUserId = data?.user?.id;

      // Restore the original session after OTP verification
      if (originalSessionRef.current) {
        await supabase.auth.setSession({
          access_token: originalSessionRef.current.access_token,
          refresh_token: originalSessionRef.current.refresh_token,
        });
        originalSessionRef.current = null;
      }

      setSuccess("Email verified successfully!");

      setTimeout(() => {
        onVerified(verifiedUserId);
      }, 500);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "An error occurred. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOTP = () => {
    verifyOTP(otp.join(''));
  };

  if (!open) return null;

  const otpComplete = otp.join('').length === 8;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="relative flex max-h-[calc(100dvh-2rem)] w-full max-w-md flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
          aria-label="Close"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="overflow-y-auto overscroll-contain px-5 py-8 sm:px-8">
          {/* No Email Available */}
          {step === 'no_email' && (
            <div className="text-center">
              <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-red-50">
                <AlertTriangle className="h-7 w-7 text-status-danger" />
              </div>
              <h2 className="font-sans text-lg font-bold text-brand-navy">Invalid Email</h2>
              <p className="mt-1.5 text-sm text-gray-500">
                Please enter a valid email address to receive the verification code.
              </p>
              <button
                type="button"
                onClick={onClose}
                className="mt-6 min-h-11 w-full rounded-lg bg-gray-100 font-semibold text-gray-700 transition-colors hover:bg-gray-200"
              >
                Close
              </button>
            </div>
          )}

          {/* Error Step */}
          {step === 'error' && (
            <div className="text-center">
              <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-red-50">
                <AlertTriangle className="h-7 w-7 text-status-danger" />
              </div>
              <h2 className="font-sans text-lg font-bold text-brand-navy">Unable to Send Code</h2>
              <p className="mt-1.5 text-sm text-gray-500">
                {error || "Something went wrong. Please try again."}
              </p>
              <div className="mt-6 flex gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="min-h-11 flex-1 rounded-lg bg-gray-100 font-semibold text-gray-700 transition-colors hover:bg-gray-200"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setError(null);
                    setStep('sending');
                    sendOTP(email);
                  }}
                  disabled={isLoading}
                  className="min-h-11 flex-1 rounded-lg bg-brand-blue font-semibold text-white shadow-sm transition-all hover:bg-brand-blue-hover disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isLoading ? 'Retrying...' : 'Try Again'}
                </button>
              </div>
            </div>
          )}

          {/* Sending Step */}
          {step === 'sending' && (
            <div className="py-6 text-center">
              <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-blue-50">
                <Mail className="h-7 w-7 animate-pulse text-brand-blue" />
              </div>
              <h2 className="font-sans text-lg font-bold text-brand-navy">Sending Code</h2>
              <p className="mt-1.5 text-sm text-gray-500">Sending verification code to</p>
              <p className="mt-1 break-all text-sm font-medium text-brand-blue">{email}</p>
              <div className="mt-6">
                <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-blue-100 border-t-brand-blue" />
              </div>
            </div>
          )}

          {/* OTP Input Step */}
          {step === 'otp' && (
            <div className="text-center">
              <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-blue-50">
                <Mail className="h-7 w-7 text-brand-blue" />
              </div>

              <h2 className="font-sans text-xl font-bold text-brand-navy">Check your email</h2>
              <p className="mt-1.5 text-sm text-gray-500">Enter the verification code sent to</p>
              <p className="mt-1 break-all text-sm font-medium text-brand-blue">{email}</p>

              {error && (
                <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-status-danger">
                  {error}
                </div>
              )}

              {success && !error && (
                <div className="mt-4 rounded-lg border border-green-200 bg-green-50 px-4 py-2 text-sm text-green-700">
                  {success}
                </div>
              )}

              {/* OTP Input Boxes */}
              <div className="mt-6 flex justify-center gap-1.5 sm:gap-2">
                {otp.map((digit, index) => (
                  <input
                    key={index}
                    ref={(el) => { otpRefs.current[index] = el; }}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleOTPChange(index, e.target.value)}
                    onKeyDown={(e) => handleOTPKeyDown(index, e)}
                    onPaste={index === 0 ? handleOTPPaste : undefined}
                    className={[
                      "h-11 w-8 rounded-lg border-2 text-center text-lg font-semibold text-gray-900 transition-all sm:h-12 sm:w-10 sm:text-xl",
                      "focus:border-brand-blue focus:outline-none focus:ring-2 focus:ring-brand-blue/20",
                      digit ? "border-brand-blue bg-blue-50" : "border-gray-200 bg-white",
                    ].join(" ")}
                    disabled={isLoading}
                  />
                ))}
              </div>

              {/* Resend */}
              <div className="mt-5 text-sm text-gray-500">
                {countdown > 0 ? (
                  <p>
                    Didn&apos;t get a code?{' '}
                    <span className="font-medium text-gray-600">Resend in {countdown}s</span>
                  </p>
                ) : (
                  <p>
                    Didn&apos;t get a code?{' '}
                    <button
                      type="button"
                      onClick={handleResendOTP}
                      disabled={isLoading}
                      className="font-medium text-brand-blue transition-colors hover:text-brand-blue-hover hover:underline disabled:opacity-50"
                    >
                      Resend
                    </button>
                  </p>
                )}
              </div>

              {/* Verify Button */}
              <button
                type="button"
                onClick={() => {
                  if (!otpComplete) {
                    setError('Please enter all 8 digits');
                    return;
                  }
                  handleVerifyOTP();
                }}
                disabled={isLoading || !otpComplete}
                className={[
                  "mt-6 min-h-11 w-full rounded-lg font-semibold text-white transition-all",
                  otpComplete && !isLoading
                    ? "bg-brand-blue shadow-sm hover:bg-brand-blue-hover hover:shadow-md"
                    : "cursor-not-allowed bg-gray-300",
                ].join(" ")}
              >
                {isLoading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Verifying...
                  </span>
                ) : (
                  'Verify'
                )}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default EmailOTPVerificationModal;
