"use client";

import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import CustomSelect from "@/app/components/CustomSelect";
import { supabase } from "@/app/utils/supabase";
import {
  OWNER_ENTITY_TYPE_OPTIONS,
  OWNER_EXTRA_REG_REQUIRED_BY_TYPE,
  OWNER_REGISTRATION_META_BY_TYPE,
  normalizePhone,
  ownerMetadataToFormFields,
} from "@/app/utils/ownerRegistrationShared";

export type OwnerPartialRegistrationSuccess = {
  user_id: string;
  email?: string;
  metadata?: Record<string, unknown>;
};

type Props = {
  open: boolean;
  onClose: () => void;
  /** Newly created user, or existing incomplete user to use on the applicant form. */
  onSuccess: (result: OwnerPartialRegistrationSuccess) => void;
};

type FormState = Record<string, string>;

const EXTRA_REG_LABELS: Record<string, string> = {
  fullNameProprietor: "Full name of proprietor",
  numberOfPartners: "Number of partners",
  numberOfDirectors: "Number of directors",
  numberOfDesignatedPartners: "Number of designated partners",
  numberOfTrustees: "Number of trustees",
  departmentName: "Department / undertaking name",
};

const emptyForm = (): FormState => ({
  entityType: "",
  entityName: "",
  firstName: "",
  middleName: "",
  lastName: "",
  email: "",
  city: "",
  pincode: "",
  alternatePhone: "",
  pan: "",
  gstNo: "",
  addressLine1: "",
  addressLine2: "",
  addressLine3: "",
  fullNameProprietor: "",
  proprietorshipRegistrationNo: "",
  proprietorshipRegistrationDate: "",
  firmRegistrationNo: "",
  partnershipRegistrationDate: "",
  numberOfPartners: "",
  cin: "",
  rocRegistrationDate: "",
  numberOfDirectors: "",
  llpin: "",
  llpIncorporationDate: "",
  numberOfDesignatedPartners: "",
  trustRegistrationNo: "",
  trustRegistrationDate: "",
  numberOfTrustees: "",
  departmentName: "",
  govtRegistrationNo: "",
  govtRegistrationDate: "",
});

type ResumePrompt = {
  user_id: string;
  email?: string;
  metadata: Record<string, unknown>;
  message: string;
};

