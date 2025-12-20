'use client';

import React, { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/app/utils/supabase";

interface Props {
  open: boolean;
  onClose: () => void;
  onVerified: () => void;
  phoneNumber?: string;
  title?: string;
}

// Helper function to format phone number
const formatPhoneNumber = (phoneNum: string): string => {
  const digits = phoneNum.replace(/\D/g, '');
  if (digits.length === 10) {
    return `+91${digits}`;
  }
  if (digits.length > 10) {
    return `+${digits}`;
  }
  return phoneNum;
};

const OTPVerificationModal: React.FC<Props> = ({ 
  open, 
  onClose, 
  onVerified, 
  phoneNumber: initialPhone,
  title = "Verify Your Identity" 
}) => {
  const [step, setStep] = useState<'sending' | 'otp' | 'no_phone'>('sending');
  const [phone, setPhone] = useState(initialPhone || '');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(0);
  const [autoSendTriggered, setAutoSendTriggered] = useState(false);
  
  // Store original session to restore after OTP verification
  const originalSessionRef = useRef<{ access_token: string; refresh_token: string } | null>(null);
  
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Auto-send OTP when modal opens
  useEffect(() => {
    const saveSessionAndSendOTP = async (phoneNum: string) => {
      setIsLoading(true);
      setError(null);
      setSuccess(null);

      try {
        // IMPORTANT: Save the original session BEFORE sending OTP
        // This is needed because signInWithOtp/verifyOtp will replace the session
        const { data: sessionData } = await supabase.auth.getSession();
        if (sessionData?.session) {
          originalSessionRef.current = {
            access_token: sessionData.session.access_token,
            refresh_token: sessionData.session.refresh_token,
          };
          console.log("Saved original session before OTP flow");
        }

        const formattedPhone = formatPhoneNumber(phoneNum);
        console.log("Auto-sending OTP to:", formattedPhone);

        const { data, error: otpError } = await supabase.auth.signInWithOtp({
          phone: formattedPhone,
        });

        console.log("OTP Response:", { data, error: otpError });

        if (otpError) {
          console.error("OTP Error:", otpError);
          setError(otpError.message || "Failed to send OTP. Please try again.");
          setIsLoading(false);
          return;
        }

        setSuccess(`OTP sent to +91 ${phoneNum.slice(-10)}. Please check your phone.`);
        setStep('otp');
        setCountdown(60);
        
        setTimeout(() => {
          otpRefs.current[0]?.focus();
        }, 100);

      } catch (err: any) {
        console.error("Send OTP Error:", err);
        setError(err.message || "An error occurred. Please try again.");
      } finally {
        setIsLoading(false);
      }
    };

    if (open && !autoSendTriggered) {
      setAutoSendTriggered(true);
      
      if (initialPhone && initialPhone.length >= 10) {
        setPhone(initialPhone);
        setStep('sending');
        saveSessionAndSendOTP(initialPhone);
      } else {
        // No phone number available
        setStep('no_phone');
      }
    }
  }, [open, initialPhone, autoSendTriggered]);

  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
      setError(null);
      setSuccess(null);
    } else {
      document.body.style.overflow = "auto";
      setStep('sending');
      setOtp(['', '', '', '', '', '']);
      setError(null);
      setSuccess(null);
      setCountdown(0);
      setAutoSendTriggered(false);
      
      // Restore original session if modal is closed without completing verification
      // This handles the case where user cancels the OTP flow
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
    if (countdown > 0 || !phone) return;
    
    setIsLoading(true);
    setError(null);

    try {
      const formattedPhone = formatPhoneNumber(phone);
      const { error: otpError } = await supabase.auth.signInWithOtp({
        phone: formattedPhone,
      });

      if (otpError) {
        setError(otpError.message || "Failed to resend OTP.");
        return;
      }

      setSuccess("OTP resent successfully!");
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

    if (value && index < 5) {
      otpRefs.current[index + 1]?.focus();
    }
    
    // Auto-verify when all 6 digits are entered
    if (value && index === 5) {
      const completeOtp = newOtp.join('');
      if (completeOtp.length === 6) {
        // Small delay to show the last digit before verifying
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
    const pastedData = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    const newOtp = [...otp];
    
    for (let i = 0; i < pastedData.length; i++) {
      newOtp[i] = pastedData[i];
    }
    
    setOtp(newOtp);
    const nextEmpty = newOtp.findIndex(v => !v);
    otpRefs.current[nextEmpty === -1 ? 5 : nextEmpty]?.focus();
    
    // Auto-verify if all 6 digits pasted
    if (pastedData.length === 6) {
      setTimeout(() => {
        verifyOTP(pastedData);
      }, 200);
    }
  };

  // Core verify function
  const verifyOTP = async (otpCode: string) => {
    if (otpCode.length !== 6 || isLoading) return;

    setIsLoading(true);
    setError(null);

    try {
      const formattedPhone = formatPhoneNumber(phone);
      console.log("Verifying OTP for:", formattedPhone, "Code:", otpCode);

      const { data, error: verifyError } = await supabase.auth.verifyOtp({
        phone: formattedPhone,
        token: otpCode,
        type: 'sms',
      });

      console.log("Verify Response:", { data, error: verifyError });

      if (verifyError) {
        console.error("Verify Error:", verifyError);
        setError(verifyError.message || "Invalid OTP. Please try again.");
        setIsLoading(false);
        return;
      }

      // IMPORTANT: Restore the original session after OTP verification
      // This is needed because verifyOtp creates a new session for the phone user
      if (originalSessionRef.current) {
        console.log("Restoring original session after OTP verification...");
        const { error: restoreError } = await supabase.auth.setSession({
          access_token: originalSessionRef.current.access_token,
          refresh_token: originalSessionRef.current.refresh_token,
        });
        
        if (restoreError) {
          console.error("Failed to restore original session:", restoreError);
          // Continue anyway - OTP was verified successfully
        } else {
          console.log("Original session restored successfully");
        }
      }

      setSuccess("Phone verified successfully!");
      
      setTimeout(() => {
        onVerified();
      }, 500);

    } catch (err: any) {
      console.error("Verify OTP Error:", err);
      setError(err.message || "An error occurred. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  // Button click handler (uses current otp state)
  const handleVerifyOTP = () => {
    verifyOTP(otp.join(''));
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
          <motion.div
            className="bg-white w-[90%] max-w-md rounded-xl shadow-2xl p-6 relative"
            onClick={(e) => e.stopPropagation()}
            initial={{ y: -40, opacity: 0, scale: 0.95 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: -40, opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.25 }}
          >
            {/* Header */}
            <div className="flex justify-between items-center mb-6 pb-3 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
              <button
                onClick={onClose}
                className="text-2xl font-bold text-gray-700 hover:text-black"
              >
                ×
              </button>
            </div>

            {/* Success Message */}
            {success && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-green-800 text-sm mb-4">
                {success}
              </div>
            )}

            {/* Error Message */}
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-800 text-sm mb-4">
                {error}
              </div>
            )}

            {/* No Phone Number Available */}
            {step === 'no_phone' && (
              <div className="space-y-4 text-center py-6">
                <div className="flex justify-center">
                  <svg className="w-16 h-16 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <div>
                  <p className="text-base font-medium text-gray-900">No Phone Number Found</p>
                  <p className="text-sm text-gray-600 mt-2">
                    Your account doesn't have a registered mobile number. Please contact support to update your profile.
                  </p>
                </div>
                <button
                  onClick={onClose}
                  className="mt-4 px-6 py-2 bg-gray-600 text-white rounded-md text-sm font-medium hover:bg-gray-700 transition"
                >
                  Close
                </button>
              </div>
            )}

            {/* Sending OTP Step */}
            {step === 'sending' && (
              <div className="space-y-4 text-center py-8">
                <div className="flex justify-center">
                  <svg className="animate-spin h-10 w-10 text-emerald-600" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                </div>
                <p className="text-sm text-gray-600">
                  Sending OTP to your registered mobile number...
                </p>
                <p className="text-xs text-gray-500">
                  +91 {phone.slice(-10)}
                </p>
              </div>
            )}

            {/* OTP Input Step */}
            {step === 'otp' && (
              <div className="space-y-4">
                <p className="text-sm text-gray-600 text-center">
                  Enter the 6-digit code sent to <span className="font-medium">+91 {phone.slice(-10)}</span>
                </p>

                {/* OTP Input Boxes */}
                <div className="flex justify-center gap-2">
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
                      className="w-11 h-12 text-center text-lg font-semibold border border-gray-300 rounded-lg focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 text-gray-900"
                      disabled={isLoading}
                    />
                  ))}
                </div>

                {/* Verifying indicator */}
                {isLoading && (
                  <div className="flex items-center justify-center gap-2 text-emerald-600">
                    <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    <span className="text-sm font-medium">Verifying...</span>
                  </div>
                )}

                {/* Resend OTP */}
                {!isLoading && (
                  <div className="text-center">
                    {countdown > 0 ? (
                      <p className="text-sm text-gray-500">
                        Resend OTP in <span className="font-semibold">{countdown}s</span>
                      </p>
                    ) : (
                      <button
                        onClick={handleResendOTP}
                        disabled={isLoading}
                        className="text-sm text-emerald-600 hover:text-emerald-700 font-medium"
                      >
                        Resend OTP
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default OTPVerificationModal;
