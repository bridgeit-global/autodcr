"use client";

import { formatCoaExpiryDisplay } from "@/app/utils/coaMetadataDisplay";
import { supabase } from "@/app/utils/supabase";
import { type TemplateFields, type TemplateType } from "./templateGenerators";

type ApplicationPreviewSource = {
  projectId?: string | null;
  selectedApplication?: string | null;
  applicationNo?: string | null;
  applicationCreatedAt?: string | null;
  /** COA registration no. from `auth.users` → `raw_user_meta_data` / session `user_metadata.coa_reg_no`. */
  coaRegNo?: string | null;
  /** COA expiry as stored (e.g. ISO `YYYY-MM-DD` in `coa_expiry_date`). */
  coaExpiryDate?: string | null;
  /** LBS license no. from `user_metadata.lbs_license_no` — used for Licensed Surveyor appointment preview Reg. No. */
  lbsLicenseNo?: string | null;
  /** LBS expiry (e.g. ISO) from `user_metadata.lbs_expiry_date` — used for Licensed Surveyor “Valid upto”. */
  lbsExpiryDate?: string | null;
  consultantName?: string | null;
  consultantCompanyName?: string | null;
  clientCompanyName?: string | null;
  clientName?: string | null;
  clientCompanyDesignation?: string | null;
  ownerDebug?: unknown;
  consultantAddressLine1?: string | null;
  consultantAddressLine2?: string | null;
  consultantAddressLine3?: string | null;
  consultantMobile?: string | null;
  consultantEmail?: string | null;
  /** Applicant directory ids (`user_id` on the row) for COA lookup when JWT is not the consultant. */
  consultantLookupUserIds?: string[];
  projectData?: {
    title?: string;
    project_info?: {
      proposalNo?: string;
      fullNameOfApplicant?: string;
      propertyAddress?: string;
    } | null;
    save_plot_details?: {
      planningAuthority?: string;
      region?: string;
      ward?: string;
      zone?: string;
      /** Matches Project Details → "This plot belongs to" (CS vs CTS vs F.P.). */
      plotBelongsTo?: "" | "CTS No." | "CS No." | "F.P.No";
      /** Survey numbers (CS or CTS) from project / area form — same as "CTS No." selection. */
      proposedCtsNumber?: string[] | string;
      villageName?: string;
      roadName?: string;
    } | null;
    applicant_details?: {
      applicants?: Array<{
        user_id?: string;
        applicantType?: string;
        applicant_type?: string;
        name?: string;
        entity_name?: string;
        entityName?: string;
        address_line1?: string;
        address_line2?: string;
        address_line3?: string;
        registrationNumber?: string;
        registrationNo?: string;
        residentialAddress?: string;
      }>;
    } | null;
  } | null;
};

type BuildingProposalAddressBlock = {
  officerName: string;
  line1: string;
  line2: string;
  line3: string;
};

const BP_CITY: BuildingProposalAddressBlock = {
  officerName: "SHRI. VIJAY TAWDE",
  line1:
    "Dy. Chief Engineer (Building Proposal) - City, New Municipal Building, C.S. No. 355 / B,",
  line2: "Bhagwan Walmiki Chowk, Vidyalankar Marg, Opp. Hanuman Mandir, Antop Hill,",
  line3: "Wadala (East), Mumbai - 400 037",
};

const BP_WESTERN_I: BuildingProposalAddressBlock = {
  officerName: "SHRI. BAJIRAO PATIL",
  line1: "",
  line2: "Hinduhrudaysamrat Balasaheb Thackeray Market, 6th to 9th Floor, New Majas Market,",
  line3: "Poonam Nagar, Opp. J. V. Link Road, Jogeshwari (East), Mumbai - 400 093",
};

const BP_WESTERN_II: BuildingProposalAddressBlock = {
  officerName: "SHRI. CHANDRAKANT CHAUDHARI",
  line1:
    "Dy. Chief Engineer, Building Proposals (W. S. - II) 1st Floor, C Wing, Municipal Building, Near Sanskruti Complex, 90 Feet D. P. Road,",
  line2: "Kandivali (East), Mumbai- 400 101",
  line3: "",
};

const BP_EASTERN: BuildingProposalAddressBlock = {
  officerName: "SHRI. MEHUL PAINTER",
  line1: "",
  line2: "Near Raj Legacy (Residential Complex), Paper Mill Compound,",
  line3: "L. B. S. Marg, Vikhroli (West), Mumbai - 400 083",
};

const BP_SPECIAL_CELL: BuildingProposalAddressBlock = {
  officerName: "SHRI. RAJENDRA JADHAV",
  line1: "Dy. Chief Engineer (Building Proposal), Special Cell, Ground Floor, Municipal Training Center,",
  line2: "Raheja Vihar Complex, Chandivali Farm Road, Powai, Andheri (East), Mumbai - 400 072",
  line3: "",
};

function normalizeWardPrefix(ward?: string): string {
  const s = (ward || "").trim().toUpperCase();
  if (!s) return "";
  return s.charAt(0);
}

