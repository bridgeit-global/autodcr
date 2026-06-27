/**
 * Sequential-sign regression against a Chromium-generated PDF (same engine as production).
 * Run: npx tsx scripts/test-chromium-sequential-sign.ts
 */
import { createHash } from "crypto";
import { existsSync } from "node:fs";
import { writeFileSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import puppeteer from "puppeteer-core";
import {
  preparePdfForNativeSigning,
  assertPdfHasSigningMarkers,
} from "../app/lib/bridge/pdfSigningPrep";

function localChromeCandidates(): string[] {
  const fromEnv = process.env.PUPPETEER_EXECUTABLE_PATH?.trim();
  if (process.platform === "darwin") {
    return [
      fromEnv,
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
      "/Applications/Chromium.app/Contents/MacOS/Chromium",
    ].filter((v): v is string => Boolean(v));
  }
  return [fromEnv, "/usr/bin/google-chrome", "/usr/bin/chromium"].filter(
    (v): v is string => Boolean(v),
  );
}

async function resolveChromePath(): Promise<string> {
  for (const p of localChromeCandidates()) {
    if (existsSync(p)) return p;
  }
  throw new Error("No Chrome/Chromium found for puppeteer-core.");
}

function indexOfBytes(haystack: Uint8Array, needle: string, from = 0): number {
  const nb = new TextEncoder().encode(needle);
  outer: for (let i = from; i <= haystack.length - nb.length; i += 1) {
    for (let j = 0; j < nb.length; j += 1) if (haystack[i + j] !== nb[j]) continue outer;
    return i;
  }
  return -1;
}

function parseFirstFilledByteRange(bytes: Uint8Array): [number, number, number, number] {
  let from = 0;
  while (from < bytes.length) {
    const idx = indexOfBytes(bytes, "/ByteRange", from);
    if (idx === -1) break;
    from = idx + 10;
    let i = idx + 10;
    while (i < bytes.length && (bytes[i] === 0x20 || bytes[i] === 0x0a || bytes[i] === 0x0d)) i += 1;
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

function findPlaceholder(bytes: Uint8Array) {
  let from = 0;
  while (from < bytes.length) {
    const idx = indexOfBytes(bytes, "/ByteRange", from);
    if (idx === -1) break;
    from = idx + 10;
    let i = idx + 10;
    while (i < bytes.length && (bytes[i] === 0x20 || bytes[i] === 0x0a || bytes[i] === 0x0d)) i += 1;
    if (bytes[i] !== 0x5b) continue;
    let brEnd = -1;
    for (let k = i; k < bytes.length; k += 1) if (bytes[k] === 0x5d) { brEnd = k; break; }
    if (brEnd === -1) continue;
    const brBody = bytes.subarray(i + 1, brEnd);
    const cIdx = indexOfBytes(bytes, "/Contents", brEnd);
    if (cIdx === -1) continue;
    let j = cIdx + 9;
    while (j < bytes.length && (bytes[j] === 0x20 || bytes[j] === 0x0a || bytes[j] === 0x0d)) j += 1;
    if (bytes[j] !== 0x3c) continue;
    let cClose = -1;
    for (let k = j + 1; k < bytes.length; k += 1) if (bytes[k] === 0x3e) { cClose = k; break; }
    if (cClose === -1) continue;
    const hasAst = [...brBody].some((b) => b === 0x2a);
    const cBody = bytes.subarray(j + 1, cClose);
    const allZero =
      cBody.length > 0 && [...cBody].every((b) => b === 0x30 || b === 0x20 || b === 0x0a || b === 0x0d);
    if (hasAst || allZero) return { brStart: i, brEnd, cOpen: j, cClose };
  }
  throw new Error("No placeholder found");
}

function fakeSignInPlace(input: Uint8Array): Uint8Array {
  const ph = findPlaceholder(input);
  const out = new Uint8Array(input);
  const enc = new TextEncoder();
  const off1 = 0;
  const len1 = ph.cOpen;
  const off2 = ph.cClose + 1;
  const len2 = input.length - off2;
  const targetWidth = ph.brEnd - ph.brStart + 1;
  let rendered = `[${off1} ${len1} ${off2} ${len2}]`;
  if (rendered.length < targetWidth) rendered = rendered.padEnd(targetWidth, " ");
  out.set(enc.encode(rendered), ph.brStart);
  const hexLen = ph.cClose - ph.cOpen - 1;
  const fakeBody = "AB".repeat(8) + "0".repeat(hexLen - 16);
  out.set(enc.encode(fakeBody), ph.cOpen + 1);
  return out;
}

async function renderChromiumPdf(html: string): Promise<Uint8Array> {
  const chromePath = await resolveChromePath();
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), "chromium-seq-sign-"));
  const htmlPath = path.join(tmpDir, "page.html");
  await writeFileSync(htmlPath, html, "utf8");
  const browser = await puppeteer.launch({
    executablePath: chromePath,
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
  try {
    const page = await browser.newPage();
    await page.goto(`file://${htmlPath}`, { waitUntil: "networkidle0" });
    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "12mm", right: "12mm", bottom: "12mm", left: "12mm" },
    });
    return new Uint8Array(pdf);
  } finally {
    await browser.close();
    await rm(tmpDir, { recursive: true, force: true });
  }
}

