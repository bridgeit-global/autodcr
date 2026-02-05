import { PDFDocument, StandardFonts, PDFPage, rgb } from "pdf-lib";

export type TemplateFields = {
  CurrentDate: string;
  WardName: string;
  ZoneName: string;
  OfficeAddress: string;
  CTSNo: string;
  VillageName: string;
  TalukaName: string;
  DistrictName: string;
  RoadWidth: string;
  RoadName: string;
  MainRoadWidth: string;
  MainRoadName: string;
  ApplicantName: string;
  FirmName: string;
  ConsultantName: string;
  ConsultantType: string;
  CouncilRegNo: string;
  RegValidityDate: string;
};

export type TemplateGenerator = (
  pdfDoc: PDFDocument,
  page: PDFPage,
  fields: TemplateFields,
  font: any,
  boldFont: any
) => Promise<number>; // Returns final Y position

// Helper function to add text with word wrap and field highlighting
const addText = (
  page: PDFPage,
  text: string,
  x: number,
  y: number,
  size: number,
  font: any,
  boldFont: any,
  isBold: boolean,
  maxWidth?: number,
  bottomMargin: number = 120,
  fieldsToHighlight?: TemplateFields
): number => {
  if (y < bottomMargin) {
    return y;
  }

  const currentFont = isBold ? boldFont : font;
  const lineHeight = 14;
  
  // Get field values to highlight - get unique non-empty values
  const fieldValues: string[] = [];
  if (fieldsToHighlight) {
    const seen = new Set<string>();
    Object.values(fieldsToHighlight).forEach((value) => {
      if (value && typeof value === 'string' && value.trim().length > 0) {
        const trimmed = value.trim();
        if (!seen.has(trimmed)) {
          seen.add(trimmed);
          fieldValues.push(trimmed);
        }
      }
    });
  }
  
  // Helper function to draw a line with highlights - search for fields directly in the line
  const drawLineWithHighlights = (lineText: string, lineX: number, lineY: number) => {
    if (lineY < bottomMargin) return;
    
    if (!fieldsToHighlight || fieldValues.length === 0) {
      // No highlighting needed
      page.drawText(lineText, { x: lineX, y: lineY, size, font: currentFont });
      return;
    }
    
    // Find all field occurrences directly in this line
    const lineOccurrences: { start: number; end: number; value: string }[] = [];
    
    // Sort field values by length (longest first) to avoid partial matches
    const sortedFields = [...fieldValues].sort((a, b) => b.length - a.length);
    
    sortedFields.forEach((fieldValue) => {
      if (!fieldValue || fieldValue.length === 0) return;
      
      let searchIndex = 0;
      while (true) {
        const index = lineText.indexOf(fieldValue, searchIndex);
        if (index === -1) break;
        lineOccurrences.push({
          start: index,
          end: index + fieldValue.length,
          value: fieldValue,
        });
        searchIndex = index + 1;
      }
    });
    
    // Sort by start position
    lineOccurrences.sort((a, b) => a.start - b.start);
    
    // Remove overlapping occurrences (keep longest)
    const nonOverlapping: typeof lineOccurrences = [];
    lineOccurrences.forEach((occ) => {
      const overlaps = nonOverlapping.some(
        (existing) =>
          (occ.start >= existing.start && occ.start < existing.end) ||
          (occ.end > existing.start && occ.end <= existing.end) ||
          (occ.start < existing.start && occ.end > existing.end)
      );
      if (!overlaps) {
        nonOverlapping.push(occ);
      }
    });
    
    if (nonOverlapping.length === 0) {
      // No fields in this line
      page.drawText(lineText, { x: lineX, y: lineY, size, font: currentFont });
      return;
    }
    
    // Draw text with highlights
    let currentX = lineX;
    let textIndex = 0;
    
    nonOverlapping.forEach((occ) => {
      // Draw text before highlight
      if (occ.start > textIndex) {
        const beforeText = lineText.substring(textIndex, occ.start);
        const beforeWidth = currentFont.widthOfTextAtSize(beforeText, size);
        page.drawText(beforeText, { x: currentX, y: lineY, size, font: currentFont });
        currentX += beforeWidth;
      }
      
      // Draw text in bold (no highlighting rectangle)
      const fieldWidth = boldFont.widthOfTextAtSize(occ.value, size);
      page.drawText(occ.value, { x: currentX, y: lineY, size, font: boldFont });
      currentX += fieldWidth;
      textIndex = occ.end;
    });
    
    // Draw remaining text
    if (textIndex < lineText.length) {
      const afterText = lineText.substring(textIndex);
      page.drawText(afterText, { x: currentX, y: lineY, size, font: currentFont });
    }
  };
  
  if (maxWidth) {
    // Word wrap
    const words = text.split(" ");
    let line = "";
    let currentY = y;
    let lines: { text: string; y: number }[] = [];

    for (let i = 0; i < words.length; i++) {
      const testLine = line + words[i] + " ";
      const width = currentFont.widthOfTextAtSize(testLine, size);

      if (width > maxWidth && i > 0) {
        lines.push({ text: line.trim(), y: currentY });
        line = words[i] + " ";
        currentY -= lineHeight;
      } else {
        line = testLine;
      }
    }
    if (line.trim()) {
      lines.push({ text: line.trim(), y: currentY });
    }

    // Draw lines with highlights - search for fields in each line
    lines.forEach((lineInfo) => {
      drawLineWithHighlights(lineInfo.text, x, lineInfo.y);
    });

    return currentY;
  } else {
    drawLineWithHighlights(text, x, y);
    return y;
  }
};

