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

const EXTRACT_CONCURRENCY = 5;

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

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> {
  if (items.length === 0) return [];
  const results: R[] = new Array(items.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < items.length) {
      const current = nextIndex;
      nextIndex += 1;
      results[current] = await fn(items[current]!);
    }
  }

  const workers = Array.from(
    { length: Math.min(limit, items.length) },
    () => worker()
  );
  await Promise.all(workers);
  return results;
}

export function useProjectLibraryExtraction() {
  const [isExtracting, setIsExtracting] = useState(false);

  const runExtraction = useCallback(
    async (extraPrSlotIds: string[]): Promise<ProjectLibraryExtractionOutcome> => {
      setIsExtracting(true);

      try {
        const candidateJobs: ExtractionJob[] = [
          ...FIXED_JOBS.map(({ index, ...rest }) => ({
            ...rest,
            loadBlob: () => getProjectLibraryFile(index),
          })),
          ...extraPrSlotIds.map((slotId) => ({
            slot: "pr-extra" as const,
            documentType: "pr-card" as DocumentType,
            label: "Additional PR / PRC",
            loadBlob: () => getExtraPrCard(slotId),
          })),
        ];

        // Only extract slots that actually have a local file (optional docs may be missing).
        const jobs: ExtractionJob[] = [];
        for (const job of candidateJobs) {
          // eslint-disable-next-line no-await-in-loop
          const stored = await job.loadBlob();
          if (stored?.blob) {
            jobs.push(job);
          }
        }

        const outcomes = await mapWithConcurrency(
          jobs,
          EXTRACT_CONCURRENCY,
          async (job) => {
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
          }
        );

        const extractions: ProjectLibraryExtraction[] = [];
        const failures: ProjectLibraryExtractionOutcome["failures"] = [];
        let primaryPrFailed = false;

        for (const outcome of outcomes) {
          const isPrCard =
            outcome.job.slot === "pr-primary" || outcome.job.slot === "pr-extra";

          if (outcome.extraction && outcome.extraction.valid) {
            extractions.push(outcome.extraction);
            continue;
          }

          if (outcome.extraction && !outcome.extraction.valid) {
            if (isPrCard) {
              if (outcome.job.slot === "pr-primary") primaryPrFailed = true;
              failures.push({
                label: outcome.job.label,
                fileName: outcome.stored?.name ?? outcome.job.label,
                missingFields: outcome.extraction.missingFields,
              });
            } else {
              // Non-PR optional docs: keep partial extraction for autofill, still note issues.
              extractions.push(outcome.extraction);
              failures.push({
                label: outcome.job.label,
                fileName: outcome.stored?.name ?? outcome.job.label,
                missingFields: outcome.extraction.missingFields,
              });
            }
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
