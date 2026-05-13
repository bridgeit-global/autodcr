/**
 * Diagnostic: run a fresh + incremental sign pair, then dump per-revision
 * state from the final PDF so we can answer "did the first signature's widget
 * survive into the second revision?" — the question behind Adobe's
 * "Annotations Deleted: Widget annot on page 1" warning.
 */

import { PDFArray, PDFDict, PDFDocument, PDFName, PDFRef, StandardFonts, rgb } from "pdf-lib";
import { preparePdfForNativeSigning } from "../app/lib/bridge/pdfSigningPrep";

function indexOfBytes(haystack: Uint8Array, needle: string, from = 0): number {
  const nb = new TextEncoder().encode(needle);
  outer: for (let i = from; i <= haystack.length - nb.length; i += 1) {
    for (let j = 0; j < nb.length; j += 1) if (haystack[i + j] !== nb[j]) continue outer;
    return i;
  }
  return -1;
}

function findPlaceholder(bytes: Uint8Array) {
  let from = 0;
  while (from < bytes.length) {
    const idx = indexOfBytes(bytes, "/ByteRange", from);
    if (idx === -1) break;
    from = idx + 10;
    let i = idx + 10;
    while (i < bytes.length && (bytes[i] === 0x20 || bytes[i] === 0x0a || bytes[i] === 0x0d)) i++;
    if (bytes[i] !== 0x5b) continue;
    let brEnd = -1;
    for (let k = i; k < bytes.length; k++) if (bytes[k] === 0x5d) { brEnd = k; break; }
    if (brEnd === -1) continue;
    const cIdx = indexOfBytes(bytes, "/Contents", brEnd);
    if (cIdx === -1) continue;
    let j = cIdx + 9;
    while (j < bytes.length && (bytes[j] === 0x20 || bytes[j] === 0x0a || bytes[j] === 0x0d)) j++;
    if (bytes[j] !== 0x3c) continue;
    let cClose = -1;
    for (let k = j + 1; k < bytes.length; k++) if (bytes[k] === 0x3e) { cClose = k; break; }
    if (cClose === -1) continue;
    const brBody = bytes.subarray(i + 1, brEnd);
    const cBody = bytes.subarray(j + 1, cClose);
    const hasAsterisk = [...brBody].some((b) => b === 0x2a);
    const allZero =
      cBody.length > 0 && [...cBody].every((b) => b === 0x30 || b === 0x20 || b === 0x0a || b === 0x0d);
    if (hasAsterisk || allZero) return { brStart: i, brEnd, cOpen: j, cClose };
  }
  throw new Error("No placeholder found");
}

