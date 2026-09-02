/** Shared consultant registration helpers for partial create, lookup, and resume. */

import { getAppBaseUrl } from "@/app/utils/applicationDeepLink";

export const NEW_USER_SENTINEL = "__new_user__";

/** Metadata keys for invite completion link (hash stored, never raw token). */
export const COMPLETION_TOKEN_HASH_META_KEY = "completion_token_hash";
export const COMPLETION_TOKEN_EXPIRES_META_KEY = "completion_token_expires_at";
export const COMPLETION_TOKEN_TTL_DAYS = 14;

export function buildConsultantCompletionUrl(token: string): string {
  const base = getAppBaseUrl();
  const params = new URLSearchParams({ token });
  return `${base}/consultant/complete?${params.toString()}`;
}

/** Dev/testing: allow skipping identity doc upload + AI extraction (saves API tokens). */
export function canSkipConsultantIdentityDocExtraction(): boolean {
  if (process.env.NODE_ENV !== "production") return true;
  return (
    process.env.NEXT_PUBLIC_ALLOW_SKIP_CONSULTANT_IDENTITY_DOCS === "true"
  );
}

export function canSkipConsultantIdentityDocExtractionServer(): boolean {
  if (process.env.NODE_ENV !== "production") return true;
  return process.env.ALLOW_SKIP_CONSULTANT_IDENTITY_DOCS === "true";
}

export function getCompletionTokenExpiryIso(
  ttlDays = COMPLETION_TOKEN_TTL_DAYS
): string {
  const expires = new Date();
  expires.setDate(expires.getDate() + ttlDays);
  return expires.toISOString();
}

export function isCompletionTokenExpired(
  expiresAt: string | null | undefined
): boolean {
  if (!expiresAt) return true;
  const parsed = Date.parse(String(expiresAt));
  if (Number.isNaN(parsed)) return true;
  return parsed < Date.now();
}

export const CONSULTANT_TYPE_OPTIONS = [
  "Architect",
  "Structural Engineer",
  "Site Supervisor",
  "Licensed Surveyor",
  "MEP Consultant",
  "Plumber",
  "Fire Consultant",
  "Landscape Consultant",
  "PMC / Project Manager",
  "Geotechnical Consultant",
  "Environmental Consultant",
  "Town Planner",
] as const;

export type ConsultantType = (typeof CONSULTANT_TYPE_OPTIONS)[number];

/** Form field → auth metadata key for the primary registration / license number. */
export const REGISTRATION_NUMBER_META_BY_TYPE: Record<
  string,
  { formField: string; metaKey: string; label: string }
> = {
  Architect: { formField: "coaRegNo", metaKey: "coa_reg_no", label: "COA Registration No." },
  "Structural Engineer": {
    formField: "structuralLicenseNo",
    metaKey: "structural_license_no",
    label: "Structural Engineer License No.",
  },
  "Site Supervisor": {
    formField: "siteSupervisorLicenseNo",
    metaKey: "site_supervisor_license_no",
    label: "Site Supervisor License No.",
  },
  "Licensed Surveyor": {
    formField: "lbsLicenseNo",
    metaKey: "lbs_license_no",
    label: "LBS License Number",
  },
  "MEP Consultant": {
    formField: "electricalLicenseNo",
    metaKey: "electrical_license_no",
    label: "Electrical License No.",
  },
  Plumber: {
    formField: "plumberLicenseNo",
    metaKey: "plumber_license_no",
    label: "Plumber License No.",
  },
  "Fire Consultant": {
    formField: "fireLicenseNo",
    metaKey: "fire_license_no",
    label: "Fire License / CFO Accreditation No.",
  },
  "Landscape Consultant": {
    formField: "landscapeLicenseNo",
    metaKey: "landscape_license_no",
    label: "Landscape License No.",
  },
  "PMC / Project Manager": {
    formField: "pmcRegistrationNo",
    metaKey: "pmc_registration_no",
    label: "PMC Registration No.",
  },
  "Geotechnical Consultant": {
    formField: "nablAccreditationNo",
    metaKey: "nabl_accreditation_no",
    label: "NABL Accreditation No.",
  },
  "Environmental Consultant": {
    formField: "envLicenseNo",
    metaKey: "env_license_no",
    label: "Environmental License No.",
  },
  "Town Planner": {
    formField: "townPlannerLicenseNo",
    metaKey: "town_planner_license_no",
    label: "Town Planner License No.",
  },
};

