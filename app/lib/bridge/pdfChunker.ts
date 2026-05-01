/**
 * Helpers for moving PDF bytes across the postMessage / native messaging
 * boundary.
 *
 * The bridge uses base64 strings as the on-the-wire representation. The
 * native host accepts SIGN_PDF_CHUNK payloads up to ~256 KiB of base64 chars,
 * so we split larger payloads into a sequence of indexed chunks.
 */

/** Maximum base64 characters per SIGN_PDF_CHUNK payload. */
export const CHUNK_SIZE = 256 * 1024;

/**
 * Split a base64 string into deterministic, fixed-size pieces.
 * Returns `[base64]` for short inputs and `[]` only when input is empty.
 */
export const chunkBase64 = (base64: string, chunkSize: number = CHUNK_SIZE): string[] => {
  if (!base64) return [];
  if (chunkSize <= 0) {
    throw new RangeError("chunkSize must be > 0");
  }
  if (base64.length <= chunkSize) return [base64];

  const chunks: string[] = [];
  for (let offset = 0; offset < base64.length; offset += chunkSize) {
    chunks.push(base64.slice(offset, offset + chunkSize));
  }
  return chunks;
};

/**
 * Re-join chunks produced by `chunkBase64`. The service worker normally
 * assembles native chunks itself, but a symmetric helper keeps the codebase
 * useful when the assembly point ever moves to the page.
 */
export const assembleChunks = (chunks: ReadonlyArray<string>): string => {
  if (chunks.length === 0) return "";
  if (chunks.length === 1) return chunks[0];
  return chunks.join("");
};

/**
 * Read a Blob and return its base64 contents (no `data:...;base64,` prefix).
 */
export const blobToBase64 = (blob: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const dataUrl = reader.result;
      if (typeof dataUrl !== "string") {
        reject(new Error("Unable to encode PDF payload."));
        return;
      }
      const commaIndex = dataUrl.indexOf(",");
      resolve(commaIndex >= 0 ? dataUrl.slice(commaIndex + 1) : "");
    };
    reader.onerror = () => reject(new Error("Failed to read PDF data."));
    reader.readAsDataURL(blob);
  });

/**
 * Decode a base64 string back into a Blob with the supplied MIME type.
 */
export const base64ToBlob = (base64: string, mimeType: string): Blob => {
  const byteChars = atob(base64);
  const byteNumbers = new Uint8Array(byteChars.length);
  for (let i = 0; i < byteChars.length; i += 1) {
    byteNumbers[i] = byteChars.charCodeAt(i);
  }
  return new Blob([byteNumbers], { type: mimeType });
};
