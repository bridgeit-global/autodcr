"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import AppShell from "@/app/components/appshell/AppShell";
import CustomSelect from "@/app/components/CustomSelect";
import { supabase } from "@/app/utils/supabase";
import {
  appointmentTypeIdsMatchingRoster,
  departmentsFromCatalog,
  fetchApplicationCatalogTypes,
  typesForDepartment,
  type ApplicationCatalogType,
} from "@/app/utils/applicationCatalog";
import {
  createApplicationForOwner,
  fetchExistingPermissionTypesForProject,
  getAuthUserId,
} from "@/app/utils/ownerApplicationRpc";
import {
  fetchManageableProjectsForSelect,
  fetchOwnerProjectsForSelect,
  getProjectPlanningAuthority,
  isProjectEligibleForNewApplication,
  type OwnerProjectSelectRow,
} from "@/app/utils/ownerProjects";
import {
  canCreateApplicationsRole,
  canCreateProjectAsArchitect,
} from "@/app/utils/projectAccess";
import { getProjectBaseTitle } from "@/app/utils/projectTitleProposal";
import { BTN_PRIMARY, BTN_SECONDARY } from "@/app/utils/buttonClasses";
import { useDashboardAlertModal } from "@/app/dashboard/context/DashboardAlertModalContext";

type PlanningAuthority = {
  id: string;
  label: string;
  description?: string;
};

type PermissionType = {
  id: string;
  title: string;
  description: string;
};

const planningAuthorities: PlanningAuthority[] = [
  { id: "bmc", label: "BMC" },
  { id: "sra", label: "SRA" },
  { id: "mhada", label: "MHADA" },
  { id: "mmrda", label: "MMRDA" },
  { id: "cidco", label: "CIDCO" },
  { id: "midc", label: "MIDC" },
];

const iconClass = "h-8 w-8 text-gray-500";

const DocumentIcon = () => (
  <svg viewBox="0 0 24 24" className={iconClass} aria-hidden="true">
    <path d="M7 3h7l4 4v14a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z" stroke="currentColor" strokeWidth={1.5} fill="none" />
    <path d="M14 3v4h4" stroke="currentColor" strokeWidth={1.5} fill="none" />
    <path d="M9 12h6M9 16h6" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" />
  </svg>
);

