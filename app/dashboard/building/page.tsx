"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { loadDraft, saveDraft, markPageSaved } from "@/app/utils/draftStorage";

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
  });

  const inputClasses =
    "border border-black rounded-lg px-3 py-2 h-10 w-full text-black focus:ring-2 focus:ring-blue-500 outline-none";

  const onSubmit = (data: BuildingFormData) => {
    console.log("Building Details:", data);
    alert("Building details saved successfully!");
    saveDraft("draft-building-details-form", data);
    markPageSaved("saved-building-details");
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
        <section className="border border-black rounded-lg bg-white flex flex-col max-h-[70vh] overflow-hidden">
          {/* Sticky header */}
          <div className="sticky top-0 z-10 bg-white border-b border-black px-6 py-4 flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold text-black">Building Details</h2>
              <p className="text-sm text-black mt-1">
                Provide the core parameters for the proposed building.
              </p>
            </div>

            <button
              type="submit"
              className="bg-sky-700 hover:bg-sky-800 text-white px-6 py-2 rounded-lg font-semibold shadow transition-colors"
            >
              Save
            </button>
          </div>

          <div className="p-6 space-y-6 overflow-y-auto pb-6">
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
                  {...register("fsiBuiltUpArea", {
                    required: "FSI built-up area is required",
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
                  {...register("grossConstructionArea", {
                    required: "Gross construction area is required",
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

