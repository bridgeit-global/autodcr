"use client";

import { useMemo, useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { useRouter, useSearchParams } from "next/navigation";
import { loadDraft, saveDraft, markPageSaved, isPageSaved } from "@/app/utils/draftStorage";
import { useProjectData } from "@/app/hooks/useProjectData";
import { useDashboardAlertModal } from "@/app/dashboard/context/DashboardAlertModalContext";
import CustomSelect from "@/app/components/CustomSelect";
import { BTN_PRIMARY, BTN_SAVE_UNSAVED } from "@/app/utils/buttonClasses";
import { CREATE_PROJECT_SECTIONS } from "@/app/utils/projectSections";

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
  ...CREATE_PROJECT_SECTIONS.map((section) => ({
    key: section.savedKey,
    label: section.label,
    path: section.path,
  })),
  { key: "saved-bg-details", label: "BG Details", path: "/dashboard/bg" },
];

export default function BGDetailsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isReadOnlyMode = searchParams.get("mode") === "readonly";
  const { isEditMode, isLoading, projectData } = useProjectData();
  const { showAlert } = useDashboardAlertModal();
  const [entry, setEntry] = useState<BGEntry | null>(() => {
    const savedEntries = loadDraft<BGEntry[]>("draft-bg-details-entries", []);
    return savedEntries.length > 0 ? savedEntries[0] : null;
  });
  const [activeTab, setActiveTab] = useState<"bg-details" | "bg-refund">(
    loadDraft<"bg-details" | "bg-refund">("draft-bg-details-active-tab", "bg-details")
  );
  const [isSaved, setIsSaved] = useState(() => isPageSaved("saved-bg-details"));

  const inputClasses =
    "h-11 w-full rounded-lg border border-gray-200 bg-gray-50 px-3 text-sm text-gray-900 placeholder:text-gray-400 outline-none transition-colors hover:border-gray-300 focus:border-brand-blue focus:bg-white focus:ring-2 focus:ring-brand-blue/20 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-500";
  const labelClasses = "mb-1.5 block text-sm font-medium text-brand-navy";
  const requiredMark = <span className="text-brand-navy">*</span>;
  const errorClasses = "mt-1 text-sm text-status-danger";

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
    if (isReadOnlyMode) return;
    try {
      // BG Details is retired from Create Project — keep local drafts only; do not persist to API.
      const newEntry: BGEntry = {
        ...data,
        id: entry?.id || createId(),
      };
      setEntry(newEntry);
      saveDraft("draft-bg-details-entries", [newEntry]);

      markPageSaved("saved-bg-details");
      saveDraft("dirty-bg-details", false);
      saveDraft("saved-bg-details-snapshot", {
        entries: [newEntry],
        form: data,
        activeTab,
      });
      setIsSaved(true);
      showAlert({
        title: "BG details",
        message: "BG Details is no longer part of project create/update and was not saved to the server.",
      });
    } catch (error: any) {
      console.error("Error saving BG details:", error);
      showAlert({
        title: "Could not save",
        message: error.message || "Failed to save BG details. Please try again.",
      });
    }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (isReadOnlyMode) return;
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
      const entries = (bgDetails.entries || []) as BGEntry[];
      const projectInfo = projectData.project_info || {};
      const proposalNoFromProject = projectInfo.proposalNo || projectInfo.proposal_no || "";

      if (entries.length > 0) {
        const firstEntry = entries[0] as Record<string, unknown>;
        const str = (v: unknown): string => (typeof v === "string" ? v : "");
        const pick = (...vals: unknown[]): string =>
          vals.reduce<string>((acc, v) => acc || (typeof v === "string" ? v : ""), "");
        const bgEntry: BGEntry = {
          id: pick(firstEntry.id) || createId(),
          zone: pick(firstEntry.zone),
          proposalNo: pick(proposalNoFromProject, firstEntry.proposalNo, firstEntry.proposal_no, firstEntry.fileNo, firstEntry.file_no),
          bgNumber: pick(firstEntry.bgNumber, firstEntry.bg_number),
          bgDate: pick(firstEntry.bgDate, firstEntry.bg_date),
          bankName: pick(firstEntry.bankName, firstEntry.bank_name),
          branchName: pick(firstEntry.branchName, firstEntry.branch_name),
          amount: pick(firstEntry.amount),
          bgValidDate: pick(firstEntry.bgValidDate, firstEntry.bg_valid_date),
          bgBankEmail: pick(firstEntry.bgBankEmail, firstEntry.bg_bank_email),
          scanCopyName: pick(firstEntry.scanCopyName, firstEntry.scan_copy_name),
        };
        
        setEntry(bgEntry);
        reset(bgEntry);
        saveDraft("draft-bg-details-entries", [bgEntry]);
        saveDraft("draft-bg-details-form", bgEntry);
        markPageSaved("saved-bg-details");
        setIsSaved(true);
      } else if (proposalNoFromProject) {
        setValue("proposalNo", String(proposalNoFromProject));
      }
    }
  }, [isEditMode, projectData, isLoading, reset, setValue]);

  // Auto-fill proposalNo from Project Details draft
  useEffect(() => {
    const projectDraft = loadDraft<{ proposalNo?: string }>("draft-project-details-project", {});
    if (projectDraft.proposalNo) {
      setValue("proposalNo", projectDraft.proposalNo);
    }
  }, [setValue]);

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
    if (isReadOnlyMode) return;
    const missing = REQUIRED_PAGES.filter((page) => !isPageSaved(page.key));

    if (missing.length > 0) {
      setMissingPages(missing);
      return;
    }

    handleSubmit(onSubmit)();
    showAlert({
      title: "BG details",
      message: "BG details submitted successfully!",
    });
  };

  return (
    <div
      className={`pb-2 space-y-6 relative ${
        isReadOnlyMode
          ? "[&_input]:cursor-not-allowed [&_textarea]:cursor-not-allowed [&_select]:cursor-not-allowed [&_button]:cursor-not-allowed [&_[role='button']]:cursor-not-allowed"
          : ""
      }`}
    >
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
      <div>
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-base font-bold text-brand-navy">Bank Guarantee Details</h2>
          <button
            type="button"
            className={`rounded-lg px-5 py-2 text-sm font-semibold ${
              isSaved ? BTN_PRIMARY : BTN_SAVE_UNSAVED
            } ${isReadOnlyMode ? "cursor-not-allowed opacity-70" : ""}`}
            disabled={isReadOnlyMode}
            onClick={handleSubmit(onSubmit)}
          >
            {isSaved ? "Saved" : "Save"}
          </button>
        </div>

        <form className="space-y-5" onSubmit={handleSubmit(onSubmit)}>
          <fieldset
            disabled={isReadOnlyMode}
            className={
              isReadOnlyMode
                ? "[&_input]:cursor-not-allowed [&_textarea]:cursor-not-allowed [&_select]:cursor-not-allowed [&_button]:cursor-not-allowed [&_[role='button']]:cursor-not-allowed"
                : ""
            }
          >
          <div className="grid grid-cols-1 gap-x-5 gap-y-4 md:grid-cols-2">
            <div>
              <label className={labelClasses}>
                Zone {requiredMark}
              </label>
              <input type="hidden" {...register("zone", { required: "Zone is required" })} />
              <CustomSelect
                value={watch("zone") || ""}
                onChange={(val) => setValue("zone", val, { shouldValidate: true })}
                options={zoneOptions.map((zone) => ({ value: zone, label: zone }))}
                placeholder="Select Zone"
              />
              {errors.zone && <p className={errorClasses}>{errors.zone.message}</p>}
            </div>
            <div>
              <label className={labelClasses}>
                Proposal No {requiredMark}
              </label>
              <input
                type="text"
                {...register("proposalNo", { required: "Proposal number is required" })}
                readOnly
                className={`${inputClasses} bg-gray-100 cursor-not-allowed`}
                placeholder="Auto-filled from Project Details"
              />
              {errors.proposalNo && <p className={errorClasses}>{errors.proposalNo.message}</p>}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-x-5 gap-y-4 md:grid-cols-2">
            <div>
              <label className={labelClasses}>
                BG Number {requiredMark}
              </label>
              <input
                {...register("bgNumber", { required: "BG number is required" })}
                className={inputClasses}
                placeholder="Enter BG number"
              />
              {errors.bgNumber && <p className={errorClasses}>{errors.bgNumber.message}</p>}
            </div>
            <div>
              <label className={labelClasses}>
                BG Date {requiredMark}
              </label>
              <input
                type="date"
                {...register("bgDate", { required: "BG date is required" })}
                className={inputClasses}
              />
              {errors.bgDate && <p className={errorClasses}>{errors.bgDate.message}</p>}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-x-5 gap-y-4 md:grid-cols-2">
            <div>
              <label className={labelClasses}>
                Bank Name {requiredMark}
              </label>
              <input
                {...register("bankName", { required: "Bank name is required" })}
                className={inputClasses}
                placeholder="Enter bank name"
              />
              {errors.bankName && <p className={errorClasses}>{errors.bankName.message}</p>}
            </div>
            <div>
              <label className={labelClasses}>
                Branch Name {requiredMark}
              </label>
              <input
                {...register("branchName", { required: "Branch name is required" })}
                className={inputClasses}
                placeholder="Enter branch name"
              />
              {errors.branchName && <p className={errorClasses}>{errors.branchName.message}</p>}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-x-5 gap-y-4 md:grid-cols-2">
            <div>
              <label className={labelClasses}>
                Amount (₹) {requiredMark}
              </label>
              <input
                type="number"
                {...register("amount", { required: "Amount is required" })}
                className={inputClasses}
                placeholder="Enter amount"
                min={0}
              />
              {errors.amount && <p className={errorClasses}>{errors.amount.message}</p>}
            </div>
            <div>
              <label className={labelClasses}>
                BG Valid Date {requiredMark}
              </label>
              <input
                type="date"
                {...register("bgValidDate", { required: "BG valid date is required" })}
                className={inputClasses}
              />
              {errors.bgValidDate && <p className={errorClasses}>{errors.bgValidDate.message}</p>}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-x-5 gap-y-4 md:grid-cols-2">
            <div>
              <label className={labelClasses}>
                BG Bank Email {requiredMark}
              </label>
              <input
                {...register("bgBankEmail", {
                  required: "Bank email is required",
                  pattern: { value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: "Enter a valid email" },
                })}
                className={inputClasses}
                placeholder="bank@email.com"
              />
              {errors.bgBankEmail && <p className={errorClasses}>{errors.bgBankEmail.message}</p>}
            </div>
            <div>
              <label className={labelClasses}>
                Attach BG Scanned Copy {requiredMark}
              </label>
              <input
                type="file"
                accept=".pdf,.png,.jpg,.jpeg"
                onChange={handleFileChange}
                className="block w-full text-sm text-gray-600 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:bg-emerald-50 file:text-emerald-700 hover:file:bg-emerald-100"
              />
              <input type="hidden" {...register("scanCopyName", { required: "Upload the BG scanned copy" })} />
              {errors.scanCopyName && <p className={errorClasses}>{errors.scanCopyName.message}</p>}
            </div>
          </div>
          </fieldset>
        </form>
      </div>

      {/* BG Details / Refund Details listing box */}
      <div className="overflow-hidden rounded-xl border border-gray-100">
        <div className="px-4 py-4 sm:px-5">
          <div className="flex gap-6 border-b border-gray-200">
            <button
              className={`px-4 py-2 text-sm font-medium ${
                activeTab === "bg-details"
                  ? "text-brand-blue border-b-2 border-brand-blue"
                  : "text-gray-500 hover:text-gray-700"
              }`}
              onClick={() => setActiveTab("bg-details")}
            >
              BG Details
            </button>
            <button
              className={`px-4 py-2 text-sm font-medium ${
                activeTab === "bg-refund"
                  ? "text-brand-blue border-b-2 border-brand-blue"
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
      </div>
    </div>
  );
}