export default function OwnerPartialRegistrationModal({
  open,
  onClose,
  onSuccess,
}: Props) {
  const [mounted, setMounted] = useState(false);
  const [formData, setFormData] = useState<FormState>(() => emptyForm());
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [checkingPhone, setCheckingPhone] = useState(false);
  const [resumePrompt, setResumePrompt] = useState<ResumePrompt | null>(null);
  const [letterheadFile, setLetterheadFile] = useState<File | null>(null);
  const [letterheadPreviewUrl, setLetterheadPreviewUrl] = useState<string | null>(
    null
  );
  const [isLetterheadModalOpen, setIsLetterheadModalOpen] = useState(false);
  const [hasViewedLetterhead, setHasViewedLetterhead] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    setFormData(emptyForm());
    setErrors({});
    setFormError("");
    setResumePrompt(null);
    setIsSubmitting(false);
    setLetterheadFile(null);
    if (letterheadPreviewUrl) {
      URL.revokeObjectURL(letterheadPreviewUrl);
    }
    setLetterheadPreviewUrl(null);
    setIsLetterheadModalOpen(false);
    setHasViewedLetterhead(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset only when modal opens
  }, [open]);

  useEffect(() => {
    return () => {
      if (letterheadPreviewUrl) {
        URL.revokeObjectURL(letterheadPreviewUrl);
      }
    };
  }, [letterheadPreviewUrl]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  const setField = (field: string, value: string) => {
    let normalized = value;
    if (field === "pan" || field === "gstNo") {
      normalized = value.toUpperCase();
    } else if (field === "cin") {
      normalized = value.toUpperCase().replace(/\s/g, "").slice(0, 21);
    } else if (field === "alternatePhone") {
      normalized = value.replace(/\D/g, "").slice(0, 10);
    } else if (field === "llpin") {
      normalized = value
        .toUpperCase()
        .replace(/[^A-Z0-9-]/g, "")
        .slice(0, 8);
    }
    setFormData((prev) => ({ ...prev, [field]: normalized }));
    setErrors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  };

  const handleLetterheadChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const file = files[0];
    const validImageTypes = ["image/jpeg", "image/jpg", "image/png"];
    const validExtensions = [".jpg", ".jpeg", ".png"];
    const isValidImage =
      validImageTypes.includes(file.type) ||
      validExtensions.some((ext) => file.name.toLowerCase().endsWith(ext));

    if (!isValidImage) {
      setErrors((prev) => ({
        ...prev,
        letterheadFile: "Please upload a JPG or PNG image file",
      }));
      e.target.value = "";
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setErrors((prev) => ({
        ...prev,
        letterheadFile: "Letterhead must be 10MB or smaller",
      }));
      e.target.value = "";
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    const img = document.createElement("img");
    img.onload = () => {
      const aspectRatio = img.width / img.height;
      const a4Ratio = 210 / 297;
      const tolerance = 0.02;
      if (aspectRatio < a4Ratio - tolerance || aspectRatio > a4Ratio + tolerance) {
        setErrors((prev) => ({
          ...prev,
          letterheadFile:
            "Letterhead image must be of A4 size (210mm x 297mm aspect ratio)",
        }));
        URL.revokeObjectURL(objectUrl);
        e.target.value = "";
        return;
      }
      if (letterheadPreviewUrl) URL.revokeObjectURL(letterheadPreviewUrl);
      setLetterheadFile(file);
      setLetterheadPreviewUrl(objectUrl);
      setHasViewedLetterhead(false);
      setIsLetterheadModalOpen(true);
      setErrors((prev) => {
        const next = { ...prev };
        delete next.letterheadFile;
        return next;
      });
    };
    img.onerror = () => {
      setErrors((prev) => ({
        ...prev,
        letterheadFile: "Failed to load image",
      }));
      URL.revokeObjectURL(objectUrl);
      e.target.value = "";
    };
    img.src = objectUrl;
  };

  const handleRemoveLetterhead = () => {
    setLetterheadFile(null);
    if (letterheadPreviewUrl) {
      URL.revokeObjectURL(letterheadPreviewUrl);
      setLetterheadPreviewUrl(null);
    }
    setIsLetterheadModalOpen(false);
    setHasViewedLetterhead(false);
  };

  const closeLetterheadModal = () => {
    setIsLetterheadModalOpen(false);
    if (letterheadPreviewUrl) {
      setHasViewedLetterhead(true);
    }
  };

  const validate = (): boolean => {
    const next: Record<string, string> = {};
    const require = (field: string, label: string) => {
      if (!String(formData[field] || "").trim()) next[field] = `${label} is required`;
    };
    require("entityType", "Entity type");
    if (formData.entityType !== "Individual") {
      require("entityName", "Entity name");
    }
    require("firstName", "First name");
    require("lastName", "Last name");
    require("email", "Email");
    require("city", "City");
    require("pincode", "Pincode");
    require("alternatePhone", "Phone number");
    require("pan", "PAN");
    require("addressLine1", "Address line 1");

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

    const mapping = OWNER_REGISTRATION_META_BY_TYPE[formData.entityType];
    if (mapping) {
      require(mapping.formField, mapping.label);
      require(mapping.dateField, "Registration date");
    }
    if (
      formData.entityType === "Proprietorship" ||
      formData.entityType === "Individual"
    ) {
      require("gstNo", "GSTIN No.");
    }
    for (const field of OWNER_EXTRA_REG_REQUIRED_BY_TYPE[formData.entityType] || []) {
      require(field, EXTRA_REG_LABELS[field] || field);
    }

    if (!letterheadFile) {
      next.letterheadFile = "Letterhead image is required";
    }

    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const lookupPhone = async (): Promise<boolean> => {
    const phone = normalizePhone(formData.alternatePhone);
    if (phone.length !== 10) return true;

    setCheckingPhone(true);
    try {
      const res = await fetch("/api/owners/lookup", {
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
            "This phone number is already registered with an incomplete profile. You can use this person on the applicant form now, or ask them to finish login creation and remaining sections on the Owner Registration page.",
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
    const mapping = OWNER_REGISTRATION_META_BY_TYPE[formData.entityType];
    if (!mapping) return true;
    const regNo = String(formData[mapping.formField] || "").trim();
    if (!regNo) return true;

    try {
      const res = await fetch("/api/owners/lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          registrationNumber: regNo,
          entityType: formData.entityType,
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
    const fields = ownerMetadataToFormFields(resumePrompt.metadata);
    setFormData((prev) => ({
      ...prev,
      ...fields,
    }));
    setResumePrompt(null);
    setFormError(
      "Profile data loaded. Ask this owner to finish remaining sections on /owner. Click Use Existing Applicant below if you only need them on this project."
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
        setFormError("You must be signed in to add a new owner");
        return;
      }

      const formPayload = new FormData();
      formPayload.append("payload", JSON.stringify(formData));
      if (letterheadFile) {
        formPayload.append("letterhead", letterheadFile);
      }

      const res = await fetch("/api/owners/partial", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
        body: formPayload,
      });
      const data = await res.json();

      if (res.status === 409 && data.status === "incomplete" && data.user_id) {
        setResumePrompt({
          user_id: data.user_id,
          email: data.email,
          metadata: data.metadata || {},
          message:
            data.error ||
            "Already registered with an incomplete profile. Use this person or finish remaining steps on Owner Registration.",
        });
        return;
      }

      if (!res.ok) {
        setFormError(data.error || "Failed to create owner");
        return;
      }

      onSuccess({
        user_id: data.user_id,
        email: data.email,
        metadata: data.metadata,
      });
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : "Failed to create owner"
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!open || !mounted) return null;

  const inputClass =
    "border border-gray-200 rounded-lg px-3 py-2 h-10 w-full text-black focus:ring-2 focus:ring-emerald-500 outline-none";
  const type = formData.entityType;

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
              Owner Registration
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              Enter basic details, registration numbers, and letterhead. Login and
              documents can be completed later on the full registration page.
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
            id="owner-section-basic-details"
            className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm ring-2 ring-emerald-500 ring-opacity-20"
          >
            <h3 className="text-lg font-semibold text-black mb-1">Basic Details</h3>
            <p className="text-sm text-gray-600 mb-4">Tell us who you are</p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block font-medium text-black mb-1">
                  Entity Type <span className="text-red-600 font-bold">*</span>
                </label>
                <CustomSelect
                  value={formData.entityType}
                  onChange={(val) => setField("entityType", val)}
                  options={OWNER_ENTITY_TYPE_OPTIONS.map((t) => ({
                    value: t,
                    label: t,
                  }))}
                  placeholder="Select Entity Type"
                  className="w-full"
                />
                {errors.entityType && (
                  <p className="text-xs text-red-600 mt-1">{errors.entityType}</p>
                )}
              </div>

              {formData.entityType !== "Individual" && (
              <div>
                <label className="block font-medium text-black mb-1">
                  Entity Name <span className="text-red-600 font-bold">*</span>
                </label>
                <input
                  value={formData.entityName}
                  onChange={(e) => setField("entityName", e.target.value)}
                  className={inputClass}
                  placeholder="Enter Entity Name"
                />
                {errors.entityName && (
                  <p className="text-xs text-red-600 mt-1">{errors.entityName}</p>
                )}
              </div>
              )}

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

              {type !== "Proprietorship" && type !== "Individual" && (
              <div>
                <label className="block font-medium text-black mb-1">
                  GSTIN No. <span className="text-gray-400 font-normal">(optional)</span>
                </label>
                <input
                  value={formData.gstNo}
                  onChange={(e) => setField("gstNo", e.target.value)}
                  className={inputClass}
                  placeholder="15-character GSTIN"
                  maxLength={15}
                />
              </div>
              )}

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
            id="owner-section-registration"
            className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm ring-2 ring-emerald-500 ring-opacity-20"
          >
            <h3 className="text-lg font-semibold text-black mb-1">
              Registration Numbers
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              {type
                ? `Enter credentials for ${type}`
                : "Select an entity type first"}
            </p>

            {!type && (
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-800 text-sm">
                Please select an Entity Type to see the required registration
                fields.
              </div>
            )}

            {(type === "Proprietorship" || type === "Individual") && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <RegField
                  label="GSTIN No."
                  value={formData.gstNo}
                  error={errors.gstNo}
                  onChange={(v) => setField("gstNo", v)}
                  inputClass={inputClass}
                  placeholder="15-character GSTIN"
                  maxLength={15}
                />
                {type === "Proprietorship" && (
                <RegField
                  label="Full Name of Proprietor"
                  value={formData.fullNameProprietor}
                  error={errors.fullNameProprietor}
                  onChange={(v) => setField("fullNameProprietor", v)}
                  inputClass={inputClass}
                  placeholder="Name as per PAN / Aadhaar"
                />
                )}
                <RegField
                  label={type === "Individual" ? "Registration No." : "Proprietorship Registration No."}
                  value={formData.proprietorshipRegistrationNo}
                  error={errors.proprietorshipRegistrationNo}
                  onChange={(v) => setField("proprietorshipRegistrationNo", v)}
                  onBlur={handleRegBlur}
                  inputClass={inputClass}
                  placeholder="Registration Number"
                />
                <DateField
                  label="Registration Date"
                  value={formData.proprietorshipRegistrationDate}
                  error={errors.proprietorshipRegistrationDate}
                  onChange={(v) => setField("proprietorshipRegistrationDate", v)}
                  inputClass={inputClass}
                />
              </div>
            )}

            {type === "Partnership Firm" && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <RegField
                  label="Firm Registration No."
                  value={formData.firmRegistrationNo}
                  error={errors.firmRegistrationNo}
                  onChange={(v) => setField("firmRegistrationNo", v)}
                  onBlur={handleRegBlur}
                  inputClass={inputClass}
                  placeholder="As per Registrar of Firms"
                />
                <DateField
                  label="Date of Registration"
                  value={formData.partnershipRegistrationDate}
                  error={errors.partnershipRegistrationDate}
                  onChange={(v) => setField("partnershipRegistrationDate", v)}
                  inputClass={inputClass}
                />
                <RegField
                  label="Number of Partners"
                  value={formData.numberOfPartners}
                  error={errors.numberOfPartners}
                  onChange={(v) => {
                    if (v === "" || !isNaN(Number(v))) {
                      setField("numberOfPartners", v);
                    }
                  }}
                  inputClass={inputClass}
                  placeholder="Total partners"
                  type="number"
                />
              </div>
            )}

            {type === "Pvt. Ltd. / Ltd. Company" && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <RegField
                  label="CIN (Corporate Identification Number)"
                  value={formData.cin}
                  error={errors.cin}
                  onChange={(v) => setField("cin", v)}
                  onBlur={handleRegBlur}
                  inputClass={inputClass}
                  placeholder="L12345MH2019ABC123456"
                  maxLength={21}
                />
                <DateField
                  label="ROC Registration Date"
                  value={formData.rocRegistrationDate}
                  error={errors.rocRegistrationDate}
                  onChange={(v) => setField("rocRegistrationDate", v)}
                  inputClass={inputClass}
                />
                <RegField
                  label="Number of Directors"
                  value={formData.numberOfDirectors}
                  error={errors.numberOfDirectors}
                  onChange={(v) => {
                    if (v === "" || !isNaN(Number(v))) {
                      setField("numberOfDirectors", v);
                    }
                  }}
                  inputClass={inputClass}
                  placeholder="Total directors"
                  type="number"
                />
              </div>
            )}

            {type === "LLP" && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <RegField
                  label="LLPIN (LLP Identification No.)"
                  value={formData.llpin}
                  error={errors.llpin}
                  onChange={(v) => setField("llpin", v)}
                  onBlur={handleRegBlur}
                  inputClass={inputClass}
                  placeholder="AAX-1234"
                  maxLength={8}
                />
                <DateField
                  label="Date of Registration"
                  value={formData.llpIncorporationDate}
                  error={errors.llpIncorporationDate}
                  onChange={(v) => setField("llpIncorporationDate", v)}
                  inputClass={inputClass}
                />
                <RegField
                  label="Number of Designated Partners"
                  value={formData.numberOfDesignatedPartners}
                  error={errors.numberOfDesignatedPartners}
                  onChange={(v) => {
                    if (v === "" || !isNaN(Number(v))) {
                      setField("numberOfDesignatedPartners", v);
                    }
                  }}
                  inputClass={inputClass}
                  placeholder="Total designated partners"
                  type="number"
                />
              </div>
            )}

            {type === "Trust / Society" && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <RegField
                  label="Trust / Society Registration No."
                  value={formData.trustRegistrationNo}
                  error={errors.trustRegistrationNo}
                  onChange={(v) => setField("trustRegistrationNo", v)}
                  onBlur={handleRegBlur}
                  inputClass={inputClass}
                  placeholder="As per Charity Commissioner / Registrar"
                />
                <DateField
                  label="Date of Registration"
                  value={formData.trustRegistrationDate}
                  error={errors.trustRegistrationDate}
                  onChange={(v) => setField("trustRegistrationDate", v)}
                  inputClass={inputClass}
                />
                <RegField
                  label="Number of Trustees"
                  value={formData.numberOfTrustees}
                  error={errors.numberOfTrustees}
                  onChange={(v) => {
                    if (v === "" || !isNaN(Number(v))) {
                      setField("numberOfTrustees", v);
                    }
                  }}
                  inputClass={inputClass}
                  placeholder="Total trustees"
                  type="number"
                />
              </div>
            )}

            {type === "Govt. / PSU / Local Body" && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <RegField
                  label="Department / Undertaking Name"
                  value={formData.departmentName}
                  error={errors.departmentName}
                  onChange={(v) => setField("departmentName", v)}
                  inputClass={inputClass}
                  placeholder="e.g. MHADA / MMRDA / BMC / XYZ Dept."
                />
                <RegField
                  label="Govt Registration No."
                  value={formData.govtRegistrationNo}
                  error={errors.govtRegistrationNo}
                  onChange={(v) => setField("govtRegistrationNo", v)}
                  onBlur={handleRegBlur}
                  inputClass={inputClass}
                  placeholder="Registration Number"
                />
                <DateField
                  label="Registration Date"
                  value={formData.govtRegistrationDate}
                  error={errors.govtRegistrationDate}
                  onChange={(v) => setField("govtRegistrationDate", v)}
                  inputClass={inputClass}
                />
              </div>
            )}
          </div>

          {/* Letterhead */}
          <div
            id="owner-section-letterhead"
            className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm ring-2 ring-emerald-500 ring-opacity-20"
          >
            <h3 className="text-lg font-semibold text-black mb-1">Letterhead</h3>
            <p className="text-sm text-gray-600 mb-4">
              Upload your letterhead image (JPG/PNG). After successful upload, you
              will see a preview showing where it will be placed.
            </p>

            <div className="grid grid-cols-1 gap-4">
              <div>
                <label className="block font-medium text-black mb-1">
                  Letterhead Image <span className="text-red-600 font-bold">*</span>
                </label>
                <div
                  className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
                    errors.letterheadFile
                      ? "border-red-300 bg-red-50"
                      : letterheadFile
                        ? hasViewedLetterhead
                          ? "border-green-300 bg-green-50"
                          : "border-blue-300 bg-blue-50"
                        : "border-gray-300 hover:border-blue-400"
                  }`}
                >
                  <input
                    type="file"
                    accept=".jpg,.jpeg,.png,image/jpeg,image/png"
                    onChange={handleLetterheadChange}
                    className="hidden"
                    id="owner-partial-letterhead-upload"
                  />
                  <label
                    htmlFor="owner-partial-letterhead-upload"
                    className="cursor-pointer"
                  >
                    <div className="flex flex-col items-center gap-2">
                      <svg
                        className={`w-10 h-10 ${
                          errors.letterheadFile
                            ? "text-red-500"
                            : letterheadFile
                              ? "text-green-500"
                              : "text-gray-400"
                        }`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={1.5}
                          d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                        />
                      </svg>
                      <span className="text-sm text-gray-600">
                        {letterheadFile ? (
                          <span className="text-green-600 font-medium">
                            ✓ {letterheadFile.name}
                          </span>
                        ) : (
                          <>
                            <span className="text-emerald-600 font-medium">
                              Click to upload
                            </span>{" "}
                            or drag and drop
                          </>
                        )}
                      </span>
                      <span className="text-xs text-gray-500">
                        JPG, PNG only (max 10MB)
                      </span>
                    </div>
                  </label>
                </div>
                {errors.letterheadFile && (
                  <p className="text-xs text-red-600 mt-2">{errors.letterheadFile}</p>
                )}
              </div>

              {letterheadFile && (
                <div className="border rounded-lg p-4 bg-gray-50">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-sm font-medium text-black">
                      Uploaded Letterhead
                    </p>
                    {hasViewedLetterhead && (
                      <span className="text-xs text-green-600 flex items-center gap-1">
                        <svg
                          className="w-4 h-4"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path
                            fillRule="evenodd"
                            d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                            clipRule="evenodd"
                          />
                        </svg>
                        Preview viewed
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-3 p-3 bg-white border rounded-lg">
                    <svg
                      className="w-10 h-10 text-red-500 flex-shrink-0"
                      fill="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6zm-1 2l5 5h-5V4zm-2.5 9.5L14 10l2 2.5V17H8v-4l2.5 3 1-3.5z" />
                    </svg>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-black truncate">
                        {letterheadFile.name}
                      </p>
                      <p className="text-xs text-gray-500">
                        {(letterheadFile.size / 1024 / 1024).toFixed(2)} MB
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-2 mt-3">
                    <button
                      type="button"
                      onClick={() => setIsLetterheadModalOpen(true)}
                      className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
                    >
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                        />
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                        />
                      </svg>
                      View Preview
                    </button>
                    <button
                      type="button"
                      onClick={handleRemoveLetterhead}
                      className="px-4 py-2 border border-red-300 text-red-600 rounded-lg text-sm font-medium hover:bg-red-50 transition-colors flex items-center gap-2"
                    >
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                        />
                      </svg>
                      Remove
                    </button>
                  </div>

                  {!hasViewedLetterhead && (
                    <p className="text-xs text-amber-600 mt-2 flex items-center gap-1">
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                      </svg>
                      Please view the preview to confirm letterhead placement
                    </p>
                  )}
                </div>
              )}
            </div>
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

      {/* Letterhead placement preview modal */}
      {isLetterheadModalOpen &&
        letterheadPreviewUrl &&
        createPortal(
          <AnimatePresence>
            {isLetterheadModalOpen && (
              <motion.div
                className="fixed inset-0 z-[9999] flex justify-center items-start bg-black/50 backdrop-blur-sm p-4 pt-10"
                onClick={closeLetterheadModal}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <motion.div
                  id="owner-partial-letterhead-modal"
                  className="bg-white w-full max-w-5xl rounded-xl shadow-2xl relative max-h-[90vh] flex flex-col overflow-hidden"
                  onClick={(e) => e.stopPropagation()}
                  initial={{ y: -40, opacity: 0, scale: 0.95 }}
                  animate={{ y: 0, opacity: 1, scale: 1 }}
                  exit={{ y: -40, opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.25 }}
                >
                  <div className="flex justify-between items-center p-6 border-b">
                    <div>
                      <h2 className="text-2xl font-bold text-black">
                        Letterhead Preview - Assigned Placement Demo
                      </h2>
                      <p className="text-sm text-gray-600 mt-1">
                        This is a demo showing where your letterhead will be
                        placed in the system.
                      </p>
                    </div>
                    <button
                      onClick={closeLetterheadModal}
                      className="text-2xl font-bold text-gray-700 hover:text-black transition-colors"
                      aria-label="Close modal"
                    >
                      ×
                    </button>
                  </div>

                  <div className="flex-1 overflow-auto p-6 space-y-4">
                    <div
                      className="border rounded-lg bg-white flex items-center justify-center"
                      style={{ minHeight: "600px" }}
                    >
                      <div
                        className="relative w-full max-w-3xl mx-auto rounded-lg border-2 border-gray-300 bg-white shadow-sm overflow-hidden"
                        style={{ aspectRatio: "210 / 297" }}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={letterheadPreviewUrl}
                          alt="Letterhead Preview"
                          className="absolute inset-0 w-full h-full object-contain"
                        />
                        <div
                          className="absolute rounded-xl border-2 border-blue-400 bg-blue-50/40"
                          style={{
                            top: "14%",
                            bottom: "14%",
                            left: "8%",
                            right: "8%",
                          }}
                        />
                      </div>
                    </div>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>,
          document.body
        )}
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
  placeholder,
  type = "text",
  maxLength,
}: {
  label: string;
  value: string;
  error?: string;
  onChange: (v: string) => void;
  onBlur?: () => void;
  inputClass: string;
  placeholder?: string;
  type?: string;
  maxLength?: number;
}) {
  return (
    <div>
      <label className="block font-medium text-black mb-1">
        {label} <span className="text-red-600 font-bold">*</span>
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        className={inputClass}
        placeholder={placeholder}
        maxLength={maxLength}
      />
      {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
    </div>
  );
}

function DateField({
  label,
  value,
  error,
  onChange,
  inputClass,
}: {
  label: string;
  value: string;
  error?: string;
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
      {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
    </div>
  );
}
