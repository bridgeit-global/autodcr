import { NextRequest, NextResponse } from "next/server";
import mammoth from "mammoth";
import * as fs from "fs";
import * as path from "path";

/**
 * Clean text to remove characters that pdf-lib can't encode in WinAnsi
 * Preserves newlines for proper line structure
 */
function cleanTextPreservingLines(text: string): string {
  if (!text) return "";
  
  // Split by lines first to preserve structure
  const lines = text.split("\n");
  
  return lines
    .map((line) => {
      return line
        // Replace tabs with spaces
        .replace(/\t/g, " ")
        // Replace non-breaking spaces with regular spaces
        .replace(/\u00A0/g, " ")
        // Replace other problematic whitespace characters
        .replace(/[\u2000-\u200B\uFEFF]/g, " ")
        // Replace line/paragraph separators (keep as newline)
        .replace(/[\u2028-\u2029]/g, "\n")
        // Remove control characters except newlines and carriage returns
        .replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, "")
        // Replace smart quotes and other special characters with ASCII equivalents
        .replace(/[\u2018\u2019]/g, "'")  // Smart single quotes
        .replace(/[\u201C\u201D]/g, '"')  // Smart double quotes
        .replace(/\u2013/g, "-")          // En dash
        .replace(/\u2014/g, "--")         // Em dash
        .replace(/\u2026/g, "...")        // Ellipsis
        // Clean up multiple spaces within a line
        .replace(/[ \t]+/g, " ")
        .trim();
    })
    .join("\n");
}

export async function POST(request: NextRequest) {
  try {
    const { templateName, sourcePath } = await request.json();
    
    if (!templateName && !sourcePath) {
      return NextResponse.json(
        { error: "Template name or source path is required" },
        { status: 400 }
      );
    }
    
    let filePath = "";
    let fileName = "";

    if (sourcePath) {
      const resolvedSourcePath = path.resolve(String(sourcePath));
      const workspaceRoot = path.resolve(process.cwd());
      // Keep this endpoint scoped to workspace files for safety.
      if (!resolvedSourcePath.startsWith(workspaceRoot)) {
        return NextResponse.json(
          { error: "Source path must be inside workspace" },
          { status: 400 }
        );
      }
      filePath = resolvedSourcePath;
      fileName = path.basename(resolvedSourcePath);
    } else {
      // Get the path to the template file
      const templatesDir = path.join(process.cwd(), "app", "templates");
      fileName = `appointment letter (${templateName}).docx`;
      filePath = path.join(templatesDir, fileName);
    }
    
    // Check if file exists
    if (!fs.existsSync(filePath)) {
      return NextResponse.json(
        { error: `Template file not found: ${fileName}` },
        { status: 404 }
      );
    }
    
    // Read and parse the DOCX file
    const buffer = fs.readFileSync(filePath);
    
    // Convert to HTML first to better preserve structure
    const htmlResult = await mammoth.convertToHtml({ buffer });
    
    // Extract text from HTML, preserving paragraph breaks
    // Replace <p> tags with newlines to preserve structure
    let textFromHtml = htmlResult.value
      .replace(/<p[^>]*>/gi, "\n")  // Replace opening <p> tags with newline
      .replace(/<\/p>/gi, "")        // Remove closing </p> tags
      .replace(/<br\s*\/?>/gi, "\n") // Replace <br> tags with newlines
      .replace(/<[^>]+>/g, "")        // Remove all other HTML tags
      .replace(/&nbsp;/g, " ")        // Replace &nbsp; with space
      .replace(/&amp;/g, "&")        // Replace &amp; with &
      .replace(/&lt;/g, "<")         // Replace &lt; with <
      .replace(/&gt;/g, ">")         // Replace &gt; with >
      .replace(/&quot;/g, '"')        // Replace &quot; with "
      .replace(/&#39;/g, "'");        // Replace &#39; with '
    
    // Also get raw text as fallback
    const rawTextResult = await mammoth.extractRawText({ buffer });
    
    // Use HTML-based text as it preserves structure better
    let cleanedText = cleanTextPreservingLines(textFromHtml);
    
    // Split into lines - preserve empty lines for spacing
    const lines = cleanedText.split("\n");
    
    return NextResponse.json({
      text: cleanedText,
      html: htmlResult.value,
      lines: lines, // Return lines array to preserve structure
      paragraphs: lines.filter((p) => p.trim().length > 0),
    });
  } catch (error: any) {
    console.error("Error parsing DOCX:", error);
    return NextResponse.json(
      { error: error.message || "Failed to parse DOCX file" },
      { status: 500 }
    );
  }
}
