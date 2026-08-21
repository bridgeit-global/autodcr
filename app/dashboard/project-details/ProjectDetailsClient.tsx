"use client";

import { useEffect, useState, useRef } from "react";
import { useSearchParams, usePathname, useRouter } from "next/navigation";
import { useForm, useFieldArray, Controller } from "react-hook-form";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { loadDraft, saveDraft, markPageSaved, isPageSaved } from "@/app/utils/draftStorage";
import { getSurveyNumbersForPlotFlowSync } from "@/app/utils/villageToSurveyNumbers";
import { WARDS_WITH_FP_OPTION } from "@/app/utils/dp2034FpWards";
import {
  DP_ZONE_OPTIONS,
  DP_ZONE_TO_MAJOR_USE_TO_SUB_USE,
  type DpZone,
} from "@/app/utils/dpZoneMajorUseSubUse";
import { supabase } from "@/app/utils/supabase";
import { fetchProjectForEdit } from "@/app/utils/fetchProjectForEdit";
import { useUserMetadata } from "@/app/contexts/UserContext";
import { useDashboardAlertModal } from "@/app/dashboard/context/DashboardAlertModalContext";
import CustomSelect from "@/app/components/CustomSelect";
import Modal from "@/app/components/ui/Modal";
import WizardSteps, { type WizardStep } from "@/app/components/ui/WizardSteps";
import { BTN_PRIMARY, BTN_SAVE_UNSAVED } from "@/app/utils/buttonClasses";
import { subscribeProjectAutofillApplied } from "@/app/lib/projectDocumentAutofill";
import {
  enrichSavePlotLocation,
  inferVillageFromCts,
  matchVillageToWardOptions,
  normalizeDpZoneForForm,
  normalizeVillageForWard,
  pickString,
  sanitizeCtsNumbers,
} from "@/app/lib/projectDocumentAutofill/utils";
import {
  combineProjectTitleWithProposalNo,
  stripTrailingProposalNo,
} from "@/app/utils/projectTitleProposal";

type ProjectFormData = {
  proposalAsPer: "DCPR 2034";
  title: string;
  proposalNo: string;
  propertyAddress: string;
  landmark: string;
  earlierBuildingProposalFileNo: string;
  pincode: string;
  fullNameOfApplicant: string;
  addressOfApplicant: string;
  hasPaidLatestPropertyTax: "Yes" | "No" | "";
};

type SavePlotFormData = {
  planningAuthority: "BMC" | "SRA" | "MHADA" | "MMRDA" | "CIDCO" | "MIDC" | "";
  projectProponent: string;
  region: string;
  zone: string;
  ward: string;
  proposedCtsNumber: string[]; // Survey Nos (multi-select)
  villageName: string;
  plotBelongsTo: "CTS No." | "CS No." | "F.P.No" | "";
  grossPlotArea: string;
  sacNo: string[]; // SAC Nos (multi-select)
  roadName: string;
  dpZone: string;
  majorUseOfPlot: string;
  plotSubUse: string;
  plotNo: string;
  isInternalRoadPresent: "Yes" | "No" | "";
  plotType: string;
  plotEntries: {
    ctsNumber: string;
    sacNumber: string;
    verifyPropertyTax: string;
    prCard: string;
  }[];
};

const PLANNING_AUTHORITY_OPTIONS = [
  "BMC",
  "SRA",
  "MHADA",
  "MMRDA",
  "CIDCO",
  "MIDC",
] as const;

function normalizePlanningAuthority(v: unknown): SavePlotFormData["planningAuthority"] {
  if (typeof v !== "string") return "";
  return (PLANNING_AUTHORITY_OPTIONS as readonly string[]).includes(v)
    ? (v as Exclude<SavePlotFormData["planningAuthority"], "">)
    : "";
}

const SAVE_PLOT_FORM_DEFAULTS: SavePlotFormData = {
  planningAuthority: "",
  projectProponent: "",
  plotBelongsTo: "",
  region: "",
  zone: "",
  ward: "",
  villageName: "",
  proposedCtsNumber: [],
  grossPlotArea: "",
  sacNo: [],
  roadName: "",
  dpZone: "",
  majorUseOfPlot: "",
  plotSubUse: "",
  plotNo: "",
  isInternalRoadPresent: "",
  plotType: "",
  plotEntries: [{ ctsNumber: "", sacNumber: "", verifyPropertyTax: "", prCard: "" }],
};

/** Base plot-belongs choices by region only (no F.P.No here). */
function plotBelongsBaseOptionsForRegion(region: string): SavePlotFormData["plotBelongsTo"][] {
  if (region === "City") return ["CS No."];
  if (region === "Western" || region === "Eastern") return ["CTS No."];
  return [];
}

/** Options for the current region + ward (adds F.P.No only for WARDS_WITH_FP_OPTION). */
function plotBelongsOptionsForRegionAndWard(
  region: string,
  ward: string | undefined
): SavePlotFormData["plotBelongsTo"][] {
  const base = plotBelongsBaseOptionsForRegion(region);
  if (base.length === 0) return [];
  if (!ward || !WARDS_WITH_FP_OPTION.has(ward)) return base;
  return [...base, "F.P.No"];
}

/** Auto-selected plot type when ward is not an FP ward (or ward not chosen yet): CS or CTS only. */
function defaultBasePlotBelongsForRegion(region: string): SavePlotFormData["plotBelongsTo"] {
  const base = plotBelongsBaseOptionsForRegion(region);
  return base.length === 1 ? base[0] : "";
}

function normalizePlotBelongsForRegion(
  region: string,
  ward: string | undefined,
  value: SavePlotFormData["plotBelongsTo"] | string
): SavePlotFormData["plotBelongsTo"] {
  const allowed = plotBelongsOptionsForRegionAndWard(region, ward);
  if (allowed.length === 0) return "";
  if (allowed.includes(value as SavePlotFormData["plotBelongsTo"])) {
    return value as SavePlotFormData["plotBelongsTo"];
  }
  // Invalid / empty: default CS/CTS for non-FP wards; no default when FP ward must choose CS/CTS vs F.P.No
  const mustPickFpOrBase = ward && WARDS_WITH_FP_OPTION.has(ward) && allowed.length > 1;
  if (mustPickFpOrBase) return "";
  return allowed[0];
}

/** Label for the village/division/TPS dropdown, aligned with "This plot belongs to". */
function labelForVillageDivisionField(plotBelongs: SavePlotFormData["plotBelongsTo"]): string {
  switch (plotBelongs) {
    case "CS No.":
      return "Division";
    case "CTS No.":
      return "Village";
    case "F.P.No":
      return "TPS schema";
    default:
      return "Village/Division";
  }
}

function villageSelectPlaceholder(plotBelongs: SavePlotFormData["plotBelongsTo"]): string {
  switch (plotBelongs) {
    case "CS No.":
      return "----- Select Division -----";
    case "CTS No.":
      return "----- Select Village -----";
    case "F.P.No":
      return "----- Select TPS schema -----";
    default:
      return "----- Select Village -----";
  }
}

function villageFieldRequiredMessage(plotBelongs: SavePlotFormData["plotBelongsTo"]): string {
  switch (plotBelongs) {
    case "CS No.":
      return "Division is required";
    case "CTS No.":
      return "Village is required";
    case "F.P.No":
      return "TPS schema is required";
    default:
      return "Village/Division is required";
  }
}

/** Label for the multi-select that lists survey numbers, aligned with "This plot belongs to". */
function labelForSurveyField(plotBelongs: SavePlotFormData["plotBelongsTo"]): string {
  switch (plotBelongs) {
    case "F.P.No":
      return "F.P. No";
    case "CS No.":
      return "CS No.";
    case "CTS No.":
      return "CTS No.";
    default:
      return "Survey No";
  }
}

function emptySurveyOptionsMessage(plotBelongs: SavePlotFormData["plotBelongsTo"]): string {
  switch (plotBelongs) {
    case "F.P.No":
      return "No F.P. numbers found";
    case "CS No.":
      return "No CS numbers found";
    case "CTS No.":
      return "No CTS numbers found";
    default:
      return "No survey numbers found";
  }
}

function validateSurveySelectionMessage(plotBelongs: SavePlotFormData["plotBelongsTo"]): string {
  switch (plotBelongs) {
    case "F.P.No":
      return "Please select at least one F.P. number";
    case "CS No.":
      return "Please select at least one CS number";
    case "CTS No.":
      return "Please select at least one CTS number";
    default:
      return "Please select at least one survey number";
  }
}

function readProjectFormDraft(): ProjectFormData {
  const draft = loadDraft<ProjectFormData>("draft-project-details-project", {
    proposalAsPer: "DCPR 2034",
    title: "",
    proposalNo: "",
    propertyAddress: "",
    landmark: "",
    earlierBuildingProposalFileNo: "",
    pincode: "",
    fullNameOfApplicant: "",
    addressOfApplicant: "",
    hasPaidLatestPropertyTax: "",
  });
  const proposalNo = String(draft.proposalNo || "").trim();
  return {
    ...draft,
    title: stripTrailingProposalNo(String(draft.title || ""), proposalNo),
    proposalNo,
  };
}

function readSavePlotFormDraft(): SavePlotFormData {
  const stored = loadDraft<Partial<SavePlotFormData>>(
    "draft-project-details-save-plot",
    SAVE_PLOT_FORM_DEFAULTS
  );
  const projectStored = loadDraft<Partial<ProjectFormData>>(
    "draft-project-details-project",
    {} as ProjectFormData
  );
  const merged: SavePlotFormData = {
    ...SAVE_PLOT_FORM_DEFAULTS,
    ...(stored && typeof stored === "object" ? stored : {}),
  };
  const enriched = enrichSavePlotLocation({
    ...merged,
    propertyAddress: pickString(projectStored.propertyAddress),
    landmark: pickString(projectStored.landmark),
  }) as Partial<SavePlotFormData>;
  const withLocation: SavePlotFormData = {
    ...merged,
    ...enriched,
    planningAuthority: normalizePlanningAuthority(
      String(enriched.planningAuthority ?? merged.planningAuthority ?? "")
    ),
    plotBelongsTo: normalizePlotBelongsForRegion(
      String(enriched.region ?? merged.region ?? ""),
      String(enriched.ward ?? merged.ward ?? "") || undefined,
      String(enriched.plotBelongsTo ?? merged.plotBelongsTo ?? "")
    ),
    villageName: normalizeVillageForWard(
      String(enriched.ward ?? merged.ward ?? ""),
      String(enriched.villageName ?? merged.villageName ?? "")
    ),
    dpZone: normalizeDpZoneForForm(String(enriched.dpZone ?? merged.dpZone ?? "")),
  };
  const raw = withLocation.proposedCtsNumber;
  const normalizedProposedCtsNumber = sanitizeCtsNumbers(raw);

  return {
    ...withLocation,
    proposedCtsNumber: normalizedProposedCtsNumber,
  };
}

