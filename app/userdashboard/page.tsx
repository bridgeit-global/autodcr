"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronRight,
  ClipboardList,
  FileText,
  FolderKanban,
  Send,
} from "lucide-react";
import MetricCard from "@/app/components/ui/MetricCard";
import Modal from "@/app/components/ui/Modal";
import ProjectHealthCard from "@/app/components/appshell/widgets/ProjectHealthCard";
import UpcomingDeadlinesCard from "@/app/components/appshell/widgets/UpcomingDeadlinesCard";
import AiAssistantCard from "@/app/components/appshell/widgets/AiAssistantCard";
import QuickActionsCard from "@/app/components/appshell/widgets/QuickActionsCard";
import {
  AI_INSIGHTS,
  QUICK_ACTIONS,
  UPCOMING_DEADLINES,
  type DashboardMetric,
} from "@/app/userdashboard/dashboardData";
import {
  useDashboardProjects,
  type DashboardProject,
} from "@/app/hooks/useDashboardProjects";
import { supabase } from "@/app/utils/supabase";
import {
  applicationHref,
  fetchApplicationsList,
  type DashboardApplication,
} from "@/app/userdashboard/applicationsList";

const METRIC_ICONS = {
  "total-projects": <FolderKanban className="h-5 w-5" />,
  "submitted-projects": <Send className="h-5 w-5" />,
  "draft-projects": <ClipboardList className="h-5 w-5" />,
  "total-applications": <FileText className="h-5 w-5" />,
} as const;

type MetricId = keyof typeof METRIC_ICONS;
type ListPanel = MetricId | "edit-project";

function isDraftStatus(status: string | null | undefined) {
  return (status ?? "").trim().toLowerCase() === "draft";
}

function projectHref(project: DashboardProject) {
  return `/dashboard/project-details?projectId=${encodeURIComponent(project.id)}`;
}

