"use client";

import { useEffect, useMemo, useState } from "react";
import { CircleDashed, Loader2, Users } from "lucide-react";
import CustomSelect from "@/app/components/CustomSelect";
import Modal from "@/app/components/ui/Modal";
import {
  useDashboardProjects,
  type DashboardProject,
} from "@/app/hooks/useDashboardProjects";
import { BTN_SECONDARY } from "@/app/utils/buttonClasses";
import { normalizeProjectId } from "@/app/utils/applicantAppointmentPermissions";
import { fetchApplicantDetailsMapForProjects } from "@/app/utils/resolveApplicantDetailsForProject";
import { supabase } from "@/app/utils/supabase";
import {
  countApplicantsByRole,
  classifyApplicantRole,
  filterApplicantsByRole,
  flattenApplicantRosters,
  getProjectLabel,
  type AdministrationApplicantRow,
  type AdministrationRoleTab,
} from "@/app/userdashboard/administrationApplicants";

const TABS: { id: AdministrationRoleTab; label: string }[] = [
  { id: "all", label: "All" },
  { id: "owners", label: "Owners" },
  { id: "architects", label: "Architects" },
  { id: "consultants", label: "Consultants" },
];

const ROLE_BADGE_CLASSES: Record<
  Exclude<AdministrationRoleTab, "all">,
  string
> = {
  owners: "bg-sky-50 text-sky-800 ring-sky-200",
  architects: "bg-indigo-50 text-indigo-800 ring-indigo-200",
  consultants: "bg-gray-50 text-gray-700 ring-gray-200",
};

function administrationProjects(
  projects: DashboardProject[],
  isConsultant: boolean,
  architectDelegateProjectIds: Set<string>
): DashboardProject[] {
  if (!isConsultant) return projects;
  return projects.filter((p) =>
    architectDelegateProjectIds.has(normalizeProjectId(p.id))
  );
}

function contactLine(row: AdministrationApplicantRow): string {
  if (row.email && row.phone) return `${row.email} · ${row.phone}`;
  return row.email || row.phone || "—";
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">
        {label}
      </p>
      <p className="mt-0.5 text-sm text-gray-900">{value || "—"}</p>
    </div>
  );
}

