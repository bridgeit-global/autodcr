'use client';

import React, { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useForm } from "react-hook-form";
import { Camera, CheckCircle2, Clock, Eye, FilePenLine, ImageIcon, Loader2, Mail, MapPin, PenLine, User, X, XCircle } from "lucide-react";

type ProfileTab = "profile" | "address" | "notifications";
import { useUserMetadata } from "@/app/contexts/UserContext";
import { supabase } from "@/app/utils/supabase";
import { uploadFileIdempotent, cleanupOldFile } from "@/app/utils/fileUtils";
import Button from "@/app/components/ui/Button";
import {
  DEFAULT_MAIL_NOTIFICATION_PREFERENCES,
  getMailNotificationPreferences,
  getVisibleMailNotificationPhases,
  MAIL_NOTIFICATION_LABELS,
  mailNotificationPreferencesToMetadata,
  type MailNotificationPhase,
  type MailNotificationPreferences,
} from "@/app/utils/mailNotificationPreferences";
import {
  resolveAddressLinesWithCityPincode,
} from "@/app/utils/applicantRecordFields";

interface Props {
  open: boolean;
  onClose: () => void;
}

function ProfileSection({
  title,
  subtitle,
  icon,
  children,
}: {
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-start gap-3">
        {icon ? (
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-brand-blue">
            {icon}
          </span>
        ) : null}
        <div>
          <h3 className="text-base font-semibold text-brand-navy">{title}</h3>
          {subtitle ? <p className="mt-0.5 text-sm text-gray-500">{subtitle}</p> : null}
        </div>
      </div>
      {children}
    </section>
  );
}

function ProfileInfoField({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-gray-100 bg-surface px-3.5 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">{label}</p>
      <p className="mt-1 text-sm font-semibold text-gray-900">{value || "—"}</p>
    </div>
  );
}

const MAIL_PHASE_STYLE: Record<
  MailNotificationPhase,
  { icon: React.ReactNode; activeBg: string; iconBg: string; iconColor: string }
> = {
  draft: {
    icon: <FilePenLine className="h-4 w-4" />,
    activeBg: "bg-amber-50/90 border-amber-200 ring-1 ring-amber-100",
    iconBg: "bg-amber-100",
    iconColor: "text-amber-700",
  },
  in_process: {
    icon: <Clock className="h-4 w-4" />,
    activeBg: "bg-blue-50/90 border-brand-blue/30 ring-1 ring-blue-100",
    iconBg: "bg-blue-100",
    iconColor: "text-brand-blue",
  },
  approved: {
    icon: <CheckCircle2 className="h-4 w-4" />,
    activeBg: "bg-emerald-50/90 border-emerald-200 ring-1 ring-emerald-100",
    iconBg: "bg-emerald-100",
    iconColor: "text-emerald-700",
  },
  rejected: {
    icon: <XCircle className="h-4 w-4" />,
    activeBg: "bg-rose-50/90 border-rose-200 ring-1 ring-rose-100",
    iconBg: "bg-rose-100",
    iconColor: "text-rose-700",
  },
  signing: {
    icon: <PenLine className="h-4 w-4" />,
    activeBg: "bg-violet-50/90 border-violet-200 ring-1 ring-violet-100",
    iconBg: "bg-violet-100",
    iconColor: "text-violet-700",
  },
};

function MailNotificationToggle({
  phase,
  title,
  description,
  enabled,
  disabled,
  onToggle,
}: {
  phase: MailNotificationPhase;
  title: string;
  description: string;
  enabled: boolean;
  disabled?: boolean;
  onToggle: () => void;
}) {
  const style = MAIL_PHASE_STYLE[phase];

  return (
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
      aria-label={`${enabled ? "Disable" : "Enable"} ${title} notifications`}
      disabled={disabled}
      onClick={onToggle}
      className={[
        "group flex h-full min-h-[132px] flex-col rounded-2xl border p-4 text-left shadow-sm transition-all",
        enabled
          ? style.activeBg
          : "border-gray-200 bg-white hover:border-gray-300 hover:shadow-md",
        disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer focus:outline-none focus:ring-2 focus:ring-brand-blue focus:ring-offset-2",
      ].join(" ")}
    >
      <div className="mb-3 flex items-start justify-between gap-2">
        <span
          className={[
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-colors",
            enabled ? style.iconBg : "bg-gray-100 group-hover:bg-gray-200/70",
            enabled ? style.iconColor : "text-gray-400",
          ].join(" ")}
        >
          {style.icon}
        </span>

        <span
          aria-hidden
          className={[
            "relative inline-flex h-6 w-11 shrink-0 rounded-full transition-colors",
            enabled ? "bg-brand-blue" : "bg-gray-200 group-hover:bg-gray-300",
          ].join(" ")}
        >
          <span
            className={[
              "pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition",
              enabled ? "translate-x-5" : "translate-x-0.5",
              "mt-0.5",
            ].join(" ")}
          />
        </span>
      </div>

      <p className="text-sm font-semibold text-brand-navy">{title}</p>
      <p className="mt-1 line-clamp-3 flex-1 text-xs leading-relaxed text-gray-500">{description}</p>
    </button>
  );
}

type FormValues = {
  name: string;
  console: string;
  panNo: string;
  address: string;
  city: string;
  zip: string;
  email: string;
  mobile: string;
  nmaRegNumber: string;
};

