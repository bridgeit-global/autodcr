"use client";

import { formatCoaExpiryDisplay } from "@/app/utils/coaMetadataDisplay";
import { supabase } from "@/app/utils/supabase";
import { type TemplateFields, type TemplateType } from "./templateGenerators";

type ApplicationPreviewSource = {
  selectedApplication?: string | null;
  applicationNo?: string | null;
  applicationCreatedAt?: string | null;
  /** COA registration no. from `auth.users` → `raw_user_meta_data` / session `user_metadata.coa_reg_no`. */
  coaRegNo?: string | null;
  /** COA expiry as stored (e.g. ISO `YYYY-MM-DD` in `coa_expiry_date`). */
  coaExpiryDate?: string | null;
  consultantName?: string | null;
  consultantCompanyName?: string | null;
  clientCompanyName?: string | null;
  clientName?: string | null;
  clientCompanyDesignation?: string | null;
  ownerDebug?: unknown;
  consultantAddressLine1?: string | null;
  consultantAddressLine2?: string | null;
  consultantAddressLine3?: string | null;
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
  line1: "Dy. Chief Engineer, Building Proposals (W. S. - I)",
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
  if (value.includes("structural")) return "Structural Engineer";
  if (value.includes("plumber")) return "Plumber";
  if (value.includes("site supervisor")) return "Site Supervisor";
  if (value.includes("horticulturist")) return "Horticulturist";
  return "Architect Licensed Surveyor";
}

function templateConsultantApplicantKeywords(templateType: TemplateType): string[] {
  switch (templateType) {
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
    const t = (a.applicantType || "").toLowerCase();
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

function splitAddressLines(address?: string, maxLines = 3): string[] {
  const raw = (address || "").trim();
  if (!raw) return Array.from({ length: maxLines }, () => "");
  const parts = raw
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);

  if (parts.length >= maxLines) {
    const head = parts.slice(0, maxLines - 1);
    const tail = parts.slice(maxLines - 1).join(", ");
    return [...head, tail];
  }

  return [...parts, ...Array.from({ length: maxLines - parts.length }, () => "")];
}

export function mapApplicationPreviewFields(source: ApplicationPreviewSource): TemplateFields {
  const projectInfo = source.projectData?.project_info || {};
  const savePlot = source.projectData?.save_plot_details || {};
  const joined = joinProposedCsOrCtsNos(source).trim();
  const ctsNo = joined ? bracketSurveyNumberList(joined) : source.applicationNo || "-";

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
    CouncilRegNo: source.coaRegNo?.trim() || "-",
    RegValidityDate: formatCoaExpiryDisplay(source.coaExpiryDate) || "-",
    // TODO: Map final backend fields once mapping contract is finalized:
    // - project_Proposal_Number
    // - consultant registration and validity
    // - office/taluka/district authoritative values
  };
}

