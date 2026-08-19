"use client";

import type { ReactNode } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  CircleHelp,
  FileText,
  ShieldAlert,
} from "lucide-react";
import Badge from "@/app/components/ui/Badge";
import type {
  ComplianceGap,
  ComplianceResult,
  RagSource,
} from "@/app/lib/regulationsRag/types";

function formatCite(cite?: { source?: string; page?: number | null }) {
  if (!cite?.source) return "—";
  return cite.page != null ? `${cite.source} p.${cite.page}` : cite.source;
}

function statusVariant(status?: string) {
  if (status === "met") return "success" as const;
  if (status === "gap") return "danger" as const;
  return "warning" as const;
}

function severityVariant(severity?: string) {
  if (severity === "high") return "danger" as const;
  if (severity === "low") return "info" as const;
  return "warning" as const;
}

function gapSeverity(gap: ComplianceGap) {
  return String(gap.severity || "medium");
}

function severityAccent(severity?: string) {
  if (severity === "high") return "border-l-red-500";
  if (severity === "low") return "border-l-blue-400";
  return "border-l-amber-400";
}

function SourcesList({ sources }: { sources: RagSource[] }) {
  if (!sources.length) return null;
  return (
    <div>
      <h3 className="text-sm font-semibold text-brand-navy">Sources</h3>
      <ul className="mt-3 space-y-2">
        {sources.map((s, i) => {
          const page = s.page != null ? ` · p.${s.page}` : "";
          const auth = s.authority ? `${s.authority} · ` : "";
          return (
            <li
              key={`${s.source}-${s.page}-${i}`}
              className="flex gap-2.5 rounded-xl bg-gray-50 px-3 py-2.5"
            >
              <FileText className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gray-400" />
              <div className="min-w-0">
                <p className="wrap-break-word text-xs font-semibold text-brand-navy">
                  {auth}
                  {s.source}
                  {page}
                </p>
                {s.snippet ? (
                  <p className="mt-1.5 whitespace-pre-wrap wrap-break-word text-xs leading-relaxed text-gray-600">
                    {s.snippet}
                  </p>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function Metric({
  label,
  value,
  icon,
  tone,
}: {
  label: string;
  value: number;
  icon: ReactNode;
  tone: "success" | "danger" | "warning";
}) {
  const tones = {
    success: "bg-green-50 text-green-700",
    danger: "bg-red-50 text-red-700",
    warning: "bg-amber-50 text-amber-700",
  };
  return (
    <div className="flex min-w-0 items-center gap-3 rounded-xl border border-gray-100 bg-white p-3 sm:p-4">
      <div
        className={[
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
          tones[tone],
        ].join(" ")}
      >
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-lg font-bold leading-none text-brand-navy">{value}</p>
        <p className="mt-1 truncate text-xs font-medium text-gray-500">{label}</p>
      </div>
    </div>
  );
}

export default function ComplianceResultView({
  data,
}: {
  data: ComplianceResult;
}) {
  if (data.needsAuthoritySelection) {
    return (
      <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3.5 text-sm text-amber-900">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
        <p>
          {data.summary ||
            "Select an authority above and run Analyze again."}
        </p>
      </div>
    );
  }

  const checklist = data.checklist || [];
  const met = checklist.filter((c) => c.status === "met").length;
  const gap = checklist.filter((c) => c.status === "gap").length;
  const unclear = checklist.filter(
    (c) => c.status !== "met" && c.status !== "gap"
  ).length;
  const total = met + gap + unclear;

  return (
    <div className="min-w-0 space-y-6">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-base font-semibold text-brand-navy">
            {data.authorityLabels || data.authorities.join(", ") || "Regulations"}
          </p>
          <Badge variant="neutral">
            {data.authoritySource === "user_override"
              ? "Your selection"
              : "Auto-detected"}
            {data.detection?.confidence ? ` · ${data.detection.confidence}` : ""}
          </Badge>
        </div>
        {data.detection?.rationale ? (
          <p className="mt-2 text-sm leading-relaxed text-gray-500">
            {data.detection.rationale}
          </p>
        ) : null}
        {data.summary ? (
          <p className="mt-3 text-sm leading-relaxed text-gray-800">
            {data.summary}
          </p>
        ) : null}
      </div>

      {total > 0 ? (
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            <Metric
              label="Met"
              value={met}
              tone="success"
              icon={<CheckCircle2 className="h-4 w-4" />}
            />
            <Metric
              label="Gaps"
              value={gap || data.gaps?.length || 0}
              tone="danger"
              icon={<ShieldAlert className="h-4 w-4" />}
            />
            <Metric
              label="Unclear"
              value={unclear}
              tone="warning"
              icon={<CircleHelp className="h-4 w-4" />}
            />
          </div>
          <div className="flex h-1.5 overflow-hidden rounded-full bg-gray-100">
            {met > 0 ? (
              <div
                className="bg-status-success"
                style={{ width: `${(met / total) * 100}%` }}
              />
            ) : null}
            {gap > 0 ? (
              <div
                className="bg-status-danger"
                style={{ width: `${(gap / total) * 100}%` }}
              />
            ) : null}
            {unclear > 0 ? (
              <div
                className="bg-status-warning"
                style={{ width: `${(unclear / total) * 100}%` }}
              />
            ) : null}
          </div>
        </div>
      ) : null}

      {data.gaps?.length ? (
        <div>
          <h3 className="text-sm font-semibold text-brand-navy">Gaps to address</h3>
          <ul className="mt-3 space-y-3">
            {data.gaps.map((g, i) => {
              const cite = formatCite(g.regulation_cite);
              const severity = gapSeverity(g);
              return (
                <li
                  key={g.id || i}
                  className={[
                    "rounded-xl border border-gray-100 border-l-4 bg-white p-3 sm:p-4",
                    severityAccent(severity),
                  ].join(" ")}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={severityVariant(severity)}>{severity}</Badge>
                    <p className="text-sm font-semibold text-gray-900">
                      {g.title || g.id}
                    </p>
                  </div>
                  <p className="mt-2 wrap-break-word text-sm leading-relaxed text-gray-600">
                    {g.detail || ""}
                  </p>
                  {cite !== "—" ? (
                    <p className="mt-2 text-xs text-gray-400">{cite}</p>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}

      {checklist.length ? (
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-brand-navy">Checklist</h3>

          <ul className="mt-3 space-y-3 md:hidden">
            {checklist.map((c, i) => (
              <li
                key={c.id || i}
                className="rounded-xl border border-gray-100 bg-white p-3"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={statusVariant(c.status)}>
                    {c.status || "unclear"}
                  </Badge>
                  <p className="text-sm font-semibold text-gray-900">
                    {c.requirement || ""}
                  </p>
                </div>
                <p className="mt-2 text-sm leading-relaxed text-gray-600">
                  {c.evidence_from_proposal || c.notes || "—"}
                </p>
                <p className="mt-1 wrap-break-word text-xs text-gray-400">
                  {formatCite(c.regulation_cite)}
                </p>
              </li>
            ))}
          </ul>

          <div className="mt-3 hidden overflow-x-auto rounded-xl border border-gray-100 md:block">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Requirement</th>
                  <th className="px-4 py-3">Proposal</th>
                  <th className="px-4 py-3">Cite</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {checklist.map((c, i) => (
                  <tr key={c.id || i} className="align-top hover:bg-slate-50/80">
                    <td className="whitespace-nowrap px-4 py-3">
                      <Badge variant={statusVariant(c.status)}>
                        {c.status || "unclear"}
                      </Badge>
                    </td>
                    <td className="max-w-xs px-4 py-3 text-gray-800">
                      {c.requirement || ""}
                    </td>
                    <td className="max-w-sm px-4 py-3 text-gray-600">
                      {c.evidence_from_proposal || c.notes || "—"}
                    </td>
                    <td className="max-w-48 wrap-break-word px-4 py-3 text-xs text-gray-500">
                      {formatCite(c.regulation_cite)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {data.sources?.length ? <SourcesList sources={data.sources} /> : null}
    </div>
  );
}
