import * as pdfjs from "pdfjs-dist";

const PDF_WORKER_URL = "https://unpkg.com/pdfjs-dist@3.11.174/build/pdf.worker.min.js";

export type DscStampRole = "owner" | "consultant";
export type DscStampLayout = "cleanRight" | "dualColumn";

export type DscStampRect = {
  pageIndex: number;
  pdfX: number;
  pdfY: number;
  pdfWidth: number;
  pdfHeight: number;
};

export const DSC_STAMP_FALLBACK_OWNER: DscStampRect = {
  pageIndex: 0,
  pdfX: 120,
  pdfY: 160,
  pdfWidth: 180,
  pdfHeight: 60,
};

export const DSC_STAMP_FALLBACK_CONSULTANT: DscStampRect = {
  pageIndex: 0,
  pdfX: 370,
  pdfY: 160,
  pdfWidth: 180,
  pdfHeight: 60,
};

const STAMP_WIDTH = 180;
const STAMP_HEIGHT = 60;
const STAMP_GAP = 10;
/** Equal outer margin above/below the stamp box relative to neighbouring text. */
const STAMP_OUTER_MARGIN = 12;
/** Approximate cap height above a 12pt signature baseline. */
const SIGNATURE_LINE_ASCENT = 12;
const LEFT_MARGIN = 56;
const RIGHT_MARGIN = 30;

function consultantFallbackRect(pageIndex: number, pageWidth = 595.28): DscStampRect {
  return {
    pageIndex,
    pdfX: Math.round(pageWidth / 2 + 20),
    pdfY: 160,
    pdfWidth: STAMP_WIDTH,
    pdfHeight: STAMP_HEIGHT,
  };
}

function isInRightColumn(line: TextLine, pageMidX: number): boolean {
  return line.x >= pageMidX * 0.55;
}

let workerConfigured = false;

function ensurePdfWorker(): void {
  if (workerConfigured) return;
  if (!pdfjs.GlobalWorkerOptions.workerSrc) {
    pdfjs.GlobalWorkerOptions.workerSrc = PDF_WORKER_URL;
  }
  workerConfigured = true;
}

type TextItemPos = {
  str: string;
  x: number;
  y: number;
  width: number;
  height: number;
};

type TextLine = {
  text: string;
  x: number;
  y: number;
  endX?: number;
};

function normalizeText(value: string): string {
  return value.replace(/\s+/g, " ").trim().toLowerCase();
}

function clusterToLine(cluster: TextItemPos[]): TextLine {
  const text = cluster
    .map((item) => item.str)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
  const xs = cluster.map((item) => item.x);
  const rights = cluster.map((item) => item.x + item.width);
  return {
    text,
    x: Math.min(...xs),
    y: Math.max(...cluster.map((item) => item.y)),
    endX: Math.max(...rights),
  };
}

function groupTextLines(items: TextItemPos[]): TextLine[] {
  const sorted = [...items].sort((a, b) => b.y - a.y || a.x - b.x);
  const yGroups: TextItemPos[][] = [];

  for (const item of sorted) {
    const group = yGroups.find((candidate) => Math.abs(candidate[0].y - item.y) <= 3);
    if (group) {
      group.push(item);
    } else {
      yGroups.push([item]);
    }
  }

  const lines: TextLine[] = [];
  const columnGap = 80;

  for (const group of yGroups) {
    const byX = [...group].sort((a, b) => a.x - b.x);
    let cluster: TextItemPos[] = [];

    for (const item of byX) {
      if (cluster.length === 0) {
        cluster.push(item);
        continue;
      }
      const last = cluster[cluster.length - 1];
      const gap = item.x - last.x;
      if (gap > columnGap) {
        lines.push(clusterToLine(cluster));
        cluster = [item];
      } else {
        cluster.push(item);
      }
    }

    if (cluster.length > 0) {
      lines.push(clusterToLine(cluster));
    }
  }

  return lines;
}

function findLine(
  lines: TextLine[],
  phrase: string,
  filter?: (line: TextLine) => boolean
): TextLine | null {
  const target = normalizeText(phrase);
  const matches = lines.filter((line) => {
    if (!normalizeText(line.text).includes(target)) return false;
    return filter ? filter(line) : true;
  });
  if (matches.length === 0) return null;
  return matches.reduce((best, line) => (line.y < best.y ? line : best));
}

function extractTextItems(
  content: { items: Array<Record<string, unknown>> }
): TextItemPos[] {
  const items: TextItemPos[] = [];
  for (const raw of content.items) {
    if (typeof raw.str !== "string") continue;
    const transform = raw.transform;
    if (!Array.isArray(transform) || transform.length < 6) continue;
    items.push({
      str: raw.str,
      x: transform[4] as number,
      y: transform[5] as number,
      width: typeof raw.width === "number" ? raw.width : 0,
      height: typeof raw.height === "number" ? raw.height : 0,
    });
  }
  return items;
}

