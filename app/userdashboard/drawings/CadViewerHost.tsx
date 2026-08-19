"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Loader2 } from "lucide-react";
import {
  CAD_HOST_SOURCE,
  isCadEmbedMessage,
} from "@/app/lib/cadViewer/protocol";

type CadPaneProps = {
  buffer: ArrayBuffer | null;
  name: string | null;
  label?: string;
  opacity?: number;
  className?: string;
};

function CadPane({ buffer, name, label, opacity = 1, className = "" }: CadPaneProps) {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lastOpenedRef = useRef<string | null>(null);

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
      }
    };

    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe?.contentWindow || !ready || !buffer || !name) return;
    const openKey = `${name}:${buffer.byteLength}`;
    if (lastOpenedRef.current === openKey) return;
    lastOpenedRef.current = openKey;

    setLoading(true);
    setError(null);
    const copy = buffer.slice(0);
    iframe.contentWindow.postMessage(
      { source: CAD_HOST_SOURCE, type: "open", name, buffer: copy },
      window.location.origin,
      [copy]
    );
  }, [ready, buffer, name]);

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
}

type CadViewerHostProps = {
  mode: "view" | "overlay" | "compare";
  primaryBuffer: ArrayBuffer | null;
  primaryName: string | null;
  secondaryBuffer: ArrayBuffer | null;
  secondaryName: string | null;
  overlayOpacity: number;
  emptyState: ReactNode;
};

export default function CadViewerHost({
  mode,
  primaryBuffer,
  primaryName,
  secondaryBuffer,
  secondaryName,
  overlayOpacity,
  emptyState,
}: CadViewerHostProps) {
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

  return <CadPane buffer={primaryBuffer} name={primaryName} className="flex-1" />;
}
