"use client";

import { useState, useEffect, useRef } from "react";
import { useForm } from "react-hook-form";
import { motion, AnimatePresence } from "framer-motion";
import { useSearchParams } from "next/navigation";
import { loadDraft, saveDraft, markPageSaved, isPageSaved } from "@/app/utils/draftStorage";
import { useUserMetadata } from "@/app/contexts/UserContext";
import { supabase } from "@/app/utils/supabase";
import { useProjectData } from "@/app/hooks/useProjectData";
import { useDashboardAlertModal } from "@/app/dashboard/context/DashboardAlertModalContext";
import CustomSelect from "@/app/components/CustomSelect";
import { BTN_PRIMARY, BTN_SAVE_UNSAVED } from "@/app/utils/buttonClasses";
import {
  addressLinesFromResidential,
  serializeApplicantRosterForStorage,
} from "@/app/utils/applicantRecordFields";
import {
  applicantRosterHasOwner,
  canCreateProjectAsArchitect,
  ensureArchitectInApplicantRoster,
  ensureOwnerInApplicantRoster,
  readSessionUserMetaFromStorage,
  resolveOwnerUserIdFromApplicants,
  sameUserId,
  validateOwnerForArchitectProject,
  type OwnerApplicantMeta,
} from "@/app/utils/projectAccess";
import { ensureProjectOwnerOnRoster } from "@/app/utils/ownerApplicantRoster";
import ConsultantPartialRegistrationModal from "@/app/components/ConsultantPartialRegistrationModal";
import { NEW_USER_SENTINEL } from "@/app/utils/consultantRegistrationShared";

type ApplicantFormData = {
  applicantType: string;
  plumbingConsultant?: string;
  name: string;
  residentialAddress: string;
  contactNumber: string;
  emailAddress: string;
  registrationNumber: string;
  panNo: string;
  licenseIssueDate: string;
};

type ApplicantRow = {
  id: number;
  user_id?: string; // Supabase auth user id (owner / consultant)
  applicantType: string;
  name: string;
  contactNumber: string;
  email: string;
  registrationNo: string;
  panNo?: string;
  licenseIssueDate: string;
  residentialAddress: string;
  officeAddress: string;
  address_line1?: string;
  address_line2?: string;
  address_line3?: string;
  entity_type?: string;
};

type ConsultantDirectoryEntry = {
  id: string;
  fullName: string;
  email: string;
  contactNumber: string;
  pan: string;
  address: string;
  address_line1?: string;
  address_line2?: string;
  address_line3?: string;
  registrationNumber: string;
  licenseIssueDate: string;
};

const APPLICANT_TYPE_OPTIONS = [
  "Architect",
  "Structural Engineer",
  "Licensed Surveyor",
  "MEP Consultant",
  "Plumber",
  "Fire Consultant",
  "Landscape Consultant",
  "PMC / Project Manager",
  "Geotechnical Consultant",
  "Environmental Consultant",
  "Town Planner",
];

const ENTITY_TYPES = [
  "Proprietorship / Individual",
  "Partnership Firm",
  "Pvt. Ltd. / Ltd. Company",
  "LLP",
  "Trust / Society",
  "Govt. / PSU / Local Body",
];

type ApplicantDirectoryEntry = {
  id: string;
  name: string;
  contactNumber: string;
  emailAddress: string;
  registrationNumber: string;
  licenseIssueDate: string;
  licenseExpiryDate: string;
  residentialAddress: string;
  officeAddress: string;
};

const LICENSED_SITE_SUPERVISORS: ApplicantDirectoryEntry[] = [
  {
    id: "site-1",
    name: "Adani Electricity Mumbai Ltd.",
    contactNumber: "9967180886",
    emailAddress: "enquiry@dadamiya.com",
    registrationNumber: "REG/MCGM/TEMP",
    licenseIssueDate: "2023-01-15",
    licenseExpiryDate: "2026-01-15",
    residentialAddress:
      "CTS 407/A (New), 408 Old Village Eksar Devidas Lane, Off SVP Road, Borivali (W), Mumbai 400103.",
    officeAddress:
      "CTS 407/A (New), 408 Old Village Eksar Devidas Lane, Off SVP Road, Borivali (W), Mumbai 400103.",
  },
  {
    id: "site-2",
    name: "Metro Construction Supervisors",
    contactNumber: "9822334455",
    emailAddress: "info@metrositesupervisors.in",
    registrationNumber: "REG/SUP/2023/012",
    licenseIssueDate: "2023-02-01",
    licenseExpiryDate: "2026-02-01",
    residentialAddress: "A-12, Skyline Residency, Mulund East, Mumbai 400081",
    officeAddress: "Unit 210, Corporate Plaza, Mulund West, Mumbai 400080",
  },
];

const PLUMBERS: ApplicantDirectoryEntry[] = [
  {
    id: "plumber-1",
    name: "Mumbai Plumbing Services Pvt. Ltd.",
    contactNumber: "9876543210",
    emailAddress: "info@mumbaiplumbing.com",
    registrationNumber: "REG/PLUMB/2023/001",
    licenseIssueDate: "2023-03-20",
    licenseExpiryDate: "2026-03-20",
    residentialAddress: "Flat 501, Building A, Andheri East, Mumbai 400069",
    officeAddress: "Shop No. 12, Commercial Complex, Andheri West, Mumbai 400053",
  },
  {
    id: "plumber-2",
    name: "Expert Plumbing Solutions",
    contactNumber: "9123456789",
    emailAddress: "contact@expertplumbing.in",
    registrationNumber: "REG/PLUMB/2023/002",
    licenseIssueDate: "2023-04-15",
    licenseExpiryDate: "2026-04-15",
    residentialAddress: "B-302, Green Heights, Bandra West, Mumbai 400050",
    officeAddress: "Office No. 205, Business Plaza, Bandra East, Mumbai 400051",
  },
  {
    id: "plumber-3",
    name: "Professional Plumbing Works",
    contactNumber: "9988776655",
    emailAddress: "info@professionalplumbing.com",
    registrationNumber: "REG/PLUMB/2023/003",
    licenseIssueDate: "2023-02-10",
    licenseExpiryDate: "2026-02-10",
    residentialAddress: "C-15, Sunrise Apartments, Goregaon West, Mumbai 400104",
    officeAddress: "Unit 401, Industrial Estate, Goregaon East, Mumbai 400063",
  },
  {
    id: "plumber-4",
    name: "Reliable Plumbing Services",
    contactNumber: "9876543211",
    emailAddress: "support@reliableplumbing.in",
    registrationNumber: "REG/PLUMB/2023/004",
    licenseIssueDate: "2023-05-01",
    licenseExpiryDate: "2026-05-01",
    residentialAddress: "D-204, Ocean View Apartments, Juhu, Mumbai 400049",
    officeAddress: "Shop No. 5, Market Complex, Juhu, Mumbai 400049",
  },
];

const CONSULTANTS: ApplicantDirectoryEntry[] = [
  {
    id: "consult-1",
    name: "Clearance Consultants India",
    contactNumber: "9123456789",
    emailAddress: "contact@clearanceconsultants.in",
    registrationNumber: "REG/CONSULT/2022/045",
    licenseIssueDate: "2022-06-10",
    licenseExpiryDate: "2025-06-10",
    residentialAddress: "B-204, Green Valley Apartments, Powai, Mumbai 400076",
    officeAddress: "Office No. 305, Business Tower, Powai, Mumbai 400076",
  },
  {
    id: "consult-2",
    name: "Urban Clearance Partners",
    contactNumber: "9001234567",
    emailAddress: "support@urbanpartners.co.in",
    registrationNumber: "REG/CONSULT/2023/012",
    licenseIssueDate: "2023-01-05",
    licenseExpiryDate: "2026-01-05",
    residentialAddress: "B-804, Central Park, Kanjurmarg East, Mumbai 400042",
    officeAddress: "Level 9, Skyline Towers, Kanjurmarg West, Mumbai 400078",
  },
];

