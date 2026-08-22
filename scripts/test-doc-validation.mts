import { readFileSync } from "fs";

function loadGeminiKey(): void {
  try {
    const env = readFileSync(".env.local", "utf8");
    const match = env.match(/^GEMINI_API_KEY=(.+)$/m);
    if (match?.[1]) {
      process.env.GEMINI_API_KEY = match[1].trim().replace(/^["']|["']$/g, "");
    }
  } catch {
    // rely on existing env
  }
}

loadGeminiKey();

import { validateDocumentFile } from "../app/lib/documentValidation/index.ts";

async function main() {
  const panBuf = readFileSync("LLP - PAN.pdf");
  const panResult = await validateDocumentFile(
    panBuf,
    "entity-pan",
    "application/pdf"
  );
  console.log("ENTITY PAN:", JSON.stringify(panResult, null, 2));

  const aadhaarBuf = readFileSync(
    "dicuments/WhatsApp Image 2026-08-10 at 12.31.47 PM.jpeg"
  );
  const aadhaarResult = await validateDocumentFile(
    aadhaarBuf,
    "aadhaar",
    "image/jpeg"
  );
  console.log("AADHAAR:", JSON.stringify(aadhaarResult, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
