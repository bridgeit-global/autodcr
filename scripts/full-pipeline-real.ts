/**
 * Full end-to-end simulation against the user's real signed-KG.pdf:
 *   1. Call preparePdfForNativeSigning (incremental path).
 *   2. Splice a plausible CMS into the new placeholder exactly the way the
 *      Rust native host does it: find the placeholder, render real
 *      /ByteRange numbers over the asterisk-pattern, fill /Contents with hex.
 *   3. Write the result to disk for visual verification.
 *   4. Verify Rev 1's pre-existing digest still matches the bytes in the
 *      finished file.
 */

import { createHash } from "crypto";
import { readFileSync, writeFileSync } from "fs";
import { preparePdfForNativeSigning } from "../app/lib/bridge/pdfSigningPrep";

function indexOfBytes(haystack: Uint8Array, needle: string, from = 0): number {
  const nb = new TextEncoder().encode(needle);
  outer: for (let i = from; i <= haystack.length - nb.length; i += 1) {
    for (let j = 0; j < nb.length; j += 1) if (haystack[i + j] !== nb[j]) continue outer;
    return i;
  }
  return -1;
}

function isWs(b: number) { return b === 0x20 || b === 0x0a || b === 0x0d || b === 0x09; }

function locateAllPlaceholders(bytes: Uint8Array) {
  const results: Array<{ brStart: number; brEnd: number; cOpen: number; cClose: number; isPlaceholder: boolean }> = [];
  let from = 0;
  while (from < bytes.length) {
    const idx = indexOfBytes(bytes, "/ByteRange", from);
    if (idx === -1) break;
    from = idx + "/ByteRange".length;
    let i = idx + "/ByteRange".length;
    while (i < bytes.length && isWs(bytes[i])) i += 1;
    if (bytes[i] !== 0x5b) continue;
    let brEnd = -1;
    for (let k = i; k < bytes.length; k += 1) if (bytes[k] === 0x5d) { brEnd = k; break; }
    if (brEnd === -1) continue;
    const cIdx = indexOfBytes(bytes, "/Contents", brEnd);
    if (cIdx === -1) continue;
    let j = cIdx + "/Contents".length;
    while (j < bytes.length && isWs(bytes[j])) j += 1;
    if (bytes[j] !== 0x3c) continue;
    let cClose = -1;
    for (let k = j + 1; k < bytes.length; k += 1) if (bytes[k] === 0x3e) { cClose = k; break; }
    if (cClose === -1) continue;
    const brBody = bytes.subarray(i + 1, brEnd);
    const cBody = bytes.subarray(j + 1, cClose);
    const isPlaceholder = [...brBody].some((b) => b === 0x2a) || (cBody.length > 0 && [...cBody].every((b) => b === 0x30 || isWs(b)));
    results.push({ brStart: i, brEnd, cOpen: j, cClose, isPlaceholder });
  }
  return results;
}

function simulateNativeHostSplice(input: Uint8Array): Uint8Array {
  // Mirror native-host/src/pdf.rs locate_placeholder + render_byte_range + splice.
  const all = locateAllPlaceholders(input);
  const ph = all.find((p) => p.isPlaceholder);
  if (!ph) throw new Error("no placeholder to fill");
  const targetWidth = ph.brEnd - ph.brStart + 1;
  const off1 = 0, len1 = ph.cOpen, off2 = ph.cClose + 1, len2 = input.length - off2;
  let rendered = `[${off1} ${len1} ${off2} ${len2}]`;
  if (rendered.length < targetWidth)
    rendered = `[${off1} ${len1} ${off2} ${len2}${" ".repeat(targetWidth - rendered.length)}]`;
  if (rendered.length !== targetWidth) throw new Error("rendered width mismatch");

  const hexLen = ph.cClose - ph.cOpen - 1;
  // Plausible CMS-ish hex content (just to keep the file well-formed for Adobe inspection).
  // Real native host emits a DER-encoded SignedData; for our reproducibility test we just
  // fill with non-zero bytes so Adobe treats this as a "completed" signature field.
  const fakeCms = "3082".repeat(20) + "0".repeat(hexLen - 80);
  if (fakeCms.length !== hexLen) throw new Error("hex fill width mismatch");

  const out = new Uint8Array(input);
  new TextEncoder().encode(rendered).forEach((b, i) => (out[ph.brStart + i] = b));
  new TextEncoder().encode(fakeCms).forEach((b, i) => (out[ph.cOpen + 1 + i] = b));
  return out;
}

async function main() {
  const orig = new Uint8Array(readFileSync("/Users/Faisalansari/Downloads/signed-KG.pdf"));
  console.log(`signed-KG.pdf size:        ${orig.length}`);

  const prepared = await preparePdfForNativeSigning(orig.buffer as ArrayBuffer, {
    stamp: {
      pageIndex: 0,
      pdfX: 100,
      pdfY: 200,
      pdfWidth: 200,
      pdfHeight: 60,
      signerLabel: "Test Sequential Signer",
      signedAt: new Date(),
      reason: "Document approval",
    },
  });
  console.log(`prepared size:             ${prepared.length}`);

  // Native host splice.
  const finalBytes = simulateNativeHostSplice(prepared);
  console.log(`final size:                ${finalBytes.length}`);
  writeFileSync("/tmp/final-sequential.pdf", Buffer.from(finalBytes));
  console.log("wrote /tmp/final-sequential.pdf");

  // Verify Rev 1's digest is preserved against the finished file.
  const all = locateAllPlaceholders(finalBytes);
  console.log(`\nfinal file has ${all.length} /ByteRange entries:`);
  for (const ph of all) {
    const brBody = new TextDecoder("latin1").decode(finalBytes.subarray(ph.brStart + 1, ph.brEnd));
    const nums = brBody.trim().split(/\s+/).map(Number);
    console.log(`  ByteRange: [${nums.join(" ")}]  isPlaceholder=${ph.isPlaceholder}`);
  }

  // Rev 1's digest from original.
  const range = [0, 709645, 721647, 20284];
  const origDigest = (() => { const h = createHash("sha256"); h.update(orig.subarray(0, 709645)); h.update(orig.subarray(721647, 721647 + 20284)); return h.digest("hex"); })();
  const finalDigest = (() => { const h = createHash("sha256"); h.update(finalBytes.subarray(0, 709645)); h.update(finalBytes.subarray(721647, 721647 + 20284)); return h.digest("hex"); })();
  console.log(`\nRev 1 digest in signed-KG.pdf:        ${origDigest}`);
  console.log(`Rev 1 digest in /tmp/final-sequential: ${finalDigest}`);
  console.log(`Rev 1 verification: ${origDigest === finalDigest ? "PASS — Adobe should mark Rev 1 valid" : "FAIL"}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
