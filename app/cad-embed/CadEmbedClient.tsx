"use client";

import { useEffect, useRef, useState } from "react";
import {
  CAD_EMBED_SOURCE,
  isCadHostMessage,
} from "@/app/lib/cadViewer/protocol";

function postToParent(
  payload: { type: string; [key: string]: unknown },
  transfer: Transferable[] = []
) {
  window.parent.postMessage({ source: CAD_EMBED_SOURCE, ...payload }, window.location.origin, transfer);
}

export default function CadEmbedClient() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState("Starting CAD viewer…");

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let cancelled = false;
    let manager: Awaited<
      ReturnType<typeof import("@/app/lib/cadViewer/ensureCadViewer")["ensureCadViewer"]>
    > | null = null;

    async function boot() {
      try {
        const { ensureCadViewer, openCadDocument, exportCurrentDrawingDxf } = await import(
          "@/app/lib/cadViewer/ensureCadViewer"
        );
        if (cancelled || !container) return;
        manager = await ensureCadViewer(container);
        if (cancelled) return;
        setStatus("");
        postToParent({ type: "ready" });

        const onMessage = (event: MessageEvent) => {
          if (event.origin !== window.location.origin) return;
          if (!isCadHostMessage(event.data)) return;
          const data = event.data;

          if (data.type === "open") {
            setError(null);
            setStatus(`Opening ${data.name}…`);
            void openCadDocument(manager!, data.name, data.buffer, data.mode === "write")
              .then((ok) => {
                setStatus("");
                if (!ok) setError(`Failed to load ${data.name}`);
                postToParent({
                  type: "opened",
                  ok,
                  name: data.name,
                  error: ok ? undefined : `Failed to load ${data.name}`,
                });
              })
              .catch((err: unknown) => {
                const message = err instanceof Error ? err.message : String(err);
                setError(message);
                setStatus("");
                postToParent({ type: "opened", ok: false, name: data.name, error: message });
              });
            return;
          }

          if (data.type === "command") {
            try {
              manager?.sendStringToExecute(data.cmd);
            } catch (err) {
              console.error("CAD command failed", err);
            }
            return;
          }

          if (data.type === "cancel") {
            try {
              manager?.editor.cancelActiveInput();
            } catch (err) {
              console.error("CAD cancel failed", err);
            }
            return;
          }

          if (data.type === "export") {
            try {
              if (!manager) throw new Error("CAD viewer is not ready");
              const buffer = exportCurrentDrawingDxf(manager);
              postToParent(
                {
                  type: "exported",
                  requestId: data.requestId,
                  ok: true,
                  name: manager.curDocument?.fileName,
                  buffer,
                },
                [buffer]
              );
            } catch (err) {
              const message = err instanceof Error ? err.message : String(err);
              postToParent({
                type: "exported",
                requestId: data.requestId,
                ok: false,
                error: message,
              });
            }
          }
        };

        window.addEventListener("message", onMessage);
        return () => window.removeEventListener("message", onMessage);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        if (!cancelled) {
          setError(message);
          setStatus("");
        }
      }
    }

    const cleanupPromise = boot();
    return () => {
      cancelled = true;
      void cleanupPromise.then((unsubscribe) => unsubscribe?.()).catch(() => undefined);
    };
  }, []);

  return (
    <div className="relative h-dvh w-full overflow-hidden bg-white">
      <div ref={containerRef} className="h-full w-full" />
      {(status || error) && (
        <div className="pointer-events-none absolute inset-x-0 top-3 z-10 flex justify-center px-4">
          <p
            className={[
              "rounded-full px-3 py-1.5 text-xs font-medium shadow-sm",
              error ? "bg-red-50 text-red-700" : "bg-white/90 text-gray-600",
            ].join(" ")}
          >
            {error || status}
          </p>
        </div>
      )}
    </div>
  );
}
