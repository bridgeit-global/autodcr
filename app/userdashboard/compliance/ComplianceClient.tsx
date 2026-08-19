"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { FileUp, Loader2 } from "lucide-react";
import CustomSelect from "@/app/components/CustomSelect";
import Button from "@/app/components/ui/Button";
import { Card } from "@/app/components/ui/Card";
import { useDashboardProjects } from "@/app/hooks/useDashboardProjects";
import { normalizeAuthorities } from "@/app/lib/regulationsRag/regulations";
import type {
  AuthorityWithDocuments,
  ComplianceResult,
} from "@/app/lib/regulationsRag/types";
import {
  filterNonDraftProjects,
  getProjectLabel,
} from "@/app/userdashboard/ownerWorkspaceConsultants";
import AuthorityChips from "./AuthorityChips";
import AskPanel from "./AskPanel";
import ComplianceResultView from "./ComplianceResultView";

type TabId = "compliance" | "ask";

type PlotDetails = {
  planningAuthority?: string;
  ward?: string;
  dpZone?: string;
  majorUseOfPlot?: string;
  grossPlotArea?: string | number;
};

function getPlotDetails(project: {
  save_plot_details?: unknown;
}): PlotDetails {
  const plot = project.save_plot_details;
  if (!plot || typeof plot !== "object") return {};
  return plot as PlotDetails;
}

function getPlanningAuthority(project: {
  save_plot_details?: unknown;
}): string {
  return getPlotDetails(project).planningAuthority?.trim() || "";
}

function buildProjectNotes(project: {
  title: string;
  project_info?: { proposalNo?: string; title?: string } | null;
  save_plot_details?: unknown;
}): string {
  const plot = getPlotDetails(project);
  const lines: string[] = [`Project: ${getProjectLabel(project)}`];
  const authority = plot.planningAuthority?.trim();
  if (authority) lines.push(`Planning authority: ${authority}`);
  if (plot.ward?.trim()) lines.push(`Ward: ${plot.ward.trim()}`);
  if (plot.dpZone?.trim()) lines.push(`DP zone: ${plot.dpZone.trim()}`);
  if (plot.majorUseOfPlot?.trim()) {
    lines.push(`Proposed use: ${plot.majorUseOfPlot.trim()}`);
  }
  if (plot.grossPlotArea != null && String(plot.grossPlotArea).trim()) {
    lines.push(`Gross plot area: ${String(plot.grossPlotArea).trim()}`);
  }
  return lines.join("\n");
}

