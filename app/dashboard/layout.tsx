"use client";

import { useState, useEffect, useRef, Suspense, useMemo } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import AppShell from "../components/appshell/AppShell";
import ProjectWizardToolbar from "../components/appshell/ProjectWizardToolbar";
import ProjectSectionStepper from "../components/appshell/ProjectSectionStepper";
import { ApplicationPdfSaveSlotProvider } from "./context/ApplicationPdfSaveSlotContext";
import { ApplicationSignSlotProvider } from "./context/ApplicationSignSlotContext";
import { SaveBeforeSubmitModal } from "../components/SaveBeforeSubmitModal";
import { useDashboardAlertModal } from "./context/DashboardAlertModalContext";
import { isPageSaved, loadDraft, saveDraft, clearProjectDrafts, markPageSaved } from "../utils/draftStorage";
import { supabase } from "../utils/supabase";
import { clearAllProjectLibraryFiles, clearAllExtraPrCards, getExtraPrCard, getProjectLibraryFile } from "../utils/projectLibraryFiles";
import { useProjectData } from "../hooks/useProjectData";
import { fetchProjectForEdit } from "../utils/fetchProjectForEdit";
import { buildProjectUpdatePayload, countPayloadSections } from "../utils/projectUpdatePayload";
import {
  serializeApplicantRosterForStorage,
} from "../utils/applicantRecordFields";
import { persistApplicantRosterForProject } from "../utils/resolveApplicantDetailsForProject";
import {
  applicantRosterHasOwner,
  canCreateProjectAsArchitect,
  ensureArchitectInApplicantRoster,
  ensureOwnerInApplicantRoster,
  readSessionUserMetaFromStorage,
  validateOwnerForArchitectProject,
  type ApplicantLike,
  type OwnerApplicantMeta,
} from "../utils/projectAccess";
import { ensureProjectOwnerOnRoster } from "../utils/ownerApplicantRoster";
import { sanitizeReturnUrl } from "../utils/applicationDeepLink";
import { combineProjectTitleWithProposalNo } from "../utils/projectTitleProposal";
import {
  CREATE_PROJECT_SECTIONS,
  LIBRARY_GATE_ALERT,
  DRAFT_PROJECT_LIBRARY_EXTRA_PR_KEY,
  PROJECT_LIBRARY_MAX_FILES,
  PROJECT_LIBRARY_PATH,
  isGatedCreateProjectPath,
  shouldGateCreateProjectSections,
} from "../utils/projectSections";

type RequiredPage = {
  key: string;
  label: string;
  path: string;
};

const REQUIRED_PAGES: RequiredPage[] = CREATE_PROJECT_SECTIONS.map((section) => ({
  key: section.savedKey,
  label: section.label,
  path: section.path,
}));

type ProjectLibraryUpload = {
  name?: string;
  path?: string;
  url?: string;
  uploadedAt?: string;
};

function loadAllProjectLibraryUploadsFromDraft(): unknown[] {
  const fixed = loadDraft("draft-project-library-uploads", []);
  const extraPrSlots = loadDraft<{ id: string; upload?: ProjectLibraryUpload }[]>(
    DRAFT_PROJECT_LIBRARY_EXTRA_PR_KEY,
    []
  );
  const extraUploads = Array.isArray(extraPrSlots)
    ? extraPrSlots.map((slot) => slot?.upload).filter(Boolean)
    : [];
  return [
    ...(Array.isArray(fixed) ? fixed.filter(Boolean) : []),
    ...extraUploads,
  ];
}

async function uploadProjectLibraryFilesToStorage(
  projectId: string
): Promise<ProjectLibraryUpload[]> {
  const uploads: ProjectLibraryUpload[] = [];

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
      continue;
    }
    const { data: publicData } = supabase.storage.from("project-library").getPublicUrl(path);
    uploads.push({
      name: local.name,
      path,
      url: publicData?.publicUrl || "",
      uploadedAt: new Date().toISOString(),
    });
  }

  const extraPrSlots = loadDraft<{ id: string }[]>(DRAFT_PROJECT_LIBRARY_EXTRA_PR_KEY, []);
  if (Array.isArray(extraPrSlots)) {
    for (let i = 0; i < extraPrSlots.length; i++) {
      const slot = extraPrSlots[i];
      if (!slot?.id) continue;
      // eslint-disable-next-line no-await-in-loop
      const local = await getExtraPrCard(slot.id);
      if (!local?.blob) continue;
      const extension = (local.name.split(".").pop() || "pdf").toLowerCase();
      const path = `${projectId}/project-library/extra-pr-${i + 1}.${extension}`;
      // eslint-disable-next-line no-await-in-loop
      const { error: uploadError } = await supabase.storage.from("project-library").upload(path, local.blob, {
        upsert: true,
        contentType: local.type || "application/pdf",
      });
      if (uploadError) {
        console.error("Error uploading extra PR card:", uploadError);
        continue;
      }
      const { data: publicData } = supabase.storage.from("project-library").getPublicUrl(path);
      uploads.push({
        name: local.name,
        path,
        url: publicData?.publicUrl || "",
        uploadedAt: new Date().toISOString(),
      });
    }
  }

  return uploads;
}

