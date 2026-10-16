"use client";

import { useEffect, useMemo } from "react";
import { Building2, FolderKanban } from "lucide-react";
import CustomSelect from "@/app/components/CustomSelect";
import { useDashboardProjects } from "@/app/hooks/useDashboardProjects";
import { normalizePlanningAuthority } from "@/app/lib/projectDocumentAutofill/utils";
import { useMasterProjectFilter } from "./MasterProjectFilterContext";

const AUTHORITIES = ["BMC", "SRA", "MHADA", "MMRDA", "CIDCO", "MIDC"] as const;

export default function MasterProjectFilterBar() {
  const { projects, loading: projectsLoading } = useDashboardProjects();
  const { masterProjectId, setMasterProjectId, masterAuthority, setMasterAuthority } =
    useMasterProjectFilter();

  const visibleProjects = useMemo(() => {
    if (!masterAuthority) return projects;
    return projects.filter(
      (project) =>
        normalizePlanningAuthority(project.save_plot_details?.planningAuthority) ===
        masterAuthority
    );
  }, [masterAuthority, projects]);

  useEffect(() => {
    if (!masterProjectId || projectsLoading) return;
    const stillVisible = visibleProjects.some((project) => project.id === masterProjectId);
    if (!stillVisible) setMasterProjectId("");
  }, [masterProjectId, projectsLoading, setMasterProjectId, visibleProjects]);

  const triggerClassName =
    "!h-9 !rounded-none !border-0 !bg-transparent !px-0 !shadow-none hover:!border-0 focus:!border-0 focus:!bg-transparent focus:!ring-0";

  return (
    <div className="sticky top-0 z-20 shrink-0 border-b border-gray-200 bg-white/90 px-4 py-2.5 backdrop-blur-sm sm:px-6">
      <div className="flex w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm sm:flex-row">
        <label className="flex min-w-0 flex-1 items-center gap-3 px-3 py-2 sm:max-w-xs sm:border-r sm:border-gray-100">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-brand-blue">
            <Building2 className="h-4 w-4" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[10px] font-semibold uppercase tracking-wider text-gray-400">
              Authority
            </span>
            <CustomSelect
              aria-label="Authority"
              value={masterAuthority}
              onChange={setMasterAuthority}
              options={[
                { value: "", label: "All authorities" },
                ...AUTHORITIES.map((authority) => ({ value: authority, label: authority })),
              ]}
              placeholder="All authorities"
              triggerClassName={triggerClassName}
            />
          </span>
        </label>
        <label className="flex min-w-0 flex-[1.6] items-center gap-3 border-t border-gray-100 px-3 py-2 sm:border-t-0">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-brand-blue">
            <FolderKanban className="h-4 w-4" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[10px] font-semibold uppercase tracking-wider text-gray-400">
              Project
            </span>
            <CustomSelect
              aria-label="Project"
              searchable
              value={masterProjectId}
              onChange={setMasterProjectId}
              options={[
                { value: "", label: "All projects" },
                ...visibleProjects.map((project) => ({
                  value: project.id,
                  label: project.title,
                })),
              ]}
              placeholder={projectsLoading ? "Loading projects…" : "All projects"}
              disabled={projectsLoading}
              triggerClassName={triggerClassName}
            />
          </span>
        </label>
      </div>
    </div>
  );
}
