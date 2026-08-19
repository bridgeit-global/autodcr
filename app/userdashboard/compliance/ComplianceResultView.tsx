"use client";

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

function SourcesList({ sources }: { sources: RagSource[] }) {
  if (!sources.length) return null;
  return (
    <div className="mt-5 sm:mt-6">
      <h3 className="text-sm font-semibold text-brand-navy">Sources</h3>
      <ul className="mt-2 space-y-1.5">
        {sources.map((s, i) => {
          const page = s.page != null ? ` · p.${s.page}` : "";
          const auth = s.authority ? `${s.authority} · ` : "";
          return (
            <li
              key={`${s.source}-${s.page}-${i}`}
              className="wrap-break-word rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-600"
            >
              {auth}
              {s.source}
              {page}
            </li>
          );
        })}
      </ul>
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
      <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-900 sm:px-4">
        {data.summary ||
          "Select an authority above and run Analyze again."}
      </div>
    );
  }

  return (
    <div className="min-w-0 space-y-5 sm:space-y-6">
      <div>
        <p className="text-sm text-gray-600">
          <span className="font-semibold text-brand-navy">
            {data.authorityLabels || data.authorities.join(", ")}
          </span>
          <span className="mt-0.5 block text-gray-400 sm:mt-0 sm:inline">
            <span className="hidden sm:inline"> · </span>
            {data.authoritySource === "user_override"
              ? "your selection"
              : "auto-detected"}{" "}
            ({data.detection?.confidence || "?"})
          </span>
        </p>
        {data.detection?.rationale && (
          <p className="mt-2 text-sm text-gray-500">{data.detection.rationale}</p>
        )}
        {data.summary && (
          <p className="mt-3 text-sm leading-relaxed text-gray-800">
            {data.summary}
          </p>
        )}
      </div>

      {data.gaps?.length ? (
        <div>
          <h3 className="text-sm font-semibold text-brand-navy">Gaps</h3>
          <ul className="mt-3 space-y-3">
            {data.gaps.map((g, i) => {
              const cite = formatCite(g.regulation_cite);
              return (
                <li
                  key={g.id || i}
                  className="flex flex-col gap-2 rounded-xl border border-gray-100 bg-white p-3 sm:flex-row sm:gap-3 sm:p-4"
                >
                  <Badge
                    variant={severityVariant(gapSeverity(g))}
                    className="w-fit shrink-0"
                  >
                    {gapSeverity(g)}
                  </Badge>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-900">
                      {g.title || g.id}
                    </p>
                    <p className="mt-1 wrap-break-word text-sm text-gray-600">
                      {g.detail || ""}
                      {cite !== "—" ? ` (${cite})` : ""}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}

      {data.checklist?.length ? (
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-brand-navy">Checklist</h3>

          <ul className="mt-3 space-y-3 md:hidden">
            {data.checklist.map((c, i) => (
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
                <p className="mt-2 text-sm text-gray-600">
                  {c.evidence_from_proposal || c.notes || "—"}
                </p>
                <p className="mt-1 wrap-break-word text-xs text-gray-500">
                  {formatCite(c.regulation_cite)}
                </p>
              </li>
            ))}
          </ul>

          <div className="mt-3 hidden overflow-x-auto rounded-xl border border-gray-100 md:block">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-gray-50 text-xs font-semibold uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-3 py-2.5">Status</th>
                  <th className="px-3 py-2.5">Requirement</th>
                  <th className="px-3 py-2.5">Proposal</th>
                  <th className="px-3 py-2.5">Cite</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data.checklist.map((c, i) => (
                  <tr key={c.id || i}>
                    <td className="whitespace-nowrap px-3 py-3 align-top">
                      <Badge variant={statusVariant(c.status)}>
                        {c.status || "unclear"}
                      </Badge>
                    </td>
                    <td className="max-w-xs px-3 py-3 align-top text-gray-800">
                      {c.requirement || ""}
                    </td>
                    <td className="max-w-sm px-3 py-3 align-top text-gray-600">
                      {c.evidence_from_proposal || c.notes || "—"}
                    </td>
                    <td className="max-w-48 wrap-break-word px-3 py-3 align-top text-xs text-gray-500">
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
