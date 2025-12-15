"use client";

import React, { useState, useEffect } from "react";
import PDFViewer from "./PDFViewer";

interface PDFViewerWithErrorHandlingProps {
  fileUrl: string;
}

const PDFViewerWithErrorHandling: React.FC<PDFViewerWithErrorHandlingProps> = ({ fileUrl }) => {
  const [hasError, setHasError] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    // Listen for PDF.js errors
    const handleError = (event: ErrorEvent) => {
      // Check if the error is related to PDF loading
      if (event.message && (
        event.message.includes('Unexpected server response') ||
        event.message.includes('Failed to fetch') ||
        event.message.includes('404') ||
        event.message.includes('400')
      )) {
        setHasError(true);
        if (event.message.includes('400') || event.message.includes('404')) {
          setErrorMessage('The file was not found in storage. It may have been deleted or the path is incorrect.');
        } else {
          setErrorMessage('Unable to load the PDF file. Please check your connection or upload a new letterhead.');
        }
      }
    };

    window.addEventListener('error', handleError);
    
    // Also check via fetch as a backup
    if (fileUrl && fileUrl.startsWith('https://')) {
      fetch(fileUrl, { method: 'HEAD' })
        .then(response => {
          if (!response.ok) {
            setHasError(true);
            if (response.status === 400 || response.status === 404) {
              setErrorMessage('The file was not found in storage. It may have been deleted.');
            }
          }
        })
        .catch(() => {
          // Ignore fetch errors - let PDF.js try to load it
        });
    }

    return () => {
      window.removeEventListener('error', handleError);
    };
  }, [fileUrl]);

  if (hasError) {
    return (
      <div className="flex items-center justify-center h-full min-h-[600px]">
        <div className="text-center p-8">
          <svg className="w-16 h-16 text-red-500 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <h3 className="text-lg font-semibold text-gray-800 mb-2">PDF Not Found</h3>
          <p className="text-gray-600 mb-4">
            {errorMessage || "The letterhead file could not be loaded. It may have been deleted or moved."}
          </p>
          <p className="text-sm text-gray-500">
            Please upload a new letterhead file using the "Upload PDF" button in edit mode.
          </p>
        </div>
      </div>
    );
  }

  // Let PDF.js try to load it - it will handle errors gracefully
  return <PDFViewer fileUrl={fileUrl} />;
};

export default PDFViewerWithErrorHandling;