function resolveBuildingProposalAddress(
  region?: string,
  ward?: string
): BuildingProposalAddressBlock | undefined {
  const normalizedRegion = (region || "").trim().toLowerCase();
  if (normalizedRegion === "city") return BP_CITY;
  if (normalizedRegion === "eastern") return BP_EASTERN;
  if (normalizedRegion.includes("special")) return BP_SPECIAL_CELL;
  if (normalizedRegion === "western") {
    const wardPrefix = normalizeWardPrefix(ward);
    // Western split: outer wards (R/T) use WS-II, others default to WS-I.
    if (wardPrefix === "R" || wardPrefix === "T") return BP_WESTERN_II;
    return BP_WESTERN_I;
  }
  return undefined;
}

export function mapSelectedApplicationToTemplate(
  selectedApplication?: string | null
): TemplateType {
  const value = (selectedApplication || "").toLowerCase();
  if (value.includes("fire")) return "Fire Safety Consultant";
  if (
    value.includes("mep") ||
    value.includes("m&e") ||
    value.includes("mechanical") ||
    value.includes("electrical")
  )
    return "M&E Consultant";
  if (value.includes("structural")) return "Structural Engineer";
  if (value.includes("parking")) return "Parking Consultant";
  if (value.includes("rain")) return "Rainwater Consultant";
  if (value.includes("site supervisor")) return "Site Supervisor";
  if (value.includes("horticulturist")) return "Horticulturist";
  if (value.includes("landscape")) return "Landscape Consultant";
  if (value.includes("geotechnical")) return "Geotechnical Consultant";
  if (value.includes("environment")) return "Environmental Consultant";
  if (value.includes("town planner") || value.includes("townplanner")) return "Town Planner";
  if (value.includes("pmc") || value.includes("project manager")) return "PMC / Project Manager";
  if (value.includes("plumber")) return "Plumber";
  if (value.includes("site supervisor")) return "Site Supervisor";
  if (value.includes("horticulturist")) return "Horticulturist";
  if (value.includes("licensed surveyor")) return "Licensed Surveyor";
  return "Architect";
}

function templateConsultantApplicantKeywords(templateType: TemplateType): string[] {
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
    default:
      return ["architect", "licensed surveyor"];
  }
}

export function pickConsultantLookupUserIdsFromProject(
  templateType: TemplateType,
  projectData: ApplicationPreviewSource["projectData"]
): string[] {
  const applicants = projectData?.applicant_details?.applicants || [];
  const keywords = templateConsultantApplicantKeywords(templateType);
  const row = applicants.find((a) => {
    const t = (a.applicantType || a.applicant_type || "").toLowerCase();
    return keywords.some((k) => t.includes(k));
  });
  const uid =
    row && typeof row.user_id === "string" ? row.user_id.trim() : "";
  return uid ? [uid] : [];
}

