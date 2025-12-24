"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { motion, AnimatePresence } from "framer-motion";
import { loadDraft, saveDraft, markPageSaved, isPageSaved } from "@/app/utils/draftStorage";
import { useUserMetadata } from "@/app/contexts/UserContext";
import { supabase } from "@/app/utils/supabase";

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
};

type ConsultantDirectoryEntry = {
  id: string;
  fullName: string;
  email: string;
  contactNumber: string;
  pan: string;
  address: string;
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
export default function ApplicantDetailsPage() {
  const { userMetadata } = useUserMetadata();
  const [authUserId, setAuthUserId] = useState<string | null>(null);

  const [applicants, setApplicants] = useState<ApplicantRow[]>(() =>
    loadDraft<ApplicantRow[]>("draft-applicant-details-applicants", [])
  );
  const [directoryOptions, setDirectoryOptions] = useState<ConsultantDirectoryEntry[]>([]);
  const [isSaved, setIsSaved] = useState(() => isPageSaved("saved-applicant-details"));
  const [isFormAutofilled, setIsFormAutofilled] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState<{ open: boolean; applicantId: number | null; applicantName: string; applicantType: string }>({
    open: false,
    applicantId: null,
    applicantName: "",
    applicantType: "",
  });
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    clearErrors,
    formState: { errors },
    reset,
  } = useForm<ApplicantFormData>({
    defaultValues: loadDraft<ApplicantFormData>("draft-applicant-details-form", {
      applicantType: "",
      plumbingConsultant: "",
      name: "",
      residentialAddress: "",
      contactNumber: "",
      emailAddress: "",
      registrationNumber: "",
      panNo: "",
      licenseIssueDate: "",
    }),
  });

  const inputClasses =
    "border border-gray-200 rounded-xl px-3 py-2 h-10 w-full text-gray-900 bg-white focus:ring-2 focus:ring-emerald-500 outline-none";
  const textareaClasses =
    "border border-gray-200 rounded-xl px-3 py-2 w-full text-gray-900 bg-white focus:ring-2 focus:ring-emerald-500 outline-none resize-none";
  const disabledClasses = "bg-gray-100 cursor-not-allowed";

  const selectedApplicantType = watch("applicantType");
  const selectedDirectoryId = watch("plumbingConsultant");
  // In this flow, users should not type manually; values come only from directory selection.
  // Show the directory dropdown as soon as applicant type is selected.
  const showDirectoryDropdown = !!selectedApplicantType;
  const isLocked = showDirectoryDropdown && Boolean(selectedDirectoryId);

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

  // If the form was previously added (green button) and the user starts editing/adding
  // another applicant, move the button back to blue "Add"
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
          address: row.address || "",
          registrationNumber: row.registration_number || "",
          licenseIssueDate: row.license_issue_date || "",
        })) ?? [];

      setDirectoryOptions(mapped);
    };

    loadDirectoryOptions();
  }, [selectedApplicantType]);

  // Ensure logged-in user (owner or consultant) is always part of the applicants list (first row)
  useEffect(() => {
    if (!userMetadata) return;

    setApplicants((prev) => {
      const userRole = userMetadata.role;
      const isConsultant = userRole === "Consultant";
      const applicantType = isConsultant ? (userMetadata.consultant_type || "") : "Owner";

      // If a row with this applicantType already exists, keep as-is
      const hasExistingRow = prev.some((a) => a.applicantType === applicantType);
      if (hasExistingRow) return prev;

      const userName =
        (userMetadata.first_name || "") + 
        (userMetadata.middle_name ? " " + userMetadata.middle_name : "") + 
        (userMetadata.last_name ? " " + userMetadata.last_name : "") ||
        "-";

      const userContact = userMetadata.alternate_phone || userMetadata.mobile || "-";
      const userEmail = userMetadata.email || "-";
      const userAddress = userMetadata.address || "-";
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
        residentialAddress: userAddress,
        officeAddress: userAddress,
      };

      // Shift existing IDs so logged-in user stays first with id 1
      const reindexed = prev.map((a, idx) => ({ ...a, id: idx + 2 }));
      return [userRow, ...reindexed];
    });
  }, [userMetadata, authUserId]);

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
    if (!selectedDirectoryId || !showDirectoryDropdown) {
      setIsFormAutofilled(false);
      return;
    }

    const selectedEntry = directoryOptions.find((entry) => entry.id === selectedDirectoryId);
    if (selectedEntry) {
      const opts = { shouldValidate: true, shouldDirty: true, shouldTouch: true } as const;
      setValue("name", selectedEntry.fullName, opts);
      setValue("contactNumber", selectedEntry.contactNumber, opts);
      setValue("emailAddress", selectedEntry.email, opts);
      setValue("residentialAddress", selectedEntry.address, opts);
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
  }, [selectedDirectoryId, directoryOptions, showDirectoryDropdown, setValue, clearErrors]);

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
  if (isConsultant && !addedApplicantTypes.includes("Owner")) {
    availableApplicantTypes = ["Owner", ...availableApplicantTypes];
  }

  const onSubmit = (data: ApplicantFormData) => {
    setApplicants((prev) => {
      const nextId = prev.length ? Math.max(...prev.map((item) => item.id)) + 1 : 1;
      // All entries come from directory dropdown (consultants or owners), use their auth user id
      const userId = (showDirectoryDropdown && selectedDirectoryId) ? selectedDirectoryId : undefined;

      const newApplicant = {
        id: nextId,
        user_id: userId,
        applicantType: data.applicantType,
        name: data.name || "-",
        contactNumber: data.contactNumber || "-",
        email: data.emailAddress || "-",
        registrationNo: data.registrationNumber || "-",
        panNo: data.panNo || "-",
        licenseIssueDate: data.licenseIssueDate || "-",
        residentialAddress: data.residentialAddress || "-",
        officeAddress: "-", // Not collected from form anymore
      };

      return [...prev, newApplicant];
    });

    reset();
    setIsFormAutofilled(false);
    markPageSaved("saved-applicant-details");
    setIsSaved(true);
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
    const applicantToRemove = applicants.find((applicant) => applicant.id === id);
    if (!applicantToRemove) return;
    
    // Check if this is the logged-in user's entry
    const isLoggedInUserEntry = 
      authUserId !== null && 
      authUserId !== undefined &&
      (String(applicantToRemove.user_id) === String(authUserId) || 
       (applicantToRemove.id === 1 && userMetadata !== null));
    
    // Don't show confirmation for logged-in user's entry or Licensed Site Supervisor
    if (
      applicantToRemove.applicantType === "Licensed Site Supervisor" ||
      isLoggedInUserEntry
    ) {
      return;
    }
    
    // Show confirmation modal
    setDeleteConfirmation({
      open: true,
      applicantId: id,
      applicantName: name,
      applicantType: applicantType,
    });
  };

  const handleConfirmDelete = () => {
    if (deleteConfirmation.applicantId !== null) {
      handleRemoveApplicant(deleteConfirmation.applicantId);
      setDeleteConfirmation({ open: false, applicantId: null, applicantName: "", applicantType: "" });
    }
  };

  const handleCancelDelete = () => {
    setDeleteConfirmation({ open: false, applicantId: null, applicantName: "", applicantType: "" });
  };

  const handleRemoveApplicant = (id: number) => {
    setApplicants((prev) => {
      const applicantToRemove = prev.find((applicant) => applicant.id === id);
      // Prevent deletion if applicant belongs to logged-in user or is Licensed Site Supervisor
      if (!applicantToRemove) return prev;
      
      // Check if this is the logged-in user's entry
      // Compare by user_id (exact match) or by id === 1 (logged-in user is always first)
      const isLoggedInUserEntry = 
        authUserId !== null && 
        authUserId !== undefined &&
        (String(applicantToRemove.user_id) === String(authUserId) || 
         (applicantToRemove.id === 1 && userMetadata !== null));
      
      if (
        applicantToRemove.applicantType === "Licensed Site Supervisor" ||
        isLoggedInUserEntry
      ) {
        return prev;
      }
      return prev.filter((applicant) => applicant.id !== id);
    });
  };

  return (
    <>
    <div className="max-w-6xl mx-auto px-6 space-y-6">
        <div className="space-y-6">
        <div className="border border-gray-200 rounded-2xl bg-white flex flex-col shadow-sm">
          <div className="bg-white border-b border-gray-200 px-6 py-4 rounded-t-2xl">
            <h2 className="text-xl font-bold text-gray-900">Applicants</h2>
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
                          // Check if this is the logged-in user's entry
                          // Compare by user_id (exact match) or by id === 1 (logged-in user is always first)
                          const isLoggedInUserEntry = 
                            authUserId !== null && 
                            authUserId !== undefined &&
                            (String(applicant.user_id) === String(authUserId) || 
                             (applicant.id === 1 && userMetadata !== null));
                          
                          const isDisabled = 
                            applicant.applicantType === "Licensed Site Supervisor" ||
                            isLoggedInUserEntry;
                          
                          return (
                            <button
                              type="button"
                              className={`text-sm ${
                                isDisabled
                                  ? "text-gray-400 cursor-not-allowed pointer-events-none"
                                  : "text-red-600 hover:underline"
                              }`}
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                if (isDisabled) {
                                  return;
                                }
                                handleDeleteClick(applicant.id, applicant.name, applicant.applicantType);
                              }}
                              disabled={isDisabled}
                              aria-disabled={isDisabled}
                            >
                              Delete
                            </button>
                          );
                        })()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="border border-gray-200 rounded-2xl bg-white flex flex-col shadow-sm">
            {/* Header */}
            <div className="bg-white border-b border-gray-200 px-6 py-4 flex flex-wrap items-start justify-between gap-4 rounded-t-2xl">
              <div>
                <h2 className="text-xl font-bold text-gray-900">Applicant / Authorized Person Details</h2>
                <p className="text-sm text-gray-600 mt-1">
                  Provide applicant/authorized person information. Ensure the details match the submitted documents.
                </p>
              </div>
              <button
                type="submit"
                className={`px-6 py-2 rounded-lg font-semibold shadow transition-colors ${
                  isSaved
                    ? "bg-emerald-700 hover:bg-emerald-800 text-white"
                    : "bg-emerald-200 hover:bg-emerald-300 text-emerald-800"
                }`}
              >
                {isSaved ? "Added" : "Add"}
              </button>
            </div>

            <div className="pt-6 space-y-6 px-6 pb-6">
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
                <select
                  {...register("applicantType", { required: "This field is required" })}
                  className={inputClasses}
                >
                  <option value="">Select</option>
                  {availableApplicantTypes.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
                {errors.applicantType && <p className="text-red-600 text-sm mt-1">{errors.applicantType.message}</p>}
              </div>


                <div>
                  <label className="block font-medium text-black mb-1">
                  Name <span className="text-red-500">*</span>
                  </label>
                  <select
                    {...register("plumbingConsultant", {
                      required: `Please select a ${selectedApplicantType?.toLowerCase() || "record"}`,
                    })}
                    className={`${inputClasses} ${directoryOptions.length === 0 ? disabledClasses : ""}`}
                    disabled={directoryOptions.length === 0}
                  >
                    <option value="">
                      {directoryOptions.length === 0
                        ? `No ${selectedApplicantType} found`
                        : `Select ${selectedApplicantType}`}
                    </option>
                    {directoryOptions.map((entry) => (
                      <option key={entry.id} value={entry.id}>
                        {entry.fullName}
                      </option>
                    ))}
                  </select>
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
                className={`${textareaClasses} h-10 ${disabledClasses}`}
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
            </div>
          </form>
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
                Are you sure you want to delete <span className="font-semibold text-gray-900">{deleteConfirmation.applicantName}</span> ({deleteConfirmation.applicantType})? This action cannot be undone.
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
    </>
  );
}