const ProfileModal: React.FC<Props> = ({ open, onClose }) => {
  const { userMetadata, fetchUserMetadata } = useUserMetadata();
  const [userId, setUserId] = useState<string | null>(null);
  const [templateUploadError, setTemplateUploadError] = useState<string | null>(null);
  const [templateUploadSuccess, setTemplateUploadSuccess] = useState<string | null>(null);
  const [templateUploadBusy, setTemplateUploadBusy] = useState<Record<string, boolean>>({});

  const APPOINTMENT_TEMPLATE_TYPES = [
    "Architect",
    "Licensed Surveyor",
    "Structural Engineer",
    "Fire Safety Consultant",
    "M&E Consultant",
    "Plumber",
    "Parking Consultant",
    "Rainwater Consultant",
    "Site Supervisor",
    "Horticulturist",
  ] as const;
  type AppointmentTemplateType = (typeof APPOINTMENT_TEMPLATE_TYPES)[number];

  const [ownerHtmlTemplates, setOwnerHtmlTemplates] = useState<Record<string, string>>({});
  const [selectedAppointmentTemplateType, setSelectedAppointmentTemplateType] =
    useState<AppointmentTemplateType>("Architect");

  const TEMPLATE_BUCKET =
    process.env.NEXT_PUBLIC_TEMPLATE_BUCKET?.trim() || "consultant-documents";

  const appointmentTemplateTypeLabel = (t: AppointmentTemplateType): string => t;
  
  // Get registration label and value based on role and type
  const getRegistrationInfo = (): { label: string; value: string } => {
    if (!userMetadata) return { label: "NMA Reg Number:", value: "" };
    
    if (userMetadata.role === "Owner") {
      const entityType = userMetadata.entity_type;
      if (entityType === "Pvt. Ltd. / Ltd. Company") {
        return { label: "CIN Number:", value: userMetadata.cin || "" };
      } else if (entityType === "LLP") {
        return { label: "LLPIN Number:", value: userMetadata.llpin || "" };
      } else if (entityType === "Partnership Firm") {
        return { label: "Firm Registration No:", value: userMetadata.firm_registration_no || "" };
      } else if (entityType === "Trust / Society") {
        return { label: "Trust Registration No:", value: userMetadata.trust_registration_no || "" };
      } else if (entityType === "Govt. / PSU / Local Body") {
        return { label: "Trust Reg No:", value: userMetadata.trust_reg_no || "" };
      }
    } else if (userMetadata.role === "Consultant") {
      const consultantType = userMetadata.consultant_type;
      if (consultantType === "Architect") {
        return { label: "COA Reg No:", value: userMetadata.coa_reg_no || "" };
      } else if (consultantType === "Structural Engineer") {
        return { label: "Structural License No:", value: userMetadata.structural_license_no || "" };
      } else if (consultantType === "Licensed Surveyor") {
        return { label: "LBS License No:", value: userMetadata.lbs_license_no || "" };
      } else if (consultantType === "MEP Consultant") {
        return { label: "Electrical License No:", value: userMetadata.electrical_license_no || "" };
      } else if (consultantType === "Plumber") {
        return { label: "Plumber License No:", value: userMetadata.plumber_license_no || "" };
      } else if (consultantType === "Fire Consultant") {
        return { label: "Fire License No:", value: userMetadata.fire_license_no || "" };
      } else if (consultantType === "Landscape Consultant") {
        return { label: "Landscape License No:", value: userMetadata.landscape_license_no || "" };
      }
    }
    
    return { label: "NMA Reg Number:", value: "" };
  };
  const [profilePhoto, setProfilePhoto] = useState<string | null>(null);
  const [profilePhotoFile, setProfilePhotoFile] = useState<File | null>(null);
  const [originalPhotoUrl, setOriginalPhotoUrl] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<ProfileTab>("profile");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [letterheadFile, setLetterheadFile] = useState<File | null>(null);
  const [letterheadPreviewUrl, setLetterheadPreviewUrl] = useState<string | null>(null);
  const [letterheadUrl, setLetterheadUrl] = useState<string | null>(null);
  const [letterheadThumbnail, setLetterheadThumbnail] = useState<string | null>(null);
  const [originalLetterheadUrl, setOriginalLetterheadUrl] = useState<string | null>(null);
  const [originalLetterheadThumbnail, setOriginalLetterheadThumbnail] = useState<string | null>(null);
  const [isLetterheadModalOpen, setIsLetterheadModalOpen] = useState(false);
  const [showCloseConfirmation, setShowCloseConfirmation] = useState(false);
  const [mailNotificationPrefs, setMailNotificationPrefs] = useState<MailNotificationPreferences>(
    DEFAULT_MAIL_NOTIFICATION_PREFERENCES
  );
  const [originalMailNotificationPrefs, setOriginalMailNotificationPrefs] =
    useState<MailNotificationPreferences>(DEFAULT_MAIL_NOTIFICATION_PREFERENCES);
  const letterheadInputRef = useRef<HTMLInputElement>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    setValue,
    watch
  } = useForm<FormValues>();

  // Fetch user_id from localStorage
  useEffect(() => {
    if (open) {
      const storedMetadata = localStorage.getItem("userMetadata");
      if (storedMetadata) {
        try {
          const parsed = JSON.parse(storedMetadata);
          if (parsed?.user_id) {
            setUserId(parsed.user_id);
          }
        } catch (e) {
          console.error('Error parsing userMetadata from localStorage:', e);
        }
      }
    }
  }, [open]);

  // Populate form with user metadata when modal opens or metadata loads
  useEffect(() => {
    if (open && userMetadata) {
      // Format name: first_name middle_name last_name
      const lastName = userMetadata.last_name || "";
      const firstName = userMetadata.first_name || "";
      const middleName = userMetadata.middle_name || "";
      const fullName = [firstName, middleName, lastName].filter(Boolean).join(" ");

      setValue("name", fullName || "");
      setValue("console",  userMetadata.role == "Owner" ? userMetadata.entity_type : userMetadata.consultant_type );
      setValue("panNo", userMetadata.pan || "");
      setValue("address", userMetadata.address || "");
      setValue("city", userMetadata.city || "");
      setValue("zip", userMetadata.pincode || "");
      setValue("email", userMetadata.email || "");
      setValue("mobile", userMetadata.alternate_phone || userMetadata.mobile || "");
      setSelectedAppointmentTemplateType((prev) =>
        APPOINTMENT_TEMPLATE_TYPES.includes(prev) ? prev : "Architect"
      );
      const existingPhotoUrl = userMetadata.authorized_signatory_photo_url || null;
      setProfilePhoto(existingPhotoUrl);
      setOriginalPhotoUrl(existingPhotoUrl);
      
      // Set letterhead URL from metadata
      // Verify file exists before setting URL
      const existingLetterheadUrl = userMetadata.letterhead_url || null;
      if (existingLetterheadUrl) {
        // Verify file exists before using the URL
        verifyFileExists(existingLetterheadUrl).then((exists) => {
          if (exists) {
            setLetterheadUrl(existingLetterheadUrl);
            setOriginalLetterheadUrl(existingLetterheadUrl);
            // For images, use the URL directly as thumbnail
            setLetterheadThumbnail(existingLetterheadUrl);
            setOriginalLetterheadThumbnail(existingLetterheadUrl);
          } else {
            // File doesn't exist at that URL - try to find it by extracting path and reconstructing URL
            // URL format: https://...supabase.co/storage/v1/object/public/consultant-documents/...path
            const urlMatch = existingLetterheadUrl.match(/\/consultant-documents\/(.+)$/);
            if (urlMatch) {
              const pathInUrl = urlMatch[1];
              
              // Get current user to check if path needs userId prepended
              supabase.auth.getUser().then(({ data: { user } }) => {
                if (user?.id) {
                  // Check if path already starts with userId
                  if (!pathInUrl.startsWith(user.id + '/')) {
                    // Try reconstructing URL with userId if hash/filename matches pattern
                    const parts = pathInUrl.split('/');
                    if (parts.length >= 2 && parts[0] === 'letterheads') {
                      // Path might be missing userId - try adding it
                      const reconstructedPath = `${user.id}/${parts.join('/')}`;
                      const { data: urlData } = supabase.storage
                        .from('consultant-documents')
                        .getPublicUrl(reconstructedPath);
                      
                      verifyFileExists(urlData.publicUrl).then((reconstructedExists) => {
                        if (reconstructedExists) {
                          setLetterheadUrl(urlData.publicUrl);
                          setOriginalLetterheadUrl(urlData.publicUrl);
                        } else {
                          // File not found - clear URL
                          setLetterheadUrl(null);
                          setOriginalLetterheadUrl(null);
                          setLetterheadThumbnail(null);
                          setOriginalLetterheadThumbnail(null);
                        }
                      });
                    } else {
                      // Clear URL if we can't reconstruct
                      setLetterheadUrl(null);
                      setOriginalLetterheadUrl(null);
                      setLetterheadThumbnail(null);
                      setOriginalLetterheadThumbnail(null);
                    }
                  } else {
                    // Path already has userId but file doesn't exist - clear URL
                    setLetterheadUrl(null);
                    setOriginalLetterheadUrl(null);
                    setLetterheadThumbnail(null);
                    setOriginalLetterheadThumbnail(null);
                  }
                } else {
                  // Can't verify - clear URL
                  setLetterheadUrl(null);
                  setOriginalLetterheadUrl(null);
                  setLetterheadThumbnail(null);
                  setOriginalLetterheadThumbnail(null);
                }
              });
            } else {
              // Can't parse URL - clear it
              setLetterheadUrl(null);
              setOriginalLetterheadUrl(null);
              setLetterheadThumbnail(null);
              setOriginalLetterheadThumbnail(null);
            }
          }
        }).catch((error) => {
          console.error('Error verifying letterhead file existence:', error);
          // On error, clear URL to avoid showing broken preview
          setLetterheadUrl(null);
          setOriginalLetterheadUrl(null);
          setLetterheadThumbnail(null);
          setOriginalLetterheadThumbnail(null);
        });
      } else {
        setLetterheadUrl(null);
        setOriginalLetterheadUrl(null);
        setLetterheadThumbnail(null);
        setOriginalLetterheadThumbnail(null);
      }
      
      // Set NMA Reg Number based on role and type
      const registrationInfo = getRegistrationInfo();
      setValue("nmaRegNumber", registrationInfo.value);

      const prefs = getMailNotificationPreferences(userMetadata);
      setMailNotificationPrefs(prefs);
      setOriginalMailNotificationPrefs(prefs);
    }
  }, [open, userMetadata, setValue]);

  // Owner templates are stored ONLY in the projects table (per your requirement).
  // Load the latest mapping from any one of the owner's projects for display.
  useEffect(() => {
    if (!open) return;
    if (userMetadata?.role !== "Owner") return;

    const loadTemplatesFromProjects = async () => {
      try {
        const { data: userData, error: userErr } = await supabase.auth.getUser();
        if (userErr) throw userErr;
        const ownerId = userData.user?.id;
        if (!ownerId) return;

        const { data, error } = await supabase
          .from("projects")
          .select("owner_html_templates")
          .eq("user_id", ownerId)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (error) {
          const msg = String(error.message || "");
          if (msg.includes("owner_html_templates")) {
            setOwnerHtmlTemplates({});
            return;
          }
          throw error;
        }

        const map = (data as { owner_html_templates?: unknown } | null)?.owner_html_templates;
        if (map && typeof map === "object") {
          const obj = map as Record<string, unknown>;
          const next: Record<string, string> = {};
          Object.entries(obj).forEach(([k, v]) => {
            if (typeof v !== "string") return;
            next[k] = v;
          });
          // Keep only latest architect key.
          if (!next.Architect && typeof obj["Architect Licensed Surveyor"] === "string") {
            next.Architect = obj["Architect Licensed Surveyor"] as string;
          }
          delete next["Architect Licensed Surveyor"];
          setOwnerHtmlTemplates(next);
        }
        else setOwnerHtmlTemplates({});
      } catch {
        setOwnerHtmlTemplates({});
      }
    };

    void loadTemplatesFromProjects();
  }, [open, userMetadata?.role]);

  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
      setSubmitError(null);
      setSubmitSuccess(false);
      setActiveTab("profile");

      // Reset any unsaved changes when modal opens
      setLetterheadFile(null);
      setLetterheadPreviewUrl(null);
      setLetterheadUrl(originalLetterheadUrl);
      setLetterheadThumbnail(originalLetterheadThumbnail);
      setProfilePhotoFile(null);
      setProfilePhoto(originalPhotoUrl);
      setMailNotificationPrefs(originalMailNotificationPrefs);
      if (letterheadInputRef.current) {
        letterheadInputRef.current.value = "";
      }
      if (photoInputRef.current) {
        photoInputRef.current.value = "";
      }
    } else {
      document.body.style.overflow = "auto";
      reset();
      
      // Reset any unsaved changes when modal closes
      setLetterheadFile(null);
      setLetterheadPreviewUrl(null);
      setLetterheadUrl(originalLetterheadUrl);
      setLetterheadThumbnail(originalLetterheadThumbnail);
      setProfilePhotoFile(null);
      setProfilePhoto(originalPhotoUrl);
      setMailNotificationPrefs(originalMailNotificationPrefs);
      if (letterheadInputRef.current) {
        letterheadInputRef.current.value = "";
      }
      if (photoInputRef.current) {
        photoInputRef.current.value = "";
      }
    }

    return () => {
      document.body.style.overflow = "auto";
    };
  }, [open, reset, originalLetterheadUrl, originalLetterheadThumbnail]);

  // Clean up blob URLs when letterheadPreviewUrl changes or component unmounts
  useEffect(() => {
    return () => {
      if (letterheadPreviewUrl && letterheadPreviewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(letterheadPreviewUrl);
      }
    };
  }, [letterheadPreviewUrl]);

  const normalizeTemplateFileName = (templateType: string) =>
    `${templateType.replace(/\s+/g, "_").replace(/[^a-zA-Z0-9_]/g, "")}.html`;

  const uploadOwnerAppointmentTemplate = async (templateType: AppointmentTemplateType, file: File) => {
    setTemplateUploadError(null);
    setTemplateUploadSuccess(null);
    setTemplateUploadBusy((prev) => ({ ...prev, [templateType]: true }));

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      if (!accessToken) throw new Error("Session expired. Please log in again.");

      const { data: userData, error: userErr } = await supabase.auth.getUser();
      if (userErr) throw userErr;
      const ownerId = userData.user?.id;
      if (!ownerId) throw new Error("User not found. Please log in again.");

      if (!file.name.toLowerCase().endsWith(".html") && file.type !== "text/html") {
        throw new Error("Please upload a valid .html file.");
      }

      const objectPath = `owners/${ownerId}/appointment-letters/${normalizeTemplateFileName(templateType)}`;
      const { error: uploadError } = await supabase.storage
        .from(TEMPLATE_BUCKET)
        .upload(objectPath, file, {
          upsert: true,
          cacheControl: "3600",
          contentType: "text/html",
        });
      if (uploadError) throw uploadError;

      const nextMap = {
        ...ownerHtmlTemplates,
        [templateType]: objectPath,
      } as Record<string, string>;
      // Keep only latest architect key in projects table.
      delete nextMap["Architect Licensed Surveyor"];
      setOwnerHtmlTemplates(nextMap);

      // Sync to all projects created by this owner (reuse across projects).
      const { error: projectUpdateError } = await supabase
        .from("projects")
        .update({ owner_html_templates: nextMap })
        .eq("user_id", ownerId);
      if (projectUpdateError) {
        const msg = String(projectUpdateError.message || "");
        // If migration hasn't been applied yet, don't block uploads.
        if (!msg.includes("owner_html_templates")) {
          throw projectUpdateError;
        }
      }

      setTemplateUploadSuccess(`Uploaded template for "${templateType}".`);
      await fetchUserMetadata();
    } catch (e: any) {
      setTemplateUploadError(e?.message || "Failed to upload template.");
    } finally {
      setTemplateUploadBusy((prev) => ({ ...prev, [templateType]: false }));
    }
  };

  const mailPrefsDirty =
    mailNotificationPrefs.draft !== originalMailNotificationPrefs.draft ||
    mailNotificationPrefs.in_process !== originalMailNotificationPrefs.in_process ||
    mailNotificationPrefs.approved !== originalMailNotificationPrefs.approved ||
    mailNotificationPrefs.rejected !== originalMailNotificationPrefs.rejected ||
    mailNotificationPrefs.signing !== originalMailNotificationPrefs.signing;

  const hasUnsavedChanges = Boolean(profilePhotoFile || letterheadFile || mailPrefsDirty);

  const toggleMailNotification = (phase: MailNotificationPhase) => {
    setMailNotificationPrefs((prev) => ({ ...prev, [phase]: !prev[phase] }));
  };

  const onSubmit = async (data: FormValues) => {
    setIsSubmitting(true);
    setSubmitError(null);
    setSubmitSuccess(false);

    try {
      if (!userMetadata) {
        setSubmitError("User metadata not found. Please refresh and try again.");
        setIsSubmitting(false);
        return;
      }

      // Get current user ID from Supabase auth
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user || !user.id) {
        setSubmitError("User not found. Please log in again.");
        setIsSubmitting(false);
        return;
      }

      const userId = user.id;

      // Upload photo if a new file was selected
      let photoUrl = originalPhotoUrl;
      if (profilePhotoFile) {
        try {
          const photoUploadResult = await uploadFileIdempotent(
            profilePhotoFile,
            userId,
            'photo',
            supabase
          );
          
          if (!photoUploadResult) {
            throw new Error("Failed to upload photo. Upload returned no result.");
          }
          
          photoUrl = photoUploadResult.url;
          
          // Cleanup old photo if it's different
          if (originalPhotoUrl && originalPhotoUrl !== photoUrl) {
            // Extract path from URL (remove domain and bucket info)
            // URL format: https://...supabase.co/storage/v1/object/public/consultant-documents/userId/photos/hash.ext
            const urlParts = originalPhotoUrl.split('/consultant-documents/');
            if (urlParts.length > 1) {
              const oldPath = urlParts[1];
              await cleanupOldFile(oldPath, photoUploadResult.hash, supabase);
            }
          }
        } catch (uploadErr: any) {
          throw new Error(uploadErr.message || "Failed to upload photo. Please try again.");
        }
      }

      // Upload letterhead if a new file was selected
      let letterheadUrlResult = originalLetterheadUrl;
      if (letterheadFile) {
        try {
          const letterheadUploadResult = await uploadFileIdempotent(
            letterheadFile,
            userId,
            'letterhead',
            supabase
          );
          
          if (!letterheadUploadResult) {
            throw new Error("Failed to upload letterhead. Upload returned no result.");
          }
          
          // Verify the URL is valid (should end with .jpg, .jpeg, or .png)
          const validExtensions = ['.jpg', '.jpeg', '.png'];
          const hasValidExtension = validExtensions.some(ext => letterheadUploadResult.url?.toLowerCase().endsWith(ext));
          if (!letterheadUploadResult.url || !hasValidExtension) {
            console.error('Invalid letterhead URL returned:', letterheadUploadResult.url);
            throw new Error("Invalid letterhead URL returned from upload. Please try again.");
          }
          
          // Additional verification: Check if file is actually accessible via HTTP
          const fileExists = await verifyFileExists(letterheadUploadResult.url);
          if (!fileExists) {
            console.error('Upload reported success but file is not accessible:', letterheadUploadResult.url);
            throw new Error("File upload failed: File is not accessible after upload. Please try again.");
          }
          
          letterheadUrlResult = letterheadUploadResult.url;
          
          // Cleanup old letterhead if it's different
          if (originalLetterheadUrl && originalLetterheadUrl !== letterheadUrlResult) {
            // Extract path from URL (remove domain and bucket info)
            // URL format: https://...supabase.co/storage/v1/object/public/consultant-documents/userId/letterheads/hash.pdf
            const urlParts = originalLetterheadUrl.split('/consultant-documents/');
            if (urlParts.length > 1) {
              const oldPath = urlParts[1];
              await cleanupOldFile(oldPath, letterheadUploadResult.hash, supabase);
            }
          }
        } catch (uploadErr: any) {
          console.error('Letterhead upload error:', uploadErr);
          throw new Error(uploadErr.message || "Failed to upload letterhead. Please try again.");
        }
      }

      // Parse name into first_name, middle_name, last_name (first middle last)
      const nameParts = data.name.trim().split(/\s+/);
      let firstName = "";
      let middleName = "";
      let lastName = "";

      if (nameParts.length === 1) {
        firstName = nameParts[0];
      } else if (nameParts.length === 2) {
        firstName = nameParts[0];
        lastName = nameParts[1];
      } else if (nameParts.length >= 3) {
        firstName = nameParts[0];
        middleName = nameParts.slice(1, -1).join(" ");
        lastName = nameParts[nameParts.length - 1];
      }

      // Build updated metadata - merge with existing metadata
      const updatedMetadata = {
        ...userMetadata,
        // Update basic fields
        first_name: firstName || userMetadata.first_name,
        middle_name: middleName || userMetadata.middle_name || null,
        last_name: lastName || userMetadata.last_name,
        pan: data.panNo || userMetadata.pan,
        address: data.address || userMetadata.address,
        city: data.city || userMetadata.city,
        pincode: data.zip || userMetadata.pincode,
        email: data.email || userMetadata.email,
        alternate_phone: data.mobile || userMetadata.alternate_phone,
        // Update file URLs if new files were uploaded
        authorized_signatory_photo_url: photoUrl || userMetadata.authorized_signatory_photo_url,
        letterhead_url: letterheadUrlResult || userMetadata.letterhead_url,
        ...mailNotificationPreferencesToMetadata(mailNotificationPrefs),
      };

      // Get user role from metadata
      const userRole = userMetadata.role || "Owner";

      // Update user metadata via API
      const updateResponse = await fetch('/api/set-user-role', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_id: userId,
          role: userRole,
          metadata: updatedMetadata
        }),
      });

      if (!updateResponse.ok) {
        const errorData = await updateResponse.json();
        throw new Error(errorData.error || "Failed to update profile");
      }

      // Refresh user metadata in context
      await fetchUserMetadata();
      
      setSubmitSuccess(true);
      
      // Reload the page to reflect changes in all components
      setTimeout(() => {
        window.location.reload();
      }, 1500);
      
    } catch (err: any) {
      setSubmitError(err.message || "Failed to update profile. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate it's an image
      if (!file.type.startsWith('image/')) {
        setSubmitError("Please upload an image file for photo");
        if (photoInputRef.current) {
          photoInputRef.current.value = "";
        }
        return;
      }
      
      // Store file for later upload
      setProfilePhotoFile(file);
      
      // Create preview URL
      const reader = new FileReader();
      reader.onloadend = () => {
        setProfilePhoto(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  // Verify if a file exists at the given URL
  const verifyFileExists = async (fileUrl: string): Promise<boolean> => {
    if (!fileUrl || !fileUrl.startsWith('https://')) {
      return false;
    }
    
    try {
      const response = await fetch(fileUrl, { method: 'HEAD' });
      return response.ok;
    } catch (error) {
      console.error('Error verifying file existence:', error);
      return false;
    }
  };


  const handleLetterheadChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) {
      return;
    }

    const file = files[0];
    
    // Validate it's an image (JPG or PNG)
    const validImageTypes = ['image/jpeg', 'image/jpg', 'image/png'];
    const validExtensions = ['.jpg', '.jpeg', '.png'];
    const fileExtension = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));
    
    if (!validImageTypes.includes(file.type) && !validExtensions.includes(fileExtension)) {
      setSubmitError("Please upload a JPG or PNG image file for letterhead");
      if (letterheadInputRef.current) {
        letterheadInputRef.current.value = "";
      }
      return;
    }

    // Validate A4 size by checking image dimensions
    const tempUrl = URL.createObjectURL(file);
    const img = new Image();

    img.onload = () => {
      // A4 aspect ratio: 210mm x 297mm ≈ 0.707 (width/height)
      const aspectRatio = img.width / img.height;
      const a4Ratio = 210 / 297;
      const tolerance = 0.02; // ±2% (same strictness as registration screens)

      if (aspectRatio < a4Ratio - tolerance || aspectRatio > a4Ratio + tolerance) {
        setSubmitError("Letterhead image must be of A4 size (210mm x 297mm aspect ratio)");
        setLetterheadFile(null);
        setIsLetterheadModalOpen(false);
        URL.revokeObjectURL(tempUrl);
        if (letterheadInputRef.current) {
          letterheadInputRef.current.value = "";
        }
        return;
      }

      setSubmitError(null);
      setLetterheadFile(file);

      // Replace existing preview URL safely
      if (letterheadPreviewUrl) {
        URL.revokeObjectURL(letterheadPreviewUrl);
      }
      setLetterheadPreviewUrl(tempUrl);
      setLetterheadThumbnail(tempUrl);

      // Open preview modal when new valid file is selected
      setTimeout(() => setIsLetterheadModalOpen(true), 0);
    };

    img.onerror = () => {
      setSubmitError("Failed to load image");
      setLetterheadFile(null);
      setIsLetterheadModalOpen(false);
      URL.revokeObjectURL(tempUrl);
      if (letterheadInputRef.current) {
        letterheadInputRef.current.value = "";
      }
    };

    img.src = tempUrl;
  };

  const handleLetterheadThumbnailClick = () => {
    // Always prioritize blob preview URL (newly selected file) over Supabase URL (uploaded file)
    // Blob URLs are for files that haven't been uploaded yet
    const urlToShow = letterheadPreviewUrl || letterheadUrl;
    if (urlToShow) {
      setIsLetterheadModalOpen(true);
    }
  };

  const handleUploadPDFClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (letterheadInputRef.current && !isSubmitting) {
      letterheadInputRef.current.click();
    }
  };

  const handleCloseAttempt = () => {
    // If there are unsaved file uploads or preference changes, show confirmation dialog
    if (hasUnsavedChanges) {
      setShowCloseConfirmation(true);
    } else {
      // No unsaved changes, close directly
      onClose();
    }
  };

  const handleConfirmClose = () => {
    // User confirmed, close the modal
    setShowCloseConfirmation(false);
    onClose();
  };

  const handleCancelClose = () => {
    // User cancelled, just hide the confirmation dialog
    setShowCloseConfirmation(false);
  };

  const handleCloseLetterheadModal = () => {
    setIsLetterheadModalOpen(false);
    // Clean up preview URL when closing (but keep file for upload later)
  };

  // Clean up object URLs on unmount
  useEffect(() => {
    return () => {
      if (letterheadPreviewUrl) {
        URL.revokeObjectURL(letterheadPreviewUrl);
      }
    };
  }, [letterheadPreviewUrl]);

  if (!open) return null;

  const displayName =
    watch("name") ||
    (userMetadata?.first_name && userMetadata?.last_name
      ? `${userMetadata.first_name} ${userMetadata.last_name}`.trim()
      : "User Name");

  const roleLabel = watch("console") || userMetadata?.role || "Role";
  const registrationInfo = getRegistrationInfo();

  const addressDisplay = (() => {
    const line1 = String(userMetadata?.address_line1 || userMetadata?.addressLine1 || "").trim();
    const line2 = String(userMetadata?.address_line2 || userMetadata?.addressLine2 || "").trim();
    const line3 = String(userMetadata?.address_line3 || userMetadata?.addressLine3 || "").trim();
    const city = watch("city") || String(userMetadata?.city || "").trim();
    const pincode = watch("zip") || String(userMetadata?.pincode || "").trim();
    if (line1 || line2 || line3) {
      const resolved = resolveAddressLinesWithCityPincode(line1, line2, line3, city, pincode);
      return [resolved.line1, resolved.line2, resolved.line3].filter(Boolean).join("\n");
    }
    const combined = watch("address") || userMetadata?.address || "";
    const suffix = resolveAddressLinesWithCityPincode("", "", "", city, pincode).line3;
    if (combined && suffix && !String(combined).includes(suffix)) {
      return `${String(combined).replace(/[,.\s]+$/, "")}\n${suffix}`;
    }
    return combined || suffix || "—";
  })();

  return (
    <>
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
          onClick={handleCloseAttempt}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            className="flex max-h-[calc(100dvh-2rem)] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
            initial={{ y: -24, opacity: 0, scale: 0.97 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: -24, opacity: 0, scale: 0.97 }}
            transition={{ duration: 0.2 }}
          >
            {/* Header */}
            <div className="flex shrink-0 items-center justify-between border-b border-gray-100 px-5 py-4 md:px-6">
              <div>
                <h2 className="text-lg font-semibold tracking-tight text-brand-navy md:text-xl">
                  My Profile
                </h2>
                <p className="mt-0.5 text-sm text-gray-500">View and update your account details</p>
              </div>
              <button
                type="button"
                onClick={handleCloseAttempt}
                className="flex h-9 w-9 items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700"
                aria-label="Close profile"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Tab bar */}
            <div className="flex shrink-0 gap-1 border-b border-gray-100 px-5 md:px-6">
              {(
                [
                  { id: "profile" as ProfileTab, label: "Profile", icon: <User className="h-3.5 w-3.5" /> },
                  { id: "address" as ProfileTab, label: "Address", icon: <MapPin className="h-3.5 w-3.5" /> },
                  { id: "notifications" as ProfileTab, label: "Notifications", icon: <Mail className="h-3.5 w-3.5" /> },
                ]
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={[
                    "flex items-center gap-1.5 border-b-2 px-3 py-3 text-sm font-semibold transition-colors",
                    activeTab === tab.id
                      ? "border-brand-blue text-brand-blue"
                      : "border-transparent text-gray-500 hover:text-gray-700",
                  ].join(" ")}
                >
                  {tab.icon}
                  {tab.label}
                </button>
              ))}
            </div>

            <form
              onSubmit={handleSubmit(onSubmit)}
              className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-5 md:px-6"
            >
              {submitSuccess && (
                <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
                  Profile updated successfully!
                </div>
              )}
              {submitError && (
                <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-800">
                  {submitError}
                </div>
              )}

              {/* ── TAB: Profile ── */}
              {activeTab === "profile" && (
              <div className="space-y-4">
              {/* Profile hero */}
              <div className="rounded-2xl border border-gray-200 bg-gradient-to-br from-surface to-white p-5 shadow-sm">
                <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
                  <div className="relative shrink-0 self-center sm:self-start">
                    <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-full border-4 border-white bg-gray-100 shadow-md ring-2 ring-brand-blue/20">
                      {profilePhoto ? (
                        <img src={profilePhoto} alt="Profile" className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center bg-brand-navy text-2xl font-bold text-white">
                          {userMetadata?.first_name?.[0] || userMetadata?.last_name?.[0] || "U"}
                        </div>
                      )}
                    </div>
                    <label className="absolute bottom-0 right-0 flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border-2 border-white bg-brand-blue text-white shadow-md transition-colors hover:bg-brand-blue-hover">
                      <Camera className="h-4 w-4" />
                      <input
                        ref={photoInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handlePhotoUpload}
                        className="hidden"
                        disabled={isSubmitting}
                      />
                    </label>
                  </div>

                  <div className="min-w-0 flex-1 text-center sm:text-left">
                    <h3 className="text-xl font-bold text-brand-navy">{displayName}</h3>
                    <div className="mt-2 flex flex-wrap items-center justify-center gap-2 sm:justify-start">
                      <span className="inline-flex rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-semibold text-brand-blue ring-1 ring-inset ring-blue-200">
                        {roleLabel}
                      </span>
                      {userId ? (
                        <span className="text-xs text-gray-400">ID: {userId.slice(0, 8)}…</span>
                      ) : null}
                    </div>
                    <p className="mt-2 text-sm text-gray-500">
                      {watch("email") || userMetadata?.email || "—"}
                    </p>
                  </div>
                </div>

                {/* Letterhead */}
                <div className="mt-5 flex flex-col gap-3 border-t border-gray-100 pt-5 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className={[
                        "flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl border-2 bg-gray-50",
                        letterheadPreviewUrl || letterheadUrl
                          ? "cursor-pointer border-brand-blue hover:bg-blue-50"
                          : "border-gray-200",
                      ].join(" ")}
                      onClick={handleLetterheadThumbnailClick}
                      title={
                        letterheadPreviewUrl || letterheadUrl
                          ? "Click to preview letterhead"
                          : "No letterhead uploaded"
                      }
                    >
                      {letterheadPreviewUrl || letterheadUrl ? (
                        letterheadThumbnail ? (
                          <img
                            src={letterheadThumbnail}
                            alt="Letterhead"
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <ImageIcon className="h-6 w-6 text-gray-400" />
                        )
                      ) : (
                        <ImageIcon className="h-6 w-6 text-gray-300" />
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-brand-navy">Letterhead</p>
                      <p className="text-xs text-gray-500">A4 JPG or PNG for documents</p>
                      {(letterheadPreviewUrl || letterheadUrl) && (
                        <button
                          type="button"
                          onClick={handleLetterheadThumbnailClick}
                          className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-brand-blue hover:text-brand-blue-hover"
                        >
                          <Eye className="h-3 w-3" />
                          Click thumbnail to preview
                        </button>
                      )}
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={handleUploadPDFClick}
                    disabled={isSubmitting}
                  >
                    Update Letterhead
                  </Button>
                  <input
                    ref={letterheadInputRef}
                    type="file"
                    accept="image/jpeg,image/jpg,image/png,.jpg,.jpeg,.png"
                    onChange={handleLetterheadChange}
                    className="hidden"
                    disabled={isSubmitting}
                  />
                </div>
              </div>

              <ProfileSection title="Personal Information" icon={<User className="h-4 w-4" />}>
                <div className="grid gap-3 sm:grid-cols-2">
                  <ProfileInfoField label="First name" value={userMetadata?.first_name} />
                  <ProfileInfoField label="Last name" value={userMetadata?.last_name} />
                  <ProfileInfoField
                    label="Phone"
                    value={watch("mobile") || userMetadata?.alternate_phone || userMetadata?.mobile}
                  />
                  <ProfileInfoField label="Title" value={roleLabel} />
                  <ProfileInfoField label="PAN No." value={watch("panNo") || userMetadata?.pan} />
                  <ProfileInfoField
                    label={registrationInfo.label.replace(/:$/, "")}
                    value={watch("nmaRegNumber") || registrationInfo.value}
                  />
                </div>
              </ProfileSection>
              </div>
              )}

              {/* ── TAB: Address ── */}
              {activeTab === "address" && (
              <ProfileSection title="Address" icon={<MapPin className="h-4 w-4" />}>
                <div className="grid gap-3 sm:grid-cols-2">
                  <ProfileInfoField label="Country" value="India" />
                  <ProfileInfoField
                    label="City / State"
                    value={watch("city") || userMetadata?.city}
                  />
                  <ProfileInfoField
                    label="Zip Code"
                    value={watch("zip") || userMetadata?.pincode}
                  />
                  <ProfileInfoField
                    label="Full Address"
                    value={<span className="whitespace-pre-line">{addressDisplay}</span>}
                  />
                </div>
              </ProfileSection>
              )}

              {/* ── TAB: Notifications ── */}
              {activeTab === "notifications" && (
              <ProfileSection
                title="Email Notifications"
                subtitle="These toggles only control email. The same application updates always appear in the header bell."
                icon={<Mail className="h-4 w-4" />}
              >
                {(() => {
                  const phases = getVisibleMailNotificationPhases(userMetadata?.role);
                  const enabledCount = phases.filter((p) => mailNotificationPrefs[p]).length;
                  const allEnabled = enabledCount === phases.length;

                  return (
                    <>
                      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-brand-blue/20 bg-gradient-to-r from-blue-50/80 to-white px-4 py-3.5 shadow-sm">
                        <div>
                          <p className="text-sm font-semibold text-brand-navy">
                            {enabledCount} of {phases.length} notifications on
                          </p>
                          <p className="text-xs text-gray-500">
                            {allEnabled
                              ? "You’ll receive emails for all application updates"
                              : "Some updates won’t be emailed to you"}
                          </p>
                        </div>
                        <button
                          type="button"
                          disabled={isSubmitting}
                          onClick={() => {
                            const next = !allEnabled;
                            setMailNotificationPrefs((prev) => {
                              const updated = { ...prev };
                              for (const phase of phases) updated[phase] = next;
                              return updated;
                            });
                          }}
                          className="text-xs font-semibold text-brand-blue hover:text-brand-blue-hover disabled:opacity-50"
                        >
                          {allEnabled ? "Turn all off" : "Turn all on"}
                        </button>
                      </div>

                      <div className="grid gap-3 sm:grid-cols-2">
                        {phases.map((phase) => {
                          const { title, description } = MAIL_NOTIFICATION_LABELS[phase];
                          return (
                            <MailNotificationToggle
                              key={phase}
                              phase={phase}
                              title={title}
                              description={description}
                              enabled={mailNotificationPrefs[phase]}
                              disabled={isSubmitting}
                              onToggle={() => toggleMailNotification(phase)}
                            />
                          );
                        })}
                      </div>
                    </>
                  );
                })()}
              </ProfileSection>
              )}

              {hasUnsavedChanges && (
                <div className="sticky bottom-0 mt-4 flex justify-end gap-3 border-t border-gray-100 bg-white pt-4">
                  <Button type="button" variant="ghost" onClick={handleCloseAttempt} disabled={isSubmitting}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={isSubmitting || submitSuccess}>
                    {isSubmitting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Saving…
                      </>
                    ) : submitSuccess ? (
                      "Saved!"
                    ) : (
                      "Save Changes"
                    )}
                  </Button>
                </div>
              )}
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>

    {/* Letterhead Preview Modal */}
    <AnimatePresence>
      {isLetterheadModalOpen && (() => {
        // Determine which URL to use for preview
        // Priority: blob URL (newly selected file) > Supabase URL (uploaded/existing file)
        // Blob URLs (blob:) are for local preview before upload
        // Supabase URLs (https://) are for files already uploaded
        const previewUrl = letterheadPreviewUrl || letterheadUrl;
        
        if (!previewUrl) return null;
        
        // Validate URL format - must be either blob: (local) or https:// (Supabase)
        // Allow any https:// URL to support existing letterheads from userMetadata
        if (!previewUrl.startsWith('blob:') && !previewUrl.startsWith('https://')) {
          console.error('Invalid letterhead preview URL:', previewUrl);
          return null;
        }
        
        return (
          <motion.div
            className="fixed inset-0 z-[10000] flex items-start justify-center bg-black/50 p-4 pt-10 backdrop-blur-sm"
            onClick={handleCloseLetterheadModal}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              id="letterhead-modal"
              className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
              onClick={(e) => e.stopPropagation()}
              initial={{ y: -24, opacity: 0, scale: 0.97 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: -24, opacity: 0, scale: 0.97 }}
              transition={{ duration: 0.2 }}
            >
              <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
                <div>
                  <h2 className="text-lg font-semibold text-brand-navy">Letterhead Preview</h2>
                  <p className="mt-0.5 text-sm text-gray-500">
                    Content area should remain blank for document placement
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleCloseLetterheadModal}
                  className="flex h-9 w-9 items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700"
                  aria-label="Close preview"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="flex-1 overflow-auto p-5">
                <div
                  className="relative mx-auto w-full max-w-md overflow-hidden rounded-xl border-2 border-gray-200 bg-white shadow-sm"
                  style={{ aspectRatio: "210 / 297" }}
                >
                  <img
                    src={previewUrl}
                    alt="Letterhead"
                    className="absolute inset-0 h-full w-full object-contain"
                    onError={(e) => {
                      console.error("Error loading letterhead image:", previewUrl);
                      e.currentTarget.style.display = "none";
                    }}
                  />
                  <div
                    className="absolute rounded-lg border-2 border-dashed border-brand-blue/40 bg-blue-50/30"
                    style={{ top: "14%", bottom: "14%", left: "8%", right: "8%" }}
                  />
                </div>
              </div>
            </motion.div>
          </motion.div>
        );
      })()}
    </AnimatePresence>

    {/* Close Confirmation Modal */}
    <AnimatePresence>
      {showCloseConfirmation && (
        <motion.div
          className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
          onClick={handleCancelClose}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
            initial={{ y: -16, opacity: 0, scale: 0.97 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: -16, opacity: 0, scale: 0.97 }}
            transition={{ duration: 0.2 }}
          >
            <div className="border-b border-gray-100 px-5 py-4">
              <h3 className="text-lg font-semibold text-brand-navy">Unsaved changes</h3>
            </div>

            <div className="px-5 py-4">
              <p className="text-sm text-gray-600">
                You have unsaved changes. Close without saving?
              </p>
            </div>

            <div className="flex justify-end gap-3 border-t border-gray-100 px-5 py-4">
              <Button type="button" variant="ghost" onClick={handleCancelClose}>
                Keep editing
              </Button>
              <Button type="button" variant="danger" onClick={handleConfirmClose}>
                Close anyway
              </Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
    </>
  );
};

export default ProfileModal;

