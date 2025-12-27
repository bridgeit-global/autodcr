"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import SiteFooter from "../components/SiteFooter";
import DashboardHeader from "../components/DashboardHeader";
import DashboardSidebar from "../components/DashboardSidebar";
import { SaveBeforeSubmitModal } from "../components/SaveBeforeSubmitModal";
import { isPageSaved, loadDraft, clearProjectDrafts } from "../utils/draftStorage";
import { supabase } from "../utils/supabase";
import { clearAllProjectLibraryFiles, getProjectLibraryFile } from "../utils/projectLibraryFiles";
import { useProjectData } from "../hooks/useProjectData";

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

type BGEntry = {
  id: string;
  zone: string;
  proposalNo?: string;
  proposal_no?: string;
  fileNo?: string; // Keep for backward compatibility
  file_no?: string; // Keep for backward compatibility
  bgNumber: string;
  bgDate: string;
  bankName: string;
  branchName: string;
  amount: string;
  bgValidDate: string;
  bgBankEmail: string;
  scanCopyName: string;
};

type ProjectLibraryUpload = {
  name?: string;
  path?: string;
  url?: string;
  uploadedAt?: string;
};

function extractProjectIdFromRpc(data: any): string | null {
  if (!data) return null;
  if (typeof data === "string") return data;
  if (typeof data === "object") {
    return data.id || data.project_id || data.projectId || null;
  }
  return null;
}