async function clearLocalProjectLibraryFiles(): Promise<void> {
  await clearAllProjectLibraryFiles(PROJECT_LIBRARY_MAX_FILES);
  const extraPrSlots = loadDraft<{ id: string }[]>(DRAFT_PROJECT_LIBRARY_EXTRA_PR_KEY, []);
  if (Array.isArray(extraPrSlots)) {
    await clearAllExtraPrCards(extraPrSlots.map((slot) => slot.id).filter(Boolean));
  }
}

function extractProjectIdFromRpc(data: any): string | null {
  if (!data) return null;
  if (typeof data === "string") return data;
  if (typeof data === "object") {
    return data.id || data.project_id || data.projectId || null;
  }
  return null;
}

function readSessionUserMeta() {
  return readSessionUserMetaFromStorage();
}

/** @returns Error message when roster could not be written to public.applicants */
async function persistProjectApplicantRoster(
  projectId: string,
  sessionUserId: string,
  options: {
    applicantDetails?: unknown;
    isArchitectCreate: boolean;
    projectOwnerUserId?: string | null;
  }
): Promise<string | null> {
  const draftApplicants = loadDraft<unknown[]>("draft-applicant-details-applicants", []);
  const base =
    options.applicantDetails && typeof options.applicantDetails === "object"
      ? options.applicantDetails
      : { applicants: draftApplicants };

  const sessionMeta = readSessionUserMetaFromStorage();
  let roster: { applicants: unknown[] };

  if (options.isArchitectCreate) {
    roster = ensureArchitectInApplicantRoster(base, sessionUserId, sessionMeta);
    const ownerUserId = options.projectOwnerUserId?.trim() || null;
    if (ownerUserId) {
      roster = await ensureProjectOwnerOnRoster(roster, ownerUserId, {
        sessionUserId,
      });
    }
  } else {
    roster = {
      applicants: Array.isArray((base as { applicants?: unknown[] }).applicants)
        ? [...(base as { applicants: unknown[] }).applicants]
        : [],
    };
    if (!applicantRosterHasOwner(roster.applicants as ApplicantLike[])) {
      roster = ensureOwnerInApplicantRoster(
        roster,
        sessionUserId,
        sessionMeta as OwnerApplicantMeta
      );
    }
  }

  const applicantRows = Array.isArray((roster as { applicants?: unknown[] }).applicants)
    ? (roster as { applicants: unknown[] }).applicants
    : [];

  const serialized = serializeApplicantRosterForStorage(applicantRows);
  if (serialized.applicants.length === 0) {
    return (
      "Applicant roster was not saved. On Applicant Details, add Owner (and other roles) using the directory dropdown, then save again."
    );
  }

  const { error: rosterError } = await persistApplicantRosterForProject(
    supabase,
    projectId,
    serialized
  );
  if (rosterError) {
    console.warn("replace_applicants_for_project after project save:", rosterError);
    return rosterError;
  }
  return null;
}

type ProjectCreatePayload = {
  title: string;
  status: string;
  project_info?: Record<string, unknown>;
  save_plot_details?: Record<string, unknown>;
  building_details?: Record<string, unknown>;
  area_details?: Record<string, unknown>;
  project_library?: Record<string, unknown>;
};

async function rpcCreateProject(
  sessionUserId: string,
  ownerUserId: string | null,
  payload: ProjectCreatePayload
): Promise<{ projectId: string | null; errorMessage: string | null }> {
  const meta = readSessionUserMeta();
  const isArchitectCreate =
    canCreateProjectAsArchitect(meta) && ownerUserId && ownerUserId !== sessionUserId;

  if (isArchitectCreate) {
    const { data, error } = await supabase.rpc("create_project_by_architect", {
      p_owner_user_id: ownerUserId,
      p_title: payload.title,
      p_status: payload.status,
      p_project_info: payload.project_info ?? {},
      p_save_plot_details: payload.save_plot_details ?? {},
      p_applicant_details: {},
      p_building_details: payload.building_details ?? {},
      p_area_details: payload.area_details ?? {},
      p_project_library: payload.project_library ?? {},
      p_bg_details: {},
    });
    if (error) {
      return { projectId: null, errorMessage: error.message || "Failed to create project." };
    }
    return { projectId: extractProjectIdFromRpc(data), errorMessage: null };
  }

  const { data, error } = await supabase.rpc("create_project", {
    p_user_id: sessionUserId,
    p_title: payload.title,
    p_status: payload.status,
    p_project_info: payload.project_info ?? {},
    p_save_plot_details: payload.save_plot_details ?? {},
    p_applicant_details: {},
    p_building_details: payload.building_details ?? {},
    p_area_details: payload.area_details ?? {},
    p_project_library: payload.project_library ?? {},
    p_bg_details: {},
  });
  if (error) {
    return { projectId: null, errorMessage: error.message || "Failed to create project." };
  }
  return { projectId: extractProjectIdFromRpc(data), errorMessage: null };
}

