"use client";

import React, { useMemo, useState } from "react";

export type ApplicationWorkflowStage = "draft" | "in_process" | "approved_verified" | "rejected";

export function normalizeApplicationWorkflowStage(value: unknown): ApplicationWorkflowStage {
  if (
    value === "in_process" ||
    value === "approved_verified" ||
    value === "draft" ||
    value === "rejected"
  ) {
    return value;
  }
  return "draft";
}

export type DraftApplication = {
  applicationId?: string;
  projectId?: string;
  applicationNo: string;
  ward: string;
  applicationType: string;
  /** Legacy display label — prefer deriving from `workflowStage`. */
  status: string;
  startedOn: string;
  currentStage: number; // Visual progress (aligned with STAGES strip in modal)
  workflowStage: ApplicationWorkflowStage;
};

interface DraftApplicationsModalProps {
  open: boolean;
  onClose: () => void;
  appType: string;
  status: string;
  applications: DraftApplication[];
  onDeleteApplication?: (applicationId: string) => Promise<void>;
  onRejectApplication?: (applicationId: string) => Promise<void>;
  onOpenApplicationDetails?: (payload: {
    applicationId: string;
    projectId?: string;
    applicationNo: string;
    appType: string;
  }) => void;
}

const STAGES = [
  "Draft",
  "Proposal Submitted",
  "Survey Done",
  "Plan Approved",
];

