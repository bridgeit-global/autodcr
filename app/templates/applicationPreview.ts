"use client";

import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
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
        name?: string;
        registrationNumber?: string;
        registrationNo?: string;
        residentialAddress?: string;
      }>;
    } | null;
  } | null;
};

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
  const architectApplicant = applicants.find(
    (applicant) => (applicant.applicantType || "").toLowerCase().includes("architect")
  );
  const architectName = architectApplicant?.name?.trim();
  const architectAddress = architectApplicant?.residentialAddress?.trim();
  const proposalNumber = source?.projectData?.project_info?.proposalNo?.trim();
  const propertyAddress = source?.projectData?.project_info?.propertyAddress?.trim();
  const street = source?.projectData?.save_plot_details?.roadName?.trim();
  const divisionVillage = source?.projectData?.save_plot_details?.villageName?.trim();
  const wardForProjectToken = source?.projectData?.save_plot_details?.ward?.trim();
  const documentNumber = source?.applicationNo?.trim();
  const csCtsToken = formatCsCtsSurveyToken(source).trim();
  const csCtsNos = csCtsToken || undefined;
  const architectCoaRegNo = source?.coaRegNo?.trim() ?? "";
  const architectValidityDisplay = formatCoaExpiryDisplay(source?.coaExpiryDate) ?? "";
  const clientName = fields.ApplicantName?.trim() || source?.projectData?.title?.trim() || "-";
  const clientCompanyName = fields.FirmName?.trim() || source?.projectData?.title?.trim() || "-";
  const clientCompanyDesignation = "Authorized Signatory";
  const buildingProposalDesignation =
    wardForProjectToken ? `The Executive Engineer (${wardForProjectToken}) Ward` : "The Executive Engineer (Ward)";

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
    // Title line: "1. APPOINTMENT LETTER FOR ARCHITECT" (this template is architect-only)
    "project_Consultant_Architect/L.S._Type": "ARCHITECT",
    "project_Consultant_Architect/L.S.": "ARCHITECT",
    // Subject line: CTS/CS survey numbers from project save_plot_details (same as CTS No. in Project Details).
    "project_CS/CTSNos": csCtsNos,
    "project_CS/CTSNos.": csCtsNos,
    // Village/Division line comes directly from Project Details form field value.
    "project_Division/Village": divisionVillage || undefined,
    project_Street: street || undefined,
    // Ward line (e.g. "L Ward") — same as Project Details → Ward.
    "project_Ward.": wardForProjectToken || undefined,
    // Proposal number from project_info (e.g. BMC/123/WS/337).
    project_Proposal_Number: proposalNumber || undefined,
    project_Document_Number: documentNumber || undefined,
    "project_Name_Architect/L.S": architectName || undefined,
    "project_Name_Architect/L.S.": architectName || undefined,
    "project_Company_Name_Architect/L.S": architectName || undefined,
    "project_Company_Name_Architect/L.S.": architectName || undefined,
    // Phase-1 approved mapping:
    // Architect/L.S section uses Architect only for this template run.
    "project_Address_line1_Architect/L.S": architectAddress || undefined,
    "project_Address_line2_Architect/L.S": "",
    "project_Address_line3Architect/L.S": "",
    // Building Proposal address lines from property address (line1 only).
    "project_ addressline1_BuildingProposal": propertyAddress || undefined,
    "project_ addressline2_BuildingProposal": "",
    // Always send a string: JSON.stringify drops `undefined`, so the API would skip replacement and leave `$project_RegNo_...` in the DOCX.
    "project_RegNo_Architect/L.S.": architectCoaRegNo,
    // Template variants (same value).
    "project_RegNo_Architect/L.S": architectCoaRegNo,
    // COA validity (from `coa_expiry_date`); always string so JSON body includes the key.
    "project_Validity_Architect/L.S.": architectValidityDisplay,
    "project_Validity_Architect/L.S": architectValidityDisplay,
    "project_Client_Company_Name": clientCompanyName,
    "project_Client_Company_Designation": clientCompanyDesignation,
    "project_Client_Name": clientName,
    project_BuildingProposal_OfficerDesignation: buildingProposalDesignation,
  };
}

async function loadTemplatePdfBytes(templateType: TemplateType): Promise<ArrayBuffer> {
  const response = await fetch(
    `/api/application-preview-template?templateType=${encodeURIComponent(templateType)}`
  );
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new Error(payload?.error || `Failed to load preview PDF template (${response.status})`);
  }
  return response.arrayBuffer();
}