// Template Generator for Architect Licensed Surveyor
export const generateArchitectLicensedSurveyor: TemplateGenerator = async (
  pdfDoc,
  page,
  fields,
  font,
  boldFont
) => {
  const margin = 72;
  const pageWidth = 612 - margin * 2;
  const bottomMargin = 120;
  const lineHeight = 14;
  let yPosition = 650;

  // Date - highlight CurrentDate
  yPosition = addText(page, `Date: ${fields.CurrentDate}`, margin, yPosition, 12, font, boldFont, false, undefined, bottomMargin, fields);
  yPosition -= lineHeight * 2;

  // To section
  yPosition = addText(page, "To,", margin, yPosition, 12, font, boldFont, false, undefined, bottomMargin);
  yPosition -= lineHeight;
  yPosition = addText(
    page,
    `The Assistant Engineer (Survey) - ${fields.WardName}`,
    margin,
    yPosition,
    12,
    font,
    boldFont,
    false,
    undefined,
    bottomMargin,
    fields
  );
  yPosition -= lineHeight;
  yPosition = addText(
    page,
    `O/o The Deputy Chief Engineer (Building Proposal) ${fields.ZoneName},`,
    margin,
    yPosition,
    12,
    font,
    boldFont,
    false,
    undefined,
    bottomMargin,
    fields
  );
  yPosition -= lineHeight;
  yPosition = addText(
    page,
    "Brihanmumbai Municipal Corporation,",
    margin,
    yPosition,
    12,
    font,
    boldFont,
    false,
    undefined,
    bottomMargin
  );
  yPosition -= lineHeight;
  yPosition = addText(page, fields.OfficeAddress, margin, yPosition, 12, font, boldFont, false, undefined, bottomMargin, fields);
  yPosition -= lineHeight * 2;

  // Subject - highlight all dynamic fields
  const subjectText = `Subject: Appointment of Architect & Licensed Surveyor for plot bearing C.T.S. No. ${fields.CTSNo} of Village - ${fields.VillageName}, Taluka - ${fields.TalukaName}, District - ${fields.DistrictName}, situated at ${fields.RoadWidth} wide ${fields.RoadName}, off ${fields.MainRoadWidth} wide ${fields.MainRoadName}, within BMC Limits of ${fields.WardName}.`;
  yPosition = addText(page, subjectText, margin, yPosition, 12, font, boldFont, false, pageWidth, bottomMargin, fields);
  yPosition -= lineHeight * 2;

  // Salutation
  yPosition = addText(page, "Sir/Madam,", margin, yPosition, 12, font, boldFont, false, undefined, bottomMargin);
  yPosition -= lineHeight * 2;

  // Body - highlight all dynamic fields
  const bodyText = `We, ${fields.ApplicantName}, hereby appoint ${fields.ConsultantName} (${fields.ConsultantType}) as our Architect & Licensed Surveyor for the above-mentioned project. The consultant is registered with Council of Architecture (Reg. No.: ${fields.CouncilRegNo}, Valid up to ${fields.RegValidityDate}).`;
  yPosition = addText(page, bodyText, margin, yPosition, 12, font, boldFont, false, pageWidth, bottomMargin, fields);
  yPosition -= lineHeight * 2;

  // Closing
  yPosition = addText(page, "Thanking you,", margin, yPosition, 12, font, boldFont, false, undefined, bottomMargin);
  yPosition -= lineHeight;
  yPosition = addText(page, "Yours faithfully,", margin, yPosition, 12, font, boldFont, false, undefined, bottomMargin);
  yPosition -= lineHeight * 2;
  yPosition = addText(page, `For ${fields.FirmName}`, margin, yPosition, 12, font, boldFont, false, undefined, bottomMargin, fields);
  yPosition -= lineHeight;
  yPosition = addText(page, "(Signed)", margin, yPosition, 12, font, boldFont, false, undefined, bottomMargin);
  yPosition -= lineHeight * 3;

  // Consultant details - highlight all fields
  yPosition = addText(page, fields.ConsultantType, margin, yPosition, 12, font, boldFont, false, undefined, bottomMargin, fields);
  yPosition -= lineHeight;
  yPosition = addText(page, fields.ConsultantName, margin, yPosition, 12, font, boldFont, false, undefined, bottomMargin, fields);
  yPosition -= lineHeight;
  yPosition = addText(page, `Reg. No.: ${fields.CouncilRegNo}`, margin, yPosition, 12, font, boldFont, false, undefined, bottomMargin, fields);
  yPosition -= lineHeight;
  yPosition = addText(
    page,
    `Reg. Validity: ${fields.RegValidityDate}`,
    margin,
    yPosition,
    12,
    font,
    boldFont,
    false,
    undefined,
    bottomMargin,
    fields
  );

  return yPosition;
};

