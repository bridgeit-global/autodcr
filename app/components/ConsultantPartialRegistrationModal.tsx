"use client";

import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import CustomSelect from "@/app/components/CustomSelect";
import { supabase } from "@/app/utils/supabase";
import {
  CONSULTANT_TYPE_OPTIONS,
  EXTRA_REG_REQUIRED_BY_TYPE,
  metadataToFormFields,
  normalizePhone,
  REGISTRATION_NUMBER_META_BY_TYPE,
} from "@/app/utils/consultantRegistrationShared";

export type PartialRegistrationSuccess = {
  user_id: string;
  email?: string;
  metadata?: Record<string, unknown>;
};

type Props = {
  open: boolean;
  consultantType: string;
  onClose: () => void;
  /** Newly created user, or existing incomplete user to use on the applicant form. */
  onSuccess: (result: PartialRegistrationSuccess) => void;
};

type FormState = Record<string, string>;

const emptyForm = (consultantType: string): FormState => ({
  consultantType,
  firstName: "",
  middleName: "",
  lastName: "",
  email: "",
  city: "",
  pincode: "",
  alternatePhone: "",
  pan: "",
  addressLine1: "",
  addressLine2: "",
  addressLine3: "",
  registrationDate: "",
  coaRegNo: "",
  coaExpiryDate: "",
  structuralLicenseNo: "",
  structuralValidity: "",
  qualification: "",
  lbsLicenseNo: "",
  competencyClass: "",
  lbsExpiryDate: "",
  electricalLicenseNo: "",
  electricalExpiryDate: "",
  pwdAccreditation: "",
  plumberLicenseNo: "",
  plumberExpiryDate: "",
  fireLicenseNo: "",
  fireValidityDate: "",
  landscapeLicenseNo: "",
  landscapeExpiryDate: "",
  pmcRegistrationNo: "",
  pmcExpiryDate: "",
  nablAccreditationNo: "",
  nablExpiryDate: "",
  geotechQualification: "",
  envLicenseNo: "",
  envExpiryDate: "",
  townPlannerLicenseNo: "",
  townPlannerExpiryDate: "",
});

type ResumePrompt = {
  user_id: string;
  email?: string;
  metadata: Record<string, unknown>;
  message: string;
};

