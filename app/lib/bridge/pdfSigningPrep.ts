import { pdflibAddPlaceholder } from "@signpdf/placeholder-pdf-lib";
import {
  PDFArray,
  PDFDict,
  PDFDocument,
  PDFFont,
  PDFHexString,
  PDFName,
  PDFObject,
  PDFRef,
  PDFString,
  StandardFonts,
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
  if (pdfHasCompletedSignature(originalBytes)) {
    return preparePdfIncremental(originalBytes, options);
  }
  return preparePdfFresh(input, options);
}

async function preparePdfFresh(
  input: ArrayBuffer,
  options: PrepareOptions
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.load(input, { updateMetadata: false });
  if (options.stamp) {
    await drawDscStampOnPage(pdfDoc, options.stamp);
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

  // Snapshot serialised form of every existing indirect object. After the
  // placeholder mutations, anything new or whose bytes differ goes into the
  // incremental revision.
  const snapshot = new Map<string, Uint8Array>();
  for (const [ref, obj] of ctx.enumerateIndirectObjects()) {
    snapshot.set(refKey(ref), serialiseObject(obj));
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

  // pdflibAddPlaceholder always inserts the new widget into the first page.
  // For multi-page docs we need it on the user-selected stamp page; relocate it.
  const targetPageIndex = options.stamp?.pageIndex ?? 0;
  if (targetPageIndex !== 0) {
    relocateLastWidgetToPage(pdfDoc, targetPageIndex);
  }

  // pdflibAddPlaceholder hardcodes the widget's partial field name to
  // "Signature1". On an already-signed PDF that name collides with the
  // existing signature field — Adobe sees two AcroForm fields with the same
  // /T value, treats the duplicate as orphaned, and surfaces the dreaded
  // "Annotations Deleted: Widget annot on page 1" warning in the signature
  // panel. Rename the new widget so every signature field carries a unique /T.
  renameLastWidgetForUniqueness(pdfDoc);

  if (options.stamp) {
    await populateLastWidgetAppearance(pdfDoc, options.stamp);
  }

  // Diff: emit everything whose serialised form differs from the snapshot, or
  // which is brand new.
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

/**
 * Scan the PDF for any `/Type /Sig` entry whose paired `/Contents` hex string
 * holds non-zero bytes — i.e. a completed signature, not a placeholder. We
 * never want to rewrite such a file in place; the only safe edit is an
 * incremental update.
 */
function pdfHasCompletedSignature(bytes: Uint8Array): boolean {
  const text = new TextDecoder("latin1").decode(bytes);
  if (!/\/Type\s*\/Sig\b/.test(text)) return false;
  const contentsPattern = /\/Contents\s*<([0-9a-fA-F\s]*)>/g;
  let match: RegExpExecArray | null;
  while ((match = contentsPattern.exec(text)) !== null) {
    const hex = match[1].replace(/\s+/g, "");
    if (hex.length > 0 && /[1-9a-fA-F]/.test(hex)) return true;
  }
  return false;
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

/**
 * After pdflibAddPlaceholder has run, the most recently added field is our
 * new signature widget. Replace its empty `/AP /N` form XObject with a
 * self-contained appearance stream so the visible stamp renders correctly
 * without touching any existing page content streams.
 */
async function populateLastWidgetAppearance(
  pdfDoc: PDFDocument,
  stamp: DscStampSpec
): Promise<void> {
  const ctx = pdfDoc.context;
  const acroForm = pdfDoc.catalog.lookupMaybe(PDFName.of("AcroForm"), PDFDict);
  if (!acroForm) return;
  const fields = acroForm.lookupMaybe(PDFName.of("Fields"), PDFArray);
  if (!fields || fields.size() === 0) return;
  const widgetRef = fields.get(fields.size() - 1);
  if (!(widgetRef instanceof PDFRef)) return;
  const widgetDict = ctx.lookup(widgetRef, PDFDict);
  if (!widgetDict) return;
  const apDict = widgetDict.lookupMaybe(PDFName.of("AP"), PDFDict);
  if (!apDict) return;
  const apNRef = apDict.get(PDFName.of("N"));
  if (!(apNRef instanceof PDFRef)) return;

  const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const width = stamp.pdfWidth;
  const height = stamp.pdfHeight;
  const isoDate = stamp.signedAt.toISOString().replace("T", " ").slice(0, 19);
  const lines: Array<{ text: string; bold: boolean; size: number }> = [
    { text: "Digitally signed", bold: true, size: 8 },
    { text: `By: ${stamp.signerLabel}`, bold: false, size: 7 },
    { text: `Date: ${isoDate} UTC`, bold: false, size: 7 },
    { text: `Reason: ${stamp.reason ?? DEFAULT_REASON}`, bold: false, size: 7 },
  ];

  const padX = 4;
  const lineGap = 2;
  const innerWidth = width - 2 * padX;
  const ops: string[] = [];
  // Background + border drawn in the form's own coordinate space (BBox).
  ops.push("q");
  ops.push("0.94 0.97 1.0 rg"); // fill colour
  ops.push(`0 0 ${fmtNum(width)} ${fmtNum(height)} re f`);
  ops.push("0 0.3 0.6 RG"); // stroke colour
  ops.push("0.75 w");
  ops.push(`0 0 ${fmtNum(width)} ${fmtNum(height)} re S`);
  ops.push("0 0.2 0.5 rg"); // text colour
  ops.push("BT");
  let cursorY = height - 10;
  for (const line of lines) {
    if (cursorY < 2) break;
    const font = line.bold ? helveticaBold : helvetica;
    const fontTag = line.bold ? "F2" : "F1";
    const truncated = truncateToWidth(line.text, font, line.size, innerWidth);
    // Absolute placement via Tm avoids the leading/relative-Td bookkeeping
    // that bit us when fonts of different sizes alternated.
    ops.push(`/${fontTag} ${line.size} Tf`);
    ops.push(`1 0 0 1 ${fmtNum(padX)} ${fmtNum(cursorY)} Tm`);
    ops.push(`${encodeTextAsPdfHex(font, truncated)} Tj`);
    cursorY -= line.size + lineGap;
  }
  ops.push("ET");
  ops.push("Q");
  const contentStr = ops.join("\n") + "\n";

  const newApStream = ctx.stream(contentStr, {
    Type: "XObject",
    Subtype: "Form",
    FormType: 1,
    BBox: [0, 0, width, height],
    Resources: {
      Font: {
        F1: helvetica.ref,
        F2: helveticaBold.ref,
      },
    },
  });
  ctx.assign(apNRef, newApStream);
}

function fmtNum(n: number): string {
  // PDF readers accept up to ~5 fractional digits; round to keep streams short.
  if (Number.isInteger(n)) return n.toString();
  return n.toFixed(3).replace(/\.?0+$/, "");
}

/**
 * Encode `text` using the font's own encoding (WinAnsi for the standard 14
 * fonts) and return a PDF hex-string literal like `<48656C6C6F>`. Going
 * through `font.encodeText` keeps non-ASCII characters (`…`, accented signer
 * names) glyph-correct, which a raw `(...)` literal cannot guarantee since
 * the source string is UTF-16.
 */
function encodeTextAsPdfHex(font: PDFFont, text: string): string {
  const encoded = font.encodeText(text);
  const buf = new Uint8Array(encoded.sizeInBytes());
  encoded.copyBytesInto(buf, 0);
  return new TextDecoder("latin1").decode(buf);
}

export function assertPdfHasSigningMarkers(pdfBytes: Uint8Array): void {
  const s = new TextDecoder("latin1").decode(pdfBytes);
  if (!s.includes("/ByteRange") || !s.includes("/Contents <")) {
    throw new Error(
      "PDF is missing required signing placeholders. Ensure /ByteRange and /Contents <...> exist."
    );
  }
}

async function drawDscStampOnPage(pdfDoc: PDFDocument, s: DscStampSpec): Promise<void> {
  const page = pdfDoc.getPage(s.pageIndex);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  page.drawRectangle({
    x: s.pdfX,
    y: s.pdfY,
    width: s.pdfWidth,
    height: s.pdfHeight,
    borderColor: rgb(0, 0.3, 0.6),
    borderWidth: 0.75,
    color: rgb(0.94, 0.97, 1.0),
  });

  const isoDate = s.signedAt.toISOString().replace("T", " ").slice(0, 19);
  const lines: Array<{ text: string; font: PDFFont; size: number }> = [
    { text: "Digitally signed", font: bold, size: 8 },
    { text: `By: ${s.signerLabel}`, font, size: 7 },
    { text: `Date: ${isoDate} UTC`, font, size: 7 },
    { text: `Reason: ${s.reason ?? DEFAULT_REASON}`, font, size: 7 },
  ];

  const padX = 4;
  const lineGap = 2;
  const innerWidth = s.pdfWidth - 2 * padX;
  let cursorY = s.pdfY + s.pdfHeight - 10;
  for (const line of lines) {
    if (cursorY < s.pdfY + 2) break;
    page.drawText(truncateToWidth(line.text, line.font, line.size, innerWidth), {
      x: s.pdfX + padX,
      y: cursorY,
      size: line.size,
      font: line.font,
      color: rgb(0, 0.2, 0.5),
    });
    cursorY -= line.size + lineGap;
  }
}

function truncateToWidth(text: string, font: PDFFont, size: number, maxWidth: number): string {
  if (font.widthOfTextAtSize(text, size) <= maxWidth) return text;
  const ellipsis = "…";
  const ellipsisWidth = font.widthOfTextAtSize(ellipsis, size);
  let lo = 0;
  let hi = text.length;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    const w = font.widthOfTextAtSize(text.slice(0, mid), size) + ellipsisWidth;
    if (w <= maxWidth) lo = mid;
    else hi = mid - 1;
  }
  return text.slice(0, lo) + ellipsis;
}
