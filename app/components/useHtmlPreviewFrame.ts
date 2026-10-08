"use client";

import { useLayoutEffect, useRef, type RefObject } from "react";

/**
 * Loads letter HTML into an iframe via a blob URL.
 * Blob navigation gives a real Window on contentDocument.defaultView
 * (srcDoc / document.write break html2canvas in some browsers).
 */
export function useHtmlPreviewFrame(
  iframeRef: RefObject<HTMLIFrameElement | null>,
  htmlContent: string | null | undefined,
  enabled: boolean
) {
  const previewBlobUrlRef = useRef<string | null>(null);

  useLayoutEffect(() => {
    if (!enabled || !htmlContent) {
      if (previewBlobUrlRef.current) {
        URL.revokeObjectURL(previewBlobUrlRef.current);
        previewBlobUrlRef.current = null;
      }
      if (iframeRef.current) {
        iframeRef.current.src = "about:blank";
      }
      return;
    }

    const frame = iframeRef.current;
    if (!frame) return;

    if (previewBlobUrlRef.current) {
      URL.revokeObjectURL(previewBlobUrlRef.current);
      previewBlobUrlRef.current = null;
    }
    const url = URL.createObjectURL(
      new Blob([htmlContent], { type: "text/html;charset=utf-8" })
    );
    previewBlobUrlRef.current = url;
    frame.src = url;

    return () => {
      URL.revokeObjectURL(url);
      if (previewBlobUrlRef.current === url) {
        previewBlobUrlRef.current = null;
      }
    };
  }, [enabled, htmlContent, iframeRef]);
}
