"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { loadDraft, saveDraft, markPageSaved, isPageSaved } from "@/app/utils/draftStorage";

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

export default function BuildingDetailsPage() {
  const [isSaved, setIsSaved] = useState(() => isPageSaved("saved-building-details"));

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
  } = useForm<BuildingFormData>({
    defaultValues: loadDraft<BuildingFormData>("draft-building-details-form", {
      buildingType: "",
      height: "",
      fsiBuiltUpArea: "",
      grossConstructionArea: "",
    }),
    mode: "onChange", // Enable validation on change
  });

  // Watch both area fields for cross-validation
  const fsiBuiltUpArea = watch("fsiBuiltUpArea");
  const grossConstructionArea = watch("grossConstructionArea");

  const inputClasses =
    "border border-gray-200 rounded-xl px-3 py-2 h-10 w-full text-gray-900 bg-white focus:ring-2 focus:ring-emerald-500 outline-none";

  const onSubmit = (data: BuildingFormData) => {
    console.log("Building Details:", data);
    alert("Building details saved successfully!");
    saveDraft("draft-building-details-form", data);
    markPageSaved("saved-building-details");
    setIsSaved(true);
  };

  // Persist draft as user types
  useEffect(() => {
    const subscription = watch((value) => {
      saveDraft("draft-building-details-form", value as BuildingFormData);
    });
    return () => subscription.unsubscribe();
  }, [watch]);

  return (
    <div className="max-w-6xl mx-auto px-6 pt-8 space-y-6">
      <form onSubmit={handleSubmit(onSubmit)}>
        <section className="border border-gray-200 rounded-2xl bg-white flex flex-col shadow-sm">
          {/* Header */}
          <div className="bg-white border-b border-gray-200 px-6 py-4 flex flex-wrap items-start justify-between gap-4 rounded-t-2xl">
            <div>
              <h2 className="text-xl font-bold text-gray-900">Building Details</h2>
              <p className="text-sm text-gray-600 mt-1">
                Provide the core parameters for the proposed building.
              </p>
            </div>

            <button
              type="submit"
              className={`px-6 py-2 rounded-lg font-semibold shadow transition-colors ${
                isSaved
                  ? "bg-emerald-700 hover:bg-emerald-800 text-white"
                  : "bg-emerald-200 hover:bg-emerald-300 text-emerald-800"
              }`}
            >
              {isSaved ? "Added" : "Add"}
            </button>
          </div>

          <div className="p-6 space-y-6 pb-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block font-medium text-black mb-1">
                  Type <span className="text-red-500">*</span>
                </label>
                <select
                  {...register("buildingType", { required: "Please select a type" })}
                  className={inputClasses}
                >
                  <option value="">Select type</option>
                  {BUILDING_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
                {errors.buildingType && (
                  <p className="text-red-600 text-sm mt-1">{errors.buildingType.message}</p>
                )}
              </div>

              <div>
                <label className="block font-medium text-black mb-1">
                  Height (in meters) <span className="text-red-500">*</span>
                </label>
                <input
                  {...register("height", {
                    required: "Height is required",
                  })}
                  className={inputClasses}
                  placeholder="Enter total height"
                />
                {errors.height && (
                  <p className="text-red-600 text-sm mt-1">{errors.height.message}</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block font-medium text-black mb-1">
                  FSI Built-up Area (sq. m) <span className="text-red-500">*</span>
                </label>
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
                  <p className="text-red-600 text-sm mt-1">{errors.fsiBuiltUpArea.message}</p>
                )}
              </div>

              <div>
                <label className="block font-medium text-black mb-1">
                  Gross Construction Area (sq. m) <span className="text-red-500">*</span>
                </label>
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
                  <p className="text-red-600 text-sm mt-1">
                    {errors.grossConstructionArea.message}
                  </p>
                )}
              </div>
            </div>
          </div>
        </section>
      </form>
    </div>
  );
}

