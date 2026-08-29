"use client";

import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import CustomSelect from "@/app/components/CustomSelect";
import RegistrationDocumentAutofillStep from "@/app/components/RegistrationDocumentAutofillStep";
import { supabase } from "@/app/utils/supabase";
import {
  buildLicenseAutofillPatch,
  mergeAutofill,
  type AutofillFiles,
  type AutofillPatch,
} from "@/app/lib/documentValidation/registrationAutofill";
import {
  CONSULTANT_TYPE_OPTIONS,
  EXTRA_REG_REQUIRED_BY_TYPE,
  canSkipConsultantIdentityDocExtraction,
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
  entityName: "",
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
  const [letterheadFile, setLetterheadFile] = useState<File | null>(null);
  const [letterheadPreviewUrl, setLetterheadPreviewUrl] = useState<string | null>(
    null
  );
  const [isLetterheadModalOpen, setIsLetterheadModalOpen] = useState(false);
  const [hasViewedLetterhead, setHasViewedLetterhead] = useState(false);
  const [identityExtracted, setIdentityExtracted] = useState(false);
  const [aadhaarCardFile, setAadhaarCardFile] = useState<File | null>(null);
  const [panCardFile, setPanCardFile] = useState<File | null>(null);
  const [licenseCertificateFile, setLicenseCertificateFile] = useState<File | null>(
    null
  );
  const [signatoryPhotoFile, setSignatoryPhotoFile] = useState<File | null>(null);
  const [signatorySignatureFile, setSignatorySignatureFile] = useState<File | null>(
    null
  );
  const [skippedIdentityDocs, setSkippedIdentityDocs] = useState(false);
  const licenseExtractedRef = useRef<Record<string, string | null> | null>(null);

  const identitySectionComplete = identityExtracted || skippedIdentityDocs;

  const applyPartialAutofill = (
    patch: AutofillPatch,
    files: AutofillFiles,
    extractions?: Partial<
      Record<"aadhaar" | "pan" | "technical-person-license", Record<string, string | null>>
    >,
    options?: { overwriteKeys?: readonly string[] }
  ) => {
    if (extractions?.["technical-person-license"]) {
      licenseExtractedRef.current = extractions["technical-person-license"];
    }

    if (files.aadhaarCardFile) setAadhaarCardFile(files.aadhaarCardFile);
    if (files.panCardFile) setPanCardFile(files.panCardFile);
    if (files.licenseCertificateFile) {
      setLicenseCertificateFile(files.licenseCertificateFile);
    }
    if (files.authorizedSignatoryPhotoFile) {
      setSignatoryPhotoFile(files.authorizedSignatoryPhotoFile);
    }
    if (files.authorizedSignatorySignatureFile) {
      setSignatorySignatureFile(files.authorizedSignatorySignatureFile);
    }

    setFormData((prev) => {
      let merged = mergeAutofill(prev, patch, options) as FormState;
      if (patch.addressLine1 || patch.addressLine2 || patch.addressLine3) {
        merged.addressLine1 = String(merged.addressLine1 || patch.addressLine1 || "");
        merged.addressLine2 = String(merged.addressLine2 || patch.addressLine2 || "");
        merged.addressLine3 = String(merged.addressLine3 || patch.addressLine3 || "");
      }

      if (licenseExtractedRef.current && merged.consultantType) {
        const licensePatch = buildLicenseAutofillPatch(
          licenseExtractedRef.current,
          merged.consultantType,
          "consultant"
        );
        merged = mergeAutofill(merged, licensePatch) as FormState;
      }

      return merged;
    });

    setErrors((prev) => {
      const next = { ...prev };
      delete next.identityDocuments;
      return next;
    });
  };

  useEffect(() => {
    if (!licenseExtractedRef.current || !formData.consultantType) return;

    const licensePatch = buildLicenseAutofillPatch(
      licenseExtractedRef.current,
      formData.consultantType,
      "consultant"
    );

    setFormData((prev) => mergeAutofill(prev, licensePatch) as FormState);
  }, [formData.consultantType]);

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
    setLetterheadFile(null);
    if (letterheadPreviewUrl) {
      URL.revokeObjectURL(letterheadPreviewUrl);
    }
    setLetterheadPreviewUrl(null);
    setIsLetterheadModalOpen(false);
    setHasViewedLetterhead(false);
    setIdentityExtracted(false);
    setAadhaarCardFile(null);
    setPanCardFile(null);
    setLicenseCertificateFile(null);
    setSignatoryPhotoFile(null);
    setSignatorySignatureFile(null);
    setSkippedIdentityDocs(false);
    licenseExtractedRef.current = null;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset only when modal opens / type changes
  }, [open, consultantType]);

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

    if (!skippedIdentityDocs) {
      if (!identityExtracted) {
        next.identityDocuments =
          "Upload and extract identity documents before continuing";
      }
      if (!aadhaarCardFile) {
        next.identityDocuments = "Aadhaar card is required";
      }
      if (!panCardFile) {
        next.identityDocuments = "PAN card is required";
      }
      if (!licenseCertificateFile) {
        next.identityDocuments = "Technical person license is required";
      }
      if (!signatoryPhotoFile) {
        next.identityDocuments = "Authorized signatory photograph is required";
      }
      if (!signatorySignatureFile) {
        next.identityDocuments = "Authorized signatory signature is required";
      }
    }

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

      const formPayload = new FormData();
      formPayload.append(
        "payload",
        JSON.stringify({
          ...formData,
          skipIdentityDocuments: skippedIdentityDocs,
        })
      );
      if (letterheadFile) {
        formPayload.append("letterhead", letterheadFile);
      }
      if (!skippedIdentityDocs) {
        if (aadhaarCardFile) {
          formPayload.append("aadhaar_card", aadhaarCardFile);
        }
        if (panCardFile) {
          formPayload.append("pan_card", panCardFile);
        }
        if (licenseCertificateFile) {
          formPayload.append("license_certificate", licenseCertificateFile);
        }
        if (signatoryPhotoFile) {
          formPayload.append("signatory_photo", signatoryPhotoFile);
        }
        if (signatorySignatureFile) {
          formPayload.append("signatory_signature", signatorySignatureFile);
        }
      }

      const res = await fetch("/api/consultants/partial", {
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
              Upload identity documents to auto-fill details, then confirm registration
              numbers and letterhead. The consultant will only need to set up login and
              accept the declaration.
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

          {/* Identity Documents */}
          <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-black mb-1">
              Identity Documents
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              Upload documents to auto-fill consultant details
            </p>
            <RegistrationDocumentAutofillStep
              registrationKind="consultant"
              consultantType={formData.consultantType}
              allowSkipExtraction={canSkipConsultantIdentityDocExtraction()}
              onSkipExtraction={() => setSkippedIdentityDocs(true)}
              onAutofill={applyPartialAutofill}
              onExtractedChange={(extracted) => {
                setIdentityExtracted(extracted);
                if (extracted) setSkippedIdentityDocs(false);
              }}
              onContinue={() => {
                const element = document.getElementById("section-basic-details");
                element?.scrollIntoView({ behavior: "smooth", block: "start" });
              }}
            />
            {errors.identityDocuments && (
              <p className="text-xs text-red-600 mt-2">{errors.identityDocuments}</p>
            )}
          </div>

          {identitySectionComplete && (
          <>
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
                <label className="block font-medium text-black mb-1">Entity Name</label>
                <input
                  value={formData.entityName}
                  onChange={(e) => setField("entityName", e.target.value)}
                  className={inputClass}
                  placeholder="Enter Entity Name"
                />
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

          {/* Letterhead */}
          <div
            id="section-letterhead"
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
                    id="partial-letterhead-upload"
                  />
                  <label
                    htmlFor="partial-letterhead-upload"
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

          </>
          )}

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

      {/* Letterhead placement preview modal (same as full registration) */}
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
                  id="partial-letterhead-modal"
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
