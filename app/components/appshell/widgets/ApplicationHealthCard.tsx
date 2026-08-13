"use client";

import { useEffect, useMemo, useState } from "react";
import type { ApplicationHealthSplit } from "@/app/userdashboard/applicationsList";
import type { ApplicationWorkflowStage } from "@/app/components/DraftApplicationsModal";

export type ApplicationHealthSlice = ApplicationWorkflowStage;

type ApplicationHealthCardProps = {
  health: ApplicationHealthSplit;
  activeSlice?: ApplicationHealthSlice;
  onSliceChange?: (stage: ApplicationHealthSlice) => void;
};

const SLICE_ORDER: ApplicationHealthSlice[] = [
  "draft",
  "in_process",
  "approved_verified",
  "rejected",
];

const SLICE_META_BASE = {
  draft: {
    label: "Draft",
    color: "#f59e0b",
    legendClass: "bg-status-warning",
  },
  in_process: {
    label: "In Process",
    color: "#2563eb",
    legendClass: "bg-brand-blue",
  },
  approved_verified: {
    label: "Approved",
    color: "#16a34a",
    legendClass: "bg-status-success",
  },
  rejected: {
    label: "Rejected",
    color: "#e11d48",
    legendClass: "bg-status-danger",
  },
} as const;

function countForSlice(health: ApplicationHealthSplit, slice: ApplicationHealthSlice) {
  if (slice === "draft") return health.draft;
  if (slice === "in_process") return health.inProcess;
  if (slice === "approved_verified") return health.approved;
  return health.rejected;
}

/** Round percents so non-zero slices sum to exactly 100. */
function roundPercentsTo100(counts: number[], total: number): number[] {
  if (total <= 0) return counts.map(() => 0);
  const raw = counts.map((c) => (c / total) * 100);
  const indexes = counts
    .map((c, i) => (c > 0 ? i : -1))
    .filter((i) => i >= 0);
  if (indexes.length === 0) return counts.map(() => 0);
  if (indexes.length === 1) {
    const out = counts.map(() => 0);
    out[indexes[0]] = 100;
    return out;
  }
  const out = counts.map(() => 0);
  let allocated = 0;
  for (let i = 0; i < indexes.length - 1; i++) {
    const idx = indexes[i];
    out[idx] = Math.round(raw[idx]);
    allocated += out[idx];
  }
  out[indexes[indexes.length - 1]] = Math.max(0, 100 - allocated);
  return out;
}

export default function ApplicationHealthCard({
  health,
  activeSlice: controlledSlice,
  onSliceChange,
}: ApplicationHealthCardProps) {
  const [internalSlice, setInternalSlice] = useState<ApplicationHealthSlice>("draft");
  const activeSlice = controlledSlice ?? internalSlice;

  useEffect(() => {
    if (controlledSlice) setInternalSlice(controlledSlice);
  }, [controlledSlice]);

  const setActiveSlice = (slice: ApplicationHealthSlice) => {
    setInternalSlice(slice);
    onSliceChange?.(slice);
  };

  const denominator = Math.max(
    health.total,
    health.draft + health.inProcess + health.approved + health.rejected,
    1
  );
  const radius = 48;
  const circumference = 2 * Math.PI * radius;

  const counts = useMemo(
    () =>
      SLICE_ORDER.map((key) => countForSlice(health, key)),
    [health]
  );

  const percents = useMemo(
    () => roundPercentsTo100(counts, health.total),
    [counts, health.total]
  );

  const arcLens = counts.map((c) => (c / denominator) * circumference);

  const activePercent = percents[SLICE_ORDER.indexOf(activeSlice)] ?? 0;
  const activeCount = countForSlice(health, activeSlice);
  const activeLabel = SLICE_META_BASE[activeSlice].label;

  return (
    <div className="flex h-full flex-col rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
      <h2 className="text-sm font-bold text-brand-navy">Application Health</h2>

      <div className="mt-3 flex flex-col items-center gap-3">
        <div className="relative h-28 w-28 shrink-0">
          <svg viewBox="0 0 140 140" className="h-full w-full -rotate-90 outline-none">
            <circle
              cx="70"
              cy="70"
              r={radius}
              fill="none"
              stroke="#e5e7eb"
              strokeWidth="14"
            />
            {SLICE_ORDER.map((key, index) => {
              if (counts[index] <= 0) return null;
              const offset = -arcLens.slice(0, index).reduce((a, b) => a + b, 0);
              return (
                <circle
                  key={key}
                  cx="70"
                  cy="70"
                  r={radius}
                  fill="none"
                  stroke={SLICE_META_BASE[key].color}
                  strokeWidth="14"
                  strokeDasharray={`${arcLens[index]} ${circumference}`}
                  strokeDashoffset={offset}
                  strokeLinecap="butt"
                  className="cursor-pointer outline-none focus:outline-none"
                  style={{ outline: "none" }}
                  aria-label={`Show ${SLICE_META_BASE[key].label} ${percents[index]}%`}
                  onClick={() => setActiveSlice(key)}
                />
              );
            })}
          </svg>
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-xl font-bold text-brand-navy">{activePercent}%</span>
          </div>
        </div>

        <ul className="w-full max-w-[12rem] space-y-2">
          <li className="flex items-center justify-between gap-3 text-sm">
            <span className="flex min-w-0 items-center gap-2 text-gray-600">
              <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-brand-navy" />
              <span className="truncate">Total</span>
            </span>
            <span className="shrink-0 font-semibold tabular-nums text-brand-navy">
              {health.total}
            </span>
          </li>
          {SLICE_ORDER.map((key, index) => (
            <li key={key}>
              <button
                type="button"
                onClick={() => setActiveSlice(key)}
                className="flex w-full items-center justify-between gap-3 text-left text-sm hover:opacity-80"
              >
                <span className="flex min-w-0 items-center gap-2 text-gray-600">
                  <span
                    className={`h-2.5 w-2.5 shrink-0 rounded-full ${SLICE_META_BASE[key].legendClass}`}
                  />
                  <span className="truncate">{SLICE_META_BASE[key].label}</span>
                </span>
                <span className="shrink-0 font-semibold tabular-nums text-brand-navy">
                  {counts[index]}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>

      <p className="mt-auto pt-3 text-center text-xs leading-snug text-gray-500">
        {health.total === 0
          ? "No applications yet"
          : `${activeCount} of ${health.total} applications ${activeLabel.toLowerCase()} (${activePercent}%)`}
      </p>
    </div>
  );
}
