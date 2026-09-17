"use client";

import { useProjectSectionNavigation } from "@/app/hooks/useProjectSectionNavigation";
import { BTN_PRIMARY } from "@/app/utils/buttonClasses";
import {
  APPLICATION_DETAILS_PATH,
  CREATE_PROJECT_SECTIONS,
  PROJECT_LIBRARY_PATH,
} from "@/app/utils/projectSections";

export type ProjectSection = {
  id: string;
  label: string;
  path: string;
};

const SECTIONS: ProjectSection[] = CREATE_PROJECT_SECTIONS.map((section) => ({
  id: section.id,
  label: section.label,
  path: section.path,
}));

export default function ProjectSectionStepper() {
  const {
    pathname,
    isReadOnlyMode,
    isLibraryGated,
    showUnsavedWarning,
    handleNavigation,
    confirmLeaveWithoutSaving,
    cancelLeave,
  } = useProjectSectionNavigation();

  const normalizedPath = pathname.replace(/\/$/, "");
  const currentIndex = SECTIONS.findIndex(
    (s) => s.path.replace(/\/$/, "") === normalizedPath
  );
  const isApplicationTab = normalizedPath === APPLICATION_DETAILS_PATH;

  return (
    <>
      <nav
        aria-label="Project sections"
        className="border-b border-gray-100 bg-white px-4 py-4 sm:px-6"
      >
        {isReadOnlyMode && (
          <div role="tablist" className="mb-3 flex items-center gap-6 border-b border-gray-100">
            {[
              { label: "Application", path: APPLICATION_DETAILS_PATH, active: isApplicationTab },
              { label: "Project Data", path: PROJECT_LIBRARY_PATH, active: !isApplicationTab },
            ].map((tab) => (
              <button
                key={tab.label}
                type="button"
                role="tab"
                aria-selected={tab.active}
                onClick={() => handleNavigation(tab.path)}
                className={[
                  "-mb-px border-b-2 px-1 pb-2 text-sm transition-colors",
                  tab.active
                    ? "border-brand-blue font-semibold text-brand-blue"
                    : "border-transparent font-medium text-gray-500 hover:text-gray-700",
                ].join(" ")}
              >
                {tab.label}
              </button>
            ))}
          </div>
        )}

        {!isApplicationTab && (
          <ol className="flex items-center gap-1 overflow-x-auto pb-0.5 sm:gap-2">
            {SECTIONS.map((section, index) => {
              const isCurrent = index === currentIndex;
              const isGated = isLibraryGated && section.id !== "project-library";

              return (
                <li key={section.id} className="flex shrink-0 items-center">
                  <button
                    type="button"
                    onClick={() => handleNavigation(section.path)}
                    aria-current={isCurrent ? "step" : undefined}
                    aria-disabled={isGated ? true : undefined}
                    className={[
                      "inline-flex items-center gap-2 px-1 py-1 text-sm transition-colors",
                      isCurrent
                        ? "font-semibold text-brand-blue"
                        : isGated
                          ? "cursor-not-allowed font-medium text-gray-300"
                          : "font-medium text-gray-400 hover:text-gray-600",
                    ].join(" ")}
                  >
                    <span
                      className={[
                        "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold",
                        isCurrent
                          ? "bg-brand-blue text-white"
                          : isGated
                            ? "border border-gray-200 bg-gray-50 text-gray-300"
                            : "border border-gray-300 bg-white text-gray-400",
                      ].join(" ")}
                    >
                      {index + 1}
                    </span>
                    <span className="whitespace-nowrap">{section.label}</span>
                  </button>
                  {index !== SECTIONS.length - 1 && (
                    <span
                      className="mx-2 hidden h-px w-6 bg-gray-200 sm:block lg:w-8"
                      aria-hidden="true"
                    />
                  )}
                </li>
              );
            })}
          </ol>
        )}
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
