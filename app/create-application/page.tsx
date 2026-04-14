"use client";

import React, { useState, useEffect, useRef, Suspense } from "react";
import { useRouter } from "next/navigation";
import DashboardHeader from "../components/DashboardHeader";
import CustomSelect from "@/app/components/CustomSelect";
import SiteFooter from "../components/SiteFooter";
import { supabase } from "@/app/utils/supabase";

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
];

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
const sraDepartment = "DP(TDR)";

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

const FlameIcon = () => (
  <svg viewBox="0 0 24 24" className={iconClass}>
    <path d="M12 3s4 4 4 7-1 7-4 7-4-3-4-6 4-8 4-8z" stroke="currentColor" strokeWidth={1.5} fill="none" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M12 21c-.5-1.5-2-3-4-3" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" />
  </svg>
);

const RefundIcon = () => (
  <svg viewBox="0 0 24 24" className={iconClass}>
    <path d="M5 12h6m8 0h-6m0 0 3 3m-3-3 3-3" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" fill="none" />
    <path d="M6 6h6M6 18h6" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" />
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

const permissionLibrary: Record<string, { title: string; description: string; icon: React.ReactNode }> =
  {
    Commencement: {
      title: "Commencement",
      description: "Concession - Building Permission",
      icon: <CheckIcon />,
    },
    Commencement_Other: {
      title: "Commencement (Other)",
      description: "Concession for other application types",
      icon: <CheckIcon />,
    },
    Change_Of_Developer: {
      title: "Change of Developer",
      description: "Update developer information",
      icon: <ClipboardIcon />,
    },
    Change_Of_Architect: {
      title: "Change of Architect",
      description: "Submit architect change request",
      icon: <ClipboardIcon />,
    },
    Common_Completion_Request: {
      title: "Common Completion Request",
      description: "Common completion request form",
      icon: <DocumentIcon />,
    },
    IOD: {
      title: "IOD",
      description: "Intimation of Disapproval",
      icon: <DocumentIcon />,
    },
    LOA: {
      title: "LOA",
      description: "Letter of Acceptance",
      icon: <DocumentIcon />,
    },
    Occupancy: {
      title: "Occupancy",
      description: "For buildings/floors ready to occupy",
      icon: <BuildingIcon />,
    },
    Provisional_Fire_NOC: {
      title: "Provisional Fire NOC",
      description: "Post-application and pre-concession",
      icon: <WarningIcon />,
    },
    CFO_Refund_Process: {
      title: "CFO Refund Process",
      description: "Initiate CFO fee refunds",
      icon: <FlowIcon />,
    },
    Final_Fire_NOC: {
      title: "Final Fire NOC",
      description: "Final fire approval",
      icon: <ShieldIcon />,
    },
    Tree_Cutting_Application: {
      title: "Tree Cutting Application",
      description: "Apply for tree cutting permission",
      icon: <TreeIcon />,
    },
    TDR_Utilization: {
      title: "TDR Utilization",
      description: "Utilize development rights",
      icon: <DocumentIcon />,
    },
    Parking_Layout_Remarks: {
      title: "Parking Layout Remarks",
      description: "Traffic department remarks",
      icon: <RoadIcon />,
    },
    Roads_Planning: {
      title: "Road Planning",
      description: "Road planning remarks",
      icon: <RoadIcon />,
    },
    MHCC_Noc: {
      title: "MHCC NOC",
      description: "Heritage committee approval",
      icon: <DocumentIcon />,
    },
    Sewerage_Remarks: {
      title: "Sewerage Remarks",
      description: "Drainage & sewerage review",
      icon: <WaterIcon />,
    },
    SWD_Internal_Remarks: {
      title: "SWD Internal Remarks",
      description: "Storm water drain review",
      icon: <WavesIcon />,
    },
    Construction_and_Demolition_waste_management_remarks: {
      title: "C&D Waste Remarks",
      description: "Construction & demolition waste management",
      icon: <WarningIcon />,
    },
    Application_for_Insecticide_treatment: {
      title: "Insecticide Treatment",
      description: "Pest control application",
      icon: <ShieldIcon />,
    },
    Permission_for_digging_of_tube_well_or_Bore_well: {
      title: "Tube/Bore Well Permission",
      description: "Permission for tube/bore wells",
      icon: <WaterIcon />,
    },
    New_Assessment_of_plot_of_land: {
      title: "New Land Assessment",
      description: "Assess plot of land",
      icon: <AssessmentIcon />,
    },
    No_Dues_Certificate_against_SAC_numbers: {
      title: "No Dues Certificate",
      description: "Certificate against SAC numbers",
      icon: <DocumentIcon />,
    },
    Application_for_HE_Remarks: {
      title: "HE Remarks",
      description: "Hydraulic engineering remarks",
      icon: <WaterIcon />,
    },
    Hydraulic_Engineer: {
      title: "Hydraulic Engineer",
      description: "Hydraulic engineer requests",
      icon: <WaterIcon />,
    },
    Permanent_Water_Connection: {
      title: "Permanent Water Connection",
      description: "Apply for permanent water connection",
      icon: <WaterIcon />,
    },
    Initial_Application_Mechanical_Ventilation_and_Air_Conditioning: {
      title: "Mechanical Ventilation & AC",
      description: "Initial application for M&E",
      icon: <GearIcon />,
    },
    Highrise_Initial_Application: {
      title: "High-rise Application",
      description: "High-rise initial application",
      icon: <BuildingIcon />,
    },
    Electricity: {
      title: "Electricity",
      description: "Electricity department requests",
      icon: <NetworkIcon />,
    },
    Survey: {
      title: "Survey",
      description: "Development plan survey",
      icon: <DocumentIcon />,
    },
    AAI_NOC_for_height_clearance: {
      title: "AAI NOC",
      description: "Airport Authority height clearance",
      icon: <PlaneIcon />,
    },
    Appointment_Letter_for_Architect: {
      title: "Appointment Letter for Architect",
      description: "Upload and manage architect appointment letter",
      icon: <DocumentIcon />,
    },
    Appointment_Letter_for_Fire_Consultant: {
      title: "Appointment Letter for Fire Consultant",
      description: "Upload and manage fire consultant appointment letter",
      icon: <DocumentIcon />,
    },
    Appointment_Letter_for_Plumber: {
      title: "Appointment Letter for Plumber",
      description: "Upload and manage plumber appointment letter",
      icon: <DocumentIcon />,
    },
    Appointment_Letter_for_Town_Planner: {
      title: "Appointment Letter for Town Planner",
      description: "Upload and manage town planner appointment letter",
      icon: <DocumentIcon />,
    },
    Appointment_Letter_for_Structural_Engineer: {
      title: "Appointment Letter for Structural Engineer",
      description: "Upload and manage structural engineer appointment letter",
      icon: <DocumentIcon />,
    },
    Appointment_Letter_for_Environmental_Consultant: {
      title: "Appointment Letter for Environmental Consultant",
      description: "Upload and manage environmental consultant appointment letter",
      icon: <DocumentIcon />,
    },
  };

type PermissionKey = keyof typeof permissionLibrary;

const getPermissionTypesFromKeys = (keys: PermissionKey[]): PermissionType[] =>
  keys
    .map((key) => {
      const config = permissionLibrary[key];
      if (!config) return null;
      return {
        id: key,
        ...config,
      };
    })
    .filter(Boolean) as PermissionType[];

const fallbackPermissionKeys: PermissionKey[] = [
  "Commencement",
  "Commencement_Other",
  "Change_Of_Developer",
  "Change_Of_Architect",
  "Common_Completion_Request",
  "IOD",
  "LOA",
  "Occupancy",
];

const generalPermissionTypes = getPermissionTypesFromKeys(fallbackPermissionKeys);

const departmentPermissionMap: Record<string, PermissionKey[]> = {
  "Building Permission": fallbackPermissionKeys,
  General: [
    "Appointment_Letter_for_Architect",
    "Appointment_Letter_for_Fire_Consultant",
    "Appointment_Letter_for_Plumber",
    "Appointment_Letter_for_Town_Planner",
    "Appointment_Letter_for_Structural_Engineer",
    "Appointment_Letter_for_Environmental_Consultant",
  ],
  Fire: ["Provisional_Fire_NOC", "CFO_Refund_Process", "Final_Fire_NOC"],
  "Traffic and Co-ordination": ["Parking_Layout_Remarks"],
  "Solid Waste Management": ["Construction_and_Demolition_waste_management_remarks"],
  "Assessment and Collection Dept": [
    "New_Assessment_of_plot_of_land",
    "No_Dues_Certificate_against_SAC_numbers",
  ],
  "Storm Water Drain (Internal)": ["SWD_Internal_Remarks"],
  "Garden (Tree)": ["Tree_Cutting_Application"],
  "Road Planning": ["Roads_Planning"],
  "Mechanical & Electrical": ["Initial_Application_Mechanical_Ventilation_and_Air_Conditioning"],
  "Hydraulic Engineering": [
    "Application_for_HE_Remarks",
    "Hydraulic_Engineer",
    "Permanent_Water_Connection",
  ],
  "Pest Control": [
    "Application_for_Insecticide_treatment",
    "Permission_for_digging_of_tube_well_or_Bore_well",
  ],
  Sewerage: ["Sewerage_Remarks"],
  "High Rise Building Commitee": ["Highrise_Initial_Application"],
  "Mumbai Heritage Conservation Committee": ["MHCC_Noc"],
  "Development Plan": ["Survey"],
  Electricity: ["Electricity"],
  "DP(TDR)": ["TDR_Utilization"],
  "Airport Authority of India": ["AAI_NOC_for_height_clearance"],
};

const getDepartmentPermissions = (department: string) => {
  const keys = departmentPermissionMap[department];
  if (!keys) {
    return generalPermissionTypes;
  }
  return getPermissionTypesFromKeys(keys);
};

const proposalSubmissionOptions = [
  "Plan Approval Only",
  "Concessions",
  "IOD (Zero FSI/ Without Concession)",
  "LOA (Without Concession)",
  "Other",
];

const noticeOptions = [
  "Commencement Notice",
  "Revised Commencement",
  "Plinth Completion",
  "Occupancy",
];

const majorUseOptions = ["Residential", "Commercial", "Industrial", "Mixed Use"];

const applicationTypeOptions = [
  "New Proposal",
  "Amended Proposal",
  "Revalidation",
  "Completion",
];

const tdrPermissionTypes: PermissionType[] = [
  {
    id: "tdr-stage-1",
    title: "TDR Stage I",
    description: "TDR Stage I (Letter of Intent)",
    icon: (
      <svg viewBox="0 0 24 24" className="h-8 w-8 text-gray-500">
        <rect x="5" y="5" width="14" height="14" stroke="currentColor" strokeWidth={1.5} fill="none" />
        <path d="M5 12h14M12 5v14" stroke="currentColor" strokeWidth={1.5} />
      </svg>
    ),
  },
  {
    id: "tdr-stage-2",
    title: "TDR Stage II",
    description: "TDR Stage II (Possession)",
    icon: (
      <svg viewBox="0 0 24 24" className="h-8 w-8 text-gray-500">
        <rect x="5" y="5" width="14" height="14" stroke="currentColor" strokeWidth={1.5} fill="none" />
        <path d="M5 12h14M12 5v7" stroke="currentColor" strokeWidth={1.5} />
      </svg>
    ),
  },
  {
    id: "tdr-stage-3",
    title: "TDR Stage III",
    description: "TDR Stage III (DRC)",
    icon: (
      <svg viewBox="0 0 24 24" className="h-8 w-8 text-gray-500">
        <rect x="5" y="5" width="14" height="14" stroke="currentColor" strokeWidth={1.5} fill="none" />
        <path d="M5 12h7M12 5v14" stroke="currentColor" strokeWidth={1.5} />
      </svg>
    ),
  },
  {
    id: "tdr-transfer",
    title: "TDR Transfer",
    description: "Transfer of DRC",
    icon: (
      <svg viewBox="0 0 24 24" className="h-8 w-8 text-gray-500">
        <rect x="5" y="5" width="14" height="14" stroke="currentColor" strokeWidth={1.5} fill="none" />
        <path d="M8 8h4M12 8v4M16 16l3-3-3-3M8 12h6" stroke="currentColor" strokeWidth={1.5} />
      </svg>
    ),
  },
];

const sraPermissionTypes: PermissionType[] = [
  {
    id: "tdr-utilization",
    title: "TDR Utilization",
    description: "TDR Utilization",
    icon: (
      <svg viewBox="0 0 24 24" className="h-8 w-8 text-gray-500">
        <rect x="5" y="5" width="14" height="14" stroke="currentColor" strokeWidth={1.5} fill="none" />
        <path d="M5 12h7M12 5v7M12 12h7M12 12v7" stroke="currentColor" strokeWidth={1.5} />
      </svg>
    ),
  },
];

const bmcTdrPermissionTypes: PermissionType[] = [
  {
    id: "tdr-stage-3",
    title: "TDR Stage III",
    description: "TDR Stage III (DRC)",
    icon: (
      <svg viewBox="0 0 24 24" className="h-8 w-8 text-gray-500">
        <rect x="5" y="5" width="14" height="14" stroke="currentColor" strokeWidth={1.5} fill="none" />
        <path d="M5 12h7M12 5v14" stroke="currentColor" strokeWidth={1.5} />
      </svg>
    ),
  },
  {
    id: "tdr-transfer",
    title: "TDR Transfer",
    description: "Transfer of DRC",
    icon: (
      <svg viewBox="0 0 24 24" className="h-8 w-8 text-gray-500">
        <rect x="5" y="5" width="14" height="14" stroke="currentColor" strokeWidth={1.5} fill="none" />
        <path d="M8 8h4M12 8v4M16 16l3-3-3-3M8 12h6" stroke="currentColor" strokeWidth={1.5} />
      </svg>
    ),
  },
];

const authorityPermissions: Record<string, PermissionType[]> = {
  default: generalPermissionTypes,
  "mcgm-tdr": tdrPermissionTypes,
  "mcgm-tdr-sra": sraPermissionTypes,
  "bmc-tdr": bmcTdrPermissionTypes,
};

export default function CreateApplicationPage() {
  const router = useRouter();
  const [sessionTime, setSessionTime] = useState(3600);
  const [selectedAuthority, setSelectedAuthority] = useState("bmc");
  const [selectedProject, setSelectedProject] = useState("");
  const [projects, setProjects] = useState<
    {
      id: string;
      title: string;
      project_info?: { proposalNo?: string } | null;
      save_plot_details?: { planningAuthority?: string } | null;
    }[]
  >([]);
  const [projectSearchQuery, setProjectSearchQuery] = useState("");

  useEffect(() => {
    const loadProjects = async () => {
      const { data: authData } = await supabase.auth.getUser();
      const userId = authData?.user?.id;
      if (!userId) return;

      const { data, error } = await supabase
        .from("projects")
        .select("id,title,project_info,save_plot_details")
        .eq("user_id", userId)
        .eq("status", "submitted")
        .order("created_at", { ascending: false });

      if (!error && data) {
        setProjects(data);
      }
    };
    loadProjects();
  }, []);
  const [projectDropdownOpen, setProjectDropdownOpen] = useState(false);
  const projectDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!projectDropdownOpen) return;
    const onClickOutside = (e: MouseEvent) => {
      if (projectDropdownRef.current && !projectDropdownRef.current.contains(e.target as Node)) {
        setProjectDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [projectDropdownOpen]);

  const authorityLabelMap: Record<string, string> = {
    bmc: "BMC",
    sra: "SRA",
    mhada: "MHADA",
    mmrda: "MMRDA",
  };
  const selectedAuthorityLabel = authorityLabelMap[selectedAuthority];
  const getProjectDisplayData = (project: {
    title: string;
    project_info?: { proposalNo?: string } | null;
  }) => {
    const detectedProposalNo = project.title.match(/\s(\d{3,})$/)?.[1];
    const proposalNo = project.project_info?.proposalNo?.trim() || detectedProposalNo;
    const cleanTitle =
      proposalNo && project.title.endsWith(` ${proposalNo}`)
        ? project.title.slice(0, -(proposalNo.length + 1))
        : project.title;
    const highlightedPart = proposalNo ? `(${proposalNo})` : undefined;
    return {
      label: proposalNo ? `${cleanTitle} ${highlightedPart}` : cleanTitle,
      highlightedPart,
    };
  };
  const filteredProjects = projects.filter(
    (project) =>
      project.save_plot_details?.planningAuthority?.toUpperCase() === selectedAuthorityLabel
  );
  const selectedProjectTitle =
    getProjectDisplayData(
      filteredProjects.find((project) => project.id === selectedProject) || { title: "" }
    ).label || "";
  const selectedProjectHighlightedPart =
    getProjectDisplayData(
      filteredProjects.find((project) => project.id === selectedProject) || { title: "" }
    ).highlightedPart;
  const filteredProjectOptions = filteredProjects.filter((project) =>
    project.title.toLowerCase().includes(projectSearchQuery.trim().toLowerCase())
  );

  useEffect(() => {
    if (selectedProject && !filteredProjects.some((project) => project.id === selectedProject)) {
      setSelectedProject("");
    }
  }, [filteredProjects, selectedProject]);

  const [selectedDepartment, setSelectedDepartment] = useState(departments[0]);
  const [selectedPermission, setSelectedPermission] = useState<string | null>(null);
  const [proposalSubmission, setProposalSubmission] = useState(
    proposalSubmissionOptions[0]
  );
  const [typeOfNotice, setTypeOfNotice] = useState("");
  const [proposedApplication, setProposedApplication] = useState("");
  const [majorUse, setMajorUse] = useState("");
  const [applicationType, setApplicationType] = useState("");
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [modalMessage, setModalMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [existingPermissionTypes, setExistingPermissionTypes] = useState<string[]>([]);

  const handleProceed = async () => {
    if (!selectedProject || !selectedPermission) return;

    const selectedProjectRecord = filteredProjects.find((project) => project.id === selectedProject);
    const selectedPermissionRecord = permissionTypes.find(
      (permission) => permission.id === selectedPermission
    );

    if (!selectedProjectRecord || !selectedPermissionRecord) {
      alert("Please select a valid project and permission type.");
      return;
    }

    setIsSubmitting(true);
    const { error } = await supabase.from("applications").insert({
      project_id: selectedProjectRecord.id,
      project_title: selectedProjectRecord.title,
      department: selectedDepartment,
      permission_type: selectedPermissionRecord.title,
    });
    setIsSubmitting(false);

    if (error) {
      // Postgres unique violation code: duplicate permission type for same project.
      if (error.code === "23505") {
        setModalMessage(
          "This permission type is already added for the selected project. Please choose a different permission type."
        );
        setShowInfoModal(true);
        return;
      }

      alert("Failed to create application. Please try again.");
      return;
    }

    setModalMessage("Application created successfully.");
    setShowInfoModal(true);
  };

  const handleModalOk = () => {
    setShowInfoModal(false);
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

  useEffect(() => {
    setSelectedPermission(null);
    setProposalSubmission(proposalSubmissionOptions[0]);
    setTypeOfNotice("");
    setProposedApplication("");
    setMajorUse("");
    setApplicationType("");
  }, [selectedAuthority, selectedDepartment]);

  useEffect(() => {
    if (!departments.includes(selectedDepartment)) {
      setSelectedDepartment(departments[0]);
    }
  }, [selectedAuthority, selectedDepartment]);

  useEffect(() => {
    const loadExistingPermissions = async () => {
      if (!selectedProject) {
        setExistingPermissionTypes([]);
        return;
      }

      const { data, error } = await supabase
        .from("applications")
        .select("permission_type")
        .eq("project_id", selectedProject)
        .eq("department", selectedDepartment);

      if (error) {
        console.error("Error loading existing permissions:", error);
        setExistingPermissionTypes([]);
        return;
      }

      setExistingPermissionTypes(
        (data ?? []).map((row: { permission_type: string }) => row.permission_type)
      );
    };

    loadExistingPermissions();
  }, [selectedProject, selectedDepartment]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const handlePermissionCardClick = (id: string) => {
    setSelectedPermission((prev) => (prev === id ? null : id));
  };

  const permissionTypes = getDepartmentPermissions(selectedDepartment);
  const showDepartment = true;
  const departmentOptions = [...departments].sort((a, b) => a.localeCompare(b));
  const showBuildingPermissionFields = selectedDepartment === "Building Permission";

  useEffect(() => {
    if (!selectedPermission) return;
    const selectedPermissionTitle = permissionTypes.find(
      (permission) => permission.id === selectedPermission
    )?.title;
    if (selectedPermissionTitle && existingPermissionTypes.includes(selectedPermissionTitle)) {
      setSelectedPermission(null);
    }
  }, [existingPermissionTypes, permissionTypes, selectedPermission]);

  const inputClasses =
    "border border-gray-200 rounded-xl px-3 py-2 h-10 w-full text-gray-900 bg-white focus:ring-2 focus:ring-emerald-500 outline-none";

  return (
    <div className="h-screen bg-gray-100 flex flex-col overflow-hidden">
      <div className="p-4 md:p-6 shrink-0">
        <Suspense fallback={<div className="h-16 bg-white border border-gray-200 rounded-3xl"></div>}>
          <DashboardHeader sessionTime={formatTime(sessionTime)} />
        </Suspense>
      </div>

      <div className="px-4 md:px-6 pb-4 md:pb-6 flex-1 min-h-0 overflow-hidden">
        <div className="h-full w-full rounded-3xl bg-white shadow-sm border border-gray-200 overflow-hidden flex flex-col">
          <div className="flex flex-1 min-h-0 bg-gray-50">
            <div className="p-4 md:p-6 flex flex-1 min-h-0 overflow-hidden">
              <main className="flex-1 min-h-0 overflow-y-auto rounded-2xl bg-white border border-gray-200 shadow-sm px-4 md:px-6 py-6">
                <div className="max-w-5xl mx-auto px-6 pt-8 space-y-6">
                  <section className="border border-gray-200 rounded-2xl p-6 bg-white shadow-sm">
                    <div className="border-b border-gray-200 pb-4 mb-6">
                      <h2 className="text-xl font-bold text-black">Create New Application</h2>
                      <p className="text-sm text-black mt-1">
                        Fill in the details below to start a new application for your project.
                      </p>
                    </div>

                    <div className="space-y-6">
                      <div>
                        <label className="block font-medium text-black mb-1">
                          Who is planning authority for the project?
                        </label>
                        <div className="flex flex-wrap gap-4">
                          {planningAuthorities.map((authority) => (
                            <label
                              key={authority.id}
                              className="flex items-center gap-2 text-sm text-black"
                            >
                              <input
                                type="radio"
                                name="planning-authority"
                                checked={selectedAuthority === authority.id}
                                onChange={() => setSelectedAuthority(authority.id)}
                                className="w-4 h-4 text-emerald-600 focus:ring-emerald-500"
                              />
                              {authority.label}
                            </label>
                          ))}
                        </div>
                      </div>

                      <div className={`grid gap-4 ${showDepartment ? "md:grid-cols-2" : "md:grid-cols-1"}`}>
                        <div ref={projectDropdownRef} className="relative">
                          <label className="block font-medium text-black mb-1">
                            Project
                          </label>
                          <button
                            type="button"
                            onClick={() => setProjectDropdownOpen((prev) => !prev)}
                            className={`${inputClasses} text-left flex items-center justify-between gap-2 h-auto min-h-[40px] py-2`}
                          >
                            <span className={`${selectedProject ? "text-gray-900" : "text-gray-400"} break-words text-left leading-snug`}>
                              {selectedProject ? (
                                selectedProjectHighlightedPart &&
                                selectedProjectTitle.includes(selectedProjectHighlightedPart) ? (
                                  <>
                                    <span>
                                      {selectedProjectTitle.split(selectedProjectHighlightedPart, 2)[0]}
                                    </span>
                                    <span className="text-black font-semibold">
                                      {selectedProjectHighlightedPart}
                                    </span>
                                    <span>
                                      {selectedProjectTitle.split(selectedProjectHighlightedPart, 2)[1]}
                                    </span>
                                  </>
                                ) : (
                                  selectedProjectTitle
                                )
                              ) : (
                                "Select Project"
                              )}
                            </span>
                            <svg className={`w-4 h-4 shrink-0 text-gray-400 transition-transform ${projectDropdownOpen ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                          </button>
                          {projectDropdownOpen && (
                            <div className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-lg max-h-60 overflow-y-auto">
                              <div className="sticky top-0 z-10 bg-white p-2 border-b border-gray-100">
                                <input
                                  type="text"
                                  value={projectSearchQuery}
                                  onChange={(event) => setProjectSearchQuery(event.target.value)}
                                  placeholder="Search project"
                                  className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:ring-emerald-500 outline-none"
                                />
                              </div>
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedProject("");
                                  setProjectDropdownOpen(false);
                                  setProjectSearchQuery("");
                                }}
                                className="w-full text-left px-3 py-2 text-sm text-gray-400 hover:bg-gray-50"
                              >
                                Select Project
                              </button>
                              {filteredProjectOptions.map((project) => (
                                <button
                                  key={project.id}
                                  type="button"
                                  onClick={() => {
                                    setSelectedProject(project.id);
                                    setProjectDropdownOpen(false);
                                    setProjectSearchQuery("");
                                  }}
                                  className={`w-full text-left px-3 py-2 text-sm hover:bg-emerald-50 break-words leading-snug ${
                                    selectedProject === project.id ? "bg-emerald-50 text-emerald-700 font-medium" : "text-gray-900"
                                  }`}
                                >
                                  {(() => {
                                    const display = getProjectDisplayData(project);
                                    if (!display.highlightedPart || !display.label.includes(display.highlightedPart)) {
                                      return display.label;
                                    }
                                    const [prefix, suffix] = display.label.split(display.highlightedPart, 2);
                                    return (
                                      <>
                                        <span>{prefix}</span>
                                        <span className="text-emerald-700 font-semibold">{display.highlightedPart}</span>
                                        <span>{suffix}</span>
                                      </>
                                    );
                                  })()}
                                </button>
                              ))}
                              {filteredProjects.length === 0 && (
                                <div className="px-3 py-2 text-sm text-gray-500">
                                  No submitted projects for selected authority
                                </div>
                              )}
                              {filteredProjects.length > 0 && filteredProjectOptions.length === 0 && (
                                <div className="px-3 py-2 text-sm text-gray-500">
                                  No projects match your search
                                </div>
                              )}
                            </div>
                          )}
                        </div>

                        {showDepartment && (
                          <div>
                            <label htmlFor="department" className="block font-medium text-black mb-1">
                              Select Department
                            </label>
                            <CustomSelect
                              id="department"
                              value={selectedDepartment}
                              onChange={(val) => setSelectedDepartment(val)}
                              options={departmentOptions.map((department) => ({
                                value: department,
                                label: department,
                              }))}
                            />
                          </div>
                        )}
                      </div>

                      <div>
                        <p className="block font-medium text-black mb-1">Permission Type</p>
                        <p className="text-xs text-gray-500 mb-4">
                          Select the type of permission you want to apply for
                        </p>
                        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                          {permissionTypes.map((type) => {
                            const isAlreadyCreated =
                              selectedProject && existingPermissionTypes.includes(type.title);

                            return (
                            <button
                              key={type.id}
                              type="button"
                              onClick={() => {
                                if (isAlreadyCreated) {
                                  setModalMessage(
                                    "This permission type is already created for the selected project."
                                  );
                                  setShowInfoModal(true);
                                  return;
                                }
                                handlePermissionCardClick(type.id);
                              }}
                              className={`h-full rounded-2xl border px-4 py-5 text-left transition ${
                                selectedPermission === type.id
                                  ? "border-emerald-500 bg-emerald-50"
                                  : isAlreadyCreated
                                  ? "border-gray-200 bg-gray-100 opacity-70 cursor-not-allowed"
                                  : "border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm"
                              }`}
                            >
                              <div className="mb-4 flex items-center justify-center">{type.icon}</div>
                              <p className="text-sm font-semibold text-black">{type.title}</p>
                              <p className="text-xs text-gray-500 mt-2">{type.description}</p>
                              {isAlreadyCreated && (
                                <p className="text-xs font-medium text-amber-700 mt-2">
                                  Already added for this project
                                </p>
                              )}
                            </button>
                          )})}
                        </div>
                      </div>

                      {showBuildingPermissionFields && (
                        <div className="space-y-6 rounded-2xl border border-gray-200 bg-gray-50 p-5">
                          <div>
                            <p className="block font-medium text-black mb-3">
                              Proposal Submission For -
                            </p>
                            <div className="flex flex-wrap gap-4">
                              {proposalSubmissionOptions.map((option) => (
                                <label key={option} className="flex items-center gap-2 text-sm text-black">
                                  <input
                                    type="radio"
                                    name="proposal-submission"
                                    value={option}
                                    checked={proposalSubmission === option}
                                    onChange={() => setProposalSubmission(option)}
                                    className="h-4 w-4 text-emerald-600 focus:ring-emerald-500"
                                  />
                                  {option}
                                </label>
                              ))}
                            </div>
                          </div>

                          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                            <div>
                              <label className="block font-medium text-black mb-1">Type of Notice</label>
                              <CustomSelect
                                value={typeOfNotice}
                                onChange={(val) => setTypeOfNotice(val)}
                                options={noticeOptions.map((option) => ({
                                  value: option,
                                  label: option,
                                }))}
                                placeholder="Select"
                              />
                            </div>

                            <div>
                              <label className="block font-medium text-black mb-1">Proposed Application</label>
                              <input
                                type="text"
                                value={proposedApplication}
                                onChange={(event) => setProposedApplication(event.target.value)}
                                placeholder="Enter proposal reference"
                                className={inputClasses}
                              />
                            </div>

                            <div>
                              <label className="block font-medium text-black mb-1">Major Use of Plot</label>
                              <CustomSelect
                                value={majorUse}
                                onChange={(val) => setMajorUse(val)}
                                options={majorUseOptions.map((option) => ({
                                  value: option,
                                  label: option,
                                }))}
                                placeholder="Select"
                                className={inputClasses}
                              />
                            </div>

                            <div>
                              <label className="block font-medium text-black mb-1">Application Type</label>
                              <CustomSelect
                                value={applicationType}
                                onChange={(val) => setApplicationType(val)}
                                options={applicationTypeOptions.map((option) => ({
                                  value: option,
                                  label: option,
                                }))}
                                placeholder="Select"
                              />
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </section>

                  <div className="flex justify-end gap-3 pb-6">
                    <button
                      type="button"
                      className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      className="rounded-xl bg-emerald-600 px-5 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:bg-emerald-300 transition-colors"
                      disabled={
                        isSubmitting ||
                        !selectedProject ||
                        !selectedPermission ||
                        (showBuildingPermissionFields &&
                          (!typeOfNotice || !proposedApplication || !majorUse || !applicationType))
                      }
                      onClick={handleProceed}
                    >
                      {isSubmitting ? "Submitting..." : "Proceed"}
                    </button>
                  </div>
                </div>
              </main>
            </div>
          </div>
        </div>
      </div>

      {showInfoModal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl w-[500px] overflow-hidden">
            <div className="bg-emerald-600 px-6 py-3">
              <h3 className="text-white text-lg font-semibold">Information</h3>
            </div>
            <div className="px-6 py-6">
              <p className="text-gray-800 text-sm">
                {modalMessage}
              </p>
            </div>
            <div className="px-6 py-4 flex justify-end border-t border-gray-200">
              <button
                onClick={handleModalOk}
                className="px-6 py-2 bg-white border border-gray-200 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="shrink-0">
        <SiteFooter />
      </div>
    </div>
  );
}

