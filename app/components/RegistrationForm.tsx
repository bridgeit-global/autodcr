"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/app/utils/supabase";
import { motion, AnimatePresence } from "framer-motion";
import { createPortal } from "react-dom";
import OTPVerificationModal from "./OTPVerificationModal";
import EmailOTPVerificationModal from "./EmailOTPVerificationModal";

interface RegistrationFormProps {
  title?: string;
}

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
    { id: "individualUtility", label: "Recent Utility Bill / Address Proof", accept: ".pdf" },
  ],
  "Partnership Firm": [
    { id: "partnershipDeed", label: "Partnership Deed", required: true, accept: ".pdf" },
    { id: "partnershipCert", label: "Firm Registration Certificate", required: true, accept: ".pdf" },
  ],
  "Pvt. Ltd. / Ltd. Company": [
    { id: "companyIncorporationCert", label: "Certificate of Incorporation", required: true, accept: ".pdf" },
    { id: "companyMoaAoa", label: "MoA & AoA (single compiled PDF)", required: true, accept: ".pdf" },
    { id: "companyBoardResolution", label: "Board Resolution authorising signatory", required: true, accept: ".pdf" },
  ],
  LLP: [
    { id: "llpCertificate", label: "LLPIN Allotment / Certificate of Incorporation", required: true, accept: ".pdf" },
    { id: "llpAgreementDoc", label: "LLP Agreement", required: true, accept: ".pdf" },
    { id: "llpResolutionDoc", label: "Resolution / LOA authorising Designated Partner", required: true, accept: ".pdf" },
  ],
  "Trust / Society": [
    { id: "trustRegistrationCert", label: "Registration Certificate (Trust / Society)", required: true, accept: ".pdf" },
    { id: "trustDeedDoc", label: "Trust Deed / Bye-laws", required: true, accept: ".pdf" },
  ],
  "Govt. / PSU / Local Body": [
    { id: "govOrder", label: "Government Order / Office Order authorising officer", required: true, accept: ".pdf" },
  ],
};

