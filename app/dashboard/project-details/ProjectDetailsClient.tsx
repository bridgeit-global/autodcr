"use client";

import { useEffect, useState, useRef } from "react";
import { useSearchParams, usePathname } from "next/navigation";
import { useForm, useFieldArray, Controller } from "react-hook-form";
import { loadDraft, saveDraft, markPageSaved, isPageSaved } from "@/app/utils/draftStorage";
import { getSurveyNumbersForVillageSync } from "@/app/utils/villageToSurveyNumbers";
import { supabase } from "@/app/utils/supabase";


type ProjectFormData = {
  proposalAsPer: "DCPR 2034";
  title: string;
  propertyAddress: string;
  landmark: string;
  earlierBuildingProposalFileNo: string;
  pincode: string;
  fullNameOfApplicant: string;
  addressOfApplicant: string;
  hasPaidLatestPropertyTax: "Yes" | "No" | "";
};

type SavePlotFormData = {
  planningAuthority: "BMC(BP)" | "BMC-TDR Generation & Transfer" | "Other" | "";
  projectProponent: string;
  region: string;
  zone: string;
  ward: string;
  proposedCtsNumber: string[]; // Survey Nos (multi-select)
  villageName: string;
  plotBelongsTo: "CTS No." | "CS No." | "F.P.No" | "";
  grossPlotArea: string;
  sacNo: string;
  roadName: string;
  dpZone: string;
  latitude: string;
  longitude: string;
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

export default function ProjectDetailsClient() {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const projectId = searchParams.get("projectId");
  
  // Only enable edit mode if we're on the project-details page and have a projectId
  const isProjectDetailsPage = pathname === "/dashboard/project-details";
  const isEditMode = isProjectDetailsPage && !!projectId;
  const [isLoadingProject, setIsLoadingProject] = useState(isEditMode);
  const [projectData, setProjectData] = useState<any>(null);
  
  const [activeTab, setActiveTab] = useState("save-plot");
  // Start as "not saved" so the buttons show Add/Update until user explicitly saves each tab.
  const [isProjectInfoSaved, setIsProjectInfoSaved] = useState(false);
  const [isSavePlotSaved, setIsSavePlotSaved] = useState(false);
  // Track initial load to prevent clearing fields during form initialization
  const [isInitialLoad, setIsInitialLoad] = useState(true);

  const inputClasses =
    "border border-gray-200 rounded-xl px-3 py-2 h-10 w-full text-gray-900 bg-white focus:ring-2 focus:ring-emerald-500 outline-none";
  const textareaClasses =
    "border border-gray-200 rounded-xl px-3 py-2 w-full text-gray-900 bg-white focus:ring-2 focus:ring-emerald-500 outline-none resize-none";

  const {
    register: registerProject,
    handleSubmit: handleProjectSubmit,
    formState: { errors: projectErrors },
    watch: watchProject,
    reset: resetProject,
    setValue: setProjectValue,
  } = useForm<ProjectFormData>({
    defaultValues: loadDraft<ProjectFormData>("draft-project-details-project", {
      proposalAsPer: "DCPR 2034",
      title: "",
      propertyAddress: "",
      landmark: "",
      earlierBuildingProposalFileNo: "",
      pincode: "",
      fullNameOfApplicant: "",
      addressOfApplicant: "",
      hasPaidLatestPropertyTax: "",
    }),
  });

  // Ensure "DCPR 2034" is selected by default
  useEffect(() => {
    setProjectValue("proposalAsPer", "DCPR 2034");
  }, [setProjectValue]);

  const {
    register: registerSavePlot,
    handleSubmit: handleSavePlotSubmit,
    control: savePlotControl,
    watch: watchSavePlot,
    getValues: getSavePlotValues,
    setValue: setSavePlotValue,
    formState: { errors: savePlotErrors },
    reset: resetSavePlot,
  } = useForm<SavePlotFormData>({
    defaultValues: (() => {
      const draft = loadDraft<any>("draft-project-details-save-plot", {
        planningAuthority: "",
        projectProponent: "",
        plotBelongsTo: "",
        region: "",
        zone: "",
        ward: "",
        villageName: "",
        proposedCtsNumber: [],
        grossPlotArea: "",
        sacNo: "",
        roadName: "",
        dpZone: "",
        latitude: "",
        longitude: "",
        majorUseOfPlot: "",
        plotSubUse: "",
        plotNo: "",
        isInternalRoadPresent: "",
        plotType: "",
        plotEntries: [{ ctsNumber: "", sacNumber: "", verifyPropertyTax: "", prCard: "" }],
      });

      // Back-compat: older drafts may have `proposedCtsNumber` as a string (single select)
      const raw = draft?.proposedCtsNumber;
      const normalizedProposedCtsNumber =
        Array.isArray(raw) ? raw.map(String) : typeof raw === "string" && raw ? [raw] : [];

      return {
        ...draft,
        proposedCtsNumber: normalizedProposedCtsNumber,
      } as SavePlotFormData;
    })(),
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
  const selectedVillage = watchSavePlot("villageName");
  const selectedSurveyNos = watchSavePlot("proposedCtsNumber");
  
  // Filter zones based on selected region
  const zoneOptions = selectedRegion && regionToZonesMap[selectedRegion]
    ? regionToZonesMap[selectedRegion]
    : [];
  
  // State to store CTS numbers from local mapping
  const [ctsNumbers, setCtsNumbers] = useState<string[]>([]);

  // Fetch project data when in edit mode
  useEffect(() => {
    if (!isEditMode || !projectId) return;

    const fetchProject = async () => {
      setIsLoadingProject(true);
      try {
        const { data, error } = await supabase
          .from("projects")
          .select("*")
          .eq("id", projectId)
          .single();

        if (error) {
          console.error("Error fetching project:", error);
          alert("Failed to load project data. Please try again.");
          return;
        }

        if (data) {
          setProjectData(data);
          
          // Map backend data to ProjectFormData structure
          const projectInfo = data.project_info || {};
          const projectFormData: ProjectFormData = {
            proposalAsPer: projectInfo.proposalAsPer === "DCR 1991" ? "DCPR 2034" : (projectInfo.proposalAsPer || "DCPR 2034"),
            title: data.title || "",
            propertyAddress: projectInfo.propertyAddress || "",
            landmark: projectInfo.landmark || "",
            earlierBuildingProposalFileNo: projectInfo.earlierBuildingProposalFileNo || "",
            pincode: projectInfo.pincode || "",
            fullNameOfApplicant: projectInfo.fullNameOfApplicant || "",
            addressOfApplicant: projectInfo.addressOfApplicant || "",
            hasPaidLatestPropertyTax: projectInfo.hasPaidLatestPropertyTax || "",
          };

          // Map backend data to SavePlotFormData structure
          const savePlotDetails = data.save_plot_details || {};
          
          // Debug: Log the raw data to see what we're getting
          console.log("[Edit Mode] Raw save_plot_details:", savePlotDetails);
          
          // Derive region from zone if region is missing (backward compatibility)
          // Also convert old zone format to new format if needed
          let zone = savePlotDetails.zone || "";
          zone = convertOldZoneToNew(zone); // Convert old zone names to new format
          const region = savePlotDetails.region || getRegionFromZone(zone);

          const savePlotFormData: SavePlotFormData = {
            planningAuthority: savePlotDetails.planningAuthority || "",
            projectProponent: savePlotDetails.projectProponent || "",
            region: region,
            zone: zone,
            ward: savePlotDetails.ward || "",
            proposedCtsNumber: Array.isArray(savePlotDetails.proposedCtsNumber) 
              ? savePlotDetails.proposedCtsNumber.map(String)
              : typeof savePlotDetails.proposedCtsNumber === "string" && savePlotDetails.proposedCtsNumber
              ? [savePlotDetails.proposedCtsNumber]
              : [],
            villageName: savePlotDetails.villageName || "",
            plotBelongsTo: savePlotDetails.plotBelongsTo || "",
            grossPlotArea: savePlotDetails.grossPlotArea || "",
            sacNo: savePlotDetails.sacNo || "",
            roadName: savePlotDetails.roadName || "",
            dpZone: savePlotDetails.dpZone || "",
            latitude: savePlotDetails.latitude || "",
            longitude: savePlotDetails.longitude || "",
            majorUseOfPlot: savePlotDetails.majorUseOfPlot || "",
            plotSubUse: savePlotDetails.plotSubUse || "",
            plotNo: savePlotDetails.plotNo || "",
            isInternalRoadPresent: savePlotDetails.isInternalRoadPresent || "",
            plotType: savePlotDetails.plotType || "",
            plotEntries: Array.isArray(savePlotDetails.plotEntries) && savePlotDetails.plotEntries.length > 0
              ? savePlotDetails.plotEntries
              : [{ ctsNumber: "", sacNumber: "", verifyPropertyTax: "", prCard: "" }],
          };

          // Debug: Log the form data we're about to set
          console.log("[Edit Mode] Setting form data:", {
            zone: savePlotFormData.zone,
            ward: savePlotFormData.ward,
            villageName: savePlotFormData.villageName,
            proposedCtsNumber: savePlotFormData.proposedCtsNumber,
            plotBelongsTo: savePlotFormData.plotBelongsTo,
          });
          
          // Set flag to prevent clearing effects during initial load - MUST be set before reset
          setIsInitialLoad(true);
          
          // Populate forms with fetched data using reset
          resetProject(projectFormData);
          resetSavePlot(savePlotFormData);
          
          // Save to localStorage drafts for consistency
          saveDraft("draft-project-details-project", projectFormData);
          saveDraft("draft-project-details-save-plot", savePlotFormData);
          
          // Use requestAnimationFrame and setTimeout to ensure reset has completed
          // Then set values explicitly to ensure watched values update and dropdowns show correct selections
          requestAnimationFrame(() => {
            setTimeout(() => {
              // Verify reset worked, then set values explicitly
              const currentValues = getSavePlotValues();
              console.log("[Edit Mode] Current form values after reset:", currentValues);
              
              // Set values explicitly to ensure watched values update
              // This is critical for dropdowns to show the selected values
              console.log("[Edit Mode] Setting zone:", savePlotFormData.zone);
              if (savePlotFormData.zone) {
                setSavePlotValue("zone", savePlotFormData.zone, { shouldValidate: false, shouldDirty: false, shouldTouch: false });
              }
              
              // Set ward after a small delay to ensure zone is set first
              setTimeout(() => {
                console.log("[Edit Mode] Setting ward:", savePlotFormData.ward);
                if (savePlotFormData.ward) {
                  setSavePlotValue("ward", savePlotFormData.ward, { shouldValidate: false, shouldDirty: false, shouldTouch: false });
                }
                
                // Set village after ward is set
                setTimeout(() => {
                  console.log("[Edit Mode] Setting village:", savePlotFormData.villageName);
                  if (savePlotFormData.villageName) {
                    setSavePlotValue("villageName", savePlotFormData.villageName, { shouldValidate: false, shouldDirty: false, shouldTouch: false });
                  }
                  if (savePlotFormData.proposedCtsNumber && savePlotFormData.proposedCtsNumber.length > 0) {
                    console.log("[Edit Mode] Setting CTS numbers:", savePlotFormData.proposedCtsNumber);
                    setSavePlotValue("proposedCtsNumber", savePlotFormData.proposedCtsNumber, { shouldValidate: false, shouldDirty: false, shouldTouch: false });
                  }
                  if (savePlotFormData.plotBelongsTo) {
                    setSavePlotValue("plotBelongsTo", savePlotFormData.plotBelongsTo, { shouldValidate: false, shouldDirty: false, shouldTouch: false });
                  }
                  
                  // Verify values are set
                  setTimeout(() => {
                    const finalValues = getSavePlotValues();
                    console.log("[Edit Mode] Final form values:", {
                      zone: finalValues.zone,
                      ward: finalValues.ward,
                      villageName: finalValues.villageName,
                      proposedCtsNumber: finalValues.proposedCtsNumber,
                    });
                  }, 100);
                  
                  // Get CTS numbers for the loaded village and ward from local mapping
                  if (savePlotFormData.villageName && savePlotFormData.ward) {
                    console.log("[Edit Mode] Getting CTS numbers for:", savePlotFormData.villageName, savePlotFormData.ward);
                    const numbers = getSurveyNumbersForVillageSync(
                      savePlotFormData.villageName,
                      savePlotFormData.ward
                    );
                    console.log("[Edit Mode] Got CTS numbers:", numbers);
                    setCtsNumbers(numbers);
                  }
                  
                  // Reset flag after all values are set
                  setTimeout(() => {
                    console.log("[Edit Mode] Clearing isInitialLoad flag");
                    setIsInitialLoad(false);
                  }, 300);
                }, 100);
              }, 100);
            }, 100);
          });
        }
      } catch (err) {
        console.error("Error fetching project:", err);
        alert("Failed to load project data. Please try again.");
      } finally {
        setIsLoadingProject(false);
      }
    };

    fetchProject();
  }, [projectId, isEditMode, resetProject, resetSavePlot]);

  // Set isInitialLoad to false after component mounts and form is ready
  // This allows initial values to display, but enables clearing when user changes fields
  useEffect(() => {
    // Give form time to initialize with default values or draft data
    const timer = setTimeout(() => {
      setIsInitialLoad(false);
    }, 500); // Small delay to ensure form values are set
    
    return () => clearTimeout(timer);
  }, []); // Only run once on mount

  // Persist drafts whenever forms change
  useEffect(() => {
    const subscription = watchProject((value) => {
      saveDraft("draft-project-details-project", value as ProjectFormData);
    });
    return () => subscription.unsubscribe();
  }, [watchProject]);

  useEffect(() => {
    const subscription = watchSavePlot((value) => {
      saveDraft("draft-project-details-save-plot", value as SavePlotFormData);
    });
    return () => subscription.unsubscribe();
  }, [watchSavePlot]);

  // Track previous region value to detect actual changes
  const prevRegionRef = useRef<string | undefined>(undefined);
  
  // When region changes: clear zone, ward, village, survey no, and CTS numbers
  useEffect(() => {
    // Skip clearing during initial data load or if region hasn't actually changed
    if (isInitialLoad) {
      prevRegionRef.current = selectedRegion;
      return;
    }
    
    // Only clear if region actually changed (not just on initial render)
    if (prevRegionRef.current !== undefined && prevRegionRef.current !== selectedRegion) {
      // Clear all dependent fields when region changes
      setSavePlotValue("zone", "", { shouldValidate: false });
      setSavePlotValue("ward", "", { shouldValidate: false });
      setSavePlotValue("villageName", "", { shouldValidate: false });
      setSavePlotValue("proposedCtsNumber", [], { shouldValidate: false });
      setSavePlotValue("plotBelongsTo", "", { shouldValidate: false });
      setCtsNumbers([]); // Clear CTS numbers state
    }
    
    prevRegionRef.current = selectedRegion;
  }, [selectedRegion, setSavePlotValue, isInitialLoad]);

  // Track previous zone value to detect actual changes (not just initial render)
  const prevZoneRef = useRef<string | undefined>(undefined);
  
  // When zone changes: clear ward, village, survey no, and CTS numbers
  useEffect(() => {
    // Skip clearing during initial data load or if zone hasn't actually changed
    if (isInitialLoad) {
      prevZoneRef.current = selectedZone;
      return;
    }
    
    // Only clear if zone actually changed (not just on initial render)
    if (prevZoneRef.current !== undefined && prevZoneRef.current !== selectedZone) {
      // Clear all dependent fields when zone changes
      setSavePlotValue("ward", "", { shouldValidate: false });
      setSavePlotValue("villageName", "", { shouldValidate: false });
      setSavePlotValue("proposedCtsNumber", [], { shouldValidate: false });
      setSavePlotValue("plotBelongsTo", "", { shouldValidate: false });
      setCtsNumbers([]); // Clear CTS numbers state
    }
    
    prevZoneRef.current = selectedZone;
  }, [selectedZone, setSavePlotValue, isInitialLoad]);

  // Auto-select plotBelongsTo based on zone and ward
  useEffect(() => {
    // Skip during initial data load
    if (isInitialLoad) return;
    
    // Only set if both zone and ward are selected (for Zone I/Zone II), or zone is selected (for other zones)
    if (!selectedZone) {
      return;
    }

    if (selectedZone === "Zone I") {
      // For Zone I, wait for ward to be selected (Zone I only has A, B, C, D, E wards)
      if (selectedWard) {
        setSavePlotValue("plotBelongsTo", "CS No.", { shouldValidate: false });
      } else {
        // Zone I selected but no ward yet - clear plotBelongsTo
        setSavePlotValue("plotBelongsTo", "", { shouldValidate: false });
      }
    } else if (selectedZone === "Zone II") {
      // For Zone II, wait for ward to be selected
      if (selectedWard) {
        if (selectedWard === "G/N Ward" || selectedWard === "G/S Ward") {
          setSavePlotValue("plotBelongsTo", "F.P.No", { shouldValidate: false });
        } else {
          // Zone II with F/N or F/S ward
          setSavePlotValue("plotBelongsTo", "CS No.", { shouldValidate: false });
        }
      } else {
        // Zone II selected but no ward yet - clear plotBelongsTo
        setSavePlotValue("plotBelongsTo", "", { shouldValidate: false });
      }
    } else {
      // Any zone other than Zone I or Zone II - set immediately
      setSavePlotValue("plotBelongsTo", "CTS No.", { shouldValidate: false });
    }
  }, [selectedZone, selectedWard, setSavePlotValue, isInitialLoad]);

  // Track previous ward value to detect actual changes
  const prevWardRef = useRef<string | undefined>(undefined);
  
  // When ward changes: clear village, survey no, and CTS numbers
  useEffect(() => {
    // Skip clearing during initial data load or if ward hasn't actually changed
    if (isInitialLoad) {
      prevWardRef.current = selectedWard;
      return;
    }
    
    // Only clear if ward actually changed (not just on initial render)
    if (prevWardRef.current !== undefined && prevWardRef.current !== selectedWard) {
      // Clear dependent fields when ward changes
      setSavePlotValue("villageName", "", { shouldValidate: false });
      setSavePlotValue("proposedCtsNumber", [], { shouldValidate: false });
      setCtsNumbers([]); // Clear CTS numbers state
    }
    
    prevWardRef.current = selectedWard;
  }, [selectedWard, setSavePlotValue, isInitialLoad]);

  // Track previous village value to detect actual changes
  const prevVillageRef = useRef<string | undefined>(undefined);
  
  // When village changes: clear survey no and CTS numbers
  useEffect(() => {
    // Skip clearing during initial data load or if village hasn't actually changed
    if (isInitialLoad) {
      prevVillageRef.current = selectedVillage;
      return;
    }
    
    // Only clear if village actually changed (not just on initial render)
    if (prevVillageRef.current !== undefined && prevVillageRef.current !== selectedVillage) {
      // Clear survey numbers when village changes
      setSavePlotValue("proposedCtsNumber", [], { shouldValidate: false });
      setCtsNumbers([]); // Clear CTS numbers state
    }
    
    prevVillageRef.current = selectedVillage;
  }, [selectedVillage, setSavePlotValue, isInitialLoad]);

  // Get CTS numbers from local mapping when village and ward are selected
  useEffect(() => {
    // Skip during initial load in edit mode (handled separately in fetchProject)
    if (isInitialLoad && isEditMode) {
      return;
    }

    if (!selectedVillage || !selectedWard) {
      setCtsNumbers([]);
      return;
    }

    // Get CTS numbers synchronously from local mapping
    const numbers = getSurveyNumbersForVillageSync(selectedVillage as string, selectedWard as string);
    
    // Only set if we got valid numbers (safety check)
    if (numbers && numbers.length > 0) {
      setCtsNumbers(numbers);
    } else {
      // Clear if no numbers found (village/ward combination might be invalid)
      setCtsNumbers([]);
    }
  }, [selectedVillage, selectedWard, isInitialLoad, isEditMode]);

  const onProjectSubmit = async (data: ProjectFormData) => {
    try {
      if (isEditMode && projectId) {
        // Get user_id from localStorage
        const userId = typeof window !== "undefined" ? window.localStorage.getItem("consultantId") : null;
        if (!userId) {
          alert("User not found in session. Please log in again.");
          return;
        }

        // Get auth token for authenticated request
        const { data: { session } } = await supabase.auth.getSession();
        const authToken = session?.access_token;
        
        const headers: HeadersInit = { "Content-Type": "application/json" };
        if (authToken) {
          headers["Authorization"] = `Bearer ${authToken}`;
        }

        // Update existing project
        const response = await fetch(`/api/projects/${projectId}`, {
          method: "PUT",
          headers,
          body: JSON.stringify({
            user_id: userId,
            project_info: data,
          }),
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || "Failed to update project");
        }

        alert("Project details updated successfully!");
      } else {
        // Create mode - just save to localStorage (existing behavior)
        console.log("Project Data:", data);
        alert("Project details saved successfully!");
      }
      markPageSaved("saved-project-info");
      setIsProjectInfoSaved(true);
    } catch (error: any) {
      console.error("Error saving project:", error);
      alert(error.message || "Failed to save project details. Please try again.");
    }
  };

  const onSavePlotSubmit = async (data: SavePlotFormData) => {
    try {
      if (isEditMode && projectId) {
        // Get user_id from localStorage
        const userId = typeof window !== "undefined" ? window.localStorage.getItem("consultantId") : null;
        if (!userId) {
          alert("User not found in session. Please log in again.");
          return;
        }

        // Get auth token for authenticated request
        const { data: { session } } = await supabase.auth.getSession();
        const authToken = session?.access_token;
        
        const headers: HeadersInit = { "Content-Type": "application/json" };
        if (authToken) {
          headers["Authorization"] = `Bearer ${authToken}`;
        }

        // Update existing project
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

        alert("Save plot details updated successfully!");
      } else {
        // Create mode - just save to localStorage (existing behavior)
        console.log("Save Plot Data:", data);
        alert("Save plot details saved successfully!");
      }
      markPageSaved("saved-save-plot-details");
      setIsSavePlotSaved(true);
    } catch (error: any) {
      console.error("Error saving plot details:", error);
      alert(error.message || "Failed to save plot details. Please try again.");
    }
  };

  const tabs = [
    { id: "save-plot", label: "Save Plot Details" },
    { id: "project-info", label: "Project Info" },
  ];

  const planningAuthorityOptions: SavePlotFormData["planningAuthority"][] = [
    "BMC(BP)",
    "BMC-TDR Generation & Transfer",
    "Other",
  ];

  const projectProponentOptions: string[] = [
    "BMC, Central Govt., State Govt., MHADA,Semi-Govt., Govt. Undertakings / Enterprises, Public Sector Undertakings (Special Cell )",
    "Private Owners / Developers (Building Proposal)",
    "Self-Development plot for Cooperative Housing Societies (CHS) under Single Window Clearance",
  ];

  const plotBelongsOptions: SavePlotFormData["plotBelongsTo"][] = ["CTS No.", "CS No.", "F.P.No"];
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
  const majorUseOptions = ["General Category", "Residential", "Commercial", "Industrial"];
  const plotSubUseOptions = ["Select SubUse", "Residential Low Rise", "Residential High Rise", "Commercial Retail"];
  const plotTypeOptions = ["Select", "Corner Plot", "Regular Plot", "Narrow Plot"];

  // Show loading state while fetching project data
  if (isLoadingProject) {
    return (
      <div className="max-w-6xl mx-auto px-6 pt-8 space-y-6">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading project data...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-6 pt-8 space-y-6">
      {/* Warning Message */}
      <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-md shadow-sm">
        <p className="text-sm text-red-700">
          <strong>Note:</strong> Dear Applicant, you will not be able to edit project if any application submitted for
          this Project. You can edit / add information before submitting any application.
        </p>
      </div>

      {/* Sub-navigation Tabs (scrolls like the note section) */}
      <section className="border border-gray-200 rounded-2xl bg-white shadow-sm">
        <div className="p-4">
          <div className="inline-flex rounded-xl border border-gray-200 bg-gray-50 p-1">
            {tabs.map((tab) => {
              const isActive = activeTab === tab.id;
              return (
              <button
                key={tab.id}
                  type="button"
                onClick={() => setActiveTab(tab.id)}
                  className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                    isActive
                    ? "bg-white text-emerald-700 shadow-sm ring-1 ring-gray-200"
                    : "text-gray-700 hover:text-gray-900 hover:bg-white/70"
                  }`}
              >
                {tab.label}
              </button>
              );
            })}
          </div>
      </div>
      </section>

      <div className="space-y-6">
        {activeTab === "project-info" && (
          <form onSubmit={handleProjectSubmit(onProjectSubmit)}>
            <section className="border border-gray-200 rounded-2xl p-6 bg-white shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-4 border-b border-gray-200 pb-4">
            <div>
                  <h2 className="text-xl font-bold text-black">Project Details</h2>
                  <p className="text-sm text-black mt-1">
                Keep the inputs consistent with your registered application to avoid review delays.
              </p>
            </div>

            <button
              type="submit"
              className={`px-6 py-2 rounded-lg font-semibold shadow transition-colors ${
                isProjectInfoSaved
                  ? "bg-emerald-700 hover:bg-emerald-800 text-white"
                  : "bg-emerald-200 hover:bg-emerald-300 text-emerald-800"
              }`}
            >
              {isEditMode 
                ? (isProjectInfoSaved ? "Updated" : "Update")
                : (isProjectInfoSaved ? "Added" : "Add")
              }
            </button>
          </div>

              <div className="pt-6 space-y-6">
            {/* Proposal is as per */}
            <div>
                <label className="block font-medium text-black mb-1">Proposal is as per</label>
              <div className="flex gap-6">
                  <label className="flex items-center gap-2 text-sm text-black">
                  <input
                      {...registerProject("proposalAsPer")}
                    type="radio"
                    value="DCPR 2034"
                    defaultChecked
                    className="w-4 h-4 text-emerald-600 focus:ring-emerald-500"
                  />
                  DCPR 2034
                </label>
              </div>
            </div>

            {/* Title */}
            <div>
                <label className="block font-medium text-black mb-1">
                Title <span className="text-red-500">*</span>
              </label>
              <p className="text-xs text-gray-500 mb-2">(Note:[, ], - characters are not allowed in title.)</p>
              <input
                  {...registerProject("title", {
                  required: "Title is required",
                  pattern: {
                    value: /^[^\[\]-]+$/,
                    message: "Characters [, ], - are not allowed",
                  },
                })}
                type="text"
                  className={inputClasses}
                placeholder="Enter title"
              />
                {projectErrors.title && <p className="text-red-600 text-sm mt-1">{projectErrors.title.message}</p>}
            </div>

            {/* Property Address */}
              <div>
                  <label className="block font-medium text-black mb-1">
                  Property Address <span className="text-red-500">*</span>
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
                    <p className="text-red-600 text-sm mt-1">{projectErrors.propertyAddress.message}</p>
                )}
            </div>

            {/* File No & Pincode */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                  <label className="block font-medium text-black mb-1">Earlier Building Proposal File No.</label>
                <input
                    {...registerProject("earlierBuildingProposalFileNo")}
                  type="text"
                    className={inputClasses}
                  placeholder="Enter file number"
                />
              </div>

              <div>
                  <label className="block font-medium text-black mb-1">
                  Pincode <span className="text-red-500">*</span>
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
                    <p className="text-red-600 text-sm mt-1">{projectErrors.pincode.message}</p>
                  )}
              </div>
            </div>

            {/* Applicant name & address */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                  <label className="block font-medium text-black mb-1">
                  Full name of applicant <span className="text-red-500">*</span>
                </label>
                <input
                    {...registerProject("fullNameOfApplicant", {
                    required: "Full name is required",
                  })}
                  type="text"
                    className={inputClasses}
                  placeholder="Enter full name"
                />
                  {projectErrors.fullNameOfApplicant && (
                    <p className="text-red-600 text-sm mt-1">{projectErrors.fullNameOfApplicant.message}</p>
                )}
              </div>

              <div>
                  <label className="block font-medium text-black mb-1">
                  Address of the applicant <span className="text-red-500">*</span>
                </label>
                <input
                    {...registerProject("addressOfApplicant", {
                    required: "Address is required",
                  })}
                  type="text"
                    className={inputClasses}
                  placeholder="Enter address"
                />
                  {projectErrors.addressOfApplicant && (
                    <p className="text-red-600 text-sm mt-1">{projectErrors.addressOfApplicant.message}</p>
                )}
              </div>
            </div>

            {/* Landmark and Property Tax */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
            <div>
                  <label className="block font-medium text-black mb-1">
                  Landmark <span className="text-red-500">*</span>
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
                    <p className="text-red-600 text-sm mt-1">{projectErrors.landmark.message}</p>
                  )}
              </div>

              <div className="flex flex-col">
                  <label className="block font-medium text-black mb-1 mt-2">Have Paid Latest Current Year Property Tax?</label>
              <div className="flex gap-6 mt-0">
                    <label className="flex items-center gap-2 text-sm text-black">
                  <input
                        {...registerProject("hasPaidLatestPropertyTax")}
                    type="radio"
                    value="Yes"
                    className="w-4 h-4 text-emerald-600 focus:ring-emerald-500"
                  />
                  Yes
                </label>
                    <label className="flex items-center gap-2 text-sm text-black">
                  <input
                        {...registerProject("hasPaidLatestPropertyTax")}
                    type="radio"
                    value="No"
                    className="w-4 h-4 text-emerald-600 focus:ring-emerald-500"
                  />
                  No
                </label>
              </div>
              </div>
            </div>
          </div>
        </section>
          </form>
        )}

        {activeTab === "save-plot" && (
          <form onSubmit={handleSavePlotSubmit(onSavePlotSubmit)}>
            <section className="border border-gray-200 rounded-2xl bg-white flex flex-col shadow-sm overflow-hidden">
              {/* Header (scrolls with content) */}
              <div className="bg-white border-b border-gray-200 p-4 flex flex-wrap items-center justify-between gap-4 rounded-t-2xl">
                <div>
                  <h2 className="text-xl font-bold text-black">Save Plot Details</h2>
                  <p className="text-sm text-black mt-1">Provide comprehensive plot details for this application.</p>
                </div>

                <button
                  type="submit"
              className={`px-6 py-2 rounded-lg font-semibold shadow transition-colors ${
                isSavePlotSaved
                  ? "bg-emerald-700 hover:bg-emerald-800 text-white"
                  : "bg-emerald-200 hover:bg-emerald-300 text-emerald-800"
              }`}
            >
              {isEditMode 
                ? (isSavePlotSaved ? "Updated" : "Update")
                : (isSavePlotSaved ? "Added" : "Add")
              }
                </button>
              </div>

              <div className="pt-6 space-y-8 px-4 pb-4">
              <div className="space-y-4">
                <div>
                  <label className="block font-medium text-black mb-1">
                    Planning Authority for the project? <span className="text-red-500">*</span>
                  </label>
                  <div className="flex flex-wrap gap-4">
                    {planningAuthorityOptions.map((option) => (
                      <label key={option} className="flex items-center gap-2 text-sm text-black">
                        <input
                          {...registerSavePlot("planningAuthority", {
                            required: "Please select a planning authority",
                          })}
                          type="radio"
                          value={option}
                          className="w-4 h-4 text-emerald-600 focus:ring-emerald-500"
                        />
                        {option}
                      </label>
                    ))}
                  </div>
                  {savePlotErrors.planningAuthority && (
                    <p className="text-red-600 text-sm mt-1">{savePlotErrors.planningAuthority.message}</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block font-medium text-black mb-1">
                    Region <span className="text-red-500">*</span>
                  </label>
                  <select
                    {...registerSavePlot("region", { required: "Region is required" })}
                    className={inputClasses}
                  >
                    <option value="">----- Select Region -----</option>
                    {regionOptions.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                  {savePlotErrors.region && <p className="text-red-600 text-sm mt-1">{savePlotErrors.region.message}</p>}
                </div>
                <div>
                  <label className="block font-medium text-black mb-1">
                    Zone <span className="text-red-500">*</span>
                  </label>
                  <select
                    {...registerSavePlot("zone", { required: "Zone is required" })}
                    className={inputClasses}
                    disabled={!selectedRegion}
                  >
                    <option value="">----- Select Zone -----</option>
                    {zoneOptions.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                  {savePlotErrors.zone && <p className="text-red-600 text-sm mt-1">{savePlotErrors.zone.message}</p>}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block font-medium text-black mb-1">
                    Ward <span className="text-red-500">*</span>
                  </label>
                  <select
                    {...registerSavePlot("ward", { required: "Ward is required" })}
                    className={inputClasses}
                    disabled={!selectedZone}
                  >
                    <option value="">----- Select Ward -----</option>
                    {(wardOptionsMap[selectedZone as string] ?? []).map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                  {savePlotErrors.ward && <p className="text-red-600 text-sm mt-1">{savePlotErrors.ward.message}</p>}
                </div>
                <div>
                  <label className="block font-medium text-black mb-1">
                    This plot belongs to <span className="text-red-500">*</span>
                  </label>
                  <div className="flex flex-wrap gap-4 items-center">
                    {plotBelongsOptions.map((option) => (
                      <label key={option} className="flex items-center gap-2 text-sm text-black">
                        <input
                          {...registerSavePlot("plotBelongsTo", { required: "Please select an option" })}
                          type="radio"
                          value={option}
                          className="w-4 h-4 text-emerald-600 focus:ring-emerald-500"
                        />
                        {option}
                      </label>
                    ))}
                  </div>
                  {savePlotErrors.plotBelongsTo && (
                    <p className="text-red-600 text-sm mt-1">{savePlotErrors.plotBelongsTo.message}</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block font-medium text-black mb-1">
                    Village/Division <span className="text-red-500">*</span>
                  </label>
                  <select
                    {...registerSavePlot("villageName", { required: "Village name is required" })}
                    className={inputClasses}
                    disabled={!selectedWard}
                  >
                    <option value="">----- Select Village -----</option>
                    {(villageOptionsByWard[selectedWard as string] ?? []).map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                  {savePlotErrors.villageName && (
                    <p className="text-red-600 text-sm mt-1">{savePlotErrors.villageName.message}</p>
                  )}
                </div>
                <div>
                  <label className="block font-medium text-black mb-1">
                    Survey No <span className="text-red-500">*</span>
                  </label>
                  <Controller
                    name="proposedCtsNumber"
                    control={savePlotControl}
                    rules={{
                      validate: (v) =>
                        Array.isArray(v) && v.length > 0 ? true : "Please select at least one survey number",
                    }}
                    render={({ field, fieldState }) => {
                      // Use CTS numbers from API (already sorted)
                      const sortedOptions = ctsNumbers;
                      const current = Array.isArray(field.value) ? field.value : [];

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
                          <select
                            className={inputClasses}
                            disabled={!selectedVillage || !selectedWard}
                            value=""
                            onChange={(e) => {
                              addSurveyNo(e.target.value);
                            }}
                          >
                          <option value="">
                            {sortedOptions.length === 0 
                              ? "No CTS numbers found" 
                              : "----- Select Survey No -----"}
                          </option>
                            {sortedOptions.map((surveyNo) => (
                              <option key={surveyNo} value={surveyNo}>
                                {surveyNo}
                              </option>
                            ))}
                          </select>

                          {selectedSurveyNos && Array.isArray(selectedSurveyNos) && selectedSurveyNos.length > 0 && (
                            <div className="mt-2 flex flex-wrap gap-2">
                              {selectedSurveyNos.map((surveyNo) => (
                                <span
                                  key={surveyNo}
                                  className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-gray-200 text-sm bg-white"
                                >
                                  <span className="text-black">{surveyNo}</span>
                                  <button
                                    type="button"
                                    onClick={() => removeSurveyNo(surveyNo)}
                                    className="text-gray-700 hover:text-red-700 font-semibold"
                                    aria-label={`Remove survey number ${surveyNo}`}
                                  >
                                    ×
                                  </button>
                                </span>
                              ))}
                            </div>
                          )}

                          {fieldState.error?.message && (
                            <p className="text-red-600 text-sm mt-1">{fieldState.error.message}</p>
                          )}
                        </div>
                      );
                    }}
                  />
                </div>
              </div>


            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                  <label className="block font-medium text-black mb-1">
                    Gross Plot Area (Sq.m) <span className="text-red-500">*</span>
                </label>
                <input
                    {...registerSavePlot("grossPlotArea", { required: "Gross plot area is required" })}
                  type="number"
                    step="any"
                    className={inputClasses}
                    placeholder="Enter area"
                />
                  {savePlotErrors.grossPlotArea && (
                    <p className="text-red-600 text-sm mt-1">{savePlotErrors.grossPlotArea.message}</p>
                  )}
                </div>
                <div>
                  <label className="block font-medium text-black mb-1">
                    SAC No <span className="text-red-500">*</span>
                  </label>
                  <Controller
                    name="sacNo"
                    control={savePlotControl}
                    rules={{
                      required: "SAC number is required",
                      minLength: { value: 15, message: "SAC number must be exactly 15 characters" },
                      maxLength: { value: 15, message: "SAC number must be exactly 15 characters" },
                      pattern: {
                        value: /^[A-Z]{2}\d{13}$/,
                        message: "SAC number must start with 2 capital letters followed by 13 digits (e.g., AB1234567890123)",
                      },
                    }}
                    render={({ field }) => (
                      <input
                        {...field}
                        type="text"
                        className={inputClasses}
                        placeholder="e.g., AB1234567890123"
                        onChange={(e) => {
                          let value = e.target.value;
                          // Convert first 2 characters to uppercase and only allow letters
                          if (value.length > 0) {
                            const firstPart = value.substring(0, 2).replace(/[^A-Za-z]/g, '').toUpperCase();
                            // For characters after position 2, only allow digits
                            const secondPart = value.substring(2).replace(/[^\d]/g, '');
                            // Limit to 15 characters total
                            value = (firstPart + secondPart).substring(0, 15);
                            field.onChange(value);
                          } else {
                            field.onChange(value);
                          }
                        }}
                      />
                    )}
                  />
                  {savePlotErrors.sacNo && (
                    <p className="text-red-600 text-sm mt-1">{savePlotErrors.sacNo.message}</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block font-medium text-black mb-1">
                    Road / Street Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    {...registerSavePlot("roadName", { required: "Road / Street Name is required" })}
                    type="text"
                    className={inputClasses}
                    placeholder="Enter road or street name"
                  />
                  {savePlotErrors.roadName && (
                    <p className="text-red-600 text-sm mt-1">{savePlotErrors.roadName.message}</p>
                  )}
                </div>
                <div>
                  <label className="block font-medium text-black mb-1">
                    DP Zone <span className="text-red-500">*</span>
                  </label>
                  <input
                    {...registerSavePlot("dpZone", { required: "DP Zone is required" })}
                    type="text"
                    className={inputClasses}
                    placeholder="Enter DP Zone"
                  />
                  {savePlotErrors.dpZone && (
                    <p className="text-red-600 text-sm mt-1">{savePlotErrors.dpZone.message}</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block font-medium text-black mb-1">
                    Latitude <span className="text-red-500">*</span>
                  </label>
                  <input
                    {...registerSavePlot("latitude", {
                      required: "Latitude is required",
                      pattern: {
                        value: /^\d{1,2}\s+\d{1,2}\s+\d{1,2}(\.\d{1,2})?[NS]$/i,
                        message: "Latitude must be in DMS format: DD MM SS.ssN (e.g., 19 04 38.24N)",
                      },
                    })}
                    type="text"
                    className={inputClasses}
                    placeholder="e.g., 19 04 38.24N"
                  />
                  <p className="text-xs text-gray-500 mt-1">Format: Degrees Minutes Seconds.ddN/S</p>
                  {savePlotErrors.latitude && (
                    <p className="text-red-600 text-sm mt-1">{savePlotErrors.latitude.message}</p>
                  )}
                </div>
              <div>
                  <label className="block font-medium text-black mb-1">
                    Longitude <span className="text-red-500">*</span>
                </label>
                <input
                    {...registerSavePlot("longitude", {
                      required: "Longitude is required",
                      pattern: {
                        value: /^\d{1,3}\s+\d{1,2}\s+\d{1,2}(\.\d{1,2})?[EW]$/i,
                        message: "Longitude must be in DMS format: DDD MM SS.ssE (e.g., 72 52 56.84E)",
                      },
                    })}
                    type="text"
                    className={inputClasses}
                    placeholder="e.g., 72 52 56.84E"
                  />
                  <p className="text-xs text-gray-500 mt-1">Format: Degrees Minutes Seconds.ddE/W</p>
                  {savePlotErrors.longitude && (
                    <p className="text-red-600 text-sm mt-1">{savePlotErrors.longitude.message}</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block font-medium text-black mb-1">
                    Major Use of Plot <span className="text-red-500">*</span>
                  </label>
                  <select
                    {...registerSavePlot("majorUseOfPlot", { required: "Select major use" })}
                    className={inputClasses}
                  >
                    <option value="">----- Select Major Use -----</option>
                    {majorUseOptions.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                  {savePlotErrors.majorUseOfPlot && (
                    <p className="text-red-600 text-sm mt-1">{savePlotErrors.majorUseOfPlot.message}</p>
                  )}
                </div>
                <div>
                  <label className="block font-medium text-black mb-1">
                    Plot SubUse <span className="text-red-500">*</span>
                  </label>
                  <select
                    {...registerSavePlot("plotSubUse", { required: "Select subuse" })}
                    className={inputClasses}
                  >
                    <option value="">----- Select Plot SubUse -----</option>
                    {plotSubUseOptions.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                  {savePlotErrors.plotSubUse && (
                    <p className="text-red-600 text-sm mt-1">{savePlotErrors.plotSubUse.message}</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block font-medium text-black mb-1">
                    Plot No. <span className="text-red-500">*</span>
                  </label>
                  <input
                    {...registerSavePlot("plotNo", { required: "Plot number is required" })}
                    type="text"
                    className={inputClasses}
                    placeholder="Enter plot number"
                  />
                  {savePlotErrors.plotNo && <p className="text-red-600 text-sm mt-1">{savePlotErrors.plotNo.message}</p>}
                </div>
                <div>
                  <label className="block font-medium text-black mb-2">
                    Is Internal/Layout road present? <span className="text-red-500">*</span>
                  </label>
                  <div className="flex gap-6">
                    {["Yes", "No"].map((option) => (
                      <label key={option} className="flex items-center gap-2 text-sm text-black">
                        <input
                          {...registerSavePlot("isInternalRoadPresent", { required: "Please select an option" })}
                          type="radio"
                          value={option}
                          className="w-4 h-4 text-emerald-600 focus:ring-emerald-500"
                />
                        {option}
                      </label>
                    ))}
                  </div>
                  {savePlotErrors.isInternalRoadPresent && (
                    <p className="text-red-600 text-sm mt-1">{savePlotErrors.isInternalRoadPresent.message}</p>
                  )}
              </div>
            </div>

            <div>
                  <p className="font-semibold text-black mb-2">Plot Abutting Details:</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block font-medium text-black mb-1">
                        Plot Type <span className="text-red-500">*</span>
              </label>
                      <select
                        {...registerSavePlot("plotType", { required: "Select plot type" })}
                        className={inputClasses}
                      >
                        <option value="">----- Select -----</option>
                        {plotTypeOptions.map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                      </select>
                      {savePlotErrors.plotType && (
                        <p className="text-red-600 text-sm mt-1">{savePlotErrors.plotType.message}</p>
              )}
                    </div>
                  </div>
            </div>
          </div>
        </section>
      </form>
        )}
      </div>
    </div>
  );
}

