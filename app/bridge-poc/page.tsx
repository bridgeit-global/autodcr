"use client";

import { useEffect, useState } from "react";

import { isExtensionAvailable, sendBridgeCommand } from "@/app/lib/bridge/bridgeClient";
import { mapBridgeError } from "@/app/lib/bridge/errorMapper";
import {
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

const pretty = (value: unknown): string => JSON.stringify(value, null, 2);

const DEFAULT_SAMPLE_CHUNK =
  "JVBERi0xLjQKJcfs... (paste base64 chunk here for manual testing)";

const createJobId = (): string => {
  const globalCrypto = globalThis.crypto as Crypto | undefined;
  if (globalCrypto && typeof globalCrypto.randomUUID === "function") {
    return globalCrypto.randomUUID();
  }
  return `job-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
};

type BridgeCommand =
  | "PING"
  | "LIST_USB_TOKENS"
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
  LIST_USB_TOKENS: makeDefaultApiState(),
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
  const [contractRunnerOutput, setContractRunnerOutput] = useState<string>("(not run)");
  const [contractRunnerLoading, setContractRunnerLoading] = useState(false);

  const [listCertsSlotId, setListCertsSlotId] = useState(0);

  const [startJobId, setStartJobId] = useState(createJobId);
  const [startTotalChunks, setStartTotalChunks] = useState(1);
  const [startSlotId, setStartSlotId] = useState(0);
  const [startCertId, setStartCertId] = useState("");
  const [startFileName, setStartFileName] = useState("generated.pdf");
  const [startContentType, setStartContentType] = useState("application/pdf");
  const [startPinHint, setStartPinHint] = useState("");

  const [chunkJobId, setChunkJobId] = useState("");
  const [chunkIndex, setChunkIndex] = useState(0);
  const [chunkBase64, setChunkBase64] = useState(DEFAULT_SAMPLE_CHUNK);

  const [endJobId, setEndJobId] = useState("");

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

  const runListUsbTokens = async () => {
    await runCommand<{ v: number }, unknown>("LIST_USB_TOKENS", { v: PROTOCOL_VERSION });
  };

  const runListSlots = async () => {
    await runCommand<ListSlotsPayload, ListSlotsResult>("LIST_SLOTS", { v: PROTOCOL_VERSION });
  };

  const runListCerts = async () => {
    await runCommand<ListCertsPayload, ListCertsResult>("LIST_CERTS", {
      slotId: Number(listCertsSlotId),
    });
  };

  const runSignStart = async () => {
    const payload: SignPdfStartPayload = {
      jobId: startJobId,
      totalChunks: Number(startTotalChunks),
      slotId: Number(startSlotId),
      certId: startCertId.trim(),
      fileName: startFileName || undefined,
      contentType: startContentType || undefined,
      pin: startPinHint || undefined,
    };
    const outcome = await runCommand<SignPdfStartPayload, SignPdfStartResult>("SIGN_PDF_START", payload);
    if (outcome.ok) {
      setChunkJobId(startJobId);
      setEndJobId(startJobId);
    }
  };

  const runSignChunk = async () => {
    const payload: SignPdfChunkPayload = {
      jobId: chunkJobId,
      index: Number(chunkIndex),
      chunkBase64: chunkBase64.trim(),
    };
    await runCommand<SignPdfChunkPayload, SignPdfChunkResult>("SIGN_PDF_CHUNK", payload);
  };

  const runSignEnd = async () => {
    const payload: SignPdfEndPayload = {
      jobId: endJobId,
    };
    await runCommand<SignPdfEndPayload, SignPdfFinalResult>("SIGN_PDF_END", payload);
  };

  const runAllChecks = async () => {
    setContractRunnerLoading(true);
    const checks: Array<{ cmd: BridgeCommand; passed: boolean; detail: string }> = [];

    const ping = await runCommand<PingPayload, PingResult>("PING", { v: PROTOCOL_VERSION });
    checks.push({
      cmd: "PING",
      passed: ping.ok,
      detail: ping.ok ? "Host protocol handshake succeeded." : "Failed handshake/timeout.",
    });

    const usb = await runCommand<{ v: number }, unknown>("LIST_USB_TOKENS", { v: PROTOCOL_VERSION });
    checks.push({
      cmd: "LIST_USB_TOKENS",
      passed: usb.ok,
      detail: usb.ok ? "Token list channel returned data." : "Command failed or not implemented downstream.",
    });

    const slots = await runCommand<ListSlotsPayload, ListSlotsResult>("LIST_SLOTS", {
      v: PROTOCOL_VERSION,
    });
    checks.push({
      cmd: "LIST_SLOTS",
      passed: slots.ok,
      detail: slots.ok ? "Slot inventory returned successfully." : "Slot query failed.",
    });

    const certs = await runCommand<ListCertsPayload, ListCertsResult>("LIST_CERTS", {
      slotId: Number(listCertsSlotId),
    });
    checks.push({
      cmd: "LIST_CERTS",
      passed: certs.ok,
      detail: certs.ok ? "Certificate list returned for selected slot." : "Certificate query failed.",
    });

    const startPayload: SignPdfStartPayload = {
      jobId: startJobId,
      totalChunks: Number(startTotalChunks),
      slotId: Number(startSlotId),
      certId: startCertId.trim(),
      fileName: startFileName || undefined,
      contentType: startContentType || undefined,
      pin: startPinHint || undefined,
    };
    const start = await runCommand<SignPdfStartPayload, SignPdfStartResult>("SIGN_PDF_START", startPayload);
    checks.push({
      cmd: "SIGN_PDF_START",
      passed: start.ok,
      detail: start.ok ? "Signing session initialized." : "Signing session init failed.",
    });

    const chunkPayload: SignPdfChunkPayload = {
      jobId: chunkJobId || startJobId,
      index: Number(chunkIndex),
      chunkBase64: chunkBase64.trim(),
    };
    const chunk = await runCommand<SignPdfChunkPayload, SignPdfChunkResult>(
      "SIGN_PDF_CHUNK",
      chunkPayload
    );
    checks.push({
      cmd: "SIGN_PDF_CHUNK",
      passed: chunk.ok,
      detail: chunk.ok ? "PDF chunk accepted." : "Chunk rejected or job mismatch.",
    });

    const end = await runCommand<SignPdfEndPayload, SignPdfFinalResult>("SIGN_PDF_END", {
      jobId: endJobId || chunkJobId || startJobId,
    });
    checks.push({
      cmd: "SIGN_PDF_END",
      passed: end.ok,
      detail: end.ok ? "Signing finalized and result returned." : "Signing finalization failed.",
    });

    const passedCount = checks.filter((check) => check.passed).length;
    setContractRunnerOutput(
      pretty({
        generatedAt: new Date().toISOString(),
        passed: `${passedCount}/${checks.length}`,
        checks,
      })
    );
    setContractRunnerLoading(false);
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

          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <h2 className="text-lg font-semibold text-gray-900">LIST_USB_TOKENS</h2>
            <p className="mt-1 text-sm text-gray-600">Payload: {"{ v: PROTOCOL_VERSION }"}</p>
            <button
              onClick={() => void runListUsbTokens()}
              disabled={apiStates.LIST_USB_TOKENS.loading}
              className="mt-3 rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {apiStates.LIST_USB_TOKENS.loading ? "Sending..." : "Send LIST_USB_TOKENS"}
            </button>
            {renderApiPanel("LIST_USB_TOKENS")}
          </div>
        </section>

        <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900">LIST_SLOTS</h2>
          <p className="mt-1 text-sm text-gray-600">Payload: {"{ v: PROTOCOL_VERSION }"}</p>
          <button
            onClick={() => void runListSlots()}
            disabled={apiStates.LIST_SLOTS.loading}
            className="mt-3 rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {apiStates.LIST_SLOTS.loading ? "Sending..." : "Send LIST_SLOTS"}
          </button>
          {renderApiPanel("LIST_SLOTS")}
        </section>

        <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900">LIST_CERTS</h2>
          <div className="mt-3 grid gap-3 md:grid-cols-3">
            <label className="text-sm">
              <span className="mb-1 block font-medium text-gray-700">slotId</span>
              <input
                type="number"
                value={listCertsSlotId}
                onChange={(e) => setListCertsSlotId(Number(e.target.value))}
                className="w-full rounded border border-gray-300 px-3 py-2 text-sm text-black"
              />
            </label>
          </div>
          <button
            onClick={() => void runListCerts()}
            disabled={apiStates.LIST_CERTS.loading}
            className="mt-3 rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {apiStates.LIST_CERTS.loading ? "Sending..." : "Send LIST_CERTS"}
          </button>
          {renderApiPanel("LIST_CERTS")}
        </section>

        <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900">SIGN_PDF_START</h2>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <label className="text-sm">
              <span className="mb-1 block font-medium text-gray-700">jobId</span>
              <input
                value={startJobId}
                onChange={(e) => setStartJobId(e.target.value)}
                className="w-full rounded border border-gray-300 px-3 py-2 text-sm text-black"
              />
            </label>
            <label className="text-sm">
              <span className="mb-1 block font-medium text-gray-700">totalChunks</span>
              <input
                type="number"
                min={1}
                value={startTotalChunks}
                onChange={(e) => setStartTotalChunks(Number(e.target.value))}
                className="w-full rounded border border-gray-300 px-3 py-2 text-sm text-black"
              />
            </label>
            <label className="text-sm">
              <span className="mb-1 block font-medium text-gray-700">slotId</span>
              <input
                type="number"
                value={startSlotId}
                onChange={(e) => setStartSlotId(Number(e.target.value))}
                className="w-full rounded border border-gray-300 px-3 py-2 text-sm text-black"
              />
            </label>
            <label className="text-sm">
              <span className="mb-1 block font-medium text-gray-700">certId (hex CKA_ID)</span>
              <input
                value={startCertId}
                onChange={(e) => setStartCertId(e.target.value)}
                className="w-full rounded border border-gray-300 px-3 py-2 text-sm text-black"
              />
            </label>
            <label className="text-sm">
              <span className="mb-1 block font-medium text-gray-700">fileName (optional)</span>
              <input
                value={startFileName}
                onChange={(e) => setStartFileName(e.target.value)}
                className="w-full rounded border border-gray-300 px-3 py-2 text-sm text-black"
              />
            </label>
            <label className="text-sm">
              <span className="mb-1 block font-medium text-gray-700">contentType (optional)</span>
              <input
                value={startContentType}
                onChange={(e) => setStartContentType(e.target.value)}
                className="w-full rounded border border-gray-300 px-3 py-2 text-sm text-black"
              />
            </label>
            <label className="text-sm md:col-span-2">
              <span className="mb-1 block font-medium text-gray-700">PIN hint (optional)</span>
              <input
                type="password"
                value={startPinHint}
                onChange={(e) => setStartPinHint(e.target.value)}
                className="w-full rounded border border-gray-300 px-3 py-2 text-sm text-black"
              />
            </label>
          </div>
          <button
            onClick={() => void runSignStart()}
            disabled={apiStates.SIGN_PDF_START.loading}
            className="mt-3 rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {apiStates.SIGN_PDF_START.loading ? "Sending..." : "Send SIGN_PDF_START"}
          </button>
          {renderApiPanel("SIGN_PDF_START")}
        </section>

        <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900">SIGN_PDF_CHUNK</h2>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <label className="text-sm">
              <span className="mb-1 block font-medium text-gray-700">jobId</span>
              <input
                value={chunkJobId}
                onChange={(e) => setChunkJobId(e.target.value)}
                className="w-full rounded border border-gray-300 px-3 py-2 text-sm text-black"
              />
            </label>
            <label className="text-sm">
              <span className="mb-1 block font-medium text-gray-700">index</span>
              <input
                type="number"
                min={0}
                value={chunkIndex}
                onChange={(e) => setChunkIndex(Number(e.target.value))}
                className="w-full rounded border border-gray-300 px-3 py-2 text-sm text-black"
              />
            </label>
            <label className="text-sm md:col-span-2">
              <span className="mb-1 block font-medium text-gray-700">chunkBase64</span>
              <textarea
                rows={6}
                value={chunkBase64}
                onChange={(e) => setChunkBase64(e.target.value)}
                className="w-full rounded border border-gray-300 px-3 py-2 font-mono text-xs text-black"
              />
            </label>
          </div>
          <button
            onClick={() => void runSignChunk()}
            disabled={apiStates.SIGN_PDF_CHUNK.loading}
            className="mt-3 rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {apiStates.SIGN_PDF_CHUNK.loading ? "Sending..." : "Send SIGN_PDF_CHUNK"}
          </button>
          {renderApiPanel("SIGN_PDF_CHUNK")}
        </section>

        <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900">SIGN_PDF_END</h2>
          <div className="mt-3 grid gap-3 md:grid-cols-3">
            <label className="text-sm">
              <span className="mb-1 block font-medium text-gray-700">jobId</span>
              <input
                value={endJobId}
                onChange={(e) => setEndJobId(e.target.value)}
                className="w-full rounded border border-gray-300 px-3 py-2 text-sm text-black"
              />
            </label>
          </div>
          <button
            onClick={() => void runSignEnd()}
            disabled={apiStates.SIGN_PDF_END.loading}
            className="mt-3 rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {apiStates.SIGN_PDF_END.loading ? "Sending..." : "Send SIGN_PDF_END"}
          </button>
          {renderApiPanel("SIGN_PDF_END")}
        </section>

        <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900">API Contract Check Runner</h2>
          <p className="mt-1 text-sm text-gray-600">
            Runs all bridge APIs sequentially and prints pass/fail diagnostics per command.
          </p>
          <button
            onClick={() => void runAllChecks()}
            disabled={contractRunnerLoading}
            className="mt-3 rounded bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {contractRunnerLoading ? "Running checks..." : "Run Full API Contract Check"}
          </button>
          <pre className="mt-3 max-h-96 overflow-auto rounded bg-gray-900 p-3 text-xs text-amber-200">
            {contractRunnerOutput}
          </pre>
        </section>

        <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <h3 className="text-base font-semibold text-gray-900">Protocol Checklist</h3>
          <p className="mt-1 text-sm text-gray-600">
            Use this as a parity checklist for extension/service-worker/native-host handlers.
          </p>
          <pre className="mt-2 max-h-96 overflow-auto rounded bg-gray-900 p-3 text-xs text-green-300">
            {pretty({
              commandPayloadRequirements: {
                PING: ["v"],
                LIST_USB_TOKENS: ["v"],
                LIST_SLOTS: ["v"],
                LIST_CERTS: ["slotId"],
                SIGN_PDF_START: ["jobId", "totalChunks", "slotId", "certId", "fileName?", "contentType?", "pin?"],
                SIGN_PDF_CHUNK: ["jobId", "index", "chunkBase64"],
                SIGN_PDF_END: ["jobId"],
              },
              commandResultExpectations: {
                PING: ["hostVersion", "protocolVersion", "tokenPresent"],
                LIST_USB_TOKENS: ["implementation-specific result structure"],
                LIST_SLOTS: ["slots[]"],
                LIST_CERTS: ["certs[]"],
                SIGN_PDF_START: ["jobId"],
                SIGN_PDF_CHUNK: ["jobId", "index", "received"],
                SIGN_PDF_END: ["signedPdfBase64", "jobId"],
              },
              responseEnvelopeExpectedByBridgeClient: {
                source: "AUTODCR_SIGN_BRIDGE",
                type: "RESPONSE",
                requestId: "must match request",
                ok: "boolean",
                error: "{ code?, message } when ok=false",
              },
            })}
          </pre>
        </section>
      </div>
    </main>
  );
}
