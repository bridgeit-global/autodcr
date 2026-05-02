/**
 * High-level signing flow on top of `bridgeClient`.
 *
 *   pingHost()        -> handshake
 *   listAllCerts()    -> LIST_SLOTS, then LIST_CERTS per slot, flattened
 *   signPdf(...)      -> SIGN_PDF_START, SIGN_PDF_CHUNK*, SIGN_PDF_END
 *
 * The orchestrator hides the chunked transport from the React layer so the
 * page can keep the same single-dropdown UX while the new protocol is fully
 * respected on the wire.
 */

import { sendBridgeCommand } from "./bridgeClient";
import { chunkBase64 } from "./pdfChunker";
import {
  CertInfo,
  ListCertsPayload,
  ListCertsResult,
  ListSlotsPayload,
  ListSlotsResult,
  PingPayload,
  PingResult,
  PROTOCOL_VERSION,
  SignPdfChunkPayload,
  SignPdfChunkResult,
  SignPdfEndPayload,
  SignPdfFinalResult,
  SignPdfStartPayload,
  SignPdfStartResult,
  SlotInfo,
} from "./protocol";

const PING_TIMEOUT_MS = 10_000;
const LIST_TIMEOUT_MS = 15_000;
const CHUNK_TIMEOUT_MS = 30_000;
const SIGN_END_TIMEOUT_MS = 120_000;

export interface SignPdfArgs {
  pdfBase64: string;
  slotId: number;
  certId: string;
  fileName?: string;
  contentType?: string;
  /** Optional PIN forwarded to the host as a hint (host may still prompt). */
  pinHint?: string;
  /** Whether certId was freshly resolved from LIST_CERTS for this slot. */
  certSource?: "fresh_slot_lookup" | "cached_ui_state";
  onProgress?: (sent: number, total: number) => void;
  onDebugEvent?: (event: SignPdfDebugEvent) => void;
  signal?: AbortSignal;
}

export interface SignPdfDebugEvent {
  phase: "start" | "chunk" | "end" | "error";
  jobId: string;
  slotId: number;
  certId: string;
  totalChunks: number;
  certSource?: "fresh_slot_lookup" | "cached_ui_state";
  chunkIndex?: number;
  detail?: string;
}

export const pingHost = (signal?: AbortSignal): Promise<PingResult> =>
  sendBridgeCommand<PingPayload, PingResult>(
    "PING",
    { v: PROTOCOL_VERSION },
    { timeoutMs: PING_TIMEOUT_MS, signal }
  );

export const listSlots = (signal?: AbortSignal): Promise<SlotInfo[]> =>
  sendBridgeCommand<ListSlotsPayload, ListSlotsResult>(
    "LIST_SLOTS",
    { v: PROTOCOL_VERSION },
    { timeoutMs: LIST_TIMEOUT_MS, signal }
  ).then((r) => r?.slots ?? []);

export const listCertsForSlot = async (
  slotId: number,
  signal?: AbortSignal
): Promise<CertInfo[]> => {
  const result = await sendBridgeCommand<ListCertsPayload, ListCertsResult>(
    "LIST_CERTS",
    { slotId },
    { timeoutMs: LIST_TIMEOUT_MS, signal }
  );
  const certs = result?.certs ?? [];
  return certs.map((c) => ({ ...c, slotId }));
};

/**
 * Walk every reachable slot and return a single flat array of certs. The
 * existing UI uses one dropdown for cert selection, so flattening here keeps
 * the JSX untouched while still talking the new per-slot protocol.
 */
export const listAllCerts = async (signal?: AbortSignal): Promise<CertInfo[]> => {
  const slots = await listSlots(signal);
  if (slots.length === 0) return [];

  const all: CertInfo[] = [];
  for (const slot of slots) {
    if (signal?.aborted) break;
    try {
      const certs = await listCertsForSlot(slot.slotId, signal);
      all.push(...certs);
    } catch (error) {
      if (slots.length === 1) throw error;
    }
  }
  return all;
};

export const signPdf = async ({
  pdfBase64,
  slotId,
  certId,
  fileName,
  contentType,
  pinHint,
  certSource = "cached_ui_state",
  onProgress,
  onDebugEvent,
  signal,
}: SignPdfArgs): Promise<SignPdfFinalResult> => {
  if (!pdfBase64) {
    throw new Error("Cannot sign an empty PDF payload.");
  }
  if (!certId) {
    throw new Error("Missing certId for signing.");
  }

  const chunks = chunkBase64(pdfBase64);
  if (chunks.length === 0) {
    throw new Error("PDF chunking produced no chunks.");
  }

  const jobId =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `job-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const totalChunks = chunks.length;
  let currentPhase: SignPdfDebugEvent["phase"] = "start";

  try {
    onDebugEvent?.({
      phase: "start",
      jobId,
      slotId,
      certId,
      totalChunks,
      certSource,
      detail: `Dispatching SIGN_PDF_START certSource=${certSource}`,
    });
    await sendBridgeCommand<SignPdfStartPayload, SignPdfStartResult>(
      "SIGN_PDF_START",
      {
        jobId,
        totalChunks,
        slotId,
        certId,
        fileName,
        contentType: contentType ?? "application/pdf",
        pin: pinHint,
      },
      { timeoutMs: CHUNK_TIMEOUT_MS, signal }
    );

    for (let index = 0; index < chunks.length; index += 1) {
      if (signal?.aborted) {
        throw new Error("Signing cancelled.");
      }
      currentPhase = "chunk";
      onDebugEvent?.({
        phase: "chunk",
        jobId,
        slotId,
        certId,
        totalChunks,
        certSource,
        chunkIndex: index,
        detail: "Dispatching SIGN_PDF_CHUNK",
      });
      await sendBridgeCommand<SignPdfChunkPayload, SignPdfChunkResult>(
        "SIGN_PDF_CHUNK",
        { jobId, index, chunkBase64: chunks[index] },
        { timeoutMs: CHUNK_TIMEOUT_MS, signal }
      );
      onProgress?.(index + 1, chunks.length);
    }

    currentPhase = "end";
    onDebugEvent?.({
      phase: "end",
      jobId,
      slotId,
      certId,
      totalChunks,
      certSource,
      detail: "Dispatching SIGN_PDF_END",
    });
    const final = await sendBridgeCommand<SignPdfEndPayload, SignPdfFinalResult>(
      "SIGN_PDF_END",
      { jobId },
      { timeoutMs: SIGN_END_TIMEOUT_MS, signal }
    );

    if (!final?.signedPdfBase64) {
      throw new Error("Native host did not return a signed PDF.");
    }
    return final;
  } catch (error) {
    const detail = `phase=${currentPhase} jobId=${jobId} slotId=${slotId} certId=${certId} totalChunks=${totalChunks}`;
    onDebugEvent?.({
      phase: "error",
      jobId,
      slotId,
      certId,
      totalChunks,
      certSource,
      detail,
    });
    if (error instanceof Error) {
      throw new Error(`${error.message} (${detail})`);
    }
    throw new Error(`Signing failed (${detail})`);
  }
};
