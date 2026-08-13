"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  ChevronRight,
  CircleDashed,
  FilePlus2,
  FileStack,
  FileText,
  Loader2,
  XCircle,
} from "lucide-react";
import MetricCard from "@/app/components/ui/MetricCard";
import ApplicationHealthCard from "@/app/components/appshell/widgets/ApplicationHealthCard";
import { useDashboardProjects } from "@/app/hooks/useDashboardProjects";
import { supabase } from "@/app/utils/supabase";
import { BTN_PRIMARY } from "@/app/utils/buttonClasses";
import {
  applicationHref,
  bucketApplicationHealth,
  fetchApplicationsList,
  filterApplicationsByStage,
  getApplicationStage,
  type ApplicationStageFilter,
  type DashboardApplication,
} from "@/app/userdashboard/applicationsList";
import type { ApplicationWorkflowStage } from "@/app/components/DraftApplicationsModal";

const STAGE_LABELS: Record<ApplicationWorkflowStage, string> = {
  draft: "Draft",
  in_process: "In Process",
  approved_verified: "Approved",
  rejected: "Rejected",
};

const STAGE_BADGE_CLASSES: Record<ApplicationWorkflowStage, string> = {
  draft: "bg-amber-50 text-amber-800 ring-amber-200",
  in_process: "bg-blue-50 text-blue-800 ring-blue-200",
  approved_verified: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  rejected: "bg-rose-50 text-rose-800 ring-rose-200",
};

function formatCreatedAt(value?: string) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function filterToActiveSlice(
  filter: ApplicationStageFilter
): ApplicationWorkflowStage | undefined {
  return filter === "all" ? undefined : filter;
}

