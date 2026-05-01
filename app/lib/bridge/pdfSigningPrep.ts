import { pdflibAddPlaceholder } from "@signpdf/placeholder-pdf-lib";
import { PDFDocument } from "pdf-lib";

export async function preparePdfForNativeSigning(input: ArrayBuffer): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.load(input, { updateMetadata: false });

  pdflibAddPlaceholder({
    pdfDoc,
    reason: "Document approval",
    contactInfo: "support@example.com",
    name: "AutoDCR Signer",
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
