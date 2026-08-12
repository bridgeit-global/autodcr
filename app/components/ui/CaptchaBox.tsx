"use client";

import { useLayoutEffect, useRef } from "react";

const CAPTCHA_CSS_W = 140;
const CAPTCHA_CSS_H = 40;

/** Four digits, rendered as two two-digit halves so the code never starts with 0. */
export const generateCaptchaValue = (): string => {
  const num1 = Math.floor(Math.random() * 90 + 10);
  const num2 = Math.floor(Math.random() * 90 + 10);
  return `${num1}${num2}`;
};

function drawCaptchaOnCanvas(canvas: HTMLCanvasElement, value: string) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

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

  for (let i = 0; i < 42; i++) {
    ctx.fillStyle = `rgba(${80 + Math.random() * 120},${80 + Math.random() * 120},${100 + Math.random() * 100},${0.15 + Math.random() * 0.35})`;
    ctx.fillRect(Math.random() * CAPTCHA_CSS_W, Math.random() * CAPTCHA_CSS_H, 1.2, 1.2);
  }

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

  ctx.textBaseline = "middle";
  ctx.font = "600 18px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace";
  let x = 18;
  const midY = CAPTCHA_CSS_H / 2;

  for (const ch of value.split("")) {
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

type CaptchaBoxProps = {
  value: string;
  onRefresh: () => void;
  className?: string;
};

const CaptchaBox = ({ value, onRefresh, className = "" }: CaptchaBoxProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useLayoutEffect(() => {
    const el = canvasRef.current;
    if (el) drawCaptchaOnCanvas(el, value);
  }, [value]);

  return (
    <div className={`flex items-center gap-2 ${className}`.trim()}>
      <canvas
        ref={canvasRef}
        className="shrink-0 select-none rounded-lg border border-gray-200 bg-gray-50"
        width={CAPTCHA_CSS_W}
        height={CAPTCHA_CSS_H}
        aria-label="Captcha: type the four digits shown"
      />
      <button
        type="button"
        onClick={onRefresh}
        className="shrink-0 text-xs font-medium text-brand-blue hover:text-brand-blue-hover sm:text-sm"
      >
        Refresh
      </button>
    </div>
  );
};

export default CaptchaBox;