function getCurrentDate(): string {
  const date = new Date();
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

function formatApplicationDate(value?: string | null): string {
  if (!value) return getCurrentDate();
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return getCurrentDate();
  const day = String(parsed.getDate()).padStart(2, "0");
  const month = String(parsed.getMonth() + 1).padStart(2, "0");
  const year = parsed.getFullYear();
  return `${day}/${month}/${year}`;
}

function joinProposedCsOrCtsNos(source?: ApplicationPreviewSource): string {
  const raw = source?.projectData?.save_plot_details?.proposedCtsNumber;
  if (typeof raw === "string" && raw.trim()) return raw.trim();
  if (Array.isArray(raw)) return raw.filter(Boolean).join(", ");
  return "";
}

/** Label before bracketed survey numbers — includes “No.” like Project Details (`plotBelongsTo`). */
function surveyNumbersKindLabel(plotBelongs?: string): string | undefined {
  switch (plotBelongs) {
    case "CTS No.":
      return "CTS No.";
    case "CS No.":
      return "CS No.";
    case "F.P.No":
      return "F.P. No";
    default:
      return undefined;
  }
}

/** Renders `(338, 340)` from stored numbers (comma-separated list inside parentheses). */
function bracketSurveyNumberList(joinedList: string): string {
  const trimmed = joinedList.trim();
  if (!trimmed) return "";
  if (/^\(.*\)$/.test(trimmed)) return trimmed;
  return `(${trimmed})`;
}

/**
 * DOCX placeholders like `project_CS/CTSNos`: kind label outside brackets, values inside —
 * e.g. `CTS No. (338, 340)` or `CS No. (338, 340)`. If plot type is unknown, brackets only.
 */
function formatCsCtsSurveyToken(source?: ApplicationPreviewSource): string {
  const joined = joinProposedCsOrCtsNos(source).trim();
  if (!joined) return "";
  const bracketed = bracketSurveyNumberList(joined);
  const kind = surveyNumbersKindLabel(source?.projectData?.save_plot_details?.plotBelongsTo);
  return kind ? `${kind} ${bracketed}` : bracketed;
}

export function mapApplicationPreviewFields(
  source: ApplicationPreviewSource,
  templateType?: TemplateType
): TemplateFields {
  const projectInfo = source.projectData?.project_info || {};
  const savePlot = source.projectData?.save_plot_details || {};
  const joined = joinProposedCsOrCtsNos(source).trim();
  const ctsNo = joined ? bracketSurveyNumberList(joined) : source.applicationNo || "-";
  const isLicensedSurveyorLetter = templateType === "Licensed Surveyor";

  return {
    CurrentDate: formatApplicationDate(source.applicationCreatedAt),
    WardName: savePlot.ward || "-",
    ZoneName: savePlot.zone || "-",
    OfficeAddress: projectInfo.propertyAddress || "-",
    CTSNo: ctsNo || source.applicationNo || "-",
    VillageName: savePlot.villageName || "-",
    TalukaName: "-",
    DistrictName: "Mumbai",
    RoadWidth: "-",
    RoadName: savePlot.roadName || "-",
    MainRoadWidth: "-",
    MainRoadName: savePlot.roadName || "-",
    ApplicantName: projectInfo.fullNameOfApplicant || source.projectData?.title || "-",
    FirmName: source.projectData?.title || "-",
    ConsultantName: "-",
    ConsultantType: source.selectedApplication || "-",
    CouncilRegNo: isLicensedSurveyorLetter
      ? source.lbsLicenseNo?.trim() || "-"
      : source.coaRegNo?.trim() || "-",
    RegValidityDate: isLicensedSurveyorLetter
      ? formatCoaExpiryDisplay(source.lbsExpiryDate) || "-"
      : formatCoaExpiryDisplay(source.coaExpiryDate) || "-",
    // TODO: Map final backend fields once mapping contract is finalized:
    // - project_Proposal_Number
    // - consultant registration and validity
    // - office/taluka/district authoritative values
  };
}

export function mapToPdfFieldValues(
  fields: TemplateFields,
  source?: ApplicationPreviewSource,
  templateType?: TemplateType
): Record<string, string | undefined> {
  const templateTokenSuffix = (type?: TemplateType): string => {
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
  };

  const pickText = (...values: Array<unknown>): string => {
    for (const value of values) {
      if (typeof value === "string" && value.trim()) return value.trim();
    }
    return "";
  };
  const sanitizeAddressLine = (value: string): string =>
    value.replace(/[,\s]+$/g, "").trim();

  const applicants = source?.projectData?.applicant_details?.applicants || [];
  const ownerApplicant = applicants.find(
    (applicant) => (applicant.applicantType || applicant.applicant_type || "").toLowerCase().includes("owner")
  );
  const isLicensedSurveyorLetter = templateType === "Licensed Surveyor";
  const consultantKeywords = templateType
    ? templateConsultantApplicantKeywords(templateType)
    : templateConsultantApplicantKeywords("Architect");
  const primaryConsultantApplicant = applicants.find((applicant) => {
    const type = (applicant.applicantType || applicant.applicant_type || "").toLowerCase();
    return consultantKeywords.some((keyword) => type.includes(keyword));
  });
  const architectApplicant = applicants.find((applicant) =>
    (applicant.applicantType || applicant.applicant_type || "").toLowerCase().includes("architect")
  );
  const consultantRoleLabel =
    templateType === "Licensed Surveyor"
      ? "Licensed Surveyor"
      : templateType || "Architect";
  const consultantName =
    primaryConsultantApplicant?.name?.trim() || source?.consultantName?.trim() || "";
  // Address resolution priority (per consultant):
  //   1. The applicant row in projects.applicant_details (per-project source of truth).
  //   2. source.consultantAddressLine* (the consultant's auth.users.user_metadata).
  //   3. "" (empty) — we never split combined `address` / `residentialAddress` strings.
  // This lets the project owner override a consultant's address per-project
  // by editing the applicant row, while still falling back to the consultant's
  // own profile when no override is present.
  const consultantAddressLine1 = sanitizeAddressLine(
    pickText(
    primaryConsultantApplicant?.address_line1,
    (primaryConsultantApplicant as any)?.addressLine1,
    source?.consultantAddressLine1
    )
  );
  const consultantAddressLine2 = sanitizeAddressLine(
    pickText(
    primaryConsultantApplicant?.address_line2,
    (primaryConsultantApplicant as any)?.addressLine2,
    source?.consultantAddressLine2
    )
  );
  const consultantAddressLine3 = sanitizeAddressLine(
    pickText(
    primaryConsultantApplicant?.address_line3,
    (primaryConsultantApplicant as any)?.addressLine3,
    source?.consultantAddressLine3
    )
  );
  const architectName =
    architectApplicant?.name?.trim() || (templateType === "Architect" ? consultantName : "");
  // For the architect block (used by every template either as primary or CC),
  // the architect's applicant row in `applicant_details` wins. When the
  // architect is also the logged-in consultant (Architect template), the
  // applicant row will typically be the *same* row picked as the primary, so
  // they resolve identically. We fall back to consultantAddressLine* only when
  // the applicant row has no address_line1/2/3 set.
  const isArchitectAlsoLoggedInConsultant =
    Boolean(architectApplicant) &&
    architectApplicant === primaryConsultantApplicant;
  const architectFallbackLine1 = isArchitectAlsoLoggedInConsultant
    ? consultantAddressLine1
    : "";
  const architectFallbackLine2 = isArchitectAlsoLoggedInConsultant
    ? consultantAddressLine2
    : "";
  const architectFallbackLine3 = isArchitectAlsoLoggedInConsultant
    ? consultantAddressLine3
    : "";
  const architectAddressLine1 = sanitizeAddressLine(
    pickText(
    architectApplicant?.address_line1,
    (architectApplicant as any)?.addressLine1,
    architectFallbackLine1
    )
  );
  const architectAddressLine2 = sanitizeAddressLine(
    pickText(
    architectApplicant?.address_line2,
    (architectApplicant as any)?.addressLine2,
    architectFallbackLine2
    )
  );
  const architectAddressLine3 = sanitizeAddressLine(
    pickText(
    architectApplicant?.address_line3,
    (architectApplicant as any)?.addressLine3,
    architectFallbackLine3
    )
  );
  const proposalNumber = source?.projectData?.project_info?.proposalNo?.trim();
  const planningAuthority =
    source?.projectData?.save_plot_details?.planningAuthority?.trim() || "BMC";
  const street = source?.projectData?.save_plot_details?.roadName?.trim();
  const divisionVillage = source?.projectData?.save_plot_details?.villageName?.trim();
  const wardForProjectToken = source?.projectData?.save_plot_details?.ward?.trim();
  const regionForProjectToken = source?.projectData?.save_plot_details?.region?.trim();
  const rawSurveyList = joinProposedCsOrCtsNos(source).trim();
  const plotBelongs = source?.projectData?.save_plot_details?.plotBelongsTo;
  const surveyLabelForSubject =
    plotBelongs === "CS No."
      ? "C.S. No(s)."
      : plotBelongs === "F.P.No"
        ? "F.P. No(s)."
        : "C.T.S. No(s).";
  const csCtsNosSubjectDisplay = rawSurveyList
    ? `${surveyLabelForSubject} ${rawSurveyList}`
    : "";
  const consultantApplicantRegNo =
    primaryConsultantApplicant?.registrationNumber?.trim() ||
    primaryConsultantApplicant?.registrationNo?.trim() ||
    "";
  const consultantMobile = pickText(
    source?.consultantMobile,
    (primaryConsultantApplicant as any)?.alternate_phone,
    (primaryConsultantApplicant as any)?.alternatePhone,
    (primaryConsultantApplicant as any)?.mobile,
    (primaryConsultantApplicant as any)?.phone
  );
  const consultantEmail = pickText(
    source?.consultantEmail,
    (primaryConsultantApplicant as any)?.email,
    (primaryConsultantApplicant as any)?.Email
  );
  const consultantCompanyName = pickText(
    primaryConsultantApplicant?.entity_name,
    primaryConsultantApplicant?.entityName,
    source?.consultantCompanyName
  );
  const consultantRegNo = isLicensedSurveyorLetter
    ? (source?.lbsLicenseNo?.trim() ?? "")
    : consultantApplicantRegNo || (source?.coaRegNo?.trim() ?? "");
  const consultantValidityDisplay = isLicensedSurveyorLetter
    ? (formatCoaExpiryDisplay(source?.lbsExpiryDate) ?? "")
    : (formatCoaExpiryDisplay(source?.coaExpiryDate) ?? "");
  const clientName =
    source?.clientName?.trim() ||
    fields.ApplicantName?.trim() ||
    source?.projectData?.title?.trim() ||
    "-";
  const clientCompanyName =
    ownerApplicant?.entity_name?.trim() ||
    ownerApplicant?.entityName?.trim() ||
    source?.clientCompanyName?.trim() ||
    "";
  const clientCompanyDesignation = source?.clientCompanyDesignation?.trim() || "";
  const normalizedClientEntityType = clientCompanyDesignation.toLowerCase();
  const displayClientCompanyDesignation =
    normalizedClientEntityType === "proprietorship / individual"
      ? "Director"
      : normalizedClientEntityType === "llp"
        ? "Designated Partner"
        : normalizedClientEntityType === "trust / society"
          ? "Trustee"
          : normalizedClientEntityType === "partnership firm"
            ? "Partner"
            : clientCompanyDesignation;
  const buildingProposalAddress = resolveBuildingProposalAddress(
    regionForProjectToken,
    wardForProjectToken
  );
  const officerDesignationDisplay =
    "O/o The Dy. Ch. Eng. (B.P.)";
  const officerZoneSuffix =
    (regionForProjectToken || "").trim().toLowerCase() === "eastern"
      ? "(E. S.),"
      : (regionForProjectToken || "").trim().toLowerCase() === "western"
        ? "(W. S.),"
      : "";
  const buildingProposalBaseDesignation =
    (regionForProjectToken || "").trim().toLowerCase() === "western"
      ? "The Executive Engineer (W.S.) - I"
      : "The Executive Engineer (E.S.) - I";
  const suffix = templateTokenSuffix(templateType);
  const genericConsultantTemplateTokens: Record<string, string> = {
    [`project_Consultant_${suffix}`]: consultantRoleLabel,
    [`project_Consultant_${suffix}.`]: consultantRoleLabel,
    [`project_Consultant_${suffix}._Type`]: consultantRoleLabel,
    [`project_Name_${suffix}`]: consultantName,
    [`project_Name_${suffix}.`]: consultantName,
    [`project_Company_Name_${suffix}`]: consultantCompanyName,
    [`project_Company_Name_${suffix}.`]: consultantCompanyName,
    [`project_Address_line1_${suffix}`]: consultantAddressLine1,
    [`project_Address_line2_${suffix}`]: consultantAddressLine2,
    [`project_Address_line3_${suffix}`]: consultantAddressLine3,
    [`project_RegNo_${suffix}`]: consultantRegNo,
    [`project_RegNo_${suffix}.`]: consultantRegNo,
    [`project_Validity_${suffix}`]: consultantValidityDisplay,
    [`project_Validity_${suffix}.`]: consultantValidityDisplay,
    [`project_Mobile_${suffix}`]: consultantMobile,
    [`project_Email_${suffix}`]: consultantEmail,
  };

  if (
    process.env.NODE_ENV === "development" &&
    templateType === "Fire Safety Consultant"
  ) {
    console.log("[fire-preview-debug]", {
      templateType,
      consultantKeywords,
      primaryConsultantApplicant,
      consultantAddressLine1,
      consultantAddressLine2,
      consultantAddressLine3,
      sourceConsultantAddressLine1: source?.consultantAddressLine1 || "",
      sourceConsultantAddressLine2: source?.consultantAddressLine2 || "",
      sourceConsultantAddressLine3: source?.consultantAddressLine3 || "",
    });
  }

  return {
    // Keep only tokens that are used by current HTML templates:
    // `architect.html` and `licensed-surveyor.html`.
    project_date_generation: fields.CurrentDate,
    // Common subject + re line fields
    project_Letter_Appointment_Role: consultantRoleLabel,
    "project_CS/CTSNos.": csCtsNosSubjectDisplay,
    "project_Division/Village": divisionVillage || undefined,
    project_Street: street || undefined,
    "project_Ward.": wardForProjectToken || undefined,
    project_Planning_Authority: planningAuthority,
    project_Proposal_Number: proposalNumber || undefined,

    // Client signature block (common)
    project_Client_Company_Name: clientCompanyName,
    project_Client_Company_Designation: displayClientCompanyDesignation,
    project_Client_Name: clientName,

    // Building proposal CC block (common)
    project_BuildingProposal_BaseDesignation: buildingProposalBaseDesignation,
    project_BuildingProposal_OfficerDesignation: officerDesignationDisplay,
    project_BuildingProposal_ZoneSuffix: officerZoneSuffix,
    "project_ addressline1_BuildingProposal": buildingProposalAddress?.line1 || "",
    "project_ addressline2_BuildingProposal": buildingProposalAddress?.line2 || "",
    "project_ addressline3_BuildingProposal": buildingProposalAddress?.line3 || "",

    // Architect template tokens
    "project_Consultant_Architect._Type": consultantRoleLabel,
    "project_Consultant_Architect.": consultantRoleLabel,
    "project_Name_Architect.": architectName || undefined,
    "project_Company_Name_Architect":
      architectApplicant?.entity_name?.trim() ||
      architectApplicant?.entityName?.trim() ||
      consultantCompanyName ||
      undefined,
    "project_Address_line1_Architect": architectAddressLine1,
    "project_Address_line2_Architect": architectAddressLine2,
    "project_Address_line3Architect": architectAddressLine3,
    "project_RegNo_Architect.": consultantRegNo,
    "project_Validity_Architect.": consultantValidityDisplay,

    // Licensed Surveyor template tokens
    project_Consultant_LS: consultantRoleLabel,
    "project_Consultant_LS.": consultantRoleLabel,
    "project_Consultant_LS._Type": consultantRoleLabel,
    "project_Name_LS.": consultantName || undefined,
    project_Company_Name_LS: consultantCompanyName || undefined,
    project_Address_line1_LS: consultantAddressLine1,
    project_Address_line2_LS: consultantAddressLine2,
    project_Address_line3_LS: consultantAddressLine3,
    "project_RegNo_LS.": consultantRegNo,
    "project_Validity_LS.": consultantValidityDisplay,

    // Fire safety consultant template tokens
    "project_Name_Fire_Safety.": consultantName || undefined,
    project_Address_line1_Fire_Safety: consultantAddressLine1,
    project_Address_line2_Fire_Safety: consultantAddressLine2,
    project_Address_line3_Fire_Safety: consultantAddressLine3,
    "project_RegNo_Fire_Safety.": consultantRegNo,

    // Generic consultant tokens for all application types.
    ...genericConsultantTemplateTokens,
  };
}

// A4 page size in points (jsPDF unit).
const A4_PAGE_WIDTH_PT = 595.28;
const A4_PAGE_HEIGHT_PT = 841.89;

// Page margins in points. Tighter than the original Word `@page` rule (which
// used 113.4pt / 56.7pt) so the appointment letter fits in 2 pages even when
// the user's browser renders fonts wider than the original Chromium output.
const PDF_MARGIN_TOP_PT = 48;
const PDF_MARGIN_BOTTOM_PT = 36;
const PDF_MARGIN_SIDE_PT = 36;

const PDF_CONTENT_WIDTH_PT = A4_PAGE_WIDTH_PT - PDF_MARGIN_SIDE_PT * 2;
const PDF_CONTENT_HEIGHT_PT = A4_PAGE_HEIGHT_PT - PDF_MARGIN_TOP_PT - PDF_MARGIN_BOTTOM_PT;

// Safety cap: if browser rendering still produces more than this many pages,
// the image is proportionally shrunk so it fits exactly within the cap.
const MAX_PAGES = 2;

// Render the host at the same width as the PDF content area so html2canvas
// produces an image that maps 1:1 onto the page's content rectangle. Using
// the natural Word width keeps line-wrapping identical to the original.
// 1pt = 96/72 px at 96 dpi → multiply by 1.3333 to get CSS pixels.
const HOST_WIDTH_PX = Math.round(PDF_CONTENT_WIDTH_PT * (96 / 72));

/**
 * Mounts a hidden host in the main document with the parsed Word HTML's
 * `<style>` blocks plus its body content. Same-document mounting is required
 * because html2canvas can't reliably traverse cross-document trees (iframes).
 *
 * The host has NO padding — page margins are applied later in `addImage`
 * positioning so they stay consistent across every PDF page.
 */
function mountHtmlIntoHiddenHost(html: string): HTMLDivElement {
  const parsed = new DOMParser().parseFromString(html, "text/html");

  const host = document.createElement("div");
  host.setAttribute("aria-hidden", "true");
  host.style.position = "absolute";
  host.style.left = "-10000px";
  host.style.top = "0";
  host.style.width = `${HOST_WIDTH_PX}px`;
  host.style.boxSizing = "border-box";
  host.style.padding = "0";
  host.style.background = "#ffffff";
  host.style.color = "#000000";
  host.style.pointerEvents = "none";

  parsed.head.querySelectorAll("style").forEach((styleNode) => {
    host.appendChild(styleNode.cloneNode(true));
  });

  // Re-parent body children so all Word styles still apply via class selectors.
  const bodyChildren = Array.from(parsed.body.childNodes);
  bodyChildren.forEach((node) => host.appendChild(node.cloneNode(true)));

  document.body.appendChild(host);
  return host;
}

// Cache the dynamic imports so the second preview pays zero module-load cost.
let cachedPdfDeps:
  | Promise<{
      html2canvas: typeof import("html2canvas").default;
      JsPdfCtor: typeof import("jspdf").jsPDF;
    }>
  | null = null;

function loadPdfDeps() {
  if (!cachedPdfDeps) {
    cachedPdfDeps = Promise.all([import("html2canvas"), import("jspdf")]).then(
      ([h2c, jsp]) => ({ html2canvas: h2c.default, JsPdfCtor: jsp.jsPDF })
    );
  }
  return cachedPdfDeps;
}

/**
 * Pre-warms the html2canvas + jsPDF chunks so the first Preview click after
 * page load doesn't pay the dynamic-import cost. Safe to call multiple times.
 * Schedule via `requestIdleCallback` from a top-level component if desired.
 */
export function prewarmPreviewPdfRuntime(): void {
  if (typeof window === "undefined") return;
  void loadPdfDeps();
}

async function convertHtmlToPdfBlobInBrowser(html: string): Promise<Blob> {
  if (typeof window === "undefined") {
    throw new Error("HTML→PDF conversion can only run in the browser.");
  }

  // Kick off the heavy dynamic imports in parallel with DOM mount + layout so
  // module loading overlaps with rendering instead of running sequentially.
  const depsPromise = loadPdfDeps();
  const host = mountHtmlIntoHiddenHost(html);

  try {
    // Single RAF is enough — html2canvas re-reads layout itself before capture.
    await new Promise((r) => requestAnimationFrame(() => r(null)));

    const { html2canvas, JsPdfCtor } = await depsPromise;

    // Capture scale chosen as a balance: 2.5-3× lands at ~190-225 dpi which
    // stays crisp at modal zoom levels but keeps html2canvas + JPEG encoding
    // fast enough to feel instant. (Going to 4× ~doubles generation time for
    // a barely-perceptible sharpness gain after PDF.js downscales it.)
    const dpr = window.devicePixelRatio || 1;
    const captureScale = dpr >= 2 ? 2.5 : 3;
    // `letterRendering` is a non-typed html2canvas option that forces per-character
    // text rendering rather than batched word-level rendering — produces sharper
    // text edges for small font sizes.
    const canvas = await html2canvas(host, {
      scale: captureScale,
      backgroundColor: "#ffffff",
      useCORS: true,
      windowWidth: HOST_WIDTH_PX,
      letterRendering: true,
    } as Parameters<typeof html2canvas>[1]);

    const pdf = new JsPdfCtor({ unit: "pt", format: "a4", orientation: "portrait" });

    // Map canvas pixels to PDF points using the content rectangle width.
    const naturalPxPerPt = canvas.width / PDF_CONTENT_WIDTH_PT;
    const naturalContentHeightPt = canvas.height / naturalPxPerPt;
    const naturalPages = Math.ceil(naturalContentHeightPt / PDF_CONTENT_HEIGHT_PT);

    // If content overflows MAX_PAGES, proportionally shrink the rendered image
    // so it fits exactly within MAX_PAGES (text gets slightly smaller, but
    // the layout stays intact).
    const fitScale =
      naturalPages > MAX_PAGES
        ? (MAX_PAGES * PDF_CONTENT_HEIGHT_PT) / naturalContentHeightPt
        : 1;

    const effectiveContentWidthPt = PDF_CONTENT_WIDTH_PT * fitScale;
    const effectivePxPerPt = canvas.width / effectiveContentWidthPt;
    const pageContentCanvasHeightPx = Math.floor(
      PDF_CONTENT_HEIGHT_PT * effectivePxPerPt
    );
    // Center horizontally if shrunk so the page doesn't look left-biased.
    const xOffsetPt =
      PDF_MARGIN_SIDE_PT + (PDF_CONTENT_WIDTH_PT - effectiveContentWidthPt) / 2;

    let consumed = 0;
    let pageIndex = 0;
    while (consumed < canvas.height) {
      const sliceHeightPx = Math.min(
        pageContentCanvasHeightPx,
        canvas.height - consumed
      );
      const sliceCanvas = document.createElement("canvas");
      sliceCanvas.width = canvas.width;
      sliceCanvas.height = sliceHeightPx;
      const ctx = sliceCanvas.getContext("2d");
      if (!ctx) break;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, sliceCanvas.width, sliceCanvas.height);
      ctx.drawImage(
        canvas,
        0, consumed, canvas.width, sliceHeightPx,
        0, 0, canvas.width, sliceHeightPx
      );
      // JPEG q=0.95 is ~5× faster to encode than PNG and produces roughly
      // 4-5× smaller PDFs at near-identical visual quality for text on white.
      const dataUrl = sliceCanvas.toDataURL("image/jpeg", 0.95);
      const sliceHeightPt = sliceHeightPx / effectivePxPerPt;
      if (pageIndex > 0) pdf.addPage();
      pdf.addImage(
        dataUrl,
        "JPEG",
        xOffsetPt,
        PDF_MARGIN_TOP_PT,
        effectiveContentWidthPt,
        sliceHeightPt,
        undefined,
        "FAST"
      );
      consumed += sliceHeightPx;
      pageIndex += 1;
    }

    return pdf.output("blob");
  } finally {
    host.remove();
  }
}