type OverlaySpec = {
  key: string;
  pageIndex: number;
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize: number;
  lineHeight: number;
};

const OVERLAY_BASE_PAGE_WIDTH = 612;
const OVERLAY_BASE_PAGE_HEIGHT = 792;

function drawWrappedText(page: PDFPage, font: PDFFont, text: string, spec: OverlaySpec): void {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return;

  const lines: string[] = [];
  let line = "";
  words.forEach((word) => {
    const candidate = line ? `${line} ${word}` : word;
    const candidateWidth = font.widthOfTextAtSize(candidate, spec.fontSize);
    if (candidateWidth <= spec.width || !line) {
      line = candidate;
    } else {
      lines.push(line);
      line = word;
    }
  });
  if (line) lines.push(line);

  const maxLines = Math.max(1, Math.floor(spec.height / spec.lineHeight));
  lines.slice(0, maxLines).forEach((row, idx) => {
    page.drawText(row, {
      x: spec.x,
      y: spec.y - idx * spec.lineHeight,
      size: spec.fontSize,
      font,
      color: rgb(0, 0, 0),
    });
  });
}

async function fillStaticTemplateOverlay(
  pdfDoc: PDFDocument,
  values: Record<string, string | undefined>
): Promise<void> {
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const overlays: OverlaySpec[] = [
    {
      key: "project_Consultant_Architect/L.S._Type",
      pageIndex: 0,
      x: 278,
      y: 722,
      width: 280,
      height: 14,
      fontSize: 11,
      lineHeight: 12,
    },
    {
      key: "project_date_generation",
      pageIndex: 0,
      x: 410,
      y: 666,
      width: 150,
      height: 14,
      fontSize: 9,
      lineHeight: 11,
    },
    {
      key: "project_Document_Number",
      pageIndex: 0,
      x: 58,
      y: 666,
      width: 190,
      height: 14,
      fontSize: 9,
      lineHeight: 11,
    },
    {
      key: "project_Name_Architect/L.S",
      pageIndex: 0,
      x: 66,
      y: 640,
      width: 260,
      height: 14,
      fontSize: 9,
      lineHeight: 11,
    },
    {
      key: "project_Company_Name_Architect/L.S",
      pageIndex: 0,
      x: 66,
      y: 622,
      width: 380,
      height: 14,
      fontSize: 9,
      lineHeight: 11,
    },
    {
      key: "project_Address_line1_Architect/L.S",
      pageIndex: 0,
      x: 66,
      y: 604,
      width: 420,
      height: 14,
      fontSize: 9,
      lineHeight: 11,
    },
    {
      key: "project_Address_line2_Architect/L.S",
      pageIndex: 0,
      x: 66,
      y: 586,
      width: 420,
      height: 14,
      fontSize: 9,
      lineHeight: 11,
    },
    {
      key: "project_Address_line3Architect/L.S",
      pageIndex: 0,
      x: 66,
      y: 568,
      width: 420,
      height: 14,
      fontSize: 9,
      lineHeight: 11,
    },
    {
      key: "project_CS/CTSNos.",
      pageIndex: 0,
      x: 318,
      y: 548,
      width: 180,
      height: 14,
      fontSize: 9,
      lineHeight: 11,
    },
    {
      key: "project_Division/Village",
      pageIndex: 0,
      x: 496,
      y: 548,
      width: 110,
      height: 14,
      fontSize: 9,
      lineHeight: 11,
    },
    {
      key: "project_Street",
      pageIndex: 0,
      x: 66,
      y: 530,
      width: 270,
      height: 14,
      fontSize: 9,
      lineHeight: 11,
    },
    {
      key: "project_Ward.",
      pageIndex: 0,
      x: 348,
      y: 530,
      width: 130,
      height: 14,
      fontSize: 9,
      lineHeight: 11,
    },
    {
      key: "project_Proposal_Number",
      pageIndex: 0,
      x: 52,
      y: 512,
      width: 300,
      height: 14,
      fontSize: 9,
      lineHeight: 11,
    },
    {
      key: "project_Consultant_Architect/L.S.",
      pageIndex: 0,
      x: 200,
      y: 460,
      width: 190,
      height: 14,
      fontSize: 9,
      lineHeight: 11,
    },
    {
      key: "project_Client_Company_Name",
      pageIndex: 1,
      x: 95,
      y: 335,
      width: 220,
      height: 14,
      fontSize: 9,
      lineHeight: 11,
    },
    {
      key: "project_Client_Company_Designation",
      pageIndex: 1,
      x: 35,
      y: 319,
      width: 220,
      height: 14,
      fontSize: 9,
      lineHeight: 11,
    },
    {
      key: "project_Client_Name",
      pageIndex: 1,
      x: 35,
      y: 303,
      width: 220,
      height: 14,
      fontSize: 9,
      lineHeight: 11,
    },
    {
      key: "project_Company_Name_Architect/L.S",
      pageIndex: 1,
      x: 96,
      y: 272,
      width: 235,
      height: 14,
      fontSize: 9,
      lineHeight: 11,
    },
    {
      key: "project_Consultant_Architect/L.S.",
      pageIndex: 1,
      x: 35,
      y: 256,
      width: 240,
      height: 14,
      fontSize: 9,
      lineHeight: 11,
    },
    {
      key: "project_Name_Architect/L.S.",
      pageIndex: 1,
      x: 35,
      y: 240,
      width: 240,
      height: 14,
      fontSize: 9,
      lineHeight: 11,
    },
    {
      key: "project_RegNo_Architect/L.S.",
      pageIndex: 1,
      x: 35,
      y: 224,
      width: 240,
      height: 14,
      fontSize: 9,
      lineHeight: 11,
    },
    {
      key: "project_Validity_Architect/L.S.",
      pageIndex: 1,
      x: 35,
      y: 208,
      width: 240,
      height: 14,
      fontSize: 9,
      lineHeight: 11,
    },
    {
      key: "project_BuildingProposal_OfficerDesignation",
      pageIndex: 1,
      x: 35,
      y: 176,
      width: 260,
      height: 14,
      fontSize: 9,
      lineHeight: 11,
    },
    {
      key: "project_ addressline1_BuildingProposal",
      pageIndex: 1,
      x: 246,
      y: 214,
      width: 270,
      height: 14,
      fontSize: 9,
      lineHeight: 11,
    },
    {
      key: "project_ addressline2_BuildingProposal",
      pageIndex: 1,
      x: 246,
      y: 198,
      width: 270,
      height: 14,
      fontSize: 9,
      lineHeight: 11,
    },
  ];

  overlays.forEach((spec) => {
    const value = values[spec.key];
    if (value === undefined) return;
    const page = pdfDoc.getPages()[spec.pageIndex];
    if (!page) return;

    const scaleX = page.getWidth() / OVERLAY_BASE_PAGE_WIDTH;
    const scaleY = page.getHeight() / OVERLAY_BASE_PAGE_HEIGHT;
    const scaledSpec: OverlaySpec = {
      ...spec,
      x: spec.x * scaleX,
      y: spec.y * scaleY,
      width: spec.width * scaleX,
      height: spec.height * scaleY,
      fontSize: Math.max(8, spec.fontSize * Math.min(scaleX, scaleY)),
      lineHeight: Math.max(10, spec.lineHeight * scaleY),
    };

    page.drawRectangle({
      x: scaledSpec.x - 6,
      y: scaledSpec.y - scaledSpec.height - 2,
      width: scaledSpec.width + 30,
      height: scaledSpec.height + 10,
      color: rgb(1, 1, 1),
      borderWidth: 0,
    });

    if (value.trim()) {
      drawWrappedText(page, font, value, scaledSpec);
    }
  });
}

async function generatePreviewPdfOverlayFallback(
  templateType: TemplateType,
  formValues: Record<string, string | undefined>
): Promise<Blob> {
  const templatePdfBytes = await loadTemplatePdfBytes(templateType);
  const pdfDoc = await PDFDocument.load(templatePdfBytes);

  if (templateType === "Architect Licensed Surveyor") {
    await fillStaticTemplateOverlay(pdfDoc, formValues);
  }

  const bytes = await pdfDoc.save();
  return new Blob([new Uint8Array(bytes)], { type: "application/pdf" });
}

/**
 * Primary path: DOCX placeholders replaced server-side, then converted to PDF.
 *
 * Converter order in `/api/application-preview-docx`:
 * `docx-pdf-converter` package first, then external converter (if configured), then local LibreOffice.
 *
 * Development fallback here: if conversion is unavailable, uses static PDF + overlay (lower fidelity).
 *
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

  if (process.env.NODE_ENV === "development") {
    console.warn(
      "[application preview] DOCX→PDF unavailable, using PDF overlay fallback:",
      message
    );
    return generatePreviewPdfOverlayFallback(templateType, formValues);
  }

  throw new Error(message);
}

