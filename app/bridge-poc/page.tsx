"use client";

import { useMemo, useState } from "react";

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

export default function BridgePocPage() {
  const [lastResponse, setLastResponse] = useState<string>("");
  const [lastError, setLastError] = useState<string>("");
  const [timeoutMs, setTimeoutMs] = useState(30000);

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

  const extensionDetected = useMemo(() => isExtensionAvailable(), []);

  const runCommand = async <TPayload, TResult>(
    cmd: "PING" | "LIST_SLOTS" | "LIST_CERTS" | "SIGN_PDF_START" | "SIGN_PDF_CHUNK" | "SIGN_PDF_END",
    payload: TPayload
  ) => {
    setLastError("");
    try {
      const result = await sendBridgeCommand<TPayload, TResult>(cmd, payload, { timeoutMs });
      setLastResponse(pretty({ cmd, payload, result }));
      return result;
    } catch (error: unknown) {
      const mapped = mapBridgeError(error);
      setLastError(pretty({ cmd, payload, error: mapped }));
      return null;
    }
  };

  const runPing = async () => {
    await runCommand<PingPayload, PingResult>("PING", { v: PROTOCOL_VERSION });
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
    const result = await runCommand<SignPdfStartPayload, SignPdfStartResult>("SIGN_PDF_START", payload);
    if (result) {
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
              className="mt-3 rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              Send PING
            </button>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <h2 className="text-lg font-semibold text-gray-900">LIST_SLOTS</h2>
            <p className="mt-1 text-sm text-gray-600">Payload: {"{ v: PROTOCOL_VERSION }"}</p>
            <button
              onClick={() => void runListSlots()}
              className="mt-3 rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              Send LIST_SLOTS
            </button>
          </div>
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
            className="mt-3 rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Send LIST_CERTS
          </button>
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
            className="mt-3 rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Send SIGN_PDF_START
          </button>
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
            className="mt-3 rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Send SIGN_PDF_CHUNK
          </button>
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
            className="mt-3 rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Send SIGN_PDF_END
          </button>
        </section>

        <section className="grid gap-4 md:grid-cols-2">
          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <h3 className="text-base font-semibold text-gray-900">Last Response</h3>
            <pre className="mt-2 max-h-96 overflow-auto rounded bg-gray-900 p-3 text-xs text-green-300">
              {lastResponse || "(none)"}
            </pre>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <h3 className="text-base font-semibold text-gray-900">Last Error</h3>
            <pre className="mt-2 max-h-96 overflow-auto rounded bg-gray-900 p-3 text-xs text-red-300">
              {lastError || "(none)"}
            </pre>
          </div>
        </section>
      </div>
    </main>
  );
}
