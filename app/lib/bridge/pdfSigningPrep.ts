import { pdflibAddPlaceholder } from "@signpdf/placeholder-pdf-lib";
import { PDFDocument, PDFFont, StandardFonts, rgb } from "pdf-lib";

export interface DscStampSpec {
  pageIndex: number;
  pdfX: number;
  pdfY: number;
  pdfWidth: number;
  pdfHeight: number;
  signerLabel: string;
  signedAt: Date;
  reason?: string;
}

export interface PrepareOptions {
  stamp?: DscStampSpec;
}

export async function preparePdfForNativeSigning(
  input: ArrayBuffer,
  options: PrepareOptions = {}
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.load(input, { updateMetadata: false });

  if (options.stamp) {
    await drawDscStamp(pdfDoc, options.stamp);
  }

  pdflibAddPlaceholder({
    pdfDoc,
    reason: options.stamp?.reason ?? "Document approval",
    contactInfo: "support@example.com",
    name: options.stamp?.signerLabel ?? "AutoDCR Signer",
    location: "IN",
    signatureLength: 12000,
  });

  return await pdfDoc.save({ useObjectStreams: false });
}

export function assertPdfHasSigningMarkers(pdfBytes: Uint8Array): void {
  const s = new TextDecoder("latin1").decode(pdfBytes);
  if (!s.includes("/ByteRange") || !s.includes("/Contents <")) {
    throw new Error(
      "PDF is missing required signing placeholders. Ensure /ByteRange and /Contents <...> exist."
    );
  }
}

async function drawDscStamp(pdfDoc: PDFDocument, s: DscStampSpec): Promise<void> {
  const page = pdfDoc.getPage(s.pageIndex);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  page.drawRectangle({
    x: s.pdfX,
    y: s.pdfY,
    width: s.pdfWidth,
    height: s.pdfHeight,
    borderColor: rgb(0, 0.3, 0.6),
    borderWidth: 0.75,
    color: rgb(0.94, 0.97, 1.0),
  });

  const isoDate = s.signedAt.toISOString().replace("T", " ").slice(0, 19);
  const lines: Array<{ text: string; font: PDFFont; size: number }> = [
    { text: "Digitally signed", font: bold, size: 8 },
    { text: `By: ${s.signerLabel}`, font, size: 7 },
    { text: `Date: ${isoDate} UTC`, font, size: 7 },
    { text: `Reason: ${s.reason ?? "Document approval"}`, font, size: 7 },
  ];

  const padX = 4;
  const lineGap = 2;
  const innerWidth = s.pdfWidth - 2 * padX;
  let cursorY = s.pdfY + s.pdfHeight - 10;
  for (const line of lines) {
    if (cursorY < s.pdfY + 2) break;
    page.drawText(truncateToWidth(line.text, line.font, line.size, innerWidth), {
      x: s.pdfX + padX,
      y: cursorY,
      size: line.size,
      font: line.font,
      color: rgb(0, 0.2, 0.5),
    });
    cursorY -= line.size + lineGap;
  }
}

function truncateToWidth(text: string, font: PDFFont, size: number, maxWidth: number): string {
  if (font.widthOfTextAtSize(text, size) <= maxWidth) return text;
  const ellipsis = "…";
  const ellipsisWidth = font.widthOfTextAtSize(ellipsis, size);
  let lo = 0;
  let hi = text.length;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    const w = font.widthOfTextAtSize(text.slice(0, mid), size) + ellipsisWidth;
    if (w <= maxWidth) lo = mid;
    else hi = mid - 1;
  }
  return text.slice(0, lo) + ellipsis;
}