async function dumpState(label: string, bytes: Uint8Array): Promise<void> {
  console.log(`\n===== ${label} (${bytes.length} bytes) =====`);
  const text = new TextDecoder("latin1").decode(bytes);
  const sigCount = (text.match(/\/Type\s*\/Sig\b/g) || []).length;
  console.log(`/Type /Sig occurrences: ${sigCount}`);
  const sigRe = /\/ByteRange\s*\[([^\]]+)\]\s*\/Contents\s*<([0-9a-fA-F\s\*]*)>/g;
  let m: RegExpExecArray | null;
  let idx = 0;
  while ((m = sigRe.exec(text)) !== null) {
    const range = m[1].trim();
    const hex = m[2].replace(/\s+/g, "");
    const filled = hex.length > 0 && /[1-9a-fA-F]/.test(hex);
    const hasAst = m[1].includes("*");
    console.log(`  /ByteRange #${idx++}: [${range}]  contents.len=${hex.length}  placeholder=${hasAst || !filled}`);
  }

  // Look at page 0 + AcroForm via pdf-lib's parser.
  const pdfDoc = await PDFDocument.load(bytes, { updateMetadata: false });
  const page0 = pdfDoc.getPage(0);
  const annotsArr = page0.node.lookupMaybe(PDFName.of("Annots"), PDFArray);
  console.log(`page0 /Annots entries: ${annotsArr?.size() ?? 0}`);
  if (annotsArr) {
    for (let k = 0; k < annotsArr.size(); k++) {
      const e = annotsArr.get(k);
      const refStr = e instanceof PDFRef ? `${e.objectNumber} ${e.generationNumber} R` : "(inline)";
      const dict = e instanceof PDFRef ? pdfDoc.context.lookup(e, PDFDict) : null;
      const subtype = dict?.lookupMaybe(PDFName.of("Subtype"), PDFName)?.toString();
      const ft = dict?.lookupMaybe(PDFName.of("FT"), PDFName)?.toString();
      const v = dict?.get(PDFName.of("V"));
      const vStr = v instanceof PDFRef ? `${v.objectNumber} ${v.generationNumber} R` : "—";
      console.log(`    Annots[${k}] = ${refStr}  Subtype=${subtype}  FT=${ft}  V=${vStr}`);
    }
  }
  const acroForm = pdfDoc.catalog.lookupMaybe(PDFName.of("AcroForm"), PDFDict);
  if (acroForm) {
    const fields = acroForm.lookupMaybe(PDFName.of("Fields"), PDFArray);
    console.log(`AcroForm /Fields entries: ${fields?.size() ?? 0}`);
    if (fields) {
      for (let k = 0; k < fields.size(); k++) {
        const e = fields.get(k);
        const refStr = e instanceof PDFRef ? `${e.objectNumber} ${e.generationNumber} R` : "(inline)";
        console.log(`    Fields[${k}] = ${refStr}`);
      }
    }
  }
}

async function main() {
  const doc = await PDFDocument.create();
  const page = doc.addPage([595, 842]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  page.drawText("Sequential sign trace", { x: 50, y: 800, size: 14, font, color: rgb(0, 0, 0) });
  const base = await doc.save({ useObjectStreams: false });
  await dumpState("ORIGINAL (pre-sign)", base);

  const pass1Prepared = await preparePdfForNativeSigning(base.buffer as ArrayBuffer, {
    stamp: {
      pageIndex: 0,
      pdfX: 100,
      pdfY: 600,
      pdfWidth: 180,
      pdfHeight: 60,
      signerLabel: "Signer Alpha",
      signedAt: new Date(),
      reason: "Document approval",
    },
  });
  await dumpState("PASS 1: prepared (placeholder only)", pass1Prepared);

  // Splice in fake CMS.
  const ph = findPlaceholder(pass1Prepared);
  const off1 = 0;
  const len1 = ph.cOpen;
  const off2 = ph.cClose + 1;
  const len2 = pass1Prepared.length - off2;
  const targetWidth = ph.brEnd - ph.brStart + 1;
  let rendered = `[${off1} ${len1} ${off2} ${len2}]`;
  if (rendered.length < targetWidth)
    rendered = `[${off1} ${len1} ${off2} ${len2}${" ".repeat(targetWidth - rendered.length)}]`;
  const signed = new Uint8Array(pass1Prepared);
  new TextEncoder().encode(rendered).forEach((b, i) => (signed[ph.brStart + i] = b));
  const hexLen = ph.cClose - ph.cOpen - 1;
  const fakeHex = "AB".repeat(8) + "0".repeat(hexLen - 16);
  new TextEncoder().encode(fakeHex).forEach((b, i) => (signed[ph.cOpen + 1 + i] = b));
  await dumpState("PASS 1: signed (filled placeholder)", signed);

  const pass2Prepared = await preparePdfForNativeSigning(signed.buffer as ArrayBuffer, {
    stamp: {
      pageIndex: 0,
      pdfX: 100,
      pdfY: 500,
      pdfWidth: 180,
      pdfHeight: 60,
      signerLabel: "Signer Bravo",
      signedAt: new Date(),
      reason: "Document approval",
    },
  });
  await dumpState("PASS 2: prepared (incremental update)", pass2Prepared);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
