import { pdflibAddPlaceholder } from "@signpdf/placeholder-pdf-lib";
import { FontNames } from "@pdf-lib/standard-fonts";
import {
  PDFArray,
  PDFDict,
  PDFDocument,
  PDFFont,
  PDFHexString,
  PDFName,
  PDFNumber,
  PDFObject,
  PDFOperator,
  PDFPage,
  PDFRef,
  PDFString,
  StandardFontEmbedder,
  StandardFonts,
  LineCapStyle,
  degrees,
  drawSvgPath,
  drawText,
  rgb,
} from "pdf-lib";

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

const SIGNATURE_LENGTH = 12000;
const DEFAULT_REASON = "Document approval";
const DEFAULT_LOCATION = "IN";
const DEFAULT_CONTACT = "support@example.com";
const DEFAULT_SIGNER = "AutoDCR Signer";

/**
 * Prepare a PDF for native-host signing by adding a `/ByteRange` + `/Contents`
 * placeholder.
 *
 * For unsigned input the function falls back to pdf-lib's full-document save:
 * we own the byte layout and can re-serialise freely. For already-signed input
 * we must perform a PDF *incremental update* — appending a new revision to
 * the existing bytes without touching the original ones — otherwise the
 * existing signature's `/ByteRange` offsets stop matching the content they
 * hashed over and Adobe reports the document as modified.
 */
export async function preparePdfForNativeSigning(
  input: ArrayBuffer,
  options: PrepareOptions = {}
): Promise<Uint8Array> {
  const originalBytes = new Uint8Array(input);

  // Unsigned PDFs never contain /ByteRange — safe to build a fresh placeholder.
  if (indexOfBytes(originalBytes, "/ByteRange") === -1) {
    return preparePdfFresh(input, options);
  }

  // Any PDF that already carries /ByteRange must NEVER be full-rewritten via
  // pdfDoc.save() — that invalidates prior PKCS#7 signatures (Adobe Rev.1 ✗).
  const prepared = await preparePdfIncremental(originalBytes, options);
  assertOriginalPrefixPreserved(originalBytes, prepared);
  if (pdfHasCompletedSignature(originalBytes)) {
    assertPriorSignaturesPreserved(originalBytes, prepared);
  }
  return prepared;
}

async function preparePdfFresh(
  input: ArrayBuffer,
  options: PrepareOptions
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.load(input, { updateMetadata: false });
  if (options.stamp) {
    await drawFormalDscStampOnPage(pdfDoc, options.stamp);
  }
  pdflibAddPlaceholder({
    pdfDoc,
    reason: options.stamp?.reason ?? DEFAULT_REASON,
    contactInfo: DEFAULT_CONTACT,
    name: options.stamp?.signerLabel ?? DEFAULT_SIGNER,
    location: DEFAULT_LOCATION,
    signatureLength: SIGNATURE_LENGTH,
    widgetRect: options.stamp
      ? [
          options.stamp.pdfX,
          options.stamp.pdfY,
          options.stamp.pdfX + options.stamp.pdfWidth,
          options.stamp.pdfY + options.stamp.pdfHeight,
        ]
      : [0, 0, 0, 0],
  });

  const targetPageIndex = options.stamp?.pageIndex ?? 0;
  if (targetPageIndex !== 0) {
    relocateLastWidgetToPage(pdfDoc, targetPageIndex);
  }

  return await pdfDoc.save({ useObjectStreams: false });
}

async function preparePdfIncremental(
  originalBytes: Uint8Array,
  options: PrepareOptions
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.load(originalBytes, { updateMetadata: false });
  const ctx = pdfDoc.context;
  const prevStartxref = findStartxref(originalBytes);

  const catalogRef = ctx.getObjectRef(pdfDoc.catalog);
  if (!catalogRef) {
    throw new Error("Cannot perform incremental update: catalog has no indirect reference.");
  }

  const snapshot = new Map<string, Uint8Array>();
  for (const [ref, obj] of ctx.enumerateIndirectObjects()) {
    snapshot.set(refKey(ref), serialiseObject(obj));
  }

  // Never redraw page /Contents on an already-signed PDF — Adobe reports
  // "1 Page(s) Modified" and invalidates Rev. 1. Put the formal stamp on the
  // new signature widget's appearance stream instead (see below).

  pdflibAddPlaceholder({
    pdfDoc,
    reason: options.stamp?.reason ?? DEFAULT_REASON,
    contactInfo: DEFAULT_CONTACT,
    name: options.stamp?.signerLabel ?? DEFAULT_SIGNER,
    location: DEFAULT_LOCATION,
    signatureLength: SIGNATURE_LENGTH,
    widgetRect: options.stamp
      ? [
          options.stamp.pdfX,
          options.stamp.pdfY,
          options.stamp.pdfX + options.stamp.pdfWidth,
          options.stamp.pdfY + options.stamp.pdfHeight,
        ]
      : [0, 0, 0, 0],
  });

  const targetPageIndex = options.stamp?.pageIndex ?? 0;
  if (targetPageIndex !== 0) {
    relocateLastWidgetToPage(pdfDoc, targetPageIndex);
  }
  renameLastWidgetForUniqueness(pdfDoc);
  if (options.stamp) {
    await embedFormalStampOnLastWidgetAppearance(pdfDoc, options.stamp);
  }

  const toEmit: Array<{ ref: PDFRef; bytes: Uint8Array }> = [];
  for (const [ref, obj] of ctx.enumerateIndirectObjects()) {
    const current = serialiseObject(obj);
    const prev = snapshot.get(refKey(ref));
    if (!prev || !u8Equal(prev, current)) {
      toEmit.push({ ref, bytes: current });
    }
  }

  return assembleIncrementalUpdate({
    originalBytes,
    prevStartxref,
    catalogRef,
    infoRef: ctx.trailerInfo.Info instanceof PDFRef ? ctx.trailerInfo.Info : null,
    idArray: ctx.trailerInfo.ID instanceof PDFArray ? ctx.trailerInfo.ID : null,
    objects: toEmit,
  });
}

