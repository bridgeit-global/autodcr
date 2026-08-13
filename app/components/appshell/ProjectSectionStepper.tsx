"use client";

import { useProjectSectionNavigation } from "@/app/hooks/useProjectSectionNavigation";
import { BTN_PRIMARY } from "@/app/utils/buttonClasses";

export type ProjectSection = {
  id: string;
  label: string;
  path: string;
};

const BASE_SECTIONS: ProjectSection[] = [
  { id: "project-details", label: "Project Details", path: "/dashboard/project-details" },
  { id: "applicant-details", label: "Applicant Details", path: "/dashboard/applicant" },
  { id: "building-details", label: "Building Details", path: "/dashboard/building" },
  { id: "area-details", label: "Area Details", path: "/dashboard/area" },
  { id: "project-library", label: "Project Library", path: "/dashboard/project-library" },
];

const APPLICATION_SECTION: ProjectSection = {
  id: "application-details",
  label: "Application Details",
  path: "/dashboard/application-details",
};

export default function ProjectSectionStepper() {
  const {
    pathname,
    isReadOnlyMode,
    showUnsavedWarning,
    handleNavigation,
    confirmLeaveWithoutSaving,
    cancelLeave,
  } = useProjectSectionNavigation();

  const sections = isReadOnlyMode ? [APPLICATION_SECTION, ...BASE_SECTIONS] : BASE_SECTIONS;
  const normalizedPath = pathname.replace(/\/$/, "");
  const currentIndex = Math.max(
    0,
    sections.findIndex((s) => s.path.replace(/\/$/, "") === normalizedPath)
  );

  return (
    <>
      <nav
        aria-label="Project sections"
        className="border-b border-gray-100 bg-white px-4 py-4 sm:px-6"
      >
        <ol className="flex items-center gap-1 overflow-x-auto pb-0.5 sm:gap-2">
          {sections.map((section, index) => {
            const isCurrent = index === currentIndex;

            return (
              <li key={section.id} className="flex shrink-0 items-center">
                <button
                  type="button"
                  onClick={() => handleNavigation(section.path)}
                  aria-current={isCurrent ? "step" : undefined}
                  className={[
                    "inline-flex items-center gap-2 px-1 py-1 text-sm transition-colors",
                    isCurrent
                      ? "font-semibold text-brand-blue"
                      : "font-medium text-gray-400 hover:text-gray-600",
                  ].join(" ")}
                >
                  <span
                    className={[
                      "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold",
                      isCurrent
                        ? "bg-brand-blue text-white"
                        : "border border-gray-300 bg-white text-gray-400",
                    ].join(" ")}
                  >
                    {index + 1}
                  </span>
                  <span className="whitespace-nowrap">{section.label}</span>
                </button>
                {index !== sections.length - 1 && (
                  <span
                    className="mx-2 hidden h-px w-6 bg-gray-200 sm:block lg:w-8"
                    aria-hidden="true"
                  />
                )}
              </li>
            );
          })}
        </ol>
      </nav>

      {showUnsavedWarning && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="w-[90%] max-w-md rounded-xl bg-white p-6 shadow-2xl">
            <h2 className="mb-2 text-lg font-semibold text-gray-900">Unsaved Changes</h2>
            <p className="mb-4 text-sm text-gray-600">
              You have unsaved changes in this section. Are you sure you want to leave this page
              without saving?
            </p>
            <div className="mt-4 flex justify-end gap-3">
              <button
                type="button"
                className="rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-200"
                onClick={cancelLeave}
              >
                Stay on this page
              </button>
              <button
                type="button"
                className={`rounded-lg px-4 py-2 text-sm font-semibold ${BTN_PRIMARY}`}
                onClick={confirmLeaveWithoutSaving}
              >
                Leave without saving
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
