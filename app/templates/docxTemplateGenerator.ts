import { PDFDocument, StandardFonts, PDFPage, rgb } from "pdf-lib";
import { TemplateFields } from "./templateGenerators";

/**
 * Generic template generator that reads from DOCX file
 */
export async function generateFromDocx(
  pdfDoc: PDFDocument,
  page: PDFPage,
  fields: TemplateFields,
  font: any,
  boldFont: any,
  templateName: string
): Promise<number> {
  const margin = 72;
  const pageWidth = 612 - margin * 2;
  const bottomMargin = 120;
  const lineHeight = 14;
  let yPosition = 650;

  try {
    // Fetch DOCX content from API route
    const response = await fetch("/api/parse-docx", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ templateName }),
    });
    
    if (!response.ok) {
      throw new Error(`Failed to parse DOCX: ${response.statusText}`);
    }
    
    const parsed = await response.json();
    
    // Use lines array if available, otherwise split text
    let lines: string[] = [];
    if (parsed.lines && Array.isArray(parsed.lines)) {
      // Use the lines array from the API
      lines = parsed.lines;
    } else {
      // Fallback: split text by newlines
      lines = parsed.text.split("\n");
    }
    
    // Process each line: clean, replace placeholders, and replace field values
    let processedLines = lines.map((line) => {
      // Clean the line
      let cleanedLine = cleanText(line);
      
      // Replace placeholders
      cleanedLine = replacePlaceholders(cleanedLine, fields);
      
      // Replace field values
      cleanedLine = replaceFieldValues(cleanedLine, fields);
      
      return cleanedLine;
    });
    
    // Combine continuation lines for Project, Subject, and Ref fields
    // If a line starts with "Project:", "Subject:", or "Ref.:" and the next line doesn't start with a label,
    // combine them into a single line
    const combinedLines: string[] = [];
    for (let i = 0; i < processedLines.length; i++) {
      const line = processedLines[i];
      const nextLine = i + 1 < processedLines.length ? processedLines[i + 1] : null;
      
      // Check if this line starts with Project, Subject, or Ref
      if (line.startsWith("Project:") || line.startsWith("Subject:") || line.startsWith("Ref.:")) {
        // Check if next line is a continuation (doesn't start with a label and isn't empty)
        if (nextLine && 
            nextLine.trim().length > 0 && 
            !nextLine.startsWith("Project:") && 
            !nextLine.startsWith("Subject:") && 
            !nextLine.startsWith("Ref.:") &&
            !nextLine.startsWith("Sir,") &&
            !nextLine.startsWith("Sir/Madam,") &&
            !nextLine.startsWith("To,") &&
            !nextLine.startsWith("Name:") &&
            !nextLine.startsWith("Address:") &&
            !nextLine.startsWith("Lic. No.:") &&
            !nextLine.startsWith("Mobile:") &&
            !nextLine.startsWith("Email:") &&
            !nextLine.startsWith("Email.:") &&
            !nextLine.startsWith("Thanking you,") &&
            !nextLine.startsWith("Yours faithfully,") &&
            !nextLine.startsWith("Signature") &&
            !nextLine.startsWith("C.C. to:")) {
          // Combine with next line
          combinedLines.push(line + " " + nextLine.trim());
          i++; // Skip next line as it's been combined
        } else {
          combinedLines.push(line);
        }
      } else {
        combinedLines.push(line);
      }
    }
    processedLines = combinedLines;
    
    // Render lines with proper formatting - preserve exact line structure
    for (let i = 0; i < processedLines.length; i++) {
      if (yPosition < bottomMargin) {
        break; // No more space on page
      }
      
      const line = processedLines[i];
      
      // Skip completely empty lines but preserve them for spacing
      if (!line || line.trim().length === 0) {
        yPosition -= lineHeight * 0.5; // Small spacing for empty lines
        continue;
      }
      
      // Handle special formatting cases
      if (line.startsWith("Date:")) {
        // Date line - render without wrapping
        yPosition = addText(page, line, margin, yPosition, 12, font, boldFont, false, undefined, bottomMargin);
        yPosition -= lineHeight * 1.5;
      } else if (line === "To," || line.trim() === "To,") {
        // "To," line - single line, no wrapping
        yPosition = addText(page, "To,", margin, yPosition, 12, font, boldFont, false, undefined, bottomMargin);
        yPosition -= lineHeight;
      } else if (line.startsWith("Subject:") || line.startsWith("Project:") || line.startsWith("Ref.:")) {
        // Section headers - add extra space before, allow wrapping if needed
        yPosition -= lineHeight * 0.5;
        const lineWidth = font.widthOfTextAtSize(line, 12);
        const shouldWrap = lineWidth > pageWidth;
        const finalY = addText(page, line, margin, yPosition, 12, font, boldFont, false, shouldWrap ? pageWidth : undefined, bottomMargin);
        // Only subtract lineHeight if text didn't wrap (wrapped text already accounts for spacing)
        yPosition = shouldWrap ? finalY : finalY - lineHeight;
        yPosition -= lineHeight * 0.5; // Add extra space after
      } else if (line.startsWith("Sir,") || line.startsWith("Sir/Madam,")) {
        // Salutation - single line
        yPosition -= lineHeight * 0.5;
        yPosition = addText(page, line, margin, yPosition, 12, font, boldFont, false, undefined, bottomMargin);
        yPosition -= lineHeight * 1.5;
      } else if (line.includes("The name, address and registration number are given below.") || 
                 line.includes("name, address and registration number are given below")) {
        // This line should have a blank line after it
        const lineWidth = font.widthOfTextAtSize(line, 12);
        const shouldWrap = lineWidth > pageWidth;
        yPosition = addText(page, line, margin, yPosition, 12, font, boldFont, false, shouldWrap ? pageWidth : undefined, bottomMargin);
        yPosition -= lineHeight * 2; // Add extra blank line after this
      } else if (line.startsWith("Name:") || line.startsWith("Address:") || line.startsWith("Lic. No.:") || line.startsWith("Mobile:")) {
        // Consultant detail labels - single line, no wrapping
        yPosition = addText(page, line, margin, yPosition, 12, font, boldFont, false, undefined, bottomMargin);
        yPosition -= lineHeight;
      } else if (line.startsWith("Email.:") || line.startsWith("Email:")) {
        // Email line - add blank line after it
        yPosition = addText(page, line, margin, yPosition, 12, font, boldFont, false, undefined, bottomMargin);
        yPosition -= lineHeight * 2; // Add blank line after email
      } else if (line.startsWith("Thanking you,") || line.startsWith("Yours faithfully,")) {
        // Closing sections - single line
        yPosition -= lineHeight * 0.5;
        yPosition = addText(page, line, margin, yPosition, 12, font, boldFont, false, undefined, bottomMargin);
        yPosition -= lineHeight;
      } else if (line.startsWith("Signature of Owner") || line.includes("Signature of Owner")) {
        // Skip rendering the "Signature of Owner" label; just add vertical spacing
        yPosition -= lineHeight * 1.5;
      } else if (line.startsWith("C.C. to:") || line.startsWith("C.C. to:")) {
        // CC section - single line, allow it closer to footer
        yPosition -= lineHeight * 0.5;
        const ccBottomMargin = 30;
        yPosition = addText(page, line, margin, yPosition, 12, font, boldFont, false, undefined, ccBottomMargin);
        yPosition -= lineHeight;
      } else {
        // Check if this is the owner name line (usually comes after "Signature of Owner")
        const isOwnerName = i > 0 && processedLines[i - 1] && 
          (processedLines[i - 1].includes("Signature of Owner") || 
           processedLines[i - 1].trim() === "Signature of Owner");
        // Check if this is a CC recipient name line (usually comes after "C.C. to:")
        const isCcName = i > 0 && processedLines[i - 1] &&
          processedLines[i - 1].startsWith("C.C. to:");
        
        if (isOwnerName) {
          // Push owner name a bit further down toward the footer, then right-align it
          yPosition -= lineHeight * 3;
          const lineWidth = font.widthOfTextAtSize(line, 12);
          // Allow owner name to go even closer to the footer by using a very small bottom margin
          const ownerBottomMargin = 0;
          yPosition = addText(page, line, pageWidth + margin - lineWidth, yPosition, 12, font, boldFont, false, undefined, ownerBottomMargin);
          yPosition -= lineHeight;
        } else if (isCcName) {
          // CC recipient name - keep it visible near footer
          const ccBottomMargin = 30;
          yPosition = addText(page, line, margin, yPosition, 12, font, boldFont, false, undefined, ccBottomMargin);
          yPosition -= lineHeight;
        } else {
          // Regular lines - render without wrapping to preserve structure
          const lineWidth = font.widthOfTextAtSize(line, 12);
          const shouldWrap = lineWidth > pageWidth;
          
          yPosition = addText(
            page,
            line,
            margin,
            yPosition,
            12,
            font,
            boldFont,
            false,
            shouldWrap ? pageWidth : undefined, // Only wrap if necessary
            bottomMargin
          );
          yPosition -= lineHeight;
        }
      }
    }
    
    return yPosition;
  } catch (error) {
    console.error(`Error generating PDF from DOCX template ${templateName}:`, error);
    // Fallback: render error message
    page.drawText(
      `Error loading template: ${error}`,
      { x: margin, y: yPosition, size: 12, font }
    );
    return yPosition - lineHeight * 2;
  }
}