function isInformationRecordLine(text: string): boolean {
  const normalized = normalizeText(text);
  return normalized.includes("information") && normalized.includes("record");
}

function isSignatureIntroLine(text: string): boolean {
  const normalized = normalizeText(text);
  return (
    normalized.includes("yours faithfully") ||
    normalized.includes("approved and confirmed") ||
    normalized.startsWith("for ") ||
    normalized.startsWith("name:") ||
    normalized.startsWith("reg.") ||
    normalized.includes("reg. no")
  );
}

function isThankYouLine(text: string): boolean {
  return normalizeText(text).includes("thanking you");
}

const SIGNATORY_DESIGNATION_TITLES = [
  "director",
  "designated partner",
  "trustee",
  "partner",
  "authorized signatory",
  "proprietor",
] as const;

const CONSULTANT_ROLE_LABELS = [
  "architect",
  "consultant",
  "plumber",
  "licensed surveyor",
  "structural engineer",
  "fire safety consultant",
  "landscape consultant",
  "geotechnical consultant",
  "m&e consultant",
  "town planner",
  "environmental consultant",
  "pmc / project manager",
  "site supervisor",
  "horticulturist",
  "parking consultant",
  "rainwater consultant",
] as const;

function isSignatoryDesignationTitle(text: string): boolean {
  const normalized = normalizeText(text);
  return SIGNATORY_DESIGNATION_TITLES.some(
    (title) => normalized === title || normalized.startsWith(`${title} `)
  );
}

function isConsultantRoleLabel(text: string): boolean {
  const normalized = normalizeText(text).replace(/\.$/, "");
  return CONSULTANT_ROLE_LABELS.some(
    (label) => normalized === label || normalized.startsWith(`${label} `)
  );
}

function findColumnForLine(
  lines: TextLine[],
  pageMidX: number,
  side: "left" | "right",
  thankYou: TextLine | null
): TextLine | null {
  const matches = lines.filter((line) => {
    const text = normalizeText(line.text);
    if (!text.startsWith("for ")) return false;
    if (isInformationRecordLine(text)) return false;
    if (side === "left" ? line.x >= pageMidX : line.x < pageMidX * 0.55) return false;
    if (thankYou && line.y > thankYou.y + 10) return false;
    return true;
  });
  if (matches.length === 0) return null;
  // Nearest "For {company}," line above the designation — highest y below thank-you.
  return matches.reduce((best, line) => (line.y > best.y ? line : best));
}

/** Bottom baseline of the "For {company}," block (handles wrapped long company names). */
function findColumnCompanyBlockBottomLine(
  lines: TextLine[],
  pageMidX: number,
  side: "left" | "right",
  thankYou: TextLine | null,
  designationAnchor: TextLine | null
): TextLine | null {
  const forTop = findColumnForLine(lines, pageMidX, side, thankYou);
  if (!forTop) return null;

  const columnLines = lines.filter((line) =>
    side === "left" ? line.x < pageMidX : line.x >= pageMidX * 0.55
  );
  const floorY = designationAnchor?.y ?? 0;

  const blockLines = columnLines.filter((line) => {
    if (thankYou && line.y > thankYou.y + 10) return false;
    if (thankYou && line.y >= thankYou.y - 8) return false;
    if (line.y <= floorY + 2) return false;
    if (line.y > forTop.y + 2) return false;
    const text = normalizeText(line.text);
    if (isThankYouLine(text) || isInformationRecordLine(text)) return false;
    if (text.includes("yours faithfully") || text.includes("approved and confirmed")) return false;
    if (isSignatoryDesignationTitle(text) || isConsultantRoleLabel(text)) return false;
    if (text.startsWith("name:") || text.includes("coa reg") || text.startsWith("valid upto")) {
      return false;
    }
    return true;
  });

  if (blockLines.length === 0) return forTop;
  return blockLines.reduce((best, line) => (line.y < best.y ? line : best));
}

function findColumnSignatureLines(
  lines: TextLine[],
  pageMidX: number,
  side: "left" | "right",
  thankYou: TextLine | null
): TextLine[] {
  const columnLines = lines.filter((line) =>
    side === "left" ? line.x < pageMidX : line.x >= pageMidX * 0.55
  );
  return columnLines.filter((line) => {
    const text = normalizeText(line.text);
    if (text.startsWith("c. c.") || text.startsWith("c.c.")) return false;
    if (isThankYouLine(text)) return false;
    if (isInformationRecordLine(text)) return false;
    if (thankYou && line.y > thankYou.y + 10) return false;
    if (thankYou && line.y >= thankYou.y - 8) return false;
    if (isSignatureIntroLine(text)) return false;
    return true;
  });
}

