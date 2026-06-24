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
  return {
    text,
    x: Math.min(...cluster.map((item) => item.x)),
    y: Math.max(...cluster.map((item) => item.y)),
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
  thankYou: TextLine | null
): TextLine | null {
  return findColumnForLine(lines, pageMidX, side, thankYou) ?? thankYou;
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
    pdfX = pageWidth - RIGHT_MARGIN - STAMP_WIDTH;
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
      signatureAnchor = findColumnSignatureAnchor(lines, pageMidX, "left", thankYou);
      anchor = findDualColumnStampTopLine(lines, pageMidX, "left", thankYou) ?? thankYou;
    } else if (layout === "dualColumn" && role === "consultant") {
      const thankYou = findLine(lines, "thanking you");
      signatureAnchor = findColumnSignatureAnchor(lines, pageMidX, "right", thankYou);
      anchor = findDualColumnStampTopLine(lines, pageMidX, "right", thankYou) ?? thankYou;
    }

    if (!anchor) {
      return { ...fallback, pageIndex };
    }

    if (
      (layout === "dualColumn" && (role === "owner" || role === "consultant")) ||
      (layout === "cleanRight" && role === "owner")
    ) {
      if (!signatureAnchor) {
        return { ...fallback, pageIndex };
      }
    }

    const rect = computeStampRect({ anchor, pageWidth, role, layout, lines, signatureAnchor });
    return { ...rect, pageIndex };
  } catch {
    return { ...fallback, pageIndex: 0 };
  }
}
