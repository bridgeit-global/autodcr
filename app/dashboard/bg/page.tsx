"use client";

import { useMemo, useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { useRouter } from "next/navigation";
import { loadDraft, saveDraft, markPageSaved, isPageSaved } from "@/app/utils/draftStorage";

type BGFormData = {
  zone: string;
  fileNo: string;
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
const fileOptions = [
  "P-28357/2025/(258)/P/S Ward/AAREY-P/S",
  "P-17821/2025/(147)/E Ward/WADALA-E",
  "P-30045/2025/(098)/N Ward/GHATKOPAR-N",
];

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
  const [entries, setEntries] = useState<BGEntry[]>(() =>
    loadDraft<BGEntry[]>("draft-bg-details-entries", [])
  );
  const [activeTab, setActiveTab] = useState<"bg-details" | "bg-refund">(
    loadDraft<"bg-details" | "bg-refund">("draft-bg-details-active-tab", "bg-details")
  );
  const [isSaved, setIsSaved] = useState(() => isPageSaved("saved-bg-details"));

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors },
    watch,
  } = useForm<BGFormData>({
    defaultValues: loadDraft<BGFormData>("draft-bg-details-form", {
      zone: "",
      fileNo: "",
      bgNumber: "",
      bgDate: "",
      bankName: "",
      branchName: "",
      amount: "",
      bgValidDate: "",
      bgBankEmail: "",
      scanCopyName: "",
    }),
  });

  const onSubmit = (data: BGFormData) => {
    const newEntry: BGEntry = { ...data, id: createId() };
    setEntries((prev) => [newEntry, ...prev]);
    reset();
    markPageSaved("saved-bg-details");
    setIsSaved(true);
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setValue("scanCopyName", file.name, { shouldValidate: true });
    } else {
      setValue("scanCopyName", "", { shouldValidate: true });
    }
  };

  const tableRows = useMemo(
    () =>
      entries.map((entry, index) => (
        <tr key={entry.id}>
          <td className="border px-3 py-2">{index + 1}</td>
          <td className="border px-3 py-2">{entry.zone}</td>
          <td className="border px-3 py-2">{entry.fileNo}</td>
          <td className="border px-3 py-2">{entry.bgNumber}</td>
          <td className="border px-3 py-2">{entry.bankName}</td>
          <td className="border px-3 py-2">{entry.bgDate}</td>
          <td className="border px-3 py-2">{entry.branchName}</td>
          <td className="border px-3 py-2">{entry.amount}</td>
          <td className="border px-3 py-2">{entry.bgValidDate}</td>
          <td className="border px-3 py-2">{entry.bgBankEmail}</td>
          <td className="border px-3 py-2">{entry.scanCopyName || "-"}</td>
        </tr>
      )),
    [entries]
  );

  // Persist drafts
  useEffect(() => {
    const subscription = watch((value) => {
      saveDraft("draft-bg-details-form", value as BGFormData);
    });
    return () => subscription.unsubscribe();
  }, [watch]);

  useEffect(() => {
    saveDraft("draft-bg-details-entries", entries);
  }, [entries]);

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
              Capture bank guarantee information and keep track of issued BGs for this project.
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
              {isSaved ? "Added" : "Add"}
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
                className="border border-gray-200 rounded-xl px-3 py-2 h-10 w-full text-gray-900 bg-white focus:ring-2 focus:ring-emerald-500 outline-none"
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
                File No <span className="text-red-500">*</span>
              </label>
              <select
                {...register("fileNo", { required: "File number is required" })}
                className="border border-gray-200 rounded-xl px-3 py-2 h-10 w-full text-gray-900 bg-white focus:ring-2 focus:ring-emerald-500 outline-none"
              >
                <option value="">Select File</option>
                {fileOptions.map((file) => (
                  <option key={file} value={file}>
                    {file}
                  </option>
                ))}
              </select>
              {errors.fileNo && <p className="text-sm text-red-600 mt-1">{errors.fileNo.message}</p>}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block font-medium text-black mb-1">
                BG Number <span className="text-red-500">*</span>
              </label>
              <input
                {...register("bgNumber", { required: "BG number is required" })}
                className="border border-gray-200 rounded-xl px-3 py-2 h-10 w-full text-gray-900 bg-white focus:ring-2 focus:ring-emerald-500 outline-none"
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
                  className="border border-gray-200 rounded-xl px-3 py-2 pr-10 h-10 w-full text-gray-900 bg-white focus:ring-2 focus:ring-emerald-500 outline-none"
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
                className="border border-gray-200 rounded-xl px-3 py-2 h-10 w-full text-gray-900 bg-white focus:ring-2 focus:ring-emerald-500 outline-none"
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
                className="border border-gray-200 rounded-xl px-3 py-2 h-10 w-full text-gray-900 bg-white focus:ring-2 focus:ring-emerald-500 outline-none"
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
                className="border border-gray-200 rounded-xl px-3 py-2 h-10 w-full text-gray-900 bg-white focus:ring-2 focus:ring-emerald-500 outline-none"
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
                  className="border border-gray-200 rounded-xl px-3 py-2 pr-10 h-10 w-full text-gray-900 bg-white focus:ring-2 focus:ring-emerald-500 outline-none"
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
                className="border border-gray-200 rounded-xl px-3 py-2 h-10 w-full text-gray-900 bg-white focus:ring-2 focus:ring-emerald-500 outline-none"
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
                    <th className="border-t px-3 py-2 text-left">File Number</th>
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
                  {entries.length === 0 ? (
                    <tr>
                      <td colSpan={11} className="px-3 py-4 text-center text-gray-500">
                        No BG records yet. Fill the form above and click Add to list entries here.
                      </td>
                    </tr>
                  ) : (
                    tableRows
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