// Template Generator for Structural Engineer
export const generateStructuralEngineer: TemplateGenerator = async (
  pdfDoc,
  page,
  fields,
  font,
  boldFont
) => {
  const margin = 72;
  const pageWidth = 612 - margin * 2;
  const bottomMargin = 120;
  const lineHeight = 14;
  let yPosition = 650;

  // Date - highlight CurrentDate
  yPosition = addText(page, `Date: ${fields.CurrentDate}`, margin, yPosition, 12, font, boldFont, false, undefined, bottomMargin, fields);
  yPosition -= lineHeight * 2;

  // To section
  yPosition = addText(page, "To,", margin, yPosition, 12, font, boldFont, false, undefined, bottomMargin);
  yPosition -= lineHeight;
  yPosition = addText(
    page,
    `The Assistant Engineer (Survey) - ${fields.WardName}`,
    margin,
    yPosition,
    12,
    font,
    boldFont,
    false,
    undefined,
    bottomMargin,
    fields
  );
  yPosition -= lineHeight;
  yPosition = addText(
    page,
    `O/o The Deputy Chief Engineer (Building Proposal) ${fields.ZoneName},`,
    margin,
    yPosition,
    12,
    font,
    boldFont,
    false,
    undefined,
    bottomMargin,
    fields
  );
  yPosition -= lineHeight;
  yPosition = addText(
    page,
    "Brihanmumbai Municipal Corporation,",
    margin,
    yPosition,
    12,
    font,
    boldFont,
    false,
    undefined,
    bottomMargin
  );
  yPosition -= lineHeight;
  yPosition = addText(page, fields.OfficeAddress, margin, yPosition, 12, font, boldFont, false, undefined, bottomMargin, fields);
  yPosition -= lineHeight * 2;

  // Subject - highlight all dynamic fields
  const subjectText = `Subject: Appointment of Structural Engineer for plot bearing C.T.S. No. ${fields.CTSNo} of Village - ${fields.VillageName}, Taluka - ${fields.TalukaName}, District - ${fields.DistrictName}, situated at ${fields.RoadWidth} wide ${fields.RoadName}, off ${fields.MainRoadWidth} wide ${fields.MainRoadName}, within BMC Limits of ${fields.WardName}.`;
  yPosition = addText(page, subjectText, margin, yPosition, 12, font, boldFont, false, pageWidth, bottomMargin, fields);
  yPosition -= lineHeight * 2;

  // Salutation
  yPosition = addText(page, "Sir/Madam,", margin, yPosition, 12, font, boldFont, false, undefined, bottomMargin);
  yPosition -= lineHeight * 2;

  // Body - highlight all dynamic fields
  const bodyText = `We, ${fields.ApplicantName}, hereby appoint ${fields.ConsultantName} (${fields.ConsultantType}) as our Structural Engineer for the above-mentioned project. The consultant is registered with appropriate authority (Reg. No.: ${fields.CouncilRegNo}, Valid up to ${fields.RegValidityDate}).`;
  yPosition = addText(page, bodyText, margin, yPosition, 12, font, boldFont, false, pageWidth, bottomMargin, fields);
  yPosition -= lineHeight * 2;

  // Closing
  yPosition = addText(page, "Thanking you,", margin, yPosition, 12, font, boldFont, false, undefined, bottomMargin);
  yPosition -= lineHeight;
  yPosition = addText(page, "Yours faithfully,", margin, yPosition, 12, font, boldFont, false, undefined, bottomMargin);
  yPosition -= lineHeight * 2;
  yPosition = addText(page, `For ${fields.FirmName}`, margin, yPosition, 12, font, boldFont, false, undefined, bottomMargin, fields);
  yPosition -= lineHeight;
  yPosition = addText(page, "(Signed)", margin, yPosition, 12, font, boldFont, false, undefined, bottomMargin);
  yPosition -= lineHeight * 3;

  // Consultant details - highlight all fields
  yPosition = addText(page, fields.ConsultantType, margin, yPosition, 12, font, boldFont, false, undefined, bottomMargin, fields);
  yPosition -= lineHeight;
  yPosition = addText(page, fields.ConsultantName, margin, yPosition, 12, font, boldFont, false, undefined, bottomMargin, fields);
  yPosition -= lineHeight;
  yPosition = addText(page, `Reg. No.: ${fields.CouncilRegNo}`, margin, yPosition, 12, font, boldFont, false, undefined, bottomMargin, fields);
  yPosition -= lineHeight;
  yPosition = addText(
    page,
    `Reg. Validity: ${fields.RegValidityDate}`,
    margin,
    yPosition,
    12,
    font,
    boldFont,
    false,
    undefined,
    bottomMargin,
    fields
  );

  return yPosition;
};

// Template Generator for Fire Safety Consultant
export const generateFireSafetyConsultant: TemplateGenerator = async (
  pdfDoc,
  page,
  fields,
  font,
  boldFont
) => {
  const margin = 72;
  const pageWidth = 612 - margin * 2;
  const bottomMargin = 120;
  const lineHeight = 14;
  let yPosition = 650;

  // Date
  yPosition = addText(page, `Date: ${fields.CurrentDate}`, margin, yPosition, 12, font, boldFont, false);
  yPosition -= lineHeight * 2;

  // To section
  yPosition = addText(page, "To,", margin, yPosition, 12, font, boldFont, false);
  yPosition -= lineHeight;
  yPosition = addText(
    page,
    `The Assistant Engineer (Survey) - ${fields.WardName}`,
    margin,
    yPosition,
    12,
    font,
    boldFont,
    false
  );
  yPosition -= lineHeight;
  yPosition = addText(
    page,
    `O/o The Deputy Chief Engineer (Building Proposal) ${fields.ZoneName},`,
    margin,
    yPosition,
    12,
    font,
    boldFont,
    false
  );
  yPosition -= lineHeight;
  yPosition = addText(
    page,
    "Brihanmumbai Municipal Corporation,",
    margin,
    yPosition,
    12,
    font,
    boldFont,
    false
  );
  yPosition -= lineHeight;
  yPosition = addText(page, fields.OfficeAddress, margin, yPosition, 12, font, boldFont, false, undefined, bottomMargin, fields);
  yPosition -= lineHeight * 2;

  // Subject
  const subjectText = `Subject: Appointment of Fire Safety Consultant for plot bearing C.T.S. No. ${fields.CTSNo} of Village - ${fields.VillageName}, Taluka - ${fields.TalukaName}, District - ${fields.DistrictName}, situated at ${fields.RoadWidth} wide ${fields.RoadName}, off ${fields.MainRoadWidth} wide ${fields.MainRoadName}, within BMC Limits of ${fields.WardName}.`;
  yPosition = addText(page, subjectText, margin, yPosition, 12, font, boldFont, false, pageWidth);
  yPosition -= lineHeight * 2;

  // Salutation
  yPosition = addText(page, "Sir/Madam,", margin, yPosition, 12, font, boldFont, false);
  yPosition -= lineHeight * 2;

  // Body
  const bodyText = `We, ${fields.ApplicantName}, hereby appoint ${fields.ConsultantName} (${fields.ConsultantType}) as our Fire Safety Consultant for the above-mentioned project. The consultant is registered with appropriate authority (Reg. No.: ${fields.CouncilRegNo}, Valid up to ${fields.RegValidityDate}).`;
  yPosition = addText(page, bodyText, margin, yPosition, 12, font, boldFont, false, pageWidth);
  yPosition -= lineHeight * 2;

  // Closing
  yPosition = addText(page, "Thanking you,", margin, yPosition, 12, font, boldFont, false);
  yPosition -= lineHeight;
  yPosition = addText(page, "Yours faithfully,", margin, yPosition, 12, font, boldFont, false);
  yPosition -= lineHeight * 2;
  yPosition = addText(page, `For ${fields.FirmName}`, margin, yPosition, 12, font, boldFont, false);
  yPosition -= lineHeight;
  yPosition = addText(page, "(Signed)", margin, yPosition, 12, font, boldFont, false);
  yPosition -= lineHeight * 3;

  // Consultant details
  yPosition = addText(page, fields.ConsultantType, margin, yPosition, 12, font, boldFont, false);
  yPosition -= lineHeight;
  yPosition = addText(page, fields.ConsultantName, margin, yPosition, 12, font, boldFont, false);
  yPosition -= lineHeight;
  yPosition = addText(page, `Reg. No.: ${fields.CouncilRegNo}`, margin, yPosition, 12, font, boldFont, false);
  yPosition -= lineHeight;
  yPosition = addText(
    page,
    `Reg. Validity: ${fields.RegValidityDate}`,
    margin,
    yPosition,
    12,
    font,
    boldFont,
    false
  );

  return yPosition;
};

