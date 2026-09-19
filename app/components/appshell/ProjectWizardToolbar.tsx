"use client";

import { useApplicationPdfSaveSlot } from "@/app/dashboard/context/ApplicationPdfSaveSlotContext";
import { useApplicationSignSlot } from "@/app/dashboard/context/ApplicationSignSlotContext";
import { useApplicationLifecycleActionsSlot } from "@/app/dashboard/context/ApplicationLifecycleActionsSlotContext";
import { BTN_PRIMARY } from "@/app/utils/buttonClasses";

type ProjectWizardToolbarProps = {
  onSubmitProjectClick: () => void;
  onSaveDraftClick: () => void;
  allPagesSaved: boolean;
  isDraftProject: boolean;
  isEditMode: boolean;
  isReadOnlyMode: boolean;
  isProjectDataLoading?: boolean;
  isSubmittingProject?: boolean;
};

export default function ProjectWizardToolbar({
  onSubmitProjectClick,
  onSaveDraftClick,
  allPagesSaved,
  isDraftProject,
  isEditMode,
  isReadOnlyMode,
  isProjectDataLoading = false,
  isSubmittingProject = false,
}: ProjectWizardToolbarProps) {
  const { slot: applicationPdfSaveSlot } = useApplicationPdfSaveSlot();
  const { slot: applicationSignSlot } = useApplicationSignSlot();
  const { slot: lifecycleActionsSlot } = useApplicationLifecycleActionsSlot();

  if (isReadOnlyMode) {
    return (
      <div className="flex flex-wrap items-center justify-end gap-2 border-b border-gray-100 bg-white px-4 py-3 sm:px-6">
        {lifecycleActionsSlot?.backToDraft && (
          <button
            type="button"
            onClick={() => void lifecycleActionsSlot.backToDraft?.onClick()}
            disabled={lifecycleActionsSlot.backToDraft.busy}
            className="inline-flex min-h-10 items-center rounded-lg border border-gray-300 px-4 text-sm font-semibold text-brand-navy transition-colors hover:bg-slate-50 disabled:opacity-50"
          >
            {lifecycleActionsSlot.backToDraft.busy ? "Moving…" : "Back to draft"}
          </button>
        )}
        {lifecycleActionsSlot?.reject && (
          <button
            type="button"
            onClick={() => void lifecycleActionsSlot.reject?.onClick()}
            disabled={lifecycleActionsSlot.reject.busy}
            className="inline-flex min-h-10 items-center rounded-lg border border-amber-300 px-4 text-sm font-semibold text-amber-700 transition-colors hover:bg-amber-50 disabled:opacity-50"
          >
            {lifecycleActionsSlot.reject.busy ? "Rejecting…" : "Reject"}
          </button>
        )}
        {lifecycleActionsSlot?.delete && (
          <button
            type="button"
            onClick={() => void lifecycleActionsSlot.delete?.onClick()}
            disabled={lifecycleActionsSlot.delete.busy}
            className="inline-flex min-h-10 items-center rounded-lg border border-rose-300 px-4 text-sm font-semibold text-rose-700 transition-colors hover:bg-rose-50 disabled:opacity-50"
          >
            {lifecycleActionsSlot.delete.busy ? "Deleting…" : "Delete"}
          </button>
        )}
        {applicationPdfSaveSlot && (
          <button
            type="button"
            onClick={() => void applicationPdfSaveSlot.onSave()}
            disabled={
              applicationPdfSaveSlot.disabled ||
              applicationPdfSaveSlot.busy ||
              applicationPdfSaveSlot.done
            }
            className={[
              "inline-flex min-h-10 items-center rounded-lg px-4 text-sm font-semibold transition-colors",
              applicationPdfSaveSlot.done && !applicationPdfSaveSlot.busy
                ? "border border-status-success bg-green-50 text-status-success cursor-default"
                : "border border-brand-blue text-brand-blue hover:bg-blue-50 disabled:opacity-50",
            ].join(" ")}
          >
            {applicationPdfSaveSlot.busy
              ? "Submitting…"
              : applicationPdfSaveSlot.done
                ? "Submitted"
                : "Submit"}
          </button>
        )}
        {applicationSignSlot && (() => {
          const signAllowed = applicationSignSlot.actionAvailable !== false;
          const signBusy = applicationSignSlot.disabled || applicationSignSlot.busy;
          const actionLabel = applicationSignSlot.actionLabel || "Approved";
          return (
            <button
              type="button"
              onClick={() => {
                if (!signAllowed) return;
                void applicationSignSlot.onSign();
              }}
              disabled={!signAllowed || signBusy}
              className={[
                "inline-flex min-h-10 items-center rounded-lg px-4 text-sm font-semibold transition-colors",
                signAllowed
                  ? `${BTN_PRIMARY} disabled:opacity-50`
                  : "cursor-not-allowed border border-gray-200 bg-gray-50 text-gray-400",
              ].join(" ")}
            >
              {applicationSignSlot.busy
                ? applicationSignSlot.busyLabel || "Approving…"
                : actionLabel}
            </button>
          );
        })()}
      </div>
    );
  }

  const isSubmittedProject = isEditMode && !isDraftProject;
  const updateDisabled = isProjectDataLoading || isSubmittingProject;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 bg-white px-4 py-3 sm:px-6">
      <p className="text-sm text-gray-500">
        Complete each section, then submit when everything is saved.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        {isSubmittedProject ? (
          <button
            type="button"
            onClick={onSubmitProjectClick}
            disabled={updateDisabled}
            className={`inline-flex min-h-10 items-center rounded-lg px-5 text-sm font-semibold ${
              updateDisabled ? "cursor-not-allowed bg-brand-blue/60 text-white" : BTN_PRIMARY
            }`}
          >
            {isProjectDataLoading
              ? "Loading…"
              : isSubmittingProject
                ? "Updating…"
                : "Update Project"}
          </button>
        ) : allPagesSaved ? (
          <button
            type="button"
            onClick={onSubmitProjectClick}
            className={`inline-flex min-h-10 items-center rounded-lg px-5 text-sm font-semibold ${BTN_PRIMARY}`}
          >
            Submit Project
          </button>
        ) : (
          <button
            type="button"
            onClick={onSaveDraftClick}
            className="inline-flex min-h-10 items-center rounded-lg border border-brand-blue px-5 text-sm font-semibold text-brand-blue transition-colors hover:bg-blue-50"
          >
            Save as Draft
          </button>
        )}
      </div>
    </div>
  );
}
