"use client";

import React, { useState, useEffect, Suspense, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import DashboardHeader from "../components/DashboardHeader";
import SiteFooter from "../components/SiteFooter";
import DraftApplicationsModal, { DraftApplication } from "../components/DraftApplicationsModal";
import CustomSelect from "@/app/components/CustomSelect";
import { mapSelectedApplicationToTemplate } from "@/app/templates/applicationPreview";
import { supabase } from "@/app/utils/supabase";
import { useDashboardAlertModal } from "@/app/dashboard/context/DashboardAlertModalContext";
import { useDashboardProjects } from "@/app/hooks/useDashboardProjects";
import {
  applicantTypeToPermissionTitle,
  normalizeProjectId,
  permissionTypeMatchesTitle,
} from "@/app/utils/applicantAppointmentPermissions";
import {
  normalizeApplicationWorkflowStage,
  type ApplicationWorkflowStage,
} from "@/app/components/DraftApplicationsModal";

/** Maps dashboard column header (when opening the list modal) to DB `workflow_stage`. */
function dashboardColumnStatusToWorkflowStage(status: string): ApplicationWorkflowStage | null {
  switch (status) {
    case "Draft":
      return "draft";
    case "In Process":
      return "in_process";
    case "Approved or Verified":
      return "approved_verified";
    default:
      return null;
  }
}

function workflowStageToModalCurrentStage(stage: ApplicationWorkflowStage): number {
  switch (stage) {
    case "draft":
      return 0;
    case "in_process":
      return 1;
    case "approved_verified":
      return 3;
    default:
      return 0;
  }
}

function workflowStageLabel(stage: ApplicationWorkflowStage): string {
  switch (stage) {
    case "draft":
      return "Draft";
    case "in_process":
      return "In Process";
    case "approved_verified":
      return "Approved or Verified";
    default:
      return "Draft";
  }
}

type ApplicationType = {
  name: string;
  draft: number | string;
  duePayment: number | string;
  inProcess: number | string;
  needClarification: number | string;
  withdrawn: number | string;
  rejectedOrCancelled: number | string;
  approvedOrVerified: number | string;
  systemApproved: number | string;
};

const departments = [
  "Building Permission",
  "Fire",
  "Traffic and Co-ordination",
  "Solid Waste Management",
  "Assessment and Collection Dept",
  "Storm Water Drain (Internal)",
  "Garden (Tree)",
  "Road Planning",
  "Mechanical & Electrical",
  "Hydraulic Engineering",
  "Pest Control",
  "Sewerage",
  "High Rise Building Commitee",
  "Mumbai Heritage Conservation Committee",
  "Revenue- Excavation Permission",
  "Development Plan",
  "Electricity",
  "National Monuments Authority",
  "Advertisement",
  "Indian Railways",
  "DP(TDR)",
  "Estate and Land Management",
  "Airport Authority of India",
  "General",
];

const DEVELOPMENT_PLAN_APPLICATION_DATA: ApplicationType[] = [
  {
    name: "Survey",
    draft: 1,
    duePayment: "-",
    inProcess: 0,
    needClarification: "-",
    withdrawn: "-",
    rejectedOrCancelled: 0,
    approvedOrVerified: 0,
    systemApproved: "-",
  },
];

const GENERAL_APPLICATION_DATA: ApplicationType[] = [
  {
    name: "Appointment Letter for Architect",
    draft: 0,
    duePayment: "-",
    inProcess: 0,
    needClarification: "-",
    withdrawn: "-",
    rejectedOrCancelled: 0,
    approvedOrVerified: 0,
    systemApproved: "-",
  },
  {
    name: "Appointment Letter for Licensed Surveyor",
    draft: 0,
    duePayment: "-",
    inProcess: 0,
    needClarification: "-",
    withdrawn: "-",
    rejectedOrCancelled: 0,
    approvedOrVerified: 0,
    systemApproved: "-",
  },
  {
    name: "Appointment Letter for Fire Consultant",
    draft: 0,
    duePayment: "-",
    inProcess: 0,
    needClarification: "-",
    withdrawn: "-",
    rejectedOrCancelled: 0,
    approvedOrVerified: 0,
    systemApproved: "-",
  },
  {
    name: "Appointment Letter for MEP Consultant",
    draft: 0,
    duePayment: "-",
    inProcess: 0,
    needClarification: "-",
    withdrawn: "-",
    rejectedOrCancelled: 0,
    approvedOrVerified: 0,
    systemApproved: "-",
  },
  {
    name: "Appointment Letter for Plumber",
    draft: 0,
    duePayment: "-",
    inProcess: 0,
    needClarification: "-",
    withdrawn: "-",
    rejectedOrCancelled: 0,
    approvedOrVerified: 0,
    systemApproved: "-",
  },
  {
    name: "Appointment Letter for Town Planner",
    draft: 0,
    duePayment: "-",
    inProcess: 0,
    needClarification: "-",
    withdrawn: "-",
    rejectedOrCancelled: 0,
    approvedOrVerified: 0,
    systemApproved: "-",
  },
  {
    name: "Appointment Letter for Structural Engineer",
    draft: 0,
    duePayment: "-",
    inProcess: 0,
    needClarification: "-",
    withdrawn: "-",
    rejectedOrCancelled: 0,
    approvedOrVerified: 0,
    systemApproved: "-",
  },
  {
    name: "Appointment Letter for Environmental Consultant",
    draft: 0,
    duePayment: "-",
    inProcess: 0,
    needClarification: "-",
    withdrawn: "-",
    rejectedOrCancelled: 0,
    approvedOrVerified: 0,
    systemApproved: "-",
  },
{
    name: "Appointment Letter for Landscape Consultant",
    draft: 0,
    duePayment: "-",
    inProcess: 0,
    needClarification: "-",
    withdrawn: "-",
    rejectedOrCancelled: 0,
    approvedOrVerified: 0,
    systemApproved: "-",
  },
  {
    name: "Appointment Letter for Geotechnical Consultant",
    draft: 0,
    duePayment: "-",
    inProcess: 0,
    needClarification: "-",
    withdrawn: "-",
    rejectedOrCancelled: 0,
    approvedOrVerified: 0,
    systemApproved: "-",
  },
  {
    name: "Appointment Letter for PMC / Project Manager",
    draft: 0,
    duePayment: "-",
    inProcess: 0,
    needClarification: "-",
    withdrawn: "-",
    rejectedOrCancelled: 0,
    approvedOrVerified: 0,
    systemApproved: "-",
  },
];

const APPLICATION_DATA: ApplicationType[] = [
  {
    name: "Commencement",
    draft: 1,
    duePayment: 0,
    inProcess: 1,
    needClarification: "-",
    withdrawn: 0,
    rejectedOrCancelled: 7,
    approvedOrVerified: 92,
    systemApproved: "-",
  },
  {
    name: "Commencement_Other",
    draft: 1,
    duePayment: "-",
    inProcess: 0,
    needClarification: "-",
    withdrawn: "-",
    rejectedOrCancelled: 5,
    approvedOrVerified: 19,
    systemApproved: "-",
  },
  {
    name: "IOD",
    draft: 0,
    duePayment: 0,
    inProcess: 0,
    needClarification: "-",
    withdrawn: "-",
    rejectedOrCancelled: 1,
    approvedOrVerified: 36,
    systemApproved: "-",
  },
  {
    name: "First CC",
    draft: 0,
    duePayment: "-",
    inProcess: 0,
    needClarification: "-",
    withdrawn: "-",
    rejectedOrCancelled: 0,
    approvedOrVerified: 32,
    systemApproved: "-",
  },
  {
    name: "Further CC",
    draft: 0,
    duePayment: "-",
    inProcess: 1,
    needClarification: "-",
    withdrawn: "-",
    rejectedOrCancelled: 0,
    approvedOrVerified: 59,
    systemApproved: "-",
  },
  {
    name: "LOA",
    draft: 0,
    duePayment: 0,
    inProcess: 0,
    needClarification: "-",
    withdrawn: 0,
    rejectedOrCancelled: 1,
    approvedOrVerified: 4,
    systemApproved: "-",
  },
  {
    name: "Common Completion Request",
    draft: 1,
    duePayment: "-",
    inProcess: 26,
    needClarification: "-",
    withdrawn: "-",
    rejectedOrCancelled: 0,
    approvedOrVerified: 0,
    systemApproved: "-",
  },
  {
    name: "OCC/BCC",
    draft: 1,
    duePayment: "-",
    inProcess: 0,
    needClarification: "-",
    withdrawn: "-",
    rejectedOrCancelled: 2,
    approvedOrVerified: 20,
    systemApproved: "-",
  },
  {
    name: "Change Of Developer",
    draft: 0,
    duePayment: "-",
    inProcess: 0,
    needClarification: "-",
    withdrawn: "-",
    rejectedOrCancelled: 0,
    approvedOrVerified: 2,
    systemApproved: "-",
  },
  {
    name: "Change Of Architect",
    draft: 1,
    duePayment: "-",
    inProcess: 1,
    needClarification: "-",
    withdrawn: "-",
    rejectedOrCancelled: 0,
    approvedOrVerified: 8,
    systemApproved: "-",
  },
  {
    name: "Miscellaneous Proposals",
    draft: 0,
    duePayment: 0,
    inProcess: 0,
    needClarification: "-",
    withdrawn: 0,
    rejectedOrCancelled: 0,
    approvedOrVerified: 0,
    systemApproved: "-",
  },
  {
    name: "Record File",
    draft: 0,
    duePayment: 0,
    inProcess: 0,
    needClarification: "-",
    withdrawn: "-",
    rejectedOrCancelled: 0,
    approvedOrVerified: 0,
    systemApproved: "-",
  },
];

const ANNOUNCEMENTS = [
  "Now Developers/Owners can Avail their \"User Id\" by using forgot User name under Registration in case they have forgot user name.",
  "Dear Users, it is recommended to have 16 mbps of internet bandwidth on your local laptop/ PC for optimized application access.",
  "All Developers/Architects who have uploaded the valid C& D transport approval in the AutoDCR for IOD/CC/OCC etc. after 15th March 2020 or auto generated the C& D approval from system, then they must upload the details of transportation of C& D waste in AutoDCR portal by 04/Aug/2018.",
];

type MenuItem = {
  header?: string;
  action: string;
  route?: string;
  showProjectDropdown?: boolean;
};

const APPLICATION_MENU_ITEMS: MenuItem[] = [
  {
    header: "New Application",
    action: "Create New Application",
    route: "/create-application",
  },
  {
    header: "Existing Applications (Old Application)",
    action: "Add existing Applications",
    route: "/dashboard/project-details",
  },
  {
    header: "Change Applicant",
    action: "Change of Developer",
    route: "/dashboard/project-details",
  },
  {
    action: "Create Application for Record File",
    route: "/dashboard/project-details",
  },
  {
    header: "Risk Based Applications",
    action: "Upload Risk Based Approval",
    route: "/dashboard/project-details",
  },
];

const PROJECT_MENU_ITEMS: MenuItem[] = [
  {
    header: "New Project",
    action: "Create New Project",
    route: "/dashboard/project-details",
  },
  {
    header: "Existing Projects",
    action: "Edit existing Project",
    showProjectDropdown: true,
  },
  {
    header: "Existing Application (Old Application)",
    action: "Add Existing Application",
    route: "/dashboard/project-details",
  },
];

interface ApplicationModalProps {
  open: boolean;
  onClose: () => void;
  items: MenuItem[];
  title: string;
  projects?: { id: string; title: string; status?: string; project_info?: { proposalNo?: string } | null }[];
}

const ApplicationModal: React.FC<ApplicationModalProps> = ({ open, onClose, items, title, projects = [] }) => {
  const router = useRouter();
  const [showProjectDropdownIndex, setShowProjectDropdownIndex] = useState<number | null>(null);
  const [selectedProjectForEdit, setSelectedProjectForEdit] = useState<string>("");

  const getProjectOptionLabel = (project: {
    title: string;
    status?: string;
    project_info?: { proposalNo?: string } | null;
  }) => {
    const detectedProposalNo = project.title.match(/\s(\d{3,})$/)?.[1];
    const proposalNo = project.project_info?.proposalNo?.trim() || detectedProposalNo;
    const cleanTitle =
      proposalNo && project.title.endsWith(` ${proposalNo}`)
        ? project.title.slice(0, -(proposalNo.length + 1))
        : project.title;
    const proposalPart = proposalNo ? ` (${proposalNo})` : "";
    const draftPart = project.status === "draft" ? " (Draft)" : "";
    return {
      label: `${cleanTitle}${proposalPart}${draftPart}`,
      highlightedPart: proposalNo ? `(${proposalNo})` : undefined,
    };
  };

  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "auto";
    }

    return () => {
      document.body.style.overflow = "auto";
      setShowProjectDropdownIndex(null);
      setSelectedProjectForEdit("");
    };
  }, [open]);

  const handleItemClick = (item: MenuItem, index: number) => {
    if (item.showProjectDropdown) {
      setShowProjectDropdownIndex(index);
    } else if (item.route) {
      router.push(item.route);
      onClose();
    }
  };

  const handleProjectSelect = (projectId: string) => {
    if (projectId) {
      router.push(`/dashboard/project-details?projectId=${projectId}`);
      onClose();
    }
  };

  if (!open) return null;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[9999] flex justify-center items-center bg-black/50 backdrop-blur-sm"
          onClick={onClose}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            className="bg-white rounded-xl shadow-2xl w-[90%] max-w-md relative border border-gray-200"
            onClick={(e) => e.stopPropagation()}
            initial={{ y: -40, opacity: 0, scale: 0.95 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: -40, opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.25 }}
          >
            {/* Close Button */}
            <button
              onClick={onClose}
              className="absolute top-4 right-4 text-2xl font-bold text-gray-700 hover:text-black transition-colors z-10"
              aria-label="Close modal"
            >
              ×
            </button>

            <div className="p-6">
              <div className="space-y-0">
                {items.map((item, index) => (
                  <div key={index}>
                    {index > 0 && <div className="border-t border-gray-200 my-0"></div>}
                    <div className="py-3">
                      {item.header && (
                        <div className="text-sm text-gray-500 mb-1">{item.header}</div>
                      )}
                      {item.showProjectDropdown && showProjectDropdownIndex === index ? (
                        <div className="space-y-2">
                          <label className="text-sm text-gray-700 font-medium block">
                            Select a project to edit:
                          </label>
                          <CustomSelect
                            value={selectedProjectForEdit}
                            onChange={(val) => {
                              setSelectedProjectForEdit(val);
                              if (val) {
                                handleProjectSelect(val);
                              }
                            }}
                            options={projects.map((project) => ({
                              value: project.id,
                              ...getProjectOptionLabel(project),
                            }))}
                            placeholder="-- Select Project --"
                          />
                          {projects.length === 0 && (
                            <p className="text-xs text-gray-500 mt-1">No projects available</p>
                          )}
                        </div>
                      ) : (
                        <button
                          onClick={() => handleItemClick(item, index)}
                          className="text-base font-bold text-gray-900 hover:text-emerald-600 transition-colors w-full text-left"
                        >
                          {item.action}
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

// Sample draft applications data
const DRAFT_APPLICATIONS: Record<string, DraftApplication[]> = {
  "Survey": [
    {
      applicationNo: "Need to discuss",
      ward: "M/E Ward",
      applicationType: "Survey",
      status: "Draft",
      startedOn: "10-09-2025",
      currentStage: 0,
      workflowStage: "draft",
    },
  ],
  "Commencement": [
    {
      applicationNo: "Need to discuss",
      ward: "M/E Ward",
      applicationType: "Commencement",
      status: "Draft",
      startedOn: "10-09-2025",
      currentStage: 0,
      workflowStage: "draft",
    },
  ],
};

function UserDashboardContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { showAlert } = useDashboardAlertModal();
  const {
    projects,
    loading: projectsLoading,
    isConsultant,
    consultantType,
    permissionTitlesByProject,
  } = useDashboardProjects();
  // Project filter: "ALL" means don't filter
  const [selectedProject, setSelectedProject] = useState("ALL");
  const [selectedApplicationType, setSelectedApplicationType] = useState("General");
  const [sessionTime, setSessionTime] = useState(3600); // 60 minutes in seconds
  const [isApplicationModalOpen, setIsApplicationModalOpen] = useState(false);
  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);
  const [isDraftModalOpen, setIsDraftModalOpen] = useState(false);
  const [selectedDraftApp, setSelectedDraftApp] = useState<{ appType: string; status: string } | null>(null);
  const [draftCounts, setDraftCounts] = useState<Record<string, number>>({});
  const [inProcessCounts, setInProcessCounts] = useState<Record<string, number>>({});
  const [approvedCounts, setApprovedCounts] = useState<Record<string, number>>({});
  const [draftApplicationsByType, setDraftApplicationsByType] = useState<Record<string, DraftApplication[]>>({});
  const departmentOptions = [...departments].sort((a, b) => a.localeCompare(b));
  const selectableProjects = projects.filter((project) => project.status !== "draft");

  const getProjectOptionLabel = (project: {
    title: string;
    status?: string;
    project_info?: { proposalNo?: string } | null;
  }) => {
    const detectedProposalNo = project.title.match(/\s(\d{3,})$/)?.[1];
    const proposalNo = project.project_info?.proposalNo?.trim() || detectedProposalNo;
    const cleanTitle =
      proposalNo && project.title.endsWith(` ${proposalNo}`)
        ? project.title.slice(0, -(proposalNo.length + 1))
        : project.title;
    const proposalPart = proposalNo ? ` (${proposalNo})` : "";
    const draftPart = project.status === "draft" ? " (Draft)" : "";
    return {
      label: `${cleanTitle}${proposalPart}${draftPart}`,
      highlightedPart: proposalNo ? `(${proposalNo})` : undefined,
    };
  };

  // Read department from URL query parameter
  useEffect(() => {
    const departmentParam = searchParams.get("department");
    if (departmentParam && departments.includes(departmentParam)) {
      setSelectedApplicationType(departmentParam);
    }
  }, [searchParams]);

  const handleCellClick = (appType: string, count: number | string, status: string) => {
    if (count && count !== "-" && Number(count) > 0) {
      setSelectedDraftApp({ appType, status });
      setIsDraftModalOpen(true);
    }
  };

  useEffect(() => {
    const interval = setInterval(() => {
      setSessionTime((prev) => {
        if (prev <= 0) return 0;
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const loadDraftCounts = useCallback(async () => {
    if (projects.length === 0) {
      setDraftCounts({});
      setInProcessCounts({});
      setApprovedCounts({});
      setDraftApplicationsByType({});
      return;
    }

    const { data: authData, error: authError } = await supabase.auth.getUser();
    const userId = authData.user?.id;
    if (authError || !userId) {
      console.error("Error loading applications: not authenticated", authError);
      setDraftCounts({});
      setInProcessCounts({});
      setApprovedCounts({});
      setDraftApplicationsByType({});
      return;
    }

    const projectIds =
      selectedProject === "ALL"
        ? projects.map((p) => String(p.id))
        : [String(selectedProject)];

    type ApplicationRow = {
      id?: string;
      project_id: string;
      permission_type: string;
      project_title?: string;
      created_at?: string;
      workflow_stage?: string | null;
      owner_signed_at?: string | null;
      architect_signed_at?: string | null;
    };

    let applicationRows: ApplicationRow[] = [];

    const rpcName = isConsultant
      ? "get_applications_for_consultant"
      : "get_applications_for_owner";
    const rpcArgs = isConsultant
      ? {
          p_consultant_id: userId,
          p_department: selectedApplicationType,
          p_project_ids: projectIds,
        }
      : {
          p_owner_id: userId,
          p_department: selectedApplicationType,
          p_project_ids: projectIds,
        };

    const { data: rpcData, error: rpcError } = await supabase.rpc(rpcName, rpcArgs);

    if (!rpcError) {
      applicationRows = (rpcData ?? []) as ApplicationRow[];
    } else {
      console.warn(`${rpcName} failed, falling back to direct query:`, rpcError.message);
      let query = supabase
        .from("applications")
        .select(
          "id,project_id,project_title,permission_type,created_at,workflow_stage,owner_signed_at,architect_signed_at"
        )
        .eq("department", selectedApplicationType);

      if (selectedProject === "ALL") {
        query = query.in("project_id", projectIds);
      } else {
        query = query.eq("project_id", String(selectedProject));
      }

      const { data, error } = await query;
      if (error) {
        console.error("Error loading application draft counts:", error);
        setDraftCounts({});
        setInProcessCounts({});
        setApprovedCounts({});
        setDraftApplicationsByType({});
        return;
      }
      applicationRows = (data ?? []) as ApplicationRow[];
    }
    if (isConsultant && selectedApplicationType === "General") {
      const consultantDefaultTitle = consultantType
        ? applicantTypeToPermissionTitle(consultantType)
        : null;
      applicationRows = applicationRows.filter((row) => {
        const projectKey = normalizeProjectId(row.project_id);
        const allowedTitle =
          permissionTitlesByProject[projectKey] ?? consultantDefaultTitle;
        return permissionTypeMatchesTitle(row.permission_type, allowedTitle);
      });
    }

    const draftMap: Record<string, number> = {};
    const inProcessMap: Record<string, number> = {};
    const approvedMap: Record<string, number> = {};
    const groupedApplications: Record<string, DraftApplication[]> = {};

    applicationRows.forEach(
      (row: {
        id?: string;
        project_id: string;
        permission_type: string;
        project_title?: string;
        created_at?: string;
        workflow_stage?: string | null;
        owner_signed_at?: string | null;
        architect_signed_at?: string | null;
      }) => {
        const perm = row.permission_type;
        const wfRaw = normalizeApplicationWorkflowStage(row.workflow_stage);
        const tmpl = mapSelectedApplicationToTemplate(row.permission_type);
        const isArchitectApp = tmpl === "Architect";
        const archSigDone =
          typeof row.architect_signed_at === "string" &&
          row.architect_signed_at.trim().length > 0;
        const wfBucket: ApplicationWorkflowStage =
          wfRaw === "approved_verified" && isArchitectApp && !archSigDone ? "in_process" : wfRaw;

        if (wfBucket === "draft") draftMap[perm] = (draftMap[perm] ?? 0) + 1;
        else if (wfBucket === "in_process") inProcessMap[perm] = (inProcessMap[perm] ?? 0) + 1;
        else if (wfBucket === "approved_verified") approvedMap[perm] = (approvedMap[perm] ?? 0) + 1;

        const startedOn = row.created_at
          ? new Date(row.created_at).toLocaleDateString("en-GB")
          : "-";
        const matchedProject = projects.find((project) => String(project.id) === String(row.project_id));
        const proposalNo = matchedProject?.project_info?.proposalNo?.trim();
        const surveyNo =
          matchedProject?.save_plot_details?.selectedSurveyNos?.[0] ||
          matchedProject?.save_plot_details?.plotEntries?.[0]?.ctsNumber;
        const applicationNo =
          proposalNo ||
          surveyNo ||
          row.project_title ||
          row.id ||
          "-";

        const entry: DraftApplication = {
          applicationId: row.id,
          projectId: String(row.project_id),
          applicationNo,
          ward: "-",
          applicationType: row.permission_type,
          status: workflowStageLabel(wfBucket),
          startedOn,
          currentStage: workflowStageToModalCurrentStage(wfBucket),
          workflowStage: wfBucket,
        };

        if (!groupedApplications[row.permission_type]) {
          groupedApplications[row.permission_type] = [];
        }
        groupedApplications[row.permission_type].push(entry);
      }
    );

    setDraftCounts(draftMap);
    setInProcessCounts(inProcessMap);
    setApprovedCounts(approvedMap);
    setDraftApplicationsByType(groupedApplications);
  }, [
    projects,
    selectedApplicationType,
    selectedProject,
    isConsultant,
    consultantType,
    permissionTitlesByProject,
  ]);

  useEffect(() => {
    loadDraftCounts();
  }, [loadDraftCounts]);

  const handleDeleteApplication = async (applicationId: string) => {
    if (isConsultant) return;

    const { data: sessionData } = await supabase.auth.getSession();
    const authToken = sessionData.session?.access_token;
    if (!authToken) {
      showAlert({
        title: "Sign in required",
        message: "You must be signed in to delete an application.",
      });
      return;
    }

    const response = await fetch(
      `/api/applications/${encodeURIComponent(applicationId)}`,
      {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      }
    );

    if (!response.ok) {
      const errBody = (await response.json().catch(() => null)) as {
        error?: string;
        details?: string;
      } | null;
      const msg =
        typeof errBody?.error === "string"
          ? errBody.error + (errBody.details ? ` (${errBody.details})` : "")
          : "Failed to delete application. Please try again.";
      showAlert({
        title: "Could not delete application",
        message: msg,
      });
      return;
    }

    await loadDraftCounts();
    setIsDraftModalOpen(false);
    setSelectedDraftApp(null);
  };

  const handleOpenApplicationDetails = async (payload: {
    applicationId: string;
    projectId?: string;
    applicationNo: string;
    appType: string;
  }) => {
    let projectId = payload.projectId?.trim() || "";

    if (!projectId) {
      const { data, error } = await supabase
        .from("applications")
        .select("project_id")
        .eq("id", payload.applicationId)
        .single();

      if (error || !data?.project_id) {
        showAlert({
          title: "Application details",
          message: "Unable to open application details. Linked project not found.",
        });
        return;
      }
      projectId = String(data.project_id);
    }

    const query = new URLSearchParams({
      projectId,
      applicationId: payload.applicationId,
      applicationNo: payload.applicationNo,
      selectedApplication: payload.appType,
      mode: "readonly",
    });

    setIsDraftModalOpen(false);
    setSelectedDraftApp(null);
    // Open Application Details directly so `applicationId` stays in the URL for Preview → Sign → save workflow.
    router.push(`/dashboard/application-details?${query.toString()}`);
  };

  const tableData =
    selectedApplicationType === "General"
      ? GENERAL_APPLICATION_DATA
      : selectedApplicationType === "Development Plan"
      ? DEVELOPMENT_PLAN_APPLICATION_DATA
      : APPLICATION_DATA;

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-gray-100">
      <div className="p-4 md:p-6 shrink-0">
        <DashboardHeader sessionTime={formatTime(sessionTime)} />
      </div>

      <div className="px-4 md:px-6 pb-4 md:pb-6 flex-1 min-h-0 overflow-hidden">
        <div className="h-full w-full rounded-3xl bg-white shadow-sm border border-gray-200 overflow-hidden flex flex-col">
          <div className="flex-1 min-h-0 overflow-y-auto bg-gray-50 p-4 md:p-6">
            {/* Mandatory notice */}
            <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-md shadow-sm mb-4">
              <p className="text-sm text-red-700">
                <strong>Note:</strong> This is mandatory for all Architect/LS to fill up Building
                construction activity details twice a month (1st to 15th & 16th to 31st) and upload
                site photographs and site supervisor report
              </p>
            </div>

            {/* Main Content */}
            <div className="flex gap-4 min-h-full overflow-x-hidden">
          {/* Left Content Area */}
          <div className="flex-1 min-w-0 min-h-0 flex flex-col gap-4">
            {/* Navigation and Filters */}
            <div className="flex items-center gap-3 w-full">
              <div className="flex items-center gap-2 min-w-0 w-full">
                <CustomSelect
                  value={selectedProject}
                  onChange={(val) => setSelectedProject(val)}
                  options={[
                    { value: "ALL", label: "All Projects" },
                    ...selectableProjects.map((p) => ({
                      value: p.id,
                      ...getProjectOptionLabel(p),
                    })),
                  ]}
                  className="flex-[7] min-w-0"
                />

                <CustomSelect
                  value={selectedApplicationType}
                  onChange={(val) => setSelectedApplicationType(val)}
                  options={departmentOptions.map((department) => ({
                    value: department,
                    label: department,
                  }))}
                  className="flex-[3] min-w-0"
                />
              </div>
            </div>
            {projectsLoading && (
              <span className="text-xs text-gray-600 mt-1 inline-block">Loading projects...</span>
            )}
            {!projectsLoading && projects.length === 0 && (
              <span className="text-xs text-gray-600 mt-1 inline-block">No projects found</span>
            )}

            {/* Main Data Table */}
            <div className="rounded-2xl border border-gray-200 shadow-sm bg-white overflow-hidden flex-1 min-h-0">
              <div className="overflow-auto h-full min-h-[420px]">
                <table className="w-full text-sm border-collapse">
                  <thead className="sticky top-0 z-10">
                    <tr>
                      <th className="bg-emerald-800 border-b border-emerald-700 px-4 py-3 text-left text-sm font-semibold text-white">
                        Application Type
                      </th>
                      <th className="bg-emerald-700 border-b border-emerald-600 px-4 py-3 text-center text-sm font-semibold text-white">
                        Draft
                      </th>
                      <th className="bg-emerald-600 border-b border-emerald-500 px-4 py-3 text-center text-sm font-semibold text-white">
                        Due Payment
                      </th>
                      <th className="bg-emerald-500 border-b border-emerald-400 px-4 py-3 text-center text-sm font-semibold text-white">
                        In Process
                      </th>
                      <th className="bg-emerald-400 border-b border-emerald-300 px-4 py-3 text-center text-sm font-semibold text-emerald-950">
                        Need Clarification
                      </th>
                      <th className="bg-emerald-300 border-b border-emerald-200 px-4 py-3 text-center text-sm font-semibold text-emerald-950">
                        Withdrawn
                      </th>
                      <th className="bg-emerald-200 border-b border-emerald-100 px-4 py-3 text-center text-sm font-semibold text-emerald-900">
                        Rejected or Cancelled
                      </th>
                      <th className="bg-emerald-100 border-b border-emerald-50 px-4 py-3 text-center text-sm font-semibold text-emerald-800">
                        Approved or Verified
                      </th>
                      <th className="bg-emerald-50 border-b border-emerald-100 px-4 py-3 text-center text-sm font-semibold text-emerald-800">
                        System Approved
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {tableData.map((app, index) => {
                      const draftCount = draftCounts[app.name] ?? 0;
                      const inProcessCount = inProcessCounts[app.name] ?? 0;
                      const approvedCount = approvedCounts[app.name] ?? 0;
                      return (
                      <tr key={index} className="hover:bg-gray-50">
                        <td className="border-b border-gray-200 px-4 py-3 text-left font-medium text-gray-900">
                          {app.name}
                        </td>
                        <td
                          className={`border-b border-gray-200 px-4 py-3 text-center ${
                            draftCount > 0
                              ? "text-emerald-600 font-semibold underline cursor-pointer hover:bg-emerald-50"
                              : "text-gray-900"
                          }`}
                          onClick={() => handleCellClick(app.name, draftCount, "Draft")}
                        >
                          {draftCount}
                        </td>
                        <td className="border-b border-gray-200 px-4 py-3 text-center text-gray-900" onClick={() => handleCellClick(app.name, 0, "Due Payment")}>
                          0
                        </td>
                        <td
                          className={`border-b border-gray-200 px-4 py-3 text-center ${
                            inProcessCount > 0
                              ? "text-emerald-600 font-semibold underline cursor-pointer hover:bg-emerald-50"
                              : "text-gray-900"
                          }`}
                          onClick={() => handleCellClick(app.name, inProcessCount, "In Process")}
                        >
                          {inProcessCount}
                        </td>
                        <td className="border-b border-gray-200 px-4 py-3 text-center text-gray-900" onClick={() => handleCellClick(app.name, 0, "Need Clarification")}>
                          0
                        </td>
                        <td className="border-b border-gray-200 px-4 py-3 text-center text-gray-900" onClick={() => handleCellClick(app.name, 0, "Withdrawn")}>
                          0
                        </td>
                        <td className="border-b border-gray-200 px-4 py-3 text-center text-gray-900" onClick={() => handleCellClick(app.name, 0, "Rejected or Cancelled")}>
                          0
                        </td>
                        <td
                          className={`border-b border-gray-200 px-4 py-3 text-center ${
                            approvedCount > 0
                              ? "text-emerald-600 font-semibold underline cursor-pointer hover:bg-emerald-50"
                              : "text-gray-900"
                          }`}
                          onClick={() => handleCellClick(app.name, approvedCount, "Approved or Verified")}
                        >
                          {approvedCount}
                        </td>
                        <td className="border-b border-gray-200 px-4 py-3 text-center text-gray-900" onClick={() => handleCellClick(app.name, 0, "System Approved")}>
                          0
                        </td>
                      </tr>
                    )})}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Right Sidebar - Announcements */}
          <div className="w-80 space-y-4">
            {!isConsultant && (
            <motion.div className="flex items-center gap-2 w-full">
              <button
                onClick={() => setIsProjectModalOpen(true)}
                className="h-9 flex-1 px-4 rounded-lg bg-gradient-to-r from-emerald-800 to-emerald-500 hover:from-emerald-900 hover:to-emerald-600 text-white shadow-sm hover:shadow-md transition-all text-sm font-semibold"
              >
                + Projects
              </button>
              <button
                onClick={() => setIsApplicationModalOpen(true)}
                className="h-9 flex-1 px-4 rounded-lg bg-gradient-to-r from-emerald-800 to-emerald-500 hover:from-emerald-900 hover:to-emerald-600 text-white shadow-sm hover:shadow-md transition-all text-sm font-semibold"
              >
                + Applications
              </button>
            </motion.div>
            )}
            <div className="rounded-2xl border border-gray-200 shadow-sm bg-white p-4">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Announcements</h3>
              <div className="space-y-4">
                {ANNOUNCEMENTS.map((announcement, index) => (
                  <div
                    key={index}
                    className="rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm text-gray-700"
                  >
                    {announcement}
                  </div>
                ))}
              </div>
            </div>
          </div>
            </div>
          </div>
        </div>
      </div>

      <div className="shrink-0">
        <SiteFooter />
      </div>

      {/* Application Modal */}
      <ApplicationModal
        open={isApplicationModalOpen}
        onClose={() => setIsApplicationModalOpen(false)}
        items={APPLICATION_MENU_ITEMS}
        title="Applications"
      />

      {/* Project Modal */}
      <ApplicationModal
        open={isProjectModalOpen}
        onClose={() => setIsProjectModalOpen(false)}
        items={PROJECT_MENU_ITEMS}
        title="Projects"
        projects={projects}
      />

      {/* Draft Applications Modal */}
      {selectedDraftApp && (
        <DraftApplicationsModal
          open={isDraftModalOpen}
          onClose={() => {
            setIsDraftModalOpen(false);
            setSelectedDraftApp(null);
          }}
          appType={selectedDraftApp.appType}
          status={selectedDraftApp.status}
          applications={(draftApplicationsByType[selectedDraftApp.appType] || []).filter(
            (a) => {
              const want = dashboardColumnStatusToWorkflowStage(selectedDraftApp.status);
              if (want === null) return false;
              return a.workflowStage === want;
            }
          )}
          onDeleteApplication={isConsultant ? undefined : handleDeleteApplication}
          onOpenApplicationDetails={handleOpenApplicationDetails}
        />
      )}
    </div>
  );
}

export default function UserDashboardPage() {
  return (
    <Suspense fallback={
      <div className="h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    }>
      <UserDashboardContent />
    </Suspense>
  );
}