export default function ComplianceClient() {
  const searchParams = useSearchParams();
  const { projects, loading: projectsLoading } = useDashboardProjects();
  const nonDraftProjects = useMemo(
    () => filterNonDraftProjects(projects),
    [projects]
  );

  const [tab, setTab] = useState<TabId>("compliance");
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [authorities, setAuthorities] = useState<AuthorityWithDocuments[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [notes, setNotes] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [hint, setHint] = useState("Select a project to begin.");
  const [result, setResult] = useState<ComplianceResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const selectedProject =
    nonDraftProjects.find((p) => p.id === selectedProjectId) ?? null;

  useEffect(() => {
    const fromQuery = searchParams.get("projectId")?.trim() || "";
    if (projectsLoading) return;
    if (fromQuery && nonDraftProjects.some((p) => p.id === fromQuery)) {
      setSelectedProjectId(fromQuery);
      return;
    }
    if (!selectedProjectId && nonDraftProjects[0]) {
      setSelectedProjectId(nonDraftProjects[0].id);
    }
  }, [searchParams, projectsLoading, nonDraftProjects, selectedProjectId]);

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/regulations/authorities")
      .then((res) => res.json())
      .then((data: { authorities?: AuthorityWithDocuments[] }) => {
        if (!cancelled) setAuthorities(data.authorities || []);
      })
      .catch(() => {
        if (!cancelled) setHint("Could not load authorities");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!selectedProjectId) return;
    const project = nonDraftProjects.find((p) => p.id === selectedProjectId);
    if (!project) return;

    const ids = normalizeAuthorities(getPlanningAuthority(project));
    setSelected(new Set(ids));
    setNotes(buildProjectNotes(project));
    setHint("Upload a proposal to begin.");
    setResult(null);
    setError(null);
  }, [selectedProjectId, nonDraftProjects]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function applyDetected(ids: string[] | undefined) {
    if (!ids?.length) return;
    setSelected(new Set(ids));
  }

  async function onAnalyze(e: FormEvent) {
    e.preventDefault();
    if (!selectedProjectId || !file || busy) return;

    setBusy(true);
    setHint("Analyzing proposal against regulations…");
    setResult(null);
    setError(null);

    const body = new FormData();
    body.append("proposal", file);
    body.append("projectId", selectedProjectId);
    if (notes.trim()) body.append("notes", notes.trim());
    if (selected.size) body.append("authorities", [...selected].join(","));

    try {
      const res = await fetch("/api/regulations/compliance", {
        method: "POST",
        body,
      });
      const data = (await res.json()) as ComplianceResult & { error?: string };
      if (!res.ok) throw new Error(data.error || "Analysis failed");

      if (data.needsAuthoritySelection && data.detection?.detected?.length) {
        applyDetected(data.detection.detected);
      } else if (data.detection?.detected?.length && selected.size === 0) {
        applyDetected(data.detection.detected);
      }

      setResult(data);
      setHint(
        data.needsAuthoritySelection ? "Select authority and retry" : "Done"
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
      setHint("Error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto w-full min-w-0 max-w-5xl space-y-4 px-3 py-4 sm:space-y-5 sm:px-6 sm:py-6 lg:px-8">
      <div className="flex min-w-0 flex-col gap-3 sm:gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-brand-blue">
            Regulation library
          </p>
          <h1 className="mt-1 text-lg font-bold text-brand-navy sm:text-xl">
            Regulation compliance
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-gray-500">
            Match your proposal to CIDCO, MIDC, SRA, or MCGM/DCPR — or ask the
            regulation library.
          </p>
        </div>
        <div className="w-full min-w-0 lg:max-w-sm">
          <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-gray-500">
            Project
          </label>
          <CustomSelect
            value={selectedProjectId}
            onChange={setSelectedProjectId}
            options={
              projectsLoading
                ? []
                : nonDraftProjects.map((project) => ({
                    value: project.id,
                    label: getProjectLabel(project),
                  }))
            }
            placeholder={
              projectsLoading
                ? "Loading projects…"
                : nonDraftProjects.length === 0
                  ? "No submitted projects"
                  : "Select a project"
            }
            disabled={projectsLoading || nonDraftProjects.length === 0}
          />
        </div>
      </div>

      <div className="flex gap-1 rounded-xl bg-gray-100 p-1">
        {(
          [
            { id: "compliance", label: "Check", long: "Compliance Check" },
            { id: "ask", label: "Ask", long: "Ask Regulations" },
          ] as const
        ).map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={[
              "min-h-11 flex-1 rounded-lg px-2 py-2 text-xs font-semibold transition-colors sm:min-h-10 sm:px-3 sm:text-sm",
              tab === t.id
                ? "bg-white text-brand-navy shadow-sm"
                : "text-gray-500 hover:text-brand-navy",
            ].join(" ")}
          >
            <span className="sm:hidden">{t.label}</span>
            <span className="hidden sm:inline">{t.long}</span>
          </button>
        ))}
      </div>

      {tab === "compliance" ? (
        <div className="min-w-0 space-y-4 sm:space-y-5">
          <Card padding="none" className="p-4 sm:p-6">
            <form onSubmit={onAnalyze} className="space-y-4">
              <div>
                <span className="mb-1.5 block text-sm font-medium text-gray-700">
                  Project proposal (PDF)
                </span>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="application/pdf,.pdf"
                  disabled={!selectedProjectId}
                  className="sr-only"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                />
                <button
                  type="button"
                  disabled={!selectedProjectId}
                  onClick={() => fileInputRef.current?.click()}
                  className="flex w-full min-w-0 items-center gap-3 rounded-lg border border-dashed border-gray-200 bg-gray-50 px-3 py-3 text-left disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <FileUp className="h-4 w-4 shrink-0 text-brand-blue" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-gray-800">
                      {file ? file.name : "Choose PDF"}
                    </span>
                    <span className="block text-xs text-gray-500">
                      {file
                        ? `${Math.max(1, Math.round(file.size / 1024))} KB`
                        : "PDF only, up to 25 MB"}
                    </span>
                  </span>
                </button>
              </div>

              <fieldset className="min-w-0">
                <legend className="mb-1.5 text-sm font-medium text-gray-700">
                  Authorities{" "}
                  <span className="block font-normal text-gray-400 sm:inline">
                    {getPlanningAuthority(selectedProject ?? {})
                      ? "(from project; override anytime)"
                      : "(auto-detected if empty)"}
                  </span>
                </legend>
                <AuthorityChips
                  authorities={authorities}
                  selected={selected}
                  onToggle={toggle}
                />
              </fieldset>

              <label className="block min-w-0">
                <span className="mb-1.5 block text-sm font-medium text-gray-700">
                  Project notes{" "}
                  <span className="font-normal text-gray-400">(optional)</span>
                </span>
                <textarea
                  rows={3}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. Residential tower in CIDCO Node, Plot X, proposed FSI 2.5…"
                  className="w-full resize-y rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-base text-gray-900 outline-none placeholder:text-gray-400 focus:border-brand-blue focus:bg-white focus:ring-2 focus:ring-brand-blue/20 sm:text-sm"
                />
              </label>

              <Button
                type="submit"
                disabled={busy || !file || !selectedProjectId}
                className="w-full sm:w-auto"
              >
                {busy ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Analyzing…
                  </>
                ) : (
                  "Analyze"
                )}
              </Button>
            </form>
          </Card>

          <p className="text-xs text-gray-400">{hint}</p>

          {error ? (
            <div className="wrap-break-word rounded-xl border border-red-200 bg-red-50 px-3 py-3 text-sm text-red-800 sm:px-4">
              {error}
            </div>
          ) : null}

          {result ? (
            <Card padding="none" className="overflow-hidden p-4 sm:p-6">
              <ComplianceResultView data={result} />
            </Card>
          ) : null}
        </div>
      ) : (
        <AskPanel
          authorities={authorities}
          selected={selected}
          onToggle={toggle}
        />
      )}
    </div>
  );
}
