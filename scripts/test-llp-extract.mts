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
import { extractTextFromPdfBuffer } from "../app/lib/documentValidation/extractText.ts";
import {
  buildLlpIncorporationAutofillPatch,
  parseDateForInput,
} from "../app/lib/documentValidation/registrationAutofill.ts";
import {
  extractDocument,
  extractDocumentFromMedia,
} from "../app/lib/documentValidation/ai.ts";
import { llpIncorporationCertificate } from "../app/lib/documentValidation/documents/llpIncorporationCertificate.ts";

async function main() {
  const buf = readFileSync("Certificate of LLP Incorporation 1.pdf");
  let text = "";
  try {
    text = await extractTextFromPdfBuffer(buf);
    console.log("text length:", text.length);
    console.log("text preview:", JSON.stringify(text.slice(0, 800)));
  } catch (e) {
    console.log("text extraction failed:", e);
  }

  console.log("\n--- text-only extract ---");
  const textResult = await extractDocument(llpIncorporationCertificate, text);
  console.log(JSON.stringify(textResult, null, 2));

  console.log("\n--- multimodal extract ---");
  const mediaResult = await extractDocumentFromMedia(
    llpIncorporationCertificate,
    { data: buf, mediaType: "application/pdf" },
    text
  );
  console.log(JSON.stringify(mediaResult, null, 2));

  const result = await validateDocumentFile(
    buf,
    "llp-incorporation-certificate",
    "application/pdf"
  );
  console.log("\n--- validateDocumentFile ---");
  console.log("extracted:", JSON.stringify(result.extracted, null, 2));
  console.log("valid:", result.valid, "missing:", result.missingFields);
  console.log(
    "patch:",
    JSON.stringify(
      buildLlpIncorporationAutofillPatch(
        result.extracted as Record<string, string | null>
      ),
      null,
      2
    )
  );

  const writtenDate = parseDateForInput(
    "Twenty seventh day of November Two thousand eighteen"
  );
  console.log("\nwritten date parse:", writtenDate);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
