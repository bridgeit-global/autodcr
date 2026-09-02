"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Brain, ChevronDown, Cpu, Lightbulb } from "lucide-react";
import type {
  ChatModelOption,
  ReasoningEffort,
} from "@/app/lib/regulationsRag/chatModels";
import {
  REASONING_EFFORT_OPTIONS,
  THINKING_OPTIONS,
  getChatModel,
} from "@/app/lib/regulationsRag/chatModels";

type Option = { value: string; label: string; hint?: string };

function CompactSelect({
  icon,
  label,
  value,
  options,
  disabled,
  onChange,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  options: Option[];
  disabled?: boolean;
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [menu, setMenu] = useState<{ top: number; left: number; width: number } | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const selected = options.find((opt) => opt.value === value);

  const placeMenu = useCallback(() => {
    const button = buttonRef.current;
    if (!button) return;
    const rect = button.getBoundingClientRect();
    const width = Math.max(rect.width, 224);
    const left = Math.min(rect.left, window.innerWidth - width - 8);
    setMenu({
      top: rect.top - 8,
      left: Math.max(8, left),
      width,
    });
  }, []);

  useEffect(() => {
    if (!open) return;
    placeMenu();
    const onPointer = (event: MouseEvent) => {
      const target = event.target as Node;
      if (ref.current?.contains(target) || menuRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointer);
    window.addEventListener("keydown", onKey);
    window.addEventListener("resize", placeMenu);
    window.addEventListener("scroll", placeMenu, true);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", placeMenu);
      window.removeEventListener("scroll", placeMenu, true);
    };
  }, [open, placeMenu]);

  const dropdown =
    open && menu && typeof window !== "undefined"
      ? createPortal(
          <div
            ref={menuRef}
            role="listbox"
            style={{
              position: "fixed",
              top: menu.top,
              left: menu.left,
              width: menu.width,
              transform: "translateY(-100%)",
            }}
            className="z-[120] max-h-64 overflow-y-auto rounded-xl border border-gray-200 bg-white py-1 shadow-lg"
          >
            {options.map((opt) => {
              const active = opt.value === value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  role="option"
                  aria-selected={active}
                  onClick={() => {
                    onChange(opt.value);
                    setOpen(false);
                  }}
                  className={[
                    "flex w-full flex-col items-start px-3 py-2 text-left text-sm",
                    active ? "bg-blue-50 text-brand-navy" : "text-gray-800 hover:bg-slate-50",
                  ].join(" ")}
                >
                  <span className={active ? "font-semibold" : "font-medium"}>{opt.label}</span>
                  {opt.hint ? (
                    <span className="mt-0.5 text-[11px] leading-snug text-gray-500">{opt.hint}</span>
                  ) : null}
                </button>
              );
            })}
          </div>,
          document.body
        )
      : null;

  return (
    <div ref={ref} className="relative">
      <button
        ref={buttonRef}
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={label}
        onClick={() => {
          if (disabled) return;
          setOpen((prev) => {
            const next = !prev;
            if (next) placeMenu();
            return next;
          });
        }}
        className={[
          "inline-flex max-w-full items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-colors",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue/40",
          open
            ? "border-brand-blue/40 bg-blue-50 text-brand-navy"
            : "border-gray-200 bg-white text-gray-700 hover:border-brand-blue/40 hover:bg-slate-50",
          disabled ? "cursor-not-allowed opacity-50" : "",
        ].join(" ")}
      >
        <span className="text-gray-400">{icon}</span>
        <span className="hidden text-[10px] font-semibold uppercase tracking-wide text-gray-400 sm:inline">
          {label}
        </span>
        <span className="max-w-[9.5rem] truncate font-semibold text-brand-navy">
          {selected?.label || "Select"}
        </span>
        <ChevronDown
          className={["h-3 w-3 text-gray-400 transition-transform", open ? "rotate-180" : ""].join(
            " "
          )}
        />
      </button>
      {dropdown}
    </div>
  );
}

export default function ModelOptionsBar({
  model,
  reasoningEffort,
  thinking,
  models,
  disabled,
  onModelChange,
  onReasoningChange,
  onThinkingChange,
}: {
  model: string;
  reasoningEffort: ReasoningEffort;
  thinking: boolean;
  models: ChatModelOption[];
  disabled?: boolean;
  onModelChange: (id: string) => void;
  onReasoningChange: (effort: ReasoningEffort) => void;
  onThinkingChange: (thinking: boolean) => void;
}) {
  const spec = getChatModel(model) || models.find((item) => item.id === model);
  const showReason = Boolean(spec?.reasoning);
  const showThinking = Boolean(spec?.thinking);

  return (
    <div className="mt-2 flex flex-wrap items-center gap-1.5">
      <CompactSelect
        icon={<Cpu className="h-3.5 w-3.5" />}
        label="Model"
        value={model}
        disabled={disabled}
        options={models.map((item) => ({
          value: item.id,
          label: item.label,
          hint: `${item.provider} · ${item.description}`,
        }))}
        onChange={onModelChange}
      />
      {showReason ? (
        <CompactSelect
          icon={<Brain className="h-3.5 w-3.5" />}
          label="Reason"
          value={reasoningEffort}
          disabled={disabled}
          options={REASONING_EFFORT_OPTIONS.map((item) => ({
            value: item.value,
            label: item.label,
            hint:
              item.value === "none"
                ? "Skip extra reasoning tokens"
                : `${item.label} reasoning effort`,
          }))}
          onChange={(value) => onReasoningChange(value as ReasoningEffort)}
        />
      ) : null}
      {showThinking ? (
        <CompactSelect
          icon={<Lightbulb className="h-3.5 w-3.5" />}
          label="Thinking"
          value={thinking ? "on" : "off"}
          disabled={disabled}
          options={THINKING_OPTIONS.map((item) => ({
            value: item.value,
            label: item.label,
            hint:
              item.value === "on"
                ? "Let the model think before answering"
                : "Answer without a thinking pass",
          }))}
          onChange={(value) => onThinkingChange(value === "on")}
        />
      ) : null}
    </div>
  );
}
