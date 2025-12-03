"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { loadDraft, saveDraft, markPageSaved } from "@/app/utils/draftStorage";

type ApplicantFormData = {
  applicantType: string;
  plumbingConsultant?: string;
  name: string;
  officeAddress: string;
  residentialAddress: string;
  contactNumber: string;
  emailAddress: string;
  registrationNumber: string;
  licenseIssueDate: string;
  licenseExpiryDate: string;
};

const SAMPLE_APPLICANTS = [
  {
    id: 1,
    applicantType: "Licensed Site Supervisor",
    name: "Adani Electricity Mumbai Ltd.",
    contactNumber: "9967180886",
    email: "enquiry@dadamiya.com",
    registrationNo: "REG/MCGM/TEMP",
    licenseIssueDate: "-",
    licenseExpiryDate: "-",
    residentialAddress:
      "CTS 407/A (New), 408 Old Village Eksar Devidas Lane, Off SVP Road, Borivali (W), Mumbai 400103.",
    officeAddress:
      "CTS 407/A (New), 408 Old Village Eksar Devidas Lane, Off SVP Road, Borivali (W), Mumbai 400103.",
  }
];

const APPLICANT_TYPE_OPTIONS = [
  "Licensed Site Supervisor",
  "Licensed Plumber",
  "Others (Consultants/Third Party Agencies for Clearances)",
  "Registered Licensed Fire Agency",
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

const FIRE_AGENCIES: ApplicantDirectoryEntry[] = [
  {
    id: "fire-1",
    name: "Fire Safety Solutions Mumbai",
    contactNumber: "9988776655",
    emailAddress: "safety@firesolutionsmumbai.com",
    registrationNumber: "REG/FIRE/2023/089",
    licenseIssueDate: "2023-05-12",
    licenseExpiryDate: "2026-05-12",
    residentialAddress: "C-15, Sunrise Apartments, Goregaon West, Mumbai 400104",
    officeAddress: "Unit 401, Industrial Estate, Goregaon East, Mumbai 400063",
  },
  {
    id: "fire-2",
    name: "Metro Fire Compliance Agency",
    contactNumber: "9812345678",
    emailAddress: "hello@metrofireagency.com",
    registrationNumber: "REG/FIRE/2023/120",
    licenseIssueDate: "2023-07-01",
    licenseExpiryDate: "2026-07-01",
    residentialAddress: "D-602, Ocean Heights, Versova, Mumbai 400061",
    officeAddress: "Suite 1204, Business Bay, Andheri East, Mumbai 400059",
  },
];

const APPLICANT_DIRECTORIES: Record<string, ApplicantDirectoryEntry[]> = {
  "Licensed Site Supervisor": LICENSED_SITE_SUPERVISORS,
  "Licensed Plumber": PLUMBERS,
  "Others (Consultants/Third Party Agencies for Clearances)": CONSULTANTS,
  "Registered Licensed Fire Agency": FIRE_AGENCIES,
};

export default function ApplicantDetailsPage() {
  const [applicants, setApplicants] = useState(SAMPLE_APPLICANTS);
  const [isFormAutofilled, setIsFormAutofilled] = useState(false);
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
    reset,
  } = useForm<ApplicantFormData>({
    defaultValues: loadDraft<ApplicantFormData>("draft-applicant-details-form", {
      applicantType: "",
      plumbingConsultant: "",
      name: "",
      officeAddress: "",
      residentialAddress: "",
      contactNumber: "",
      emailAddress: "",
      registrationNumber: "",
      licenseIssueDate: "",
      licenseExpiryDate: "",
    }),
  });

  const inputClasses =
    "border border-black rounded-lg px-3 py-2 h-10 w-full text-black focus:ring-2 focus:ring-blue-500 outline-none";
  const textareaClasses =
    "border border-black rounded-lg px-3 py-2 w-full text-black focus:ring-2 focus:ring-blue-500 outline-none resize-none";
  const disabledClasses = "bg-gray-100 cursor-not-allowed";

  const selectedApplicantType = watch("applicantType");
  const selectedDirectoryId = watch("plumbingConsultant");
  const directoryOptions = selectedApplicantType ? APPLICANT_DIRECTORIES[selectedApplicantType] ?? [] : [];
  const showDirectoryDropdown = selectedApplicantType ? directoryOptions.length > 0 : false;

  const resetApplicantFields = () => {
    const fieldsToClear: (keyof ApplicantFormData)[] = [
      "name",
      "officeAddress",
      "residentialAddress",
      "contactNumber",
      "emailAddress",
      "registrationNumber",
      "licenseIssueDate",
      "licenseExpiryDate",
    ];
    fieldsToClear.forEach((field) => setValue(field, ""));
  };

  useEffect(() => {
    if (!selectedApplicantType) {
      return;
    }
    setValue("plumbingConsultant", "");
    resetApplicantFields();
    setIsFormAutofilled(false);
  }, [selectedApplicantType, setValue]);

  useEffect(() => {
    if (!selectedApplicantType || !selectedDirectoryId) {
      setIsFormAutofilled(false);
      return;
    }

    const directory = APPLICANT_DIRECTORIES[selectedApplicantType];
    if (!directory) {
      setIsFormAutofilled(false);
      return;
    }

    const selectedEntry = directory.find((entry) => entry.id === selectedDirectoryId);
    if (selectedEntry) {
      setValue("name", selectedEntry.name);
      setValue("contactNumber", selectedEntry.contactNumber);
      setValue("emailAddress", selectedEntry.emailAddress);
      setValue("registrationNumber", selectedEntry.registrationNumber);
      setValue("licenseIssueDate", selectedEntry.licenseIssueDate);
      setValue("licenseExpiryDate", selectedEntry.licenseExpiryDate);
      setValue("residentialAddress", selectedEntry.residentialAddress);
      setValue("officeAddress", selectedEntry.officeAddress);
      setIsFormAutofilled(true);
    } else {
      setIsFormAutofilled(false);
    }
  }, [selectedApplicantType, selectedDirectoryId, setValue]);

  // Get applicant types that are already added
  const addedApplicantTypes = applicants.map((applicant) => applicant.applicantType);
  
  // Filter out already added applicant types from dropdown options
  const availableApplicantTypes = APPLICANT_TYPE_OPTIONS.filter(
    (type) => !addedApplicantTypes.includes(type)
  );

  const onSubmit = (data: ApplicantFormData) => {
    setApplicants((prev) => {
      const nextId = prev.length ? Math.max(...prev.map((item) => item.id)) + 1 : 1;
      const newApplicant = {
        id: nextId,
        applicantType: data.applicantType,
        name: data.name || "-",
        contactNumber: data.contactNumber || "-",
        email: data.emailAddress || "-",
        registrationNo: data.registrationNumber || "-",
        licenseIssueDate: data.licenseIssueDate || "-",
        licenseExpiryDate: data.licenseExpiryDate || "-",
        residentialAddress: data.residentialAddress || "-",
        officeAddress: data.officeAddress || "-",
      };

      return [...prev, newApplicant];
    });

    reset();
    setIsFormAutofilled(false);
    markPageSaved("saved-applicant-details");
  };

  // Persist draft as user types
  useEffect(() => {
    const subscription = watch((value) => {
      saveDraft("draft-applicant-details-form", value as ApplicantFormData);
    });
    return () => subscription.unsubscribe();
  }, [watch]);

  const handleRemoveApplicant = (id: number) => {
    setApplicants((prev) => prev.filter((applicant) => applicant.id !== id));
  };

  return (
    <div className="max-w-6xl mx-auto px-6 space-y-6 ">
        <div className="space-y-6">
          <div className="border border-black rounded-lg bg-white flex flex-col max-h-[70vh] overflow-hidden">
            <div className="sticky top-0 z-10 bg-white border-b border-black px-6 py-4">
              <h2 className="text-xl font-bold text-black">Applicants</h2>
            </div>
            <div className="overflow-x-auto overflow-y-auto">
              <table className="min-w-full text-sm text-black border-collapse">
                <thead className="bg-white uppercase text-xs sticky top-0 z-10">
                  <tr>
                    <th className="border-r border-b border-black px-4 py-3 text-left bg-white">#</th>
                    <th className="border-r border-b border-black px-4 py-3 text-left bg-white">Applicant</th>
                    <th className="border-r border-b border-black px-4 py-3 text-left bg-white">Name / Contact No.</th>
                    <th className="border-r border-b border-black px-4 py-3 text-left bg-white">Registration No.</th>
                    <th className="border-r border-b border-black px-4 py-3 text-left bg-white">License Issue Date</th>
                    <th className="border-r border-b border-black px-4 py-3 text-left bg-white">License Expiry Date</th>
                    <th className="border-r border-b border-black px-4 py-3 text-left bg-white">Residential Address</th>
                    <th className="border-r border-b border-black px-4 py-3 text-left bg-white">Office Address</th>
                    <th className="border-b border-black px-4 py-3 text-left bg-white">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {applicants.map((applicant, index) => (
                    <tr key={applicant.id}>
                      <td className={`border-r ${index !== applicants.length - 1 ? 'border-b' : ''} border-black px-4 py-3 text-center`}>{applicant.id}</td>
                      <td className={`border-r ${index !== applicants.length - 1 ? 'border-b' : ''} border-black px-4 py-3`}>{applicant.applicantType}</td>
                      <td className={`border-r ${index !== applicants.length - 1 ? 'border-b' : ''} border-black px-4 py-3`}>
                        <p className="font-semibold text-black">{applicant.name}</p>
                        <p className="text-xs text-black">Ph: {applicant.contactNumber}</p>
                        <p className="text-xs text-black">Email: {applicant.email}</p>
                      </td>
                      <td className={`border-r ${index !== applicants.length - 1 ? 'border-b' : ''} border-black px-4 py-3`}>{applicant.registrationNo}</td>
                      <td className={`border-r ${index !== applicants.length - 1 ? 'border-b' : ''} border-black px-4 py-3`}>{applicant.licenseIssueDate || "-"}</td>
                      <td className={`border-r ${index !== applicants.length - 1 ? 'border-b' : ''} border-black px-4 py-3`}>{applicant.licenseExpiryDate || "-"}</td>
                      <td className={`border-r ${index !== applicants.length - 1 ? 'border-b' : ''} border-black px-4 py-3`}>{applicant.residentialAddress}</td>
                      <td className={`border-r ${index !== applicants.length - 1 ? 'border-b' : ''} border-black px-4 py-3`}>{applicant.officeAddress}</td>
                      <td className={`${index !== applicants.length - 1 ? 'border-b' : ''} border-black px-4 py-3`}>
                        <button
                          type="button"
                          className={`text-sm ${
                            applicant.applicantType === "Licensed Site Supervisor"
                              ? "text-gray-400 cursor-not-allowed"
                              : "text-red-600 hover:underline"
                          }`}
                          onClick={() => handleRemoveApplicant(applicant.id)}
                          disabled={applicant.applicantType === "Licensed Site Supervisor"}
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

          <form
            onSubmit={handleSubmit(onSubmit)}
            className="border border-black rounded-lg bg-white flex flex-col max-h-[70vh] overflow-hidden"
          >
            {/* Sticky header */}
            <div className="sticky top-0 z-10 bg-white border-b border-black px-6 py-4 flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-black">Applicant / Authorized Person Details</h2>
                <p className="text-sm text-black mt-1">
                  Provide applicant/authorized person information. Ensure the details match the submitted documents.
                </p>
              </div>
              <button
                type="submit"
                className="bg-sky-700 hover:bg-sky-800 text-white px-6 py-2 rounded-lg font-semibold shadow transition-colors"
              >
                Save
              </button>
            </div>

            <div className="pt-6 space-y-6 overflow-y-auto px-6 pb-6">

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

              {showDirectoryDropdown && (
                <div>
                  <label className="block font-medium text-black mb-1">
                    Select Others (Consultants/Third Party Agencies for Clearances){" "}
                    <span className="text-red-500">*</span>
                  </label>
                  <select
                    {...register("plumbingConsultant", {
                      required: `Please select a ${selectedApplicantType?.toLowerCase() || "record"}`,
                    })}
                    className={`${inputClasses} ${isFormAutofilled ? disabledClasses : ''}`}
                    disabled={isFormAutofilled}
                  >
                    <option value="">Select {selectedApplicantType}</option>
                    {directoryOptions.map((entry) => (
                      <option key={entry.id} value={entry.id}>
                        {entry.name}
                      </option>
                    ))}
                  </select>
                  {errors.plumbingConsultant && (
                    <p className="text-red-600 text-sm mt-1">{errors.plumbingConsultant.message}</p>
                  )}
                </div>
              )}

              <div>
                <label className="block font-medium text-black mb-1">
                  Name <span className="text-red-500">*</span>
                </label>
                <input
                  {...register("name", { required: "Name is required" })}
                  className={`${inputClasses} ${isFormAutofilled ? disabledClasses : ''}`}
                  placeholder="Enter name"
                  disabled={isFormAutofilled}
                />
                {errors.name && <p className="text-red-600 text-sm mt-1">{errors.name.message}</p>}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block font-medium text-black mb-1">
                  Office Address (Other than site office) <span className="text-red-500">*</span>
                </label>
                <textarea
                  {...register("officeAddress", { required: "Office address is required" })}
                  className={`${textareaClasses} ${isFormAutofilled ? disabledClasses : ''}`}
                  style={{ minHeight: "120px" }}
                  placeholder="Enter office address"
                  disabled={isFormAutofilled}
                />
                {errors.officeAddress && <p className="text-red-600 text-sm mt-1">{errors.officeAddress.message}</p>}
              </div>

              <div>
                <label className="block font-medium text-black mb-1">
                  Residential Address <span className="text-red-500">*</span>
                </label>
                <textarea
                  {...register("residentialAddress", { required: "Residential address is required" })}
                  className={`${textareaClasses} ${isFormAutofilled ? disabledClasses : ''}`}
                  style={{ minHeight: "120px" }}
                  placeholder="Enter residential address"
                  disabled={isFormAutofilled}
                />
                {errors.residentialAddress && (
                  <p className="text-red-600 text-sm mt-1">{errors.residentialAddress.message}</p>
                )}
              </div>
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
                  className={`${inputClasses} ${isFormAutofilled ? disabledClasses : ''}`}
                  placeholder="Enter contact number"
                  disabled={isFormAutofilled}
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
                  className={`${inputClasses} ${isFormAutofilled ? disabledClasses : ''}`}
                  placeholder="Enter email address"
                  disabled={isFormAutofilled}
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
                  className={`${inputClasses} ${isFormAutofilled ? disabledClasses : ''}`}
                  placeholder="Enter registration number"
                  disabled={isFormAutofilled}
                />
                {errors.registrationNumber && (
                  <p className="text-red-600 text-sm mt-1">{errors.registrationNumber.message}</p>
                )}
              </div>

              <div>
                <label className="block font-medium text-black mb-1">
                  License Issue Date <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  {...register("licenseIssueDate", { required: "License issue date is required" })}
                  className={`${inputClasses} ${isFormAutofilled ? disabledClasses : ''}`}
                  disabled={isFormAutofilled}
                />
                {errors.licenseIssueDate && (
                  <p className="text-red-600 text-sm mt-1">{errors.licenseIssueDate.message}</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block font-medium text-black mb-1">
                  License Expiry Date <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  {...register("licenseExpiryDate", { required: "License expiry date is required" })}
                  className={`${inputClasses} ${isFormAutofilled ? disabledClasses : ''}`}
                  disabled={isFormAutofilled}
                />
                {errors.licenseExpiryDate && (
                  <p className="text-red-600 text-sm mt-1">{errors.licenseExpiryDate.message}</p>
                )}
              </div>
            </div>
            </div>
          </form>
        </div>
      </div>
  );
}
