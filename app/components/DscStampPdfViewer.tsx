"use client";

/**
 * PDF preview with drag-to-place DSC stamp rectangle (PDF point coords).
 * Factored from bridge-poc for use in BridgeSignModal.
 */

import React, { useEffect, useRef, useState } from "react";
import { RenderPageProps, Viewer, Worker } from "@react-pdf-viewer/core";
import { defaultLayoutPlugin } from "@react-pdf-viewer/default-layout";
import { PDFDocument } from "pdf-lib";

import "@react-pdf-viewer/core/lib/styles/index.css";
import "@react-pdf-viewer/default-layout/lib/styles/index.css";

const PDF_WORKER_URL = "https://unpkg.com/pdfjs-dist@3.11.174/build/pdf.worker.min.js";

export interface StampRect {
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
        border: "1px dashed #9ca3af",
        background: "transparent",
        pointerEvents: "none",
        display: "flex",
        alignItems: "center",
        padding: "2px 4px",
        boxSizing: "border-box",
        overflow: "hidden",
      }}
    >
      <div style={{ position: "relative", width: "100%", height: "100%" }}>
      <svg
        aria-hidden
        viewBox="0 0 100 100"
        fill="none"
        style={{
          position: "absolute",
          left: "2%",
          top: "10%",
          width: "46%",
          height: "80%",
          pointerEvents: "none",
        }}
      >
        <g opacity={0.28} transform="translate(2 2)">
          <path
            d="M22 76 L38 88 L92 18"
            stroke="#374151"
            strokeWidth="7"
            strokeLinecap="round"
            strokeLinejoin="miter"
          />
        </g>
        <path
          d="M22 76 L38 88 L92 18"
          stroke="#111827"
          strokeWidth="7"
          strokeLinecap="round"
          strokeLinejoin="miter"
        />
        <path
          d="M22 76 L38 88 L92 18"
          stroke="#22c55e"
          strokeWidth="5"
          strokeLinecap="round"
          strokeLinejoin="miter"
          opacity={0.62}
        />
      </svg>
      <div
        style={{
          position: "relative",
          fontSize: Math.max(8, box.width * 0.05),
          color: "#111827",
          lineHeight: 1.25,
        }}
      >
        <div style={{ fontWeight: 700 }}>Signature valid</div>
        <div style={{ fontWeight: 400 }}>Digitally signed by</div>
        <div style={{ fontWeight: 400 }}>…</div>
        <div style={{ fontWeight: 400 }}>Date: …</div>
      </div>
      </div>
    </div>
  );
}

export type DscStampPdfViewerProps = {
  fileUrl: string;
  stampRect: StampRect | null;
  onStampChange: (rect: StampRect | null) => void;
  /** When true, stamp placement controls are disabled. */
  disabled?: boolean;
};

export default function DscStampPdfViewer({
  fileUrl,
  stampRect,
  onStampChange,
  disabled = false,
}: DscStampPdfViewerProps) {
  const [pageDims, setPageDims] = useState<PageDims[]>([]);
  const [isPlacingStamp, setIsPlacingStamp] = useState(false);
  const [dragState, setDragState] = useState<DragState | null>(null);
  const defaultLayoutPluginInstance = defaultLayoutPlugin();

  useEffect(() => {
    if (!fileUrl) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(fileUrl);
        const buffer = await res.arrayBuffer();
        const doc = await PDFDocument.load(buffer, { updateMetadata: false });
        if (cancelled) return;
        setPageDims(
          doc.getPages().map((p) => {
            const { width, height } = p.getSize();
            return { width, height };
          })
        );
      } catch (e) {
        if (!cancelled) {
          console.error("DscStampPdfViewer: failed to load page dimensions", e);
          setPageDims([]);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [fileUrl]);

  const handleStampMouseDown =
    (pageIndex: number): React.MouseEventHandler<HTMLDivElement> =>
    (event) => {
      if (!isPlacingStamp || disabled) return;
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

    onStampChange({
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
    const overlayInteractive =
      !disabled && isPlacingStamp && (!stampRect || stampRect.pageIndex === pageIndex);

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
            <StampOverlay stamp={stampOnThisPage} pageDims={pageDims[pageIndex]} />
          ) : null}
        </div>
      </>
    );
  };

  if (!fileUrl) return null;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-xs font-medium text-gray-700">Visible DSC stamp:</span>
        <button
          type="button"
          disabled={disabled}
          onClick={() => {
            onStampChange(null);
            setIsPlacingStamp(true);
            setDragState(null);
          }}
          className="rounded bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {stampRect ? "Re-place stamp" : "Place stamp"}
        </button>
        {stampRect ? (
          <button
            type="button"
            disabled={disabled}
            onClick={() => {
              onStampChange(null);
              setIsPlacingStamp(false);
            }}
            className="rounded border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Clear
          </button>
        ) : null}
        <span className="text-xs text-gray-600">
          {disabled
            ? "Signing in progress…"
            : isPlacingStamp
              ? "Drag a rectangle on any page to position the stamp."
              : stampRect
                ? `Page ${stampRect.pageIndex + 1} · ${stampRect.pdfWidth.toFixed(0)}×${stampRect.pdfHeight.toFixed(0)} pt`
                : "Optional — no visible stamp unless you place one."}
        </span>
      </div>
      <div
        className="overflow-hidden rounded border border-gray-300 bg-gray-100"
        style={{ height: 400 }}
      >
        <Worker workerUrl={PDF_WORKER_URL}>
          <Viewer
            fileUrl={fileUrl}
            plugins={[defaultLayoutPluginInstance]}
            renderPage={renderViewerPage}
          />
        </Worker>
      </div>
    </div>
  );
}