// Template Generator for M&E Consultant
export const generateMEConsultant: TemplateGenerator = async (
  pdfDoc,
  page,
  fields,
  font,
  boldFont
) => {
  const margin = 72;
  const pageWidth = 612 - margin * 2;
  const bottomMargin = 120;
  const lineHeight = 14;
  let yPosition = 650;

  // Date
  yPosition = addText(page, `Date: ${fields.CurrentDate}`, margin, yPosition, 12, font, boldFont, false);
  yPosition -= lineHeight * 2;

  // To section
  yPosition = addText(page, "To,", margin, yPosition, 12, font, boldFont, false);
  yPosition -= lineHeight;
  yPosition = addText(
    page,
    `The Assistant Engineer (Survey) - ${fields.WardName}`,
    margin,
    yPosition,
    12,
    font,
    boldFont,
    false
  );
  yPosition -= lineHeight;
  yPosition = addText(
    page,
    `O/o The Deputy Chief Engineer (Building Proposal) ${fields.ZoneName},`,
    margin,
    yPosition,
    12,
    font,
    boldFont,
    false
  );
  yPosition -= lineHeight;
  yPosition = addText(
    page,
    "Brihanmumbai Municipal Corporation,",
    margin,
    yPosition,
    12,
    font,
    boldFont,
    false
  );
  yPosition -= lineHeight;
  yPosition = addText(page, fields.OfficeAddress, margin, yPosition, 12, font, boldFont, false, undefined, bottomMargin, fields);
  yPosition -= lineHeight * 2;

  // Subject
  const subjectText = `Subject: Appointment of M&E Consultant for plot bearing C.T.S. No. ${fields.CTSNo} of Village - ${fields.VillageName}, Taluka - ${fields.TalukaName}, District - ${fields.DistrictName}, situated at ${fields.RoadWidth} wide ${fields.RoadName}, off ${fields.MainRoadWidth} wide ${fields.MainRoadName}, within BMC Limits of ${fields.WardName}.`;
  yPosition = addText(page, subjectText, margin, yPosition, 12, font, boldFont, false, pageWidth);
  yPosition -= lineHeight * 2;

  // Salutation
  yPosition = addText(page, "Sir/Madam,", margin, yPosition, 12, font, boldFont, false);
  yPosition -= lineHeight * 2;

  // Body
  const bodyText = `We, ${fields.ApplicantName}, hereby appoint ${fields.ConsultantName} (${fields.ConsultantType}) as our M&E Consultant for the above-mentioned project. The consultant is registered with appropriate authority (Reg. No.: ${fields.CouncilRegNo}, Valid up to ${fields.RegValidityDate}).`;
  yPosition = addText(page, bodyText, margin, yPosition, 12, font, boldFont, false, pageWidth);
  yPosition -= lineHeight * 2;

  // Closing
  yPosition = addText(page, "Thanking you,", margin, yPosition, 12, font, boldFont, false);
  yPosition -= lineHeight;
  yPosition = addText(page, "Yours faithfully,", margin, yPosition, 12, font, boldFont, false);
  yPosition -= lineHeight * 2;
  yPosition = addText(page, `For ${fields.FirmName}`, margin, yPosition, 12, font, boldFont, false);
  yPosition -= lineHeight;
  yPosition = addText(page, "(Signed)", margin, yPosition, 12, font, boldFont, false);
  yPosition -= lineHeight * 3;

  // Consultant details
  yPosition = addText(page, fields.ConsultantType, margin, yPosition, 12, font, boldFont, false);
  yPosition -= lineHeight;
  yPosition = addText(page, fields.ConsultantName, margin, yPosition, 12, font, boldFont, false);
  yPosition -= lineHeight;
  yPosition = addText(page, `Reg. No.: ${fields.CouncilRegNo}`, margin, yPosition, 12, font, boldFont, false);
  yPosition -= lineHeight;
  yPosition = addText(
    page,
    `Reg. Validity: ${fields.RegValidityDate}`,
    margin,
    yPosition,
    12,
    font,
    boldFont,
    false
  );

  return yPosition;
};

