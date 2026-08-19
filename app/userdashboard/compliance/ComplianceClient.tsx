"use client";

import {
  FormEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent,
} from "react";
import { useSearchParams } from "next/navigation";
import {
  CheckCircle2,
  FileUp,
  FolderKanban,
  Loader2,
  MessageSquareText,
  ShieldCheck,
  Sparkles,
  X,
} from "lucide-react";
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

const MAX_PDF_BYTES = 25 * 1024 * 1024;

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

function formatFileSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function plotPills(plot: PlotDetails) {
  const pills: { label: string; value: string }[] = [];
  if (plot.planningAuthority?.trim()) {
    pills.push({ label: "Authority", value: plot.planningAuthority.trim() });
  }
  if (plot.ward?.trim()) pills.push({ label: "Ward", value: plot.ward.trim() });
  if (plot.dpZone?.trim()) pills.push({ label: "DP zone", value: plot.dpZone.trim() });
  if (plot.majorUseOfPlot?.trim()) {
    pills.push({ label: "Use", value: plot.majorUseOfPlot.trim() });
  }
  if (plot.grossPlotArea != null && String(plot.grossPlotArea).trim()) {
    pills.push({ label: "Area", value: String(plot.grossPlotArea).trim() });
  }
  return pills;
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
  const [dragOver, setDragOver] = useState(false);
  const [result, setResult] = useState<ComplianceResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  const selectedProject =
    nonDraftProjects.find((p) => p.id === selectedProjectId) ?? null;
  const plot = getPlotDetails(selectedProject ?? {});
  const contextPills = plotPills(plot);

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
        if (!cancelled) setError("Could not load authorities.");
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
    setResult(null);
    setError(null);
  }, [selectedProjectId, nonDraftProjects]);

  useEffect(() => {
    if (!result && !error) return;
    if (typeof window !== "undefined" && window.matchMedia("(max-width: 1023px)").matches) {
      resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [result, error]);

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

  function acceptFile(next: File | undefined | null) {
    if (!next) return;
    const okType =
      next.type === "application/pdf" || next.name.toLowerCase().endsWith(".pdf");
    if (!okType) {
      setError("Please upload a PDF file.");
      return;
    }
    if (next.size > MAX_PDF_BYTES) {
      setError("PDF must be 25 MB or smaller.");
      return;
    }
    setError(null);
    setFile(next);
  }

  function onDrop(e: DragEvent<HTMLButtonElement>) {
    e.preventDefault();
    setDragOver(false);
    if (!selectedProjectId) return;
    acceptFile(e.dataTransfer.files?.[0]);
  }

  async function onAnalyze(e: FormEvent) {
    e.preventDefault();
    if (!selectedProjectId || !file || busy) return;

    setBusy(true);
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
    } catch (err) {
      setError(err instanceof Error ? err.message : "Analysis failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto w-full min-w-0 max-w-7xl space-y-5 px-4 py-5 sm:space-y-6 sm:px-6 sm:py-6 lg:px-8">
      <div className="flex min-w-0 flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <div className="hidden h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-brand-blue sm:flex">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-brand-blue">
              Regulation library
            </p>
            <h1 className="mt-0.5 text-lg font-bold text-brand-navy sm:text-xl">
              Check proposals against CIDCO, MIDC, SRA &amp; MCGM
            </h1>
            <p className="mt-1 max-w-2xl text-sm text-gray-500">
              Upload a PDF for a gap analysis, or ask the indexed regulation
              documents a question.
            </p>
          </div>
        </div>
        <div className="w-full min-w-0 lg:max-w-sm">
          <label className="mb-1.5 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-gray-500">
            <FolderKanban className="h-3.5 w-3.5" />
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

      {contextPills.length > 0 ? (
        <div className="flex gap-2 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {contextPills.map((pill) => (
            <span
              key={pill.label}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-gray-200 bg-white px-3 py-1 text-xs text-gray-600"
            >
              <span className="font-medium text-gray-400">{pill.label}</span>
              <span className="font-semibold text-brand-navy">{pill.value}</span>
            </span>
          ))}
        </div>
      ) : null}

      <div
        role="tablist"
        aria-label="Compliance tools"
        className="grid grid-cols-2 gap-1 rounded-2xl bg-gray-100 p-1"
      >
        {(
          [
            {
              id: "compliance" as const,
              label: "Check",
              long: "Compliance check",
              icon: ShieldCheck,
            },
            {
              id: "ask" as const,
              label: "Ask",
              long: "Ask regulations",
              icon: MessageSquareText,
            },
          ] as const
        ).map((t) => {
          const Icon = t.icon;
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setTab(t.id)}
              className={[
                "flex min-h-11 items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold transition-all",
                active
                  ? "bg-white text-brand-navy shadow-sm"
                  : "text-gray-500 hover:text-brand-navy",
              ].join(" ")}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="sm:hidden">{t.label}</span>
              <span className="hidden sm:inline">{t.long}</span>
            </button>
          );
        })}
      </div>

      {tab === "compliance" ? (
        <div className="grid min-w-0 items-start gap-5 lg:grid-cols-12 lg:gap-6">
          <Card padding="none" className="p-4 sm:p-6 lg:col-span-5 lg:sticky lg:top-4">
            <form onSubmit={onAnalyze} className="space-y-5">
              <div>
                <span className="mb-2 block text-sm font-medium text-gray-700">
                  Project proposal
                </span>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="application/pdf,.pdf"
                  disabled={!selectedProjectId || busy}
                  className="sr-only"
                  onChange={(e) => acceptFile(e.target.files?.[0])}
                />
                <button
                  type="button"
                  disabled={!selectedProjectId || busy}
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={(e) => {
                    e.preventDefault();
                    if (selectedProjectId && !busy) setDragOver(true);
                  }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={onDrop}
                  className={[
                    "flex w-full min-w-0 flex-col items-center gap-2 rounded-2xl border-2 border-dashed px-4 py-6 text-center transition-colors sm:py-8",
                    "disabled:cursor-not-allowed disabled:opacity-50",
                    dragOver
                      ? "border-brand-blue bg-blue-50"
                      : file
                        ? "border-brand-blue/40 bg-blue-50/60"
                        : "border-gray-200 bg-gray-50 hover:border-brand-blue/40 hover:bg-slate-50",
                  ].join(" ")}
                >
                  <span
                    className={[
                      "flex h-11 w-11 items-center justify-center rounded-2xl",
                      file ? "bg-brand-blue text-white" : "bg-white text-brand-blue shadow-sm",
                    ].join(" ")}
                  >
                    {file ? (
                      <CheckCircle2 className="h-5 w-5" />
                    ) : (
                      <FileUp className="h-5 w-5" />
                    )}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold text-gray-800">
                      {file
                        ? file.name
                        : dragOver
                          ? "Drop PDF to attach"
                          : "Drop a PDF here, or browse"}
                    </span>
                    <span className="mt-0.5 block text-xs text-gray-500">
                      {file
                        ? formatFileSize(file.size)
                        : selectedProjectId
                          ? "PDF only · up to 25 MB"
                          : "Select a project first"}
                    </span>
                  </span>
                </button>
                {file ? (
                  <button
                    type="button"
                    onClick={() => {
                      setFile(null);
                      if (fileInputRef.current) fileInputRef.current.value = "";
                    }}
                    className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-gray-500 hover:text-red-600"
                  >
                    <X className="h-3.5 w-3.5" />
                    Remove file
                  </button>
                ) : null}
              </div>

              <fieldset className="min-w-0">
                <legend className="mb-2 text-sm font-medium text-gray-700">
                  Authorities
                  <span className="mt-0.5 block text-xs font-normal text-gray-400 sm:mt-0 sm:ml-1 sm:inline">
                    {getPlanningAuthority(selectedProject ?? {})
                      ? "Pre-filled from the project — change anytime"
                      : "Leave empty to auto-detect from the PDF"}
                  </span>
                </legend>
                <AuthorityChips
                  authorities={authorities}
                  selected={selected}
                  onToggle={toggle}
                />
              </fieldset>

              <label className="block min-w-0">
                <span className="mb-2 block text-sm font-medium text-gray-700">
                  Project notes{" "}
                  <span className="font-normal text-gray-400">(optional)</span>
                </span>
                <textarea
                  rows={4}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. Residential tower in CIDCO Node, Plot X, proposed FSI 2.5…"
                  className="w-full resize-y rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-base text-gray-900 outline-none placeholder:text-gray-400 focus:border-brand-blue focus:bg-white focus:ring-2 focus:ring-brand-blue/20 sm:text-sm"
                />
              </label>

              <Button
                type="submit"
                disabled={busy || !file || !selectedProjectId}
                className="w-full"
              >
                {busy ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Analyzing proposal…
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-4 w-4" />
                    Analyze compliance
                  </>
                )}
              </Button>
            </form>
          </Card>

          <div ref={resultsRef} className="min-w-0 lg:col-span-7">
            {error ? (
              <div className="mb-4 wrap-break-word rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                {error}
              </div>
            ) : null}

            {busy ? (
              <Card padding="none" className="p-6 sm:p-8">
                <div className="flex flex-col items-center py-8 text-center sm:py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-brand-blue" />
                  <p className="mt-4 text-sm font-semibold text-brand-navy">
                    Matching your proposal to regulations…
                  </p>
                  <p className="mt-1 max-w-sm text-sm text-gray-500">
                    This usually takes a moment. Gaps, checklist items, and
                    citations will appear here.
                  </p>
                </div>
              </Card>
            ) : result ? (
              <Card padding="none" className="overflow-hidden p-4 sm:p-6">
                <ComplianceResultView data={result} />
              </Card>
            ) : (
              <Card padding="none" className="p-6 sm:p-8">
                <div className="mx-auto max-w-sm py-4 text-center sm:py-8">
                  <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-brand-blue">
                    <ShieldCheck className="h-5 w-5" />
                  </div>
                  <p className="text-sm font-semibold text-brand-navy">
                    Results will show here
                  </p>
                  <p className="mt-1 text-sm text-gray-500">
                    Complete the setup on the left, then run an analysis.
                  </p>
                  <ol className="mt-6 space-y-3 text-left">
                    {[
                      {
                        done: Boolean(selectedProjectId),
                        label: "Select a submitted project",
                      },
                      {
                        done: Boolean(file),
                        label: "Upload the proposal PDF",
                      },
                      {
                        done: false,
                        label: "Choose authorities and analyze",
                      },
                    ].map((step, i) => (
                      <li key={step.label} className="flex items-start gap-3">
                        <span
                          className={[
                            "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold",
                            step.done
                              ? "bg-green-100 text-green-700"
                              : "bg-gray-100 text-gray-500",
                          ].join(" ")}
                        >
                          {step.done ? (
                            <CheckCircle2 className="h-3.5 w-3.5" />
                          ) : (
                            i + 1
                          )}
                        </span>
                        <span
                          className={[
                            "text-sm",
                            step.done ? "text-gray-500 line-through" : "text-gray-700",
                          ].join(" ")}
                        >
                          {step.label}
                        </span>
                      </li>
                    ))}
                  </ol>
                </div>
              </Card>
            )}
          </div>
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
