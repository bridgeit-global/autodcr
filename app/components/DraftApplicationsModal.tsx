"use client";

import React from "react";

export type DraftApplication = {
  applicationNo: string;
  ward: string;
  applicationType: string;
  status: string;
  startedOn: string;
  currentStage: number; // 0 = Draft, 1 = Payment Pending, 2 = Proposal Submitted, etc.
};

interface DraftApplicationsModalProps {
  open: boolean;
  onClose: () => void;
  appType: string;
  status: string;
  applications: DraftApplication[];
}

const STAGES = [
  "Draft",
  "Payment Pending",
  "Proposal Submitted",
  "Survey Done",
  "Scrutiny Done",
  "Plan Approved",
];

const DraftApplicationsModal: React.FC<DraftApplicationsModalProps> = ({
  open,
  onClose,
  appType,
  status,
  applications,
}) => {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-lg shadow-2xl w-[950px] max-h-[85vh] overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-start justify-between px-6 py-4 border-b border-gray-200">
          <div>
            <h3 className="text-xl font-semibold text-orange-500">{appType}</h3>
            <p className="text-sm text-orange-400">{status}</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600">Application Type</span>
              <select className="border border-gray-300 rounded px-3 py-1.5 text-sm bg-white">
                <option>Select</option>
              </select>
            </div>
            <div className="flex items-center">
              <input
                type="text"
                placeholder="Enter file number"
                className="border border-gray-300 rounded-l px-3 py-1.5 text-sm w-44"
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
          {/* Application Entries */}
          {applications.map((app, index) => (
            <div 
              key={index} 
              className="border border-gray-200 rounded-lg p-5 mb-4"
            >
              {/* Stage Headers Row */}
              <div className="flex mb-4">
                <div className="w-44 flex-shrink-0"></div>
                <div className="flex-1">
                  <div className="flex justify-between">
                    {STAGES.map((stage, idx) => (
                      <div key={idx} className="w-24 text-center">
                        <span className="text-xs text-gray-500 leading-tight">
                          {stage.split(" ").map((word, i) => (
                            <span key={i} className="block">{word}</span>
                          ))}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Content Row */}
              <div className="flex">
                {/* Left Info */}
                <div className="w-44 flex-shrink-0 pr-4">
                  <p className="text-xs text-gray-500 mb-1">Application No:</p>
                  <a href="#" className="text-blue-600 text-sm hover:underline block mb-3 leading-tight">
                    {app.applicationNo}
                  </a>
                  <p className="text-sm text-gray-600 mb-1">{app.ward}</p>
                  <p className="text-blue-600 text-sm mb-1">{app.applicationType}</p>
                  <p className="text-blue-600 text-sm mb-1">{app.status}</p>
                  <button className="text-blue-600 text-sm hover:underline">Delete</button>
                </div>

                {/* Progress Timeline */}
                <div className="flex-1 relative">
                  {/* Horizontal Line */}
                  <div className="absolute top-4 left-12 right-12 h-px bg-gray-300"></div>
                  
                  {/* Circles */}
                  <div className="flex justify-between relative">
                    {STAGES.map((stage, stageIndex) => (
                      <div key={stageIndex} className="w-24 flex flex-col items-center">
                        {/* Circle */}
                        {stageIndex <= app.currentStage ? (
                          <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center z-10">
                            <div className="w-3 h-3 rounded-full bg-white"></div>
                          </div>
                        ) : (
                          <div className="w-8 h-8 rounded-full border-2 border-gray-300 bg-white z-10"></div>
                        )}
                        
                        {/* Date label for current stage */}
                        {stageIndex === app.currentStage && (
                          <div className="mt-2 text-center">
                            <p className="text-xs text-gray-500">Started on</p>
                            <p className="text-xs text-gray-700">{app.startedOn}</p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ))}

          {applications.length === 0 && (
            <div className="text-center py-12 text-gray-500">
              No applications found
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DraftApplicationsModal;
