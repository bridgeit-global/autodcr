/** Project-level access: owner vs appointed architect delegate. */

import {
  formatCityPincode,
  resolveAddressLinesWithCityPincode,
} from "@/app/utils/applicantRecordFields";

export type ProjectAccessRow = {
  user_id?: string | null;
  architect_user_id?: string | null;
};

export type UserMetadataLike = {
  role?: string;
  consultant_type?: string;
} | null;

function pickText(...values: Array<unknown>): string {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

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

export type ApplicantLike = {
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
  city?: string;
  pincode?: string;
  coa_reg_no?: string;
  registration_date?: string;
  pan_no?: string;
  pan?: string;
  entity_type?: string;
};

/** Owner profile fields used when seeding the applicant roster from projects.user_id. */
export type OwnerApplicantMeta = SessionUserMeta & {
  entity_type?: string;
  proprietorship_registration_no?: string;
  proprietorship_registration_date?: string;
  cin?: string;
  roc_registration_date?: string;
  llpin?: string;
  llp_incorporation_date?: string;
  firm_registration_no?: string;
  partnership_registration_date?: string;
  trust_registration_no?: string;
  trust_registration_date?: string;
  govt_registration_no?: string;
  govt_registration_date?: string;
  letterhead_url?: string;
  letterheadUrl?: string;
};

export function applicantRosterHasOwner(
  applicants: ApplicantLike[] | null | undefined
): boolean {
  return Boolean(resolveOwnerUserIdFromApplicants(applicants));
}

function ownerRegistrationFromMeta(meta?: OwnerApplicantMeta | null): {
  registrationNo: string;
  licenseIssueDate: string;
} {
  const entityType = (meta?.entity_type || "").trim().toLowerCase();
  let registrationNo = "";
  let licenseIssueDate = "-";
  switch (entityType) {
    case "proprietorship / individual":
      registrationNo = meta?.proprietorship_registration_no?.trim() || "";
      licenseIssueDate = meta?.proprietorship_registration_date?.trim() || "-";
      break;
    case "pvt. ltd. / ltd. company":
      registrationNo = meta?.cin?.trim() || "";
      licenseIssueDate = meta?.roc_registration_date?.trim() || "-";
      break;
    case "llp":
      registrationNo = meta?.llpin?.trim() || "";
      licenseIssueDate = meta?.llp_incorporation_date?.trim() || "-";
      break;
    case "partnership firm":
      registrationNo = meta?.firm_registration_no?.trim() || "";
      licenseIssueDate = meta?.partnership_registration_date?.trim() || "-";
      break;
    case "trust / society":
      registrationNo = meta?.trust_registration_no?.trim() || "";
      licenseIssueDate = meta?.trust_registration_date?.trim() || "-";
      break;
    case "govt. / psu / local body":
      registrationNo = meta?.govt_registration_no?.trim() || "";
      licenseIssueDate = meta?.govt_registration_date?.trim() || "-";
      break;
    default:
      break;
  }
  return { registrationNo, licenseIssueDate };
}

/** Build one Owner row for applicant_details.applicants[] (matches DB backfill shape). */
export function buildOwnerApplicantRow(
  ownerUserId: string,
  meta?: OwnerApplicantMeta | null
): ApplicantLike & Record<string, unknown> {
  const name =
    [meta?.first_name, meta?.middle_name, meta?.last_name].filter(Boolean).join(" ").trim() ||
    "-";
  const { registrationNo, licenseIssueDate } = ownerRegistrationFromMeta(meta);
  const addressLine1 = meta?.address_line1?.trim() || "";
  const addressLine2 = meta?.address_line2?.trim() || "";
  const addressLine3 = meta?.address_line3?.trim() || "";
  const city = meta?.city?.trim() || "";
  const pincode = meta?.pincode?.trim() || "";
  const resolved = resolveAddressLinesWithCityPincode(
    addressLine1,
    addressLine2,
    addressLine3,
    city,
    pincode
  );
  const residentialFromLines = [resolved.line1, resolved.line2, resolved.line3]
    .filter(Boolean)
    .join(", ");
  const addressFallback = meta?.address?.trim() || "";
  const cityPincode = formatCityPincode(city, pincode);
  const residentialWithCity =
    addressFallback && cityPincode && !addressFallback.includes(cityPincode)
      ? `${addressFallback.replace(/[,.\s]+$/, "")}, ${cityPincode}`
      : addressFallback;
  const residentialAddress = residentialFromLines || residentialWithCity || "-";
  return {
    user_id: ownerUserId,
    applicantType: "Owner",
    name,
    contactNumber: meta?.alternate_phone?.trim() || meta?.mobile?.trim() || "-",
    email: meta?.email?.trim() || "-",
    registrationNo: registrationNo || "-",
    licenseIssueDate,
    panNo: meta?.pan_no?.trim() || meta?.pan?.trim() || "-",
    residentialAddress,
    officeAddress: meta?.address?.trim() || "-",
    address_line1: addressLine1 || undefined,
    address_line2: addressLine2 || undefined,
    address_line3: addressLine3 || undefined,
    city: city || undefined,
    pincode: pincode || undefined,
    entity_type: meta?.entity_type?.trim() || undefined,
    letterhead_url: meta?.letterhead_url?.trim() || meta?.letterheadUrl?.trim() || undefined,
    letterheadUrl: meta?.letterhead_url?.trim() || meta?.letterheadUrl?.trim() || undefined,
  };
}

/** Prepend the designated project owner when missing; backfill entity_type when absent. */
export function ensureOwnerInApplicantRoster(
  roster: { applicants?: unknown[] } | unknown[] | null | undefined,
  ownerUserId: string,
  meta?: OwnerApplicantMeta | null
): { applicants: unknown[] } {
  const applicants: ApplicantLike[] = Array.isArray(roster)
    ? (roster as ApplicantLike[])
    : Array.isArray(roster?.applicants)
      ? (roster.applicants as ApplicantLike[])
      : [];

  const ownerId = ownerUserId.trim();
  if (!ownerId) {
    return { applicants: [...applicants] };
  }

  const ownerIndex = applicants.findIndex((a) => {
    const uid = a.user_id || a.userId;
    if (!sameUserId(uid, ownerId)) return false;
    const t = (a.applicantType || a.applicant_type || "").toLowerCase();
    return t.includes("owner");
  });

  const entityTypeFromMeta = meta?.entity_type?.trim() || "";

  if (ownerIndex >= 0) {
    const existing = applicants[ownerIndex] as ApplicantLike & Record<string, unknown>;
    const existingType = pickText(existing.entity_type, existing.entityType);
    if (!existingType && entityTypeFromMeta) {
      const updated = applicants.map((row, idx) =>
        idx === ownerIndex ? { ...row, entity_type: entityTypeFromMeta } : row
      );
      return { applicants: updated };
    }
    return { applicants: [...applicants] };
  }

  if (applicantRosterHasOwner(applicants)) {
    return { applicants: [...applicants] };
  }

  return {
    applicants: [buildOwnerApplicantRow(ownerId, meta), ...applicants],
  };
}

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

  const addressLine1 = meta?.address_line1?.trim() || "";
  const addressLine2 = meta?.address_line2?.trim() || "";
  const addressLine3 = meta?.address_line3?.trim() || "";
  const city = meta?.city?.trim() || "";
  const pincode = meta?.pincode?.trim() || "";
  const resolved = resolveAddressLinesWithCityPincode(
    addressLine1,
    addressLine2,
    addressLine3,
    city,
    pincode
  );
  const residentialFromLines = [resolved.line1, resolved.line2, resolved.line3]
    .filter(Boolean)
    .join(", ");
  const addressFallback = meta?.address?.trim() || "";
  const cityPincode = formatCityPincode(city, pincode);
  const residentialWithCity =
    addressFallback && cityPincode && !addressFallback.includes(cityPincode)
      ? `${addressFallback.replace(/[,.\s]+$/, "")}, ${cityPincode}`
      : addressFallback;

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
        residentialAddress: residentialFromLines || residentialWithCity || "-",
        officeAddress: meta?.address || "-",
        address_line1: meta?.address_line1,
        address_line2: meta?.address_line2,
        address_line3: meta?.address_line3,
        city: city || undefined,
        pincode: pincode || undefined,
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
