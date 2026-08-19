"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Briefcase, CircleDashed, Loader2 } from "lucide-react";
import CustomSelect from "@/app/components/CustomSelect";
import Modal from "@/app/components/ui/Modal";
import ConsultantProgressCard, {
  WorkspaceDetailRow,
} from "@/app/userdashboard/components/ConsultantProgressCard";
import { useDashboardProjects } from "@/app/hooks/useDashboardProjects";
import { supabase } from "@/app/utils/supabase";
import {
  filterConsultantsByProject,
  filterNonDraftProjects,
  getProjectLabel,
  loadConsultantWorkspaceCards,
  type AssignedConsultantCard,
} from "@/app/userdashboard/ownerWorkspaceConsultants";

export default function ConsultantWorkspacePage() {
  const { projects, loading: projectsLoading, isConsultant, consultantType } =
    useDashboardProjects();

  const [selectedProjectId, setSelectedProjectId] = useState("ALL");
  const [cardsLoading, setCardsLoading] = useState(true);
  const [cards, setCards] = useState<AssignedConsultantCard[]>([]);
  const [viewing, setViewing] = useState<AssignedConsultantCard | null>(null);

  const nonDraftProjects = useMemo(() => filterNonDraftProjects(projects), [projects]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (projectsLoading) return;

      if (!isConsultant) {
        if (!cancelled) {
          setCards([]);
          setCardsLoading(false);
        }
        return;
      }

      setCardsLoading(true);
      try {
        const { data: authData } = await supabase.auth.getUser();
        const userId = authData.user?.id;
        if (!userId) {
          if (!cancelled) setCards([]);
          return;
        }

        const loaded = await loadConsultantWorkspaceCards({
          projects,
          userId,
          consultantType,
        });
        if (!cancelled) setCards(loaded);
      } catch (err) {
        console.error("Failed to load consultant workspace cards:", err);
        if (!cancelled) setCards([]);
      } finally {
        if (!cancelled) setCardsLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [projectsLoading, isConsultant, projects, consultantType]);

  const filtered = useMemo(
    () => filterConsultantsByProject(cards, selectedProjectId),
    [cards, selectedProjectId]
  );

  const loading = projectsLoading || cardsLoading;

  return (
    <div className="mx-auto flex min-h-0 w-full max-w-7xl flex-1 flex-col gap-4 overflow-hidden px-4 py-4 md:px-6 md:py-6">
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="flex shrink-0 flex-col gap-4 border-b border-gray-100 px-5 py-4 sm:flex-row sm:items-end sm:justify-between md:px-6">
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-brand-navy md:text-2xl">
              Consultant Workspace
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              Your assigned projects and work progress
            </p>
          </div>
          <div className="w-full sm:max-w-xs">
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
        </div>

        <div className="min-h-0 flex-1 overflow-auto p-5 md:p-6">
          {!isConsultant && !projectsLoading ? (
            <div className="flex flex-col items-center gap-3 py-16 text-center">
              <Briefcase className="h-8 w-8 text-gray-300" />
              <p className="max-w-md text-sm text-gray-500">
                Consultant Workspace is available to consultants only.
              </p>
              <Link
                href="/userdashboard/owner-workspace"
                className="text-sm font-semibold text-brand-blue hover:text-brand-blue-hover"
              >
                Go to Owner Workspace →
              </Link>
            </div>
          ) : loading ? (
            <div className="flex items-center justify-center gap-2 py-16 text-sm text-gray-500">
              <Loader2 className="h-4 w-4 animate-spin text-brand-blue" />
              Loading your assignments…
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-16 text-center">
              <CircleDashed className="h-8 w-8 text-gray-300" />
              <p className="text-sm text-gray-500">
                {cards.length === 0
                  ? "You are not assigned to any active projects yet."
                  : "No assignments match the selected project."}
              </p>
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
        title={viewing?.projectLabel || "Assignment"}
        maxWidth="md"
      >
        {viewing && (
          <div className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <WorkspaceDetailRow label="Role" value={viewing.consultantType} />
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
              Continue work
            </Link>
          </div>
        )}
      </Modal>
    </div>
  );
}
