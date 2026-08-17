import type { DashboardProject } from "@/app/hooks/useDashboardProjects";
import type { ApplicantDetailsJson } from "@/app/utils/resolveApplicantDetailsForProject";
import { isOwnerApplicantType } from "@/app/utils/projectAccess";
import { getProjectBaseTitle } from "@/app/utils/projectTitleProposal";

export type AdministrationRoleTab = "all" | "owners" | "architects" | "consultants";

export type AdministrationApplicantRow = {
  id: string;
  projectId: string;
  projectLabel: string;
  name: string;
  role: string;
  email: string;
  phone: string;
  registrationNo: string;
  panNo: string;
  userId: string;
};

function pickText(...values: Array<unknown>): string {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

export function getProjectLabel(project: {
  title: string;
  project_info?: { proposalNo?: string; title?: string } | null;
}): string {
  const proposalNo = project.project_info?.proposalNo?.trim() || "";
  const cleanTitle = getProjectBaseTitle(
    project.title,
    proposalNo,
    project.project_info?.title
  );
  return proposalNo ? `${cleanTitle} (${proposalNo})` : cleanTitle;
}

export function classifyApplicantRole(
  type: string
): Exclude<AdministrationRoleTab, "all"> {
  if (isOwnerApplicantType(type)) return "owners";
  const normalized = type.trim().toLowerCase();
  if (normalized.includes("architect")) return "architects";
  return "consultants";
}

function collectApplicantRecords(roster: ApplicantDetailsJson | undefined): Record<string, unknown>[] {
  if (!roster) return [];
  const raw = roster.applicants;
  if (!Array.isArray(raw)) return [];

  const people: Record<string, unknown>[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    if (Array.isArray(item)) continue;
    const rec = item as Record<string, unknown>;
    if (Array.isArray(rec.applicants)) {
      for (const nested of rec.applicants) {
        if (nested && typeof nested === "object" && !Array.isArray(nested)) {
          people.push(nested as Record<string, unknown>);
        }
      }
      continue;
    }
    people.push(rec);
  }
  return people;
}

export function flattenApplicantRosters(params: {
  projects: DashboardProject[];
  rosters: Record<string, ApplicantDetailsJson>;
}): AdministrationApplicantRow[] {
  const rows: AdministrationApplicantRow[] = [];

  const rosterById = new Map<string, ApplicantDetailsJson>();
  for (const [id, roster] of Object.entries(params.rosters)) {
    rosterById.set(id, roster);
    rosterById.set(id.trim().toLowerCase(), roster);
  }

  for (const project of params.projects) {
    const roster =
      rosterById.get(project.id) ??
      rosterById.get(String(project.id).trim().toLowerCase());
    const applicants = collectApplicantRecords(roster);
    const projectLabel = getProjectLabel(project);

    applicants.forEach((rec, index) => {
      const role = pickText(rec.applicantType, rec.applicant_type) || "Applicant";
      const userId = pickText(rec.user_id, rec.userId);
      const name = pickText(rec.name) || "—";
      const email = pickText(rec.email, rec.emailAddress, rec.email_address);
      const phone = pickText(rec.contactNumber, rec.contact_number, rec.mobile);
      const registrationNo = pickText(
        rec.registrationNumber,
        rec.registrationNo,
        rec.registration_number
      );
      const panNo = pickText(rec.panNo, rec.pan_no, rec.pan);

      rows.push({
        id: `${project.id}:${userId || index}:${role}`,
        projectId: project.id,
        projectLabel,
        name,
        role,
        email,
        phone,
        registrationNo,
        panNo,
        userId,
      });
    });
  }

  return rows.sort((a, b) => {
    const byName = a.name.localeCompare(b.name);
    if (byName !== 0) return byName;
    return a.projectLabel.localeCompare(b.projectLabel);
  });
}

export function filterApplicantsByRole(
  rows: AdministrationApplicantRow[],
  tab: AdministrationRoleTab
): AdministrationApplicantRow[] {
  if (tab === "all") return rows;
  return rows.filter((row) => classifyApplicantRole(row.role) === tab);
}

export function countApplicantsByRole(rows: AdministrationApplicantRow[]): {
  all: number;
  owners: number;
  architects: number;
  consultants: number;
} {
  const counts = { all: rows.length, owners: 0, architects: 0, consultants: 0 };
  for (const row of rows) {
    counts[classifyApplicantRole(row.role)] += 1;
  }
  return counts;
}
