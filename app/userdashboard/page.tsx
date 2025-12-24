"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import DashboardHeader from "../components/DashboardHeader";
import SiteFooter from "../components/SiteFooter";
import DraftApplicationsModal, { DraftApplication } from "../components/DraftApplicationsModal";
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
    name: "Acceptance by Consultant",
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
    name: "Architect Licensed Surveyor",
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
    name: "Fire Safety Consultant",
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
    name: "Horticulturist",
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
    name: "M&E Consultant",
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
    name: "Parking Consultant",
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
    name: "Plumber",
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
    name: "Rain Water Consultant",
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
    name: "Site Supervisor",
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
    name: "Structural Engineer",
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
    name: "Development Completion Certificate",
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
    name: "Notice for Start of Work",
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
    name: "Owners Plot Area Affidavit",
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
    name: "Plot Area Certificate",
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
    name: "Supervision Memo of Architect",
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
  "All Developers/Architects who have uploaded the valid C& D transport approval in the AutoDCR for IOD/CC/OCC etc. after 15th March 2018 or auto generated the C& D approval from system, then they must upload the details of transportation of C& D waste in AutoDCR portal by 04/Aug/2018.",
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
  projects?: { id: string; title: string }[];
}

const ApplicationModal: React.FC<ApplicationModalProps> = ({ open, onClose, items, title, projects = [] }) => {
  const router = useRouter();
  const [showProjectDropdownIndex, setShowProjectDropdownIndex] = useState<number | null>(null);
  const [selectedProjectForEdit, setSelectedProjectForEdit] = useState<string>("");

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
                          <select
                            value={selectedProjectForEdit}
                            onChange={(e) => {
                              setSelectedProjectForEdit(e.target.value);
                              if (e.target.value) {
                                handleProjectSelect(e.target.value);
                              }
                            }}
                            className="w-full border border-gray-300 rounded px-3 py-2 text-sm text-black bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                          >
                            <option value="">-- Select Project --</option>
                            {projects.map((project) => (
                              <option key={project.id} value={project.id}>
                                {project.title}
                              </option>
                            ))}
                          </select>
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
  const [activeTab, setActiveTab] = useState("tile-view");
  // Project filter: "ALL" means don't filter
  const [selectedProject, setSelectedProject] = useState("ALL");
  const [projects, setProjects] = useState<{ id: string; title: string }[]>([]);
  const [projectsLoading, setProjectsLoading] = useState(false);
  const [selectedApplicationType, setSelectedApplicationType] = useState("Building Permission");
  const [sessionTime, setSessionTime] = useState(3600); // 60 minutes in seconds
  const [isApplicationModalOpen, setIsApplicationModalOpen] = useState(false);
  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);
  const [isDraftModalOpen, setIsDraftModalOpen] = useState(false);
  const [selectedDraftApp, setSelectedDraftApp] = useState<{ appType: string; status: string } | null>(null);

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
          .select("id,title")
          .eq("user_id", userId)
          .order("created_at", { ascending: false });

        if (error) {
          console.error("Error loading projects:", error);
          setProjects([]);
          return;
        }

        setProjects((data ?? []).map((row: any) => ({ id: row.id, title: row.title })));
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

  return (
    <div className="h-screen bg-gray-50 flex flex-col overflow-hidden">
      <DashboardHeader sessionTime={formatTime(sessionTime)} />
      
      <div className="flex-1 overflow-y-auto bg-gray-100">
        {/* Red Instruction Banner */}
        <div className="w-full bg-red-600 text-white px-6 py-3 text-sm font-medium">
          This is mandatory for all Architect/LS to fill up Building construction activity details twice a month (1st to 15th & 16th to 31st) and upload site photographs and site supervisor report
        </div>

        {/* Main Content */}
        <div className="flex gap-4 p-6">
          {/* Left Content Area */}
          <div className="flex-1 space-y-4">
            {/* Navigation and Filters */}
            <div className="bg-white rounded-lg border border-gray-300 p-4 space-y-4">
              {/* Top Row - Dropdowns and Tabs */}
              <div className="flex flex-wrap items-center gap-4">
                {/* Left Dropdowns */}
                <div className="flex items-center gap-2">
                <div className="flex items-center gap-2">
                  <select
                    value={selectedProject}
                    onChange={(e) => setSelectedProject(e.target.value)}
                    className="border border-black rounded px-3 py-2 text-sm text-black bg-white"
                  >
                      <option value="ALL">All Projects</option>
                      {projects.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.title}
                        </option>
                      ))}
                  </select>

                    {projectsLoading && (
                      <span className="text-xs text-gray-600">Loading projects…</span>
                    )}
                    {!projectsLoading && projects.length === 0 && (
                      <span className="text-xs text-gray-600">No projects found</span>
                    )}
                  </div>
                </div>

                {/* Center Tabs */}
                <div className="flex items-center gap-2 ml-auto">
                  <button
                    onClick={() => setActiveTab("tile-view")}
                    className={`px-4 py-2 rounded text-sm font-medium transition-colors ${
                      activeTab === "tile-view"
                        ? "bg-blue-600 text-white"
                        : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                    }`}
                  >
                    Tile View
                  </button>
                  <button
                    onClick={() => setActiveTab("pie-chart")}
                    className={`px-4 py-2 rounded text-sm font-medium transition-colors ${
                      activeTab === "pie-chart"
                        ? "bg-blue-600 text-white"
                        : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                    }`}
                  >
                    Pie Chart
                  </button>
                  <button
                    onClick={() => setActiveTab("air-pollution")}
                    className={`px-4 py-2 rounded text-sm font-medium transition-colors ${
                      activeTab === "air-pollution"
                        ? "bg-blue-600 text-white"
                        : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                    }`}
                  >
                    Air Pollution Control Application List
                  </button>
                </div>

                {/* Dropdown and Buttons Row */}
                <div className="flex items-center justify-between w-full">
                  {/* Left - Department Dropdown */}
                  <select
                    value={selectedApplicationType}
                    onChange={(e) => setSelectedApplicationType(e.target.value)}
                    className="border border-black rounded px-3 py-2 text-sm text-black bg-white"
                  >
                    {departments.map((department) => (
                      <option key={department} value={department}>
                        {department}
                      </option>
                    ))}
                  </select>

                  {/* Right - 4 Buttons */}
                  <div className="flex items-center gap-2">
                    <button className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded text-sm font-medium">
                      Go
                    </button>
                    <button
                      onClick={() => setIsProjectModalOpen(true)}
                      className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded text-sm font-medium"
                    >
                      + Projects
                    </button>
                    <button
                      onClick={() => setIsApplicationModalOpen(true)}
                      className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded text-sm font-medium"
                    >
                      + Applications
                    </button>
                    <button
                      onClick={() => router.push("/template")}
                      className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded text-sm font-medium"
                    >
                      Template
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Main Data Table */}
            {activeTab === "tile-view" && (
              <div className="bg-white rounded-lg border border-gray-300 overflow-hidden">
                <div className="overflow-auto max-h-96">
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
                      {(selectedApplicationType === "General" 
                        ? GENERAL_APPLICATION_DATA 
                        : selectedApplicationType === "Development Plan" 
                        ? DEVELOPMENT_PLAN_APPLICATION_DATA 
                        : APPLICATION_DATA).map((app, index) => (
                        <tr key={index} className="hover:bg-gray-50">
                          <td className="border border-gray-300 px-4 py-3 text-left font-medium text-black">
                            {app.name}
                          </td>
                          <td 
                            className={`border border-gray-300 px-4 py-3 text-center ${app.draft && app.draft !== "-" && Number(app.draft) > 0 ? "text-blue-600 cursor-pointer hover:underline font-medium" : "text-black"}`}
                            onClick={() => handleCellClick(app.name, app.draft, "Draft")}
                          >
                            {app.draft}
                          </td>
                          <td 
                            className={`border border-gray-300 px-4 py-3 text-center ${app.duePayment && app.duePayment !== "-" && Number(app.duePayment) > 0 ? "text-blue-600 cursor-pointer hover:underline font-medium" : "text-black"}`}
                            onClick={() => handleCellClick(app.name, app.duePayment, "Due Payment")}
                          >
                            {app.duePayment}
                          </td>
                          <td 
                            className={`border border-gray-300 px-4 py-3 text-center ${app.inProcess && app.inProcess !== "-" && Number(app.inProcess) > 0 ? "text-blue-600 cursor-pointer hover:underline font-medium" : "text-black"}`}
                            onClick={() => handleCellClick(app.name, app.inProcess, "In Process")}
                          >
                            {app.inProcess}
                          </td>
                          <td 
                            className={`border border-gray-300 px-4 py-3 text-center ${app.needClarification && app.needClarification !== "-" && Number(app.needClarification) > 0 ? "text-blue-600 cursor-pointer hover:underline font-medium" : "text-black"}`}
                            onClick={() => handleCellClick(app.name, app.needClarification, "Need Clarification")}
                          >
                            {app.needClarification}
                          </td>
                          <td 
                            className={`border border-gray-300 px-4 py-3 text-center ${app.withdrawn && app.withdrawn !== "-" && Number(app.withdrawn) > 0 ? "text-blue-600 cursor-pointer hover:underline font-medium" : "text-black"}`}
                            onClick={() => handleCellClick(app.name, app.withdrawn, "Withdrawn")}
                          >
                            {app.withdrawn}
                          </td>
                          <td 
                            className={`border border-gray-300 px-4 py-3 text-center ${app.rejectedOrCancelled && app.rejectedOrCancelled !== "-" && Number(app.rejectedOrCancelled) > 0 ? "text-blue-600 cursor-pointer hover:underline font-medium" : "text-black"}`}
                            onClick={() => handleCellClick(app.name, app.rejectedOrCancelled, "Rejected or Cancelled")}
                          >
                            {app.rejectedOrCancelled}
                          </td>
                          <td 
                            className={`border border-gray-300 px-4 py-3 text-center ${app.approvedOrVerified && app.approvedOrVerified !== "-" && Number(app.approvedOrVerified) > 0 ? "text-blue-600 cursor-pointer hover:underline font-medium" : "text-black"}`}
                            onClick={() => handleCellClick(app.name, app.approvedOrVerified, "Approved or Verified")}
                          >
                            {app.approvedOrVerified}
                          </td>
                          <td 
                            className={`border border-gray-300 px-4 py-3 text-center ${app.systemApproved && app.systemApproved !== "-" && Number(app.systemApproved) > 0 ? "text-blue-600 cursor-pointer hover:underline font-medium" : "text-black"}`}
                            onClick={() => handleCellClick(app.name, app.systemApproved, "System Approved")}
                          >
                            {app.systemApproved}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Placeholder for other tabs */}
            {activeTab === "pie-chart" && (
              <div className="bg-white rounded-lg border border-gray-300 p-8 text-center text-gray-600">
                Pie Chart view will be displayed here
              </div>
            )}

            {activeTab === "air-pollution" && (
              <div className="bg-white rounded-lg border border-gray-300 p-8 text-center text-gray-600">
                Air Pollution Control Application List will be displayed here
              </div>
            )}
          </div>

          {/* Right Sidebar - Announcements */}
          <div className="w-80 space-y-4">
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
          applications={DRAFT_APPLICATIONS[selectedDraftApp.appType] || []}
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
