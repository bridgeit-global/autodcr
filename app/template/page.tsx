"use client";

import React, { useState, useEffect, Suspense } from "react";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { Viewer, Worker } from "@react-pdf-viewer/core";
import { defaultLayoutPlugin } from "@react-pdf-viewer/default-layout";
import "@react-pdf-viewer/core/lib/styles/index.css";
import "@react-pdf-viewer/default-layout/lib/styles/index.css";
import DashboardHeader from "../components/DashboardHeader";
import SiteFooter from "../components/SiteFooter";

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

type TemplateFields = {
  CurrentDate: string;
  WardName: string;
  ZoneName: string;
  OfficeAddress: string;
  CTSNo: string;
  VillageName: string;
  TalukaName: string;
  DistrictName: string;
  RoadWidth: string;
  RoadName: string;
  MainRoadWidth: string;
  MainRoadName: string;
  ApplicantName: string;
  FirmName: string;
  ConsultantName: string;
  ConsultantType: string;
  CouncilRegNo: string;
  RegValidityDate: string;
};

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
  const [templateFields, setTemplateFields] = useState<TemplateFields | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [generatedPdfUrl, setGeneratedPdfUrl] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [letterheadBytes, setLetterheadBytes] = useState<ArrayBuffer | null>(null);
  const [letterheadError, setLetterheadError] = useState<string | null>(null);
  
  // Call defaultLayoutPlugin at the top level to avoid hooks order issues
  const defaultLayoutPluginInstance = defaultLayoutPlugin();

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
        // Auto-generate PDF when project is selected
        generatePDF(fields);
      } else {
        setTemplateFields(null);
        setGeneratedPdfUrl(null);
      }
    } else {
      setTemplateFields(null);
      setGeneratedPdfUrl(null);
    }
  }, [selectedProject]);

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

  const generatePDF = async (fields: TemplateFields) => {
    setIsGenerating(true);
    try {
      if (!letterheadBytes) {
        setIsGenerating(false);
        alert(letterheadError ?? "Letterhead template is still loading. Please try again in a moment.");
        return;
      }

      const baseBytes = letterheadBytes.slice(0);
      const pdfDoc = await PDFDocument.load(baseBytes);
      const page = pdfDoc.getPages()[0] ?? pdfDoc.addPage([612, 792]);
      const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
      
      // Adjust starting position based on letterhead - leave space for header at top
      // Letterhead header takes about 100-120 points from top, footer takes about 100-120 from bottom
      const startingY = letterheadBytes ? 650 : 750;
      const bottomMargin = letterheadBytes ? 120 : 72; // Leave space for footer
      let yPosition = startingY;
      const lineHeight = 14;
      const margin = 72;
      const pageWidth = 612 - (margin * 2);
      const pageHeight = 792;
      
      // Helper function to add text with word wrap and check bounds
      const addText = (text: string, x: number, y: number, size: number, isBold: boolean = false, maxWidth?: number): number => {
        // Check if we're too close to the bottom margin
        if (y < bottomMargin) {
          console.warn(`Content would overflow into footer area. Y position: ${y}, bottom margin: ${bottomMargin}`);
          return y; // Don't draw if too low
        }
        
        const currentFont = isBold ? boldFont : font;
        if (maxWidth) {
          const words = text.split(' ');
          let line = '';
          let currentY = y;
          let linesDrawn = 0;
          
          for (let i = 0; i < words.length; i++) {
            const testLine = line + words[i] + ' ';
            const width = currentFont.widthOfTextAtSize(testLine, size);
            
            if (width > maxWidth && i > 0) {
              // Check bounds before drawing each line
              if (currentY >= bottomMargin) {
                page.drawText(line.trim(), { x, y: currentY, size, font: currentFont });
              }
              line = words[i] + ' ';
              currentY -= lineHeight;
              linesDrawn++;
            } else {
              line = testLine;
            }
          }
          if (line.trim() && currentY >= bottomMargin) {
            page.drawText(line.trim(), { x, y: currentY, size, font: currentFont });
            linesDrawn++;
          }
          return currentY;
        } else {
          if (y >= bottomMargin) {
            page.drawText(text, { x, y, size, font: currentFont });
          }
          return y;
        }
      };
      
      // Title
      yPosition = addText("TEMPLATE: Application for Survey Remarks", margin, yPosition, 16, true);
      yPosition -= lineHeight;
      yPosition = addText("(For use in Building Proposal / Survey Section Submissions)", margin, yPosition, 10, false);
      yPosition -= lineHeight * 2;
      
      // Date
      yPosition = addText(`Date: ${fields.CurrentDate}`, margin, yPosition, 12);
      yPosition -= lineHeight * 2;
      
      // To section
      yPosition = addText("To,", margin, yPosition, 12);
      yPosition -= lineHeight;
      yPosition = addText(`The Assistant Engineer (Survey) - ${fields.WardName}`, margin, yPosition, 12);
      yPosition -= lineHeight;
      yPosition = addText(`O/o The Deputy Chief Engineer (Building Proposal) ${fields.ZoneName},`, margin, yPosition, 12);
      yPosition -= lineHeight;
      yPosition = addText("Brihanmumbai Municipal Corporation,", margin, yPosition, 12);
      yPosition -= lineHeight;
      yPosition = addText(fields.OfficeAddress, margin, yPosition, 12);
      yPosition -= lineHeight * 2;
      
      // Subject
      const subjectText = `Subject: Application for Survey Remarks for plot bearing C.T.S. No. ${fields.CTSNo} of Village - ${fields.VillageName}, Taluka - ${fields.TalukaName}, District - ${fields.DistrictName}, situated at ${fields.RoadWidth} wide ${fields.RoadName}, off ${fields.MainRoadWidth} wide ${fields.MainRoadName}, within BMC Limits of ${fields.WardName}.`;
      yPosition = addText(subjectText, margin, yPosition, 12, false, pageWidth);
      yPosition -= lineHeight * 2;
      
      // Salutation
      yPosition = addText("Sir/Madam,", margin, yPosition, 12);
      yPosition -= lineHeight * 2;
      
      // Body paragraph
      const bodyText = "I/We, the undersigned, hereby submit this application for obtaining Survey Remarks in respect of the above-mentioned property. The following documents are enclosed herewith for your kind examination and record:";
      yPosition = addText(bodyText, margin, yPosition, 12, false, pageWidth);
      yPosition -= lineHeight * 2;
      
      // Documents list (simple format without table)
      const documents = [
        "Architect Appointment Letter",
        "Architect Registration Certificate",
        "Three (3) sets of Block & Location Plan",
        "Copy of DP Remarks",
        "Copy of Property Register Cards (PRCs) & CTS Plan"
      ];
      
      documents.forEach((doc) => {
        yPosition = addText(`• ${doc}`, margin, yPosition, 12);
        yPosition -= lineHeight;
      });
      
      yPosition -= lineHeight;
      
      // Request paragraph
      const requestText = "You are therefore requested to kindly process this application and issue Survey Remarks at the earliest.";
      yPosition = addText(requestText, margin, yPosition, 12, false, pageWidth);
      yPosition -= lineHeight;
      
      const chargesText = `The requisite charges, if any, shall be duly paid, and the challan may please be prepared in the name of ${fields.ApplicantName} (e.g., M/s. Adani Electricity Mumbai Ltd.).`;
      yPosition = addText(chargesText, margin, yPosition, 12, false, pageWidth);
      yPosition -= lineHeight * 2;
      
      // Closing
      yPosition = addText("Thanking you,", margin, yPosition, 12);
      yPosition -= lineHeight;
      yPosition = addText("Yours faithfully,", margin, yPosition, 12);
      yPosition -= lineHeight * 2;
      yPosition = addText(`For ${fields.FirmName}`, margin, yPosition, 12);
      yPosition -= lineHeight;
      yPosition = addText("(Signed)", margin, yPosition, 12);
      yPosition -= lineHeight * 3;
      
      // Consultant details
      yPosition = addText(fields.ConsultantType, margin, yPosition, 12);
      yPosition -= lineHeight;
      yPosition = addText(fields.ConsultantName, margin, yPosition, 12);
      yPosition -= lineHeight;
      yPosition = addText(`Reg. No.: ${fields.CouncilRegNo}`, margin, yPosition, 12);
      yPosition -= lineHeight;
      yPosition = addText(`Reg. Validity: ${fields.RegValidityDate}`, margin, yPosition, 12);
      yPosition -= lineHeight * 2;
      
      // Enclosures
      yPosition = addText("Encl.: As above", margin, yPosition, 12);
      
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
                <select
                  id="project"
                  value={selectedProject}
                  onChange={(event) => setSelectedProject(event.target.value)}
                  className="rounded-lg border-2 border-gray-300 bg-white px-4 py-3 text-sm font-medium text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 transition-all shadow-sm hover:border-gray-400"
                >
                  <option value="">-- Select a Project --</option>
                  {projects.map((project, index) => (
                    <option key={index} value={project}>
                      {project.length > 100 ? `${project.substring(0, 100)}...` : project}
                    </option>
                  ))}
                </select>
                {selectedProject && (
                  <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <p className="text-xs font-semibold text-blue-900 mb-1">Selected Project:</p>
                    <p className="text-sm text-gray-700">{selectedProject}</p>
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
                  Survey Remarks Document
                  {templateFields && (
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
                        download="Survey_Remarks_Application.pdf"
                        className="text-sm text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>
                        Download PDF
                      </a>
                    </div>
                    <div className="h-[800px] overflow-auto">
                      <Worker workerUrl="https://unpkg.com/pdfjs-dist@3.11.174/build/pdf.worker.min.js">
                        <div style={{ height: "100%", position: "relative" }}>
                          <Viewer 
                            fileUrl={generatedPdfUrl} 
                            plugins={[defaultLayoutPluginInstance]}
                            defaultScale={1.0}
                          />
                        </div>
                      </Worker>
                    </div>
                  </div>
                ) : (
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-12 text-center bg-gray-50">
                    <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                    </svg>
                    <p className="text-gray-600 font-medium mb-1">No PDF generated</p>
                    <p className="text-gray-500 text-sm">Select a project to generate the Survey Remarks document</p>
                  </div>
                )}
              </div>
            </section>
          </div>
          </div>
        </div>
      </div>

      <SiteFooter />
    </div>
  );
}

