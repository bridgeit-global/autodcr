/** Project-level access: owner vs appointed architect delegate. */

export type ProjectAccessRow = {
  user_id?: string | null;
  architect_user_id?: string | null;
};

export type UserMetadataLike = {
  role?: string;
  consultant_type?: string;
} | null;

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

export function isOwnerApplicantType(type: string): boolean {
  return type.toLowerCase().includes("owner");
}

export function isProjectOwner(
  project: ProjectAccessRow | null | undefined,
  userId: string | null | undefined
): boolean {
  if (!project || !userId) return false;
  return sameUserId(project.user_id, userId);
}

export function isAppointedArchitect(
  project: ProjectAccessRow | null | undefined,
  userId: string | null | undefined
): boolean {
  if (!project || !userId) return false;
  return sameUserId(project.architect_user_id, userId);
}

export function canManageProject(
  project: ProjectAccessRow | null | undefined,
  userId: string | null | undefined
): boolean {
  return isProjectOwner(project, userId) || isAppointedArchitect(project, userId);
}

/** Only the account on projects.user_id may perform In Process owner signing. */
export function canPerformOwnerInProcessSign(
  project: ProjectAccessRow | null | undefined,
  userId: string | null | undefined
): boolean {
  return isProjectOwner(project, userId);
}

export function isArchitectConsultantRole(meta: UserMetadataLike): boolean {
  if (!meta) return false;
  if (meta.role !== "Consultant") return false;
  const t = (meta.consultant_type ?? "").trim().toLowerCase();
  return t === "architect" || t.includes("architect");
}

export function canCreateProjectAsArchitect(meta: UserMetadataLike): boolean {
  return isArchitectConsultantRole(meta);
}

type ApplicantLike = {
  user_id?: string;
  userId?: string;
  applicantType?: string;
  applicant_type?: string;
};

/** Resolve designated owner auth id from applicant roster (required for architect-created projects). */
export function resolveOwnerUserIdFromApplicants(
  applicants: ApplicantLike[] | null | undefined
): string | null {
  if (!applicants?.length) return null;
  for (const a of applicants) {
    const type = (a.applicantType || a.applicant_type || "").trim();
    if (!isOwnerApplicantType(type)) continue;
    const uid = a.user_id || a.userId;
    if (typeof uid === "string" && uid.trim()) return uid.trim();
  }
  return null;
}

export type OwnerValidationResult =
  | { ok: true; ownerUserId: string }
  | { ok: false; message: string };

export type SessionUserMeta = UserMetadataLike & {
  first_name?: string;
  middle_name?: string;
  last_name?: string;
  email?: string;
  mobile?: string;
  alternate_phone?: string;
  address?: string;
  address_line1?: string;
  address_line2?: string;
  address_line3?: string;
  coa_reg_no?: string;
  registration_date?: string;
  pan_no?: string;
  pan?: string;
};

function applicantRowHasArchitectUser(
  applicants: ApplicantLike[],
  architectUserId: string
): boolean {
  return applicants.some((a) => {
    const uid = a.user_id || a.userId;
    if (!sameUserId(uid, architectUserId)) return false;
    const t = (a.applicantType || a.applicant_type || "").toLowerCase();
    return t.includes("architect");
  });
}

/** Ensure the logged-in architect is on the roster before replace_applicants runs. */
export function ensureArchitectInApplicantRoster(
  roster: { applicants?: unknown[] } | unknown[] | null | undefined,
  architectUserId: string,
  meta?: SessionUserMeta | null
): { applicants: unknown[] } {
  const applicants: ApplicantLike[] = Array.isArray(roster)
    ? (roster as ApplicantLike[])
    : Array.isArray(roster?.applicants)
      ? (roster.applicants as ApplicantLike[])
      : [];

  if (!architectUserId.trim() || applicantRowHasArchitectUser(applicants, architectUserId)) {
    return { applicants: [...applicants] };
  }

  const consultantType = (meta?.consultant_type || "Architect").trim() || "Architect";
  const name =
    [meta?.first_name, meta?.middle_name, meta?.last_name].filter(Boolean).join(" ").trim() ||
    "-";

  return {
    applicants: [
      ...applicants,
      {
        user_id: architectUserId,
        applicantType: consultantType,
        name,
        contactNumber: meta?.alternate_phone || meta?.mobile || "-",
        email: meta?.email || "-",
        registrationNo: meta?.coa_reg_no || "",
        licenseIssueDate: meta?.registration_date || "-",
        panNo: meta?.pan_no || meta?.pan || "-",
        residentialAddress: meta?.address || "-",
        officeAddress: meta?.address || "-",
        address_line1: meta?.address_line1,
        address_line2: meta?.address_line2,
        address_line3: meta?.address_line3,
      },
    ],
  };
}

export function validateOwnerForArchitectProject(
  applicants: ApplicantLike[] | null | undefined,
  architectUserId: string | null | undefined
): OwnerValidationResult {
  const ownerUserId = resolveOwnerUserIdFromApplicants(applicants);
  if (!ownerUserId) {
    return {
      ok: false,
      message:
        "Add a project Owner from the directory before submitting. The owner will sign applications in In Process.",
    };
  }
  if (architectUserId && sameUserId(ownerUserId, architectUserId)) {
    return {
      ok: false,
      message: "The project Owner must be a different account than the architect.",
    };
  }
  return { ok: true, ownerUserId };
}

export function readSessionUserMetaFromStorage(): SessionUserMeta {
  if (typeof window === "undefined") {
    return { role: "", consultant_type: "" };
  }
  try {
    const stored = localStorage.getItem("userMetadata");
    if (stored) {
      return JSON.parse(stored) as SessionUserMeta;
    }
  } catch {
    /* ignore */
  }
  return {
    role: "",
    consultant_type: localStorage.getItem("consultantType") ?? "",
  };
}
