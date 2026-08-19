"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/app/utils/supabase";
import PDFModal from "./PDFModal";
import OTPVerificationModal from "./OTPVerificationModal";
import EmailOTPVerificationModal from "./EmailOTPVerificationModal";
import { motion, AnimatePresence } from "framer-motion";
import { createPortal } from "react-dom";
import CustomSelect from "@/app/components/CustomSelect";
import RegistrationDocumentAutofillStep from "./RegistrationDocumentAutofillStep";
import {
  buildLicenseAutofillPatch,
  getConsultantCertificateFileField,
  mergeAutofill,
  resolveConsultantCertificateUpload,
  type AutofillFiles,
  type AutofillPatch,
} from "@/app/lib/documentValidation/registrationAutofill";
import {
  isPartialProfileField,
  metadataToFormFields,
  normalizePhone,
  REGISTRATION_NUMBER_META_BY_TYPE,
} from "@/app/utils/consultantRegistrationShared";
import { isValidIndianPincode } from "@/app/utils/pincode";

interface ConsultantRegistrationFormProps {
  title?: string;
}

const ConsultantRegistrationForm: React.FC<ConsultantRegistrationFormProps> = ({
  title = "Consultant Registration"
}) => {
  const router = useRouter();
  const [formError, setFormError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [hasScrolledDeclaration, setHasScrolledDeclaration] = useState(false);
  const [activeSection, setActiveSection] = useState<string>("section-identity-documents");
  
  // Letterhead modal state
  const [letterheadPreviewUrl, setLetterheadPreviewUrl] = useState<string | null>(null);
  const [isPDFModalOpen, setIsPDFModalOpen] = useState(false);
  const [hasViewedLetterhead, setHasViewedLetterhead] = useState(false);
  
  // Phone OTP verification state
  const [showPhoneOTPModal, setShowPhoneOTPModal] = useState(false);
  const [isPhoneVerified, setIsPhoneVerified] = useState(false);
  
  // Email OTP verification state
  const [showEmailOTPModal, setShowEmailOTPModal] = useState(false);
  const [isEmailVerified, setIsEmailVerified] = useState(false);
  const [verifiedUserId, setVerifiedUserId] = useState<string | null>(null);
  const [isResumingIncomplete, setIsResumingIncomplete] = useState(false);
  const [identityExtracted, setIdentityExtracted] = useState(false);
  const [existingLetterheadUrl, setExistingLetterheadUrl] = useState<string | null>(
    null
  );
  const [resumePrompt, setResumePrompt] = useState<{
    user_id: string;
    email?: string;
    metadata: Record<string, unknown>;
  } | null>(null);
  
  // Password visibility state
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  
  // Cleanup object URL on unmount
  useEffect(() => {
    return () => {
      if (letterheadPreviewUrl) {
        URL.revokeObjectURL(letterheadPreviewUrl);
      }
    };
  }, [letterheadPreviewUrl]);

  // Lock body scroll when letterhead modal is open
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (isPDFModalOpen) {
      const scrollY = window.scrollY;
      document.body.style.position = "fixed";
      document.body.style.top = `-${scrollY}px`;
      document.body.style.width = "100%";
      document.body.style.overflow = "hidden";

      return () => {
        document.body.style.position = "";
        document.body.style.top = "";
        document.body.style.width = "";
        document.body.style.overflow = "";
        window.scrollTo(0, scrollY);
      };
    }
  }, [isPDFModalOpen]);

  // Track active section using Intersection Observer
  useEffect(() => {
    const sections = [
      "section-identity-documents",
      "section-basic-details",
      "section-registration",
      "section-documents",
      "section-letterhead",
      "section-login",
      "section-declaration",
    ];

    const observerOptions = {
      root: null,
      rootMargin: "-20% 0px -60% 0px", // Trigger when section is in the upper portion of viewport
      threshold: 0,
    };

    const observerCallback = (entries: IntersectionObserverEntry[]) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          setActiveSection(entry.target.id);
        }
      });
    };

    const observer = new IntersectionObserver(observerCallback, observerOptions);

    sections.forEach((sectionId) => {
      const element = document.getElementById(sectionId);
      if (element) {
        observer.observe(element);
      }
    });

    return () => {
      sections.forEach((sectionId) => {
        const element = document.getElementById(sectionId);
        if (element) {
          observer.unobserve(element);
        }
      });
    };
  }, [identityExtracted, isResumingIncomplete]);

  const declarationText = `I, the undersigned Developer/Promoter/Owner, hereby solemnly declare and confirm as follows:

Accuracy of Information & Documents:
I affirm that all details, documents, approvals, title papers, drawings, certificates, calculations, and project-related information submitted or uploaded on DraftDesk are true, correct, genuine, and updated to the best of our knowledge and belief.

Authority & Ownership:
I confirm that I am the lawful owner(s)/developer(s)/promoter(s) of the project or have valid authority/Power of Attorney/Development Agreement to undertake the proposed development activities and to upload related documents.

Compliance With Laws:
I agree that all project submissions made through the DraftDesk platform shall comply with:
• DCPR-2034, MMC Act, MR&TP Act, MOEF & CC guidelines
• Relevant notifications, circulars, orders issued by BMC/SRA/MMRDA/MHADA/Govt. of Maharashtra
• All applicable regulatory, environmental, fire, structural, and statutory requirements.

Responsibility of Developer/Promoter:
I understand that DraftDesk is a facilitation platform and does not verify, certify, scrutinize or approve our project. The correctness, legality, and validity of documents submitted through the platform remain solely my/our responsibility.

Engagement of Consultants:
I confirm that all Consultants, Architects, Engineers, and Technical Personnel engaged by us on the DraftDesk platform are duly qualified, registered, and authorized. Any documents generated by them shall be deemed to have been submitted with my/our consent.

No Misuse / No Unlawful Activities:
I undertake not to use DraftDesk for any fraudulent purpose, unauthorized documentation, manipulation of drawings/data, or misrepresentation before any authority.

Confidentiality & Data Use:
I understand that project documents uploaded by us may be processed for generating drafts, scrutiny reports, compliance sheets, and other application-related materials.
I take full responsibility for maintaining confidentiality and access control to our project dashboard.

Indemnity:
I hereby indemnify and keep DraftDesk, its owners, developers, partners, and employees harmless against any loss, liability, proceedings, damages, penalties, or claims arising due to any incorrect, incomplete, misleading, unauthorized, or illegal submissions made by me/us or on my/our behalf.

Digital Acceptance:
I acknowledge that acceptance of this declaration digitally shall be treated as valid and binding as if physically signed and executed.

Updates, Modifications & Terms of Use:
I agree to abide by any updated terms, policies, or guidelines issued by DraftDesk from time to time and shall ensure that our project information complies with the latest standards.

Voluntary Execution:
I am registering on DraftDesk voluntarily and fully understand the nature, scope, and implications of this declaration.

DECLARATION
I hereby declare that I have read, understood, and agree to comply with all the above terms and conditions as a Developer/Promoter/Owner on DraftDesk.`;

  const handleDeclarationScroll = (e: React.UIEvent<HTMLTextAreaElement>) => {
    const target = e.target as HTMLTextAreaElement;
    const isAtBottom = target.scrollHeight - target.scrollTop <= target.clientHeight + 10;
    if (isAtBottom) {
      setHasScrolledDeclaration(true);
    }
  };
  
  // Form state to preserve data across sections
  const [formData, setFormData] = useState({
    // Profile (Common)
    consultantType: "",
    firstName: "",
    middleName: "",
    lastName: "",
    entityName: "",
    city: "",
    pincode: "",
    email: "",
    alternatePhone: "",
    pan: "",
    address: "",
    addressLine1: "",
    addressLine2: "",
    addressLine3: "",
    gstNo: "",
    authorizedSignatoryPhotoFile: null as File | null,
    authorizedSignatorySignatureFile: null as File | null,
    aadhaarCardFile: null as File | null,
    panCardFile: null as File | null,
    licenseCertificateFile: null as File | null,
    letterheadFile: null as File | null,
    
    // Common registration date for all consultant types
    registrationDate: "",
    
    // Architect fields
    coaRegNo: "",
    coaExpiryDate: "",
    coaCertificateFile: null as File | null,
    aadhaarNo: "",
    dscFile: null as File | null,
    officeAddress: "",
    experienceYears: "",
    
    // Structural Engineer fields
    structuralLicenseNo: "",
    structuralValidity: "",
    structuralLicenseFile: null as File | null,
    qualification: "",
    professionalIndemnityInsurance: "",
    majorProjectsList: "",
    
    // Licensed Surveyor fields
    lbsLicenseNo: "",
    competencyClass: "",
    lbsCertificateFile: null as File | null,
    lbsExpiryDate: "",
    
    // Fire Consultant fields
    fireLicenseNo: "",
    fireSystemQualification: "",
    pastNocFile: null as File | null,
    firmAccreditationFile: null as File | null,
    fireValidityDate: "",
    
    // MEP Consultant fields
    electricalLicenseNo: "",
    electricalExpiryDate: "",
    pwdAccreditation: "",
    mepExperienceFile: null as File | null,
    dscTokenId: "",
    
    // Plumber fields
    plumberLicenseNo: "",
    plumberExpiryDate: "",
    pheAccreditationFile: null as File | null,
    plumbingExperience: "",
    plumberIdFile: null as File | null,
    
    // Geotechnical / Soil Testing fields
    nablAccreditationNo: "",
    nablExpiryDate: "",
    labRegistrationFile: null as File | null,
    equipmentListFile: null as File | null,
    geotechQualification: "",
    
    // Landscape Consultant fields
    landscapeLicenseNo: "",
    landscapeCertificateFile: null as File | null,
    landscapeExpiryDate: "",
    
    // PMC / Project Manager fields
    pmcRegistrationNo: "",
    pmcCertificateFile: null as File | null,
    pmcExpiryDate: "",
    
    // Environmental Consultant fields
    envLicenseNo: "",
    envCertificateFile: null as File | null,
    envExpiryDate: "",
    
    // Town Planner fields
    townPlannerLicenseNo: "",
    townPlannerCertificateFile: null as File | null,
    townPlannerExpiryDate: "",
    
    // Login
    userId: "",
    password: "",
    confirmPassword: "",
    acceptDeclaration: false,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const licenseExtractedRef = useRef<Record<string, string | null> | null>(null);

  const composeAddress = (line1: string, line2: string, line3: string): string =>
    [line1, line2, line3].map((v) => v.trim()).filter(Boolean).join("\n");

  const handleInputChange = (field: string, value: string | boolean) => {
    if (isResumingIncomplete && isPartialProfileField(field)) {
      return;
    }
    const normalizedValue =
      field === "pan" && typeof value === "string" ? value.toUpperCase() : value;
    setFormData(prev => {
      const updated = {
        ...prev,
        [field]: normalizedValue
      };
      if (field === "addressLine1" || field === "addressLine2" || field === "addressLine3") {
        updated.address = composeAddress(
          String(updated.addressLine1 || ""),
          String(updated.addressLine2 || ""),
          String(updated.addressLine3 || "")
        );
      }
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

  const applyResumeFromMetadata = (
    userId: string,
    metadata: Record<string, unknown>,
    email?: string
  ) => {
    const fields = metadataToFormFields(metadata);
    setFormData((prev) => ({
      ...prev,
      ...fields,
      email: fields.email || email || prev.email,
      address: composeAddress(
        fields.addressLine1 || "",
        fields.addressLine2 || "",
        fields.addressLine3 || ""
      ),
    }));
    setVerifiedUserId(userId);
    setIsPhoneVerified(true);
    setIsEmailVerified(true);
    setIsResumingIncomplete(true);
    setIdentityExtracted(true);
    const existingLh = String(metadata.letterhead_url || "").trim();
    setExistingLetterheadUrl(existingLh || null);
    if (existingLh) {
      setHasViewedLetterhead(true);
      setErrors((prev) => {
        const next = { ...prev };
        delete next.letterheadFile;
        return next;
      });
    }
    setResumePrompt(null);
    setFormError("");
    setErrors((prev) => {
      const next = { ...prev };
      delete next.alternatePhone;
      delete next.email;
      return next;
    });
  };

  const lookupPhoneBeforeVerify = async (): Promise<boolean> => {
    const phone = normalizePhone(formData.alternatePhone);
    if (phone.length !== 10) {
      setErrors((prev) => ({
        ...prev,
        alternatePhone: "Please enter a valid 10-digit phone number",
      }));
      return false;
    }

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
        });
        return false;
      }

      return true;
    } catch {
      setFormError("Failed to verify phone number uniqueness. Please try again.");
      return false;
    }
  };

  const lookupRegistrationUniqueness = async (regField?: string) => {
    const mapping = REGISTRATION_NUMBER_META_BY_TYPE[formData.consultantType];
    if (!mapping) return;
    if (regField && regField !== mapping.formField) return;

    const regNo = String(
      (formData as Record<string, unknown>)[mapping.formField] || ""
    ).trim();
    if (!regNo) return;

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
      if (
        (data.status === "incomplete" || data.status === "complete") &&
        data.user_id &&
        data.user_id !== verifiedUserId
      ) {
        setErrors((prev) => ({
          ...prev,
          [mapping.formField]: "This registration number is already registered",
        }));
        setFormError("This registration number is already registered");
      }
    } catch {
      // non-blocking on blur
    }
  };

  const handleFileChange = (field: string, file: File | null) => {
    if (isResumingIncomplete && isPartialProfileField(field)) {
      return;
    }
    setFormData(prev => {
      const updated = {
        ...prev,
        [field]: file
      };
      validateField(field, file, updated);
      return updated;
    });
  };

  const wireLicenseCertificateFile = (
    data: Record<string, unknown>,
    consultantType: string
  ) => {
    const licenseFile = data.licenseCertificateFile;
    if (!(licenseFile instanceof File)) return data;
    const certField = getConsultantCertificateFileField(consultantType);
    if (!certField) return data;
    return { ...data, [certField]: licenseFile };
  };

  const applyRegistrationAutofill = (
    patch: AutofillPatch,
    files: AutofillFiles,
    extractions?: Partial<
      Record<
        "aadhaar" | "pan" | "technical-person-license",
        Record<string, string | null>
      >
    >,
    options?: { overwriteKeys?: readonly string[] }
  ) => {
    if (extractions?.["technical-person-license"]) {
      licenseExtractedRef.current = extractions["technical-person-license"];
    }

    setFormData((prev) => {
      let merged = mergeAutofill(prev, patch, options);
      if (patch.addressLine1 || patch.addressLine2 || patch.addressLine3) {
        merged.address = composeAddress(
          String(merged.addressLine1 || ""),
          String(merged.addressLine2 || ""),
          String(merged.addressLine3 || "")
        );
      }
      if ("aadhaarCardFile" in files) {
        merged.aadhaarCardFile = files.aadhaarCardFile ?? null;
      }
      if ("panCardFile" in files) {
        merged.panCardFile = files.panCardFile ?? null;
      }
      if ("licenseCertificateFile" in files) {
        merged.licenseCertificateFile = files.licenseCertificateFile ?? null;
      }

      if (licenseExtractedRef.current && merged.consultantType) {
        const licensePatch = buildLicenseAutofillPatch(
          licenseExtractedRef.current,
          merged.consultantType,
          "consultant"
        );
        merged = mergeAutofill(merged, licensePatch);
        merged = wireLicenseCertificateFile(
          merged as Record<string, unknown>,
          merged.consultantType
        ) as typeof merged;
      }

      return merged;
    });

    Object.entries(patch).forEach(([field, value]) => {
      if (typeof value === "string" && value.trim()) {
        validateField(field, value);
      }
    });
  };

  useEffect(() => {
    if (!licenseExtractedRef.current || !formData.consultantType) return;

    const licensePatch = buildLicenseAutofillPatch(
      licenseExtractedRef.current,
      formData.consultantType,
      "consultant"
    );

    setFormData((prev) => {
      let merged = mergeAutofill(prev, licensePatch);
      merged = wireLicenseCertificateFile(
        merged as Record<string, unknown>,
        formData.consultantType
      ) as typeof merged;
      if (merged.addressLine1 || merged.addressLine2 || merged.addressLine3) {
        merged.address = composeAddress(
          String(merged.addressLine1 || ""),
          String(merged.addressLine2 || ""),
          String(merged.addressLine3 || "")
        );
      }
      return merged;
    });
  }, [formData.consultantType]);

  // Handler for letterhead file change - creates preview URL and opens modal (image, A4 only)
  const handleLetterheadChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) {
      return;
    }

    const file = files[0];

    // Validate it's an image (JPG, PNG)
    const validImageTypes = ["image/jpeg", "image/jpg", "image/png"];
    const validExtensions = [".jpg", ".jpeg", ".png"];
    const isValidImage =
      validImageTypes.includes(file.type) ||
      validExtensions.some((ext) => file.name.toLowerCase().endsWith(ext));

    if (!isValidImage) {
      setFormError("Please upload a JPG or PNG image file for letterhead");
      setErrors((prev) => ({
        ...prev,
        letterheadFile: "Please upload a JPG or PNG image file",
      }));
      return;
    }

    // Optimistically set file so UI updates immediately
    handleFileChange("letterheadFile", file);
    setErrors((prev) => ({ ...prev, letterheadFile: "" }));

    const img = document.createElement('img');
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      // A4 aspect ratio: 210mm x 297mm ≈ 0.707 (width/height)
      const aspectRatio = img.width / img.height;
      const a4Ratio = 210 / 297;
      const tolerance = 0.02; // ±2%

      if (aspectRatio < a4Ratio - tolerance || aspectRatio > a4Ratio + tolerance) {
        setFormError(
          "Letterhead image must be of A4 size (210mm x 297mm aspect ratio)"
        );
        setErrors((prev) => ({
          ...prev,
          letterheadFile: "Letterhead image must be of A4 size (210mm x 297mm aspect ratio)",
        }));
        // Remove file & preview if validation fails (without re-validating the field)
        setFormData((prev) => ({
          ...prev,
          letterheadFile: null,
        }));
        if (letterheadPreviewUrl) {
          URL.revokeObjectURL(letterheadPreviewUrl);
          setLetterheadPreviewUrl(null);
        }
        URL.revokeObjectURL(objectUrl);
        e.target.value = "";
        setHasViewedLetterhead(false);
        return;
      }

      if (letterheadPreviewUrl) {
        URL.revokeObjectURL(letterheadPreviewUrl);
      }
      setLetterheadPreviewUrl(objectUrl);

      // Reset viewed state and open modal
      setHasViewedLetterhead(false);
      setIsPDFModalOpen(true);
    };

    img.onerror = () => {
      setFormError("Failed to load image. Please try again.");
      setErrors((prev) => ({
        ...prev,
        letterheadFile: "Failed to load image",
      }));
      handleFileChange("letterheadFile", null);
      if (letterheadPreviewUrl) {
        URL.revokeObjectURL(letterheadPreviewUrl);
        setLetterheadPreviewUrl(null);
      }
      URL.revokeObjectURL(objectUrl);
      e.target.value = "";
      setHasViewedLetterhead(false);
    };

    img.src = objectUrl;
  };

  // Remove letterhead handler
  const handleRemoveLetterhead = () => {
    handleFileChange("letterheadFile", null);
    if (letterheadPreviewUrl) {
      URL.revokeObjectURL(letterheadPreviewUrl);
      setLetterheadPreviewUrl(null);
    }
    setHasViewedLetterhead(false);
  };

  // Upload file to Supabase Storage using idempotent method (hash-based)
  // For letterhead and photos, use idempotent upload
  // For other documents, use timestamp-based (backward compatibility)
  const uploadFileToStorageWithPath = async (
    file: File, 
    userId: string, 
    fileType: string
  ): Promise<{ url: string; path: string } | null> => {
    try {
      // Use idempotent upload for letterhead and photos
      if (fileType === 'letterhead' || fileType === 'signatory_photo') {
        const { uploadFileIdempotent } = await import('@/app/utils/fileUtils');
        
        // Map fileType to the format expected by uploadFileIdempotent
        const uploadFileType = fileType === 'letterhead' ? 'letterhead' : 'photo';
        
        try {
          const result = await uploadFileIdempotent(file, userId, uploadFileType, supabase);
          
          if (result) {
            return {
              url: result.url,
              path: result.path
            };
          }
        } catch (err: any) {
          console.error(`Error in idempotent upload for ${fileType}:`, err);
          // Fall back to timestamp-based upload if idempotent fails
        }
        // If idempotent upload fails, continue to timestamp-based upload below
      }
      
      // For other files, use timestamp-based naming (backward compatibility)
      const fileExt = file.name.split('.').pop();
      const fileName = `${userId}/${fileType}_${Date.now()}.${fileExt}`;
      
      const { data, error } = await supabase.storage
        .from('consultant-documents')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (error) {
        console.error(`Error uploading ${fileType}:`, error);
        return null;
      }

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('consultant-documents')
        .getPublicUrl(data.path);

      return {
        url: urlData.publicUrl,
        path: data.path  // Store path for potential rollback
      };
    } catch (err) {
      console.error(`Unexpected error uploading ${fileType}:`, err);
      return null;
    }
  };

  const sections = [
    { id: "section-identity-documents", label: "Identity Documents" },
    { id: "section-basic-details", label: "Basic Details" },
    { id: "section-registration", label: "Registration Numbers" },
    { id: "section-documents", label: "Documents Upload" },
    { id: "section-letterhead", label: "Letterhead" },
    { id: "section-login", label: "Login Setup" },
    { id: "section-declaration", label: "Declaration" },
  ];

  const profileFields: readonly string[] = [
    "consultantType",
    "firstName",
    "lastName",
    "email",
    "city",
    "pincode",
    "addressLine1",
    "gstNo",
    "alternatePhone",
  ];

  const credentialFields: readonly string[] = [
    "coaRegNo",
    "coaExpiryDate",
    "authorizedSignatoryPhotoFile",
    "authorizedSignatorySignatureFile",
    "aadhaarCardFile",
    "panCardFile",
    "licenseCertificateFile",
  ];

  const loginFields: readonly string[] = ["userId", "password", "confirmPassword", "acceptDeclaration"];

  const requiredFields = [...profileFields, ...credentialFields, ...loginFields];

  const otherSectionsUnlocked = identityExtracted || isResumingIncomplete;

  const scrollToSection = (sectionId: string) => {
    if (sectionId !== "section-identity-documents" && !otherSectionsUnlocked) {
      setFormError("Upload and extract identity documents first.");
      return;
    }
    const element = document.getElementById(sectionId);
    if (element) {
      setActiveSection(sectionId);
      element.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
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


    // Check if userId already exists
    const checkUserIdUniqueness = async (userId: string): Promise<boolean> => {
      if (!userId || userId.trim() === "") {
        return false;
      }
      
      const trimmedUserId = userId.trim();
      
      try {
        const response = await fetch('/api/get-user-email', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ user_id: trimmedUserId }),
        });
  
        // If user exists (200), userId is not unique
        // If user doesn't exist (404), userId is unique
        if (response.ok) {
          return true; // User exists, userId is taken
        } else if (response.status === 404) {
          return false; // User doesn't exist, userId is available
        } else {
          // Other errors - allow registration (database will enforce uniqueness)
          // This prevents blocking valid registrations due to API issues
          console.warn('Error checking userId uniqueness, allowing registration:', response.status);
          return false;
        }
      } catch (error) {
        console.error('Error checking userId uniqueness:', error);
        // On network error, allow registration (database will enforce uniqueness)
        return false;
      }
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
      case "firstName":
        if (!value || (typeof value === "string" && value.trim() === "")) {
          error = "First name is required";
        }
        break;
      case "lastName":
        if (!value || (typeof value === "string" && value.trim() === "")) {
          error = "Last name is required";
        }
        break;
      case "email":
        if (!value) error = "Email is required";
        else if (!emailRegex.test(value as string)) error = "Enter a valid email address";
        break;
      case "city":
        if (!value) error = "City is required";
        break;
      case "alternatePhone":
        if (!value) {
          error = "Phone number is required";
        } else if (!/^\d{10}$/.test(value as string)) {
          error = "Phone number must be 10 digits";
        }
        break;
      case "pincode":
        if (!value) error = "Pincode is required";
        else if (!isValidIndianPincode(value as string))
          error = "Enter a 6-digit pincode";
        break;
      case "addressLine1":
        if (!value) error = "Address line 1 is required";
        break;
      case "addressLine2":
      case "addressLine3":
        break;
      case "gstNo":
        // GST No is optional, but if provided, validate format
        if (value && !/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(value as string)) {
          error = "Enter valid GST No (e.g., 22AAAAA0000A1Z5)";
        }
        break;
      case "pan":
        // Optional: only validate if user entered something
        if (value && typeof value === "string" && value.trim() !== "") {
          if (!panRegex.test(value as string)) {
            error = "Enter valid PAN: first 5 letters, 4 digits, last letter";
          }
        }
        break;
      case "authorizedSignatoryPhotoFile":
        if (!value) error = "Upload photograph";
        break;
      case "authorizedSignatorySignatureFile":
        if (!value) error = "Upload signature";
        break;
      case "aadhaarCardFile":
        if (!value) error = "Upload Aadhaar Card in Identity Documents";
        break;
      case "panCardFile":
        if (!value) error = "Upload PAN Card in Identity Documents";
        break;
      case "licenseCertificateFile":
        if (!value) error = "Upload Technical Person License in Identity Documents";
        break;
      case "letterheadFile":
        if (!value && !existingLetterheadUrl) error = "Upload Letterhead";
        break;
      case "coaRegNo":
        if (!value) {
          error = "COA registration number is required";
        } else {
          // COA format: CA/YYYY/XXXXX (e.g., CA/2020/12345 or CA/20/12345)
          const coaRegex = /^CA\/\d{2,4}\/\d{4,8}$/i;
          if (!coaRegex.test(value as string)) {
            error = "Enter valid COA format: CA/YYYY/XXXXX (e.g., CA/2020/12345)";
          }
        }
        break;
      case "registrationDate":
        if (!value) {
          error = "Registration date is required";
        } else {
          const selected = new Date(value as string);
          selected.setHours(0, 0, 0, 0);
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          if (selected > today) {
            error = "Registration date cannot be in the future";
          }
        }
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
      case "coaCertificateFile":
      case "structuralLicenseFile":
      case "lbsCertificateFile":
      case "mepExperienceFile":
      case "pheAccreditationFile":
      case "pastNocFile":
      case "landscapeCertificateFile":
      case "pmcCertificateFile":
      case "labRegistrationFile":
      case "envCertificateFile":
      case "townPlannerCertificateFile":
        break;
      // Structural Engineer
      case "structuralLicenseNo":
        if (!value) {
          error = "Structural Engineer License No is required";
        } else {
          // Structural License format: Alphanumeric, typically MCGM/XXXX or UDD/XXXX or similar
          const structuralRegex = /^[A-Z]{2,10}\/?[A-Z0-9]{4,15}$/i;
          if (!structuralRegex.test(value as string)) {
            error = "Enter valid license format (e.g., MCGM/12345 or UDD/2020/123)";
          }
        }
        break;
      case "structuralValidity":
        if (!value) {
          error = "License issue date is required";
        } else {
          const selected = new Date(value as string);
          selected.setHours(0, 0, 0, 0);
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          if (selected < today) {
            error = "License issue date cannot be in the past";
          }
        }
        break;
      // Licensed Surveyor
      case "lbsLicenseNo":
        if (!value) {
          error = "LBS License Number is required";
        } else {
          // LBS License format: Alphanumeric, typically LBS/XXXX or just alphanumeric
          const lbsRegex = /^[A-Z0-9]{5,20}$/i;
          if (!lbsRegex.test(value as string)) {
            error = "Enter valid LBS License Number (5-20 alphanumeric characters)";
          }
        }
        break;
      case "competencyClass":
        if (!value) error = "Competency Class is required";
        break;
      case "lbsExpiryDate":
        if (!value) {
          error = "Expiry date is required";
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
      // MEP Consultant
      case "electricalLicenseNo":
        if (!value) {
          error = "Electrical License No is required";
        } else {
          // Electrical License format: Alphanumeric, typically EL/XXXX or similar
          const electricalRegex = /^[A-Z0-9\/\-]{5,25}$/i;
          if (!electricalRegex.test(value as string)) {
            error = "Enter valid Electrical License No (5-25 alphanumeric characters, / or - allowed)";
          }
        }
        break;
      case "electricalExpiryDate":
        if (!value || (typeof value === "string" && value.trim() === "")) {
          error = "Expiry date is required";
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
      // Plumber
      case "plumberLicenseNo":
        if (!value) {
          error = "Plumber License No is required";
        } else {
          // Plumber License format: Alphanumeric
          const plumberRegex = /^[A-Z0-9]{5,20}$/i;
          if (!plumberRegex.test(value as string)) {
            error = "Enter valid Plumber License No (5-20 alphanumeric characters)";
          }
        }
        break;
      case "plumberExpiryDate":
        if (!value || (typeof value === "string" && value.trim() === "")) {
          error = "Expiry date is required";
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
      // Fire Consultant
      case "fireLicenseNo":
        if (!value) {
          error = "Fire License / CFO Accreditation No is required";
        } else {
          // Fire License / CFO format: Alphanumeric, typically CFO/XXXX or similar
          const fireRegex = /^[A-Z0-9\/\-]{5,25}$/i;
          if (!fireRegex.test(value as string)) {
            error = "Enter valid Fire License / CFO Accreditation No (5-25 alphanumeric characters, / or - allowed)";
          }
        }
        break;
      case "fireValidityDate":
        if (!value) {
          error = "Validity date is required";
        } else {
          const selected = new Date(value as string);
          selected.setHours(0, 0, 0, 0);
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          if (selected < today) {
            error = "Validity date cannot be in the past";
          }
        }
        break;
      // Landscape Consultant
      case "landscapeLicenseNo":
        if (!value) {
          error = "Landscape License No is required";
        } else {
          // Landscape License format: Alphanumeric
          const landscapeRegex = /^[A-Z0-9]{5,25}$/i;
          if (!landscapeRegex.test(value as string)) {
            error = "Enter valid Landscape License No (5-25 alphanumeric characters)";
          }
        }
        break;
      case "landscapeExpiryDate":
        if (!value) {
          error = "Expiry date is required";
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
      // PMC / Project Manager
      case "pmcRegistrationNo":
        if (!value) {
          error = "PMC Registration No is required";
        } else {
          // PMC Registration format: Alphanumeric, typically PMC/XXXX or similar
          const pmcRegex = /^[A-Z0-9\/\-]{5,25}$/i;
          if (!pmcRegex.test(value as string)) {
            error = "Enter valid PMC Registration No (5-25 alphanumeric characters, / or - allowed)";
          }
        }
        break;
      case "pmcExpiryDate":
        if (!value) {
          error = "Expiry date is required";
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
      // Geotechnical Consultant
      case "nablAccreditationNo":
        if (!value) {
          error = "NABL Accreditation No is required";
        } else {
          // NABL format: Typically NABL/XXXX/XXXX or alphanumeric
          const nablRegex = /^NABL\/[A-Z0-9]{2,10}\/[A-Z0-9]{4,10}$|^[A-Z0-9]{8,25}$/i;
          if (!nablRegex.test(value as string)) {
            error = "Enter valid NABL Accreditation No (e.g., NABL/XXXX/XXXX or alphanumeric 8-25 chars)";
          }
        }
        break;
      case "nablExpiryDate":
        if (!value || (typeof value === "string" && value.trim() === "")) {
          error = "Expiry date is required";
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
      // Environmental Consultant
      case "envLicenseNo":
        if (!value) {
          error = "Environmental License No is required";
        } else {
          // Environmental License format: Alphanumeric
          const envRegex = /^[A-Z0-9\/\-]{5,25}$/i;
          if (!envRegex.test(value as string)) {
            error = "Enter valid Environmental License No (5-25 alphanumeric characters, / or - allowed)";
          }
        }
        break;
      case "envExpiryDate":
        if (!value) {
          error = "Expiry date is required";
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
      // Town Planner
      case "townPlannerLicenseNo":
        if (!value) {
          error = "Town Planner License No is required";
        } else {
          // Town Planner License format: Alphanumeric
          const townPlannerRegex = /^[A-Z0-9\/\-]{5,25}$/i;
          if (!townPlannerRegex.test(value as string)) {
            error = "Enter valid Town Planner License No (5-25 alphanumeric characters, / or - allowed)";
          }
        }
        break;
      case "townPlannerExpiryDate":
        if (!value) {
          error = "Expiry date is required";
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
      case "userId":
        if (!value) error = "User ID is required";
        break;
      case "password":
        if (!value) error = "Password is required";
        else {
          const pwd = value as string;
          if (pwd.length < 8) error = "Password must be at least 8 characters";
          else if (!/[A-Z]/.test(pwd)) error = "Password must contain at least one uppercase letter";
          else if (!/[a-z]/.test(pwd)) error = "Password must contain at least one lowercase letter";
          else if (!/[0-9]/.test(pwd)) error = "Password must contain at least one number";
          else if (!/[!@#$%^&*(),.?":{}|<>]/.test(pwd)) error = "Password must contain at least one special character (!@#$%^&*...)";
        }
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
        console.log('Validation failed for field:', field, 'with value:', value);
      }
    });
    return valid;
  };

  const handleSubmitForm = async () => {
    if (!otherSectionsUnlocked) {
      setFormError("Upload and extract identity documents first.");
      scrollToSection("section-identity-documents");
      return;
    }

    // Build dynamic required fields based on consultant type
    const getDynamicRequiredFields = (): string[] => {
      const baseFields = [
        "consultantType",
        "email",
        "city",
        "pincode",
        "addressLine1",
        "alternatePhone",
        "pan",
        "aadhaarCardFile",
        "panCardFile",
        "licenseCertificateFile",
        "authorizedSignatoryPhotoFile",
        "authorizedSignatorySignatureFile",
        ...(existingLetterheadUrl ? [] : ["letterheadFile"]),
        "registrationDate",
        "userId",
        "password",
        "confirmPassword",
        "acceptDeclaration",
      ];

      const typeSpecificFields: Record<string, string[]> = {
        "Architect": ["coaRegNo", "coaExpiryDate"],
        "Structural Engineer": ["structuralLicenseNo", "structuralValidity"],
        "Licensed Surveyor": ["lbsLicenseNo", "competencyClass", "lbsExpiryDate"],
        "MEP Consultant": ["electricalLicenseNo", "electricalExpiryDate"],
        "Plumber": ["plumberLicenseNo", "plumberExpiryDate"],
        "Fire Consultant": ["fireLicenseNo", "fireValidityDate"],
        "Landscape Consultant": ["landscapeLicenseNo", "landscapeExpiryDate"],
        "PMC / Project Manager": ["pmcRegistrationNo", "pmcExpiryDate"],
        "Geotechnical Consultant": ["nablAccreditationNo", "nablExpiryDate"],
        "Environmental Consultant": ["envLicenseNo", "envExpiryDate"],
        "Town Planner": ["townPlannerLicenseNo", "townPlannerExpiryDate"],
      };

      const consultantTypeFields = typeSpecificFields[formData.consultantType] || [];
      return [...baseFields, ...consultantTypeFields];
    };

    const dynamicRequiredFields = getDynamicRequiredFields();
    console.log('Validating fields for', formData.consultantType, ':', dynamicRequiredFields);
    console.log('Form data:', formData);
    
    const isValid = validateFields(dynamicRequiredFields);
    console.log('Validation result:', isValid);
    console.log('Current errors:', errors);
    
    // Check if email and phone are verified
    if (!isEmailVerified) {
      setFormError("Please verify your email address before submitting");
      scrollToSection("section-basic-details");
      return;
    }
    
    if (!isPhoneVerified) {
      setFormError("Please verify your phone number before submitting");
      scrollToSection("section-basic-details");
      return;
    }
    
    if (!isValid) {
      setFormError("Please fill all the necessary fields");
      
      // Scroll to first error field
      const errorFields = Object.keys(errors);
      const firstErrorField = errorFields[0];
      if (firstErrorField.includes('consultantType') || firstErrorField.includes('email') || firstErrorField.includes('city')) {
        scrollToSection("section-basic-details");
      } else if (
        firstErrorField === "aadhaarCardFile" ||
        firstErrorField === "panCardFile" ||
        firstErrorField === "licenseCertificateFile"
      ) {
        scrollToSection("section-identity-documents");
      } else if (firstErrorField.includes('RegNo') || firstErrorField.includes('License') || firstErrorField.includes('Accreditation')) {
        scrollToSection("section-registration");
      } else if (firstErrorField.includes('File') || firstErrorField.includes('Photo') || firstErrorField.includes('Signature')) {
        scrollToSection("section-documents");
      } else if (firstErrorField.includes('letterhead')) {
        scrollToSection("section-letterhead");
      } else if (firstErrorField.includes('userId') || firstErrorField.includes('password')) {
        scrollToSection("section-login");
      } else if (firstErrorField.includes('Declaration')) {
        scrollToSection("section-declaration");
      }
      return;
    }
    
    setFormError("");
    setIsSubmitting(true);

    try {
      // Phone + registration uniqueness (skip self when resuming incomplete profile)
      const phoneLookupRes = await fetch("/api/consultants/lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: formData.alternatePhone }),
      });
      const phoneLookup = await phoneLookupRes.json();
      if (
        phoneLookup.status === "complete" ||
        (phoneLookup.status === "incomplete" &&
          phoneLookup.user_id &&
          phoneLookup.user_id !== verifiedUserId)
      ) {
        setFormError(
          phoneLookup.status === "complete"
            ? "This phone number is already registered"
            : "This phone number belongs to another incomplete registration"
        );
        setIsSubmitting(false);
        scrollToSection("section-basic-details");
        return;
      }

      const regMapping = REGISTRATION_NUMBER_META_BY_TYPE[formData.consultantType];
      if (regMapping) {
        const regNo = String(
          (formData as Record<string, unknown>)[regMapping.formField] || ""
        ).trim();
        if (regNo) {
          const regLookupRes = await fetch("/api/consultants/lookup", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              registrationNumber: regNo,
              consultantType: formData.consultantType,
            }),
          });
          const regLookup = await regLookupRes.json();
          if (
            (regLookup.status === "incomplete" || regLookup.status === "complete") &&
            regLookup.user_id &&
            regLookup.user_id !== verifiedUserId
          ) {
            setFormError("This registration number is already registered");
            setIsSubmitting(false);
            scrollToSection("section-registration");
            return;
          }
        }
      }

       // Step 0: Check if userId already exists
       console.log('=== USER ID UNIQUENESS CHECK START ===');
       console.log('Checking userId uniqueness for:', formData.userId);
       
       if (!formData.userId || formData.userId.trim() === "") {
         console.error('ERROR: userId is empty!');
         setFormError("User ID is required.");
         setIsSubmitting(false);
         return;
       }
       
       const userIdExists = await checkUserIdUniqueness(formData.userId);
       
       if (userIdExists) {
         setFormError("This User ID is already taken. Please choose a different one.");
         setFieldError("userId", "This User ID is already taken");
         setIsSubmitting(false);
         scrollToSection("section-login");
         return;
       }



      // User was created during email OTP verification - set their password
      if (!verifiedUserId) {
        setFormError('Email verification is required. Please verify your email address first.');
        setIsSubmitting(false);
        scrollToSection("section-basic-details");
        return;
      }
      
      console.log('Using verified user ID from email OTP:', verifiedUserId);
      const userId = verifiedUserId;
      
      // Update the user's password using edge function
      const { data: updateData, error: updateError } = await supabase.functions.invoke('update-user-password', {
        body: {
          userId: verifiedUserId,
          password: formData.password,
          metadata: {
            consultant_type: formData.consultantType,
            first_name: formData.firstName,
            middle_name: formData.middleName || null,
            last_name: formData.lastName,
            entity_name: formData.entityName || null,
            user_id: formData.userId,
            status: 'pending'
          }
        }
      });
      
      if (updateError) {
        console.error('Failed to update user password:', updateError);
        setFormError('Failed to set password. Please try again.');
        setIsSubmitting(false);
        return;
      }
      console.log('Password set successfully for verified user');

      // Track uploaded file paths for rollback if needed
      const uploadedFilePaths: string[] = [];

      // Helper function to delete uploaded files on failure
      const rollbackUploadedFiles = async () => {
        if (uploadedFilePaths.length > 0) {
          console.log('Rolling back uploaded files:', uploadedFilePaths);
          const { error } = await supabase.storage
            .from('consultant-documents')
            .remove(uploadedFilePaths);
          if (error) {
            console.error('Error during rollback:', error);
          }
        }
      };

      // Helper function to delete auth user on failure (requires admin role, so just log)
      const rollbackAuthUser = async () => {
        console.log('Auth user created but registration failed. User ID:', userId);
      };

      // Step 2: Upload all files to Supabase Storage
      let authorizedSignatoryPhotoUrl: string | null = null;
      let authorizedSignatorySignatureUrl: string | null = null;
      let aadhaarCardUrl: string | null = null;
      let panCardUrl: string | null = null;
      let letterheadUrl: string | null = null;
      let certificateUrl: string | null = null;

      try {
        // Upload Signatory Photo
        if (formData.authorizedSignatoryPhotoFile) {
          const result = await uploadFileToStorageWithPath(
            formData.authorizedSignatoryPhotoFile,
            userId,
            'signatory_photo'
          );
          if (!result) {
            throw new Error('Failed to upload Authorized Signatory Photograph');
          }
          authorizedSignatoryPhotoUrl = result.url;
          uploadedFilePaths.push(result.path);
        }

        // Upload Signatory Signature
        if (formData.authorizedSignatorySignatureFile) {
          const result = await uploadFileToStorageWithPath(
            formData.authorizedSignatorySignatureFile,
            userId,
            'signatory_signature'
          );
          if (!result) {
            throw new Error('Failed to upload Authorized Signatory Signature');
          }
          authorizedSignatorySignatureUrl = result.url;
          uploadedFilePaths.push(result.path);
        }

        // Upload identity documents collected in Identity Documents
        if (formData.aadhaarCardFile) {
          const result = await uploadFileToStorageWithPath(
            formData.aadhaarCardFile,
            userId,
            'aadhaar_card'
          );
          if (!result) {
            throw new Error('Failed to upload Aadhaar Card');
          }
          aadhaarCardUrl = result.url;
          uploadedFilePaths.push(result.path);
        }

        if (formData.panCardFile) {
          const result = await uploadFileToStorageWithPath(
            formData.panCardFile,
            userId,
            'pan_card'
          );
          if (!result) {
            throw new Error('Failed to upload PAN Card');
          }
          panCardUrl = result.url;
          uploadedFilePaths.push(result.path);
        }

        // Upload Letterhead
        if (formData.letterheadFile) {
          const result = await uploadFileToStorageWithPath(
            formData.letterheadFile,
            userId,
            'letterhead'
          );
          if (!result) {
            throw new Error('Failed to upload Letterhead');
          }
          letterheadUrl = result.url;
          uploadedFilePaths.push(result.path);
        } else if (existingLetterheadUrl) {
          letterheadUrl = existingLetterheadUrl;
        }

        const certificateInfo = resolveConsultantCertificateUpload(
          formData.consultantType,
          formData as unknown as Record<string, unknown>
        );
        if (certificateInfo) {
          const result = await uploadFileToStorageWithPath(
            certificateInfo.file,
            userId,
            certificateInfo.storageType
          );
          if (!result) {
            throw new Error(`Failed to upload ${formData.consultantType} certificate`);
          }
          certificateUrl = result.url;
          uploadedFilePaths.push(result.path);
        }

      } catch (uploadError) {
        console.error('File upload failed:', uploadError);
        await rollbackUploadedFiles();
        await rollbackAuthUser();
        setFormError(`File upload failed: ${uploadError instanceof Error ? uploadError.message : 'Unknown error'}. Please try again.`);
        setIsSubmitting(false);
        return;
      }

      // Step 3: Build all form data to store in raw_user_meta_data
      const buildUserMetadata = () => {
        const fullAddress = composeAddress(
          formData.addressLine1,
          formData.addressLine2,
          formData.addressLine3
        );
        const baseData: any = {
            consultant_type: formData.consultantType,
            first_name: formData.firstName,
            middle_name: formData.middleName || null,
            last_name: formData.lastName,
            entity_name: formData.entityName || null,
          user_id: formData.userId,
          role: 'Consultant',
            email: formData.email,
            city: formData.city,
            pincode: formData.pincode,
            address: fullAddress,
            address_line1: formData.addressLine1 || null,
            address_line2: formData.addressLine2 || null,
            address_line3: formData.addressLine3 || null,
          gst_no: formData.gstNo || null,
            alternate_phone: formData.alternatePhone || null,
            pan: formData.pan || null,
            aadhaar_no: formData.aadhaarNo || null,
            authorized_signatory_photo_url: authorizedSignatoryPhotoUrl,
            authorized_signatory_signature_url: authorizedSignatorySignatureUrl,
          aadhaar_card_url: aadhaarCardUrl,
          pan_card_url: panCardUrl,
          license_certificate_url: certificateUrl,
          letterhead_url: letterheadUrl,
            registration_date: formData.registrationDate,
            declaration_accepted: formData.acceptDeclaration,
            registration_status: 'complete',
            status: 'pending'
        };

        // Add type-specific fields
        switch (formData.consultantType) {
          case "Architect":
            baseData.coa_reg_no = formData.coaRegNo;
            baseData.coa_expiry_date = formData.coaExpiryDate;
            baseData.coa_certificate_url = certificateUrl;
            break;
          case "Structural Engineer":
            baseData.structural_license_no = formData.structuralLicenseNo;
            baseData.structural_validity = formData.structuralValidity;
            baseData.qualification = formData.qualification;
            baseData.structural_license_url = certificateUrl;
            break;
          case "Licensed Surveyor":
            baseData.lbs_license_no = formData.lbsLicenseNo;
            baseData.competency_class = formData.competencyClass;
            baseData.lbs_expiry_date = formData.lbsExpiryDate;
            baseData.lbs_certificate_url = certificateUrl;
            break;
          case "MEP Consultant":
            baseData.electrical_license_no = formData.electricalLicenseNo;
            baseData.electrical_expiry_date = formData.electricalExpiryDate;
            baseData.pwd_accreditation = formData.pwdAccreditation;
            baseData.mep_experience_url = certificateUrl;
            break;
          case "Plumber":
            baseData.plumber_license_no = formData.plumberLicenseNo;
            baseData.plumber_expiry_date = formData.plumberExpiryDate;
            baseData.phe_accreditation_url = certificateUrl;
            break;
          case "Fire Consultant":
            baseData.fire_license_no = formData.fireLicenseNo;
            baseData.fire_validity_date = formData.fireValidityDate;
            baseData.fire_noc_url = certificateUrl;
            break;
          case "Landscape Consultant":
            baseData.landscape_license_no = formData.landscapeLicenseNo;
            baseData.landscape_expiry_date = formData.landscapeExpiryDate;
            baseData.landscape_certificate_url = certificateUrl;
            break;
          case "PMC / Project Manager":
            baseData.pmc_registration_no = formData.pmcRegistrationNo;
            baseData.pmc_expiry_date = formData.pmcExpiryDate;
            baseData.pmc_certificate_url = certificateUrl;
            break;
          case "Geotechnical Consultant":
            baseData.nabl_accreditation_no = formData.nablAccreditationNo;
            baseData.nabl_expiry_date = formData.nablExpiryDate;
            baseData.geotech_qualification = formData.geotechQualification;
            baseData.lab_registration_url = certificateUrl;
            break;
          case "Environmental Consultant":
            baseData.env_license_no = formData.envLicenseNo;
            baseData.env_expiry_date = formData.envExpiryDate;
            baseData.env_certificate_url = certificateUrl;
            break;
          case "Town Planner":
            baseData.town_planner_license_no = formData.townPlannerLicenseNo;
            baseData.town_planner_expiry_date = formData.townPlannerExpiryDate;
            baseData.town_planner_certificate_url = certificateUrl;
            break;
        }

        return baseData;
      };

      // Step 4: Update user metadata and set role in a single API call
      const userMetadata = buildUserMetadata();
      
      const updateResponse = await fetch('/api/set-user-role', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          user_id: userId, 
          role: 'Consultant',
          metadata: userMetadata
        }),
      });

      if (!updateResponse.ok) {
        const errorData = await updateResponse.json();
        console.error('Update user metadata and role error:', errorData);
        await rollbackUploadedFiles();
        await rollbackAuthUser();
        setFormError(`Failed to save profile data: ${errorData.error || 'Unknown error'}. Please try again.`);
        setIsSubmitting(false);
        return;
      }

      console.log('Registration successful:', { userId: userId, metadata: userMetadata });
      setSubmitSuccess(true);
      
      // Send the new user to sign in after 2 seconds
      setTimeout(() => {
        router.push('/login');
      }, 2000);

    } catch (err) {
      console.error('Unexpected error:', err);
      setFormError("An unexpected error occurred. Please try again.");
      setIsSubmitting(false);
    } finally {
      setIsSubmitting(false);
    }
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
  const lockPartialProfileFields = isResumingIncomplete;
  const hasExistingLetterhead = Boolean(existingLetterheadUrl);

  return (
    <>
    <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 md:px-6 lg:flex-row">
      {/* Sidebar Navigation */}
      <div className="lg:w-72 lg:flex-shrink-0">
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm lg:sticky lg:top-24">
          <div className="mb-4">
            <h2 className="text-lg font-semibold tracking-tight text-brand-navy">{title}</h2>
            <p className="mt-1 text-xs text-gray-500">
              {otherSectionsUnlocked
                ? "Complete each section, then submit."
                : "Upload and extract identity documents to continue."}
            </p>
          </div>
          
          {/* Submit Button */}
          <button
            type="button"
            onClick={handleSubmitForm}
            disabled={isSubmitting || !otherSectionsUnlocked}
            className="mb-6 flex w-full items-center justify-center gap-2 rounded-lg bg-brand-blue py-3 text-sm font-semibold text-white shadow-sm transition-all hover:bg-brand-blue-hover hover:shadow-md disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSubmitting ? (
              <>
                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Submitting...
              </>
            ) : (
              'Submit Registration'
            )}
          </button>

          {/* Navigation Items */}
          <nav className="-mx-1 flex gap-1 overflow-x-auto pb-1 lg:mx-0 lg:flex-col lg:space-y-1 lg:overflow-visible lg:pb-0">
            {sections.map((section) => {
              const isActive = activeSection === section.id;
              const sectionIcons: Record<string, React.ReactNode> = {
                "section-identity-documents": (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0m-5 8a2 2 0 100-4 2 2 0 000 4zm0 0c1.306 0 2.417.835 2.83 2M9 14a3.001 3.001 0 00-2.83 2M15 11h3m-3 4h2" />
                  </svg>
                ),
                "section-basic-details": (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                ),
                "section-registration": (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                ),
                "section-documents": (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                ),
                "section-letterhead": (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
                  </svg>
                ),
                "section-login": (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                  </svg>
                ),
                "section-declaration": (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                ),
              };

              return (
                <button
                  key={section.id}
                  type="button"
                  disabled={section.id !== "section-identity-documents" && !otherSectionsUnlocked}
                  onClick={() => scrollToSection(section.id)}
                  className={`flex shrink-0 items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-all duration-200 lg:w-full ${
                    section.id !== "section-identity-documents" && !otherSectionsUnlocked
                      ? "cursor-not-allowed text-gray-400 opacity-50"
                      : isActive
                        ? "bg-blue-50 font-medium text-brand-blue"
                        : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                  }`}
                >
                  <span className={isActive ? "text-brand-blue" : "text-gray-400"}>
                    {sectionIcons[section.id]}
                  </span>
                  <span className="whitespace-nowrap text-sm">{section.label}</span>
                  <svg className={`ml-auto hidden h-4 w-4 transition-transform lg:block ${isActive ? "text-brand-blue" : "text-gray-300"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 min-w-0">
        {/* Note Banner */}
        <div className="mb-6 rounded-xl border border-amber-100 bg-amber-50 p-4">
          <p className="text-sm text-gray-700">
            <span className="font-semibold text-brand-navy">Note:</span> Please fill all required fields marked with <span className="font-bold text-status-danger">*</span> before submitting.
          </p>
        </div>

        {formError && (
          <div className="mb-6 p-4 border border-red-200 bg-red-50 rounded-lg flex items-center gap-3">
            <svg className="w-5 h-5 text-red-600 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
            <span className="font-medium text-red-800">{formError}</span>
          </div>
        )}

        {resumePrompt && (
          <div className="mb-6 p-4 border border-amber-200 bg-amber-50 rounded-lg space-y-3">
            <p className="font-medium text-amber-900">
              This phone number is already registered with an incomplete profile. Continue with
              remaining login creation, documents, letterhead, and declaration.
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() =>
                  applyResumeFromMetadata(
                    resumePrompt.user_id,
                    resumePrompt.metadata,
                    resumePrompt.email
                  )
                }
                className="bg-brand-blue text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-brand-blue-hover"
              >
                Continue Remaining Steps
              </button>
              <button
                type="button"
                onClick={() => setResumePrompt(null)}
                className="bg-white border border-amber-300 text-amber-900 px-4 py-2 rounded-lg text-sm font-medium hover:bg-amber-100"
              >
                Dismiss
              </button>
            </div>
          </div>
        )}

        {isResumingIncomplete && (
          <div className="mb-6 p-4 border border-sky-100 bg-sky-50/70 rounded-lg text-brand-navy text-sm">
            Resuming incomplete registration. Basic details, registration numbers
            {hasExistingLetterhead ? ", and letterhead" : ""} are read-only.
            Complete documents, {hasExistingLetterhead ? "" : "letterhead, "}login
            setup, and declaration, then submit.
          </div>
        )}

        <div className="space-y-6">
          {/* Identity Documents */}
          <div id="section-identity-documents" className={`scroll-mt-6 overflow-hidden rounded-2xl border border-gray-200 bg-white p-6 transition-all duration-300 ${activeSection === "section-identity-documents" ? "shadow-md ring-2 ring-brand-blue/20" : "shadow-sm"}`}>
            <div
              className="flex items-center gap-3 mb-2 cursor-pointer hover:text-brand-blue transition-colors"
              onClick={() => scrollToSection("section-identity-documents")}
            >
              <div className="w-8 h-8 flex items-center justify-center bg-blue-50 rounded-lg">
                <svg className="w-5 h-5 text-brand-blue" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0m-5 8a2 2 0 100-4 2 2 0 000 4zm0 0c1.306 0 2.417.835 2.83 2M9 14a3.001 3.001 0 00-2.83 2M15 11h3m-3 4h2" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-brand-navy">Identity Documents</h3>
            </div>
            <RegistrationDocumentAutofillStep
              registrationKind="consultant"
              consultantType={formData.consultantType}
              onAutofill={applyRegistrationAutofill}
              onExtractedChange={setIdentityExtracted}
              onContinue={() => {
                const element = document.getElementById("section-basic-details");
                if (element) {
                  setActiveSection("section-basic-details");
                  element.scrollIntoView({ behavior: "smooth", block: "start" });
                }
              }}
            />
          </div>

          {otherSectionsUnlocked && (
          <>
          {/* Basic Details Section */}
          <div id="section-basic-details" className={`scroll-mt-6 overflow-hidden rounded-2xl border border-gray-200 bg-white p-6 transition-all duration-300 ${activeSection === "section-basic-details" ? "shadow-md ring-2 ring-brand-blue/20" : "shadow-sm"}`}>
            <div 
              className="flex items-center gap-3 mb-2 cursor-pointer hover:text-brand-blue transition-colors"
              onClick={() => scrollToSection("section-basic-details")}
            >
              <div className="w-8 h-8 flex items-center justify-center bg-blue-50 rounded-lg">
                <svg className="w-5 h-5 text-brand-blue" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-brand-navy">
                Basic Details
              </h3>
            </div>
            <p className="text-sm text-gray-600 mb-4 ml-11">
              Tell us who you are
            </p>

              <fieldset
                disabled={lockPartialProfileFields}
                className={`grid grid-cols-1 md:grid-cols-2 gap-4 border-0 p-0 m-0 min-w-0 ${
                  lockPartialProfileFields ? "cursor-not-allowed [&_*]:cursor-not-allowed" : ""
                }`}
              >
                {/* Row 1 */}
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-800">
                    Consultant Type <span className="text-red-600 font-bold">*</span>
                  </label>
                  <CustomSelect
                    value={formData.consultantType}
                    onChange={(val) => handleInputChange("consultantType", val)}
                    options={[
                      { value: "Architect", label: "Architect" },
                      { value: "Structural Engineer", label: "Structural Engineer" },
                      { value: "Licensed Surveyor", label: "Licensed Surveyor" },
                      { value: "MEP Consultant", label: "MEP Consultant" },
                      { value: "Plumber", label: "Plumber" },
                      { value: "Fire Consultant", label: "Fire Consultant" },
                      { value: "Landscape Consultant", label: "Landscape Consultant" },
                      { value: "PMC / Project Manager", label: "PMC / Project Manager" },
                      { value: "Geotechnical Consultant", label: "Geotechnical Consultant" },
                      { value: "Environmental Consultant", label: "Environmental Consultant" },
                      { value: "Town Planner", label: "Town Planner" },
                    ]}
                    placeholder="Select Consultant Type"
                    className="w-full"
                    disabled={lockPartialProfileFields}
                  />
                  {errors.consultantType && (
                    <p className="text-xs text-red-600 mt-1">{errors.consultantType}</p>
                  )}
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-800">
                    First Name <span className="text-red-600 font-bold">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.firstName}
                    onChange={(e) => handleInputChange("firstName", e.target.value)}
                    className="h-11 w-full rounded-lg border border-gray-200 bg-gray-50 px-3 text-sm text-gray-900 placeholder:text-gray-400 outline-none transition-colors hover:border-gray-300 focus:border-brand-blue focus:bg-white focus:ring-2 focus:ring-brand-blue/20"
                    placeholder="Enter First Name"
                  />
                  {errors.firstName && (
                    <p className="text-xs text-red-600 mt-1">{errors.firstName}</p>
                  )}
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-800">
                    Middle Name
                  </label>
                  <input
                    type="text"
                    value={formData.middleName}
                    onChange={(e) => handleInputChange("middleName", e.target.value)}
                    className="h-11 w-full rounded-lg border border-gray-200 bg-gray-50 px-3 text-sm text-gray-900 placeholder:text-gray-400 outline-none transition-colors hover:border-gray-300 focus:border-brand-blue focus:bg-white focus:ring-2 focus:ring-brand-blue/20"
                    placeholder="Enter Middle Name"
                  />
                </div>

                {/* Row 2 */}
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-800">
                    Last Name <span className="text-red-600 font-bold">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.lastName}
                    onChange={(e) => handleInputChange("lastName", e.target.value)}
                    className="h-11 w-full rounded-lg border border-gray-200 bg-gray-50 px-3 text-sm text-gray-900 placeholder:text-gray-400 outline-none transition-colors hover:border-gray-300 focus:border-brand-blue focus:bg-white focus:ring-2 focus:ring-brand-blue/20"
                    placeholder="Enter Last Name"
                  />
                  {errors.lastName && (
                    <p className="text-xs text-red-600 mt-1">{errors.lastName}</p>
                  )}
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-800">
                    Entity Name
                  </label>
                  <input
                    type="text"
                    value={formData.entityName}
                    onChange={(e) => handleInputChange("entityName", e.target.value)}
                    className="h-11 w-full rounded-lg border border-gray-200 bg-gray-50 px-3 text-sm text-gray-900 placeholder:text-gray-400 outline-none transition-colors hover:border-gray-300 focus:border-brand-blue focus:bg-white focus:ring-2 focus:ring-brand-blue/20"
                    placeholder="Enter Entity Name"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-800">
                    Email <span className="text-red-600 font-bold">*</span>
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => {
                        handleInputChange("email", e.target.value);
                        // Reset verification if email changes
                        if (isEmailVerified) setIsEmailVerified(false);
                      }}
                      className={`h-11 flex-1 rounded-lg border border-gray-200 bg-gray-50 px-3 text-sm text-gray-900 outline-none transition-colors hover:border-gray-300 focus:border-brand-blue focus:bg-white focus:ring-2 focus:ring-brand-blue/20 ${isEmailVerified ? 'bg-green-50 border-green-300' : ''}`}
                      placeholder="name@example.com"
                      disabled={isEmailVerified || lockPartialProfileFields}
                    />
                    {isEmailVerified ? (
                      <div className="flex items-center gap-2 px-4 py-2 bg-status-success text-white rounded-lg font-medium">
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                        Verified
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          if (isResumingIncomplete && verifiedUserId) {
                            setIsEmailVerified(true);
                            return;
                          }
                          if (!formData.email || formData.email.trim() === '') {
                            setErrors(prev => ({ ...prev, email: "Email is required" }));
                            return;
                          }
                          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                          if (emailRegex.test(formData.email)) {
                            setShowEmailOTPModal(true);
                          } else {
                            setErrors(prev => ({ ...prev, email: "Please enter a valid email address" }));
                          }
                        }}
                        className="bg-blue-50 border border-blue-200 text-brand-blue px-4 py-2 rounded-lg font-medium hover:bg-blue-100 transition whitespace-nowrap"
                      >
                        Verify
                      </button>
                    )}
                  </div>
                  {errors.email && (
                    <p className="text-xs text-red-600 mt-1">{errors.email}</p>
                  )}
                </div>

                {/* Row 3 */}
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-800">
                    City <span className="text-red-600 font-bold">*</span>
                  </label>
                  <input
                    value={formData.city}
                    onChange={(e) => handleInputChange("city", e.target.value)}
                    className="h-11 w-full rounded-lg border border-gray-200 bg-gray-50 px-3 text-sm text-gray-900 placeholder:text-gray-400 outline-none transition-colors hover:border-gray-300 focus:border-brand-blue focus:bg-white focus:ring-2 focus:ring-brand-blue/20"
                    placeholder="Enter City"
                  />
                  {errors.city && (
                    <p className="text-xs text-red-600 mt-1">{errors.city}</p>
                  )}
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-800">
                    Phone Number <span className="text-red-600 font-bold">*</span>
                  </label>
                  <div className="flex gap-2">
                    <input
                      value={formData.alternatePhone}
                      onChange={(e) => {
                        handleInputChange("alternatePhone", e.target.value);
                        if (isPhoneVerified) setIsPhoneVerified(false);
                      }}
                      className={`h-11 flex-1 rounded-lg border border-gray-200 bg-gray-50 px-3 text-sm text-gray-900 outline-none transition-colors hover:border-gray-300 focus:border-brand-blue focus:bg-white focus:ring-2 focus:ring-brand-blue/20 ${isPhoneVerified ? 'bg-green-50 border-green-300' : ''}`}
                      placeholder="Enter 10-digit phone number"
                      disabled={isPhoneVerified || lockPartialProfileFields}
                    />
                    {isPhoneVerified ? (
                      <div className="flex items-center gap-2 px-4 py-2 bg-status-success text-white rounded-lg font-medium">
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                        Verified
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={async () => {
                          if (!formData.alternatePhone || formData.alternatePhone.trim() === '') {
                            setErrors(prev => ({ ...prev, alternatePhone: "Phone number is required" }));
                            return;
                          }
                          if (formData.alternatePhone.length !== 10) {
                            setErrors(prev => ({ ...prev, alternatePhone: "Please enter a valid 10-digit phone number" }));
                            return;
                          }
                          const ok = await lookupPhoneBeforeVerify();
                          if (ok) {
                            setShowPhoneOTPModal(true);
                          }
                        }}
                        className="bg-blue-50 border border-blue-200 text-brand-blue px-4 py-2 rounded-lg font-medium hover:bg-blue-100 transition whitespace-nowrap"
                      >
                        Verify
                      </button>
                    )}
                  </div>
                  {errors.alternatePhone && (
                    <p className="text-xs text-red-600 mt-1">{errors.alternatePhone}</p>
                  )}
                </div>

                {/* Row 4 */}
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-800">
                    Pincode <span className="text-red-600 font-bold">*</span>
                  </label>
                  <input
                    value={formData.pincode}
                    onChange={(e) => handleInputChange("pincode", e.target.value)}
                    className="h-11 w-full rounded-lg border border-gray-200 bg-gray-50 px-3 text-sm text-gray-900 placeholder:text-gray-400 outline-none transition-colors hover:border-gray-300 focus:border-brand-blue focus:bg-white focus:ring-2 focus:ring-brand-blue/20"
                    placeholder="Enter Pincode"
                  />
                  {errors.pincode && (
                    <p className="text-xs text-red-600 mt-1">{errors.pincode}</p>
                  )}
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-800">
                    PAN <span className="text-red-600 font-bold">*</span>
                  </label>
                  <input
                    value={formData.pan}
                    onChange={(e) => handleInputChange("pan", e.target.value)}
                    className="h-11 w-full rounded-lg border border-gray-200 bg-gray-50 px-3 text-sm text-gray-900 placeholder:text-gray-400 outline-none transition-colors hover:border-gray-300 focus:border-brand-blue focus:bg-white focus:ring-2 focus:ring-brand-blue/20"
                    placeholder="ABCDE1234F"
                  />
                  {errors.pan && (
                    <p className="text-xs text-red-600 mt-1">{errors.pan}</p>
                  )}
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-800">
                    Aadhaar Number
                  </label>
                  <input
                    value={formData.aadhaarNo}
                    onChange={(e) => handleInputChange("aadhaarNo", e.target.value)}
                    className="h-11 w-full rounded-lg border border-gray-200 bg-gray-50 px-3 text-sm text-gray-900 placeholder:text-gray-400 outline-none transition-colors hover:border-gray-300 focus:border-brand-blue focus:bg-white focus:ring-2 focus:ring-brand-blue/20"
                    placeholder="XXXX XXXX XXXX"
                  />
                  {errors.aadhaarNo && (
                    <p className="text-xs text-red-600 mt-1">{errors.aadhaarNo}</p>
                  )}
                </div>

                {/* Row 5 */}
                <div className="md:col-span-2">
                  <label className="mb-1.5 block text-sm font-medium text-gray-800">
                    Address Line 1 <span className="text-red-600 font-bold">*</span>
                  </label>
                  <input
                    value={formData.addressLine1}
                    onChange={(e) => handleInputChange("addressLine1", e.target.value)}
                    className="h-11 w-full rounded-lg border border-gray-200 bg-gray-50 px-3 text-sm text-gray-900 placeholder:text-gray-400 outline-none transition-colors hover:border-gray-300 focus:border-brand-blue focus:bg-white focus:ring-2 focus:ring-brand-blue/20"
                    placeholder="Building / Street / Area"
                  />
                  {errors.addressLine1 && (
                    <p className="text-xs text-red-600 mt-1">{errors.addressLine1}</p>
                  )}
                </div>

                <div className="md:col-span-2">
                  <label className="mb-1.5 block text-sm font-medium text-gray-800">
                    Address Line 2
                  </label>
                  <input
                    value={formData.addressLine2}
                    onChange={(e) => handleInputChange("addressLine2", e.target.value)}
                    className="h-11 w-full rounded-lg border border-gray-200 bg-gray-50 px-3 text-sm text-gray-900 placeholder:text-gray-400 outline-none transition-colors hover:border-gray-300 focus:border-brand-blue focus:bg-white focus:ring-2 focus:ring-brand-blue/20"
                    placeholder="Landmark / Locality"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="mb-1.5 block text-sm font-medium text-gray-800">
                    Address Line 3
                  </label>
                  <input
                    value={formData.addressLine3}
                    onChange={(e) => handleInputChange("addressLine3", e.target.value)}
                    className="h-11 w-full rounded-lg border border-gray-200 bg-gray-50 px-3 text-sm text-gray-900 placeholder:text-gray-400 outline-none transition-colors hover:border-gray-300 focus:border-brand-blue focus:bg-white focus:ring-2 focus:ring-brand-blue/20"
                    placeholder="Additional details (optional)"
                  />
                </div>
            </fieldset>
          </div>

        {/* Registration Numbers Section - Dynamic based on Consultant Type */}
            <div id="section-registration" className={`scroll-mt-6 overflow-hidden rounded-2xl border border-gray-200 bg-white p-6 transition-all duration-300 shadow-sm ${activeSection === "section-registration" ? "shadow-md ring-2 ring-brand-blue/20" : ""}`}>
              <div 
                className="flex items-center gap-3 mb-2 cursor-pointer hover:text-brand-blue transition-colors"
                onClick={() => scrollToSection("section-registration")}
              >
                <div className="w-8 h-8 flex items-center justify-center bg-blue-50 rounded-lg">
                  <svg className="w-5 h-5 text-brand-blue" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-brand-navy">
                  Registration Numbers
                </h3>
              </div>
              <p className="text-sm text-gray-600 mb-4 ml-11">
                {formData.consultantType ? `Enter credentials for ${formData.consultantType}` : "Select a consultant type first"}
              </p>

              {!formData.consultantType && (
                <div className="p-4 bg-sky-50/70 border border-sky-100 rounded-lg text-sky-800 text-sm">
                  ⚠️ Please select a Consultant Type in Basic Details to see the required registration fields.
                </div>
              )}

              <fieldset
                disabled={lockPartialProfileFields}
                className={`border-0 p-0 m-0 min-w-0 ${
                  lockPartialProfileFields ? "cursor-not-allowed [&_*]:cursor-not-allowed" : ""
                }`}
              >

              {/* Architect */}
              {formData.consultantType === "Architect" && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-gray-800">COA Registration No. <span className="text-red-600 font-bold">*</span></label>
                    <input
                      value={formData.coaRegNo}
                      onChange={(e) => handleInputChange("coaRegNo", e.target.value)}
                      onBlur={() => lookupRegistrationUniqueness("coaRegNo")}
                      className="h-11 w-full rounded-lg border border-gray-200 bg-gray-50 px-3 text-sm text-gray-900 placeholder:text-gray-400 outline-none transition-colors hover:border-gray-300 focus:border-brand-blue focus:bg-white focus:ring-2 focus:ring-brand-blue/20"
                      placeholder="e.g., CA/2020/12345"
                    />
                    {errors.coaRegNo && (
                      <p className="text-xs text-red-600 mt-1">{errors.coaRegNo}</p>
                    )}
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-gray-800">Registration Date <span className="text-red-600 font-bold">*</span></label>
                    <input
                      type="date"
                      value={formData.registrationDate}
                      onChange={(e) => handleInputChange("registrationDate", e.target.value)}
                      className="h-11 w-full rounded-lg border border-gray-200 bg-gray-50 px-3 text-sm text-gray-900 placeholder:text-gray-400 outline-none transition-colors hover:border-gray-300 focus:border-brand-blue focus:bg-white focus:ring-2 focus:ring-brand-blue/20"
                    />
                    {errors.registrationDate && (
                      <p className="text-xs text-red-600 mt-1">{errors.registrationDate}</p>
                    )}
                  </div>
                <div>
                    <label className="mb-1.5 block text-sm font-medium text-gray-800">Validity / Expiry Date <span className="text-red-600 font-bold">*</span></label>
                    <input
                      type="date"
                      value={formData.coaExpiryDate}
                      onChange={(e) => handleInputChange("coaExpiryDate", e.target.value)}
                      className="h-11 w-full rounded-lg border border-gray-200 bg-gray-50 px-3 text-sm text-gray-900 placeholder:text-gray-400 outline-none transition-colors hover:border-gray-300 focus:border-brand-blue focus:bg-white focus:ring-2 focus:ring-brand-blue/20"
                    />
                    {errors.coaExpiryDate && (
                      <p className="text-xs text-red-600 mt-1">{errors.coaExpiryDate}</p>
                    )}
                  </div>
                </div>
              )}

              {/* Structural Engineer */}
              {formData.consultantType === "Structural Engineer" && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-gray-800">Structural Engineer License No. (MCGM/UDD) <span className="text-red-600 font-bold">*</span></label>
                    <input
                      value={formData.structuralLicenseNo}
                      onChange={(e) => handleInputChange("structuralLicenseNo", e.target.value)}
                      onBlur={() => lookupRegistrationUniqueness("structuralLicenseNo")}
                      className="h-11 w-full rounded-lg border border-gray-200 bg-gray-50 px-3 text-sm text-gray-900 placeholder:text-gray-400 outline-none transition-colors hover:border-gray-300 focus:border-brand-blue focus:bg-white focus:ring-2 focus:ring-brand-blue/20"
                      placeholder="Enter license number"
                    />
                    {errors.structuralLicenseNo && (
                      <p className="text-xs text-red-600 mt-1">{errors.structuralLicenseNo}</p>
                    )}
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-gray-800">Registration Date <span className="text-red-600 font-bold">*</span></label>
                    <input
                      type="date"
                      value={formData.registrationDate}
                      onChange={(e) => handleInputChange("registrationDate", e.target.value)}
                      className="h-11 w-full rounded-lg border border-gray-200 bg-gray-50 px-3 text-sm text-gray-900 placeholder:text-gray-400 outline-none transition-colors hover:border-gray-300 focus:border-brand-blue focus:bg-white focus:ring-2 focus:ring-brand-blue/20"
                    />
                    {errors.registrationDate && (
                      <p className="text-xs text-red-600 mt-1">{errors.registrationDate}</p>
                    )}
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-gray-800">License Issue Date <span className="text-red-600 font-bold">*</span></label>
                    <input
                      type="date"
                      value={formData.structuralValidity}
                      onChange={(e) => handleInputChange("structuralValidity", e.target.value)}
                      className="h-11 w-full rounded-lg border border-gray-200 bg-gray-50 px-3 text-sm text-gray-900 placeholder:text-gray-400 outline-none transition-colors hover:border-gray-300 focus:border-brand-blue focus:bg-white focus:ring-2 focus:ring-brand-blue/20"
                    />
                    {errors.structuralValidity && (
                      <p className="text-xs text-red-600 mt-1">{errors.structuralValidity}</p>
                    )}
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-gray-800">Qualification (BE / ME Civil)</label>
                    <CustomSelect
                      value={formData.qualification}
                      onChange={(val) => handleInputChange("qualification", val)}
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

              {/* Licensed Surveyor */}
              {formData.consultantType === "Licensed Surveyor" && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-gray-800">LBS License Number <span className="text-red-600 font-bold">*</span></label>
                    <input
                      value={formData.lbsLicenseNo}
                      onChange={(e) => handleInputChange("lbsLicenseNo", e.target.value)}
                      onBlur={() => lookupRegistrationUniqueness("lbsLicenseNo")}
                      className="h-11 w-full rounded-lg border border-gray-200 bg-gray-50 px-3 text-sm text-gray-900 placeholder:text-gray-400 outline-none transition-colors hover:border-gray-300 focus:border-brand-blue focus:bg-white focus:ring-2 focus:ring-brand-blue/20"
                      placeholder="Enter LBS license number"
                    />
                    {errors.lbsLicenseNo && (
                      <p className="text-xs text-red-600 mt-1">{errors.lbsLicenseNo}</p>
                  )}
                </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-gray-800">Registration Date <span className="text-red-600 font-bold">*</span></label>
                    <input
                      type="date"
                      value={formData.registrationDate}
                      onChange={(e) => handleInputChange("registrationDate", e.target.value)}
                      className="h-11 w-full rounded-lg border border-gray-200 bg-gray-50 px-3 text-sm text-gray-900 placeholder:text-gray-400 outline-none transition-colors hover:border-gray-300 focus:border-brand-blue focus:bg-white focus:ring-2 focus:ring-brand-blue/20"
                    />
                    {errors.registrationDate && (
                      <p className="text-xs text-red-600 mt-1">{errors.registrationDate}</p>
                    )}
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-gray-800">Competency Class <span className="text-red-600 font-bold">*</span></label>
                    <CustomSelect
                      value={formData.competencyClass}
                      onChange={(val) => handleInputChange("competencyClass", val)}
                      options={[
                        { value: "Class A", label: "Class A" },
                        { value: "Class B", label: "Class B" },
                      ]}
                      placeholder="Select Class"
                      className="w-full"
                    />
                    {errors.competencyClass && (
                      <p className="text-xs text-red-600 mt-1">{errors.competencyClass}</p>
                    )}
                </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-gray-800">Expiry Date <span className="text-red-600 font-bold">*</span></label>
                    <input
                      type="date"
                      value={formData.lbsExpiryDate}
                      onChange={(e) => handleInputChange("lbsExpiryDate", e.target.value)}
                      className="h-11 w-full rounded-lg border border-gray-200 bg-gray-50 px-3 text-sm text-gray-900 placeholder:text-gray-400 outline-none transition-colors hover:border-gray-300 focus:border-brand-blue focus:bg-white focus:ring-2 focus:ring-brand-blue/20"
                    />
                    {errors.lbsExpiryDate && (
                      <p className="text-xs text-red-600 mt-1">{errors.lbsExpiryDate}</p>
                    )}
              </div>
            </div>
              )}

              {/* MEP Consultant */}
              {formData.consultantType === "MEP Consultant" && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-gray-800">Electrical License No. <span className="text-red-600 font-bold">*</span></label>
                    <input
                      value={formData.electricalLicenseNo}
                      onChange={(e) => handleInputChange("electricalLicenseNo", e.target.value)}
                      onBlur={() => lookupRegistrationUniqueness("electricalLicenseNo")}
                      className="h-11 w-full rounded-lg border border-gray-200 bg-gray-50 px-3 text-sm text-gray-900 placeholder:text-gray-400 outline-none transition-colors hover:border-gray-300 focus:border-brand-blue focus:bg-white focus:ring-2 focus:ring-brand-blue/20"
                      placeholder="Enter electrical license number"
                    />
                    {errors.electricalLicenseNo && (
                      <p className="text-xs text-red-600 mt-1">{errors.electricalLicenseNo}</p>
                    )}
                </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-gray-800">Registration Date <span className="text-red-600 font-bold">*</span></label>
                    <input
                      type="date"
                      value={formData.registrationDate}
                      onChange={(e) => handleInputChange("registrationDate", e.target.value)}
                      className="h-11 w-full rounded-lg border border-gray-200 bg-gray-50 px-3 text-sm text-gray-900 placeholder:text-gray-400 outline-none transition-colors hover:border-gray-300 focus:border-brand-blue focus:bg-white focus:ring-2 focus:ring-brand-blue/20"
                    />
                    {errors.registrationDate && (
                      <p className="text-xs text-red-600 mt-1">{errors.registrationDate}</p>
                    )}
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-gray-800">Expiry Date <span className="text-red-600 font-bold">*</span></label>
                    <input
                      type="date"
                      value={formData.electricalExpiryDate}
                      onChange={(e) => handleInputChange("electricalExpiryDate", e.target.value)}
                      className="h-11 w-full rounded-lg border border-gray-200 bg-gray-50 px-3 text-sm text-gray-900 placeholder:text-gray-400 outline-none transition-colors hover:border-gray-300 focus:border-brand-blue focus:bg-white focus:ring-2 focus:ring-brand-blue/20"
                    />
                    {errors.electricalExpiryDate && (
                      <p className="text-xs text-red-600 mt-1">{errors.electricalExpiryDate}</p>
                    )}
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-gray-800">PWD/Chief Electrical Inspector Accreditation</label>
                    <input
                      value={formData.pwdAccreditation}
                      onChange={(e) => handleInputChange("pwdAccreditation", e.target.value)}
                      className="h-11 w-full rounded-lg border border-gray-200 bg-gray-50 px-3 text-sm text-gray-900 placeholder:text-gray-400 outline-none transition-colors hover:border-gray-300 focus:border-brand-blue focus:bg-white focus:ring-2 focus:ring-brand-blue/20"
                      placeholder="Accreditation number"
                    />
                </div>
              </div>
              )}

              {/* Plumber */}
              {formData.consultantType === "Plumber" && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-gray-800">Plumber License No. <span className="text-red-600 font-bold">*</span></label>
                    <input
                      value={formData.plumberLicenseNo}
                      onChange={(e) => handleInputChange("plumberLicenseNo", e.target.value)}
                      onBlur={() => lookupRegistrationUniqueness("plumberLicenseNo")}
                      className="h-11 w-full rounded-lg border border-gray-200 bg-gray-50 px-3 text-sm text-gray-900 placeholder:text-gray-400 outline-none transition-colors hover:border-gray-300 focus:border-brand-blue focus:bg-white focus:ring-2 focus:ring-brand-blue/20"
                      placeholder="Enter plumber license number"
                    />
                    {errors.plumberLicenseNo && (
                      <p className="text-xs text-red-600 mt-1">{errors.plumberLicenseNo}</p>
                    )}
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-gray-800">Registration Date <span className="text-red-600 font-bold">*</span></label>
                    <input
                      type="date"
                      value={formData.registrationDate}
                      onChange={(e) => handleInputChange("registrationDate", e.target.value)}
                      className="h-11 w-full rounded-lg border border-gray-200 bg-gray-50 px-3 text-sm text-gray-900 placeholder:text-gray-400 outline-none transition-colors hover:border-gray-300 focus:border-brand-blue focus:bg-white focus:ring-2 focus:ring-brand-blue/20"
                    />
                    {errors.registrationDate && (
                      <p className="text-xs text-red-600 mt-1">{errors.registrationDate}</p>
                    )}
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-gray-800">Expiry Date <span className="text-red-600 font-bold">*</span></label>
                    <input
                      type="date"
                      value={formData.plumberExpiryDate}
                      onChange={(e) => handleInputChange("plumberExpiryDate", e.target.value)}
                      className="h-11 w-full rounded-lg border border-gray-200 bg-gray-50 px-3 text-sm text-gray-900 placeholder:text-gray-400 outline-none transition-colors hover:border-gray-300 focus:border-brand-blue focus:bg-white focus:ring-2 focus:ring-brand-blue/20"
                    />
                    {errors.plumberExpiryDate && (
                      <p className="text-xs text-red-600 mt-1">{errors.plumberExpiryDate}</p>
                    )}
                  </div>
                </div>
              )}

              {/* Fire Consultant */}
              {formData.consultantType === "Fire Consultant" && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-gray-800">Fire License / CFO Accreditation No. <span className="text-red-600 font-bold">*</span></label>
                    <input
                      value={formData.fireLicenseNo}
                      onChange={(e) => handleInputChange("fireLicenseNo", e.target.value)}
                      onBlur={() => lookupRegistrationUniqueness("fireLicenseNo")}
                      className="h-11 w-full rounded-lg border border-gray-200 bg-gray-50 px-3 text-sm text-gray-900 placeholder:text-gray-400 outline-none transition-colors hover:border-gray-300 focus:border-brand-blue focus:bg-white focus:ring-2 focus:ring-brand-blue/20"
                      placeholder="Enter fire license number"
                    />
                    {errors.fireLicenseNo && (
                      <p className="text-xs text-red-600 mt-1">{errors.fireLicenseNo}</p>
                    )}
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-gray-800">Registration Date <span className="text-red-600 font-bold">*</span></label>
                    <input
                      type="date"
                      value={formData.registrationDate}
                      onChange={(e) => handleInputChange("registrationDate", e.target.value)}
                      className="h-11 w-full rounded-lg border border-gray-200 bg-gray-50 px-3 text-sm text-gray-900 placeholder:text-gray-400 outline-none transition-colors hover:border-gray-300 focus:border-brand-blue focus:bg-white focus:ring-2 focus:ring-brand-blue/20"
                    />
                    {errors.registrationDate && (
                      <p className="text-xs text-red-600 mt-1">{errors.registrationDate}</p>
                    )}
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-gray-800">Validity Date <span className="text-red-600 font-bold">*</span></label>
                    <input
                      type="date"
                      value={formData.fireValidityDate}
                      onChange={(e) => handleInputChange("fireValidityDate", e.target.value)}
                      className="h-11 w-full rounded-lg border border-gray-200 bg-gray-50 px-3 text-sm text-gray-900 placeholder:text-gray-400 outline-none transition-colors hover:border-gray-300 focus:border-brand-blue focus:bg-white focus:ring-2 focus:ring-brand-blue/20"
                    />
                    {errors.fireValidityDate && (
                      <p className="text-xs text-red-600 mt-1">{errors.fireValidityDate}</p>
                    )}
                  </div>
                </div>
              )}

              {/* Landscape Consultant */}
              {formData.consultantType === "Landscape Consultant" && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-gray-800">Landscape License No. <span className="text-red-600 font-bold">*</span></label>
                    <input
                      value={formData.landscapeLicenseNo}
                      onChange={(e) => handleInputChange("landscapeLicenseNo", e.target.value)}
                      onBlur={() => lookupRegistrationUniqueness("landscapeLicenseNo")}
                      className="h-11 w-full rounded-lg border border-gray-200 bg-gray-50 px-3 text-sm text-gray-900 placeholder:text-gray-400 outline-none transition-colors hover:border-gray-300 focus:border-brand-blue focus:bg-white focus:ring-2 focus:ring-brand-blue/20"
                      placeholder="Enter license number"
                    />
                    {errors.landscapeLicenseNo && (
                      <p className="text-xs text-red-600 mt-1">{errors.landscapeLicenseNo}</p>
                    )}
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-gray-800">Registration Date <span className="text-red-600 font-bold">*</span></label>
                    <input
                      type="date"
                      value={formData.registrationDate}
                      onChange={(e) => handleInputChange("registrationDate", e.target.value)}
                      className="h-11 w-full rounded-lg border border-gray-200 bg-gray-50 px-3 text-sm text-gray-900 placeholder:text-gray-400 outline-none transition-colors hover:border-gray-300 focus:border-brand-blue focus:bg-white focus:ring-2 focus:ring-brand-blue/20"
                    />
                    {errors.registrationDate && (
                      <p className="text-xs text-red-600 mt-1">{errors.registrationDate}</p>
                    )}
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-gray-800">Expiry Date <span className="text-red-600 font-bold">*</span></label>
                    <input
                      type="date"
                      value={formData.landscapeExpiryDate}
                      onChange={(e) => handleInputChange("landscapeExpiryDate", e.target.value)}
                      className="h-11 w-full rounded-lg border border-gray-200 bg-gray-50 px-3 text-sm text-gray-900 placeholder:text-gray-400 outline-none transition-colors hover:border-gray-300 focus:border-brand-blue focus:bg-white focus:ring-2 focus:ring-brand-blue/20"
                    />
                    {errors.landscapeExpiryDate && (
                      <p className="text-xs text-red-600 mt-1">{errors.landscapeExpiryDate}</p>
                    )}
                  </div>
                </div>
              )}

              {/* PMC / Project Manager */}
              {formData.consultantType === "PMC / Project Manager" && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-gray-800">PMC Registration No. <span className="text-red-600 font-bold">*</span></label>
                    <input
                      value={formData.pmcRegistrationNo}
                      onChange={(e) => handleInputChange("pmcRegistrationNo", e.target.value)}
                      onBlur={() => lookupRegistrationUniqueness("pmcRegistrationNo")}
                      className="h-11 w-full rounded-lg border border-gray-200 bg-gray-50 px-3 text-sm text-gray-900 placeholder:text-gray-400 outline-none transition-colors hover:border-gray-300 focus:border-brand-blue focus:bg-white focus:ring-2 focus:ring-brand-blue/20"
                      placeholder="Enter PMC registration number"
                    />
                    {errors.pmcRegistrationNo && (
                      <p className="text-xs text-red-600 mt-1">{errors.pmcRegistrationNo}</p>
                    )}
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-gray-800">Registration Date <span className="text-red-600 font-bold">*</span></label>
                    <input
                      type="date"
                      value={formData.registrationDate}
                      onChange={(e) => handleInputChange("registrationDate", e.target.value)}
                      className="h-11 w-full rounded-lg border border-gray-200 bg-gray-50 px-3 text-sm text-gray-900 placeholder:text-gray-400 outline-none transition-colors hover:border-gray-300 focus:border-brand-blue focus:bg-white focus:ring-2 focus:ring-brand-blue/20"
                    />
                    {errors.registrationDate && (
                      <p className="text-xs text-red-600 mt-1">{errors.registrationDate}</p>
                    )}
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-gray-800">Expiry Date <span className="text-red-600 font-bold">*</span></label>
                    <input
                      type="date"
                      value={formData.pmcExpiryDate}
                      onChange={(e) => handleInputChange("pmcExpiryDate", e.target.value)}
                      className="h-11 w-full rounded-lg border border-gray-200 bg-gray-50 px-3 text-sm text-gray-900 placeholder:text-gray-400 outline-none transition-colors hover:border-gray-300 focus:border-brand-blue focus:bg-white focus:ring-2 focus:ring-brand-blue/20"
                    />
                    {errors.pmcExpiryDate && (
                      <p className="text-xs text-red-600 mt-1">{errors.pmcExpiryDate}</p>
                    )}
                  </div>
                </div>
              )}

              {/* Geotechnical Consultant */}
              {formData.consultantType === "Geotechnical Consultant" && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-gray-800">NABL Accreditation No. <span className="text-red-600 font-bold">*</span></label>
                    <input
                      value={formData.nablAccreditationNo}
                      onChange={(e) => handleInputChange("nablAccreditationNo", e.target.value)}
                      onBlur={() => lookupRegistrationUniqueness("nablAccreditationNo")}
                      className="h-11 w-full rounded-lg border border-gray-200 bg-gray-50 px-3 text-sm text-gray-900 placeholder:text-gray-400 outline-none transition-colors hover:border-gray-300 focus:border-brand-blue focus:bg-white focus:ring-2 focus:ring-brand-blue/20"
                      placeholder="Enter NABL accreditation number"
                    />
                    {errors.nablAccreditationNo && (
                      <p className="text-xs text-red-600 mt-1">{errors.nablAccreditationNo}</p>
                    )}
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-gray-800">Registration Date <span className="text-red-600 font-bold">*</span></label>
                    <input
                      type="date"
                      value={formData.registrationDate}
                      onChange={(e) => handleInputChange("registrationDate", e.target.value)}
                      className="h-11 w-full rounded-lg border border-gray-200 bg-gray-50 px-3 text-sm text-gray-900 placeholder:text-gray-400 outline-none transition-colors hover:border-gray-300 focus:border-brand-blue focus:bg-white focus:ring-2 focus:ring-brand-blue/20"
                    />
                    {errors.registrationDate && (
                      <p className="text-xs text-red-600 mt-1">{errors.registrationDate}</p>
                    )}
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-gray-800">Expiry Date <span className="text-red-600 font-bold">*</span></label>
                    <input
                      type="date"
                      value={formData.nablExpiryDate}
                      onChange={(e) => handleInputChange("nablExpiryDate", e.target.value)}
                      className="h-11 w-full rounded-lg border border-gray-200 bg-gray-50 px-3 text-sm text-gray-900 placeholder:text-gray-400 outline-none transition-colors hover:border-gray-300 focus:border-brand-blue focus:bg-white focus:ring-2 focus:ring-brand-blue/20"
                    />
                    {errors.nablExpiryDate && (
                      <p className="text-xs text-red-600 mt-1">{errors.nablExpiryDate}</p>
                    )}
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-gray-800">Geotech Engineer Qualification</label>
                    <input
                      value={formData.geotechQualification}
                      onChange={(e) => handleInputChange("geotechQualification", e.target.value)}
                      className="h-11 w-full rounded-lg border border-gray-200 bg-gray-50 px-3 text-sm text-gray-900 placeholder:text-gray-400 outline-none transition-colors hover:border-gray-300 focus:border-brand-blue focus:bg-white focus:ring-2 focus:ring-brand-blue/20"
                      placeholder="e.g., M.Tech Geotechnical"
                    />
                  </div>
                </div>
              )}

              {/* Environmental Consultant */}
              {formData.consultantType === "Environmental Consultant" && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-gray-800">Environmental License No. <span className="text-red-600 font-bold">*</span></label>
                    <input
                      value={formData.envLicenseNo}
                      onChange={(e) => handleInputChange("envLicenseNo", e.target.value)}
                      onBlur={() => lookupRegistrationUniqueness("envLicenseNo")}
                      className="h-11 w-full rounded-lg border border-gray-200 bg-gray-50 px-3 text-sm text-gray-900 placeholder:text-gray-400 outline-none transition-colors hover:border-gray-300 focus:border-brand-blue focus:bg-white focus:ring-2 focus:ring-brand-blue/20"
                      placeholder="Enter license number"
                    />
                    {errors.envLicenseNo && (
                      <p className="text-xs text-red-600 mt-1">{errors.envLicenseNo}</p>
                    )}
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-gray-800">Registration Date <span className="text-red-600 font-bold">*</span></label>
                    <input
                      type="date"
                      value={formData.registrationDate}
                      onChange={(e) => handleInputChange("registrationDate", e.target.value)}
                      className="h-11 w-full rounded-lg border border-gray-200 bg-gray-50 px-3 text-sm text-gray-900 placeholder:text-gray-400 outline-none transition-colors hover:border-gray-300 focus:border-brand-blue focus:bg-white focus:ring-2 focus:ring-brand-blue/20"
                    />
                    {errors.registrationDate && (
                      <p className="text-xs text-red-600 mt-1">{errors.registrationDate}</p>
                    )}
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-gray-800">Expiry Date <span className="text-red-600 font-bold">*</span></label>
                    <input
                      type="date"
                      value={formData.envExpiryDate}
                      onChange={(e) => handleInputChange("envExpiryDate", e.target.value)}
                      className="h-11 w-full rounded-lg border border-gray-200 bg-gray-50 px-3 text-sm text-gray-900 placeholder:text-gray-400 outline-none transition-colors hover:border-gray-300 focus:border-brand-blue focus:bg-white focus:ring-2 focus:ring-brand-blue/20"
                    />
                    {errors.envExpiryDate && (
                      <p className="text-xs text-red-600 mt-1">{errors.envExpiryDate}</p>
                    )}
                  </div>
                </div>
              )}

              {/* Town Planner */}
              {formData.consultantType === "Town Planner" && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-gray-800">Town Planner License No. <span className="text-red-600 font-bold">*</span></label>
                    <input
                      value={formData.townPlannerLicenseNo}
                      onChange={(e) => handleInputChange("townPlannerLicenseNo", e.target.value)}
                      onBlur={() => lookupRegistrationUniqueness("townPlannerLicenseNo")}
                      className="h-11 w-full rounded-lg border border-gray-200 bg-gray-50 px-3 text-sm text-gray-900 placeholder:text-gray-400 outline-none transition-colors hover:border-gray-300 focus:border-brand-blue focus:bg-white focus:ring-2 focus:ring-brand-blue/20"
                      placeholder="Enter license number"
                    />
                    {errors.townPlannerLicenseNo && (
                      <p className="text-xs text-red-600 mt-1">{errors.townPlannerLicenseNo}</p>
                    )}
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-gray-800">Registration Date <span className="text-red-600 font-bold">*</span></label>
                    <input
                      type="date"
                      value={formData.registrationDate}
                      onChange={(e) => handleInputChange("registrationDate", e.target.value)}
                      className="h-11 w-full rounded-lg border border-gray-200 bg-gray-50 px-3 text-sm text-gray-900 placeholder:text-gray-400 outline-none transition-colors hover:border-gray-300 focus:border-brand-blue focus:bg-white focus:ring-2 focus:ring-brand-blue/20"
                    />
                    {errors.registrationDate && (
                      <p className="text-xs text-red-600 mt-1">{errors.registrationDate}</p>
                    )}
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-gray-800">Expiry Date <span className="text-red-600 font-bold">*</span></label>
                    <input
                      type="date"
                      value={formData.townPlannerExpiryDate}
                      onChange={(e) => handleInputChange("townPlannerExpiryDate", e.target.value)}
                      className="h-11 w-full rounded-lg border border-gray-200 bg-gray-50 px-3 text-sm text-gray-900 placeholder:text-gray-400 outline-none transition-colors hover:border-gray-300 focus:border-brand-blue focus:bg-white focus:ring-2 focus:ring-brand-blue/20"
                    />
                    {errors.townPlannerExpiryDate && (
                      <p className="text-xs text-red-600 mt-1">{errors.townPlannerExpiryDate}</p>
                    )}
                  </div>
                </div>
              )}

              </fieldset>

            </div>

        {/* Documents Upload Section */}
            <div id="section-documents" className={`scroll-mt-6 overflow-hidden rounded-2xl border border-gray-200 bg-white p-6 transition-all duration-300 shadow-sm ${activeSection === "section-documents" ? "shadow-md ring-2 ring-brand-blue/20" : ""}`}>
              <div 
                className="flex items-center gap-3 mb-2 cursor-pointer hover:text-brand-blue transition-colors"
                onClick={() => scrollToSection("section-documents")}
              >
                <div className="w-8 h-8 flex items-center justify-center bg-blue-50 rounded-lg">
                  <svg className="w-5 h-5 text-brand-blue" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-brand-navy">Documents Upload</h3>
              </div>
              <p className="text-sm text-gray-600 mb-4 ml-11">
                Upload photograph and signature. Aadhaar, PAN, and Technical Person License are collected in Identity Documents.
              </p>

              <div className="mb-4 rounded-lg border border-sky-100 bg-sky-50/70 px-4 py-3 text-sm text-sky-800">
                {formData.aadhaarCardFile && formData.panCardFile && formData.licenseCertificateFile ? (
                  <p>
                    Identity documents already attached: Aadhaar, PAN, and Technical Person License.
                  </p>
                ) : (
                  <p>
                    Please upload Aadhaar, PAN, and Technical Person License in Identity Documents first.
                  </p>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <div>
                    <label className="mb-1.5 block text-sm font-medium text-gray-800">Authorized Signatory Photograph <span className="text-red-600 font-bold">*</span></label>
                  <input
                    type="file"
                    accept=".gif,.jpg,.jpeg,.png,.bmp"
                      onChange={(e) => handleFileChange("authorizedSignatoryPhotoFile", e.target.files?.[0] || null)}
                    className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-900 outline-none transition-colors hover:border-gray-300 focus:border-brand-blue focus:bg-white focus:ring-2 focus:ring-brand-blue/20"
                  />
                    <p className="text-xs text-gray-500 mt-1">Only .GIF, .JPG, .PNG, .BMP (max 100x120px)</p>
                  {formData.authorizedSignatoryPhotoFile && (
                      <p className="text-xs text-green-600 mt-1">✓ {formData.authorizedSignatoryPhotoFile.name}</p>
                  )}
                  {errors.authorizedSignatoryPhotoFile && (
                    <p className="text-xs text-red-600 mt-1">{errors.authorizedSignatoryPhotoFile}</p>
                  )}
                </div>
                <div>
                    <label className="mb-1.5 block text-sm font-medium text-gray-800">Authorized Signatory Signature <span className="text-red-600 font-bold">*</span></label>
                  <input
                    type="file"
                    accept=".gif,.jpg,.jpeg,.png,.bmp"
                      onChange={(e) => handleFileChange("authorizedSignatorySignatureFile", e.target.files?.[0] || null)}
                    className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-900 outline-none transition-colors hover:border-gray-300 focus:border-brand-blue focus:bg-white focus:ring-2 focus:ring-brand-blue/20"
                  />
                    <p className="text-xs text-gray-500 mt-1">Only .GIF, .JPG, .PNG, .BMP (max 100x120px)</p>
                  {formData.authorizedSignatorySignatureFile && (
                      <p className="text-xs text-green-600 mt-1">✓ {formData.authorizedSignatorySignatureFile.name}</p>
                    )}
                  {errors.authorizedSignatorySignatureFile && (
                    <p className="text-xs text-red-600 mt-1">{errors.authorizedSignatorySignatureFile}</p>
                  )}
                  </div>
              </div>

              <p className="text-xs text-gray-500 mt-4">
                Max 10MB per file. JPG, PNG, GIF, or BMP.
              </p>
            </div>

            {/* Letterhead Upload Section */}
            <div id="section-letterhead" className={`scroll-mt-24 overflow-hidden rounded-2xl border border-gray-200 bg-white p-6 transition-shadow duration-300 ${activeSection === "section-letterhead" ? "shadow-md ring-2 ring-brand-blue/20" : ""}`}>
              <div 
                className="flex items-center gap-3 mb-2 cursor-pointer hover:text-brand-blue transition-colors"
                onClick={() => scrollToSection("section-letterhead")}
              >
                <div className="w-8 h-8 flex items-center justify-center bg-blue-50 rounded-lg">
                  <svg className="w-5 h-5 text-brand-blue" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-brand-navy">Letterhead</h3>
              </div>
              <p className="text-sm text-gray-600 mb-4 ml-11">
                {hasExistingLetterhead
                  ? "Letterhead was already uploaded during partial registration and cannot be changed here."
                  : "Upload your letterhead image (JPG/PNG). After successful upload, you will see a preview showing where it will be placed."}
              </p>

              {hasExistingLetterhead ? (
                <div
                  className={`border rounded-lg p-4 bg-gray-50 space-y-3 ${
                    lockPartialProfileFields
                      ? "cursor-not-allowed [&_*]:cursor-not-allowed"
                      : ""
                  }`}
                >
                  <p className="text-sm font-medium text-brand-navy">
                    Letterhead already on file
                  </p>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={existingLetterheadUrl || ""}
                    alt="Saved letterhead"
                    className="max-h-64 mx-auto rounded border border-gray-200 bg-white object-contain"
                  />
                </div>
              ) : (
              <div className="grid grid-cols-1 gap-4">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-800">Letterhead Image <span className="text-red-600 font-bold">*</span></label>
                  <div className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
                    errors.letterheadFile
                      ? 'border-red-300 bg-red-50'
                      : formData.letterheadFile 
                        ? hasViewedLetterhead 
                          ? 'border-green-300 bg-green-50' 
                          : 'border-blue-300 bg-blue-50'
                        : 'border-gray-300 hover:border-blue-400'
                  }`}>
                    <input
                      type="file"
                      accept=".jpg,.jpeg,.png,image/jpeg,image/png"
                      onChange={handleLetterheadChange}
                      className="hidden"
                      id="letterhead-upload"
                    />
                    <label htmlFor="letterhead-upload" className="cursor-pointer">
                      <div className="flex flex-col items-center gap-2">
                        <svg className={`w-10 h-10 ${
                          errors.letterheadFile 
                            ? 'text-red-500' 
                            : formData.letterheadFile 
                              ? 'text-green-500' 
                              : 'text-gray-400'
                        }`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                        </svg>
                        <span className="text-sm text-gray-600">
                          {formData.letterheadFile ? (
                            <span className="text-green-600 font-medium">✓ {formData.letterheadFile.name}</span>
                          ) : (
                            <>
                              <span className="text-brand-blue font-medium">Click to upload</span> or drag and drop
                            </>
                          )}
                        </span>
                        <span className="text-xs text-gray-500">JPG, PNG only (max 10MB)</span>
                      </div>
                    </label>
                  </div>
                  {errors.letterheadFile && (
                    <p className="text-xs text-red-600 mt-2">{errors.letterheadFile}</p>
                  )}
                </div>

                {/* Preview and actions when file uploaded */}
                {formData.letterheadFile && (
                  <div className="border rounded-lg p-4 bg-gray-50">
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-sm font-medium text-black">Uploaded Letterhead</p>
                      {hasViewedLetterhead && (
                        <span className="text-xs text-green-600 flex items-center gap-1">
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                          Preview viewed
                        </span>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-3 p-3 bg-white border rounded-lg">
                      <svg className="w-10 h-10 text-red-500 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6zm-1 2l5 5h-5V4zm-2.5 9.5L14 10l2 2.5V17H8v-4l2.5 3 1-3.5z"/>
                      </svg>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-black truncate">{formData.letterheadFile.name}</p>
                        <p className="text-xs text-gray-500">
                          {(formData.letterheadFile.size / 1024 / 1024).toFixed(2)} MB
                        </p>
                      </div>
                    </div>

                    <div className="flex gap-2 mt-3">
                      <button
                        type="button"
                        onClick={() => setIsPDFModalOpen(true)}
                        className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                        View Preview
                      </button>
                      <button
                        type="button"
                        onClick={handleRemoveLetterhead}
                        className="px-4 py-2 border border-red-300 text-red-600 rounded-lg text-sm font-medium hover:bg-red-50 transition-colors flex items-center gap-2"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                        Remove
                      </button>
                    </div>

                    {!hasViewedLetterhead && (
                      <p className="text-xs text-amber-600 mt-2 flex items-center gap-1">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Please view the preview to confirm letterhead placement
                      </p>
                    )}
                  </div>
                )}
              </div>
              )}
            </div>

            {/* Login Setup Section */}
            <div id="section-login" className={`scroll-mt-6 overflow-hidden rounded-2xl border border-gray-200 bg-white p-6 transition-all duration-300 shadow-sm ${activeSection === "section-login" ? "shadow-md ring-2 ring-brand-blue/20" : ""}`}>
              <div 
                className="flex items-center gap-3 mb-2 cursor-pointer hover:text-brand-blue transition-colors"
                onClick={() => scrollToSection("section-login")}
              >
                <div className="w-8 h-8 flex items-center justify-center bg-blue-50 rounded-lg">
                  <svg className="w-5 h-5 text-brand-blue" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-brand-navy">
                  Login Setup
                </h3>
              </div>
              <p className="text-sm text-gray-600 mb-4 ml-11">
                Create your credentials
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-800">
                    User ID <span className="text-red-600 font-bold">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.userId}
                    onChange={(e) => handleInputChange("userId", e.target.value)}
                    className="h-11 w-full rounded-lg border border-gray-200 bg-gray-50 px-3 text-sm text-gray-900 placeholder:text-gray-400 outline-none transition-colors hover:border-gray-300 focus:border-brand-blue focus:bg-white focus:ring-2 focus:ring-brand-blue/20"
                    placeholder="Enter User ID"
                  />
                  {errors.userId && (
                    <p className="text-xs text-red-600 mt-1">{errors.userId}</p>
                  )}
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-800">
                    Password <span className="text-red-600 font-bold">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      value={formData.password}
                      onChange={(e) => handleInputChange("password", e.target.value)}
                      className="h-11 w-full rounded-lg border border-gray-200 bg-gray-50 px-3 pr-28 text-sm text-gray-900 outline-none transition-colors hover:border-gray-300 focus:border-brand-blue focus:bg-white focus:ring-2 focus:ring-brand-blue/20"
                      placeholder="Create a strong password"
                    />
                    <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="text-gray-500 hover:text-gray-700 focus:outline-none"
                        aria-label={showPassword ? "Hide password" : "Show password"}
                      >
                        {showPassword ? (
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                          </svg>
                        ) : (
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                        )}
                      </button>
                    </div>
                  </div>
                  
                  {/* Password Strength Indicator */}
                  {formData.password && (
                    <div className="mt-2">
                      {/* Strength Bar */}
                      <div className="flex gap-1 mb-2">
                        {[1, 2, 3, 4, 5].map((level) => {
                          const strength = [
                            formData.password.length >= 8,
                            /[A-Z]/.test(formData.password),
                            /[a-z]/.test(formData.password),
                            /[0-9]/.test(formData.password),
                            /[!@#$%^&*(),.?":{}|<>]/.test(formData.password),
                          ].filter(Boolean).length;
                          
                          const colors = ['bg-red-500', 'bg-orange-500', 'bg-yellow-500', 'bg-lime-500', 'bg-green-500'];
                          const isActive = level <= strength;
                          
                          return (
                            <div
                              key={level}
                              className={`h-1.5 flex-1 rounded-full transition-all ${
                                isActive ? colors[strength - 1] : 'bg-gray-200'
                              }`}
                            />
                          );
                        })}
                      </div>
                      
                      {/* Password Strength Label */}
                      <p className={`text-xs font-medium mb-2 ${
                        (() => {
                          const strength = [
                            formData.password.length >= 8,
                            /[A-Z]/.test(formData.password),
                            /[a-z]/.test(formData.password),
                            /[0-9]/.test(formData.password),
                            /[!@#$%^&*(),.?":{}|<>]/.test(formData.password),
                          ].filter(Boolean).length;
                          if (strength <= 1) return 'text-red-600';
                          if (strength <= 2) return 'text-orange-600';
                          if (strength <= 3) return 'text-yellow-600';
                          if (strength <= 4) return 'text-lime-600';
                          return 'text-green-600';
                        })()
                      }`}>
                        {(() => {
                          const strength = [
                            formData.password.length >= 8,
                            /[A-Z]/.test(formData.password),
                            /[a-z]/.test(formData.password),
                            /[0-9]/.test(formData.password),
                            /[!@#$%^&*(),.?":{}|<>]/.test(formData.password),
                          ].filter(Boolean).length;
                          const labels = ['Very Weak', 'Weak', 'Fair', 'Good', 'Strong'];
                          return labels[strength - 1] || 'Very Weak';
                        })()}
                      </p>
                      
                      {/* Requirements Checklist */}
                      <div className="grid grid-cols-1 gap-1 text-xs">
                        <div className={`flex items-center gap-1.5 ${formData.password.length >= 8 ? 'text-green-600' : 'text-gray-500'}`}>
                          {formData.password.length >= 8 ? (
                            <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                          ) : (
                            <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                            </svg>
                          )}
                          <span>At least 8 characters</span>
                        </div>
                        <div className={`flex items-center gap-1.5 ${/[A-Z]/.test(formData.password) ? 'text-green-600' : 'text-gray-500'}`}>
                          {/[A-Z]/.test(formData.password) ? (
                            <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                          ) : (
                            <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                            </svg>
                          )}
                          <span>One uppercase letter (A-Z)</span>
                        </div>
                        <div className={`flex items-center gap-1.5 ${/[a-z]/.test(formData.password) ? 'text-green-600' : 'text-gray-500'}`}>
                          {/[a-z]/.test(formData.password) ? (
                            <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                          ) : (
                            <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                            </svg>
                          )}
                          <span>One lowercase letter (a-z)</span>
                        </div>
                        <div className={`flex items-center gap-1.5 ${/[0-9]/.test(formData.password) ? 'text-green-600' : 'text-gray-500'}`}>
                          {/[0-9]/.test(formData.password) ? (
                            <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                          ) : (
                            <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                            </svg>
                          )}
                          <span>One number (0-9)</span>
                        </div>
                        <div className={`flex items-center gap-1.5 ${/[!@#$%^&*(),.?":{}|<>]/.test(formData.password) ? 'text-green-600' : 'text-gray-500'}`}>
                          {/[!@#$%^&*(),.?":{}|<>]/.test(formData.password) ? (
                            <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                          ) : (
                            <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                            </svg>
                          )}
                          <span>One special character (!@#$%^&*...)</span>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {errors.password && (
                    <p className="text-xs text-red-600 mt-1">{errors.password}</p>
                  )}
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-800">
                    Confirm Password <span className="text-red-600 font-bold">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type={showConfirmPassword ? "text" : "password"}
                      value={formData.confirmPassword}
                      onChange={(e) => handleInputChange("confirmPassword", e.target.value)}
                      onCopy={(e) => e.preventDefault()}
                      onPaste={(e) => e.preventDefault()}
                      onCut={(e) => e.preventDefault()}
                      onPasteCapture={(e) => e.preventDefault()}
                      onDrop={(e) => e.preventDefault()}
                      onBeforeInput={(e) => {
                        const n = e.nativeEvent;
                        if ("inputType" in n) {
                          const inputType = (n as InputEvent).inputType;
                          if (inputType === "insertFromPaste" || inputType === "insertFromDrop") {
                            e.preventDefault();
                          }
                        }
                      }}
                      className="h-11 w-full rounded-lg border border-gray-200 bg-gray-50 px-3 pr-10 text-sm text-gray-900 outline-none transition-colors hover:border-gray-300 focus:border-brand-blue focus:bg-white focus:ring-2 focus:ring-brand-blue/20"
                      placeholder="Re-enter password"
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 focus:outline-none"
                      aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                    >
                      {showConfirmPassword ? (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                        </svg>
                      ) : (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                      )}
                    </button>
                  </div>
                  {formData.confirmPassword && formData.password === formData.confirmPassword && (
                    <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
                      <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                      Passwords match
                    </p>
                  )}
                  {errors.confirmPassword && (
                    <p className="text-xs text-red-600 mt-1">{errors.confirmPassword}</p>
                  )}
                </div>
              </div>
              </div>

            {/* Declaration Section */}
            <div id="section-declaration" className={`scroll-mt-6 overflow-hidden rounded-2xl border border-gray-200 bg-white p-6 transition-all duration-300 shadow-sm ${activeSection === "section-declaration" ? "shadow-md ring-2 ring-brand-blue/20" : ""}`}>
              <div 
                className="flex items-center gap-3 mb-4 cursor-pointer hover:text-brand-blue transition-colors"
                onClick={() => scrollToSection("section-declaration")}
              >
                <div className="w-8 h-8 flex items-center justify-center bg-blue-50 rounded-lg">
                  <svg className="w-5 h-5 text-brand-blue" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-brand-navy">
                Declaration *
              </h3>
              </div>

              <div className="border rounded-lg p-4 bg-gray-50 mb-4">
                <textarea
                  readOnly
                  onScroll={handleDeclarationScroll}
                  className="w-full h-64 p-3 bg-white border rounded-lg text-sm text-black resize-none focus:outline-none overflow-y-auto"
                  value={declarationText}
                />
                {!hasScrolledDeclaration && (
                  <p className="text-xs text-amber-600 mt-2 flex items-center gap-1">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                    </svg>
                    Please scroll to the bottom to read the complete declaration
                  </p>
                )}
              </div>

              <div className="flex items-start gap-3 mb-4">
                <input
                  type="checkbox"
                  checked={formData.acceptDeclaration}
                  onChange={(e) => handleInputChange("acceptDeclaration", e.target.checked)}
                  disabled={!hasScrolledDeclaration}
                  className={`mt-1 w-4 h-4 ${!hasScrolledDeclaration ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                />
                <label className={`text-sm ${!hasScrolledDeclaration ? 'text-gray-400' : 'text-black'}`}>
                  I accept the declaration.
                </label>
              </div>
              {!hasScrolledDeclaration && (
                <p className="text-xs text-gray-500 mb-2">
                  You must scroll through and read the entire declaration before accepting.
                </p>
              )}
              {errors.acceptDeclaration && (
                <p className="text-xs text-red-600">{errors.acceptDeclaration}</p>
              )}

              <p className="text-xs text-gray-500">
                By submitting, you consent to verification of credentials with issuing bodies (COA, IEI, MCGM Empanelment, etc.)
              </p>
            </div>

          {submitSuccess && (
            <div className="p-4 border border-green-200 bg-green-50 text-green-700 rounded-lg mb-4">
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span className="font-medium">Registration successful!</span>
              </div>
              <p className="text-sm mt-1">Redirecting to home page...</p>
            </div>
          )}

          <div className="mt-8 flex justify-end border-t border-gray-100 pt-6">
            <button
              type="button"
              onClick={handleSubmitForm}
              disabled={isSubmitting || submitSuccess}
              className={`flex items-center gap-2 rounded-lg px-8 py-2.5 text-sm font-semibold shadow-sm transition-all
                ${isSubmitting || submitSuccess 
                  ? 'cursor-not-allowed bg-gray-300 text-white' 
                  : 'bg-brand-blue text-white hover:bg-brand-blue-hover hover:shadow-md'}`}
            >
              {isSubmitting ? (
                <>
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Submitting...
                </>
              ) : submitSuccess ? (
                'Submitted!'
              ) : (
                'Submit'
              )}
            </button>
          </div>
          </>
          )}
        </div>
        </div>
      </div>

      {/* Image Modal - Shows user's uploaded letterhead image with blue content area (via portal) */}
      {typeof window !== "undefined" &&
        isPDFModalOpen &&
        letterheadPreviewUrl &&
        createPortal(
          <AnimatePresence>
            {isPDFModalOpen && (
              <motion.div
                className="fixed inset-0 z-[9999] flex justify-center items-start bg-black/50 backdrop-blur-sm p-4 pt-10"
                onClick={() => {
                  setIsPDFModalOpen(false);
                  if (letterheadPreviewUrl) {
                    setHasViewedLetterhead(true);
                  }
                }}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <motion.div
                  id="letterhead-modal"
                  className="bg-white w-full max-w-5xl rounded-xl shadow-2xl relative max-h-[90vh] flex flex-col overflow-hidden"
                  onClick={(e) => e.stopPropagation()}
                  initial={{ y: -40, opacity: 0, scale: 0.95 }}
                  animate={{ y: 0, opacity: 1, scale: 1 }}
                  exit={{ y: -40, opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.25 }}
                >
                  <div className="flex items-center justify-between border-b border-gray-100 bg-brand-navy px-6 py-4">
                    <div>
                      <h2 className="text-lg font-semibold text-white">
                        Letterhead Preview
                      </h2>
                      <p className="mt-0.5 text-sm text-white/70">
                        This is a demo showing where your letterhead will be placed.
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        setIsPDFModalOpen(false);
                        if (letterheadPreviewUrl) {
                          setHasViewedLetterhead(true);
                        }
                      }}
                      className="text-2xl font-bold text-white/80 transition-colors hover:text-white"
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
                        {/* Letterhead image as background */}
                        <img
                          src={letterheadPreviewUrl}
                          alt="Letterhead Preview"
                          className="absolute inset-0 w-full h-full object-contain"
                        />
                        {/* Blue content area overlay (simulating where content will appear) */}
                        <div
                          className="absolute rounded-xl border-2 border-blue-400 bg-blue-50/40"
                          style={{ top: "14%", bottom: "14%", left: "8%", right: "8%" }}
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

      {/* Phone OTP Verification Modal */}
      <OTPVerificationModal
        open={showPhoneOTPModal}
        onClose={() => setShowPhoneOTPModal(false)}
        onVerified={() => {
          setIsPhoneVerified(true);
          setShowPhoneOTPModal(false);
          // Scroll to Basic Details section after verification
          setTimeout(() => {
            const basicDetailsSection = document.getElementById('section-basic-details');
            if (basicDetailsSection) {
              basicDetailsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
          }, 100);
        }}
        phoneNumber={formData.alternatePhone}
        title="Verify Phone Number"
      />

      {/* Email OTP Verification Modal */}
      <EmailOTPVerificationModal
        open={showEmailOTPModal}
        onClose={() => setShowEmailOTPModal(false)}
        onVerified={(userId?: string) => {
          setIsEmailVerified(true);
          if (userId) setVerifiedUserId(userId);
          setShowEmailOTPModal(false);
        }}
        email={formData.email}
        title="Verify Email Address"
      />
    </>
  );
};

export default ConsultantRegistrationForm;


