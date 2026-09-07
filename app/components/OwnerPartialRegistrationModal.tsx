"use client";

import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import CustomSelect from "@/app/components/CustomSelect";
import { supabase } from "@/app/utils/supabase";
import {
  OWNER_ENTITY_TYPE_OPTIONS,
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

const emptyForm = (): FormState => ({
  entityType: "",
  entityName: "",
  firstName: "",
  middleName: "",
  lastName: "",
  email: "",
  alternatePhone: "",
  addressLine1: "",
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
  }, [open]);

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
    if (field === "alternatePhone") {
      normalized = value.replace(/\D/g, "").slice(0, 10);
    }
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
    require("entityType", "Entity type");
    if (formData.entityType !== "Individual") {
      require("entityName", "Entity name");
    }
    require("firstName", "First name");
    require("lastName", "Last name");
    require("email", "Email");
    require("alternatePhone", "Phone number");
    require("addressLine1", "Address line 1");

    const email = formData.email.trim();
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      next.email = "Enter a valid email";
    }
    const phone = normalizePhone(formData.alternatePhone);
    if (formData.alternatePhone && phone.length !== 10) {
      next.alternatePhone = "Enter a valid 10-digit phone number";
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
    setFormData({
      entityType: fields.entityType || "",
      entityName: fields.entityName || "",
      firstName: fields.firstName || "",
      middleName: fields.middleName || "",
      lastName: fields.lastName || "",
      email: fields.email || "",
      alternatePhone: fields.alternatePhone || "",
      addressLine1: fields.addressLine1 || "",
    });
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

    setIsSubmitting(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) {
        setFormError("You must be signed in to add a new owner");
        return;
      }

      const res = await fetch("/api/owners/partial", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
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
              Enter the required basic details. Remaining registration can be
              completed later on the full registration page.
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

              <div className="md:col-span-2">
                <label className="block font-medium text-black mb-1">
                  Address Line 1 <span className="text-red-600 font-bold">*</span>
                </label>
                <input
                  value={formData.addressLine1}
                  onChange={(e) => setField("addressLine1", e.target.value)}
                  className={inputClass}
                  placeholder="Enter Address Line 1"
                />
                {errors.addressLine1 && (
                  <p className="text-xs text-red-600 mt-1">{errors.addressLine1}</p>
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl border border-gray-300 bg-white text-gray-700 font-medium hover:bg-gray-50"
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isSubmitting || checkingPhone}
              className="px-5 py-2.5 rounded-xl bg-emerald-600 text-white font-medium hover:bg-emerald-700 disabled:opacity-60"
            >
              {isSubmitting ? "Saving…" : "Create Owner"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}