export function mapToPdfFieldValues(
  fields: TemplateFields,
  source?: ApplicationPreviewSource
): Record<string, string | undefined> {
  const applicants = source?.projectData?.applicant_details?.applicants || [];
  const ownerApplicant = applicants.find(
    (applicant) => (applicant.applicantType || applicant.applicant_type || "").toLowerCase().includes("owner")
  );
  const architectApplicant = applicants.find(
    (applicant) => (applicant.applicantType || applicant.applicant_type || "").toLowerCase().includes("architect")
  );
  const architectName = architectApplicant?.name?.trim() || source?.consultantName?.trim() || "";
  const architectAddressLine1 =
    source?.consultantAddressLine1?.trim() || "";
  const architectAddressLine2 =
    source?.consultantAddressLine2?.trim() || "";
  const architectAddressLine3 =
    source?.consultantAddressLine3?.trim() || "";
  const proposalNumber = source?.projectData?.project_info?.proposalNo?.trim();
  const planningAuthority =
    source?.projectData?.save_plot_details?.planningAuthority?.trim() || "BMC";
  const propertyAddress = source?.projectData?.project_info?.propertyAddress?.trim();
  const street = source?.projectData?.save_plot_details?.roadName?.trim();
  const divisionVillage = source?.projectData?.save_plot_details?.villageName?.trim();
  const wardForProjectToken = source?.projectData?.save_plot_details?.ward?.trim();
  const regionForProjectToken = source?.projectData?.save_plot_details?.region?.trim();
  const documentNumber = source?.applicationNo?.trim();
  const csCtsToken = formatCsCtsSurveyToken(source).trim();
  const csCtsNos = csCtsToken || undefined;
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
    : csCtsNos;
  const architectCoaRegNo = source?.coaRegNo?.trim() ?? "";
  const architectValidityDisplay = formatCoaExpiryDisplay(source?.coaExpiryDate) ?? "";
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
      : "";
  const buildingProposalBaseDesignation = "The Executive Engineer (E.S.) - I";

  return {
    CurrentDate: fields.CurrentDate,
    WardName: fields.WardName,
    ZoneName: fields.ZoneName,
    OfficeAddress: fields.OfficeAddress,
    CTSNo: fields.CTSNo,
    VillageName: fields.VillageName,
    TalukaName: fields.TalukaName,
    DistrictName: fields.DistrictName,
    RoadWidth: fields.RoadWidth,
    RoadName: fields.RoadName,
    MainRoadWidth: fields.MainRoadWidth,
    MainRoadName: fields.MainRoadName,
    ApplicantName: fields.ApplicantName,
    FirmName: fields.FirmName,
    ConsultantName: fields.ConsultantName,
    ConsultantType: fields.ConsultantType,
    CouncilRegNo: fields.CouncilRegNo,
    RegValidityDate: fields.RegValidityDate,
    project_date_generation: fields.CurrentDate,
    // Title and consultant labels for architect template.
    "project_Consultant_Architect/L.S._Type": "Architect",
    "project_Consultant_Architect/L.S.": "Architect",
    // Subject line: CTS/CS survey numbers from project save_plot_details (same as CTS No. in Project Details).
    "project_CS/CTSNos": csCtsNosSubjectDisplay,
    "project_CS/CTSNos.": csCtsNosSubjectDisplay,
    // Village/Division line comes directly from Project Details form field value.
    "project_Division/Village": divisionVillage || undefined,
    project_Street: street || undefined,
    // Ward line (e.g. "L Ward") — same as Project Details → Ward.
    "project_Ward.": wardForProjectToken || undefined,
    // Re line format in template: "<Authority> Proposal No. <reference-no>".
    project_Planning_Authority: planningAuthority,
    project_Proposal_Number: proposalNumber || undefined,
    project_Document_Number: documentNumber || undefined,
    "project_Name_Architect/L.S": architectName || undefined,
    "project_Name_Architect/L.S.": architectName || undefined,
    "project_Company_Name_Architect/L.S":
      source?.consultantCompanyName?.trim() || undefined,
    "project_Company_Name_Architect/L.S.":
      source?.consultantCompanyName?.trim() || undefined,
    // Phase-1 approved mapping:
    // Architect/L.S section uses Architect only for this template run.
    "project_Address_line1_Architect/L.S": architectAddressLine1 || undefined,
    "project_Address_line2_Architect/L.S": architectAddressLine2,
    "project_Address_line3Architect/L.S": architectAddressLine3,
    // Building Proposal address lines from region/ward mapping.
    "project_ addressline1_BuildingProposal": buildingProposalAddress?.line1 || "",
    "project_ addressline2_BuildingProposal": buildingProposalAddress?.line2 || "",
    "project_ addressline3_BuildingProposal": buildingProposalAddress?.line3 || "",
    // Always send a string: JSON.stringify drops `undefined`, so the API would skip replacement and leave `$project_RegNo_...` in the DOCX.
    "project_RegNo_Architect/L.S.": architectCoaRegNo,
    // Template variants (same value).
    "project_RegNo_Architect/L.S": architectCoaRegNo,
    // COA validity (from `coa_expiry_date`); always string so JSON body includes the key.
    "project_Validity_Architect/L.S.": architectValidityDisplay,
    "project_Validity_Architect/L.S": architectValidityDisplay,
    "project_Client_Company_Name": clientCompanyName,
    "project_Client_Company_Designation": displayClientCompanyDesignation,
    "project_Client_Name": clientName,
    project_BuildingProposal_BaseDesignation: buildingProposalBaseDesignation,
    project_BuildingProposal_OfficerDesignation: officerDesignationDisplay,
    project_BuildingProposal_ZoneSuffix: officerZoneSuffix,
  };
}

/**
 * Primary path: DOCX placeholders replaced server-side, then converted to PDF.
 *
 * Converter order in `/api/application-preview-docx`:
 * `docx-pdf-converter` package first, then external converter (if configured), then local LibreOffice.
 * Other template types use DOCX placeholders replaced server-side, then converted to PDF via LibreOffice
 * (local `soffice` or remote Gotenberg — see `/api/application-preview-docx`).
 * On Vercel, set DOCX_CONVERTER_URL to your self-hosted Gotenberg `/forms/libreoffice/convert`.
 */
export async function generateApplicationPreviewPdf(
  fields: TemplateFields,
  templateType: TemplateType,
  source?: ApplicationPreviewSource
): Promise<Blob> {
  const formValues = mapToPdfFieldValues(fields, source);

  if (templateType === "Architect Licensed Surveyor") {
    const htmlResponse = await fetch("/api/application-preview-html", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        templateType,
        fields: formValues,
        ...(source?.ownerDebug ? { owner_debug: source.ownerDebug } : {}),
      }),
    });

    if (htmlResponse.ok) {
      return htmlResponse.blob();
    }

    const htmlPayload = await htmlResponse.json().catch(() => null);
    const htmlMessage =
      typeof htmlPayload?.error === "string"
        ? htmlPayload.error
        : `HTML preview conversion failed (${htmlResponse.status}).`;
    throw new Error(htmlMessage);
  }

  await supabase.auth.refreshSession();
  const { data: sessionData } = await supabase.auth.getSession();
  const access_token = sessionData.session?.access_token;

  const docxResponse = await fetch("/api/application-preview-docx", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      templateType,
      fields: formValues,
      ...(access_token ? { access_token } : {}),
      ...(source?.consultantLookupUserIds?.length
        ? { consultant_lookup_user_ids: source.consultantLookupUserIds }
        : {}),
    }),
  });

  if (docxResponse.ok) {
    return docxResponse.blob();
  }

  const payload = await docxResponse.json().catch(() => null);
  const message =
    typeof payload?.error === "string"
      ? payload.error
      : `Preview conversion failed (${docxResponse.status}).`;

  throw new Error(message);
}

