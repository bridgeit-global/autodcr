"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";

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

const DOC_CHECKLIST: Record<string, string[]> = {
  "Proprietorship / Individual": [
    "PAN of Individual",
    "Aadhaar Card",
    "Recent Utility Bill / Address Proof",
  ],
  "Partnership Firm": [
    "Partnership Deed",
    "Firm Registration Certificate (if registered)",
    "PAN of Firm",
    "PAN of All Partners",
    "Authorization Letter / Resolution in favour of Authorised Signatory",
  ],
  "Pvt. Ltd. / Ltd. Company": [
    "Certificate of Incorporation",
    "MoA & AoA (single compiled PDF)",
    "Board Resolution authorising signatory",
    "PAN of Company",
    "List of Directors",
  ],
  "LLP": [
    "LLPIN Allotment / Certificate of Incorporation",
    "LLP Agreement",
    "Resolution / LOA authorising Designated Partner",
    "PAN of LLP",
  ],
  "Trust / Society": [
    "Registration Certificate (Trust / Society)",
    "Trust Deed / Bye-laws",
    "Resolution authorising signatory",
    "PAN of Trust / Society",
  ],
  "Govt. / PSU / Local Body": [
    "Government Order / Office Order authorising officer",
    "Department / Undertaking Establishment Order",
    "ID Card of Authorised Officer",
  ],
};

type FormValues = {
  registrationType: string;
  entityType: string;
  entityName: string;
  pan: string;
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
  
  // LLP
  llpin?: string;
  llpIncorporationDate?: string;
  numberOfDesignatedPartners?: string;
  llpAgreementFile?: FileList;
  llpResolutionFile?: FileList;
  
  // Trust / Society
  trustRegistrationNo?: string;
  trustRegistrationDate?: string;
  trustRegisteredAddress?: string;
  trustDeedFile?: FileList;
  trustRegistrationCertFile?: FileList;
  trustResolutionFile?: FileList;
  
  // Govt. / PSU / Local Body
  departmentName?: string;
  officeOrderRef?: string;
  officeAddress?: string;
  officeOrderFile?: FileList;
  
  // Common files
  panFile: FileList;
  aadharFile: FileList;
  photoFile: FileList;
  signatureFile: FileList;
  idProofFile?: FileList;
};

