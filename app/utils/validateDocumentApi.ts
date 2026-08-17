import type { DocumentValidationResult } from "@/app/components/DocumentValidationResultModal";
import type { DocumentType } from "@/app/lib/documentValidation/registry";

/** Vercel serverless request body limit is 4.5 MB. Leave headroom for multipart fields. */
const MAX_UPLOAD_BYTES = 4.4 * 1024 * 1024;

function formatMb(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function messageFromPlatformBody(text: string): string {
  const compact = text.replace(/\s+/g, " ").trim();
  if (/FUNCTION_PAYLOAD_TOO_LARGE|payload too large|413/i.test(compact)) {
    return "This PDF is too large for the server (max 4.5 MB). Compress it or export a smaller file and try again.";
  }
  if (/FUNCTION_INVOCATION_TIMEOUT|timeout/i.test(compact)) {
    return "Document extraction timed out. Try a smaller PDF, or ask your admin to raise the function timeout on Vercel.";
  }
  if (/An error occurred/i.test(compact)) {
    return "The extraction server failed before returning a result. Confirm GEMINI_API_KEY is set in Vercel Production, and that each PDF is under 4.5 MB.";
  }
  return compact.slice(0, 240) || "Could not validate this document.";
}

async function parseValidateDocumentResponse(response: Response): Promise<{
  ok: boolean;
  data: Record<string, unknown>;
  error: string;
}> {
  const text = await response.text();
  try {
    const data = JSON.parse(text) as Record<string, unknown>;
    const error =
      typeof data.error === "string"
        ? data.error
        : "Could not validate this document.";
    return { ok: response.ok, data, error };
  } catch {
    return {
      ok: false,
      data: {},
      error: messageFromPlatformBody(text),
    };
  }
}

export async function validateDocumentFile(
  file: File,
  documentType: DocumentType,
  applicationType?: string
): Promise<DocumentValidationResult> {
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new Error(
      `"${file.name}" is ${formatMb(file.size)} — over the 4.5 MB Vercel upload limit. Compress the PDF and try again.`
    );
  }

  const formData = new FormData();
  formData.append("file", file);
  formData.append("documentType", documentType);
  if (applicationType) {
    formData.append("applicationType", applicationType);
  }

  const response = await fetch("/api/validate-document", {
    method: "POST",
    body: formData,
  });
  const parsed = await parseValidateDocumentResponse(response);
  if (!parsed.ok) {
    throw new Error(parsed.error);
  }
  return parsed.data as unknown as DocumentValidationResult;
}
