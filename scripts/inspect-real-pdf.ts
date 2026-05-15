/**
 * Inspect a real-world signed PDF: dump every /ByteRange + /Contents pair,
 * compute the SHA-256 over each signature's declared byte range, and report
 * whether that digest still matches the bytes currently in the file. Adobe's
 * "Document has been altered or corrupted since it was signed" warning fires
 * when this check fails.
 *
 * Usage: npx tsx scripts/inspect-real-pdf.ts <pdf>
 */

import { createHash } from "crypto";
import { readFileSync } from "fs";
import { PDFArray, PDFDict, PDFDocument, PDFName, PDFRef, StandardFonts } from "pdf-lib";

function indexOfBytes(haystack: Uint8Array, needle: string, from = 0): number {
  const nb = new TextEncoder().encode(needle);
  outer: for (let i = from; i <= haystack.length - nb.length; i += 1) {
    for (let j = 0; j < nb.length; j += 1) if (haystack[i + j] !== nb[j]) continue outer;
    return i;
  }
  return -1;
}

function isWs(b: number) {
  return b === 0x20 || b === 0x0a || b === 0x0d || b === 0x09 || b === 0x0c;
}

function scanSignatures(bytes: Uint8Array) {
  const results: Array<{
    brStart: number;
    brEnd: number;
    cOpen: number;
    cClose: number;
    range: number[] | null;
    isPlaceholder: boolean;
  }> = [];
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
    const brBody = new TextDecoder("latin1").decode(bytes.subarray(i + 1, brEnd));
    const hasAst = brBody.includes("*");
    let range: number[] | null = null;
    if (!hasAst) {
      const nums = brBody.trim().split(/\s+/).map(Number);
      if (nums.length === 4 && nums.every((n) => Number.isFinite(n))) range = nums;
    }
    const cIdx = indexOfBytes(bytes, "/Contents", brEnd);
    if (cIdx === -1) continue;
    let j = cIdx + "/Contents".length;
    while (j < bytes.length && isWs(bytes[j])) j += 1;
    if (bytes[j] !== 0x3c) continue;
    let cClose = -1;
    for (let k = j + 1; k < bytes.length; k += 1) if (bytes[k] === 0x3e) { cClose = k; break; }
    if (cClose === -1) continue;
    const cBody = bytes.subarray(j + 1, cClose);
    const isPlaceholder = hasAst || (cBody.length > 0 && [...cBody].every((b) => b === 0x30 || isWs(b)));
    results.push({ brStart: i, brEnd, cOpen: j, cClose, range, isPlaceholder });
  }
  return results;
}

function digestRange(bytes: Uint8Array, range: number[]): string {
  const h = createHash("sha256");
  h.update(bytes.subarray(range[0], range[0] + range[1]));
  h.update(bytes.subarray(range[2], range[2] + range[3]));
  return h.digest("hex");
}

async function main() {
  const path = process.argv[2];
  if (!path) {
    console.error("usage: inspect-real-pdf.ts <pdf>");
    process.exit(2);
  }
  const bytes = new Uint8Array(readFileSync(path));
  console.log(`File: ${path}  size=${bytes.length}`);

  // Show last 200 bytes — useful for spotting where revisions end.
  const tail = new TextDecoder("latin1").decode(bytes.subarray(Math.max(0, bytes.length - 200)));
  console.log("--- tail (last 200 bytes) ---");
  console.log(tail.replace(/[\x00-\x1f\x80-\xff]/g, "."));
  console.log("--- end tail ---");

  const sigs = scanSignatures(bytes);
  console.log(`\nfound ${sigs.length} /ByteRange entries`);
  sigs.forEach((s, k) => {
    console.log(
      `  #${k}: brStart=${s.brStart}  brEnd=${s.brEnd}  cOpen=${s.cOpen}  cClose=${s.cClose}  isPlaceholder=${s.isPlaceholder}  range=${JSON.stringify(s.range)}`
    );
    if (s.range) {
      const expectedFileLen = s.range[2] + s.range[3];
      const matchesFile = expectedFileLen === bytes.length;
      console.log(
        `       byte range covers off1..len1=${s.range[0]}..${s.range[1]}  off2..len2=${s.range[2]}..${s.range[3]}  endsAtFileLen=${matchesFile} (file=${bytes.length})`
      );
      const digest = digestRange(bytes, s.range);
      console.log(`       sha256 over range = ${digest}`);
      // Also check: does the byte at off2 line up with the closing '>' of Contents + 1?
      const afterContents = s.cClose + 1;
      console.log(
        `       afterContents=${afterContents}  off2=${s.range[2]}  diff=${s.range[2] - afterContents}`
      );
    }
  });

  // Find every "startxref" + value and dump.
  const text = new TextDecoder("latin1").decode(bytes);
  const sxRe = /startxref\s+(\d+)/g;
  console.log("\nstartxref values (chronological):");
  let m: RegExpExecArray | null;
  while ((m = sxRe.exec(text)) !== null) {
    console.log(`  at byte ${m.index}  → ${m[1]}`);
  }
  // Find /Prev in trailers.
  const prevRe = /\/Prev\s+(\d+)/g;
  console.log("\n/Prev values:");
  while ((m = prevRe.exec(text)) !== null) {
    console.log(`  at byte ${m.index}  → ${m[1]}`);
  }

  // Try loading with pdf-lib and dumping the key form structure.
  try {
    const doc = await PDFDocument.load(bytes, { updateMetadata: false });
    console.log(`\npdf-lib load: ok, ${doc.getPageCount()} page(s)`);
    const acroForm = doc.catalog.lookupMaybe(PDFName.of("AcroForm"), PDFDict);
    if (acroForm) {
      const fields = acroForm.lookupMaybe(PDFName.of("Fields"), PDFArray);
      console.log(`AcroForm Fields count: ${fields?.size() ?? 0}`);
      if (fields) {
        for (let k = 0; k < fields.size(); k += 1) {
          const e = fields.get(k);
          if (e instanceof PDFRef) {
            const fd = doc.context.lookup(e, PDFDict);
            const t = fd?.get(PDFName.of("T"));
            const v = fd?.get(PDFName.of("V"));
            const tStr = (t as any)?.asString?.() ?? (t as any)?.decodeText?.() ?? String(t);
            const vRef = v instanceof PDFRef ? `${v.objectNumber} 0 R` : String(v);
            console.log(`  Fields[${k}] = ${e.objectNumber} 0 R  /T=${JSON.stringify(tStr)}  /V=${vRef}`);
          }
        }
      }
      const sigFlags = acroForm.get(PDFName.of("SigFlags"));
      console.log(`AcroForm /SigFlags = ${(sigFlags as any)?.asNumber?.() ?? sigFlags}`);
    }
  } catch (e) {
    console.log(`pdf-lib load FAILED: ${e}`);
  }
}

void StandardFonts;
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