// Template Generator for Plumber
export const generatePlumber: TemplateGenerator = async (
  pdfDoc,
  page,
  fields,
  font,
  boldFont
) => {
  const margin = 72;
  const pageWidth = 612 - margin * 2;
  const bottomMargin = 120;
  const lineHeight = 14;
  let yPosition = 650;

  // Date
  yPosition = addText(page, `Date: ${fields.CurrentDate}`, margin, yPosition, 12, font, boldFont, false);
  yPosition -= lineHeight * 2;

  // To section
  yPosition = addText(page, "To,", margin, yPosition, 12, font, boldFont, false);
  yPosition -= lineHeight;
  yPosition = addText(
    page,
    `The Assistant Engineer (Survey) - ${fields.WardName}`,
    margin,
    yPosition,
    12,
    font,
    boldFont,
    false
  );
  yPosition -= lineHeight;
  yPosition = addText(
    page,
    `O/o The Deputy Chief Engineer (Building Proposal) ${fields.ZoneName},`,
    margin,
    yPosition,
    12,
    font,
    boldFont,
    false
  );
  yPosition -= lineHeight;
  yPosition = addText(
    page,
    "Brihanmumbai Municipal Corporation,",
    margin,
    yPosition,
    12,
    font,
    boldFont,
    false
  );
  yPosition -= lineHeight;
  yPosition = addText(page, fields.OfficeAddress, margin, yPosition, 12, font, boldFont, false, undefined, bottomMargin, fields);
  yPosition -= lineHeight * 2;

  // Subject
  const subjectText = `Subject: Appointment of Plumber for plot bearing C.T.S. No. ${fields.CTSNo} of Village - ${fields.VillageName}, Taluka - ${fields.TalukaName}, District - ${fields.DistrictName}, situated at ${fields.RoadWidth} wide ${fields.RoadName}, off ${fields.MainRoadWidth} wide ${fields.MainRoadName}, within BMC Limits of ${fields.WardName}.`;
  yPosition = addText(page, subjectText, margin, yPosition, 12, font, boldFont, false, pageWidth);
  yPosition -= lineHeight * 2;

  // Salutation
  yPosition = addText(page, "Sir/Madam,", margin, yPosition, 12, font, boldFont, false);
  yPosition -= lineHeight * 2;

  // Body
  const bodyText = `We, ${fields.ApplicantName}, hereby appoint ${fields.ConsultantName} (${fields.ConsultantType}) as our Plumber for the above-mentioned project. The consultant is registered with appropriate authority (Reg. No.: ${fields.CouncilRegNo}, Valid up to ${fields.RegValidityDate}).`;
  yPosition = addText(page, bodyText, margin, yPosition, 12, font, boldFont, false, pageWidth);
  yPosition -= lineHeight * 2;

  // Closing
  yPosition = addText(page, "Thanking you,", margin, yPosition, 12, font, boldFont, false);
  yPosition -= lineHeight;
  yPosition = addText(page, "Yours faithfully,", margin, yPosition, 12, font, boldFont, false);
  yPosition -= lineHeight * 2;
  yPosition = addText(page, `For ${fields.FirmName}`, margin, yPosition, 12, font, boldFont, false);
  yPosition -= lineHeight;
  yPosition = addText(page, "(Signed)", margin, yPosition, 12, font, boldFont, false);
  yPosition -= lineHeight * 3;

  // Consultant details
  yPosition = addText(page, fields.ConsultantType, margin, yPosition, 12, font, boldFont, false);
  yPosition -= lineHeight;
  yPosition = addText(page, fields.ConsultantName, margin, yPosition, 12, font, boldFont, false);
  yPosition -= lineHeight;
  yPosition = addText(page, `Reg. No.: ${fields.CouncilRegNo}`, margin, yPosition, 12, font, boldFont, false);
  yPosition -= lineHeight;
  yPosition = addText(
    page,
    `Reg. Validity: ${fields.RegValidityDate}`,
    margin,
    yPosition,
    12,
    font,
    boldFont,
    false
  );

  return yPosition;
};

// Template Generator for Parking Consultant
export const generateParkingConsultant: TemplateGenerator = async (
  pdfDoc,
  page,
  fields,
  font,
  boldFont
) => {
  const margin = 72;
  const pageWidth = 612 - margin * 2;
  const bottomMargin = 120;
  const lineHeight = 14;
  let yPosition = 650;

  // Date
  yPosition = addText(page, `Date: ${fields.CurrentDate}`, margin, yPosition, 12, font, boldFont, false);
  yPosition -= lineHeight * 2;

  // To section
  yPosition = addText(page, "To,", margin, yPosition, 12, font, boldFont, false);
  yPosition -= lineHeight;
  yPosition = addText(
    page,
    `The Assistant Engineer (Survey) - ${fields.WardName}`,
    margin,
    yPosition,
    12,
    font,
    boldFont,
    false
  );
  yPosition -= lineHeight;
  yPosition = addText(
    page,
    `O/o The Deputy Chief Engineer (Building Proposal) ${fields.ZoneName},`,
    margin,
    yPosition,
    12,
    font,
    boldFont,
    false
  );
  yPosition -= lineHeight;
  yPosition = addText(
    page,
    "Brihanmumbai Municipal Corporation,",
    margin,
    yPosition,
    12,
    font,
    boldFont,
    false
  );
  yPosition -= lineHeight;
  yPosition = addText(page, fields.OfficeAddress, margin, yPosition, 12, font, boldFont, false, undefined, bottomMargin, fields);
  yPosition -= lineHeight * 2;

  // Subject
  const subjectText = `Subject: Appointment of Parking Consultant for plot bearing C.T.S. No. ${fields.CTSNo} of Village - ${fields.VillageName}, Taluka - ${fields.TalukaName}, District - ${fields.DistrictName}, situated at ${fields.RoadWidth} wide ${fields.RoadName}, off ${fields.MainRoadWidth} wide ${fields.MainRoadName}, within BMC Limits of ${fields.WardName}.`;
  yPosition = addText(page, subjectText, margin, yPosition, 12, font, boldFont, false, pageWidth);
  yPosition -= lineHeight * 2;

  // Salutation
  yPosition = addText(page, "Sir/Madam,", margin, yPosition, 12, font, boldFont, false);
  yPosition -= lineHeight * 2;

  // Body
  const bodyText = `We, ${fields.ApplicantName}, hereby appoint ${fields.ConsultantName} (${fields.ConsultantType}) as our Parking Consultant for the above-mentioned project. The consultant is registered with appropriate authority (Reg. No.: ${fields.CouncilRegNo}, Valid up to ${fields.RegValidityDate}).`;
  yPosition = addText(page, bodyText, margin, yPosition, 12, font, boldFont, false, pageWidth);
  yPosition -= lineHeight * 2;

  // Closing
  yPosition = addText(page, "Thanking you,", margin, yPosition, 12, font, boldFont, false);
  yPosition -= lineHeight;
  yPosition = addText(page, "Yours faithfully,", margin, yPosition, 12, font, boldFont, false);
  yPosition -= lineHeight * 2;
  yPosition = addText(page, `For ${fields.FirmName}`, margin, yPosition, 12, font, boldFont, false);
  yPosition -= lineHeight;
  yPosition = addText(page, "(Signed)", margin, yPosition, 12, font, boldFont, false);
  yPosition -= lineHeight * 3;

  // Consultant details
  yPosition = addText(page, fields.ConsultantType, margin, yPosition, 12, font, boldFont, false);
  yPosition -= lineHeight;
  yPosition = addText(page, fields.ConsultantName, margin, yPosition, 12, font, boldFont, false);
  yPosition -= lineHeight;
  yPosition = addText(page, `Reg. No.: ${fields.CouncilRegNo}`, margin, yPosition, 12, font, boldFont, false);
  yPosition -= lineHeight;
  yPosition = addText(
    page,
    `Reg. Validity: ${fields.RegValidityDate}`,
    margin,
    yPosition,
    12,
    font,
    boldFont,
    false
  );

  return yPosition;
};

