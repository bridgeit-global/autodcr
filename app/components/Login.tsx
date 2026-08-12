"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { useRouter, useSearchParams } from "next/navigation";
import { Eye, EyeOff, ChevronLeft, ChevronRight } from "lucide-react";
import ForgotPasswordModal from "./ForgotPasswordModal";
import ForgetUsernameModal from "./ForgetUsernameModal";
import { supabase } from "../utils/supabase";
import { sanitizeReturnUrl } from "@/app/utils/applicationDeepLink";
import Button from "./ui/Button";
import Input from "./ui/Input";
import CaptchaBox, { generateCaptchaValue } from "./ui/CaptchaBox";

type HeroSectionProps = {
  slides: string[];
};

type LoginForm = {
  username: string;
  password: string;
  captcha: string;
};

const fieldClassName =
  "w-full rounded-lg border border-gray-200 px-3 py-2 text-base text-gray-900 placeholder:text-gray-400 outline-none transition-colors focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20 sm:py-2.5 sm:text-sm";

const Login = ({ slides }: HeroSectionProps) => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnUrl = sanitizeReturnUrl(searchParams.get("returnUrl"));
  const [currentSlide, setCurrentSlide] = useState(0);

  const [forgotOpen, setForgotOpen] = useState(false);
  const [userforgotOpen, setUserForgotOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [captcha, setCaptcha] = useState<string>(generateCaptchaValue);
  const [showPassword, setShowPassword] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<LoginForm>();

  const [loginError, setLoginError] = useState<string>("");

  useEffect(() => {
    router.prefetch("/userdashboard");
    router.prefetch(returnUrl);
  }, [router, returnUrl]);

  useEffect(() => {
    let cancelled = false;
    void supabase.auth.getSession().then(({ data: { session } }) => {
      if (cancelled || !session?.access_token) return;
      router.replace(returnUrl);
    });
    return () => {
      cancelled = true;
    };
  }, [router, returnUrl]);

  const regenerateCaptcha = () => {
    setCaptcha(generateCaptchaValue());
  };

  const onSubmit = async (data: LoginForm) => {
    setLoginError("");
    setIsLoading(true);

    if (data.captcha.trim() !== captcha) {
      setLoginError("Invalid captcha. Please try again.");
      regenerateCaptcha();
      setIsLoading(false);
      return;
    }

    try {
      const { data: rows, error: rpcError } = await supabase.rpc("get_user_email_by_user_id", {
        lookup_user_id: data.username.trim(),
      });

      if (rpcError || !rows || !Array.isArray(rows) || rows.length === 0) {
        setLoginError("Invalid username or password. Please try again.");
        regenerateCaptcha();
        setIsLoading(false);
        return;
      }

      const row = rows[0] as {
        email?: string | null;
        user_id?: string | null;
        consultant_type?: string | null;
        raw_user_meta_data?: Record<string, unknown> | null;
        metadata?: Record<string, unknown> | null;
      };

      if (!row.email) {
        setLoginError("Invalid username or password. Please try again.");
        regenerateCaptcha();
        setIsLoading(false);
        return;
      }

      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: row.email,
        password: data.password,
      });

      if (authError || !authData.user) {
        setLoginError("Invalid username or password. Please try again.");
        regenerateCaptcha();
        setIsLoading(false);
        return;
      }

      localStorage.setItem("consultantId", authData.user.id);
      localStorage.setItem("consultantUserId", row.user_id || data.username);
      localStorage.setItem("consultantType", row.consultant_type || "");

      const jwtMeta =
        authData.user.user_metadata && typeof authData.user.user_metadata === "object"
          ? authData.user.user_metadata
          : {};
      const rpcMeta =
        row.raw_user_meta_data && typeof row.raw_user_meta_data === "object"
          ? row.raw_user_meta_data
          : row.metadata && typeof row.metadata === "object"
            ? row.metadata
            : {};
      const metadataToStore = { ...jwtMeta, ...rpcMeta };
      if (Object.keys(metadataToStore).length > 0) {
        localStorage.setItem("userMetadata", JSON.stringify(metadataToStore));
      }

      router.push(returnUrl);
      reset();
    } catch {
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
      <ForgotPasswordModal open={forgotOpen} onClose={() => setForgotOpen(false)} />
      <ForgetUsernameModal open={userforgotOpen} onClose={() => setUserForgotOpen(false)} />

      <div className="fixed inset-0 flex h-[100dvh] max-h-[100dvh] flex-col overflow-hidden supports-[height:100svh]:h-[100svh] md:static md:inset-auto md:h-dvh md:max-h-dvh md:flex-row">
        {/* Hero — full panel on tablet+ only */}
        <div className="relative order-1 hidden h-full min-h-0 shrink-0 md:block md:order-2 md:flex-1 lg:w-1/2">
          <div
            className="absolute inset-0 bg-cover bg-center transition-all duration-700"
            style={{ backgroundImage: `url(${slides[currentSlide]})` }}
          />
          <div className="absolute inset-0 bg-brand-navy/50 md:bg-brand-navy/40" />

          {/* Mobile/tablet hero copy */}
          <div className="absolute inset-0 flex items-end p-4 sm:p-6 md:items-center md:pb-0">
            <div className="text-white md:absolute md:bottom-16 md:left-8 md:right-8">
              <p className="text-base font-bold leading-snug sm:text-lg md:text-2xl md:leading-tight">
                Streamline your building plan approvals
              </p>
              <p className="mt-1 hidden max-w-md text-xs text-white/80 sm:block sm:text-sm">
                Single window clearance, time-bound approvals, and integrated online compliance.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={goToPrev}
            className="absolute left-3 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-brand-navy shadow-lg transition-colors hover:bg-white sm:left-4 md:h-11 md:w-11"
            aria-label="Previous slide"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>

          <button
            type="button"
            onClick={goToNext}
            className="absolute right-3 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-brand-navy shadow-lg transition-colors hover:bg-white sm:right-4 md:h-11 md:w-11"
            aria-label="Next slide"
          >
            <ChevronRight className="h-5 w-5" />
          </button>

          <div className="absolute bottom-3 left-1/2 z-10 flex -translate-x-1/2 gap-1.5 md:bottom-8">
            {slides.map((_, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => setCurrentSlide(idx)}
                className={[
                  "h-1.5 rounded-full transition-all sm:h-2",
                  idx === currentSlide ? "w-5 bg-white sm:w-6" : "w-1.5 bg-white/50 sm:w-2",
                ].join(" ")}
                aria-label={`Go to slide ${idx + 1}`}
              />
            ))}
          </div>
        </div>

        {/* Login form */}
        <div className="order-2 flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-y-contain bg-white [-webkit-overflow-scrolling:touch] md:order-1 md:h-full md:w-1/2 md:overflow-hidden lg:w-1/2">
          <div className="flex min-h-0 flex-1 flex-col justify-center px-4 py-3 sm:px-6 sm:py-4 md:px-10 md:py-6 lg:px-12 xl:px-16">
            <div className="mx-auto w-full max-w-md font-sans">
              <div className="mb-3 flex justify-center md:mb-4 md:justify-start">
                <Link href="/" aria-label="Back to Draft Desk home">
                  <Image
                    src="/draft-desk-logo.png"
                    alt="Draft Desk — Document Smarter. Work Faster."
                    width={240}
                    height={100}
                    priority
                    className="h-auto w-full max-w-[140px] object-contain sm:max-w-[180px] md:max-w-[220px] lg:max-w-[240px]"
                  />
                </Link>
              </div>

              <div className="mb-3 text-center md:mb-4 md:text-left">
                <h1 className="font-sans text-base font-bold text-brand-navy sm:text-lg">
                  Sign in to your account
                </h1>
                <p className="mt-0.5 hidden font-sans text-sm text-gray-500 sm:block">
                  Enter your credentials to access the platform
                </p>
              </div>

              <form onSubmit={handleSubmit(onSubmit)} className="space-y-2.5 sm:space-y-3">
                <Input
                  label="User ID"
                  placeholder="Enter your User ID"
                  error={errors.username?.message}
                  className="text-base sm:text-sm"
                  autoComplete="username"
                  {...register("username", { required: "User ID is required" })}
                />

                <div>
                  <label htmlFor="password" className="mb-1 block text-sm font-medium text-gray-700 sm:mb-1.5">
                    Password
                  </label>
                  <div className="relative">
                    <input
                      id="password"
                      {...register("password", { required: "Password is required" })}
                      type={showPassword ? "text" : "password"}
                      placeholder="Enter password"
                      autoComplete="current-password"
                      className={`${fieldClassName} pr-11`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-0 top-0 flex h-full w-11 items-center justify-center text-gray-400 hover:text-gray-600"
                      tabIndex={-1}
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                    </button>
                  </div>
                  {errors.password && (
                    <p className="mt-1 text-sm text-status-danger">{errors.password.message}</p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <label className="block text-sm font-medium text-gray-700">Security Code</label>
                  <CaptchaBox value={captcha} onRefresh={regenerateCaptcha} />
                  <Input
                    placeholder="Enter the 4-digit code"
                    error={errors.captcha?.message}
                    className="text-base sm:text-sm"
                    inputMode="numeric"
                    autoComplete="off"
                    {...register("captcha", { required: "Captcha is required" })}
                  />
                </div>

                {loginError && (
                  <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-status-danger">
                    {loginError}
                  </p>
                )}

                <Button type="submit" fullWidth disabled={isLoading} size="md">
                  {isLoading ? "Signing in..." : "Sign In"}
                </Button>

                <div className="flex items-center justify-center gap-3 border-t border-gray-100 pt-3">
                  <button
                    type="button"
                    className="text-sm font-medium text-brand-blue transition-colors hover:text-brand-blue-hover hover:underline"
                    onClick={() => setForgotOpen(true)}
                  >
                    Forgot Password?
                  </button>
                  <span className="text-gray-300" aria-hidden="true">
                    |
                  </span>
                  <button
                    type="button"
                    className="text-sm font-medium text-brand-blue transition-colors hover:text-brand-blue-hover hover:underline"
                    onClick={() => setUserForgotOpen(true)}
                  >
                    Forgot Username?
                  </button>
                </div>
              </form>

              <div className="mt-3 border-t border-gray-100 pt-3 sm:mt-4 sm:pt-4">
                <p className="text-center font-sans text-xs text-gray-500 sm:text-sm">
                  Don&apos;t have an account?{" "}
                  <Link href="/owner" className="font-medium text-brand-blue hover:text-brand-blue-hover">
                    Owner
                  </Link>
                  {" · "}
                  <Link href="/consultant" className="font-medium text-brand-blue hover:text-brand-blue-hover">
                    Consultant
                  </Link>
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default Login;
