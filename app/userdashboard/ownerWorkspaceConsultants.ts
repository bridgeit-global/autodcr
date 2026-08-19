import type { DashboardProject } from "@/app/hooks/useDashboardProjects";
import {
  applicantTypeToPermissionTitle,
  permissionTypeMatchesTitle,
} from "@/app/utils/applicantAppointmentPermissions";
import {
  classifyApplicantRole,
  flattenApplicantRosters,
  getProjectLabel,
  type AdministrationApplicantRow,
} from "@/app/userdashboard/administrationApplicants";
import {
  normalizeApplicationWorkflowStage,
  type ApplicationWorkflowStage,
} from "@/app/components/DraftApplicationsModal";
import { sameUserId } from "@/app/utils/projectAccess";
import { supabase } from "@/app/utils/supabase";
import { fetchApplicantDetailsMapForProjects } from "@/app/utils/resolveApplicantDetailsForProject";
import { applicationHref } from "@/app/userdashboard/applicationsList";
import type { OwnerWorkspaceApplication } from "@/app/userdashboard/ownerWorkspaceTasks";
import { fetchOwnerWorkspaceApplications } from "@/app/userdashboard/ownerWorkspaceTasks";

export type ConsultantCredentialStatus = {
  licence: string;
  hasLetterhead: boolean;
  hasDsc: boolean;
};

export type ConsultantProgressStats = {
  pending: number;
  completed: number;
  openRemarks: number;
};

export type AssignedConsultantCard = {
  id: string;
  projectId: string;
  projectLabel: string;
  consultantType: string;
  name: string;
  userId: string;
  initials: string;
  isActive: boolean;
  credentials: ConsultantCredentialStatus;
  stats: ConsultantProgressStats;
  detailsHref: string;
};

function consultantInitials(consultantType: string): string {
  const words = consultantType
    .replace(/^ar\.\s*/i, "")
    .split(/\s+/)
    .filter(Boolean);
  if (words.length >= 2) {
    return `${words[0][0] ?? ""}${words[1][0] ?? ""}`.toUpperCase();
  }
  return (words[0]?.slice(0, 2) ?? "CO").toUpperCase();
}

function isConsultantRow(row: AdministrationApplicantRow): boolean {
  const group = classifyApplicantRole(row.role);
  return group === "consultants" || group === "architects";
}

function getApplicationStage(raw?: string | null): ApplicationWorkflowStage {
  return normalizeApplicationWorkflowStage(raw);
}

function applicationsForConsultant(
  applications: OwnerWorkspaceApplication[],
  projectId: string,
  consultantType: string
): OwnerWorkspaceApplication[] {
  const permissionTitle = applicantTypeToPermissionTitle(consultantType);
  return applications.filter((app) => {
    if (String(app.projectId) !== String(projectId)) return false;
    if (permissionTitle) {
      return permissionTypeMatchesTitle(app.permissionType, permissionTitle);
    }
    const roleWord = consultantType.trim().toLowerCase();
    return app.permissionType.trim().toLowerCase().includes(roleWord);
  });
}

export function computeConsultantStats(
  applications: OwnerWorkspaceApplication[]
): ConsultantProgressStats {
  const stats: ConsultantProgressStats = {
    pending: 0,
    completed: 0,
    openRemarks: 0,
  };

  for (const app of applications) {
    const stage = getApplicationStage(app.workflowStage);
    if (stage === "draft" || stage === "in_process") stats.pending += 1;
    else if (stage === "approved_verified") stats.completed += 1;
    else if (stage === "rejected") stats.openRemarks += 1;
  }

  return stats;
}

function hasSignature(value?: string | null): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

export function computeConsultantCredentials(
  row: AdministrationApplicantRow,
  applications: OwnerWorkspaceApplication[]
): ConsultantCredentialStatus {
  const licence = row.registrationNo?.trim() || "—";
  const submitted = applications.some((app) => {
    const stage = getApplicationStage(app.workflowStage);
    return stage !== "draft";
  });
  const signed = applications.some(
    (app) =>
      hasSignature(app.architectSignedAt) || hasSignature(app.ownerSignedAt)
  );

  return {
    licence,
    hasLetterhead: submitted || Boolean(row.registrationNo?.trim()),
    hasDsc: signed,
  };
}

function ownerDetailsHref(projectId: string): string {
  return `/dashboard/applicant?projectId=${encodeURIComponent(projectId)}`;
}

