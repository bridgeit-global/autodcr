"use client";

import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import CustomSelect from "@/app/components/CustomSelect";
import RegistrationDocumentAutofillStep from "@/app/components/RegistrationDocumentAutofillStep";
import { supabase } from "@/app/utils/supabase";
import {
  mergeAutofill,
  type AutofillFiles,
  type AutofillPatch,
} from "@/app/lib/documentValidation/registrationAutofill";
import { isValidIndianPincode } from "@/app/utils/pincode";
import {
  isIndividualType,
  isOwnerDocumentsSectionComplete,
  normalizePhone,
  OWNER_DOC_CHECKLIST,
  OWNER_ENTITY_TYPE_OPTIONS,
  OWNER_EXTRA_REG_REQUIRED_BY_TYPE,
  OWNER_LLP_AUTOFILL_ENTITY_DOC_IDS,
  OWNER_REGISTRATION_META_BY_TYPE,
  ownerMetadataToFormFields,
  ownerUsesEntityPan,
} from "@/app/utils/ownerRegistrationShared";

export type OwnerPartialRegistrationSuccess = {
  user_id: string;
  email?: string;
  metadata?: Record<string, unknown>;
};

type Props = {
  open: boolean;
  onClose: () => void;
  onSuccess: (result: OwnerPartialRegistrationSuccess) => void;
  accountRole?: "Owner" | "Developer";
};

