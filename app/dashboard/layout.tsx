"use client";

import { useState, useEffect } from "react";
import SiteFooter from "../components/SiteFooter";
import DashboardHeader from "../components/DashboardHeader";
import DashboardSidebar from "../components/DashboardSidebar";
import { SaveBeforeSubmitModal } from "../components/SaveBeforeSubmitModal";
import { isPageSaved, loadDraft, clearProjectDrafts } from "../utils/draftStorage";
import { supabase } from "../utils/supabase";
import { clearAllProjectLibraryFiles, getProjectLibraryFile } from "../utils/projectLibraryFiles";

type RequiredPage = {
  key: string;
  label: string;
  path: string;
};

const REQUIRED_PAGES: RequiredPage[] = [
  { key: "saved-project-details", label: "Project Details", path: "/dashboard/project-details" },
  { key: "saved-applicant-details", label: "Applicant Details", path: "/dashboard/applicant" },
  { key: "saved-building-details", label: "Building Details", path: "/dashboard/building" },
  { key: "saved-area-details", label: "Area Details", path: "/dashboard/area" },
  { key: "saved-project-library", label: "Project Library", path: "/dashboard/project-library" },
  { key: "saved-bg-details", label: "BG Details", path: "/dashboard/bg" },
];

const PROJECT_LIBRARY_MAX_FILES = 5;

