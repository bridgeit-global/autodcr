"use client";

import React from "react";
import { Viewer, Worker } from "@react-pdf-viewer/core";
import { defaultLayoutPlugin } from "@react-pdf-viewer/default-layout";
import "@react-pdf-viewer/core/lib/styles/index.css";
import "@react-pdf-viewer/default-layout/lib/styles/index.css";

interface PlainPDFViewerProps {
  fileUrl: string;
}

// Same viewer stack as `PDFViewer`, but WITHOUT the letterhead overlay.
export default function PlainPDFViewer({ fileUrl }: PlainPDFViewerProps) {
  const defaultLayoutPluginInstance = defaultLayoutPlugin();

  return (
    <Worker workerUrl="https://unpkg.com/pdfjs-dist@3.11.174/build/pdf.worker.min.js">
      <div style={{ height: "80vh" }}>
        <Viewer fileUrl={fileUrl} plugins={[defaultLayoutPluginInstance]} defaultScale={1.0} />
      </div>
    </Worker>
  );
}


