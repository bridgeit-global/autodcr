"use client";

import { useEffect, useState } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { loadDraft, saveDraft, markPageSaved } from "@/app/utils/draftStorage";

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
  proposedCtsNumber: string;
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

export default function ProjectDetailsPage() {
  const [activeTab, setActiveTab] = useState("save-plot");

  const inputClasses =
    "border border-black rounded-lg px-3 py-2 h-10 w-full text-black focus:ring-2 focus:ring-blue-500 outline-none";
  const textareaClasses =
    "border border-black rounded-lg px-3 py-2 w-full text-black focus:ring-2 focus:ring-blue-500 outline-none resize-none";

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
    defaultValues: loadDraft<SavePlotFormData>("draft-project-details-save-plot", {
      planningAuthority: "",
      projectProponent: "",
      plotBelongsTo: "",
      zone: "",
      ward: "",
      proposedCtsNumber: "",
      villageName: "",
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
    }),
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
  }, [selectedZone, setSavePlotValue]);

  useEffect(() => {
    setSavePlotValue("proposedCtsNumber", "");
  }, [selectedWard, setSavePlotValue]);

  const onProjectSubmit = (data: ProjectFormData) => {
    console.log("Project Data:", data);
    alert("Project details saved successfully!");
    markPageSaved("saved-project-details");
  };

  const onSavePlotSubmit = (data: SavePlotFormData) => {
    console.log("Save Plot Data:", data);
    alert("Save plot details saved successfully!");
    markPageSaved("saved-project-details");
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
  const zoneOptions = ["BP Special Cell", "City", "Eastern Suburb", "Western Suburb I", "Western Suburb II"];
  const wardOptionsMap: Record<string, string[]> = {
    "BP Special Cell": ["Special Ward 1", "Special Ward 2"],
    City: ["Ward A", "Ward B", "Ward C"],
    "Eastern Suburb": ["Ward E1", "Ward E2"],
    "Western Suburb I": ["Ward W1", "Ward W2"],
    "Western Suburb II": ["Ward W3", "Ward W4"],
  };
  const proposedCtsOptionsByWard: Record<string, string[]> = {
    "Special Ward 1": ["CTS-1001", "CTS-1002"],
    "Special Ward 2": ["CTS-2001", "CTS-2002"],
    "Ward A": ["CTS-A1", "CTS-A2"],
    "Ward B": ["CTS-B1", "CTS-B2"],
    "Ward C": ["CTS-C1", "CTS-C2"],
    "Ward E1": ["CTS-E1", "CTS-E2"],
    "Ward E2": ["CTS-E3", "CTS-E4"],
    "Ward W1": ["CTS-W1", "CTS-W2"],
    "Ward W2": ["CTS-W3", "CTS-W4"],
    "Ward W3": ["CTS-W5", "CTS-W6"],
    "Ward W4": ["CTS-W7", "CTS-W8"],
  };
  const majorUseOptions = ["General Category", "Residential", "Commercial", "Industrial"];
  const plotSubUseOptions = ["Select SubUse", "Residential Low Rise", "Residential High Rise", "Commercial Retail"];
  const plotTypeOptions = ["Select", "Corner Plot", "Through Plot", "Irregular Plot"];

  return (
    <div className="max-w-6xl mx-auto px-6 pt-8 space-y-6">
      {/* Warning Message */}
      <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-md shadow-sm">
        <p className="text-sm text-red-700">
          <strong>Note:</strong> Dear Applicant, you will not be able to edit project if any application submitted for
          this Project. You can edit / add information before submitting any application.
        </p>
      </div>

      {/* Sub-navigation Tabs */}
      <div className="sticky top-0 z-50 mb-6">
        <section className="border border-black rounded-lg bg-white shadow-sm">
          <div className="flex flex-wrap gap-2 p-4">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-2 text-sm font-medium text-gray-700 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </section>
      </div>

      <div className="max-h-[70vh] overflow-y-auto space-y-6">
        {activeTab === "project-info" && (
          <form onSubmit={handleProjectSubmit(onProjectSubmit)}>
            <section className="border border-black rounded-lg p-6 bg-white">
              <div className="flex flex-wrap items-start justify-between gap-4 border-b border-black pb-4">
            <div>
                  <h2 className="text-xl font-bold text-black">Project Details</h2>
                  <p className="text-sm text-black mt-1">
                Keep the inputs consistent with your registered application to avoid review delays.
              </p>
            </div>

            <button
              type="submit"
              className="bg-sky-700 hover:bg-sky-800 text-white px-6 py-2 rounded-lg font-semibold shadow transition-colors"
            >
              Save
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
                    className="w-4 h-4 text-sky-700 focus:ring-sky-500"
                  />
                  DCR 1991
                </label>
                  <label className="flex items-center gap-2 text-sm text-black">
                  <input
                      {...registerProject("proposalAsPer")}
                    type="radio"
                    value="DCPR 2034"
                    className="w-4 h-4 text-sky-700 focus:ring-sky-500"
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

            {/* Property Address and Landmark */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                  <label className="block font-medium text-black mb-1">
                  Property Address <span className="text-red-500">*</span>
                </label>
                <textarea
                    {...registerProject("propertyAddress", {
                    required: "Property Address is required",
                  })}
                  rows={4}
                    className={textareaClasses}
                  placeholder="Enter property address"
                />
                  {projectErrors.propertyAddress && (
                    <p className="text-red-600 text-sm mt-1">{projectErrors.propertyAddress.message}</p>
                )}
              </div>

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

            {/* Property Tax */}
            <div>
                  <label className="block font-medium text-black mb-1">Have Paid Latest Current Year Property Tax?</label>
              <div className="flex gap-6">
                    <label className="flex items-center gap-2 text-sm text-black">
                  <input
                        {...registerProject("hasPaidLatestPropertyTax")}
                    type="radio"
                    value="Yes"
                    className="w-4 h-4 text-sky-700 focus:ring-sky-500"
                  />
                  Yes
                </label>
                    <label className="flex items-center gap-2 text-sm text-black">
                  <input
                        {...registerProject("hasPaidLatestPropertyTax")}
                    type="radio"
                    value="No"
                    className="w-4 h-4 text-sky-700 focus:ring-sky-500"
                  />
                  No
                </label>
              </div>
            </div>
          </div>
        </section>
          </form>
        )}

        {activeTab === "save-plot" && (
          <form onSubmit={handleSavePlotSubmit(onSavePlotSubmit)}>
            <section className="border border-black rounded-lg bg-white flex flex-col max-h-[70vh] overflow-hidden">
              {/* Sticky header stays visible while fields scroll */}
              <div className="sticky top-0 z-10 bg-white border-b border-black p-4 flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h2 className="text-xl font-bold text-black">Save Plot Details</h2>
                  <p className="text-sm text-black mt-1">Provide comprehensive plot details for this application.</p>
                </div>

                <button
                  type="submit"
                  className="bg-sky-700 hover:bg-sky-800 text-white px-6 py-2 rounded-lg font-semibold shadow transition-colors"
                >
                  Save
                </button>
              </div>

              <div className="pt-6 space-y-8 overflow-y-auto px-4 pb-4">
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
                        className="w-4 h-4 text-sky-700 focus:ring-sky-500"
                      />
                      {option}
                    </label>
                  ))}
                  <button
                    type="button"
                    className="ml-4 px-3 py-1 border border-black rounded-md text-black text-sm"
                    onClick={() =>
                      appendPlotField({ ctsNumber: "", sacNumber: "", verifyPropertyTax: "", prCard: "" })
                    }
                  >
                    +
                  </button>
                </div>
                {savePlotErrors.plotBelongsTo && (
                  <p className="text-red-600 text-sm mt-1">{savePlotErrors.plotBelongsTo.message}</p>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block font-medium text-black mb-1">
                    Proposed CTS No for this project <span className="text-red-500">*</span>
                  </label>
                  <select
                    {...registerSavePlot("proposedCtsNumber", {
                      required: "Please select a proposed CTS number",
                    })}
                    className={inputClasses}
                  >
                    <option value="">----- Select Proposed CTS -----</option>
                    {(proposedCtsOptionsByWard[selectedWard as string] ?? []).map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                  {savePlotErrors.proposedCtsNumber && (
                    <p className="text-red-600 text-sm mt-1">{savePlotErrors.proposedCtsNumber.message}</p>
                  )}
                </div>
                <div>
                  <label className="block font-medium text-black mb-1">
                    Village (Village Name-CTS and Division-CS) <span className="text-red-500">*</span>
                  </label>
                  <input
                    {...registerSavePlot("villageName", { required: "Village name is required" })}
                    className={inputClasses}
                    placeholder="Enter village name"
                  />
                  {savePlotErrors.villageName && (
                    <p className="text-red-600 text-sm mt-1">{savePlotErrors.villageName.message}</p>
                  )}
                </div>
              </div>

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
                          className="w-4 h-4 text-sky-700 focus:ring-sky-500"
                        />
                        {option}
                      </label>
                    ))}
                  </div>
                  {savePlotErrors.planningAuthority && (
                    <p className="text-red-600 text-sm mt-1">{savePlotErrors.planningAuthority.message}</p>
                  )}
                  <p className="text-xs text-black mt-2">
                    Note: This is used for enabling construction permit application. Outside BMC vicinity plot will not
                    have option of building permission department.
                  </p>
                  <p className="text-xs text-red-600">
                    This option is not for TDR Generation and Utilisation Process. Please create separate NEW TDR
                    (SRA/MMRDA) Project.
                  </p>
                </div>

                <div>
                  <label className="block font-medium text-black mb-1">
                    Project Proponent <span className="text-red-500">*</span>
                  </label>
                  <div className="space-y-2">
                    {projectProponentOptions.map((option) => (
                      <label key={option} className="flex items-center gap-2 text-sm text-black">
                        <input
                          {...registerSavePlot("projectProponent", {
                            required: "Please select a project proponent",
                          })}
                          type="radio"
                          value={option}
                          className="w-4 h-4 text-sky-700 focus:ring-sky-500"
                        />
                        {option}
                      </label>
                    ))}
                  </div>
                  {savePlotErrors.projectProponent && (
                    <p className="text-red-600 text-sm mt-1">{savePlotErrors.projectProponent.message}</p>
                  )}
                </div>
              </div>

              <div className="border border-gray-300 rounded-lg overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-black border-collapse">
                    <thead>
                      <tr className="bg-gray-100 uppercase text-xs text-gray-600">
                        <th className="px-4 py-2 text-left border-b border-gray-300">CTS/CS/FP No&apos;s</th>
                        <th className="px-4 py-2 text-left border-b border-gray-300">Verify Property Tax</th>
                        <th className="px-4 py-2 text-left border-b border-gray-300">PR Card</th>
                      </tr>
                    </thead>
                    <tbody>
                      {plotFields.map((field, index) => (
                        <tr key={field.id} className="border-b border-gray-200 last:border-b-0 hover:bg-gray-50">
                          <td className="px-4 py-3 align-top">
                            <input
                              {...registerSavePlot(`plotEntries.${index}.ctsNumber` as const, {
                                required: "CTS/CS/FP Number is required",
                              })}
                              className={inputClasses}
                              placeholder="CTS/CS/FP Number"
                            />
                            {savePlotErrors.plotEntries?.[index]?.ctsNumber && (
                              <p className="text-red-600 text-sm mt-1">
                                {savePlotErrors.plotEntries[index]?.ctsNumber?.message}
                              </p>
                            )}
                          </td>
                          <td className="px-4 py-3 align-top">
                            <input
                              {...registerSavePlot(`plotEntries.${index}.verifyPropertyTax` as const)}
                              className={inputClasses}
                              placeholder="Verification Details"
                            />
                          </td>
                          <td className="px-4 py-3 align-top">
                            <input
                              {...registerSavePlot(`plotEntries.${index}.prCard` as const)}
                              className={inputClasses}
                              placeholder="PR Card"
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
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
                    {...registerSavePlot("latitude", { required: "Latitude is required" })}
                    type="text"
                    className={inputClasses}
                    placeholder="Enter latitude"
                  />
                  {savePlotErrors.latitude && (
                    <p className="text-red-600 text-sm mt-1">{savePlotErrors.latitude.message}</p>
                  )}
                </div>
              <div>
                  <label className="block font-medium text-black mb-1">
                    Longitude <span className="text-red-500">*</span>
                </label>
                <input
                    {...registerSavePlot("longitude", { required: "Longitude is required" })}
                    type="text"
                    className={inputClasses}
                    placeholder="Enter longitude"
                  />
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
                          className="w-4 h-4 text-sky-700 focus:ring-sky-500"
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