/** Extra required registration fields (beyond primary reg no + registrationDate). */
export const EXTRA_REG_REQUIRED_BY_TYPE: Record<string, string[]> = {
  Architect: ["coaExpiryDate"],
  "Structural Engineer": ["structuralValidity"],
  "Site Supervisor": ["siteSupervisorGrade", "siteSupervisorValidity"],
  "Licensed Surveyor": ["competencyClass", "lbsExpiryDate"],
  "MEP Consultant": ["electricalExpiryDate"],
  Plumber: ["plumberExpiryDate"],
  "Fire Consultant": ["fireValidityDate"],
  "Landscape Consultant": ["landscapeExpiryDate"],
  "PMC / Project Manager": ["pmcExpiryDate"],
  "Geotechnical Consultant": ["nablExpiryDate"],
  "Environmental Consultant": ["envExpiryDate"],
  "Town Planner": ["townPlannerExpiryDate"],
};

export type RegistrationStatus = "incomplete" | "complete" | "not_found";

export function normalizePhone(value: string | null | undefined): string {
  const digits = String(value || "").replace(/\D/g, "");
  if (digits.length >= 10) return digits.slice(-10);
  return digits;
}

export function normalizeRegNo(value: string | null | undefined): string {
  return String(value || "").trim().toUpperCase().replace(/\s+/g, "");
}

export function getPhoneFromMetadata(meta: Record<string, unknown> | null | undefined): string {
  if (!meta) return "";
  return normalizePhone(
    String(meta.alternate_phone || meta.mobile || meta.phone || "")
  );
}

export function getRegistrationNumberFromMetadata(
  meta: Record<string, unknown> | null | undefined,
  consultantType?: string
): string {
  if (!meta) return "";
  const type = consultantType || String(meta.consultant_type || "");
  const mapping = REGISTRATION_NUMBER_META_BY_TYPE[type];
  if (mapping) {
    return normalizeRegNo(String(meta[mapping.metaKey] || ""));
  }
  for (const { metaKey } of Object.values(REGISTRATION_NUMBER_META_BY_TYPE)) {
    const v = normalizeRegNo(String(meta[metaKey] || ""));
    if (v) return v;
  }
  return "";
}

/**
 * Incomplete = explicitly incomplete, OR consultant role without a login username.
 * Complete = registration_status complete, OR has login user_id set (legacy full registrations).
 */
export function getRegistrationCompleteness(
  meta: Record<string, unknown> | null | undefined
): "incomplete" | "complete" {
  if (!meta) return "incomplete";
  const status = String(meta.registration_status || "").toLowerCase();
  if (status === "incomplete") return "incomplete";
  if (status === "complete") return "complete";
  const loginUserId = String(meta.user_id || "").trim();
  if (loginUserId) return "complete";
  return "incomplete";
}

export function composeAddressLines(
  line1: string,
  line2: string,
  line3: string
): string {
  return [line1, line2, line3].map((v) => v.trim()).filter(Boolean).join("\n");
}

export type PartialConsultantPayload = {
  consultantType: string;
  firstName: string;
  middleName?: string;
  lastName: string;
  entityName?: string;
  email: string;
  city: string;
  pincode: string;
  alternatePhone: string;
  pan: string;
  addressLine1: string;
  addressLine2?: string;
  addressLine3?: string;
  registrationDate: string;
  coaRegNo?: string;
  coaExpiryDate?: string;
  structuralLicenseNo?: string;
  structuralValidity?: string;
  qualification?: string;
  siteSupervisorLicenseNo?: string;
  siteSupervisorGrade?: string;
  siteSupervisorValidity?: string;
  lbsLicenseNo?: string;
  competencyClass?: string;
  lbsExpiryDate?: string;
  electricalLicenseNo?: string;
  electricalExpiryDate?: string;
  pwdAccreditation?: string;
  plumberLicenseNo?: string;
  plumberExpiryDate?: string;
  fireLicenseNo?: string;
  fireValidityDate?: string;
  landscapeLicenseNo?: string;
  landscapeExpiryDate?: string;
  pmcRegistrationNo?: string;
  pmcExpiryDate?: string;
  nablAccreditationNo?: string;
  nablExpiryDate?: string;
  geotechQualification?: string;
  envLicenseNo?: string;
  envExpiryDate?: string;
  townPlannerLicenseNo?: string;
  townPlannerExpiryDate?: string;
  letterheadUrl?: string;
};

