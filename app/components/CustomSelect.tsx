"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { createPortal } from "react-dom";

export interface CustomSelectOption {
  value: string;
  label: string;
  highlightedPart?: string;
  disabled?: boolean;
}

interface CustomSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: CustomSelectOption[];
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  id?: string;
  "aria-label"?: string;
  searchable?: boolean;
}

type MenuPosition = {
  top: number;
  left: number;
  width: number;
};

export default function CustomSelect({
  value,
  onChange,
  options,
  placeholder = "Select",
  className = "",
  disabled = false,
  id,
  "aria-label": ariaLabel,
  searchable = false,
}: CustomSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState<number>(-1);
  const [menuPosition, setMenuPosition] = useState<MenuPosition | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const typeaheadBufferRef = useRef("");
  const typeaheadTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const optionsContainerRef = useRef<HTMLDivElement>(null);

  const visibleOptions = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!searchable || !needle) return options;
    return options.filter((opt) => opt.label.toLowerCase().includes(needle));
  }, [options, query, searchable]);

  const updateMenuPosition = useCallback(() => {
    const button = buttonRef.current;
    if (!button) return;
    const rect = button.getBoundingClientRect();
    const width = searchable ? Math.max(rect.width, 280) : rect.width;
    const maxLeft = Math.max(8, window.innerWidth - width - 8);
    setMenuPosition({
      top: rect.bottom + 4,
      left: Math.min(rect.left, maxLeft),
      width,
    });
  }, [searchable]);

  useEffect(() => {
    if (!open) return;
    updateMenuPosition();

    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        ref.current?.contains(target) ||
        menuRef.current?.contains(target)
      ) {
        return;
      }
      setOpen(false);
      setQuery("");
    };

    const reposition = () => updateMenuPosition();

    document.addEventListener("mousedown", handler);
    window.addEventListener("resize", reposition);
    window.addEventListener("scroll", reposition, true);
    return () => {
      document.removeEventListener("mousedown", handler);
      window.removeEventListener("resize", reposition);
      window.removeEventListener("scroll", reposition, true);
    };
  }, [open, updateMenuPosition]);

  useEffect(() => {
    if (!open || !searchable) return;
    const frame = requestAnimationFrame(() => searchRef.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, [open, searchable]);

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

  const enabledIndexes = visibleOptions.reduce<number[]>((acc, opt, idx) => {
    if (!opt.disabled) acc.push(idx);
    return acc;
  }, []);

  const nextEnabledIndex = (current: number, direction: 1 | -1) => {
    if (enabledIndexes.length === 0) return -1;
    if (direction === 1) {
      const found = enabledIndexes.find((idx) => idx > current);
      return found ?? enabledIndexes[enabledIndexes.length - 1];
    }
    if (current < 0) return enabledIndexes[enabledIndexes.length - 1];
    const found = [...enabledIndexes].reverse().find((idx) => idx < current);
    return found ?? enabledIndexes[0];
  };

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
        <span className="text-brand-blue font-semibold">{highlightedPart}</span>
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

    const matchedIndex = visibleOptions.findIndex(
      (opt) =>
        !opt.disabled && opt.label.toLowerCase().startsWith(nextBuffer)
    );
    if (matchedIndex < 0) return;
    setOpen(true);
    setActiveIndex(matchedIndex);
  };

  const dropdownMenu =
    open && menuPosition && typeof window !== "undefined"
      ? createPortal(
          <div
            ref={menuRef}
            style={{
              position: "fixed",
              top: menuPosition.top,
              left: menuPosition.left,
              width: menuPosition.width,
            }}
            className="z-[10050] flex max-h-72 flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-lg"
          >
            {searchable ? (
              <div className="shrink-0 border-b border-gray-100 p-2">
                <input
                  ref={searchRef}
                  type="text"
                  value={query}
                  onChange={(event) => {
                    setQuery(event.target.value);
                    setActiveIndex(0);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "ArrowDown") {
                      event.preventDefault();
                      setActiveIndex((prev) => nextEnabledIndex(prev, 1));
                      return;
                    }
                    if (event.key === "ArrowUp") {
                      event.preventDefault();
                      setActiveIndex((prev) => nextEnabledIndex(prev, -1));
                      return;
                    }
                    if (event.key === "Enter") {
                      event.preventDefault();
                      const selected =
                        visibleOptions[activeIndex] ??
                        visibleOptions.find((opt) => !opt.disabled);
                      if (selected && !selected.disabled) {
                        onChange(selected.value);
                        setOpen(false);
                        setQuery("");
                      }
                      return;
                    }
                    if (event.key === "Escape") {
                      event.preventDefault();
                      setOpen(false);
                      setQuery("");
                      buttonRef.current?.focus();
                    }
                  }}
                  placeholder="Search projects"
                  aria-label="Search projects"
                  className="h-9 w-full rounded-lg border border-gray-200 bg-gray-50 px-3 text-sm text-gray-900 outline-none focus:border-brand-blue focus:bg-white focus:ring-2 focus:ring-brand-blue/20"
                />
              </div>
            ) : null}
            <div ref={optionsContainerRef} className="min-h-0 overflow-x-hidden overflow-y-auto">
            {visibleOptions.length === 0 ? (
              <p className="px-3 py-2 text-sm text-gray-500">No matches</p>
            ) : (
            visibleOptions.map((opt, idx) => (
              <button
                key={opt.value || `option-${idx}`}
                ref={(el) => {
                  optionRefs.current[idx] = el;
                }}
                type="button"
                disabled={opt.disabled}
                onClick={() => {
                  if (opt.disabled) return;
                  onChange(opt.value);
                  setOpen(false);
                  setQuery("");
                }}
                className={`w-full text-left px-3 py-2 text-sm break-words leading-snug ${
                  opt.disabled
                    ? "cursor-not-allowed text-gray-400"
                    : value === opt.value
                      ? "bg-blue-50 text-brand-blue font-medium hover:bg-blue-50"
                      : activeIndex >= 0 && visibleOptions[activeIndex]?.value === opt.value
                        ? "bg-blue-50 text-gray-900 hover:bg-blue-50"
                        : "text-gray-900 hover:bg-blue-50"
                }`}
              >
                {renderHighlightedLabel(opt.label, opt.highlightedPart)}
              </button>
            ))
            )}
            </div>
          </div>,
          document.body
        )
      : null;

  return (
    <div ref={ref} className={`relative min-w-0 w-full ${className}`} id={id}>
      <button
        ref={buttonRef}
        type="button"
        disabled={disabled}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => {
          if (disabled) return;
          setOpen((prev) => {
            const next = !prev;
            if (next) {
              updateMenuPosition();
            } else {
              setQuery("");
            }
            return next;
          });
        }}
        onKeyDown={(e) => {
          if (disabled) return;
          if (searchable && e.key.length === 1 && !e.metaKey && !e.ctrlKey && !e.altKey && /\S/.test(e.key)) {
            e.preventDefault();
            setQuery((prev) => (open ? `${prev}${e.key}` : e.key));
            setOpen(true);
            updateMenuPosition();
            return;
          }
          if (!searchable && e.key.length === 1 && /\S/.test(e.key)) {
            e.preventDefault();
            runTypeahead(e.key);
            return;
          }
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setOpen(true);
            updateMenuPosition();
            setActiveIndex((prev) => nextEnabledIndex(prev, 1));
            return;
          }
          if (e.key === "ArrowUp") {
            e.preventDefault();
            setOpen(true);
            updateMenuPosition();
            setActiveIndex((prev) => nextEnabledIndex(prev, -1));
            return;
          }
          if (e.key === "Enter" && open && activeIndex >= 0) {
            e.preventDefault();
            const selected = visibleOptions[activeIndex];
            if (selected && !selected.disabled) {
              onChange(selected.value);
              setOpen(false);
              setQuery("");
            }
          }
          if (e.key === "Escape" && open) {
            e.preventDefault();
            setOpen(false);
            setQuery("");
          }
        }}
        className={`flex h-11 w-full min-w-0 items-center justify-between gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 text-left outline-none transition-colors focus:border-brand-blue focus:bg-white focus:ring-2 focus:ring-brand-blue/20 ${
          disabled ? "cursor-not-allowed bg-gray-100 text-gray-400" : "hover:border-gray-300"
        }`}
      >
        <span
          className={`block min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap text-sm ${
            value ? "text-gray-900" : "text-gray-400"
          }`}
          title={value ? selectedLabel : undefined}
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
      {dropdownMenu}
    </div>
  );
}
