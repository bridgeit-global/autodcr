"use client";

import { useState, useRef, useEffect } from "react";

export interface CustomSelectOption {
  value: string;
  label: string;
  highlightedPart?: string;
}

interface CustomSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: CustomSelectOption[];
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  id?: string;
}

export default function CustomSelect({
  value,
  onChange,
  options,
  placeholder = "Select",
  className = "",
  disabled = false,
  id,
}: CustomSelectProps) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState<number>(-1);
  const ref = useRef<HTMLDivElement>(null);
  const typeaheadBufferRef = useRef("");
  const typeaheadTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const optionsContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  useEffect(() => {
    if (!open || activeIndex < 0) return;
    const container = optionsContainerRef.current;
    const optionEl = optionRefs.current[activeIndex];
    if (!container || !optionEl) return;
    const top = optionEl.offsetTop;
    container.scrollTo({ top, behavior: "auto" });
  }, [open, activeIndex]);

  useEffect(() => {
    return () => {
      if (typeaheadTimeoutRef.current) {
        clearTimeout(typeaheadTimeoutRef.current);
      }
    };
  }, []);

  const selectedOption = options.find((o) => o.value === value);
  const selectedLabel = selectedOption?.label || "";

  const renderHighlightedLabel = (label: string, highlightedPart?: string) => {
    if (!highlightedPart || !label.includes(highlightedPart)) {
      return label;
    }
    const [prefix, suffix] = label.split(highlightedPart, 2);
    return (
      <>
        <span>{prefix}</span>
        <span className="text-emerald-700 font-semibold">{highlightedPart}</span>
        <span>{suffix}</span>
      </>
    );
  };

  const runTypeahead = (key: string) => {
    const nextBuffer = `${typeaheadBufferRef.current}${key}`.toLowerCase();
    typeaheadBufferRef.current = nextBuffer;

    if (typeaheadTimeoutRef.current) {
      clearTimeout(typeaheadTimeoutRef.current);
    }
    typeaheadTimeoutRef.current = setTimeout(() => {
      typeaheadBufferRef.current = "";
    }, 600);

    const matchedIndex = options.findIndex((opt) =>
      opt.label.toLowerCase().startsWith(nextBuffer)
    );
    if (matchedIndex < 0) return;
    setOpen(true);
    setActiveIndex(matchedIndex);
  };

  return (
    <div ref={ref} className={`relative ${className}`} id={id}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setOpen((p) => !p)}
        onKeyDown={(e) => {
          if (disabled) return;
          if (e.key.length === 1 && /\S/.test(e.key)) {
            e.preventDefault();
            runTypeahead(e.key);
            return;
          }
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setOpen(true);
            setActiveIndex((prev) => {
              const base = prev < 0 ? 0 : prev + 1;
              return Math.min(base, options.length - 1);
            });
            return;
          }
          if (e.key === "ArrowUp") {
            e.preventDefault();
            setOpen(true);
            setActiveIndex((prev) => {
              const base = prev < 0 ? options.length - 1 : prev - 1;
              return Math.max(base, 0);
            });
            return;
          }
          if (e.key === "Enter" && open && activeIndex >= 0) {
            e.preventDefault();
            const selected = options[activeIndex];
            if (selected) {
              onChange(selected.value);
              setOpen(false);
            }
          }
        }}
        className={`border border-gray-200 rounded-xl px-3 h-10 w-full text-left bg-white focus:ring-2 focus:ring-emerald-500 outline-none flex items-center justify-between gap-2 ${
          disabled ? "bg-gray-100 cursor-not-allowed" : ""
        }`}
      >
        <span
          className={`min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap text-sm ${
            value ? "text-gray-900" : "text-gray-400"
          }`}
        >
          {value
            ? renderHighlightedLabel(selectedLabel, selectedOption?.highlightedPart)
            : placeholder}
        </span>
        <svg
          className={`w-4 h-4 shrink-0 text-gray-400 transition-transform ${
            open ? "rotate-180" : ""
          }`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>
      {open && (
        <div
          ref={optionsContainerRef}
          className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-lg max-h-60 overflow-y-auto"
        >
          {options.map((opt, idx) => (
            <button
              key={opt.value}
              ref={(el) => {
                optionRefs.current[idx] = el;
              }}
              type="button"
              onClick={() => {
                onChange(opt.value);
                setOpen(false);
              }}
              className={`w-full text-left px-3 py-2 text-sm hover:bg-emerald-50 break-words leading-snug ${
                value === opt.value
                  ? "bg-emerald-50 text-emerald-700 font-medium"
                  : activeIndex >= 0 && options[activeIndex]?.value === opt.value
                    ? "bg-emerald-50 text-gray-900"
                  : "text-gray-900"
              }`}
            >
              {renderHighlightedLabel(opt.label, opt.highlightedPart)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