const RegistrationForm: React.FC<RegistrationFormProps> = ({ title = "Registration" }) => {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("registration");
  const [tabError, setTabError] = useState("");

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
  const [docSelections, setDocSelections] = useState<string[]>([]);
  const [docNoneSelected, setDocNoneSelected] = useState(false);
  const panRegister = register("pan", {
    required: "PAN is required",
    pattern: {
      value: /^[A-Z]{5}[0-9]{4}[A-Z]$/,
      message: "Enter valid PAN: first 5 letters, 4 digits, last letter",
    },
  });

  const tabs = [
    { id: "registration", label: "Registration Type" },
    { id: "common", label: "Common Details" },
    { id: "entity", label: "Entity Overview" },
    { id: "entitySpecific", label: "Entity Specific" },
    { id: "credentialsUploads", label: "Login & Uploads" },
  ];

  useEffect(() => {
    setDocSelections([]);
    setDocNoneSelected(false);
  }, [entityType]);

  const toggleDocumentSelection = (doc: string) => {
    setDocNoneSelected(false);
    setDocSelections((prev) =>
      prev.includes(doc) ? prev.filter((item) => item !== doc) : [...prev, doc]
    );
  };

  const handleNoneSelection = () => {
    setDocNoneSelected((prev) => {
      const next = !prev;
      if (next) {
        setDocSelections([]);
      }
      return next;
    });
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

  const tabFieldMap: Record<string, string[]> = {
    registration: ["registrationType"],
    common: ["pan", "address", "authSignatoryName", "mobile", "email"],
    entity: ["entityName", "entityType"],
    credentialsUploads: ["loginId", "password", "confirmPassword", "photoFile", "signatureFile"],
  };

  const tabValidationMessages: Record<string, string> = {
    registration: "Please choose a registration type before continuing.",
    common: "Please complete all common details.",
    entity: "Please provide entity details and document checklist selection.",
    entitySpecific: "Please complete the required details for the selected entity type.",
    credentialsUploads: "Please fill in login credentials and mandatory uploads.",
  };

  const validateTab = async (tabId: string) => {
    const values = getValues();
    const hasValue = (field: string) => {
      const value = values[field as keyof FormValues];
      if (value instanceof FileList) {
        return value && value.length > 0;
      }
      return value !== undefined && value !== null && value !== "";
    };

    const fields = tabFieldMap[tabId] || [];

    if (fields.length) {
      const isValid = await trigger(fields as (keyof FormValues)[], { shouldFocus: true });
      if (!isValid) {
        return {
          valid: false,
          message: tabValidationMessages[tabId],
        };
      }
    }

    if (tabId === "entity") {
      const hasDocSelection = docSelections.length > 0 || docNoneSelected;
      if (!hasDocSelection) {
        return {
          valid: false,
          message: "Please select at least one document or choose None.",
        };
      }
    }

    if (tabId === "entitySpecific") {
      const requiredFields = getEntitySpecificRequiredFields();
      const missing = requiredFields.filter((field) => !hasValue(field));
      if (missing.length) {
        return {
          valid: false,
          message: tabValidationMessages.entitySpecific,
        };
      }
    }

    return { valid: true, message: "" };
  };

  const attemptTabChange = async (targetTabId: string) => {
    if (targetTabId === activeTab) return;

    const currentIndex = tabs.findIndex((tab) => tab.id === activeTab);
    const targetIndex = tabs.findIndex((tab) => tab.id === targetTabId);

    if (targetIndex < currentIndex) {
      setActiveTab(targetTabId);
      setTabError("");
      return;
    }

    const { valid, message } = await validateTab(activeTab);
    const validationResult = await validateTab(activeTab);

    if (validationResult.valid) {
      setActiveTab(targetTabId);
      setTabError("");
    } else {
      setTabError(validationResult.message);
    }
  };

  const goToPreviousTab = () => {
    const currentIndex = tabs.findIndex((tab) => tab.id === activeTab);
    if (currentIndex > 0) {
      setActiveTab(tabs[currentIndex - 1].id);
      setTabError("");
    }
  };

  const goToNextTab = async () => {
    const currentIndex = tabs.findIndex((tab) => tab.id === activeTab);
    if (currentIndex < tabs.length - 1) {
      await attemptTabChange(tabs[currentIndex + 1].id);
    }
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

      {/* Body */}
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Tabs */}
        <div className="mb-8 border-b">
          <div className="flex space-x-1 overflow-x-auto">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => attemptTabChange(tab.id)}
                className={`px-6 py-3 font-medium text-sm transition-colors whitespace-nowrap ${
                  activeTab === tab.id
                    ? "border-b-2 border-blue-600 text-blue-600"
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {tabError && (
          <div className="p-3 border border-red-200 bg-red-50 text-sm text-red-700 rounded-lg">
            {tabError}
          </div>
        )}
        {/* Registration Type */}
        {activeTab === "registration" && (
          <div className="space-y-6">
          <div className="border rounded-lg p-4 bg-white my-3">
            <label className="block font-medium text-black my-3">
                Registration Type <span className="text-red-500">*</span>
              </label>
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
              </div>
              {errors.registrationType && (
                <p className="text-red-600 text-sm mt-2">{errors.registrationType.message}</p>
              )}
            </div>
          </div>
        )}

        {/* Common Details Section */}
        {activeTab === "common" && (
          <div className="space-y-6">
            <div className="border rounded-lg p-4 bg-white">
              <h3 className="text-sm font-semibold text-black mb-4">Common Details (All Entities)</h3>
              
              <div className="space-y-4">
                {/* PAN */}
                <div>
                <label className="block font-medium text-black mb-1">
                  PAN (10-character tax ID) <span className="text-red-500">*</span>
                  </label>
                  <input
                    {...panRegister}
                    className="border rounded-lg px-3 py-2 w-full text-black focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder="ABCDE1234F"
                    maxLength={10}
                    onChange={(e) => {
                      e.target.value = e.target.value.toUpperCase();
                      panRegister.onChange(e);
                    }}
                  />
                  {errors.pan && <p className="text-red-600 text-sm mt-1">{errors.pan.message}</p>}
                {!errors.pan && (
                  <p className="text-xs text-gray-500 mt-1">Enter PAN (10 characters).</p>
                )}
                </div>

                {/* Address */}
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

                {/* Row: Authorized Signatory + Designation */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block font-medium text-black mb-1">
                      Authorised Signatory Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      {...register("authSignatoryName", { required: "Authorised Signatory Name is required" })}
                      className="border rounded-lg px-3 py-2 w-full text-black focus:ring-2 focus:ring-blue-500 outline-none"
                      placeholder="Name as per authorization"
                    />
                    {errors.authSignatoryName && <p className="text-red-600 text-sm mt-1">{errors.authSignatoryName.message}</p>}
                  </div>

                  <div>
                    <label className="block font-medium text-black mb-1">
                      Designation
                    </label>
                    <input
                      {...register("designation")}
                      className="border rounded-lg px-3 py-2 w-full text-black focus:ring-2 focus:ring-blue-500 outline-none"
                      placeholder="Partner / Director / Trustee / Officer"
                    />
                  </div>
                </div>

                {/* Row: Mobile + Email */}
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
                          message: "Mobile Number must be 10 digits"
                        }
                      })}
                      className="border rounded-lg px-3 py-2 w-full text-black focus:ring-2 focus:ring-blue-500 outline-none"
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
                          message: "Invalid Email Address"
                        }
                      })}
                      className="border rounded-lg px-3 py-2 w-full text-black focus:ring-2 focus:ring-blue-500 outline-none"
                      placeholder="official@email.com"
                    />
                    {errors.email && <p className="text-red-600 text-sm mt-1">{errors.email.message}</p>}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === "entity" && (
          <div className="space-y-6">
            {/* Row: Entity Name + Entity Type */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Entity Name */}
              <div>
                <label className="block font-medium text-black mb-1">
                  Name of Entity / Applicant <span className="text-red-500">*</span>
                </label>
                <input
                  {...register("entityName", { required: "Name of Entity / Applicant is required" })}
                  className="border rounded-lg px-3 py-2 w-full text-black focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="e.g. M/s. XYZ Developers LLP"
                />
                {errors.entityName && <p className="text-red-600 text-sm mt-1">{errors.entityName.message}</p>}
              </div>

              {/* Entity Type */}
              <div>
                <label className="block font-medium text-black mb-1">
                  Entity Type <span className="text-red-500">*</span>
                </label>
                <select
                  {...register("entityType", { required: "Entity Type is required" })}
                  className="border rounded-lg px-3 py-2 w-full text-black focus:ring-2 focus:ring-blue-500 outline-none"
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

            {/* Document Checklist */}
            <div className="border rounded-lg p-4 bg-white">
              <h3 className="text-sm font-semibold text-black mb-3">
                Document Checklist (Required for Selected Entity Type)
              </h3>
              {entityType ? (
                <div className="space-y-2">
                  {docsForEntity.map((doc) => (
                    <label key={doc} className="flex items-start gap-2 text-sm cursor-pointer">
                      <input
                        type="checkbox"
                        className="mt-0.5"
                        checked={docSelections.includes(doc)}
                        disabled={docNoneSelected}
                        onChange={() => toggleDocumentSelection(doc)}
                      />
                      <span>{doc}</span>
                    </label>
                  ))}
                  <label className="flex items-start gap-2 text-sm cursor-pointer font-medium text-gray-800">
                    <input
                      type="checkbox"
                      className="mt-0.5"
                      checked={docNoneSelected}
                      onChange={handleNoneSelection}
                    />
                    <span>None of the above / Will submit later</span>
                  </label>
                  <p className="text-xs text-gray-500">
                    Select documents applicable to your entity or choose &ldquo;None&rdquo; if not available.
                  </p>
                </div>
              ) : (
                <p className="text-sm text-gray-600">Select an entity type to view the checklist.</p>
              )}
            </div>
          </div>
        )}

        {/* Entity-Specific Sections */}
        {activeTab === "entitySpecific" && (
          <div className="space-y-6">
            {!entityType && (
              <div className="border rounded-lg p-4 bg-yellow-50 text-yellow-800 text-sm">
                Select an entity type in the previous step to load its specific details.
              </div>
            )}

            {entityType === "Proprietorship / Individual" && (
          <div className="border rounded-lg p-4 bg-white">
            <h3 className="text-sm font-semibold text-black mb-4">Proprietorship / Individual Details</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block font-medium text-black mb-1">
                  Full Name of Proprietor <span className="text-red-500">*</span>
            </label>
                <input
                  {...register("fullNameProprietor", { required: "Full Name is required" })}
                  className="border rounded-lg px-3 py-2 w-full text-black focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="Name as per PAN / Aadhaar"
                />
                {errors.fullNameProprietor && <p className="text-red-600 text-sm mt-1">{errors.fullNameProprietor.message}</p>}
              </div>

              <div>
                <label className="block font-medium text-black mb-1">
                  Aadhaar No.
                </label>
            <input
                  {...register("aadhaarNo")}
                  className="border rounded-lg px-3 py-2 w-full text-black focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="XXXX-XXXX-XXXX"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block font-medium text-black mb-1">
                  Residential Address
                </label>
                <textarea
                  {...register("residentialAddress")}
                  className="border rounded-lg px-3 py-2 w-full h-20 text-black focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="Enter complete residential address"
                />
              </div>
            </div>
          </div>
        )}

            {entityType === "Partnership Firm" && (
          <div className="border rounded-lg p-4 bg-white">
            <h3 className="text-sm font-semibold text-black mb-4">Partnership Firm Details</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block font-medium text-black mb-1">
                  Firm Registration No. (if registered)
                </label>
                <input
                  {...register("firmRegistrationNo")}
                  className="border rounded-lg px-3 py-2 w-full text-black focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="As per Registrar of Firms"
                />
          </div>

          <div>
            <label className="block font-medium text-black mb-1">
                  Date of Registration
            </label>
                <input
                  type="date"
                  {...register("partnershipRegistrationDate")}
                  className="border rounded-lg px-3 py-2 w-full text-black focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>

              <div>
                <label className="block font-medium text-black mb-1">
                  Number of Partners
                </label>
            <input
              type="number"
                  {...register("numberOfPartners")}
                  className="border rounded-lg px-3 py-2 w-full text-black focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="Total partners"
                />
              </div>

              <div>
                <label className="block font-medium text-black mb-1">
                  Upload Partnership Deed
                </label>
                <input
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  {...register("partnershipDeedFile")}
                  className="border rounded-lg px-3 py-2 w-full text-black focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>

              <div>
                <label className="block font-medium text-black mb-1">
                  Upload Firm Registration Certificate (if applicable)
                </label>
                <input
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  {...register("firmRegistrationCertFile")}
                  className="border rounded-lg px-3 py-2 w-full text-black focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
            </div>
          </div>
        )}

            {entityType === "Pvt. Ltd. / Ltd. Company" && (
          <div className="border rounded-lg p-4 bg-white">
            <h3 className="text-sm font-semibold text-black mb-4">Pvt. Ltd. / Ltd. Company Details</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block font-medium text-black mb-1">
                  CIN (Corporate Identification Number)
                </label>
                <input
                  {...register("cin")}
                  className="border rounded-lg px-3 py-2 w-full text-black focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="L/UXXXXXXXXXX"
                />
        </div>

          <div>
            <label className="block font-medium text-black mb-1">
                  ROC Registration Date
                </label>
                <input
                  type="date"
                  {...register("rocRegistrationDate")}
                  className="border rounded-lg px-3 py-2 w-full text-black focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block font-medium text-black mb-1">
                  Registered Office Address
            </label>
                <textarea
                  {...register("registeredOfficeAddress")}
                  className="border rounded-lg px-3 py-2 w-full h-20 text-black focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="As per ROC records"
                />
              </div>

              <div>
                <label className="block font-medium text-black mb-1">
                  Upload MOA & AOA (combined PDF)
                </label>
            <input
              type="file"
                  accept=".pdf"
                  {...register("moaAoaFile")}
                  className="border rounded-lg px-3 py-2 w-full text-black focus:ring-2 focus:ring-blue-500 outline-none"
                />
          </div>

          <div>
            <label className="block font-medium text-black mb-1">
                  Upload Board Resolution authorising signatory
            </label>
            <input
              type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  {...register("boardResolutionFile")}
                  className="border rounded-lg px-3 py-2 w-full text-black focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
            </div>
          </div>
        )}

            {entityType === "LLP" && (
          <div className="border rounded-lg p-4 bg-white">
            <h3 className="text-sm font-semibold text-black mb-4">LLP Details</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block font-medium text-black mb-1">
                  LLPIN (LLP Identification No.)
                </label>
                <input
                  {...register("llpin")}
                  className="border rounded-lg px-3 py-2 w-full text-black focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="AAX-XXXX"
                />
        </div>

          <div>
            <label className="block font-medium text-black mb-1">
                  Date of Incorporation
            </label>
            <input
                  type="date"
                  {...register("llpIncorporationDate")}
                  className="border rounded-lg px-3 py-2 w-full text-black focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>

              <div>
                <label className="block font-medium text-black mb-1">
                  Number of Designated Partners
                </label>
                <input
              type="number"
                  {...register("numberOfDesignatedPartners")}
                  className="border rounded-lg px-3 py-2 w-full text-black focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="Total designated partners"
                />
              </div>

              <div>
                <label className="block font-medium text-black mb-1">
                  Upload LLP Agreement
                </label>
                <input
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  {...register("llpAgreementFile")}
                  className="border rounded-lg px-3 py-2 w-full text-black focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>

              <div>
                <label className="block font-medium text-black mb-1">
                  Upload Resolution / Authorization
                </label>
                <input
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  {...register("llpResolutionFile")}
                  className="border rounded-lg px-3 py-2 w-full text-black focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
            </div>
          </div>
        )}

            {entityType === "Trust / Society" && (
          <div className="border rounded-lg p-4 bg-white">
            <h3 className="text-sm font-semibold text-black mb-4">Trust / Society Details</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block font-medium text-black mb-1">
                  Registration No.
                </label>
                <input
                  {...register("trustRegistrationNo")}
                  className="border rounded-lg px-3 py-2 w-full text-black focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="As per Charity Commissioner / Registrar"
                />
              </div>

              <div>
                <label className="block font-medium text-black mb-1">
                  Date of Registration
                </label>
                <input
                  type="date"
                  {...register("trustRegistrationDate")}
                  className="border rounded-lg px-3 py-2 w-full text-black focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block font-medium text-black mb-1">
                  Registered Address
                </label>
                <textarea
                  {...register("trustRegisteredAddress")}
                  className="border rounded-lg px-3 py-2 w-full h-20 text-black focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="As per registration certificate"
                />
              </div>

              <div>
                <label className="block font-medium text-black mb-1">
                  Upload Trust Deed / Bye-laws
                </label>
                <input
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  {...register("trustDeedFile")}
                  className="border rounded-lg px-3 py-2 w-full text-black focus:ring-2 focus:ring-blue-500 outline-none"
                />
          </div>

          <div>
            <label className="block font-medium text-black mb-1">
                  Upload Registration Certificate
            </label>
                <input
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  {...register("trustRegistrationCertFile")}
                  className="border rounded-lg px-3 py-2 w-full text-black focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>

              <div>
                <label className="block font-medium text-black mb-1">
                  Upload Resolution authorising signatory
                </label>
            <input
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  {...register("trustResolutionFile")}
                  className="border rounded-lg px-3 py-2 w-full text-black focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
            </div>
          </div>
        )}

            {entityType === "Govt. / PSU / Local Body" && (
          <div className="border rounded-lg p-4 bg-white">
            <h3 className="text-sm font-semibold text-black mb-4">Government / PSU / Local Body Details</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block font-medium text-black mb-1">
                  Department / Undertaking Name <span className="text-red-500">*</span>
                </label>
                <input
                  {...register("departmentName", { required: entityType === "Govt. / PSU / Local Body" ? "Department Name is required" : false })}
                  className="border rounded-lg px-3 py-2 w-full text-black focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="e.g. MHADA / MMRDA / BMC / XYZ Dept."
                />
                {errors.departmentName && <p className="text-red-600 text-sm mt-1">{errors.departmentName.message}</p>}
        </div>

        <div>
          <label className="block font-medium text-black mb-1">
                  Office Order / Authorization Reference
          </label>
                <input
                  {...register("officeOrderRef")}
                  className="border rounded-lg px-3 py-2 w-full text-black focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="GO / Office order number"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block font-medium text-black mb-1">
                  Office Address
                </label>
          <textarea
                  {...register("officeAddress")}
                  className="border rounded-lg px-3 py-2 w-full h-20 text-black focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="Complete office address"
                />
        </div>

          <div>
            <label className="block font-medium text-black mb-1">
                  Upload Authorization / Office Order
            </label>
            <input
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  {...register("officeOrderFile")}
                  className="border rounded-lg px-3 py-2 w-full text-black focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
            </div>
          </div>
        )}
          </div>
        )}

        {activeTab === "credentialsUploads" && (
          <div className="space-y-6">
            {/* Login Credentials */}
            <div className="border rounded-lg p-4 bg-white">
              <h3 className="text-sm font-semibold text-black mb-4">Login Credentials (Portal Access)</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block font-medium text-black mb-1">
                    Preferred Login ID <span className="text-red-500">*</span>
                  </label>
                  <input
                    {...register("loginId", { required: "Login ID is required" })}
                    className="border rounded-lg px-3 py-2 w-full text-black focus:ring-2 focus:ring-blue-500 outline-none"
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
                    className="border rounded-lg px-3 py-2 w-full text-black focus:ring-2 focus:ring-blue-500 outline-none"
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
                      validate: (value, formValues) => value === formValues.password || "Password & Confirm Password must match."
                    })}
                    className="border rounded-lg px-3 py-2 w-full text-black focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder="Re-enter password"
                  />
                  {errors.confirmPassword && <p className="text-red-600 text-sm mt-1">{errors.confirmPassword.message}</p>}
                </div>
              </div>
            </div>

            {/* Common Uploads */}
            <div className="border rounded-lg p-4 bg-white">
              <h3 className="text-sm font-semibold text-black mb-4">Uploads (Common)</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-start">
                <div>
                  <label className="block font-medium text-black mb-1" style={{ minHeight: '40px', display: 'flex', alignItems: 'flex-start' }}>
                    Photograph of Authorised Signatory <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="file"
                    accept="image/*"
                    {...register("photoFile", { required: "Photo is required" })}
                    className="border rounded-lg px-3 py-2 w-full text-black focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                  {errors.photoFile && <p className="text-red-600 text-sm mt-1">{errors.photoFile.message}</p>}
                </div>

                <div>
                  <label className="block font-medium text-black mb-3" style={{ minHeight: '40px', display: 'flex', alignItems: 'flex-start' }}>
                    Signature of Authorised Signatory <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="file"
                    accept="image/*"
                    {...register("signatureFile", { required: "Signature image is required" })}
                    className="border rounded-lg px-3 py-2 w-full text-black focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                  {errors.signatureFile && <p className="text-red-600 text-sm mt-1">{errors.signatureFile.message}</p>}
                </div>

                <div>
                  <label className="block font-medium text-black mb-1" style={{ minHeight: '40px', display: 'flex', alignItems: 'flex-start' }}>
                    Identity Proof (PAN / Aadhaar / Passport)
                  </label>
                  <input
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png"
                    {...register("idProofFile")}
                    className="border rounded-lg px-3 py-2 w-full text-black focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Submit */}
            <div className="text-center mt-4">
              <button
                type="submit"
                className="bg-blue-600 text-white px-10 py-2 rounded-lg font-medium shadow hover:bg-blue-700 transition"
              >
                Submit Registration
              </button>
            </div>
          </div>
        )}
        {/* Navigation Buttons */}
        <div className="flex justify-between mt-8 pt-6 border-t">
          <button
            type="button"
            onClick={goToPreviousTab}
            disabled={activeTab === tabs[0].id}
            className={`px-6 py-2 rounded-lg font-medium transition ${
              activeTab === tabs[0].id
                ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                : "bg-blue-500 text-white shadow hover:bg-blue-600"
            }`}
          >
            Previous
          </button>
          {activeTab === "credentialsUploads" ? (
            <span />
          ) : (
            <button
              type="button"
              onClick={goToNextTab}
              className="bg-blue-600 text-white px-6 py-2 rounded-lg font-medium shadow hover:bg-blue-700 transition"
            >
              Next
            </button>
          )}
        </div>
      </form>
    </div>
  );
};

export default RegistrationForm;