const DraftApplicationsModal: React.FC<DraftApplicationsModalProps> = ({
  open,
  onClose,
  appType,
  status,
  applications,
  onDeleteApplication,
  onRejectApplication,
  onOpenApplicationDetails,
}) => {
  const [fileNumberQuery, setFileNumberQuery] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [pendingRejectId, setPendingRejectId] = useState<string | null>(null);

  if (!open) return null;

  const filteredApplications = useMemo(() => {
    const query = fileNumberQuery.trim().toLowerCase();
    if (!query) return applications;
    return applications.filter((app) =>
      app.applicationNo.toLowerCase().includes(query)
    );
  }, [applications, fileNumberQuery]);

  const handleDelete = async (applicationId: string) => {
    if (!onDeleteApplication) return;
    setPendingDeleteId(null);
    setDeletingId(applicationId);
    try {
      await onDeleteApplication(applicationId);
    } finally {
      setDeletingId(null);
    }
  };

  const handleReject = async (applicationId: string) => {
    if (!onRejectApplication) return;
    setPendingRejectId(null);
    setRejectingId(applicationId);
    try {
      await onRejectApplication(applicationId);
    } finally {
      setRejectingId(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="relative bg-white rounded-lg shadow-2xl w-[950px] max-h-[85vh] overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-start justify-between px-6 py-4 border-b border-gray-200">
          <div>
            <h3 className="text-xl font-semibold text-orange-500">{appType}</h3>
            <p className="text-sm text-orange-400">{status}</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center">
              <input
                type="text"
                placeholder="Enter application no"
                className="border border-gray-300 rounded-l px-3 py-1.5 text-sm w-44 bg-white text-black font-medium placeholder:text-gray-500 caret-black"
                value={fileNumberQuery}
                onChange={(event) => setFileNumberQuery(event.target.value)}
              />
              <button className="border border-l-0 border-gray-300 rounded-r px-3 py-1.5 text-blue-600 hover:bg-gray-50">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
              </button>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
            >
              ×
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto max-h-[65vh] bg-white">
          {filteredApplications.length > 0 && (
            <div className="mb-2">
              <div className="flex justify-end px-2">
                <div className="w-[calc(100%-15rem)]">
                  <div className="flex justify-between">
                    {STAGES.map((stage, idx) => (
                      <div key={idx} className="w-24 text-center text-xs text-gray-500 leading-tight">
                        {stage.split(" ").map((word, i) => (
                          <span key={i} className="block">
                            {word}
                          </span>
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {filteredApplications.map((app, index) => (
            <div key={index} className="py-4 px-3 rounded-xl border border-gray-100 bg-gradient-to-r from-white to-sky-50/40 mb-3 last:mb-0">
              <div className="flex">
                <div className="w-60 shrink-0 pr-4">
                  <div className="mb-2 flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-medium text-gray-600">Application No:</span>
                    {app.applicationId && onOpenApplicationDetails ? (
                      <button
                        type="button"
                        className="inline-flex items-center rounded-full bg-sky-100 text-sky-700 border border-sky-200 px-2.5 py-0.5 text-xs font-semibold break-all hover:bg-sky-200 hover:text-sky-800 focus:outline-none focus:ring-2 focus:ring-sky-400"
                        onClick={() =>
                          onOpenApplicationDetails({
                            applicationId: app.applicationId as string,
                            projectId: app.projectId,
                            applicationNo: app.applicationNo,
                            appType: app.applicationType || appType,
                          })
                        }
                      >
                        {app.applicationNo}
                      </button>
                    ) : (
                      <span className="inline-flex items-center rounded-full bg-sky-100 text-sky-700 border border-sky-200 px-2.5 py-0.5 text-xs font-semibold break-all">
                        {app.applicationNo}
                      </span>
                    )}
                  </div>
                  <p className="text-[13px] font-medium text-sky-700 mb-1">{app.status}</p>
                  <div className="flex items-center gap-3">
                    {onRejectApplication &&
                      app.workflowStage !== "rejected" &&
                      app.workflowStage !== "approved_verified" && (
                      <button
                        type="button"
                        className="text-[13px] text-amber-600 hover:text-amber-700 hover:underline disabled:text-gray-400 disabled:no-underline"
                        onClick={() => app.applicationId && setPendingRejectId(app.applicationId)}
                        disabled={
                          !app.applicationId ||
                          rejectingId === app.applicationId ||
                          deletingId === app.applicationId
                        }
                      >
                        {rejectingId === app.applicationId ? "Rejecting..." : "Reject"}
                      </button>
                    )}
                    {onDeleteApplication && (
                      <button
                        type="button"
                        className="text-[13px] text-rose-600 hover:text-rose-700 hover:underline disabled:text-gray-400 disabled:no-underline"
                        onClick={() => app.applicationId && setPendingDeleteId(app.applicationId)}
                        disabled={
                          !app.applicationId ||
                          deletingId === app.applicationId ||
                          rejectingId === app.applicationId
                        }
                      >
                        {deletingId === app.applicationId ? "Deleting..." : "Delete"}
                      </button>
                    )}
                  </div>
                </div>

                <div className="flex-1 relative pt-2">
                  <div className="absolute top-6 left-12 right-12 h-px bg-gray-300"></div>
                  <div className="flex justify-between relative">
                    {STAGES.map((_, stageIndex) => (
                      <div key={stageIndex} className="w-24 flex flex-col items-center">
                        {stageIndex <= app.currentStage ? (
                          <div className="w-6 h-6 rounded-full bg-sky-500 z-10"></div>
                        ) : (
                          <div className="w-6 h-6 rounded-full border border-gray-300 bg-white z-10"></div>
                        )}
                        {stageIndex === app.currentStage && (
                          <div className="mt-2 text-center">
                            <p className="text-[11px] text-gray-500">Started on</p>
                            <p className="text-[11px] text-gray-700">{app.startedOn}</p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ))}

          {filteredApplications.length === 0 && (
            <div className="text-center py-10 text-gray-500 border border-dashed border-gray-300 rounded-md bg-gray-50">
              No applications found
            </div>
          )}
        </div>

        {pendingDeleteId && (
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center z-10">
            <div className="bg-white rounded-xl border border-gray-200 shadow-xl p-5 w-[360px]">
              <p className="text-sm text-gray-800">
                Are you sure you want to delete this application?
              </p>
              <div className="mt-4 flex justify-end gap-2">
                <button
                  type="button"
                  className="px-3 py-1.5 rounded-lg border border-gray-200 text-sm text-gray-700 hover:bg-gray-50"
                  onClick={() => setPendingDeleteId(null)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="px-3 py-1.5 rounded-lg bg-rose-600 text-sm text-white hover:bg-rose-700"
                  onClick={() => handleDelete(pendingDeleteId)}
                >
                  Yes, Delete
                </button>
              </div>
            </div>
          </div>
        )}

        {pendingRejectId && (
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center z-10">
            <div className="bg-white rounded-xl border border-gray-200 shadow-xl p-5 w-[360px]">
              <p className="text-sm text-gray-800">
                Are you sure you want to reject this application? It will move to Rejected or
                Cancelled and both owner and consultant will be notified.
              </p>
              <div className="mt-4 flex justify-end gap-2">
                <button
                  type="button"
                  className="px-3 py-1.5 rounded-lg border border-gray-200 text-sm text-gray-700 hover:bg-gray-50"
                  onClick={() => setPendingRejectId(null)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="px-3 py-1.5 rounded-lg bg-amber-600 text-sm text-white hover:bg-amber-700"
                  onClick={() => handleReject(pendingRejectId)}
                >
                  Yes, Reject
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DraftApplicationsModal;
