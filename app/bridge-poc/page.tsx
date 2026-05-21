"use client";

import { useEffect, useRef, useState } from "react";
import { RenderPageProps, Viewer, Worker } from "@react-pdf-viewer/core";
import { defaultLayoutPlugin } from "@react-pdf-viewer/default-layout";
import { PDFDocument } from "pdf-lib";
import "@react-pdf-viewer/core/lib/styles/index.css";
import "@react-pdf-viewer/default-layout/lib/styles/index.css";

import { isExtensionAvailable, sendBridgeCommand } from "@/app/lib/bridge/bridgeClient";
import { mapBridgeError } from "@/app/lib/bridge/errorMapper";
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
} from "@/app/lib/bridge/protocol";
import {
  DscStampSpec,
  assertPdfHasSigningMarkers,
  preparePdfForNativeSigning,
} from "@/app/lib/bridge/pdfSigningPrep";
import { base64ToBlob, chunkBase64 as splitBase64ToChunks } from "@/app/lib/bridge/pdfChunker";

const PDF_WORKER_URL = "https://unpkg.com/pdfjs-dist@3.11.174/build/pdf.worker.min.js";

interface StampRect {
  pageIndex: number;
  pdfX: number;
  pdfY: number;
  pdfWidth: number;
  pdfHeight: number;
}

interface PageDims {
  width: number;
  height: number;
}

interface DragState {
  pageIndex: number;
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
  viewportWidth: number;
  viewportHeight: number;
}

const MIN_RECT_PX = 24;

function extractCommonName(subject?: string): string | undefined {
  if (!subject) return undefined;
  const match = subject.match(/CN\s*=\s*([^,]+)/i);
  return match?.[1]?.trim();
}

function resolveSignerLabel(cert: CertInfo | undefined): string {
  if (!cert) return "AutoDCR Signer";
  return (
    extractCommonName(cert.subject) ||
    cert.label?.trim() ||
    cert.subject?.trim() ||
    `Cert ${cert.id.slice(0, 8)}`
  );
}

const pretty = (value: unknown): string => JSON.stringify(value, null, 2);

