/**
 * Smoke test for app/lib/bridge/pdfSigningPrep.ts:
 *
 *   1. Build a tiny PDF with pdf-lib.
 *   2. Run preparePdfForNativeSigning in "fresh" mode → unsigned PDF + placeholder.
 *   3. Splice a fake CMS signature into the placeholder so the PDF looks like
 *      it was just signed by the native host.
 *   4. Run preparePdfForNativeSigning again on those bytes — this should take
 *      the incremental-update path. Verify:
 *        - the original byte prefix is preserved verbatim
 *        - the output contains TWO /ByteRange entries (one filled, one placeholder)
 *        - the trailer has a /Prev entry pointing at the prior xref
 *   5. Sanity-check the second pass's placeholder is locatable by the same
 *      heuristic the Rust native host uses (asterisks in the array body, or
 *      all-zero Contents).
 *
 * Run with `npx tsx scripts/test-sequential-sign.ts`.
 */

import { createHash } from "crypto";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import {
  preparePdfForNativeSigning,
  assertPdfHasSigningMarkers,
} from "../app/lib/bridge/pdfSigningPrep";

function parseFirstFilledByteRange(bytes: Uint8Array): [number, number, number, number] {
  // Scan for the first /ByteRange whose body is all digits/whitespace.
  let from = 0;
  while (from < bytes.length) {
    const idx = indexOfBytes(bytes, "/ByteRange", from);
    if (idx === -1) break;
    from = idx + "/ByteRange".length;
    let i = idx + "/ByteRange".length;
    while (i < bytes.length && (bytes[i] === 0x20 || bytes[i] === 0x0a || bytes[i] === 0x0d || bytes[i] === 0x09)) i += 1;
    if (bytes[i] !== 0x5b) continue;
    let end = -1;
    for (let k = i; k < bytes.length; k += 1) if (bytes[k] === 0x5d) { end = k; break; }
    if (end === -1) continue;
    const body = new TextDecoder("latin1").decode(bytes.subarray(i + 1, end));
    if (/[*]/.test(body)) continue;
    const nums = body.trim().split(/\s+/).map(Number);
    if (nums.length === 4 && nums.every((n) => Number.isFinite(n))) {
      return nums as [number, number, number, number];
    }
  }
  throw new Error("Could not parse first filled /ByteRange");
}

function digestByteRange(bytes: Uint8Array, range: [number, number, number, number]): string {
  const h = createHash("sha256");
  h.update(bytes.subarray(range[0], range[0] + range[1]));
  h.update(bytes.subarray(range[2], range[2] + range[3]));
  return h.digest("hex");
}

const assert = (cond: unknown, msg: string) => {
  if (!cond) {
    console.error(`FAIL: ${msg}`);
    process.exit(1);
  }
};

function indexOfBytes(haystack: Uint8Array, needle: string, from = 0): number {
  const needleBytes = new TextEncoder().encode(needle);
  outer: for (let i = from; i <= haystack.length - needleBytes.length; i += 1) {
    for (let j = 0; j < needleBytes.length; j += 1) {
      if (haystack[i + j] !== needleBytes[j]) continue outer;
    }
    return i;
  }
  return -1;
}

function countOccurrences(haystack: Uint8Array, needle: string): number {
  let from = 0;
  let count = 0;
  for (;;) {
    const idx = indexOfBytes(haystack, needle, from);
    if (idx === -1) break;
    count += 1;
    from = idx + needle.length;
  }
  return count;
}

