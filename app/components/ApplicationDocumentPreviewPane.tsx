"use client";

import { useRef } from "react";
import dynamic from "next/dynamic";
import { useHtmlPreviewFrame } from "@/app/components/useHtmlPreviewFrame";

const ApplicationStoredPdfViewer = dynamic(() => import("./ApplicationStoredPdfViewer"), {
  ssr: false,
}) as React.ComponentType<{ fileUrl: string }>;

const IMAGE_URL_PATTERN = /\.(png|jpe?g|webp|gif|bmp)(\?|#|$)/i;

type ApplicationDocumentPreviewPaneProps = {
  title?: string;
  htmlContent?: string | null;
  fileUrl?: string | null;
  isLoading?: boolean;
  loadError?: string | null;
  notice?: string | null;
};

export default function ApplicationDocumentPreviewPane({
  title,
  htmlContent,
  fileUrl,
  isLoading = false,
  loadError = null,
  notice = null,
}: ApplicationDocumentPreviewPaneProps) {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const showHtml = Boolean(htmlContent) && !fileUrl;
  useHtmlPreviewFrame(iframeRef, htmlContent, showHtml);

  const hasContent = Boolean(fileUrl) || Boolean(htmlContent);
  const isImagePreview = Boolean(fileUrl) && IMAGE_URL_PATTERN.test(fileUrl ?? "");

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-xl border border-gray-200 bg-gray-50">
      <div className="shrink-0 border-b border-gray-200 bg-white px-4 py-2.5">
        <h3 className="text-sm font-semibold text-gray-900">Document preview</h3>
        {title ? <p className="mt-0.5 truncate text-xs text-gray-500">{title}</p> : null}
      </div>
      <div className="relative min-h-0 flex-1 overflow-auto">
        {isLoading && !hasContent ? (
          <div className="flex h-full min-h-48 items-center justify-center text-sm text-gray-500">
            Loading preview…
          </div>
        ) : loadError && !hasContent ? (
          <div className="flex h-full min-h-48 items-center justify-center px-6 text-center text-sm text-status-danger">
            {loadError}
          </div>
        ) : notice && !hasContent ? (
          <div className="flex h-full min-h-48 items-center justify-center px-6 text-center text-sm text-gray-500">
            {notice}
          </div>
        ) : showHtml ? (
          <iframe
            ref={iframeRef}
            title={title || "Document preview"}
            src="about:blank"
            className="block h-full min-h-[32rem] w-full border-0 bg-white"
          />
        ) : fileUrl && isImagePreview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={fileUrl}
            alt={title || "Document preview"}
            className="block h-auto w-full bg-white"
          />
        ) : fileUrl ? (
          <ApplicationStoredPdfViewer fileUrl={fileUrl} />
        ) : (
          <div className="flex h-full min-h-48 items-center justify-center px-6 text-center text-sm text-gray-500">
            Preview will appear here.
          </div>
        )}
        {isLoading && hasContent ? (
          <div className="pointer-events-none absolute right-3 top-3 rounded-full bg-white/95 px-2.5 py-1 text-xs font-medium text-gray-600 shadow-sm ring-1 ring-gray-200">
            Updating…
          </div>
        ) : null}
        {loadError && hasContent ? (
          <p className="absolute inset-x-0 bottom-0 bg-white/95 px-3 py-2 text-sm text-status-danger">
            {loadError}
          </p>
        ) : null}
      </div>
    </div>
  );
}