const createJobId = (): string => {
  const globalCrypto = globalThis.crypto as Crypto | undefined;
  if (globalCrypto && typeof globalCrypto.randomUUID === "function") {
    return globalCrypto.randomUUID();
  }
  return `job-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
};

type BridgeCommand =
  | "PING"
  | "LIST_SLOTS"
  | "LIST_CERTS"
  | "SIGN_PDF_START"
  | "SIGN_PDF_CHUNK"
  | "SIGN_PDF_END";

interface ApiState {
  loading: boolean;
  status: "idle" | "success" | "error";
  lastRunAt: string | null;
  requestView: string;
  responseView: string;
  errorView: string;
}

interface RunResult<T> {
  ok: boolean;
  result: T | null;
}

interface FlowErrorDisplay {
  title: string;
  detail: string;
}

interface CertIdValidation {
  looksHex: boolean;
  evenLength: boolean;
  normalizedHex: string;
}

interface SlotCertSnapshot {
  certIds: string[];
  selectedCertId: string;
}

const makeDefaultApiState = (): ApiState => ({
  loading: false,
  status: "idle",
  lastRunAt: null,
  requestView: "(not sent)",
  responseView: "(none)",
  errorView: "(none)",
});

const createApiStates = (): Record<BridgeCommand, ApiState> => ({
  PING: makeDefaultApiState(),
  LIST_SLOTS: makeDefaultApiState(),
  LIST_CERTS: makeDefaultApiState(),
  SIGN_PDF_START: makeDefaultApiState(),
  SIGN_PDF_CHUNK: makeDefaultApiState(),
  SIGN_PDF_END: makeDefaultApiState(),
});

const validateCertId = (rawCertId: string): CertIdValidation => {
  const normalizedHex = rawCertId.trim().replace(/^0x/i, "");
  const looksHex = /^[0-9a-fA-F]+$/.test(normalizedHex);
  const evenLength = normalizedHex.length % 2 === 0;
  return { looksHex, evenLength, normalizedHex };
};

function StampOverlay({
  stamp,
  pageDims,
}: {
  stamp: StampRect;
  pageDims: PageDims | undefined;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [box, setBox] = useState<{
    left: number;
    top: number;
    width: number;
    height: number;
  } | null>(null);

  useEffect(() => {
    if (!pageDims) return;
    const el = ref.current?.parentElement;
    if (!el) return;
    const update = () => {
      const rect = el.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;
      const sx = rect.width / pageDims.width;
      const sy = rect.height / pageDims.height;
      setBox({
        left: stamp.pdfX * sx,
        top: (pageDims.height - stamp.pdfY - stamp.pdfHeight) * sy,
        width: stamp.pdfWidth * sx,
        height: stamp.pdfHeight * sy,
      });
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, [stamp, pageDims]);

  if (!box) return <div ref={ref} style={{ display: "none" }} />;
  return (
    <div
      ref={ref}
      style={{
        position: "absolute",
        left: `${box.left}px`,
        top: `${box.top}px`,
        width: `${box.width}px`,
        height: `${box.height}px`,
        border: "1.5px solid #1e40af",
        background: "rgba(219,234,254,0.45)",
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          position: "absolute",
          left: 0,
          top: -18,
          fontSize: 11,
          fontWeight: 600,
          color: "#1e40af",
          background: "rgba(255,255,255,0.85)",
          padding: "1px 6px",
          borderRadius: 4,
        }}
      >
        DSC stamp · page {stamp.pageIndex + 1}
      </div>
    </div>
  );
}

export default function BridgePocPage() {
  const [timeoutMs, setTimeoutMs] = useState(30000);
  const [extensionDetected, setExtensionDetected] = useState(false);
  const [bridgeHealthy, setBridgeHealthy] = useState(false);
  const [apiStates, setApiStates] = useState<Record<BridgeCommand, ApiState>>(createApiStates);
  const [pdfToSignFile, setPdfToSignFile] = useState<File | null>(null);
  const [pdfFlowLoading, setPdfFlowLoading] = useState(false);
  const [pdfFlowProgress, setPdfFlowProgress] = useState<string>("(idle)");
  const [pdfFlowResult, setPdfFlowResult] = useState<string>("(none)");
  const [signedPdfUrl, setSignedPdfUrl] = useState<string>("");

  const [availableSlots, setAvailableSlots] = useState<ListSlotsResult["slots"]>([]);
  const [selectedSlotIndex, setSelectedSlotIndex] = useState("");
  const [certsBySlot, setCertsBySlot] = useState<Record<number, CertInfo[]>>({});
  const [selectedCertIdBySlot, setSelectedCertIdBySlot] = useState<Record<number, string>>({});
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [certsLoading, setCertsLoading] = useState(false);
  const certFetchesBySlotRef = useRef<Map<number, Promise<SlotCertSnapshot>>>(new Map());

  const [startFileName] = useState("generated.pdf");
  const [startContentType] = useState("application/pdf");
  const [startPinHint, setStartPinHint] = useState("");

  const [pdfPreviewUrl, setPdfPreviewUrl] = useState<string>("");
  const [pageDims, setPageDims] = useState<PageDims[]>([]);
  const [stampRect, setStampRect] = useState<StampRect | null>(null);
  const [isPlacingStamp, setIsPlacingStamp] = useState(false);
  const [dragState, setDragState] = useState<DragState | null>(null);
  const defaultLayoutPluginInstance = defaultLayoutPlugin();

  useEffect(() => {
    if (!pdfToSignFile) {
      setPdfPreviewUrl("");
      setPageDims([]);
      setStampRect(null);
      setIsPlacingStamp(false);
      return;
    }
    const url = URL.createObjectURL(pdfToSignFile);
    setPdfPreviewUrl(url);
    setStampRect(null);
    setIsPlacingStamp(false);
    setDragState(null);

    let cancelled = false;
    (async () => {
      try {
        const buffer = await pdfToSignFile.arrayBuffer();
        const doc = await PDFDocument.load(buffer, { updateMetadata: false });
        if (cancelled) return;
        setPageDims(
          doc.getPages().map((p) => {
            const { width, height } = p.getSize();
            return { width, height };
          })
        );
      } catch (error) {
        if (!cancelled) {
          console.error("Failed to load PDF page dimensions", error);
          setPageDims([]);
        }
      }
    })();

    return () => {
      cancelled = true;
      URL.revokeObjectURL(url);
    };
  }, [pdfToSignFile]);

  useEffect(() => {
    const refreshDetected = () => {
      setExtensionDetected(isExtensionAvailable());
    };
    refreshDetected();

    const observer = new MutationObserver((entries) => {
      if (entries.some((entry) => entry.attributeName === "data-autodcr-extension")) {
        refreshDetected();
      }
    });

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-autodcr-extension"],
    });

    return () => observer.disconnect();
  }, []);

  useEffect(
    () => () => {
      if (signedPdfUrl) {
        URL.revokeObjectURL(signedPdfUrl);
      }
    },
    [signedPdfUrl]
  );

  const updateApiState = (cmd: BridgeCommand, patch: Partial<ApiState>) => {
    setApiStates((current) => ({
      ...current,
      [cmd]: {
        ...current[cmd],
        ...patch,
      },
    }));
  };

  const runCommand = async <TPayload, TResult>(
    cmd: BridgeCommand,
    payload: TPayload
  ): Promise<RunResult<TResult>> => {
    const now = new Date().toISOString();
    updateApiState(cmd, {
      loading: true,
      status: "idle",
      lastRunAt: now,
      requestView: pretty(payload),
      responseView: "(awaiting response)",
      errorView: "(none)",
    });

    try {
      const result = await sendBridgeCommand<TPayload, TResult>(cmd, payload, { timeoutMs });
      setBridgeHealthy(true);
      setExtensionDetected(true);
      updateApiState(cmd, {
        loading: false,
        status: "success",
        responseView: pretty({
          cmd,
          envelopeSanity: {
            ok: true,
            source: "AUTODCR_SIGN_BRIDGE (validated by bridge client)",
            type: "RESPONSE (validated by bridge client)",
            requestId: "(matched internally by bridge client)",
          },
          result,
        }),
        errorView: "(none)",
      });
      return { ok: true, result };
    } catch (error: unknown) {
      const mapped = mapBridgeError(error);
      updateApiState(cmd, {
        loading: false,
        status: "error",
        responseView: "(none)",
        errorView: pretty({
          cmd,
          envelopeSanity: {
            ok: false,
            source: "AUTODCR_SIGN_BRIDGE (expected)",
            type: "RESPONSE (expected)",
            requestId: "(matched internally by bridge client)",
          },
          error: mapped,
        }),
      });
      return { ok: false, result: null };
    }
  };

  const runPing = async () => {
    await runCommand<PingPayload, PingResult>("PING", { v: PROTOCOL_VERSION });
  };

  const getSlotIdForSigning = (
    slot: ListSlotsResult["slots"][number] | undefined,
    /** When the host omits numeric slotId, many stacks still use LIST_CERTS(slotIndex). */
    fallbackSlotIndex?: number
  ): number | null => {
    if (!slot) return null;
    const candidate = slot as ListSlotsResult["slots"][number] & {
      id?: unknown;
      slot?: unknown;
      slotID?: unknown;
    };
    const rawValue: unknown = candidate.slotId ?? candidate.id ?? candidate.slot ?? candidate.slotID;
    if (typeof rawValue === "number" && Number.isFinite(rawValue)) return rawValue;
    if (typeof rawValue === "string" && rawValue.trim() && !Number.isNaN(Number(rawValue))) {
      return Number(rawValue);
    }
    if (
      fallbackSlotIndex !== undefined &&
      Number.isInteger(fallbackSlotIndex) &&
      fallbackSlotIndex >= 0
    ) {
      return fallbackSlotIndex;
    }
    return null;
  };

  const loadSlotsForDropdown = async (): Promise<ListSlotsResult["slots"]> => {
    if (slotsLoading) return availableSlots;
    setSlotsLoading(true);
    try {
      const slotsResponse = await runCommand<ListSlotsPayload, ListSlotsResult>("LIST_SLOTS", {
        v: PROTOCOL_VERSION,
      });
      if (!slotsResponse.ok || !slotsResponse.result) return [];
      const slots = slotsResponse.result.slots ?? [];
      setAvailableSlots(slots);
      if (slots.length > 0 && !selectedSlotIndex) {
        setSelectedSlotIndex("0");
        const firstSlotId = getSlotIdForSigning(slots[0], 0);
        if (firstSlotId !== null) {
          void fetchCertsForSlot(firstSlotId, { forceRefresh: true });
        }
      }
      return slots;
    } finally {
      setSlotsLoading(false);
    }
  };

  const formatCertOptionLabel = (cert: CertInfo): string => {
    const base = cert.label?.trim() || cert.subject?.trim();
    if (base) return base.length > 72 ? `${base.slice(0, 69)}…` : base;
    const id = cert.id;
    if (!id) return "Unknown certificate";
    if (id.length > 28) return `${id.slice(0, 12)}…${id.slice(-10)}`;
    return id;
  };

  const fetchCertsForSlot = async (
    slotId: number,
    opts?: { forceRefresh?: boolean; preferredCertId?: string }
  ): Promise<SlotCertSnapshot> => {
    const existing = certFetchesBySlotRef.current.get(slotId);
    if (!opts?.forceRefresh && existing) {
      return existing;
    }
    const request = (async (): Promise<SlotCertSnapshot> => {
      setCertsLoading(true);
      try {
        const certsResponse = await runCommand<ListCertsPayload, ListCertsResult>("LIST_CERTS", { slotId });
        if (!certsResponse.ok || !certsResponse.result) {
          setCertsBySlot((current) => ({ ...current, [slotId]: [] }));
          setSelectedCertIdBySlot((current) => ({ ...current, [slotId]: "" }));
          return { certIds: [], selectedCertId: "" };
        }
        const certs = certsResponse.result.certs ?? [];
        const certIds = certs.map((cert) => cert.id).filter((id): id is string => Boolean(id));
        const preferred = opts?.preferredCertId?.trim() ?? "";
        const resolvedCertId =
          preferred && certIds.includes(preferred) ? preferred : certIds[0] ?? "";
        setCertsBySlot((current) => ({ ...current, [slotId]: certs }));
        setSelectedCertIdBySlot((current) => ({ ...current, [slotId]: resolvedCertId }));
        return { certIds, selectedCertId: resolvedCertId };
      } finally {
        certFetchesBySlotRef.current.delete(slotId);
        setCertsLoading(false);
      }
    })();
    certFetchesBySlotRef.current.set(slotId, request);
    return request;
  };

  const runUploadedPdfSigningFlow = async () => {
    if (!pdfToSignFile) {
      setPdfFlowResult("Please choose a PDF file first.");
      return;
    }
    let resolvedIndex = selectedSlotIndex;
    if (!resolvedIndex && availableSlots.length > 0) {
      resolvedIndex = "0";
      setSelectedSlotIndex("0");
    }
    if (!resolvedIndex) {
      const slots = await loadSlotsForDropdown();
      if (slots.length > 0) {
        resolvedIndex = "0";
        setSelectedSlotIndex("0");
      }
    }

    const selectedSlot = availableSlots[Number(resolvedIndex)] ?? availableSlots[0];
    const selectedSlotIdNumber = getSlotIdForSigning(selectedSlot, Number(resolvedIndex));
    if (selectedSlotIdNumber === null) {
      setPdfFlowResult("Please select slotId before starting signing.");
      return;
    }

    setPdfFlowLoading(true);
    setPdfFlowProgress("Reading PDF...");
    setPdfFlowResult("(running)");
    if (signedPdfUrl) {
      URL.revokeObjectURL(signedPdfUrl);
      setSignedPdfUrl("");
    }

    try {
      const slotScopedSelectedCert = selectedCertIdBySlot[selectedSlotIdNumber]?.trim() ?? "";
      const latestSnapshot = await fetchCertsForSlot(selectedSlotIdNumber, {
        forceRefresh: true,
        preferredCertId: slotScopedSelectedCert,
      });
      const resolvedCertId = latestSnapshot.selectedCertId.trim();
      if (!resolvedCertId) {
        setPdfFlowResult("No certificate available for selected slot.");
        return;
      }
      if (!latestSnapshot.certIds.includes(resolvedCertId)) {
        setPdfFlowProgress("Failed.");
        setPdfFlowResult(
          pretty({
            status: "failed",
            title: "Stale certificate selection detected",
            detail:
              "Selected certId is not present in the latest LIST_CERTS response for this slot. Refresh slot/certificate metadata and retry.",
            slotId: selectedSlotIdNumber,
            selectedCertId: resolvedCertId,
            latestCertIds: latestSnapshot.certIds,
          })
        );
        return;
      }

      setPdfFlowProgress("Preparing PDF for signing...");
      const originalPdfBuffer = await pdfToSignFile.arrayBuffer();

      let stamp: DscStampSpec | undefined;
      if (stampRect) {
        const certForStamp = (certsBySlot[selectedSlotIdNumber] ?? []).find(
          (c) => c.id === resolvedCertId
        );
        stamp = {
          pageIndex: stampRect.pageIndex,
          pdfX: stampRect.pdfX,
          pdfY: stampRect.pdfY,
          pdfWidth: stampRect.pdfWidth,
          pdfHeight: stampRect.pdfHeight,
          signerLabel: resolveSignerLabel(certForStamp),
          signedAt: new Date(),
        };
      }

      const preparedPdfBytes = await preparePdfForNativeSigning(originalPdfBuffer, { stamp });
      assertPdfHasSigningMarkers(preparedPdfBytes);

      const preparedPdfBlob = new Blob([new Uint8Array(preparedPdfBytes)], {
        type: "application/pdf",
      });
      const preparedPdfDataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = () => reject(new Error("Failed to encode prepared PDF to base64."));
        reader.onload = () => {
          if (typeof reader.result !== "string") {
            reject(new Error("Unexpected FileReader result while encoding prepared PDF."));
            return;
          }
          resolve(reader.result);
        };
        reader.readAsDataURL(preparedPdfBlob);
      });
      const commaIndex = preparedPdfDataUrl.indexOf(",");
      if (commaIndex === -1) {
        throw new Error("Unable to parse base64 payload for prepared PDF.");
      }
      const pdfBase64 = preparedPdfDataUrl.slice(commaIndex + 1);
      const chunks = splitBase64ToChunks(pdfBase64);
      if (chunks.length === 0) {
        throw new Error("Selected PDF is empty after base64 encoding.");
      }

      const jobId = createJobId();
      const certValidation = validateCertId(resolvedCertId);
      const signingContext = {
        jobId,
        slotId: selectedSlotIdNumber,
        certId: resolvedCertId,
        certIdLength: resolvedCertId.length,
        certIdNormalizedHex: certValidation.normalizedHex,
        certIdNormalizedHexLength: certValidation.normalizedHex.length,
        totalChunks: chunks.length,
      };
      setPdfFlowResult(pretty({ status: "preflight", signingContext }));
      if (!certValidation.looksHex || !certValidation.evenLength) {
        setPdfFlowProgress("Failed.");
        setPdfFlowResult(
          pretty({
            status: "failed",
            title: "Malformed certificate identifier",
            detail:
              "certId must be a hex-encoded PKCS#11 CKA_ID with even length. Reselect the certificate and retry.",
            signingContext,
          })
        );
        return;
      }

      const startPayload: SignPdfStartPayload = {
        jobId,
        totalChunks: chunks.length,
        slotId: selectedSlotIdNumber,
        certId: resolvedCertId,
        fileName: pdfToSignFile.name || startFileName || undefined,
        contentType: pdfToSignFile.type || startContentType || "application/pdf",
        pin: startPinHint || undefined,
      };

      setPdfFlowProgress(`Sending SIGN_PDF_START (1/${chunks.length + 2})...`);
      const start = await runCommand<SignPdfStartPayload, SignPdfStartResult>(
        "SIGN_PDF_START",
        startPayload
      );
      if (!start.ok) {
        setPdfFlowResult("Signing failed at SIGN_PDF_START. See API panel for details.");
        return;
      }

      for (let index = 0; index < chunks.length; index += 1) {
        setPdfFlowProgress(`Sending SIGN_PDF_CHUNK ${index + 1}/${chunks.length}...`);
        const chunk = await runCommand<SignPdfChunkPayload, SignPdfChunkResult>("SIGN_PDF_CHUNK", {
          jobId,
          index,
          chunkBase64: chunks[index],
        });
        if (!chunk.ok) {
          setPdfFlowResult(
            `Signing failed at chunk ${index + 1}/${chunks.length}. Restart with a new jobId.`
          );
          return;
        }
      }

      setPdfFlowProgress(`Sending SIGN_PDF_END (${chunks.length + 2}/${chunks.length + 2})...`);
      const end = await runCommand<SignPdfEndPayload, SignPdfFinalResult>("SIGN_PDF_END", { jobId });
      if (!end.ok || !end.result?.signedPdfBase64) {
        setPdfFlowResult("Signing failed at SIGN_PDF_END or returned empty signed PDF.");
        return;
      }

      const signedBlob = base64ToBlob(end.result.signedPdfBase64, "application/pdf");
      const downloadUrl = URL.createObjectURL(signedBlob);
      setSignedPdfUrl(downloadUrl);
      setPdfFlowProgress("Completed.");
      setPdfFlowResult(
        pretty({
          status: "success",
          fileName: `signed-${pdfToSignFile.name || "document.pdf"}`,
          sizeBytes: signedBlob.size,
          slotId: selectedSlotIdNumber,
          certId: resolvedCertId,
          jobId: end.result.jobId || jobId,
        })
      );
    } catch (error: unknown) {
      const display = toFlowError(error);
      setPdfFlowProgress("Failed.");
      setPdfFlowResult(pretty({ status: "failed", title: display.title, detail: display.detail }));
    } finally {
      setPdfFlowLoading(false);
    }
  };

  const statusText = (status: ApiState["status"]): string => {
    if (status === "success") return "Success";
    if (status === "error") return "Failed";
    return "Idle";
  };

  const statusClass = (status: ApiState["status"]): string => {
    if (status === "success") return "text-emerald-700";
    if (status === "error") return "text-red-700";
    return "text-gray-600";
  };

  const toFlowError = (error: unknown): FlowErrorDisplay => {
    const mapped = mapBridgeError(error);
    if (
      mapped.code === "NO_EXTENSION" ||
      mapped.code === "NATIVE_DISCONNECTED" ||
      mapped.code === "NATIVE_SEND_FAILED" ||
      mapped.code === "NATIVE_TIMEOUT"
    ) {
      return {
        title: "Bridge setup issue",
        detail:
          "Install or reconnect the AutoDCR extension/native host, then reload this page and retry.",
      };
    }
    if (mapped.code === "PIN_CANCELLED") {
      return {
        title: mapped.message,
        detail: "PIN entry was cancelled. Retry signing and enter PIN to continue.",
      };
    }
    if (mapped.code === "UNKNOWN_JOB" || mapped.code === "INVALID_CHUNK_INDEX") {
      return {
        title: mapped.message,
        detail: "Chunk/job mismatch detected. Restart signing with a fresh job.",
      };
    }
    if (mapped.code === "CERT_NOT_FOUND" || mapped.code?.startsWith("PKCS11_")) {
      return {
        title: mapped.message,
        detail: "Refresh slot/certificate selection and retry signing.",
      };
    }
    return {
      title: mapped.message,
      detail: mapped.hint || "Please retry signing.",
    };
  };


  const renderApiPanel = (cmd: BridgeCommand) => {
    const state = apiStates[cmd];
    return (
      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <div className="rounded border border-gray-200 bg-gray-50 p-3 md:col-span-1">
          <div className="text-xs font-semibold text-gray-700">Sanity</div>
          <div className={`mt-1 text-sm font-medium ${statusClass(state.status)}`}>
            {state.loading ? "In flight..." : statusText(state.status)}
          </div>
          <div className="mt-1 text-xs text-gray-600">
            Last run: {state.lastRunAt ? new Date(state.lastRunAt).toLocaleTimeString() : "never"}
          </div>
        </div>
        <div className="rounded border border-gray-200 bg-gray-50 p-3 md:col-span-1">
          <div className="text-xs font-semibold text-gray-700">Request View</div>
          <pre className="mt-2 max-h-56 overflow-auto rounded bg-gray-900 p-2 text-xs text-cyan-200">
            {state.requestView}
          </pre>
        </div>
        <div className="rounded border border-gray-200 bg-gray-50 p-3 md:col-span-1">
          <div className="text-xs font-semibold text-gray-700">Response / Error View</div>
          <pre className="mt-2 max-h-56 overflow-auto rounded bg-gray-900 p-2 text-xs text-green-300">
            {state.status === "error" ? state.errorView : state.responseView}
          </pre>
        </div>
      </div>
    );
  };

  const handleStampMouseDown = (
    pageIndex: number
  ): React.MouseEventHandler<HTMLDivElement> => (event) => {
    if (!isPlacingStamp) return;
    event.preventDefault();
    event.stopPropagation();
    const rect = event.currentTarget.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    setDragState({
      pageIndex,
      startX: x,
      startY: y,
      currentX: x,
      currentY: y,
      viewportWidth: rect.width,
      viewportHeight: rect.height,
    });
  };

  const handleStampMouseMove: React.MouseEventHandler<HTMLDivElement> = (event) => {
    if (!dragState) return;
    event.preventDefault();
    const rect = event.currentTarget.getBoundingClientRect();
    setDragState({
      ...dragState,
      currentX: event.clientX - rect.left,
      currentY: event.clientY - rect.top,
    });
  };

  const handleStampMouseUp: React.MouseEventHandler<HTMLDivElement> = (event) => {
    if (!dragState) return;
    event.preventDefault();
    const { pageIndex, startX, startY, currentX, currentY, viewportWidth, viewportHeight } =
      dragState;
    setDragState(null);

    const left = Math.min(startX, currentX);
    const top = Math.min(startY, currentY);
    const width = Math.abs(currentX - startX);
    const height = Math.abs(currentY - startY);
    if (width < MIN_RECT_PX || height < MIN_RECT_PX) return;

    const dims = pageDims[pageIndex];
    if (!dims || viewportWidth <= 0 || viewportHeight <= 0) return;
    const sx = dims.width / viewportWidth;
    const sy = dims.height / viewportHeight;
    const pdfX = left * sx;
    const pdfHeight = height * sy;
    const pdfY = dims.height - top * sy - pdfHeight;
    const pdfWidth = width * sx;

    setStampRect({
      pageIndex,
      pdfX,
      pdfY,
      pdfWidth,
      pdfHeight,
    });
    setIsPlacingStamp(false);
  };

  const renderViewerPage = (props: RenderPageProps) => {
    const { pageIndex } = props;
    const isDraggingThisPage = dragState?.pageIndex === pageIndex;
    const stampOnThisPage = stampRect?.pageIndex === pageIndex ? stampRect : null;
    const overlayInteractive = isPlacingStamp && (!stampRect || stampRect.pageIndex === pageIndex);

    let activeRect: { left: number; top: number; width: number; height: number } | null = null;
    if (isDraggingThisPage && dragState) {
      activeRect = {
        left: Math.min(dragState.startX, dragState.currentX),
        top: Math.min(dragState.startY, dragState.currentY),
        width: Math.abs(dragState.currentX - dragState.startX),
        height: Math.abs(dragState.currentY - dragState.startY),
      };
    }

    return (
      <>
        {props.canvasLayer.children}
        {props.textLayer.children}
        {props.annotationLayer.children}
        <div
          style={{
            position: "absolute",
            inset: 0,
            zIndex: 25,
            cursor: overlayInteractive ? "crosshair" : "default",
            pointerEvents: overlayInteractive ? "auto" : "none",
          }}
          onMouseDown={handleStampMouseDown(pageIndex)}
          onMouseMove={handleStampMouseMove}
          onMouseUp={handleStampMouseUp}
          onMouseLeave={handleStampMouseUp}
        >
          {activeRect ? (
            <div
              style={{
                position: "absolute",
                left: `${activeRect.left}px`,
                top: `${activeRect.top}px`,
                width: `${activeRect.width}px`,
                height: `${activeRect.height}px`,
                border: "1.5px dashed #2563eb",
                background: "rgba(59,130,246,0.12)",
                pointerEvents: "none",
              }}
            />
          ) : null}
          {stampOnThisPage && !isDraggingThisPage ? (
            <StampOverlay
              stamp={stampOnThisPage}
              pageDims={pageDims[pageIndex]}
            />
          ) : null}
        </div>
      </>
    );
  };

  const signingUiSelectedSlot =
    selectedSlotIndex === ""
      ? undefined
      : (availableSlots[Number(selectedSlotIndex)] ?? availableSlots[0]);
  const signingUiSlotId =
    signingUiSelectedSlot === undefined
      ? null
      : getSlotIdForSigning(signingUiSelectedSlot, Number(selectedSlotIndex));
  const signingUiCerts = signingUiSlotId === null ? [] : (certsBySlot[signingUiSlotId] ?? []);
  const signingUiCertValue = signingUiSlotId === null ? "" : (selectedCertIdBySlot[signingUiSlotId] ?? "");
  const signingUiCertPlaceholderLabel =
    signingUiSlotId === null
      ? "Select a slot first"
      : certsLoading
        ? "Loading certificates..."
        : signingUiCerts.length === 0
          ? "No certificates for this slot"
          : "Select certificate";

  return (
    <main className="min-h-screen bg-gray-50 px-6 py-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <h1 className="text-2xl font-semibold text-gray-900">Bridge POC Tester</h1>
          <p className="mt-1 text-sm text-gray-600">
            Manual page to test extension/native-host bridge APIs from the browser.
          </p>
          <div className="mt-3 text-sm">
            <span className="font-medium text-gray-800">Extension detected:</span>{" "}
            <span className={extensionDetected ? "text-emerald-700" : "text-red-700"}>
              {extensionDetected ? "Yes (data-autodcr-extension=1)" : "No"}
            </span>
          </div>
          <div className="mt-1 text-sm">
            <span className="font-medium text-gray-800">Bridge health:</span>{" "}
            <span className={bridgeHealthy ? "text-emerald-700" : "text-amber-700"}>
              {bridgeHealthy ? "Healthy (at least one command roundtrip succeeded)" : "Not yet verified"}
            </span>
          </div>
          <div className="mt-3 flex items-center gap-3">
            <label className="text-sm font-medium text-gray-700" htmlFor="timeoutMs">
              Request timeout (ms)
            </label>
            <input
              id="timeoutMs"
              type="number"
              min={1000}
              value={timeoutMs}
              onChange={(e) => setTimeoutMs(Number(e.target.value))}
              className="w-40 rounded border border-gray-300 px-3 py-1.5 text-sm text-black"
            />
          </div>
        </header>

        <section className="grid gap-4 md:grid-cols-2">
          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <h2 className="text-lg font-semibold text-gray-900">PING</h2>
            <p className="mt-1 text-sm text-gray-600">Payload: {"{ v: PROTOCOL_VERSION }"}</p>
            <button
              onClick={() => void runPing()}
              disabled={apiStates.PING.loading}
              className="mt-3 rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {apiStates.PING.loading ? "Sending..." : "Send PING"}
            </button>
            {renderApiPanel("PING")}
          </div>
        </section>

        <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900">Upload PDF and Auto-Sign (DSC)</h2>
          <p className="mt-1 text-sm text-gray-600">
            Select PKCS#11 slot, then the signing certificate (CKA_ID). Certificates are loaded with
            LIST_CERTS for the chosen slot.
          </p>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <label className="text-sm md:col-span-2">
              <span className="mb-1 block font-medium text-gray-700">PDF file</span>
              <input
                type="file"
                accept="application/pdf,.pdf"
                onChange={(e) => setPdfToSignFile(e.target.files?.[0] ?? null)}
                className="w-full rounded border border-gray-300 px-3 py-2 text-sm text-black"
              />
            </label>
            {pdfPreviewUrl ? (
              <div className="md:col-span-2">
                <div className="mb-2 flex flex-wrap items-center gap-3">
                  <span className="text-sm font-medium text-gray-700">Visible DSC stamp:</span>
                  <button
                    type="button"
                    onClick={() => {
                      setStampRect(null);
                      setIsPlacingStamp(true);
                      setDragState(null);
                    }}
                    className="rounded bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
                  >
                    {stampRect ? "Re-place stamp" : "Place stamp"}
                  </button>
                  {stampRect ? (
                    <button
                      type="button"
                      onClick={() => {
                        setStampRect(null);
                        setIsPlacingStamp(false);
                      }}
                      className="rounded border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-100"
                    >
                      Clear
                    </button>
                  ) : null}
                  <span className="text-xs text-gray-600">
                    {isPlacingStamp
                      ? "Drag a rectangle on any page to position the stamp."
                      : stampRect
                        ? `Page ${stampRect.pageIndex + 1} · ${stampRect.pdfWidth.toFixed(0)}×${stampRect.pdfHeight.toFixed(0)} pt`
                        : "No visible stamp will be drawn (signing only)."}
                  </span>
                </div>
                <div
                  className="overflow-hidden rounded border border-gray-300 bg-gray-100"
                  style={{ height: 520 }}
                >
                  <Worker workerUrl={PDF_WORKER_URL}>
                    <Viewer
                      fileUrl={pdfPreviewUrl}
                      plugins={[defaultLayoutPluginInstance]}
                      renderPage={renderViewerPage}
                    />
                  </Worker>
                </div>
              </div>
            ) : null}
            <label className="text-sm">
              <span className="mb-1 block font-medium text-gray-700">slotId (required)</span>
              <select
                value={selectedSlotIndex}
                onFocus={() => {
                  if (availableSlots.length === 0) {
                    void loadSlotsForDropdown();
                  }
                }}
                onClick={() => {
                  if (availableSlots.length === 0) {
                    void loadSlotsForDropdown();
                  }
                }}
                onChange={(e) => {
                  const rawIndex = e.target.value;
                  if (!rawIndex) {
                    setSelectedSlotIndex("");
                    return;
                  }
                  setSelectedSlotIndex(rawIndex);
                  const slot = availableSlots[Number(rawIndex)];
                  const parsed = getSlotIdForSigning(slot, Number(rawIndex));
                  if (parsed !== null) {
                    setSelectedCertIdBySlot((current) => ({ ...current, [parsed]: "" }));
                    void fetchCertsForSlot(parsed, { forceRefresh: true });
                  }
                }}
                className="w-full rounded border border-gray-300 px-3 py-2 text-sm text-black"
              >
                <option value="">
                  {slotsLoading ? "Loading slots..." : "Select slot"}
                </option>
                {availableSlots.map((slot, index) => (
                  <option key={`${String(slot.slotId)}-${index}`} value={String(index)}>
                    {slot.slotId} - {slot.label || "Unnamed slot"}
                  </option>
                ))}
              </select>
              <span className="mt-1 block text-xs text-gray-600">
                Slot list comes from LIST_SLOTS. Changing slot reloads certificates for that slot.
              </span>
            </label>
            <label className="text-sm md:col-span-2">
              <span className="mb-1 block font-medium text-gray-700">Certificate (required)</span>
              <select
                value={signingUiCertValue}
                disabled={signingUiSlotId === null || certsLoading}
                onFocus={() => {
                  if (
                    signingUiSlotId !== null &&
                    (certsBySlot[signingUiSlotId] ?? []).length === 0 &&
                    !certsLoading
                  ) {
                    void fetchCertsForSlot(signingUiSlotId, { forceRefresh: true });
                  }
                }}
                onClick={() => {
                  if (
                    signingUiSlotId !== null &&
                    (certsBySlot[signingUiSlotId] ?? []).length === 0 &&
                    !certsLoading
                  ) {
                    void fetchCertsForSlot(signingUiSlotId, { forceRefresh: true });
                  }
                }}
                onChange={(e) => {
                  if (signingUiSlotId === null) return;
                  setSelectedCertIdBySlot((current) => ({
                    ...current,
                    [signingUiSlotId]: e.target.value,
                  }));
                }}
                className="w-full rounded border border-gray-300 px-3 py-2 text-sm text-black disabled:cursor-not-allowed disabled:opacity-60"
              >
                <option value="">{signingUiCertPlaceholderLabel}</option>
                {signingUiCerts.map((cert, index) => (
                  <option key={`${cert.id}-${index}`} value={cert.id}>
                    {formatCertOptionLabel(cert)}
                  </option>
                ))}
              </select>
              <span className="mt-1 block text-xs text-gray-600">
                certId is the hex CKA_ID sent in SIGN_PDF_START. Pick the certificate that matches your
                DSC private key in this slot.
              </span>
            </label>
            <label className="text-sm md:col-span-2">
              <span className="mb-1 block font-medium text-gray-700">PIN (optional)</span>
              <input
                type="password"
                value={startPinHint}
                onChange={(e) => setStartPinHint(e.target.value)}
                placeholder="Enter DSC PIN if host supports inline pin"
                className="w-full rounded border border-gray-300 px-3 py-2 text-sm text-black"
              />
            </label>
          </div>
          <button
            onClick={() => void runUploadedPdfSigningFlow()}
            disabled={pdfFlowLoading}
            className="mt-3 rounded bg-gradient-to-r from-emerald-800 to-emerald-500 hover:from-emerald-900 hover:to-emerald-600 text-white shadow-sm hover:shadow-md transition-all px-4 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50"
          >
            {pdfFlowLoading ? "Signing uploaded PDF..." : "Sign Uploaded PDF with DSC"}
          </button>
          <div className="mt-3 rounded border border-gray-200 bg-gray-50 p-3">
            <div className="text-xs font-semibold text-gray-700">Flow Progress</div>
            <div className="mt-1 text-sm text-gray-800">{pdfFlowProgress}</div>
            <div className="mt-3 text-xs font-semibold text-gray-700">Flow Output</div>
            <pre className="mt-2 max-h-56 overflow-auto rounded bg-gray-900 p-2 text-xs text-emerald-300">
              {pdfFlowResult}
            </pre>
            {signedPdfUrl ? (
              <a
                href={signedPdfUrl}
                download={`signed-${pdfToSignFile?.name || "document.pdf"}`}
                className="mt-3 inline-block rounded bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
              >
                Download Signed PDF
              </a>
            ) : null}
          </div>
        </section>
      </div>
    </main>
  );
}
