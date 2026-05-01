/**
 * Wire protocol shared with the AutoDCR Chrome extension and Rust native host.
 *
 * Messages travel page <-> content script <-> service worker <-> native host.
 * All payloads are JSON-serialisable; PDF bytes are transported as base64 chunks.
 */

export const BRIDGE_SOURCE = "AUTODCR_SIGN_BRIDGE" as const;
export const PROTOCOL_VERSION = 1 as const;

export type HostCmd =
  | "PING"
  | "LIST_USB_TOKENS"
  | "LIST_SLOTS"
  | "LIST_CERTS"
  | "SIGN_PDF_START"
  | "SIGN_PDF_CHUNK"
  | "SIGN_PDF_END";

export interface BridgeRequest<P = unknown> {
  source: typeof BRIDGE_SOURCE;
  type: "REQUEST";
  requestId: string;
  cmd: HostCmd;
  payload: P;
}

export interface BridgeErrorPayload {
  code?: string;
  message: string;
}

export interface BridgeResponse<R = unknown> {
  source: typeof BRIDGE_SOURCE;
  type: "RESPONSE";
  requestId: string;
  ok: boolean;
  result?: R;
  error?: BridgeErrorPayload | null;
}

export interface PingPayload {
  v: number;
}

export interface PingResult {
  hostVersion: string;
  protocolVersion: number;
  tokenPresent: boolean;
}

export interface ListSlotsPayload {
  v?: number;
}

export interface SlotInfo {
  slotId: number;
  label?: string;
  description?: string;
  manufacturer?: string;
  tokenPresent?: boolean;
  serialNumber?: string;
}

export interface ListSlotsResult {
  slots: SlotInfo[];
}

export interface ListCertsPayload {
  slotId: number;
}

/**
 * One certificate as exposed by the native host.
 *
 * `id` is the canonical selector for signing and MUST be the certificate's
 * PKCS#11 `CKA_ID` encoded as a plain hex string (no separators, no `0x` prefix).
 * The same `CKA_ID` must resolve to a private key object in the selected slot.
 *
 * `slotId` is injected by the orchestrator (the host's LIST_CERTS response is
 * per-slot, but downstream code wants a single flat list).
 */
export interface CertInfo {
  id: string;
  slotId: number;
  label?: string;
  subject?: string;
  issuer?: string;
  notBefore?: string;
  notAfter?: string;
  derBase64?: string;
}

export interface ListCertsResult {
  certs: CertInfo[];
}

export interface SignPdfStartPayload {
  jobId: string;
  totalChunks: number;
  slotId: number;
  /** Hex PKCS#11 CKA_ID, normalized (no 0x prefix, even-length). */
  certId: string;
  fileName?: string;
  contentType?: string;
  /** Optional PIN hint forwarded from the page; host may still prompt. */
  pin?: string;
}

export interface SignPdfStartResult {
  jobId: string;
}

export interface SignPdfChunkPayload {
  jobId: string;
  index: number;
  chunkBase64: string;
}

export interface SignPdfChunkResult {
  jobId: string;
  index: number;
  received: number;
}

export interface SignPdfEndPayload {
  jobId: string;
}

/**
 * Final response returned by the service worker after it assembles the
 * native host's chunked output back into a single base64 PDF.
 */
export interface SignPdfFinalResult {
  signedPdfBase64: string;
  jobId: string;
}