interface IncrementalAssemblyInput {
  originalBytes: Uint8Array;
  prevStartxref: number;
  catalogRef: PDFRef;
  infoRef: PDFRef | null;
  idArray: PDFArray | null;
  objects: Array<{ ref: PDFRef; bytes: Uint8Array }>;
}

function assembleIncrementalUpdate(input: IncrementalAssemblyInput): Uint8Array {
  const { originalBytes, prevStartxref, catalogRef, infoRef, idArray, objects } = input;
  const encoder = new TextEncoder();

  // PDF readers tolerate the original `%%EOF` not being followed by a newline,
  // but we must guarantee a separator before our appended body so the new
  // `N G obj` token starts on a fresh line.
  const needsSeparator = originalBytes.length === 0 || originalBytes[originalBytes.length - 1] !== 0x0a;
  const separator = needsSeparator ? encoder.encode("\n") : new Uint8Array(0);

  // Compute byte offsets as we lay the new objects down.
  const offsets = new Map<string, number>();
  let cursor = originalBytes.length + separator.length;
  const objectBytes: Uint8Array[] = [];
  for (const { ref, bytes } of objects) {
    offsets.set(refKey(ref), cursor);
    const head = encoder.encode(`${ref.objectNumber} ${ref.generationNumber} obj\n`);
    const tail = encoder.encode("\nendobj\n");
    objectBytes.push(head, bytes, tail);
    cursor += head.length + bytes.length + tail.length;
  }

  let maxObjNum = catalogRef.objectNumber;
  for (const { ref } of objects) {
    if (ref.objectNumber > maxObjNum) maxObjNum = ref.objectNumber;
  }

  // Build the xref table. PDF spec: incremental update emits sub-sections
  // covering only the objects that changed; the chain through /Prev resolves
  // older obj nums from the previous xref.
  const sorted = [...objects].sort((a, b) => a.ref.objectNumber - b.ref.objectNumber);
  type SubSection = { start: number; entries: Array<{ offset: number; gen: number }> };
  const subsections: SubSection[] = [];
  for (const { ref } of sorted) {
    const offset = offsets.get(refKey(ref))!;
    const last = subsections[subsections.length - 1];
    if (last && last.start + last.entries.length === ref.objectNumber) {
      last.entries.push({ offset, gen: ref.generationNumber });
    } else {
      subsections.push({
        start: ref.objectNumber,
        entries: [{ offset, gen: ref.generationNumber }],
      });
    }
  }

  let xref = "xref\n";
  for (const sub of subsections) {
    xref += `${sub.start} ${sub.entries.length}\n`;
    for (const entry of sub.entries) {
      const off = entry.offset.toString().padStart(10, "0");
      const gen = entry.gen.toString().padStart(5, "0");
      // PDF spec requires the 20-byte fixed-width row terminating with " \n"
      // (space + LF) or "\r\n".
      xref += `${off} ${gen} n \n`;
    }
  }

  const xrefOffset = cursor;

  let trailer = "trailer\n<< ";
  trailer += `/Size ${maxObjNum + 1} `;
  trailer += `/Root ${catalogRef.objectNumber} ${catalogRef.generationNumber} R `;
  if (infoRef) {
    trailer += `/Info ${infoRef.objectNumber} ${infoRef.generationNumber} R `;
  }
  // PDF 1.7 §14.4: /ID is a two-element array. The first element is the
  // permanent document identifier (must NOT change across updates) and the
  // second is the changing identifier (MUST be regenerated on every save).
  // Adobe specifically uses /ID[1] to detect tampering on signed documents —
  // keeping it identical across an incremental update is interpreted as
  // "file claims unchanged" while bytes have been appended, which Acrobat
  // surfaces as "Document has been altered or corrupted since it was signed".
  trailer += `/ID ${rebuildIdArray(idArray)} `;
  trailer += `/Prev ${prevStartxref} >>\n`;
  trailer += `startxref\n${xrefOffset}\n%%EOF\n`;

  const xrefBytes = encoder.encode(xref);
  const trailerBytes = encoder.encode(trailer);

  let total = originalBytes.length + separator.length;
  for (const b of objectBytes) total += b.length;
  total += xrefBytes.length + trailerBytes.length;

  const out = new Uint8Array(total);
  let pos = 0;
  out.set(originalBytes, pos); pos += originalBytes.length;
  out.set(separator, pos); pos += separator.length;
  for (const b of objectBytes) {
    out.set(b, pos); pos += b.length;
  }
  out.set(xrefBytes, pos); pos += xrefBytes.length;
  out.set(trailerBytes, pos);
  return out;
}

function serialiseObject(obj: PDFObject): Uint8Array {
  const buf = new Uint8Array(obj.sizeInBytes());
  obj.copyBytesInto(buf, 0);
  return buf;
}

