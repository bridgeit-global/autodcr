"use client";

import React from "react";
import { Viewer, Worker, RenderPageProps } from "@react-pdf-viewer/core";
import { defaultLayoutPlugin } from "@react-pdf-viewer/default-layout";
import "@react-pdf-viewer/core/lib/styles/index.css";
import "@react-pdf-viewer/default-layout/lib/styles/index.css";
import PDFLayoutOverlay from "./PDFLayoutOverlay";

interface PDFViewerProps {
  fileUrl: string;
}

const PDFViewer: React.FC<PDFViewerProps> = ({ fileUrl }) => {
  // Call defaultLayoutPlugin unconditionally at the top level
  const defaultLayoutPluginInstance = defaultLayoutPlugin();

  // Custom render function to inject overlay into page
  const renderPage = (props: RenderPageProps) => {
    const { canvasLayer, textLayer, annotationLayer } = props;
    
    return (
      <>
        {canvasLayer.children}
        {textLayer.children}
        {annotationLayer.children}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            pointerEvents: "none",
            zIndex: 10,
          }}
        >
          <PDFLayoutOverlay
            pageWidth={612}
            pageHeight={792}
            scale={props.scale}
          />
        </div>
      </>
    );
  };

  return (
    <Worker workerUrl="https://unpkg.com/pdfjs-dist@3.11.174/build/pdf.worker.min.js">
      <div style={{ height: "600px", position: "relative" }}>
        <Viewer 
          fileUrl={fileUrl} 
          plugins={[defaultLayoutPluginInstance]}
          defaultScale={1.0}
          renderPage={renderPage}
        />
      </div>
    </Worker>
  );
};

export default PDFViewer;

