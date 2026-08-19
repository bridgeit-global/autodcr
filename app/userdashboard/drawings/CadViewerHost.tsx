"use client";

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Loader2 } from "lucide-react";
import {
  CAD_HOST_SOURCE,
  isCadEmbedMessage,
} from "@/app/lib/cadViewer/protocol";

export type CadViewerHandle = {
  sendCommand: (cmd: string) => void;
  cancelCommand: () => void;
  exportDxf: () => Promise<ArrayBuffer>;
};

type CadPaneProps = {
  buffer: ArrayBuffer | null;
  name: string | null;
  label?: string;
  opacity?: number;
  writable?: boolean;
  className?: string;
};

type PendingExport = {
  resolve: (buffer: ArrayBuffer) => void;
  reject: (error: Error) => void;
  timer: number;
};

const CadPane = forwardRef<CadViewerHandle, CadPaneProps>(function CadPane(
  { buffer, name, label, opacity = 1, writable = false, className = "" },
  ref
) {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const pendingExportsRef = useRef(new Map<string, PendingExport>());
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lastOpenedRef = useRef<string | null>(null);

  const postToEmbed = (payload: Record<string, unknown>, transfer: Transferable[] = []) => {
    const iframe = iframeRef.current;
    if (!iframe?.contentWindow) return false;
    iframe.contentWindow.postMessage(
      { source: CAD_HOST_SOURCE, ...payload },
      window.location.origin,
      transfer
    );
    return true;
  };

  useImperativeHandle(
    ref,
    () => ({
      sendCommand: (cmd: string) => {
        postToEmbed({ type: "command", cmd });
      },
      cancelCommand: () => {
        postToEmbed({ type: "cancel" });
      },
      exportDxf: () =>
        new Promise<ArrayBuffer>((resolve, reject) => {
          const requestId = crypto.randomUUID();
          const timer = window.setTimeout(() => {
            pendingExportsRef.current.delete(requestId);
            reject(new Error("Timed out exporting drawing"));
          }, 30000);
          pendingExportsRef.current.set(requestId, { resolve, reject, timer });
          if (!postToEmbed({ type: "export", requestId })) {
            window.clearTimeout(timer);
            pendingExportsRef.current.delete(requestId);
            reject(new Error("CAD viewer is not ready"));
          }
        }),
    }),
    []
  );

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      if (event.source !== iframe.contentWindow) return;
      if (!isCadEmbedMessage(event.data)) return;

      if (event.data.type === "ready") {
        setReady(true);
        return;
      }
      if (event.data.type === "opened") {
        setLoading(false);
        setError(event.data.ok ? null : event.data.error || "Failed to open drawing");
        return;
      }
      if (event.data.type === "exported") {
        const pending = pendingExportsRef.current.get(event.data.requestId);
        if (!pending) return;
        pendingExportsRef.current.delete(event.data.requestId);
        window.clearTimeout(pending.timer);
        if (event.data.ok && event.data.buffer) {
          pending.resolve(event.data.buffer);
        } else {
          pending.reject(new Error(event.data.error || "Failed to export drawing"));
        }
      }
    };

    window.addEventListener("message", onMessage);
    return () => {
      window.removeEventListener("message", onMessage);
      for (const pending of pendingExportsRef.current.values()) {
        window.clearTimeout(pending.timer);
        pending.reject(new Error("CAD viewer closed"));
      }
      pendingExportsRef.current.clear();
    };
  }, []);

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe?.contentWindow || !ready || !buffer || !name) return;
    const openKey = `${name}:${buffer.byteLength}:${writable ? "write" : "review"}`;
    if (lastOpenedRef.current === openKey) return;
    lastOpenedRef.current = openKey;

    setLoading(true);
    setError(null);
    const copy = buffer.slice(0);
    iframe.contentWindow.postMessage(
      { source: CAD_HOST_SOURCE, type: "open", name, buffer: copy, mode: writable ? "write" : "review" },
      window.location.origin,
      [copy]
    );
  }, [ready, buffer, name, writable]);

  return (
    <div className={["relative h-full w-full min-h-0 min-w-0 overflow-hidden bg-white", className].join(" ")} style={{ opacity }}>
      {label ? (
        <div className="absolute left-3 top-3 z-10 rounded-full bg-white/90 px-2.5 py-1 text-[11px] font-semibold text-brand-navy shadow-sm ring-1 ring-gray-200">
          {label}
        </div>
      ) : null}
      <iframe
        ref={iframeRef}
        src="/cad-embed"
        title={label || name || "CAD viewer"}
        className="h-full w-full border-0 bg-white"
      />
      {loading ? (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-white/70">
          <Loader2 className="h-6 w-6 animate-spin text-brand-blue" />
        </div>
      ) : null}
      {error ? (
        <div className="absolute inset-x-3 bottom-3 z-20 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">
          {error}
        </div>
      ) : null}
    </div>
  );
});

type CadViewerHostProps = {
  mode: "view" | "overlay" | "compare";
  writable?: boolean;
  primaryBuffer: ArrayBuffer | null;
  primaryName: string | null;
  secondaryBuffer: ArrayBuffer | null;
  secondaryName: string | null;
  overlayOpacity: number;
  emptyState: ReactNode;
};

const CadViewerHost = forwardRef<CadViewerHandle, CadViewerHostProps>(function CadViewerHost(
  {
    mode,
    writable = false,
    primaryBuffer,
    primaryName,
    secondaryBuffer,
    secondaryName,
    overlayOpacity,
    emptyState,
  },
  ref
) {
  if (!primaryBuffer || !primaryName) {
    return <div className="flex h-full min-h-0 flex-1 items-center justify-center">{emptyState}</div>;
  }

  if (mode === "compare") {
    return (
      <div className="grid h-full min-h-0 flex-1 grid-cols-1 gap-px bg-gray-200 md:grid-cols-2">
        <CadPane buffer={secondaryBuffer ?? primaryBuffer} name={secondaryName ?? primaryName} label={secondaryName ?? "Previous"} />
        <CadPane buffer={primaryBuffer} name={primaryName} label={primaryName} />
      </div>
    );
  }

  if (mode === "overlay") {
    return (
      <div className="relative h-full min-h-0 flex-1">
        <CadPane
          buffer={secondaryBuffer ?? primaryBuffer}
          name={secondaryName ?? primaryName}
          className="pointer-events-none absolute inset-0"
        />
        <CadPane
          buffer={primaryBuffer}
          name={primaryName}
          opacity={overlayOpacity}
          className="absolute inset-0 mix-blend-multiply"
        />
      </div>
    );
  }

  return (
    <CadPane
      ref={ref}
      buffer={primaryBuffer}
      name={primaryName}
      writable={writable}
      className="flex-1"
    />
  );
});

export default CadViewerHost;