/**
 * Build the `[<perm> <changing>]` /ID array for the new trailer. Preserve the
 * existing permanent ID (first element) verbatim if present; always
 * regenerate the changing ID (second element) — that's the half whose
 * stability across an incremental update Acrobat treats as tampering.
 */
function rebuildIdArray(prev: PDFArray | null): string {
  const newChangingHex = randomHex16().toUpperCase();
  if (prev && prev.size() >= 1) {
    // PDF spec requires permanent ID stay constant. Read whatever pdf-lib
    // parsed (PDFHexString or PDFString) and re-emit the raw bytes.
    const permBuf = new Uint8Array(prev.get(0).sizeInBytes());
    prev.get(0).copyBytesInto(permBuf, 0);
    const permLiteral = new TextDecoder("latin1").decode(permBuf);
    return `[ ${permLiteral} <${newChangingHex}> ]`;
  }
  // No prior /ID: generate both halves.
  const newPermHex = randomHex16().toUpperCase();
  return `[ <${newPermHex}> <${newChangingHex}> ]`;
}

function randomHex16(): string {
  // 16 bytes = 32 hex chars, matching the typical /ID element width.
  const buf = new Uint8Array(16);
  const g = globalThis as { crypto?: { getRandomValues?: (b: Uint8Array) => void } };
  if (g.crypto && typeof g.crypto.getRandomValues === "function") {
    g.crypto.getRandomValues(buf);
  } else {
    for (let i = 0; i < buf.length; i += 1) buf[i] = Math.floor(Math.random() * 256);
  }
  let out = "";
  for (let i = 0; i < buf.length; i += 1) out += buf[i].toString(16).padStart(2, "0");
  return out;
}

function pdfObjectToString(obj: PDFObject): string {
  return new TextDecoder("latin1").decode(serialiseObject(obj));
}

function refKey(ref: PDFRef): string {
  return `${ref.objectNumber} ${ref.generationNumber}`;
}

function u8Equal(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

function indexOfBytes(haystack: Uint8Array, needle: string, from = 0): number {
  const nb = new TextEncoder().encode(needle);
  outer: for (let i = from; i <= haystack.length - nb.length; i += 1) {
    for (let j = 0; j < nb.length; j += 1) if (haystack[i + j] !== nb[j]) continue outer;
    return i;
  }
  return -1;
}

function isPdfWs(b: number): boolean {
  return b === 0x20 || b === 0x0a || b === 0x0d || b === 0x09 || b === 0x0c;
}

function isPdfHexZeroByte(b: number): boolean {
  return b === 0x30 || isPdfWs(b);
}

type ScannedSignature = { isPlaceholder: boolean };

/** Signature dicts are small; never scan past this window after `/ByteRange [...]` for `/Contents`. */
const SIG_DICT_SEARCH_WINDOW = 2048;
/** Reserved `/Contents` hex placeholder length (see SIGNATURE_LENGTH). */
const SIG_CONTENTS_HEX_MAX = 65536;

function findSignatureDictSearchLimit(bytes: Uint8Array, brEnd: number): number {
  return Math.min(bytes.length, brEnd + SIG_DICT_SEARCH_WINDOW);
}

function findContentsHexAfterByteRange(
  bytes: Uint8Array,
  brEnd: number,
): { cOpen: number; cClose: number } | null {
  const tokenSearchLimit = findSignatureDictSearchLimit(bytes, brEnd);
  let searchFrom = brEnd + 1;
  while (searchFrom < tokenSearchLimit) {
    const cIdx = indexOfBytes(bytes, "/Contents", searchFrom);
    if (cIdx === -1 || cIdx >= tokenSearchLimit) return null;
    let j = cIdx + "/Contents".length;
    while (j < bytes.length && isPdfWs(bytes[j])) j += 1;
    if (j >= bytes.length || bytes[j] !== 0x3c) {
      searchFrom = cIdx + "/Contents".length;
      continue;
    }
    const hexCloseLimit = Math.min(bytes.length, j + 1 + SIG_CONTENTS_HEX_MAX);
    let cClose = -1;
    for (let k = j + 1; k < hexCloseLimit; k += 1) {
      if (bytes[k] === 0x3e) {
        cClose = k;
        break;
      }
    }
    if (cClose !== -1) return { cOpen: j, cClose };
    searchFrom = cIdx + "/Contents".length;
  }
  return null;
}

function parseByteRangeBody(brBody: string): [number, number, number, number] | null {
  if (brBody.includes("*")) return null;
  const nums = brBody.trim().split(/\s+/).map(Number);
  if (nums.length !== 4 || nums.some((n) => !Number.isFinite(n))) return null;
  return nums as [number, number, number, number];
}

/** Byte-level scan — matches native-host placeholder detection heuristics. */
function scanPdfSignatures(bytes: Uint8Array): ScannedSignature[] {
  const results: ScannedSignature[] = [];
  let from = 0;
  while (from < bytes.length) {
    const idx = indexOfBytes(bytes, "/ByteRange", from);
    if (idx === -1) break;
    let i = idx + "/ByteRange".length;
    while (i < bytes.length && isPdfWs(bytes[i])) i += 1;
    if (i >= bytes.length || bytes[i] !== 0x5b) {
      from = idx + 1;
      continue;
    }
    let brEnd = -1;
    for (let k = i; k < bytes.length; k += 1) {
      if (bytes[k] === 0x5d) {
        brEnd = k;
        break;
      }
    }
    if (brEnd === -1) {
      from = idx + 1;
      continue;
    }
    const brBody = new TextDecoder("latin1").decode(bytes.subarray(i + 1, brEnd));
    const hasAst = brBody.includes("*");
    const contents = findContentsHexAfterByteRange(bytes, brEnd);
    if (!contents) {
      from = idx + 1;
      continue;
    }
    const cBody = bytes.subarray(contents.cOpen + 1, contents.cClose);
    const isPlaceholder =
      hasAst || (cBody.length > 0 && [...cBody].every((b) => isPdfHexZeroByte(b)));
    results.push({ isPlaceholder });
    from = idx + 1;
  }
  return results;
}

function parseFilledByteRangesFromText(bytes: Uint8Array): Array<[number, number, number, number]> {
  const text = new TextDecoder("latin1").decode(bytes);
  const ranges: Array<[number, number, number, number]> = [];
  const re = /\/ByteRange\s*\[\s*(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s*\]/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(text)) !== null) {
    const nums = match.slice(1, 5).map(Number);
    if (nums.every((n) => Number.isFinite(n) && n >= 0)) {
      ranges.push(nums as [number, number, number, number]);
    }
  }
  return ranges;
}

