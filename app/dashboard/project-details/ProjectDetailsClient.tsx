"use client";

import { useEffect, useState } from "react";
import { useForm, useFieldArray, Controller } from "react-hook-form";
import { loadDraft, saveDraft, markPageSaved, isPageSaved } from "@/app/utils/draftStorage";
import { addressOptionsByVillage } from "@/app/utils/villageAddresses";
import { addressToSurveyNumbers } from "@/app/utils/addressToSurveyNumbers";
import { addressToRateDetails, type AddressRateDetails } from "@/app/utils/addressToRateDetails";

// Helper function to normalize address for lookup (removes trailing periods and normalizes whitespace)
function normalizeAddressForLookup(address: string): string {
  return address.trim().replace(/\.+$/, "").replace(/\s+/g, " ");
}

// Helper function to get survey numbers for an address, handling normalization
function getSurveyNumbersForAddress(address: string): string[] {
  if (!address) return [];
  
  // Try exact match first
  if (addressToSurveyNumbers[address]) {
    return addressToSurveyNumbers[address];
  }
  
  // Try normalized match (without trailing period)
  const normalized = normalizeAddressForLookup(address);
  if (addressToSurveyNumbers[normalized]) {
    return addressToSurveyNumbers[normalized];
  }
  
  // Try with trailing period added
  if (addressToSurveyNumbers[normalized + "."]) {
    return addressToSurveyNumbers[normalized + "."];
  }
  
  return [];
}

function getRateDetailsForAddress(address: string): AddressRateDetails | null {
  if (!address) return null;

  if (addressToRateDetails[address]) {
    return addressToRateDetails[address];
  }

  const normalized = normalizeAddressForLookup(address);
  if (addressToRateDetails[normalized]) {
    return addressToRateDetails[normalized];
  }

  if (addressToRateDetails[normalized + "."]) {
    return addressToRateDetails[normalized + "."];
  }

  return null;
}

