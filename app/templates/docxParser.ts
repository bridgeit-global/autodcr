import mammoth from "mammoth";
import { TemplateFields } from "./templateGenerators";
import * as fs from "fs";
import * as path from "path";

export interface ParsedDocxContent {
  text: string;
  html: string;
  paragraphs: string[];
}

/**
 * Parse a DOCX file and extract its content
 */
export async function parseDocxFile(filePath: string): Promise<ParsedDocxContent> {
  try {
    const buffer = fs.readFileSync(filePath);
    const result = await mammoth.extractRawText({ buffer });
    const htmlResult = await mammoth.convertToHtml({ buffer });
    
    const paragraphs = result.value
      .split("\n")
      .map((p) => p.trim())
      .filter((p) => p.length > 0);
    
    return {
      text: result.value,
      html: htmlResult.value,
      paragraphs,
    };
  } catch (error) {
    console.error(`Error parsing DOCX file ${filePath}:`, error);
    throw error;
  }
}

/**
 * Replace placeholders in text with field values
 */
export function replacePlaceholders(
  text: string,
  fields: TemplateFields
): string {
  let result = text;
  
  // Replace common placeholders
  const replacements: Record<string, string> = {
    "{CurrentDate}": fields.CurrentDate,
    "{WardName}": fields.WardName,
    "{ZoneName}": fields.ZoneName,
    "{OfficeAddress}": fields.OfficeAddress,
    "{CTSNo}": fields.CTSNo,
    "{VillageName}": fields.VillageName,
    "{TalukaName}": fields.TalukaName,
    "{DistrictName}": fields.DistrictName,
    "{RoadWidth}": fields.RoadWidth,
    "{RoadName}": fields.RoadName,
    "{MainRoadWidth}": fields.MainRoadWidth,
    "{MainRoadName}": fields.MainRoadName,
    "{ApplicantName}": fields.ApplicantName,
    "{FirmName}": fields.FirmName,
    "{ConsultantName}": fields.ConsultantName,
    "{ConsultantType}": fields.ConsultantType,
    "{CouncilRegNo}": fields.CouncilRegNo,
    "{RegValidityDate}": fields.RegValidityDate,
  };
  
  // Also handle variations without braces
  Object.entries(replacements).forEach(([placeholder, value]) => {
    const withoutBraces = placeholder.replace(/[{}]/g, "");
    result = result.replace(new RegExp(placeholder.replace(/[{}]/g, "\\$&"), "g"), value);
    result = result.replace(new RegExp(withoutBraces, "g"), value);
  });
  
  return result;
}

/**
 * Get the path to a template DOCX file
 */
export function getTemplatePath(templateName: string): string {
  const templatesDir = path.join(process.cwd(), "app", "templates");
  const fileName = `appointment letter (${templateName}).docx`;
  return path.join(templatesDir, fileName);
}