/** Prefer Director / Architect role line over the signatory person name below it. */
function findColumnDesignationAnchor(
  lines: TextLine[],
  pageMidX: number,
  side: "left" | "right",
  thankYou: TextLine | null
): TextLine | null {
  const signatureLines = findColumnSignatureLines(lines, pageMidX, side, thankYou);
  const designationLines = signatureLines.filter((line) => {
    const text = normalizeText(line.text);
    return isSignatoryDesignationTitle(text) || isConsultantRoleLabel(text);
  });
  if (designationLines.length > 0) {
    return designationLines.reduce((best, line) => (line.y > best.y ? line : best));
  }
  return findColumnSignatureAnchor(lines, pageMidX, side, thankYou);
}

function findColumnSignatureAnchor(
  lines: TextLine[],
  pageMidX: number,
  side: "left" | "right",
  thankYou: TextLine | null
): TextLine | null {
  const signatureLines = findColumnSignatureLines(lines, pageMidX, side, thankYou);
  if (signatureLines.length === 0) return null;
  return signatureLines.reduce((best, line) => (line.y > best.y ? line : best));
}

function findRightSignatureLines(
  lines: TextLine[],
  pageMidX: number,
  thankYou: TextLine | null
): TextLine[] {
  return findColumnSignatureLines(lines, pageMidX, "right", thankYou);
}

function findRightSignatureAnchor(
  lines: TextLine[],
  pageMidX: number,
  thankYou: TextLine | null
): TextLine | null {
  return findColumnSignatureAnchor(lines, pageMidX, "right", thankYou);
}

function computeBalancedStampY(topLine: TextLine, signatureAnchor: TextLine): number {
  const gapTopY = topLine.y;
  const gapBottomY = signatureAnchor.y + SIGNATURE_LINE_ASCENT;
  const totalSpace = gapTopY - gapBottomY;
  const remaining = totalSpace - STAMP_HEIGHT - 2 * STAMP_OUTER_MARGIN;

  if (remaining >= 0) {
    return gapBottomY + STAMP_OUTER_MARGIN + remaining / 2;
  }

  const overlap = STAMP_HEIGHT + 2 * STAMP_OUTER_MARGIN - totalSpace;
  return gapBottomY + STAMP_OUTER_MARGIN - overlap / 2;
}

function findDualColumnStampTopLine(
  lines: TextLine[],
  pageMidX: number,
  side: "left" | "right",
  thankYou: TextLine | null,
  designationAnchor: TextLine | null
): TextLine | null {
  return (
    findColumnCompanyBlockBottomLine(lines, pageMidX, side, thankYou, designationAnchor) ??
    findColumnForLine(lines, pageMidX, side, thankYou) ??
    thankYou
  );
}

function findRightColumnSignatureLeftX(
  lines: TextLine[],
  pageMidX: number,
  thankYou: TextLine | null
): number | null {
  const approved = findLine(lines, "approved and confirmed", (line) =>
    isInRightColumn(line, pageMidX)
  );
  if (approved) return approved.x;

  const forLine = findColumnForLine(lines, pageMidX, "right", thankYou);
  if (forLine) return forLine.x;

  const introLines = lines.filter((line) => {
    if (!isInRightColumn(line, pageMidX)) return false;
    if (thankYou && line.y > thankYou.y + 10) return false;
    if (thankYou && line.y >= thankYou.y - 8) return false;
    const text = normalizeText(line.text);
    if (isThankYouLine(text) || isInformationRecordLine(text)) return false;
    return text.includes("approved and confirmed") || text.startsWith("for ");
  });
  if (introLines.length > 0) {
    return Math.min(...introLines.map((line) => line.x));
  }
  return null;
}

function findConsultantSignatureAnchor(
  lines: TextLine[],
  pageMidX: number,
  thankYou: TextLine | null
): TextLine | null {
  return (
    findColumnDesignationAnchor(lines, pageMidX, "right", thankYou) ??
    findColumnSignatureAnchor(lines, pageMidX, "right", thankYou) ??
    findColumnSignatureAnchor(lines, pageMidX, "right", null) ??
    findLine(lines, "consultant", (line) => isInRightColumn(line, pageMidX)) ??
    findLine(lines, "plumber", (line) => isInRightColumn(line, pageMidX)) ??
    findLine(lines, "architect", (line) => isInRightColumn(line, pageMidX))
  );
}

function findConsultantStampTopLine(
  lines: TextLine[],
  pageMidX: number,
  thankYou: TextLine | null,
  designationAnchor: TextLine | null
): TextLine | null {
  return (
    findDualColumnStampTopLine(lines, pageMidX, "right", thankYou, designationAnchor) ??
    findLine(lines, "approved and confirmed", (line) => isInRightColumn(line, pageMidX)) ??
    thankYou
  );
}