type ProjectFormData = {
  proposalAsPer: "DCR 1991" | "DCPR 2034" | "";
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
  zone: string;
  ward: string;
  proposedCtsNumber: string[]; // Survey Nos (multi-select)
  villageName: string;
  address: string;
  // Derived from `mumbai_main.csv` for the selected Address
  addressRateDetails: (AddressRateDetails & { address: string }) | null;
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
  const [activeTab, setActiveTab] = useState("save-plot");
  const [isProjectInfoSaved, setIsProjectInfoSaved] = useState(() => isPageSaved("saved-project-info"));
  const [isSavePlotSaved, setIsSavePlotSaved] = useState(() => isPageSaved("saved-save-plot-details"));

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
  } = useForm<ProjectFormData>({
    defaultValues: loadDraft<ProjectFormData>("draft-project-details-project", {
      proposalAsPer: "",
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

  const {
    register: registerSavePlot,
    handleSubmit: handleSavePlotSubmit,
    control: savePlotControl,
    watch: watchSavePlot,
    setValue: setSavePlotValue,
    formState: { errors: savePlotErrors },
    reset: resetSavePlot,
  } = useForm<SavePlotFormData>({
    defaultValues: (() => {
      const draft = loadDraft<any>("draft-project-details-save-plot", {
        planningAuthority: "",
        projectProponent: "",
        plotBelongsTo: "",
        zone: "",
        ward: "",
        villageName: "",
        address: "",
        addressRateDetails: null,
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

  const selectedZone = watchSavePlot("zone");
  const selectedWard = watchSavePlot("ward");
  const selectedVillage = watchSavePlot("villageName");
  const selectedAddress = watchSavePlot("address");
  const selectedSurveyNos = watchSavePlot("proposedCtsNumber");

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

  useEffect(() => {
    setSavePlotValue("ward", "");
    setSavePlotValue("villageName", "");
    setSavePlotValue("proposedCtsNumber", []);
    setSavePlotValue("addressRateDetails", null);
    // Reset plotBelongsTo when zone changes
    setSavePlotValue("plotBelongsTo", "");
  }, [selectedZone, setSavePlotValue]);

  // Auto-select plotBelongsTo based on zone and ward
  useEffect(() => {
    // Only set if both zone and ward are selected (for City), or zone is selected (for non-City)
    if (!selectedZone) {
      return;
    }

    if (selectedZone === "City") {
      // For City, wait for ward to be selected
      if (selectedWard) {
        if (selectedWard === "G/N Ward" || selectedWard === "G/S Ward") {
          setSavePlotValue("plotBelongsTo", "F.P.No", { shouldValidate: false });
        } else {
          // City with any other ward (not G/N or G/S)
          setSavePlotValue("plotBelongsTo", "CS No.", { shouldValidate: false });
        }
      } else {
        // City selected but no ward yet - clear plotBelongsTo
        setSavePlotValue("plotBelongsTo", "", { shouldValidate: false });
      }
    } else {
      // Any zone other than City - set immediately
      setSavePlotValue("plotBelongsTo", "CTS No.", { shouldValidate: false });
    }
  }, [selectedZone, selectedWard, setSavePlotValue]);

  useEffect(() => {
    setSavePlotValue("villageName", "");
    setSavePlotValue("proposedCtsNumber", []);
    setSavePlotValue("address", "");
    setSavePlotValue("addressRateDetails", null);
  }, [selectedWard, setSavePlotValue]);

  useEffect(() => {
    setSavePlotValue("address", "");
    setSavePlotValue("proposedCtsNumber", []);
    setSavePlotValue("addressRateDetails", null);
  }, [selectedVillage, setSavePlotValue]);

  useEffect(() => {
    setSavePlotValue("proposedCtsNumber", []);
    const details = getRateDetailsForAddress(selectedAddress as string);
    setSavePlotValue(
      "addressRateDetails",
      details ? { address: (selectedAddress as string) || "", ...details } : null
    );

    // Debug log for testing: confirm rate details are being picked up from CSV mapping
    if (selectedAddress) {
      if (details) {
        console.log("[Save Plot] Address selected:", selectedAddress, "Rate details:", details);
      } else {
        console.warn("[Save Plot] Address selected but no rate details found:", selectedAddress);
      }
    }
  }, [selectedAddress, setSavePlotValue]);

  const onProjectSubmit = (data: ProjectFormData) => {
    console.log("Project Data:", data);
    alert("Project details saved successfully!");
    markPageSaved("saved-project-info");
    setIsProjectInfoSaved(true);
  };

  const onSavePlotSubmit = (data: SavePlotFormData) => {
    console.log("Save Plot Data:", data);
    alert("Save plot details saved successfully!");
    markPageSaved("saved-save-plot-details");
    setIsSavePlotSaved(true);
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
  const zoneOptions = ["City", "Eastern Suburb", "Western Suburb I", "Western Suburb II"];
  // Ward options based on reference screenshots from the official system
  const wardOptionsMap: Record<string, string[]> = {
    City: [
      "A Ward",
      "B Ward",
      "C Ward",
      "D Ward",
      "E Ward",
      "F/N Ward",
      "F/S Ward",
      "G/N Ward",
      "G/S Ward",
    ],
    "Eastern Suburb": ["L Ward", "M/E Ward", "M/W Ward", "N Ward", "S Ward", "T Ward"],
    "Western Suburb I": ["H/E Ward", "H/W Ward", "K/E Ward", "K/W Ward"],
    "Western Suburb II": ["P/N Ward", "P/S Ward", "R/C Ward", "R/N Ward", "R/S Ward"],
  };
  // Village options per ward (Division names shown in English + Marathi)
  const villageOptionsByWard: Record<string, string[]> = {
    "A Ward": [
      "Colaba Division (कुलाबा डिव्हीजन)",
      "Fort Division (फोर्ट डिव्हीजन)",
    ],
    "B Ward": [
      "Princess Dock Division (प्रिन्सेस डॉक डिव्हीजन)",
      "Mandvi Division (मांडवी डिव्हीजन)",
    ],
    "C Ward": [
      "Bhuleshwar Division (भुलेश्वर डिव्हीजन)",
      "Girgaon Division (गिरगांव डिव्हीजन)",
    ],
    "D Ward": [
      "Malabar Hill & Khambala Hill Division (मलबार व खंबाला हिल डिव्हीजन)",
      "Tardeo Division (ताडदेव डिव्हीजन)",
    ],
    "E Ward": [
      "Byculla Division (भायखळा डिव्हीजन)",
      "Mazgaon Division (माझगाव डिव्हीजन)",
    ],
    "F/N Ward": [
      "Dadar–Naigaon Division (दादर–नायगाव डिव्हीजन)",
      "Salt Pan Division (सॉल्ट पॅन डिव्हीजन)",
      "Matunga Division (माटुंगा डिव्हीजन)",
    ],
    "F/S Ward": [
      "Parel & Sewri Division (परळ, शिवडी डिव्हीजन)",
      "Lower Parel Division (लोअर परळ डिव्हीजन)",
    ],
    "G/N Ward": [
      "Mahim Division (माहीम डिव्हीजन)",
      "Dharavi Division (धारावी डिव्हीजन)",
      "Sion Division (सायन डिव्हीजन)",
    ],
    "G/S Ward": [
      "Worli Division (वरळी डिव्हीजन)",
    ],
    // For other wards (not covered in the shared mapping), keep simple placeholders for now
    "L Ward": ["Village L1", "Village L2"],
    "M/E Ward": ["Village ME1", "Village ME2"],
    "M/W Ward": ["Village MW1", "Village MW2"],
    "N Ward": ["Village N1", "Village N2"],
    "S Ward": ["Village S1", "Village S2"],
    "T Ward": ["Village T1", "Village T2"],
    "H/E Ward": ["Village HE1", "Village HE2"],
    "H/W Ward": ["Village HW1", "Village HW2"],
    "K/E Ward": ["Village KE1", "Village KE2"],
    "K/W Ward": ["Village KW1", "Village KW2"],
    "P/N Ward": ["Village PN1", "Village PN2"],
    "P/S Ward": ["Village PS1", "Village PS2"],
    "R/C Ward": ["Village RC1", "Village RC2"],
    "R/N Ward": ["Village RN1", "Village RN2"],
    "R/S Ward": ["Village RS1", "Village RS2"],
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
              {isProjectInfoSaved ? "Added" : "Add"}
            </button>
          </div>

              <div className="pt-6 space-y-6">
            {/* Proposal is as per */}
            <div>
                <label className="block font-medium text-black mb-1">Proposal is as per</label>
              <div className="flex gap-6">
                  <label className="flex items-center gap-2 text-sm text-black">
                  <input
                      {...registerProject("proposalAsPer", {
                      required: "Please select an option",
                    })}
                    type="radio"
                    value="DCR 1991"
                    className="w-4 h-4 text-emerald-600 focus:ring-emerald-500"
                  />
                  DCR 1991
                </label>
                  <label className="flex items-center gap-2 text-sm text-black">
                  <input
                      {...registerProject("proposalAsPer")}
                    type="radio"
                    value="DCPR 2034"
                    className="w-4 h-4 text-emerald-600 focus:ring-emerald-500"
                  />
                  DCPR 2034
                </label>
              </div>
                {projectErrors.proposalAsPer && (
                  <p className="text-red-600 text-sm mt-1">{projectErrors.proposalAsPer.message}</p>
                )}
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
              {isSavePlotSaved ? "Added" : "Add"}
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
                    Zone <span className="text-red-500">*</span>
                  </label>
                  <select
                    {...registerSavePlot("zone", { required: "Zone is required" })}
                    className={inputClasses}
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
              </div>

              <div>
                <label className="block font-medium text-black mb-2">
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

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block font-medium text-black mb-1">
                    Village (Village Name-CTS and Division-CS) <span className="text-red-500">*</span>
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
                    Address <span className="text-red-500">*</span>
                  </label>
                  <select
                    {...registerSavePlot("address", { required: "Address is required" })}
                    className={inputClasses}
                    disabled={!selectedVillage}
                  >
                    <option value="">----- Select Address -----</option>
                    {(addressOptionsByVillage[selectedVillage as string] ?? []).map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                  {savePlotErrors.address && <p className="text-red-600 text-sm mt-1">{savePlotErrors.address.message}</p>}
                </div>
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
                    const options = getSurveyNumbersForAddress(selectedAddress as string);
                    // Sort survey numbers in descending order
                    // Handle both numeric and alphanumeric survey numbers
                    const sortedOptions = [...options].sort((a, b) => {
                      // Extract numeric parts for comparison
                      const numA = parseInt(a.match(/\d+/)?.[0] || "0", 10);
                      const numB = parseInt(b.match(/\d+/)?.[0] || "0", 10);
                      if (numA !== numB) {
                        return numB - numA; // Descending order
                      }
                      // If numeric parts are equal, compare as strings (descending)
                      return b.localeCompare(a);
                    });
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
                          disabled={!selectedAddress}
                          value=""
                          onChange={(e) => {
                            addSurveyNo(e.target.value);
                          }}
                        >
                          <option value="">----- Select Survey No -----</option>
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


            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                  <label className="block font-medium text-black mb-1">
                    Gross Plot Area (Sq.m) <span className="text-red-500">*</span>
                </label>
                <input
                    {...registerSavePlot("grossPlotArea", { required: "Gross plot area is required" })}
                  type="number"
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
                  <input
                    {...registerSavePlot("sacNo", {
                      required: "SAC number is required",
                      minLength: { value: 6, message: "SAC number must be 6 characters" },
                      maxLength: { value: 6, message: "SAC number must be 6 characters" },
                    })}
                    type="text"
                    className={inputClasses}
                    placeholder="Enter SAC number"
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
                        value: /^-?([1-8]?[0-9](\.[0-9]{1,6})?|90(\.0{1,6})?)$/,
                        message: "Latitude must be between -90 and 90 degrees",
                      },
                    })}
                    type="number"
                    step="any"
                    min="-90"
                    max="90"
                    className={inputClasses}
                    placeholder="e.g., 19.0760"
                  />
                  <p className="text-xs text-gray-500 mt-1">Range: -90 to 90 degrees</p>
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
                        value: /^-?([1]?[0-7]?[0-9](\.[0-9]{1,6})?|180(\.0{1,6})?)$/,
                        message: "Longitude must be between -180 and 180 degrees",
                      },
                    })}
                    type="number"
                    step="any"
                    min="-180"
                    max="180"
                    className={inputClasses}
                    placeholder="e.g., 72.8777"
                  />
                  <p className="text-xs text-gray-500 mt-1">Range: -180 to 180 degrees</p>
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