export default function CreateApplicationPage() {
  const router = useRouter();
  const { showAlert } = useDashboardAlertModal();
  const [selectedAuthority, setSelectedAuthority] = useState("bmc");
  const [selectedProject, setSelectedProject] = useState("");
  const [projects, setProjects] = useState<OwnerProjectSelectRow[]>([]);
  const [projectsLoading, setProjectsLoading] = useState(true);
  const [selectedDepartment, setSelectedDepartment] = useState("");
  const [selectedPermission, setSelectedPermission] = useState<string | null>(null);
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [modalMessage, setModalMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [existingPermissionTypes, setExistingPermissionTypes] = useState<string[]>([]);
  const [redirectOnModalOk, setRedirectOnModalOk] = useState(false);
  const [catalogTypes, setCatalogTypes] = useState<ApplicationCatalogType[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const rows = await fetchApplicationCatalogTypes();
      if (!cancelled) setCatalogTypes(rows);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setProjectsLoading(true);
      const { data: authData } = await supabase.auth.getUser();
      const meta = authData.user?.user_metadata as {
        role?: string;
        consultant_type?: string;
      };
      let role = meta?.role ?? "";
      let consultantType = meta?.consultant_type ?? "";
      if (typeof window !== "undefined") {
        try {
          const stored = localStorage.getItem("userMetadata");
          if (stored) {
            const parsed = JSON.parse(stored) as { role?: string; consultant_type?: string };
            if (!role) role = parsed.role ?? "";
            if (!consultantType) consultantType = parsed.consultant_type ?? "";
          }
          if (!consultantType) {
            consultantType = localStorage.getItem("consultantType") ?? "";
          }
        } catch {
          /* ignore */
        }
      }
      if (!canCreateApplicationsRole({ role, consultant_type: consultantType })) {
        if (!cancelled) {
          setProjectsLoading(false);
          showAlert({
            title: "Cannot create application",
            message:
              "Only owners, developers, architects, and licensed surveyors can create applications.",
          });
          router.replace("/userdashboard/applications");
        }
        return;
      }
      const rows = canCreateProjectAsArchitect({ role, consultant_type: consultantType })
        ? await fetchManageableProjectsForSelect()
        : await fetchOwnerProjectsForSelect();
      if (!cancelled) {
        setProjects(rows);
        setProjectsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router, showAlert]);

  useEffect(() => {
    if (!selectedProject) return;

    let cancelled = false;
    (async () => {
      const { data: rpcData, error: rpcError } = await supabase.rpc("get_project_for_preview", {
        p_project_id: selectedProject,
      });

      if (cancelled) return;

      let applicantDetails: unknown;
      let projectInfo: OwnerProjectSelectRow["project_info"];
      let savePlot: OwnerProjectSelectRow["save_plot_details"];
      let buildingDetails: OwnerProjectSelectRow["building_details"];

      if (!rpcError && rpcData && typeof rpcData === "object" && !Array.isArray(rpcData)) {
        const row = rpcData as {
          applicant_details?: unknown;
          project_info?: OwnerProjectSelectRow["project_info"];
          save_plot_details?: OwnerProjectSelectRow["save_plot_details"];
        };
        applicantDetails = row.applicant_details;
        projectInfo = row.project_info;
        savePlot = row.save_plot_details;
      } else {
        const { data: rosterData, error: rosterError } = await supabase.rpc(
          "get_applicant_details_for_project",
          { p_project_id: selectedProject }
        );
        if (cancelled || rosterError) return;
        applicantDetails = rosterData;
      }

      const { data: bdRow } = await supabase
        .from("projects")
        .select("building_details")
        .eq("id", selectedProject)
        .maybeSingle();
      if (cancelled) return;
      if (bdRow?.building_details && typeof bdRow.building_details === "object") {
        buildingDetails = bdRow.building_details as OwnerProjectSelectRow["building_details"];
      }

      setProjects((prev) =>
        prev.map((p) =>
          p.id === selectedProject
            ? {
                ...p,
                ...(applicantDetails !== undefined ? { applicant_details: applicantDetails } : {}),
                ...(projectInfo ? { project_info: projectInfo } : {}),
                ...(savePlot ? { save_plot_details: savePlot } : {}),
                ...(buildingDetails ? { building_details: buildingDetails } : {}),
              }
            : p
        )
      );
    })();

    return () => {
      cancelled = true;
    };
  }, [selectedProject]);

  const authorityLabelMap: Record<string, string> = {
    bmc: "BMC",
    sra: "SRA",
    mhada: "MHADA",
    mmrda: "MMRDA",
    cidco: "CIDCO",
    midc: "MIDC",
  };
  const selectedAuthorityLabel = authorityLabelMap[selectedAuthority];

  const getProjectDisplayData = (project: {
    title: string;
    project_info?: { proposalNo?: string; title?: string } | null;
  }) => {
    const detectedProposalNo = project.title.match(/\s(\d{3,})$/)?.[1];
    const proposalNo =
      project.project_info?.proposalNo?.trim() || detectedProposalNo || "";
    const cleanTitle = getProjectBaseTitle(
      project.title,
      proposalNo,
      project.project_info?.title
    );
    const highlightedPart = proposalNo ? `(${proposalNo})` : undefined;
    return {
      label: proposalNo ? `${cleanTitle} ${highlightedPart}` : cleanTitle,
      highlightedPart,
      proposalNo,
      cleanTitle,
    };
  };

  const filteredProjects = projects.filter(
    (project) =>
      isProjectEligibleForNewApplication(project.status) &&
      getProjectPlanningAuthority(project) === selectedAuthorityLabel
  );

  useEffect(() => {
    if (selectedProject && !filteredProjects.some((project) => project.id === selectedProject)) {
      setSelectedProject("");
    }
  }, [filteredProjects, selectedProject]);

  const catalogTypesForDepartment = useMemo(
    () => typesForDepartment(catalogTypes, selectedDepartment, selectedAuthority),
    [catalogTypes, selectedDepartment, selectedAuthority]
  );
  const departmentOptions = departmentsFromCatalog(catalogTypes, selectedAuthority);

  const permissionTypes = useMemo(
    () =>
      catalogTypesForDepartment.map((type) => ({
        id: type.id,
        title: type.application_title,
        description: type.description,
      })),
    [catalogTypesForDepartment]
  );

  const selectedProjectData = filteredProjects.find((project) => project.id === selectedProject);

  const visiblePermissionTypes = useMemo(() => {
    const needsRoster = catalogTypesForDepartment.some((type) => type.requires_roster_match);
    if (!needsRoster || !selectedProject || !selectedProjectData) {
      return permissionTypes;
    }
    const allowed = appointmentTypeIdsMatchingRoster(
      catalogTypesForDepartment,
      selectedProjectData.applicant_details
    );
    return permissionTypes.filter((p) => {
      const catalog = catalogTypesForDepartment.find((type) => type.id === p.id);
      if (!catalog?.requires_roster_match) return true;
      return allowed.has(p.id);
    });
  }, [catalogTypesForDepartment, selectedProject, selectedProjectData, permissionTypes]);

  const selectedPermissionRecord = visiblePermissionTypes.find((p) => p.id === selectedPermission);

  const handleProceed = async () => {
    if (!selectedProject || !selectedPermission) return;

    const selectedProjectRecord = filteredProjects.find((project) => project.id === selectedProject);
    const selectedPermissionRec = visiblePermissionTypes.find(
      (permission) => permission.id === selectedPermission
    );

    if (!selectedProjectRecord || !selectedPermissionRec) {
      showAlert({
        title: "Selection required",
        message: "Please select a valid project and permission type.",
      });
      return;
    }

    if (!isProjectEligibleForNewApplication(selectedProjectRecord.status)) {
      showAlert({
        title: "Project still in draft",
        message:
          "Applications can only be created for submitted projects. Submit the project first, then try again.",
      });
      return;
    }

    setIsSubmitting(true);
    const ownerId = await getAuthUserId();
    if (!ownerId) {
      setIsSubmitting(false);
      showAlert({
        title: "Sign in required",
        message: "You must be signed in to create an application.",
      });
      return;
    }

    const result = await createApplicationForOwner(ownerId, {
      projectId: selectedProjectRecord.id,
      projectTitle: selectedProjectRecord.title,
      department: selectedDepartment,
      permissionType: selectedPermissionRec.title,
      workflowStage: "draft",
    });
    setIsSubmitting(false);

    if ("error" in result) {
      if (result.code === "23505") {
        setModalMessage(
          result.error ||
            "This permission type is already added for the selected project. Please choose a different permission type."
        );
        setRedirectOnModalOk(false);
        setShowInfoModal(true);
        setExistingPermissionTypes((prev) =>
          prev.includes(selectedPermissionRec.title)
            ? prev
            : [...prev, selectedPermissionRec.title]
        );
        return;
      }

      showAlert({
        title: "Could not create application",
        message: result.error || "Failed to create application. Please try again.",
      });
      return;
    }

    if ("applicationId" in result) {
      supabase.auth.getSession().then(({ data: { session: notifSession } }) => {
        const notifToken = notifSession?.access_token;
        if (notifToken) {
          fetch(`/api/applications/${result.applicationId}/notify`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${notifToken}`,
            },
            body: JSON.stringify({ stage: "draft" }),
          }).catch((err) =>
            console.error("Application notification request failed:", err)
          );
        }
      });
    }

    setExistingPermissionTypes((prev) =>
      prev.includes(selectedPermissionRec.title)
        ? prev
        : [...prev, selectedPermissionRec.title]
    );
    setSelectedPermission(null);
    setModalMessage("Application created successfully.");
    setRedirectOnModalOk(true);
    setShowInfoModal(true);
  };

  const handleModalOk = () => {
    setShowInfoModal(false);
    if (redirectOnModalOk) {
      router.push("/userdashboard/applications?stage=draft");
    }
  };

  useEffect(() => {
    setSelectedPermission(null);
  }, [selectedAuthority, selectedDepartment]);

  useEffect(() => {
    if (
      selectedDepartment &&
      departmentOptions.length > 0 &&
      !departmentOptions.includes(selectedDepartment)
    ) {
      setSelectedDepartment("");
    }
  }, [selectedAuthority, selectedDepartment, departmentOptions]);

  useEffect(() => {
    if (!selectedProject) {
      setSelectedDepartment("");
    }
  }, [selectedProject]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!selectedProject) {
        setExistingPermissionTypes([]);
        return;
      }

      const ownerId = await getAuthUserId();
      if (!ownerId) {
        setExistingPermissionTypes([]);
        return;
      }

      const titles = await fetchExistingPermissionTypesForProject(
        selectedProject,
        selectedDepartment,
        ownerId
      );
      if (!cancelled) {
        setExistingPermissionTypes(titles);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [selectedProject, selectedDepartment]);

  useEffect(() => {
    if (!selectedPermission) return;
    const selectedPermissionTitle = visiblePermissionTypes.find(
      (permission) => permission.id === selectedPermission
    )?.title;
    if (selectedPermissionTitle && existingPermissionTypes.includes(selectedPermissionTitle)) {
      setSelectedPermission(null);
    }
  }, [existingPermissionTypes, visiblePermissionTypes, selectedPermission]);

  useEffect(() => {
    if (!selectedPermission) return;
    const stillVisible = visiblePermissionTypes.some((p) => p.id === selectedPermission);
    if (!stillVisible) setSelectedPermission(null);
  }, [visiblePermissionTypes, selectedPermission]);

  const canSubmit =
    Boolean(selectedProject && selectedPermission) &&
    !isSubmitting &&
    !(
      selectedPermission &&
      existingPermissionTypes.includes(selectedPermissionRecord?.title ?? "")
    );

  const projectSelectOptions = filteredProjects.map((project) => ({
    value: project.id,
    label: getProjectDisplayData(project).label,
  }));

  const relatedRows = [
    { label: "Authority", value: selectedAuthorityLabel },
    { label: "Department", value: selectedDepartment || "—" },
    {
      label: "Application",
      value: selectedPermissionRecord?.title || "—",
    },
    {
      label: "Project",
      value: selectedProjectData
        ? getProjectDisplayData(selectedProjectData).cleanTitle || selectedProjectData.title
        : "—",
    },
    {
      label: "Proposal No",
      value:
        selectedProjectData?.project_info?.proposalNo?.trim() ||
        (selectedProjectData ? getProjectDisplayData(selectedProjectData).proposalNo : "") ||
        "—",
    },
    {
      label: "Major Use",
      value: selectedProjectData?.save_plot_details?.majorUseOfPlot?.trim() || "—",
    },
  ];

  return (
    <AppShell title="Create Application">
      <div className="flex min-h-0 w-full flex-1 flex-col px-2 py-3 sm:px-3">
        <div className="flex min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden rounded-2xl bg-white shadow-sm">
          <div className="border-b border-gray-100 px-2 py-3">
            <div className="grid min-w-0 gap-3 md:grid-cols-3">
              <div className="min-w-0">
                <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-gray-500">
                  Authority
                </label>
                <CustomSelect
                  value={selectedAuthority}
                  onChange={setSelectedAuthority}
                  options={planningAuthorities.map((a) => ({
                    value: a.id,
                    label: a.label,
                  }))}
                  placeholder="Select authority"
                />
              </div>
              <div className="min-w-0">
                <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-gray-500">
                  Project
                </label>
                <CustomSelect
                  value={selectedProject}
                  onChange={(val) => setSelectedProject(val)}
                  options={projectSelectOptions}
                  placeholder={
                    projectsLoading
                      ? "Loading projects…"
                      : filteredProjects.length === 0
                        ? "No submitted projects"
                        : "Select project"
                  }
                  disabled={projectsLoading || filteredProjects.length === 0}
                />
              </div>
              <div className="min-w-0">
                <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-gray-500">
                  Department
                </label>
                <CustomSelect
                  value={selectedDepartment}
                  onChange={setSelectedDepartment}
                  options={departmentOptions.map((dept) => ({
                    value: dept,
                    label: dept,
                  }))}
                  placeholder="Select department"
                  disabled={!selectedProject}
                />
              </div>
            </div>
            {!projectsLoading && filteredProjects.length === 0 ? (
              <p className="mt-2 text-xs text-gray-500">
                Draft projects are not listed. Submit a project for this authority first.
              </p>
            ) : null}
          </div>

          <div className="grid min-w-0 gap-6 px-2 py-4 lg:grid-cols-3">
            <div className="min-w-0 space-y-6 lg:col-span-2">
              <div>
                <div className="mb-3">
                  <h2 className="text-sm font-semibold text-brand-navy">Application type</h2>
                  <p className="text-xs text-gray-500">Choose the application to create.</p>
                </div>
                {catalogTypesForDepartment.some((type) => type.requires_roster_match) &&
                selectedProject &&
                visiblePermissionTypes.length === 0 ? (
                  <p className="rounded-xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm leading-snug text-gray-700">
                    No consultant roles match an appointment letter yet. Add matching roles in{" "}
                    <Link
                      href={`/dashboard/applicant?projectId=${encodeURIComponent(selectedProject)}`}
                      className="font-medium text-brand-blue underline underline-offset-2 hover:text-brand-navy"
                    >
                      Applicant Details
                    </Link>
                    .
                  </p>
                ) : !selectedProject ? (
                  <p className="rounded-xl border border-dashed border-gray-200 bg-gray-50 px-4 py-10 text-center text-sm text-gray-500">
                    Select a project first to see application types.
                  </p>
                ) : !selectedDepartment ? (
                  <p className="rounded-xl border border-dashed border-gray-200 bg-gray-50 px-4 py-10 text-center text-sm text-gray-500">
                    Select a department to see application types.
                  </p>
                ) : visiblePermissionTypes.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-gray-200 bg-gray-50 px-4 py-10 text-center text-sm text-gray-500">
                    No application types are available for this department.
                  </p>
                ) : (
                  <div className="grid min-w-0 gap-3 sm:grid-cols-2">
                    {visiblePermissionTypes.map((type) => {
                      const already = existingPermissionTypes.includes(type.title);
                      const selected = selectedPermission === type.id;
                      return (
                        <button
                          key={type.id}
                          type="button"
                          aria-pressed={selected}
                          aria-label={already ? `${type.title}, already added` : type.title}
                          onClick={() => {
                            if (already) {
                              setModalMessage(
                                "This permission type is already created for the selected project."
                              );
                              setRedirectOnModalOk(false);
                              setShowInfoModal(true);
                              return;
                            }
                            setSelectedPermission(type.id);
                          }}
                          className={`relative flex min-h-[7.25rem] w-full min-w-0 items-start gap-3 rounded-xl border p-4 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-brand-blue/30 ${
                            already
                              ? "border-sky-200 bg-sky-50/80 hover:border-sky-300 hover:bg-sky-50"
                              : selected
                                ? "border-brand-blue bg-brand-blue/5 ring-2 ring-brand-blue/15"
                                : "border-gray-200 bg-white hover:border-brand-blue/40 hover:bg-gray-50"
                          }`}
                        >
                          <span
                            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${
                              already
                                ? "bg-white"
                                : selected
                                  ? "bg-brand-blue/10"
                                  : "bg-gray-100"
                            }`}
                          >
                            <DocumentIcon />
                          </span>
                          <span className="min-w-0 flex-1 pt-0.5 pr-8">
                            <span className="block text-sm font-semibold leading-snug text-brand-navy">
                              {type.title}
                            </span>
                            {type.description ? (
                              <span className="mt-1 line-clamp-2 block text-xs leading-relaxed text-gray-500">
                                {type.description}
                              </span>
                            ) : null}
                          </span>
                          {already ? (
                            <span className="group/added absolute right-3 top-3">
                              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-navy text-white shadow-sm transition-transform group-hover/added:scale-110">
                                <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
                                  <path
                                    d="M5 12.5l4.2 4.2L19 7"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth={2.5}
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                  />
                                </svg>
                              </span>
                              <span className="pointer-events-none absolute right-0 top-9 z-10 hidden whitespace-nowrap rounded-md bg-brand-navy px-2 py-1 text-[11px] font-medium text-white shadow-md group-hover/added:block">
                                Already added
                              </span>
                            </span>
                          ) : selected ? (
                            <span className="absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded-full bg-brand-blue text-white">
                              <svg viewBox="0 0 24 24" className="h-3 w-3" aria-hidden="true">
                                <path
                                  d="M5 12.5l4.2 4.2L19 7"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth={2.5}
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                />
                              </svg>
                            </span>
                          ) : null}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            <aside className="min-w-0 lg:col-span-1">
              <div className="h-full min-w-0 overflow-hidden rounded-xl border border-sky-100 bg-sky-50/70 p-5">
                <h2 className="text-sm font-semibold text-brand-navy">Related Information</h2>
                <p className="mt-1 text-xs text-gray-500">
                  Summary of your current selections.
                </p>
                <dl className="mt-5 space-y-4">
                  {relatedRows.map((row) => (
                    <div key={row.label} className="min-w-0">
                      <dt className="text-xs font-medium uppercase tracking-wide text-sky-800/70">
                        {row.label}
                      </dt>
                      <dd
                        className="mt-1 truncate text-sm font-medium text-gray-900"
                        title={row.value}
                      >
                        {row.value}
                      </dd>
                    </div>
                  ))}
                </dl>
              </div>
            </aside>
          </div>

          <div className="flex flex-col-reverse gap-3 border-t border-gray-100 px-2 py-3 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={() => router.push("/userdashboard")}
              className={`rounded-lg px-4 py-2.5 text-sm font-semibold ${BTN_SECONDARY}`}
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={!canSubmit}
              onClick={handleProceed}
              className={`rounded-lg px-5 py-2.5 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50 ${BTN_PRIMARY}`}
            >
              {isSubmitting ? "Creating…" : "Create Application"}
            </button>
          </div>
        </div>
      </div>

      {showInfoModal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="w-[min(500px,92vw)] overflow-hidden rounded-xl bg-white shadow-2xl">
            <div className="bg-brand-navy px-6 py-3">
              <h3 className="text-lg font-semibold text-white">Information</h3>
            </div>
            <div className="px-6 py-6">
              <p className="text-sm text-gray-800">{modalMessage}</p>
            </div>
            <div className="flex justify-end border-t border-gray-200 px-6 py-4">
              <button
                onClick={handleModalOk}
                className={`rounded-lg px-6 py-2 text-sm font-medium ${BTN_SECONDARY}`}
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