function parseFilledByteRanges(bytes: Uint8Array): Array<[number, number, number, number]> {
  const ranges: Array<[number, number, number, number]> = [];
  let from = 0;
  while (from < bytes.length) {
    const idx = indexOfBytes(bytes, "/ByteRange", from);
    if (idx === -1) break;
    let i = idx + "/ByteRange".length;
    while (i < bytes.length && isPdfWs(bytes[i])) i += 1;
    if (i >= bytes.length || bytes[i] !== 0x5b) {
      from = idx + 1;
      continue;
    }
    const brStart = i;
    let brEnd = -1;
    for (let k = i; k < bytes.length; k += 1) {
      if (bytes[k] === 0x5d) {
        brEnd = k;
        break;
      }
    }
    if (brEnd === -1) {
      from = idx + 1;
      continue;
    }
    const brBody = new TextDecoder("latin1").decode(bytes.subarray(brStart + 1, brEnd));
    const nums = parseByteRangeBody(brBody);
    if (!nums) {
      from = idx + 1;
      continue;
    }
    const contents = findContentsHexAfterByteRange(bytes, brEnd);
    if (!contents) {
      from = idx + 1;
      continue;
    }
    const cBody = bytes.subarray(contents.cOpen + 1, contents.cClose);
    const isPlaceholder =
      cBody.length > 0 && [...cBody].every((b) => isPdfHexZeroByte(b));
    if (!isPlaceholder) {
      ranges.push(nums);
    }
    from = idx + 1;
  }
  if (ranges.length > 0) return ranges;
  return parseFilledByteRangesFromText(bytes);
}

function pdfHasFilledSignatureMarkFallback(bytes: Uint8Array): boolean {
  const text = new TextDecoder("latin1").decode(bytes);
  if (!/\/ByteRange\s*\[\s*\d+\s+\d+\s+\d+\s+\d+\s*\]/.test(text)) return false;
  return /\/Contents\s*<[0-9A-Fa-f]*[1-9A-Fa-f][0-9A-Fa-f\s\r\n]*>/i.test(text);
}

function assertOriginalPrefixPreserved(originalBytes: Uint8Array, updated: Uint8Array): void {
  if (updated.length < originalBytes.length) {
    throw new Error(
      "Incremental PDF update truncated the owner-signed file; prior signatures would be invalid."
    );
  }
  for (let i = 0; i < originalBytes.length; i += 1) {
    if (updated[i] !== originalBytes[i]) {
      throw new Error(
        `Incremental PDF update modified owner-signed byte at offset ${i}; prior signatures would be invalid.`
      );
    }
  }
}

function assertPriorSignaturesPreserved(before: Uint8Array, after: Uint8Array): void {
  const ranges = parseFilledByteRanges(before);
  if (ranges.length === 0 && pdfHasCompletedSignature(before)) {
    throw new Error(
      "Could not locate filled signature byte ranges in the owner-signed PDF. " +
        "Refusing to continue — dual signing would invalidate the owner signature."
    );
  }
  for (const [off1, len1, off2, len2] of ranges) {
    const seg1Before = before.subarray(off1, off1 + len1);
    const seg1After = after.subarray(off1, off1 + len1);
    const seg2Before = before.subarray(off2, off2 + len2);
    const seg2After = after.subarray(off2, off2 + len2);
    if (!u8Equal(seg1Before, seg1After) || !u8Equal(seg2Before, seg2After)) {
      throw new Error(
        "PDF bytes covered by an existing signature were modified. " +
          "Prior signatures would show as invalid in Adobe Acrobat."
      );
    }
  }
}

/** Verify owner-signed byte ranges still match after incremental prep or native signing. */
export function assertPdfPriorSignaturesPreserved(before: Uint8Array, after: Uint8Array): void {
  assertPriorSignaturesPreserved(before, after);
}

/** Verify the owner-signed file prefix is byte-identical (dual-sign invariant). */
export function assertPdfOriginalPrefixPreserved(originalBytes: Uint8Array, updated: Uint8Array): void {
  assertOriginalPrefixPreserved(originalBytes, updated);
}

