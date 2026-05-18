/** Project/applicant shape used for signing permission checks. */
export type SigningProjectContext = {
  user_id?: string | null;
  architect_user_id?: string | null;
  applicant_details?: {
    applicants?: Array<{
      user_id?: string;
      userId?: string;
      id?: string;
      owner_id?: string;
      applicantType?: string;
      applicant_type?: string;
    }>;
  } | null;
} | null;

export type SigningApplicationRow = {
  owner_signed_at?: string | null;
  architect_signed_at?: string | null;
};

function normalizeId(id: string | null | undefined): string {
  return typeof id === "string" ? id.trim().toLowerCase() : "";
}

export function sameUserId(
  a: string | null | undefined,
  b: string | null | undefined
): boolean {
  const x = normalizeId(a);
  const y = normalizeId(b);
  return x.length > 0 && y.length > 0 && x === y;
}

/** Appointed architect: projects.architect_user_id or Architect applicant with user_id. */
export function resolveAppointedArchitectUserId(
  project: SigningProjectContext
): string | null {
  if (!project) return null;
  if (typeof project.architect_user_id === "string" && project.architect_user_id.trim()) {
    return project.architect_user_id.trim();
  }
  const applicants = project.applicant_details?.applicants ?? [];
  for (const a of applicants) {
    const type = (a.applicantType || a.applicant_type || "").toLowerCase();
    if (!type.includes("architect")) continue;
    const uid = a.user_id || a.userId;
    if (typeof uid === "string" && uid.trim()) return uid.trim();
  }
  return null;
}

export function collectOwnerSignerUserIds(
  project: SigningProjectContext,
  projectRowUserId?: string | null
): string[] {
  const raw: string[] = [];
  if (typeof projectRowUserId === "string" && projectRowUserId.trim()) {
    raw.push(projectRowUserId.trim());
  }
  if (typeof project?.user_id === "string" && project.user_id.trim()) {
    raw.push(project.user_id.trim());
  }
  const applicants = project?.applicant_details?.applicants ?? [];
  for (const a of applicants) {
    const type = (a.applicantType || a.applicant_type || "").toLowerCase();
    if (!type.includes("owner")) continue;
    for (const v of [a.user_id, a.userId, a.id, a.owner_id]) {
      if (typeof v === "string" && v.trim()) raw.push(v.trim());
    }
  }
  const seen = new Set<string>();
  return raw.filter((id) => {
    const k = id.toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

export function isAnySameUserId(uid: string, candidates: string[]): boolean {
  const u = normalizeId(uid);
  if (!u) return false;
  return candidates.some((c) => normalizeId(c) === u);
}

export type ArchitectSignStep = "owner" | "architect" | "complete" | "none";

export function getArchitectSignStep(
  application: SigningApplicationRow | null | undefined
): ArchitectSignStep {
  const ownerSigned = Boolean(application?.owner_signed_at?.trim());
  const architectSigned = Boolean(application?.architect_signed_at?.trim());
  if (ownerSigned && architectSigned) return "complete";
  if (!ownerSigned) return "owner";
  return "architect";
}

/** Whether user may save PDFs / update application_urls for this project. */
export function canUserSaveApplicationPdf(
  authUserId: string,
  project: SigningProjectContext,
  projectRowUserId?: string | null
): boolean {
  const uid = authUserId.trim();
  if (!uid) return false;
  const owners = collectOwnerSignerUserIds(project, projectRowUserId);
  if (isAnySameUserId(uid, owners)) return true;
  const architectId = resolveAppointedArchitectUserId(project);
  if (architectId && sameUserId(uid, architectId)) return true;
  const applicants = project?.applicant_details?.applicants ?? [];
  for (const a of applicants) {
    const applicantUid = a.user_id || a.userId;
    if (sameUserId(uid, applicantUid)) return true;
  }
  return false;
}
