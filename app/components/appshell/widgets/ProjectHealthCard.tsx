"use client";

import { useMemo, useState } from "react";
import type { ProjectHealthSplit } from "@/app/userdashboard/dashboardData";

type ProjectHealthCardProps = {
  health: ProjectHealthSplit;
};

type HealthSlice = "submitted" | "draft";

export default function ProjectHealthCard({ health }: ProjectHealthCardProps) {
  const [activeSlice, setActiveSlice] = useState<HealthSlice>("submitted");

  const total = Math.max(health.total, health.submitted + health.draft, 1);
  const radius = 48;
  const circumference = 2 * Math.PI * radius;
  const submittedLen = (health.submitted / total) * circumference;
  const draftLen = (health.draft / total) * circumference;

  const sliceMeta = useMemo(() => {
    let submittedPct = 0;
    let draftPct = 0;

    if (health.total > 0) {
      submittedPct = Math.round((health.submitted / health.total) * 100);
      // Keep the pair summing to exactly 100 (avoids 63+38=101 from independent rounding)
      draftPct = Math.max(0, 100 - submittedPct);
      if (health.draft === 0) {
        submittedPct = 100;
        draftPct = 0;
      } else if (health.submitted === 0) {
        submittedPct = 0;
        draftPct = 100;
      }
    }

    return {
      submitted: {
        percent: submittedPct,
        label: "Submitted",
        count: health.submitted,
        color: "#16a34a",
      },
      draft: {
        percent: draftPct,
        label: "Draft",
        count: health.draft,
        color: "#f59e0b",
      },
    } as const;
  }, [health.total, health.submitted, health.draft]);

  const active = sliceMeta[activeSlice];

  return (
    <div className="flex h-full flex-col rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
      <h2 className="text-sm font-bold text-brand-navy">Project Health</h2>

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
            {health.submitted > 0 && (
              <circle
                cx="70"
                cy="70"
                r={radius}
                fill="none"
                stroke={sliceMeta.submitted.color}
                strokeWidth="14"
                strokeDasharray={`${submittedLen} ${circumference}`}
                strokeDashoffset={0}
                strokeLinecap="butt"
                className="cursor-pointer outline-none focus:outline-none"
                style={{ outline: "none" }}
                aria-label={`Show submitted ${sliceMeta.submitted.percent}%`}
                onClick={() => setActiveSlice("submitted")}
              />
            )}
            {health.draft > 0 && (
              <circle
                cx="70"
                cy="70"
                r={radius}
                fill="none"
                stroke={sliceMeta.draft.color}
                strokeWidth="14"
                strokeDasharray={`${draftLen} ${circumference}`}
                strokeDashoffset={-submittedLen}
                strokeLinecap="butt"
                className="cursor-pointer outline-none focus:outline-none"
                style={{ outline: "none" }}
                aria-label={`Show draft ${sliceMeta.draft.percent}%`}
                onClick={() => setActiveSlice("draft")}
              />
            )}
          </svg>
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-xl font-bold text-brand-navy">{active.percent}%</span>
          </div>
        </div>

        <ul className="w-full max-w-[11rem] space-y-2">
          <li className="flex items-center justify-between gap-3 text-sm">
            <span className="flex min-w-0 items-center gap-2 text-gray-600">
              <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-brand-blue" />
              <span className="truncate">Total</span>
            </span>
            <span className="shrink-0 font-semibold tabular-nums text-brand-navy">
              {health.total}
            </span>
          </li>
          <li className="flex items-center justify-between gap-3 text-sm">
            <span className="flex min-w-0 items-center gap-2 text-gray-600">
              <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-status-success" />
              <span className="truncate">Submitted</span>
            </span>
            <span className="shrink-0 font-semibold tabular-nums text-brand-navy">
              {health.submitted}
            </span>
          </li>
          <li className="flex items-center justify-between gap-3 text-sm">
            <span className="flex min-w-0 items-center gap-2 text-gray-600">
              <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-status-warning" />
              <span className="truncate">Draft</span>
            </span>
            <span className="shrink-0 font-semibold tabular-nums text-brand-navy">
              {health.draft}
            </span>
          </li>
        </ul>
      </div>

      <p className="mt-auto pt-3 text-center text-xs leading-snug text-gray-500">
        {health.total === 0
          ? "No projects yet"
          : `${active.count} of ${health.total} projects ${active.label.toLowerCase()} (${active.percent}%)`}
      </p>
    </div>
  );
}
