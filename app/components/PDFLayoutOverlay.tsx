"use client";

import React from "react";

// Based on the demo PDF analysis (Parkour Letter Head.docx.pdf):
// Standard US Letter size: 612 x 792 points (8.5" x 11")
// MediaBox: [0 0 612 792]
// From the PDF structure, we need to calculate the content area
// Typical letterhead has header at top and footer at bottom
// Content area is the blank space between them

interface PDFLayoutOverlayProps {
  pageWidth: number;
  pageHeight: number;
  scale: number;
}

const PDFLayoutOverlay: React.FC<PDFLayoutOverlayProps> = ({ pageWidth, pageHeight, scale }) => {
  // Since we're now rendering inside the page container via renderPage,
  // we can use percentage-based positioning directly
  // No need for complex detection - the overlay is already positioned relative to the page

  // Calculate content area percentages based on demo PDF structure
  // Standard letter: 612x792 points
  // Header area: ~12.6% from top (100/792)
  // Footer area: ~12.6% from bottom (100/792)
  // Left/Right margins: ~11.8% each (72/612)
  const topMarginPercent = 12.6;
  const bottomMarginPercent = 12.6;
  const leftMarginPercent = 11.8;
  const rightMarginPercent = 11.8;

  return (
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
      {/* Content Area Overlay - Shows the blank space where content will be placed */}
      <div
        style={{
          position: "absolute",
          top: `${topMarginPercent}%`,
          left: `${leftMarginPercent}%`,
          width: `${100 - leftMarginPercent - rightMarginPercent}%`,
          height: `${100 - topMarginPercent - bottomMarginPercent}%`,
          border: "3px dashed #3b82f6",
          backgroundColor: "rgba(59, 130, 246, 0.2)",
          boxSizing: "border-box",
          boxShadow: "0 0 0 3px rgba(59, 130, 246, 0.3), inset 0 0 20px rgba(59, 130, 246, 0.1)",
        }}
      >
        {/* Corner indicators */}
        <div
          style={{
            position: "absolute",
            top: "-2px",
            left: "-2px",
            width: "12px",
            height: "12px",
            borderTop: "3px solid #3b82f6",
            borderLeft: "3px solid #3b82f6",
          }}
        />
        <div
          style={{
            position: "absolute",
            top: "-2px",
            right: "-2px",
            width: "12px",
            height: "12px",
            borderTop: "3px solid #3b82f6",
            borderRight: "3px solid #3b82f6",
          }}
        />
        <div
          style={{
            position: "absolute",
            bottom: "-2px",
            left: "-2px",
            width: "12px",
            height: "12px",
            borderBottom: "3px solid #3b82f6",
            borderLeft: "3px solid #3b82f6",
          }}
        />
        <div
          style={{
            position: "absolute",
            bottom: "-2px",
            right: "-2px",
            width: "12px",
            height: "12px",
            borderBottom: "3px solid #3b82f6",
            borderRight: "3px solid #3b82f6",
          }}
        />
        
        {/* Label */}
        <div
          style={{
            position: "absolute",
            top: "8px",
            left: "8px",
            backgroundColor: "rgba(59, 130, 246, 0.9)",
            color: "white",
            padding: "4px 8px",
            borderRadius: "4px",
            fontSize: "11px",
            fontWeight: "600",
            pointerEvents: "auto",
          }}
        >
          Content Area
        </div>
      </div>
    </div>
  );
};

export default PDFLayoutOverlay;

