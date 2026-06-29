"use client";

import Image from "next/image";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { useRouter, useSearchParams } from "next/navigation";
import ForgotPasswordModal from "./ForgotPasswordModal";
import ForgetUsernameModal from "./ForgetUsernameModal";
import { supabase } from "../utils/supabase";
import { sanitizeReturnUrl } from "@/app/utils/applicationDeepLink";
import { BTN_PRIMARY, BTN_SAVE_UNSAVED } from "@/app/utils/buttonClasses";
import { TEXT_BODY, TEXT_LABEL, TEXT_MUTED, TEXT_TITLE_PANEL } from "@/app/utils/typography";

type HeroSectionProps = {
  slides: string[];
};

type LoginForm = {
  username: string;
  password: string;
  captcha: string;
};

type CaptchaState = { num1: number; num2: number; value: string };

// Two 2-digit numbers concatenated; image and input are the same 4 digits.
const generateCaptcha = (): CaptchaState => {
  const num1 = Math.floor(Math.random() * 90 + 10);
  const num2 = Math.floor(Math.random() * 90 + 10);
  return { num1, num2, value: `${num1}${num2}` };
};

const CAPTCHA_CSS_W = 160;
const CAPTCHA_CSS_H = 48;

/** Renders captcha as a bitmap (noise + distorted glyphs) — not plain DOM text. */
function drawCaptchaOnCanvas(canvas: HTMLCanvasElement, num1: number, num2: number) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  // Cap DPR so high-density screens don’t allocate huge backing stores for a tiny widget.
  const rawDpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
  const dpr = Math.min(2, rawDpr);
  canvas.width = Math.floor(CAPTCHA_CSS_W * dpr);
  canvas.height = Math.floor(CAPTCHA_CSS_H * dpr);
  canvas.style.width = `${CAPTCHA_CSS_W}px`;
  canvas.style.height = `${CAPTCHA_CSS_H}px`;

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.scale(dpr, dpr);

  ctx.fillStyle = "#fafafa";
  ctx.fillRect(0, 0, CAPTCHA_CSS_W, CAPTCHA_CSS_H);

  // Speckle noise (kept light for fast redraws)
  for (let i = 0; i < 42; i++) {
    ctx.fillStyle = `rgba(${80 + Math.random() * 120},${80 + Math.random() * 120},${100 + Math.random() * 100},${0.15 + Math.random() * 0.35})`;
    ctx.fillRect(Math.random() * CAPTCHA_CSS_W, Math.random() * CAPTCHA_CSS_H, 1.2, 1.2);
  }

  // Curved distraction lines
  for (let i = 0; i < 2; i++) {
    ctx.strokeStyle = `rgba(${60 + Math.random() * 100},${60 + Math.random() * 100},${80 + Math.random() * 100},0.35)`;
    ctx.lineWidth = 0.8 + Math.random();
    ctx.beginPath();
    const y0 = Math.random() * CAPTCHA_CSS_H;
    ctx.moveTo(0, y0);
    ctx.bezierCurveTo(
      CAPTCHA_CSS_W * 0.35,
      y0 + (Math.random() - 0.5) * 30,
      CAPTCHA_CSS_W * 0.65,
      y0 + (Math.random() - 0.5) * 30,
      CAPTCHA_CSS_W,
      Math.random() * CAPTCHA_CSS_H
    );
    ctx.stroke();
  }

  const chars = `${num1}${num2}`.split("");
  ctx.textBaseline = "middle";
  ctx.font = "600 21px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace";
  let x = 18;
  const midY = CAPTCHA_CSS_H / 2;

  for (const ch of chars) {
    const wch = ctx.measureText(ch).width;
    ctx.save();
    ctx.translate(x + wch / 2, midY);
    ctx.rotate((Math.random() - 0.5) * 0.45);
    ctx.fillStyle = `rgb(${25 + Math.random() * 60},${25 + Math.random() * 60},${35 + Math.random() * 50})`;
    ctx.fillText(ch, -wch / 2, 0);
    ctx.restore();
    x += wch + 3;
  }
}

