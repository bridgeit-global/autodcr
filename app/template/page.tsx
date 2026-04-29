"use client";

import React, { useState, useEffect, Suspense, useRef } from "react";
import dynamic from "next/dynamic";
import { PDFDocument, StandardFonts } from "pdf-lib";
import DashboardHeader from "../components/DashboardHeader";
import SiteFooter from "../components/SiteFooter";
import CustomSelect from "@/app/components/CustomSelect";
import {
  TEMPLATE_CONFIG,
  TemplateFields,
  TemplateType,
} from "../templates/templateGenerators";

const BRIDGE_SOURCE = "AUTODCR_SIGN_BRIDGE";
const BRIDGE_VERSION = 1;
const BRIDGE_TIMEOUT_MS = 20000;
const MAX_SIGN_PDF_BASE64_SIZE = 8 * 1024 * 1024;

type BridgeCommand = "PING" | "LIST_CERTS" | "SIGN_PDF";

type BridgeError = {
  code?: string;
  message: string;
};

type BridgeRequest = {
  source: typeof BRIDGE_SOURCE;
  type: "REQUEST";
  requestId: string;
  cmd: BridgeCommand;
  payload: Record<string, unknown>;
};

type BridgeResponse = {
  source: typeof BRIDGE_SOURCE;
  type: "RESPONSE";
  requestId: string;
  ok: boolean;
  result?: unknown;
  error?: BridgeError | null;
};

type DscStatus = {
  connected: boolean;
  message: string;
};

type DscCertificate = {
  slotIndex: number;
  certIndex: number;
  cn?: string;
  label?: string;
};

type PendingBridgeRequest = {
  resolve: (response: BridgeResponse) => void;
  reject: (error: Error) => void;
  timeoutId: number;
};

const PlainPDFViewer = dynamic(() => import("../components/PlainPDFViewer"), {
  ssr: false,
}) as React.ComponentType<{ fileUrl: string }>;

const CopyIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
  </svg>
);

const CheckIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
  </svg>
);

// TemplateFields type is now imported from templateGenerators

const projects = [
  "Proposed redevelopment of existing building known as \"Naindwar CHS Ltd.\" under Reg. 33(7)(B) of DCPR-2034 on plot bearing C.T.S. No. 236 of Village - Kurla (2), at Kale Marg, Kurla(W), Mumbai in 'L' Ward. Proposed redevelopment on plot bearing C.T.S. Nos. 130, 130/1 to 7 of Village- Kurla (4) at 30.50 M. wide L.B.S. Marg, Kurla (W), Mumbai in 'L' Ward.",
  "PROPOSED REDEVELOPMENT OF RESIDENTIAL BUILDING ON PLOT BEARING C.T.S. NO. 128A/53/1 OF VILLAGE KANDIVALI AT MAHAVIR NAGAR, KANDIVALI (WEST), MUMBAI.",
  "Proposed 220kV GIS Sub-station along with LILO of 220kV TPC Salsette on plot bearing C.T.S. Nos. 38B, 38/5 to 15 (Sub-Plot \"B\"), Village- Tungwa, situated in Industrial (I) Zone, Off Saki Vihar Road, Muranjan Wadi, Marol, Andheri (East), Mumbai, in 'L' Ward.",
  "Proposed Layout on plot bearing C.T.S. Nos. 38B, 38/5 to 15 (Sub-Plot \"B\"), Village- Tungwa, situated in Industrial (I) Zone, Off Saki Vihar Road, Muranjan Wadi, Marol, Andheri (East), Mumbai, in 'L' Ward.",
  "Proposed redevelopment on plot bearing C.T.S. No. 135 of Village- Kurla (4) at L.B.S. Marg, Kurla (W), Mumbai in 'L' Ward.",
  "Proposed redevelopment on plot bearing C.T.S. No. 834, 835, 836/A & 836/B of Village- Kurla (2) situated at 13.40 M. wide New Hall Road, Kurla (W), Mumbai in 'L' Ward.",
  "Proposed redevelopment under reg. 33(7)(B) of D.C.&P.R.-2034 at 13.40 M. wide Fr. Peter Periera Marg, Kurla (W), Mumbai in 'L' Ward.",
  "Proposed redevelopment on plot bearing C.T.S. No. 848 & 848/1 of Village- Kurla (2) situated at 13.40 M. wide New Hall Road, Kurla (W), Mumbai in 'L' Ward.",
  "Proposed redevelopment on plot bearing C.T.S. No. 834, 835, 836/A & 836/B of Village- Kurla (2) situated at 13.40 M. wide New Hall Road, Kurla (W), Mumbai in 'L' Ward.",
];

