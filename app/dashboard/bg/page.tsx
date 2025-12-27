"use client";

import { useMemo, useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { useRouter } from "next/navigation";
import { loadDraft, saveDraft, markPageSaved, isPageSaved } from "@/app/utils/draftStorage";
import { useProjectData } from "@/app/hooks/useProjectData";
import { supabase } from "@/app/utils/supabase";

type BGFormData = {
  zone: string;
  proposalNo: string;
  bgNumber: string;
  bgDate: string;
  bankName: string;
  branchName: string;
  amount: string;
  bgValidDate: string;
  bgBankEmail: string;
  scanCopyName: string;
};

type BGEntry = BGFormData & {
  id: string;
};

const zoneOptions = ["City", "Eastern Suburb", "Western Suburb I", "Western Suburb II", "BP Special Cell"];

const createId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);

type RequiredPage = {
  key: string;
  label: string;
  path: string;
};

const REQUIRED_PAGES: RequiredPage[] = [
  { key: "saved-project-details", label: "Project Details", path: "/dashboard/project-details" },
  { key: "saved-applicant-details", label: "Applicant Details", path: "/dashboard/applicant" },
  { key: "saved-building-details", label: "Building Details", path: "/dashboard/building" },
  { key: "saved-area-details", label: "Area Details", path: "/dashboard/area" },
  { key: "saved-project-library", label: "Project Library", path: "/dashboard/project-library" },
  { key: "saved-bg-details", label: "BG Details", path: "/dashboard/bg" },
];