function extractProjectIdFromRpc(data: any): string | null {
  if (!data) return null;
  if (typeof data === "string") return data;
  if (typeof data === "object") {
    return data.id || data.project_id || data.projectId || null;
  }
  return null;
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sessionTime, setSessionTime] = useState(3600); // 60 minutes in seconds
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isSubmitModalOpen, setIsSubmitModalOpen] = useState(false);
  const [missingPages, setMissingPages] = useState<RequiredPage[]>([]);
  const [isSubmittingProject, setIsSubmittingProject] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccessMessage, setSubmitSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    const interval = setInterval(() => {
      setSessionTime((prev) => {
        if (prev <= 0) return 0;
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  // Clear all project drafts when leaving the dashboard (unmount)
  useEffect(() => {
    return () => {
      clearProjectDrafts();
    };
  }, []);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const handleSubmitProjectClick = async () => {
    setSubmitError(null);
    setSubmitSuccessMessage(null);

    const missing = REQUIRED_PAGES.filter((page) => {
      // Special handling for project details - check both tabs are saved
      if (page.key === "saved-project-details") {
        return !(isPageSaved("saved-project-info") && isPageSaved("saved-save-plot-details"));
      }
      return !isPageSaved(page.key);
    });
    if (missing.length > 0) {
      setMissingPages(missing);
      setIsSubmitModalOpen(true);
      return;
    }

    try {
      setIsSubmittingProject(true);

      // Get current user id from localStorage (set on login)
      const userId = typeof window !== "undefined" ? window.localStorage.getItem("consultantId") : null;
      if (!userId) {
        const message = "User not found in local session. Please log in again.";
        setSubmitError(message);
        alert(message);
        return;
      }

      // Collect drafts from localStorage
      const projectInfo = loadDraft("draft-project-details-project", {
        proposalAsPer: "",
        title: "",
        propertyAddress: "",
        landmark: "",
        earlierBuildingProposalFileNo: "",
        pincode: "",
        fullNameOfApplicant: "",
        addressOfApplicant: "",
        hasPaidLatestPropertyTax: "",
      });

      if (!projectInfo?.title || typeof projectInfo.title !== "string" || projectInfo.title.trim() === "") {
        const message = "Project title is missing. Please fill Project Details and save again.";
        setSubmitError(message);
        alert(message);
        return;
      }

      const savePlotDetails = loadDraft("draft-project-details-save-plot", {});
      const applicantsList = loadDraft("draft-applicant-details-applicants", []);
      const buildingDetails = loadDraft("draft-building-details-form", {});
      const areaPlots = loadDraft("draft-area-details-plots", []);
      const rawAreaTotals = loadDraft<any>("draft-area-details-totals", null);
      const areaTotals =
        rawAreaTotals && typeof rawAreaTotals === "object"
          ? {
              ...rawAreaTotals,
              allPlotsTotal: {
                prcArea: Number(rawAreaTotals?.allPlotsTotal?.prcArea ?? 0) || 0,
                ulcArea: Number(rawAreaTotals?.allPlotsTotal?.ulcArea ?? 0) || 0,
                bFormArea: Number(rawAreaTotals?.allPlotsTotal?.bFormArea ?? 0) || 0,
                conveyanceArea: Number(rawAreaTotals?.allPlotsTotal?.conveyanceArea ?? 0) || 0,
                attorneyArea: Number(rawAreaTotals?.allPlotsTotal?.attorneyArea ?? 0) || 0,
                dilrMapArea: Number(rawAreaTotals?.allPlotsTotal?.dilrMapArea ?? 0) || 0,
                leaseArea: Number(rawAreaTotals?.allPlotsTotal?.leaseArea ?? 0) || 0,
              },
              totalLeaseArea: Number(rawAreaTotals?.totalLeaseArea ?? 0) || 0,
            }
          : null;
      const projectLibraryUploads = loadDraft("draft-project-library-uploads", []);
      const bgEntries = loadDraft("draft-bg-details-entries", []);

      const payload = {
        user_id: userId,
        title: (projectInfo.title as string).toString(),
        status: "submitted",
        project_info: projectInfo,
        save_plot_details: savePlotDetails,
        applicant_details: {
          applicants: applicantsList,
        },
        building_details: buildingDetails,
        area_details: {
          plots: Array.isArray(areaPlots) ? areaPlots : [],
          totals: areaTotals,
        },
        project_library: {
          uploads: projectLibraryUploads,
        },
        bg_details: {
          entries: bgEntries,
        },
      };

      // Call Supabase RPC directly from the client so auth.uid() matches the logged-in user
      const { data, error } = await supabase.rpc("create_project", {
        p_user_id: payload.user_id,
        p_title: payload.title,
        p_status: payload.status,
        p_project_info: payload.project_info,
        p_save_plot_details: payload.save_plot_details,
        p_applicant_details: payload.applicant_details,
        p_building_details: payload.building_details,
        p_area_details: payload.area_details,
        p_project_library: payload.project_library,
        p_bg_details: payload.bg_details,
      });

      if (error) {
        console.error("Error creating project via Supabase RPC:", error);
        const message = error.message || "Failed to create project.";
        setSubmitError(message);
        alert(`Project submission failed: ${message}`);
        return;
      }

      console.log("Created project:", data);

      // Upload Project Library documents now (after project is created)
      const projectId = extractProjectIdFromRpc(data);
      if (projectId) {
        const uploads: any[] = [];
        for (let i = 0; i < PROJECT_LIBRARY_MAX_FILES; i++) {
          // eslint-disable-next-line no-await-in-loop
          const local = await getProjectLibraryFile(i);
          if (!local?.blob) continue;

          const safeDocName = `document-${i + 1}`;
          const extension = (local.name.split(".").pop() || "pdf").toLowerCase();
          const path = `${projectId}/project-library/${safeDocName}-${i + 1}.${extension}`;

          // eslint-disable-next-line no-await-in-loop
          const { error: uploadError } = await supabase.storage.from("project-library").upload(path, local.blob, {
            upsert: true,
            contentType: local.type || "application/pdf",
          });

          if (uploadError) {
            console.error("Error uploading project library doc:", uploadError);
            // Don't fail the whole project submission; just show message.
            setSubmitError(uploadError.message);
    } else {
            const { data: publicData } = supabase.storage.from("project-library").getPublicUrl(path);
            uploads.push({
              name: local.name,
              path,
              url: publicData?.publicUrl || "",
              uploadedAt: new Date().toISOString(),
            });
          }
        }

        // Persist uploaded metadata into the project record (best-effort)
        if (uploads.length > 0) {
          const { error: updateError } = await supabase
            .from("projects")
            .update({ project_library: { uploads } })
            .eq("id", projectId);
          if (updateError) {
            console.error("Failed to update project_library on project:", updateError);
          }
        }

        // Clear local IndexedDB files after submit
        await clearAllProjectLibraryFiles(PROJECT_LIBRARY_MAX_FILES);
      }

      const successMessage = "Project created and submitted successfully.";
      setSubmitSuccessMessage(successMessage);
      alert(successMessage);
      // Clear drafts for a fresh new project the next time user comes in
      clearProjectDrafts();
      // Optionally: clear drafts or navigate to a "My Projects" page here.
    } catch (err: any) {
      console.error("Error submitting project:", err);
      const message = err?.message || "Unexpected error while submitting project.";
      setSubmitError(message);
      alert(message);
    } finally {
      setIsSubmittingProject(false);
    }
  };

  return (
    <div className="h-screen bg-gray-100 flex flex-col overflow-hidden">
      {/* Top area (header) */}
      <div className="p-4 md:p-6 shrink-0">
      <DashboardHeader sessionTime={formatTime(sessionTime)} />
      </div>

      {/* Dashboard area takes remaining height */}
      <div className="px-4 md:px-6 pb-4 md:pb-6 flex-1 min-h-0 overflow-hidden">
        {/* Outer rounded container (Donezo-like) */}
        <div className="h-full w-full rounded-3xl bg-white shadow-sm border border-gray-200 overflow-hidden flex flex-col">
          <div className="flex flex-1 min-h-0 bg-gray-50">
            {/* Inner padding so sidebar/content look like separate cards */}
            <div className="p-4 md:p-6 flex flex-1 min-h-0 overflow-hidden gap-4">
              <div className="shrink-0">
                <div className="h-full rounded-2xl bg-white border border-gray-200 shadow-sm overflow-hidden">
        <DashboardSidebar
          collapsed={isSidebarCollapsed}
          onToggleSidebar={() => setIsSidebarCollapsed((prev) => !prev)}
          onSubmitProjectClick={handleSubmitProjectClick}
        />
                </div>
              </div>

              {/* Main content card: fixed height, single scrollbar */}
              <main className="flex-1 min-h-0 overflow-y-auto rounded-2xl bg-white border border-gray-200 shadow-sm px-4 md:px-6 py-6">
                {children}
              </main>
            </div>
          </div>
        </div>
      </div>

      {/* Footer at bottom (outside cards). Appears without stealing card height. */}
      <div className="shrink-0">
      <SiteFooter />
      </div>

      <SaveBeforeSubmitModal
        open={isSubmitModalOpen}
        missingPages={missingPages}
        onClose={() => setIsSubmitModalOpen(false)}
      />

      {/* Status messages */}
      {submitError && (
        <div className="fixed bottom-4 right-4 max-w-sm rounded-lg bg-red-100 text-red-800 px-4 py-2 shadow">
          {submitError}
        </div>
      )}
      {submitSuccessMessage && (
        <div className="fixed bottom-4 right-4 max-w-sm rounded-lg bg-green-100 text-green-800 px-4 py-2 shadow">
          {submitSuccessMessage}
        </div>
      )}
    </div>
  );
}