/**
 * Wraps the populated HTML with a `@page` margin override + Paged.js
 * (loaded from a CDN inside the iframe so it costs nothing in the app bundle).
 *
 * Paged.js is a CSS Paged Media polyfill: it interprets `@page` rules and
 * splits the document into actual A4 page boxes (`.pagedjs_page`), which we
 * then style as white sheets with drop shadow so the preview looks like the
 * reference `architect appointment letter.pdf` (multiple pages, not one
 * scrolling document). Native browser text rendering = razor-sharp at any
 * zoom; Print/Save as PDF uses the same `@page` rules → vector PDF output
 * matches the on-screen pagination exactly.
 */
function injectPaginatedStyles(html: string): string {
  const head = `
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Carlito:wght@400;700&display=swap" rel="stylesheet">
<style>
  /* A4 with tight vertical margins (36pt top + bottom) and demo-matching
     horizontal margins (56.7pt sides). The slim vertical margins give us
     ~196pt extra content height across the 2 pages so all content fits.
     Paged.js requires shorthand margin inside @page (longhand variants are
     ignored), so override both the unnamed default and the named
     @page WordSection1 rule that the Word HTML binds the body to. */
  @page {
    size: A4;
    margin: 36pt 56.7pt;
  }
  @page WordSection1 {
    size: A4;
    margin: 36pt 56.7pt;
  }

  html, body {
    margin: 0;
    padding: 0;
    background: #f3f4f6;
  }

  /* Some uploaded/Word-exported templates carry explicit widths/offsets on
     the root wrapper. Normalize that wrapper to fill the printable page area
     so horizontal spacing is balanced on both sides. */
  div.WordSection1,
  main.page {
    width: 100% !important;
    max-width: 100% !important;
    box-sizing: border-box !important;
    margin-left: 0 !important;
    margin-right: 0 !important;
    padding-left: 0 !important;
    padding-right: 0 !important;
  }

  /* Carlito is metric-compatible with Calibri (Google's open-source clone).
     Forcing it everywhere gives consistent line widths regardless of which
     fonts the user has installed locally — without this the browser's
     default fallback (Times/Arial) wraps wider and overflows to 3 pages. */
  body, body * {
    font-family: 'Carlito', 'Calibri', 'Helvetica', sans-serif !important;
  }

  /* The Word template has a 80pt top gap before the signature block which,
     combined with page-break-inside:avoid, can shove the block onto a fresh
     page and create a wasted 3rd page. Squash that gap. */
  div[style*="margin-top:80.0pt"],
  div[style*="margin-top: 80.0pt"] {
    margin-top: 24pt !important;
  }

  /* Keep the closing italic line ("For information & record please.") with
     the C.C. block above it instead of letting Paged.js push it to a 3rd
     page. We target the last paragraph inside the WordSection1 wrapper. */
  div.WordSection1 > p:last-child,
  div.WordSection1 > p.MsoNormal:last-of-type {
    page-break-before: avoid !important;
    break-before: avoid !important;
  }

  /* Collapse empty Word paragraph spacers so the final line has more room
     to fit on page 2. (These are <p>...&nbsp;</p> rhythm fillers.) */
  div.WordSection1 > p.MsoNormal:nth-last-child(2) {
    margin: 0 !important;
    line-height: 1 !important;
    font-size: 0 !important;
  }

  /* Paged.js page boxes — styled to look like real sheets of A4 paper. */
  .pagedjs_pages {
    padding: 12px 0;
  }
  .pagedjs_page {
    background: #ffffff;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
    margin: 0 auto 16px auto;
  }

  /* During print, drop the shadow / background — only the actual content. */
  @media print {
    html, body { background: #ffffff; }
    .pagedjs_pages { padding: 0; }
    .pagedjs_page { box-shadow: none; margin: 0; }
  }
</style>
<script src="https://unpkg.com/pagedjs/dist/paged.polyfill.js"></script>`;
  // Insert before </head>; if no head tag, prepend so styles still parse.
  if (/<\/head>/i.test(html)) {
    return html.replace(/<\/head>/i, `${head}</head>`);
  }
  return head + html;
}

