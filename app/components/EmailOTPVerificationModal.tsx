'use client';

import React, { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/app/utils/supabase";

interface Props {
  open: boolean;
  onClose: () => void;
  onVerified: (userId?: string) => void;
  email?: string;
  title?: string;
}

// Helper function to mask email for display
const maskEmail = (email: string): string => {
  if (!email || !email.includes('@')) return email || '';
  const [localPart, domain] = email.split('@');
  if (localPart.length <= 2) return `${localPart}***@${domain}`;
  return `${localPart.slice(0, 2)}***@${domain}`;
};

const EmailOTPVerificationModal: React.FC<Props> = ({ 
  open, 
  onClose, 
  onVerified, 
  email: initialEmail,
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
        console.log("Saved original session before OTP flow");
      }

      console.log("Sending OTP to email:", emailAddr);

      const { data, error: otpError } = await supabase.auth.signInWithOtp({
        email: emailAddr,
        options: {
          shouldCreateUser: true,
        }
      });

      console.log("OTP Response:", { data, error: otpError });

      if (otpError) {
        console.error("OTP Error:", otpError);
        
        // Handle specific error messages
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

      setSuccess(`Verification code sent successfully!`);
      setStep('otp');
      setCountdown(60);
      
      setTimeout(() => {
        otpRefs.current[0]?.focus();
      }, 100);

    } catch (err: any) {
      console.error("Send OTP Error:", err);
      setError(err.message || "An error occurred. Please try again.");
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
  }, [open, initialEmail, autoSendTriggered]);

  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
      window.scrollTo({ top: 0, behavior: 'instant' });
      setError(null);
      setSuccess(null);
    } else {
      document.body.style.overflow = "auto";
      setStep('sending');
      setOtp(['', '', '', '', '', '', '', '']);
      setError(null);
      setSuccess(null);
      setCountdown(0);
      setAutoSendTriggered(false);
      
      // Restore original session if modal is closed without completing verification
      if (originalSessionRef.current) {
        supabase.auth.setSession({
          access_token: originalSessionRef.current.access_token,
          refresh_token: originalSessionRef.current.refresh_token,
        }).then(({ error }) => {
          if (error) {
            console.error("Failed to restore session on modal close:", error);
          } else {
            console.log("Session restored on modal close");
          }
        });
        originalSessionRef.current = null;
      }
    }

    return () => {
      document.body.style.overflow = "auto";
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
        email: email,
        options: {
          shouldCreateUser: true,
        }
      });

      if (otpError) {
        setError(otpError.message || "Failed to resend OTP.");
        return;
      }

      setSuccess("Code resent successfully!");
      setCountdown(60);
    } catch (err: any) {
      setError(err.message || "An error occurred.");
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
      console.log("Verifying OTP for email:", email, "Code:", otpCode);

      const { data, error: verifyError } = await supabase.auth.verifyOtp({
        email: email,
        token: otpCode,
        type: 'email',
      });

      console.log("Verify Response:", { data, error: verifyError });

      if (verifyError) {
        console.error("Verify Error:", verifyError);
        setError(verifyError.message || "Invalid OTP. Please try again.");
        setIsLoading(false);
        return;
      }

      // Capture user ID BEFORE restoring original session
      const verifiedUserId = data?.user?.id;
      console.log("Verified user ID:", verifiedUserId);

      // Restore the original session after OTP verification
      if (originalSessionRef.current) {
        console.log("Restoring original session after OTP verification...");
        const { error: restoreError } = await supabase.auth.setSession({
          access_token: originalSessionRef.current.access_token,
          refresh_token: originalSessionRef.current.refresh_token,
        });
        
        if (restoreError) {
          console.error("Failed to restore original session:", restoreError);
        } else {
          console.log("Original session restored successfully");
        }
        originalSessionRef.current = null;
      }

      setSuccess("Email verified successfully!");
      
      setTimeout(() => {
        onVerified(verifiedUserId);
      }, 500);

    } catch (err: any) {
      console.error("Verify OTP Error:", err);
      setError(err.message || "An error occurred. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOTP = () => {
    verifyOTP(otp.join(''));
  };

  if (!open) return null;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[9999] flex justify-center items-start pt-24 bg-black/40 backdrop-blur-sm overflow-y-auto"
          onClick={onClose}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            className="bg-white w-[90%] max-w-[420px] rounded-2xl shadow-2xl overflow-hidden mb-10"
            onClick={(e) => e.stopPropagation()}
            initial={{ y: -20, opacity: 0, scale: 0.95 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: -20, opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
          >
            {/* Close Button */}
            <button
              onClick={onClose}
              className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors z-10"
            >
              <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            {/* Content */}
            <div className="px-8 py-10">
              
              {/* No Email Available */}
              {step === 'no_email' && (
                <div className="text-center">
                  <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-red-50 flex items-center justify-center">
                    <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                  </div>
                  <h2 className="text-xl font-semibold text-gray-900 mb-2">Invalid Email</h2>
                  <p className="text-gray-500 text-sm mb-6">
                    Please enter a valid email address to receive the verification code.
                  </p>
                  <button
                    onClick={onClose}
                    className="w-full py-3 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200 transition-colors"
                  >
                    Close
                  </button>
                </div>
              )}

              {/* Error Step */}
              {step === 'error' && (
                <div className="text-center">
                  <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-red-50 flex items-center justify-center">
                    <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                  </div>
                  <h2 className="text-xl font-semibold text-gray-900 mb-2">Unable to Send Code</h2>
                  <p className="text-gray-500 text-sm mb-6">
                    {error || "Something went wrong. Please try again."}
                  </p>
                  <div className="flex gap-3">
                    <button
                      onClick={onClose}
                      className="flex-1 py-3 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => {
                        setError(null);
                        setStep('sending');
                        sendOTP(email);
                      }}
                      disabled={isLoading}
                      className="flex-1 py-3 bg-emerald-600 text-white rounded-xl font-medium hover:bg-emerald-700 transition-colors disabled:opacity-50"
                    >
                      {isLoading ? 'Retrying...' : 'Try Again'}
                    </button>
                  </div>
                </div>
              )}

              {/* Sending Step */}
              {step === 'sending' && (
                <div className="text-center py-8">
                  <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-emerald-50 flex items-center justify-center">
                    <svg className="w-8 h-8 text-emerald-600 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <h2 className="text-xl font-semibold text-gray-900 mb-2">Sending Code</h2>
                  <p className="text-gray-500 text-sm">
                    Sending verification code to
                  </p>
                  <p className="text-emerald-600 font-medium mt-1">{email}</p>
                  <div className="mt-6">
                    <div className="w-8 h-8 mx-auto border-3 border-emerald-200 border-t-emerald-600 rounded-full animate-spin"></div>
                  </div>
                </div>
              )}

              {/* OTP Input Step */}
              {step === 'otp' && (
                <div className="text-center">
                  {/* Email Icon */}
                  <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-emerald-50 flex items-center justify-center">
                    <svg className="w-8 h-8 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                  </div>

                  {/* Title */}
                  <h2 className="text-2xl font-semibold text-gray-900 mb-2">Check your email</h2>
                  
                  {/* Subtitle */}
                  <p className="text-gray-500 text-sm mb-1">Enter the verification code sent to</p>
                  <p className="text-emerald-600 font-medium mb-6">{email}</p>

                  {/* Error Message */}
                  {error && (
                    <div className="bg-red-50 border border-red-100 rounded-lg px-4 py-2 text-red-600 text-sm mb-4">
                      {error}
                    </div>
                  )}

                  {/* Success Message */}
                  {success && (
                    <div className="bg-emerald-50 border border-emerald-100 rounded-lg px-4 py-2 text-emerald-600 text-sm mb-4">
                      {success}
                    </div>
                  )}

                  {/* OTP Input Boxes */}
                  <div className="flex justify-center gap-2 mb-6">
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
                        className={`w-10 h-12 text-center text-xl font-semibold border-2 rounded-lg transition-all duration-200
                          ${digit ? 'border-emerald-500 bg-emerald-50' : 'border-gray-200 bg-white'}
                          focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 focus:outline-none
                          text-gray-900 placeholder-gray-300`}
                        disabled={isLoading}
                        placeholder="•"
                      />
                    ))}
                  </div>

                  {/* Resend Link */}
                  <div className="mb-6">
                    {countdown > 0 ? (
                      <p className="text-gray-400 text-sm">
                        Didn&apos;t get a code? <span className="text-gray-500">Resend in {countdown}s</span>
                      </p>
                    ) : (
                      <p className="text-gray-400 text-sm">
                        Didn&apos;t get a code?{' '}
                        <button
                          onClick={handleResendOTP}
                          disabled={isLoading}
                          className="text-emerald-600 font-medium hover:text-emerald-700 hover:underline disabled:opacity-50"
                        >
                          resend
                        </button>
                      </p>
                    )}
                  </div>

                  {/* Verify Button */}
                  <button
                    onClick={() => {
                      if (otp.join('').length !== 8) {
                        setError('Please enter all 8 digits');
                        return;
                      }
                      handleVerifyOTP();
                    }}
                    disabled={isLoading}
                    className={`w-full py-3.5 rounded-xl font-semibold text-white transition-all duration-200
                      ${otp.join('').length === 8 && !isLoading
                        ? 'bg-emerald-600 hover:bg-emerald-700 shadow-lg shadow-emerald-200'
                        : 'bg-gray-300 cursor-not-allowed'
                      }`}
                  >
                    {isLoading ? (
                      <span className="flex items-center justify-center gap-2">
                        <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
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
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default EmailOTPVerificationModal;
