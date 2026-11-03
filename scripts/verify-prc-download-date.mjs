/**
 * One-off: DigiSatbara download date from sample PR card → DATE_OF_PRC.
 *   node scripts/verify-prc-download-date.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const pdf = require("pdf-parse");

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sample = path.join(
  root,
  "project document/prc Cards/PR Card CTS 177-32.pdf"
);

const DMY_RE = /\b(\d{2})\/(\d{2})\/(\d{4})\b/;

function normalizeDmy(raw) {
  const m = raw.trim().match(DMY_RE);
  if (!m) return null;
  const day = Number(m[1]);
  const month = Number(m[2]);
  const year = Number(m[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31 || year < 1990 || year > 2100) {
    return null;
  }
  return `${m[1]}/${m[2]}/${m[3]}`;
}

/** Mirrors app/lib/documentValidation/documents/prCard.ts parsePrCardDownloadDate */
function parsePrCardDownloadDate(documentText) {
  const text = documentText?.trim();
  if (!text) return null;
  const anchors = [
    /डाउनलोड[^\d]{0,40}?(\d{2}\/\d{2}\/\d{4})/u,
    /download\s*(?:date|दिनांक|िदनांक)?[^\d]{0,40}?(\d{2}\/\d{2}\/\d{4})/iu,
    /पत्रिका[^\d]{0,60}?डाउनलोड[^\d]{0,40}?(\d{2}\/\d{2}\/\d{4})/u,
  ];
  for (const re of anchors) {
    const m = text.match(re);
    if (!m?.[1]) continue;
    const n = normalizeDmy(m[1]);
    if (n) return n;
  }
  return null;
}

const buf = fs.readFileSync(sample);
const { text } = await pdf(buf);
const date = parsePrCardDownloadDate(text);
console.log("sample:", path.basename(sample));
console.log("parsed download date:", date);
if (date !== "12/02/2025") {
  console.error("FAIL: expected 12/02/2025");
  process.exit(1);
}
if (date === "02/02/2019") {
  console.error("FAIL: used digital-signature date");
  process.exit(1);
}
console.log("OK");
