/** Vercel Functions reject request bodies over 4.5 MB with HTTP 413. */
export const VERCEL_FUNCTION_BODY_LIMIT_BYTES = 4.5 * 1024 * 1024;
/** Leave headroom for multipart fields and encoding when posting files directly. */
export const DIRECT_PROPOSAL_UPLOAD_MAX_BYTES = 4 * 1024 * 1024;

export const PROPOSAL_STORAGE_BUCKET = "project-library";
export const PROPOSAL_STORAGE_FOLDER = "regulation-chat";

export function safeProposalFileName(name: string): string {
  const trimmed =
    name.replace(/[^a-zA-Z0-9._-]+/g, "_").replace(/^_+|_+$/g, "") || "proposal.pdf";
  return trimmed.toLowerCase().endsWith(".pdf") ? trimmed : `${trimmed}.pdf`;
}

export function regulationChatProposalPath(projectId: string, fileName: string): string {
  return `${projectId}/${PROPOSAL_STORAGE_FOLDER}/${crypto.randomUUID()}/${safeProposalFileName(fileName)}`;
}

export function isRegulationChatProposalPath(projectId: string, storagePath: string): boolean {
  const prefix = `${projectId}/${PROPOSAL_STORAGE_FOLDER}/`;
  if (!storagePath.startsWith(prefix)) return false;
  if (storagePath.includes("..") || storagePath.includes("\\") || storagePath.includes("//")) {
    return false;
  }
  const rest = storagePath.slice(prefix.length).split("/");
  return rest.length === 2 && Boolean(rest[0]) && rest[1].toLowerCase().endsWith(".pdf");
}
