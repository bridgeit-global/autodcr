"use client";

import { useCallback, useState } from "react";
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
import { validateDocumentFile } from "@/app/utils/validateDocumentApi";

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

        const outcomes = await Promise.all(
          jobs.map(async (job) => {
            const stored = await job.loadBlob();
            if (!stored?.blob) {
              return {
                job,
                stored: null as { name: string } | null,
                extraction: null as ProjectLibraryExtraction | null,
                error: "File not found in local storage.",
              };
            }

            try {
              const file = storedBlobToFile(stored);
              const result = await validateDocumentFile(file, job.documentType);
              return {
                job,
                stored: { name: stored.name },
                extraction: {
                  slot: job.slot,
                  documentType: job.documentType,
                  label: job.label,
                  valid: result.valid,
                  missingFields: result.missingFields,
                  extracted: result.extracted,
                },
                error: null as string | null,
              };
            } catch (err) {
              return {
                job,
                stored: { name: stored.name },
                extraction: null,
                error: err instanceof Error ? err.message : "Validation failed.",
              };
            }
          })
        );

        const extractions: ProjectLibraryExtraction[] = [];
        const failures: ProjectLibraryExtractionOutcome["failures"] = [];
        let primaryPrFailed = false;

        for (const outcome of outcomes) {
          if (outcome.extraction) {
            extractions.push(outcome.extraction);
            continue;
          }
          if (outcome.job.slot === "pr-primary") primaryPrFailed = true;
          failures.push({
            label: outcome.job.label,
            fileName: outcome.stored?.name ?? outcome.job.label,
            error: outcome.error ?? "Validation failed.",
          });
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
