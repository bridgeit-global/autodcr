import type { TemplateType } from "@/app/templates/templateGenerators";

/** Token suffix segment used in `project_*_${suffix}` placeholders (matches HTML templates). */
export function templateTypeToPdfTokenSuffix(type?: TemplateType): string {
  switch (type) {
    case "Architect":
      return "Architect";
    case "Licensed Surveyor":
      return "LS";
    case "Structural Engineer":
      return "Structural_Engineer";
    case "Fire Safety Consultant":
      return "Fire_Safety";
    case "M&E Consultant":
      return "ME_Consultant";
    case "Plumber":
      return "Plumber";
    case "Parking Consultant":
      return "Parking_Consultant";
    case "Landscape Consultant":
      return "Landscape_Consultant";
    case "Geotechnical Consultant":
      return "Geotechnical_Consultant";
    case "Environmental Consultant":
      return "Environmental_Consultant";
    case "Town Planner":
      return "Town_Planner";
    case "PMC / Project Manager":
      return "PMC_Project_Manager";
    case "Rainwater Consultant":
      return "Rainwater_Consultant";
    case "Site Supervisor":
      return "Site_Supervisor";
    case "Horticulturist":
      return "Horticulturist";
    default:
      return "Architect";
  }
}

export function templateConsultantApplicantKeywords(templateType: TemplateType): string[] {
  switch (templateType) {
    case "Licensed Surveyor":
      return ["licensed surveyor"];
    case "Structural Engineer":
      return ["structural"];
    case "Fire Safety Consultant":
      return ["fire"];
    case "M&E Consultant":
      return ["mep"];
    case "Plumber":
      return ["plumb"];
    case "Parking Consultant":
      return ["parking"];
    case "Landscape Consultant":
      return ["landscape"];
    case "Geotechnical Consultant":
      return ["geotechnical"];
    case "Environmental Consultant":
      return ["environment"];
    case "Town Planner":
      return ["town planner", "townplanner"];
    case "PMC / Project Manager":
      return ["pmc", "project manager"];
    case "Rainwater Consultant":
      return ["rain", "rainwater"];
    case "Site Supervisor":
      return ["site supervisor"];
    case "Horticulturist":
      return ["horticultur"];
    case "Architect":
      return ["architect"];
    default:
      return ["architect", "licensed surveyor"];
  }
}

/**
 * Auth `user_metadata` key holding the consultant's uploaded license document URL.
 * Mirrors `CONSULTANT_CERTIFICATE_URL_BY_TYPE` in `app/api/consultants/partial/route.ts`,
 * keyed by template type instead of registration type.
 */
const LICENSE_URL_KEY_BY_TEMPLATE_TYPE: Partial<Record<TemplateType, string>> = {
  Architect: "coa_certificate_url",
  "Licensed Surveyor": "lbs_certificate_url",
  "Structural Engineer": "structural_license_url",
  "Fire Safety Consultant": "fire_noc_url",
  "M&E Consultant": "mep_experience_url",
  Plumber: "phe_accreditation_url",
  "Site Supervisor": "site_supervisor_license_url",
  "Landscape Consultant": "landscape_certificate_url",
  "Geotechnical Consultant": "lab_registration_url",
  "Environmental Consultant": "env_certificate_url",
  "Town Planner": "town_planner_certificate_url",
  "PMC / Project Manager": "pmc_certificate_url",
};

/** Generic license URL key, written alongside the type-specific one on every upload. */
const GENERIC_LICENSE_URL_KEY = "license_certificate_url";

/**
 * Ordered candidate metadata keys holding the consultant's license document URL.
 * Types without a registration counterpart (Parking, Rainwater, Horticulturist)
 * resolve to the generic key only.
 */
export function templateTypeLicenseUrlKeys(templateType: TemplateType): string[] {
  const typeKey = LICENSE_URL_KEY_BY_TEMPLATE_TYPE[templateType];
  return typeKey ? [typeKey, GENERIC_LICENSE_URL_KEY] : [GENERIC_LICENSE_URL_KEY];
}

export type ConsultantAppointmentFieldKeys = {
  company: string;
  addr1: string;
  addr2: string;
  addr3: string;
};

export function getConsultantAppointmentFieldKeys(suffix: string): ConsultantAppointmentFieldKeys {
  if (suffix === "Architect") {
    return {
      company: "project_Company_Name_Architect",
      addr1: "project_Address_line1_Architect",
      addr2: "project_Address_line2_Architect",
      addr3: "project_Address_line3Architect",
    };
  }
  return {
    company: `project_Company_Name_${suffix}`,
    addr1: `project_Address_line1_${suffix}`,
    addr2: `project_Address_line2_${suffix}`,
    addr3: `project_Address_line3_${suffix}`,
  };
}

export function findConsultantApplicantInList(
  rawApplicants: unknown,
  templateType: TemplateType
): Record<string, unknown> | undefined {
  if (!Array.isArray(rawApplicants)) return undefined;
  const keywords = templateConsultantApplicantKeywords(templateType);
  return rawApplicants.find((a) => {
    if (!a || typeof a !== "object") return false;
    const rec = a as Record<string, unknown>;
    const t = String(rec.applicantType ?? rec.applicant_type ?? "").toLowerCase();
    return keywords.some((keyword) => t.includes(keyword));
  }) as Record<string, unknown> | undefined;
}

export function findArchitectApplicantInList(
  rawApplicants: unknown
): Record<string, unknown> | undefined {
  if (!Array.isArray(rawApplicants)) return undefined;
  return rawApplicants.find((a) => {
    if (!a || typeof a !== "object") return false;
    const rec = a as Record<string, unknown>;
    const t = String(rec.applicantType ?? rec.applicant_type ?? "").toLowerCase();
    return t.includes("architect");
  }) as Record<string, unknown> | undefined;
}