export default function UserDashboardPage() {
  const router = useRouter();
  const { projects, loading: projectsLoading, isConsultant } = useDashboardProjects();
  const [applications, setApplications] = useState<DashboardApplication[]>([]);
  const [applicationsLoading, setApplicationsLoading] = useState(true);
  const [activePanel, setActivePanel] = useState<ListPanel | null>(null);

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

  const draftProjects = useMemo(
    () => projects.filter((p) => isDraftStatus(p.status)),
    [projects]
  );
  const submittedProjects = useMemo(
    () => projects.filter((p) => !isDraftStatus(p.status)),
    [projects]
  );

  const projectHealth = useMemo(() => {
    const total = projects.length;
    const draft = draftProjects.length;
    const submitted = submittedProjects.length;
    const percentSubmitted = total === 0 ? 0 : Math.round((submitted / total) * 100);
    return { total, submitted, draft, percentSubmitted };
  }, [projects.length, draftProjects.length, submittedProjects.length]);

  const metrics = useMemo((): DashboardMetric[] => {
    const loadingValue = "…";

    return [
      {
        id: "total-projects",
        label: "Total Projects",
        value: projectsLoading ? loadingValue : projects.length,
        hint: { text: "Click to view list", tone: "neutral" },
      },
      {
        id: "submitted-projects",
        label: "Submitted Projects",
        value: projectsLoading ? loadingValue : submittedProjects.length,
        hint: { text: "Click to view list", tone: "neutral" },
      },
      {
        id: "draft-projects",
        label: "Draft Projects",
        value: projectsLoading ? loadingValue : draftProjects.length,
        hint: {
          text: "Click to view list",
          tone: draftProjects.length > 0 ? "danger" : "neutral",
        },
      },
      {
        id: "total-applications",
        label: "Total Applications",
        value: projectsLoading || applicationsLoading ? loadingValue : applications.length,
        hint: { text: "Click to view list", tone: "neutral" },
      },
    ];
  }, [
    projects.length,
    projectsLoading,
    submittedProjects.length,
    draftProjects.length,
    applications.length,
    applicationsLoading,
  ]);

  const modalTitle = useMemo(() => {
    switch (activePanel) {
      case "total-projects":
        return "All Projects";
      case "submitted-projects":
        return "Submitted Projects";
      case "draft-projects":
        return "Draft Projects";
      case "total-applications":
        return "All Applications";
      case "edit-project":
        return "Edit Project";
      default:
        return "";
    }
  }, [activePanel]);

  const projectListForModal = useMemo(() => {
    if (activePanel === "total-projects" || activePanel === "edit-project") return projects;
    if (activePanel === "submitted-projects") return submittedProjects;
    if (activePanel === "draft-projects") return draftProjects;
    return [];
  }, [activePanel, projects, submittedProjects, draftProjects]);

  const showingApplications = activePanel === "total-applications";
  const isEditPicker = activePanel === "edit-project";

  const openEditProjectPicker = () => {
    setActivePanel("edit-project");
  };

  const closePanel = () => {
    setActivePanel(null);
  };

  return (
    <div className="mx-auto max-w-7xl space-y-5 px-4 py-6 sm:px-6 lg:px-8">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12 lg:gap-5">
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:col-span-9 lg:grid-cols-4">
          {metrics.map((metric) => (
            <MetricCard
              key={metric.id}
              label={metric.label}
              value={metric.value}
              hint={metric.hint}
              icon={METRIC_ICONS[metric.id as MetricId]}
              onClick={() => setActivePanel(metric.id as MetricId)}
            />
          ))}
        </div>
        <div className="lg:col-span-3">
          <AiAssistantCard insights={AI_INSIGHTS} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12 lg:gap-5">
        <div className="lg:col-span-3">
          <ProjectHealthCard health={projectHealth} />
        </div>
        <div className="lg:col-span-6">
          <UpcomingDeadlinesCard deadlines={UPCOMING_DEADLINES} />
        </div>
        <div className="lg:col-span-3">
          <QuickActionsCard
            actions={QUICK_ACTIONS}
            onActionClick={(actionId) => {
              if (actionId === "edit-project") openEditProjectPicker();
            }}
          />
        </div>
      </div>

      <Modal
        open={activePanel !== null}
        onClose={closePanel}
        title={modalTitle}
        maxWidth="xl"
      >
        {showingApplications ? (
          applicationsLoading ? (
            <p className="py-8 text-center text-sm text-gray-500">Loading applications…</p>
          ) : applications.length === 0 ? (
            <p className="py-8 text-center text-sm text-gray-500">No applications found.</p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {applications.map((app) => (
                <li key={app.id}>
                  <button
                    type="button"
                    onClick={() => {
                      closePanel();
                      router.push(applicationHref(app));
                    }}
                    className="flex w-full items-center gap-3 px-1 py-3 text-left transition-colors hover:bg-blue-50/60"
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
                    {app.workflowStage && (
                      <span className="shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-600">
                        {app.workflowStage}
                      </span>
                    )}
                    <ChevronRight className="h-4 w-4 shrink-0 text-gray-400" />
                  </button>
                </li>
              ))}
            </ul>
          )
        ) : projectsLoading ? (
          <p className="py-8 text-center text-sm text-gray-500">Loading projects…</p>
        ) : projectListForModal.length === 0 ? (
          <p className="py-8 text-center text-sm text-gray-500">
            {isEditPicker ? "No projects available to edit." : "No projects found."}
          </p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {isEditPicker && (
              <li className="pb-2 text-xs text-gray-500">
                Choose a project to open in the edit flow.
              </li>
            )}
            {projectListForModal.map((project) => {
              const draft = isDraftStatus(project.status);
              return (
                <li key={project.id}>
                  <button
                    type="button"
                    onClick={() => {
                      closePanel();
                      router.push(projectHref(project));
                    }}
                    className="flex w-full items-center gap-3 px-1 py-3 text-left transition-colors hover:bg-blue-50/60"
                  >
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-brand-blue">
                      <FolderKanban className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-brand-navy">
                        {project.title || "Untitled project"}
                      </p>
                      <p className="truncate text-xs text-gray-500">
                        {project.project_info?.proposalNo
                          ? `Proposal ${project.project_info.proposalNo}`
                          : project.id}
                      </p>
                    </div>
                    <span
                      className={[
                        "shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium",
                        draft
                          ? "bg-amber-50 text-amber-700"
                          : "bg-green-50 text-status-success",
                      ].join(" ")}
                    >
                      {draft ? "Draft" : "Submitted"}
                    </span>
                    <ChevronRight className="h-4 w-4 shrink-0 text-gray-400" />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </Modal>
    </div>
  );
}