const projectTemplateData: Record<number, TemplateFields> = {
  0: {
    CurrentDate: "",
    WardName: "L Ward",
    ZoneName: "W.S.-II",
    OfficeAddress: "123, Building Complex, Kurla West, Mumbai - 400070",
    CTSNo: "236",
    VillageName: "Kurla (2)",
    TalukaName: "Kurla",
    DistrictName: "Mumbai Suburban",
    RoadWidth: "30.50 M",
    RoadName: "L.B.S. Marg",
    MainRoadWidth: "30.50 M",
    MainRoadName: "L.B.S. Marg",
    ApplicantName: "M/s. Naindwar CHS Ltd.",
    FirmName: "Kurla Developers Pvt. Ltd.",
    ConsultantName: "Mr. Rajesh Kumar",
    ConsultantType: "Architect",
    CouncilRegNo: "CA/2015/45231",
    RegValidityDate: "Valid up to 31.12.2027",
  },
  1: {
    CurrentDate: "",
    WardName: "R/S Ward",
    ZoneName: "E.S.-I",
    OfficeAddress: "456, Mahavir Nagar, Kandivali West, Mumbai - 400067",
    CTSNo: "128A/53/1",
    VillageName: "Kandivali",
    TalukaName: "Borivali",
    DistrictName: "Mumbai Suburban",
    RoadWidth: "18.30 M",
    RoadName: "Mahavir Nagar Road",
    MainRoadWidth: "45.00 M",
    MainRoadName: "S.V. Road",
    ApplicantName: "M/s. Kandivali Housing Society",
    FirmName: "West Mumbai Builders",
    ConsultantName: "Mrs. Priya Sharma",
    ConsultantType: "Liaison Architect",
    CouncilRegNo: "CA/2018/67890",
    RegValidityDate: "Valid up to 31.12.2028",
  },
  2: {
    CurrentDate: "",
    WardName: "L Ward",
    ZoneName: "W.S.-II",
    OfficeAddress: "789, Industrial Estate, Andheri East, Mumbai - 400093",
    CTSNo: "38B, 38/5 to 15",
    VillageName: "Tungwa",
    TalukaName: "Andheri",
    DistrictName: "Mumbai Suburban",
    RoadWidth: "12.00 M",
    RoadName: "Saki Vihar Road",
    MainRoadWidth: "30.00 M",
    MainRoadName: "Saki Vihar Road",
    ApplicantName: "M/s. Adani Electricity Mumbai Ltd.",
    FirmName: "Power Infrastructure Solutions",
    ConsultantName: "Mr. Vikram Singh",
    ConsultantType: "Structural Engineer",
    CouncilRegNo: "CA/2020/78901",
    RegValidityDate: "Valid up to 31.12.2029",
  },
  3: {
    CurrentDate: "",
    WardName: "L Ward",
    ZoneName: "W.S.-II",
    OfficeAddress: "789, Industrial Estate, Andheri East, Mumbai - 400093",
    CTSNo: "38B, 38/5 to 15",
    VillageName: "Tungwa",
    TalukaName: "Andheri",
    DistrictName: "Mumbai Suburban",
    RoadWidth: "12.00 M",
    RoadName: "Saki Vihar Road",
    MainRoadWidth: "30.00 M",
    MainRoadName: "Saki Vihar Road",
    ApplicantName: "M/s. Industrial Developers",
    FirmName: "Marol Infrastructure Pvt. Ltd.",
    ConsultantName: "Mrs. Anjali Desai",
    ConsultantType: "PMC",
    CouncilRegNo: "CA/2019/56789",
    RegValidityDate: "Valid up to 31.12.2026",
  },
  4: {
    CurrentDate: "",
    WardName: "L Ward",
    ZoneName: "E.S.-I",
    OfficeAddress: "321, Kurla Complex, Kurla West, Mumbai - 400070",
    CTSNo: "135",
    VillageName: "Kurla (4)",
    TalukaName: "Kurla",
    DistrictName: "Mumbai Suburban",
    RoadWidth: "18.30 M",
    RoadName: "L.B.S. Marg",
    MainRoadWidth: "30.50 M",
    MainRoadName: "L.B.S. Marg",
    ApplicantName: "M/s. Kurla Redevelopment Co.",
    FirmName: "Dadamiya Infrastructure LLP",
    ConsultantName: "Mrs. Sana (N. Malik) Shaikh",
    ConsultantType: "Architect",
    CouncilRegNo: "CA/2010/50185",
    RegValidityDate: "Valid up to 31.12.2026",
  },
  5: {
    CurrentDate: "",
    WardName: "L Ward",
    ZoneName: "W.S.-II",
    OfficeAddress: "654, New Hall Road Area, Kurla West, Mumbai - 400070",
    CTSNo: "834, 835, 836/A & 836/B",
    VillageName: "Kurla (2)",
    TalukaName: "Kurla",
    DistrictName: "Mumbai Suburban",
    RoadWidth: "13.40 M",
    RoadName: "New Hall Road",
    MainRoadWidth: "18.30 M",
    MainRoadName: "Service Road",
    ApplicantName: "M/s. Hall Road Developers",
    FirmName: "Kurla Builders Association",
    ConsultantName: "Mr. Sameer Patel",
    ConsultantType: "Liaison Architect",
    CouncilRegNo: "CA/2017/34567",
    RegValidityDate: "Valid up to 31.12.2027",
  },
  6: {
    CurrentDate: "",
    WardName: "L Ward",
    ZoneName: "E.S.-I",
    OfficeAddress: "987, Fr. Peter Periera Marg, Kurla West, Mumbai - 400070",
    CTSNo: "Multiple",
    VillageName: "Kurla (2)",
    TalukaName: "Kurla",
    DistrictName: "Mumbai Suburban",
    RoadWidth: "13.40 M",
    RoadName: "Fr. Peter Periera Marg",
    MainRoadWidth: "30.50 M",
    MainRoadName: "L.B.S. Marg",
    ApplicantName: "M/s. Periera Road Society",
    FirmName: "Kurla Redevelopment Group",
    ConsultantName: "Mr. Ajay Mehta",
    ConsultantType: "Structural Engineer",
    CouncilRegNo: "CA/2016/23456",
    RegValidityDate: "Valid up to 31.12.2028",
  },
  7: {
    CurrentDate: "",
    WardName: "L Ward",
    ZoneName: "W.S.-II",
    OfficeAddress: "147, New Hall Road Area, Kurla West, Mumbai - 400070",
    CTSNo: "848 & 848/1",
    VillageName: "Kurla (2)",
    TalukaName: "Kurla",
    DistrictName: "Mumbai Suburban",
    RoadWidth: "13.40 M",
    RoadName: "New Hall Road",
    MainRoadWidth: "18.30 M",
    MainRoadName: "Service Road",
    ApplicantName: "M/s. Hall Road Properties",
    FirmName: "New Hall Developers",
    ConsultantName: "Mrs. Kavita Shah",
    ConsultantType: "PMC",
    CouncilRegNo: "CA/2014/12345",
    RegValidityDate: "Valid up to 31.12.2026",
  },
  8: {
    CurrentDate: "",
    WardName: "L Ward",
    ZoneName: "W.S.-II",
    OfficeAddress: "258, New Hall Road Area, Kurla West, Mumbai - 400070",
    CTSNo: "834, 835, 836/A & 836/B",
    VillageName: "Kurla (2)",
    TalukaName: "Kurla",
    DistrictName: "Mumbai Suburban",
    RoadWidth: "13.40 M",
    RoadName: "New Hall Road",
    MainRoadWidth: "18.30 M",
    MainRoadName: "Service Road",
    ApplicantName: "M/s. Hall Road Complex",
    FirmName: "Kurla Infrastructure Ltd.",
    ConsultantName: "Mr. Ramesh Iyer",
    ConsultantType: "Architect",
    CouncilRegNo: "CA/2013/98765",
    RegValidityDate: "Valid up to 31.12.2027",
  },
};

