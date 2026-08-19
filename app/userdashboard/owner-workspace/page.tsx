"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CircleDashed, ClipboardCheck, Loader2 } from "lucide-react";
import CustomSelect from "@/app/components/CustomSelect";
import Modal from "@/app/components/ui/Modal";
import ConsultantProgressCard, {
  WorkspaceDetailRow,
} from "@/app/userdashboard/components/ConsultantProgressCard";
import { useDashboardProjects } from "@/app/hooks/useDashboardProjects";
import { supabase } from "@/app/utils/supabase";
import {
  filterConsultantsByProject,
  filterConsultantsByType,
  filterNonDraftProjects,
  getConsultantTypeOptions,
  getProjectLabel,
  loadOwnerWorkspaceConsultants,
  type AssignedConsultantCard,
} from "@/app/userdashboard/ownerWorkspaceConsultants";

export default function OwnerWorkspacePage() {
  const { projects, loading: projectsLoading, isConsultant } = useDashboardProjects();

  const [selectedProjectId, setSelectedProjectId] = useState("ALL");
  const [selectedConsultantType, setSelectedConsultantType] = useState("ALL");
  const [consultantsLoading, setConsultantsLoading] = useState(true);
  const [consultants, setConsultants] = useState<AssignedConsultantCard[]>([]);
  const [viewing, setViewing] = useState<AssignedConsultantCard | null>(null);

  const nonDraftProjects = useMemo(() => filterNonDraftProjects(projects), [projects]);

  const canViewWorkspace = !isConsultant;

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (projectsLoading) return;

      if (!canViewWorkspace || projects.length === 0) {
        if (!cancelled) {
          setConsultants([]);
          setConsultantsLoading(false);
        }
        return;
      }

      setConsultantsLoading(true);
      try {
        const { data: authData } = await supabase.auth.getUser();
        const userId = authData.user?.id;
        if (!userId) {
          if (!cancelled) setConsultants([]);
          return;
        }

        const cards = await loadOwnerWorkspaceConsultants({
          projects,
          userId,
          isConsultant: false,
        });
        if (!cancelled) setConsultants(cards);
      } catch (err) {
        console.error("Failed to load owner workspace consultants:", err);
        if (!cancelled) setConsultants([]);
      } finally {
        if (!cancelled) setConsultantsLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [projectsLoading, canViewWorkspace, projects]);

  const projectFiltered = useMemo(
    () => filterConsultantsByProject(consultants, selectedProjectId),
    [consultants, selectedProjectId]
  );

  const consultantTypeOptions = useMemo(
    () => getConsultantTypeOptions(projectFiltered),
    [projectFiltered]
  );

  useEffect(() => {
    if (selectedConsultantType === "ALL") return;
    const stillAvailable = consultantTypeOptions.some(
      (option) => option.value === selectedConsultantType
    );
    if (!stillAvailable) setSelectedConsultantType("ALL");
  }, [consultantTypeOptions, selectedConsultantType]);

  const filtered = useMemo(
    () => filterConsultantsByType(projectFiltered, selectedConsultantType),
    [projectFiltered, selectedConsultantType]
  );

  const loading = projectsLoading || consultantsLoading;

  return (
    <div className="mx-auto flex min-h-0 w-full max-w-7xl flex-1 flex-col gap-4 overflow-hidden px-4 py-4 md:px-6 md:py-6">
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="flex shrink-0 flex-col gap-4 border-b border-gray-100 px-5 py-4 sm:flex-row sm:items-end sm:justify-between md:px-6">
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-brand-navy md:text-2xl">
              Owner Workspace
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              Assigned consultants and their work progress
            </p>
          </div>
          <div className="flex w-full flex-col gap-3 sm:max-w-xl sm:flex-row">
            <div className="w-full sm:flex-1">
              <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-gray-500">
                Project
              </label>
              <CustomSelect
                value={selectedProjectId}
                onChange={setSelectedProjectId}
                options={[
                  { value: "ALL", label: "All projects" },
                  ...nonDraftProjects.map((p) => ({
                    value: p.id,
                    label: getProjectLabel(p),
                  })),
                ]}
                placeholder={projectsLoading ? "Loading projects…" : "All projects"}
                disabled={projectsLoading || nonDraftProjects.length === 0}
              />
            </div>
            <div className="w-full sm:flex-1">
              <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-gray-500">
                Consultant
              </label>
              <CustomSelect
                value={selectedConsultantType}
                onChange={setSelectedConsultantType}
                options={consultantTypeOptions}
                placeholder={loading ? "Loading…" : "All consultants"}
                disabled={loading || consultantTypeOptions.length <= 1}
              />
            </div>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-auto p-5 md:p-6">
          {!canViewWorkspace && !projectsLoading ? (
            <div className="flex flex-col items-center gap-3 py-16 text-center">
              <ClipboardCheck className="h-8 w-8 text-gray-300" />
              <p className="max-w-md text-sm text-gray-500">
                Owner Workspace is available to project owners only.
              </p>
              <Link
                href="/userdashboard/consultant-workspace"
                className="text-sm font-semibold text-brand-blue hover:text-brand-blue-hover"
              >
                Go to Consultant Workspace →
              </Link>
            </div>
          ) : loading ? (
            <div className="flex items-center justify-center gap-2 py-16 text-sm text-gray-500">
              <Loader2 className="h-4 w-4 animate-spin text-brand-blue" />
              Loading consultants…
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-16 text-center">
              <CircleDashed className="h-8 w-8 text-gray-300" />
              <p className="text-sm text-gray-500">
                {consultants.length === 0
                  ? "No consultants assigned to your projects yet."
                  : "No consultants match the selected filters."}
              </p>
              {consultants.length === 0 && projects.length > 0 ? (
                <Link
                  href={`/dashboard/applicant?projectId=${encodeURIComponent(projects[0].id)}`}
                  className="text-sm font-semibold text-brand-blue hover:text-brand-blue-hover"
                >
                  Assign consultants →
                </Link>
              ) : null}
            </div>
          ) : (
            <div className="flex flex-wrap gap-4">
              {filtered.map((card) => (
                <ConsultantProgressCard
                  key={card.id}
                  card={card}
                  onViewDetails={setViewing}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      <Modal
        open={Boolean(viewing)}
        onClose={() => setViewing(null)}
        title={viewing?.consultantType || "Consultant"}
        maxWidth="md"
      >
        {viewing && (
          <div className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <WorkspaceDetailRow label="Name" value={viewing.name} />
              <WorkspaceDetailRow label="Project" value={viewing.projectLabel} />
              <WorkspaceDetailRow label="Licence" value={viewing.credentials.licence} />
              <WorkspaceDetailRow
                label="Status"
                value={viewing.isActive ? "Active" : "Pending link"}
              />
            </div>

            <div className="grid grid-cols-3 gap-3 rounded-xl border border-gray-100 bg-surface p-4 text-center">
              <div>
                <p className="text-xl font-bold text-brand-blue">{viewing.stats.pending}</p>
                <p className="text-xs font-medium text-gray-500">Pending</p>
              </div>
              <div>
                <p className="text-xl font-bold text-brand-navy">{viewing.stats.completed}</p>
                <p className="text-xs font-medium text-gray-500">Completed</p>
              </div>
              <div>
                <p className="text-xl font-bold text-brand-blue">{viewing.stats.openRemarks}</p>
                <p className="text-xs font-medium text-gray-500">Open Remarks</p>
              </div>
            </div>

            <Link
              href={viewing.detailsHref}
              className="inline-flex w-full items-center justify-center rounded-lg bg-brand-blue px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-blue-hover"
            >
              Open applicant details
            </Link>
          </div>
        )}
      </Modal>
    </div>
  );
}
