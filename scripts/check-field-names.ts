import {
  PDFArray,
  PDFDict,
  PDFDocument,
  PDFHexString,
  PDFName,
  PDFRef,
  PDFString,
  StandardFonts,
  rgb,
} from "pdf-lib";
import { preparePdfForNativeSigning } from "../app/lib/bridge/pdfSigningPrep";

function findPlaceholder(bytes: Uint8Array) {
  const text = new TextDecoder("latin1").decode(bytes);
  let from = 0;
  while (from < text.length) {
    const idx = text.indexOf("/ByteRange", from);
    if (idx === -1) break;
    from = idx + 10;
    let i = idx + 10;
    while (i < bytes.length && (bytes[i] === 0x20 || bytes[i] === 0x0a || bytes[i] === 0x0d)) i++;
    if (bytes[i] !== 0x5b) continue;
    let brEnd = -1;
    for (let k = i; k < bytes.length; k++) if (bytes[k] === 0x5d) { brEnd = k; break; }
    const cIdx = text.indexOf("/Contents", brEnd);
    if (cIdx === -1) continue;
    let j = cIdx + 9;
    while (j < bytes.length && (bytes[j] === 0x20 || bytes[j] === 0x0a || bytes[j] === 0x0d)) j++;
    if (bytes[j] !== 0x3c) continue;
    let cClose = -1;
    for (let k = j + 1; k < bytes.length; k++) if (bytes[k] === 0x3e) { cClose = k; break; }
    const brBody = bytes.subarray(i + 1, brEnd);
    const cBody = bytes.subarray(j + 1, cClose);
    if (
      [...brBody].some((b) => b === 0x2a) ||
      (cBody.length > 0 && [...cBody].every((b) => b === 0x30 || b === 0x20 || b === 0x0a))
    ) {
      return { brStart: i, brEnd, cOpen: j, cClose };
    }
  }
  throw new Error("no placeholder");
}

async function main() {
  const doc = await PDFDocument.create();
  const p = doc.addPage([595, 842]);
  const f = await doc.embedFont(StandardFonts.Helvetica);
  p.drawText("hi", { x: 50, y: 800, size: 14, font: f, color: rgb(0, 0, 0) });
  const base = await doc.save({ useObjectStreams: false });

  const pass1 = await preparePdfForNativeSigning(base.buffer as ArrayBuffer, {
    stamp: {
      pageIndex: 0,
      pdfX: 100,
      pdfY: 600,
      pdfWidth: 180,
      pdfHeight: 60,
      signerLabel: "A",
      signedAt: new Date(),
    },
  });

  const ph = findPlaceholder(pass1);
  const signed = new Uint8Array(pass1);
  const off1 = 0, len1 = ph.cOpen, off2 = ph.cClose + 1, len2 = pass1.length - off2;
  const targetWidth = ph.brEnd - ph.brStart + 1;
  let rendered = `[${off1} ${len1} ${off2} ${len2}]`;
  if (rendered.length < targetWidth)
    rendered = `[${off1} ${len1} ${off2} ${len2}${" ".repeat(targetWidth - rendered.length)}]`;
  new TextEncoder().encode(rendered).forEach((b, i) => (signed[ph.brStart + i] = b));
  const hexLen = ph.cClose - ph.cOpen - 1;
  const fakeHex = "AB".repeat(8) + "0".repeat(hexLen - 16);
  new TextEncoder().encode(fakeHex).forEach((b, i) => (signed[ph.cOpen + 1 + i] = b));

  const pass2 = await preparePdfForNativeSigning(signed.buffer as ArrayBuffer, {
    stamp: {
      pageIndex: 0,
      pdfX: 100,
      pdfY: 500,
      pdfWidth: 180,
      pdfHeight: 60,
      signerLabel: "B",
      signedAt: new Date(),
    },
  });

  const finalDoc = await PDFDocument.load(pass2, { updateMetadata: false });
  const acroForm = finalDoc.catalog.lookupMaybe(PDFName.of("AcroForm"), PDFDict)!;
  const fields = acroForm.lookupMaybe(PDFName.of("Fields"), PDFArray)!;
  console.log(`AcroForm /Fields has ${fields.size()} entries:`);
  for (let k = 0; k < fields.size(); k++) {
    const e = fields.get(k);
    const dict = finalDoc.context.lookup(e, PDFDict)!;
    const t = dict.get(PDFName.of("T"));
    let tStr = "(none)";
    if (t instanceof PDFString) tStr = t.asString();
    else if (t instanceof PDFHexString) tStr = t.decodeText();
    console.log(`  Fields[${k}] = ${(e as PDFRef).objectNumber} 0 R   /T = ${JSON.stringify(tStr)}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