type FormState = Record<string, string>;

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
  accountRole = "Owner",
}: Props) {
  const registrationKind = accountRole === "Developer" ? "developer" : "owner";
  const finishPath = accountRole === "Developer" ? "/developer" : "/owner";

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

  const [aadhaarCardFile, setAadhaarCardFile] = useState<File | null>(null);
  const [panCardFile, setPanCardFile] = useState<File | null>(null);
  const [signatoryPhotoFile, setSignatoryPhotoFile] = useState<File | null>(null);
  const [signatorySignatureFile, setSignatorySignatureFile] =
    useState<File | null>(null);
  const [entityDocuments, setEntityDocuments] = useState<
    Record<string, File | null>
  >({});

  const documentsComplete = isOwnerDocumentsSectionComplete(formData.entityType, {
    aadhaarCardFile,
    panCardFile,
    authorizedSignatoryPhotoFile: signatoryPhotoFile,
    authorizedSignatorySignatureFile: signatorySignatureFile,
    entityDocuments,
  });

  const docsForEntity = OWNER_DOC_CHECKLIST[formData.entityType] || [];
  const docsForEntityDisplay =
    formData.entityType === "LLP"
      ? docsForEntity.filter((doc) => !OWNER_LLP_AUTOFILL_ENTITY_DOC_IDS.has(doc.id))
      : docsForEntity;

  const applyPartialAutofill = (patch: AutofillPatch, files: AutofillFiles) => {
    if (files.aadhaarCardFile) setAadhaarCardFile(files.aadhaarCardFile);
    if (files.panCardFile) setPanCardFile(files.panCardFile);
    if (files.authorizedSignatoryPhotoFile) {
      setSignatoryPhotoFile(files.authorizedSignatoryPhotoFile);
    }
    if (files.authorizedSignatorySignatureFile) {
      setSignatorySignatureFile(files.authorizedSignatorySignatureFile);
    }
    if (files.entityDocuments) {
      setEntityDocuments((prev) => {
        const next = { ...prev };
        for (const [docId, file] of Object.entries(files.entityDocuments || {})) {
          if (file) next[docId] = file;
        }
        return next;
      });
    }

    setFormData((prev) => {
      const merged = mergeAutofill(prev, patch) as FormState;
      if (patch.addressLine1 || patch.addressLine2 || patch.addressLine3) {
        merged.addressLine1 = String(merged.addressLine1 || patch.addressLine1 || "");
        merged.addressLine2 = String(merged.addressLine2 || patch.addressLine2 || "");
        merged.addressLine3 = String(merged.addressLine3 || patch.addressLine3 || "");
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
    setLetterheadPreviewUrl(null);
    setIsLetterheadModalOpen(false);
    setHasViewedLetterhead(false);
    setAadhaarCardFile(null);
    setPanCardFile(null);
    setSignatoryPhotoFile(null);
    setSignatorySignatureFile(null);
    setEntityDocuments({});
  }, [open, accountRole]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  useEffect(() => {
    return () => {
      if (letterheadPreviewUrl) URL.revokeObjectURL(letterheadPreviewUrl);
    };
  }, [letterheadPreviewUrl]);

  const setField = (field: string, value: string) => {
    let normalized = value;
    if (field === "alternatePhone") {
      normalized = value.replace(/\D/g, "").slice(0, 10);
    }
    if (field === "pan") {
      normalized = value.replace(/[^a-zA-Z0-9]/g, "").toUpperCase().slice(0, 10);
    }
    if (field === "pincode") {
      normalized = value.replace(/\D/g, "").slice(0, 6);
    }
    setFormData((prev) => {
      if (field === "entityType" && prev.entityType !== normalized) {
        setEntityDocuments({});
        setAadhaarCardFile(null);
        setPanCardFile(null);
        setSignatoryPhotoFile(null);
        setSignatorySignatureFile(null);
      }
      return { ...prev, [field]: normalized };
    });
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

    require("entityType", "Entity type");
    if (!isIndividualType(formData.entityType)) {
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

    if (
      formData.pincode &&
      !isValidIndianPincode(formData.pincode)
    ) {
      next.pincode = "Enter a valid 6-digit pincode";
    }
    if (normalizePhone(formData.alternatePhone).length !== 10) {
      next.alternatePhone = "Enter a valid 10-digit phone number";
    }
    if (
      formData.pan &&
      !/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(formData.pan.toUpperCase())
    ) {
      next.pan = "Enter a valid PAN (e.g. ABCDE1234F)";
    }

    if (!documentsComplete) {
      next.identityDocuments = "Complete entity type and document uploads first";
    }

    const mapping = OWNER_REGISTRATION_META_BY_TYPE[formData.entityType];
    if (mapping) {
      require(mapping.formField, mapping.label);
      require(mapping.dateField, `${mapping.label} date`);
    }
    for (const field of OWNER_EXTRA_REG_REQUIRED_BY_TYPE[formData.entityType] || []) {
      const labels: Record<string, string> = {
        fullNameProprietor: "Full name of proprietor",
        numberOfPartners: "Number of partners",
        numberOfDirectors: "Number of directors",
        numberOfDesignatedPartners: "Number of designated partners",
        numberOfTrustees: "Number of trustees",
        departmentName: "Department name",
      };
      require(field, labels[field] || field);
    }

    if (!letterheadFile) {
      next.letterheadFile = "Letterhead is required";
    } else if (!hasViewedLetterhead) {
      next.letterheadFile = "Please view the letterhead preview before submitting";
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
          message: `This phone number is already registered with an incomplete profile. You can use this person on the applicant form now, or ask them to finish login creation and remaining sections on the ${accountRole} Registration page.`,
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
    setFormData((prev) => ({ ...prev, ...fields }));
    setResumePrompt(null);
    setFormError(
      `Profile data loaded. Ask this ${accountRole.toLowerCase()} to finish remaining sections on ${finishPath}. Click Use Existing Applicant below if you only need them on this project.`
    );
  };

  const handleLetterheadChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const validImageTypes = ["image/jpeg", "image/jpg", "image/png"];
    const validExtensions = [".jpg", ".jpeg", ".png"];
    const isValidImage =
      validImageTypes.includes(file.type) ||
      validExtensions.some((ext) => file.name.toLowerCase().endsWith(ext));
    if (!isValidImage) {
      setFormError("Please upload a JPG or PNG image file for letterhead");
      e.target.value = "";
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setFormError("Letterhead file size must be less than 10MB");
      e.target.value = "";
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const aspectRatio = img.width / img.height;
      const a4Ratio = 210 / 297;
      if (Math.abs(aspectRatio - a4Ratio) > 0.05) {
        URL.revokeObjectURL(objectUrl);
        setFormError(
          "Letterhead must be A4 size (210×297mm). Please upload an A4-sized image."
        );
        e.target.value = "";
        return;
      }
      if (letterheadPreviewUrl) URL.revokeObjectURL(letterheadPreviewUrl);
      setLetterheadFile(file);
      setLetterheadPreviewUrl(objectUrl);
      setHasViewedLetterhead(false);
      setIsLetterheadModalOpen(true);
      setFormError("");
      setErrors((prev) => {
        const next = { ...prev };
        delete next.letterheadFile;
        return next;
      });
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      setFormError("Failed to load image. Please try again.");
      e.target.value = "";
    };
    img.src = objectUrl;
  };

  const closeLetterheadModal = () => {
    setIsLetterheadModalOpen(false);
    setHasViewedLetterhead(true);
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
        setFormError(`You must be signed in to add a new ${accountRole.toLowerCase()}`);
        return;
      }

      const formPayload = new FormData();
      formPayload.append(
        "payload",
        JSON.stringify({
          ...formData,
          accountRole,
        })
      );
      if (letterheadFile) formPayload.append("letterhead", letterheadFile);
      if (aadhaarCardFile) formPayload.append("aadhaar_card", aadhaarCardFile);
      if (panCardFile) formPayload.append("pan_card", panCardFile);
      if (signatoryPhotoFile) {
        formPayload.append("signatory_photo", signatoryPhotoFile);
      }
      if (signatorySignatureFile) {
        formPayload.append("signatory_signature", signatorySignatureFile);
      }
      Object.entries(entityDocuments).forEach(([id, file]) => {
        if (file) formPayload.append(`entity_doc_${id}`, file);
      });

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
            `Already registered with an incomplete profile. Use this person or finish remaining steps on ${accountRole} Registration.`,
        });
        return;
      }

      if (!res.ok) {
        setFormError(data.error || `Failed to create ${accountRole.toLowerCase()}`);
        return;
      }

      onSuccess({
        user_id: data.user_id,
        email: data.email,
        metadata: data.metadata,
      });
    } catch (err) {
      setFormError(
        err instanceof Error
          ? err.message
          : `Failed to create ${accountRole.toLowerCase()}`
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!open || !mounted) return null;

  const inputClass =
    "border border-gray-200 rounded-lg px-3 py-2 h-10 w-full text-black focus:ring-2 focus:ring-emerald-500 outline-none";
  const entityType = formData.entityType;
  const regMapping = OWNER_REGISTRATION_META_BY_TYPE[entityType];

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
              {accountRole} Registration
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              Select entity type, upload documents to auto-fill details, then confirm
              registration numbers and letterhead. The {accountRole.toLowerCase()} will
              only need to set up login and accept the declaration.
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

          {/* Card 1: Entity Type + Documents */}
          <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-black mb-1">
              Entity Type &amp; Documents
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              Choose entity type, then upload documents to auto-fill details
            </p>

            <div className="mb-4 max-w-md">
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

            {formData.entityType ? (
              <>
                <RegistrationDocumentAutofillStep
                  key={formData.entityType}
                  registrationKind={registrationKind}
                  entityType={formData.entityType}
                  onAutofill={applyPartialAutofill}
                  onContinue={() => {
                    const element = document.getElementById(
                      "owner-section-basic-details"
                    );
                    element?.scrollIntoView({ behavior: "smooth", block: "start" });
                  }}
                />

                {docsForEntityDisplay.length > 0 && (
                  <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                    {docsForEntityDisplay.map((doc) => (
                      <div key={doc.id}>
                        <label className="block font-medium text-black mb-1">
                          {doc.label}{" "}
                          <span className="text-red-600 font-bold">*</span>
                        </label>
                        <input
                          type="file"
                          accept={doc.accept || ".pdf"}
                          onChange={(e) => {
                            const file = e.target.files?.[0] || null;
                            setEntityDocuments((prev) => ({
                              ...prev,
                              [doc.id]: file,
                            }));
                          }}
                          className="block w-full text-sm text-gray-700 file:mr-3 file:rounded-lg file:border-0 file:bg-emerald-50 file:px-3 file:py-2 file:text-emerald-800"
                        />
                        {entityDocuments[doc.id] && (
                          <p className="text-xs text-gray-500 mt-1 truncate">
                            {entityDocuments[doc.id]?.name}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <p className="text-sm text-gray-500">
                Select an entity type to unlock document upload.
              </p>
            )}
            {errors.identityDocuments && (
              <p className="text-xs text-red-600 mt-2">{errors.identityDocuments}</p>
            )}
          </div>

          {documentsComplete && (
            <>
              {/* Card 2: Basic Details */}
              <div
                id="owner-section-basic-details"
                className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm ring-2 ring-emerald-500 ring-opacity-20"
              >
                <h3 className="text-lg font-semibold text-black mb-1">
                  Basic Details
                </h3>
                <p className="text-sm text-gray-600 mb-4">Confirm identity details</p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {!isIndividualType(entityType) && (
                    <div className="md:col-span-2">
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
                    <label className="block font-medium text-black mb-1">
                      Middle Name
                    </label>
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
                      <p className="text-xs text-red-600 mt-1">
                        {errors.alternatePhone}
                      </p>
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

                  <div>
                    <label className="block font-medium text-black mb-1">GSTIN</label>
                    <input
                      value={formData.gstNo}
                      onChange={(e) => setField("gstNo", e.target.value)}
                      className={inputClass}
                      placeholder="15-character GSTIN"
                      maxLength={15}
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="block font-medium text-black mb-1">
                      Address Line 1 <span className="text-red-600 font-bold">*</span>
                    </label>
                    <input
                      value={formData.addressLine1}
                      onChange={(e) => setField("addressLine1", e.target.value)}
                      className={inputClass}
                      placeholder="Building / Street"
                    />
                    {errors.addressLine1 && (
                      <p className="text-xs text-red-600 mt-1">
                        {errors.addressLine1}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block font-medium text-black mb-1">
                      Address Line 2
                    </label>
                    <input
                      value={formData.addressLine2}
                      onChange={(e) => setField("addressLine2", e.target.value)}
                      className={inputClass}
                      placeholder="Area / Locality"
                    />
                  </div>

                  <div>
                    <label className="block font-medium text-black mb-1">
                      Address Line 3
                    </label>
                    <input
                      value={formData.addressLine3}
                      onChange={(e) => setField("addressLine3", e.target.value)}
                      className={inputClass}
                      placeholder="Landmark"
                    />
                  </div>
                </div>
              </div>

              {/* Card 3: Registration Numbers */}
              <div
                id="owner-section-registration"
                className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm"
              >
                <h3 className="text-lg font-semibold text-black mb-1">
                  Registration Numbers
                </h3>
                <p className="text-sm text-gray-600 mb-4">
                  Entity registration details
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {regMapping && (
                    <>
                      <div>
                        <label className="block font-medium text-black mb-1">
                          {regMapping.label}{" "}
                          <span className="text-red-600 font-bold">*</span>
                        </label>
                        <input
                          value={formData[regMapping.formField] || ""}
                          onChange={(e) =>
                            setField(regMapping.formField, e.target.value)
                          }
                          onBlur={() => void lookupRegistration()}
                          className={inputClass}
                          placeholder={regMapping.label}
                        />
                        {errors[regMapping.formField] && (
                          <p className="text-xs text-red-600 mt-1">
                            {errors[regMapping.formField]}
                          </p>
                        )}
                      </div>
                      <div>
                        <label className="block font-medium text-black mb-1">
                          Registration Date{" "}
                          <span className="text-red-600 font-bold">*</span>
                        </label>
                        <input
                          type="date"
                          value={formData[regMapping.dateField] || ""}
                          onChange={(e) =>
                            setField(regMapping.dateField, e.target.value)
                          }
                          className={inputClass}
                        />
                        {errors[regMapping.dateField] && (
                          <p className="text-xs text-red-600 mt-1">
                            {errors[regMapping.dateField]}
                          </p>
                        )}
                      </div>
                    </>
                  )}

                  {entityType === "Proprietorship" && (
                    <div>
                      <label className="block font-medium text-black mb-1">
                        Full Name of Proprietor{" "}
                        <span className="text-red-600 font-bold">*</span>
                      </label>
                      <input
                        value={formData.fullNameProprietor}
                        onChange={(e) =>
                          setField("fullNameProprietor", e.target.value)
                        }
                        className={inputClass}
                        placeholder="Name as per PAN / Aadhaar"
                      />
                      {errors.fullNameProprietor && (
                        <p className="text-xs text-red-600 mt-1">
                          {errors.fullNameProprietor}
                        </p>
                      )}
                    </div>
                  )}

                  {entityType === "Partnership Firm" && (
                    <div>
                      <label className="block font-medium text-black mb-1">
                        Number of Partners{" "}
                        <span className="text-red-600 font-bold">*</span>
                      </label>
                      <input
                        type="number"
                        min="2"
                        value={formData.numberOfPartners}
                        onChange={(e) =>
                          setField("numberOfPartners", e.target.value)
                        }
                        className={inputClass}
                        placeholder="Total partners"
                      />
                      {errors.numberOfPartners && (
                        <p className="text-xs text-red-600 mt-1">
                          {errors.numberOfPartners}
                        </p>
                      )}
                    </div>
                  )}

                  {entityType === "Pvt. Ltd. / Ltd. Company" && (
                    <div>
                      <label className="block font-medium text-black mb-1">
                        Number of Directors{" "}
                        <span className="text-red-600 font-bold">*</span>
                      </label>
                      <input
                        type="number"
                        min="1"
                        value={formData.numberOfDirectors}
                        onChange={(e) =>
                          setField("numberOfDirectors", e.target.value)
                        }
                        className={inputClass}
                        placeholder="Total directors"
                      />
                      {errors.numberOfDirectors && (
                        <p className="text-xs text-red-600 mt-1">
                          {errors.numberOfDirectors}
                        </p>
                      )}
                    </div>
                  )}

                  {entityType === "LLP" && (
                    <div>
                      <label className="block font-medium text-black mb-1">
                        Number of Designated Partners{" "}
                        <span className="text-red-600 font-bold">*</span>
                      </label>
                      <input
                        type="number"
                        min="2"
                        value={formData.numberOfDesignatedPartners}
                        onChange={(e) =>
                          setField("numberOfDesignatedPartners", e.target.value)
                        }
                        className={inputClass}
                        placeholder="Designated partners"
                      />
                      {errors.numberOfDesignatedPartners && (
                        <p className="text-xs text-red-600 mt-1">
                          {errors.numberOfDesignatedPartners}
                        </p>
                      )}
                    </div>
                  )}

                  {entityType === "Trust / Society" && (
                    <div>
                      <label className="block font-medium text-black mb-1">
                        Number of Trustees{" "}
                        <span className="text-red-600 font-bold">*</span>
                      </label>
                      <input
                        type="number"
                        min="1"
                        value={formData.numberOfTrustees}
                        onChange={(e) =>
                          setField("numberOfTrustees", e.target.value)
                        }
                        className={inputClass}
                        placeholder="Total trustees"
                      />
                      {errors.numberOfTrustees && (
                        <p className="text-xs text-red-600 mt-1">
                          {errors.numberOfTrustees}
                        </p>
                      )}
                    </div>
                  )}

                  {entityType === "Govt. / PSU / Local Body" && (
                    <div>
                      <label className="block font-medium text-black mb-1">
                        Department Name{" "}
                        <span className="text-red-600 font-bold">*</span>
                      </label>
                      <input
                        value={formData.departmentName}
                        onChange={(e) =>
                          setField("departmentName", e.target.value)
                        }
                        className={inputClass}
                        placeholder="Department / Office"
                      />
                      {errors.departmentName && (
                        <p className="text-xs text-red-600 mt-1">
                          {errors.departmentName}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Card 4: Letterhead */}
              <div
                id="owner-section-letterhead"
                className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm"
              >
                <h3 className="text-lg font-semibold text-black mb-1">Letterhead</h3>
                <p className="text-sm text-gray-600 mb-4">
                  Upload A4 JPG/PNG letterhead and confirm placement
                </p>

                <div>
                  <label className="block font-medium text-black mb-1">
                    Letterhead Image <span className="text-red-600 font-bold">*</span>
                  </label>
                  <input
                    type="file"
                    accept=".jpg,.jpeg,.png,image/jpeg,image/png"
                    onChange={handleLetterheadChange}
                    className="block w-full text-sm text-gray-700 file:mr-3 file:rounded-lg file:border-0 file:bg-emerald-50 file:px-3 file:py-2 file:text-emerald-800"
                  />
                  {letterheadFile && (
                    <div className="mt-2 flex flex-wrap items-center gap-3">
                      <p className="text-xs text-gray-500 truncate">
                        {letterheadFile.name}
                      </p>
                      <button
                        type="button"
                        onClick={() => setIsLetterheadModalOpen(true)}
                        className="text-sm font-medium text-emerald-700 underline"
                      >
                        View preview
                      </button>
                      {hasViewedLetterhead ? (
                        <span className="text-xs text-emerald-700">
                          Placement confirmed
                        </span>
                      ) : (
                        <p className="text-xs text-amber-700 flex items-center gap-1">
                          Please view the preview to confirm letterhead placement
                        </p>
                      )}
                    </div>
                  )}
                  {errors.letterheadFile && (
                    <p className="text-xs text-red-600 mt-1">
                      {errors.letterheadFile}
                    </p>
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
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isSubmitting || checkingPhone || !documentsComplete}
              className="px-5 py-2.5 rounded-xl bg-emerald-600 text-white font-medium hover:bg-emerald-700 disabled:opacity-60"
            >
              {isSubmitting ? "Submitting…" : `Create ${accountRole}`}
            </button>
          </div>
        </div>
      </div>

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
                        This is a demo showing where your letterhead will be placed
                        in the system.
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
                  <div className="flex-1 overflow-auto p-6">
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
                  <div className="p-4 border-t flex justify-end">
                    <button
                      type="button"
                      onClick={closeLetterheadModal}
                      className="px-5 py-2.5 rounded-xl bg-emerald-600 text-white font-medium hover:bg-emerald-700"
                    >
                      Confirm Placement
                    </button>
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
