"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import DashboardHeader from "../components/DashboardHeader";
import SiteFooter from "../components/SiteFooter";

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
  { id: "mcgm-bp", label: "MCGM(BP)" },
  { id: "other", label: "Other" },
  { id: "mcgm-tdr", label: "MCGM-TDR Generation & Transfer" },
  { id: "mcgm-tdr-sra", label: "MCGM-TDR SRA Utilization" },
  { id: "bmc-tdr", label: "BMC-TDR Generation and Transfer (SRA/MMRDA/Dharavi Redevelopment Project/BMC-Improvement)" },
];

const projects = [
  { id: "project-1", name: "Siddhi Heights Redevelopment" },
  { id: "project-2", name: "Green Meadows Township" },
  { id: "project-3", name: "Lotus Residency Phase II" },
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
  const [selectedAuthority, setSelectedAuthority] = useState(planningAuthorities[0].id);
  const [selectedProject, setSelectedProject] = useState("");
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

  const handleProceed = () => {
    setShowInfoModal(true);
  };

  const handleModalOk = () => {
    setShowInfoModal(false);
    router.push(`/userdashboard?department=${encodeURIComponent(selectedDepartment)}`);
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
    if (selectedAuthority === "mcgm-tdr-sra") {
      setSelectedDepartment(sraDepartment);
    } else if (!departments.includes(selectedDepartment)) {
      setSelectedDepartment(departments[0]);
    }
  }, [selectedAuthority, selectedDepartment]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const handlePermissionCardClick = (id: string) => {
    setSelectedPermission((prev) => (prev === id ? null : id));
  };

  const isDepartmentDrivenAuthority = selectedAuthority === "mcgm-bp" || selectedAuthority === "other";
  const permissionTypes = isDepartmentDrivenAuthority
    ? getDepartmentPermissions(selectedDepartment)
    : authorityPermissions[selectedAuthority] ?? authorityPermissions.default;
  const showDepartment = !["mcgm-tdr", "bmc-tdr"].includes(selectedAuthority);
  const departmentOptions =
    selectedAuthority === "mcgm-tdr-sra" ? [sraDepartment] : departments;
  const showBuildingPermissionFields =
    isDepartmentDrivenAuthority && selectedDepartment === "Building Permission";

  return (
    <div className="h-screen bg-gray-50 flex flex-col overflow-hidden">
      <DashboardHeader sessionTime={formatTime(sessionTime)} />

      <div className="flex-1 overflow-y-auto bg-gray-100">
        <div className="max-w-5xl mx-auto px-6 pt-8 pb-12 space-y-6">
          <section className="border border-gray-300 rounded-lg bg-white flex flex-col shadow-sm">
            <div className="border-b border-gray-200 px-6 py-4 bg-white">
              <h2 className="text-xl font-semibold text-gray-900">Create New Application</h2>
              <p className="text-sm text-gray-600 mt-1">
                Fill in the details below to start a new application for your project.
              </p>
            </div>

            <div className="p-6 space-y-8">
              <div>
                <p className="text-sm font-semibold text-gray-900 mb-4">
                  Who is planning authority for the project?
                </p>
                <div className="grid gap-3 md:grid-cols-3">
                  {planningAuthorities.map((authority) => (
                    <label
                      key={authority.id}
                      className={`flex items-center gap-3 rounded-lg border px-4 py-3 text-sm ${
                        selectedAuthority === authority.id
                          ? "border-blue-500 bg-blue-50 text-blue-900"
                          : "border-gray-200 bg-white text-gray-800"
                      }`}
                    >
                      <input
                        type="radio"
                        name="planning-authority"
                        checked={selectedAuthority === authority.id}
                        onChange={() => setSelectedAuthority(authority.id)}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500"
                      />
                      <span>{authority.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className={`grid gap-6 ${showDepartment ? "md:grid-cols-2" : "md:grid-cols-1"}`}>
                <div className="flex flex-col gap-2">
                  <label htmlFor="project" className="text-sm font-semibold text-gray-900">
                    Project
                  </label>
                  <select
                    id="project"
                    value={selectedProject}
                    onChange={(event) => setSelectedProject(event.target.value)}
                    className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="">Select Project</option>
                    {projects.map((project) => (
                      <option key={project.id} value={project.id}>
                        {project.name}
                      </option>
                    ))}
                  </select>
                </div>

                {showDepartment && (
                  <div className="flex flex-col gap-2">
                    <label htmlFor="department" className="text-sm font-semibold text-gray-900">
                      Select Department
                    </label>
                    <select
                      id="department"
                      value={selectedDepartment}
                      onChange={(event) => setSelectedDepartment(event.target.value)}
                      className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    >
                      {departmentOptions.map((department) => (
                        <option key={department} value={department}>
                          {department}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              <div>
                <p className="text-sm font-semibold text-gray-900 mb-2">Permission Type</p>
                <p className="text-xs text-gray-500 mb-4">
                  Select the type of permission you want to apply for
                </p>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {permissionTypes.map((type) => (
                    <button
                      key={type.id}
                      type="button"
                      onClick={() => handlePermissionCardClick(type.id)}
                      className={`h-full rounded-lg border px-4 py-5 text-left transition ${
                        selectedPermission === type.id
                          ? "border-blue-500 bg-blue-50"
                          : "border-gray-200 bg-gray-50 hover:border-gray-300"
                      }`}
                    >
                      <div className="mb-4 flex items-center justify-center">{type.icon}</div>
                      <p className="text-sm font-semibold text-gray-900">{type.title}</p>
                      <p className="text-xs text-gray-500 mt-2">{type.description}</p>
                    </button>
                  ))}
                </div>
              </div>

              {showBuildingPermissionFields && (
                <div className="space-y-6 rounded-lg border border-gray-200 bg-gray-50 p-5">
                  <div>
                    <p className="text-sm font-semibold text-gray-900 mb-3">
                      Proposal Submission For -
                    </p>
                    <div className="flex flex-wrap gap-4">
                      {proposalSubmissionOptions.map((option) => (
                        <label key={option} className="flex items-center gap-2 text-sm text-gray-800">
                          <input
                            type="radio"
                            name="proposal-submission"
                            value={option}
                            checked={proposalSubmission === option}
                            onChange={() => setProposalSubmission(option)}
                            className="h-4 w-4 text-blue-600 focus:ring-blue-500"
                          />
                          {option}
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
                    <div className="flex flex-col gap-2">
                      <label className="text-sm font-semibold text-gray-900">Type of Notice</label>
                      <select
                        value={typeOfNotice}
                        onChange={(event) => setTypeOfNotice(event.target.value)}
                        className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      >
                        <option value="">Select</option>
                        {noticeOptions.map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="flex flex-col gap-2">
                      <label className="text-sm font-semibold text-gray-900">Proposed Application</label>
                      <input
                        type="text"
                        value={proposedApplication}
                        onChange={(event) => setProposedApplication(event.target.value)}
                        placeholder="Enter proposal reference"
                        className="rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </div>

                    <div className="flex flex-col gap-2">
                      <label className="text-sm font-semibold text-gray-900">Major Use of Plot</label>
                      <select
                        value={majorUse}
                        onChange={(event) => setMajorUse(event.target.value)}
                        className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      >
                        <option value="">Select</option>
                        {majorUseOptions.map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="flex flex-col gap-2">
                      <label className="text-sm font-semibold text-gray-900">Application Type</label>
                      <select
                        value={applicationType}
                        onChange={(event) => setApplicationType(event.target.value)}
                        className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      >
                        <option value="">Select</option>
                        {applicationTypeOptions.map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </section>

          <div className="flex justify-end gap-3">
            <button
              type="button"
              className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-white"
            >
              Cancel
            </button>
            <button
              type="button"
              className="rounded-md bg-blue-600 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:bg-blue-300"
              disabled={
                !selectedProject ||
                !selectedPermission ||
                (showBuildingPermissionFields &&
                  (!typeOfNotice || !proposedApplication || !majorUse || !applicationType))
              }
              onClick={handleProceed}
            >
              Proceed
            </button>
          </div>
        </div>
      </div>

      {/* Information Modal */}
      {showInfoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-lg shadow-xl w-[500px] overflow-hidden">
            {/* Modal Header */}
            <div className="bg-[#4A9BD9] px-6 py-3">
              <h3 className="text-white text-lg font-medium">Information</h3>
            </div>
            
            {/* Modal Body */}
            <div className="px-6 py-6">
              <p className="text-gray-800 text-sm">
                Dear Applicant, You have already created new for selected application for this project
              </p>
            </div>
            
            {/* Modal Footer */}
            <div className="px-6 py-4 flex justify-end border-t border-gray-200">
              <button
                onClick={handleModalOk}
                className="px-6 py-2 bg-white border border-gray-300 rounded text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}

      <SiteFooter />
    </div>
  );
}

