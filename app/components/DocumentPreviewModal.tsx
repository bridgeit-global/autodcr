"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { motion, AnimatePresence } from "framer-motion";
import { createPortal } from "react-dom";
import CustomSelect from "@/app/components/CustomSelect";

const PlainPDFViewer = dynamic(() => import("./PlainPDFViewer"), {
  ssr: false,
}) as React.ComponentType<{ fileUrl: string }>;

type DocumentPreviewModalProps = {
  open: boolean;
  onClose: () => void;
  fileUrl: string | null;
  title?: string;
};

type DscStatus = {
  connected?: boolean;
  message?: string;
};

type DscCertificate = {
  slotIndex: number;
  certIndex: number;
  cn?: string;
  label?: string;
};

type DscCertificatesResponse = {
  success?: boolean;
  certificates?: DscCertificate[];
  error?: string;
};

export default function DocumentPreviewModal({ open, onClose, fileUrl, title }: DocumentPreviewModalProps) {
  const DEFAULT_BOX_WIDTH = 200;
  const DEFAULT_BOX_HEIGHT = 90;

  const [dscLoading, setDscLoading] = useState(false);
  const [dscStatus, setDscStatus] = useState<DscStatus | null>(null);
  const [dscCertificates, setDscCertificates] = useState<DscCertificate[]>([]);
  const [selectedDsc, setSelectedDsc] = useState<{ slotIndex: number; certIndex: number } | null>(null);
  const [dscPin, setDscPin] = useState("");
  const [dscError, setDscError] = useState<string | null>(null);
  const [isSigning, setIsSigning] = useState(false);
  const [selectionRect, setSelectionRect] = useState<{
    left: number;
    top: number;
    width: number;
    height: number;
  } | null>(null);
  const [selectionPdfRect, setSelectionPdfRect] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
    pageIndex: number;
  } | null>(null);
  const pdfViewerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (open) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "auto";
    return () => {
      document.body.style.overflow = "auto";
    };
  }, [open]);

  const updatePdfRectFromSelection = useCallback((
    sel: { left: number; top: number; width: number; height: number },
    pageRect: DOMRect,
    containerRect: DOMRect,
    pageIndex: number
  ) => {
    const pdfWidth = 612;
    const pdfHeight = 792;
    const scaleX = pdfWidth / pageRect.width;
    const scaleY = pdfHeight / pageRect.height;

    const pageOffsetLeft = pageRect.left - containerRect.left;
    const pageOffsetTop = pageRect.top - containerRect.top;
    const relativeLeft = sel.left - pageOffsetLeft;
    const relativeTop = sel.top - pageOffsetTop;

    const sigWidth = sel.width * scaleX;
    const sigHeight = sel.height * scaleY;
    const centerX = relativeLeft + sel.width / 2;
    const centerY = relativeTop + sel.height / 2;

    const pdfX = centerX * scaleX - sigWidth / 2;
    const pdfY = pdfHeight - centerY * scaleY - sigHeight / 2;

    setSelectionPdfRect({
      x: pdfX,
      y: pdfY,
      width: sigWidth,
      height: sigHeight,
      pageIndex,
    });
  }, []);

  useEffect(() => {
    if (!open || !fileUrl) return;
    const loadDscInfo = async () => {
      setDscLoading(true);
      setDscError(null);
      setSelectionRect(null);
      setSelectionPdfRect(null);
      try {
        const [statusRes, certsRes] = await Promise.all([
          fetch("/api/dsc/status"),
          fetch("/api/dsc/certificates"),
        ]);
        const statusData = (await statusRes.json()) as DscStatus;
        setDscStatus(statusData);

        const certsData = (await certsRes.json()) as DscCertificatesResponse;
        if (certsData.success && (certsData.certificates || []).length > 0) {
          setDscCertificates(certsData.certificates || []);
          setSelectedDsc(null);
        } else {
          setDscCertificates([]);
          setSelectedDsc(null);
          if (!certsData.success) {
            setDscError(certsData.error || "Failed to load DSC certificates.");
          }
        }
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Failed to load DSC information.";
        setDscError(message);
      } finally {
        setDscLoading(false);
      }
    };

    void loadDscInfo();
  }, [open, fileUrl]);

  useEffect(() => {
    if (!open || !fileUrl) return;

    let attempts = 0;
    const maxAttempts = 28;
    const timer = window.setInterval(() => {
      attempts += 1;
      if (!pdfViewerRef.current) {
        if (attempts >= maxAttempts) window.clearInterval(timer);
        return;
      }
      const containerRect = pdfViewerRef.current.getBoundingClientRect();
      const pageLayers = Array.from(
        pdfViewerRef.current.querySelectorAll(".rpv-core__page-layer")
      ) as HTMLElement[];
      if (pageLayers.length === 0) {
        if (attempts >= maxAttempts) window.clearInterval(timer);
        return;
      }

      const textNodes = Array.from(
        pdfViewerRef.current?.querySelectorAll(".rpv-core__text-layer-text") || []
      ) as HTMLElement[];
      const designatedPartnerNode = textNodes.find(
        (node) => (node.textContent || "").trim().toLowerCase() === "designated partner"
      );

      const fallbackPageLayer = pageLayers[1] || pageLayers[0];
      const designatedPageLayer = designatedPartnerNode
        ? (designatedPartnerNode.closest(".rpv-core__page-layer") as HTMLElement | null)
        : null;
      const targetPageLayer = designatedPageLayer || fallbackPageLayer;
      const pageIndex = Math.max(0, pageLayers.indexOf(targetPageLayer));
      const pageRect = targetPageLayer.getBoundingClientRect();
      const pageOffsetLeft = pageRect.left - containerRect.left;
      const pageOffsetTop = pageRect.top - containerRect.top;
      const boxWidthPx = Math.min(DEFAULT_BOX_WIDTH, pageRect.width * 0.9);
      const boxHeightPx = Math.min(DEFAULT_BOX_HEIGHT, pageRect.height * 0.6);

      let left = pageOffsetLeft + pageRect.width * 0.1059;
      let top = pageOffsetTop + pageRect.height * 0.278 - boxHeightPx - 8;

      if (designatedPartnerNode && designatedPageLayer === targetPageLayer) {
        const textRect = designatedPartnerNode.getBoundingClientRect();
        const textLeft = textRect.left - containerRect.left;
        const textTop = textRect.top - containerRect.top;
        const textWidth = textRect.width;
        // Keep entire signature stamp clear of the "Designated Partner" line:
        // place the stamp to the right of the text and a bit higher.
        left = textLeft + textWidth + 24;
        top = textTop - boxHeightPx - 44;
      }

      left = Math.max(
        pageOffsetLeft,
        Math.min(left, pageOffsetLeft + pageRect.width - boxWidthPx)
      );
      top = Math.max(
        pageOffsetTop,
        Math.min(top, pageOffsetTop + pageRect.height - boxHeightPx)
      );

      const sel = { left, top, width: boxWidthPx, height: boxHeightPx };
      setSelectionRect(sel);
      updatePdfRectFromSelection(sel, pageRect, containerRect, pageIndex);

      if (designatedPartnerNode || attempts >= maxAttempts) {
        window.clearInterval(timer);
      }
    }, 250);

    return () => {
      window.clearInterval(timer);
    };
  }, [open, fileUrl, updatePdfRectFromSelection]);

  const triggerDownload = (url: string) => {
    const link = document.createElement("a");
    link.href = url;
    link.download = "";
    link.target = "_blank";
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  const handleSignWithDsc = async () => {
    if (!fileUrl) {
      setDscError("Preview URL is missing.");
      return;
    }
    if (!dscStatus?.connected) {
      setDscError("DSC token is not connected.");
      return;
    }
    if (!selectedDsc) {
      setDscError("Please select a DSC certificate.");
      return;
    }
    if (!dscPin) {
      setDscError("Please enter DSC PIN.");
      return;
    }

    try {
      setIsSigning(true);
      setDscError(null);
      const pdfResponse = await fetch(fileUrl);
      const pdfBlob = await pdfResponse.blob();
      const pdfFile = new File([pdfBlob], "application-preview.pdf", { type: "application/pdf" });
      const formData = new FormData();
      formData.append("pdf", pdfFile);
      formData.append("pin", dscPin);
      formData.append("certificateIndex", selectedDsc.certIndex.toString());
      formData.append("slotIndex", selectedDsc.slotIndex.toString());

      const targetRect = selectionPdfRect || {
        x: 342,
        y: 180,
        width: 230,
        height: 90,
        pageIndex: 0,
      };
      formData.append("x", targetRect.x.toString());
      formData.append("y", targetRect.y.toString());
      formData.append("width", targetRect.width.toString());
      formData.append("height", targetRect.height.toString());
      formData.append("pageIndex", targetRect.pageIndex.toString());

      const res = await fetch("/api/dsc/sign-pdf", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok || !data.success || !data.signedUrl) {
        setDscError(data.error || data.details || "Failed to sign PDF.");
        return;
      }

      triggerDownload(data.signedUrl);
      setDscPin("");
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Error while signing PDF.";
      setDscError(message);
    } finally {
      setIsSigning(false);
    }
  };

  if (!open || !fileUrl) return null;
  if (typeof window === "undefined") return null;

  const modalContent = (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[9999] flex justify-center items-start bg-black/50 backdrop-blur-sm p-4 pt-10"
          onClick={onClose}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            className="bg-white w-full max-w-5xl rounded-2xl shadow-2xl relative max-h-[90vh] flex flex-col overflow-hidden border border-gray-200"
            onClick={(e) => e.stopPropagation()}
            initial={{ y: -20, opacity: 0, scale: 0.98 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: -20, opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.2 }}
          >
            {/* Clean top bar (no big header box) */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200 bg-white">
              <div className="text-sm font-semibold text-gray-900 truncate">{title || "Document Preview"}</div>
              <button
                onClick={onClose}
                className="h-9 w-9 rounded-lg hover:bg-gray-100 text-gray-700 transition-colors flex items-center justify-center"
                aria-label="Close preview"
                type="button"
              >
                <span className="text-2xl leading-none">×</span>
              </button>
            </div>

            <div className="flex-1 overflow-auto p-4 bg-gray-50">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 h-full min-h-[620px]">
                <div className="rounded-xl bg-white border border-gray-200 p-4 space-y-3 lg:col-span-1">
                  <h4 className="text-sm font-semibold text-gray-900">Digital Signature (DSC)</h4>
                  <p className="text-xs text-gray-600">
                    Signature box is auto-positioned above &quot;Designated Partner&quot; in the preview.
                  </p>

                  {dscLoading ? (
                    <p className="text-sm text-gray-600">Loading DSC information...</p>
                  ) : (
                    <>
                      {dscStatus && (
                        <div
                          className={`rounded-lg px-3 py-2 text-sm border ${
                            dscStatus.connected
                              ? "bg-emerald-50 border-emerald-200 text-emerald-900"
                              : "bg-red-50 border-red-200 text-red-900"
                          }`}
                        >
                          <p className="font-semibold">
                            Status: {dscStatus.connected ? "Connected" : "Not connected"}
                          </p>
                          <p>{dscStatus.message}</p>
                        </div>
                      )}

                      <div className="space-y-1">
                        <label className="text-sm font-medium text-gray-700">Select DSC Certificate</label>
                        <CustomSelect
                          value={selectedDsc ? `${selectedDsc.slotIndex}-${selectedDsc.certIndex}` : ""}
                          onChange={(val) => {
                            if (!val) {
                              setSelectedDsc(null);
                              return;
                            }
                            const [slotIdx, certIdx] = val.split("-").map(Number);
                            setSelectedDsc({ slotIndex: slotIdx, certIndex: certIdx });
                          }}
                          options={dscCertificates.map((cert) => ({
                            value: `${cert.slotIndex}-${cert.certIndex}`,
                            label: cert.cn || cert.label || `Certificate ${cert.certIndex + 1}`,
                          }))}
                          placeholder="-- Select DSC Certificate --"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-sm font-medium text-gray-700">DSC PIN</label>
                        <input
                          type="password"
                          value={dscPin}
                          onChange={(e) => setDscPin(e.target.value)}
                          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-black focus:outline-none focus:ring-2 focus:ring-emerald-500"
                          placeholder="Enter DSC PIN"
                        />
                      </div>

                      {dscError && (
                        <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-900">
                          {dscError}
                        </div>
                      )}

                      <button
                        type="button"
                        onClick={handleSignWithDsc}
                        disabled={isSigning || !dscStatus?.connected || !selectedDsc || !dscPin}
                        className="w-full rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:bg-emerald-300"
                      >
                        {isSigning ? "Signing..." : "Sign and Download"}
                      </button>
                    </>
                  )}
                </div>

                <div className="rounded-xl bg-white border border-gray-200 overflow-hidden lg:col-span-2">
                  <div
                    ref={pdfViewerRef}
                    className="relative h-full"
                    style={{ minHeight: "600px" }}
                  >
                    <PlainPDFViewer fileUrl={fileUrl} />
                    {selectionRect && (
                      <div
                        className="absolute border-2 border-emerald-500 bg-emerald-500/10 pointer-events-none"
                        style={{
                          left: selectionRect.left,
                          top: selectionRect.top,
                          width: selectionRect.width,
                          height: selectionRect.height,
                        }}
                      />
                    )}
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  return createPortal(modalContent, document.body);
}