const RegistrationForm: React.FC<RegistrationFormProps> = ({
  title = "Registration"
}) => {
  const router = useRouter();
  const [formError, setFormError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [hasScrolledDeclaration, setHasScrolledDeclaration] = useState(false);
  const [activeSection, setActiveSection] = useState<string>("section-basic-details");
  
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
  
  // Password visibility state
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Generate a strong random password (similar to browser suggestions)
  const generateStrongPassword = () => {
    const length = 16;
    const uppercase = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    const lowercase = "abcdefghijklmnopqrstuvwxyz";
    const numbers = "0123456789";
    const special = "!@#$%^&*(),.?\":{}|<>";
    const allChars = uppercase + lowercase + numbers + special;
    
    // Ensure at least one character from each required category
    let pwd = "";
    pwd += uppercase[Math.floor(Math.random() * uppercase.length)];
    pwd += lowercase[Math.floor(Math.random() * lowercase.length)];
    pwd += numbers[Math.floor(Math.random() * numbers.length)];
    pwd += special[Math.floor(Math.random() * special.length)];
    
    // Fill the rest randomly from all character sets
    for (let i = pwd.length; i < length; i++) {
      pwd += allChars.charAt(Math.floor(Math.random() * allChars.length));
    }
    
    // Shuffle the password to randomize the order
    pwd = pwd.split('').sort(() => Math.random() - 0.5).join('');

    // Update password & confirm password, and revalidate both
    setFormData((prev) => {
      const updated = {
        ...prev,
        password: pwd,
        confirmPassword: pwd,
      };
      validateField("password", updated.password, updated);
      validateField("confirmPassword", updated.confirmPassword, updated);
      return updated;
    });

    // Show both fields so user can see the generated password
    setShowPassword(true);
    setShowConfirmPassword(true);
  };
  
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
  }, []);

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
    // Basic Details
    entityName: "",
    entityType: "",
    gstNo: "",
    
    // Personal Information
    firstName: "",
    middleName: "",
    lastName: "",
    email: "",
    
    // Common fields
    city: "",
    pincode: "",
    alternatePhone: "",
    pan: "",
    address: "",
    
    // Proprietorship / Individual
    fullNameProprietor: "",
    aadhaarNo: "",
    residentialAddress: "",
    
    // Partnership Firm
    firmRegistrationNo: "",
    partnershipRegistrationDate: "",
    numberOfPartners: "",
    partnershipDeedFile: null as File | null,
    firmRegistrationCertFile: null as File | null,
    
    // Pvt. Ltd. / Ltd. Company
    cin: "",
    rocRegistrationDate: "",
    moaAoaFile: null as File | null,
    boardResolutionFile: null as File | null,
    numberOfDirectors: "",
    
    // LLP
    llpin: "",
    llpIncorporationDate: "",
    numberOfDesignatedPartners: "",
    llpAgreementFile: null as File | null,
    llpResolutionFile: null as File | null,
    
    // Trust / Society
    trustRegistrationNo: "",
    trustRegistrationDate: "",
    trustDeedFile: null as File | null,
    trustRegistrationCertFile: null as File | null,
    trustResolutionFile: null as File | null,
    numberOfTrustees: "",
    
    // Govt. / PSU / Local Body
    departmentName: "",
    officeOrderRef: "",
    officeOrderFile: null as File | null,
    
    // Common documents
    authorizedSignatoryPhotoFile: null as File | null,
    authorizedSignatorySignatureFile: null as File | null,
    panCardFile: null as File | null,
    letterheadFile: null as File | null,
    
    // Entity Documents
    entityDocuments: {} as Record<string, File | null>,
    
    // Login
    userId: "",
    password: "",
    confirmPassword: "",
    acceptDeclaration: false,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const docsForEntity = DOC_CHECKLIST[formData.entityType] || [];

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

  const handleEntityDocumentChange = (docId: string, file: File | null) => {
    setFormData(prev => {
      const updated = {
        ...prev,
        entityDocuments: {
          ...prev.entityDocuments,
          [docId]: file
        }
      };
      validateField(`entityDocuments.${docId}`, file, updated);
      return updated;
    });
  };

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

    // Validate A4 size by checking image dimensions
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

      // Validation passed - create preview URL
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
    { id: "section-basic-details", label: "Basic Details" },
    { id: "section-registration", label: "Registration Numbers" },
    { id: "section-documents", label: "Documents Upload" },
    { id: "section-letterhead", label: "Letterhead" },
    { id: "section-login", label: "Login Setup" },
    { id: "section-declaration", label: "Declaration" },
  ];

  const profileFields: readonly string[] = [
    "entityType",
    "email",
    "city",
    "pincode",
    "address",
    "gstNo",
    "alternatePhone",
  ];

  const credentialFields: readonly string[] = [
    "coaRegNo",
    "coaExpiryDate",
    "authorizedSignatoryPhotoFile",
    "authorizedSignatorySignatureFile",
    "coaCertificateFile",
  ];

  const loginFields: readonly string[] = ["userId", "password", "confirmPassword", "acceptDeclaration"];

  const requiredFields = [...profileFields, ...credentialFields, ...loginFields];

  const scrollToSection = (sectionId: string) => {
    const element = document.getElementById(sectionId);
    if (element) {
      setActiveSection(sectionId);
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
      case "entityType":
        if (!value) error = "Select an entity type";
        break;
      case "entityName":
        if (!value) error = "Entity name is required";
        break;
      case "firstName":
        if (!value) error = "First name is required";
        break;
      case "lastName":
        if (!value) error = "Last name is required";
        break;
      case "middleName":
        // Middle name is optional, no validation needed
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
        else if (!pincodeRegex.test(value as string)) error = "Enter a 6-digit pincode";
        break;
      case "address":
        if (!value) error = "Address is required";
        break;
      case "gstNo":
        if (!value || (typeof value === "string" && value.trim() === "")) {
          error = "GSTIN No. is required";
        } else if (!/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(value as string)) {
          error = "Enter valid GSTIN No. (e.g., 22AAAAA0000A1Z5)";
        }
        break;
      case "pan":
        // PAN is optional; validate only if user enters a value
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
      case "panCardFile":
        if (!value) error = "Upload PAN Card";
        break;
      case "letterheadFile":
        if (!value) error = "Upload Letterhead";
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
        if (!value) error = "Upload COA Certificate";
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
      case "structuralLicenseFile":
        if (!value) error = "Upload Structural License";
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
      case "lbsCertificateFile":
        if (!value) error = "Upload LBS Certificate";
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
      case "mepExperienceFile":
        if (!value) error = "Upload MEP Experience Documents";
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
      case "pheAccreditationFile":
        if (!value) error = "Upload PHE Accreditation Certificate";
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
      case "pastNocFile":
        if (!value) error = "Upload Fire NOC / Accreditation";
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
      case "landscapeCertificateFile":
        if (!value) error = "Upload Landscape Certificate";
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
      case "pmcCertificateFile":
        if (!value) error = "Upload PMC Certificate";
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
      case "labRegistrationFile":
        if (!value) error = "Upload Lab Registration Certificate";
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
      case "envCertificateFile":
        if (!value) error = "Upload Environmental Certificate";
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
      case "townPlannerCertificateFile":
        if (!value) error = "Upload Town Planner Certificate";
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
      case "firmRegistrationNo":
        if (!value || (typeof value === "string" && value.trim() === "")) {
          error = "Firm Registration No. is required";
        }
        break;
      case "partnershipRegistrationDate":
        if (!value || (typeof value === "string" && value.trim() === "")) {
          error = "Date of Registration is required";
        } else {
          const selected = new Date(value as string);
          selected.setHours(0, 0, 0, 0);
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          if (selected > today) {
            error = "Date cannot be in the future";
          }
        }
        break;
      case "numberOfPartners":
        if (!value) {
          error = "Number of partners is required";
        } else {
          const numValue = parseInt(value as string, 10);
          if (isNaN(numValue) || numValue < 2) {
            error = "Number of partners must be at least 2";
          }
        }
        break;
      case "numberOfDirectors":
        if (!value) {
          error = "Number of directors is required";
        } else {
          const numValue = parseInt(value as string, 10);
          if (isNaN(numValue) || numValue < 2) {
            error = "Number of directors must be at least 2";
          }
        }
        break;
      case "numberOfDesignatedPartners":
        if (!value) {
          error = "Number of designated partners is required";
        } else {
          const numValue = parseInt(value as string, 10);
          if (isNaN(numValue) || numValue < 2) {
            error = "Number of designated partners must be at least 2";
          }
        }
        break;
      case "numberOfTrustees":
        if (!value) {
          error = "Number of trustees is required";
        } else {
          const numValue = parseInt(value as string, 10);
          if (isNaN(numValue) || numValue < 2) {
            error = "Number of trustees must be at least 2";
          }
        }
        break;
      case "fullNameProprietor":
        if (!value || (typeof value === "string" && value.trim() === "")) {
          error = "Full Name of Proprietor is required";
        }
        break;
      case "cin":
        if (!value || (typeof value === "string" && value.trim() === "")) {
          error = "CIN is required";
        } else if (typeof value === "string") {
          const cinValue = value.trim().toUpperCase();
          // CIN format: L/U + 5 digits + 2 letters (state) + 4 digits (year) + 3 alphanumeric + 6 alphanumeric = 21 characters
          // Example: L12345MH2019ABC123456
          const cinRegex = /^[LU][0-9]{5}[A-Z]{2}[0-9]{4}[A-Z0-9]{3}[A-Z0-9]{6}$/;
          if (cinValue.length !== 21) {
            error = "Enter valid CIN (e.g., L12345MH2019ABC123456)";
          } else if (!cinRegex.test(cinValue)) {
            error = "Enter valid CIN (e.g., L12345MH2019ABC123456)";
          }
        }
        break;
      case "rocRegistrationDate":
        if (!value || (typeof value === "string" && value.trim() === "")) {
          error = "ROC Registration Date is required";
        } else {
          const selected = new Date(value as string);
          selected.setHours(0, 0, 0, 0);
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          if (selected > today) {
            error = "Date cannot be in the future";
          }
        }
        break;
      case "llpin":
        if (!value || (typeof value === "string" && value.trim() === "")) {
          error = "LLPIN is required";
        } else {
          const llpinRegex = /^[A-Z]{3}-[A-Z0-9]{4}$/;
          if (!llpinRegex.test(value as string)) {
            error = "Enter valid LLPIN (format: AAA-XXXX, e.g., AAX-1234)";
          }
        }
        break;
      case "llpIncorporationDate":
        if (!value || (typeof value === "string" && value.trim() === "")) {
          error = "LLP Incorporation Date is required";
        } else {
          const selected = new Date(value as string);
          selected.setHours(0, 0, 0, 0);
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          if (selected > today) {
            error = "Date cannot be in the future";
          }
        }
        break;
      case "trustRegistrationNo":
        if (!value || (typeof value === "string" && value.trim() === "")) {
          error = "Trust Registration No. is required";
        }
        break;
      case "trustRegistrationDate":
        if (!value || (typeof value === "string" && value.trim() === "")) {
          error = "Trust Registration Date is required";
        } else {
          const selected = new Date(value as string);
          selected.setHours(0, 0, 0, 0);
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          if (selected > today) {
            error = "Date cannot be in the future";
          }
        }
        break;
      case "departmentName":
        if (!value || (typeof value === "string" && value.trim() === "")) {
          error = "Department Name is required";
        }
        break;
        break;
      default:
        // Handle entity document fields
        if (field.startsWith("entityDocuments.")) {
          const docId = field.replace("entityDocuments.", "");
          if (!value) {
            // Check if this document is required based on DOC_CHECKLIST
            const docsForEntity = DOC_CHECKLIST[formData.entityType] || [];
            const docRequirement = docsForEntity.find(doc => doc.id === docId);
            if (docRequirement?.required) {
              error = `Upload ${docRequirement.label}`;
            }
          }
        }
        break;
    }

    setFieldError(field, error);
    return !error;
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

  const validateFields = (fields: readonly string[]) => {
    let valid = true;
    fields.forEach((field) => {
      let value: unknown;
      if (field.startsWith("entityDocuments.")) {
        // Handle entity document fields
        const docId = field.replace("entityDocuments.", "");
        value = formData.entityDocuments[docId] || null;
      } else {
        value = (formData as Record<string, unknown>)[field];
      }
      if (!validateField(field, value)) {
        console.log('Validation failed for field:', field);
        valid = false;
      }
    });
    return valid;
  };

  const handleSubmitForm = async () => {
    // Build dynamic required fields based on entity type
    const getDynamicRequiredFields = (): string[] => {
      const baseFields = [
        "entityType",
        "entityName",
        "firstName",
        "lastName",
        "email",
        "city",
        "pincode",
        "address",
        "alternatePhone",
        "pan",
        "gstNo",
        "authorizedSignatoryPhotoFile",
        "authorizedSignatorySignatureFile",
        "panCardFile",
        "letterheadFile",
        "userId",
        "password",
        "confirmPassword",
        "acceptDeclaration",
      ];

      const typeSpecificFields: Record<string, string[]> = {
        "Proprietorship / Individual": [
          "fullNameProprietor",
          "entityDocuments.individualUtility",
        ],
        "Partnership Firm": [
          "firmRegistrationNo",
          "partnershipRegistrationDate",
          "numberOfPartners",
          "entityDocuments.partnershipDeed",
          "entityDocuments.partnershipCert",
        ],
        "Pvt. Ltd. / Ltd. Company": [
          "cin",
          "rocRegistrationDate",
          "numberOfDirectors",
          "entityDocuments.companyIncorporationCert",
          "entityDocuments.companyMoaAoa",
          "entityDocuments.companyBoardResolution",
        ],
        "LLP": [
          "llpin",
          "llpIncorporationDate",
          "numberOfDesignatedPartners",
          "entityDocuments.llpCertificate",
          "entityDocuments.llpAgreementDoc",
          "entityDocuments.llpResolutionDoc",
        ],
        "Trust / Society": [
          "trustRegistrationNo",
          "trustRegistrationDate",
          "numberOfTrustees",
          "entityDocuments.trustRegistrationCert",
          "entityDocuments.trustDeedDoc",
        ],
        "Govt. / PSU / Local Body": [
          "departmentName",
          "entityDocuments.govOrder",
        ],
      };

      const entityTypeFields = typeSpecificFields[formData.entityType] || [];
      return [...baseFields, ...entityTypeFields];
    };

    const dynamicRequiredFields = getDynamicRequiredFields();
    console.log('Validating fields for', formData.entityType, ':', dynamicRequiredFields);
    console.log('Form data:', formData);
    
    const isValid = validateFields(dynamicRequiredFields);
    
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
      if (firstErrorField) {
        if (firstErrorField.includes('entityType') || firstErrorField.includes('email') || firstErrorField.includes('city')) {
          scrollToSection("section-basic-details");
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
      }
      return;
    }
    
    setFormError("");
    setIsSubmitting(true);

    try {
      // Check if userId already exists before proceeding
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
            entity_type: formData.entityType,
            entity_name: formData.entityName,
            first_name: formData.firstName,
            middle_name: formData.middleName || null,
            last_name: formData.lastName,
            user_id: formData.userId,
            role: 'Owner',
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
      let panCardUrl: string | null = null;
      let letterheadUrl: string | null = null;
      const entityDocumentUrls: Record<string, string> = {};

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

        // Upload PAN Card
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
        }

        // Upload entity-specific documents based on entity type
        const uploadEntityDocument = async (file: File | null, fileType: string, label: string) => {
          if (file && file instanceof File) {
            const result = await uploadFileToStorageWithPath(
              file,
              userId,
              fileType
            );
            if (!result) {
              throw new Error(`Failed to upload ${label}`);
            }
            entityDocumentUrls[fileType] = result.url;
            uploadedFilePaths.push(result.path);
          }
        };

        switch (formData.entityType) {
          case "Proprietorship / Individual":
            await uploadEntityDocument(
              formData.entityDocuments.individualUtility,
              'individualUtility',
              'Recent Utility Bill / Address Proof'
            );
            break;
          case "Partnership Firm":
            await uploadEntityDocument(
              formData.entityDocuments.partnershipDeed,
              'partnershipDeed',
              'Partnership Deed'
            );
            await uploadEntityDocument(
              formData.entityDocuments.partnershipCert,
              'partnershipCert',
              'Firm Registration Certificate'
            );
            break;
          case "Pvt. Ltd. / Ltd. Company":
            await uploadEntityDocument(
              formData.entityDocuments.companyIncorporationCert,
              'companyIncorporationCert',
              'Certificate of Incorporation'
            );
            await uploadEntityDocument(
              formData.entityDocuments.companyMoaAoa,
              'companyMoaAoa',
              'MoA & AoA'
            );
            await uploadEntityDocument(
              formData.entityDocuments.companyBoardResolution,
              'companyBoardResolution',
              'Board Resolution'
            );
            break;
          case "LLP":
            await uploadEntityDocument(
              formData.entityDocuments.llpCertificate,
              'llpCertificate',
              'LLPIN Allotment / Certificate of Incorporation'
            );
            await uploadEntityDocument(
              formData.entityDocuments.llpAgreementDoc,
              'llpAgreementDoc',
              'LLP Agreement'
            );
            await uploadEntityDocument(
              formData.entityDocuments.llpResolutionDoc,
              'llpResolutionDoc',
              'Resolution / LOA'
            );
            break;
          case "Trust / Society":
            await uploadEntityDocument(
              formData.entityDocuments.trustRegistrationCert,
              'trustRegistrationCert',
              'Registration Certificate'
            );
            await uploadEntityDocument(
              formData.entityDocuments.trustDeedDoc,
              'trustDeedDoc',
              'Trust Deed / Bye-laws'
            );
            break;
          case "Govt. / PSU / Local Body":
            await uploadEntityDocument(
              formData.entityDocuments.govOrder,
              'govOrder',
              'Government Order / Office Order'
            );
            break;
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
        const baseData: any = {
            entity_type: formData.entityType,
            entity_name: formData.entityName,
            first_name: formData.firstName,
            middle_name: formData.middleName || null,
            last_name: formData.lastName,
          user_id: formData.userId,
          role: 'Owner',
            email: formData.email,
            city: formData.city,
            pincode: formData.pincode,
            address: formData.address,
          gst_no: formData.gstNo || null,
            alternate_phone: formData.alternatePhone || null,
            pan: formData.pan || null,
            authorized_signatory_photo_url: authorizedSignatoryPhotoUrl,
            authorized_signatory_signature_url: authorizedSignatorySignatureUrl,
          pan_card_url: panCardUrl,
          letterhead_url: letterheadUrl,
            declaration_accepted: formData.acceptDeclaration,
            status: 'pending'
        };

        // Add entity-specific fields and document URLs
        switch (formData.entityType) {
          case "Proprietorship / Individual":
            baseData.full_name_proprietor = formData.fullNameProprietor;
            baseData.residential_address = formData.residentialAddress;
            baseData.individual_utility_url = entityDocumentUrls.individualUtility || null;
            break;
          case "Partnership Firm":
            baseData.firm_registration_no = formData.firmRegistrationNo;
            baseData.partnership_registration_date = formData.partnershipRegistrationDate;
            baseData.number_of_partners = formData.numberOfPartners;
            baseData.partnership_deed_url = entityDocumentUrls.partnershipDeed || null;
            baseData.partnership_cert_url = entityDocumentUrls.partnershipCert || null;
            break;
          case "Pvt. Ltd. / Ltd. Company":
            baseData.cin = formData.cin;
            baseData.roc_registration_date = formData.rocRegistrationDate;
            baseData.number_of_directors = formData.numberOfDirectors;
            baseData.company_incorporation_cert_url = entityDocumentUrls.companyIncorporationCert || null;
            baseData.company_moa_aoa_url = entityDocumentUrls.companyMoaAoa || null;
            baseData.company_board_resolution_url = entityDocumentUrls.companyBoardResolution || null;
            break;
          case "LLP":
            baseData.llpin = formData.llpin;
            baseData.llp_incorporation_date = formData.llpIncorporationDate;
            baseData.number_of_designated_partners = formData.numberOfDesignatedPartners;
            baseData.llp_certificate_url = entityDocumentUrls.llpCertificate || null;
            baseData.llp_agreement_url = entityDocumentUrls.llpAgreementDoc || null;
            baseData.llp_resolution_url = entityDocumentUrls.llpResolutionDoc || null;
            break;
          case "Trust / Society":
            baseData.trust_registration_no = formData.trustRegistrationNo;
            baseData.trust_registration_date = formData.trustRegistrationDate;
            baseData.number_of_trustees = formData.numberOfTrustees;
            baseData.trust_registration_cert_url = entityDocumentUrls.trustRegistrationCert || null;
            baseData.trust_deed_url = entityDocumentUrls.trustDeedDoc || null;
            break;
          case "Govt. / PSU / Local Body":
            baseData.department_name = formData.departmentName;
            baseData.gov_order_url = entityDocumentUrls.govOrder || null;
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
          role: 'Owner',
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
      
      // Redirect to landing page after 2 seconds
      setTimeout(() => {
        router.push('/');
      }, 2000);

    } catch (err) {
      console.error('Unexpected error:', err);
      setFormError("An unexpected error occurred. Please try again.");
      setIsSubmitting(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderEntitySpecificFields = () => {
    switch (formData.entityType) {
      case "Proprietorship / Individual":
        return (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
              <label className="block font-medium text-black mb-1">GSTIN No. <span className="text-red-600 font-bold">*</span></label>
                <input
                value={formData.gstNo}
                onChange={(e) => handleInputChange("gstNo", e.target.value.toUpperCase())}
                onBlur={(e) => validateField("gstNo", e.target.value.trim().toUpperCase() || "")}
                  className="border rounded-lg px-3 py-2 h-10 w-full text-black focus:ring-2 focus:ring-emerald-500 outline-none"
                  placeholder="15-character GSTIN"
                  maxLength={15}
                />
              {errors.gstNo && <p className="text-red-600 text-sm mt-1">{errors.gstNo}</p>}
              </div>
              <div>
                <label className="block font-medium text-black mb-1">
                  Full Name of Proprietor <span className="text-red-500">*</span>
                </label>
                <input
                value={formData.fullNameProprietor}
                onChange={(e) => handleInputChange("fullNameProprietor", e.target.value)}
                  className="border rounded-lg px-3 py-2 h-10 w-full text-black focus:ring-2 focus:ring-emerald-500 outline-none"
                  placeholder="Name as per PAN / Aadhaar"
                />
                {errors.fullNameProprietor && (
                <p className="text-red-600 text-sm mt-1">{errors.fullNameProprietor}</p>
              )}
            </div>
          </div>
        );

      case "Partnership Firm":
        return (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
              <label className="block font-medium text-black mb-1">GSTIN No. <span className="text-red-600 font-bold">*</span></label>
                <input
                value={formData.gstNo}
                onChange={(e) => handleInputChange("gstNo", e.target.value.toUpperCase())}
                onBlur={(e) => validateField("gstNo", e.target.value.trim().toUpperCase() || "")}
                  className="border rounded-lg px-3 py-2 h-10 w-full text-black focus:ring-2 focus:ring-emerald-500 outline-none"
                  placeholder="15-character GSTIN"
                  maxLength={15}
                />
              {errors.gstNo && <p className="text-red-600 text-sm mt-1">{errors.gstNo}</p>}
              </div>
              <div>
                <label className="block font-medium text-black mb-1">
                Firm Registration No. <span className="text-red-600 font-bold">*</span>
                </label>
                <input
                value={formData.firmRegistrationNo}
                onChange={(e) => handleInputChange("firmRegistrationNo", e.target.value)}
                onBlur={(e) => validateField("firmRegistrationNo", e.target.value.trim() || "")}
                  className="border rounded-lg px-3 py-2 h-10 w-full text-black focus:ring-2 focus:ring-emerald-500 outline-none"
                  placeholder="As per Registrar of Firms"
                />
                {errors.firmRegistrationNo && (
                <p className="text-red-600 text-sm mt-1">{errors.firmRegistrationNo}</p>
                )}
              </div>
              <div>
              <label className="block font-medium text-black mb-1">
                Date of Registration <span className="text-red-600 font-bold">*</span>
              </label>
                <input
                  type="date"
                value={formData.partnershipRegistrationDate}
                onChange={(e) => {
                  const value = e.target.value;
                  handleInputChange("partnershipRegistrationDate", value);
                }}
                onBlur={(e) => validateField("partnershipRegistrationDate", e.target.value.trim() || "")}
                  className="border rounded-lg px-3 py-2 h-10 w-full text-black focus:ring-2 focus:ring-emerald-500 outline-none"
                />
                {errors.partnershipRegistrationDate && (
                <p className="text-red-600 text-sm mt-1">{errors.partnershipRegistrationDate}</p>
                )}
              </div>
              <div>
              <label className="block font-medium text-black mb-1">
                Number of Partners <span className="text-red-600 font-bold">*</span>
              </label>
                <input
                  type="number"
                min="2"
                value={formData.numberOfPartners}
                onChange={(e) => {
                  const value = e.target.value;
                  // Allow empty value or any numeric input while typing
                  if (value === "" || !isNaN(Number(value))) {
                    handleInputChange("numberOfPartners", value);
                  }
                }}
                onBlur={(e) => validateField("numberOfPartners", e.target.value.trim() || "")}
                  className="border rounded-lg px-3 py-2 h-10 w-full text-black focus:ring-2 focus:ring-emerald-500 outline-none"
                  placeholder="Total partners"
                />
              {errors.numberOfPartners && (
                <p className="text-red-600 text-sm mt-1">{errors.numberOfPartners}</p>
              )}
            </div>
          </div>
        );

      case "Pvt. Ltd. / Ltd. Company":
        return (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
              <label className="block font-medium text-black mb-1">GSTIN No. <span className="text-red-600 font-bold">*</span></label>
                <input
                value={formData.gstNo}
                onChange={(e) => handleInputChange("gstNo", e.target.value.toUpperCase())}
                onBlur={(e) => validateField("gstNo", e.target.value.trim().toUpperCase() || "")}
                  className="border rounded-lg px-3 py-2 h-10 w-full text-black focus:ring-2 focus:ring-emerald-500 outline-none"
                  placeholder="15-character GSTIN"
                  maxLength={15}
                />
              {errors.gstNo && <p className="text-red-600 text-sm mt-1">{errors.gstNo}</p>}
              </div>
              <div>
                <label className="block font-medium text-black mb-1">
                  CIN (Corporate Identification Number) <span className="text-red-600 font-bold">*</span>
                </label>
                <input
                value={formData.cin}
                onChange={(e) => handleInputChange("cin", e.target.value.toUpperCase().replace(/\s/g, ""))}
                onBlur={(e) => validateField("cin", e.target.value.trim().toUpperCase().replace(/\s/g, "") || "")}
                  className="border rounded-lg px-3 py-2 h-10 w-full text-black focus:ring-2 focus:ring-emerald-500 outline-none"
                  placeholder="L12345MH2019ABC123456"
                  maxLength={21}
                />
              {errors.cin && <p className="text-red-600 text-sm mt-1">{errors.cin}</p>}
              {!errors.cin && formData.cin && formData.cin.length > 0 && formData.cin.length !== 21 && (
                  <p className="text-xs text-red-600 mt-1">
                    Enter valid CIN (21 characters: L/U + 5 digits + 2 letters + 4 digits + 3 alphanumeric + 6 alphanumeric)
                  </p>
                )}
              </div>
              <div>
                <label className="block font-medium text-black mb-1">
                  ROC Registration Date <span className="text-red-600 font-bold">*</span>
                </label>
                  <input
                    type="date"
                value={formData.rocRegistrationDate}
                onChange={(e) => {
                  const value = e.target.value;
                  handleInputChange("rocRegistrationDate", value);
                }}
                onBlur={(e) => validateField("rocRegistrationDate", e.target.value.trim() || "")}
                className="border rounded-lg px-3 py-2 h-10 w-full text-black focus:ring-2 focus:ring-emerald-500 outline-none"
                  />
                  {errors.rocRegistrationDate && (
                <p className="text-red-600 text-sm mt-1">{errors.rocRegistrationDate}</p>
              )}
                </div>
              <div>
                <label className="block font-medium text-black mb-1">
                  Number of Directors <span className="text-red-600 font-bold">*</span>
                </label>
                <input
                  type="number"
                min="2"
                value={formData.numberOfDirectors}
                onChange={(e) => {
                  const value = e.target.value;
                  // Allow empty value or any numeric input while typing
                  if (value === "" || !isNaN(Number(value))) {
                    handleInputChange("numberOfDirectors", value);
                  }
                }}
                onBlur={(e) => validateField("numberOfDirectors", e.target.value.trim() || "")}
                  className="border rounded-lg px-3 py-2 h-10 w-full text-black focus:ring-2 focus:ring-emerald-500 outline-none"
                  placeholder="Total directors"
                />
              {errors.numberOfDirectors && (
                <p className="text-red-600 text-sm mt-1">{errors.numberOfDirectors}</p>
              )}
            </div>
          </div>
        );

      case "LLP":
        return (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
              <label className="block font-medium text-black mb-1">GSTIN No. <span className="text-red-600 font-bold">*</span></label>
                <input
                value={formData.gstNo}
                onChange={(e) => handleInputChange("gstNo", e.target.value.toUpperCase())}
                onBlur={(e) => validateField("gstNo", e.target.value.trim().toUpperCase() || "")}
                  className="border rounded-lg px-3 py-2 h-10 w-full text-black focus:ring-2 focus:ring-emerald-500 outline-none"
                  placeholder="15-character GSTIN"
                  maxLength={15}
                />
              {errors.gstNo && <p className="text-red-600 text-sm mt-1">{errors.gstNo}</p>}
              </div>
              <div>
                <label className="block font-medium text-black mb-1">
                  LLPIN (LLP Identification No.) <span className="text-red-600 font-bold">*</span>
                </label>
                <input
                value={formData.llpin}
                onChange={(e) => {
                  let value = e.target.value.toUpperCase();
                  // Allow only alphanumeric and hyphen, enforce format
                  value = value.replace(/[^A-Z0-9-]/g, '');
                  // Limit length to 8 characters (AAA-XXXX)
                  if (value.length > 8) value = value.slice(0, 8);
                  handleInputChange("llpin", value);
                }}
                onBlur={(e) => validateField("llpin", e.target.value.trim().toUpperCase() || "")}
                  className="border rounded-lg px-3 py-2 h-10 w-full text-black focus:ring-2 focus:ring-emerald-500 outline-none"
                  placeholder="AAX-1234"
                  maxLength={8}
                />
                {errors.llpin && <p className="text-red-600 text-sm mt-1">{errors.llpin}</p>}
              </div>
              <div>
                <label className="block font-medium text-black mb-1">
                  Date of Incorporation <span className="text-red-600 font-bold">*</span>
                </label>
                <input
                  type="date"
                value={formData.llpIncorporationDate}
                onChange={(e) => {
                  const value = e.target.value;
                  handleInputChange("llpIncorporationDate", value);
                }}
                onBlur={(e) => validateField("llpIncorporationDate", e.target.value.trim() || "")}
                  className="border rounded-lg px-3 py-2 h-10 w-full text-black focus:ring-2 focus:ring-emerald-500 outline-none"
                />
                {errors.llpIncorporationDate && (
                <p className="text-red-600 text-sm mt-1">{errors.llpIncorporationDate}</p>
                )}
              </div>
              <div>
                <label className="block font-medium text-black mb-1">
                  Number of Designated Partners <span className="text-red-600 font-bold">*</span>
                </label>
                <input
                  type="number"
                min="2"
                value={formData.numberOfDesignatedPartners}
                onChange={(e) => {
                  const value = e.target.value;
                  // Allow empty value or any numeric input while typing
                  if (value === "" || !isNaN(Number(value))) {
                    handleInputChange("numberOfDesignatedPartners", value);
                  }
                }}
                onBlur={(e) => validateField("numberOfDesignatedPartners", e.target.value.trim() || "")}
                  className="border rounded-lg px-3 py-2 h-10 w-full text-black focus:ring-2 focus:ring-emerald-500 outline-none"
                  placeholder="Total designated partners"
                />
                {errors.numberOfDesignatedPartners && (
                <p className="text-red-600 text-sm mt-1">{errors.numberOfDesignatedPartners}</p>
                )}
            </div>
          </div>
        );

      case "Trust / Society":
        return (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
              <label className="block font-medium text-black mb-1">GSTIN No. <span className="text-red-600 font-bold">*</span></label>
                <input
                value={formData.gstNo}
                onChange={(e) => handleInputChange("gstNo", e.target.value.toUpperCase())}
                onBlur={(e) => validateField("gstNo", e.target.value.trim().toUpperCase() || "")}
                  className="border rounded-lg px-3 py-2 h-10 w-full text-black focus:ring-2 focus:ring-emerald-500 outline-none"
                  placeholder="15-character GSTIN"
                  maxLength={15}
                />
              {errors.gstNo && <p className="text-red-600 text-sm mt-1">{errors.gstNo}</p>}
              </div>
              <div>
                <label className="block font-medium text-black mb-1">
                  Registration No. <span className="text-red-600 font-bold">*</span>
                </label>
                <input
                value={formData.trustRegistrationNo}
                onChange={(e) => handleInputChange("trustRegistrationNo", e.target.value)}
                onBlur={(e) => validateField("trustRegistrationNo", e.target.value.trim() || "")}
                  className="border rounded-lg px-3 py-2 h-10 w-full text-black focus:ring-2 focus:ring-emerald-500 outline-none"
                  placeholder="As per Charity Commissioner / Registrar"
                />
                {errors.trustRegistrationNo && (
                <p className="text-red-600 text-sm mt-1">{errors.trustRegistrationNo}</p>
                )}
              </div>
              <div>
                <label className="block font-medium text-black mb-1">
                  Date of Registration <span className="text-red-600 font-bold">*</span>
                </label>
                <input
                  type="date"
                value={formData.trustRegistrationDate}
                onChange={(e) => {
                  const value = e.target.value;
                  handleInputChange("trustRegistrationDate", value);
                }}
                onBlur={(e) => validateField("trustRegistrationDate", e.target.value.trim() || "")}
                  className="border rounded-lg px-3 py-2 h-10 w-full text-black focus:ring-2 focus:ring-emerald-500 outline-none"
                />
                {errors.trustRegistrationDate && (
                <p className="text-red-600 text-sm mt-1">{errors.trustRegistrationDate}</p>
                )}
              </div>
              <div>
                <label className="block font-medium text-black mb-1">
                  Number of Trustees <span className="text-red-600 font-bold">*</span>
                </label>
                <input
                  type="number"
                min="2"
                value={formData.numberOfTrustees}
                onChange={(e) => {
                  const value = e.target.value;
                  // Allow empty value or any numeric input while typing
                  if (value === "" || !isNaN(Number(value))) {
                    handleInputChange("numberOfTrustees", value);
                  }
                }}
                onBlur={(e) => validateField("numberOfTrustees", e.target.value.trim() || "")}
                className="border rounded-lg px-3 py-2 h-10 w-full text-black focus:ring-2 focus:ring-emerald-500 outline-none"
                  placeholder="Total trustees"
                />
              {errors.numberOfTrustees && (
                <p className="text-red-600 text-sm mt-1">{errors.numberOfTrustees}</p>
              )}
            </div>
          </div>
        );

      case "Govt. / PSU / Local Body":
        return (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
              <label className="block font-medium text-black mb-1">GSTIN No. <span className="text-red-600 font-bold">*</span></label>
                <input
                value={formData.gstNo}
                onChange={(e) => handleInputChange("gstNo", e.target.value.toUpperCase())}
                onBlur={(e) => validateField("gstNo", e.target.value.trim().toUpperCase() || "")}
                  className="border rounded-lg px-3 py-2 h-10 w-full text-black focus:ring-2 focus:ring-emerald-500 outline-none"
                  placeholder="15-character GSTIN"
                  maxLength={15}
                />
              {errors.gstNo && <p className="text-red-600 text-sm mt-1">{errors.gstNo}</p>}
              </div>
              <div>
                <label className="block font-medium text-black mb-1">
                  Department / Undertaking Name <span className="text-red-600 font-bold">*</span>
                </label>
                <input
                value={formData.departmentName}
                onChange={(e) => handleInputChange("departmentName", e.target.value)}
                onBlur={(e) => validateField("departmentName", e.target.value.trim() || "")}
                  className="border rounded-lg px-3 py-2 h-10 w-full text-black focus:ring-2 focus:ring-emerald-500 outline-none"
                  placeholder="e.g. MHADA / MMRDA / BMC / XYZ Dept."
                />
                {errors.departmentName && (
                <p className="text-red-600 text-sm mt-1">{errors.departmentName}</p>
              )}
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <>
    <div className="flex gap-6 max-w-6xl mx-auto p-6">
      {/* Sidebar Navigation */}
      <div className="w-72 flex-shrink-0">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sticky top-6">
          {/* Title */}
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-gray-900 uppercase tracking-wide">{title.toUpperCase()}</h2>
          <button
            onClick={() => router.push("/")}
              className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              title="Back to Home"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
      </div>

          {/* Submit Button */}
          <button
            type="button"
            onClick={handleSubmitForm}
            disabled={isSubmitting}
            className="w-full mb-6 py-3 bg-emerald-600 text-white rounded-lg font-semibold hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
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
          <nav className="space-y-1">
          {sections.map((section) => {
            const isActive = activeSection === section.id;
              const sectionIcons: Record<string, React.ReactNode> = {
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
              onClick={() => scrollToSection(section.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-all duration-200 ${
                  isActive
                      ? "bg-emerald-50 text-emerald-700 border-l-4 border-emerald-600 font-medium"
                      : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                  }`}
                >
                  <span className={isActive ? "text-emerald-600" : "text-gray-400"}>
                    {sectionIcons[section.id]}
                  </span>
                  <span className="text-sm">{section.label}</span>
                  <svg className={`w-4 h-4 ml-auto transition-transform ${isActive ? "text-emerald-600" : "text-gray-300"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
        <div className="mb-6 bg-red-50 border-l-4 border-red-500 p-4 rounded-r-lg">
          <p className="text-red-700 text-sm">
            <span className="font-semibold">Note:</span> Please fill all required fields marked with <span className="text-red-600 font-bold">*</span> before submitting the registration form.
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

        <div className="space-y-6">
            {/* Basic Details Section */}
          <div id="section-basic-details" className={`scroll-mt-6 bg-white border border-gray-200 rounded-xl p-6 transition-all duration-300 ${activeSection === "section-basic-details" ? "shadow-lg ring-2 ring-emerald-500 ring-opacity-20" : "shadow-sm"}`}>
            <div 
              className="flex items-center gap-3 mb-2 cursor-pointer hover:text-emerald-600 transition-colors"
              onClick={() => scrollToSection("section-basic-details")}
            >
              <div className="w-8 h-8 flex items-center justify-center bg-emerald-100 rounded-lg">
                <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                    Entity Type <span className="text-red-600 font-bold">*</span>
            </label>
              <select
                    value={formData.entityType}
                    onChange={(e) => handleInputChange("entityType", e.target.value)}
                className="border rounded-lg px-3 py-2 h-10 w-full text-black focus:ring-2 focus:ring-emerald-500 outline-none"
              >
                <option value="">Select Entity Type</option>
                {ENTITY_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
                  {errors.entityType && (
                    <p className="text-xs text-red-600 mt-1">{errors.entityType}</p>
                  )}
        </div>

                <div>
                  <label className="block font-medium text-black mb-1">
                    Entity Name <span className="text-red-600 font-bold">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.entityName}
                    onChange={(e) => handleInputChange("entityName", e.target.value)}
                    className="border rounded-lg px-3 py-2 h-10 w-full text-black focus:ring-2 focus:ring-emerald-500 outline-none"
                    placeholder="e.g. M/s. XYZ Developers LLP"
                  />
                  {errors.entityName && (
                    <p className="text-xs text-red-600 mt-1">{errors.entityName}</p>
                  )}
      </div>

                {/* Row 2 - Name Fields */}
            <div>
              <label className="block font-medium text-black mb-1">
                    First Name <span className="text-red-600 font-bold">*</span>
              </label>
              <input
                    type="text"
                    value={formData.firstName}
                    onChange={(e) => handleInputChange("firstName", e.target.value)}
                className="border rounded-lg px-3 py-2 h-10 w-full text-black focus:ring-2 focus:ring-emerald-500 outline-none"
                    placeholder="Enter first name"
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
                    type="text"
                    value={formData.middleName}
                    onChange={(e) => handleInputChange("middleName", e.target.value)}
              className="border rounded-lg px-3 py-2 h-10 w-full text-black focus:ring-2 focus:ring-emerald-500 outline-none"
                    placeholder="Enter middle name"
            />
                  {errors.middleName && (
                    <p className="text-xs text-red-600 mt-1">{errors.middleName}</p>
                  )}
          </div>

            <div>
              <label className="block font-medium text-black mb-1">
                    Last Name <span className="text-red-600 font-bold">*</span>
              </label>
              <input
                    type="text"
                    value={formData.lastName}
                    onChange={(e) => handleInputChange("lastName", e.target.value)}
                className="border rounded-lg px-3 py-2 h-10 w-full text-black focus:ring-2 focus:ring-emerald-500 outline-none"
                    placeholder="Enter last name"
              />
                  {errors.lastName && (
                    <p className="text-xs text-red-600 mt-1">{errors.lastName}</p>
                  )}
            </div>

            <div>
              <label className="block font-medium text-black mb-1">
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
                      className={`border rounded-lg px-3 py-2 h-10 flex-1 text-black focus:ring-2 focus:ring-emerald-500 outline-none ${isEmailVerified ? 'bg-green-50 border-green-300' : ''}`}
                      placeholder="Enter email address"
                      disabled={isEmailVerified}
                    />
                    {isEmailVerified ? (
                      <div className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg font-medium">
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                        Verified
                      </div>
                    ) : (
                    <button
                      type="button"
                        onClick={() => {
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
                      className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-2 rounded-lg font-medium hover:bg-emerald-100 transition whitespace-nowrap"
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
                  <label className="block font-medium text-black mb-1">
                    City <span className="text-red-600 font-bold">*</span>
                  </label>
                  <input
                    value={formData.city}
                    onChange={(e) => handleInputChange("city", e.target.value)}
                    className="border rounded-lg px-3 py-2 h-10 w-full text-black focus:ring-2 focus:ring-emerald-500 outline-none"
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
                  <div className="flex gap-2">
                    <input
                      value={formData.alternatePhone}
                      onChange={(e) => {
                        handleInputChange("alternatePhone", e.target.value);
                        // Reset verification if phone number changes
                        if (isPhoneVerified) setIsPhoneVerified(false);
                      }}
                      className={`border rounded-lg px-3 py-2 h-10 flex-1 text-black focus:ring-2 focus:ring-emerald-500 outline-none ${isPhoneVerified ? 'bg-green-50 border-green-300' : ''}`}
                      placeholder="Enter 10-digit phone number"
                      disabled={isPhoneVerified}
                    />
                    {isPhoneVerified ? (
                      <div className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg font-medium">
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                        Verified
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          if (!formData.alternatePhone || formData.alternatePhone.trim() === '') {
                            setErrors(prev => ({ ...prev, alternatePhone: "Phone number is required" }));
                            return;
                          }
                          if (formData.alternatePhone.length === 10) {
                            setShowPhoneOTPModal(true);
                          } else {
                            setErrors(prev => ({ ...prev, alternatePhone: "Please enter a valid 10-digit phone number" }));
                          }
                        }}
                        className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-2 rounded-lg font-medium hover:bg-emerald-100 transition whitespace-nowrap"
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
            <label className="block font-medium text-black mb-1">
                    Pincode <span className="text-red-600 font-bold">*</span>
            </label>
                  <input
                    value={formData.pincode}
                    onChange={(e) => handleInputChange("pincode", e.target.value)}
                    className="border rounded-lg px-3 py-2 h-10 w-full text-black focus:ring-2 focus:ring-emerald-500 outline-none"
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
                className="border rounded-lg px-3 py-2 h-10 w-full text-black focus:ring-2 focus:ring-emerald-500 outline-none"
                placeholder="ABCDE1234F"
              />
                  {errors.pan && (
                    <p className="text-xs text-red-600 mt-1">{errors.pan}</p>
                  )}
        </div>

                {/* Row 5 */}
                <div className="md:col-span-2">
                  <label className="block font-medium text-black mb-1">
                    Address <span className="text-red-600 font-bold">*</span>
                  </label>
                  <input
                    value={formData.address}
                    onChange={(e) => handleInputChange("address", e.target.value)}
                    className="border rounded-lg px-3 py-2 h-10 w-full text-black focus:ring-2 focus:ring-emerald-500 outline-none"
                    placeholder="Office address"
                  />
                  {errors.address && (
                    <p className="text-xs text-red-600 mt-1">{errors.address}</p>
                  )}
        </div>
      </div>
    </div>

        {/* Registration Numbers Section - Dynamic based on Entity Type */}
            <div id="section-registration" className={`scroll-mt-6 bg-white border border-gray-200 rounded-xl p-6 transition-all duration-300 shadow-sm ${activeSection === "section-registration" ? "shadow-lg ring-2 ring-emerald-500 ring-opacity-20" : ""}`}>
              <div 
                className="flex items-center gap-3 mb-2 cursor-pointer hover:text-emerald-600 transition-colors"
                onClick={() => scrollToSection("section-registration")}
              >
                <div className="w-8 h-8 flex items-center justify-center bg-emerald-100 rounded-lg">
                  <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-black">
                  Registration Numbers
                </h3>
              </div>
              <p className="text-sm text-gray-600 mb-4 ml-11">
                {formData.entityType ? `Enter credentials for ${formData.entityType}` : "Select a consultant type first"}
              </p>

              {!formData.entityType && (
                <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-800 text-sm">
                  ⚠️ Please select an Entity Type in Basic Details to see the required registration fields.
    </div>
              )}

              {formData.entityType && renderEntitySpecificFields()}
            </div>

        {/* Documents Upload Section - Dynamic based on Entity Type */}
            <div id="section-documents" className={`scroll-mt-6 bg-white border border-gray-200 rounded-xl p-6 transition-all duration-300 shadow-sm ${activeSection === "section-documents" ? "shadow-lg ring-2 ring-emerald-500 ring-opacity-20" : ""}`}>
              <div 
                className="flex items-center gap-3 mb-2 cursor-pointer hover:text-emerald-600 transition-colors"
                onClick={() => scrollToSection("section-documents")}
              >
                <div className="w-8 h-8 flex items-center justify-center bg-emerald-100 rounded-lg">
                  <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-black">Documents Upload</h3>
              </div>
              <p className="text-sm text-gray-600 mb-4 ml-11">
                {formData.entityType ? `Upload documents for ${formData.entityType}` : "Select an Entity Type first"}
              </p>

              {!formData.entityType && (
                <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-800 text-sm">
                  ⚠️ Please select an Entity Type in Basic Details to see the required documents.
                </div>
              )}

              {/* Common Documents - PAN Card for all entity types */}
              {formData.entityType && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                  <div>
                    <label className="block font-medium text-black mb-1">Authorized Signatory Photograph <span className="text-red-600 font-bold">*</span></label>
                    <input
                      type="file"
                      accept=".gif,.jpg,.jpeg,.png,.bmp"
                      onChange={(e) => handleFileChange("authorizedSignatoryPhotoFile", e.target.files?.[0] || null)}
                      className="border rounded-lg px-3 py-2 w-full text-black focus:ring-2 focus:ring-emerald-500 outline-none"
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
                    <label className="block font-medium text-black mb-1">Authorized Signatory Signature <span className="text-red-600 font-bold">*</span></label>
                    <input
                      type="file"
                      accept=".gif,.jpg,.jpeg,.png,.bmp"
                      onChange={(e) => handleFileChange("authorizedSignatorySignatureFile", e.target.files?.[0] || null)}
                      className="border rounded-lg px-3 py-2 w-full text-black focus:ring-2 focus:ring-emerald-500 outline-none"
                    />
                    <p className="text-xs text-gray-500 mt-1">Only .GIF, .JPG, .PNG, .BMP (max 100x120px)</p>
                    {formData.authorizedSignatorySignatureFile && (
                      <p className="text-xs text-green-600 mt-1">✓ {formData.authorizedSignatorySignatureFile.name}</p>
                    )}
                    {errors.authorizedSignatorySignatureFile && (
                      <p className="text-xs text-red-600 mt-1">{errors.authorizedSignatorySignatureFile}</p>
                    )}
                  </div>
                  <div>
                    <label className="block font-medium text-black mb-1">PAN Card (Image) <span className="text-red-600 font-bold">*</span></label>
                    <input
                      type="file"
                      accept=".gif,.jpg,.jpeg,.png,.bmp"
                      onChange={(e) => handleFileChange("panCardFile", e.target.files?.[0] || null)}
                      className="border rounded-lg px-3 py-2 w-full text-black focus:ring-2 focus:ring-emerald-500 outline-none"
                    />
                    <p className="text-xs text-gray-500 mt-1">Only .GIF, .JPG, .PNG, .BMP</p>
                    {formData.panCardFile && (
                      <p className="text-xs text-green-600 mt-1">✓ {formData.panCardFile.name}</p>
                    )}
                    {errors.panCardFile && (
                      <p className="text-xs text-red-600 mt-1">{errors.panCardFile}</p>
                    )}
                  </div>

                  {/* Entity-specific documents */}
                  {docsForEntity.map((doc) => {
                    const fieldName = `entityDocuments.${doc.id}`;
                    const fieldError = errors[fieldName];

                    return (
                      <div key={doc.id}>
                        <label className="block font-medium text-black mb-1">
                          {doc.label} {doc.required && <span className="text-red-600 font-bold">*</span>}
                        </label>
                        <input
                          type="file"
                          accept={doc.accept || ".pdf,.jpg,.jpeg,.png"}
                          onChange={(e) => handleEntityDocumentChange(doc.id, e.target.files?.[0] || null)}
                          className="border rounded-lg px-3 py-2 w-full text-black focus:ring-2 focus:ring-emerald-500 outline-none"
                        />
                        {doc.accept === ".pdf" && (
                          <p className="text-xs text-gray-500 mt-1">Only .PDF</p>
                        )}
                        {formData.entityDocuments[doc.id] && (
                          <p className="text-xs text-green-600 mt-1">✓ {formData.entityDocuments[doc.id]?.name}</p>
                        )}
                        {fieldError && (
                          <p className="text-xs text-red-600 mt-1">{fieldError}</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {formData.entityType && (
                <p className="text-xs text-gray-500 mt-4">
                  Max 10MB per file. PDF files preferred for certificates.
                </p>
              )}
            </div>

            {/* Letterhead Upload Section */}
            <div id="section-letterhead" className={`scroll-mt-24 border rounded-lg p-6 bg-white transition-shadow duration-300 ${activeSection === "section-letterhead" ? "shadow-lg ring-2 ring-emerald-500 ring-opacity-20" : ""}`}>
          <div 
            className="flex items-center gap-3 mb-2 cursor-pointer hover:text-emerald-600 transition-colors"
                onClick={() => scrollToSection("section-letterhead")}
          >
            <div className="w-8 h-8 flex items-center justify-center bg-emerald-100 rounded-lg">
              <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-black">Letterhead</h3>
          </div>
          <p className="text-sm text-gray-600 mb-4 ml-11">
            Upload your letterhead PDF file. After successful upload, you will see a preview showing where it will be placed.
          </p>

          <div className="grid grid-cols-1 gap-4">
            <div>
              <label className="block font-medium text-black mb-1">Letterhead PDF <span className="text-red-600 font-bold">*</span></label>
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
                          <span className="text-emerald-600 font-medium">Click to upload</span> or drag and drop
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
        </div>

            {/* Login Setup Section */}
            <div id="section-login" className={`scroll-mt-6 bg-white border border-gray-200 rounded-xl p-6 transition-all duration-300 shadow-sm ${activeSection === "section-login" ? "shadow-lg ring-2 ring-emerald-500 ring-opacity-20" : ""}`}>
          <div 
            className="flex items-center gap-3 mb-2 cursor-pointer hover:text-emerald-600 transition-colors"
                onClick={() => scrollToSection("section-login")}
          >
            <div className="w-8 h-8 flex items-center justify-center bg-emerald-100 rounded-lg">
              <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
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
                User ID <span className="text-red-600 font-bold">*</span>
              </label>
              <input
                    type="text"
                    value={formData.userId}
                    onChange={(e) => handleInputChange("userId", e.target.value)}
                className="border rounded-lg px-3 py-2 h-10 w-full text-black focus:ring-2 focus:ring-emerald-500 outline-none"
                placeholder="Enter User ID"
              />
                  {errors.userId && (
                    <p className="text-xs text-red-600 mt-1">{errors.userId}</p>
                  )}
            </div>

            <div>
              <label className="block font-medium text-black mb-1">
                Password <span className="text-red-600 font-bold">*</span>
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={formData.password}
                  onChange={(e) => handleInputChange("password", e.target.value)}
                  className="border rounded-lg px-3 py-2 h-10 w-full pr-24 text-black focus:ring-2 focus:ring-emerald-500 outline-none"
                  placeholder="Create a strong password"
                />
                <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                  <button
                    type="button"
                    onClick={generateStrongPassword}
                    className="text-xs text-emerald-600 hover:text-emerald-700 font-medium px-2 py-1 rounded hover:bg-emerald-50 transition-colors focus:outline-none"
                    title="Generate strong password"
                  >
                    Generate
                  </button>
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
                  <label className="block font-medium text-black mb-1">
                    Confirm Password <span className="text-red-600 font-bold">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type={showConfirmPassword ? "text" : "password"}
                      value={formData.confirmPassword}
                      onChange={(e) => handleInputChange("confirmPassword", e.target.value)}
                      className="border rounded-lg px-3 py-2 h-10 w-full pr-10 text-black focus:ring-2 focus:ring-emerald-500 outline-none"
                      placeholder="Re-enter password"
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
            <div id="section-declaration" className={`scroll-mt-6 bg-white border border-gray-200 rounded-xl p-6 transition-all duration-300 shadow-sm ${activeSection === "section-declaration" ? "shadow-lg ring-2 ring-emerald-500 ring-opacity-20" : ""}`}>
          <div 
            className="flex items-center gap-3 mb-4 cursor-pointer hover:text-emerald-600 transition-colors"
                onClick={() => scrollToSection("section-declaration")}
          >
            <div className="w-8 h-8 flex items-center justify-center bg-emerald-100 rounded-lg">
              <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-black">
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

          <div className="flex justify-end mt-8 pt-6 border-t">
          <button
              type="button"
              onClick={handleSubmitForm}
              disabled={isSubmitting || submitSuccess}
              className={`px-10 py-2 rounded-lg font-medium shadow transition flex items-center gap-2
                ${isSubmitting || submitSuccess 
                  ? 'bg-gray-400 cursor-not-allowed' 
                  : 'bg-emerald-600 text-white hover:bg-emerald-700'}`}
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
        </div>
      </div>
    </div>

  {/* Image Modal - rendered via portal, same positioning as previous PDF modal */}
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
                  <div className="flex justify-between items-center p-6 border-b">
                    <div>
                      <h2 className="text-2xl font-bold text-black">
                        Letterhead Preview - Assigned Placement Demo
                      </h2>
                      <p className="text-sm text-gray-600 mt-1">
                        This is a demo showing where your letterhead will be placed in the system.
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        setIsPDFModalOpen(false);
                        if (letterheadPreviewUrl) {
                          setHasViewedLetterhead(true);
                        }
                      }}
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
                        className="relative w-full max-w-3xl mx-auto"
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

      {/* Email OTP Verification Modal - Testing with phone code */}
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

export default RegistrationForm;


