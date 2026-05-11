"use client";

import { formatCoaExpiryDisplay } from "@/app/utils/coaMetadataDisplay";
import { supabase } from "@/app/utils/supabase";
import { type TemplateFields, type TemplateType } from "./templateGenerators";

export type ApplicationPreviewSource = {
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
  ownerLetterheadUrl?: string | null;
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
  line1: "Near Raj Legacy (Residential Complex),",
  line2: "Paper Mill Compound,L. B. S. Marg,",
  line3: "Vikhroli (West), Mumbai - 400 083",
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

/** Subject line: village like `KURLA - 4` → `Kurla - 4` (first letter only capitalised on name part). */
function formatDivisionVillageForSubject(value: string): string {
  const s = value.trim();
  if (!s) return s;
  const parts = s.split(/\s*-\s*/);
  if (parts.length >= 2) {
    const head = parts[0].trim();
    const tail = parts.slice(1).join(" - ").trim();
    const headFormatted =
      head.charAt(0).toUpperCase() + head.slice(1).toLowerCase();
    return `${headFormatted} - ${tail}`;
  }
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

/**
 * Subject line survey numbers: two items → `338 & 340`; three or more → `2, 3, 4 & 6`.
 */
function formatSurveyNumbersListForSubject(joinedList: string): string {
  const cleaned = joinedList.replace(/^\(|\)$/g, "").trim();
  if (!cleaned) return "";
  const parts = cleaned
    .split(/[,，]/)
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length === 0) return "";
  if (parts.length === 1) return parts[0];
  if (parts.length === 2) return `${parts[0]} & ${parts[1]}`;
  return `${parts.slice(0, -1).join(", ")} & ${parts[parts.length - 1]}`;
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

  /** Ends architect address line 3 with a period when DB omits it. */
  const ensureTrailingPeriodOnFinalAddressLine = (value: string): string => {
    const s = value.trim();
    if (!s) return "";
    if (/[.!?…]\s*$/.test(s)) return s;
    return `${s}.`;
  };

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
  const architectAddressLine1 = pickText(
    architectApplicant?.address_line1,
    (architectApplicant as any)?.addressLine1,
    architectFallbackLine1
  );
  const architectAddressLine2 = pickText(
    architectApplicant?.address_line2,
    (architectApplicant as any)?.addressLine2,
    architectFallbackLine2
  );
  const architectAddressLine3 = pickText(
    architectApplicant?.address_line3,
    (architectApplicant as any)?.addressLine3,
    architectFallbackLine3
  );
  const architectAddressLine3ForLetter =
    architectAddressLine3.trim().length > 0
      ? ensureTrailingPeriodOnFinalAddressLine(architectAddressLine3)
      : "";
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
    ? `${surveyLabelForSubject} ${formatSurveyNumbersListForSubject(rawSurveyList)}`
    : "";
  const divisionVillageForSubject = divisionVillage
    ? formatDivisionVillageForSubject(divisionVillage)
    : undefined;
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
  const ownerLetterheadUrl = source?.ownerLetterheadUrl?.trim() || "";
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
      ? "E. S.,"
      : (regionForProjectToken || "").trim().toLowerCase() === "western"
        ? "W. S.,"
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
    "project_Division/Village": divisionVillageForSubject,
    project_Street: street || undefined,
    "project_Ward.": wardForProjectToken || undefined,
    project_Planning_Authority: planningAuthority,
    project_Proposal_Number: proposalNumber || undefined,

    // Client signature block (common)
    project_Client_Company_Name: clientCompanyName,
    project_Client_Company_Designation: displayClientCompanyDesignation,
    project_Client_Name: clientName,
    project_Letterhead_Image_Url: ownerLetterheadUrl || undefined,

    // Building proposal CC block (common)
    project_BuildingProposal_BaseDesignation: buildingProposalBaseDesignation,
    project_BuildingProposal_OfficerDesignation: officerDesignationDisplay,
    project_BuildingProposal_ZoneSuffix: officerZoneSuffix,
    project_addressline1_BuildingProposal: buildingProposalAddress?.line1 || "",
    project_addressline2_BuildingProposal: buildingProposalAddress?.line2 || "",
    project_addressline3_BuildingProposal: buildingProposalAddress?.line3 || "",
    "project_ addressline1_BuildingProposal": buildingProposalAddress?.line1 || "",
    "project_ addressline2_BuildingProposal": buildingProposalAddress?.line2 || "",
    "project_ addressline3_BuildingProposal": buildingProposalAddress?.line3 || "",

    // Generic consultant tokens for all application types.
    // Keep this before template-specific blocks so specific mappings can override.
    ...genericConsultantTemplateTokens,

    // Architect template tokens
    project_Consultant_Architect: consultantRoleLabel,
    "project_Consultant_Architect._Type": consultantRoleLabel,
    "project_Consultant_Architect.": consultantRoleLabel,
    project_Name_Architect: architectName?.trim()
      ? `${architectName.trim()},`
      : undefined,
    "project_Name_Architect.": architectName || undefined,
    project_Company_Name_Architect: (() => {
      const company =
        architectApplicant?.entity_name?.trim() ||
        architectApplicant?.entityName?.trim() ||
        consultantCompanyName?.trim() ||
        "";
      return company ? `${company},` : undefined;
    })(),
    project_RegNo_Architect: consultantRegNo,
    /** Label for value from `coa_reg_no` (Council of Architecture registration). */
    project_Architect_COA_Reg_No_Label: "COA Reg. No.:",
    "project_Address_line1_Architect": architectAddressLine1 || undefined,
    "project_Address_line2_Architect": architectAddressLine2 || undefined,
    "project_Address_line3Architect":
      architectAddressLine3ForLetter || undefined,
    project_Validity_Architect: consultantValidityDisplay,
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

// Render host at full A4 width so template backgrounds sized as `210mm 297mm`
// align to one physical page. Content margins are still applied during
// PDF composition (`xOffsetPt` / `marginTopPt` / `marginBottomPt`).
const HOST_WIDTH_PX = Math.round(A4_PAGE_WIDTH_PT * (96 / 72));

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
  host.className = "pdf-host-root";
  host.setAttribute("aria-hidden", "true");
  host.style.position = "absolute";
  host.style.left = "-10000px";
  host.style.top = "0";
  host.style.width = `${HOST_WIDTH_PX}px`;
  host.style.boxSizing = "border-box";
  host.style.padding = "0";
  // Do not set `background` here: templates put the letterhead on `body` which
  // we rewrite to `.pdf-host-root`. An inline background would win the cascade
  // and strip the letterhead in html2canvas captures (Print uses the iframe and
  // keeps the full `background: #fff url(...)` rule).
  host.style.color = "#000000";
  host.style.pointerEvents = "none";

  parsed.head.querySelectorAll("style").forEach((styleNode) => {
    const styleEl = document.createElement("style");
    const rawCss = styleNode.textContent || "";
    // The PDF host is a detached <div>, not the real document <body>.
    // Rewrite body/html selectors so letterhead/background rules still apply
    // when templates define them on `body`.
    const rewrittenCss = rawCss
      .replace(/\bhtml\s*,\s*body\b/gi, ".pdf-host-root, .pdf-host-root")
      .replace(/\bbody\s*,\s*html\b/gi, ".pdf-host-root, .pdf-host-root")
      .replace(/\bbody\b/gi, ".pdf-host-root")
      .replace(/\bhtml\b/gi, ".pdf-host-root");
    styleEl.textContent = rewrittenCss;
    host.appendChild(styleEl);
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

type RasterizeDomOptions = {
  /** Forces html2canvas layout width (hidden host path uses {@link HOST_WIDTH_PX}). */
  windowWidthPx?: number;
  /**
   * Sharper, heavier capture (used for Supabase uploads from the preview iframe).
   * Higher canvas scale + higher JPEG quality + slower PDF image compression.
   */
  highFidelity?: boolean;
};

type RasterPdfMetrics = {
  captureScale: number;
  jpegQuality: number;
  imageCompression: "MEDIUM" | "FAST";
  windowWidthPx: number;
  plumberCcBreakPx: number | null;
};

function computeRasterPdfMetrics(
  captureRoot: HTMLElement,
  templateType: TemplateType | undefined,
  highFidelity: boolean
): RasterPdfMetrics {
  const dpr = Math.max(1, window.devicePixelRatio || 1);
  const captureScale = highFidelity
    ? Math.min(4, Math.max(3.25, dpr * 2))
    : dpr >= 2
      ? 2.5
      : 3;
  const jpegQuality = highFidelity ? 0.98 : 0.95;
  const imageCompression: "MEDIUM" | "FAST" = highFidelity ? "MEDIUM" : "FAST";
  const windowWidthPx = Math.max(
    1,
    Math.ceil(Math.max(captureRoot.scrollWidth, captureRoot.getBoundingClientRect().width))
  );
  let plumberCcBreakPx: number | null = null;
  if (templateType === "Plumber") {
    const ccAnchor = captureRoot.querySelector(".cc-start") as HTMLElement | null;
    if (ccAnchor) {
      const hostRect = captureRoot.getBoundingClientRect();
      const anchorRect = ccAnchor.getBoundingClientRect();
      const offset = anchorRect.top - hostRect.top;
      plumberCcBreakPx = offset > 0 ? offset : null;
    }
  }
  return { captureScale, jpegQuality, imageCompression, windowWidthPx, plumberCcBreakPx };
}

async function composePdfFromRasterCanvas(
  canvas: HTMLCanvasElement,
  templateType: TemplateType | undefined,
  metrics: RasterPdfMetrics
): Promise<Blob> {
  const { JsPdfCtor } = await loadPdfDeps();
  const captureScale = metrics.captureScale;
  const jpegQuality = metrics.jpegQuality;
  const imageCompression = metrics.imageCompression;
  const plumberCcBreakPx = metrics.plumberCcBreakPx;

  const pdf = new JsPdfCtor({ unit: "pt", format: "a4", orientation: "portrait" });
  const marginTopPt = templateType === "Plumber" ? 60 : PDF_MARGIN_TOP_PT;
  const marginBottomPt = templateType === "Plumber" ? 90 : PDF_MARGIN_BOTTOM_PT;
  const contentWidthPt = PDF_CONTENT_WIDTH_PT;
  const contentHeightPt = A4_PAGE_HEIGHT_PT - marginTopPt - marginBottomPt;

  const naturalPxPerPt = canvas.width / contentWidthPt;
  const naturalContentHeightPt = canvas.height / naturalPxPerPt;
  const naturalPages = Math.ceil(naturalContentHeightPt / contentHeightPt);

  const fitScale =
    naturalPages > MAX_PAGES ? (MAX_PAGES * contentHeightPt) / naturalContentHeightPt : 1;

  const effectiveContentWidthPt = contentWidthPt * fitScale;
  const effectivePxPerPt = canvas.width / effectiveContentWidthPt;
  const pageContentCanvasHeightPx = Math.floor(contentHeightPt * effectivePxPerPt);
  const xOffsetPt = PDF_MARGIN_SIDE_PT + (PDF_CONTENT_WIDTH_PT - effectiveContentWidthPt) / 2;

  let consumed = 0;
  let pageIndex = 0;
  const forcedBreakCanvasPx =
    plumberCcBreakPx != null ? Math.floor(plumberCcBreakPx * captureScale) : null;
  let plumberForcedBreakApplied = false;
  while (consumed < canvas.height) {
    let sliceHeightPx = Math.min(pageContentCanvasHeightPx, canvas.height - consumed);
    if (
      templateType === "Plumber" &&
      !plumberForcedBreakApplied &&
      forcedBreakCanvasPx != null &&
      forcedBreakCanvasPx > consumed &&
      forcedBreakCanvasPx < canvas.height
    ) {
      const untilForcedBreak = forcedBreakCanvasPx - consumed;
      if (untilForcedBreak > 0) {
        sliceHeightPx = Math.min(sliceHeightPx, untilForcedBreak);
        plumberForcedBreakApplied = true;
      }
    }
    const sliceCanvas = document.createElement("canvas");
    sliceCanvas.width = canvas.width;
    sliceCanvas.height = sliceHeightPx;
    const ctx = sliceCanvas.getContext("2d");
    if (!ctx) break;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, sliceCanvas.width, sliceCanvas.height);
    ctx.drawImage(canvas, 0, consumed, canvas.width, sliceHeightPx, 0, 0, canvas.width, sliceHeightPx);
    const dataUrl = sliceCanvas.toDataURL("image/jpeg", jpegQuality);
    const sliceHeightPt = sliceHeightPx / effectivePxPerPt;
    if (pageIndex > 0) pdf.addPage();
    pdf.addImage(
      dataUrl,
      "JPEG",
      xOffsetPt,
      marginTopPt,
      effectiveContentWidthPt,
      sliceHeightPt,
      undefined,
      imageCompression
    );
    consumed += sliceHeightPx;
    pageIndex += 1;
  }

  const totalPages = pdf.getNumberOfPages();
  const footerY = A4_PAGE_HEIGHT_PT - 26;
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9);
  pdf.setTextColor(80, 80, 80);
  const footerX = A4_PAGE_WIDTH_PT / 2;
  for (let i = 1; i <= totalPages; i++) {
    pdf.setPage(i);
    pdf.text(`Page ${i} of ${totalPages}`, footerX, footerY, {
      align: "center",
    });
  }

  return pdf.output("blob");
}

/**
 * Rasterizes an in-document DOM subtree (same pixels as Print when `captureRoot`
 * is the preview iframe `body` after Paged.js layout).
 */
async function rasterizeDomRootToPdfBlob(
  captureRoot: HTMLElement,
  templateType?: TemplateType,
  options?: RasterizeDomOptions
): Promise<Blob> {
  await new Promise((r) => requestAnimationFrame(() => r(null)));

  await Promise.all(
    Array.from(captureRoot.querySelectorAll("img")).map(
      (img) =>
        img.complete && img.naturalWidth > 0
          ? Promise.resolve()
          : new Promise<void>((resolve) => {
              const done = () => resolve();
              img.addEventListener("load", done, { once: true });
              img.addEventListener("error", done, { once: true });
            })
    )
  );

  const highFidelity = Boolean(options?.highFidelity);
  const baseMetrics = computeRasterPdfMetrics(captureRoot, templateType, highFidelity);
  const windowWidthPx = options?.windowWidthPx ?? baseMetrics.windowWidthPx;
  const metrics: RasterPdfMetrics = { ...baseMetrics, windowWidthPx };

  const { html2canvas } = await loadPdfDeps();

  const canvas = await html2canvas(captureRoot, {
    scale: metrics.captureScale,
    backgroundColor: "#ffffff",
    useCORS: true,
    windowWidth: windowWidthPx,
    letterRendering: false,
    ...(highFidelity
      ? {
          onclone: (clonedDoc: Document) => {
            const b = clonedDoc.body;
            if (!b) return;
            b.style.setProperty("-webkit-font-smoothing", "antialiased");
            b.style.setProperty("-moz-osx-font-smoothing", "grayscale");
          },
        }
      : {}),
  } as Parameters<typeof html2canvas>[1]);

  return composePdfFromRasterCanvas(canvas, templateType, metrics);
}

/**
 * Rasterizes a full HTML document string in a hidden host on the **main** `document`
 * (always has `defaultView`) — reliable for **Save to project** / QR uploads.
 * Preview iframe capture was removed due to browser `defaultView` / timing issues.
 */
export async function applicationPreviewPdfFromFullHtml(
  html: string,
  templateType: TemplateType,
  options?: { highFidelity?: boolean }
): Promise<Blob> {
  return convertHtmlToPdfBlobInBrowser(html, templateType, options);
}

async function convertHtmlToPdfBlobInBrowser(
  html: string,
  templateType?: TemplateType,
  opts?: { highFidelity?: boolean }
): Promise<Blob> {
  if (typeof window === "undefined") {
    throw new Error("HTML→PDF conversion can only run in the browser.");
  }

  const host = mountHtmlIntoHiddenHost(html);

  try {
    return await rasterizeDomRootToPdfBlob(host, templateType, {
      windowWidthPx: HOST_WIDTH_PX,
      highFidelity: Boolean(opts?.highFidelity),
    });
  } finally {
    host.remove();
  }
}

/**
 * Saved-PDF QR sizing:
 * - Lock stylesheet is appended immediately before `</body>` so it follows Word `<style>` blocks.
 * - Word often uses `div, img { width:100% !important }` and column flex where `flex: 0 0 112px`
 *   only fixes the main axis (height), leaving width stretched — use `flex: none`, explicit
 *   width/height, `align-self: flex-start`, and re-apply after Paged.js (`PagedConfig.after`).
 */
const SAVED_PDF_QR_LOCK_FN = `function __lockAppSavedPdfQr(){
  document.querySelectorAll('[id="app-saved-pdf-qr"]').forEach(function(el){
    el.style.setProperty("width","112px","important");
    el.style.setProperty("height","112px","important");
    el.style.setProperty("max-width","112px","important");
    el.style.setProperty("max-height","112px","important");
    el.style.setProperty("min-width","112px","important");
    el.style.setProperty("min-height","112px","important");
    el.style.setProperty("flex","none","important");
    el.style.setProperty("flex-grow","0","important");
    el.style.setProperty("flex-shrink","0","important");
    el.style.setProperty("align-self","flex-start","important");
    el.style.setProperty("box-sizing","border-box","important");
    el.style.setProperty("display","inline-block","important");
    el.style.setProperty("overflow","hidden","important");
    el.style.setProperty("background-size","contain","important");
    el.style.setProperty("background-repeat","no-repeat","important");
    el.style.setProperty("background-position","center","important");
  });
}`;

const SAVED_PDF_QR_LOCK_SCRIPT_PAGED = `<script>
${SAVED_PDF_QR_LOCK_FN}
(function(){
  var prev = window.PagedConfig || {};
  var pa = prev.after;
  window.PagedConfig = Object.assign({}, prev, {
    after: async function(done){
      __lockAppSavedPdfQr();
      if (typeof pa === "function") await pa(done);
      __lockAppSavedPdfQr();
    }
  });
})();
(function(){
  __lockAppSavedPdfQr();
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", __lockAppSavedPdfQr);
  }
  window.addEventListener("load", function(){
    __lockAppSavedPdfQr();
    setTimeout(__lockAppSavedPdfQr, 50);
    setTimeout(__lockAppSavedPdfQr, 300);
  });
})();
</script>`;

const SAVED_PDF_QR_LOCK_SCRIPT_INLINE = `<script>
${SAVED_PDF_QR_LOCK_FN}
(function(){
  __lockAppSavedPdfQr();
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", __lockAppSavedPdfQr);
  }
  window.addEventListener("load", function(){
    __lockAppSavedPdfQr();
    setTimeout(__lockAppSavedPdfQr, 50);
    setTimeout(__lockAppSavedPdfQr, 300);
  });
})();
</script>`;

const SAVED_PDF_QR_LOCK_STYLE = `<style id="app-saved-pdf-qr-lock" type="text/css">
html body div#app-saved-pdf-qr.application-saved-pdf-qr-pixel {
  width: 112px !important;
  height: 112px !important;
  max-width: 112px !important;
  max-height: 112px !important;
  min-width: 112px !important;
  min-height: 112px !important;
  flex: none !important;
  flex-grow: 0 !important;
  flex-shrink: 0 !important;
  align-self: flex-start !important;
  box-sizing: border-box !important;
  display: inline-block !important;
  overflow: hidden !important;
  line-height: 0 !important;
  vertical-align: top !important;
  background-size: contain !important;
  background-repeat: no-repeat !important;
  background-position: center center !important;
  transform: none !important;
}
html body .application-saved-pdf-qr-fallback {
  width: 132px !important;
  max-width: 132px !important;
  flex-grow: 0 !important;
  align-self: flex-end !important;
}
</style>`;

/**
 * Remove injected saved-PDF QR markup before scanning HTML for letterhead URLs.
 * The QR is a PNG data URI; `injectPaginatedStyles` picks the first `data:image`
 * for `.pagedjs_page` letterhead. When the real letterhead is JPEG/WebP or only
 * appears after the QR in the string, the QR PNG was wrongly stretched to full A4.
 */
function htmlWithoutSavedPdfQrInjection(html: string): string {
  return html
    .replace(/<div[^>]*\bid\s*=\s*["']app-saved-pdf-qr["'][^>]*>\s*<\/div>/gi, "")
    .replace(
      /<div[^>]*class\s*=\s*["'][^"']*application-saved-pdf-qr-fallback[^"']*["'][^>]*>[\s\S]*?<\/div>/gi,
      ""
    );
}

/** Primary wrapper for Word-export letters (all application templates). */
function letterRootFromParsed(parsed: Document): Element | null {
  return (
    parsed.querySelector("div.WordSection1") ||
    parsed.querySelector("main.page") ||
    null
  );
}

/**
 * Saved-PDF QR appended before `</body>` sits after the letter wrapper. Paged.js
 * then flows it after all letter pages (often last page). Hoist into the letter
 * root as the first child so it appears on page 1 (all non–special-case previews).
 */
function prependFloatingSavedPdfQrIntoLetterRoot(html: string): string {
  if (typeof window === "undefined" || typeof DOMParser === "undefined") {
    return html;
  }
  const parsed = new DOMParser().parseFromString(html, "text/html");
  const root = letterRootFromParsed(parsed);
  const qrFallback = parsed.body.querySelector(".application-saved-pdf-qr-fallback");
  const qrStandalone = parsed.body.querySelector("#app-saved-pdf-qr");
  let node: Element | null = null;
  if (root && qrFallback && !root.contains(qrFallback)) node = qrFallback;
  else if (root && qrStandalone && !root.contains(qrStandalone)) node = qrStandalone;

  if (!root || !node) return html;

  const wrap = parsed.createElement("div");
  wrap.className = "application-saved-pdf-qr-firstpage-wrap";
  wrap.setAttribute(
    "style",
    "display:flex!important;justify-content:flex-end!important;width:100%!important;margin:0 0 10px 0!important;clear:both!important;"
  );
  node.parentNode?.removeChild(node);
  wrap.appendChild(node);
  root.insertBefore(wrap, root.firstChild);
  return parsed.documentElement.outerHTML;
}

/** Read QR markup that lives outside the letter root (used by Plumber sheet rebuild). */
function getSavedPdfQrMarkupOutsideLetterRoot(html: string): string {
  if (typeof window === "undefined" || typeof DOMParser === "undefined") {
    return "";
  }
  const parsed = new DOMParser().parseFromString(html, "text/html");
  const root = letterRootFromParsed(parsed);
  const qrFallback = parsed.body.querySelector(".application-saved-pdf-qr-fallback");
  const qrStandalone = parsed.body.querySelector("#app-saved-pdf-qr");
  if (!root) return "";
  if (qrFallback && !root.contains(qrFallback)) return qrFallback.outerHTML;
  if (qrStandalone && !root.contains(qrStandalone)) return qrStandalone.outerHTML;
  return "";
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
function injectPaginatedStyles(html: string, templateType?: TemplateType): string {
  html = prependFloatingSavedPdfQrIntoLetterRoot(html);
  const metaHtml = htmlWithoutSavedPdfQrInjection(html);
  const dataUriMatch = metaHtml.match(
    /data:image\/(?:png|jpeg|jpg|webp);base64,[A-Za-z0-9+/=]+/i
  );
  const cssBackgroundImageMatch = metaHtml.match(
    /background-image\s*:\s*url\((['"]?)(.*?)\1\)\s*;/i
  );
  const cssBackgroundShorthandMatch = metaHtml.match(
    /background\s*:\s*[^;]*url\((['"]?)(.*?)\1\)[^;]*;/i
  );
  const letterheadUrl =
    dataUriMatch?.[0] ||
    cssBackgroundImageMatch?.[2] ||
    cssBackgroundShorthandMatch?.[2] ||
    "";
  const isArchitectTemplate = templateType === "Architect";
  const pageMarginTop = isArchitectTemplate ? "72pt" : "95pt";
  const pageMarginBottom = isArchitectTemplate ? "72pt" : "135pt";
  const contentPaddingTop = isArchitectTemplate ? "22pt" : "40pt";
  /* No extra inner gap under body copy; @page margin-bottom still clears letterhead/footer. */
  const contentPaddingBottom = "0";
  const pageMarginLeft = isArchitectTemplate ? "36pt" : "56pt";
  const pageMarginRight = isArchitectTemplate ? "30pt" : "42pt";
  const contentPaddingLeft = isArchitectTemplate ? "36pt" : "56pt";
  const contentPaddingRight = isArchitectTemplate ? "30pt" : "42pt";

  const head = `
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Carlito:wght@400;700&display=swap" rel="stylesheet">
<style>
  /* Letterhead-safe A4 content frame.
     Reserve top/footer zones so flowing content does not overlap the printed
     letterhead branding/footer and naturally continues on page 2. */
  @page {
    size: A4;
    margin: ${pageMarginTop} ${pageMarginRight} ${pageMarginBottom} ${pageMarginLeft};
    @bottom-center {
      content: "Page " counter(page) " of " counter(pages);
      font-family: 'Carlito', 'Calibri', 'Helvetica', sans-serif;
      font-size: 9pt;
      color: rgb(100, 100, 100);
      vertical-align: bottom;
      /* Larger inset lifts “Page X of Y” into the white band above the thick gold bar. */
      padding-bottom: 20pt;
    }
  }
  @page WordSection1 {
    size: A4;
    margin: ${pageMarginTop} ${pageMarginRight} ${pageMarginBottom} ${pageMarginLeft};
    @bottom-center {
      content: "Page " counter(page) " of " counter(pages);
      font-family: 'Carlito', 'Calibri', 'Helvetica', sans-serif;
      font-size: 9pt;
      color: rgb(100, 100, 100);
      vertical-align: bottom;
      padding-bottom: 20pt;
    }
  }

  html, body {
    margin: 0;
    padding: 0;
    background: #f3f4f6;
  }

  /* Normalize root wrapper width only (do not zero out paddings/margins that
     templates may intentionally use for their own sections). */
  div.WordSection1,
  main.page {
    width: 100% !important;
    max-width: 100% !important;
    box-sizing: border-box !important;
  }

  /* Fixed, global page content frame for paged preview (all templates).
     This avoids per-template padding differences between page 1 and 2. */
  .pagedjs_page_content {
    padding: ${contentPaddingTop} ${contentPaddingRight} ${contentPaddingBottom} ${contentPaddingLeft} !important;
    box-sizing: border-box !important;
  }

  .pagedjs_page_content ol:last-child,
  .pagedjs_page_content ul:last-child {
    margin-bottom: 0 !important;
  }

  /* Neutralize template wrapper in paged mode so only the fixed frame above
     controls spacing consistently on every page. */
  .pagedjs_page_content .WordSection1,
  .pagedjs_page_content main.page,
  .pagedjs_page_content div.page {
    margin: 0 !important;
    padding: 0 !important;
    min-height: auto !important;
    width: 100% !important;
  }

  /* Carlito is metric-compatible with Calibri (Google's open-source clone).
     Forcing it everywhere gives consistent line widths regardless of which
     fonts the user has installed locally — without this the browser's
     default fallback (Times/Arial) wraps wider and overflows to 3 pages. */
  body, body * {
    font-family: 'Carlito', 'Calibri', 'Helvetica', sans-serif !important;
  }

  /* Saved PDF QR: use a background div in HTML, not <img> — Word sets img{width:100%}. */
  #app-saved-pdf-qr.application-saved-pdf-qr-pixel,
  div.application-saved-pdf-qr-pixel {
    width: 112px !important;
    height: 112px !important;
    max-width: 112px !important;
    max-height: 112px !important;
    min-width: 112px !important;
    min-height: 112px !important;
    flex: none !important;
    flex-grow: 0 !important;
    flex-shrink: 0 !important;
    align-self: flex-start !important;
    box-sizing: border-box !important;
    display: inline-block !important;
    overflow: hidden !important;
    line-height: 0 !important;
    vertical-align: top !important;
  }
  .application-saved-pdf-qr-fallback {
    width: 132px !important;
    max-width: 132px !important;
    min-width: 0 !important;
    margin-left: auto !important;
    margin-right: 0 !important;
    flex-shrink: 0 !important;
    box-sizing: border-box !important;
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
    background-color: #ffffff;
    ${letterheadUrl ? `background-image: url('${letterheadUrl}');` : ""}
    ${letterheadUrl ? "background-repeat: no-repeat;" : ""}
    ${letterheadUrl ? "background-size: 210mm 297mm;" : ""}
    ${letterheadUrl ? "background-position: top center;" : ""}
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
    margin: 0 auto 16px auto;
    overflow: visible;
  }

  /* Letterhead only on page 1; continuation pages stay plain white. */
  .pagedjs_pages > .pagedjs_page ~ .pagedjs_page {
    background-image: none !important;
  }

  .pagedjs_margin-bottom-center {
    vertical-align: bottom !important;
    box-sizing: border-box !important;
    text-align: center !important;
    overflow: visible !important;
    padding-bottom: 65pt !important;
  }

  /* During print, drop the shadow / background — only the actual content. */
  @media print {
    html, body { background: #ffffff; }
    .pagedjs_pages { padding: 0; }
    .pagedjs_page { box-shadow: none; margin: 0; }
  }
</style>
${SAVED_PDF_QR_LOCK_SCRIPT_PAGED}
<script src="https://unpkg.com/pagedjs/dist/paged.polyfill.js"></script>`;

  let out = html;
  if (/<\/head>/i.test(out)) {
    out = out.replace(/<\/head>/i, `${head}</head>`);
  } else {
    out = head + out;
  }
  if (/<\/body>/i.test(out)) {
    out = out.replace(/<\/body>/i, `${SAVED_PDF_QR_LOCK_STYLE}</body>`);
  } else {
    out = `${out}${SAVED_PDF_QR_LOCK_STYLE}`;
  }
  return out;
}

function injectPlumberPreviewPages(
  html: string,
  ownerLetterheadUrl?: string | null
): string {
  const parsed = new DOMParser().parseFromString(html, "text/html");
  const marker = parsed.querySelector("p.MsoNormal.cc-start") as HTMLElement | null;
  const section = parsed.querySelector("div.WordSection1") as HTMLElement | null;
  if (!marker || !section) return html;

  /** API may append QR before `</body>`; rebuild only serializes section children — preserve for sheet 1. */
  const qrOutsideSection = getSavedPdfQrMarkupOutsideLetterRoot(html);

  const children = Array.from(section.childNodes);
  const markerIndex = children.findIndex((n) => n === marker);
  if (markerIndex < 0) return html;

  const serializeNodes = (nodes: Node[]) =>
    nodes
      .map((n) => {
        if (n.nodeType === Node.TEXT_NODE) return n.textContent || "";
        if (n.nodeType === Node.ELEMENT_NODE) return (n as HTMLElement).outerHTML;
        return "";
      })
      .join("");

  const before = serializeNodes(children.slice(0, markerIndex));
  const after = serializeNodes(children.slice(markerIndex));

  const metaHtml = htmlWithoutSavedPdfQrInjection(html);
  const dataUriMatch = metaHtml.match(
    /data:image\/(?:png|jpeg|jpg|webp);base64,[A-Za-z0-9+/=]+/i
  );
  const cssUrlMatch = metaHtml.match(
    /background-image\s*:\s*url\((['"]?)(.*?)\1\)\s*;/i
  );
  const letterheadUrl =
    ownerLetterheadUrl?.trim() ||
    dataUriMatch?.[0] ||
    cssUrlMatch?.[2] ||
    "";

  const plumberHead = `
<style>
  html, body {
    margin: 0;
    padding: 0;
    background: #f3f4f6;
  }
  .preview-pages {
    padding: 4px 0;
  }
  .preview-sheet {
    width: 210mm;
    min-height: 297mm;
    background: #ffffff;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
    margin: 0 auto 8px auto;
    box-sizing: border-box;
  }
  .preview-sheet--first {
    ${letterheadUrl ? `background-image: url('${letterheadUrl}');` : ""}
    ${letterheadUrl ? "background-repeat: no-repeat;" : ""}
    ${letterheadUrl ? "background-size: 210mm 297mm;" : ""}
    ${letterheadUrl ? "background-position: top center;" : ""}
  }
  .preview-sheet--first,
  .preview-sheet--second {
    position: relative;
    padding: 135pt 42pt 120pt 56pt;
  }
  .preview-sheet-page-num {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0pt;
    width: auto;
    text-align: center;
    font-family: 'Carlito', 'Calibri', 'Helvetica', sans-serif;
    font-size: 9pt;
    color: rgb(100, 100, 100);
    pointer-events: none;
    z-index: 2;
  }
  .preview-sheet--first .WordSection1,
  .preview-sheet--second .WordSection1 {
    padding: 0 !important;
    margin: 0 !important;
    min-height: auto !important;
    width: 100% !important;
  }
  #app-saved-pdf-qr.application-saved-pdf-qr-pixel,
  div.application-saved-pdf-qr-pixel {
    width: 112px !important;
    height: 112px !important;
    max-width: 112px !important;
    max-height: 112px !important;
    flex: none !important;
    align-self: flex-start !important;
    box-sizing: border-box !important;
    overflow: hidden !important;
  }
  .application-saved-pdf-qr-fallback {
    width: 132px !important;
    max-width: 132px !important;
    margin-left: auto !important;
  }
  @media print {
    html, body { background: #ffffff; }
    .preview-pages { padding: 0; }
    .preview-sheet { box-shadow: none; margin: 0; }
  }
</style>`;

  const sectionClass = section.className || "WordSection1";
  const bodyAttrs = Array.from(parsed.body.attributes)
    .map((attr) => `${attr.name}="${attr.value}"`)
    .join(" ");
  const bodyOpen = bodyAttrs ? `<body ${bodyAttrs}>` : "<body>";

  const qrBlock =
    qrOutsideSection !== ""
      ? `<div class="application-saved-pdf-qr-firstpage-wrap" style="display:flex!important;justify-content:flex-end!important;width:100%!important;margin-top:12px!important;clear:both!important;">${qrOutsideSection}</div>`
      : "";

  return `<html><head>${parsed.head.innerHTML}${plumberHead}</head>${bodyOpen}
<div class="preview-pages">
  <div class="preview-sheet preview-sheet--first"><div class="${sectionClass}">${before}</div>${qrBlock}<div class="preview-sheet-page-num" aria-hidden="true">Page 1 of 2</div></div>
  <div class="preview-sheet preview-sheet--second"><div class="${sectionClass}">${after}</div><div class="preview-sheet-page-num" aria-hidden="true">Page 2 of 2</div></div>
</div>
${SAVED_PDF_QR_LOCK_STYLE}
${SAVED_PDF_QR_LOCK_SCRIPT_INLINE}
</body></html>`;
}

/**
 * Global HTML preview path for all consultant template types.
 * Native browser text = razor-sharp preview at any zoom, instant load.
 *
 * Saved-PDF QR (optional): in Storage bucket `Application_Templates` HTML, place
 * `$project_Saved_Pdf_QR` (see `PROJECT_SAVED_PDF_QR_SENTINEL` in
 * `app/api/application-preview-html/constants.ts`) beside the client/owner block, e.g.:
 * `<div style="display:flex;align-items:flex-start;gap:12px;justify-content:space-between">`
 * inner column for client tokens, then a column with only `$project_Saved_Pdf_QR`.
 * The API replaces the sentinel with a QR image of `application_urls[templateType]`.
 */
export async function generateApplicationPreviewHtml(
  fields: TemplateFields,
  templateType: TemplateType,
  source?: ApplicationPreviewSource
): Promise<string> {
  const rawHtml = await fetchApplicationPreviewHtmlRaw(fields, templateType, source);
  if (templateType === "Plumber") {
    return injectPlumberPreviewPages(rawHtml, source?.ownerLetterheadUrl);
  }
  return injectPaginatedStyles(rawHtml, templateType);
}

export async function fetchApplicationPreviewHtmlRaw(
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

  if (response.ok) return await response.text();

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
  // Use the exact same HTML contract as preview (Paged.js wrappers/styles),
  // then let Chromium print that final DOM.
  const html = await generateApplicationPreviewHtml(fields, templateType, source);
  const response = await fetch("/api/application-preview-pdf", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ html, templateType }),
  });
  const contentType = response.headers.get("content-type") || "";
  if (response.ok && contentType.includes("application/pdf")) {
    return await response.blob();
  }
  const payload = await response.json().catch(() => null);
  const message =
    typeof payload?.error === "string"
      ? payload.error
      : `Chromium PDF route failed (${response.status}).`;
  throw new Error(message);
}

