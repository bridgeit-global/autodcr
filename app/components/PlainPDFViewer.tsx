"use client";

import React from "react";

interface PlainPDFViewerProps {
  fileUrl: string;
}

/**
 * Native browser PDF rendering via iframe — matches opening the same Storage URL in a new tab.
 * Avoids pdf.js canvas path which often omits full-page letterhead in complex PDFs.
 */
export default function PlainPDFViewer({ fileUrl }: PlainPDFViewerProps) {
  return (
    <div className="w-full bg-neutral-100" style={{ height: "80vh", minHeight: "560px" }}>
      <iframe
        title="PDF preview"
        src={fileUrl}
        className="block h-full w-full border-0 bg-white"
      />
    </div>
  );
}