/**
 * Clean text to remove characters that pdf-lib can't encode
 * Preserves newlines for proper paragraph structure
 */
function cleanText(text: string): string {
  if (!text) return "";
  
  return text
    // Replace tabs with spaces
    .replace(/\t/g, " ")
    // Replace non-breaking spaces with regular spaces
    .replace(/\u00A0/g, " ")
    // Replace other problematic whitespace characters (but keep newlines)
    .replace(/[\u2000-\u200B\uFEFF]/g, " ")
    // Replace line/paragraph separators with newlines
    .replace(/[\u2028-\u2029]/g, "\n")
    // Remove control characters except newlines and carriage returns
    .replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, "")
    // Clean up multiple spaces within a line (but preserve newlines)
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .join("\n");
}

/**
 * Replace placeholders in text with field values
 * Handles various placeholder formats: {FieldName}, {{FieldName}}, [FieldName], (Issue), etc.
 */
function replacePlaceholders(text: string, fields: TemplateFields): string {
  let result = text;
  
  // Map of field names to values
  const fieldMap: Record<string, string> = {
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
  };
  
  // Replace (Issue) with actual date
  result = result.replace(/\(Issue\)/g, fields.CurrentDate);
  
  // Replace (Ward) with actual ward name
  result = result.replace(/\(Ward\)/g, fields.WardName);
  
  // Replace (Name of Plumber), (Name of Architect), etc. with consultant name
  result = result.replace(/\(Name of [^)]+\)/g, fields.ConsultantName);
  
  // Replace (address) with office address
  result = result.replace(/\(address\)/gi, fields.OfficeAddress);
  
  // Replace (Lic. No.) with council reg number
  result = result.replace(/\(Lic\.\s*No\.\)/gi, fields.CouncilRegNo);
  
  // Replace (Contact no.) with dummy mobile number
  result = result.replace(/\(Contact\s+no\.\)/gi, "+91-9876543210");
  
  // Replace (email) with dummy email
  result = result.replace(/\(email\)/gi, "consultant@example.com");
  
  // Replace Signature of Owner with dummy value
  result = result.replace(/Signature\s+of\s+Owner/gi, "Signature of Owner");
  result = result.replace(/\(Signature\s+of\s+Owner\)/gi, "[Signature]");
  
  // Replace Name of Owner with dummy value
  result = result.replace(/Name\s+of\s+Owner/gi, fields.ApplicantName || "M/s. ABC Developers");
  result = result.replace(/\(Name\s+of\s+Owner\)/gi, fields.ApplicantName || "M/s. ABC Developers");
  
  // Replace (name of architect) with dummy value
  result = result.replace(/\(name\s+of\s+architect\)/gi, fields.ConsultantName || "Mr. John Doe");
  result = result.replace(/\(Name\s+of\s+Architect\)/gi, fields.ConsultantName || "Mr. John Doe");
  
  // Replace (Address of Architect) with dummy value
  result = result.replace(/\(Address\s+of\s+Architect\)/gi, fields.OfficeAddress || "123, Architect Office, Mumbai - 400001");
  result = result.replace(/\(address\s+of\s+architect\)/gi, fields.OfficeAddress || "123, Architect Office, Mumbai - 400001");
  
  // Replace various placeholder formats
  Object.entries(fieldMap).forEach(([fieldName, value]) => {
    // Handle {FieldName} format
    result = result.replace(new RegExp(`\\{${fieldName}\\}`, "g"), value);
    // Handle {{FieldName}} format (double braces)
    result = result.replace(new RegExp(`\\{\\{${fieldName}\\}\\}`, "g"), value);
    // Handle [FieldName] format
    result = result.replace(new RegExp(`\\[${fieldName}\\]`, "g"), value);
    // Handle <<FieldName>> format
    result = result.replace(new RegExp(`<<${fieldName}>>`, "g"), value);
    // Handle ${FieldName} format
    result = result.replace(new RegExp(`\\$\\{${fieldName}\\}`, "g"), value);
    // Handle (FieldName) format
    result = result.replace(new RegExp(`\\(${fieldName}\\)`, "g"), value);
  });
  
  return result;
}

