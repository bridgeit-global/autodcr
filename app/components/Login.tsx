"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { useRouter } from "next/navigation";
import ForgotPasswordModal from "./ForgotPasswordModal";
import ForgetUsernameModal from "./ForgetUsernameModal";
import { supabase } from "../utils/supabase";

type HeroSectionProps = {
  slides: string[];
};

type LoginForm = {
  username: string;
  password: string;
  captcha: string;
};

// Generate random captcha code
const generateCaptcha = () => {
  const num1 = Math.floor(Math.random() * 90 + 10); // 2-digit number
  const num2 = Math.floor(Math.random() * 90 + 10); // 2-digit number
  return {
    display: `${num1}•${num2}`,
    value: `${num1}${num2}`
  };
};

const HeroSection = ({ slides }: HeroSectionProps) => {
  const router = useRouter();
  const [currentSlide, setCurrentSlide] = useState(0);

  const [forgotOpen, setForgotOpen] = useState(false);
  const [userforgotOpen, setUserForgotOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [captcha, setCaptcha] = useState({ display: "98•22", value: "9822" });
  const [showPassword, setShowPassword] = useState(false);

  // ⭐ React Hook Form
  const {
    register,
    handleSubmit,
    formState: { errors },
    reset
  } = useForm<LoginForm>();

  const [loginError, setLoginError] = useState<string>("");

  // Generate captcha on mount
  useEffect(() => {
    setCaptcha(generateCaptcha());
  }, []);

  const regenerateCaptcha = () => {
    setCaptcha(generateCaptcha());
  };

  const onSubmit = async (data: LoginForm) => {
    setLoginError("");
    setIsLoading(true);

    // Validate captcha first
    if (data.captcha !== captcha.value) {
      setLoginError("Invalid captcha. Please try again.");
      regenerateCaptcha();
      setIsLoading(false);
      return;
    }

    try {
      // Step 1: Look up user by user_id from raw_user_meta_data to get their email
      // Use API route to query auth.users (which requires admin access)
      const response = await fetch('/api/get-user-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ user_id: data.username }),
      });

      if (!response.ok) {
        setLoginError("Invalid username or password. Please try again.");
        regenerateCaptcha();
        setIsLoading(false);
        return;
      }

      const userData = await response.json();

      if (!userData.email) {
        setLoginError("Invalid username or password. Please try again.");
        regenerateCaptcha();
        setIsLoading(false);
        return;
      }

      const userEmail = userData.email;
      const userId = userData.user_id;
      const consultantType = userData.consultant_type;

      // Step 2: Use the user's email to authenticate with Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: userEmail,
        password: data.password,
      });

      if (authError) {
        setLoginError("Invalid username or password. Please try again.");
        regenerateCaptcha();
        setIsLoading(false);
        return;
      }

      if (authData.user) {
        // Store user info in localStorage
        localStorage.setItem('consultantId', authData.user.id);
        localStorage.setItem('consultantUserId', userId || data.username);
        localStorage.setItem('consultantType', consultantType || '');
        
        // Store metadata from Supabase auth user_metadata (primary source)
        const metadataToStore = authData.user.user_metadata || userData.metadata;
        if (metadataToStore && typeof metadataToStore === 'object' && Object.keys(metadataToStore).length > 0) {
          localStorage.setItem('userMetadata', JSON.stringify(metadataToStore));
        }
        
        // Navigate to dashboard on successful login
        router.push("/userdashboard");
        reset();
      }
    } catch (err) {
      setLoginError("An error occurred during login. Please try again.");
      regenerateCaptcha();
    } finally {
      setIsLoading(false);
    }
  };

  const goToPrev = () => {
    setCurrentSlide((prev) => (prev - 1 + slides.length) % slides.length);
  };

  const goToNext = () => {
    setCurrentSlide((prev) => (prev + 1) % slides.length);
  };

  useEffect(() => {
    const id = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % slides.length);
    }, 10000);
    return () => clearInterval(id);
  }, [slides.length]);

  return (
    <>
      {/* Modals */}
      <ForgotPasswordModal open={forgotOpen} onClose={() => setForgotOpen(false)} />
      <ForgetUsernameModal
        open={userforgotOpen}
        onClose={() => setUserForgotOpen(false)}
      />

      <section
        className="relative w-full border-b border-zinc-200 bg-cover bg-center"
        style={{ backgroundImage: `url(${slides[currentSlide]})` }}
      >
        <div className="absolute inset-0 bg-sky-900/40" />

        {/* Arrows */}
        <button
          type="button"
          onClick={goToPrev}
          className="absolute left-4 top-1/2 z-10 -translate-y-1/2 rounded-full bg-white/80 p-2 text-sky-700 shadow hover:bg-white"
        >
          <span className="inline-block rotate-180 text-2xl leading-none">
            &rsaquo;
          </span>
        </button>

        <button
          type="button"
          onClick={goToNext}
          className="absolute right-4 top-1/2 z-10 -translate-y-1/2 rounded-full bg-white/80 p-2 text-sky-700 shadow hover:bg-white"
        >
          <span className="inline-block text-2xl leading-none">&rsaquo;</span>
        </button>

        <div className="relative mx-auto grid max-w-7xl grid-cols-1 items-start gap-8 px-4 py-8 text-white md:grid-cols-3 md:py-12">
          <div className="md:col-span-2">
            <div className="mb-4 inline-block rounded bg-sky-900 px-4 py-2">
              <h2 className="text-lg font-semibold tracking-wide">
                REFORMS UNDERTAKEN
              </h2>
            </div>

            <ul className="space-y-4 text-base leading-relaxed">
              {[
                "Single Window Clearance System for all types of approval",
                "Time bound approval system",
                "Construction life cycle approvals within 8 processes and time 45 days",
                "Integrated online approval system for issuing NOCs",
                "Fee calculator for knowing permit cost in advance",
                "Online payment facility"
              ].map((item) => (
                <li key={item} className="flex items-start gap-3">
                  <span className="mt-1 text-amber-300">🚧</span>
                  <span className="text-white">{item}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Login Form With Validation */}
          <div className="md:col-span-1 shadow-[0_25px_50px_-12px_rgba(0,0,0,0.6),0_15px_30px_-8px_rgba(0,0,0,0.5)]">
            <div className="rounded-xl border border-sky-200 bg-white shadow-[0_25px_50px_-12px_rgba(0,0,0,0.6),0_15px_30px_-8px_rgba(0,0,0,0.5)]">
              <div className="bg-sky-700 px-4 py-3 text-white rounded-xl">
                <h3 className="text-base font-semibold">User Login</h3>
              </div>

              <form onSubmit={handleSubmit(onSubmit)} className="space-y-3 p-4">
                {/* User ID */}
                <label className="block text-sm">
                  <span className="mb-1 block text-zinc-700">User ID</span>
                  <input
                    {...register("username", {
                      required: "User ID is required"
                    })}
                    type="text"
                    className="w-full rounded border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-sky-500 text-black"
                    placeholder="Enter your User ID"
                  />
                </label>
                {errors.username && (
                  <p className="text-red-600 text-sm">{errors.username.message}</p>
                )}

                {/* Password */}
                <label className="block text-sm">
                  <span className="mb-1 block text-zinc-700">Password</span>
                  <div className="relative">
                    <input
                      {...register("password", {
                        required: "Password is required"
                      })}
                      type={showPassword ? "text" : "password"}
                      className="w-full rounded border border-zinc-300 px-3 py-2 pr-10 text-sm outline-none focus:border-sky-500 text-black"
                      placeholder="Enter password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-700 focus:outline-none"
                      tabIndex={-1}
                    >
                      {showPassword ? (
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className="h-5 w-5"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
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
                          xmlns="http://www.w3.org/2000/svg"
                          className="h-5 w-5"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
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
                </label>
                {errors.password && (
                  <p className="text-red-600 text-sm">{errors.password.message}</p>
                )}

                {/* Captcha */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="h-12 w-40 select-none rounded border border-zinc-300 bg-zinc-50 p-2 text-center font-mono text-lg tracking-widest text-zinc-700">
                      {captcha.display}
                    </div>
                    <button 
                      type="button" 
                      className="text-sm text-sky-700 underline"
                      onClick={regenerateCaptcha}
                    >
                      Generate New Image
                    </button>
                  </div>

                  <input
                    {...register("captcha", {
                      required: "Captcha is required"
                    })}
                    type="text"
                    className="w-full rounded border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-sky-500 text-black"
                    placeholder="Type the code from the image"
                  />
                </div>
                {errors.captcha && (
                  <p className="text-red-600 text-sm">{errors.captcha.message}</p>
                )}

                {/* Login Error Message */}
                {loginError && (
                  <p className="text-red-600 text-sm">{loginError}</p>
                )}

                {/* Buttons */}
                <div className="flex flex-col gap-2 pt-1 sm:flex-row sm:items-center sm:justify-between">
                  <button 
                    type="submit"
                    disabled={isLoading}
                    className="w-full rounded bg-sky-700 px-4 py-2 text-sm font-medium text-white hover:bg-sky-800 disabled:bg-sky-400 disabled:cursor-not-allowed sm:w-auto"
                  >
                    {isLoading ? "Logging in..." : "Login"}
                  </button>

                  <div className="flex flex-col gap-2 sm:flex-row sm:gap-0">
                    <button
                      type="button"
                      className="w-full rounded bg-sky-700 px-3 py-2 text-xs sm:text-sm font-medium text-white hover:bg-sky-800 sm:mx-2 sm:w-auto"
                      onClick={() => setForgotOpen(true)}
                    >
                      Forgot Password
                    </button>

                    <button
                      type="button"
                      className="w-full rounded bg-sky-700 px-3 py-2 text-xs sm:text-sm font-medium text-white hover:bg-sky-800 sm:w-auto"
                      onClick={() => setUserForgotOpen(true)}
                    >
                      Forgot Username
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        </div>

        {/* Slider dots */}
        <div className="absolute bottom-4 right-8 flex gap-2">
          {slides.map((_, idx) => (
            <span
              key={idx}
              className={`h-2.5 w-2.5 rounded-full ${
                idx === currentSlide ? "bg-white" : "bg-white/60"
              }`}
            />
          ))}
        </div>
      </section>
    </>
  );
};

export default HeroSection;