export default function AdministrationPage() {
  const {
    projects,
    loading: projectsLoading,
    isConsultant,
    hasArchitectDelegateAccess,
    architectDelegateProjectIds,
  } = useDashboardProjects();

  const [selectedProjectId, setSelectedProjectId] = useState("ALL");
  const [roleTab, setRoleTab] = useState<AdministrationRoleTab>("all");
  const [rows, setRows] = useState<AdministrationApplicantRow[]>([]);
  const [rostersLoading, setRostersLoading] = useState(true);
  const [viewing, setViewing] = useState<AdministrationApplicantRow | null>(
    null
  );

  const canViewAdministration = !isConsultant || hasArchitectDelegateAccess;

  const allowedProjects = useMemo(
    () =>
      administrationProjects(
        projects,
        isConsultant,
        architectDelegateProjectIds
      ),
    [projects, isConsultant, architectDelegateProjectIds]
  );

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (projectsLoading) return;

      if (!canViewAdministration || allowedProjects.length === 0) {
        if (!cancelled) {
          setRows([]);
          setRostersLoading(false);
        }
        return;
      }

      setRostersLoading(true);
      try {
        const rosters = await fetchApplicantDetailsMapForProjects(
          supabase,
          allowedProjects.map((p) => p.id)
        );
        if (cancelled) return;
        setRows(flattenApplicantRosters({ projects: allowedProjects, rosters }));
      } catch (err) {
        console.error("Failed to load administration applicants:", err);
        if (!cancelled) setRows([]);
      } finally {
        if (!cancelled) setRostersLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [projectsLoading, canViewAdministration, allowedProjects]);

  const projectFilteredRows = useMemo(() => {
    if (selectedProjectId === "ALL") return rows;
    return rows.filter((row) => row.projectId === selectedProjectId);
  }, [rows, selectedProjectId]);

  const counts = useMemo(
    () => countApplicantsByRole(projectFilteredRows),
    [projectFilteredRows]
  );

  const filtered = useMemo(
    () => filterApplicantsByRole(projectFilteredRows, roleTab),
    [projectFilteredRows, roleTab]
  );

  const loading = projectsLoading || rostersLoading;

  return (
    <div className="mx-auto flex min-h-0 w-full max-w-7xl flex-1 flex-col gap-4 overflow-hidden px-4 py-4 md:px-6 md:py-6">
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="flex shrink-0 flex-col gap-4 border-b border-gray-100 px-5 py-4 sm:flex-row sm:items-end sm:justify-between md:px-6">
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-brand-navy md:text-2xl">
              Administration
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              Applicants on your projects
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
                ...allowedProjects.map((p) => ({
                  value: p.id,
                  label: getProjectLabel(p),
                })),
              ]}
              placeholder={projectsLoading ? "Loading projects…" : "All projects"}
              disabled={projectsLoading || allowedProjects.length === 0}
            />
          </div>
        </div>

        <div className="flex shrink-0 gap-1 overflow-x-auto border-b border-gray-100 px-5 md:px-6">
          {TABS.map((tab) => {
            const active = roleTab === tab.id;
            const count = counts[tab.id];
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setRoleTab(tab.id)}
                className={[
                  "relative shrink-0 px-3 py-3 text-sm font-semibold transition-colors",
                  active
                    ? "text-brand-blue"
                    : "text-gray-500 hover:text-brand-navy",
                ].join(" ")}
              >
                <span className="inline-flex items-center gap-2">
                  {tab.label}
                  <span
                    className={[
                      "inline-flex min-w-[1.25rem] items-center justify-center rounded-full px-1.5 py-0.5 text-[11px] font-semibold",
                      active
                        ? "bg-brand-blue/10 text-brand-blue"
                        : "bg-gray-100 text-gray-600",
                    ].join(" ")}
                  >
                    {loading ? "…" : count}
                  </span>
                </span>
                {active && (
                  <span className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-brand-blue" />
                )}
              </button>
            );
          })}
        </div>

        <div className="min-h-0 flex-1 overflow-auto">
          {!canViewAdministration && !projectsLoading ? (
            <div className="flex flex-col items-center gap-3 px-5 py-16 text-center">
              <Users className="h-8 w-8 text-gray-300" />
              <p className="max-w-md text-sm text-gray-500">
                Only the project owner or appointed architect can view
                Administration.
              </p>
            </div>
          ) : loading ? (
            <div className="flex items-center justify-center gap-2 px-5 py-16 text-sm text-gray-500">
              <Loader2 className="h-4 w-4 animate-spin text-brand-blue" />
              Loading applicants…
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center gap-3 px-5 py-16 text-center">
              <CircleDashed className="h-8 w-8 text-gray-300" />
              <p className="text-sm text-gray-500">
                {rows.length === 0
                  ? "No applicants on your projects yet."
                  : "No applicants in this view."}
              </p>
            </div>
          ) : (
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="sticky top-0 z-10 bg-white">
                <tr className="border-b border-gray-100 text-xs font-semibold uppercase tracking-wide text-gray-400">
                  <th className="px-5 py-3 font-semibold md:px-6">Applicant</th>
                  <th className="px-3 py-3 font-semibold">Role</th>
                  <th className="px-3 py-3 font-semibold">Project</th>
                  <th className="px-3 py-3 font-semibold">Contact</th>
                  <th className="px-5 py-3 text-right font-semibold md:px-6">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((row) => {
                  const roleGroup = classifyApplicantRole(row.role);
                  return (
                    <tr
                      key={row.id}
                      className="border-b border-gray-50 last:border-b-0 hover:bg-blue-50/40"
                    >
                      <td className="px-5 py-3.5 md:px-6">
                        <p className="font-semibold text-brand-navy">{row.name}</p>
                      </td>
                      <td className="px-3 py-3.5">
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${ROLE_BADGE_CLASSES[roleGroup]}`}
                        >
                          {row.role}
                        </span>
                      </td>
                      <td className="max-w-[220px] truncate px-3 py-3.5 text-gray-600">
                        {row.projectLabel}
                      </td>
                      <td className="max-w-[240px] truncate px-3 py-3.5 text-gray-600">
                        {contactLine(row)}
                      </td>
                      <td className="px-5 py-3.5 text-right md:px-6">
                        <button
                          type="button"
                          onClick={() => setViewing(row)}
                          className={`inline-flex items-center justify-center rounded-lg px-3 py-1.5 text-sm font-semibold ${BTN_SECONDARY}`}
                        >
                          View
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <Modal
        open={Boolean(viewing)}
        onClose={() => setViewing(null)}
        title={viewing?.name || "Applicant"}
        maxWidth="md"
      >
        {viewing && (
          <div className="grid gap-4 sm:grid-cols-2">
            <DetailRow label="Role" value={viewing.role} />
            <DetailRow label="Project" value={viewing.projectLabel} />
            <DetailRow label="Email" value={viewing.email} />
            <DetailRow label="Phone" value={viewing.phone} />
            <DetailRow label="Registration no." value={viewing.registrationNo} />
            {viewing.panNo ? (
              <DetailRow label="PAN" value={viewing.panNo} />
            ) : null}
          </div>
        )}
      </Modal>
    </div>
  );
}
