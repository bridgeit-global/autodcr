"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { useSearchParams } from "next/navigation";
import { loadDraft, saveDraft, markPageSaved, isPageSaved } from "@/app/utils/draftStorage";
import { useProjectData } from "@/app/hooks/useProjectData";
import { supabase } from "@/app/utils/supabase";
import { useDashboardAlertModal } from "@/app/dashboard/context/DashboardAlertModalContext";
import CustomSelect from "@/app/components/CustomSelect";
import { BTN_PRIMARY, BTN_SAVE_UNSAVED } from "@/app/utils/buttonClasses";

type BuildingFormData = {
  buildingType: string;
  height: string;
  fsiBuiltUpArea: string;
  grossConstructionArea: string;
};

const BUILDING_TYPES = [
  "Residential",
  "Commercial",
  "Mixed Use",
  "Institutional",
  "Industrial",
];

const SAVED_BUILDING_SNAPSHOT_KEY = "saved-building-details-snapshot";
const UNSAVED_BUILDING_FLAG_KEY = "unsaved-building-details";
const BASELINE_BUILDING_SNAPSHOT_KEY = "baseline-building-details-snapshot";

const areBuildingFormsEqual = (a: BuildingFormData, b: BuildingFormData) =>
  JSON.stringify(a) === JSON.stringify(b);

