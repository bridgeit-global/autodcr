"use client";

import React, { useState, useEffect, Suspense, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import DashboardHeader from "../components/DashboardHeader";
import SiteFooter from "../components/SiteFooter";
import DraftApplicationsModal, { DraftApplication } from "../components/DraftApplicationsModal";
import CustomSelect from "@/app/components/CustomSelect";
import { supabase } from "@/app/utils/supabase";

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
            className="bg-white rounded-lg shadow-2xl w-[90%] max-w-md relative"
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
                    {index > 0 && <div className="border-t border-gray-300 my-0"></div>}
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
                          className="text-base font-bold text-black hover:text-blue-600 transition-colors w-full text-left"
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
    },
  ],
};

function UserDashboardContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  // Project filter: "ALL" means don't filter
  const [selectedProject, setSelectedProject] = useState("ALL");
  const [projects, setProjects] = useState<
    {
      id: string;
      title: string;
      status?: string;
      project_info?: { proposalNo?: string } | null;
      save_plot_details?: {
        selectedSurveyNos?: string[];
        plotEntries?: Array<{ ctsNumber?: string }>;
      } | null;
    }[]
  >([]);
  const [projectsLoading, setProjectsLoading] = useState(false);
  const [selectedApplicationType, setSelectedApplicationType] = useState("Building Permission");
  const [sessionTime, setSessionTime] = useState(3600); // 60 minutes in seconds
  const [isApplicationModalOpen, setIsApplicationModalOpen] = useState(false);
  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);
  const [isDraftModalOpen, setIsDraftModalOpen] = useState(false);
  const [selectedDraftApp, setSelectedDraftApp] = useState<{ appType: string; status: string } | null>(null);
  const [draftCounts, setDraftCounts] = useState<Record<string, number>>({});
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

  // Load projects for logged-in user (populate "Select Project" dropdown)
  useEffect(() => {
    const loadProjects = async () => {
      setProjectsLoading(true);
      try {
        const { data: authData, error: authError } = await supabase.auth.getUser();
        if (authError) {
          console.error("Error fetching auth user:", authError);
          setProjects([]);
          return;
        }
        const userId = authData.user?.id;
        if (!userId) {
          setProjects([]);
          return;
        }

        const { data, error } = await supabase
          .from("projects")
          .select("id,title,status,project_info,save_plot_details")
          .eq("user_id", userId)
          .order("created_at", { ascending: false });

        if (error) {
          console.error("Error loading projects:", error);
          setProjects([]);
          return;
        }

        setProjects(
          (data ?? []).map((row: any) => ({
            id: row.id,
            title: row.title,
            status: row.status,
            project_info: row.project_info,
            save_plot_details: row.save_plot_details,
          }))
        );
      } finally {
        setProjectsLoading(false);
      }
    };

    loadProjects();
  }, []);

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
      return;
    }

    let query = supabase
      .from("applications")
      .select("id,project_id,project_title,permission_type,created_at")
      .eq("department", selectedApplicationType);

    if (selectedProject === "ALL") {
      query = query.in("project_id", projects.map((project) => project.id));
    } else {
      query = query.eq("project_id", selectedProject);
    }

    const { data, error } = await query;
    if (error) {
      console.error("Error loading application draft counts:", error);
      setDraftCounts({});
      setDraftApplicationsByType({});
      return;
    }

    const counts: Record<string, number> = {};
    const groupedApplications: Record<string, DraftApplication[]> = {};

    (data ?? []).forEach((row: { id?: string; project_id: string; permission_type: string; project_title?: string; created_at?: string }) => {
      counts[row.permission_type] = (counts[row.permission_type] ?? 0) + 1;

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
        applicationNo,
        ward: "-",
        applicationType: row.permission_type,
        status: "Draft",
        startedOn,
        currentStage: 0,
      };

      if (!groupedApplications[row.permission_type]) {
        groupedApplications[row.permission_type] = [];
      }
      groupedApplications[row.permission_type].push(entry);
    });

    setDraftCounts(counts);
    setDraftApplicationsByType(groupedApplications);
  }, [projects, selectedApplicationType, selectedProject]);

  useEffect(() => {
    loadDraftCounts();
  }, [loadDraftCounts]);

  const handleDeleteApplication = async (applicationId: string) => {
    const { error } = await supabase.from("applications").delete().eq("id", applicationId);
    if (error) {
      alert("Failed to delete application. Please try again.");
      return;
    }
    await loadDraftCounts();
  };

  const handleOpenApplicationDetails = async (payload: {
    applicationId: string;
    applicationNo: string;
    appType: string;
  }) => {
    const { data, error } = await supabase
      .from("applications")
      .select("project_id")
      .eq("id", payload.applicationId)
      .single();

    if (error || !data?.project_id) {
      alert("Unable to open application details. Linked project not found.");
      return;
    }

    const query = new URLSearchParams({
      projectId: String(data.project_id),
      applicationId: payload.applicationId,
      applicationNo: payload.applicationNo,
      selectedApplication: payload.appType,
      mode: "readonly",
    });

    setIsDraftModalOpen(false);
    setSelectedDraftApp(null);
    router.push(`/dashboard/project-details?${query.toString()}`);
  };

  const tableData =
    selectedApplicationType === "General"
      ? GENERAL_APPLICATION_DATA
      : selectedApplicationType === "Development Plan"
      ? DEVELOPMENT_PLAN_APPLICATION_DATA
      : APPLICATION_DATA;

  return (
    <div className="h-screen bg-gray-50 flex flex-col overflow-hidden">
      <DashboardHeader sessionTime={formatTime(sessionTime)} />
      
      <div className="flex-1 overflow-y-auto bg-gray-100">
        {/* Red Instruction Banner */}
        <div className="w-full bg-red-600 text-white px-6 py-3 text-sm font-medium">
          This is mandatory for all Architect/LS to fill up Building construction activity details twice a month (1st to 15th & 16th to 31st) and upload site photographs and site supervisor report
        </div>

        {/* Main Content */}
        <div className="flex gap-4 p-6 min-h-full overflow-x-hidden">
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
            <div className="bg-white rounded-lg border border-gray-300 overflow-hidden flex-1 min-h-0">
              <div className="overflow-auto h-full min-h-[420px]">
                <table className="w-full text-sm border-collapse">
                  <thead className="sticky top-0 z-10">
                    <tr>
                      <th className="bg-green-100 border border-gray-300 px-4 py-3 text-left font-semibold text-black">
                        Application Type
                      </th>
                      <th className="bg-blue-100 border border-gray-300 px-4 py-3 text-center font-semibold text-black">
                        Draft
                      </th>
                      <th className="bg-white border border-gray-300 px-4 py-3 text-center font-semibold text-black">
                        Due Payment
                      </th>
                      <th className="bg-purple-100 border border-gray-300 px-4 py-3 text-center font-semibold text-black">
                        In Process
                      </th>
                      <th className="bg-white border border-gray-300 px-4 py-3 text-center font-semibold text-black">
                        Need Clarification
                      </th>
                      <th className="bg-amber-100 border border-gray-300 px-4 py-3 text-center font-semibold text-black">
                        Withdrawn
                      </th>
                      <th className="bg-red-100 border border-gray-300 px-4 py-3 text-center font-semibold text-black">
                        Rejected or Cancelled
                      </th>
                      <th className="bg-green-100 border border-gray-300 px-4 py-3 text-center font-semibold text-black">
                        Approved or Verified
                      </th>
                      <th className="bg-white border border-gray-300 px-4 py-3 text-center font-semibold text-black">
                        System Approved
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {tableData.map((app, index) => {
                      const draftCount = draftCounts[app.name] ?? 0;
                      return (
                      <tr key={index} className="hover:bg-gray-50">
                        <td className="border border-gray-300 px-4 py-3 text-left font-medium text-black">
                          {app.name}
                        </td>
                        <td
                          className={`border border-gray-300 px-4 py-3 text-center ${
                            draftCount > 0
                              ? "text-blue-600 font-semibold underline cursor-pointer hover:bg-blue-50"
                              : "text-black"
                          }`}
                          onClick={() => handleCellClick(app.name, draftCount, "Draft")}
                        >
                          {draftCount}
                        </td>
                        <td className="border border-gray-300 px-4 py-3 text-center text-black" onClick={() => handleCellClick(app.name, 0, "Due Payment")}>
                          0
                        </td>
                        <td className="border border-gray-300 px-4 py-3 text-center text-black" onClick={() => handleCellClick(app.name, 0, "In Process")}>
                          0
                        </td>
                        <td className="border border-gray-300 px-4 py-3 text-center text-black" onClick={() => handleCellClick(app.name, 0, "Need Clarification")}>
                          0
                        </td>
                        <td className="border border-gray-300 px-4 py-3 text-center text-black" onClick={() => handleCellClick(app.name, 0, "Withdrawn")}>
                          0
                        </td>
                        <td className="border border-gray-300 px-4 py-3 text-center text-black" onClick={() => handleCellClick(app.name, 0, "Rejected or Cancelled")}>
                          0
                        </td>
                        <td className="border border-gray-300 px-4 py-3 text-center text-black" onClick={() => handleCellClick(app.name, 0, "Approved or Verified")}>
                          0
                        </td>
                        <td className="border border-gray-300 px-4 py-3 text-center text-black" onClick={() => handleCellClick(app.name, 0, "System Approved")}>
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
            <div className="flex items-center gap-2 w-full">
              <button
                onClick={() => setIsProjectModalOpen(true)}
                className="h-9 flex-1 px-4 rounded bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold"
              >
                + Projects
              </button>
              <button
                onClick={() => setIsApplicationModalOpen(true)}
                className="h-9 flex-1 px-4 rounded bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold"
              >
                + Applications
              </button>
            </div>
            <div className="bg-white rounded-lg border border-gray-300 p-4">
              <h3 className="text-lg font-semibold text-black mb-4">Announcements</h3>
              <div className="space-y-4">
                {ANNOUNCEMENTS.map((announcement, index) => (
                  <div
                    key={index}
                    className="bg-gray-100 border border-gray-300 rounded p-3 text-sm text-gray-700"
                  >
                    {announcement}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      <SiteFooter />

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
          applications={draftApplicationsByType[selectedDraftApp.appType] || []}
          onDeleteApplication={handleDeleteApplication}
          onOpenApplicationDetails={handleOpenApplicationDetails}
        />
      )}
    </div>
  );
}

export default function UserDashboardPage() {
  return (
    <Suspense fallback={
      <div className="h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    }>
      <UserDashboardContent />
    </Suspense>
  );
}