/**
 * Replace field values in text - useful when DOCX contains example values
 * This finds common patterns and replaces them with actual field values
 */
function replaceFieldValues(text: string, fields: TemplateFields): string {
  let result = text;
  
  // Common patterns to replace (case-insensitive)
  const patterns: Array<{ search: RegExp; replace: string }> = [
    // Date patterns
    { search: /\d{2}\/\d{2}\/\d{4}/g, replace: fields.CurrentDate },
    { search: /\d{2}-\d{2}-\d{4}/g, replace: fields.CurrentDate },
    
    // Ward patterns
    { search: /['"]?[A-Z]\s+Ward['"]?/gi, replace: fields.WardName },
    
    // Zone patterns  
    { search: /[A-Z]\.S\.-[IVX]+/gi, replace: fields.ZoneName },
    
    // CTS patterns
    { search: /C\.T\.S\.\s*No\.\s*\d+[A-Z0-9\/\s,.-]*/gi, replace: `C.T.S. No. ${fields.CTSNo}` },
  ];
  
  patterns.forEach(({ search, replace }) => {
    result = result.replace(search, replace);
  });
  
  return result;
}

// Helper function to add text - only wrap if explicitly requested and line is too long
function addText(
  page: PDFPage,
  text: string,
  x: number,
  y: number,
  size: number,
  font: any,
  boldFont: any,
  isBold: boolean,
  maxWidth?: number,
  bottomMargin: number = 120
): number {
  if (y < bottomMargin) return y;

  const currentFont = isBold ? boldFont : font;
  const lineHeight = 14;

  // Only wrap if maxWidth is provided AND the text actually exceeds it
  if (maxWidth) {
    const textWidth = currentFont.widthOfTextAtSize(text, size);
    
    // If text fits in one line, don't wrap
    if (textWidth <= maxWidth) {
      if (y >= bottomMargin) {
        page.drawText(text, { x, y, size, font: currentFont });
      }
      return y;
    }
    
    // Only wrap if text is too long
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

    lines.forEach((lineInfo) => {
      if (lineInfo.y >= bottomMargin) {
        page.drawText(lineInfo.text, { x, y: lineInfo.y, size, font: currentFont });
      }
    });

    return currentY;
  } else {
    // No wrapping - render as single line
    if (y >= bottomMargin) {
      page.drawText(text, { x, y, size, font: currentFont });
    }
    return y;
  }
}

// Helper function to add text with field highlighting
function addTextWithHighlighting(
  page: PDFPage,
  text: string,
  x: number,
  y: number,
  size: number,
  font: any,
  boldFont: any,
  maxWidth?: number,
  bottomMargin: number = 120,
  fields?: TemplateFields
): number {
  if (y < bottomMargin) return y;

  const lineHeight = 14;
  
  // Get field values to highlight
  const fieldValues: string[] = [];
  if (fields) {
    const seen = new Set<string>();
    Object.values(fields).forEach((value) => {
      if (value && typeof value === "string" && value.trim().length > 0) {
        const trimmed = value.trim();
        if (!seen.has(trimmed)) {
          seen.add(trimmed);
          fieldValues.push(trimmed);
        }
      }
    });
    
    // Add dummy mobile and email values to fieldValues so they get bolded
    const dummyMobile = "+91-9876543210";
    const dummyEmail = "consultant@example.com";
    if (!seen.has(dummyMobile)) {
      fieldValues.push(dummyMobile);
    }
    if (!seen.has(dummyEmail)) {
      fieldValues.push(dummyEmail);
    }
  }
  
  // Check if text fits in one line - if so, don't wrap
  if (maxWidth) {
    const textWidth = font.widthOfTextAtSize(text, size);
    if (textWidth <= maxWidth) {
      maxWidth = undefined; // Don't wrap if it fits
    }
  }
  
  // Helper to draw a line with highlights
  const drawLineWithHighlights = (lineText: string, lineX: number, lineY: number) => {
    if (lineY < bottomMargin) return;
    
    if (!fields || fieldValues.length === 0) {
      page.drawText(lineText, { x: lineX, y: lineY, size, font });
      return;
    }
    
    // Find field occurrences
    const sortedFields = [...fieldValues].sort((a, b) => b.length - a.length);
    const fieldOccurrences: { start: number; end: number; value: string }[] = [];
    
    sortedFields.forEach((fieldValue) => {
      if (!fieldValue || fieldValue.length === 0) return;
      let searchIndex = 0;
      while (true) {
        const index = lineText.indexOf(fieldValue, searchIndex);
        if (index === -1) break;
        fieldOccurrences.push({
          start: index,
          end: index + fieldValue.length,
          value: fieldValue,
        });
        searchIndex = index + 1;
      }
    });
    
    // Sort and remove overlaps
    fieldOccurrences.sort((a, b) => a.start - b.start);
    const nonOverlapping: typeof fieldOccurrences = [];
    fieldOccurrences.forEach((occ) => {
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
      page.drawText(lineText, { x: lineX, y: lineY, size, font });
      return;
    }
    
    // Draw text with highlights
    let currentX = lineX;
    let textIndex = 0;
    
    nonOverlapping.forEach((occ) => {
      // Draw text before highlight
      if (occ.start > textIndex) {
        const beforeText = lineText.substring(textIndex, occ.start);
        const beforeWidth = font.widthOfTextAtSize(beforeText, size);
        page.drawText(beforeText, { x: currentX, y: lineY, size, font });
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
      page.drawText(afterText, { x: currentX, y: lineY, size, font });
    }
  };
  
  if (maxWidth) {
    const words = text.split(" ");
    let line = "";
    let currentY = y;
    let lines: { text: string; y: number }[] = [];

    for (let i = 0; i < words.length; i++) {
      const testLine = line + words[i] + " ";
      const width = font.widthOfTextAtSize(testLine, size);

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

    lines.forEach((lineInfo) => {
      drawLineWithHighlights(lineInfo.text, x, lineInfo.y);
    });

    return currentY;
  } else {
    drawLineWithHighlights(text, x, y);
    return y;
  }
}