const getCurrentDate = () => {
  const today = new Date();
  const day = String(today.getDate()).padStart(2, "0");
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const year = today.getFullYear();
  return `${day}/${month}/${year}`;
};

export default function TemplatePage() {
  const [sessionTime, setSessionTime] = useState(3600);
  const [selectedProject, setSelectedProject] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateType | "">("");
  const [templateFields, setTemplateFields] = useState<TemplateFields | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [generatedPdfUrl, setGeneratedPdfUrl] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [letterheadBytes, setLetterheadBytes] = useState<ArrayBuffer | null>(null);
  const [letterheadError, setLetterheadError] = useState<string | null>(null);
  const [isDscModalOpen, setIsDscModalOpen] = useState(false);
  const [dscStatus, setDscStatus] = useState<DscStatus | null>(null);
  const [dscCertificates, setDscCertificates] = useState<DscCertificate[]>([]);
  const [selectedDsc, setSelectedDsc] = useState<{ slotIndex: number; certIndex: number } | null>(null);
  const [dscPin, setDscPin] = useState("");
  const [dscError, setDscError] = useState<string | null>(null);
  const [dscLoading, setDscLoading] = useState(false);
  const [isPingingConnector, setIsPingingConnector] = useState(false);
  const [connectorPingMessage, setConnectorPingMessage] = useState<string | null>(null);
  const [isSelectingArea, setIsSelectingArea] = useState(false);
  const [isSigning, setIsSigning] = useState(false);
  const pdfViewerRef = useRef<HTMLDivElement | null>(null);
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
  const [isDragging, setIsDragging] = useState(false);
  const dragOffsetRef = useRef<{ offsetX: number; offsetY: number } | null>(null);
  const pendingBridgeRequestsRef = useRef<Map<string, PendingBridgeRequest>>(new Map());

  useEffect(() => {
    const interval = setInterval(() => {
      setSessionTime((prev) => {
        if (prev <= 0) return 0;
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const loadLetterhead = async () => {
      try {
        const response = await fetch("/letterhead.pdf");
        if (!response.ok) {
          throw new Error(`Failed to load letterhead template (${response.status})`);
        }
        const buffer = await response.arrayBuffer();
        setLetterheadBytes(buffer);
        setLetterheadError(null);
      } catch (error) {
        console.error("Error loading letterhead template:", error);
        setLetterheadBytes(null);
        setLetterheadError("Unable to load letterhead template. Generated PDFs will use a blank page.");
      }
    };

    loadLetterhead();
  }, []);

  useEffect(() => {
    if (selectedProject) {
      const projectIndex = projects.indexOf(selectedProject);
      if (projectIndex !== -1 && projectTemplateData[projectIndex]) {
        const fields = { ...projectTemplateData[projectIndex] };
        fields.CurrentDate = getCurrentDate();
        setTemplateFields(fields);
        // Auto-generate PDF when project and template are both selected
        if (selectedTemplate) {
          generatePDF(fields);
        }
      } else {
        setTemplateFields(null);
        setGeneratedPdfUrl(null);
      }
    } else {
      setTemplateFields(null);
      setGeneratedPdfUrl(null);
    }
  }, [selectedProject, selectedTemplate]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const copyToClipboard = async (text: string, fieldName: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(fieldName);
      setTimeout(() => setCopiedField(null), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  useEffect(() => {
    const pendingRequests = pendingBridgeRequestsRef.current;

    const handleBridgeResponse = (event: MessageEvent) => {
      if (event.source !== window) return;
      if (event.origin !== window.location.origin) return;
      const data = event.data as BridgeResponse | undefined;
      if (!data || data.source !== BRIDGE_SOURCE || data.type !== "RESPONSE") return;
      if (!data.requestId) return;

      const pending = pendingRequests.get(data.requestId);
      if (!pending) return;

      window.clearTimeout(pending.timeoutId);
      pendingRequests.delete(data.requestId);
      pending.resolve(data);
    };

    window.addEventListener("message", handleBridgeResponse);

    return () => {
      window.removeEventListener("message", handleBridgeResponse);
      pendingRequests.forEach((pending) => {
        window.clearTimeout(pending.timeoutId);
        pending.reject(new Error("Bridge request cancelled."));
      });
      pendingRequests.clear();
    };
  }, []);

  const sendBridgeRequest = async (
    cmd: BridgeCommand,
    payload: Record<string, unknown> = {}
  ): Promise<unknown> => {
    const requestId = crypto.randomUUID();

    const response = await new Promise<BridgeResponse>((resolve, reject) => {
      const timeoutId = window.setTimeout(() => {
        pendingBridgeRequestsRef.current.delete(requestId);
        reject(
          new Error(
            "Connector did not respond in time. Ensure the extension and native host are installed and running."
          )
        );
      }, BRIDGE_TIMEOUT_MS);

      pendingBridgeRequestsRef.current.set(requestId, { resolve, reject, timeoutId });

      const request: BridgeRequest = {
        source: BRIDGE_SOURCE,
        type: "REQUEST",
        requestId,
        cmd,
        payload,
      };

      window.postMessage(request, window.location.origin);
    });

    if (!response.ok) {
      const message = response.error?.message || "Connector request failed.";
      throw new Error(message);
    }

    return response.result;
  };

  const blobToBase64 = (blob: Blob): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const dataUrl = reader.result;
        if (typeof dataUrl !== "string") {
          reject(new Error("Unable to encode PDF payload."));
          return;
        }
        const [, base64 = ""] = dataUrl.split(",");
        resolve(base64);
      };
      reader.onerror = () => reject(new Error("Failed to read PDF data."));
      reader.readAsDataURL(blob);
    });

  const base64ToBlob = (base64: string, mimeType: string): Blob => {
    const byteChars = atob(base64);
    const byteNumbers = new Array(byteChars.length);
    for (let i = 0; i < byteChars.length; i += 1) {
      byteNumbers[i] = byteChars.charCodeAt(i);
    }
    return new Blob([new Uint8Array(byteNumbers)], { type: mimeType });
  };

  const FieldCard = ({ label, value, fieldName }: { label: string; value: string; fieldName: string }) => (
    <div className="group relative flex flex-col gap-1.5 bg-white rounded-lg border border-gray-200 p-3 hover:border-blue-300 hover:shadow-md transition-all">
      <div className="flex items-center justify-between">
        <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">{label}</label>
        <button
          onClick={() => copyToClipboard(value, fieldName)}
          className="opacity-0 group-hover:opacity-100 p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-all"
          title="Copy to clipboard"
        >
          {copiedField === fieldName ? (
            <span className="text-green-600"><CheckIcon /></span>
          ) : (
            <CopyIcon />
          )}
        </button>
      </div>
      <div className="text-sm font-medium text-gray-900 break-words">{value || "-"}</div>
    </div>
  );

  const openDscModal = async () => {
    if (!generatedPdfUrl) {
      alert("Please generate the PDF first.");
      return;
    }
    setIsDscModalOpen(true);
    setDscError(null);
    setDscLoading(true);
    setIsSelectingArea(false);
    setSelectionRect(null);
    setSelectionPdfRect(null);
    try {
      const [pingResult, certsResult] = await Promise.all([
        sendBridgeRequest("PING"),
        sendBridgeRequest("LIST_CERTS"),
      ]);

      const pingMessage =
        typeof (pingResult as { hostVersion?: string })?.hostVersion === "string"
          ? `Connected (Host ${(pingResult as { hostVersion: string }).hostVersion})`
          : "Connected to extension and native host.";
      setDscStatus({ connected: true, message: pingMessage });

      const certs =
        (certsResult as { certificates?: DscCertificate[] })?.certificates ||
        ((Array.isArray(certsResult) ? certsResult : []) as DscCertificate[]);
      if (certs.length > 0) {
        setDscCertificates(certs);
        setSelectedDsc(null);
      } else {
        setDscCertificates([]);
        setSelectedDsc(null);
        setDscError("No DSC certificates were returned by the connector.");
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to load connector info.";
      console.error("Failed to load connector info:", error);
      setDscStatus({
        connected: false,
        message: "Connector unavailable",
      });
      setDscCertificates([]);
      setSelectedDsc(null);
      setDscError(
        message ||
          "Unable to reach extension connector. Install the connector extension and native host, then retry."
      );
    } finally {
      setDscLoading(false);
    }
  };

  const checkConnectorHealth = async () => {
    setIsPingingConnector(true);
    setConnectorPingMessage(null);

    try {
      const pingResult = (await sendBridgeRequest("PING", {
        v: BRIDGE_VERSION,
      })) as { hostVersion?: string; tokenPresent?: boolean };

      const hostVersion =
        typeof pingResult?.hostVersion === "string" ? pingResult.hostVersion : "unknown";
      const tokenHint =
        typeof pingResult?.tokenPresent === "boolean"
          ? pingResult.tokenPresent
            ? "Token detected."
            : "Token not detected."
          : "";

      setDscStatus({
        connected: true,
        message: `Connected (Host ${hostVersion})${tokenHint ? ` ${tokenHint}` : ""}`,
      });
      setConnectorPingMessage(
        `Connector is reachable.${tokenHint ? ` ${tokenHint}` : ""}`
      );
    } catch (error: unknown) {
      const message =
        error instanceof Error
          ? error.message
          : "Connector check failed. Install extension/native host and retry.";
      setDscStatus({
        connected: false,
        message: "Connector unavailable",
      });
      setConnectorPingMessage(message);
    } finally {
      setIsPingingConnector(false);
    }
  };

  const signWithDsc = async (rect?: { x: number; y: number; width: number; height: number; pageIndex: number }) => {
    if (!generatedPdfUrl) {
      setDscError("Please generate the PDF first.");
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

      const pdfResponse = await fetch(generatedPdfUrl);
      const pdfBlob = await pdfResponse.blob();
      const pdfFile = new File([pdfBlob], "generated.pdf", { type: "application/pdf" });
      const defaultWidth = 230;
      const defaultHeight = 90;
      // Keep signature after "For ... LLP" and before "Designated Partner".
      const marginBottom = 78;

      const targetRect = rect ?? {
        // Left-aligned between company name and designation lines.
        x: 65,
        y: marginBottom,
        width: defaultWidth,
        height: defaultHeight,
        pageIndex: 0,
      };

      const pdfBase64 = await blobToBase64(pdfFile);
      if (pdfBase64.length > MAX_SIGN_PDF_BASE64_SIZE) {
        setDscError("PDF is too large for connector transport. Please reduce size and retry.");
        return;
      }

      const result = (await sendBridgeRequest("SIGN_PDF", {
        v: BRIDGE_VERSION,
        certificateIndex: selectedDsc.certIndex,
        slotIndex: selectedDsc.slotIndex,
        pin: dscPin,
        pdfBase64,
        signatureRect: targetRect,
      })) as { signedPdfBase64?: string; signedPdf?: string };

      const signedPdfBase64 = result.signedPdfBase64 || result.signedPdf;
      if (!signedPdfBase64) {
        setDscError("Connector response did not include signed PDF data.");
        return;
      }

      const signedPdfBlob = base64ToBlob(signedPdfBase64, "application/pdf");
      const signedPdfUrl = URL.createObjectURL(signedPdfBlob);
      if (generatedPdfUrl.startsWith("blob:")) {
        URL.revokeObjectURL(generatedPdfUrl);
      }
      setGeneratedPdfUrl(signedPdfUrl);
      setIsDscModalOpen(false);
      setIsSelectingArea(false);
      setSelectionRect(null);
      setSelectionPdfRect(null);
      setDscPin("");
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Error while signing PDF.";
      console.error("Error signing PDF:", error);
      setDscError(
        message ||
          "Failed to sign via connector. Ensure extension/native host are active and retry."
      );
    } finally {
      setIsSigning(false);
    }
  };

  const updatePdfRectFromSelection = (containerRect: DOMRect, sel: { left: number; top: number; width: number; height: number }) => {
    const pdfWidth = 612;
    const pdfHeight = 792;
    const scaleX = pdfWidth / containerRect.width;
    const scaleY = pdfHeight / containerRect.height;

    const sigWidth = sel.width * scaleX;
    const sigHeight = sel.height * scaleY;

    const centerX = sel.left + sel.width / 2;
    const centerY = sel.top + sel.height / 2;

    const pdfX = centerX * scaleX - sigWidth / 2;
    const pdfY = pdfHeight - centerY * scaleY - sigHeight / 2;

    setSelectionPdfRect({
      x: pdfX,
      y: pdfY,
      width: sigWidth,
      height: sigHeight,
      pageIndex: 0,
    });
  };

  const handlePdfClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!isSelectingArea || !pdfViewerRef.current) return;

    const rect = pdfViewerRef.current.getBoundingClientRect();
    const clickX = event.clientX - rect.left;
    const clickY = event.clientY - rect.top;

    // If no block yet, create a fixed-size block centered at click
    if (!selectionRect) {
      const boxWidthPx = Math.min(220, rect.width * 0.6);
      const boxHeightPx = 90;
      const left = Math.max(0, Math.min(clickX - boxWidthPx / 2, rect.width - boxWidthPx));
      const top = Math.max(0, Math.min(clickY - boxHeightPx / 2, rect.height - boxHeightPx));

      const sel = {
        left,
        top,
        width: boxWidthPx,
        height: boxHeightPx,
      };
      setSelectionRect(sel);
      updatePdfRectFromSelection(rect, sel);
    }
  };

  const handlePdfMouseDown = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!selectionRect || !pdfViewerRef.current) return;

    const rect = pdfViewerRef.current.getBoundingClientRect();
    const clickX = event.clientX - rect.left;
    const clickY = event.clientY - rect.top;

    const withinX = clickX >= selectionRect.left && clickX <= selectionRect.left + selectionRect.width;
    const withinY = clickY >= selectionRect.top && clickY <= selectionRect.top + selectionRect.height;

    if (withinX && withinY) {
      setIsDragging(true);
      dragOffsetRef.current = {
        offsetX: clickX - selectionRect.left,
        offsetY: clickY - selectionRect.top,
      };
      event.preventDefault();
    }
  };

  const handlePdfMouseMove = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!isDragging || !pdfViewerRef.current || !selectionRect || !dragOffsetRef.current) return;

    const rect = pdfViewerRef.current.getBoundingClientRect();
    const pointerX = event.clientX - rect.left;
    const pointerY = event.clientY - rect.top;

    const newLeft = Math.max(
      0,
      Math.min(pointerX - dragOffsetRef.current.offsetX, rect.width - selectionRect.width)
    );
    const newTop = Math.max(
      0,
      Math.min(pointerY - dragOffsetRef.current.offsetY, rect.height - selectionRect.height)
    );

    const updatedSel = {
      ...selectionRect,
      left: newLeft,
      top: newTop,
    };
    setSelectionRect(updatedSel);
    updatePdfRectFromSelection(rect, updatedSel);
  };

  const handlePdfMouseUp = () => {
    if (isDragging) {
      setIsDragging(false);
      dragOffsetRef.current = null;
    }
  };

  const generatePDF = async (fields: TemplateFields) => {
    setIsGenerating(true);
    try {
      if (!letterheadBytes) {
        setIsGenerating(false);
        alert(letterheadError ?? "Letterhead template is still loading. Please try again in a moment.");
        return;
      }

      if (!selectedTemplate) {
        setIsGenerating(false);
        alert("Please select a template type first.");
        return;
      }

      const templateConfig = TEMPLATE_CONFIG[selectedTemplate];
      if (!templateConfig) {
        setIsGenerating(false);
        alert("Invalid template selected.");
        return;
      }

      const baseBytes = letterheadBytes.slice(0);
      const pdfDoc = await PDFDocument.load(baseBytes);
      const page = pdfDoc.getPages()[0] ?? pdfDoc.addPage([612, 792]);
      const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
      
      // Use the selected template generator
      await templateConfig.generator(pdfDoc, page, fields, font, boldFont);
      
      // Generate PDF bytes
      const pdfBytes = await pdfDoc.save();
      const uint8Array = new Uint8Array(pdfBytes);
      const blob = new Blob([uint8Array], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      
      // Clean up old URL
      if (generatedPdfUrl) {
        URL.revokeObjectURL(generatedPdfUrl);
      }
      
      setGeneratedPdfUrl(url);
    } catch (error) {
      console.error("Error generating PDF:", error);
      alert("Failed to generate PDF. Please try again.");
    } finally {
      setIsGenerating(false);
    }
  };

  useEffect(() => {
    return () => {
      if (generatedPdfUrl) {
        URL.revokeObjectURL(generatedPdfUrl);
      }
    };
  }, [generatedPdfUrl]);

  return (
    <div className="h-screen bg-gray-50 flex flex-col overflow-hidden">
      <Suspense fallback={<div className="h-16 bg-white border border-gray-200 rounded-3xl"></div>}>
        <DashboardHeader sessionTime={formatTime(sessionTime)} />
      </Suspense>

      <div className="flex-1 overflow-y-auto bg-gradient-to-br from-gray-50 via-blue-50/30 to-gray-50">
        <div className="max-w-[95rem] mx-auto px-6 pt-8 pb-12">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Column - Template Fields */}
          <div className="space-y-6">
            {/* Header Section */}
            <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-xl shadow-lg p-6 text-white">
              <h1 className="text-3xl font-bold mb-2">Template Generator</h1>
              <p className="text-blue-100">
                Select a project to generate template fields with pre-filled values
              </p>
            </div>

          {/* Project Selection Card */}
          <section className="bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden">
            <div className="bg-gradient-to-r from-gray-50 to-gray-100 border-b border-gray-200 px-6 py-4">
              <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Select Project
              </h2>
            </div>
            <div className="p-6">
              <div className="flex flex-col gap-2">
                <label htmlFor="project" className="text-sm font-semibold text-gray-700">
                  Choose a project from the list below
                </label>
                <CustomSelect
                  id="project"
                  value={selectedProject}
                  onChange={(val) => setSelectedProject(val)}
                  options={projects.map((project) => ({
                    value: project,
                    label: project.length > 100 ? `${project.substring(0, 100)}...` : project,
                  }))}
                  placeholder="-- Select a Project --"
                />
                {selectedProject && (
                  <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <p className="text-xs font-semibold text-blue-900 mb-1">Selected Project:</p>
                    <p className="text-sm text-gray-700">{selectedProject}</p>
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* Template Type Selection Card */}
          <section className="bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden">
            <div className="bg-gradient-to-r from-purple-50 to-indigo-50 border-b border-gray-200 px-6 py-4">
              <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Select Template Type
              </h2>
            </div>
            <div className="p-6">
              <div className="flex flex-col gap-2">
                <label htmlFor="template" className="text-sm font-semibold text-gray-700">
                  Choose an appointment letter template
                </label>
                <CustomSelect
                  id="template"
                  value={selectedTemplate}
                  onChange={(val) => {
                    setSelectedTemplate(val as TemplateType | "");
                    setGeneratedPdfUrl(null);
                  }}
                  options={Object.keys(TEMPLATE_CONFIG).map((templateKey) => ({
                    value: templateKey,
                    label: TEMPLATE_CONFIG[templateKey as TemplateType].displayName,
                  }))}
                  placeholder="-- Select a Template --"
                />
                {selectedTemplate && (
                  <div className="mt-3 p-3 bg-purple-50 border border-purple-200 rounded-lg">
                    <p className="text-xs font-semibold text-purple-900 mb-1">Selected Template:</p>
                    <p className="text-sm text-gray-700">
                      {TEMPLATE_CONFIG[selectedTemplate as TemplateType].displayName}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* Template Fields Section */}
          {templateFields && (
            <section className="bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden">
              <div className="bg-gradient-to-r from-green-50 to-emerald-50 border-b border-gray-200 px-6 py-4">
                <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                  <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Template Fields
                  <span className="ml-auto text-sm font-normal text-gray-600">
                    Hover over fields to copy
                  </span>
                </h2>
              </div>

              <div className="p-6 space-y-8">
                {/* Date & Location Section */}
                <div>
                  <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wider mb-4 flex items-center gap-2">
                    <div className="w-1 h-4 bg-blue-600 rounded"></div>
                    Date & Location Information
                  </h3>
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    <FieldCard label="Current Date" value={templateFields.CurrentDate} fieldName="CurrentDate" />
                    <FieldCard label="Ward Name" value={templateFields.WardName} fieldName="WardName" />
                    <FieldCard label="Zone Name" value={templateFields.ZoneName} fieldName="ZoneName" />
                    <FieldCard label="Village Name" value={templateFields.VillageName} fieldName="VillageName" />
                    <FieldCard label="Taluka Name" value={templateFields.TalukaName} fieldName="TalukaName" />
                    <FieldCard label="District Name" value={templateFields.DistrictName} fieldName="DistrictName" />
                  </div>
                </div>

                {/* Property Details Section */}
                <div>
                  <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wider mb-4 flex items-center gap-2">
                    <div className="w-1 h-4 bg-purple-600 rounded"></div>
                    Property Details
                  </h3>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="md:col-span-2">
                      <FieldCard label="Office Address" value={templateFields.OfficeAddress} fieldName="OfficeAddress" />
                    </div>
                    <FieldCard label="CTS No." value={templateFields.CTSNo} fieldName="CTSNo" />
                  </div>
                </div>

                {/* Road Information Section */}
                <div>
                  <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wider mb-4 flex items-center gap-2">
                    <div className="w-1 h-4 bg-orange-600 rounded"></div>
                    Road Information
                  </h3>
                  <div className="grid gap-4 md:grid-cols-2">
                    <FieldCard label="Road Width" value={templateFields.RoadWidth} fieldName="RoadWidth" />
                    <FieldCard label="Road Name" value={templateFields.RoadName} fieldName="RoadName" />
                    <FieldCard label="Main Road Width" value={templateFields.MainRoadWidth} fieldName="MainRoadWidth" />
                    <FieldCard label="Main Road Name" value={templateFields.MainRoadName} fieldName="MainRoadName" />
                  </div>
                </div>

                {/* Applicant & Consultant Section */}
                <div>
                  <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wider mb-4 flex items-center gap-2">
                    <div className="w-1 h-4 bg-indigo-600 rounded"></div>
                    Applicant & Consultant Information
                  </h3>
                  <div className="grid gap-4 md:grid-cols-2">
                    <FieldCard label="Applicant Name" value={templateFields.ApplicantName} fieldName="ApplicantName" />
                    <FieldCard label="Firm Name" value={templateFields.FirmName} fieldName="FirmName" />
                    <FieldCard label="Consultant Name" value={templateFields.ConsultantName} fieldName="ConsultantName" />
                    <FieldCard label="Consultant Type" value={templateFields.ConsultantType} fieldName="ConsultantType" />
                    <FieldCard label="Council Reg. No." value={templateFields.CouncilRegNo} fieldName="CouncilRegNo" />
                    <FieldCard label="Reg. Validity Date" value={templateFields.RegValidityDate} fieldName="RegValidityDate" />
                  </div>
                </div>
              </div>
            </section>
          )}

            {/* Empty State */}
            {!templateFields && selectedProject === "" && (
              <div className="bg-white rounded-xl shadow-md border border-gray-200 p-12 text-center">
                <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <p className="text-gray-600 text-lg font-medium">Select a project to view template fields</p>
                <p className="text-gray-500 text-sm mt-2">Choose a project from the dropdown above to generate template values</p>
              </div>
            )}
          </div>

          {/* Right Column - PDF Viewer */}
          <div className="space-y-6">
            <section className="bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden">
              <div className="bg-gradient-to-r from-red-50 to-rose-50 border-b border-gray-200 px-6 py-4">
                <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                  <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                  </svg>
                  {selectedTemplate ? TEMPLATE_CONFIG[selectedTemplate as TemplateType].displayName : "Appointment Letter Document"}
                  {templateFields && selectedTemplate && (
                    <button
                      onClick={() => templateFields && generatePDF(templateFields)}
                      disabled={isGenerating}
                      className="ml-auto px-4 py-1.5 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed transition-colors"
                    >
                      {isGenerating ? "Generating..." : "Regenerate PDF"}
                    </button>
                  )}
                </h2>
              </div>
              <div className="p-6">
                {!isGenerating && !letterheadBytes && !letterheadError && (
                  <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                    Loading letterhead template...
                  </div>
                )}

                {!isGenerating && letterheadError && (
                  <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
                    {letterheadError}
                  </div>
                )}

                {isGenerating ? (
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-12 text-center bg-gray-50">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                    <p className="text-gray-600 font-medium">Generating PDF...</p>
                    <p className="text-gray-500 text-sm mt-2">Please wait while we create your document</p>
                  </div>
                ) : generatedPdfUrl ? (
                  <div className="border border-gray-200 rounded-lg overflow-hidden bg-gray-50">
                    <div className="bg-gray-100 px-4 py-2 border-b border-gray-200 flex items-center justify-between">
                      <p className="text-sm font-medium text-gray-700">Generated Document Preview</p>
                      <a
                        href={generatedPdfUrl}
                        download={selectedTemplate ? TEMPLATE_CONFIG[selectedTemplate as TemplateType].fileName : "Appointment_Letter.pdf"}
                        className="text-sm text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>
                        Download PDF
                      </a>
                    </div>
                    <div className="h-[800px] overflow-auto">
                      <div style={{ height: "100%", position: "relative" }}>
                        <PlainPDFViewer fileUrl={generatedPdfUrl} />
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-12 text-center bg-gray-50">
                    <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                    </svg>
                    <p className="text-gray-600 font-medium mb-1">No PDF generated</p>
                    <p className="text-gray-500 text-sm">Select a project and template type to generate the appointment letter document</p>
                  </div>
                )}
              </div>
            </section>
            {generatedPdfUrl && (
              <div className="space-y-2">
                {connectorPingMessage && (
                  <div
                    className={`rounded-lg border px-3 py-2 text-sm ${
                      dscStatus?.connected
                        ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                        : "border-red-200 bg-red-50 text-red-900"
                    }`}
                  >
                    {connectorPingMessage}
                  </div>
                )}
                <div className="flex justify-end gap-2">
                  <button
                    onClick={checkConnectorHealth}
                    disabled={isPingingConnector || isSigning}
                    className="px-4 py-2 text-sm font-medium border border-blue-200 text-blue-700 rounded-lg hover:bg-blue-50 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
                  >
                    {isPingingConnector ? "Checking Connector..." : "Check Connector"}
                  </button>
                  <button
                    onClick={openDscModal}
                    className="px-4 py-2 text-sm font-medium bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
                  >
                    Sign using DSC
                  </button>
                </div>
              </div>
            )}
          </div>
          </div>
        </div>
      </div>

      <SiteFooter />

      {isDscModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl max-w-5xl w-full h-[90vh] p-6 flex flex-col space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">Sign Document using DSC</h3>
              <button
                className="text-gray-400 hover:text-gray-600"
                onClick={() => {
                  if (!isSigning) {
                    setIsDscModalOpen(false);
                    setIsSelectingArea(false);
                  }
                }}
              >
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-hidden space-y-4">
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

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 h-full">
                    <div className="space-y-3 md:col-span-1">
                      {dscCertificates.length > 0 && (
                        <div className="space-y-1">
                          <label className="text-sm font-medium text-gray-700">
                            Select DSC Certificate
                          </label>
                          <CustomSelect
                            value={
                              selectedDsc
                                ? `${selectedDsc.slotIndex}-${selectedDsc.certIndex}`
                                : ""
                            }
                            onChange={(val) => {
                              if (val === "") {
                                setSelectedDsc(null);
                              } else {
                                const [slotIdx, certIdx] = val.split("-").map(Number);
                                setSelectedDsc({ slotIndex: slotIdx, certIndex: certIdx });
                              }
                            }}
                            options={dscCertificates.map((cert) => {
                              const displayName = cert.cn || cert.label || `Certificate ${cert.certIndex + 1}`;
                              return {
                                value: `${cert.slotIndex}-${cert.certIndex}`,
                                label: displayName,
                              };
                            })}
                            placeholder="-- Select DSC Certificate --"
                          />
                        </div>
                      )}

                      <div className="space-y-1">
                        <label className="text-sm font-medium text-gray-700">DSC PIN</label>
                        <input
                          type="password"
                          value={dscPin}
                          onChange={(e) => setDscPin(e.target.value)}
                          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 text-black"
                          placeholder="Enter DSC PIN"
                        />
                      </div>

                      {dscError && (
                        <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-900">
                          {dscError}
                        </div>
                      )}

                      <div className="flex flex-col gap-2 pt-2">
                        <button
                          className="px-4 py-2 text-sm font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:bg-blue-400"
                          onClick={() => {
                            void signWithDsc(selectionPdfRect || undefined);
                          }}
                          disabled={
                            isSigning ||
                            !dscStatus?.connected ||
                            !selectedDsc ||
                            !dscPin
                          }
                        >
                          {isSigning ? "Signing..." : "Sign here"}
                        </button>
                      </div>
                    </div>

                    <div className="md:col-span-2 flex flex-col gap-2 h-full min-h-0">
                      {generatedPdfUrl && (
                        <>
                          <p className="text-xs text-gray-600">
                            Step 2: Drag the green block over the PDF to choose where the DSC
                            signature should appear.
                          </p>
                          <div className="flex-1 min-h-0 border border-gray-200 rounded-lg overflow-auto">
                            <div
                              style={{ height: "100%", minHeight: 0, position: "relative" }}
                              ref={pdfViewerRef}
                              onClick={handlePdfClick}
                              onMouseDown={handlePdfMouseDown}
                              onMouseMove={handlePdfMouseMove}
                              onMouseUp={handlePdfMouseUp}
                              onMouseLeave={handlePdfMouseUp}
                              className={isSelectingArea || isDragging ? "cursor-move" : "cursor-default"}
                            >
                              <PlainPDFViewer fileUrl={generatedPdfUrl} />
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
                              {isSelectingArea && !selectionRect && (
                                <div className="absolute inset-0 pointer-events-none border-2 border-dashed border-emerald-400" />
                              )}
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-2">
                  <button
                    className="px-3 py-2 text-sm font-medium text-gray-600 hover:text-gray-800"
                    onClick={() => {
                      if (!isSigning) {
                        setIsDscModalOpen(false);
                        setIsSelectingArea(false);
                        setSelectionRect(null);
                        setSelectionPdfRect(null);
                      }
                    }}
                    disabled={isSigning}
                  >
                    Cancel
                  </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// import DSCSigner from '../components/DSCSigner';
   
// export default function MyPage() {
//   return <DSCSigner />;
// }