/** Sections not yet saved (local draft flags), with routes for direct navigation. */
function getUnsavedRequiredPages(): RequiredPage[] {
  const pages: RequiredPage[] = [];

  for (const section of CREATE_PROJECT_SECTIONS) {
    if (section.id === "project-details") {
      if (!isPageSaved("saved-save-plot-details")) {
        pages.push({
          key: "saved-save-plot-details",
          label: "Project Details (Save Plot Details)",
          path: "/dashboard/project-details?tab=save-plot",
        });
      }
      if (!isPageSaved("saved-project-info")) {
        pages.push({
          key: "saved-project-info",
          label: "Project Details (Project Info)",
          path: "/dashboard/project-details?tab=project-info",
        });
      }
      continue;
    }

    if (!isPageSaved(section.savedKey)) {
      pages.push({
        key: section.savedKey,
        label: section.label,
        path: section.path,
      });
    }
  }

  return pages;
}

function DashboardLayoutContent({
  children,
}: {
  children: React.ReactNode;
}) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const { showAlert } = useDashboardAlertModal();
  const projectId = searchParams.get("projectId");
  const isEditMode = !!projectId;
  const mode = searchParams.get("mode");
  const isReadOnlyMode = mode === "readonly";
  const selectedApplication = searchParams.get("selectedApplication");
  const [authState, setAuthState] = useState<
    "checking" | "authenticated" | "unauthenticated"
  >("checking");

  useEffect(() => {
    let cancelled = false;
    void supabase.auth.getSession().then(({ data: { session } }) => {
      if (cancelled) return;
      if (!session?.access_token) {
        const qs = searchParams.toString();
        const returnPath = sanitizeReturnUrl(
          qs ? `${pathname}?${qs}` : pathname
        );
        router.replace(`/login?returnUrl=${encodeURIComponent(returnPath)}`);
        setAuthState("unauthenticated");
        return;
      }
      setAuthState("authenticated");
    });
    return () => {
      cancelled = true;
    };
  }, [pathname, router, searchParams]);
  
  // Use useProjectData hook to verify project actually exists
  const { projectData: verifiedProjectData, isLoading: isProjectDataLoading, error: projectDataError } =
    useProjectData();
  
  const isDraftProject = !!(verifiedProjectData && verifiedProjectData.status === "draft");

  const [isSubmitModalOpen, setIsSubmitModalOpen] = useState(false);
  const [missingPages, setMissingPages] = useState<RequiredPage[]>([]);
  const [isSubmittingProject, setIsSubmittingProject] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccessMessage, setSubmitSuccessMessage] = useState<string | null>(null);
  const [allPagesSaved, setAllPagesSaved] = useState(false);
  const [showDraftConfirm, setShowDraftConfirm] = useState(false);

  useEffect(() => {
    const checkAllPagesSaved = () => {
      const allSaved = REQUIRED_PAGES.every((page) => {
        if (page.key === "saved-project-details") {
          return isPageSaved("saved-project-info") && isPageSaved("saved-save-plot-details");
        }
        return isPageSaved(page.key);
      });
      setAllPagesSaved(allSaved);
    };

    checkAllPagesSaved();
    const interval = setInterval(checkAllPagesSaved, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (authState !== "authenticated") return;
    if (!shouldGateCreateProjectSections({ isEditMode, isReadOnlyMode })) return;
    if (!isGatedCreateProjectPath(pathname)) return;

    const qs = searchParams.toString();
    showAlert(LIBRARY_GATE_ALERT);
    router.replace(qs ? `${PROJECT_LIBRARY_PATH}?${qs}` : PROJECT_LIBRARY_PATH);
  }, [authState, isEditMode, isReadOnlyMode, pathname, router, searchParams, showAlert]);

  // Pre-mark sections that already have meaningful data for draft projects.
  // Runs synchronously during render (not in useEffect) so that child components
  // see the correct localStorage flags when they initialize their state.
  const preMarkedProjectRef = useRef<string | null>(null);
  if (
    verifiedProjectData &&
    verifiedProjectData.status === "draft" &&
    preMarkedProjectRef.current !== verifiedProjectData.id
  ) {
    preMarkedProjectRef.current = verifiedProjectData.id ?? null;

    const hasMeaningful = (val: any): boolean => {
      if (val === null || val === undefined) return false;
      if (typeof val === "string") return val.trim().length > 0;
      if (typeof val === "number") return true;
      if (typeof val === "boolean") return val;
      if (Array.isArray(val)) return val.length > 0 && val.some(hasMeaningful);
      if (typeof val === "object") return Object.values(val).some(hasMeaningful);
      return false;
    };

    if (hasMeaningful(verifiedProjectData.project_info)) markPageSaved("saved-project-info");
    if (hasMeaningful(verifiedProjectData.save_plot_details)) markPageSaved("saved-save-plot-details");
    if (hasMeaningful(verifiedProjectData.applicant_details)) markPageSaved("saved-applicant-details");
    if (hasMeaningful(verifiedProjectData.building_details)) markPageSaved("saved-building-details");
    if (hasMeaningful(verifiedProjectData.area_details)) markPageSaved("saved-area-details");
    if (hasMeaningful(verifiedProjectData.project_library)) {
      markPageSaved("saved-project-library");
      const libraryUploads = (verifiedProjectData.project_library as { uploads?: unknown[] })
        ?.uploads;
      if (Array.isArray(libraryUploads)) {
        const uploadCount = libraryUploads.filter(Boolean).length;
        if (uploadCount >= 1) {
          saveDraft("saved-project-library-files", { count: uploadCount });
        }
      }
    }
  }

  // Clear all project drafts when leaving the dashboard (unmount)
  useEffect(() => {
    return () => {
      clearProjectDrafts();
    };
  }, []);

  const buildProjectPayload = (statusOverride: string) => {
    const userId = typeof window !== "undefined" ? window.localStorage.getItem("consultantId") : null;

    const projectInfo = loadDraft("draft-project-details-project", {
      proposalAsPer: "",
      title: "",
      proposalNo: "",
      propertyAddress: "",
      landmark: "",
      earlierBuildingProposalFileNo: "",
      pincode: "",
      fullNameOfApplicant: "",
      addressOfApplicant: "",
      hasPaidLatestPropertyTax: "",
    });

    let projectTitle = (projectInfo as any)?.title;
    const currentProjectId = projectId || (typeof window !== "undefined"
      ? new URLSearchParams(window.location.search).get("projectId")
      : null);
    const isActuallyEditMode = !!currentProjectId && !!verifiedProjectData;

    if (isActuallyEditMode && verifiedProjectData && (!projectTitle || projectTitle.trim() === "")) {
      projectTitle = verifiedProjectData.title || "";
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
    const allProjectLibraryUploads = loadAllProjectLibraryUploadsFromDraft();

    const proposalNo = (projectInfo as any)?.proposalNo?.trim() || "";
    const previousProposalNo = String(
      (verifiedProjectData?.project_info as { proposalNo?: string } | undefined)
        ?.proposalNo || ""
    ).trim();

    const finalProjectTitle = combineProjectTitleWithProposalNo(
      (projectTitle as string) || "",
      proposalNo,
      [previousProposalNo]
    );

    const deepEqual = (a: any, b: any): boolean => {
      if (a === b) return true;
      if (a == null || b == null) return a === b;
      if (typeof a !== typeof b) return false;
      if (typeof a !== "object") return a === b;
      if (Array.isArray(a) !== Array.isArray(b)) return false;
      if (Array.isArray(a)) {
        if (a.length !== b.length) return false;
        return a.every((val: any, idx: number) => deepEqual(val, b[idx]));
      }
      const keysA = Object.keys(a);
      const keysB = Object.keys(b);
      if (keysA.length !== keysB.length) return false;
      return keysA.every(key => deepEqual(a[key], b[key]));
    };

    const payload: any = {
      user_id: userId,
      title: finalProjectTitle,
      status: statusOverride,
    };

    const existingData = isActuallyEditMode && verifiedProjectData ? verifiedProjectData : null;

    if (projectInfo && Object.keys(projectInfo).length > 0) {
      const existingProjectInfo = existingData?.project_info || {};
      if (!deepEqual(projectInfo, existingProjectInfo)) {
        payload.project_info = projectInfo;
      }
    }

    if (savePlotDetails && Object.keys(savePlotDetails).length > 0) {
      const existingSavePlot = existingData?.save_plot_details || {};
      if (!deepEqual(savePlotDetails, existingSavePlot)) {
        payload.save_plot_details = savePlotDetails;
      }
    }

    if (applicantsList && (applicantsList as any[]).length > 0) {
      const existingApplicants = existingData?.applicant_details?.applicants || [];
      if (!deepEqual(applicantsList, existingApplicants)) {
        payload.applicant_details = serializeApplicantRosterForStorage(
          applicantsList as unknown[]
        );
      }
    }

    if (buildingDetails && Object.keys(buildingDetails).length > 0) {
      const existingBuilding = existingData?.building_details || {};
      if (!deepEqual(buildingDetails, existingBuilding)) {
        payload.building_details = buildingDetails;
      }
    }

    if (areaPlots && Array.isArray(areaPlots) && areaPlots.length > 0) {
      const existingArea = existingData?.area_details || {};
      const existingPlots = existingArea.plots || [];
      if (!deepEqual(areaPlots, existingPlots)) {
        payload.area_details = { plots: areaPlots, totals: areaTotals };
      }
    }

    if (allProjectLibraryUploads && Array.isArray(allProjectLibraryUploads)) {
      const filteredUploads = (allProjectLibraryUploads as any[]).filter((u: any) => u !== null && u !== undefined && u !== "") as ProjectLibraryUpload[];
      if (filteredUploads.length > 0) {
        const existingLibrary = existingData?.project_library || {};
        const existingUploads = existingLibrary.uploads || [];
        const normalizedNew = filteredUploads.map((u) => ({ name: u?.name, path: u?.path, url: u?.url }));
        const normalizedExisting = existingUploads.map((u: any) => ({ name: u?.name, path: u?.path, url: u?.url }));
        if (!deepEqual(normalizedNew, normalizedExisting)) {
          payload.project_library = { uploads: filteredUploads };
        }
      }
    }

    return { payload, isActuallyEditMode, currentProjectId };
  };

  const draftRemainingPages = useMemo(() => {
    if (!showDraftConfirm) return [];
    return getUnsavedRequiredPages();
  }, [showDraftConfirm, allPagesSaved]);

  const handleSaveDraftClick = () => {
    setShowDraftConfirm(true);
  };

  const navigateToDraftPage = (path: string) => {
    setShowDraftConfirm(false);
    if (projectId) {
      const separator = path.includes("?") ? "&" : "?";
      router.push(`${path}${separator}projectId=${projectId}`);
    } else {
      router.push(path);
    }
  };

  const handleDraftConfirmYes = async () => {
    setShowDraftConfirm(false);
    setSubmitError(null);
    setSubmitSuccessMessage(null);

    try {
      setIsSubmittingProject(true);

      const { payload, isActuallyEditMode, currentProjectId } = buildProjectPayload("draft");

      if (!payload.user_id) {
        const message = "User not found in local session. Please log in again.";
        setSubmitError(message);
        showAlert({ title: "Session required", message });
        return;
      }

      const projectInfoSaved = isPageSaved("saved-project-info");
      const savePlotSaved = isPageSaved("saved-save-plot-details");
      if (!projectInfoSaved || !savePlotSaved) {
        const pages: RequiredPage[] = [];
        if (!savePlotSaved) {
          pages.push({
            key: "saved-save-plot-details",
            label: "Project Details (Save Plot Details)",
            path: "/dashboard/project-details?tab=save-plot",
          });
        }
        if (!projectInfoSaved) {
          pages.push({
            key: "saved-project-info",
            label: "Project Details (Project Info)",
            path: "/dashboard/project-details?tab=project-info",
          });
        }
        setIsSubmittingProject(false);
        setMissingPages(pages);
        setIsSubmitModalOpen(true);
        return;
      }

      if (!payload.title || typeof payload.title !== "string" || payload.title.trim() === "") {
        const message = "Project title is missing. Please fill in the title under Project Details.";
        setSubmitError(message);
        showAlert({ title: "Missing project title", message });
        return;
      }

      const sessionUserId = payload.user_id;
      const meta = readSessionUserMeta();
      const isArchitectCreate =
        canCreateProjectAsArchitect(meta) && !isActuallyEditMode;
      let ownerUserIdForCreate: string | null = null;
      if (isArchitectCreate) {
        const applicantsList = loadDraft("draft-applicant-details-applicants", []);
        const ownerCheck = validateOwnerForArchitectProject(
          applicantsList as Array<{
            user_id?: string;
            userId?: string;
            applicantType?: string;
            applicant_type?: string;
          }>,
          sessionUserId
        );
        if (!ownerCheck.ok) {
          setSubmitError(ownerCheck.message);
          showAlert({ title: "Owner required", message: ownerCheck.message });
          return;
        }
        ownerUserIdForCreate = ownerCheck.ownerUserId;
      } else if (canCreateProjectAsArchitect(meta) && isActuallyEditMode) {
        const applicantsList = loadDraft("draft-applicant-details-applicants", []);
        const ownerCheck = validateOwnerForArchitectProject(
          applicantsList as Array<{
            user_id?: string;
            userId?: string;
            applicantType?: string;
            applicant_type?: string;
          }>,
          sessionUserId
        );
        if (!ownerCheck.ok) {
          setSubmitError(ownerCheck.message);
          showAlert({ title: "Owner required", message: ownerCheck.message });
          return;
        }
      }

      let finalProjectId: string | null = null;

      if (isActuallyEditMode && currentProjectId && verifiedProjectData) {
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
          const message = errorData.error || "Failed to save draft.";
          setSubmitError(message);
          showAlert({ title: "Draft save failed", message });
          return;
        }

        const result = await response.json();
        finalProjectId = result.project?.id || currentProjectId;
      } else {
        let existingDraft: { id: string } | null = null;
        if (isArchitectCreate && ownerUserIdForCreate) {
          const { data: architectDrafts } = await supabase
            .from("projects")
            .select("id")
            .eq("architect_user_id", sessionUserId)
            .eq("title", payload.title)
            .eq("status", "draft")
            .limit(1);
          existingDraft =
            architectDrafts && architectDrafts.length > 0 ? architectDrafts[0] : null;
        } else {
          const { data: existingDrafts } = await supabase
            .from("projects")
            .select("id")
            .eq("user_id", payload.user_id)
            .eq("title", payload.title)
            .eq("status", "draft")
            .limit(1);
          existingDraft =
            existingDrafts && existingDrafts.length > 0 ? existingDrafts[0] : null;
        }

        if (existingDraft) {
          // Update the existing draft instead of creating a duplicate
          const { data: { session } } = await supabase.auth.getSession();
          const authToken = session?.access_token;
          const headers: HeadersInit = { "Content-Type": "application/json" };
          if (authToken) {
            headers["Authorization"] = `Bearer ${authToken}`;
          }

          const response = await fetch(`/api/projects/${existingDraft.id}`, {
            method: "PUT",
            headers,
            body: JSON.stringify(payload),
          });

          if (!response.ok) {
            const errorData = await response.json();
            const message = errorData.error || "Failed to update existing draft.";
            setSubmitError(message);
            showAlert({ title: "Draft save failed", message });
            return;
          }

          finalProjectId = existingDraft.id;
        } else {
          const { projectId: createdId, errorMessage } = await rpcCreateProject(
            sessionUserId,
            ownerUserIdForCreate,
            {
              title: payload.title,
              status: "draft",
              project_info: payload.project_info,
              save_plot_details: payload.save_plot_details,
              building_details: payload.building_details,
              area_details: payload.area_details,
              project_library: payload.project_library,
            }
          );

          if (errorMessage) {
            console.error("Error saving draft via Supabase RPC:", errorMessage);
            setSubmitError(errorMessage);
            showAlert({ title: "Draft save failed", message: errorMessage });
            return;
          }

          finalProjectId = createdId;
        }
      }

      if (finalProjectId) {
        const rosterErr = await persistProjectApplicantRoster(finalProjectId, sessionUserId, {
          applicantDetails: payload.applicant_details,
          isArchitectCreate: Boolean(isArchitectCreate),
          projectOwnerUserId: ownerUserIdForCreate,
        });
        if (rosterErr) {
          setSubmitError(rosterErr);
          showAlert({ title: "Applicants not saved", message: rosterErr });
          return;
        }
        if (typeof window !== "undefined") {
          window.sessionStorage.setItem("lastProjectId", finalProjectId);
        }
      }

      if (finalProjectId) {
        const uploads = await uploadProjectLibraryFilesToStorage(finalProjectId);
        if (uploads.length > 0) {
          const { error: updateError } = await supabase
            .from("projects")
            .update({ project_library: { uploads } })
            .eq("id", finalProjectId);
          if (updateError) {
            console.error("Failed to update project_library on project:", updateError);
          }
        }

        await clearLocalProjectLibraryFiles();
      }

      clearProjectDrafts();
      router.push("/userdashboard");
    } catch (err: any) {
      console.error("Error saving draft:", err);
      const message = err?.message || "Unexpected error while saving draft.";
      setSubmitError(message);
      showAlert({ title: "Could not save draft", message });
    } finally {
      setIsSubmittingProject(false);
    }
  };

  const handleSubmitProjectClick = async () => {
    setSubmitError(null);
    setSubmitSuccessMessage(null);

    const isSubmittedProject = isEditMode && !isDraftProject;
    if (!isSubmittedProject) {
      const missing = REQUIRED_PAGES.filter((page) => {
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

    if (isEditMode && isProjectDataLoading) {
      const message = "Project is still loading. Please wait a moment and try again.";
      setSubmitError(message);
      showAlert({ title: "Please wait", message });
      return;
    }

    try {
      setIsSubmittingProject(true);

      const userId = typeof window !== "undefined" ? window.localStorage.getItem("consultantId") : null;
      if (!userId) {
        const message = "User not found in local session. Please log in again.";
        setSubmitError(message);
        showAlert({ title: "Session required", message });
        return;
      }

      const currentProjectId =
        projectId ||
        (typeof window !== "undefined"
          ? new URLSearchParams(window.location.search).get("projectId")
          : null);

      const isActuallyEditMode = !!currentProjectId;

      let existingData = verifiedProjectData;
      if (isActuallyEditMode && currentProjectId && !existingData) {
        const { project, error: loadError } = await fetchProjectForEdit(currentProjectId);
        if (loadError || !project) {
          const message =
            loadError || projectDataError || "Could not load project for update. Please refresh and try again.";
          setSubmitError(message);
          showAlert({ title: "Could not load project", message });
          return;
        }
        existingData = project;
      }

      const projectInfo = loadDraft("draft-project-details-project", {
        proposalAsPer: "",
        title: "",
        proposalNo: "",
        propertyAddress: "",
        landmark: "",
        earlierBuildingProposalFileNo: "",
        pincode: "",
        fullNameOfApplicant: "",
        addressOfApplicant: "",
        hasPaidLatestPropertyTax: "",
      });

      let projectTitle = (projectInfo as { title?: string })?.title;
      if (isActuallyEditMode && existingData && (!projectTitle || projectTitle.trim() === "")) {
        projectTitle = (existingData.title as string) || "";
      }

      if (!projectTitle || typeof projectTitle !== "string" || projectTitle.trim() === "") {
        const message = "Project title is missing. Please fill Project Details and save again.";
        setSubmitError(message);
        showAlert({ title: "Missing project title", message });
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
      const projectLibraryUploads = loadAllProjectLibraryUploadsFromDraft();

      const proposalNo = (projectInfo as { proposalNo?: string })?.proposalNo?.trim() || "";
      const previousProposalNo = String(
        (existingData?.project_info as { proposalNo?: string } | undefined)?.proposalNo ||
          ""
      ).trim();

      const finalProjectTitle = combineProjectTitleWithProposalNo(
        projectTitle as string,
        proposalNo,
        [previousProposalNo]
      );

      const payload = buildProjectUpdatePayload({
        userId,
        finalProjectTitle,
        existingData: isActuallyEditMode ? existingData : null,
        partialUpdate: isSubmittedProject,
        projectInfo: projectInfo as Record<string, unknown>,
        savePlotDetails: savePlotDetails as Record<string, unknown>,
        applicantsList,
        buildingDetails: buildingDetails as Record<string, unknown>,
        areaPlots,
        areaTotals,
        projectLibraryUploads,
      });

      if (!payload.user_id) {
        const message = "User ID is missing. Please log in again.";
        setSubmitError(message);
        showAlert({ title: "Session required", message });
        return;
      }

      const meta = readSessionUserMeta();
      const isArchitectCreate =
        canCreateProjectAsArchitect(meta) && !isActuallyEditMode;
      let ownerUserIdForCreate: string | null = null;
      if (isArchitectCreate) {
        const ownerCheck = validateOwnerForArchitectProject(
          applicantsList as Array<{
            user_id?: string;
            userId?: string;
            applicantType?: string;
            applicant_type?: string;
          }>,
          userId
        );
        if (!ownerCheck.ok) {
          setSubmitError(ownerCheck.message);
          showAlert({ title: "Owner required", message: ownerCheck.message });
          return;
        }
        ownerUserIdForCreate = ownerCheck.ownerUserId;
      } else if (canCreateProjectAsArchitect(meta) && isActuallyEditMode) {
        const ownerCheck = validateOwnerForArchitectProject(
          applicantsList as Array<{
            user_id?: string;
            userId?: string;
            applicantType?: string;
            applicant_type?: string;
          }>,
          userId
        );
        if (!ownerCheck.ok) {
          setSubmitError(ownerCheck.message);
          showAlert({ title: "Owner required", message: ownerCheck.message });
          return;
        }
        ownerUserIdForCreate = ownerCheck.ownerUserId;
      }

      let finalProjectId: string | null = null;

      if (isActuallyEditMode && currentProjectId) {
        const sectionCount = countPayloadSections(payload);
        const titleChanged =
          !!existingData &&
          finalProjectTitle.trim() !== String(existingData.title ?? "").trim();
        if (isSubmittedProject && sectionCount === 0 && !titleChanged) {
          const message =
            "No changes to save. Edit a section, use Save on that page, then click Update Project again.";
          setSubmitError(message);
          showAlert({ title: "No changes to save", message });
          return;
        }

        const { data: { session } } = await supabase.auth.getSession();
        const authToken = session?.access_token;
        if (!authToken) {
          const message = "Your session expired. Please log in again.";
          setSubmitError(message);
          showAlert({ title: "Session expired", message });
          return;
        }

        const headers: HeadersInit = {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        };

        const response = await fetch(`/api/projects/${currentProjectId}`, {
          method: "PUT",
          headers,
          body: JSON.stringify({
            ...payload,
            ...(ownerUserIdForCreate
              ? { project_owner_user_id: ownerUserIdForCreate }
              : {}),
          }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          const message = errorData.error || "Failed to update project.";
          setSubmitError(message);
          showAlert({ title: "Project update failed", message });
          return;
        }

        const result = await response.json();
        finalProjectId = result.project?.id || currentProjectId;
        setSubmitSuccessMessage("Project updated successfully.");
      } else {
        const { projectId: createdId, errorMessage } = await rpcCreateProject(
          userId,
          ownerUserIdForCreate,
          {
            title: payload.title,
            status: payload.status,
            project_info: payload.project_info as Record<string, unknown> | undefined,
            save_plot_details: payload.save_plot_details as Record<string, unknown> | undefined,
            building_details: payload.building_details as Record<string, unknown> | undefined,
            area_details: payload.area_details as Record<string, unknown> | undefined,
            project_library: payload.project_library as Record<string, unknown> | undefined,
          }
        );

        if (errorMessage) {
          console.error("Error creating project via Supabase RPC:", errorMessage);
          setSubmitError(errorMessage);
          showAlert({ title: "Project submission failed", message: errorMessage });
          return;
        }

        finalProjectId = createdId;
      }

      if (finalProjectId) {
        const rosterErr = await persistProjectApplicantRoster(finalProjectId, userId, {
          applicantDetails: payload.applicant_details,
          isArchitectCreate: Boolean(isArchitectCreate),
          projectOwnerUserId: ownerUserIdForCreate,
        });
        if (rosterErr) {
          setSubmitError(rosterErr);
          showAlert({ title: "Applicants not saved", message: rosterErr });
          return;
        }
        if (!isActuallyEditMode && typeof window !== "undefined") {
          window.sessionStorage.setItem("lastProjectId", finalProjectId);
        }
      }

      // Upload Project Library documents now (after project is created/updated)
      if (finalProjectId) {
        const uploads = await uploadProjectLibraryFilesToStorage(finalProjectId);

        if (uploads.length > 0) {
          const { error: updateError } = await supabase
            .from("projects")
            .update({ project_library: { uploads } })
            .eq("id", finalProjectId);
          if (updateError) {
            console.error("Failed to update project_library on project:", updateError);
          }
        }

        await clearLocalProjectLibraryFiles();
      }

      // Notify applicants via email (fire-and-forget — don't block redirect)
      if (finalProjectId) {
        supabase.auth.getSession().then(({ data: { session: notifSession } }) => {
          const notifToken = notifSession?.access_token;
          if (notifToken) {
            fetch(`/api/projects/${finalProjectId}/notify-applicants`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${notifToken}`,
              },
              body: JSON.stringify({
                type: isActuallyEditMode ? "updated" : "submitted",
              }),
            }).catch((err) =>
              console.error("Applicant notification request failed:", err)
            );
          }
        });
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
      showAlert({ title: "Something went wrong", message });
    } finally {
      setIsSubmittingProject(false);
    }
  };

  if (authState === "checking" || authState === "unauthenticated") {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-surface">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-gray-200 border-t-brand-blue" />
      </div>
    );
  }

  const shellTitle = isReadOnlyMode
    ? selectedApplication || "Application"
    : isEditMode
      ? "Edit Project"
      : "Create Project";

  return (
    <>
      <AppShell title={shellTitle}>
        <ApplicationPdfSaveSlotProvider>
          <ApplicationSignSlotProvider>
            <div className="mx-auto flex min-h-0 max-w-7xl flex-1 flex-col px-4 py-4 sm:px-6 lg:px-8">
              <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl bg-white shadow-sm">
                <div className="shrink-0">
                  <ProjectWizardToolbar
                    onSubmitProjectClick={handleSubmitProjectClick}
                    onSaveDraftClick={handleSaveDraftClick}
                    allPagesSaved={allPagesSaved}
                    isDraftProject={isDraftProject}
                    isEditMode={isEditMode}
                    isReadOnlyMode={isReadOnlyMode}
                    isProjectDataLoading={isProjectDataLoading}
                    isSubmittingProject={isSubmittingProject}
                  />
                </div>
                <div className="shrink-0">
                  <Suspense
                    fallback={
                      <div className="border-b border-gray-100 px-4 py-4 text-sm text-gray-500">
                        Loading sections…
                      </div>
                    }
                  >
                    <ProjectSectionStepper />
                  </Suspense>
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-5 sm:px-6">
                  {children}
                </div>
              </div>
            </div>
          </ApplicationSignSlotProvider>
        </ApplicationPdfSaveSlotProvider>
      </AppShell>

      <SaveBeforeSubmitModal
        open={isSubmitModalOpen}
        missingPages={missingPages}
        onClose={() => setIsSubmitModalOpen(false)}
      />

      {showDraftConfirm && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div
            className={`bg-white rounded-xl shadow-2xl p-6 w-full mx-4 ${
              draftRemainingPages.length > 0 ? "max-w-md" : "max-w-sm"
            }`}
          >
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Save as Draft</h3>
            <p className="text-sm text-gray-600">
              Are you sure you want to save changes as draft?
            </p>
            {draftRemainingPages.length > 0 && (
              <div className="mt-4 space-y-2">
                <p className="text-sm text-gray-600">
                  The following sections are not saved yet. Open a section to complete and save
                  it before saving the draft:
                </p>
                <ul className="space-y-2 max-h-48 overflow-y-auto">
                  {draftRemainingPages.map((page) => (
                    <li key={page.key}>
                      <button
                        type="button"
                        onClick={() => navigateToDraftPage(page.path)}
                        className="w-full flex items-center justify-between px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-800 hover:border-brand-blue hover:bg-blue-50 transition-colors"
                      >
                        <span>{page.label}</span>
                        <span className="text-xs text-brand-blue font-medium shrink-0 ml-2">
                          Go to section
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <div className="flex justify-end gap-3 mt-6">
              <button
                type="button"
                onClick={() => setShowDraftConfirm(false)}
                className="px-4 py-2 rounded-lg text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDraftConfirmYes}
                className="px-4 py-2 rounded-lg text-sm font-semibold bg-brand-blue hover:bg-brand-blue-hover text-white shadow-sm transition-all"
              >
                Yes, Save Draft
              </button>
            </div>
          </div>
        </div>
      )}

      {isSubmittingProject && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl p-8 max-w-md w-full mx-4 flex flex-col items-center space-y-4">
            <div className="animate-spin rounded-full h-12 w-12 border-2 border-gray-200 border-t-brand-blue"></div>
            <p className="text-lg font-semibold text-gray-900">
              {isEditMode ? "Updating Project..." : allPagesSaved ? "Creating Project..." : "Saving Draft..."}
            </p>
            <p className="text-sm text-gray-600 text-center">
              Please wait while we {isEditMode ? "update" : allPagesSaved ? "create" : "save"} your project. This may take a few moments.
            </p>
          </div>
        </div>
      )}

      {submitSuccessMessage && (
        <div className="fixed bottom-4 right-4 max-w-sm rounded-lg bg-green-100 text-green-800 px-4 py-2 shadow">
          {submitSuccessMessage}
        </div>
      )}
    </>
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