function computeStampRect(args: {
  anchor: TextLine;
  pageWidth: number;
  role: DscStampRole;
  layout: DscStampLayout;
  lines: TextLine[];
  signatureAnchor?: TextLine | null;
}): DscStampRect {
  const { anchor, pageWidth, role, layout, lines, signatureAnchor } = args;

  let pdfX: number;
  if (layout === "cleanRight" && role === "owner") {
    pdfX = pageWidth - RIGHT_MARGIN - STAMP_WIDTH;
  } else if (layout === "dualColumn" && role === "owner") {
    pdfX = LEFT_MARGIN;
  } else if (layout === "dualColumn" && role === "consultant") {
    const pageMidX = pageWidth / 2;
    const thankYou = findLine(lines, "thanking you");
    pdfX =
      findRightColumnSignatureLeftX(lines, pageMidX, thankYou) ??
      Math.round(pageMidX + 20);
  } else {
    pdfX = Math.max(LEFT_MARGIN, Math.min(anchor.x, pageWidth - RIGHT_MARGIN - STAMP_WIDTH));
  }

  let pdfY: number;
  if (signatureAnchor && anchor) {
    if (
      (layout === "cleanRight" && role === "owner") ||
      (layout === "dualColumn" && (role === "owner" || role === "consultant"))
    ) {
      pdfY = computeBalancedStampY(anchor, signatureAnchor);
    } else {
      pdfY = anchor.y - STAMP_GAP - STAMP_HEIGHT;
    }
  } else {
    pdfY = anchor.y - STAMP_GAP - STAMP_HEIGHT;
  }

  return {
    pageIndex: 0,
    pdfX,
    pdfY: Math.max(20, pdfY),
    pdfWidth: STAMP_WIDTH,
    pdfHeight: STAMP_HEIGHT,
  };
}

/**
 * Locate a DSC stamp rectangle on the last page of a letter PDF by searching
 * for known anchor phrases ("Thanking you", "Yours faithfully", etc.).
 */
export async function resolveDscStampRectFromPdf(
  pdfBytes: ArrayBuffer,
  role: DscStampRole,
  layout: DscStampLayout
): Promise<DscStampRect> {
  const fallback = role === "consultant" ? DSC_STAMP_FALLBACK_CONSULTANT : DSC_STAMP_FALLBACK_OWNER;

  try {
    ensurePdfWorker();
    const pdf = await pdfjs.getDocument({ data: pdfBytes.slice(0) }).promise;
    if (pdf.numPages === 0) return { ...fallback, pageIndex: 0 };

    const pageIndex = pdf.numPages - 1;
    const page = await pdf.getPage(pageIndex + 1);
    const viewport = page.getViewport({ scale: 1 });
    const pageWidth = viewport.width;
    const pageMidX = pageWidth / 2;

    const textContent = await page.getTextContent();
    const lines = groupTextLines(extractTextItems(textContent));

    let anchor: TextLine | null = null;
    let signatureAnchor: TextLine | null = null;
    if (layout === "cleanRight" && role === "owner") {
      const thankYou = findLine(lines, "thanking you");
      signatureAnchor = findRightSignatureAnchor(lines, pageMidX, thankYou);
      anchor = thankYou;
    } else if (layout === "dualColumn" && role === "owner") {
      const thankYou = findLine(lines, "thanking you");
      signatureAnchor = findColumnDesignationAnchor(lines, pageMidX, "left", thankYou);
      anchor = findDualColumnStampTopLine(lines, pageMidX, "left", thankYou, signatureAnchor) ?? thankYou;
    } else if (layout === "dualColumn" && role === "consultant") {
      const thankYou = findLine(lines, "thanking you");
      signatureAnchor = findConsultantSignatureAnchor(lines, pageMidX, thankYou);
      anchor = findConsultantStampTopLine(lines, pageMidX, thankYou, signatureAnchor);
    }

    if (!anchor) {
      return consultantFallbackRect(pageIndex, pageWidth);
    }

    if (
      (layout === "dualColumn" && (role === "owner" || role === "consultant")) ||
      (layout === "cleanRight" && role === "owner")
    ) {
      if (!signatureAnchor) {
        return role === "consultant"
          ? consultantFallbackRect(pageIndex, pageWidth)
          : { ...fallback, pageIndex };
      }
    }

    const rect = computeStampRect({ anchor, pageWidth, role, layout, lines, signatureAnchor });
    return { ...rect, pageIndex };
  } catch {
    return role === "consultant"
      ? consultantFallbackRect(0)
      : { ...fallback, pageIndex: 0 };
  }
}
