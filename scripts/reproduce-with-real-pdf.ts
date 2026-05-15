import { readFileSync, writeFileSync } from "fs";
import { createHash } from "crypto";
import { preparePdfForNativeSigning } from "../app/lib/bridge/pdfSigningPrep";

async function main() {
const signedPath = "/Users/Faisalansari/Downloads/signed-KG.pdf";
const brokenPath = "/Users/Faisalansari/Downloads/signed-signed-KG.pdf";

const signed = new Uint8Array(readFileSync(signedPath));
const broken = new Uint8Array(readFileSync(brokenPath));

console.log(`signed-KG.pdf:        ${signed.length} bytes`);
console.log(`signed-signed-KG.pdf: ${broken.length} bytes`);

const buf = signed.buffer.slice(signed.byteOffset, signed.byteOffset + signed.byteLength) as ArrayBuffer;
const out = await preparePdfForNativeSigning(buf, {
  stamp: {
    pageIndex: 0,
    pdfX: 100,
    pdfY: 200,
    pdfWidth: 200,
    pdfHeight: 60,
    signerLabel: "Test",
    signedAt: new Date(),
    reason: "Document approval",
  },
});

console.log(`my prep output:       ${out.length} bytes`);
writeFileSync("/tmp/my-prep-output.pdf", Buffer.from(out));

// Is signed-KG.pdf a verbatim prefix of my output?
let firstDiff = -1;
for (let i = 0; i < signed.length; i++) {
  if (signed[i] !== out[i]) { firstDiff = i; break; }
}
console.log(`\nIs original a verbatim prefix of MY output?`);
console.log(`  first diff: ${firstDiff === -1 ? "NONE — prefix preserved correctly" : firstDiff}`);
if (firstDiff !== -1) {
  const start = Math.max(0, firstDiff - 20);
  const end = Math.min(signed.length, firstDiff + 50);
  const a = new TextDecoder("latin1").decode(signed.subarray(start, end)).replace(/[\x00-\x1f]/g, ".");
  const b = new TextDecoder("latin1").decode(out.subarray(start, end)).replace(/[\x00-\x1f]/g, ".");
  console.log(`  signed-KG: ${a}`);
  console.log(`  my output: ${b}`);
}

// Is the user's broken output a verbatim prefix of the original?
let firstDiffUser = -1;
for (let i = 0; i < signed.length; i++) {
  if (signed[i] !== broken[i]) { firstDiffUser = i; break; }
}
console.log(`\nIs original a verbatim prefix of USER's broken output?`);
console.log(`  first diff: ${firstDiffUser === -1 ? "NONE — prefix preserved correctly" : firstDiffUser}`);
}
main().catch(e => { console.error(e); process.exit(1); });
