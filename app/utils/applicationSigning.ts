import type { TemplateType } from "@/app/templates/templateGenerators";
import { findConsultantApplicantInList } from "@/app/utils/consultantTemplateTokens";

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

/** Appointed consultant for a dual-letter application (Plumber, Town Planner, etc.). */
export function resolveAppointedConsultantUserId(
  project: SigningProjectContext,
  templateType: TemplateType
): string | null {
  if (!project || templateType === "Architect") return null;
  const applicants = project.applicant_details?.applicants ?? [];
  const match = findConsultantApplicantInList(applicants, templateType);
  if (!match) return null;
  const uid = match.user_id ?? match.userId;
  if (typeof uid === "string" && uid.trim()) return uid.trim();
  return null;
}

/** Second signer on dual-letter flows: architect for Architect, else appointed consultant. */
export function resolveAppointedSecondSignerUserId(
  project: SigningProjectContext,
  templateType: TemplateType
): string | null {
  if (templateType === "Architect") {
    return resolveAppointedArchitectUserId(project);
  }
  return resolveAppointedConsultantUserId(project, templateType);
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

export type DualLetterSignStep =
  | "owner"
  | "consultant"
  | "complete"
  | "none"
  | "partial_owner"
  | "partial_consultant";

/** @deprecated Use {@link getDualLetterSignStep} */
export type ArchitectSignStep = DualLetterSignStep | "architect";

/**
 * Signature status helper for dual-letter apps (not an ordering gate).
 * Owner and consultant may sign independently.
 */
export function getDualLetterSignStep(
  application: SigningApplicationRow | null | undefined
): DualLetterSignStep {
  const ownerSigned = Boolean(application?.owner_signed_at?.trim());
  const secondSigned = Boolean(application?.architect_signed_at?.trim());
  if (ownerSigned && secondSigned) return "complete";
  if (ownerSigned && !secondSigned) return "partial_owner";
  if (!ownerSigned && secondSigned) return "partial_consultant";
  if (!ownerSigned && !secondSigned) return "none";
  return "none";
}

/** @deprecated Use {@link getDualLetterSignStep} */
export function getArchitectSignStep(
  application: SigningApplicationRow | null | undefined
): ArchitectSignStep {
  const step = getDualLetterSignStep(application);
  if (step === "partial_owner") return "architect";
  if (step === "partial_consultant") return "owner";
  if (step === "none") return "owner";
  return step === "complete" ? "complete" : step;
}

/** Dual letters ready for manual Approved (both signatures present). */
export function dualLetterSignaturesComplete(
  application: SigningApplicationRow | null | undefined
): boolean {
  return (
    Boolean(application?.owner_signed_at?.trim()) &&
    Boolean(application?.architect_signed_at?.trim())
  );
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
