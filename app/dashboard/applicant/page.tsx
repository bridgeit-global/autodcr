"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
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
  const isReadOnlyForm = true;

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

  // Load consultants for the selected type from Supabase auth via RPC
  useEffect(() => {
    const loadConsultants = async () => {
      if (!selectedApplicantType) {
        setDirectoryOptions([]);
        return;
      }

      const { data, error } = await supabase.rpc("get_consultants_by_type", {
        p_type: selectedApplicantType,
      });

      if (error) {
        console.error("Error loading consultants by type:", error);
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

    loadConsultants();
  }, [selectedApplicantType]);

  // Ensure logged-in owner is always part of the applicants list (first row)
  useEffect(() => {
    if (!userMetadata) return;

    setApplicants((prev) => {
      // If an Owner row already exists, keep as-is
      const hasOwner = prev.some((a) => a.applicantType === "Owner");
      if (hasOwner) return prev;

      const ownerName =
        userMetadata.first_name + " " + userMetadata.last_name 
        + " " + userMetadata.middle_name ||
        "-";

      const ownerContact = userMetadata.alternate_phone || userMetadata.mobile || "-";
      const ownerEmail = userMetadata.email || "-";
      const ownerAddress = userMetadata.address || "-";

      // Derive registration number and date based on entity_type (same logic as ProfileModal / RegistrationForm)
      let ownerRegistrationNo = "";
      let ownerLicenseIssueDate = "";
      const entityType = userMetadata.entity_type;
      if (entityType === "Pvt. Ltd. / Ltd. Company") {
        ownerRegistrationNo = userMetadata.cin || "";
        ownerLicenseIssueDate = userMetadata.roc_registration_date || "";
      } else if (entityType === "LLP") {
        ownerRegistrationNo = userMetadata.llpin || "";
        ownerLicenseIssueDate = userMetadata.llp_incorporation_date || "";
      } else if (entityType === "Partnership Firm") {
        ownerRegistrationNo = userMetadata.firm_registration_no || "";
        ownerLicenseIssueDate = userMetadata.partnership_registration_date || "";
      } else if (entityType === "Trust / Society") {
        ownerRegistrationNo = userMetadata.trust_registration_no || "";
        ownerLicenseIssueDate = userMetadata.trust_registration_date || "";
      } else if (entityType === "Govt. / PSU / Local Body") {
        ownerRegistrationNo = userMetadata.trust_reg_no || "";
        // No explicit date field in registration form; leave empty
      }
      const ownerPanNo = userMetadata.pan_no || userMetadata.pan || "-";

      const ownerRow: ApplicantRow = {
        id: 1,
        user_id: authUserId ?? undefined,
        applicantType: "Owner",
        name: ownerName,
        contactNumber: ownerContact,
        email: ownerEmail,
        registrationNo: ownerRegistrationNo,
        panNo: ownerPanNo,
        licenseIssueDate: ownerLicenseIssueDate || "-",
        residentialAddress: ownerAddress,
        officeAddress: ownerAddress,
      };

      // Shift existing IDs so Owner stays first with id 1
      const reindexed = prev.map((a, idx) => ({ ...a, id: idx + 2 }));
      return [ownerRow, ...reindexed];
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

  // When a consultant is selected from the dropdown, auto-fill all form fields
  useEffect(() => {
    if (!selectedDirectoryId || !showDirectoryDropdown) {
      setIsFormAutofilled(false);
      return;
    }

    const selectedConsultant = directoryOptions.find((entry) => entry.id === selectedDirectoryId);
    if (selectedConsultant) {
      const opts = { shouldValidate: true, shouldDirty: true, shouldTouch: true } as const;
      setValue("name", selectedConsultant.fullName, opts);
      setValue("contactNumber", selectedConsultant.contactNumber, opts);
      setValue("emailAddress", selectedConsultant.email, opts);
      setValue("residentialAddress", selectedConsultant.address, opts);
      setValue("registrationNumber", selectedConsultant.registrationNumber, opts);
      setValue("panNo", selectedConsultant.pan, opts);
      setValue("licenseIssueDate", selectedConsultant.licenseIssueDate, opts);
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
  const availableApplicantTypes = APPLICANT_TYPE_OPTIONS.filter((type) => {
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

  const onSubmit = (data: ApplicantFormData) => {
    setApplicants((prev) => {
      const nextId = prev.length ? Math.max(...prev.map((item) => item.id)) + 1 : 1;
      const newApplicant = {
        id: nextId,
        // If user picked from directory dropdown, this is the consultant's auth user id.
        // Otherwise, store the creator (logged-in owner) id.
        user_id: (showDirectoryDropdown ? selectedDirectoryId : authUserId) || undefined,
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

  const handleRemoveApplicant = (id: number) => {
    setApplicants((prev) => prev.filter((applicant) => applicant.id !== id));
  };

  return (
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
                    <th className="border-r border-b border-gray-200 px-4 py-3 text-left bg-white">Residential Address</th>
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
                        <button
                          type="button"
                          className={`text-sm ${
                            applicant.applicantType === "Licensed Site Supervisor" ||
                            applicant.applicantType === "Owner"
                              ? "text-gray-400 cursor-not-allowed"
                              : "text-red-600 hover:underline"
                          }`}
                          onClick={() => handleRemoveApplicant(applicant.id)}
                          disabled={
                            applicant.applicantType === "Licensed Site Supervisor" ||
                            applicant.applicantType === "Owner"
                          }
                        >
                          Delete
                        </button>
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
                    ? "bg-green-600 hover:bg-green-700 text-white"
                    : "bg-emerald-600 hover:bg-emerald-700 text-white"
                }`}
              >
                {isSaved ? "Saved" : "Save"}
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
                <>
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
                </>
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
                readOnly={isReadOnlyForm}
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
                  readOnly={isReadOnlyForm}
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
                  readOnly={isReadOnlyForm}
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
                  readOnly={isReadOnlyForm}
                />
                {errors.registrationNumber && (
                  <p className="text-red-600 text-sm mt-1">{errors.registrationNumber.message}</p>
                )}
              </div>

              <div>
                <label className="block font-medium text-black mb-1">
                  PAN No. <span className="text-red-500">*</span>
                </label>
                <input
                  {...register("panNo", { 
                    required: "PAN No. is required",
                    pattern: {
                      value: /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/,
                      message: "Enter a valid PAN (e.g., ABCDE1234F)",
                    },
                  })}
                  className={`${inputClasses} ${disabledClasses}`}
                  placeholder={selectedDirectoryId ? "" : "Select from directory to auto-fill"}
                  readOnly={isReadOnlyForm}
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
                  License Issue Date
                </label>
                <input
                  type="date"
                  {...register("licenseIssueDate")}
                  className={`${inputClasses} ${disabledClasses}`}
                  readOnly={isReadOnlyForm}
                />
              </div>
            </div>
            </div>
          </form>
        </div>
      </div>
  );
}
