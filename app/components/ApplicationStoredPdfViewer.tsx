"use client";

import { useEffect, useRef, useState } from "react";
import * as pdfjs from "pdfjs-dist";

type PreviewLinkService = Parameters<pdfjs.AnnotationLayer["render"]>[0]["linkService"];
type PreviewDownloadManager = Parameters<pdfjs.AnnotationLayer["render"]>[0]["downloadManager"];

const PDF_WORKER_URL = "https://unpkg.com/pdfjs-dist@3.11.174/build/pdf.worker.min.js";

type ApplicationStoredPdfViewerProps = {
  fileUrl: string;
};

/** Minimal link service for annotation-layer rendering (signature widgets). */
function createPreviewLinkService(pagesCount: number): PreviewLinkService {
  let page = 1;
  let rotation = 0;
  return {
    externalLinkEnabled: true,
    get pagesCount() {
      return pagesCount;
    },
    get page() {
      return page;
    },
    set page(value: number) {
      page = value;
    },
    get rotation() {
      return rotation;
    },
    set rotation(value: number) {
      rotation = value;
    },
    get isInPresentationMode() {
      return false;
    },
    goToDestination: async () => {},
    goToPage: () => {},
    addLinkAttributes: () => {},
    getDestinationHash: () => "#",
    getAnchorUrl: () => "#",
    setHash: () => {},
    executeNamedAction: () => {},
    executeSetOCGState: () => {},
    cachePageRef: () => {},
  };
}

const previewDownloadManager: PreviewDownloadManager = {
  downloadUrl: () => {},
  downloadData: () => {},
  openOrDownloadData: () => false,
  download: () => {},
};

/**
 * Letter-style preview for saved application PDFs (Approved / Verified).
 * Renders pages edge-to-edge at container width — matches the HTML iframe preview
 * without browser PDF chrome or react-pdf-viewer page shadows.
 */
export default function ApplicationStoredPdfViewer({ fileUrl }: ApplicationStoredPdfViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    pdfjs.GlobalWorkerOptions.workerSrc = PDF_WORKER_URL;

    let cancelled = false;
    const container = containerRef.current;
    if (!container) return;

    const renderPages = async () => {
      setLoading(true);
      setError(null);
      container.replaceChildren();

      const res = await fetch(fileUrl);
      if (!res.ok) throw new Error("Could not load the saved PDF.");
      const data = await res.arrayBuffer();
      const pdf = await pdfjs.getDocument({ data }).promise;
      if (cancelled) return;

      const width = container.clientWidth > 0 ? container.clientWidth : 800;

      for (let pageNum = 1; pageNum <= pdf.numPages; pageNum += 1) {
        const page = await pdf.getPage(pageNum);
        if (cancelled) return;

        const baseViewport = page.getViewport({ scale: 1 });
        const scale = width / baseViewport.width;
        const viewport = page.getViewport({ scale });

        const canvas = document.createElement("canvas");
        const context = canvas.getContext("2d");
        if (!context) continue;

        canvas.width = viewport.width;
        canvas.height = viewport.height;
        canvas.className = "block w-full h-auto bg-white";

        await page.render({ canvasContext: context, viewport }).promise;
        if (cancelled) return;

        const pageWrap = document.createElement("div");
        pageWrap.className = "bg-white relative";
        pageWrap.appendChild(canvas);

        const annotations = await page.getAnnotations({ intent: "display" });
        if (annotations.length > 0) {
          const annotationDiv = document.createElement("div");
          annotationDiv.className = "absolute left-0 top-0";
          pageWrap.appendChild(annotationDiv);

          const annotationLayer = new pdfjs.AnnotationLayer({
            div: annotationDiv,
            page,
            viewport,
            accessibilityManager: null,
            annotationCanvasMap: null,
            l10n: null,
          });
          await annotationLayer.render({
            viewport,
            div: annotationDiv,
            annotations,
            page,
            linkService: createPreviewLinkService(pdf.numPages),
            downloadManager: previewDownloadManager,
            renderForms: true,
          });
        }

        container.appendChild(pageWrap);
      }

      if (!cancelled) setLoading(false);
    };

    void renderPages().catch((err: unknown) => {
      if (cancelled) return;
      const message = err instanceof Error ? err.message : "Could not load PDF.";
      setError(message);
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [fileUrl]);

  return (
    <div className="relative w-full bg-white">
      <div
        ref={containerRef}
        className="application-stored-pdf-viewer w-full overflow-y-auto overflow-x-hidden bg-white"
        style={{ height: "78vh", minHeight: "600px" }}
      />
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-white text-sm text-gray-500">
          Loading PDF…
        </div>
      )}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-white px-4 text-center text-sm text-red-600">
          {error}
        </div>
      )}
    </div>
  );
}