export function buildPartialConsultantMetadata(
  data: PartialConsultantPayload
): Record<string, unknown> {
  const fullAddress = composeAddressLines(
    data.addressLine1 || "",
    data.addressLine2 || "",
    data.addressLine3 || ""
  );
  const base: Record<string, unknown> = {
    consultant_type: data.consultantType,
    first_name: data.firstName,
    middle_name: data.middleName || null,
    last_name: data.lastName,
    entity_name: data.entityName || null,
    role: "Consultant",
    email: data.email,
    city: data.city,
    pincode: data.pincode,
    address: fullAddress,
    address_line1: data.addressLine1 || null,
    address_line2: data.addressLine2 || null,
    address_line3: data.addressLine3 || null,
    alternate_phone: data.alternatePhone || null,
    pan: data.pan || null,
    registration_date: data.registrationDate,
    registration_status: "incomplete",
    status: "pending",
    ...(data.letterheadUrl ? { letterhead_url: data.letterheadUrl } : {}),
  };

  switch (data.consultantType) {
    case "Architect":
      base.coa_reg_no = data.coaRegNo;
      base.coa_expiry_date = data.coaExpiryDate;
      break;
    case "Structural Engineer":
      base.structural_license_no = data.structuralLicenseNo;
      base.structural_validity = data.structuralValidity;
      base.qualification = data.qualification || null;
      break;
    case "Site Supervisor":
      base.site_supervisor_license_no = data.siteSupervisorLicenseNo;
      base.site_supervisor_grade = data.siteSupervisorGrade;
      base.site_supervisor_validity = data.siteSupervisorValidity;
      break;
    case "Licensed Surveyor":
      base.lbs_license_no = data.lbsLicenseNo;
      base.competency_class = data.competencyClass;
      base.lbs_expiry_date = data.lbsExpiryDate;
      break;
    case "MEP Consultant":
      base.electrical_license_no = data.electricalLicenseNo;
      base.electrical_expiry_date = data.electricalExpiryDate;
      base.pwd_accreditation = data.pwdAccreditation || null;
      break;
    case "Plumber":
      base.plumber_license_no = data.plumberLicenseNo;
      base.plumber_expiry_date = data.plumberExpiryDate;
      break;
    case "Fire Consultant":
      base.fire_license_no = data.fireLicenseNo;
      base.fire_validity_date = data.fireValidityDate;
      break;
    case "Landscape Consultant":
      base.landscape_license_no = data.landscapeLicenseNo;
      base.landscape_expiry_date = data.landscapeExpiryDate;
      break;
    case "PMC / Project Manager":
      base.pmc_registration_no = data.pmcRegistrationNo;
      base.pmc_expiry_date = data.pmcExpiryDate;
      break;
    case "Geotechnical Consultant":
      base.nabl_accreditation_no = data.nablAccreditationNo;
      base.nabl_expiry_date = data.nablExpiryDate;
      base.geotech_qualification = data.geotechQualification || null;
      break;
    case "Environmental Consultant":
      base.env_license_no = data.envLicenseNo;
      base.env_expiry_date = data.envExpiryDate;
      break;
    case "Town Planner":
      base.town_planner_license_no = data.townPlannerLicenseNo;
      base.town_planner_expiry_date = data.townPlannerExpiryDate;
      break;
  }

  return base;
}

/** Map stored metadata back into form field keys for resume prefilling. */
export function metadataToFormFields(
  meta: Record<string, unknown>
): Record<string, string> {
  return {
    consultantType: String(meta.consultant_type || ""),
    firstName: String(meta.first_name || ""),
    middleName: String(meta.middle_name || ""),
    lastName: String(meta.last_name || ""),
    entityName: String(meta.entity_name || ""),
    email: String(meta.email || ""),
    city: String(meta.city || ""),
    pincode: String(meta.pincode || ""),
    alternatePhone: getPhoneFromMetadata(meta),
    pan: String(meta.pan || ""),
    addressLine1: String(meta.address_line1 || ""),
    addressLine2: String(meta.address_line2 || ""),
    addressLine3: String(meta.address_line3 || ""),
    registrationDate: String(meta.registration_date || ""),
    coaRegNo: String(meta.coa_reg_no || ""),
    coaExpiryDate: String(meta.coa_expiry_date || ""),
    structuralLicenseNo: String(meta.structural_license_no || ""),
    structuralValidity: String(meta.structural_validity || ""),
    qualification: String(meta.qualification || ""),
    siteSupervisorLicenseNo: String(meta.site_supervisor_license_no || ""),
    siteSupervisorGrade: String(meta.site_supervisor_grade || ""),
    siteSupervisorValidity: String(meta.site_supervisor_validity || ""),
    lbsLicenseNo: String(meta.lbs_license_no || ""),
    competencyClass: String(meta.competency_class || ""),
    lbsExpiryDate: String(meta.lbs_expiry_date || ""),
    electricalLicenseNo: String(meta.electrical_license_no || ""),
    electricalExpiryDate: String(meta.electrical_expiry_date || ""),
    pwdAccreditation: String(meta.pwd_accreditation || ""),
    plumberLicenseNo: String(meta.plumber_license_no || ""),
    plumberExpiryDate: String(meta.plumber_expiry_date || ""),
    fireLicenseNo: String(meta.fire_license_no || ""),
    fireValidityDate: String(meta.fire_validity_date || ""),
    landscapeLicenseNo: String(meta.landscape_license_no || ""),
    landscapeExpiryDate: String(meta.landscape_expiry_date || ""),
    pmcRegistrationNo: String(meta.pmc_registration_no || ""),
    pmcExpiryDate: String(meta.pmc_expiry_date || ""),
    nablAccreditationNo: String(meta.nabl_accreditation_no || ""),
    nablExpiryDate: String(meta.nabl_expiry_date || ""),
    geotechQualification: String(meta.geotech_qualification || ""),
    envLicenseNo: String(meta.env_license_no || ""),
    envExpiryDate: String(meta.env_expiry_date || ""),
    townPlannerLicenseNo: String(meta.town_planner_license_no || ""),
    townPlannerExpiryDate: String(meta.town_planner_expiry_date || ""),
  };
}

