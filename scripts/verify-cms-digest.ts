/**
 * Pull the CMS SignedData out of /Contents, find the messageDigest signed
 * attribute, and compare it against SHA-256 over the file's declared
 * ByteRange. If they don't match, the file is corrupt independently of any
 * incremental update layered on top.
 */

import { readFileSync } from "fs";
import { createHash } from "crypto";

function indexOfBytes(haystack: Uint8Array, needle: string, from = 0): number {
  const nb = new TextEncoder().encode(needle);
  outer: for (let i = from; i <= haystack.length - nb.length; i += 1) {
    for (let j = 0; j < nb.length; j += 1) if (haystack[i + j] !== nb[j]) continue outer;
    return i;
  }
  return -1;
}

function isWs(b: number) { return b === 0x20 || b === 0x0a || b === 0x0d || b === 0x09; }

interface Sig {
  range: number[];
  contentsHex: string;
}

function readSignatures(bytes: Uint8Array): Sig[] {
  const out: Sig[] = [];
  let from = 0;
  while (from < bytes.length) {
    const idx = indexOfBytes(bytes, "/ByteRange", from);
    if (idx === -1) break;
    from = idx + 10;
    let i = idx + 10;
    while (i < bytes.length && isWs(bytes[i])) i++;
    if (bytes[i] !== 0x5b) continue;
    let brEnd = -1;
    for (let k = i; k < bytes.length; k++) if (bytes[k] === 0x5d) { brEnd = k; break; }
    if (brEnd === -1) continue;
    const body = new TextDecoder("latin1").decode(bytes.subarray(i + 1, brEnd));
    if (body.includes("*")) continue; // placeholder
    const nums = body.trim().split(/\s+/).map(Number);
    if (nums.length !== 4 || !nums.every((n) => Number.isFinite(n))) continue;
    const cIdx = indexOfBytes(bytes, "/Contents", brEnd);
    if (cIdx === -1) continue;
    let j = cIdx + 9;
    while (j < bytes.length && isWs(bytes[j])) j++;
    if (bytes[j] !== 0x3c) continue;
    let cClose = -1;
    for (let k = j + 1; k < bytes.length; k++) if (bytes[k] === 0x3e) { cClose = k; break; }
    if (cClose === -1) continue;
    const hex = new TextDecoder("latin1").decode(bytes.subarray(j + 1, cClose)).replace(/\s/g, "");
    out.push({ range: nums, contentsHex: hex });
  }
  return out;
}

// Minimal DER walker: find the messageDigest attribute inside a CMS SignedData.
// messageDigest OID = 1.2.840.113549.1.9.4 → DER bytes 06 09 2A 86 48 86 F7 0D 01 09 04
function findMessageDigest(cmsDer: Uint8Array): Uint8Array | null {
  const oid = Uint8Array.from([0x06, 0x09, 0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x09, 0x04]);
  outer: for (let i = 0; i <= cmsDer.length - oid.length; i++) {
    for (let j = 0; j < oid.length; j++) if (cmsDer[i + j] !== oid[j]) continue outer;
    // After the OID, there's a SET (0x31) containing an OCTET STRING (0x04) with the digest.
    let p = i + oid.length;
    if (cmsDer[p] !== 0x31) continue;
    // Skip SET length.
    let lenByte = cmsDer[p + 1];
    let off = p + 2;
    if (lenByte & 0x80) {
      const n = lenByte & 0x7f;
      off += n;
    }
    if (cmsDer[off] !== 0x04) continue;
    lenByte = cmsDer[off + 1];
    let payloadOff = off + 2;
    let payloadLen = lenByte;
    if (lenByte & 0x80) {
      const n = lenByte & 0x7f;
      payloadLen = 0;
      for (let k = 0; k < n; k++) payloadLen = payloadLen * 256 + cmsDer[off + 2 + k];
      payloadOff = off + 2 + n;
    }
    return cmsDer.subarray(payloadOff, payloadOff + payloadLen);
  }
  return null;
}

async function main() {
  const path = process.argv[2];
  if (!path) { console.error("usage: verify-cms-digest.ts <pdf>"); process.exit(2); }
  const bytes = new Uint8Array(readFileSync(path));
  const sigs = readSignatures(bytes);
  console.log(`${path}: ${bytes.length} bytes, ${sigs.length} signature(s)`);
  sigs.forEach((s, k) => {
    console.log(`\nsig #${k}:`);
    console.log(`  ByteRange: ${JSON.stringify(s.range)}`);
    const h = createHash("sha256");
    h.update(bytes.subarray(s.range[0], s.range[0] + s.range[1]));
    h.update(bytes.subarray(s.range[2], s.range[2] + s.range[3]));
    const fileDigest = h.digest("hex");
    console.log(`  SHA-256 over byte range:  ${fileDigest}`);
    const cmsDer = new Uint8Array(s.contentsHex.length / 2);
    for (let i = 0; i < cmsDer.length; i++) cmsDer[i] = parseInt(s.contentsHex.substr(i * 2, 2), 16);
    // Find first non-zero suffix.
    let realLen = cmsDer.length;
    while (realLen > 0 && cmsDer[realLen - 1] === 0) realLen--;
    const cms = cmsDer.subarray(0, realLen);
    console.log(`  CMS DER length (trimmed): ${cms.length}`);
    const embeddedDigest = findMessageDigest(cms);
    if (embeddedDigest) {
      const hex = Array.from(embeddedDigest).map((b) => b.toString(16).padStart(2, "0")).join("");
      console.log(`  messageDigest in CMS:     ${hex}`);
      console.log(`  MATCH: ${hex === fileDigest ? "✅ signature WOULD validate" : "❌ MISMATCH — Adobe will say corrupt"}`);
    } else {
      console.log(`  messageDigest not found in CMS — cannot verify`);
    }
  });
}

main().catch((e) => { console.error(e); process.exit(1); });
