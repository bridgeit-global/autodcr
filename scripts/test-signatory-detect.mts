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
  for (const [file, type] of [
    ["photo.png", "signatory-photo"],
    ["sign.png", "signatory-signature"],
  ] as const) {
    const buf = readFileSync(file);
    const mediaType = file.endsWith(".png") ? "image/png" : "image/jpeg";
    const result = await validateDocumentFile(buf, type, mediaType);
    console.log(file, "->", type, JSON.stringify(result, null, 2));
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
