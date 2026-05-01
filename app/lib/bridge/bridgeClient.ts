/**
 * Generic page-side transport for the AutoDCR signing bridge.
 *
 * One `window.message` listener is installed lazily for the lifetime of the
 * page. Every `sendBridgeCommand` call generates a UUID `requestId`, posts a
 * BridgeRequest to the page itself (the content script intercepts it on the
 * way to the service worker), and resolves when a matching BridgeResponse
 * comes back through the same channel.
 */

import {
  BRIDGE_SOURCE,
  BridgeErrorPayload,
  BridgeRequest,
  BridgeResponse,
  HostCmd,
} from "./protocol";

const DEFAULT_TIMEOUT_MS = 30_000;

export interface SendBridgeOptions {
  /** Per-call timeout. Defaults to 30s. */
  timeoutMs?: number;
  /** Optional abort signal. Aborting rejects the pending request. */
  signal?: AbortSignal;
}

export class BridgeError extends Error {
  readonly code?: string;

  constructor(message: string, code?: string) {
    super(message);
    this.name = "BridgeError";
    this.code = code;
  }
}

interface PendingEntry {
  resolve: (response: BridgeResponse) => void;
  reject: (error: Error) => void;
  timeoutId: ReturnType<typeof setTimeout>;
  cleanup: () => void;
}

const pending = new Map<string, PendingEntry>();
let listenerInstalled = false;

const installListenerOnce = (): void => {
  if (listenerInstalled) return;
  if (typeof window === "undefined") return;

  window.addEventListener("message", (event: MessageEvent) => {
    if (event.source !== window) return;
    if (event.origin !== window.location.origin) return;

    const data = event.data as Partial<BridgeResponse> | undefined;
    if (!data || data.source !== BRIDGE_SOURCE || data.type !== "RESPONSE") return;
    if (typeof data.requestId !== "string") return;

    const entry = pending.get(data.requestId);
    if (!entry) return;

    entry.cleanup();
    pending.delete(data.requestId);
    entry.resolve(data as BridgeResponse);
  });

  listenerInstalled = true;
};

/**
 * Returns true when the AutoDCR signer extension has marked the page as
 * compatible by setting `<html data-autodcr-extension="1">` from its content
 * script.
 */
export const isExtensionAvailable = (): boolean => {
  if (typeof document === "undefined") return false;
  return document.documentElement.dataset.autodcrExtension === "1";
};

/**
 * Send one bridge command and await its response. Throws `BridgeError` when
 * the host returns `ok: false` or when the request times out / is aborted.
 */
export async function sendBridgeCommand<TPayload, TResult>(
  cmd: HostCmd,
  payload: TPayload,
  opts: SendBridgeOptions = {}
): Promise<TResult> {
  if (typeof window === "undefined") {
    throw new BridgeError("Bridge unavailable in non-browser environment.", "NO_WINDOW");
  }

  installListenerOnce();

  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const requestId =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

  const response = await new Promise<BridgeResponse>((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      const entry = pending.get(requestId);
      if (entry) {
        entry.cleanup();
        pending.delete(requestId);
      }
      reject(new BridgeError("Native host did not respond in time.", "NATIVE_TIMEOUT"));
    }, timeoutMs);

    const onAbort = () => {
      const entry = pending.get(requestId);
      if (entry) {
        entry.cleanup();
        pending.delete(requestId);
      }
      reject(new BridgeError("Bridge request was cancelled.", "ABORTED"));
    };

    const cleanup = () => {
      clearTimeout(timeoutId);
      if (opts.signal) opts.signal.removeEventListener("abort", onAbort);
    };

    if (opts.signal) {
      if (opts.signal.aborted) {
        clearTimeout(timeoutId);
        reject(new BridgeError("Bridge request was cancelled.", "ABORTED"));
        return;
      }
      opts.signal.addEventListener("abort", onAbort, { once: true });
    }

    pending.set(requestId, { resolve, reject, timeoutId, cleanup });

    const request: BridgeRequest<TPayload> = {
      source: BRIDGE_SOURCE,
      type: "REQUEST",
      requestId,
      cmd,
      payload,
    };

    window.postMessage(request, window.location.origin);
  });

  if (!response.ok) {
    const err: BridgeErrorPayload = response.error ?? { message: "Native host request failed." };
    throw new BridgeError(err.message || "Native host request failed.", err.code);
  }

  return response.result as TResult;
}

/**
 * Reject every in-flight request. Use when closing the signing modal or
 * unmounting the host component so dangling promises don't leak.
 */
export const cancelAllPending = (reason: string = "Bridge request cancelled."): void => {
  pending.forEach((entry) => {
    entry.cleanup();
    entry.reject(new BridgeError(reason, "ABORTED"));
  });
  pending.clear();
};
