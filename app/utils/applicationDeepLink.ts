type ProjectInfoLike = {
  proposalNo?: string | null;
};

type SavePlotDetailsLike = {
  selectedSurveyNos?: string[] | null;
  plotEntries?: Array<{ ctsNumber?: string | null }> | null;
};

export type ApplicationNoProject = {
  project_info?: ProjectInfoLike | null;
  save_plot_details?: SavePlotDetailsLike | null;
};

export type ApplicationNoApplication = {
  id?: string | null;
  project_title?: string | null;
};

export function getAppBaseUrl(): string {
  const fromEnv = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (fromEnv) return fromEnv.replace(/\/$/, "");
  const vercel = process.env.VERCEL_URL?.trim();
  if (vercel) return `https://${vercel}`;
  return "http://localhost:3000";
}

/** Mirror userdashboard application number resolution. */
export function resolveApplicationNo(
  project: ApplicationNoProject | null | undefined,
  application: ApplicationNoApplication
): string {
  const proposalNo =
    project?.project_info &&
    typeof project.project_info === "object" &&
    "proposalNo" in project.project_info
      ? String((project.project_info as ProjectInfoLike).proposalNo || "").trim()
      : "";

  const plotDetails = project?.save_plot_details;
  const surveyNo =
    (Array.isArray(plotDetails?.selectedSurveyNos) &&
      plotDetails.selectedSurveyNos[0] &&
      String(plotDetails.selectedSurveyNos[0]).trim()) ||
    (Array.isArray(plotDetails?.plotEntries) &&
      plotDetails.plotEntries[0]?.ctsNumber &&
      String(plotDetails.plotEntries[0].ctsNumber).trim()) ||
    "";

  return (
    proposalNo ||
    surveyNo ||
    String(application.project_title || "").trim() ||
    String(application.id || "").trim() ||
    "-"
  );
}

export function buildApplicationDetailsPath(params: {
  projectId: string;
  applicationId: string;
  applicationNo: string;
  selectedApplication: string;
}): string {
  const query = new URLSearchParams({
    projectId: params.projectId,
    applicationId: params.applicationId,
    applicationNo: params.applicationNo,
    selectedApplication: params.selectedApplication,
    mode: "readonly",
  });
  return `/dashboard/application-details?${query.toString()}`;
}

export function buildApplicationDetailsUrl(
  baseUrl: string,
  params: {
    projectId: string;
    applicationId: string;
    applicationNo: string;
    selectedApplication: string;
  }
): string {
  const normalizedBase = baseUrl.replace(/\/$/, "");
  return `${normalizedBase}${buildApplicationDetailsPath(params)}`;
}

const DEFAULT_RETURN_PATH = "/userdashboard";

/** Only allow same-origin relative paths; reject open redirects. */
export function sanitizeReturnUrl(
  path: string | null | undefined,
  fallback = DEFAULT_RETURN_PATH
): string {
  if (!path || typeof path !== "string") return fallback;
  const trimmed = path.trim();
  if (!trimmed.startsWith("/") || trimmed.startsWith("//")) return fallback;
  if (trimmed.includes("://")) return fallback;
  return trimmed;
}