// Legacy static directories retained for reference but no longer used for the Name dropdown
const FIRE_AGENCIES: ApplicantDirectoryEntry[] = [];

const pickText = (...values: Array<unknown>): string => {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
};

/** Collapse newlines into one comma-separated line (avoids multi-line textarea scroll). */
const normalizeAddressSingleLine = (value: string): string => {
  const trimmed = value.trim();
  if (!trimmed) return "";
  return trimmed
    .split(/\n+/)
    .flatMap((line) =>
      line
        .split(",")
        .map((p) => p.trim())
        .filter(Boolean)
    )
    .join(", ");
};

const composeAddress = (
  line1?: string,
  line2?: string,
  line3?: string,
  fallback?: string
): string => {
  const joined = [line1, line2, line3]
    .map((v) => (typeof v === "string" ? v.trim() : ""))
    .filter(Boolean)
    .join(", ");
  const raw = joined || (typeof fallback === "string" ? fallback.trim() : "");
  return normalizeAddressSingleLine(raw);
};

const isOwnerApplicantType = (type: string): boolean =>
  type.trim().toLowerCase() === "owner";

/** Owner row is always first; display ids are renumbered 1..n. */
const sortApplicantsOwnerFirst = (rows: ApplicantRow[]): ApplicantRow[] => {
  if (rows.length <= 1) return rows.map((row, index) => ({ ...row, id: index + 1 }));

  const sorted = [...rows].sort((a, b) => {
    const aOwner = isOwnerApplicantType(a.applicantType);
    const bOwner = isOwnerApplicantType(b.applicantType);
    if (aOwner && !bOwner) return -1;
    if (!aOwner && bOwner) return 1;
    return a.id - b.id;
  });

  return sorted.map((row, index) => ({ ...row, id: index + 1 }));
};

const mapStoredApplicantsToRows = (applicantsList: unknown[]): ApplicantRow[] =>
  applicantsList.map((app: any, index: number) => ({
    id: app.id || index + 1,
    user_id: app.user_id || app.userId || undefined,
    applicantType: app.applicantType || app.applicant_type || "",
    name: app.name || "",
    contactNumber: app.contactNumber || app.contact_number || "",
    email: app.email || app.emailAddress || app.email_address || "",
    registrationNo: app.registrationNumber || app.registration_number || app.registrationNo || "",
    panNo: app.panNo || app.pan_no || app.pan || "",
    licenseIssueDate: app.licenseIssueDate || app.license_issue_date || "",
    residentialAddress: composeAddress(
      pickText(app.address_line1, app.addressLine1),
      pickText(app.address_line2, app.addressLine2),
      pickText(app.address_line3, app.addressLine3),
      pickText(app.residentialAddress, app.residential_address)
    ),
    officeAddress: app.officeAddress || app.office_address || "",
    address_line1: pickText(app.address_line1, app.addressLine1),
    address_line2: pickText(app.address_line2, app.addressLine2),
    address_line3: pickText(app.address_line3, app.addressLine3),
    entity_type: pickText(app.entity_type, app.entityType),
  }));

const mapRosterJsonToApplicantRows = (rows: unknown[]): ApplicantRow[] =>
  sortApplicantsOwnerFirst(
    rows.map((app, index) => {
      const row = app as Record<string, unknown>;
      return {
        id: typeof row.id === "number" ? row.id : index + 1,
        user_id: pickText(row.user_id, row.userId) || undefined,
        applicantType: pickText(row.applicantType, row.applicant_type),
        name: pickText(row.name) || "-",
        contactNumber: pickText(row.contactNumber, row.contact_number) || "-",
        email: pickText(row.email, row.emailAddress, row.email_address) || "-",
        registrationNo:
          pickText(row.registrationNo, row.registrationNumber, row.registration_number) || "-",
        panNo: pickText(row.panNo, row.pan_no, row.pan) || "-",
        licenseIssueDate: pickText(row.licenseIssueDate, row.license_issue_date) || "-",
        residentialAddress:
          pickText(row.residentialAddress, row.residential_address, row.address) || "-",
        officeAddress: pickText(row.officeAddress, row.office_address, row.address) || "-",
        address_line1: pickText(row.address_line1, row.addressLine1) || undefined,
        address_line2: pickText(row.address_line2, row.addressLine2) || undefined,
        address_line3: pickText(row.address_line3, row.addressLine3) || undefined,
        entity_type: pickText(row.entity_type, row.entityType) || undefined,
      };
    })
  );

const APPLICANT_FORM_DEFAULTS: ApplicantFormData = {
  applicantType: "",
  plumbingConsultant: "",
  name: "",
  residentialAddress: "",
  contactNumber: "",
  emailAddress: "",
  registrationNumber: "",
  panNo: "",
  licenseIssueDate: "",
};