function findPlaceholder(bytes: Uint8Array): {
  byteRangeStart: number;
  byteRangeEnd: number;
  contentsOpen: number;
  contentsClose: number;
} {
  // Mirror the Rust native host's placeholder selection: scan every
  // /ByteRange occurrence and pick the one with asterisks or all-zero hex.
  let searchFrom = 0;
  while (searchFrom < bytes.length) {
    const idx = indexOfBytes(bytes, "/ByteRange", searchFrom);
    if (idx === -1) break;
    searchFrom = idx + "/ByteRange".length;
    let i = idx + "/ByteRange".length;
    while (i < bytes.length && (bytes[i] === 0x20 || bytes[i] === 0x0a || bytes[i] === 0x0d || bytes[i] === 0x09)) {
      i += 1;
    }
    if (bytes[i] !== 0x5b) continue; // '['
    const brStart = i;
    let brEnd = -1;
    for (let k = i; k < bytes.length; k += 1) {
      if (bytes[k] === 0x5d) {
        brEnd = k;
        break;
      }
    }
    if (brEnd === -1) continue;

    const contentsIdx = indexOfBytes(bytes, "/Contents", brEnd + 1);
    if (contentsIdx === -1) continue;
    let j = contentsIdx + "/Contents".length;
    while (j < bytes.length && (bytes[j] === 0x20 || bytes[j] === 0x0a || bytes[j] === 0x0d || bytes[j] === 0x09)) {
      j += 1;
    }
    if (bytes[j] !== 0x3c) continue; // '<'
    const cOpen = j;
    let cClose = -1;
    for (let k = j + 1; k < bytes.length; k += 1) {
      if (bytes[k] === 0x3e) {
        cClose = k;
        break;
      }
    }
    if (cClose === -1) continue;

    const brBody = bytes.subarray(brStart + 1, brEnd);
    const cBody = bytes.subarray(cOpen + 1, cClose);
    const hasAsterisk = brBody.some((b) => b === 0x2a);
    const allZero =
      cBody.length > 0 && cBody.every((b) => b === 0x30 || b === 0x20 || b === 0x0a || b === 0x0d || b === 0x09);
    if (hasAsterisk || allZero) {
      return { byteRangeStart: brStart, byteRangeEnd: brEnd, contentsOpen: cOpen, contentsClose: cClose };
    }
  }
  throw new Error("No placeholder /ByteRange found");
}

async function buildBasePdf(): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([595.28, 841.89]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  page.drawText("Sequential sign smoke test", {
    x: 50,
    y: 800,
    size: 14,
    font,
    color: rgb(0, 0, 0),
  });
  return await doc.save({ useObjectStreams: false });
}

function fakeSignInPlace(bytes: Uint8Array): Uint8Array {
  // Pretend to be the native host: fill in /ByteRange and replace the all-zero
  // /Contents hex with a chunk of plausible-looking hex bytes. Output must be
  // identical in size to the input.
  const ph = findPlaceholder(bytes);
  const targetWidth = ph.byteRangeEnd - ph.byteRangeStart + 1;
  const off1 = 0;
  const len1 = ph.contentsOpen;
  const off2 = ph.contentsClose + 1;
  const len2 = bytes.length - off2;
  let rendered = `[${off1} ${len1} ${off2} ${len2}]`;
  if (rendered.length < targetWidth) {
    rendered = `[${off1} ${len1} ${off2} ${len2}${" ".repeat(targetWidth - rendered.length)}]`;
  }
  assert(rendered.length === targetWidth, "rendered ByteRange must match width");

  const out = new Uint8Array(bytes.length);
  out.set(bytes, 0);
  const enc = new TextEncoder();
  out.set(enc.encode(rendered), ph.byteRangeStart);

  // Replace Contents hex with a chunk of `AB...` followed by zero padding.
  const hexLen = ph.contentsClose - ph.contentsOpen - 1;
  const fakeBody = "AB".repeat(8) + "0".repeat(hexLen - 16);
  assert(fakeBody.length === hexLen, "fake contents body must fill hex region");
  out.set(enc.encode(fakeBody), ph.contentsOpen + 1);
  return out;
}

