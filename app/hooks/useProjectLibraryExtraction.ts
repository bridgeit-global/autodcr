"use client";

import { useCallback, useState } from "react";
import type { DocumentValidationResult } from "@/app/components/DocumentValidationResultModal";
import type { DocumentType } from "@/app/lib/documentValidation/registry";
import {
  buildProjectAutofillFromExtractions,
  type ProjectAutofillResult,
  type ProjectLibraryExtraction,
  type ProjectLibraryDocSlot,
} from "@/app/lib/projectDocumentAutofill";
import {
  getExtraPrCard,
  getProjectLibraryFile,
} from "@/app/utils/projectLibraryFiles";

export type ProjectLibraryExtractionOutcome = {
  extractions: ProjectLibraryExtraction[];
  autofill: ProjectAutofillResult | null;
  primaryPrFailed: boolean;
  failures: Array<{
    label: string;
    fileName: string;
    error?: string;
    missingFields?: string[];
  }>;
};

type ExtractionJob = {
  slot: ProjectLibraryDocSlot;
  documentType: DocumentType;
  label: string;
  loadBlob: () => Promise<{
    name: string;
    type: string;
    lastModified: number;
    blob: Blob;
  } | null>;
};

const FIXED_JOBS: Array<Omit<ExtractionJob, "loadBlob"> & { index: number }> = [
  { index: 0, slot: "pr-primary", documentType: "pr-card", label: "Primary PR / PRC" },
  { index: 1, slot: "dp-remarks", documentType: "dp-remarks", label: "D.P. Remarks" },
  { index: 2, slot: "crz-remarks", documentType: "crz-remarks", label: "C.R.Z. Remarks" },
  {
    index: 3,
    slot: "power-of-attorney",
    documentType: "power-of-attorney",
    label: "Power of Attorney",
  },
];

async function validateDocumentFile(
  file: File,
  documentType: DocumentType
): Promise<DocumentValidationResult> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("documentType", documentType);

  const response = await fetch("/api/validate-document", {
    method: "POST",
    body: formData,
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(
      typeof data?.error === "string" ? data.error : "Could not validate this document."
    );
  }
  return data as DocumentValidationResult;
}

function storedBlobToFile(stored: {
  name: string;
  type: string;
  lastModified: number;
  blob: Blob;
}): File {
  return new File([stored.blob], stored.name, {
    type: stored.type,
    lastModified: stored.lastModified,
  });
}

export function useProjectLibraryExtraction() {
  const [isExtracting, setIsExtracting] = useState(false);

  const runExtraction = useCallback(
    async (extraPrSlotIds: string[]): Promise<ProjectLibraryExtractionOutcome> => {
      setIsExtracting(true);

      try {
        const jobs: ExtractionJob[] = FIXED_JOBS.map(({ index, ...rest }) => ({
          ...rest,
          loadBlob: () => getProjectLibraryFile(index),
        }));

        for (const slotId of extraPrSlotIds) {
          jobs.push({
            slot: "pr-extra",
            documentType: "pr-card",
            label: "Additional PR / PRC",
            loadBlob: () => getExtraPrCard(slotId),
          });
        }

        const extractions: ProjectLibraryExtraction[] = [];
        const failures: ProjectLibraryExtractionOutcome["failures"] = [];
        let primaryPrFailed = false;

        for (const job of jobs) {
          const stored = await job.loadBlob();
          if (!stored?.blob) {
            if (job.slot === "pr-primary") primaryPrFailed = true;
            failures.push({
              label: job.label,
              fileName: stored?.name ?? job.label,
              error: "File not found in local storage.",
            });
            continue;
          }

          try {
            const file = storedBlobToFile(stored);
            const result = await validateDocumentFile(file, job.documentType);
            extractions.push({
              slot: job.slot,
              documentType: job.documentType,
              label: job.label,
              valid: result.valid,
              missingFields: result.missingFields,
              extracted: result.extracted,
            });

            if (!result.valid) {
              failures.push({
                label: job.label,
                fileName: stored.name,
                missingFields: result.missingFields,
              });
              if (job.slot === "pr-primary") primaryPrFailed = true;
            }
          } catch (err) {
            const message = err instanceof Error ? err.message : "Validation failed.";
            failures.push({ label: job.label, fileName: stored.name, error: message });
            if (job.slot === "pr-primary") primaryPrFailed = true;
          }
        }

        const autofill =
          extractions.length > 0 && !primaryPrFailed
            ? buildProjectAutofillFromExtractions(extractions)
            : null;

        return { extractions, autofill, primaryPrFailed, failures };
      } finally {
        setIsExtracting(false);
      }
    },
    []
  );

  return { isExtracting, runExtraction };
}
