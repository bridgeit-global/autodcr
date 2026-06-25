/**
 * Smoke test for anchor-based DSC stamp placement.
 * Run: npx tsx scripts/test-dsc-stamp-placement.ts
 */
import { createRequire } from "node:module";
import { PDFDocument, StandardFonts } from "pdf-lib";
import * as pdfjs from "pdfjs-dist";

const require = createRequire(import.meta.url);
pdfjs.GlobalWorkerOptions.workerSrc = require.resolve("pdfjs-dist/build/pdf.worker.min.js");

async function makeLetterPdf(lines: Array<{ text: string; x: number; y: number }>): Promise<ArrayBuffer> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([595.28, 841.89]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  for (const line of lines) {
    page.drawText(line.text, { x: line.x, y: line.y, size: 12, font });
  }
  const bytes = await doc.save();
  return bytes.slice().buffer;
}

async function run() {
  const { resolveDscStampRectFromPdf } = await import("../app/lib/bridge/dscStampPlacement");

  const plumberPdf = await makeLetterPdf([
    { text: "I/We am/are enclosing herewith the letter of consent/acceptance from the Plumber.", x: 56, y: 350 },
    { text: "for the above referred project.", x: 56, y: 330 },
    { text: "Thanking you,", x: 56, y: 280 },
    { text: "Director", x: 400, y: 220 },
    { text: "John Doe", x: 400, y: 200 },
  ]);
  const plumberRect = await resolveDscStampRectFromPdf(plumberPdf, "owner", "cleanRight");
  console.log("Plumber appointment:", plumberRect);
  const gapTop = 280;
  const gapBottom = 220 + 12;
  const remaining = gapTop - gapBottom - 60 - 24;
  const expectedY = remaining >= 0 ? gapBottom + 12 + remaining / 2 : gapBottom + 12 - (60 + 24 - (gapTop - gapBottom)) / 2;
  if (Math.abs(plumberRect.pdfY - expectedY) > 1) {
    throw new Error(`Expected balanced margins at pdfY=${expectedY}, got pdfY=${plumberRect.pdfY}`);
  }
  const marginTop = gapTop - (plumberRect.pdfY + 60);
  const marginBottom = plumberRect.pdfY - gapBottom;
  if (Math.abs(marginTop - marginBottom) > 2) {
    throw new Error(`Unequal margins: top=${marginTop}, bottom=${marginBottom}`);
  }
  if (plumberRect.pdfX < 350) {
    throw new Error(`Expected right-aligned stamp, got pdfX=${plumberRect.pdfX}`);
  }

  const architectPdf = await makeLetterPdf([
    { text: "Thanking You,", x: 56, y: 300 },
    { text: "Yours faithfully,", x: 56, y: 250 },
    { text: "For Tata,", x: 56, y: 235 },
    { text: "Owner Director", x: 56, y: 210 },
    { text: "Owner Name", x: 56, y: 190 },
    { text: "Approved and confirmed,", x: 320, y: 250 },
    { text: "For Tata,", x: 320, y: 235 },
    { text: "Consultant", x: 320, y: 210 },
    { text: "Consultant Name", x: 320, y: 190 },
  ]);
  const ownerRect = await resolveDscStampRectFromPdf(architectPdf, "owner", "dualColumn");
  const consultantRect = await resolveDscStampRectFromPdf(architectPdf, "consultant", "dualColumn");
  console.log("Architect owner:", ownerRect);
  console.log("Architect consultant:", consultantRect);
  if (ownerRect.pdfX > 200) {
    throw new Error(`Expected owner stamp on left, got pdfX=${ownerRect.pdfX}`);
  }
  if (consultantRect.pdfX < 280) {
    throw new Error(`Expected consultant stamp on right, got pdfX=${consultantRect.pdfX}`);
  }
  if (Math.abs(consultantRect.pdfX - 320) > 2) {
    throw new Error(`Expected consultant stamp left-aligned at x=320, got pdfX=${consultantRect.pdfX}`);
  }
  const architectGapBottom = 210 + 12;
  if (ownerRect.pdfY > 260) {
    throw new Error(`Owner stamp should be in signature block, got pdfY=${ownerRect.pdfY}`);
  }
  if (ownerRect.pdfY < architectGapBottom - 40) {
    throw new Error(`Owner stamp should sit above designation, got pdfY=${ownerRect.pdfY}`);
  }
  if (Math.abs(ownerRect.pdfY - consultantRect.pdfY) > 1) {
    throw new Error(`Owner and consultant stamps should share the same row, got ${ownerRect.pdfY} vs ${consultantRect.pdfY}`);
  }

  const acceptanceOwnerPdf = await makeLetterPdf([
    { text: "I will be carrying out the work as per my scope of appointment.", x: 56, y: 420 },
    { text: "This is for your information and record please.", x: 56, y: 400 },
    { text: "Thanking you,", x: 56, y: 280 },
    { text: "Yours faithfully,", x: 56, y: 255 },
    { text: "For Tata,", x: 56, y: 240 },
    { text: "Director", x: 56, y: 130 },
    { text: "Munib Naeemuddin", x: 56, y: 110 },
    { text: "Approved and confirmed,", x: 320, y: 255 },
    { text: "For Tata,", x: 320, y: 240 },
    { text: "Plumber", x: 320, y: 130 },
    { text: "For information & record please.", x: 56, y: 70 },
  ]);
  const acceptanceOwnerRect = await resolveDscStampRectFromPdf(
    acceptanceOwnerPdf,
    "owner",
    "dualColumn"
  );
  console.log("Acceptance owner:", acceptanceOwnerRect);
  if (acceptanceOwnerRect.pdfX > 200) {
    throw new Error(`Expected acceptance owner stamp on left, got pdfX=${acceptanceOwnerRect.pdfX}`);
  }
  if (acceptanceOwnerRect.pdfY > 250) {
    throw new Error(`Acceptance owner stamp should be below body text, got pdfY=${acceptanceOwnerRect.pdfY}`);
  }
  const acceptanceGapTop = 240;
  const acceptanceGapBottom = 130 + 12;
  const expectedAcceptanceY =
    acceptanceGapBottom + 12 + (acceptanceGapTop - acceptanceGapBottom - 60 - 24) / 2;
  if (Math.abs(acceptanceOwnerRect.pdfY - expectedAcceptanceY) > 1) {
    throw new Error(
      `Expected balanced acceptance owner stamp at pdfY=${expectedAcceptanceY}, got pdfY=${acceptanceOwnerRect.pdfY}`
    );
  }

  const acceptanceConsultantPdf = await makeLetterPdf([
    { text: "Thanking you,", x: 56, y: 280 },
    { text: "Yours faithfully,", x: 56, y: 255 },
    { text: "For Tata,", x: 56, y: 240 },
    { text: "Director", x: 56, y: 130 },
    { text: "Approved and confirmed,", x: 320, y: 255 },
    { text: "For Tata,", x: 320, y: 240 },
    { text: "M&E Consultant", x: 320, y: 130 },
    { text: "For information & record please.", x: 56, y: 70 },
  ]);
  const acceptanceConsultantRect = await resolveDscStampRectFromPdf(
    acceptanceConsultantPdf,
    "consultant",
    "dualColumn"
  );
  console.log("Acceptance consultant:", acceptanceConsultantRect);
  if (acceptanceConsultantRect.pdfX > 360) {
    throw new Error(
      `Acceptance consultant stamp should align with right column, got pdfX=${acceptanceConsultantRect.pdfX}`
    );
  }
  if (acceptanceConsultantRect.pdfX < 280) {
    throw new Error(
      `Expected acceptance consultant stamp on right, got pdfX=${acceptanceConsultantRect.pdfX}`
    );
  }
  if (Math.abs(acceptanceConsultantRect.pdfX - 320) > 2) {
    throw new Error(
      `Expected acceptance consultant stamp at x=320, got pdfX=${acceptanceConsultantRect.pdfX}`
    );
  }
  const consultantGapTop = 240;
  const consultantGapBottom = 130 + 12;
  const expectedConsultantY =
    consultantGapBottom + 12 + (consultantGapTop - consultantGapBottom - 60 - 24) / 2;
  if (Math.abs(acceptanceConsultantRect.pdfY - expectedConsultantY) > 1) {
    throw new Error(
      `Expected balanced acceptance consultant stamp at pdfY=${expectedConsultantY}, got pdfY=${acceptanceConsultantRect.pdfY}`
    );
  }

  const consultantOnlyPdf = await makeLetterPdf([
    { text: "Thanking you,", x: 56, y: 280 },
    { text: "Yours faithfully,", x: 56, y: 250 },
    { text: "Director", x: 56, y: 220 },
    { text: "Approved and confirmed,", x: 320, y: 250 },
    { text: "Plumber", x: 320, y: 220 },
  ]);
  const consultantOnlyRect = await resolveDscStampRectFromPdf(
    consultantOnlyPdf,
    "consultant",
    "dualColumn"
  );
  console.log("Consultant-only:", consultantOnlyRect);
  if (consultantOnlyRect.pdfX < 280) {
    throw new Error(`Expected consultant stamp on right, got pdfX=${consultantOnlyRect.pdfX}`);
  }
  if (Math.abs(consultantOnlyRect.pdfX - 320) > 2) {
    throw new Error(`Expected consultant-only stamp at x=320, got pdfX=${consultantOnlyRect.pdfX}`);
  }

  const lsAppointmentPdf = await makeLetterPdf([
    { text: "Thanking You,", x: 56, y: 300 },
    { text: "Yours faithfully,", x: 56, y: 250 },
    { text: "For Tata,", x: 56, y: 235 },
    { text: "Director", x: 56, y: 210 },
    { text: "Owner Name", x: 56, y: 190 },
    { text: "Approved and confirmed", x: 288, y: 250 },
    { text: "For Tata,", x: 288, y: 235 },
    { text: "Licensed Surveyor", x: 288, y: 210 },
  ]);
  const lsConsultantRect = await resolveDscStampRectFromPdf(
    lsAppointmentPdf,
    "consultant",
    "dualColumn"
  );
  console.log("Licensed Surveyor appointment consultant:", lsConsultantRect);
  if (lsConsultantRect.pdfX < 260) {
    throw new Error(`Expected LS consultant stamp on right, got pdfX=${lsConsultantRect.pdfX}`);
  }
  if (Math.abs(lsConsultantRect.pdfX - 288) > 4) {
    throw new Error(`Expected LS consultant stamp at x=288, got pdfX=${lsConsultantRect.pdfX}`);
  }

  console.log("All placement checks passed.");
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
