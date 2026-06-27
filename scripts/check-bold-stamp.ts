/**
 * Verify owner + consultant DSC stamps both embed Helvetica-Bold in page content.
 */
import { writeFileSync } from "fs";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { preparePdfForNativeSigning } from "../app/lib/bridge/pdfSigningPrep";

async function buildBase(): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([595.28, 841.89]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  page.drawText("test", { x: 50, y: 800, size: 14, font, color: rgb(0, 0, 0) });
  return doc.save({ useObjectStreams: false });
}

function fakeSign(bytes: Uint8Array): Uint8Array {
  const s = new TextDecoder("latin1").decode(bytes);
  const idx = s.indexOf("/ByteRange");
  const brStart = s.indexOf("[", idx);
  const brEnd = s.indexOf("]", brStart);
  const cIdx = s.indexOf("/Contents", brEnd);
  let j = cIdx + "/Contents".length;
  while (" \n\r\t".includes(s[j])) j += 1;
  const cOpen = j;
  const cClose = s.indexOf(">", cOpen);
  const off1 = 0;
  const len1 = cOpen;
  const off2 = cClose + 1;
  const len2 = bytes.length - off2;
  let rendered = `[${off1} ${len1} ${off2} ${len2}]`;
  const target = brEnd - brStart + 1;
  if (rendered.length < target) rendered += " ".repeat(target - rendered.length);
  const out = new Uint8Array(bytes);
  out.set(new TextEncoder().encode(rendered), brStart);
  const hexLen = cClose - cOpen - 1;
  out.set(new TextEncoder().encode("AB".repeat(8) + "0".repeat(hexLen - 16)), cOpen + 1);
  return out;
}

async function main() {
  const base = await buildBase();
  const fresh = await preparePdfForNativeSigning(base.buffer as ArrayBuffer, {
    stamp: {
      pageIndex: 0,
      pdfX: 56,
      pdfY: 161,
      pdfWidth: 180,
      pdfHeight: 60,
      signerLabel: "OWNER NAME",
      signedAt: new Date("2026-06-25T12:00:00"),
    },
  });
  const signed = fakeSign(fresh);
  const incr = await preparePdfForNativeSigning(signed.buffer as ArrayBuffer, {
    stamp: {
      pageIndex: 0,
      pdfX: 320,
      pdfY: 161,
      pdfWidth: 180,
      pdfHeight: 60,
      signerLabel: "CONSULTANT NAME",
      signedAt: new Date("2026-06-25T13:00:00"),
    },
  });

  const text = new TextDecoder("latin1").decode(incr);
  const boldCount = (text.match(/Helvetica-Bold/g) || []).length;
  const sigValidCount = (text.match(/Signature valid/g) || []).length;
  console.log({
    boldCount,
    sigValidCount,
    ownerName: (text.match(/OWNER NAME/g) || []).length,
    consultantName: (text.match(/CONSULTANT NAME/g) || []).length,
    incrLen: incr.length,
  });

  const doc = await PDFDocument.load(incr, { updateMetadata: false });
  const page = doc.getPage(0);
  const { PDFName, PDFArray, PDFRef, PDFStream } = await import("pdf-lib");
  const contents = page.node.lookup(PDFName.of("Contents"));
  const streamRefs: unknown[] = [];
  if (contents instanceof PDFRef) streamRefs.push(contents);
  else if (contents instanceof PDFArray) {
    for (let i = 0; i < contents.size(); i += 1) streamRefs.push(contents.get(i));
  }
  console.log(`page content streams: ${streamRefs.length}`);
  writeFileSync("/tmp/test-incr.pdf", incr);
  console.log("wrote /tmp/test-incr.pdf");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