function consultantDetailsHref(
  projectId: string,
  consultantType: string,
  matchedApps: OwnerWorkspaceApplication[]
): string {
  const latest = matchedApps[0];
  if (latest) return applicationHref(latest);

  const permissionTitle = applicantTypeToPermissionTitle(consultantType);
  if (permissionTitle) {
    const query = new URLSearchParams({
      projectId,
      selectedApplication: permissionTitle,
      mode: "readonly",
    });
    return `/dashboard/application-details?${query.toString()}`;
  }

  return `/userdashboard/applications?projectId=${encodeURIComponent(projectId)}`;
}

export function buildAssignedConsultantCards(params: {
  applicants: AdministrationApplicantRow[];
  applications: OwnerWorkspaceApplication[];
  detailsMode?: "owner" | "consultant";
}): AssignedConsultantCard[] {
  const consultantRows = params.applicants.filter(isConsultantRow);
  const detailsMode = params.detailsMode ?? "owner";

  return consultantRows.map((row) => {
    const matchedApps = applicationsForConsultant(
      params.applications,
      row.projectId,
      row.role
    );

    const detailsHref =
      detailsMode === "consultant"
        ? consultantDetailsHref(row.projectId, row.role, matchedApps)
        : ownerDetailsHref(row.projectId);

    return {
      id: row.id,
      projectId: row.projectId,
      projectLabel: row.projectLabel,
      consultantType: row.role,
      name: row.name,
      userId: row.userId,
      initials: consultantInitials(row.role),
      isActive: Boolean(row.userId?.trim()),
      credentials: computeConsultantCredentials(row, matchedApps),
      stats: computeConsultantStats(matchedApps),
      detailsHref,
    };
  });
}

export function filterNonDraftProjects(projects: DashboardProject[]): DashboardProject[] {
  return projects.filter(
    (project) => (project.status ?? "").trim().toLowerCase() !== "draft"
  );
}

export async function loadOwnerWorkspaceConsultants(params: {
  projects: DashboardProject[];
  userId: string;
  isConsultant: boolean;
}): Promise<AssignedConsultantCard[]> {
  const { projects, userId, isConsultant } = params;
  if (projects.length === 0) return [];

  const rosters = await fetchApplicantDetailsMapForProjects(
    supabase,
    projects.map((p) => p.id)
  );

  const applicants = flattenApplicantRosters({ projects, rosters });
  const applications = await fetchOwnerWorkspaceApplications({
    userId,
    isConsultant,
    projectIds: projects.map((p) => String(p.id)),
  });

  return buildAssignedConsultantCards({ applicants, applications, detailsMode: "owner" });
}

export async function loadConsultantWorkspaceCards(params: {
  projects: DashboardProject[];
  userId: string;
  consultantType?: string | null;
}): Promise<AssignedConsultantCard[]> {
  const { projects, userId, consultantType } = params;
  const activeProjects = filterNonDraftProjects(projects);
  if (activeProjects.length === 0) return [];

  const rosters = await fetchApplicantDetailsMapForProjects(
    supabase,
    activeProjects.map((p) => p.id)
  );

  const applicants = flattenApplicantRosters({ projects: activeProjects, rosters });
  const applications = await fetchOwnerWorkspaceApplications({
    userId,
    isConsultant: true,
    projectIds: activeProjects.map((p) => String(p.id)),
  });

  const allCards = buildAssignedConsultantCards({
    applicants,
    applications,
    detailsMode: "consultant",
  });

  return allCards.filter((card) => {
    if (!sameUserId(card.userId, userId)) return false;
    if (!consultantType?.trim()) return true;
    return card.consultantType.trim().toLowerCase() === consultantType.trim().toLowerCase();
  });
}

export function filterConsultantsByProject(
  cards: AssignedConsultantCard[],
  projectId: string
): AssignedConsultantCard[] {
  if (projectId === "ALL") return cards;
  return cards.filter((card) => card.projectId === projectId);
}

export function filterConsultantsByType(
  cards: AssignedConsultantCard[],
  consultantType: string
): AssignedConsultantCard[] {
  if (consultantType === "ALL") return cards;
  return cards.filter((card) => card.consultantType === consultantType);
}

export function getConsultantTypeOptions(
  cards: AssignedConsultantCard[]
): { value: string; label: string }[] {
  const types = [...new Set(cards.map((card) => card.consultantType).filter(Boolean))].sort(
    (a, b) => a.localeCompare(b)
  );
  return [
    { value: "ALL", label: "All consultants" },
    ...types.map((type) => ({ value: type, label: type })),
  ];
}

export { getProjectLabel };
