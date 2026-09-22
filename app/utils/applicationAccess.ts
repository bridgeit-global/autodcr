import { permissionTitleToApplicantType } from "@/app/utils/applicantAppointmentPermissions";
import {
  isAppointedArchitect,
  isOwnerApplicantType,
  sameUserId,
} from "@/app/utils/projectAccess";

type ApplicantLike = {
  user_id?: string | null;
  userId?: string | null;
  applicantType?: string | null;
  applicant_type?: string | null;
};

type ProjectLike = {
  user_id?: string | null;
  architect_user_id?: string | null;
};

/** Roster types that can open/preview building-permission applications. */
function isBuildingPermissionAccessType(type: string): boolean {
  if (isOwnerApplicantType(type)) return true;
  const t = type.trim().toLowerCase();
  return t === "architect" || t === "licensed surveyor";
}

export function canUserAccessApplication(params: {
  authUserId: string | null | undefined;
  project: ProjectLike | null | undefined;
  applicants: ApplicantLike[];
  permissionType: string;
}): boolean {
  const { authUserId, project, applicants, permissionType } = params;
  if (!authUserId?.trim()) return false;

  if (project && sameUserId(project.user_id, authUserId)) {
    return true;
  }

  if (isAppointedArchitect(project, authUserId)) {
    return true;
  }

  for (const applicant of applicants) {
    const type = String(
      applicant.applicantType || applicant.applicant_type || ""
    ).trim();
    const applicantUserId = String(
      applicant.user_id || applicant.userId || ""
    ).trim();

    if (
      isBuildingPermissionAccessType(type) &&
      sameUserId(applicantUserId, authUserId)
    ) {
      return true;
    }
  }

  const targetConsultantType = permissionTitleToApplicantType(permissionType);
  if (!targetConsultantType) return false;

  for (const applicant of applicants) {
    const type = String(
      applicant.applicantType || applicant.applicant_type || ""
    ).trim();
    const applicantUserId = String(
      applicant.user_id || applicant.userId || ""
    ).trim();

    if (
      type.toLowerCase() === targetConsultantType.toLowerCase() &&
      sameUserId(applicantUserId, authUserId)
    ) {
      return true;
    }
  }

  return false;
}