const HeroSection = ({ slides }: HeroSectionProps) => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnUrl = sanitizeReturnUrl(searchParams.get("returnUrl"));
  const [currentSlide, setCurrentSlide] = useState(0);

  const [forgotOpen, setForgotOpen] = useState(false);
  const [userforgotOpen, setUserForgotOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  /** null until first client layout pass — avoids double-generate + double-draw on mount. */
  const [captcha, setCaptcha] = useState<CaptchaState | null>(null);
  const captchaCanvasRef = useRef<HTMLCanvasElement>(null);
  const [showPassword, setShowPassword] = useState(false);

  // ⭐ React Hook Form
  const {
    register,
    handleSubmit,
    formState: { errors },
    reset
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

  useLayoutEffect(() => {
    if (captcha === null) {
      setCaptcha(generateCaptcha());
      return;
    }
    const el = captchaCanvasRef.current;
    if (!el) return;
    drawCaptchaOnCanvas(el, captcha.num1, captcha.num2);
  }, [captcha]);

  const regenerateCaptcha = () => {
    setCaptcha(generateCaptcha());
  };

  const onSubmit = async (data: LoginForm) => {
    setLoginError("");
    setIsLoading(true);

    // Validate captcha first
    if (!captcha || data.captcha.trim() !== captcha.value) {
      setLoginError("Invalid captcha. Please try again.");
      regenerateCaptcha();
      setIsLoading(false);
      return;
    }

    try {
      // Talk straight to Supabase (no Next.js API = no serverless cold start; signIn sets session — no setSession round trip).
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
        className="relative w-full border-b border-gray-200 bg-cover bg-center"
        style={{ backgroundImage: `url(${slides[currentSlide]})` }}
      >
        <div className="absolute inset-0 bg-emerald-950/45" />

        {/* Arrows */}
        <button
          type="button"
          onClick={goToPrev}
          className="absolute left-4 top-1/2 z-10 -translate-y-1/2 rounded-full bg-white/90 p-2 text-emerald-800 shadow hover:bg-white"
        >
          <span className="inline-block rotate-180 text-2xl leading-none">
            &rsaquo;
          </span>
        </button>

        <button
          type="button"
          onClick={goToNext}
          className="absolute right-4 top-1/2 z-10 -translate-y-1/2 rounded-full bg-white/90 p-2 text-emerald-800 shadow hover:bg-white"
        >
          <span className="inline-block text-2xl leading-none">&rsaquo;</span>
        </button>

        <div className="relative mx-auto grid max-w-7xl grid-cols-1 items-start gap-8 px-4 py-8 text-white md:grid-cols-3 md:py-12">
          <div className="md:col-span-2">
            <div className={`mb-4 inline-block rounded-lg px-4 py-2 ${BTN_PRIMARY}`}>
              <h2 className={`${TEXT_TITLE_PANEL} tracking-wide`}>
                REFORMS UNDERTAKEN
              </h2>
            </div>

            <ul className={`space-y-4 leading-relaxed ${TEXT_BODY}`}>
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
            <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-lg">
              <div className={`px-4 py-3 ${BTN_PRIMARY} rounded-t-2xl`}>
                <h3 className={TEXT_TITLE_PANEL}>User Login</h3>
              </div>

              <form onSubmit={handleSubmit(onSubmit)} className="space-y-3 p-4">
                {/* User ID */}
                <label className="block">
                  <span className={TEXT_LABEL}>User ID</span>
                  <input
                    {...register("username", {
                      required: "User ID is required"
                    })}
                    type="text"
                    className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-900 outline-none focus:ring-2 focus:ring-emerald-500"
                    placeholder="Enter your User ID"
                  />
                </label>
                {errors.username && (
                  <p className="text-red-600 text-sm">{errors.username.message}</p>
                )}

                {/* Password */}
                <label className="block">
                  <span className={TEXT_LABEL}>Password</span>
                  <div className="relative">
                    <input
                      {...register("password", {
                        required: "Password is required"
                      })}
                      type={showPassword ? "text" : "password"}
                      className="w-full rounded-xl border border-gray-200 px-3 py-2 pr-10 text-sm text-gray-900 outline-none focus:ring-2 focus:ring-emerald-500"
                      placeholder="Enter password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 focus:outline-none"
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
                  <div className="flex items-center justify-between gap-2">
                    <canvas
                      ref={captchaCanvasRef}
                      className="select-none rounded-xl border border-gray-200 bg-gray-50"
                      width={CAPTCHA_CSS_W}
                      height={CAPTCHA_CSS_H}
                      aria-label="Captcha: type the four digits shown"
                    />
                    <button 
                      type="button" 
                      className="shrink-0 text-sm font-medium text-emerald-700 underline hover:text-emerald-800"
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
                    className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-900 outline-none focus:ring-2 focus:ring-emerald-500"
                    placeholder="Enter the 4-digit code from the image"
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
                    className={`w-full rounded-lg px-4 py-2 text-sm font-semibold sm:w-auto ${BTN_PRIMARY} disabled:opacity-50 disabled:cursor-not-allowed`}
                  >
                    {isLoading ? "Logging in..." : "Login"}
                  </button>

                  <div className="flex flex-col gap-2 sm:flex-row sm:gap-0">
                    <button
                      type="button"
                      className={`w-full rounded-lg px-3 py-2 text-xs font-semibold sm:mx-2 sm:w-auto sm:text-sm ${BTN_SAVE_UNSAVED}`}
                      onClick={() => setForgotOpen(true)}
                    >
                      Forgot Password
                    </button>

                    <button
                      type="button"
                      className={`w-full rounded-lg px-3 py-2 text-xs font-semibold sm:w-auto sm:text-sm ${BTN_SAVE_UNSAVED}`}
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
