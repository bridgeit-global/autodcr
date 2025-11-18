"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import dynamic from "next/dynamic";

// Dynamically import PDFModal with SSR disabled to avoid canvas module error
const PDFModal = dynamic(() => import("./PDFModal"), {
  ssr: false,
}) as React.ComponentType<{ open: boolean; onClose: () => void; fileUrl: string | null }>;

interface RegistrationFormProps {
  title?: string;
}

const REGISTRATION_TYPES = [
  "Owner As Developer (Self Use)",
  "Developer As Firm (Selling Use)",
  "Constituted Attorney (CA) to Owner",
];

const ENTITY_TYPES = [
  "Proprietorship / Individual",
  "Partnership Firm",
  "Pvt. Ltd. / Ltd. Company",
  "LLP",
  "Trust / Society",
  "Govt. / PSU / Local Body",
];

type EntityDocumentRequirement = {
  id: string;
  label: string;
  required?: boolean;
  accept?: string;
};

const DOC_CHECKLIST: Record<string, EntityDocumentRequirement[]> = {
  "Proprietorship / Individual": [
    { id: "individualPan", label: "PAN of Individual", required: true },
    { id: "individualAadhaar", label: "Aadhaar Card", required: true },
    { id: "individualUtility", label: "Recent Utility Bill / Address Proof" },
  ],
  "Partnership Firm": [
    { id: "partnershipDeed", label: "Partnership Deed", required: true },
    { id: "partnershipCert", label: "Firm Registration Certificate (if registered)" },
    { id: "partnershipPan", label: "PAN of Firm", required: true },
    { id: "partnersPan", label: "PAN of All Partners" },
    {
      id: "partnershipResolution",
      label: "Authorization Letter / Resolution in favour of Authorised Signatory",
    },
  ],
  "Pvt. Ltd. / Ltd. Company": [
    { id: "companyIncorporationCert", label: "Certificate of Incorporation", required: true },
    { id: "companyMoaAoa", label: "MoA & AoA (single compiled PDF)", required: true },
    { id: "companyBoardResolution", label: "Board Resolution authorising signatory", required: true },
    { id: "companyPan", label: "PAN of Company", required: true },
    { id: "companyDirectorsList", label: "List of Directors" },
  ],
  LLP: [
    { id: "llpCertificate", label: "LLPIN Allotment / Certificate of Incorporation", required: true },
    { id: "llpAgreementDoc", label: "LLP Agreement", required: true },
    { id: "llpResolutionDoc", label: "Resolution / LOA authorising Designated Partner" },
    { id: "llpPan", label: "PAN of LLP", required: true },
  ],
  "Trust / Society": [
    { id: "trustRegistrationCert", label: "Registration Certificate (Trust / Society)", required: true },
    { id: "trustDeedDoc", label: "Trust Deed / Bye-laws", required: true },
    { id: "trustResolutionDoc", label: "Resolution authorising signatory" },
    { id: "trustPan", label: "PAN of Trust / Society", required: true },
  ],
  "Govt. / PSU / Local Body": [
    { id: "govOrder", label: "Government Order / Office Order authorising officer", required: true },
    { id: "govEstablishmentOrder", label: "Department / Undertaking Establishment Order" },
    { id: "govOfficerId", label: "ID Card of Authorised Officer" },
  ],
};

type FormValues = {
  registrationType: string;
  entityType: string;
  entityName: string;
  pan: string;
  gstNo?: string;
  address: string;
  authSignatoryName: string;
  designation: string;
  mobile: string;
  email: string;
  loginId: string;
  password: string;
  confirmPassword: string;
  
  // Proprietorship / Individual
  fullNameProprietor?: string;
  aadhaarNo?: string;
  residentialAddress?: string;
  
  // Partnership Firm
  firmRegistrationNo?: string;
  partnershipRegistrationDate?: string;
  numberOfPartners?: string;
  partnershipDeedFile?: FileList;
  firmRegistrationCertFile?: FileList;
  
  // Pvt. Ltd. / Ltd. Company
  cin?: string;
  rocRegistrationDate?: string;
  registeredOfficeAddress?: string;
  moaAoaFile?: FileList;
  boardResolutionFile?: FileList;
  numberOfDirectors?: string;
  
  // LLP
  llpin?: string;
  llpIncorporationDate?: string;
  numberOfDesignatedPartners?: string;
  llpAgreementFile?: FileList;
  llpResolutionFile?: FileList;
  
  // Trust / Society
  trustRegistrationNo?: string;
  trustRegistrationDate?: string;
  trustDeedFile?: FileList;
  trustRegistrationCertFile?: FileList;
  trustResolutionFile?: FileList;
  numberOfTrustees?: string;
  
  // Govt. / PSU / Local Body
  departmentName?: string;
  officeOrderRef?: string;
  officeAddress?: string;
  officeOrderFile?: FileList;
  
  // Letterhead
  letterheadFile?: FileList;
  entityDocuments?: Record<string, FileList | undefined>;
};

