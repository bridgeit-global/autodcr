/**
 * PDF text extraction using pdf-parse (text-based PDFs only).
 */
import pdfParse from "pdf-parse";

export async function extractTextFromPdfBuffer(
  buffer: Buffer
): Promise<string> {
  const parsed = await pdfParse(buffer);
  const text = parsed.text.trim();

  if (!text) {
    throw new Error(
      "No extractable text found in PDF. This tool supports text-based PDFs only, not scanned images."
    );
  }

  return text;
}
