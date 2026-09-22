"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import AppShell from "@/app/components/appshell/AppShell";
import CustomSelect from "@/app/components/CustomSelect";
import { supabase } from "@/app/utils/supabase";
import {
  appointmentTypeIdsMatchingRoster,
  catalogPlaceholderFieldMap,
  departmentsFromCatalog,
  fetchApplicationCatalogTypes,
  fetchPlaceholdersForApplicationType,
  typesForDepartment,
  type ApplicationCatalogType,
  type CatalogLinkedPlaceholder,
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
import { canCreateProjectAsArchitect } from "@/app/utils/projectAccess";
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
  icon: React.ReactNode;
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
  <svg viewBox="0 0 24 24" className={iconClass}>
    <path d="M7 3h7l4 4v14a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z" stroke="currentColor" strokeWidth={1.5} fill="none" />
    <path d="M14 3v4h4" stroke="currentColor" strokeWidth={1.5} fill="none" />
    <path d="M9 12h6M9 16h6" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" />
  </svg>
);

const BuildingIcon = () => (
  <svg viewBox="0 0 24 24" className={iconClass}>
    <rect x="6" y="3" width="12" height="18" rx="1.5" stroke="currentColor" strokeWidth={1.5} fill="none" />
    <path d="M9 7h2M13 7h2M9 11h2M13 11h2M11 15h2M10 21v-4h4v4" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" />
  </svg>
);

const ClipboardIcon = () => (
  <svg viewBox="0 0 24 24" className={iconClass}>
    <rect x="6" y="4" width="12" height="16" rx="2" stroke="currentColor" strokeWidth={1.5} fill="none" />
    <path d="M9 4V2h6v2" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" />
    <path d="M9 10h6M9 14h4" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" />
  </svg>
);

const CheckIcon = () => (
  <svg viewBox="0 0 24 24" className={iconClass}>
    <path d="M4 12l5 5 11-11" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" fill="none" />
  </svg>
);