export function getPrimaryRegNoFromPayload(
  data: PartialConsultantPayload
): string {
  const mapping = REGISTRATION_NUMBER_META_BY_TYPE[data.consultantType];
  if (!mapping) return "";
  const value = (data as Record<string, string | undefined>)[mapping.formField];
  return normalizeRegNo(value);
}

/** Form fields locked when completing a partial (incomplete) registration. */
export const PARTIAL_PROFILE_LOCKED_FIELDS = new Set([
  "consultantType",
  "firstName",
  "middleName",
  "lastName",
  "email",
  "city",
  "pincode",
  "alternatePhone",
  "pan",
  "address",
  "addressLine1",
  "addressLine2",
  "addressLine3",
  "registrationDate",
  "coaRegNo",
  "coaExpiryDate",
  "structuralLicenseNo",
  "structuralValidity",
  "qualification",
  "siteSupervisorLicenseNo",
  "siteSupervisorGrade",
  "siteSupervisorValidity",
  "lbsLicenseNo",
  "competencyClass",
  "lbsExpiryDate",
  "electricalLicenseNo",
  "electricalExpiryDate",
  "pwdAccreditation",
  "plumberLicenseNo",
  "plumberExpiryDate",
  "fireLicenseNo",
  "fireValidityDate",
  "landscapeLicenseNo",
  "landscapeExpiryDate",
  "pmcRegistrationNo",
  "pmcExpiryDate",
  "nablAccreditationNo",
  "nablExpiryDate",
  "geotechQualification",
  "envLicenseNo",
  "envExpiryDate",
  "townPlannerLicenseNo",
  "townPlannerExpiryDate",
  "letterheadFile",
]);

export function isPartialProfileField(field: string): boolean {
  return PARTIAL_PROFILE_LOCKED_FIELDS.has(field);
}

const CONSULTANT_CERTIFICATE_URL_KEYS = [
  "license_certificate_url",
  "coa_certificate_url",
  "structural_license_url",
  "site_supervisor_license_url",
  "lbs_certificate_url",
  "mep_experience_url",
  "phe_accreditation_url",
  "fire_noc_url",
  "landscape_certificate_url",
  "pmc_certificate_url",
  "lab_registration_url",
  "env_certificate_url",
  "town_planner_certificate_url",
] as const;

/** True when partial registration already uploaded core identity documents. */
export function hasPartialIdentityDocuments(
  meta: Record<string, unknown> | null | undefined
): boolean {
  if (!meta) return false;
  const aadhaar = String(meta.aadhaar_card_url || "").trim();
  const pan = String(meta.pan_card_url || "").trim();
  if (!aadhaar || !pan) return false;
  return CONSULTANT_CERTIFICATE_URL_KEYS.some((key) =>
    Boolean(String(meta[key] || "").trim())
  );
}

/** True when partial registration includes all documents (identity + signatory). */
export function hasPartialRegistrationDocuments(
  meta: Record<string, unknown> | null | undefined
): boolean {
  if (!meta || !hasPartialIdentityDocuments(meta)) return false;
  return Boolean(
    String(meta.authorized_signatory_photo_url || "").trim() &&
      String(meta.authorized_signatory_signature_url || "").trim()
  );
}

export const INVITE_SECTION_IDENTITY = "section-identity-documents";
export const INVITE_SECTION_LOGIN = "section-login";
export const INVITE_SECTION_DECLARATION = "section-declaration";

export function getInviteCompletionSectionIds(
  meta?: Record<string, unknown> | null
): string[] {
  if (hasPartialRegistrationDocuments(meta)) {
    return [INVITE_SECTION_LOGIN, INVITE_SECTION_DECLARATION];
  }
  return [
    INVITE_SECTION_IDENTITY,
    INVITE_SECTION_LOGIN,
    INVITE_SECTION_DECLARATION,
  ];
}