// Template Generator for Rainwater Consultant
export const generateRainwaterConsultant: TemplateGenerator = async (
  pdfDoc,
  page,
  fields,
  font,
  boldFont
) => {
  const margin = 72;
  const pageWidth = 612 - margin * 2;
  const bottomMargin = 120;
  const lineHeight = 14;
  let yPosition = 650;

  // Date
  yPosition = addText(page, `Date: ${fields.CurrentDate}`, margin, yPosition, 12, font, boldFont, false);
  yPosition -= lineHeight * 2;

  // To section
  yPosition = addText(page, "To,", margin, yPosition, 12, font, boldFont, false);
  yPosition -= lineHeight;
  yPosition = addText(
    page,
    `The Assistant Engineer (Survey) - ${fields.WardName}`,
    margin,
    yPosition,
    12,
    font,
    boldFont,
    false
  );
  yPosition -= lineHeight;
  yPosition = addText(
    page,
    `O/o The Deputy Chief Engineer (Building Proposal) ${fields.ZoneName},`,
    margin,
    yPosition,
    12,
    font,
    boldFont,
    false
  );
  yPosition -= lineHeight;
  yPosition = addText(
    page,
    "Brihanmumbai Municipal Corporation,",
    margin,
    yPosition,
    12,
    font,
    boldFont,
    false
  );
  yPosition -= lineHeight;
  yPosition = addText(page, fields.OfficeAddress, margin, yPosition, 12, font, boldFont, false, undefined, bottomMargin, fields);
  yPosition -= lineHeight * 2;

  // Subject
  const subjectText = `Subject: Appointment of Rainwater Consultant for plot bearing C.T.S. No. ${fields.CTSNo} of Village - ${fields.VillageName}, Taluka - ${fields.TalukaName}, District - ${fields.DistrictName}, situated at ${fields.RoadWidth} wide ${fields.RoadName}, off ${fields.MainRoadWidth} wide ${fields.MainRoadName}, within BMC Limits of ${fields.WardName}.`;
  yPosition = addText(page, subjectText, margin, yPosition, 12, font, boldFont, false, pageWidth);
  yPosition -= lineHeight * 2;

  // Salutation
  yPosition = addText(page, "Sir/Madam,", margin, yPosition, 12, font, boldFont, false);
  yPosition -= lineHeight * 2;

  // Body
  const bodyText = `We, ${fields.ApplicantName}, hereby appoint ${fields.ConsultantName} (${fields.ConsultantType}) as our Rainwater Consultant for the above-mentioned project. The consultant is registered with appropriate authority (Reg. No.: ${fields.CouncilRegNo}, Valid up to ${fields.RegValidityDate}).`;
  yPosition = addText(page, bodyText, margin, yPosition, 12, font, boldFont, false, pageWidth);
  yPosition -= lineHeight * 2;

  // Closing
  yPosition = addText(page, "Thanking you,", margin, yPosition, 12, font, boldFont, false);
  yPosition -= lineHeight;
  yPosition = addText(page, "Yours faithfully,", margin, yPosition, 12, font, boldFont, false);
  yPosition -= lineHeight * 2;
  yPosition = addText(page, `For ${fields.FirmName}`, margin, yPosition, 12, font, boldFont, false);
  yPosition -= lineHeight;
  yPosition = addText(page, "(Signed)", margin, yPosition, 12, font, boldFont, false);
  yPosition -= lineHeight * 3;

  // Consultant details
  yPosition = addText(page, fields.ConsultantType, margin, yPosition, 12, font, boldFont, false);
  yPosition -= lineHeight;
  yPosition = addText(page, fields.ConsultantName, margin, yPosition, 12, font, boldFont, false);
  yPosition -= lineHeight;
  yPosition = addText(page, `Reg. No.: ${fields.CouncilRegNo}`, margin, yPosition, 12, font, boldFont, false);
  yPosition -= lineHeight;
  yPosition = addText(
    page,
    `Reg. Validity: ${fields.RegValidityDate}`,
    margin,
    yPosition,
    12,
    font,
    boldFont,
    false
  );

  return yPosition;
};