export default function ConsultantPartialRegistrationModal({
  open,
  consultantType,
  onClose,
  onSuccess,
}: Props) {
  const [mounted, setMounted] = useState(false);
  const [formData, setFormData] = useState<FormState>(() =>
    emptyForm(consultantType)
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [checkingPhone, setCheckingPhone] = useState(false);
  const [resumePrompt, setResumePrompt] = useState<ResumePrompt | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    setFormData(emptyForm(consultantType));
    setErrors({});
    setFormError("");
    setResumePrompt(null);
    setIsSubmitting(false);
  }, [open, consultantType]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  const setField = (field: string, value: string) => {
    const normalized =
      field === "pan" ? value.toUpperCase() : field === "alternatePhone"
        ? value.replace(/\D/g, "").slice(0, 10)
        : value;
    setFormData((prev) => ({ ...prev, [field]: normalized }));
    setErrors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  };

  const validate = (): boolean => {
    const next: Record<string, string> = {};
    const require = (field: string, label: string) => {
      if (!String(formData[field] || "").trim()) next[field] = `${label} is required`;
    };
    require("firstName", "First name");
    require("lastName", "Last name");
    require("email", "Email");
    require("city", "City");
    require("pincode", "Pincode");
    require("alternatePhone", "Phone number");
    require("pan", "PAN");
    require("addressLine1", "Address line 1");
    require("registrationDate", "Registration date");

    const email = formData.email.trim();
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      next.email = "Enter a valid email";
    }
    const phone = normalizePhone(formData.alternatePhone);
    if (formData.alternatePhone && phone.length !== 10) {
      next.alternatePhone = "Enter a valid 10-digit phone number";
    }
    if (formData.pan && !/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(formData.pan.trim())) {
      next.pan = "Enter a valid PAN (e.g. ABCDE1234F)";
    }

    const mapping = REGISTRATION_NUMBER_META_BY_TYPE[formData.consultantType];
    if (mapping) {
      require(mapping.formField, mapping.label);
    }
    for (const field of EXTRA_REG_REQUIRED_BY_TYPE[formData.consultantType] || []) {
      require(field, field);
    }

    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const lookupPhone = async (): Promise<boolean> => {
    const phone = normalizePhone(formData.alternatePhone);
    if (phone.length !== 10) return true;

    setCheckingPhone(true);
    try {
      const res = await fetch("/api/consultants/lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
      });
      const data = await res.json();
      if (data.status === "complete") {
        setErrors((prev) => ({
          ...prev,
          alternatePhone: "This phone number is already registered",
        }));
        setFormError("This phone number is already registered");
        return false;
      }
      if (data.status === "incomplete" && data.user_id) {
        setResumePrompt({
          user_id: data.user_id,
          email: data.email,
          metadata: data.metadata || {},
          message:
            "This phone number is already registered with an incomplete profile. You can use this person on the applicant form now, or ask them to finish login creation and remaining sections on the Consultant Registration page.",
        });
        return false;
      }
      return true;
    } catch {
      setFormError("Failed to verify phone number. Please try again.");
      return false;
    } finally {
      setCheckingPhone(false);
    }
  };

  const lookupRegistration = async (): Promise<boolean> => {
    const mapping = REGISTRATION_NUMBER_META_BY_TYPE[formData.consultantType];
    if (!mapping) return true;
    const regNo = String(formData[mapping.formField] || "").trim();
    if (!regNo) return true;

    try {
      const res = await fetch("/api/consultants/lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          registrationNumber: regNo,
          consultantType: formData.consultantType,
        }),
      });
      const data = await res.json();
      if (data.status === "incomplete" || data.status === "complete") {
        setErrors((prev) => ({
          ...prev,
          [mapping.formField]: "This registration number is already registered",
        }));
        setFormError("This registration number is already registered");
        return false;
      }
      return true;
    } catch {
      setFormError("Failed to verify registration number. Please try again.");
      return false;
    }
  };

  const handlePhoneBlur = async () => {
    if (normalizePhone(formData.alternatePhone).length === 10) {
      await lookupPhone();
    }
  };

  const handleRegBlur = async () => {
    await lookupRegistration();
  };

  const handleUseExisting = () => {
    if (!resumePrompt) return;
    onSuccess({
      user_id: resumePrompt.user_id,
      email: resumePrompt.email,
      metadata: resumePrompt.metadata,
    });
  };

  const handlePrefillFromResume = () => {
    if (!resumePrompt) return;
    const fields = metadataToFormFields(resumePrompt.metadata);
    setFormData((prev) => ({
      ...prev,
      ...fields,
      consultantType: consultantType || fields.consultantType || prev.consultantType,
    }));
    setResumePrompt(null);
    setFormError(
      "Profile data loaded. Ask this consultant to finish remaining sections on /consultant. Click Use Existing Applicant below if you only need them on this project."
    );
  };

  const handleSubmit = async () => {
    setFormError("");
    setResumePrompt(null);
    if (!validate()) {
      setFormError("Please fill all the necessary fields");
      return;
    }

    const phoneOk = await lookupPhone();
    if (!phoneOk) return;
    const regOk = await lookupRegistration();
    if (!regOk) return;

    setIsSubmitting(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) {
        setFormError("You must be signed in to add a new consultant");
        return;
      }

      const res = await fetch("/api/consultants/partial", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(formData),
      });
      const data = await res.json();

      if (res.status === 409 && data.status === "incomplete" && data.user_id) {
        setResumePrompt({
          user_id: data.user_id,
          email: data.email,
          metadata: data.metadata || {},
          message:
            data.error ||
            "Already registered with an incomplete profile. Use this person or finish remaining steps on Consultant Registration.",
        });
        return;
      }

      if (!res.ok) {
        setFormError(data.error || "Failed to create consultant");
        return;
      }

      onSuccess({
        user_id: data.user_id,
        email: data.email,
        metadata: data.metadata,
      });
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : "Failed to create consultant"
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!open || !mounted) return null;

  const inputClass =
    "border border-gray-200 rounded-lg px-3 py-2 h-10 w-full text-black focus:ring-2 focus:ring-emerald-500 outline-none";
  const type = formData.consultantType;

  const modal = (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
        aria-hidden
      />
      <div className="relative w-full max-w-3xl max-h-[90vh] overflow-y-auto bg-gray-50 rounded-2xl shadow-xl border border-gray-200">
        <div className="sticky top-0 z-10 bg-white border-b border-gray-200 px-6 py-4 flex items-start justify-between gap-4 rounded-t-2xl">
          <div>
            <h2 className="text-lg font-bold text-gray-900 uppercase tracking-wide">
              Consultant Registration
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              Enter basic details and registration numbers. Login and documents
              can be completed later on the full registration page.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-500 hover:text-gray-800 text-2xl leading-none px-2"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div className="p-6 space-y-6">
          {formError && (
            <div className="p-4 border border-red-200 bg-red-50 rounded-lg text-red-800 text-sm">
              {formError}
            </div>
          )}

          {resumePrompt && (
            <div className="p-4 border border-amber-200 bg-amber-50 rounded-lg space-y-3">
              <p className="text-sm text-amber-900 font-medium">
                {resumePrompt.message}
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={handleUseExisting}
                  className="bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-emerald-700"
                >
                  Use Existing Applicant
                </button>
                <button
                  type="button"
                  onClick={handlePrefillFromResume}
                  className="bg-white border border-amber-300 text-amber-900 px-4 py-2 rounded-lg text-sm font-medium hover:bg-amber-100"
                >
                  Load Profile Into Form
                </button>
                <button
                  type="button"
                  onClick={() => setResumePrompt(null)}
                  className="text-amber-800 px-3 py-2 text-sm underline"
                >
                  Dismiss
                </button>
              </div>
            </div>
          )}

          {/* Basic Details */}
          <div
            id="section-basic-details"
            className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm ring-2 ring-emerald-500 ring-opacity-20"
          >
            <h3 className="text-lg font-semibold text-black mb-1">Basic Details</h3>
            <p className="text-sm text-gray-600 mb-4">Tell us who you are</p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block font-medium text-black mb-1">
                  Consultant Type <span className="text-red-600 font-bold">*</span>
                </label>
                <CustomSelect
                  value={formData.consultantType}
                  onChange={() => {}}
                  options={CONSULTANT_TYPE_OPTIONS.map((t) => ({
                    value: t,
                    label: t,
                  }))}
                  placeholder="Select Consultant Type"
                  className="w-full"
                  disabled
                />
              </div>

              <div>
                <label className="block font-medium text-black mb-1">
                  First Name <span className="text-red-600 font-bold">*</span>
                </label>
                <input
                  value={formData.firstName}
                  onChange={(e) => setField("firstName", e.target.value)}
                  className={inputClass}
                  placeholder="Enter First Name"
                />
                {errors.firstName && (
                  <p className="text-xs text-red-600 mt-1">{errors.firstName}</p>
                )}
              </div>

              <div>
                <label className="block font-medium text-black mb-1">Middle Name</label>
                <input
                  value={formData.middleName}
                  onChange={(e) => setField("middleName", e.target.value)}
                  className={inputClass}
                  placeholder="Enter Middle Name"
                />
              </div>

              <div>
                <label className="block font-medium text-black mb-1">
                  Last Name <span className="text-red-600 font-bold">*</span>
                </label>
                <input
                  value={formData.lastName}
                  onChange={(e) => setField("lastName", e.target.value)}
                  className={inputClass}
                  placeholder="Enter Last Name"
                />
                {errors.lastName && (
                  <p className="text-xs text-red-600 mt-1">{errors.lastName}</p>
                )}
              </div>

              <div>
                <label className="block font-medium text-black mb-1">
                  Email <span className="text-red-600 font-bold">*</span>
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setField("email", e.target.value)}
                  className={inputClass}
                  placeholder="name@example.com"
                />
                {errors.email && (
                  <p className="text-xs text-red-600 mt-1">{errors.email}</p>
                )}
              </div>

              <div>
                <label className="block font-medium text-black mb-1">
                  City <span className="text-red-600 font-bold">*</span>
                </label>
                <input
                  value={formData.city}
                  onChange={(e) => setField("city", e.target.value)}
                  className={inputClass}
                  placeholder="Enter City"
                />
                {errors.city && (
                  <p className="text-xs text-red-600 mt-1">{errors.city}</p>
                )}
              </div>

              <div>
                <label className="block font-medium text-black mb-1">
                  Phone Number <span className="text-red-600 font-bold">*</span>
                </label>
                <input
                  value={formData.alternatePhone}
                  onChange={(e) => setField("alternatePhone", e.target.value)}
                  onBlur={handlePhoneBlur}
                  className={inputClass}
                  placeholder="Enter 10-digit phone number"
                />
                {errors.alternatePhone && (
                  <p className="text-xs text-red-600 mt-1">{errors.alternatePhone}</p>
                )}
                {checkingPhone && (
                  <p className="text-xs text-gray-500 mt-1">Checking phone…</p>
                )}
              </div>

              <div>
                <label className="block font-medium text-black mb-1">
                  Pincode <span className="text-red-600 font-bold">*</span>
                </label>
                <input
                  value={formData.pincode}
                  onChange={(e) => setField("pincode", e.target.value)}
                  className={inputClass}
                  placeholder="Enter Pincode"
                />
                {errors.pincode && (
                  <p className="text-xs text-red-600 mt-1">{errors.pincode}</p>
                )}
              </div>

              <div>
                <label className="block font-medium text-black mb-1">
                  PAN <span className="text-red-600 font-bold">*</span>
                </label>
                <input
                  value={formData.pan}
                  onChange={(e) => setField("pan", e.target.value)}
                  className={inputClass}
                  placeholder="ABCDE1234F"
                />
                {errors.pan && (
                  <p className="text-xs text-red-600 mt-1">{errors.pan}</p>
                )}
              </div>

              <div className="md:col-span-2">
                <label className="block font-medium text-black mb-1">
                  Address Line 1 <span className="text-red-600 font-bold">*</span>
                </label>
                <input
                  value={formData.addressLine1}
                  onChange={(e) => setField("addressLine1", e.target.value)}
                  className={inputClass}
                  placeholder="Building / Street / Area"
                />
                {errors.addressLine1 && (
                  <p className="text-xs text-red-600 mt-1">{errors.addressLine1}</p>
                )}
              </div>

              <div className="md:col-span-2">
                <label className="block font-medium text-black mb-1">Address Line 2</label>
                <input
                  value={formData.addressLine2}
                  onChange={(e) => setField("addressLine2", e.target.value)}
                  className={inputClass}
                  placeholder="Landmark / Locality"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block font-medium text-black mb-1">Address Line 3</label>
                <input
                  value={formData.addressLine3}
                  onChange={(e) => setField("addressLine3", e.target.value)}
                  className={inputClass}
                  placeholder="Additional details (optional)"
                />
              </div>
            </div>
          </div>

          {/* Registration Numbers */}
          <div
            id="section-registration"
            className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm ring-2 ring-emerald-500 ring-opacity-20"
          >
            <h3 className="text-lg font-semibold text-black mb-1">
              Registration Numbers
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              {type
                ? `Enter credentials for ${type}`
                : "Select a consultant type first"}
            </p>

            {!type && (
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-800 text-sm">
                Please select a Consultant Type to see the required registration
                fields.
              </div>
            )}

            {type === "Architect" && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block font-medium text-black mb-1">
                    COA Registration No. <span className="text-red-600 font-bold">*</span>
                  </label>
                  <input
                    value={formData.coaRegNo}
                    onChange={(e) => setField("coaRegNo", e.target.value)}
                    onBlur={handleRegBlur}
                    className={inputClass}
                    placeholder="e.g., CA/2020/12345"
                  />
                  {errors.coaRegNo && (
                    <p className="text-xs text-red-600 mt-1">{errors.coaRegNo}</p>
                  )}
                </div>
                <div>
                  <label className="block font-medium text-black mb-1">
                    Registration Date <span className="text-red-600 font-bold">*</span>
                  </label>
                  <input
                    type="date"
                    value={formData.registrationDate}
                    onChange={(e) => setField("registrationDate", e.target.value)}
                    className={inputClass}
                  />
                  {errors.registrationDate && (
                    <p className="text-xs text-red-600 mt-1">{errors.registrationDate}</p>
                  )}
                </div>
                <div>
                  <label className="block font-medium text-black mb-1">
                    Validity / Expiry Date <span className="text-red-600 font-bold">*</span>
                  </label>
                  <input
                    type="date"
                    value={formData.coaExpiryDate}
                    onChange={(e) => setField("coaExpiryDate", e.target.value)}
                    className={inputClass}
                  />
                  {errors.coaExpiryDate && (
                    <p className="text-xs text-red-600 mt-1">{errors.coaExpiryDate}</p>
                  )}
                </div>
              </div>
            )}

            {type === "Structural Engineer" && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block font-medium text-black mb-1">
                    Structural Engineer License No.{" "}
                    <span className="text-red-600 font-bold">*</span>
                  </label>
                  <input
                    value={formData.structuralLicenseNo}
                    onChange={(e) => setField("structuralLicenseNo", e.target.value)}
                    onBlur={handleRegBlur}
                    className={inputClass}
                  />
                  {errors.structuralLicenseNo && (
                    <p className="text-xs text-red-600 mt-1">
                      {errors.structuralLicenseNo}
                    </p>
                  )}
                </div>
                <div>
                  <label className="block font-medium text-black mb-1">
                    Registration Date <span className="text-red-600 font-bold">*</span>
                  </label>
                  <input
                    type="date"
                    value={formData.registrationDate}
                    onChange={(e) => setField("registrationDate", e.target.value)}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="block font-medium text-black mb-1">
                    License Issue Date <span className="text-red-600 font-bold">*</span>
                  </label>
                  <input
                    type="date"
                    value={formData.structuralValidity}
                    onChange={(e) => setField("structuralValidity", e.target.value)}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="block font-medium text-black mb-1">
                    Qualification (BE / ME Civil)
                  </label>
                  <CustomSelect
                    value={formData.qualification}
                    onChange={(val) => setField("qualification", val)}
                    options={[
                      { value: "BE Civil", label: "BE Civil" },
                      { value: "ME Civil", label: "ME Civil" },
                      { value: "B.Tech Civil", label: "B.Tech Civil" },
                      { value: "M.Tech Structural", label: "M.Tech Structural" },
                    ]}
                    placeholder="Select"
                    className="w-full"
                  />
                </div>
              </div>
            )}

            {type === "Licensed Surveyor" && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block font-medium text-black mb-1">
                    LBS License Number <span className="text-red-600 font-bold">*</span>
                  </label>
                  <input
                    value={formData.lbsLicenseNo}
                    onChange={(e) => setField("lbsLicenseNo", e.target.value)}
                    onBlur={handleRegBlur}
                    className={inputClass}
                    placeholder="Enter LBS license number"
                  />
                  {errors.lbsLicenseNo && (
                    <p className="text-xs text-red-600 mt-1">{errors.lbsLicenseNo}</p>
                  )}
                </div>
                <div>
                  <label className="block font-medium text-black mb-1">
                    Registration Date <span className="text-red-600 font-bold">*</span>
                  </label>
                  <input
                    type="date"
                    value={formData.registrationDate}
                    onChange={(e) => setField("registrationDate", e.target.value)}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="block font-medium text-black mb-1">
                    Competency Class <span className="text-red-600 font-bold">*</span>
                  </label>
                  <CustomSelect
                    value={formData.competencyClass}
                    onChange={(val) => setField("competencyClass", val)}
                    options={[
                      { value: "Class A", label: "Class A" },
                      { value: "Class B", label: "Class B" },
                    ]}
                    placeholder="Select Class"
                    className="w-full"
                  />
                </div>
                <div>
                  <label className="block font-medium text-black mb-1">
                    Expiry Date <span className="text-red-600 font-bold">*</span>
                  </label>
                  <input
                    type="date"
                    value={formData.lbsExpiryDate}
                    onChange={(e) => setField("lbsExpiryDate", e.target.value)}
                    className={inputClass}
                  />
                </div>
              </div>
            )}

            {type === "MEP Consultant" && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <RegField
                  label="Electrical License No."
                  value={formData.electricalLicenseNo}
                  error={errors.electricalLicenseNo}
                  onChange={(v) => setField("electricalLicenseNo", v)}
                  onBlur={handleRegBlur}
                  inputClass={inputClass}
                />
                <DateField
                  label="Registration Date"
                  value={formData.registrationDate}
                  onChange={(v) => setField("registrationDate", v)}
                  inputClass={inputClass}
                />
                <DateField
                  label="Expiry Date"
                  value={formData.electricalExpiryDate}
                  onChange={(v) => setField("electricalExpiryDate", v)}
                  inputClass={inputClass}
                />
                <div>
                  <label className="block font-medium text-black mb-1">
                    PWD/Chief Electrical Inspector Accreditation
                  </label>
                  <input
                    value={formData.pwdAccreditation}
                    onChange={(e) => setField("pwdAccreditation", e.target.value)}
                    className={inputClass}
                  />
                </div>
              </div>
            )}

            {type === "Plumber" && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <RegField
                  label="Plumber License No."
                  value={formData.plumberLicenseNo}
                  error={errors.plumberLicenseNo}
                  onChange={(v) => setField("plumberLicenseNo", v)}
                  onBlur={handleRegBlur}
                  inputClass={inputClass}
                />
                <DateField
                  label="Registration Date"
                  value={formData.registrationDate}
                  onChange={(v) => setField("registrationDate", v)}
                  inputClass={inputClass}
                />
                <DateField
                  label="Expiry Date"
                  value={formData.plumberExpiryDate}
                  onChange={(v) => setField("plumberExpiryDate", v)}
                  inputClass={inputClass}
                />
              </div>
            )}

            {type === "Fire Consultant" && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <RegField
                  label="Fire License / CFO Accreditation No."
                  value={formData.fireLicenseNo}
                  error={errors.fireLicenseNo}
                  onChange={(v) => setField("fireLicenseNo", v)}
                  onBlur={handleRegBlur}
                  inputClass={inputClass}
                />
                <DateField
                  label="Registration Date"
                  value={formData.registrationDate}
                  onChange={(v) => setField("registrationDate", v)}
                  inputClass={inputClass}
                />
                <DateField
                  label="Validity Date"
                  value={formData.fireValidityDate}
                  onChange={(v) => setField("fireValidityDate", v)}
                  inputClass={inputClass}
                />
              </div>
            )}

            {type === "Landscape Consultant" && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <RegField
                  label="Landscape License No."
                  value={formData.landscapeLicenseNo}
                  error={errors.landscapeLicenseNo}
                  onChange={(v) => setField("landscapeLicenseNo", v)}
                  onBlur={handleRegBlur}
                  inputClass={inputClass}
                />
                <DateField
                  label="Registration Date"
                  value={formData.registrationDate}
                  onChange={(v) => setField("registrationDate", v)}
                  inputClass={inputClass}
                />
                <DateField
                  label="Expiry Date"
                  value={formData.landscapeExpiryDate}
                  onChange={(v) => setField("landscapeExpiryDate", v)}
                  inputClass={inputClass}
                />
              </div>
            )}

            {type === "PMC / Project Manager" && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <RegField
                  label="PMC Registration No."
                  value={formData.pmcRegistrationNo}
                  error={errors.pmcRegistrationNo}
                  onChange={(v) => setField("pmcRegistrationNo", v)}
                  onBlur={handleRegBlur}
                  inputClass={inputClass}
                />
                <DateField
                  label="Registration Date"
                  value={formData.registrationDate}
                  onChange={(v) => setField("registrationDate", v)}
                  inputClass={inputClass}
                />
                <DateField
                  label="Expiry Date"
                  value={formData.pmcExpiryDate}
                  onChange={(v) => setField("pmcExpiryDate", v)}
                  inputClass={inputClass}
                />
              </div>
            )}

            {type === "Geotechnical Consultant" && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <RegField
                  label="NABL Accreditation No."
                  value={formData.nablAccreditationNo}
                  error={errors.nablAccreditationNo}
                  onChange={(v) => setField("nablAccreditationNo", v)}
                  onBlur={handleRegBlur}
                  inputClass={inputClass}
                />
                <DateField
                  label="Registration Date"
                  value={formData.registrationDate}
                  onChange={(v) => setField("registrationDate", v)}
                  inputClass={inputClass}
                />
                <DateField
                  label="Expiry Date"
                  value={formData.nablExpiryDate}
                  onChange={(v) => setField("nablExpiryDate", v)}
                  inputClass={inputClass}
                />
                <div>
                  <label className="block font-medium text-black mb-1">
                    Geotech Engineer Qualification
                  </label>
                  <input
                    value={formData.geotechQualification}
                    onChange={(e) => setField("geotechQualification", e.target.value)}
                    className={inputClass}
                  />
                </div>
              </div>
            )}

            {type === "Environmental Consultant" && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <RegField
                  label="Environmental License No."
                  value={formData.envLicenseNo}
                  error={errors.envLicenseNo}
                  onChange={(v) => setField("envLicenseNo", v)}
                  onBlur={handleRegBlur}
                  inputClass={inputClass}
                />
                <DateField
                  label="Registration Date"
                  value={formData.registrationDate}
                  onChange={(v) => setField("registrationDate", v)}
                  inputClass={inputClass}
                />
                <DateField
                  label="Expiry Date"
                  value={formData.envExpiryDate}
                  onChange={(v) => setField("envExpiryDate", v)}
                  inputClass={inputClass}
                />
              </div>
            )}

            {type === "Town Planner" && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <RegField
                  label="Town Planner License No."
                  value={formData.townPlannerLicenseNo}
                  error={errors.townPlannerLicenseNo}
                  onChange={(v) => setField("townPlannerLicenseNo", v)}
                  onBlur={handleRegBlur}
                  inputClass={inputClass}
                />
                <DateField
                  label="Registration Date"
                  value={formData.registrationDate}
                  onChange={(v) => setField("registrationDate", v)}
                  inputClass={inputClass}
                />
                <DateField
                  label="Expiry Date"
                  value={formData.townPlannerExpiryDate}
                  onChange={(v) => setField("townPlannerExpiryDate", v)}
                  inputClass={inputClass}
                />
              </div>
            )}
          </div>

          <div className="flex justify-end gap-3 pb-2">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl border border-gray-200 bg-white text-gray-800 font-medium hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isSubmitting || checkingPhone}
              className="px-5 py-2.5 rounded-xl bg-emerald-600 text-white font-medium hover:bg-emerald-700 disabled:opacity-60"
            >
              {isSubmitting ? "Submitting…" : "Submit"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}

function RegField({
  label,
  value,
  error,
  onChange,
  onBlur,
  inputClass,
}: {
  label: string;
  value: string;
  error?: string;
  onChange: (v: string) => void;
  onBlur?: () => void;
  inputClass: string;
}) {
  return (
    <div>
      <label className="block font-medium text-black mb-1">
        {label} <span className="text-red-600 font-bold">*</span>
      </label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        className={inputClass}
      />
      {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
    </div>
  );
}

function DateField({
  label,
  value,
  onChange,
  inputClass,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  inputClass: string;
}) {
  return (
    <div>
      <label className="block font-medium text-black mb-1">
        {label} <span className="text-red-600 font-bold">*</span>
      </label>
      <input
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={inputClass}
      />
    </div>
  );
}
