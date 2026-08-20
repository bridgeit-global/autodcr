"use client";

import { Check } from "lucide-react";

type AuthorityChip = {
  id: string;
  label: string;
  description?: string;
};

type AuthorityChipsProps = {
  authorities: AuthorityChip[];
  selected: Set<string>;
  onToggle: (id: string) => void;
  compact?: boolean;
};

export default function AuthorityChips({
  authorities,
  selected,
  onToggle,
  compact = false,
}: AuthorityChipsProps) {
  if (!authorities.length) {
    if (compact) {
      return (
        <div className="flex flex-wrap gap-1.5">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-8 w-20 animate-pulse rounded-full bg-gray-100" />
          ))}
        </div>
      );
    }
    return (
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="h-[4.5rem] animate-pulse rounded-xl bg-gray-100"
          />
        ))}
      </div>
    );
  }

  if (compact) {
    return (
      <div className="flex flex-wrap gap-1.5">
        {authorities.map((a) => {
          const active = selected.has(a.id);
          return (
            <button
              key={a.id}
              type="button"
              title={a.description || a.id}
              aria-pressed={active}
              onClick={() => onToggle(a.id)}
              className={[
                "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold transition-colors",
                "focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue/40",
                active
                  ? "border-brand-blue bg-blue-50 text-brand-navy"
                  : "border-gray-200 bg-white text-gray-600 hover:border-brand-blue/40",
              ].join(" ")}
            >
              <span
                className={[
                  "flex h-3.5 w-3.5 items-center justify-center rounded-full border",
                  active
                    ? "border-brand-blue bg-brand-blue text-white"
                    : "border-gray-300 bg-white text-transparent",
                ].join(" ")}
              >
                <Check className="h-2.5 w-2.5" strokeWidth={3} />
              </span>
              {a.label}
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {authorities.map((a) => {
        const active = selected.has(a.id);
        return (
          <button
            key={a.id}
            type="button"
            title={a.description || a.id}
            aria-pressed={active}
            onClick={() => onToggle(a.id)}
            className={[
              "flex min-h-16 items-start gap-2 rounded-xl border px-3 py-2.5 text-left transition-all",
              "focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue/40",
              active
                ? "border-brand-blue bg-blue-50 shadow-sm"
                : "border-gray-200 bg-white hover:border-brand-blue/40 hover:bg-slate-50",
            ].join(" ")}
          >
            <span
              className={[
                "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border",
                active
                  ? "border-brand-blue bg-brand-blue text-white"
                  : "border-gray-300 bg-white text-transparent",
              ].join(" ")}
            >
              <Check className="h-3 w-3" strokeWidth={3} />
            </span>
            <span className="min-w-0">
              <span
                className={[
                  "block text-xs font-semibold sm:text-sm",
                  active ? "text-brand-navy" : "text-gray-800",
                ].join(" ")}
              >
                {a.label}
              </span>
              {a.description ? (
                <span className="mt-0.5 line-clamp-2 block text-[11px] leading-snug text-gray-500">
                  {a.description}
                </span>
              ) : null}
            </span>
          </button>
        );
      })}
    </div>
  );
}