export default function BuildingDetailsPage() {
  const searchParams = useSearchParams();
  const isReadOnlyMode = searchParams.get("mode") === "readonly";
  const { isEditMode, isLoading, projectData } = useProjectData();
  const { showAlert } = useDashboardAlertModal();
  const [isSaved, setIsSaved] = useState(() => isPageSaved("saved-building-details"));

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
    reset,
    setValue,
  } = useForm<BuildingFormData>({
    defaultValues: loadDraft<BuildingFormData>("draft-building-details-form", {
      buildingType: "",
      height: "",
      fsiBuiltUpArea: "",
      grossConstructionArea: "",
    }),
    mode: "onChange", // Enable validation on change
  });

  // Fetch and populate data when in edit mode
  useEffect(() => {
    if (isEditMode && projectData && !isLoading) {
      const buildingDetails = projectData.building_details || {};
      const bd = buildingDetails as Record<string, unknown>;
      const s = (v: unknown): string => (typeof v === "string" ? v : "");
      const formData: BuildingFormData = {
        buildingType: s(bd.buildingType),
        height: s(bd.height),
        fsiBuiltUpArea: s(bd.fsiBuiltUpArea),
        grossConstructionArea: s(bd.grossConstructionArea),
      };
      reset(formData);
      saveDraft("draft-building-details-form", formData);
      saveDraft(BASELINE_BUILDING_SNAPSHOT_KEY, formData);
      saveDraft(SAVED_BUILDING_SNAPSHOT_KEY, formData);
      const hasData = Object.values(formData).some((v) => typeof v === "string" && v.trim().length > 0);
      if (hasData) {
        markPageSaved("saved-building-details");
        setIsSaved(true);
        saveDraft(UNSAVED_BUILDING_FLAG_KEY, false);
      } else {
        setIsSaved(false);
        saveDraft(UNSAVED_BUILDING_FLAG_KEY, true);
      }
    }
  }, [isEditMode, projectData, isLoading, reset]);

  // Watch both area fields for cross-validation
  const fsiBuiltUpArea = watch("fsiBuiltUpArea");
  const grossConstructionArea = watch("grossConstructionArea");

  const inputClasses =
    "h-11 w-full rounded-lg border border-gray-200 bg-gray-50 px-3 text-sm text-gray-900 placeholder:text-gray-400 outline-none transition-colors hover:border-gray-300 focus:border-brand-blue focus:bg-white focus:ring-2 focus:ring-brand-blue/20 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-500";
  const labelClasses = "mb-1.5 block text-sm font-medium text-brand-navy";
  const requiredMark = <span className="text-brand-navy">*</span>;
  const errorClasses = "mt-1 text-sm text-status-danger";

  const onSubmit = async (data: BuildingFormData) => {
    if (isReadOnlyMode) return;
    try {
      const isDraft = projectData?.status === "draft";
      if (isEditMode && projectData?.id && !isDraft) {
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

        const response = await fetch(`/api/projects/${projectData.id}`, {
          method: "PUT",
          headers,
          body: JSON.stringify({
            user_id: userId,
            building_details: data,
          }),
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || "Failed to update project");
        }

        showAlert({
          title: "Building details",
          message: "Building details updated successfully!",
        });
      } else {
        console.log("Building Details:", data);
        showAlert({
          title: "Building details",
          message: "Building details saved successfully!",
        });
      }
      saveDraft("draft-building-details-form", data);
      markPageSaved("saved-building-details");
      saveDraft(SAVED_BUILDING_SNAPSHOT_KEY, data);
      saveDraft(BASELINE_BUILDING_SNAPSHOT_KEY, data);
      saveDraft("dirty-building-details", false);
      saveDraft(UNSAVED_BUILDING_FLAG_KEY, false);
      setIsSaved(true);
    } catch (error: any) {
      console.error("Error saving building details:", error);
      showAlert({
        title: "Could not save",
        message: error.message || "Failed to save building details. Please try again.",
      });
    }
  };

  // Persist draft as user types
  useEffect(() => {
    const subscription = watch((value) => {
      const currentValue = value as BuildingFormData;
      saveDraft("draft-building-details-form", currentValue);

      const savedSnapshot = loadDraft<BuildingFormData | null>(SAVED_BUILDING_SNAPSHOT_KEY, null);
      const hasSavedFlag = isPageSaved("saved-building-details");
      const currentlySaved =
        hasSavedFlag && !!savedSnapshot && areBuildingFormsEqual(currentValue, savedSnapshot);

      setIsSaved(currentlySaved);
      saveDraft(UNSAVED_BUILDING_FLAG_KEY, !currentlySaved);
    });
    return () => subscription.unsubscribe();
  }, [watch]);

  useEffect(() => {
    const initialDraft = loadDraft<BuildingFormData>("draft-building-details-form", {
      buildingType: "",
      height: "",
      fsiBuiltUpArea: "",
      grossConstructionArea: "",
    });
    const savedSnapshot = loadDraft<BuildingFormData | null>(SAVED_BUILDING_SNAPSHOT_KEY, null);
    const hasSavedFlag = isPageSaved("saved-building-details");
    const currentlySaved =
      hasSavedFlag && !!savedSnapshot && areBuildingFormsEqual(initialDraft, savedSnapshot);

    saveDraft(BASELINE_BUILDING_SNAPSHOT_KEY, initialDraft);
    setIsSaved(currentlySaved);
    saveDraft(UNSAVED_BUILDING_FLAG_KEY, !currentlySaved);
  }, []);

  if (isLoading) {
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
    <div className="pb-2">
      <form onSubmit={handleSubmit(onSubmit)}>
        <fieldset
          disabled={isReadOnlyMode}
          className={
            isReadOnlyMode
              ? "[&_input]:cursor-not-allowed [&_textarea]:cursor-not-allowed [&_select]:cursor-not-allowed [&_button]:cursor-not-allowed [&_[role='button']]:cursor-not-allowed"
              : ""
          }
        >
          {!isReadOnlyMode && (
            <div className="mb-5 flex flex-wrap items-center justify-end gap-3">
              <button
                type="submit"
                className={`rounded-lg px-5 py-2 text-sm font-semibold ${
                  isSaved ? BTN_PRIMARY : BTN_SAVE_UNSAVED
                }`}
              >
                {isSaved ? "Saved" : "Save"}
              </button>
            </div>
          )}

          <div className="grid grid-cols-1 gap-x-5 gap-y-4 md:grid-cols-2">
            <div>
              <label className={labelClasses}>Type {requiredMark}</label>
              <input
                type="hidden"
                {...register("buildingType", { required: "Please select a type" })}
              />
              <CustomSelect
                value={watch("buildingType") || ""}
                onChange={(val) => setValue("buildingType", val, { shouldValidate: true })}
                options={BUILDING_TYPES.map((type) => ({ value: type, label: type }))}
                placeholder="Select type"
              />
              {errors.buildingType && (
                <p className={errorClasses}>{errors.buildingType.message}</p>
              )}
            </div>

            <div>
              <label className={labelClasses}>Height (in meters) {requiredMark}</label>
              <input
                {...register("height", {
                  required: "Height is required",
                })}
                className={inputClasses}
                placeholder="Enter total height"
              />
              {errors.height && <p className={errorClasses}>{errors.height.message}</p>}
            </div>

            <div>
              <label className={labelClasses}>FSI Built-up Area (sq. m) {requiredMark}</label>
              <input
                type="number"
                step="0.01"
                {...register("fsiBuiltUpArea", {
                  required: "FSI built-up area is required",
                  validate: (value) => {
                    const grossArea = parseFloat(grossConstructionArea || "0");
                    const fsiArea = parseFloat(value || "0");
                    if (grossArea > 0 && fsiArea >= grossArea) {
                      return "FSI Built-up Area must be less than Gross Construction Area";
                    }
                    return true;
                  },
                })}
                className={inputClasses}
                placeholder="Enter FSI built-up area"
              />
              {errors.fsiBuiltUpArea && (
                <p className={errorClasses}>{errors.fsiBuiltUpArea.message}</p>
              )}
            </div>

            <div>
              <label className={labelClasses}>Gross Construction Area (sq. m) {requiredMark}</label>
              <input
                type="number"
                step="0.01"
                {...register("grossConstructionArea", {
                  required: "Gross construction area is required",
                  validate: (value) => {
                    const grossArea = parseFloat(value || "0");
                    const fsiArea = parseFloat(fsiBuiltUpArea || "0");
                    if (fsiArea > 0 && grossArea <= fsiArea) {
                      return "Gross Construction Area must be greater than FSI Built-up Area";
                    }
                    return true;
                  },
                })}
                className={inputClasses}
                placeholder="Enter gross construction area"
              />
              {errors.grossConstructionArea && (
                <p className={errorClasses}>{errors.grossConstructionArea.message}</p>
              )}
            </div>
          </div>
        </fieldset>
      </form>
    </div>
  );
}