/** True when the PDF bytes contain a `/ByteRange` token (signed or prepared for signing). */
export function pdfHasByteRangeMarker(bytes: Uint8Array): boolean {
  return indexOfBytes(bytes, "/ByteRange") !== -1;
}

/** Count completed (non-placeholder) PKCS#7 signature fields in the PDF. */
export function countCompletedSignatures(bytes: Uint8Array): number {
  return scanPdfSignatures(bytes).filter((s) => !s.isPlaceholder).length;
}

/**
 * True when at least one `/ByteRange` + `/Contents` pair is filled (not a placeholder).
 * Uses byte scanning instead of regex so incremental-update PDFs are detected reliably.
 */
export function pdfHasCompletedSignature(bytes: Uint8Array): boolean {
  if (scanPdfSignatures(bytes).some((s) => !s.isPlaceholder)) return true;
  return pdfHasFilledSignatureMarkFallback(bytes);
}

/** Prepared for signing but CMS not yet written (placeholder ByteRange or zero Contents). */
export function pdfHasUnsignedSignaturePlaceholder(bytes: Uint8Array): boolean {
  const scanned = scanPdfSignatures(bytes);
  return scanned.some((s) => s.isPlaceholder) && !pdfHasCompletedSignature(bytes);
}

function findStartxref(bytes: Uint8Array): number {
  // Search the last 8 KiB — `startxref` is always within the final EOF block.
  const tailLen = Math.min(bytes.length, 8192);
  const tail = new TextDecoder("latin1").decode(bytes.subarray(bytes.length - tailLen));
  const matches = [...tail.matchAll(/startxref\s+(\d+)\s+%%EOF/g)];
  if (matches.length === 0) {
    throw new Error("PDF is missing a startxref / %%EOF marker; cannot do incremental update.");
  }
  return Number(matches[matches.length - 1][1]);
}

/**
 * pdflibAddPlaceholder always attaches the new widget to page 0. For
 * incremental sequential signing we want the widget on whichever page the user
 * picked. Pop it from page 0 and push it onto the target page.
 */
function relocateLastWidgetToPage(pdfDoc: PDFDocument, targetPageIndex: number): void {
  const pages = pdfDoc.getPages();
  if (targetPageIndex < 0 || targetPageIndex >= pages.length) return;
  const sourcePage = pages[0];
  const targetPage = pages[targetPageIndex];
  if (sourcePage === targetPage) return;

  const annotsOnSource = sourcePage.node.lookupMaybe(PDFName.of("Annots"), PDFArray);
  if (!annotsOnSource || annotsOnSource.size() === 0) return;
  const widgetRef = annotsOnSource.get(annotsOnSource.size() - 1);
  if (!(widgetRef instanceof PDFRef)) return;

  // Drop the trailing entry by rebuilding the array; pdf-lib's PDFArray has no
  // pop helper.
  const ctx = pdfDoc.context;
  const newAnnots = PDFArray.withContext(ctx);
  for (let i = 0; i < annotsOnSource.size() - 1; i += 1) {
    newAnnots.push(annotsOnSource.get(i));
  }
  sourcePage.node.set(PDFName.of("Annots"), newAnnots);

  let targetAnnots = targetPage.node.lookupMaybe(PDFName.of("Annots"), PDFArray);
  if (!targetAnnots) {
    targetAnnots = PDFArray.withContext(ctx);
    targetPage.node.set(PDFName.of("Annots"), targetAnnots);
  }
  targetAnnots.push(widgetRef);

  // Point the widget's /P at the new page so signature panels show the right
  // page number.
  const widgetDict = ctx.lookup(widgetRef, PDFDict);
  if (widgetDict) {
    widgetDict.set(PDFName.of("P"), targetPage.ref);
  }
}

/**
 * Reads `/T` from a field dict regardless of whether it was stored as
 * `PDFString` or `PDFHexString` (different PDF producers pick different
 * encodings — pdf-lib emits PDFString, real-world signers occasionally emit
 * PDFHexString for non-ASCII names).
 */
function readFieldName(dict: PDFDict): string | undefined {
  const raw = dict.get(PDFName.of("T"));
  if (raw instanceof PDFString) return raw.asString();
  if (raw instanceof PDFHexString) return raw.decodeText();
  return undefined;
}

/**
 * Ensure the newest AcroForm field has a `/T` that doesn't collide with any
 * pre-existing field name. pdflibAddPlaceholder hardcodes "Signature1"; if
 * that name is already taken, switch to "Signature2", "Signature3", etc.
 */
function renameLastWidgetForUniqueness(pdfDoc: PDFDocument): void {
  const ctx = pdfDoc.context;
  const acroForm = pdfDoc.catalog.lookupMaybe(PDFName.of("AcroForm"), PDFDict);
  if (!acroForm) return;
  const fields = acroForm.lookupMaybe(PDFName.of("Fields"), PDFArray);
  if (!fields || fields.size() < 2) return;

  const taken = new Set<string>();
  for (let i = 0; i < fields.size() - 1; i += 1) {
    const ref = fields.get(i);
    const dict = ref instanceof PDFRef ? ctx.lookup(ref, PDFDict) : null;
    const name = dict ? readFieldName(dict) : undefined;
    if (name) taken.add(name);
  }

  const lastRef = fields.get(fields.size() - 1);
  if (!(lastRef instanceof PDFRef)) return;
  const lastDict = ctx.lookup(lastRef, PDFDict);
  if (!lastDict) return;

  const currentName = readFieldName(lastDict) ?? "Signature1";
  if (!taken.has(currentName)) return;

  let suffix = 2;
  let candidate = `Signature${suffix}`;
  while (taken.has(candidate)) {
    suffix += 1;
    candidate = `Signature${suffix}`;
  }
  lastDict.set(PDFName.of("T"), PDFString.of(candidate));
}