const RegistrationForm: React.FC<RegistrationFormProps> = ({ title = "Registration" }) => {
  const router = useRouter();

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
    trigger,
    getValues,
  } = useForm<FormValues>({
    defaultValues: {
      registrationType: "",
      entityType: "",
    },
  });

  const entityType = watch("entityType");
  const docsForEntity = DOC_CHECKLIST[entityType] || [];
  const [letterheadPreviewUrl, setLetterheadPreviewUrl] = useState<string | null>(null);
  const [letterheadFileName, setLetterheadFileName] = useState<string>("");
  const [isPDFModalOpen, setIsPDFModalOpen] = useState(false);
  const [hasViewedLetterhead, setHasViewedLetterhead] = useState(false);
  
  // Cleanup object URL on unmount
  useEffect(() => {
    return () => {
      if (letterheadPreviewUrl) {
        URL.revokeObjectURL(letterheadPreviewUrl);
      }
    };
  }, [letterheadPreviewUrl]);
  const panRegister = register("pan", {
    required: "PAN is required",
    pattern: {
      value: /^[A-Z]{5}[0-9]{4}[A-Z]$/,
      message: "Enter valid PAN: first 5 letters, 4 digits, last letter",
    },
  });
  const gstRegister = register("gstNo", {
    pattern: {
      value: /^[0-9A-Z]{15}$/,
      message: "GST No. must be 15 alphanumeric characters",
    },
  });
  const cinRegister = register("cin", {
    pattern: {
      value: /^[LU]\d{5}[A-Z]{2}\d{4}[A-Z0-9]{3}[A-Z0-9]{6}$/,
      message: "Enter valid CIN: L/U followed by 21 alphanumeric characters (e.g., L12345MH2019ABC123456)"
    },
    maxLength: {
      value: 21,
      message: "CIN must be exactly 21 characters"
    }
  });
  const entityTypeRegister = register("entityType", { required: "Entity Type is required" });

  const sections = [
    { id: "registration", label: "Registration Type" },
    { id: "common", label: "Common Details" },
    { id: "entity", label: "Entity Overview" },
    { id: "entitySpecific", label: "Entity Specific" },
    { id: "letterhead", label: "Letterhead" },
    { id: "credentialsUploads", label: "Login & Uploads" },
  ];

  const scrollToSection = (sectionId: string) => {
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  const getEntitySpecificRequiredFields = () => {
    switch (entityType) {
      case "Proprietorship / Individual":
        return ["fullNameProprietor"];
      case "Partnership Firm":
        return [
          "firmRegistrationNo",
          "partnershipRegistrationDate",
          "numberOfPartners",
          "partnershipDeedFile",
          "firmRegistrationCertFile",
        ];
      case "Pvt. Ltd. / Ltd. Company":
        return [
          "cin",
          "rocRegistrationDate",
          "registeredOfficeAddress",
          "moaAoaFile",
          "boardResolutionFile",
        ];
      case "LLP":
        return [
          "llpin",
          "llpIncorporationDate",
          "numberOfDesignatedPartners",
          "llpAgreementFile",
          "llpResolutionFile",
        ];
      case "Trust / Society":
        return [
          "trustRegistrationNo",
          "trustRegistrationDate",
          "trustRegisteredAddress",
          "trustDeedFile",
          "trustRegistrationCertFile",
          "trustResolutionFile",
        ];
      case "Govt. / PSU / Local Body":
        return ["departmentName", "officeOrderRef", "officeAddress", "officeOrderFile"];
      default:
        return [];
    }
  };

  const renderEntitySpecificFields = () => {
    if (!entityType) {
      return (
        <div className="border rounded-lg p-4 bg-yellow-50 text-yellow-800 text-sm">
          Select an entity type in the previous step to load its specific details.
        </div>
      );
    }

    switch (entityType) {
      case "Proprietorship / Individual":
        return (
          <div className="border rounded-lg p-6 bg-white">
            <h2
              className="text-xl font-bold text-black mb-6 cursor-pointer hover:text-blue-600 transition-colors"
              onClick={() => scrollToSection("entitySpecific")}
            >
              Entity Specific - Proprietorship / Individual Details
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block font-medium text-black mb-1">
                  PAN (10-character tax ID) <span className="text-red-500">*</span>
                </label>
                <input
                  {...panRegister}
                  className="border rounded-lg px-3 py-2 h-10 w-full text-black focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="ABCDE1234F"
                  maxLength={10}
                  onChange={(e) => {
                    e.target.value = e.target.value.toUpperCase();
                    panRegister.onChange(e);
                  }}
                />
                {errors.pan && <p className="text-red-600 text-sm mt-1">{errors.pan.message}</p>}
                {!errors.pan && <p className="text-xs text-gray-500 mt-1">Enter PAN (10 characters).</p>}
              </div>

              <div>
                <label className="block font-medium text-black mb-1">GST No.</label>
                <input
                  {...gstRegister}
                  className="border rounded-lg px-3 py-2 h-10 w-full text-black focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="15-character GSTIN"
                  maxLength={15}
                  onChange={(e) => {
                    e.target.value = e.target.value.toUpperCase();
                    gstRegister.onChange?.(e);
                  }}
                />
                {errors.gstNo && <p className="text-red-600 text-sm mt-1">{errors.gstNo.message}</p>}
              </div>
              <div>
                <label className="block font-medium text-black mb-1">
                  Full Name of Proprietor <span className="text-red-500">*</span>
                </label>
                <input
                  {...register("fullNameProprietor", { required: "Full Name is required" })}
                  className="border rounded-lg px-3 py-2 h-10 w-full text-black focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="Name as per PAN / Aadhaar"
                />
                {errors.fullNameProprietor && (
                  <p className="text-red-600 text-sm mt-1">{errors.fullNameProprietor.message}</p>
                )}
              </div>

              <div>
                <label className="block font-medium text-black mb-1">Aadhaar No.</label>
                <input
                  {...register("aadhaarNo")}
                  className="border rounded-lg px-3 py-2 h-10 w-full text-black focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="XXXX-XXXX-XXXX"
                />
              </div>

            </div>
          </div>
        );

      case "Partnership Firm":
        return (
          <div className="border rounded-lg p-6 bg-white">
            <h2
              className="text-xl font-bold text-black mb-6 cursor-pointer hover:text-blue-600 transition-colors"
              onClick={() => scrollToSection("entitySpecific")}
            >
              Entity Specific - Partnership Firm Details
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block font-medium text-black mb-1">
                  PAN (10-character tax ID) <span className="text-red-500">*</span>
                </label>
                <input
                  {...panRegister}
                  className="border rounded-lg px-3 py-2 h-10 w-full text-black focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="ABCDE1234F"
                  maxLength={10}
                  onChange={(e) => {
                    e.target.value = e.target.value.toUpperCase();
                    panRegister.onChange(e);
                  }}
                />
                {errors.pan && <p className="text-red-600 text-sm mt-1">{errors.pan.message}</p>}
                {!errors.pan && <p className="text-xs text-gray-500 mt-1">Enter PAN (10 characters).</p>}
              </div>

              <div>
                <label className="block font-medium text-black mb-1">GST No.</label>
                <input
                  {...gstRegister}
                  className="border rounded-lg px-3 py-2 h-10 w-full text-black focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="15-character GSTIN"
                  maxLength={15}
                  onChange={(e) => {
                    e.target.value = e.target.value.toUpperCase();
                    gstRegister.onChange?.(e);
                  }}
                />
                {errors.gstNo && <p className="text-red-600 text-sm mt-1">{errors.gstNo.message}</p>}
              </div>
              <div>
                <label className="block font-medium text-black mb-1">
                  Firm Registration No. (if registered)
                </label>
                <input
                  {...register("firmRegistrationNo")}
                  className="border rounded-lg px-3 py-2 h-10 w-full text-black focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="As per Registrar of Firms"
                />
              </div>

              <div>
                <label className="block font-medium text-black mb-1">Date of Registration</label>
                <input
                  type="date"
                  {...register("partnershipRegistrationDate")}
                  className="border rounded-lg px-3 py-2 h-10 w-full text-black focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>

              <div>
                <label className="block font-medium text-black mb-1">Number of Partners</label>
                <input
                  type="number"
                  {...register("numberOfPartners")}
                  className="border rounded-lg px-3 py-2 h-10 w-full text-black focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="Total partners"
                />
              </div>

            </div>
          </div>
        );

      case "Pvt. Ltd. / Ltd. Company":
        return (
          <div className="border rounded-lg p-6 bg-white">
            <h2
              className="text-xl font-bold text-black mb-6 cursor-pointer hover:text-blue-600 transition-colors"
              onClick={() => scrollToSection("entitySpecific")}
            >
              Entity Specific - Pvt. Ltd. / Ltd. Company Details
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block font-medium text-black mb-1">
                  PAN (10-character tax ID) <span className="text-red-500">*</span>
                </label>
                <input
                  {...panRegister}
                  className="border rounded-lg px-3 py-2 h-10 w-full text-black focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="ABCDE1234F"
                  maxLength={10}
                  onChange={(e) => {
                    e.target.value = e.target.value.toUpperCase();
                    panRegister.onChange(e);
                  }}
                />
                {errors.pan && <p className="text-red-600 text-sm mt-1">{errors.pan.message}</p>}
                {!errors.pan && <p className="text-xs text-gray-500 mt-1">Enter PAN (10 characters).</p>}
              </div>

              <div>
                <label className="block font-medium text-black mb-1">GST No.</label>
                <input
                  {...gstRegister}
                  className="border rounded-lg px-3 py-2 h-10 w-full text-black focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="15-character GSTIN"
                  maxLength={15}
                  onChange={(e) => {
                    e.target.value = e.target.value.toUpperCase();
                    gstRegister.onChange?.(e);
                  }}
                />
                {errors.gstNo && <p className="text-red-600 text-sm mt-1">{errors.gstNo.message}</p>}
              </div>
              <div>
                <label className="block font-medium text-black mb-1">
                  CIN (Corporate Identification Number)
                </label>
                <input
                  {...cinRegister}
                  className="border rounded-lg px-3 py-2 h-10 w-full text-black focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="L12345MH2019ABC123456"
                  maxLength={21}
                  onChange={(e) => {
                    e.target.value = e.target.value.toUpperCase().replace(/\s/g, "");
                    cinRegister.onChange(e);
                  }}
                />
                {errors.cin && <p className="text-red-600 text-sm mt-1">{errors.cin.message}</p>}
                {!errors.cin && (
                  <p className="text-xs text-gray-500 mt-1">
                    CIN is a 21-character unique identifier: L/U (Listed/Unlisted) + 5 digits (State)
                    + 2 letters (State code) + 4 digits (Year) + 3 alphanumeric (Type) + 6 alphanumeric
                    (Reg No.). Example: L12345MH2019ABC123456
                  </p>
                )}
              </div>

              <div>
                <label className="block font-medium text-black mb-1">ROC Registration Date</label>
                <div className="relative">
                  <input
                    type="date"
                    {...register("rocRegistrationDate")}
                    className="border rounded-lg px-3 py-2 pr-10 h-10 w-full text-black focus:ring-2 focus:ring-blue-500 outline-none cursor-pointer [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:right-2 [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                  />
                  <svg
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-500 pointer-events-none"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                    />
                  </svg>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Click the calendar icon to open date picker and select the ROC registration date.
                </p>
              </div>

              <div>
                <label className="block font-medium text-black mb-1">Number of Directors</label>
                <input
                  type="number"
                  {...register("numberOfDirectors")}
                  className="border rounded-lg px-3 py-2 h-10 w-full text-black focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="Total directors"
                />
              </div>

            </div>
          </div>
        );

      case "LLP":
        return (
          <div className="border rounded-lg p-6 bg-white">
            <h2
              className="text-xl font-bold text-black mb-6 cursor-pointer hover:text-blue-600 transition-colors"
              onClick={() => scrollToSection("entitySpecific")}
            >
              Entity Specific - LLP Details
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block font-medium text-black mb-1">
                  PAN (10-character tax ID) <span className="text-red-500">*</span>
                </label>
                <input
                  {...panRegister}
                  className="border rounded-lg px-3 py-2 h-10 w-full text-black focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="ABCDE1234F"
                  maxLength={10}
                  onChange={(e) => {
                    e.target.value = e.target.value.toUpperCase();
                    panRegister.onChange(e);
                  }}
                />
                {errors.pan && <p className="text-red-600 text-sm mt-1">{errors.pan.message}</p>}
                {!errors.pan && <p className="text-xs text-gray-500 mt-1">Enter PAN (10 characters).</p>}
              </div>

              <div>
                <label className="block font-medium text-black mb-1">GST No.</label>
                <input
                  {...gstRegister}
                  className="border rounded-lg px-3 py-2 h-10 w-full text-black focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="15-character GSTIN"
                  maxLength={15}
                  onChange={(e) => {
                    e.target.value = e.target.value.toUpperCase();
                    gstRegister.onChange?.(e);
                  }}
                />
                {errors.gstNo && <p className="text-red-600 text-sm mt-1">{errors.gstNo.message}</p>}
              </div>
              <div>
                <label className="block font-medium text-black mb-1">LLPIN (LLP Identification No.)</label>
                <input
                  {...register("llpin")}
                  className="border rounded-lg px-3 py-2 h-10 w-full text-black focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="AAX-XXXX"
                />
              </div>

              <div>
                <label className="block font-medium text-black mb-1">Date of Incorporation</label>
                <input
                  type="date"
                  {...register("llpIncorporationDate")}
                  className="border rounded-lg px-3 py-2 h-10 w-full text-black focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>

              <div>
                <label className="block font-medium text-black mb-1">Number of Designated Partners</label>
                <input
                  type="number"
                  {...register("numberOfDesignatedPartners")}
                  className="border rounded-lg px-3 py-2 h-10 w-full text-black focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="Total designated partners"
                />
              </div>

            </div>
          </div>
        );

      case "Trust / Society":
        return (
          <div className="border rounded-lg p-6 bg-white">
            <h2
              className="text-xl font-bold text-black mb-6 cursor-pointer hover:text-blue-600 transition-colors"
              onClick={() => scrollToSection("entitySpecific")}
            >
              Entity Specific - Trust / Society Details
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block font-medium text-black mb-1">
                  PAN (10-character tax ID) <span className="text-red-500">*</span>
                </label>
                <input
                  {...panRegister}
                  className="border rounded-lg px-3 py-2 h-10 w-full text-black focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="ABCDE1234F"
                  maxLength={10}
                  onChange={(e) => {
                    e.target.value = e.target.value.toUpperCase();
                    panRegister.onChange(e);
                  }}
                />
                {errors.pan && <p className="text-red-600 text-sm mt-1">{errors.pan.message}</p>}
                {!errors.pan && <p className="text-xs text-gray-500 mt-1">Enter PAN (10 characters).</p>}
              </div>

              <div>
                <label className="block font-medium text-black mb-1">GST No.</label>
                <input
                  {...gstRegister}
                  className="border rounded-lg px-3 py-2 h-10 w-full text-black focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="15-character GSTIN"
                  maxLength={15}
                  onChange={(e) => {
                    e.target.value = e.target.value.toUpperCase();
                    gstRegister.onChange?.(e);
                  }}
                />
                {errors.gstNo && <p className="text-red-600 text-sm mt-1">{errors.gstNo.message}</p>}
              </div>
              <div>
                <label className="block font-medium text-black mb-1">Registration No.</label>
                <input
                  {...register("trustRegistrationNo")}
                  className="border rounded-lg px-3 py-2 h-10 w-full text-black focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="As per Charity Commissioner / Registrar"
                />
              </div>

              <div>
                <label className="block font-medium text-black mb-1">Date of Registration</label>
                <input
                  type="date"
                  {...register("trustRegistrationDate")}
                  className="border rounded-lg px-3 py-2 h-10 w-full text-black focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>

              <div>
                <label className="block font-medium text-black mb-1">Number of Trustees</label>
                <input
                  type="number"
                  {...register("numberOfTrustees")}
                  className="border rounded-lg px-3 py-2 h-10 w-full text-black focus:ring-2 focus-ring-blue-500 outline-none"
                  placeholder="Total trustees"
                />
              </div>

            </div>
          </div>
        );

      case "Govt. / PSU / Local Body":
        return (
          <div className="border rounded-lg p-6 bg-white">
            <h2
              className="text-xl font-bold text-black mb-6 cursor-pointer hover:text-blue-600 transition-colors"
              onClick={() => scrollToSection("entitySpecific")}
            >
              Entity Specific - Government / PSU / Local Body Details
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block font-medium text-black mb-1">
                  PAN (10-character tax ID) <span className="text-red-500">*</span>
                </label>
                <input
                  {...panRegister}
                  className="border rounded-lg px-3 py-2 h-10 w-full text-black focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="ABCDE1234F"
                  maxLength={10}
                  onChange={(e) => {
                    e.target.value = e.target.value.toUpperCase();
                    panRegister.onChange(e);
                  }}
                />
                {errors.pan && <p className="text-red-600 text-sm mt-1">{errors.pan.message}</p>}
                {!errors.pan && <p className="text-xs text-gray-500 mt-1">Enter PAN (10 characters).</p>}
              </div>

              <div>
                <label className="block font-medium text-black mb-1">GST No.</label>
                <input
                  {...gstRegister}
                  className="border rounded-lg px-3 py-2 h-10 w-full text-black focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="15-character GSTIN"
                  maxLength={15}
                  onChange={(e) => {
                    e.target.value = e.target.value.toUpperCase();
                    gstRegister.onChange?.(e);
                  }}
                />
                {errors.gstNo && <p className="text-red-600 text-sm mt-1">{errors.gstNo.message}</p>}
              </div>
              <div>
                <label className="block font-medium text-black mb-1">
                  Department / Undertaking Name <span className="text-red-500">*</span>
                </label>
                <input
                  {...register("departmentName", {
                    required:
                      entityType === "Govt. / PSU / Local Body" ? "Department Name is required" : false,
                  })}
                  className="border rounded-lg px-3 py-2 h-10 w-full text-black focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="e.g. MHADA / MMRDA / BMC / XYZ Dept."
                />
                {errors.departmentName && (
                  <p className="text-red-600 text-sm mt-1">{errors.departmentName.message}</p>
                )}
              </div>

              <div>
                <label className="block font-medium text-black mb-1">
                  Office Order / Authorization Reference
                </label>
                <input
                  {...register("officeOrderRef")}
                  className="border rounded-lg px-3 py-2 h-10 w-full text-black focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="GO / Office order number"
                />
              </div>

            </div>
          </div>
        );

      default:
        return null;
    }
  };

  const RegistrationTypeSection = () => (
    <div id="registration" className="scroll-mt-24">
      <div className="border rounded-lg p-6 bg-white">
        <h2
          className="text-xl font-bold text-black mb-6 cursor-pointer hover:text-blue-600 transition-colors"
          onClick={() => scrollToSection("registration")}
        >
          Registration Type <span className="text-red-500">*</span>
        </h2>
        <div className="space-y-2">
          {REGISTRATION_TYPES.map((type) => (
            <label key={type} className="flex items-start gap-2 cursor-pointer">
              <input
                type="radio"
                value={type}
                {...register("registrationType", { required: "Registration Type is required" })}
                className="mt-1"
              />
              <span className="text-sm">{type}</span>
            </label>
          ))}
          {errors.registrationType && (
            <p className="text-red-600 text-sm mt-2">{errors.registrationType.message}</p>
          )}
        </div>
      </div>
    </div>
  );

  const CommonDetailsSection = () => (
    <div id="common" className="scroll-mt-24">
      <div className="border rounded-lg p-6 bg-white">
        <h2
          className="text-xl font-bold text-black mb-6 cursor-pointer hover:text-blue-600 transition-colors"
          onClick={() => scrollToSection("common")}
        >
          Common Details (All Entities)
        </h2>

        <div className="space-y-4">
          <div>
            <label className="block font-medium text-black mb-1">
              Authorised Signatory Name <span className="text-red-500">*</span>
            </label>
            <input
              {...register("authSignatoryName", { required: "Authorised Signatory Name is required" })}
              className="border rounded-lg px-3 py-2 h-10 w-full text-black focus:ring-2 focus:ring-blue-500 outline-none"
              placeholder="Name as per authorization"
            />
            {errors.authSignatoryName && (
              <p className="text-red-600 text-sm mt-1">{errors.authSignatoryName.message}</p>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block font-medium text-black mb-1">
                Mobile No. <span className="text-red-500">*</span>
              </label>
              <input
                {...register("mobile", {
                  required: "Mobile Number is required",
                  pattern: {
                    value: /^[0-9]{10}$/,
                    message: "Mobile Number must be 10 digits",
                  },
                })}
                className="border rounded-lg px-3 py-2 h-10 w-full text-black focus:ring-2 focus:ring-blue-500 outline-none"
                placeholder="10-digit mobile number"
                type="number"
              />
              {errors.mobile && <p className="text-red-600 text-sm mt-1">{errors.mobile.message}</p>}
            </div>

            <div>
              <label className="block font-medium text-black mb-1">
                Email ID <span className="text-red-500">*</span>
              </label>
              <input
                type="email"
                {...register("email", {
                  required: "Email is required",
                  pattern: {
                    value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                    message: "Invalid Email Address",
                  },
                })}
                className="border rounded-lg px-3 py-2 h-10 w-full text-black focus:ring-2 focus:ring-blue-500 outline-none"
                placeholder="official@email.com"
              />
              {errors.email && <p className="text-red-600 text-sm mt-1">{errors.email.message}</p>}
            </div>
          </div>

          <div>
            <label className="block font-medium text-black mb-1">
              Registered / Correspondence Address <span className="text-red-500">*</span>
            </label>
            <textarea
              {...register("address", { required: "Address is required" })}
              className="border rounded-lg px-3 py-2 w-full h-20 text-black focus:ring-2 focus:ring-blue-500 outline-none"
              placeholder="Enter full postal address"
            />
            {errors.address && <p className="text-red-600 text-sm mt-1">{errors.address.message}</p>}
          </div>

        </div>
      </div>
    </div>
  );

  const EntityOverviewSection = () => (
    <div id="entity" className="scroll-mt-24">
      <div className="space-y-6">
        <div className="border rounded-lg p-6 bg-white">
          <h2
            className="text-xl font-bold text-black mb-6 cursor-pointer hover:text-blue-600 transition-colors"
            onClick={() => scrollToSection("entity")}
          >
            Entity Overview
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block font-medium text-black mb-1">
                Name of Entity / Applicant <span className="text-red-500">*</span>
              </label>
              <input
                {...register("entityName", { required: "Name of Entity / Applicant is required" })}
                className="border rounded-lg px-3 py-2 h-10 w-full text-black focus:ring-2 focus:ring-blue-500 outline-none"
                placeholder="e.g. M/s. XYZ Developers LLP"
              />
              {errors.entityName && <p className="text-red-600 text-sm mt-1">{errors.entityName.message}</p>}
            </div>

            <div>
              <label className="block font-medium text-black mb-1">
                Entity Type <span className="text-red-500">*</span>
              </label>
              <select
                name={entityTypeRegister.name}
                ref={entityTypeRegister.ref}
                onBlur={entityTypeRegister.onBlur}
                className="border rounded-lg px-3 py-2 h-10 w-full text-black focus:ring-2 focus:ring-blue-500 outline-none"
                onChange={(e) => {
                  // Call the registered onChange handler
                  entityTypeRegister.onChange(e);
                  // Prevent scroll to top by maintaining current scroll position
                  const scrollY = window.scrollY;
                  requestAnimationFrame(() => {
                    window.scrollTo({ top: scrollY, behavior: "auto" });
                  });
                }}
              >
                <option value="">Select Entity Type</option>
                {ENTITY_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
              {errors.entityType && <p className="text-red-600 text-sm mt-1">{errors.entityType.message}</p>}
              <p className="text-xs mt-1 text-gray-600">
                Fields & document checklist will adjust as per selected entity type.
              </p>
            </div>
          </div>
        </div>

      </div>
    </div>
  );

  const EntitySpecificSection = () => (
    <div id="entitySpecific" className="scroll-mt-24">
      <div className="space-y-6">{renderEntitySpecificFields()}</div>
    </div>
  );

  const LetterheadSection = () => {
    const letterheadField = register("letterheadFile", {
      required: "Letterhead PDF is required",
      validate: {
        fileType: (files?: FileList | null) => {
          if (files && files.length > 0) {
            const file = files[0];
            return file.type === "application/pdf" || file.name.endsWith(".pdf")
              ? true
              : "Please upload a PDF file";
          }
          return true;
        },
      },
    });

    const handleLetterheadChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (!files || files.length === 0) {
        return;
      }

      const file = files[0];
      setLetterheadFileName(file.name);

      if (letterheadPreviewUrl) {
        URL.revokeObjectURL(letterheadPreviewUrl);
      }

      const fileUrl = URL.createObjectURL(file);
      setLetterheadPreviewUrl(fileUrl);

      setHasViewedLetterhead(false);
      setTimeout(() => setIsPDFModalOpen(true), 0);
      letterheadField.onChange?.(e);
    };

    return (
      <div id="letterhead" className="scroll-mt-24">
        <div className="border rounded-lg p-6 bg-white">
          <h2
            className="text-xl font-bold text-black mb-6 cursor-pointer hover:text-blue-600 transition-colors"
            onClick={() => scrollToSection("letterhead")}
          >
            Letterhead
          </h2>
          <p className="text-sm text-gray-600 mb-4">
            Upload your letterhead PDF file. After successful upload, you will see a preview showing where it will be placed.
          </p>

          <div className="mb-4">
            <label className="block font-medium text-black mb-1">
              Letterhead PDF <span className="text-red-500">*</span>
            </label>
            <input
              type="file"
              accept=".pdf"
              {...letterheadField}
              onChange={handleLetterheadChange}
              className="border rounded-lg px-3 py-2 w-full text-black focus:ring-2 focus:ring-blue-500 outline-none"
            />
            {errors.letterheadFile && (
              <p className="text-red-600 text-sm mt-1">{errors.letterheadFile.message}</p>
            )}

            {letterheadFileName && !errors.letterheadFile && (
              <div className="mt-3">
                <p className="text-xs text-green-600 mb-2">✓ Successfully uploaded: {letterheadFileName}</p>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      if (letterheadPreviewUrl) {
                        setIsPDFModalOpen(true);
                      }
                    }}
                    className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    {hasViewedLetterhead ? "Review Letterhead Again" : "View Letterhead Demo"}
                  </button>
                  {hasViewedLetterhead && (
                    <span className="text-xs text-green-600 flex items-center gap-1">✓ Viewed</span>
                  )}
                </div>
              </div>
            )}

          </div>
        </div>
      </div>
    );
  };

  const LoginUploadsSection = () => {
    const entityDocumentErrors =
      (errors.entityDocuments as Record<string, { message?: string }> | undefined) || undefined;

    return (
      <div id="credentialsUploads" className="scroll-mt-24">
      <div className="space-y-6">
        <div className="border rounded-lg p-6 bg-white">
          <h2
            className="text-xl font-bold text-black mb-6 cursor-pointer hover:text-blue-600 transition-colors"
            onClick={() => scrollToSection("credentialsUploads")}
          >
            Login Credentials (Portal Access)
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block font-medium text-black mb-1">
                Preferred Login ID <span className="text-red-500">*</span>
              </label>
              <input
                {...register("loginId", { required: "Login ID is required" })}
                className="border rounded-lg px-3 py-2 h-10 w-full text-black focus:ring-2 focus:ring-blue-500 outline-none"
                placeholder="e.g. xyz.developer01"
              />
              {errors.loginId && <p className="text-red-600 text-sm mt-1">{errors.loginId.message}</p>}
            </div>

            <div>
              <label className="block font-medium text-black mb-1">
                Password <span className="text-red-500">*</span>
              </label>
              <input
                type="password"
                {...register("password", { required: "Password is required" })}
                className="border rounded-lg px-3 py-2 h-10 w-full text-black focus:ring-2 focus:ring-blue-500 outline-none"
                placeholder="Enter password"
              />
              {errors.password && <p className="text-red-600 text-sm mt-1">{errors.password.message}</p>}
            </div>

            <div>
              <label className="block font-medium text-black mb-1">
                Confirm Password <span className="text-red-500">*</span>
              </label>
              <input
                type="password"
                {...register("confirmPassword", {
                  required: "Confirm Password is required",
                  validate: (value, formValues) =>
                    value === formValues.password || "Password & Confirm Password must match.",
                })}
                className="border rounded-lg px-3 py-2 h-10 w-full text-black focus:ring-2 focus:ring-blue-500 outline-none"
                placeholder="Re-enter password"
              />
              {errors.confirmPassword && (
                <p className="text-red-600 text-sm mt-1">{errors.confirmPassword.message}</p>
              )}
            </div>
          </div>
        </div>

        <div className="border rounded-lg p-4 bg-white">
          <h3 className="text-sm font-semibold text-black mb-4">
            {entityType ? `${entityType} Specific Uploads` : "Entity Specific Uploads"}
          </h3>
          {!entityType ? (
            <p className="text-sm text-gray-600">Select an entity type to view required document uploads.</p>
          ) : docsForEntity.length === 0 ? (
            <p className="text-sm text-gray-600">No additional uploads required for this entity type.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {docsForEntity.map((doc) => {
                const fieldName = `entityDocuments.${doc.id}` as const;
                const fieldError = entityDocumentErrors?.[doc.id];

                return (
                  <div key={doc.id}>
                    <label className="block font-medium text-black mb-1">
                      {doc.label} {doc.required && <span className="text-red-500">*</span>}
                    </label>
                    <input
                      type="file"
                      accept={doc.accept || ".pdf,.jpg,.jpeg,.png"}
                      {...register(
                        fieldName,
                        doc.required ? { required: `${doc.label} is required` } : undefined
                      )}
                      className="border rounded-lg px-3 py-2 w-full text-black focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                    {fieldError && <p className="text-red-600 text-sm mt-1">{fieldError.message}</p>}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="text-center mt-8">
          <button
            type="submit"
            className="bg-blue-600 text-white px-10 py-3 rounded-lg font-medium shadow hover:bg-blue-700 transition text-lg"
          >
            Submit Registration
          </button>
        </div>
      </div>
    </div>
    );
  };


  const onSubmit = (data: FormValues) => {
    console.log("Form Data:", data);
    alert("Registration Successful!");
    router.push("/");
  };

  return (
    <div className="max-w-4xl mx-auto p-8">
      {/* Header */}
      <div className="mb-6 pb-3 border-b">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-2">
          <h2 className="text-2xl font-bold text-black">{title}</h2>

          <button
            onClick={() => router.push("/")}
            className="flex items-center gap-2 px-4 py-2 text-gray-700 hover:text-gray-900 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            <span className="font-medium">Back to Home</span>
          </button>
        </div>
        <p className="text-sm text-gray-600 mt-2">
          Please fill in the details below. Fields and document checklist will change based on the selected entity type.
        </p>
      </div>

      {/* Navigation Menu - Sticky at top */}
      <div className="sticky top-0 z-50 bg-white border-b shadow-sm mb-6">
        <div className="flex flex-wrap gap-2 p-4">
          {sections.map((section) => (
            <button
              key={section.id}
              type="button"
              onClick={() => scrollToSection(section.id)}
              className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
            >
              {section.label}
            </button>
          ))}
        </div>
      </div>

      {/* Body */}
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
        <RegistrationTypeSection />
        <CommonDetailsSection />
        <EntityOverviewSection />
        <EntitySpecificSection />
        <LetterheadSection />
        <LoginUploadsSection />
      </form>

      {/* PDF Modal - Shows user's uploaded letterhead PDF */}
      <PDFModal
        open={isPDFModalOpen}
        onClose={() => {
          setIsPDFModalOpen(false);
          if (letterheadPreviewUrl) {
            setHasViewedLetterhead(true);
          }
        }}
        fileUrl={letterheadPreviewUrl}
      />
    </div>
  );
};

export default RegistrationForm;
