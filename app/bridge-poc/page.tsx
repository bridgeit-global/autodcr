"use client";

import { useEffect, useState } from "react";

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
import { base64ToBlob, blobToBase64, chunkBase64 as splitBase64ToChunks } from "@/app/lib/bridge/pdfChunker";

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
  const [availableCerts, setAvailableCerts] = useState<CertInfo[]>([]);
  const [selectedSlotId, setSelectedSlotId] = useState<number | null>(null);
  const [selectedCertId, setSelectedCertId] = useState("");
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [certsLoading, setCertsLoading] = useState(false);

  const [startFileName] = useState("generated.pdf");
  const [startContentType] = useState("application/pdf");
  const [startPinHint, setStartPinHint] = useState("");

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

  const loadSlotsForDropdown = async () => {
    if (slotsLoading) return;
    setSlotsLoading(true);
    try {
      const slotsResponse = await runCommand<ListSlotsPayload, ListSlotsResult>("LIST_SLOTS", {
        v: PROTOCOL_VERSION,
      });
      if (!slotsResponse.ok || !slotsResponse.result) return;
      const slots = slotsResponse.result.slots ?? [];
      setAvailableSlots(slots);
      if (slots.length > 0 && selectedSlotId === null) {
        setSelectedSlotId(slots[0].slotId);
      }
    } finally {
      setSlotsLoading(false);
    }
  };

  const fetchCertsForSlot = async (slotId: number) => {
    if (certsLoading) return;
    setCertsLoading(true);
    const certsResponse = await runCommand<ListCertsPayload, ListCertsResult>("LIST_CERTS", { slotId });
    if (!certsResponse.ok || !certsResponse.result) {
      setAvailableCerts([]);
      setSelectedCertId("");
      setCertsLoading(false);
      return;
    }

    const certs = certsResponse.result.certs ?? [];
    setAvailableCerts(certs);
    const resolvedCertId = certs[0]?.id || "";
    setSelectedCertId(resolvedCertId);
    setCertsLoading(false);
  };

  const runUploadedPdfSigningFlow = async () => {
    if (!pdfToSignFile) {
      setPdfFlowResult("Please choose a PDF file first.");
      return;
    }
    if (!selectedCertId.trim()) {
      setPdfFlowResult("Please select certId before starting signing.");
      return;
    }
    if (selectedSlotId === null) {
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
      const pdfBase64 = await blobToBase64(pdfToSignFile);
      const chunks = splitBase64ToChunks(pdfBase64);
      if (chunks.length === 0) {
        throw new Error("Selected PDF is empty after base64 encoding.");
      }

      const jobId = createJobId();

      const startPayload: SignPdfStartPayload = {
        jobId,
        totalChunks: chunks.length,
        slotId: Number(selectedSlotId),
        certId: selectedCertId.trim(),
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
            Click the slot dropdown to load slots, then click certificate dropdown to load certs for that slot.
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
            <label className="text-sm">
              <span className="mb-1 block font-medium text-gray-700">slotId (required)</span>
              <select
                value={selectedSlotId ?? ""}
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
                  const raw = e.target.value;
                  if (!raw) {
                    setSelectedSlotId(null);
                    setAvailableCerts([]);
                    setSelectedCertId("");
                    return;
                  }
                  const value = Number(raw);
                  setSelectedSlotId(value);
                  if (!Number.isNaN(value)) {
                    void fetchCertsForSlot(value);
                  }
                }}
                className="w-full rounded border border-gray-300 px-3 py-2 text-sm text-black"
              >
                <option value="">
                  {slotsLoading ? "Loading slots..." : "Select slot"}
                </option>
                {availableSlots.map((slot) => (
                  <option key={slot.slotId} value={slot.slotId}>
                    {slot.slotId} - {slot.label || "Unnamed slot"}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm">
              <span className="mb-1 block font-medium text-gray-700">certId (required)</span>
              <select
                value={selectedCertId}
                onFocus={() => {
                  if (selectedSlotId !== null && availableCerts.length === 0) {
                    void fetchCertsForSlot(selectedSlotId);
                  }
                }}
                onClick={() => {
                  if (selectedSlotId !== null && availableCerts.length === 0) {
                    void fetchCertsForSlot(selectedSlotId);
                  }
                }}
                onChange={(e) => {
                  setSelectedCertId(e.target.value);
                }}
                className="w-full rounded border border-gray-300 px-3 py-2 text-sm text-black"
              >
                <option value="">
                  {selectedSlotId === null
                    ? "Select slot first"
                    : certsLoading
                      ? "Loading certificates..."
                      : "Select certificate"}
                </option>
                {availableCerts.map((cert) => (
                  <option key={`${cert.slotId}-${cert.id}`} value={cert.id}>
                    {cert.label || cert.subject || cert.id}
                  </option>
                ))}
              </select>
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
            className="mt-3 rounded bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
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
