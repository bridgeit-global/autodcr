import type { SupabaseClient } from "@supabase/supabase-js";
import { MAX_PROPOSAL_FILES } from "./chatStore";
import { extractPdf } from "./pdf";
import { isRegulationChatProposalPath, PROPOSAL_STORAGE_BUCKET } from "./proposalUploadShared";

export {
  DIRECT_PROPOSAL_UPLOAD_MAX_BYTES,
  isRegulationChatProposalPath,
  PROPOSAL_STORAGE_BUCKET,
  PROPOSAL_STORAGE_FOLDER,
  regulationChatProposalPath,
  safeProposalFileName,
  VERCEL_FUNCTION_BODY_LIMIT_BYTES,
} from "./proposalUploadShared";

export type ExtractedProposal = {
  filename: string;
  text: string;
  pages: number;
};

export type ExtractProposalsResult =
  | { ok: true; parts: ExtractedProposal[]; storagePaths: string[] }
  | { ok: false; error: string; status: number; storagePaths: string[] };

function isPdf(name: string, mime: string): boolean {
  return mime === "application/pdf" || name.toLowerCase().endsWith(".pdf");
}

async function extractBuffer(
  buffer: Buffer,
  filename: string,
  maxBytes: number,
  uploadMaxMb: number
): Promise<ExtractedProposal | { error: string; status: number }> {
  if (buffer.byteLength > maxBytes) {
    return {
      error: `${filename} must be under ${uploadMaxMb} MB.`,
      status: 400,
    };
  }
  const extracted = await extractPdf(buffer);
  const text = extracted.text.trim();
  if (!text) {
    return {
      error: `Could not extract text from ${filename}. Scanned/image-only PDFs need OCR (not supported yet).`,
      status: 400,
    };
  }
  return { filename, text, pages: extracted.pages };
}

export async function extractProposalsFromForm(params: {
  formData: FormData;
  projectId: string;
  client: SupabaseClient;
  maxBytes: number;
  uploadMaxMb: number;
}): Promise<ExtractProposalsResult> {
  const uploaded = params.formData
    .getAll("proposal")
    .filter((item): item is File => item instanceof File && item.size > 0);
  const storagePaths = params.formData
    .getAll("proposalPath")
    .map((value) => String(value || "").trim())
    .filter(Boolean);
  const storageNames = params.formData
    .getAll("proposalName")
    .map((value) => String(value || "").trim());
  const fail = (error: string, status: number): ExtractProposalsResult => ({
    ok: false,
    error,
    status,
    storagePaths,
  });

  const total = uploaded.length + storagePaths.length;
  if (total > MAX_PROPOSAL_FILES) {
    return fail(`You can upload up to ${MAX_PROPOSAL_FILES} PDFs at a time.`, 400);
  }

  const parts: ExtractedProposal[] = [];

  for (const file of uploaded) {
    const filename = file.name || "proposal.pdf";
    if (!isPdf(filename, file.type || "")) {
      return fail(`Only PDF proposals are supported (${filename}).`, 400);
    }
    if (file.size > params.maxBytes) {
      return fail(`${filename} must be under ${params.uploadMaxMb} MB.`, 400);
    }
    const extracted = await extractBuffer(
      Buffer.from(await file.arrayBuffer()),
      filename,
      params.maxBytes,
      params.uploadMaxMb
    );
    if ("error" in extracted) return fail(extracted.error, extracted.status);
    parts.push(extracted);
  }

  for (let i = 0; i < storagePaths.length; i++) {
    const storagePath = storagePaths[i];
    const filename = storageNames[i] || storagePath.split("/").pop() || "proposal.pdf";
    if (!isRegulationChatProposalPath(params.projectId, storagePath)) {
      return fail("Invalid proposal upload path.", 400);
    }
    if (!isPdf(filename, "")) {
      return fail(`Only PDF proposals are supported (${filename}).`, 400);
    }
    const { data, error } = await params.client.storage
      .from(PROPOSAL_STORAGE_BUCKET)
      .download(storagePath);
    if (error || !data) {
      return fail(error?.message || `Could not read uploaded PDF (${filename}).`, 400);
    }
    const extracted = await extractBuffer(
      Buffer.from(await data.arrayBuffer()),
      filename,
      params.maxBytes,
      params.uploadMaxMb
    );
    if ("error" in extracted) return fail(extracted.error, extracted.status);
    parts.push(extracted);
  }

  return { ok: true, parts, storagePaths };
}

export async function removeProposalUploads(
  client: SupabaseClient,
  storagePaths: string[]
): Promise<void> {
  if (!storagePaths.length) return;
  await client.storage.from(PROPOSAL_STORAGE_BUCKET).remove(storagePaths);
}
