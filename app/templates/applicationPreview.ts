"use client";

import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { type TemplateFields, type TemplateType } from "./templateGenerators";

type ApplicationPreviewSource = {
  selectedApplication?: string | null;
  applicationNo?: string | null;
  applicationCreatedAt?: string | null;
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
    CouncilRegNo: "-",
    RegValidityDate: "-",
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
  const divisionVillage = source?.projectData?.save_plot_details?.villageName?.trim();
  const wardForProjectToken = source?.projectData?.save_plot_details?.ward?.trim();
  const documentNumber = source?.applicationNo?.trim();
  const csCtsToken = formatCsCtsSurveyToken(source).trim();
  const csCtsNos = csCtsToken || undefined;

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
      key: "project_date_generation",
      pageIndex: 0,
      x: 452,
      y: 649,
      width: 170,
      height: 14,
      fontSize: 9,
      lineHeight: 11,
    },
    {
      key: "project_Document_Number",
      pageIndex: 0,
      x: 100,
      y: 649,
      width: 220,
      height: 14,
      fontSize: 9,
      lineHeight: 11,
    },
    {
      key: "project_Name_Architect/L.S",
      pageIndex: 0,
      x: 145,
      y: 624,
      width: 360,
      height: 14,
      fontSize: 9,
      lineHeight: 11,
    },
    {
      key: "project_Company_Name_Architect/L.S",
      pageIndex: 0,
      x: 145,
      y: 608,
      width: 360,
      height: 14,
      fontSize: 9,
      lineHeight: 11,
    },
    {
      key: "project_Address_line1_Architect/L.S",
      pageIndex: 0,
      x: 145,
      y: 592,
      width: 360,
      height: 14,
      fontSize: 9,
      lineHeight: 11,
    },
    {
      key: "project_Address_line2_Architect/L.S",
      pageIndex: 0,
      x: 145,
      y: 576,
      width: 360,
      height: 14,
      fontSize: 9,
      lineHeight: 11,
    },
    {
      key: "project_Address_line3Architect/L.S",
      pageIndex: 0,
      x: 145,
      y: 560,
      width: 360,
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
 * Primary path: DOCX placeholders replaced server-side, then converted to PDF via LibreOffice
 * (local `soffice` or remote Gotenberg — see `/api/application-preview-docx`).
 * On Vercel, set DOCX_CONVERTER_URL to your self-hosted Gotenberg `/forms/libreoffice/convert`.
 *
 * Development fallback: if conversion is unavailable, uses static PDF + overlay (lower fidelity).
 */
export async function generateApplicationPreviewPdf(
  fields: TemplateFields,
  templateType: TemplateType,
  source?: ApplicationPreviewSource
): Promise<Blob> {
  const formValues = mapToPdfFieldValues(fields, source);

  const docxResponse = await fetch("/api/application-preview-docx", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      templateType,
      fields: formValues,
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