const ShieldIcon = () => (
  <svg viewBox="0 0 24 24" className={iconClass}>
    <path d="M12 3l7 3v6c0 5-3 8-7 9-4-1-7-4-7-9V6l7-3z" stroke="currentColor" strokeWidth={1.5} fill="none" />
    <path d="M9 12l2 2 4-4" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const TreeIcon = () => (
  <svg viewBox="0 0 24 24" className={iconClass}>
    <path d="M12 2c3 0 5 2 5 5 0 2-1 4-1 4s2 1 2 4-2 4-5 4-5-1-5-4 2-4 2-4-1-2-1-4c0-3 2-5 5-5z" stroke="currentColor" strokeWidth={1.5} fill="none" />
    <path d="M12 19v3" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" />
  </svg>
);

const RoadIcon = () => (
  <svg viewBox="0 0 24 24" className={iconClass}>
    <path d="M8 3h8l3 18H5L8 3z" stroke="currentColor" strokeWidth={1.5} fill="none" />
    <path d="M12 5v3M12 12v3M12 18v2" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" />
  </svg>
);

const GearIcon = () => (
  <svg viewBox="0 0 24 24" className={iconClass}>
    <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth={1.5} fill="none" />
    <path d="M12 5V3M12 21v-2M5 12H3m18 0h-2M6.343 6.343 4.929 4.929m14.142 14.142-1.414-1.414M17.657 6.343l1.414-1.414M6.343 17.657l-1.414 1.414" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" />
  </svg>
);

const WaterIcon = () => (
  <svg viewBox="0 0 24 24" className={iconClass}>
    <path d="M12 3s5 6 5 9-2.239 7-5 7-5-4-5-7 5-9 5-9z" stroke="currentColor" strokeWidth={1.5} fill="none" />
    <path d="M9 16c.5.667 1.667 2 3 2s2.5-1 3-2" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" />
  </svg>
);

const WavesIcon = () => (
  <svg viewBox="0 0 24 24" className={iconClass}>
    <path d="M4 9c1.5-1 3.5-1 5 0s3.5 1 5 0 3.5-1 5 0" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" fill="none" />
    <path d="M4 15c1.5-1 3.5-1 5 0s3.5 1 5 0 3.5-1 5 0" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" fill="none" />
  </svg>
);

const AssessmentIcon = () => (
  <svg viewBox="0 0 24 24" className={iconClass}>
    <path d="M4 4h16v16H4z" stroke="currentColor" strokeWidth={1.5} fill="none" />
    <path d="M8 16l2-3 2 2 4-5 2 3" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const NetworkIcon = () => (
  <svg viewBox="0 0 24 24" className={iconClass}>
    <circle cx="12" cy="6" r="3" stroke="currentColor" strokeWidth={1.5} fill="none" />
    <circle cx="6" cy="18" r="3" stroke="currentColor" strokeWidth={1.5} fill="none" />
    <circle cx="18" cy="18" r="3" stroke="currentColor" strokeWidth={1.5} fill="none" />
    <path d="M10 8.5l-3 7M14 8.5l3 7" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" />
  </svg>
);

const PlaneIcon = () => (
  <svg viewBox="0 0 24 24" className={iconClass}>
    <path d="M2 12l20-7-5 7 5 7-20-7z" stroke="currentColor" strokeWidth={1.5} fill="none" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M12 12v8" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" />
  </svg>
);

const WarningIcon = () => (
  <svg viewBox="0 0 24 24" className={iconClass}>
    <path d="M12 3l9 16H3l9-16z" stroke="currentColor" strokeWidth={1.5} fill="none" />
    <path d="M12 9v4M12 17h.01" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" />
  </svg>
);

const FlowIcon = () => (
  <svg viewBox="0 0 24 24" className={iconClass}>
    <path d="M5 7h8a4 4 0 0 1 4 4v6" stroke="currentColor" strokeWidth={1.5} fill="none" strokeLinecap="round" />
    <path d="M5 7l3 3M5 7l3-3" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" />
    <path d="M17 17l2-2m-2 2 2 2" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" />
  </svg>
);

const CATALOG_ICON_BY_KEY: Record<string, React.ReactNode> = {
  document: <DocumentIcon />,
  building: <BuildingIcon />,
  clipboard: <ClipboardIcon />,
  check: <CheckIcon />,
  shield: <ShieldIcon />,
  tree: <TreeIcon />,
  road: <RoadIcon />,
  gear: <GearIcon />,
  water: <WaterIcon />,
  waves: <WavesIcon />,
  assessment: <AssessmentIcon />,
  network: <NetworkIcon />,
  plane: <PlaneIcon />,
  warning: <WarningIcon />,
  flow: <FlowIcon />,
};

export default function CreateApplicationPage() {
  const router = useRouter();
  const { showAlert } = useDashboardAlertModal();
  const [selectedAuthority, setSelectedAuthority] = useState("bmc");
  const [selectedProject, setSelectedProject] = useState("");
  const [projects, setProjects] = useState<OwnerProjectSelectRow[]>([]);
  const [projectsLoading, setProjectsLoading] = useState(true);
  const [selectedDepartment, setSelectedDepartment] = useState("General");
  const [selectedPermission, setSelectedPermission] = useState<string | null>(null);
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [modalMessage, setModalMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [existingPermissionTypes, setExistingPermissionTypes] = useState<string[]>([]);
  const [redirectOnModalOk, setRedirectOnModalOk] = useState(false);
  const [catalogTypes, setCatalogTypes] = useState<ApplicationCatalogType[]>([]);
  const [catalogPlaceholders, setCatalogPlaceholders] = useState<CatalogLinkedPlaceholder[]>([]);

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
  }, []);

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
        icon: CATALOG_ICON_BY_KEY[type.icon_key] ?? <DocumentIcon />,
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
  const selectedCatalogType = catalogTypesForDepartment.find((type) => type.id === selectedPermission);

  useEffect(() => {
    if (!selectedPermission) {
      setCatalogPlaceholders([]);
      return;
    }
    let cancelled = false;
    (async () => {
      const rows = await fetchPlaceholdersForApplicationType(selectedPermission);
      if (!cancelled) setCatalogPlaceholders(rows);
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedPermission]);

  const keyVariables = useMemo(() => {
    if (!selectedProjectData) return [] as { field: string; value: string; source: string }[];
    const projectSource = {
      title: selectedProjectData.title,
      project_info: selectedProjectData.project_info as Record<string, unknown> | null,
      save_plot_details: selectedProjectData.save_plot_details as Record<string, unknown> | null,
      building_details: selectedProjectData.building_details as Record<string, unknown> | null,
      applicant_details: selectedProjectData.applicant_details as
        | { applicants?: Record<string, unknown>[] }
        | null,
    };
    if (catalogPlaceholders.length > 0) {
      const mapped = catalogPlaceholderFieldMap(
        catalogPlaceholders,
        projectSource,
        selectedCatalogType?.applicant_type
      );
      return catalogPlaceholders
        .map((ph) => {
          const value = mapped[ph.token] || "";
          if (!value) return null;
          return { field: ph.label, value, source: "Project Data" };
        })
        .filter((row): row is { field: string; value: string; source: string } => Boolean(row));
    }
    const info = selectedProjectData.project_info;
    const plot = selectedProjectData.save_plot_details;
    const building = selectedProjectData.building_details;
    const display = getProjectDisplayData(selectedProjectData);
    const rows: { field: string; value: string; source: string }[] = [];
    const push = (field: string, value: string | number | undefined | null) => {
      const text = value == null ? "" : String(value).trim();
      if (!text) return;
      rows.push({ field, value: text, source: "Project Data" });
    };
    push("Project Name", display.cleanTitle || selectedProjectData.title);
    push("Proposal No", info?.proposalNo || display.proposalNo);
    push("Plot Area", plot?.grossPlotArea);
    push("Building Height", building?.height);
    push("Planning Authority", plot?.planningAuthority || selectedAuthorityLabel);
    push("Major Use of Plot", plot?.majorUseOfPlot);
    push("Ward", plot?.ward);
    push("Building Type", building?.buildingType);
    push("Property Address", info?.propertyAddress);
    return rows;
  }, [
    selectedProjectData,
    selectedAuthorityLabel,
    catalogPlaceholders,
    selectedCatalogType,
  ]);

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
    if (departmentOptions.length > 0 && !departmentOptions.includes(selectedDepartment)) {
      setSelectedDepartment(departmentOptions.includes("General") ? "General" : departmentOptions[0]);
    }
  }, [selectedAuthority, selectedDepartment, departmentOptions]);

  useEffect(() => {
    if (!selectedProject) {
      setSelectedDepartment("General");
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

  const applicationSelectOptions = visiblePermissionTypes.map((type) => {
    const already = existingPermissionTypes.includes(type.title);
    return {
      value: type.id,
      label: already ? `${type.title} (Already added)` : type.title,
    };
  });

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
      <div className="mx-auto w-full min-w-0 max-w-6xl px-4 py-6 md:px-6 md:py-8">
        <div className="min-w-0 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
          <div className="flex min-w-0 flex-col gap-4 border-b border-gray-100 px-5 py-5 lg:flex-row lg:items-start lg:justify-between md:px-6">
            <div className="min-w-0 shrink-0 lg:max-w-sm">
              <h1 className="text-xl font-semibold tracking-tight text-brand-navy md:text-2xl">
                Create Application
              </h1>
              <p className="mt-1 text-sm text-gray-500">
                Select authority and project, then choose the application to create.
              </p>
            </div>
            <div className="grid w-full min-w-0 gap-3 sm:grid-cols-2 lg:max-w-xl">
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
                <p className="mt-1.5 min-h-4 text-xs text-gray-500">
                  {!projectsLoading && filteredProjects.length === 0
                    ? "Draft projects are not listed. Submit a project for this authority first."
                    : "\u00a0"}
                </p>
              </div>
            </div>
          </div>

          <div className="grid min-w-0 gap-6 px-5 py-6 lg:grid-cols-3 md:px-6">
            <div className="min-w-0 space-y-6 lg:col-span-2">
              <div className="grid min-w-0 gap-4 sm:grid-cols-2">
                <div className="min-w-0">
                  <label className="mb-1.5 block text-sm font-medium text-gray-800">
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
                <div className="min-w-0">
                  <label className="mb-1.5 block text-sm font-medium text-gray-800">
                    Application type
                  </label>
                  {catalogTypesForDepartment.some((type) => type.requires_roster_match) &&
                  selectedProject &&
                  visiblePermissionTypes.length === 0 ? (
                    <p className="min-h-11 rounded-lg border border-amber-100 bg-amber-50 px-3 py-2.5 text-sm leading-snug text-gray-700">
                      No consultant roles match an appointment letter yet. Add matching roles in{" "}
                      <Link
                        href={`/dashboard/applicant?projectId=${encodeURIComponent(selectedProject)}`}
                        className="font-medium text-brand-blue underline underline-offset-2 hover:text-brand-navy"
                      >
                        Applicant Details
                      </Link>
                      .
                    </p>
                  ) : (
                    <CustomSelect
                      value={selectedPermission ?? ""}
                      onChange={(val) => {
                        const type = visiblePermissionTypes.find((p) => p.id === val);
                        if (type && existingPermissionTypes.includes(type.title)) {
                          setModalMessage(
                            "This permission type is already created for the selected project."
                          );
                          setRedirectOnModalOk(false);
                          setShowInfoModal(true);
                          return;
                        }
                        setSelectedPermission(val || null);
                      }}
                      options={applicationSelectOptions}
                      placeholder={
                        !selectedProject
                          ? "Select a project first"
                          : "Select application type"
                      }
                      disabled={!selectedProject || visiblePermissionTypes.length === 0}
                    />
                  )}
                </div>
              </div>

              <div>
                <div className="mb-3 flex items-end justify-between gap-3">
                  <div>
                    <h2 className="text-sm font-semibold text-brand-navy">Key Variables</h2>
                    <p className="text-xs text-gray-500">
                      Pulled from the selected project. Empty fields are hidden.
                    </p>
                  </div>
                </div>
                <div className="overflow-hidden rounded-xl border border-gray-200">
                  <div className="max-h-[280px] overflow-auto">
                    <table className="w-full table-fixed text-left text-sm">
                      <thead className="sticky top-0 bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                        <tr>
                          <th className="w-[30%] px-4 py-3 font-medium">Field</th>
                          <th className="w-[45%] px-4 py-3 font-medium">Value</th>
                          <th className="w-[25%] px-4 py-3 font-medium">Source</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 bg-white">
                        {!selectedProject ? (
                          <tr>
                            <td colSpan={3} className="px-4 py-8 text-center text-gray-500">
                              Select a project to view key variables.
                            </td>
                          </tr>
                        ) : keyVariables.length === 0 ? (
                          <tr>
                            <td colSpan={3} className="px-4 py-8 text-center text-gray-500">
                              No project variables available yet.
                            </td>
                          </tr>
                        ) : (
                          keyVariables.map((row) => (
                            <tr key={row.field}>
                              <td className="truncate px-4 py-3 font-medium text-gray-800" title={row.field}>
                                {row.field}
                              </td>
                              <td className="truncate px-4 py-3 text-gray-700" title={row.value}>
                                {row.value}
                              </td>
                              <td className="truncate px-4 py-3 text-gray-500" title={row.source}>
                                {row.source}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
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

          <div className="flex flex-col-reverse gap-3 border-t border-gray-100 px-5 py-4 sm:flex-row sm:justify-end md:px-6">
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