async function main() {
  const baseBytes = await buildBasePdf();

  console.log(`base PDF: ${baseBytes.length} bytes`);

  const preparedFresh = await preparePdfForNativeSigning(baseBytes.buffer as ArrayBuffer, {
    stamp: {
      pageIndex: 0,
      pdfX: 100,
      pdfY: 600,
      pdfWidth: 180,
      pdfHeight: 60,
      signerLabel: "Test Signer Alpha",
      signedAt: new Date(),
      reason: "Document approval",
    },
  });
  assertPdfHasSigningMarkers(preparedFresh);
  console.log(`fresh prepared PDF: ${preparedFresh.length} bytes`);
  const freshByteRangeCount = countOccurrences(preparedFresh, "/ByteRange");
  assert(freshByteRangeCount === 1, `expected 1 /ByteRange in fresh prep, got ${freshByteRangeCount}`);

  // Step 3: pretend the native host filled the placeholder.
  const signed = fakeSignInPlace(preparedFresh);
  assert(signed.length === preparedFresh.length, "signed length must equal prepared length");
  console.log(`fake-signed PDF: ${signed.length} bytes (same length as prepared)`);

  // Step 4: re-prepare. Must take the incremental path.
  const preparedSecond = await preparePdfForNativeSigning(signed.buffer as ArrayBuffer, {
    stamp: {
      pageIndex: 0,
      pdfX: 100,
      pdfY: 500,
      pdfWidth: 180,
      pdfHeight: 60,
      signerLabel: "Test Signer Bravo",
      signedAt: new Date(),
      reason: "Document approval",
    },
  });
  console.log(`incrementally prepared PDF: ${preparedSecond.length} bytes`);

  // Original byte prefix must be preserved verbatim — this is the whole point
  // of an incremental update.
  assert(preparedSecond.length > signed.length, "incremental update must grow the file");
  for (let i = 0; i < signed.length; i += 1) {
    if (preparedSecond[i] !== signed[i]) {
      console.error(`byte mismatch at index ${i}`);
      console.error(`  prior:  ${signed[i].toString(16)}`);
      console.error(`  output: ${preparedSecond[i].toString(16)}`);
      process.exit(1);
    }
  }
  console.log("original bytes preserved verbatim — incremental invariant holds");

  // Two /ByteRange entries: one filled (the fake signature) and one placeholder.
  const secondByteRangeCount = countOccurrences(preparedSecond, "/ByteRange");
  assert(
    secondByteRangeCount === 2,
    `expected 2 /ByteRange in incremental prep, got ${secondByteRangeCount}`
  );

  // The new placeholder must be findable by the host's selector.
  const newPh = findPlaceholder(preparedSecond);
  console.log(
    `placeholder located at byteRange=[${newPh.byteRangeStart}..${newPh.byteRangeEnd}], contents=[${newPh.contentsOpen}..${newPh.contentsClose}]`
  );

  // The trailer must include /Prev pointing at the prior startxref (= the
  // original PDF's startxref).
  const trailerText = new TextDecoder("latin1").decode(
    preparedSecond.subarray(preparedSecond.length - Math.min(4096, preparedSecond.length))
  );
  assert(
    /\/Prev\s+\d+/.test(trailerText),
    `incremental trailer must include /Prev — tail was:\n${trailerText.slice(-512)}`
  );
  assert(
    /startxref\s+\d+\s+%%EOF/.test(trailerText),
    "incremental output must end with valid startxref/%%EOF"
  );
  console.log("trailer has /Prev and proper startxref/%%EOF");

  // assertPdfHasSigningMarkers must still pass.
  assertPdfHasSigningMarkers(preparedSecond);

  // Critical regression check: the FIRST signature's hashed byte range must
  // still cover the same content. The fake CMS we spliced in earlier embedded
  // a /ByteRange of `[0 N1 N2 N3]` over the original `signed` bytes. Those
  // four numbers stay numerically valid even in the appended file (we never
  // changed the first N1+N3 bytes of the original prefix and the gap between
  // them is the original /Contents hex range), so a verifier digesting the
  // first signature's byte range against `preparedSecond` must produce the
  // same hash as against `signed`.
  const firstSigByteRange = parseFirstFilledByteRange(preparedSecond);
  console.log(`first signature byteRange parsed: ${JSON.stringify(firstSigByteRange)}`);
  const digestPriorBytes = digestByteRange(signed, firstSigByteRange);
  const digestAfterBytes = digestByteRange(preparedSecond, firstSigByteRange);
  assert(
    digestPriorBytes === digestAfterBytes,
    `first signature's byte range digest changed!\n  before: ${digestPriorBytes}\n  after:  ${digestAfterBytes}`
  );
  console.log("first signature's hashed byte range is byte-identical across revisions");

  console.log("\nALL CHECKS PASSED");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