/** Wizard steps in order. Each `id` matches the `tab` query-param contract. */
const WIZARD_STEPS: WizardStep[] = [
  { id: "project-info", label: "Basic Details" },
  { id: "save-plot", label: "Property Details" },
];

export default function ProjectDetailsClient() {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const projectId = searchParams.get("projectId");
  const mode = searchParams.get("mode");
  const isReadOnlyMode = mode === "readonly";
  const { userMetadata } = useUserMetadata();
  const { showAlert } = useDashboardAlertModal();

  // Only enable edit mode if we're on the project-details page and have a projectId
  const isProjectDetailsPage = pathname === "/dashboard/project-details";
  const isEditMode = isProjectDetailsPage && !!projectId;
  const [isLoadingProject, setIsLoadingProject] = useState(isEditMode);
  const [projectData, setProjectData] = useState<any>(null);
  
  const tabParam = searchParams.get("tab");
  const [activeTab, setActiveTab] = useState(
    tabParam === "save-plot" ? "save-plot" : "project-info"
  );
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);

  useEffect(() => {
    if (tabParam === "project-info" || tabParam === "save-plot") {
      setActiveTab(tabParam);
    }
  }, [tabParam]);

  const [isProjectInfoSaved, setIsProjectInfoSaved] = useState(() => isPageSaved("saved-project-info"));
  const [isSavePlotSaved, setIsSavePlotSaved] = useState(() => isPageSaved("saved-save-plot-details"));
  // Track initial load to prevent clearing fields during form initialization
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const lastAutofillHydratedRef = useRef(0);
  const prevRegionRef = useRef<string | undefined>(undefined);
  const prevZoneRef = useRef<string | undefined>(undefined);
  const prevWardRef = useRef<string | undefined>(undefined);
  const prevVillageRef = useRef<string | undefined>(undefined);

  const syncCascadeRefs = (draft: SavePlotFormData) => {
    prevRegionRef.current = draft.region;
    prevZoneRef.current = draft.zone;
    prevWardRef.current = draft.ward;
    prevVillageRef.current = draft.villageName;
  };

  const inputClasses =
    "h-11 w-full rounded-lg border border-gray-200 bg-gray-50 px-3 text-sm text-gray-900 placeholder:text-gray-400 outline-none transition-colors hover:border-gray-300 focus:border-brand-blue focus:bg-white focus:ring-2 focus:ring-brand-blue/20 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-500";
  const textareaClasses =
    "w-full resize-none rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 outline-none transition-colors hover:border-gray-300 focus:border-brand-blue focus:bg-white focus:ring-2 focus:ring-brand-blue/20";
  const labelClasses = "mb-1.5 block text-sm font-medium text-brand-navy";
  const requiredMark = <span className="text-brand-navy">*</span>;
  const errorClasses = "mt-1 text-sm text-status-danger";
  const radioClasses = "h-4 w-4 border-gray-300 text-brand-blue focus:ring-brand-blue";
  const radioLabelClasses = "flex items-center gap-2 text-sm text-gray-700";
  const chipClasses =
    "inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5 text-sm text-gray-800";
  const secondaryBtnClasses =
    "inline-flex min-h-10 items-center rounded-lg border border-brand-blue/30 bg-white px-4 text-sm font-semibold text-brand-blue transition-colors hover:bg-blue-50";
  const primaryBtnClasses =
    "inline-flex min-h-10 items-center gap-2 rounded-lg bg-brand-blue px-5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-brand-blue-hover hover:shadow-md";
  const footerBarClasses =
    "mt-6 flex flex-wrap items-center justify-end gap-2 border-t border-gray-100 pt-4";

  const {
    register: registerProject,
    handleSubmit: handleProjectSubmit,
    formState: { errors: projectErrors },
    watch: watchProject,
    reset: resetProject,
    setValue: setProjectValue,
    setError: setProjectError,
  } = useForm<ProjectFormData>({
    defaultValues: readProjectFormDraft(),
  });

  // Default for new projects only (edit mode loads proposalAsPer from the database)
  useEffect(() => {
    if (isEditMode) return;
    setProjectValue("proposalAsPer", "DCPR 2034");
  }, [isEditMode, setProjectValue]);

  // Auto-fill applicant name and address from logged-in user metadata (only for new projects)
  useEffect(() => {
    if (isEditMode || !userMetadata) return;
    const draft = loadDraft<ProjectFormData>("draft-project-details-project", {} as ProjectFormData);
    if (draft.fullNameOfApplicant || draft.addressOfApplicant) return;

    const fullName =
      [userMetadata.first_name, userMetadata.middle_name, userMetadata.last_name]
        .filter(Boolean)
        .join(" ") || "";
    const address = userMetadata.address || "";

    if (fullName) setProjectValue("fullNameOfApplicant", fullName);
    if (address) setProjectValue("addressOfApplicant", address);
  }, [isEditMode, userMetadata, setProjectValue]);

  const {
    register: registerSavePlot,
    handleSubmit: handleSavePlotSubmit,
    control: savePlotControl,
    watch: watchSavePlot,
    getValues: getSavePlotValues,
    setValue: setSavePlotValue,
    setError: setSavePlotError,
    clearErrors: clearSavePlotErrors,
    formState: { errors: savePlotErrors },
    reset: resetSavePlot,
  } = useForm<SavePlotFormData>({
    defaultValues: readSavePlotFormDraft(),
  });

  const {
    fields: plotFields,
    append: appendPlotField,
  } = useFieldArray({
    control: savePlotControl,
    name: "plotEntries",
  });

  // Region to Zone mapping (defined before use)
  const regionToZonesMap: Record<string, string[]> = {
    "City": ["Zone I", "Zone II"],
    "Western": ["Zone III", "Zone IV"],
    "Eastern": ["Zone V", "Zone VI", "Zone VII"],
  };

  // Helper function to derive region from zone (for backward compatibility)
  const getRegionFromZone = (zone: string): string => {
    if (!zone) return "";
    // New zone format
    if (zone === "Zone I" || zone === "Zone II") return "City";
    if (zone === "Zone III" || zone === "Zone IV") return "Western";
    if (zone === "Zone V" || zone === "Zone VI" || zone === "Zone VII") return "Eastern";
    // Old zone format (backward compatibility)
    if (zone === "City") return "City";
    if (zone === "Central Mumbai" || zone === "Western South" || zone === "Western North") return "Western";
    if (zone === "Eastern Suburbs" || zone === "Northern Suburbs") return "Eastern";
    return "";
  };

  // Helper function to convert old zone names to new zone format (for backward compatibility)
  const convertOldZoneToNew = (zone: string): string => {
    if (!zone) return "";
    // If already in new format, return as is
    if (zone.startsWith("Zone ")) return zone;
    // Convert old zone names to new format
    const oldToNewZoneMap: Record<string, string> = {
      "City": "Zone I", // Default to Zone I for City
      "Central Mumbai": "Zone II",
      "Western South": "Zone III",
      "Eastern Suburbs": "Zone V",
      "Western North": "Zone IV",
      "Northern Suburbs": "Zone VI",
    };
    return oldToNewZoneMap[zone] || zone;
  };

  const selectedRegion = watchSavePlot("region");
  const selectedZone = watchSavePlot("zone");
  const selectedWard = watchSavePlot("ward");
  const selectedPlotBelongs = watchSavePlot("plotBelongsTo");
  const selectedVillage = watchSavePlot("villageName");
  const selectedSurveyNos = watchSavePlot("proposedCtsNumber");
  const selectedDpZone = watchSavePlot("dpZone");
  const selectedMajorUse = watchSavePlot("majorUseOfPlot");
  
  // Filter zones based on selected region
  const zoneOptions = selectedRegion && regionToZonesMap[selectedRegion]
    ? regionToZonesMap[selectedRegion]
    : [];
  
  // State to store CTS numbers from local mapping
  const [ctsNumbers, setCtsNumbers] = useState<string[]>([]);
  /** F.P.No: TPS schemes from DP2034 MapServer/13 (same as dpremarks.mcgm.gov.in). */
  const [fpTpsFromApi, setFpTpsFromApi] = useState<string[] | null>(null);
  const [fpTpsReady, setFpTpsReady] = useState(false);

  // Fetch project data when in edit mode
  useEffect(() => {
    if (!isEditMode || !projectId) return;

    const fetchProject = async () => {
      setIsLoadingProject(true);
      try {
        const { project: data, error: loadError } = await fetchProjectForEdit(projectId);

        if (loadError || !data) {
          console.error("Error fetching project:", loadError);
          showAlert({
            title: "Could not load project",
            message: "Failed to load project data. Please try again.",
          });
          return;
        }

        setProjectData(data);

        // Map backend data to ProjectFormData structure
        const projectInfo = (data.project_info as Record<string, unknown>) || {};
        const storedProposalNo = String(projectInfo.proposalNo || "").trim();
        const infoTitle = stripTrailingProposalNo(
          String(projectInfo.title || ""),
          storedProposalNo
        );
        const fromStoredTitle = stripTrailingProposalNo(
          String(data.title || ""),
          storedProposalNo
        );
        // Prefer project_info title when it is the clean base (avoids duplicated proposal nos)
        const baseTitle =
          infoTitle &&
          fromStoredTitle &&
          (fromStoredTitle === infoTitle || fromStoredTitle.startsWith(`${infoTitle} `))
            ? infoTitle
            : fromStoredTitle || infoTitle;
        const projectFormData: ProjectFormData = {
          proposalAsPer: "DCPR 2034",
          title: baseTitle,
          proposalNo: storedProposalNo,
          propertyAddress: String(projectInfo.propertyAddress || ""),
          landmark: String(projectInfo.landmark || ""),
          earlierBuildingProposalFileNo: String(projectInfo.earlierBuildingProposalFileNo || ""),
          pincode: String(projectInfo.pincode || ""),
          fullNameOfApplicant: String(projectInfo.fullNameOfApplicant || ""),
          addressOfApplicant: String(projectInfo.addressOfApplicant || ""),
          hasPaidLatestPropertyTax: (projectInfo.hasPaidLatestPropertyTax === "Yes" || projectInfo.hasPaidLatestPropertyTax === "No") ? projectInfo.hasPaidLatestPropertyTax : "",
        };

        // Map backend data to SavePlotFormData structure
        const savePlotDetails = (data.save_plot_details as Record<string, unknown>) || {};
          
        let zone = String(savePlotDetails.zone || "");
        zone = convertOldZoneToNew(zone);
        const region = String(savePlotDetails.region || getRegionFromZone(zone));

        const savePlotFormData: SavePlotFormData = {
          planningAuthority: normalizePlanningAuthority(
            String(savePlotDetails.planningAuthority || "")
          ),
          projectProponent: String(savePlotDetails.projectProponent || ""),
          region,
          zone,
          ward: String(savePlotDetails.ward || ""),
          proposedCtsNumber: Array.isArray(savePlotDetails.proposedCtsNumber)
            ? savePlotDetails.proposedCtsNumber.map(String)
            : typeof savePlotDetails.proposedCtsNumber === "string" && savePlotDetails.proposedCtsNumber
              ? [savePlotDetails.proposedCtsNumber]
              : [],
          villageName: String(savePlotDetails.villageName || ""),
          plotBelongsTo: normalizePlotBelongsForRegion(
            region,
            String(savePlotDetails.ward || "") || undefined,
            String(savePlotDetails.plotBelongsTo || "")
          ),
          grossPlotArea: String(savePlotDetails.grossPlotArea || ""),
          sacNo: Array.isArray(savePlotDetails.sacNo)
            ? savePlotDetails.sacNo.map(String)
            : typeof savePlotDetails.sacNo === "string" && savePlotDetails.sacNo
              ? [savePlotDetails.sacNo]
              : [],
          roadName: String(savePlotDetails.roadName || ""),
          dpZone: String(savePlotDetails.dpZone || ""),
          majorUseOfPlot: String(savePlotDetails.majorUseOfPlot || ""),
          plotSubUse: String(savePlotDetails.plotSubUse || ""),
          plotNo: String(savePlotDetails.plotNo || ""),
          isInternalRoadPresent: (savePlotDetails.isInternalRoadPresent === "Yes" || savePlotDetails.isInternalRoadPresent === "No") ? savePlotDetails.isInternalRoadPresent : "",
          plotType: String(savePlotDetails.plotType || ""),
          plotEntries:
            Array.isArray(savePlotDetails.plotEntries) && savePlotDetails.plotEntries.length > 0
              ? (savePlotDetails.plotEntries as SavePlotFormData["plotEntries"])
              : [{ ctsNumber: "", sacNumber: "", verifyPropertyTax: "", prCard: "" }],
        };

        setIsInitialLoad(true);
        resetProject(projectFormData);
        resetSavePlot(savePlotFormData);
        saveDraft("draft-project-details-project", projectFormData);
        saveDraft("draft-project-details-save-plot", savePlotFormData);
        saveDraft("saved-project-info-snapshot", projectFormData);
        saveDraft("saved-save-plot-details-snapshot", savePlotFormData);

        const hasMeaningful = (val: unknown): boolean => {
          if (val === null || val === undefined) return false;
          if (typeof val === "string") return val.trim().length > 0;
          if (typeof val === "number") return true;
          if (typeof val === "boolean") return val;
          if (Array.isArray(val)) return val.length > 0 && val.some(hasMeaningful);
          if (typeof val === "object") return Object.values(val).some(hasMeaningful);
          return false;
        };
        if (hasMeaningful(data.project_info)) {
          markPageSaved("saved-project-info");
          setIsProjectInfoSaved(true);
        }
        if (hasMeaningful(data.save_plot_details)) {
          markPageSaved("saved-save-plot-details");
          setIsSavePlotSaved(true);
        }

        requestAnimationFrame(() => {
          setTimeout(() => {
            if (savePlotFormData.zone) {
              setSavePlotValue("zone", savePlotFormData.zone, {
                shouldValidate: false,
                shouldDirty: false,
                shouldTouch: false,
              });
            }
            setTimeout(() => {
              if (savePlotFormData.ward) {
                setSavePlotValue("ward", savePlotFormData.ward, {
                  shouldValidate: false,
                  shouldDirty: false,
                  shouldTouch: false,
                });
              }
              setTimeout(() => {
                if (savePlotFormData.villageName) {
                  setSavePlotValue("villageName", savePlotFormData.villageName, {
                    shouldValidate: false,
                    shouldDirty: false,
                    shouldTouch: false,
                  });
                }
                if (savePlotFormData.proposedCtsNumber?.length > 0) {
                  setSavePlotValue("proposedCtsNumber", savePlotFormData.proposedCtsNumber, {
                    shouldValidate: false,
                    shouldDirty: false,
                    shouldTouch: false,
                  });
                }
                if (savePlotFormData.plotBelongsTo) {
                  setSavePlotValue("plotBelongsTo", savePlotFormData.plotBelongsTo, {
                    shouldValidate: false,
                    shouldDirty: false,
                    shouldTouch: false,
                  });
                }
                if (savePlotFormData.villageName && savePlotFormData.ward) {
                  const loadNumbers = async () => {
                    if (savePlotFormData.plotBelongsTo === "F.P.No") {
                      try {
                        const qs = new URLSearchParams({
                          type: "fp",
                          ward: savePlotFormData.ward,
                          tps: savePlotFormData.villageName,
                        });
                        const r = await fetch(`/api/dp2034/map-query?${qs}`);
                        const mapData = await r.json();
                        if (Array.isArray(mapData.values) && mapData.values.length > 0) {
                          setCtsNumbers(mapData.values);
                          return;
                        }
                      } catch {
                        /* fall through */
                      }
                    }
                    setCtsNumbers(
                      getSurveyNumbersForPlotFlowSync(
                        savePlotFormData.ward,
                        savePlotFormData.villageName,
                        savePlotFormData.plotBelongsTo || ""
                      )
                    );
                  };
                  void loadNumbers();
                }
                setTimeout(() => setIsInitialLoad(false), 300);
              }, 100);
            }, 100);
          }, 100);
        });
      } catch (err) {
        console.error("Error fetching project:", err);
        showAlert({
          title: "Could not load project",
          message: "Failed to load project data. Please try again.",
        });
      } finally {
        setIsLoadingProject(false);
      }
    };

    fetchProject();
  }, [projectId, isEditMode, resetProject, resetSavePlot, showAlert]);

  // New projects only — edit mode clears isInitialLoad after DB data is applied
  useEffect(() => {
    if (isEditMode) return;
    const timer = setTimeout(() => setIsInitialLoad(false), 500);
    return () => clearTimeout(timer);
  }, [isEditMode]);

  // Persist drafts whenever forms change
  useEffect(() => {
    if (isReadOnlyMode) return;
    const subscription = watchProject((value) => {
      saveDraft("draft-project-details-project", value as ProjectFormData);
    });
    return () => subscription.unsubscribe();
  }, [isReadOnlyMode, watchProject]);

  useEffect(() => {
    if (isReadOnlyMode || isInitialLoad) return;
    const subscription = watchSavePlot((value) => {
      saveDraft("draft-project-details-save-plot", value as SavePlotFormData);
    });
    return () => subscription.unsubscribe();
  }, [isInitialLoad, isReadOnlyMode, watchSavePlot]);

  // Reload project + save-plot forms when Project Library extraction writes new drafts.
  useEffect(() => {
    if (isEditMode || isReadOnlyMode) return;

    const hydrateFromAutofillDrafts = () => {
      setIsInitialLoad(true);
      resetProject(readProjectFormDraft());
      const savePlotDraft = readSavePlotFormDraft();
      resetSavePlot(savePlotDraft);
      syncCascadeRefs(savePlotDraft);
      setIsProjectInfoSaved(false);
      setIsSavePlotSaved(false);
      window.setTimeout(() => setIsInitialLoad(false), 500);
    };

    return subscribeProjectAutofillApplied(hydrateFromAutofillDrafts);
  }, [isEditMode, isReadOnlyMode, resetProject, resetSavePlot]);

  // If user navigates here after Library Save, hydrate from the latest autofill timestamp.
  useEffect(() => {
    if (isEditMode || isReadOnlyMode) return;
    const autofillAt = loadDraft<number>("project-library-autofill-at", 0);
    if (!autofillAt || autofillAt <= lastAutofillHydratedRef.current) return;
    lastAutofillHydratedRef.current = autofillAt;
    setIsInitialLoad(true);
    resetProject(readProjectFormDraft());
    const savePlotDraft = readSavePlotFormDraft();
    resetSavePlot(savePlotDraft);
    syncCascadeRefs(savePlotDraft);
    setIsProjectInfoSaved(false);
    setIsSavePlotSaved(false);
    window.setTimeout(() => setIsInitialLoad(false), 500);
  }, [isEditMode, isReadOnlyMode, resetProject, resetSavePlot]);

  // After hydration, backfill village/CTS from enriched draft if cascade effects cleared them.
  useEffect(() => {
    if (isEditMode || isReadOnlyMode || isInitialLoad) return;
    const autofillAt = loadDraft<number>("project-library-autofill-at", 0);
    if (!autofillAt) return;

    const draft = readSavePlotFormDraft();
    const current = getSavePlotValues();

    if (draft.villageName && !current.villageName) {
      setSavePlotValue("villageName", draft.villageName, { shouldValidate: false });
    }
    if (
      draft.proposedCtsNumber?.length &&
      (!Array.isArray(current.proposedCtsNumber) || current.proposedCtsNumber.length === 0)
    ) {
      setSavePlotValue("proposedCtsNumber", draft.proposedCtsNumber, { shouldValidate: false });
    }
  }, [getSavePlotValues, isEditMode, isInitialLoad, isReadOnlyMode, setSavePlotValue]);

  // Mark as unsaved only on actual user interaction (DOM events don't fire for programmatic changes)
  useEffect(() => {
    if (isReadOnlyMode) return;
    const handleUserEdit = () => {
      if (activeTab === "project-info" && isProjectInfoSaved) {
        setIsProjectInfoSaved(false);
      } else if (activeTab === "save-plot" && isSavePlotSaved) {
        setIsSavePlotSaved(false);
      }
    };
    const main = document.querySelector("main");
    if (!main) return;
    main.addEventListener("input", handleUserEdit, true);
    main.addEventListener("change", handleUserEdit, true);
    return () => {
      main.removeEventListener("input", handleUserEdit, true);
      main.removeEventListener("change", handleUserEdit, true);
    };
  }, [activeTab, isProjectInfoSaved, isReadOnlyMode, isSavePlotSaved]);

  // When region changes: clear zone, ward, village, survey no, and CTS numbers
  useEffect(() => {
    if (isReadOnlyMode) return;
    // Skip clearing during initial data load or if region hasn't actually changed
    if (isInitialLoad) {
      prevRegionRef.current = selectedRegion;
      return;
    }
    
    // Only clear if region actually changed (not just on initial render)
    if (
      prevRegionRef.current !== undefined &&
      prevRegionRef.current !== selectedRegion &&
      !(prevRegionRef.current === "" && selectedRegion)
    ) {
      // Clear all dependent fields when region changes
      setSavePlotValue("zone", "", { shouldValidate: false });
      setSavePlotValue("ward", "", { shouldValidate: false });
      setSavePlotValue("villageName", "", { shouldValidate: false });
      setSavePlotValue("proposedCtsNumber", [], { shouldValidate: false });
      setSavePlotValue("plotBelongsTo", "", { shouldValidate: false });
      setCtsNumbers([]); // Clear CTS numbers state
    }
    
    prevRegionRef.current = selectedRegion;
  }, [isInitialLoad, isReadOnlyMode, selectedRegion, setSavePlotValue]);

  // When zone changes: clear ward, village, survey no, and CTS numbers
  useEffect(() => {
    if (isReadOnlyMode) return;
    // Skip clearing during initial data load or if zone hasn't actually changed
    if (isInitialLoad) {
      prevZoneRef.current = selectedZone;
      return;
    }
    
    // Only clear if zone actually changed (not just on initial render)
    if (
      prevZoneRef.current !== undefined &&
      prevZoneRef.current !== selectedZone &&
      !(prevZoneRef.current === "" && selectedZone)
    ) {
      // Clear all dependent fields when zone changes
      setSavePlotValue("ward", "", { shouldValidate: false });
      setSavePlotValue("villageName", "", { shouldValidate: false });
      setSavePlotValue("proposedCtsNumber", [], { shouldValidate: false });
      setSavePlotValue("plotBelongsTo", defaultBasePlotBelongsForRegion(selectedRegion), {
        shouldValidate: false,
      });
      setCtsNumbers([]); // Clear CTS numbers state
    }
    
    prevZoneRef.current = selectedZone;
  }, [isInitialLoad, isReadOnlyMode, selectedRegion, selectedZone, setSavePlotValue]);

  // When ward changes: clear village, survey no, and CTS numbers
  useEffect(() => {
    if (isReadOnlyMode) return;
    // Skip clearing during initial data load or if ward hasn't actually changed
    if (isInitialLoad) {
      prevWardRef.current = selectedWard;
      return;
    }
    
    // Only clear if ward actually changed (not just on initial render)
    if (
      prevWardRef.current !== undefined &&
      prevWardRef.current !== selectedWard &&
      !(prevWardRef.current === "" && selectedWard)
    ) {
      // Clear dependent fields when ward changes
      setSavePlotValue("villageName", "", { shouldValidate: false });
      setSavePlotValue("proposedCtsNumber", [], { shouldValidate: false });
      setCtsNumbers([]); // Clear CTS numbers state
      const current = getSavePlotValues().plotBelongsTo;
      const next = normalizePlotBelongsForRegion(
        selectedRegion,
        selectedWard || undefined,
        current
      );
      if (current !== next) {
        setSavePlotValue("plotBelongsTo", next, { shouldValidate: false });
      }
    }
    
    prevWardRef.current = selectedWard;
  }, [getSavePlotValues, isInitialLoad, isReadOnlyMode, selectedRegion, selectedWard, setSavePlotValue]);

  // When village changes: clear survey no and CTS numbers
  useEffect(() => {
    if (isReadOnlyMode) return;
    // Skip clearing during initial data load or if village hasn't actually changed
    if (isInitialLoad) {
      prevVillageRef.current = selectedVillage;
      return;
    }
    
    // Only clear if village actually changed (not just on initial render)
    if (
      prevVillageRef.current !== undefined &&
      prevVillageRef.current !== selectedVillage &&
      !(prevVillageRef.current === "" && selectedVillage)
    ) {
      // Clear survey numbers when village changes
      setSavePlotValue("proposedCtsNumber", [], { shouldValidate: false });
      setCtsNumbers([]); // Clear CTS numbers state
    }
    
    prevVillageRef.current = selectedVillage;
  }, [isInitialLoad, isReadOnlyMode, selectedVillage, setSavePlotValue]);

  // Track previous DP Zone value to detect actual changes
  const prevDpZoneRef = useRef<string | undefined>(undefined);

  // When DP Zone changes: clear major use + sub use
  useEffect(() => {
    if (isReadOnlyMode) return;
    if (isInitialLoad) {
      prevDpZoneRef.current = selectedDpZone;
      return;
    }
    if (prevDpZoneRef.current !== undefined && prevDpZoneRef.current !== selectedDpZone) {
      setSavePlotValue("majorUseOfPlot", "", { shouldValidate: false });
      setSavePlotValue("plotSubUse", "", { shouldValidate: false });
    }
    prevDpZoneRef.current = selectedDpZone;
  }, [isInitialLoad, isReadOnlyMode, selectedDpZone, setSavePlotValue]);

  // Track previous major use value to detect actual changes
  const prevMajorUseRef = useRef<string | undefined>(undefined);

  // When major use changes: clear sub use
  useEffect(() => {
    if (isReadOnlyMode) return;
    if (isInitialLoad) {
      prevMajorUseRef.current = selectedMajorUse;
      return;
    }
    if (prevMajorUseRef.current !== undefined && prevMajorUseRef.current !== selectedMajorUse) {
      setSavePlotValue("plotSubUse", "", { shouldValidate: false });
    }
    prevMajorUseRef.current = selectedMajorUse;
  }, [isInitialLoad, isReadOnlyMode, selectedMajorUse, setSavePlotValue]);

  // F.P.No: load TPS scheme names from DP2034 MapServer (dpremarks.mcgm.gov.in / Widget.js layer 13)
  useEffect(() => {
    if (selectedPlotBelongs !== "F.P.No" || !selectedWard) {
      setFpTpsFromApi(null);
      setFpTpsReady(false);
      return;
    }
    setFpTpsReady(false);
    setFpTpsFromApi(null);
    const ac = new AbortController();
    const url = `/api/dp2034/map-query?type=tps&ward=${encodeURIComponent(selectedWard)}`;
    fetch(url, { signal: ac.signal })
      .then((r) => r.json())
      .then((data: { values?: string[] }) => {
        const values = Array.isArray(data.values) ? data.values : [];
        // Never substitute villageToCtsMapping.json keys here — those are CS/CTS names, not GIS TPS schemes.
        setFpTpsFromApi(values);
        setFpTpsReady(true);
      })
      .catch(() => {
        setFpTpsFromApi([]);
        setFpTpsReady(true);
      });
    return () => ac.abort();
  }, [selectedPlotBelongs, selectedWard]);

  // F.P.No: TPS / village option list validation — clear if current value not in allowed set
  useEffect(() => {
    if (isInitialLoad) return;

    const draft = getSavePlotValues();
    let ward = selectedWard;
    const autofillAt = loadDraft<number>("project-library-autofill-at", 0);
    const recentAutofill = autofillAt > 0 && Date.now() - autofillAt < 15000;

    const ctsDraft = Array.isArray(draft.proposedCtsNumber)
      ? draft.proposedCtsNumber.map(String)
      : [];

    if (ward && !draft.villageName && ctsDraft.length > 0) {
      const fromCts = inferVillageFromCts(ward, ctsDraft);
      if (fromCts) {
        setSavePlotValue("villageName", fromCts, { shouldValidate: false });
        return;
      }
    }

    if (ward && draft.villageName) {
      const projectDraft = loadDraft<Partial<ProjectFormData>>(
        "draft-project-details-project",
        {} as ProjectFormData
      );
      const enriched = enrichSavePlotLocation({
        region: draft.region,
        zone: draft.zone,
        ward,
        villageName: draft.villageName,
        proposedCtsNumber: ctsDraft,
        propertyAddress: pickString(projectDraft.propertyAddress),
        landmark: pickString(projectDraft.landmark),
      }) as Partial<SavePlotFormData>;
      if ((enriched.villageName || "") !== (draft.villageName || "")) {
        setSavePlotValue("villageName", enriched.villageName || "", { shouldValidate: false });
        return;
      }
    }

    if (!ward && draft.villageName) {
      const enriched = enrichSavePlotLocation({
        region: draft.region,
        zone: draft.zone,
        ward: draft.ward,
        villageName: draft.villageName,
        proposedCtsNumber: ctsDraft,
        propertyAddress: pickString(
          loadDraft<Partial<ProjectFormData>>("draft-project-details-project", {} as ProjectFormData)
            .propertyAddress
        ),
      }) as Partial<SavePlotFormData>;

      if (enriched.ward && enriched.ward !== draft.ward) {
        setSavePlotValue("ward", enriched.ward, { shouldValidate: false });
      }
      if (enriched.region && enriched.region !== draft.region) {
        setSavePlotValue("region", enriched.region, { shouldValidate: false });
      }
      if (enriched.zone && enriched.zone !== draft.zone) {
        setSavePlotValue("zone", enriched.zone, { shouldValidate: false });
      }
      if (enriched.villageName && enriched.villageName !== draft.villageName) {
        setSavePlotValue("villageName", enriched.villageName, { shouldValidate: false });
      }
      if (enriched.ward) ward = enriched.ward;
    }

    if (!ward) return;
    if (selectedPlotBelongs === "F.P.No" && !fpTpsReady) return;

    const fpOpts =
      selectedPlotBelongs === "F.P.No" && fpTpsFromApi !== null ? fpTpsFromApi : null;
    const regularOpts = villageOptionsByWard[ward] ?? [];
    const opts = selectedPlotBelongs === "F.P.No" ? (fpOpts ?? []) : regularOpts;
    const v = getSavePlotValues().villageName;
    const normalized = normalizeVillageForWard(ward, v);
    const matched = matchVillageToWardOptions(ward, normalized || v);

    if (matched && matched !== v && opts.includes(matched)) {
      setSavePlotValue("villageName", matched, { shouldValidate: false });
      return;
    }
    if (recentAutofill && v && opts.includes(v)) return;
    if (v && !opts.includes(v)) {
      if (matched && opts.includes(matched)) {
        setSavePlotValue("villageName", matched, { shouldValidate: false });
        return;
      }
      setSavePlotValue("villageName", "", { shouldValidate: false });
      setSavePlotValue("proposedCtsNumber", [], { shouldValidate: false });
      setCtsNumbers([]);
    }
  }, [
    selectedPlotBelongs,
    selectedWard,
    isInitialLoad,
    setSavePlotValue,
    getSavePlotValues,
    fpTpsReady,
    fpTpsFromApi,
  ]);

  // Survey / F.P. numbers: CS/CTS from local JSON; F.P.No from MapServer/13 (then JSON fallback)
  useEffect(() => {
    if (isInitialLoad && isEditMode) {
      return;
    }

    const draftSelected = getSavePlotValues().proposedCtsNumber;
    const selected = Array.isArray(draftSelected) ? draftSelected.map(String) : [];

    if (!selectedVillage || !selectedWard) {
      setCtsNumbers(selected.length > 0 ? [...new Set(selected)] : []);
      return;
    }

    if (selectedPlotBelongs === "F.P.No") {
      const ac = new AbortController();
      const qs = new URLSearchParams({
        type: "fp",
        ward: String(selectedWard),
        tps: String(selectedVillage),
      });
      fetch(`/api/dp2034/map-query?${qs}`, { signal: ac.signal })
        .then((r) => r.json())
        .then((data: { values?: string[] }) => {
          if (Array.isArray(data.values) && data.values.length > 0) {
            setCtsNumbers(data.values);
          } else {
            const fallback = getSurveyNumbersForPlotFlowSync(
              selectedWard as string,
              selectedVillage as string,
              "F.P.No"
            );
            setCtsNumbers(fallback);
          }
        })
        .catch(() => {
          setCtsNumbers(
            getSurveyNumbersForPlotFlowSync(
              selectedWard as string,
              selectedVillage as string,
              "F.P.No"
            )
          );
        });
      return () => ac.abort();
    }

    const numbers = getSurveyNumbersForPlotFlowSync(
      selectedWard as string,
      selectedVillage as string,
      selectedPlotBelongs || ""
    );
    const merged = [...new Set([...numbers, ...selected])];
    setCtsNumbers(merged.length > 0 ? merged : []);
  }, [selectedVillage, selectedWard, selectedPlotBelongs, isInitialLoad, isEditMode, getSavePlotValues]);

  const onProjectSubmit = async (data: ProjectFormData) => {
    if (isReadOnlyMode) return;
    try {
      const title = data.title?.trim();
      if (!title) {
        setProjectError("title", { type: "manual", message: "Title is required" });
        return;
      }

      const proposalNo = data.proposalNo?.trim() || "";
      const previousProposalNo = String(
        ((projectData?.project_info as Record<string, unknown> | undefined)
          ?.proposalNo as string) || ""
      ).trim();
      const combinedTitle = combineProjectTitleWithProposalNo(title, proposalNo, [
        previousProposalNo,
      ]);

      const userId = typeof window !== "undefined" ? window.localStorage.getItem("consultantId") : null;

      if (userId) {
        const query = supabase
          .from("projects")
          .select("id, status")
          .eq("user_id", userId)
          .eq("title", combinedTitle)
          .limit(1);

        if (isEditMode && projectId) {
          query.neq("id", projectId);
        }

        const { data: duplicates } = await query;
        if (duplicates && duplicates.length > 0) {
          setProjectError("title", { type: "manual", message: "A project with this Title and Proposal No combination already exists. Please change the title or proposal number." });
          return;
        }
      }

      const isDraft = projectData?.status === "draft";
      if (isEditMode && projectId && !isDraft) {
        if (!userId) {
          showAlert({
            title: "Session required",
            message: "User not found in session. Please log in again.",
          });
          return;
        }

        const { data: { session } } = await supabase.auth.getSession();
        const authToken = session?.access_token;
        
        const headers: HeadersInit = { "Content-Type": "application/json" };
        if (authToken) {
          headers["Authorization"] = `Bearer ${authToken}`;
        }

        const response = await fetch(`/api/projects/${projectId}`, {
          method: "PUT",
          headers,
          body: JSON.stringify({
            user_id: userId,
            title: combinedTitle,
            project_info: data,
          }),
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || "Failed to update project");
        }

        showAlert({
          title: "Project details",
          message: "Project details updated successfully!",
        });
      } else {
        console.log("Project Data:", data);
        showAlert({
          title: "Project details",
          message: "Project details saved successfully!",
        });
      }
      markPageSaved("saved-project-info");
      saveDraft("dirty-project-details", false);
      saveDraft("saved-project-info-snapshot", data);
      setIsProjectInfoSaved(true);
    } catch (error: any) {
      console.error("Error saving project:", error);
      showAlert({
        title: "Could not save",
        message: error.message || "Failed to save project details. Please try again.",
      });
    }
  };

  const onSavePlotSubmit = async (data: SavePlotFormData) => {
    if (isReadOnlyMode) return;
    try {
      const isDraft = projectData?.status === "draft";
      if (isEditMode && projectId && !isDraft) {
        const userId = typeof window !== "undefined" ? window.localStorage.getItem("consultantId") : null;
        if (!userId) {
          showAlert({
            title: "Session required",
            message: "User not found in session. Please log in again.",
          });
          return;
        }

        const { data: { session } } = await supabase.auth.getSession();
        const authToken = session?.access_token;
        
        const headers: HeadersInit = { "Content-Type": "application/json" };
        if (authToken) {
          headers["Authorization"] = `Bearer ${authToken}`;
        }

        const response = await fetch(`/api/projects/${projectId}`, {
          method: "PUT",
          headers,
          body: JSON.stringify({
            user_id: userId,
            save_plot_details: data,
          }),
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || "Failed to update project");
        }

        showAlert({
          title: "Save plot details",
          message: "Save plot details updated successfully!",
        });
      } else {
        console.log("Save Plot Data:", data);
        showAlert({
          title: "Save plot details",
          message: "Save plot details saved successfully!",
        });
      }
      markPageSaved("saved-save-plot-details");
      saveDraft("dirty-project-details", false);
      saveDraft("saved-save-plot-details-snapshot", data);
      setIsSavePlotSaved(true);
    } catch (error: any) {
      console.error("Error saving plot details:", error);
      showAlert({
        title: "Could not save",
        message: error.message || "Failed to save plot details. Please try again.",
      });
    }
  };

  const currentStepIndex = Math.max(
    0,
    WIZARD_STEPS.findIndex((step) => step.id === activeTab)
  );
  const goToStep = (index: number) => {
    const step = WIZARD_STEPS[index];
    if (!step) return;
    setActiveTab(step.id);
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const planningAuthorityOptions = [...PLANNING_AUTHORITY_OPTIONS];

  const projectProponentOptions: string[] = [
    "BMC, Central Govt., State Govt., MHADA,Semi-Govt., Govt. Undertakings / Enterprises, Public Sector Undertakings (Special Cell )",
    "Private Owners / Developers (Building Proposal)",
    "Self-Development plot for Cooperative Housing Societies (CHS) under Single Window Clearance",
  ];

  const plotBelongsOptions = plotBelongsOptionsForRegionAndWard(selectedRegion, selectedWard);
  const regionOptions = ["City", "Western", "Eastern"];
  const allZoneOptions = [
    "Zone I",
    "Zone II",
    "Zone III",
    "Zone IV",
    "Zone V",
    "Zone VI",
    "Zone VII",
  ];
  // Ward options based on zone mapping
  const wardOptionsMap: Record<string, string[]> = {
    "Zone I": [
      "A Ward",
      "B Ward",
      "C Ward",
      "D Ward",
      "E Ward",
    ],
    "Zone II": [
      "F/N Ward",
      "F/S Ward",
      "G/N Ward",
      "G/S Ward",
    ],
    "Zone III": [
      "H/E Ward",
      "H/W Ward",
      "K/E Ward",
    ],
    "Zone IV": [
      "K/W Ward",
      "P/S Ward",
      "P/N Ward",
    ],
    "Zone V": [
      "L Ward",
      "M/E Ward",
      "M/W Ward",
    ],
    "Zone VI": [
      "N Ward",
      "S Ward",
      "T Ward",
    ],
    "Zone VII": [
      "R/N Ward",
      "R/C Ward",
      "R/S Ward",
    ],
  };
  // Village options per ward (mapped from DP2034 API)
  const villageOptionsByWard: Record<string, string[]> = {
    "A Ward": [
      "COLABA",
      "FORT",
    ],
    "B Ward": [
      "MANDVI",
      "PRINCESS DOCK",
    ],
    "C Ward": [
      "BHULESHWAR",
      "FORT",
      "GIRGAUM",
    ],
    "D Ward": [
      "GIRGAUM",
      "MALABAR HILL",
      "TARDEO",
    ],
    "E Ward": [
      "BYCULLA",
      "MAZAGAON",
    ],
    "F/N Ward": [
      "DADAR-NAIGAON",
      "MATUNGA",
      "SALT PAN",
      "SION",
    ],
    "F/S Ward": [
      "DADAR-NAIGAON",
      "PAREL-SEWERI",
    ],
    "G/N Ward": [
      "DHARAVI",
      "MAHIM",
      "PARIGHIKARI",
    ],
    "G/S Ward": [
      "LOWER PAREL",
      "MAHIM",
      "MALABAR HILL",
      "WORLI",
    ],
    "H/E Ward": [
      "BANDRA-A",
      "BANDRA-EAST",
      "BANDRA-I",
      "KOLEKALYAN",
      "KOLEKALYAN UNIVERSITY",
      "PARIGHIKARI",
      "VILE PARLE",
    ],
    "H/W Ward": [
      "BANDRA-A",
      "BANDRA-B",
      "BANDRA-C",
      "BANDRA-D",
      "BANDRA-E",
      "BANDRA-F",
      "BANDRA-G",
      "BANDRA-H",
      "JUHU",
      "VILE PARLE",
    ],
    "K/E Ward": [
      "ANDHERI",
      "BANDIVALI",
      "BAPNALA",
      "BRAMHANWADA",
      "CHAKALA",
      "GUNDAVALI",
      "ISMALIA",
      "KOLEKALYAN",
      "KONDIVATE",
      "MAJAS",
      "MAROL",
      "MOGRA",
      "MULGAON",
      "PRAJAPUR",
      "SAHAR",
      "TUNGWE",
      "VILE PARLE",
      "VYARAVLI",
    ],
    "K/W Ward": [
      "AMBIVALI",
      "ANDHERI",
      "BANDIVALI",
      "BANDRA-G",
      "JUHU",
      "MADH",
      "MAJAS",
      "MOGRA",
      "OSHIWARA",
      "VERSOVA",
      "VILE PARLE",
    ],
    "L Ward": [
      "ASALPE",
      "CHANDIVALI",
      "CHEMBUR",
      "KIROL",
      "KOLEKALYAN",
      "KURLA - 1",
      "KURLA - 2",
      "KURLA - 3",
      "KURLA - 4",
      "MAROL",
      "MOHILI",
      "PARIGHIKARI",
      "PASPOLI",
      "SAKI",
      "TUNGWE",
    ],
    "M/E Ward": [
      "ANIK",
      "BORLA",
      "DEONAR",
      "MAHUL",
      "MANDALE",
      "MANKHURD",
      "MARAVALI",
      "TURBHE",
      "WADHAVALI",
    ],
    "M/W Ward": [
      "ANIK",
      "BORLA",
      "CHEMBUR",
      "KIROL",
      "MAHUL",
      "MARAVALI",
      "WADHAVALI",
    ],
    "N Ward": [
      "ASALPE",
      "CHANDIVALI",
      "CHEMBUR",
      "GHATKOPAR",
      "GHATKOPAR KIROL",
      "HARIYALI-E",
      "HARIYALI-W",
      "KIROL",
      "POWAI",
      "VIKHROLI",
    ],
    "P/N Ward": [
      "AAKSE",
      "AAREY",
      "AKURLI",
      "CHARKOP",
      "CHINCHAVALI",
      "DARAVALI",
      "DINDOSHI",
      "ERANGAL",
      "KURAR",
      "MADH",
      "MALAD",
      "MALAD-E",
      "MALAD-NORTH",
      "MALAD-SOUTH",
      "MALVANI",
      "MANORI",
      "MARVE",
      "PAHADI GOREGAON-E",
      "PAHADI GOREGAON-W",
      "VALNAI",
      "WADHWAN",
    ],
    "P/S Ward": [
      "AAREY",
      "CHINCHAVALI",
      "DINDOSHI",
      "GOREGAON",
      "MALAD-E",
      "MALAD-SOUTH",
      "MAROL MAROSHI",
      "PAHADI EKSAR",
      "PAHADI GOREGAON-E",
      "PAHADI GOREGAON-W",
      "SAAI",
    ],
    "R/N Ward": [
      "BORIVALI",
      "DAHISAR",
      "EKSAR",
      "MANDPESHWAR-M",
      "MANDPESHWAR-N",
      "MANDPESHWAR-S",
    ],
    "R/C Ward": [
      "BORIVALI",
      "CHARKOP",
      "DAHISAR",
      "EKSAR",
      "GORAI",
      "KANDIVALI",
      "KANHERI",
      "MAGATHANE",
      "MANDPESHWAR-S",
      "MANORI",
      "POISAR",
      "SHIMPAWALI",
    ],
    "R/S Ward": [
      "AKURLI",
      "CHARKOP",
      "KANDIVALI",
      "MAGATHANE",
      "MALAD",
      "MALAD-E",
      "MALAD-NORTH",
      "MALVANI",
      "POISAR",
      "VALNAI",
      "WADHWAN",
    ],
    "S Ward": [
      "BHANDUP-E",
      "BHANDUP-W",
      "CHANDIVALI",
      "GHATKOPAR",
      "HARIYALI-E",
      "HARIYALI-W",
      "KANJUR-E",
      "KANJUR-W",
      "KOPRI",
      "MULUND-E",
      "NAHUR",
      "PASPOLI",
      "POWAI",
      "TIRANDAZ",
      "TUNGWE",
      "VIKHROLI",
    ],
    "T Ward": [
      "BHANDUP-E",
      "BHANDUP-W",
      "GUNDHGAON",
      "KLERABAD",
      "MULUND-E",
      "MULUND-W",
      "NAHUR",
      "SAAI",
      "TULSI",
    ],
  };

  /** CS/CTS: static ward list. F.P.No: TPS schemes from MapServer only (never use JSON village keys — those are CS/CTS). */
  const villageDivisionOrTpsOptions =
    selectedPlotBelongs === "F.P.No" && selectedWard
      ? fpTpsReady && fpTpsFromApi !== null
        ? fpTpsFromApi
        : []
      : (villageOptionsByWard[selectedWard as string] ?? []);

  // Simple placeholder CTS lists for each ward so the CTS dropdown is never empty
  const proposedCtsOptionsByWard: Record<string, string[]> = {
    "A Ward": ["CTS-A1", "CTS-A2"],
    "B Ward": ["CTS-B1", "CTS-B2"],
    "C Ward": ["CTS-C1", "CTS-C2"],
    "D Ward": ["CTS-D1", "CTS-D2"],
    "E Ward": ["CTS-E1", "CTS-E2"],
    "F/N Ward": ["CTS-FN1", "CTS-FN2"],
    "F/S Ward": ["CTS-FS1", "CTS-FS2"],
    "G/N Ward": ["CTS-GN1", "CTS-GN2"],
    "G/S Ward": ["CTS-GS1", "CTS-GS2"],
    "L Ward": ["CTS-L1", "CTS-L2"],
    "M/E Ward": ["CTS-ME1", "CTS-ME2"],
    "M/W Ward": ["CTS-MW1", "CTS-MW2"],
    "N Ward": ["CTS-N1", "CTS-N2"],
    "S Ward": ["CTS-S1", "CTS-S2"],
    "T Ward": ["CTS-T1", "CTS-T2"],
    "H/E Ward": ["CTS-HE1", "CTS-HE2"],
    "H/W Ward": ["CTS-HW1", "CTS-HW2"],
    "K/E Ward": ["CTS-KE1", "CTS-KE2"],
    "K/W Ward": ["CTS-KW1", "CTS-KW2"],
    "P/N Ward": ["CTS-PN1", "CTS-PN2"],
    "P/S Ward": ["CTS-PS1", "CTS-PS2"],
    "R/C Ward": ["CTS-RC1", "CTS-RC2"],
    "R/N Ward": ["CTS-RN1", "CTS-RN2"],
    "R/S Ward": ["CTS-RS1", "CTS-RS2"],
  };
  const plotTypeOptions = ["Select", "Corner Plot", "Regular Plot", "Narrow Plot"];
  const dpZoneLabelMap: Record<string, string> = {
    "1": "Residential Zone (R)",
    "2": "Commercial Zone (C)",
    "3": "Industrial Zone (I)",
    "4": "Special Development Zone (SDZ)",
    "5": "Port & Port Related Activities Zone (P)",
    "6": "Natural Areas (NA)",
    "7": "Green Zone (GZ)",
  };

  const majorUseOptions = (() => {
    const z = selectedDpZone as DpZone | undefined;
    if (!z || !(z in DP_ZONE_TO_MAJOR_USE_TO_SUB_USE)) return [];
    return Object.keys(DP_ZONE_TO_MAJOR_USE_TO_SUB_USE[z]).sort((a, b) => a.localeCompare(b));
  })();

  const plotSubUseOptions = (() => {
    const z = selectedDpZone as DpZone | undefined;
    if (!z || !(z in DP_ZONE_TO_MAJOR_USE_TO_SUB_USE)) return [];
    if (!selectedMajorUse) return [];
    return DP_ZONE_TO_MAJOR_USE_TO_SUB_USE[z]?.[selectedMajorUse] ?? [];
  })();

  // Show loading state while fetching project data
  if (isLoadingProject) {
    return (
      <div className="flex min-h-[320px] items-center justify-center py-10">
        <div className="text-center">
          <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-2 border-gray-200 border-t-brand-blue" />
          <p className="text-sm text-gray-500">Loading project data…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="pb-6">
      {/* Basic Details → Property Details */}
      <div>
        <div className="mb-5 overflow-x-auto pb-1">
          <WizardSteps
            steps={WIZARD_STEPS}
            currentStep={currentStepIndex}
            onStepClick={goToStep}
          />
        </div>

        {activeTab === "project-info" && (
          <form onSubmit={handleProjectSubmit(onProjectSubmit)}>
            <fieldset
              disabled={isReadOnlyMode}
              className={
                isReadOnlyMode
                  ? "[&_input]:cursor-not-allowed [&_textarea]:cursor-not-allowed [&_select]:cursor-not-allowed [&_button]:cursor-not-allowed [&_[role='button']]:cursor-not-allowed"
                  : ""
              }
            >
            <section className="pt-2">
              <div className="grid grid-cols-1 gap-x-5 gap-y-4 md:grid-cols-2">
            {/* Proposal is as per + Proposal No */}
              <div>
                <label className={labelClasses}>Proposal is as per</label>
                <div className="flex h-11 items-center gap-6">
                  <label className={radioLabelClasses}>
                    <input
                      {...registerProject("proposalAsPer")}
                      type="radio"
                      value="DCPR 2034"
                      defaultChecked
                      className={radioClasses}
                    />
                    DCPR 2034
                  </label>
                </div>
              </div>
              <div>
                <label className={labelClasses}>
                  Proposal No {requiredMark}
                </label>
                <input
                  {...registerProject("proposalNo", {
                    required: "Proposal number is required",
                  })}
                  type="text"
                  className={inputClasses}
                  placeholder="Enter proposal number"
                />
                {projectErrors.proposalNo && <p className={errorClasses}>{projectErrors.proposalNo.message}</p>}
              </div>

            {/* Title */}
            <div className="md:col-span-2">
                <label className={labelClasses}>
                Title {requiredMark}
              </label>
              <input
                  {...registerProject("title", {
                  required: "Title is required",
                })}
                type="text"
                  className={inputClasses}
                placeholder="Enter title"
              />
                {projectErrors.title && <p className={errorClasses}>{projectErrors.title.message}</p>}
            </div>

            {/* Property Address */}
              <div className="md:col-span-2">
                  <label className={labelClasses}>
                  Property Address {requiredMark}
                </label>
                <input
                    {...registerProject("propertyAddress", {
                    required: "Property Address is required",
                  })}
                  type="text"
                    className={inputClasses}
                  placeholder="Enter property address"
                />
                  {projectErrors.propertyAddress && (
                    <p className={errorClasses}>{projectErrors.propertyAddress.message}</p>
                )}
            </div>

            {/* File No & Pincode */}
              <div>
                  <label className={labelClasses}>Earlier Building Proposal File No.</label>
                <input
                    {...registerProject("earlierBuildingProposalFileNo")}
                  type="text"
                    className={inputClasses}
                  placeholder="Enter file number"
                />
              </div>

              <div>
                  <label className={labelClasses}>
                  Pincode {requiredMark}
                </label>
                <input
                    {...registerProject("pincode", {
                    required: "Pincode is required",
                    pattern: {
                      value: /^\d{6}$/,
                      message: "Pincode must be 6 digits",
                    },
                  })}
                  type="text"
                  maxLength={6}
                    className={inputClasses}
                  placeholder="Enter pincode"
                />
                  {projectErrors.pincode && (
                    <p className={errorClasses}>{projectErrors.pincode.message}</p>
                  )}
              </div>

            {/* Applicant name & address */}
              <div>
                  <label className={labelClasses}>
                  Full name of applicant {requiredMark}
                </label>
                <input
                    {...registerProject("fullNameOfApplicant", {
                    required: "Full name is required",
                  })}
                  type="text"
                  readOnly={!isEditMode}
                    className={isEditMode ? inputClasses : `${inputClasses} cursor-not-allowed bg-gray-100 text-gray-500`}
                  placeholder={isEditMode ? "Enter full name" : "Auto-filled from profile"}
                />
                  {projectErrors.fullNameOfApplicant && (
                    <p className={errorClasses}>{projectErrors.fullNameOfApplicant.message}</p>
                )}
              </div>

              <div>
                  <label className={labelClasses}>
                  Address of the applicant {requiredMark}
                </label>
                <input
                    {...registerProject("addressOfApplicant", {
                    required: "Address is required",
                  })}
                  type="text"
                  readOnly={!isEditMode}
                    className={isEditMode ? inputClasses : `${inputClasses} cursor-not-allowed bg-gray-100 text-gray-500`}
                  placeholder={isEditMode ? "Enter address" : "Auto-filled from profile"}
                />
                  {projectErrors.addressOfApplicant && (
                    <p className={errorClasses}>{projectErrors.addressOfApplicant.message}</p>
                )}
              </div>

            {/* Landmark and Property Tax */}
            <div>
                  <label className={labelClasses}>
                  Landmark {requiredMark}
                </label>
                <input
                    {...registerProject("landmark", {
                    required: "Landmark is required",
                  })}
                  type="text"
                    className={inputClasses}
                  placeholder="Enter landmark"
                />
                  {projectErrors.landmark && (
                    <p className={errorClasses}>{projectErrors.landmark.message}</p>
                  )}
              </div>

              <div className="flex flex-col">
                  <label className={labelClasses}>Have Paid Latest Current Year Property Tax?</label>
              <div className="flex h-11 items-center gap-6">
                    <label className={radioLabelClasses}>
                  <input
                        {...registerProject("hasPaidLatestPropertyTax")}
                    type="radio"
                    value="Yes"
                    className={radioClasses}
                  />
                  Yes
                </label>
                    <label className={radioLabelClasses}>
                  <input
                        {...registerProject("hasPaidLatestPropertyTax")}
                    type="radio"
                    value="No"
                    className={radioClasses}
                  />
                  No
                </label>
              </div>
              </div>
          </div>
        </section>
            </fieldset>

            <div className={footerBarClasses}>
              <button
                type="button"
                onClick={() => setShowLeaveConfirm(true)}
                className={secondaryBtnClasses}
              >
                Cancel
              </button>

                {!isReadOnlyMode && (
                  <button
                    type="submit"
                    className={`inline-flex min-h-10 items-center rounded-lg px-5 text-sm font-semibold ${
                      isProjectInfoSaved ? BTN_PRIMARY : BTN_SAVE_UNSAVED
                    }`}
                  >
                    {isProjectInfoSaved ? "Saved" : "Save"}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => goToStep(currentStepIndex + 1)}
                  className={primaryBtnClasses}
                >
                  Next
                  <ArrowRight className="h-4 w-4" />
                </button>
            </div>
          </form>
        )}

        {activeTab === "save-plot" && (
          <form onSubmit={handleSavePlotSubmit(onSavePlotSubmit)}>
            <fieldset
              disabled={isReadOnlyMode}
              className={
                isReadOnlyMode
                  ? "[&_input]:cursor-not-allowed [&_textarea]:cursor-not-allowed [&_select]:cursor-not-allowed [&_button]:cursor-not-allowed [&_[role='button']]:cursor-not-allowed"
                  : ""
              }
            >
            <section className="pt-2">
              <div className="space-y-6">
              <div className="space-y-4">
                <div>
                  <label className={labelClasses}>
                    Planning Authority for the project? {requiredMark}
                  </label>
                  <Controller
                    name="planningAuthority"
                    control={savePlotControl}
                    rules={{ required: "Please select a planning authority" }}
                    render={({ field, fieldState }) => (
                      <>
                        <div className="flex flex-wrap gap-4">
                          {planningAuthorityOptions.map((option, index) => (
                            <label key={option} className={radioLabelClasses}>
                              <input
                                type="radio"
                                name={field.name}
                                value={option}
                                checked={field.value === option}
                                onChange={() => field.onChange(option)}
                                onBlur={field.onBlur}
                                ref={index === 0 ? field.ref : undefined}
                                className={radioClasses}
                              />
                              {option}
                            </label>
                          ))}
                        </div>
                        {fieldState.error && (
                          <p className={errorClasses}>{fieldState.error.message}</p>
                        )}
                      </>
                    )}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-x-5 gap-y-4 md:grid-cols-2">
                <div>
                  <label className={labelClasses}>
                    Region {requiredMark}
                  </label>
                  <CustomSelect
                    value={watchSavePlot("region") || ""}
                    onChange={(val) => setSavePlotValue("region", val, { shouldValidate: true })}
                    options={regionOptions.map((option) => ({ value: option, label: option }))}
                    placeholder="----- Select Region -----"
                  />
                  {savePlotErrors.region && <p className={errorClasses}>{savePlotErrors.region.message}</p>}
                </div>
                <div>
                  <label className={labelClasses}>
                    Zone {requiredMark}
                  </label>
                  <CustomSelect
                    value={watchSavePlot("zone") || ""}
                    onChange={(val) => setSavePlotValue("zone", val, { shouldValidate: true })}
                    options={zoneOptions.map((option) => ({ value: option, label: option }))}
                    placeholder="----- Select Zone -----"
                    disabled={!selectedRegion}
                  />
                  {savePlotErrors.zone && <p className={errorClasses}>{savePlotErrors.zone.message}</p>}
                </div>
                <div>
                  <label className={labelClasses}>
                    Ward {requiredMark}
                  </label>
                  <CustomSelect
                    value={watchSavePlot("ward") || ""}
                    onChange={(val) => setSavePlotValue("ward", val, { shouldValidate: true })}
                    options={(wardOptionsMap[selectedZone as string] ?? []).map((option) => ({ value: option, label: option }))}
                    placeholder="----- Select Ward -----"
                    disabled={!selectedZone}
                  />
                  {savePlotErrors.ward && <p className={errorClasses}>{savePlotErrors.ward.message}</p>}
                </div>
                <div>
                  <label className={labelClasses}>
                    This plot belongs to {requiredMark}
                  </label>
                  {plotBelongsOptions.length === 0 ? (
                    <p className="py-2 text-sm text-gray-500">Select a region first.</p>
                  ) : (
                    <div className="flex min-h-11 flex-wrap items-center gap-4">
                      {plotBelongsOptions.map((option) => (
                        <label key={option} className={radioLabelClasses}>
                          <input
                            {...registerSavePlot("plotBelongsTo", { required: "Please select an option" })}
                            type="radio"
                            value={option}
                            className={radioClasses}
                          />
                          {option}
                        </label>
                      ))}
                    </div>
                  )}
                  {savePlotErrors.plotBelongsTo && (
                    <p className={errorClasses}>{savePlotErrors.plotBelongsTo.message}</p>
                  )}
                </div>
                <div>
                  <label className={labelClasses}>
                    {labelForVillageDivisionField(selectedPlotBelongs)}{" "}
                    {requiredMark}
                  </label>
                  <CustomSelect
                    value={watchSavePlot("villageName") || ""}
                    onChange={(val) => setSavePlotValue("villageName", val, { shouldValidate: true })}
                    options={villageDivisionOrTpsOptions.map((option) => ({ value: option, label: option }))}
                    placeholder={villageSelectPlaceholder(selectedPlotBelongs)}
                    disabled={
                      !selectedWard ||
                      (selectedPlotBelongs === "F.P.No" && Boolean(selectedWard) && !fpTpsReady)
                    }
                  />
                  {savePlotErrors.villageName && (
                    <p className={errorClasses}>{savePlotErrors.villageName.message}</p>
                  )}
                </div>
                <div>
                  <label className={labelClasses}>
                    {labelForSurveyField(selectedPlotBelongs)} {requiredMark}
                  </label>
                  <Controller
                    name="proposedCtsNumber"
                    control={savePlotControl}
                    rules={{
                      validate: (v) =>
                        Array.isArray(v) && v.length > 0
                          ? true
                          : validateSurveySelectionMessage(selectedPlotBelongs),
                    }}
                    render={({ field, fieldState }) => {
                      const current = Array.isArray(field.value) ? field.value : [];
                      const sortedOptions = [...new Set([...ctsNumbers, ...current])];
                      const surveyKindLabel = labelForSurveyField(selectedPlotBelongs);

                      const addSurveyNo = (surveyNo: string) => {
                        const cleaned = (surveyNo ?? "").trim();
                        if (!cleaned) return;
                        if (current.includes(cleaned)) return;
                        field.onChange([...current, cleaned]);
                      };

                      const removeSurveyNo = (surveyNo: string) => {
                        field.onChange(current.filter((x) => x !== surveyNo));
                      };

                      return (
                        <div>
                          <CustomSelect
                            value=""
                            onChange={(val) => {
                              addSurveyNo(val);
                            }}
                            options={sortedOptions.map((surveyNo) => ({ value: surveyNo, label: surveyNo }))}
                            placeholder={
                              sortedOptions.length === 0
                                ? emptySurveyOptionsMessage(selectedPlotBelongs)
                                : `----- Select ${surveyKindLabel} -----`
                            }
                            disabled={!selectedVillage || !selectedWard}
                          />

                          {selectedSurveyNos && Array.isArray(selectedSurveyNos) && selectedSurveyNos.length > 0 && (
                            <div className="mt-2 flex flex-wrap gap-2">
                              {selectedSurveyNos.map((surveyNo) => (
                                <span
                                  key={surveyNo}
                                  className={chipClasses}
                                >
                                  <span className="text-brand-navy">{surveyNo}</span>
                                  <button
                                    type="button"
                                    onClick={() => removeSurveyNo(surveyNo)}
                                    className="font-semibold text-gray-500 hover:text-status-danger"
                                    aria-label={`Remove ${surveyKindLabel} ${surveyNo}`}
                                  >
                                    ×
                                  </button>
                                </span>
                              ))}
                            </div>
                          )}

                          {fieldState.error?.message && (
                            <p className={errorClasses}>{fieldState.error.message}</p>
                          )}
                        </div>
                      );
                    }}
                  />
                </div>
              </div>


            <div className="grid grid-cols-1 gap-x-5 gap-y-4 md:grid-cols-2">
              <div>
                <label className={labelClasses}>
                  Gross Plot Area (Sq.m) {requiredMark}
                </label>
                <input
                  {...registerSavePlot("grossPlotArea", { required: "Gross plot area is required" })}
                  type="number"
                  step="any"
                  className={inputClasses}
                  placeholder="Enter area"
                />
                {savePlotErrors.grossPlotArea && (
                  <p className={errorClasses}>{savePlotErrors.grossPlotArea.message}</p>
                )}
              </div>
              <div>
                <label className={labelClasses}>
                  SAC Nos {requiredMark}
                </label>
                <Controller
                  name="sacNo"
                  control={savePlotControl}
                  rules={{
                    validate: (v) => {
                      if (!Array.isArray(v) || v.length === 0) {
                        return "Please add at least one SAC number";
                      }
                      const pattern = /^[A-Z]{2}\d{13}$/;
                      const invalid = v.find((value) => !pattern.test(value));
                      if (invalid) {
                        return "Each SAC number must be exactly 15 characters: 2 capital letters followed by 13 digits (e.g., AB1234567890123)";
                      }
                      return true;
                    },
                  }}
                  render={({ field }) => {
                    const current: string[] = Array.isArray(field.value) ? field.value : [];

                    const addSacNo = (raw: string): boolean => {
                      let value = (raw ?? "").trim();
                      if (!value) return false;

                      // Normalise: 2 letters + 13 digits, max 15 chars
                      const firstPart = value.substring(0, 2).replace(/[^A-Za-z]/g, "").toUpperCase();
                      const secondPart = value.substring(2).replace(/[^\d]/g, "");
                      value = (firstPart + secondPart).substring(0, 15);

                      // Only accept if it fully matches the SAC pattern
                      const pattern = /^[A-Z]{2}\d{13}$/;
                      if (!pattern.test(value)) {
                        setSavePlotError("sacNo", {
                          type: "manual",
                          message:
                            "SAC number must be exactly 15 characters: 2 capital letters followed by 13 digits (e.g., AB1234567890123)",
                        });
                        return false;
                      }

                      if (current.includes(value)) return false;
                      field.onChange([...current, value]);
                      // We have at least one valid SAC now; clear any previous error
                      clearSavePlotErrors("sacNo");
                      return true;
                    };

                    const removeSacNo = (sac: string) => {
                      field.onChange(current.filter((x) => x !== sac));
                    };

                    return (
                      <div>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            className={inputClasses}
                            placeholder="e.g., AB1234567890123"
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                const target = e.target as HTMLInputElement;
                                const added = addSacNo(target.value);
                                if (added) {
                                  target.value = "";
                                }
                              }
                            }}
                          />
                          <button
                            type="button"
                            className={`px-3 py-2 text-sm font-medium rounded-lg ${BTN_PRIMARY}`}
                            onClick={(event) => {
                              const input = (event.currentTarget.previousSibling as HTMLInputElement) || null;
                              if (input && input.value) {
                                const added = addSacNo(input.value);
                                if (added) {
                                  input.value = "";
                                }
                              }
                            }}
                          >
                            Add
                          </button>
                        </div>
                        {current.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-2">
                            {current.map((sac) => (
                              <span
                                key={sac}
                                className={chipClasses}
                              >
                                <span className="text-brand-navy">{sac}</span>
                                <button
                                  type="button"
                                  onClick={() => removeSacNo(sac)}
                                  className="font-semibold text-gray-500 hover:text-status-danger"
                                  aria-label={`Remove SAC ${sac}`}
                                >
                                  ×
                                </button>
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  }}
                />
                {savePlotErrors.sacNo && (
                  <p className={errorClasses}>{(savePlotErrors.sacNo as any).message}</p>
                )}
              </div>
              </div>

              <div className="grid grid-cols-1 gap-x-5 gap-y-4 md:grid-cols-2">
                <div>
                  <label className={labelClasses}>
                    Road / Street Name {requiredMark}
                  </label>
                  <input
                    {...registerSavePlot("roadName", { required: "Road / Street Name is required" })}
                    type="text"
                    className={inputClasses}
                    placeholder="Enter road or street name"
                  />
                  {savePlotErrors.roadName && (
                    <p className={errorClasses}>{savePlotErrors.roadName.message}</p>
                  )}
                </div>
                <div>
                  <label className={labelClasses}>
                    DP Zone {requiredMark}
                  </label>
                  <CustomSelect
                    value={watchSavePlot("dpZone") || ""}
                    onChange={(val) => setSavePlotValue("dpZone", val, { shouldValidate: true })}
                    options={DP_ZONE_OPTIONS.map((z) => ({ value: z, label: dpZoneLabelMap[z] ?? `DP Zone ${z}` }))}
                    placeholder="----- Select DP Zone -----"
                  />
                  {savePlotErrors.dpZone && (
                    <p className={errorClasses}>{savePlotErrors.dpZone.message}</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-x-5 gap-y-4 md:grid-cols-2">
                <div>
                  <label className={labelClasses}>
                    Major Use of Plot {requiredMark}
                  </label>
                  <CustomSelect
                    value={watchSavePlot("majorUseOfPlot") || ""}
                    onChange={(val) => setSavePlotValue("majorUseOfPlot", val, { shouldValidate: true })}
                    options={majorUseOptions.map((option) => ({ value: option, label: option }))}
                    placeholder="----- Select Major Use -----"
                    disabled={!selectedDpZone}
                  />
                  {savePlotErrors.majorUseOfPlot && (
                    <p className={errorClasses}>{savePlotErrors.majorUseOfPlot.message}</p>
                  )}
                </div>
                <div>
                  <label className={labelClasses}>
                    Plot SubUse {requiredMark}
                  </label>
                  <CustomSelect
                    value={watchSavePlot("plotSubUse") || ""}
                    onChange={(val) => setSavePlotValue("plotSubUse", val, { shouldValidate: true })}
                    options={plotSubUseOptions.map((option) => ({ value: option, label: option }))}
                    placeholder="----- Select Plot SubUse -----"
                    disabled={!selectedDpZone || !selectedMajorUse}
                  />
                  {savePlotErrors.plotSubUse && (
                    <p className={errorClasses}>{savePlotErrors.plotSubUse.message}</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-x-5 gap-y-4 md:grid-cols-2">
                <div>
                  <label className={labelClasses}>
                    Plot No. {requiredMark}
                  </label>
                  <input
                    {...registerSavePlot("plotNo", { required: "Plot number is required" })}
                    type="text"
                    className={inputClasses}
                    placeholder="Enter plot number"
                  />
                  {savePlotErrors.plotNo && <p className={errorClasses}>{savePlotErrors.plotNo.message}</p>}
                </div>
                <div>
                  <label className={labelClasses}>
                    Is Internal/Layout road present? {requiredMark}
                  </label>
                  <div className="flex gap-6">
                    {["Yes", "No"].map((option) => (
                      <label key={option} className={radioLabelClasses}>
                        <input
                          {...registerSavePlot("isInternalRoadPresent", { required: "Please select an option" })}
                          type="radio"
                          value={option}
                          className={radioClasses}
                />
                        {option}
                      </label>
                    ))}
                  </div>
                  {savePlotErrors.isInternalRoadPresent && (
                    <p className={errorClasses}>{savePlotErrors.isInternalRoadPresent.message}</p>
                  )}
              </div>
            </div>

            <div className="border-t border-gray-100 pt-5">
                  <p className="mb-3 text-sm font-bold text-brand-navy">Plot Abutting Details</p>
                  <div className="grid grid-cols-1 gap-x-5 gap-y-4 md:grid-cols-2">
                    <div>
                      <label className={labelClasses}>
                        Plot Type {requiredMark}
              </label>
                      <CustomSelect
                        value={watchSavePlot("plotType") || ""}
                        onChange={(val) => setSavePlotValue("plotType", val, { shouldValidate: true })}
                        options={plotTypeOptions.map((option) => ({ value: option, label: option }))}
                        placeholder="----- Select -----"
                      />
                      {savePlotErrors.plotType && (
                        <p className={errorClasses}>{savePlotErrors.plotType.message}</p>
              )}
                    </div>
                  </div>
            </div>
          </div>
        </section>
            </fieldset>

            <div className={footerBarClasses}>
              <button
                type="button"
                onClick={() => goToStep(currentStepIndex - 1)}
                className={`${secondaryBtnClasses} gap-2`}
              >
                <ArrowLeft className="h-4 w-4" />
                Back
              </button>
              <button
                type="button"
                onClick={() => setShowLeaveConfirm(true)}
                className={secondaryBtnClasses}
              >
                Cancel
              </button>
                {!isReadOnlyMode && (
                  <button
                    type="submit"
                    className={`inline-flex min-h-10 items-center rounded-lg px-5 text-sm font-semibold ${
                      isSavePlotSaved ? BTN_PRIMARY : BTN_SAVE_UNSAVED
                    }`}
                  >
                    {isSavePlotSaved ? "Saved" : "Save"}
                  </button>
                )}
            </div>
      </form>
        )}
      </div>

      <Modal
        open={showLeaveConfirm}
        onClose={() => setShowLeaveConfirm(false)}
        title={isEditMode ? "Leave Edit Project?" : "Leave Create Project?"}
        maxWidth="sm"
      >
        <p className="text-sm text-gray-600">
          {isEditMode
            ? "You have unsaved changes. Any information that has not been saved will be lost if you go back to the dashboard."
            : "You have not submitted this project. Any information that has not been saved will be lost if you go back to the dashboard."}
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={() => setShowLeaveConfirm(false)}
            className="inline-flex min-h-10 items-center rounded-lg border border-gray-200 bg-white px-4 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50"
          >
            Stay on this page
          </button>
          <button
            type="button"
            onClick={() => {
              setShowLeaveConfirm(false);
              router.push("/userdashboard");
            }}
            className="inline-flex min-h-10 items-center rounded-lg bg-brand-blue px-4 text-sm font-semibold text-white transition-colors hover:bg-brand-blue-hover"
          >
            Go to dashboard
          </button>
        </div>
      </Modal>
    </div>
  );
}