// Template Generator for Site Supervisor
export const generateSiteSupervisor: TemplateGenerator = async (
  pdfDoc,
  page,
  fields,
  font,
  boldFont
) => {
  const margin = 72;
  const pageWidth = 612 - margin * 2;
  const bottomMargin = 120;
  const lineHeight = 14;
  let yPosition = 650;

  // Date
  yPosition = addText(page, `Date: ${fields.CurrentDate}`, margin, yPosition, 12, font, boldFont, false);
  yPosition -= lineHeight * 2;

  // To section
  yPosition = addText(page, "To,", margin, yPosition, 12, font, boldFont, false);
  yPosition -= lineHeight;
  yPosition = addText(
    page,
    `The Assistant Engineer (Survey) - ${fields.WardName}`,
    margin,
    yPosition,
    12,
    font,
    boldFont,
    false
  );
  yPosition -= lineHeight;
  yPosition = addText(
    page,
    `O/o The Deputy Chief Engineer (Building Proposal) ${fields.ZoneName},`,
    margin,
    yPosition,
    12,
    font,
    boldFont,
    false
  );
  yPosition -= lineHeight;
  yPosition = addText(
    page,
    "Brihanmumbai Municipal Corporation,",
    margin,
    yPosition,
    12,
    font,
    boldFont,
    false
  );
  yPosition -= lineHeight;
  yPosition = addText(page, fields.OfficeAddress, margin, yPosition, 12, font, boldFont, false, undefined, bottomMargin, fields);
  yPosition -= lineHeight * 2;

  // Subject
  const subjectText = `Subject: Appointment of Site Supervisor for plot bearing C.T.S. No. ${fields.CTSNo} of Village - ${fields.VillageName}, Taluka - ${fields.TalukaName}, District - ${fields.DistrictName}, situated at ${fields.RoadWidth} wide ${fields.RoadName}, off ${fields.MainRoadWidth} wide ${fields.MainRoadName}, within BMC Limits of ${fields.WardName}.`;
  yPosition = addText(page, subjectText, margin, yPosition, 12, font, boldFont, false, pageWidth);
  yPosition -= lineHeight * 2;

  // Salutation
  yPosition = addText(page, "Sir/Madam,", margin, yPosition, 12, font, boldFont, false);
  yPosition -= lineHeight * 2;

  // Body
  const bodyText = `We, ${fields.ApplicantName}, hereby appoint ${fields.ConsultantName} (${fields.ConsultantType}) as our Site Supervisor for the above-mentioned project. The consultant is registered with appropriate authority (Reg. No.: ${fields.CouncilRegNo}, Valid up to ${fields.RegValidityDate}).`;
  yPosition = addText(page, bodyText, margin, yPosition, 12, font, boldFont, false, pageWidth);
  yPosition -= lineHeight * 2;

  // Closing
  yPosition = addText(page, "Thanking you,", margin, yPosition, 12, font, boldFont, false);
  yPosition -= lineHeight;
  yPosition = addText(page, "Yours faithfully,", margin, yPosition, 12, font, boldFont, false);
  yPosition -= lineHeight * 2;
  yPosition = addText(page, `For ${fields.FirmName}`, margin, yPosition, 12, font, boldFont, false);
  yPosition -= lineHeight;
  yPosition = addText(page, "(Signed)", margin, yPosition, 12, font, boldFont, false);
  yPosition -= lineHeight * 3;

  // Consultant details
  yPosition = addText(page, fields.ConsultantType, margin, yPosition, 12, font, boldFont, false);
  yPosition -= lineHeight;
  yPosition = addText(page, fields.ConsultantName, margin, yPosition, 12, font, boldFont, false);
  yPosition -= lineHeight;
  yPosition = addText(page, `Reg. No.: ${fields.CouncilRegNo}`, margin, yPosition, 12, font, boldFont, false);
  yPosition -= lineHeight;
  yPosition = addText(
    page,
    `Reg. Validity: ${fields.RegValidityDate}`,
    margin,
    yPosition,
    12,
    font,
    boldFont,
    false
  );

  return yPosition;
};