function DashboardLayoutContent({
  children,
}: {
  children: React.ReactNode;
}) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const projectId = searchParams.get("projectId");
  const isEditMode = !!projectId;
  
  // Use useProjectData hook to verify project actually exists
  const { projectData: verifiedProjectData } = useProjectData();
  
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

    // In edit mode, skip the "all pages saved" check - allow updating individual sections
    if (!isEditMode) {
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

      // Get projectId from URL if not available from searchParams (fallback)
      const currentProjectId = projectId || (typeof window !== "undefined" 
        ? new URLSearchParams(window.location.search).get("projectId")
        : null);
      
      // Only treat as edit mode if projectId exists AND project data was successfully loaded
      const isActuallyEditMode = !!currentProjectId && !!verifiedProjectData;

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

      // In edit mode, get title from existing project data if not in draft
      let projectTitle = projectInfo?.title;
      if (isActuallyEditMode && verifiedProjectData && (!projectTitle || projectTitle.trim() === "")) {
        projectTitle = verifiedProjectData.title || "";
      }

      if (!projectTitle || typeof projectTitle !== "string" || projectTitle.trim() === "") {
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
      const bgEntries = loadDraft<BGEntry[]>("draft-bg-details-entries", []);

      // Get proposal number from BG Details (with backward compatibility for fileNo)
      const firstBgEntry: BGEntry | null = Array.isArray(bgEntries) && bgEntries.length > 0 ? bgEntries[0] : null;
      const proposalNo = firstBgEntry?.proposalNo || firstBgEntry?.proposal_no || firstBgEntry?.fileNo || firstBgEntry?.file_no || "";
      
      // Extract base title (remove proposal number if it was already appended in edit mode)
      let baseTitle = projectTitle as string;
      if (isActuallyEditMode && proposalNo && proposalNo.trim() !== "") {
        // Check if title ends with the proposal number (e.g., "demo 123" ends with "123")
        const proposalNoTrimmed = proposalNo.trim();
        const titleTrimmed = baseTitle.trim();
        if (titleTrimmed.endsWith(` ${proposalNoTrimmed}`)) {
          // Remove the proposal number from the end to get the base title
          baseTitle = titleTrimmed.slice(0, -(proposalNoTrimmed.length + 1)).trim();
        }
      }
      
      // Combine base title with current proposal number: "baseTitle proposalNo"
      let finalProjectTitle = baseTitle;
      if (proposalNo && proposalNo.trim() !== "") {
        finalProjectTitle = `${baseTitle} ${proposalNo}`.trim();
      }

      // Helper function to deep compare two values
      const deepEqual = (a: any, b: any): boolean => {
        if (a === b) return true;
        if (a == null || b == null) return a === b;
        if (typeof a !== typeof b) return false;
        if (typeof a !== "object") return a === b;
        if (Array.isArray(a) !== Array.isArray(b)) return false;
        
        if (Array.isArray(a)) {
          if (a.length !== b.length) return false;
          return a.every((val, idx) => deepEqual(val, b[idx]));
        }
        
        const keysA = Object.keys(a);
        const keysB = Object.keys(b);
        if (keysA.length !== keysB.length) return false;
        return keysA.every(key => deepEqual(a[key], b[key]));
      };

      // Build payload - only include sections that have been modified
      // Always include user_id, title, and status (required fields)
      const payload: any = {
        user_id: userId,
        title: finalProjectTitle,
        status: "submitted",
      };

      // Ensure user_id is always present
      if (!payload.user_id) {
        console.error("ERROR: user_id is missing from payload!");
        const message = "User ID is missing. Please log in again.";
        setSubmitError(message);
        alert(message);
        return;
      }

      // Get existing project data for comparison (only in edit mode)
      const existingData = isActuallyEditMode && verifiedProjectData ? verifiedProjectData : null;

      // Compare and include project_info only if modified
      if (projectInfo && Object.keys(projectInfo).length > 0) {
        const existingProjectInfo = existingData?.project_info || {};
        if (!deepEqual(projectInfo, existingProjectInfo)) {
          payload.project_info = projectInfo;
        }
      }

      // Compare and include save_plot_details only if modified
      if (savePlotDetails && Object.keys(savePlotDetails).length > 0) {
        const existingSavePlot = existingData?.save_plot_details || {};
        if (!deepEqual(savePlotDetails, existingSavePlot)) {
          payload.save_plot_details = savePlotDetails;
        }
      }

      // Compare and include applicant_details only if modified
      if (applicantsList && applicantsList.length > 0) {
        const existingApplicants = existingData?.applicant_details?.applicants || [];
        if (!deepEqual(applicantsList, existingApplicants)) {
          payload.applicant_details = {
            applicants: applicantsList,
          };
        }
      }

      // Compare and include building_details only if modified
      if (buildingDetails && Object.keys(buildingDetails).length > 0) {
        const existingBuilding = existingData?.building_details || {};
        if (!deepEqual(buildingDetails, existingBuilding)) {
          payload.building_details = buildingDetails;
        }
      }

      // Compare and include area_details only if modified
      if (areaPlots && Array.isArray(areaPlots) && areaPlots.length > 0) {
        const existingArea = existingData?.area_details || {};
        const existingPlots = existingArea.plots || [];
        if (!deepEqual(areaPlots, existingPlots)) {
          payload.area_details = {
            plots: areaPlots,
            totals: areaTotals,
          };
        }
      }

      // Compare and include project_library only if modified
      if (projectLibraryUploads && Array.isArray(projectLibraryUploads)) {
        const filteredUploads = projectLibraryUploads.filter((u: any) => u !== null && u !== undefined && u !== "") as ProjectLibraryUpload[];
        if (filteredUploads.length > 0) {
          const existingLibrary = existingData?.project_library || {};
          const existingUploads = existingLibrary.uploads || [];
          // Compare uploads by their essential properties (name, path, url)
          const normalizedNew = filteredUploads.map((u) => ({
            name: u?.name,
            path: u?.path,
            url: u?.url,
          }));
          const normalizedExisting = existingUploads.map((u: any) => ({
            name: u?.name,
            path: u?.path,
            url: u?.url,
          }));
          if (!deepEqual(normalizedNew, normalizedExisting)) {
            payload.project_library = {
              uploads: filteredUploads,
            };
          }
        }
      }

      // Compare and include bg_details only if modified
      if (bgEntries && Array.isArray(bgEntries) && bgEntries.length > 0) {
        const existingBg = existingData?.bg_details || {};
        const existingBgEntries = existingBg.entries || [];
        if (!deepEqual(bgEntries, existingBgEntries)) {
          payload.bg_details = {
            entries: bgEntries,
          };
        }
      }

      let finalProjectId: string | null = null;

      if (isActuallyEditMode && currentProjectId && verifiedProjectData) {
        // Update existing project
        console.log("Updating project with ID:", currentProjectId);
        console.log("Payload being sent:", JSON.stringify(payload, null, 2));
        console.log("Payload keys:", Object.keys(payload));
        console.log("User ID in payload:", payload.user_id);
        
        // Get auth token for authenticated request
        const { data: { session } } = await supabase.auth.getSession();
        const authToken = session?.access_token;
        
        const headers: HeadersInit = { "Content-Type": "application/json" };
        if (authToken) {
          headers["Authorization"] = `Bearer ${authToken}`;
        }
        
        const response = await fetch(`/api/projects/${currentProjectId}`, {
          method: "PUT",
          headers,
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          const errorData = await response.json();
          const message = errorData.error || "Failed to update project.";
          setSubmitError(message);
          alert(`Project update failed: ${message}`);
          return;
        }

        const result = await response.json();
        console.log("Updated project:", result);
        finalProjectId = result.project?.id || currentProjectId;
      } else {
        // Create new project - Call Supabase RPC directly from the client so auth.uid() matches the logged-in user
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
        finalProjectId = extractProjectIdFromRpc(data);
      }

      // Upload Project Library documents now (after project is created/updated)
      if (finalProjectId) {
        const uploads: any[] = [];
        for (let i = 0; i < PROJECT_LIBRARY_MAX_FILES; i++) {
          // eslint-disable-next-line no-await-in-loop
          const local = await getProjectLibraryFile(i);
          if (!local?.blob) continue;

          const safeDocName = `document-${i + 1}`;
          const extension = (local.name.split(".").pop() || "pdf").toLowerCase();
          const path = `${finalProjectId}/project-library/${safeDocName}-${i + 1}.${extension}`;

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
            .eq("id", finalProjectId);
          if (updateError) {
            console.error("Failed to update project_library on project:", updateError);
          }
        }

        // Clear local IndexedDB files after submit
        await clearAllProjectLibraryFiles(PROJECT_LIBRARY_MAX_FILES);
      }

      // Clear drafts for a fresh new project the next time user comes in (only in create mode)
      if (!isActuallyEditMode) {
        clearProjectDrafts();
      }
      // Redirect to user dashboard after successful submission/update
      router.push("/userdashboard");
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
      <Suspense fallback={<div className="h-16 bg-white border border-gray-200 rounded-3xl"></div>}>
        <DashboardHeader sessionTime={formatTime(sessionTime)} />
      </Suspense>
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
                  <Suspense
                    fallback={
                      <div className="w-16 md:w-64 h-full flex items-center justify-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div>
                      </div>
                    }
                  >
                    <DashboardSidebar
                      collapsed={isSidebarCollapsed}
                      onToggleSidebar={() => setIsSidebarCollapsed((prev) => !prev)}
                      onSubmitProjectClick={handleSubmitProjectClick}
                    />
                  </Suspense>
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

      {/* Loading overlay when submitting project */}
      {isSubmittingProject && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl p-8 max-w-md w-full mx-4 flex flex-col items-center space-y-4">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600"></div>
            <p className="text-lg font-semibold text-gray-900">
              {isEditMode ? "Updating Project..." : "Creating Project..."}
            </p>
            <p className="text-sm text-gray-600 text-center">
              Please wait while we {isEditMode ? "update" : "create"} your project. This may take a few moments.
            </p>
          </div>
        </div>
      )}

      {/* Status messages */}
      {submitSuccessMessage && (
        <div className="fixed bottom-4 right-4 max-w-sm rounded-lg bg-green-100 text-green-800 px-4 py-2 shadow">
          {submitSuccessMessage}
        </div>
      )}
    </div>
  );
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <DashboardLayoutContent>{children}</DashboardLayoutContent>
    </Suspense>
  );
}