async function main() {
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
    body { font-family: Arial, sans-serif; font-size: 11pt; }
    .row { display: flex; justify-content: space-between; margin-top: 120px; }
    .col { width: 45%; }
    .slot { min-height: 80px; border: 1px dashed #ccc; margin-top: 8px; }
  </style></head><body>
    <h2>Architect Acceptance Letter (test)</h2>
    <p>Approved and confirmed, For Test Company,</p>
    <div class="row">
      <div class="col"><p>Owner signature block</p><div class="slot" id="owner-slot"></div></div>
      <div class="col"><p>Consultant signature block</p><div class="slot" id="consultant-slot"></div></div>
    </div>
  </body></html>`;

  const baseBytes = await renderChromiumPdf(html);
  console.log(`Chromium base PDF: ${baseBytes.length} bytes`);
  console.log(`Has /ByteRange before prep: ${indexOfBytes(baseBytes, "/ByteRange") !== -1}`);

  const preparedFresh = await preparePdfForNativeSigning(baseBytes.buffer as ArrayBuffer, {
    stamp: {
      pageIndex: 0,
      pdfX: 72,
      pdfY: 120,
      pdfWidth: 180,
      pdfHeight: 60,
      signerLabel: "Owner Signer",
      signedAt: new Date(),
    },
  });
  assertPdfHasSigningMarkers(preparedFresh);
  console.log(`Fresh prepared: ${preparedFresh.length} bytes`);

  const signed1 = fakeSignInPlace(preparedFresh);
  console.log(`Fake owner signed: ${signed1.length} bytes`);

  const rev1Range = parseFirstFilledByteRange(signed1);
  const rev1DigestBefore = digestByteRange(signed1, rev1Range);

  const preparedSecond = await preparePdfForNativeSigning(signed1.buffer as ArrayBuffer, {
    stamp: {
      pageIndex: 0,
      pdfX: 340,
      pdfY: 120,
      pdfWidth: 180,
      pdfHeight: 60,
      signerLabel: "Consultant Signer",
      signedAt: new Date(),
    },
  });
  console.log(`Incremental prepared: ${preparedSecond.length} bytes`);

  for (let i = 0; i < signed1.length; i += 1) {
    if (preparedSecond[i] !== signed1[i]) {
      console.error(`PREFIX MISMATCH at ${i}: ${signed1[i]} vs ${preparedSecond[i]}`);
      process.exit(1);
    }
  }
  console.log("Prefix preserved after incremental prep");

  const signed2 = fakeSignInPlace(preparedSecond);
  console.log(`Fake consultant signed: ${signed2.length} bytes`);

  for (let i = 0; i < signed1.length; i += 1) {
    if (signed2[i] !== signed1[i]) {
      console.error(`PREFIX MISMATCH after 2nd sign at ${i}`);
      process.exit(1);
    }
  }

  const rev1DigestAfter = digestByteRange(signed2, rev1Range);
  console.log(`Rev1 digest before: ${rev1DigestBefore}`);
  console.log(`Rev1 digest after:  ${rev1DigestAfter}`);
  if (rev1DigestBefore !== rev1DigestAfter) {
    console.error("FAIL: Rev 1 digest changed");
    process.exit(1);
  }
  console.log("ALL CHECKS PASSED (Chromium PDF)");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