export default function ApplicationsHubPage() {
  const router = useRouter();
  const { projects, loading: projectsLoading, isConsultant } = useDashboardProjects();
  const [applications, setApplications] = useState<DashboardApplication[]>([]);
  const [applicationsLoading, setApplicationsLoading] = useState(true);
  const [stageFilter, setStageFilter] = useState<ApplicationStageFilter>("all");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (projectsLoading) return;

      setApplicationsLoading(true);
      try {
        const { data: authData } = await supabase.auth.getUser();
        const userId = authData.user?.id;
        if (!userId) {
          if (!cancelled) setApplications([]);
          return;
        }

        const rows = await fetchApplicationsList({
          userId,
          isConsultant,
          projectIds: projects.map((p) => String(p.id)),
        });
        if (!cancelled) setApplications(rows);
      } catch (err) {
        console.error("Failed to load applications:", err);
        if (!cancelled) setApplications([]);
      } finally {
        if (!cancelled) setApplicationsLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [projects, projectsLoading, isConsultant]);

  const health = useMemo(() => bucketApplicationHealth(applications), [applications]);

  const filtered = useMemo(
    () => filterApplicationsByStage(applications, stageFilter),
    [applications, stageFilter]
  );

  const loading = projectsLoading || applicationsLoading;
  const listTitle =
    stageFilter === "all" ? "All Applications" : `${STAGE_LABELS[stageFilter]} Applications`;

  return (
    <div className="mx-auto flex min-h-0 w-full max-w-7xl flex-1 flex-col gap-6 overflow-hidden px-4 py-6 md:px-6 md:py-8">
      <div className="flex shrink-0 flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-brand-navy md:text-2xl">
            Applications
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Track draft, in-process, approved, and rejected applications across your projects.
          </p>
        </div>
        <Link
          href="/create-application"
          className={`inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold ${BTN_PRIMARY}`}
        >
          <FilePlus2 className="h-4 w-4" />
          Create Application
        </Link>
      </div>

      <div className="grid shrink-0 grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <MetricCard
          label="Total Applications"
          value={loading ? "…" : health.total}
          hint={{ text: "All applications", tone: "neutral" }}
          icon={<FileStack className="h-5 w-5" />}
          onClick={() => setStageFilter("all")}
          className={stageFilter === "all" ? "ring-2 ring-brand-blue/30" : ""}
        />
        <MetricCard
          label="Draft"
          value={loading ? "…" : health.draft}
          hint={{ text: "Not yet submitted", tone: "neutral" }}
          icon={<FileText className="h-5 w-5" />}
          onClick={() => setStageFilter("draft")}
          className={stageFilter === "draft" ? "ring-2 ring-brand-blue/30" : ""}
        />
        <MetricCard
          label="In Process"
          value={loading ? "…" : health.inProcess}
          hint={{ text: "Under review", tone: "neutral" }}
          icon={<Loader2 className="h-5 w-5" />}
          onClick={() => setStageFilter("in_process")}
          className={stageFilter === "in_process" ? "ring-2 ring-brand-blue/30" : ""}
        />
        <MetricCard
          label="Rejected"
          value={loading ? "…" : health.rejected}
          hint={{ text: "Needs attention", tone: "danger" }}
          icon={<XCircle className="h-5 w-5" />}
          onClick={() => setStageFilter("rejected")}
          className={stageFilter === "rejected" ? "ring-2 ring-brand-blue/30" : ""}
        />
        <MetricCard
          label="Approved"
          value={loading ? "…" : health.approved}
          hint={{ text: "Verified / approved", tone: "up" }}
          icon={<CheckCircle2 className="h-5 w-5" />}
          onClick={() => setStageFilter("approved_verified")}
          className={stageFilter === "approved_verified" ? "ring-2 ring-brand-blue/30" : ""}
        />
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 lg:grid-cols-12 lg:gap-5">
        <div className="min-h-0 lg:col-span-3 lg:overflow-y-auto">
          <ApplicationHealthCard
            health={health}
            activeSlice={filterToActiveSlice(stageFilter) ?? "draft"}
            onSliceChange={(stage) => setStageFilter(stage)}
          />
        </div>

        <div className="flex min-h-0 flex-col lg:col-span-9">
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm">
            <div className="flex shrink-0 items-center justify-between gap-3 border-b border-gray-100 px-5 py-4">
              <div>
                <h2 className="text-sm font-bold text-brand-navy">{listTitle}</h2>
                <p className="mt-0.5 text-xs text-gray-500">
                  {loading
                    ? "Loading…"
                    : `${filtered.length} application${filtered.length === 1 ? "" : "s"}`}
                </p>
              </div>
              {stageFilter !== "all" && (
                <button
                  type="button"
                  onClick={() => setStageFilter("all")}
                  className="text-xs font-semibold text-brand-blue hover:text-brand-navy"
                >
                  Clear filter
                </button>
              )}
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain max-h-[calc(100dvh-22rem)] lg:max-h-none">
              {loading ? (
                <p className="px-5 py-12 text-center text-sm text-gray-500">
                  Loading applications…
                </p>
              ) : filtered.length === 0 ? (
                <div className="flex flex-col items-center gap-3 px-5 py-12 text-center">
                  <CircleDashed className="h-8 w-8 text-gray-300" />
                  <p className="text-sm text-gray-500">
                    {applications.length === 0
                      ? "No applications yet. Create one to get started."
                      : "No applications in this stage."}
                  </p>
                  {applications.length === 0 && (
                    <Link
                      href="/create-application"
                      className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold ${BTN_PRIMARY}`}
                    >
                      <FilePlus2 className="h-4 w-4" />
                      Create Application
                    </Link>
                  )}
                </div>
              ) : (
                <ul className="divide-y divide-gray-100">
                  {filtered.map((app) => {
                    const stage = getApplicationStage(app);
                    return (
                      <li key={app.id}>
                        <button
                          type="button"
                          onClick={() => router.push(applicationHref(app))}
                          className="flex w-full items-center gap-3 px-5 py-3.5 text-left transition-colors hover:bg-blue-50/60"
                        >
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-brand-blue">
                            <FileText className="h-4 w-4" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold text-brand-navy">
                              {app.permissionType}
                            </p>
                            <p className="truncate text-xs text-gray-500">
                              {app.projectTitle}
                              {app.department ? ` · ${app.department}` : ""}
                            </p>
                          </div>
                          <div className="hidden shrink-0 flex-col items-end gap-1 sm:flex">
                            <span
                              className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${STAGE_BADGE_CLASSES[stage]}`}
                            >
                              {STAGE_LABELS[stage]}
                            </span>
                            <span className="text-[11px] text-gray-400">
                              {formatCreatedAt(app.createdAt)}
                            </span>
                          </div>
                          <ChevronRight className="h-4 w-4 shrink-0 text-gray-400" />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