export default function BGDetailsPage() {
  const router = useRouter();
  const { isEditMode, isLoading, projectData } = useProjectData();
  const [entry, setEntry] = useState<BGEntry | null>(() => {
    const savedEntries = loadDraft<BGEntry[]>("draft-bg-details-entries", []);
    return savedEntries.length > 0 ? savedEntries[0] : null;
  });
  const [activeTab, setActiveTab] = useState<"bg-details" | "bg-refund">(
    loadDraft<"bg-details" | "bg-refund">("draft-bg-details-active-tab", "bg-details")
  );
  // Start as "not saved" so the button shows Add/Update until user explicitly saves.
  const [isSaved, setIsSaved] = useState(false);

  const inputClasses =
    "border border-gray-200 rounded-xl px-3 py-2 h-10 w-full text-gray-900 bg-white focus:ring-2 focus:ring-emerald-500 outline-none";

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors },
    watch,
  } = useForm<BGFormData>({
    defaultValues: (() => {
      const savedEntry = loadDraft<BGEntry[]>("draft-bg-details-entries", [])[0];
      const draftForm = loadDraft<BGFormData>("draft-bg-details-form", {
        zone: "",
        proposalNo: "",
        bgNumber: "",
        bgDate: "",
        bankName: "",
        branchName: "",
        amount: "",
        bgValidDate: "",
        bgBankEmail: "",
        scanCopyName: "",
      });
      // Pre-fill form with existing entry if available
      if (savedEntry) {
        return {
          zone: savedEntry.zone || "",
          proposalNo: savedEntry.proposalNo || "",
          bgNumber: savedEntry.bgNumber || "",
          bgDate: savedEntry.bgDate || "",
          bankName: savedEntry.bankName || "",
          branchName: savedEntry.branchName || "",
          amount: savedEntry.amount || "",
          bgValidDate: savedEntry.bgValidDate || "",
          bgBankEmail: savedEntry.bgBankEmail || "",
          scanCopyName: savedEntry.scanCopyName || "",
        };
      }
      return draftForm;
    })(),
  });

  const onSubmit = async (data: BGFormData) => {
    try {
      // Only one entry allowed - replace existing or create new
      const newEntry: BGEntry = { 
        ...data, 
        id: entry?.id || createId() 
      };
      setEntry(newEntry);
      saveDraft("draft-bg-details-entries", [newEntry]);

      if (isEditMode && projectData?.id) {
        // Get user_id from localStorage
        const userId = typeof window !== "undefined" ? window.localStorage.getItem("consultantId") : null;
        if (!userId) {
          alert("User not found in session. Please log in again.");
          return;
        }

        // Get auth token for authenticated request
        const { data: { session } } = await supabase.auth.getSession();
        const authToken = session?.access_token;
        
        const headers: HeadersInit = { "Content-Type": "application/json" };
        if (authToken) {
          headers["Authorization"] = `Bearer ${authToken}`;
        }

        // Update existing project
        const response = await fetch(`/api/projects/${projectData.id}`, {
          method: "PUT",
          headers,
          body: JSON.stringify({
            user_id: userId,
            bg_details: {
              entries: [newEntry],
            },
          }),
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || "Failed to update project");
        }

        alert("BG details updated successfully!");
      } else {
        alert("BG details saved successfully!");
      }

      markPageSaved("saved-bg-details");
      setIsSaved(true);
    } catch (error: any) {
      console.error("Error saving BG details:", error);
      alert(error.message || "Failed to save BG details. Please try again.");
    }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setValue("scanCopyName", file.name, { shouldValidate: true });
    } else {
      setValue("scanCopyName", "", { shouldValidate: true });
    }
  };

  const tableRow = useMemo(
    () =>
      entry ? (
        <tr key={entry.id}>
          <td className="border px-3 py-2">1</td>
          <td className="border px-3 py-2">{entry.zone}</td>
          <td className="border px-3 py-2">{entry.proposalNo}</td>
          <td className="border px-3 py-2">{entry.bgNumber}</td>
          <td className="border px-3 py-2">{entry.bankName}</td>
          <td className="border px-3 py-2">{entry.bgDate}</td>
          <td className="border px-3 py-2">{entry.branchName}</td>
          <td className="border px-3 py-2">{entry.amount}</td>
          <td className="border px-3 py-2">{entry.bgValidDate}</td>
          <td className="border px-3 py-2">{entry.bgBankEmail}</td>
          <td className="border px-3 py-2">{entry.scanCopyName || "-"}</td>
        </tr>
      ) : null,
    [entry]
  );

  // Fetch and populate data when in edit mode
  useEffect(() => {
    if (isEditMode && projectData && !isLoading) {
      const bgDetails = projectData.bg_details || {};
      const entries = bgDetails.entries || [];
      
      if (entries.length > 0) {
        const firstEntry = entries[0];
        const bgEntry: BGEntry = {
          id: firstEntry.id || createId(),
          zone: firstEntry.zone || "",
          proposalNo: firstEntry.proposalNo || firstEntry.proposal_no || firstEntry.fileNo || firstEntry.file_no || "",
          bgNumber: firstEntry.bgNumber || firstEntry.bg_number || "",
          bgDate: firstEntry.bgDate || firstEntry.bg_date || "",
          bankName: firstEntry.bankName || firstEntry.bank_name || "",
          branchName: firstEntry.branchName || firstEntry.branch_name || "",
          amount: firstEntry.amount || "",
          bgValidDate: firstEntry.bgValidDate || firstEntry.bg_valid_date || "",
          bgBankEmail: firstEntry.bgBankEmail || firstEntry.bg_bank_email || "",
          scanCopyName: firstEntry.scanCopyName || firstEntry.scan_copy_name || "",
        };
        
        setEntry(bgEntry);
        reset(bgEntry);
        saveDraft("draft-bg-details-entries", [bgEntry]);
        saveDraft("draft-bg-details-form", bgEntry);
      }
    }
  }, [isEditMode, projectData, isLoading, reset]);

  // Persist drafts
  useEffect(() => {
    const subscription = watch((value) => {
      saveDraft("draft-bg-details-form", value as BGFormData);
    });
    return () => subscription.unsubscribe();
  }, [watch]);

  useEffect(() => {
    // Save as array for backward compatibility, but only store one entry
    saveDraft("draft-bg-details-entries", entry ? [entry] : []);
  }, [entry]);

  useEffect(() => {
    saveDraft("draft-bg-details-active-tab", activeTab);
  }, [activeTab]);

  const [missingPages, setMissingPages] = useState<RequiredPage[]>([]);

  const handleSubmitAll = () => {
    const missing = REQUIRED_PAGES.filter((page) => !isPageSaved(page.key));

    if (missing.length > 0) {
      setMissingPages(missing);
      return;
    }

    handleSubmit(onSubmit)();
    alert("BG details submitted successfully!");
  };

  return (
    <div className="max-w-6xl mx-auto px-6 pt-8 space-y-6 relative">
      {missingPages.length > 0 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full mx-4 p-6 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Save required before submitting</h3>
                <p className="text-sm text-gray-600 mt-1">
                  Please save the following pages before you submit your Bank Guarantee details:
                </p>
              </div>
            </div>
            <ul className="space-y-2">
              {missingPages.map((page) => (
                <li key={page.key}>
                  <button
                    type="button"
                    onClick={() => router.push(page.path)}
                    className="w-full flex items-center justify-between px-3 py-2 rounded-xl border border-gray-200 text-sm text-gray-800 hover:border-emerald-300 hover:bg-emerald-50"
                  >
                    <span>{page.label}</span>
                    <span className="text-xs text-emerald-700 font-medium">Go to page</span>
                  </button>
                </li>
              ))}
            </ul>
            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setMissingPages([])}
                className="px-4 py-2 text-sm font-medium text-gray-700 rounded-lg border border-gray-300 hover:bg-gray-50"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
      <section className="border border-gray-200 rounded-2xl bg-white flex flex-col shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-gray-200 px-6 py-4 bg-white rounded-t-2xl">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Bank Guarantee Details</h2>
            <p className="text-sm text-gray-700 mt-1">
              Capture bank guarantee information for this project. Only one BG entry is allowed per project.
            </p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              className={`px-4 py-2 rounded-lg font-semibold shadow transition-colors ${
                isSaved
                  ? "bg-emerald-700 hover:bg-emerald-800 text-white"
                  : "bg-emerald-200 hover:bg-emerald-300 text-emerald-800"
              }`}
              onClick={handleSubmit(onSubmit)}
            >
              {isEditMode 
                ? (isSaved ? "Updated" : "Update")
                : (isSaved ? "Added" : "Add")
              }
            </button>
          </div>
        </div>

        <form className="space-y-6 px-6 py-4" onSubmit={handleSubmit(onSubmit)}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block font-medium text-black mb-1">
                Zone <span className="text-red-500">*</span>
              </label>
              <select
                {...register("zone", { required: "Zone is required" })}
                className={inputClasses}
              >
                <option value="">Select Zone</option>
                {zoneOptions.map((zone) => (
                  <option key={zone} value={zone}>
                    {zone}
                  </option>
                ))}
              </select>
              {errors.zone && <p className="text-sm text-red-600 mt-1">{errors.zone.message}</p>}
            </div>
            <div>
              <label className="block font-medium text-black mb-1">
                Proposal No <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                {...register("proposalNo", { required: "Proposal number is required" })}
                className={inputClasses}
                placeholder="Enter proposal number"
              />
              {errors.proposalNo && <p className="text-sm text-red-600 mt-1">{errors.proposalNo.message}</p>}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block font-medium text-black mb-1">
                BG Number <span className="text-red-500">*</span>
              </label>
              <input
                {...register("bgNumber", { required: "BG number is required" })}
                className={inputClasses}
                placeholder="Enter BG number"
              />
              {errors.bgNumber && <p className="text-sm text-red-600 mt-1">{errors.bgNumber.message}</p>}
            </div>
            <div>
              <label className="block font-medium text-black mb-1">
                BG Date <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="date"
                  {...register("bgDate", { required: "BG date is required" })}
                  className={`${inputClasses} pr-10`}
                />
                <svg
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-500 pointer-events-none"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                  />
                </svg>
              </div>
              {errors.bgDate && <p className="text-sm text-red-600 mt-1">{errors.bgDate.message}</p>}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block font-medium text-black mb-1">
                Bank Name <span className="text-red-500">*</span>
              </label>
              <input
                {...register("bankName", { required: "Bank name is required" })}
                className={inputClasses}
                placeholder="Enter bank name"
              />
              {errors.bankName && <p className="text-sm text-red-600 mt-1">{errors.bankName.message}</p>}
            </div>
            <div>
              <label className="block font-medium text-black mb-1">
                Branch Name <span className="text-red-500">*</span>
              </label>
              <input
                {...register("branchName", { required: "Branch name is required" })}
                className={inputClasses}
                placeholder="Enter branch name"
              />
              {errors.branchName && <p className="text-sm text-red-600 mt-1">{errors.branchName.message}</p>}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block font-medium text-black mb-1">
                Amount (₹) <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                {...register("amount", { required: "Amount is required" })}
                className={inputClasses}
                placeholder="Enter amount"
                min={0}
              />
              {errors.amount && <p className="text-sm text-red-600 mt-1">{errors.amount.message}</p>}
            </div>
            <div>
              <label className="block font-medium text-black mb-1">
                BG Valid Date <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="date"
                  {...register("bgValidDate", { required: "BG valid date is required" })}
                  className={`${inputClasses} pr-10`}
                />
                <svg
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-500 pointer-events-none"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                  />
                </svg>
              </div>
              {errors.bgValidDate && <p className="text-sm text-red-600 mt-1">{errors.bgValidDate.message}</p>}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block font-medium text-black mb-1">
                BG Bank Email <span className="text-red-500">*</span>
              </label>
              <input
                {...register("bgBankEmail", {
                  required: "Bank email is required",
                  pattern: { value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: "Enter a valid email" },
                })}
                className={inputClasses}
                placeholder="bank@email.com"
              />
              {errors.bgBankEmail && <p className="text-sm text-red-600 mt-1">{errors.bgBankEmail.message}</p>}
            </div>
            <div>
              <label className="block font-medium text-black mb-1">
                Attach BG Scanned Copy <span className="text-red-500">*</span>
              </label>
              <input
                type="file"
                accept=".pdf,.png,.jpg,.jpeg"
                onChange={handleFileChange}
                className="block w-full text-sm text-gray-600 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:bg-emerald-50 file:text-emerald-700 hover:file:bg-emerald-100"
              />
              <input type="hidden" {...register("scanCopyName", { required: "Upload the BG scanned copy" })} />
              {errors.scanCopyName && <p className="text-sm text-red-600 mt-1">{errors.scanCopyName.message}</p>}
            </div>
          </div>
        </form>
      </section>

      {/* BG Details / Refund Details listing box */}
      <section className="border border-gray-200 rounded-2xl bg-white flex flex-col shadow-sm">
        <div className="px-6 py-4">
          <div className="flex gap-6 border-b border-gray-200">
            <button
              className={`px-4 py-2 text-sm font-medium ${
                activeTab === "bg-details"
                  ? "text-emerald-700 border-b-2 border-emerald-600"
                  : "text-gray-500 hover:text-gray-700"
              }`}
              onClick={() => setActiveTab("bg-details")}
            >
              BG Details
            </button>
            <button
              className={`px-4 py-2 text-sm font-medium ${
                activeTab === "bg-refund"
                  ? "text-emerald-700 border-b-2 border-emerald-600"
                  : "text-gray-500 hover:text-gray-700"
              }`}
              onClick={() => setActiveTab("bg-refund")}
            >
              BG Refund Details
            </button>
          </div>

          {activeTab === "bg-details" ? (
            <div className="overflow-x-auto border-t border-gray-200">
              <table className="w-full text-sm text-black">
                <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                  <tr>
                    <th className="border-t px-3 py-2 text-left">Sr. No</th>
                    <th className="border-t px-3 py-2 text-left">Zone</th>
                    <th className="border-t px-3 py-2 text-left">Proposal Number</th>
                    <th className="border-t px-3 py-2 text-left">BG Number</th>
                    <th className="border-t px-3 py-2 text-left">Bank Name</th>
                    <th className="border-t px-3 py-2 text-left">BG Date</th>
                    <th className="border-t px-3 py-2 text-left">Branch Name</th>
                    <th className="border-t px-3 py-2 text-left">Amount</th>
                    <th className="border-t px-3 py-2 text-left">BG Valid Date</th>
                    <th className="border-t px-3 py-2 text-left">BG Bank Email</th>
                    <th className="border-t px-3 py-2 text-left">Attachment</th>
                  </tr>
                </thead>
                <tbody>
                  {!entry ? (
                    <tr>
                      <td colSpan={11} className="px-3 py-4 text-center text-gray-500">
                        No BG record yet. Fill the form above and click Add to save the entry here.
                      </td>
                    </tr>
                  ) : (
                    tableRow
                  )}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="border border-gray-200 rounded-b-lg p-6 text-sm text-gray-600">
              Refund workflow tracking will appear here. Capture acknowledgement number, refund status, and processed
              date once BG refund features are enabled.
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

