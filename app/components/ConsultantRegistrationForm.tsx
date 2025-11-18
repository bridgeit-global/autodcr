"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";

interface ConsultantRegistrationFormProps {
  title?: string;
}

const ConsultantRegistrationForm: React.FC<ConsultantRegistrationFormProps> = ({
  title = "Consultant Registration"
}) => {
  const router = useRouter();
  const [formError, setFormError] = useState("");
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [notificationError, setNotificationError] = useState("");
  
  // Form state to preserve data across sections
  const [formData, setFormData] = useState({
    // Profile
    consultantType: "",
    city: "",
    pincode: "",
    email: "",
    alternatePhone: "",
    pan: "",
    address: "",
    state: "",
    authorizedSignatoryPhotoFile: null as File | null,
    authorizedSignatorySignatureFile: null as File | null,
    // Credentials
    coaRegNo: "",
    coaExpiryDate: "",
    otherRegId: "",
    otherRegExpiryDate: "",
    // Files
    addressProofFile: null as File | null,
    profileStatementFile: null as File | null,
    // Login
    loginId: "",
    password: "",
    confirmPassword: "",
    acceptDeclaration: false,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleInputChange = (field: string, value: string | boolean) => {
    const normalizedValue =
      field === "pan" && typeof value === "string" ? value.toUpperCase() : value;
    setFormData(prev => {
      const updated = {
        ...prev,
        [field]: normalizedValue
      };
      validateField(field, normalizedValue, updated);
      if (field === "password") {
        validateField("confirmPassword", updated.confirmPassword, updated);
      }
      if (field === "confirmPassword") {
        validateField("password", updated.password, updated);
      }
      return updated;
    });
  };

  const handleFileChange = (field: string, file: File | null) => {
    setFormData(prev => {
      const updated = {
        ...prev,
        [field]: file
      };
      validateField(field, file, updated);
      return updated;
    });
  };

  const sections = [
    { id: "consultant-profile", label: "Profile" },
    { id: "consultant-credentials", label: "Credentials & Uploads" },
    { id: "consultant-login", label: "Login & Declaration" },
  ];

  const profileFields: readonly string[] = [
    "consultantType",
    "email",
    "city",
    "pincode",
    "address",
    "state",
    "alternatePhone",
    "pan",
  ];

  const credentialFields: readonly string[] = [
    "coaRegNo",
    "coaExpiryDate",
    "authorizedSignatoryPhotoFile",
    "authorizedSignatorySignatureFile",
    "addressProofFile",
    "profileStatementFile",
  ];

  const loginFields: readonly string[] = ["loginId", "password", "confirmPassword", "acceptDeclaration"];

  const requiredFields = [...profileFields, ...credentialFields, ...loginFields];

  const scrollToSection = (sectionId: string) => {
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const pincodeRegex = /^\d{6}$/;
  const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]$/;

  const setFieldError = (field: string, error: string) => {
    setErrors((prev) => {
      if (error) {
        if (prev[field] === error) {
          return prev;
        }
        return { ...prev, [field]: error };
      }
      if (!(field in prev)) {
        return prev;
      }
      const next = { ...prev };
      delete next[field];
      return next;
    });
  };

  const validateField = (
    field: string,
    value: unknown,
    data: typeof formData = formData
  ): boolean => {
    let error = "";

    switch (field) {
      case "consultantType":
        if (!value) error = "Select a consultant type";
        break;
      case "email":
        if (!value) error = "Email is required";
        else if (!emailRegex.test(value as string)) error = "Enter a valid email address";
        break;
      case "city":
        if (!value) error = "City is required";
        break;
      case "alternatePhone":
        if (!value) error = "Phone number is required";
        else if (!/^\d{10}$/.test(value as string)) {
          error = "Phone number must be 10 digits";
        }
        break;
      case "pincode":
        if (!value) error = "Pincode is required";
        else if (!pincodeRegex.test(value as string)) error = "Enter a 6-digit pincode";
        break;
      case "address":
        if (!value) error = "Address is required";
        break;
      case "state":
        if (!value) error = "State is required";
        break;
      case "pan":
        if (!value) error = "PAN is required";
        else if (!panRegex.test(value as string)) {
          error = "Enter valid PAN: first 5 letters, 4 digits, last letter";
        }
        break;
      case "authorizedSignatoryPhotoFile":
        if (!value) error = "Upload photograph";
        break;
      case "authorizedSignatorySignatureFile":
        if (!value) error = "Upload signature";
        break;
      case "coaRegNo":
        if (!value) error = "COA registration number is required";
        break;
      case "coaExpiryDate":
        if (!value) {
          error = "Select expiry date";
        } else {
          const selected = new Date(value as string);
          selected.setHours(0, 0, 0, 0);
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          if (selected < today) {
            error = "Expiry date cannot be in the past";
          }
        }
        break;
      case "addressProofFile":
        if (!value) error = "Upload address proof";
        break;
      case "profileStatementFile":
        if (!value) error = "Upload profile/capability statement";
        break;
      case "loginId":
        if (!value) error = "Login ID is required";
        else if (!emailRegex.test(value as string)) error = "Enter a valid email address";
        break;
      case "password":
        if (!value) error = "Password is required";
        else if ((value as string).length < 8) error = "Password must be at least 8 characters";
        break;
      case "confirmPassword":
        if (!value) error = "Confirm your password";
        else if (value !== data.password) error = "Passwords must match";
        break;
      case "acceptDeclaration":
        if (!value) error = "You must accept the declaration";
        break;
      default:
        break;
    }

    setFieldError(field, error);
    return !error;
  };

  const validateFields = (fields: readonly string[]) => {
    let valid = true;
    fields.forEach((field) => {
      const value = (formData as Record<string, unknown>)[field];
      if (!validateField(field, value)) {
        valid = false;
      }
    });
    return valid;
  };

  const handleNotificationChange = (checked: boolean) => {
    setNotificationsEnabled(checked);
    if (!checked) {
      setNotificationError("Enable notifications to receive critical alerts.");
    } else {
      setNotificationError("");
      setFormError("");
    }
  };

  const handleSubmitForm = () => {
    const isValid = validateFields(requiredFields);
    if (!isValid) {
      setFormError("Please complete all required details before submitting.");
      return;
    }
    if (!notificationsEnabled) {
      setNotificationError("Enable notifications to receive critical alerts.");
      setFormError("Please enable notifications to continue.");
      return;
    }
    setFormError("");
    // Placeholder submit handler
    alert("Submitted successfully!");
  };

  const getExpiryStatus = () => {
    if (!formData.coaExpiryDate) return null;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const expiryDate = new Date(formData.coaExpiryDate);
    expiryDate.setHours(0, 0, 0, 0);

    const diffInMs = expiryDate.getTime() - today.getTime();
    const diffInDays = Math.ceil(diffInMs / (1000 * 60 * 60 * 24));

    if (diffInDays > 30) {
      return {
        label: "Active",
        description: "expiry is more than 30 days away",
        icon: <div className="w-3 h-3 rounded-full bg-green-500"></div>,
      };
    }

    if (diffInDays >= 0) {
      return {
        label: "Expiring Soon",
        description: "within 30 days",
        icon: <div className="w-3 h-3 rounded-full bg-orange-500"></div>,
      };
    }

    return {
      label: "Expired",
      description: "past date (also blocked by validation)",
      icon: (
        <div className="w-0 h-0 border-l-[6px] border-r-[6px] border-t-[10px] border-l-transparent border-r-transparent border-t-red-500"></div>
      ),
    };
  };

  const expiryStatus = getExpiryStatus();

  return (
    <div className="max-w-4xl mx-auto p-8">
      {/* Header */}
      <div className="mb-6 pb-3 border-b">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-2">
          <h2 className="text-2xl font-bold text-black">{title}</h2>
          <button
            onClick={() => router.push("/")}
            className="flex items-center gap-2 px-4 py-2 text-gray-700 hover:text-gray-900 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors self-start sm:self-auto"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            <span className="font-medium">Back to Home</span>
          </button>
        </div>
        {/* Breadcrumb */}
        <nav className="text-sm text-gray-600">
          <span>Dashboard</span>
          <span className="mx-2">›</span>
          <span>Registrations</span>
          <span className="mx-2">›</span>
          <span className="text-black font-medium">Consultant</span>
        </nav>
      </div>

      {/* Navigation Menu */}
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

      <div className="space-y-6">
        {formError && (
          <div className="p-3 border border-red-200 bg-red-50 text-sm text-red-700 rounded-lg">
            {formError}
          </div>
        )}

        {/* Profile Section */}
          <div className="space-y-6">
            {/* Basic Details Section */}
            <div className="border rounded-lg p-4 bg-white">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-8 h-8 flex items-center justify-center bg-blue-100 rounded-lg">
                  <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-black">
                  Basic Details
                </h3>
              </div>
              <p className="text-sm text-gray-600 mb-4 ml-11">
                Tell us who you are
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Row 1 */}
                <div>
                  <label className="block font-medium text-black mb-1">
                    Consultant Type *
                  </label>
                  <select 
                    value={formData.consultantType}
                    onChange={(e) => handleInputChange("consultantType", e.target.value)}
                    className="border rounded-lg px-3 py-2 h-10 w-full text-black focus:ring-2 focus:ring-blue-500 outline-none"
                  >
                    <option value="">Select</option>
                    <option>Architect</option>
                    <option>Structural Engineer</option>
                    <option>PMC/Project Management Consultant</option>
                    <option>MEP Engineer</option>
                    <option>Licensed Surveyor</option>
                    <option>Town Planner</option>
                    <option>Legal Consultant</option>
                    <option>Liaison/Approval Consultant</option>
                    <option>Environmental Consultant</option>
                    <option>Valuer</option>
                  </select>
                  {errors.consultantType && (
                    <p className="text-xs text-red-600 mt-1">{errors.consultantType}</p>
                  )}
                </div>

                <div>
                  <label className="block font-medium text-black mb-1">
                    Email *
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => handleInputChange("email", e.target.value)}
                      className="border rounded-lg px-3 py-2 h-10 flex-1 text-black focus:ring-2 focus:ring-blue-500 outline-none"
                      placeholder="name@example.com"
                    />
                    <button
                      type="button"
                      className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 transition whitespace-nowrap"
                    >
                      Verify
                    </button>
                  </div>
                  {errors.email && (
                    <p className="text-xs text-red-600 mt-1">{errors.email}</p>
                  )}
                </div>

                {/* Row 2 */}
                <div>
                  <label className="block font-medium text-black mb-1">
                    City *
                  </label>
                  <input
                    value={formData.city}
                    onChange={(e) => handleInputChange("city", e.target.value)}
                    className="border rounded-lg px-3 py-2 h-10 w-full text-black focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder="Enter City"
                  />
                  {errors.city && (
                    <p className="text-xs text-red-600 mt-1">{errors.city}</p>
                  )}
                </div>

                <div>
                  <label className="block font-medium text-black mb-1">
                    Phone Number
                  </label>
                  <div className="flex gap-2">
                    <input
                      value={formData.alternatePhone}
                      onChange={(e) => handleInputChange("alternatePhone", e.target.value)}
                      className="border rounded-lg px-3 py-2 h-10 flex-1 text-black focus:ring-2 focus:ring-blue-500 outline-none"
                      placeholder="Optional"
                    />
                    <button
                      type="button"
                      className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 transition whitespace-nowrap"
                    >
                      Verify
                    </button>
                  </div>
                  {errors.alternatePhone && (
                    <p className="text-xs text-red-600 mt-1">{errors.alternatePhone}</p>
                  )}
                </div>

                {/* Row 3 */}
                <div>
                  <label className="block font-medium text-black mb-1">
                    Pincode *
                  </label>
                  <input
                    value={formData.pincode}
                    onChange={(e) => handleInputChange("pincode", e.target.value)}
                    className="border rounded-lg px-3 py-2 h-10 w-full text-black focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder="Enter Pincode"
                  />
                  {errors.pincode && (
                    <p className="text-xs text-red-600 mt-1">{errors.pincode}</p>
                  )}
                </div>

                <div>
                  <label className="block font-medium text-black mb-1">
                    PAN
                  </label>
                  <input
                    value={formData.pan}
                    onChange={(e) => handleInputChange("pan", e.target.value)}
                    className="border rounded-lg px-3 py-2 h-10 w-full text-black focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder="ABCDE1234F"
                  />
                  {errors.pan && (
                    <p className="text-xs text-red-600 mt-1">{errors.pan}</p>
                  )}
                </div>

                {/* Row 4 */}
                <div>
                  <label className="block font-medium text-black mb-1">
                    Address *
                  </label>
                  <input
                    value={formData.address}
                    onChange={(e) => handleInputChange("address", e.target.value)}
                    className="border rounded-lg px-3 py-2 h-10 w-full text-black focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder="Office address"
                  />
                  {errors.address && (
                    <p className="text-xs text-red-600 mt-1">{errors.address}</p>
                  )}
                </div>

                <div>
                  <label className="block font-medium text-black mb-1">
                    State *
                  </label>
                  <input
                    value={formData.state}
                    onChange={(e) => handleInputChange("state", e.target.value)}
                    className="border rounded-lg px-3 py-2 h-10 w-full text-black focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder="Enter State"
                  />
                  {errors.state && (
                    <p className="text-xs text-red-600 mt-1">{errors.state}</p>
                  )}
                </div>

                {/* Row 5 intentionally left blank to keep layout balanced */}
              </div>
            </div>
          </div>

        {/* Credentials & Uploads Section */}
          <div className="space-y-8">
            {/* Registration Numbers Section */}
            <div className="border rounded-lg p-4 bg-white">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-8 h-8 flex items-center justify-center bg-blue-100 rounded-lg">
                  <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-black">
                  Registration Numbers
                </h3>
              </div>
              <p className="text-sm text-gray-600 mb-4 ml-11">
                Enter IDs & Expiry Dates
              </p>

              <div className="mb-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block font-medium text-black mb-1">
                      Council of Architecture (COA) Reg. No.
                    </label>
                    <input
                      value={formData.coaRegNo}
                      onChange={(e) => handleInputChange("coaRegNo", e.target.value)}
                      className="border rounded-lg px-3 py-2 h-10 w-full text-black focus:ring-2 focus:ring-blue-500 outline-none"
                      placeholder="Enter number"
                    />
                    {errors.coaRegNo && (
                      <p className="text-xs text-red-600 mt-1">{errors.coaRegNo}</p>
                    )}
                  </div>

                <div>
                  <label className="block font-medium text-black mb-1">
                    Validity / Expiry Date
                  </label>
                  <div className="relative">
                    <input
                      type="date"
                      value={formData.coaExpiryDate}
                      onChange={(e) => handleInputChange("coaExpiryDate", e.target.value)}
                      className="border rounded-lg px-3 py-2 pr-10 h-10 w-full text-black focus:ring-2 focus:ring-blue-500 outline-none cursor-pointer [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:right-2 [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                    />
                    <svg 
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-500 pointer-events-none"
                      fill="none" 
                      stroke="currentColor" 
                      viewBox="0 0 24 24"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                  {expiryStatus ? (
                    <div className="flex items-center gap-2 mt-2">
                      {expiryStatus.icon}
                      <span className="text-sm font-medium text-black">
                        {expiryStatus.label}
                      </span>
                      <span className="text-xs text-gray-600">
                        {expiryStatus.description}
                      </span>
                    </div>
                  ) : (
                    <p className="text-xs text-gray-500 mt-2">
                      Select an expiry date to view status.
                    </p>
                  )}
                  {errors.coaExpiryDate && (
                    <p className="text-xs text-red-600 mt-1">{errors.coaExpiryDate}</p>
                  )}
                </div>
                </div>
              </div>
            </div>

            {/* Documents Upload Section */}
            <div className="border rounded-lg p-4 bg-white">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-8 h-8 flex items-center justify-center bg-blue-100 rounded-lg">
                  <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-black">
                  Documents Upload
                </h3>
              </div>
              <p className="text-sm text-gray-600 mb-4 ml-11">
                Upload clear, legible copies (PDF/JPG)
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block font-medium text-black mb-1">
                    Authorized Signatory Photograph *
                  </label>
                  <input
                    type="file"
                    accept=".jpg,.jpeg,.png"
                    onChange={(e) =>
                      handleFileChange("authorizedSignatoryPhotoFile", e.target.files?.[0] || null)
                    }
                    className="border rounded-lg px-3 py-2 w-full text-black focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                  {formData.authorizedSignatoryPhotoFile && (
                    <p className="text-xs text-green-600 mt-1">
                      Selected: {formData.authorizedSignatoryPhotoFile.name}
                    </p>
                  )}
                  {errors.authorizedSignatoryPhotoFile && (
                    <p className="text-xs text-red-600 mt-1">{errors.authorizedSignatoryPhotoFile}</p>
                  )}
                </div>

                <div>
                  <label className="block font-medium text-black mb-1">
                    Authorized Signatory Signature *
                  </label>
                  <input
                    type="file"
                    accept=".jpg,.jpeg,.png"
                    onChange={(e) =>
                      handleFileChange("authorizedSignatorySignatureFile", e.target.files?.[0] || null)
                    }
                    className="border rounded-lg px-3 py-2 w-full text-black focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                  {formData.authorizedSignatorySignatureFile && (
                    <p className="text-xs text-green-600 mt-1">
                      Selected: {formData.authorizedSignatorySignatureFile.name}
                    </p>
                  )}
                  {errors.authorizedSignatorySignatureFile && (
                    <p className="text-xs text-red-600 mt-1">{errors.authorizedSignatorySignatureFile}</p>
                  )}
                </div>

                <div>
                  <label className="block font-medium text-black mb-1">
                    Address Proof *
                  </label>
                  <input
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png"
                    onChange={(e) => handleFileChange("addressProofFile", e.target.files?.[0] || null)}
                    className="border rounded-lg px-3 py-2 w-full text-black focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                  {formData.addressProofFile && (
                    <p className="text-xs text-green-600 mt-1">Selected: {formData.addressProofFile.name}</p>
                  )}
                  {errors.addressProofFile && (
                    <p className="text-xs text-red-600 mt-1">{errors.addressProofFile}</p>
                  )}
                </div>

                <div>
                  <label className="block font-medium text-black mb-1">
                    Profile/Capability Statement (PDF) *
                  </label>
                  <input
                    type="file"
                    accept=".pdf"
                    onChange={(e) => handleFileChange("profileStatementFile", e.target.files?.[0] || null)}
                    className="border rounded-lg px-3 py-2 w-full text-black focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                  {formData.profileStatementFile && (
                    <p className="text-xs text-green-600 mt-1">
                      Selected: {formData.profileStatementFile.name}
                    </p>
                  )}
                  {errors.profileStatementFile && (
                    <p className="text-xs text-red-600 mt-1">{errors.profileStatementFile}</p>
                  )}
                </div>
              </div>

              <p className="text-xs text-gray-500 mt-4">
                Max 10MB per file. Allowed: PDF, JPG, PNG.
              </p>
            </div>
          </div>

        {/* Login & Declaration Section */}
          <div className="space-y-8">
            {/* Login Setup Section */}
            <div className="border rounded-lg p-4 bg-white">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-8 h-8 flex items-center justify-center bg-blue-100 rounded-lg">
                  <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-black">
                  Login Setup
                </h3>
              </div>
              <p className="text-sm text-gray-600 mb-4 ml-11">
                Create your credentials
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block font-medium text-black mb-1">
                    Login ID *
                  </label>
                  <input
                    type="email"
                    value={formData.loginId}
                    onChange={(e) => handleInputChange("loginId", e.target.value)}
                    className="border rounded-lg px-3 py-2 h-10 w-full text-black focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder="Enter email ID"
                  />
                  {errors.loginId && (
                    <p className="text-xs text-red-600 mt-1">{errors.loginId}</p>
                  )}
                </div>

                <div>
                  <label className="block font-medium text-black mb-1">
                    Password *
                  </label>
                  <input
                    type="password"
                    value={formData.password}
                    onChange={(e) => handleInputChange("password", e.target.value)}
                    className="border rounded-lg px-3 py-2 h-10 w-full text-black focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder="At least 8 characters (letters & numbers)"
                  />
                  {errors.password && (
                    <p className="text-xs text-red-600 mt-1">{errors.password}</p>
                  )}
                </div>

                <div>
                  <label className="block font-medium text-black mb-1">
                    Confirm Password *
                  </label>
                  <input
                    type="password"
                    value={formData.confirmPassword}
                    onChange={(e) => handleInputChange("confirmPassword", e.target.value)}
                    className="border rounded-lg px-3 py-2 h-10 w-full text-black focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder="Re-enter password"
                  />
                  {errors.confirmPassword && (
                    <p className="text-xs text-red-600 mt-1">{errors.confirmPassword}</p>
                  )}
                </div>
              </div>

              {/* Notifications Section */}
              <div className="mt-6 p-4 border rounded-lg bg-gray-50">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-black">
                      Receive critical alerts on email & SMS
                    </p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
                    <input
                      type="checkbox"
                      checked={notificationsEnabled}
                      onChange={(e) => handleNotificationChange(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-300 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                    <span className="ml-3 text-sm font-medium text-black whitespace-nowrap">
                      Enable notifications
                    </span>
                  </label>
                </div>
                {notificationError && (
                  <p className="text-xs text-red-600 mt-2">{notificationError}</p>
                )}
              </div>
            </div>

            {/* Declaration Section */}
            <div className="border rounded-lg p-4 bg-white">
              <h3 className="text-lg font-semibold text-black mb-4">
                Declaration *
              </h3>

              <div className="border rounded-lg p-4 bg-gray-50 mb-4">
                <textarea
                  readOnly
                  className="w-full h-32 p-3 bg-white border rounded-lg text-sm text-black resize-none focus:outline-none"
                  value="I hereby declare that the information and documents submitted are true and correct to the best of my knowledge. I agree to abide by the portal Terms of Use and all applicable municipal/authority rules, and understand that any false information may result in blacklisting and/or legal action."
                />
              </div>

              <div className="flex items-start gap-3 mb-4">
                <input
                  type="checkbox"
                  checked={formData.acceptDeclaration}
                  onChange={(e) => handleInputChange("acceptDeclaration", e.target.checked)}
                  className="mt-1 w-4 h-4"
                />
                <label className="text-sm text-black">
                  I accept the declaration.
                </label>
              </div>
              {errors.acceptDeclaration && (
                <p className="text-xs text-red-600">{errors.acceptDeclaration}</p>
              )}

              <p className="text-xs text-gray-500">
                By submitting, you consent to verification of credentials with issuing bodies (COA, IEI, MCGM Empanelment, etc.)
              </p>
            </div>

          <div className="flex justify-end mt-8 pt-6 border-t">
            <button
              type="button"
              onClick={handleSubmitForm}
              className="bg-blue-600 text-white px-10 py-2 rounded-lg font-medium shadow hover:bg-blue-700 transition"
            >
              Submit
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ConsultantRegistrationForm;