/**
 * Global HTML preview path for all consultant template types.
 * Native browser text = razor-sharp preview at any zoom, instant load.
 */
export async function generateApplicationPreviewHtml(
  fields: TemplateFields,
  templateType: TemplateType,
  source?: ApplicationPreviewSource
): Promise<string> {
  const formValues = mapToPdfFieldValues(fields, source, templateType);

  await supabase.auth.refreshSession();
  const { data: sessionData } = await supabase.auth.getSession();
  const access_token = sessionData.session?.access_token;

  const response = await fetch("/api/application-preview-html", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(access_token ? { Authorization: `Bearer ${access_token}` } : {}),
    },
    body: JSON.stringify({
      templateType,
      fields: formValues,
      ...(source?.projectId ? { projectId: source.projectId } : {}),
      ...(source?.ownerDebug ? { owner_debug: source.ownerDebug } : {}),
    }),
  });

  if (response.ok) {
    const rawHtml = await response.text();
    return injectPaginatedStyles(rawHtml);
  }

  const payload = await response.json().catch(() => null);
  throw new Error(
    typeof payload?.error === "string"
      ? payload.error
      : `HTML preview load failed (${response.status}).`
  );
}

/**
 * Global HTML path for all consultant template types:
 * fetch populated HTML from `/api/application-preview-html`, then render to
 * a PDF blob in the browser via `html2canvas` + `jspdf`.
 */
export async function generateApplicationPreviewPdf(
  fields: TemplateFields,
  templateType: TemplateType,
  source?: ApplicationPreviewSource
): Promise<Blob> {
  const formValues = mapToPdfFieldValues(fields, source, templateType);

  await supabase.auth.refreshSession();
  const { data: sessionData } = await supabase.auth.getSession();
  const access_token = sessionData.session?.access_token;

  const htmlResponse = await fetch("/api/application-preview-html", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(access_token ? { Authorization: `Bearer ${access_token}` } : {}),
    },
    body: JSON.stringify({
      templateType,
      fields: formValues,
      ...(source?.projectId ? { projectId: source.projectId } : {}),
      ...(source?.ownerDebug ? { owner_debug: source.ownerDebug } : {}),
    }),
  });

  if (htmlResponse.ok) {
    const html = await htmlResponse.text();
    return convertHtmlToPdfBlobInBrowser(html);
  }

  const htmlPayload = await htmlResponse.json().catch(() => null);
  const message =
    typeof htmlPayload?.error === "string"
      ? htmlPayload.error
      : `HTML preview conversion failed (${htmlResponse.status}).`;

  throw new Error(message);
}