function formatDscStampDate(date: Date): string {
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${date.getFullYear()}.${pad(date.getMonth() + 1)}.${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())} IST`;
}

function buildFormalDscStampTextLines(
  signerLabel: string,
  signedAt: Date,
  titleFont: PDFFont,
  bodyFont: PDFFont,
  innerWidth: number,
): Array<{ text: string; size: number; font: PDFFont }> {
  const titleSize = DSC_STAMP_FONT_SIZES[0];
  const bodySize = DSC_STAMP_FONT_SIZES[1];
  const lines: Array<{ text: string; size: number; font: PDFFont }> = [];

  for (const text of wrapToWidth("Signature valid", titleFont, titleSize, innerWidth)) {
    lines.push({ text, size: titleSize, font: titleFont });
  }
  for (const text of wrapToWidth("Digitally signed by", bodyFont, bodySize, innerWidth)) {
    lines.push({ text, size: bodySize, font: bodyFont });
  }
  for (const text of wrapToWidth(signerLabel, bodyFont, bodySize, innerWidth)) {
    lines.push({ text, size: bodySize, font: bodyFont });
  }
  const dateText = `Date: ${formatDscStampDate(signedAt)}`;
  for (const text of wrapToWidth(dateText, bodyFont, bodySize, innerWidth)) {
    lines.push({ text, size: bodySize, font: bodyFont });
  }
  return lines;
}

const DSC_STAMP_FONT_SIZES = [12, 9] as const;
const DSC_STAMP_LINE_GAP = 2.5;
const DSC_STAMP_PAD_X = 4;
const DSC_CHECKMARK_GREEN = rgb(0.1, 0.72, 0.18);
const DSC_CHECKMARK_OUTLINE = rgb(0, 0, 0);
const DSC_CHECKMARK_SHADOW = rgb(0.15, 0.15, 0.15);
const DSC_CHECKMARK_GREEN_OPACITY = 0.62;
const DSC_CHECKMARK_OUTLINE_THICKNESS = 7;
const DSC_CHECKMARK_GREEN_THICKNESS = 5;

type PdfPoint = { x: number; y: number };

function computeCheckmarkGeometry(stamp: DscStampSpec): {
  leg1Start: PdfPoint;
  leg1End: PdfPoint;
  leg2End: PdfPoint;
} {
  const x0 = stamp.pdfX;
  const y0 = stamp.pdfY;
  const w = stamp.pdfWidth;
  const h = stamp.pdfHeight;

  const size = Math.min(w * 0.46, h * 1.02);
  const kneeX = x0 + w * 0.3;
  const kneeY = y0 + h * 0.38;
  const corner = { x: kneeX, y: kneeY - size * 0.28 };

  return {
    leg1Start: { x: kneeX - size * 0.3, y: kneeY + size * 0.06 },
    leg1End: corner,
    leg2End: { x: kneeX + size * 0.56, y: kneeY + size * 0.26 },
  };
}

function checkmarkPathFromCorner(geom: ReturnType<typeof computeCheckmarkGeometry>): {
  path: string;
  originX: number;
  originY: number;
} {
  const { leg1Start, leg1End, leg2End } = geom;
  const toLocal = (p: PdfPoint): PdfPoint => ({
    x: p.x - leg1End.x,
    y: -(p.y - leg1End.y),
  });
  const p1 = toLocal(leg1Start);
  const p2 = toLocal(leg2End);
  return {
    path: `M ${p1.x} ${p1.y} L 0 0 L ${p2.x} ${p2.y}`,
    originX: leg1End.x,
    originY: leg1End.y,
  };
}

function drawCheckmarkStroke(
  page: PDFPage,
  geom: ReturnType<typeof computeCheckmarkGeometry>,
  opts: { thickness: number; color: ReturnType<typeof rgb>; opacity: number; offsetX?: number; offsetY?: number },
): void {
  const { path, originX, originY } = checkmarkPathFromCorner(geom);
  page.drawSvgPath(path, {
    x: originX + (opts.offsetX ?? 0),
    y: originY + (opts.offsetY ?? 0),
    scale: 1,
    borderColor: opts.color,
    borderWidth: opts.thickness,
    borderOpacity: opts.opacity,
    borderLineCap: LineCapStyle.Round,
  });
}

/** Adobe-style green checkmark watermark (shadow + black outline + green fill) behind stamp text. */
function drawBackgroundCheckmark(page: PDFPage, stamp: DscStampSpec): void {
  const geom = computeCheckmarkGeometry(stamp);

  drawCheckmarkStroke(page, geom, {
    thickness: DSC_CHECKMARK_OUTLINE_THICKNESS,
    color: DSC_CHECKMARK_SHADOW,
    opacity: 0.28,
    offsetX: 1.8,
    offsetY: -1.8,
  });
  drawCheckmarkStroke(page, geom, {
    thickness: DSC_CHECKMARK_OUTLINE_THICKNESS,
    color: DSC_CHECKMARK_OUTLINE,
    opacity: 1,
  });
  drawCheckmarkStroke(page, geom, {
    thickness: DSC_CHECKMARK_GREEN_THICKNESS,
    color: DSC_CHECKMARK_GREEN,
    opacity: DSC_CHECKMARK_GREEN_OPACITY,
  });
}

async function getHelveticaRegularFont(pdfDoc: PDFDocument): Promise<PDFFont> {
  const existingRef = findExistingHelveticaRef(pdfDoc);
  if (existingRef) {
    const embedder = StandardFontEmbedder.for(FontNames.Helvetica);
    const font = PDFFont.of(existingRef, pdfDoc, embedder);
    (font as unknown as { modified: boolean }).modified = false;
    return font;
  }
  return pdfDoc.embedFont(StandardFonts.Helvetica);
}

function findExistingHelveticaRef(pdfDoc: PDFDocument): PDFRef | null {
  const ctx = pdfDoc.context;
  for (const [ref, obj] of ctx.enumerateIndirectObjects()) {
    if (!(obj instanceof PDFDict)) continue;
    if (obj.get(PDFName.of("Type")) !== PDFName.of("Font")) continue;
    if (obj.get(PDFName.of("Subtype")) !== PDFName.of("Type1")) continue;
    const baseFont = obj.get(PDFName.of("BaseFont"));
    if (!(baseFont instanceof PDFName)) continue;
    const name = baseFont.decodeText();
    if (name.includes("Helvetica") && !name.includes("Bold") && !name.includes("Oblique")) {
      return ref;
    }
  }
  return null;
}

/** Reuse an already-embedded Helvetica-Bold so incremental stamps share the owner's font ref (pdf.js otherwise falls back to regular). */
function findExistingHelveticaBoldRef(pdfDoc: PDFDocument): PDFRef | null {
  const ctx = pdfDoc.context;
  for (const [ref, obj] of ctx.enumerateIndirectObjects()) {
    if (!(obj instanceof PDFDict)) continue;
    if (obj.get(PDFName.of("Type")) !== PDFName.of("Font")) continue;
    if (obj.get(PDFName.of("Subtype")) !== PDFName.of("Type1")) continue;
    const baseFont = obj.get(PDFName.of("BaseFont"));
    if (!(baseFont instanceof PDFName)) continue;
    const name = baseFont.decodeText();
    if (name.includes("Helvetica-Bold")) return ref;
  }
  return null;
}

async function getHelveticaBoldFont(pdfDoc: PDFDocument): Promise<PDFFont> {
  const existingRef = findExistingHelveticaBoldRef(pdfDoc);
  if (existingRef) {
    const embedder = StandardFontEmbedder.for(FontNames.HelveticaBold);
    const font = PDFFont.of(existingRef, pdfDoc, embedder);
    // Already embedded in a prior signature revision — do not register again.
    (font as unknown as { modified: boolean }).modified = false;
    return font;
  }
  return pdfDoc.embedFont(StandardFonts.HelveticaBold);
}

/**
 * Put the formal DSC stamp on the newest signature widget's `/AP` stream.
 * Used on incremental (second) signatures so page `/Contents` stays untouched
 * and Rev. 1 remains valid in Adobe.
 */
async function embedFormalStampOnLastWidgetAppearance(
  pdfDoc: PDFDocument,
  stamp: DscStampSpec,
): Promise<void> {
  const ctx = pdfDoc.context;
  const acroForm = pdfDoc.catalog.lookupMaybe(PDFName.of("AcroForm"), PDFDict);
  if (!acroForm) return;
  const fields = acroForm.lookupMaybe(PDFName.of("Fields"), PDFArray);
  if (!fields || fields.size() === 0) return;

  const lastRef = fields.get(fields.size() - 1);
  if (!(lastRef instanceof PDFRef)) return;
  const widgetDict = ctx.lookup(lastRef, PDFDict);
  if (!widgetDict) return;

  const rectArr = widgetDict.lookupMaybe(PDFName.of("Rect"), PDFArray);
  if (!rectArr || rectArr.size() < 4) return;
  const x1 = (rectArr.get(0) as PDFNumber).asNumber();
  const y1 = (rectArr.get(1) as PDFNumber).asNumber();
  const x2 = (rectArr.get(2) as PDFNumber).asNumber();
  const y2 = (rectArr.get(3) as PDFNumber).asNumber();
  const width = x2 - x1;
  const height = y2 - y1;
  if (width <= 0 || height <= 0) return;

  const bold = await getHelveticaBoldFont(pdfDoc);
  const regular = await getHelveticaRegularFont(pdfDoc);
  const black = rgb(0, 0, 0);

  const localStamp: DscStampSpec = {
    ...stamp,
    pdfX: 0,
    pdfY: 0,
    pdfWidth: width,
    pdfHeight: height,
  };

  const extGStates = new Map<number, string>();
  const gsResources: Record<string, PDFRef> = {};
  const geom = computeCheckmarkGeometry(localStamp);
  const operators: PDFOperator[] = [
    ...checkmarkStrokeOperators(ctx, geom, {
      thickness: DSC_CHECKMARK_OUTLINE_THICKNESS,
      color: DSC_CHECKMARK_SHADOW,
      opacity: 0.28,
      offsetX: 1.8,
      offsetY: -1.8,
    }, extGStates, gsResources),
    ...checkmarkStrokeOperators(ctx, geom, {
      thickness: DSC_CHECKMARK_OUTLINE_THICKNESS,
      color: DSC_CHECKMARK_OUTLINE,
      opacity: 1,
    }, extGStates, gsResources),
    ...checkmarkStrokeOperators(ctx, geom, {
      thickness: DSC_CHECKMARK_GREEN_THICKNESS,
      color: DSC_CHECKMARK_GREEN,
      opacity: DSC_CHECKMARK_GREEN_OPACITY,
    }, extGStates, gsResources),
  ];

  const textX = DSC_STAMP_PAD_X;
  const innerWidth = width - 2 * DSC_STAMP_PAD_X;
  const textLines = buildFormalDscStampTextLines(
    stamp.signerLabel,
    stamp.signedAt,
    bold,
    regular,
    innerWidth,
  );
  let cursorY = height - 11;
  for (const line of textLines) {
    operators.push(
      ...drawText(line.font.encodeText(line.text), {
        x: textX,
        y: cursorY,
        size: line.size,
        font: line.font.name,
        color: black,
        rotate: degrees(0),
        xSkew: degrees(0),
        ySkew: degrees(0),
      }),
    );
    cursorY -= line.size + DSC_STAMP_LINE_GAP;
  }

  const fontResources = {
    [bold.name]: bold.ref,
    [regular.name]: regular.ref,
  };
  const stream = ctx.formXObject(operators, {
    Resources:
      Object.keys(gsResources).length > 0
        ? { Font: fontResources, ExtGState: gsResources }
        : { Font: fontResources },
    BBox: ctx.obj([0, 0, width, height]),
    Matrix: ctx.obj([1, 0, 0, 1, 0, 0]),
  });
  widgetDict.set(PDFName.of("AP"), ctx.obj({ N: ctx.register(stream) }));
}

function checkmarkStrokeOperators(
  ctx: PDFDocument["context"],
  geom: ReturnType<typeof computeCheckmarkGeometry>,
  opts: {
    thickness: number;
    color: ReturnType<typeof rgb>;
    opacity?: number;
    offsetX?: number;
    offsetY?: number;
  },
  extGStates: Map<number, string>,
  gsResources: Record<string, PDFRef>,
): PDFOperator[] {
  const { path, originX, originY } = checkmarkPathFromCorner(geom);
  let graphicsState: string | PDFName | undefined;
  if (opts.opacity !== undefined && opts.opacity < 1) {
    let gsName = extGStates.get(opts.opacity);
    if (!gsName) {
      gsName = ctx.addRandomSuffix("GS", 6);
      gsResources[gsName] = ctx.register(
        ctx.obj({ Type: "ExtGState", ca: opts.opacity, CA: opts.opacity }),
      );
      extGStates.set(opts.opacity, gsName);
    }
    graphicsState = gsName;
  }
  return drawSvgPath(path, {
    x: originX + (opts.offsetX ?? 0),
    y: originY + (opts.offsetY ?? 0),
    scale: 1,
    borderColor: opts.color,
    borderWidth: opts.thickness,
    borderLineCap: LineCapStyle.Round,
    color: undefined,
    graphicsState,
  });
}

/** Burn the formal stamp into page content so every PDF viewer shows it. */
async function drawFormalDscStampOnPage(pdfDoc: PDFDocument, stamp: DscStampSpec): Promise<void> {
  const page = pdfDoc.getPage(stamp.pageIndex);
  drawBackgroundCheckmark(page, stamp);
  const bold = await getHelveticaBoldFont(pdfDoc);
  const regular = await getHelveticaRegularFont(pdfDoc);
  const textX = stamp.pdfX + DSC_STAMP_PAD_X;
  const innerWidth = stamp.pdfWidth - 2 * DSC_STAMP_PAD_X;
  const textLines = buildFormalDscStampTextLines(
    stamp.signerLabel,
    stamp.signedAt,
    bold,
    regular,
    innerWidth,
  );
  const black = rgb(0, 0, 0);

  let cursorY = stamp.pdfY + stamp.pdfHeight - 11;
  for (const line of textLines) {
    page.drawText(line.text, {
      x: textX,
      y: cursorY,
      size: line.size,
      font: line.font,
      color: black,
    });
    cursorY -= line.size + DSC_STAMP_LINE_GAP;
  }
}

export function assertPdfHasSigningMarkers(pdfBytes: Uint8Array): void {
  const s = new TextDecoder("latin1").decode(pdfBytes);
  if (!s.includes("/ByteRange") || !s.includes("/Contents <")) {
    throw new Error(
      "PDF is missing required signing placeholders. Ensure /ByteRange and /Contents <...> exist."
    );
  }
}

function wrapToWidth(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  if (!text) return [""];
  if (font.widthOfTextAtSize(text, size) <= maxWidth) return [text];

  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) return [text];

  const lines: string[] = [];
  let current = "";

  const flush = () => {
    if (current) {
      lines.push(current);
      current = "";
    }
  };

  const pushLongToken = (token: string) => {
    let partial = "";
    for (const ch of token) {
      const next = partial + ch;
      if (partial && font.widthOfTextAtSize(next, size) > maxWidth) {
        lines.push(partial);
        partial = ch;
      } else {
        partial = next;
      }
    }
    current = partial;
  };

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
      current = candidate;
      continue;
    }
    flush();
    if (font.widthOfTextAtSize(word, size) <= maxWidth) {
      current = word;
    } else {
      pushLongToken(word);
    }
  }
  flush();
  return lines.length > 0 ? lines : [text];
}
