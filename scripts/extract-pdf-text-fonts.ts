import { readFileSync } from "fs";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.js";

async function main() {
  const data = new Uint8Array(readFileSync("/tmp/test-incr.pdf"));
  const doc = await getDocument({ data, standardFontDataUrl: "https://unpkg.com/pdfjs-dist@3.11.174/standard_fonts/" }).promise;
  const page = await doc.getPage(1);
  const tc = await page.getTextContent();
  for (const item of tc.items) {
    if (!("str" in item)) continue;
    const s = item.str.trim();
    if (!s) continue;
    console.log(JSON.stringify({ text: s, font: item.fontName, height: item.height }));
  }
}

main().catch(console.error);