// Template Generator for Horticulturist
export const generateHorticulturist: TemplateGenerator = async (
  pdfDoc,
  page,
  fields,
  font,
  boldFont
) => {
  const margin = 72;
  const pageWidth = 612 - margin * 2;
  const bottomMargin = 120;
  const lineHeight = 14;
  let yPosition = 650;

  // Date
  yPosition = addText(page, `Date: ${fields.CurrentDate}`, margin, yPosition, 12, font, boldFont, false);
  yPosition -= lineHeight * 2;

  // To section
  yPosition = addText(page, "To,", margin, yPosition, 12, font, boldFont, false);
  yPosition -= lineHeight;
  yPosition = addText(
    page,
    `The Assistant Engineer (Survey) - ${fields.WardName}`,
    margin,
    yPosition,
    12,
    font,
    boldFont,
    false
  );
  yPosition -= lineHeight;
  yPosition = addText(
    page,
    `O/o The Deputy Chief Engineer (Building Proposal) ${fields.ZoneName},`,
    margin,
    yPosition,
    12,
    font,
    boldFont,
    false
  );
  yPosition -= lineHeight;
  yPosition = addText(
    page,
    "Brihanmumbai Municipal Corporation,",
    margin,
    yPosition,
    12,
    font,
    boldFont,
    false
  );
  yPosition -= lineHeight;
  yPosition = addText(page, fields.OfficeAddress, margin, yPosition, 12, font, boldFont, false, undefined, bottomMargin, fields);
  yPosition -= lineHeight * 2;

  // Subject
  const subjectText = `Subject: Appointment of Horticulturist for plot bearing C.T.S. No. ${fields.CTSNo} of Village - ${fields.VillageName}, Taluka - ${fields.TalukaName}, District - ${fields.DistrictName}, situated at ${fields.RoadWidth} wide ${fields.RoadName}, off ${fields.MainRoadWidth} wide ${fields.MainRoadName}, within BMC Limits of ${fields.WardName}.`;
  yPosition = addText(page, subjectText, margin, yPosition, 12, font, boldFont, false, pageWidth);
  yPosition -= lineHeight * 2;

  // Salutation
  yPosition = addText(page, "Sir/Madam,", margin, yPosition, 12, font, boldFont, false);
  yPosition -= lineHeight * 2;

  // Body
  const bodyText = `We, ${fields.ApplicantName}, hereby appoint ${fields.ConsultantName} (${fields.ConsultantType}) as our Horticulturist for the above-mentioned project. The consultant is registered with appropriate authority (Reg. No.: ${fields.CouncilRegNo}, Valid up to ${fields.RegValidityDate}).`;
  yPosition = addText(page, bodyText, margin, yPosition, 12, font, boldFont, false, pageWidth);
  yPosition -= lineHeight * 2;

  // Closing
  yPosition = addText(page, "Thanking you,", margin, yPosition, 12, font, boldFont, false);
  yPosition -= lineHeight;
  yPosition = addText(page, "Yours faithfully,", margin, yPosition, 12, font, boldFont, false);
  yPosition -= lineHeight * 2;
  yPosition = addText(page, `For ${fields.FirmName}`, margin, yPosition, 12, font, boldFont, false);
  yPosition -= lineHeight;
  yPosition = addText(page, "(Signed)", margin, yPosition, 12, font, boldFont, false);
  yPosition -= lineHeight * 3;

  // Consultant details
  yPosition = addText(page, fields.ConsultantType, margin, yPosition, 12, font, boldFont, false);
  yPosition -= lineHeight;
  yPosition = addText(page, fields.ConsultantName, margin, yPosition, 12, font, boldFont, false);
  yPosition -= lineHeight;
  yPosition = addText(page, `Reg. No.: ${fields.CouncilRegNo}`, margin, yPosition, 12, font, boldFont, false);
  yPosition -= lineHeight;
  yPosition = addText(
    page,
    `Reg. Validity: ${fields.RegValidityDate}`,
    margin,
    yPosition,
    12,
    font,
    boldFont,
    false
  );

  return yPosition;
};

// Import DOCX-based generator
import { generateFromDocx } from "./docxTemplateGenerator";

// Template configuration mapping - now using DOCX files
export const TEMPLATE_CONFIG = {
  "Architect Licensed Surveyor": {
    generator: (pdfDoc: any, page: any, fields: TemplateFields, font: any, boldFont: any) => 
      generateFromDocx(pdfDoc, page, fields, font, boldFont, "Architect Licensed Surveyor"),
    displayName: "Architect Licensed Surveyor",
    fileName: "Appointment_Letter_Architect_Licensed_Surveyor.pdf",
  },
  "Structural Engineer": {
    generator: (pdfDoc: any, page: any, fields: TemplateFields, font: any, boldFont: any) => 
      generateFromDocx(pdfDoc, page, fields, font, boldFont, "Structural Engineer"),
    displayName: "Structural Engineer",
    fileName: "Appointment_Letter_Structural_Engineer.pdf",
  },
  "Fire Safety Consultant": {
    generator: (pdfDoc: any, page: any, fields: TemplateFields, font: any, boldFont: any) => 
      generateFromDocx(pdfDoc, page, fields, font, boldFont, "Fire Safety Consultant"),
    displayName: "Fire Safety Consultant",
    fileName: "Appointment_Letter_Fire_Safety_Consultant.pdf",
  },
  "M&E Consultant": {
    generator: (pdfDoc: any, page: any, fields: TemplateFields, font: any, boldFont: any) => 
      generateFromDocx(pdfDoc, page, fields, font, boldFont, "M&E Consultant"),
    displayName: "M&E Consultant",
    fileName: "Appointment_Letter_ME_Consultant.pdf",
  },
  "Plumber": {
    generator: (pdfDoc: any, page: any, fields: TemplateFields, font: any, boldFont: any) => 
      generateFromDocx(pdfDoc, page, fields, font, boldFont, "Plumber"),
    displayName: "Plumber",
    fileName: "Appointment_Letter_Plumber.pdf",
  },
  "Parking Consultant": {
    generator: (pdfDoc: any, page: any, fields: TemplateFields, font: any, boldFont: any) => 
      generateFromDocx(pdfDoc, page, fields, font, boldFont, "Parking Consultant"),
    displayName: "Parking Consultant",
    fileName: "Appointment_Letter_Parking_Consultant.pdf",
  },
  "Rainwater Consultant": {
    generator: (pdfDoc: any, page: any, fields: TemplateFields, font: any, boldFont: any) => 
      generateFromDocx(pdfDoc, page, fields, font, boldFont, "Rainwater Consultant"),
    displayName: "Rainwater Consultant",
    fileName: "Appointment_Letter_Rainwater_Consultant.pdf",
  },
  "Site Supervisor": {
    generator: (pdfDoc: any, page: any, fields: TemplateFields, font: any, boldFont: any) => 
      generateFromDocx(pdfDoc, page, fields, font, boldFont, "Site Supervisor"),
    displayName: "Site Supervisor",
    fileName: "Appointment_Letter_Site_Supervisor.pdf",
  },
  "Horticulturist": {
    generator: (pdfDoc: any, page: any, fields: TemplateFields, font: any, boldFont: any) => 
      generateFromDocx(pdfDoc, page, fields, font, boldFont, "Horticulturist"),
    displayName: "Horticulturist",
    fileName: "Appointment_Letter_Horticulturist.pdf",
  },
} as const;

export type TemplateType = keyof typeof TEMPLATE_CONFIG;

