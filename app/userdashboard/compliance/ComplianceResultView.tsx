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
    <div className="mt-6">
      <h3 className="text-sm font-semibold text-brand-navy">Sources</h3>
      <ul className="mt-2 space-y-1.5">
        {sources.map((s, i) => {
          const page = s.page != null ? ` · p.${s.page}` : "";
          const auth = s.authority ? `${s.authority} · ` : "";
          return (
            <li
              key={`${s.source}-${s.page}-${i}`}
              className="rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-600"
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
      <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        {data.summary ||
          "Select an authority above and run Analyze again."}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-gray-600">
          <span className="font-semibold text-brand-navy">
            {data.authorityLabels || data.authorities.join(", ")}
          </span>
          <span className="text-gray-400">
            {" "}
            ·{" "}
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
                  className="flex gap-3 rounded-xl border border-gray-100 bg-white p-4"
                >
                  <Badge variant={severityVariant(gapSeverity(g))}>
                    {gapSeverity(g)}
                  </Badge>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-900">
                      {g.title || g.id}
                    </p>
                    <p className="mt-1 text-sm text-gray-600">
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
        <div>
          <h3 className="text-sm font-semibold text-brand-navy">Checklist</h3>
          <div className="mt-3 overflow-x-auto rounded-xl border border-gray-100">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-gray-50 text-xs font-semibold uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-3 py-2.5">Status</th>
                  <th className="px-3 py-2.5">Requirement</th>
                  <th className="hidden px-3 py-2.5 sm:table-cell">Proposal</th>
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
                    <td className="px-3 py-3 align-top text-gray-800">
                      {c.requirement || ""}
                    </td>
                    <td className="hidden px-3 py-3 align-top text-gray-600 sm:table-cell">
                      {c.evidence_from_proposal || c.notes || "—"}
                    </td>
                    <td className="px-3 py-3 align-top text-xs text-gray-500">
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