export default function ApplicantDetailsPage() {
  const { userMetadata } = useUserMetadata();
  const { showAlert } = useDashboardAlertModal();
  const { isEditMode, isLoading, projectData } = useProjectData();
  const searchParams = useSearchParams();
  const projectIdFromUrl = searchParams.get("projectId");
  const [storedProjectId, setStoredProjectId] = useState<string | null>(null);

  useEffect(() => {
    if (projectIdFromUrl) {
      setStoredProjectId(null);
      return;
    }
    if (typeof window === "undefined") return;
    const fromSession = window.sessionStorage.getItem("lastProjectId")?.trim();
    if (fromSession) setStoredProjectId(fromSession);
  }, [projectIdFromUrl]);

  const projectId = projectIdFromUrl || storedProjectId;
  const isReadOnlyMode = searchParams.get("mode") === "readonly";
  const [authUserId, setAuthUserId] = useState<string | null>(null);

  const [applicants, setApplicants] = useState<ApplicantRow[]>(() =>
    sortApplicantsOwnerFirst(loadDraft<ApplicantRow[]>("draft-applicant-details-applicants", []))
  );
  const [directoryOptions, setDirectoryOptions] = useState<ConsultantDirectoryEntry[]>([]);
  const [directoryRefreshKey, setDirectoryRefreshKey] = useState(0);
  const previousApplicantTypeRef = useRef<string | undefined>(undefined);
  const [showNewUserModal, setShowNewUserModal] = useState(false);
  const [isSaved, setIsSaved] = useState(() => isPageSaved("saved-applicant-details"));
  const [isFormAutofilled, setIsFormAutofilled] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState<{ open: boolean; applicantId: number | null; applicantName: string; applicantType: string }>({
    open: false,
    applicantId: null,
    applicantName: "",
    applicantType: "",
  });
  /** After Owner is removed from roster, skip re-seeding from projects.user_id until a new Owner is saved. */
  const [ownerAwaitingReplacement, setOwnerAwaitingReplacement] = useState(false);
  /** Architect is picking a replacement Owner while the current Owner row still shows. */
  const [changingOwner, setChangingOwner] = useState(false);
  /** Local mirror of projects.user_id so Change Owner can update without a full project reload. */
  const [projectOwnerUserId, setProjectOwnerUserId] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    clearErrors,
    formState: { errors },
    reset,
  } = useForm<ApplicantFormData>({
    defaultValues: (() => {
      const loaded = loadDraft<ApplicantFormData>("draft-applicant-details-form", APPLICANT_FORM_DEFAULTS);
      return {
        ...loaded,
        residentialAddress: normalizeAddressSingleLine(loaded.residentialAddress || ""),
      };
    })(),
  });

  const inputClasses =
    "border border-gray-200 rounded-xl px-3 py-2 h-10 w-full text-gray-900 bg-white focus:ring-2 focus:ring-emerald-500 outline-none";
  const textareaClasses =
    "border border-gray-200 rounded-xl px-3 py-2 w-full text-gray-900 bg-white focus:ring-2 focus:ring-emerald-500 outline-none resize-none";
  const disabledClasses = "bg-gray-100 cursor-not-allowed";

  const selectedApplicantType = watch("applicantType");
  const selectedDirectoryId = watch("plumbingConsultant");
  const isValidDirectorySelection =
    Boolean(selectedDirectoryId) && selectedDirectoryId !== NEW_USER_SENTINEL;
  // In this flow, users should not type manually; values come only from directory selection.
  // Show the directory dropdown as soon as applicant type is selected.
  const showDirectoryDropdown = !!selectedApplicantType;
  const canAddNewUser =
    !!selectedApplicantType && selectedApplicantType !== "Owner";
  const isLocked = showDirectoryDropdown && isValidDirectorySelection;

  // Capture logged-in Supabase auth user id (used to store `user_id` in applicant rows)
  useEffect(() => {
    const loadAuthUser = async () => {
      const { data, error } = await supabase.auth.getUser();
      if (error) {
        console.error("Error fetching auth user:", error);
        return;
      }
      setAuthUserId(data.user?.id ?? null);
    };
    loadAuthUser();
  }, []);

  // Fetch and populate data when in edit mode
  useEffect(() => {
    if (isEditMode && projectData && !isLoading) {
      console.log("[Applicant Details] Loading project data:", projectData);
      const applicantDetails = projectData.applicant_details || {};
      const applicantsList = applicantDetails.applicants || [];
      setProjectOwnerUserId(
        typeof projectData.user_id === "string" ? projectData.user_id.trim() || null : null
      );
      
      console.log("[Applicant Details] Applicants list from backend:", applicantsList);
      
      if (applicantsList.length > 0) {
        const orderedApplicants = sortApplicantsOwnerFirst(
          mapStoredApplicantsToRows(applicantsList)
        );
        console.log("[Applicant Details] Mapped applicants:", orderedApplicants);
        setApplicants(orderedApplicants);
        saveDraft("draft-applicant-details-applicants", orderedApplicants);
        markPageSaved("saved-applicant-details");
        setIsSaved(true);
        const savedHasOwner = applicantRosterHasOwner(orderedApplicants);
        setOwnerAwaitingReplacement(!savedHasOwner);
        setChangingOwner(false);
      } else {
        console.log("[Applicant Details] No applicants found in project data");
        setOwnerAwaitingReplacement(false);
      }
    }
  }, [isEditMode, projectData, isLoading]);

  // Architect-created projects: seed projects.user_id as Owner when the saved roster is empty.
  // Do not re-add after the architect removed/replaced the Owner on the roster.
  useEffect(() => {
    if (userMetadata?.role !== "Consultant") return;
    const ownerUserId = (projectOwnerUserId || projectData?.user_id || "").trim();
    if (!ownerUserId || isLoading) return;
    if (applicantRosterHasOwner(applicants)) return;
    if (ownerAwaitingReplacement || changingOwner) return;

    const savedApplicants = Array.isArray(projectData?.applicant_details?.applicants)
      ? projectData.applicant_details.applicants
      : [];
    const savedHasRows = savedApplicants.length > 0;
    const savedHasOwner = applicantRosterHasOwner(
      mapStoredApplicantsToRows(savedApplicants)
    );
    if (isEditMode && savedHasRows && !savedHasOwner) {
      setOwnerAwaitingReplacement(true);
      return;
    }

    let cancelled = false;
    const syncOwner = async () => {
      const roster = await ensureProjectOwnerOnRoster({ applicants }, ownerUserId, {
        sessionUserId: authUserId,
      });
      if (cancelled) return;
      const nextApplicants = mapRosterJsonToApplicantRows(roster.applicants);
      setApplicants(nextApplicants);
      saveDraft("draft-applicant-details-applicants", nextApplicants);
    };

    void syncOwner();
    return () => {
      cancelled = true;
    };
  }, [
    userMetadata?.role,
    projectOwnerUserId,
    projectData?.user_id,
    projectData?.applicant_details,
    isLoading,
    isEditMode,
    applicants,
    authUserId,
    ownerAwaitingReplacement,
    changingOwner,
  ]);

  // If the form was previously saved (green button) and the user starts editing/adding
  // another applicant, move the button back to blue "Save"
  useEffect(() => {
    const subscription = watch(() => {
      if (isSaved) {
        setIsSaved(false);
      }
    });

    return () => subscription.unsubscribe();
  }, [watch, isSaved]);

  // Load applicants (consultants or owners) for the selected type from Supabase auth via RPC
  useEffect(() => {
    const loadDirectoryOptions = async () => {
      if (!selectedApplicantType) {
        setDirectoryOptions([]);
        return;
      }

      // For Owner type, use get_owners() to fetch all owners
      // For other types, use the standard get_consultants_by_type function
      let data, error;
      
      if (selectedApplicantType === "Owner") {
        // Use function to get all owners (no entity type filter)
        const result = await supabase.rpc("get_owners");
        data = result.data;
        error = result.error;
      } else {
        // Use dedicated function for consultants (single parameter to avoid PostgREST schema cache issues)
        const result = await supabase.rpc("get_consultants_by_type", {
          p_type: selectedApplicantType,
        });
        data = result.data;
        error = result.error;
      }

      if (error) {
        console.error("Error loading applicants by type:", error);
        setDirectoryOptions([]);
        return;
      }

      const mapped: ConsultantDirectoryEntry[] =
        data?.map((row: any) => ({
          id: row.user_id,
          fullName: [row.first_name, row.middle_name, row.last_name].filter(Boolean).join(" "),
          email: row.email || "",
          contactNumber: row.contact_number || "",
          pan: row.pan || "",
          address_line1: pickText(row.address_line1, row.addressLine1, row.user_metadata?.address_line1),
          address_line2: pickText(row.address_line2, row.addressLine2, row.user_metadata?.address_line2),
          address_line3: pickText(row.address_line3, row.addressLine3, row.user_metadata?.address_line3),
          address: composeAddress(
            pickText(row.address_line1, row.addressLine1, row.user_metadata?.address_line1),
            pickText(row.address_line2, row.addressLine2, row.user_metadata?.address_line2),
            pickText(row.address_line3, row.addressLine3, row.user_metadata?.address_line3),
            pickText(row.address, row.user_metadata?.address)
          ),
          registrationNumber: row.registration_number || "",
          licenseIssueDate: row.license_issue_date || "",
        })) ?? [];

      // Keep any locally added entries (e.g. just-created partial users) until RPC includes them,
      // but replace entirely when the applicant type changes.
      const typeChanged = previousApplicantTypeRef.current !== selectedApplicantType;
      previousApplicantTypeRef.current = selectedApplicantType;
      if (typeChanged) {
        setDirectoryOptions(mapped);
      } else {
        setDirectoryOptions((prev) => {
          const byId = new Map(mapped.map((entry) => [entry.id, entry]));
          for (const entry of prev) {
            if (entry.id && !byId.has(entry.id)) {
              byId.set(entry.id, entry);
            }
          }
          return Array.from(byId.values());
        });
      }
    };

    loadDirectoryOptions();
  }, [selectedApplicantType, directoryRefreshKey]);

  // Owner-created projects: logged-in owner is always the first applicant row.
  // Consultants: logged-in consultant type is added when missing.
  useEffect(() => {
    if (!userMetadata) return;

    const isConsultant = userMetadata.role === "Consultant";
    // Wait for auth id so the default Owner row gets projects.user_id / applicant user_id.
    if (!isConsultant && !authUserId) return;

    if (isEditMode && projectData && applicantRosterHasOwner(applicants)) return;

    setApplicants((prev) => {
      const applicantType = isConsultant ? (userMetadata.consultant_type || "") : "Owner";

      if (!isConsultant) {
        const ownerIndex = prev.findIndex((a) => isOwnerApplicantType(a.applicantType));
        if (ownerIndex >= 0) {
          const existing = prev[ownerIndex];
          const ownerEntityType =
            existing.entity_type?.trim() || userMetadata.entity_type?.trim() || "";
          if (!existing.user_id?.trim() && authUserId) {
            const updated = prev.map((row, idx) =>
              idx === ownerIndex
                ? {
                    ...row,
                    user_id: authUserId,
                    ...(ownerEntityType ? { entity_type: ownerEntityType } : {}),
                  }
                : row
            );
            return sortApplicantsOwnerFirst(updated);
          }
          if (!existing.entity_type?.trim() && ownerEntityType) {
            const updated = prev.map((row, idx) =>
              idx === ownerIndex ? { ...row, entity_type: ownerEntityType } : row
            );
            return sortApplicantsOwnerFirst(updated);
          }
          return prev;
        }
      } else if (prev.some((a) => a.applicantType === applicantType)) {
        return prev;
      }

      const userName =
        (userMetadata.first_name || "") +
        (userMetadata.middle_name ? " " + userMetadata.middle_name : "") +
        (userMetadata.last_name ? " " + userMetadata.last_name : "") ||
        "-";

      const userContact = userMetadata.alternate_phone || userMetadata.mobile || "-";
      const userEmail = userMetadata.email || "-";
      const userAddress = userMetadata.address || "-";
      const userAddressLine1 = pickText(userMetadata.address_line1, userMetadata.addressLine1);
      const userAddressLine2 = pickText(userMetadata.address_line2, userMetadata.addressLine2);
      const userAddressLine3 = pickText(userMetadata.address_line3, userMetadata.addressLine3);
      const userPanNo = userMetadata.pan_no || userMetadata.pan || "-";

      let registrationNo = "";
      let licenseIssueDate = "";

      if (isConsultant) {
        // Derive registration number and date based on consultant_type (same logic as RPC function)
        const consultantType = userMetadata.consultant_type;
        switch (consultantType) {
          case "Architect":
            registrationNo = userMetadata.coa_reg_no || "";
            licenseIssueDate = userMetadata.registration_date || "";
            break;
          case "Structural Engineer":
            registrationNo = userMetadata.structural_license_no || "";
            licenseIssueDate = userMetadata.registration_date || "";
            break;
          case "Licensed Surveyor":
            registrationNo = userMetadata.lbs_license_no || "";
            licenseIssueDate = userMetadata.registration_date || "";
            break;
          case "MEP Consultant":
            registrationNo = userMetadata.electrical_license_no || "";
            licenseIssueDate = userMetadata.registration_date || "";
            break;
          case "Plumber":
            registrationNo = userMetadata.plumber_license_no || "";
            licenseIssueDate = userMetadata.registration_date || "";
            break;
          case "Fire Consultant":
            registrationNo = userMetadata.fire_license_no || "";
            licenseIssueDate = userMetadata.registration_date || "";
            break;
          case "Landscape Consultant":
            registrationNo = userMetadata.landscape_license_no || "";
            licenseIssueDate = userMetadata.registration_date || "";
            break;
          case "PMC / Project Manager":
            registrationNo = userMetadata.pmc_registration_no || "";
            licenseIssueDate = userMetadata.registration_date || "";
            break;
          case "Geotechnical Consultant":
            registrationNo = userMetadata.nabl_accreditation_no || "";
            licenseIssueDate = userMetadata.registration_date || "";
            break;
          case "Environmental Consultant":
            registrationNo = userMetadata.env_license_no || "";
            licenseIssueDate = userMetadata.registration_date || "";
            break;
          case "Town Planner":
            registrationNo = userMetadata.town_planner_license_no || "";
            licenseIssueDate = userMetadata.registration_date || "";
            break;
          default:
            registrationNo = "";
            licenseIssueDate = "";
        }
      } else {
        // Derive registration number and date based on entity_type (same logic as ProfileModal / RegistrationForm)
        const entityType = userMetadata.entity_type;
        if (entityType === "Proprietorship / Individual") {
          registrationNo = userMetadata.proprietorship_registration_no || "";
          licenseIssueDate = userMetadata.proprietorship_registration_date || "";
        } else if (entityType === "Pvt. Ltd. / Ltd. Company") {
          registrationNo = userMetadata.cin || "";
          licenseIssueDate = userMetadata.roc_registration_date || "";
        } else if (entityType === "LLP") {
          registrationNo = userMetadata.llpin || "";
          licenseIssueDate = userMetadata.llp_incorporation_date || "";
        } else if (entityType === "Partnership Firm") {
          registrationNo = userMetadata.firm_registration_no || "";
          licenseIssueDate = userMetadata.partnership_registration_date || "";
        } else if (entityType === "Trust / Society") {
          registrationNo = userMetadata.trust_registration_no || "";
          licenseIssueDate = userMetadata.trust_registration_date || "";
        } else if (entityType === "Govt. / PSU / Local Body") {
          registrationNo = userMetadata.govt_registration_no || "";
          licenseIssueDate = userMetadata.govt_registration_date || "";
        }
      }

      const userRow: ApplicantRow = {
        id: 1,
        user_id: authUserId ?? undefined,
        applicantType: applicantType,
        name: userName,
        contactNumber: userContact,
        email: userEmail,
        registrationNo: registrationNo,
        panNo: userPanNo,
        licenseIssueDate: licenseIssueDate || "-",
        residentialAddress:
          composeAddress(userAddressLine1, userAddressLine2, userAddressLine3, userAddress) || "-",
        officeAddress: userAddress,
        address_line1: userAddressLine1 || undefined,
        address_line2: userAddressLine2 || undefined,
        address_line3: userAddressLine3 || undefined,
        ...(!isConsultant && userMetadata.entity_type?.trim()
          ? { entity_type: userMetadata.entity_type.trim() }
          : {}),
      };

      const reindexed = prev.map((a, idx) => ({ ...a, id: idx + 2 }));
      return sortApplicantsOwnerFirst([userRow, ...reindexed]);
    });
  }, [userMetadata, authUserId, isEditMode, projectData, applicants.length]);

  const resetApplicantFields = () => {
    const fieldsToClear: (keyof ApplicantFormData)[] = [
      "name",
      "residentialAddress",
      "contactNumber",
      "emailAddress",
      "registrationNumber",
      "panNo",
      "licenseIssueDate",
    ];
    fieldsToClear.forEach((field) => setValue(field, ""));
    clearErrors(fieldsToClear);
  };

  useEffect(() => {
    if (!selectedApplicantType) {
      return;
    }
    setValue("plumbingConsultant", "");
    resetApplicantFields();
    setIsFormAutofilled(false);
  }, [selectedApplicantType, setValue]);

  // Reset directory selection and fields when applicant type changes to Owner
  useEffect(() => {
    if (selectedApplicantType === "Owner") {
      setValue("plumbingConsultant", "");
      resetApplicantFields();
      setIsFormAutofilled(false);
    }
  }, [selectedApplicantType, setValue]);

  // When a consultant or owner is selected from the dropdown, auto-fill all form fields
  useEffect(() => {
    if (!isValidDirectorySelection || !showDirectoryDropdown) {
      setIsFormAutofilled(false);
      return;
    }

    const selectedEntry = directoryOptions.find((entry) => entry.id === selectedDirectoryId);
    if (selectedEntry) {
      const opts = { shouldValidate: true, shouldDirty: true, shouldTouch: true } as const;
      const selectedAddressLine1 = pickText(selectedEntry.address_line1);
      const selectedAddressLine2 = pickText(selectedEntry.address_line2);
      const selectedAddressLine3 = pickText(selectedEntry.address_line3);
      setValue("name", selectedEntry.fullName, opts);
      setValue("contactNumber", selectedEntry.contactNumber, opts);
      setValue("emailAddress", selectedEntry.email, opts);
      setValue(
        "residentialAddress",
        composeAddress(
          selectedAddressLine1,
          selectedAddressLine2,
          selectedAddressLine3,
          selectedEntry.address
        ),
        opts
      );
      setValue("registrationNumber", selectedEntry.registrationNumber, opts);
      setValue("panNo", selectedEntry.pan, opts);
      setValue("licenseIssueDate", selectedEntry.licenseIssueDate, opts);
      clearErrors([
        "name",
        "contactNumber",
        "emailAddress",
        "residentialAddress",
        "registrationNumber",
        "panNo",
        "licenseIssueDate",
      ]);
      setIsFormAutofilled(true);
    } else {
      setIsFormAutofilled(false);
    }
  }, [
    selectedDirectoryId,
    isValidDirectorySelection,
    directoryOptions,
    showDirectoryDropdown,
    setValue,
    clearErrors,
  ]);

  const handleNewUserSuccess = async (result: {
    user_id: string;
    email?: string;
    metadata?: Record<string, unknown>;
  }) => {
    setShowNewUserModal(false);

    const meta = result.metadata || {};
    const fullName = [meta.first_name, meta.middle_name, meta.last_name]
      .filter(Boolean)
      .join(" ")
      .trim();
    const addressLine1 = String(meta.address_line1 || "");
    const addressLine2 = String(meta.address_line2 || "");
    const addressLine3 = String(meta.address_line3 || "");

    let registrationNumber = "";
    let licenseIssueDate = String(meta.registration_date || "");
    const consultantType = String(meta.consultant_type || selectedApplicantType || "");
    switch (consultantType) {
      case "Architect":
        registrationNumber = String(meta.coa_reg_no || "");
        break;
      case "Structural Engineer":
        registrationNumber = String(meta.structural_license_no || "");
        break;
      case "Licensed Surveyor":
        registrationNumber = String(meta.lbs_license_no || "");
        break;
      case "MEP Consultant":
        registrationNumber = String(meta.electrical_license_no || "");
        break;
      case "Plumber":
        registrationNumber = String(meta.plumber_license_no || "");
        break;
      case "Fire Consultant":
        registrationNumber = String(meta.fire_license_no || "");
        break;
      case "Landscape Consultant":
        registrationNumber = String(meta.landscape_license_no || "");
        break;
      case "PMC / Project Manager":
        registrationNumber = String(meta.pmc_registration_no || "");
        break;
      case "Geotechnical Consultant":
        registrationNumber = String(meta.nabl_accreditation_no || "");
        break;
      case "Environmental Consultant":
        registrationNumber = String(meta.env_license_no || "");
        break;
      case "Town Planner":
        registrationNumber = String(meta.town_planner_license_no || "");
        break;
      default:
        break;
    }

    if (Object.keys(meta).length > 0) {
      const entry: ConsultantDirectoryEntry = {
        id: result.user_id,
        fullName: fullName || result.email || "New User",
        email: String(meta.email || result.email || ""),
        contactNumber: String(meta.alternate_phone || meta.mobile || ""),
        pan: String(meta.pan || ""),
        address_line1: addressLine1,
        address_line2: addressLine2,
        address_line3: addressLine3,
        address: composeAddress(
          addressLine1,
          addressLine2,
          addressLine3,
          String(meta.address || "")
        ),
        registrationNumber,
        licenseIssueDate,
      };
      setDirectoryOptions((prev) => {
        if (prev.some((e) => e.id === entry.id)) {
          return prev.map((e) => (e.id === entry.id ? entry : e));
        }
        return [entry, ...prev];
      });
    }

    setDirectoryRefreshKey((k) => k + 1);
    setValue("plumbingConsultant", result.user_id, {
      shouldValidate: true,
      shouldDirty: true,
      shouldTouch: true,
    });
  };

  // Get applicant types that are already added
  const addedApplicantTypes = applicants.map((applicant) => applicant.applicantType);
  
  // Check if Architect or Licensed Surveyor is already added
  const hasArchitect = addedApplicantTypes.includes("Architect");
  const hasLicensedSurveyor = addedApplicantTypes.includes("Licensed Surveyor");
  
  // Filter out already added applicant types from dropdown options
  // Also enforce mutual exclusivity: if Architect is added, exclude Licensed Surveyor and vice versa
  let availableApplicantTypes = APPLICANT_TYPE_OPTIONS.filter((type) => {
    // Don't show if already added
    if (addedApplicantTypes.includes(type)) {
      return false;
    }
    
    // Mutual exclusivity: if Architect is added, don't show Licensed Surveyor
    if (hasArchitect && type === "Licensed Surveyor") {
      return false;
    }
    
    // Mutual exclusivity: if Licensed Surveyor is added, don't show Architect
    if (hasLicensedSurveyor && type === "Architect") {
      return false;
    }
    
    return true;
  });

  // If logged-in user is a consultant, add "Owner" option (unless already added)
  const isConsultant = userMetadata?.role === "Consultant";
  const canManageProjectOwner = canCreateProjectAsArchitect(userMetadata);
  if (
    isConsultant &&
    (!addedApplicantTypes.includes("Owner") || changingOwner || ownerAwaitingReplacement)
  ) {
    availableApplicantTypes = ["Owner", ...availableApplicantTypes.filter((t) => t !== "Owner")];
  }

  const isLoggedInApplicantRow = (applicant: ApplicantRow): boolean =>
    authUserId != null &&
    Boolean(applicant.user_id) &&
    String(applicant.user_id) === String(authUserId);

  const persistApplicantsToProject = async (
    roster: ApplicantRow[],
    options?: { syncProjectOwner?: boolean }
  ): Promise<boolean> => {
    if (!projectId) return true;

    const userId =
      typeof window !== "undefined" ? window.localStorage.getItem("consultantId") : null;
    if (!userId) {
      showAlert({
        title: "Could not save applicants",
        message: "User session not found. Please log in again.",
      });
      return false;
    }

    const {
      data: { session },
    } = await supabase.auth.getSession();
    const authToken = session?.access_token;
    const headers: HeadersInit = { "Content-Type": "application/json" };
    if (authToken) headers.Authorization = `Bearer ${authToken}`;

    const meta = readSessionUserMetaFromStorage();
    let rosterForSave: { applicants: unknown[] } = { applicants: roster };

    if (canCreateProjectAsArchitect(meta)) {
      rosterForSave = ensureArchitectInApplicantRoster(
        rosterForSave,
        authUserId ?? userId,
        meta
      );
      // Do not force projects.user_id back onto the roster — architect may be changing Owner.
    } else if (authUserId && !applicantRosterHasOwner(roster)) {
      rosterForSave = ensureOwnerInApplicantRoster(
        rosterForSave,
        authUserId,
        userMetadata as OwnerApplicantMeta
      );
    }

    const serialized = serializeApplicantRosterForStorage(rosterForSave.applicants);
    if (serialized.applicants.length === 0) {
      showAlert({
        title: "Could not save applicants",
        message:
          "Select each applicant from the directory dropdown so they are linked to an account (Owner must be chosen from the list).",
      });
      return false;
    }

    const rosterOwnerId = resolveOwnerUserIdFromApplicants(
      rosterForSave.applicants as ApplicantRow[]
    );
    const shouldSyncOwner =
      Boolean(options?.syncProjectOwner) &&
      canCreateProjectAsArchitect(meta) &&
      Boolean(rosterOwnerId);

    if (shouldSyncOwner && rosterOwnerId) {
      const ownerCheck = validateOwnerForArchitectProject(
        rosterForSave.applicants as ApplicantRow[],
        authUserId ?? userId
      );
      if (!ownerCheck.ok) {
        showAlert({ title: "Invalid Owner", message: ownerCheck.message });
        return false;
      }
    }

    const ownerRow = (rosterForSave.applicants as ApplicantRow[]).find((row) =>
      isOwnerApplicantType(String(row.applicantType || ""))
    );
    const payload: Record<string, unknown> = {
      user_id: userId,
      applicant_details: serialized,
    };
    if (shouldSyncOwner && rosterOwnerId) {
      payload.project_owner_user_id = rosterOwnerId;
      if (projectData?.project_info && typeof projectData.project_info === "object") {
        payload.project_info = {
          ...(projectData.project_info as Record<string, unknown>),
          fullNameOfApplicant: ownerRow?.name && ownerRow.name !== "-" ? ownerRow.name : "",
        };
      }
    }

    const response = await fetch(`/api/projects/${projectId}`, {
      method: "PUT",
      headers,
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      showAlert({
        title: "Could not save applicants",
        message: (error as { error?: string }).error || "Failed to save applicant roster.",
      });
      return false;
    }

    if (shouldSyncOwner && rosterOwnerId) {
      setProjectOwnerUserId(rosterOwnerId);
      setOwnerAwaitingReplacement(false);
      setChangingOwner(false);
    }
    return true;
  };

  const onSubmit = async (data: ApplicantFormData) => {
    if (isReadOnlyMode) return;
    const nextId = applicants.length ? Math.max(...applicants.map((item) => item.id)) + 1 : 1;
    // All entries come from directory dropdown (consultants or owners), use their auth user id
    const userId =
      showDirectoryDropdown && isValidDirectorySelection
        ? selectedDirectoryId
        : undefined;

    const selectedDirectoryEntry =
      showDirectoryDropdown && isValidDirectorySelection
        ? directoryOptions.find((entry) => entry.id === selectedDirectoryId)
        : undefined;
    let addressLine1 = pickText(selectedDirectoryEntry?.address_line1);
    let addressLine2 = pickText(selectedDirectoryEntry?.address_line2);
    let addressLine3 = pickText(selectedDirectoryEntry?.address_line3);
    if (!addressLine1 && !addressLine2 && !addressLine3 && data.residentialAddress?.trim()) {
      const split = addressLinesFromResidential(data.residentialAddress);
      addressLine1 = split.line1;
      addressLine2 = split.line2;
      addressLine3 = split.line3;
    }
    const newApplicant: ApplicantRow = {
      id: nextId,
      user_id: userId,
      applicantType: data.applicantType,
      name: data.name || "-",
      contactNumber: data.contactNumber || "-",
      email: data.emailAddress || "-",
      registrationNo: data.registrationNumber || "-",
      panNo: data.panNo || "-",
      licenseIssueDate: data.licenseIssueDate || "-",
      residentialAddress:
        composeAddress(addressLine1, addressLine2, addressLine3, data.residentialAddress) || "-",
      officeAddress: "-",
      address_line1: addressLine1 || undefined,
      address_line2: addressLine2 || undefined,
      address_line3: addressLine3 || undefined,
    };

    const isAddingOwner = isOwnerApplicantType(data.applicantType);
    if (isAddingOwner && canManageProjectOwner) {
      if (!userId) {
        showAlert({
          title: "Owner required",
          message: "Select an Owner from the directory so they are linked to an account.",
        });
        return;
      }
      if (authUserId && sameUserId(userId, authUserId)) {
        showAlert({
          title: "Invalid Owner",
          message: "The project Owner must be a different account than the architect.",
        });
        return;
      }
    }

    const baseRoster =
      isAddingOwner && (changingOwner || ownerAwaitingReplacement || applicantRosterHasOwner(applicants))
        ? applicants.filter((row) => !isOwnerApplicantType(row.applicantType))
        : applicants;
    const nextApplicants = sortApplicantsOwnerFirst([...baseRoster, newApplicant]);

    if (
      !(await persistApplicantsToProject(nextApplicants, {
        syncProjectOwner: isAddingOwner && canManageProjectOwner,
      }))
    ) {
      return;
    }

    setApplicants(nextApplicants);
    if (isAddingOwner && canManageProjectOwner) {
      setOwnerAwaitingReplacement(false);
      setChangingOwner(false);
    }

    reset();
    setIsFormAutofilled(false);
    markPageSaved("saved-applicant-details");
    saveDraft("dirty-applicant-details", false);
    saveDraft("saved-applicant-details-snapshot", {
      applicants: nextApplicants,
      form: {
        applicantType: "",
        plumbingConsultant: "",
        name: "",
        residentialAddress: "",
        contactNumber: "",
        emailAddress: "",
        registrationNumber: "",
        panNo: "",
        licenseIssueDate: "",
      },
    });
    setIsSaved(true);
    showAlert({
      title: "Applicant details",
      message: isAddingOwner && canManageProjectOwner
        ? "Owner updated and saved to the project."
        : "Applicant details saved successfully!",
    });
  };

  // Persist draft as user types
  useEffect(() => {
    const subscription = watch((value) => {
      saveDraft("draft-applicant-details-form", value as ApplicantFormData);
    });
    return () => subscription.unsubscribe();
  }, [watch]);

  // Persist applicants array whenever it changes
  useEffect(() => {
    saveDraft("draft-applicant-details-applicants", applicants);
  }, [applicants]);

  const handleDeleteClick = (id: number, name: string, applicantType: string) => {
    if (isReadOnlyMode) return;
    const applicantToRemove = applicants.find((applicant) => applicant.id === id);
    if (!applicantToRemove) return;

    if (
      applicantToRemove.applicantType === "Licensed Site Supervisor" ||
      isLoggedInApplicantRow(applicantToRemove)
    ) {
      return;
    }

    setDeleteConfirmation({
      open: true,
      applicantId: id,
      applicantName: name,
      applicantType: applicantType,
    });
  };

  const handleConfirmDelete = () => {
    if (deleteConfirmation.applicantId !== null) {
      void handleRemoveApplicant(deleteConfirmation.applicantId);
      setDeleteConfirmation({ open: false, applicantId: null, applicantName: "", applicantType: "" });
    }
  };

  const handleCancelDelete = () => {
    setDeleteConfirmation({ open: false, applicantId: null, applicantName: "", applicantType: "" });
  };

  const handleChangeOwnerClick = (applicant: ApplicantRow) => {
    if (isReadOnlyMode || !canManageProjectOwner) return;
    if (!isOwnerApplicantType(applicant.applicantType)) return;
    setChangingOwner(true);
    setOwnerAwaitingReplacement(false);
    setValue("applicantType", "Owner");
    setValue("plumbingConsultant", "");
    setIsSaved(false);
  };

  const handleRemoveApplicant = async (id: number) => {
    if (isReadOnlyMode) return;
    const applicantToRemove = applicants.find((applicant) => applicant.id === id);
    if (!applicantToRemove) return;

    if (
      applicantToRemove.applicantType === "Licensed Site Supervisor" ||
      isLoggedInApplicantRow(applicantToRemove)
    ) {
      return;
    }

    const removingOwner = isOwnerApplicantType(applicantToRemove.applicantType);
    if (removingOwner && canManageProjectOwner) {
      setOwnerAwaitingReplacement(true);
      setChangingOwner(false);
    }

    const updatedApplicants = sortApplicantsOwnerFirst(
      applicants.filter((applicant) => applicant.id !== id)
    );
    setApplicants(updatedApplicants);
    saveDraft("draft-applicant-details-applicants", updatedApplicants);

    if (!projectId) return;

    // Persist roster without Owner; keep projects.user_id until a new Owner is saved.
    const ok = await persistApplicantsToProject(updatedApplicants, { syncProjectOwner: false });
    if (!ok) {
      setApplicants(applicants);
      saveDraft("draft-applicant-details-applicants", applicants);
      if (removingOwner && canManageProjectOwner) {
        setOwnerAwaitingReplacement(false);
      }
      return;
    }

    if (removingOwner && canManageProjectOwner) {
      setValue("applicantType", "Owner");
      setIsSaved(false);
      showAlert({
        title: "Owner removed",
        message:
          "Select a new Owner from the directory and Save to update the project. Update Project stays blocked until an Owner is saved.",
      });
    }
  };

  const isArchitectCreatingProject =
    canCreateProjectAsArchitect(userMetadata) && !isEditMode && !isReadOnlyMode;

  if (isLoading) {
    return (
      <div className="max-w-6xl mx-auto px-6 pt-8 space-y-6">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading project data...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
    <div className="max-w-6xl mx-auto px-6 space-y-6">
        <div className="space-y-6 pt-8">
        <div className="border border-gray-200 rounded-2xl bg-white flex flex-col shadow-sm">
          <div className="bg-white border-b border-gray-200 px-6 py-4 rounded-t-2xl">
            <h2 className="text-xl font-bold text-gray-900">Applicants</h2>
            {isArchitectCreatingProject && (
              <p className="text-sm text-amber-900 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mt-3">
                Add a project Owner from the directory before submitting the project. The owner
                will sign applications in In Process; you can manage everything else.
              </p>
            )}
            {canManageProjectOwner && (ownerAwaitingReplacement || changingOwner) && (
              <p className="text-sm text-amber-900 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mt-3">
                {changingOwner
                  ? "Select a new Owner from the directory below and Save. That updates the applicants roster and projects.user_id together."
                  : "Owner removed from the roster. Select a new Owner from the directory and Save to set the project owner. Update Project stays blocked until then."}
              </p>
            )}
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm text-gray-900 border-collapse">
                <thead className="bg-white uppercase text-xs">
                  <tr>
                    <th className="border-r border-b border-gray-200 px-4 py-3 text-left bg-white">#</th>
                    <th className="border-r border-b border-gray-200 px-4 py-3 text-left bg-white">Applicant</th>
                    <th className="border-r border-b border-gray-200 px-4 py-3 text-left bg-white">Name / Contact No.</th>
                    <th className="border-r border-b border-gray-200 px-4 py-3 text-left bg-white">Registration No.</th>
                    <th className="border-r border-b border-gray-200 px-4 py-3 text-left bg-white">License Issue Date</th>
                    <th className="border-r border-b border-gray-200 px-4 py-3 text-left bg-white">PAN No.</th>
                    <th className="border-r border-b border-gray-200 px-4 py-3 text-left bg-white">Address</th>
                    <th className="border-b border-gray-200 px-4 py-3 text-left bg-white">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {applicants.map((applicant, index) => (
                    <tr key={applicant.id}>
                      <td className={`border-r ${index !== applicants.length - 1 ? "border-b" : ""} border-gray-200 px-4 py-3 text-center`}>{applicant.id}</td>
                      <td className={`border-r ${index !== applicants.length - 1 ? "border-b" : ""} border-gray-200 px-4 py-3`}>{applicant.applicantType}</td>
                      <td className={`border-r ${index !== applicants.length - 1 ? "border-b" : ""} border-gray-200 px-4 py-3`}>
                        <p className="font-semibold text-gray-900">{applicant.name}</p>
                        <p className="text-xs text-gray-600">Ph: {applicant.contactNumber}</p>
                        <p className="text-xs text-gray-600">Email: {applicant.email}</p>
                      </td>
                      <td className={`border-r ${index !== applicants.length - 1 ? "border-b" : ""} border-gray-200 px-4 py-3`}>{applicant.registrationNo}</td>
                      <td className={`border-r ${index !== applicants.length - 1 ? "border-b" : ""} border-gray-200 px-4 py-3`}>{applicant.licenseIssueDate || "-"}</td>
                      <td className={`border-r ${index !== applicants.length - 1 ? "border-b" : ""} border-gray-200 px-4 py-3`}>{applicant.panNo || "-"}</td>
                      <td className={`border-r ${index !== applicants.length - 1 ? "border-b" : ""} border-gray-200 px-4 py-3`}>{applicant.residentialAddress}</td>
                      <td className={`${index !== applicants.length - 1 ? "border-b" : ""} border-gray-200 px-4 py-3`}>
                        {(() => {
                          const isOwnerRow = isOwnerApplicantType(applicant.applicantType);
                          const isLoggedInUserEntry = isLoggedInApplicantRow(applicant);
                          const deleteDisabled =
                            isReadOnlyMode ||
                            applicant.applicantType === "Licensed Site Supervisor" ||
                            isLoggedInUserEntry;
                          const showChangeOwner =
                            canManageProjectOwner && isOwnerRow && !isReadOnlyMode && !changingOwner;

                          return (
                            <div className="flex flex-col items-start gap-1">
                              {showChangeOwner && (
                                <button
                                  type="button"
                                  className="text-sm text-emerald-700 hover:underline"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    handleChangeOwnerClick(applicant);
                                  }}
                                >
                                  Change
                                </button>
                              )}
                              <button
                                type="button"
                                className={`text-sm ${
                                  deleteDisabled
                                    ? "text-gray-400 cursor-not-allowed pointer-events-none"
                                    : "text-red-600 hover:underline"
                                }`}
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  if (deleteDisabled) {
                                    return;
                                  }
                                  handleDeleteClick(applicant.id, applicant.name, applicant.applicantType);
                                }}
                                disabled={deleteDisabled}
                                aria-disabled={deleteDisabled}
                              >
                                Delete
                              </button>
                            </div>
                          );
                        })()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {!isReadOnlyMode && (
          <form onSubmit={handleSubmit(onSubmit)} className="border border-gray-200 rounded-2xl bg-white flex flex-col shadow-sm">
            {/* Header */}
            <div className="bg-white border-b border-gray-200 px-6 py-4 flex flex-wrap items-start justify-between gap-4 rounded-t-2xl">
              <div>
                <h2 className="text-xl font-bold text-gray-900">Applicant / Authorized Person Details</h2>
                <p className="text-sm text-gray-600 mt-1">
                  Provide applicant/authorized person information. Ensure the details match the submitted documents.
                </p>
              </div>
              {!isReadOnlyMode && (
                <button
                  type="submit"
                  className={`px-6 py-2 rounded-lg font-semibold ${
                    isSaved ? BTN_PRIMARY : BTN_SAVE_UNSAVED
                  }`}
                >
                  {isSaved ? "Saved" : "Save"}
                </button>
              )}
            </div>

            <fieldset
              disabled={isReadOnlyMode}
              className={
                isReadOnlyMode
                  ? "pt-6 space-y-6 px-6 pb-6 [&_input]:cursor-not-allowed [&_textarea]:cursor-not-allowed [&_select]:cursor-not-allowed [&_button]:cursor-not-allowed [&_[role='button']]:cursor-not-allowed"
                  : "pt-6 space-y-6 px-6 pb-6"
              }
            >
            {isLocked && (
              <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
                <svg
                  className="h-4 w-4 text-emerald-700"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 11c1.657 0 3-1.343 3-3S13.657 5 12 5 9 6.343 9 8s1.343 3 3 3zm6 10H6a2 2 0 01-2-2v-5a4 4 0 014-4h8a4 4 0 014 4v5a2 2 0 01-2 2z"
                  />
                </svg>
                <span>Fields are locked because this applicant was selected from the directory.</span>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block font-medium text-black mb-1">
                  Applicant / Authorized Person <span className="text-red-500">*</span>
                </label>
                <input
                  type="hidden"
                  {...register("applicantType", { required: "This field is required" })}
                />
                <CustomSelect
                  value={watch("applicantType") || ""}
                  onChange={(val) => setValue("applicantType", val, { shouldValidate: true })}
                  options={availableApplicantTypes.map((type) => ({ value: type, label: type }))}
                  placeholder="Select"
                />
                {errors.applicantType && <p className="text-red-600 text-sm mt-1">{errors.applicantType.message}</p>}
              </div>


                <div>
                  <label className="block font-medium text-black mb-1">
                  Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="hidden"
                    {...register("plumbingConsultant", {
                      required: `Please select a ${selectedApplicantType?.toLowerCase() || "record"}`,
                    })}
                  />
                  <CustomSelect
                    value={
                      watch("plumbingConsultant") === NEW_USER_SENTINEL
                        ? ""
                        : watch("plumbingConsultant") || ""
                    }
                    onChange={(val) => {
                      if (val === NEW_USER_SENTINEL) {
                        setShowNewUserModal(true);
                        setValue("plumbingConsultant", "", { shouldValidate: false });
                        resetApplicantFields();
                        setIsFormAutofilled(false);
                        return;
                      }
                      setValue("plumbingConsultant", val, { shouldValidate: true });
                    }}
                    options={[
                      ...(canAddNewUser
                        ? [{ value: NEW_USER_SENTINEL, label: "+ New User" }]
                        : []),
                      ...directoryOptions.map((entry) => ({
                        value: entry.id,
                        label: entry.fullName,
                      })),
                    ]}
                    placeholder={
                      directoryOptions.length === 0
                        ? canAddNewUser
                          ? `No ${selectedApplicantType} found — add new`
                          : `No ${selectedApplicantType} found`
                        : `Select ${selectedApplicantType}`
                    }
                    disabled={!selectedApplicantType}
                  />
                  {errors.plumbingConsultant && (
                    <p className="text-red-600 text-sm mt-1">{errors.plumbingConsultant.message}</p>
                  )}
              </div>
              </div>

              <div>
                <label className="block font-medium text-black mb-1">
                  Residential Address <span className="text-red-500">*</span>
                </label>
                <textarea
                  {...register("residentialAddress", { required: "Residential address is required" })}
                className={`${textareaClasses} h-10 overflow-x-auto overflow-y-hidden whitespace-nowrap ${disabledClasses}`}
                placeholder={selectedDirectoryId ? "" : "Select from directory to auto-fill"}
                readOnly={true}
                />
                {errors.residentialAddress && (
                  <p className="text-red-600 text-sm mt-1">{errors.residentialAddress.message}</p>
                )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block font-medium text-black mb-1">
                  Contact Number <span className="text-red-500">*</span>
                </label>
                <input
                  {...register("contactNumber", {
                    required: "Contact number is required",
                    pattern: {
                      value: /^[0-9]{10}$/,
                      message: "Enter a valid 10-digit number",
                    },
                  })}
                  className={`${inputClasses} ${disabledClasses}`}
                  placeholder={selectedDirectoryId ? "" : "Select from directory to auto-fill"}
                  readOnly={true}
                />
                {errors.contactNumber && <p className="text-red-600 text-sm mt-1">{errors.contactNumber.message}</p>}
              </div>

              <div>
                <label className="block font-medium text-black mb-1">
                  Email Address <span className="text-red-500">*</span>
                </label>
                <input
                  {...register("emailAddress", {
                    required: "Email address is required",
                    pattern: {
                      value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                      message: "Enter a valid email",
                    },
                  })}
                  className={`${inputClasses} ${disabledClasses}`}
                  placeholder={selectedDirectoryId ? "" : "Select from directory to auto-fill"}
                  readOnly={true}
                />
                {errors.emailAddress && <p className="text-red-600 text-sm mt-1">{errors.emailAddress.message}</p>}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block font-medium text-black mb-1">
                  Registration Number <span className="text-red-500">*</span>
                </label>
                <input
                  {...register("registrationNumber", { required: "Registration number is required" })}
                  className={`${inputClasses} ${disabledClasses}`}
                  placeholder={selectedDirectoryId ? "" : "Select from directory to auto-fill"}
                  readOnly={true}
                />
                {errors.registrationNumber && (
                  <p className="text-red-600 text-sm mt-1">{errors.registrationNumber.message}</p>
                )}
              </div>

              <div>
                <label className="block font-medium text-black mb-1">
                  PAN No.
                </label>
                <input
                  {...register("panNo", { 
                    pattern: {
                      value: /^$|^[A-Z]{5}[0-9]{4}[A-Z]{1}$/,
                      message: "Enter a valid PAN (e.g., ABCDE1234F)",
                    },
                  })}
                  className={`${inputClasses} ${disabledClasses}`}
                  placeholder={selectedDirectoryId ? "" : "Select from directory to auto-fill"}
                  readOnly={true}
                  style={{ textTransform: "uppercase" }}
                />
                {errors.panNo && (
                  <p className="text-red-600 text-sm mt-1">{errors.panNo.message}</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block font-medium text-black mb-1">
                  License Issue Date <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  {...register("licenseIssueDate", { 
                    required: "License issue date is required",
                    validate: (value) => {
                      if (!value || value.trim() === "") {
                        return "License issue date is required";
                      }
                      const selected = new Date(value);
                      selected.setHours(0, 0, 0, 0);
                      const today = new Date();
                      today.setHours(0, 0, 0, 0);
                      if (selected > today) {
                        return "License issue date cannot be in the future";
                      }
                      return true;
                    }
                  })}
                  className={`${inputClasses} ${disabledClasses}`}
                  readOnly={true}
                />
                {errors.licenseIssueDate && (
                  <p className="text-red-600 text-sm mt-1">{errors.licenseIssueDate.message}</p>
                )}
              </div>
            </div>
            </fieldset>
          </form>
          )}
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {deleteConfirmation.open && (
          <motion.div
            className="fixed inset-0 z-[10000] flex justify-center items-center bg-black/50 backdrop-blur-sm p-4"
            onClick={handleCancelDelete}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="bg-white w-full max-w-md rounded-xl shadow-2xl p-6 relative"
              onClick={(e) => e.stopPropagation()}
              initial={{ y: -40, opacity: 0, scale: 0.95 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: -40, opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.25 }}
            >
              {/* Close Button */}
              <button
                onClick={handleCancelDelete}
                className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors"
                aria-label="Close modal"
              >
                <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>

              {/* Icon */}
              <div className="flex justify-center mb-4">
                <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center">
                  <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </div>
              </div>

              {/* Title */}
              <h3 className="text-xl font-bold text-gray-900 text-center mb-2">
                Confirm Deletion
              </h3>

              {/* Message */}
              <p className="text-gray-700 text-center mb-6">
                {isOwnerApplicantType(deleteConfirmation.applicantType) && canManageProjectOwner ? (
                  <>
                    Remove <span className="font-semibold text-gray-900">{deleteConfirmation.applicantName}</span> from
                    the applicants roster? You must select a new Owner and Save before Update Project. The project
                    owner id stays unchanged until you save the replacement.
                  </>
                ) : (
                  <>
                    Are you sure you want to delete{" "}
                    <span className="font-semibold text-gray-900">{deleteConfirmation.applicantName}</span> (
                    {deleteConfirmation.applicantType})? This action cannot be undone.
                  </>
                )}
              </p>

              {/* Buttons */}
              <div className="flex justify-end gap-3">
                <button
                  onClick={handleCancelDelete}
                  className="px-6 py-2.5 bg-white text-gray-700 border border-gray-300 rounded-lg font-medium hover:bg-gray-50 transition-colors shadow-sm"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmDelete}
                  className="px-6 py-2.5 bg-red-600 text-white rounded-lg font-medium shadow hover:bg-red-700 transition-colors"
                >
                  Delete
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <ConsultantPartialRegistrationModal
        open={showNewUserModal && canAddNewUser}
        consultantType={selectedApplicantType || ""}
        onClose={() => setShowNewUserModal(false)}
        onSuccess={handleNewUserSuccess}
      />
    </>
  );
}
