"use client";

import { useMemo, useRef, useState } from "react";
import { getFieldLabel } from "@/app/lib/documentValidation/fieldLabels";
import type { DocumentValidationResult } from "@/app/components/DocumentValidationResultModal";
import {
  autofillOverwriteKeys,
  buildAutofillPatch,
  collectAutofillConflicts,
  resolveAutofillPatch,
  type AutofillDocSource,
  type AutofillFieldConflict,
  type AutofillFiles,
  type AutofillGroupConflict,
  type AutofillGroupId,
  type AutofillPatch,
  type RegistrationKind,
} from "@/app/lib/documentValidation/registrationAutofill";

const ACCEPTED =
  "application/pdf,image/jpeg,image/jpg,image/png,image/webp";

type DocSlot = {
  id: AutofillDocSource;
  label: string;
  required: boolean;
};

type DocStatus = {
  loading: boolean;
  result: DocumentValidationResult | null;
  error: string | null;
};

type AutofillApplyOptions = {
  overwriteKeys?: readonly string[];
};

type RegistrationDocumentAutofillStepProps = {
  registrationKind: RegistrationKind;
  consultantType?: string;
  entityType?: string;
  onAutofill: (
    patch: AutofillPatch,
    files: AutofillFiles,
    extractions?: Partial<Record<AutofillDocSource, Record<string, string | null>>>,
    options?: AutofillApplyOptions
  ) => void;
  onContinue: () => void;
};

function slotsForKind(kind: RegistrationKind): DocSlot[] {
  const common: DocSlot[] = [
    { id: "aadhaar", label: "Aadhaar Card", required: true },
    { id: "pan", label: "PAN Card", required: true },
  ];
  if (kind === "consultant") {
    common.push({
      id: "technical-person-license",
      label: "Technical Person License",
      required: true,
    });
  }
  return common;
}

function defaultGroupConflictSelections(
  groupConflicts: AutofillGroupConflict[]
): Partial<Record<AutofillGroupId, AutofillDocSource>> {
  const selections: Partial<Record<AutofillGroupId, AutofillDocSource>> = {};
  for (const conflict of groupConflicts) {
    const first = conflict.candidates[0];
    if (first) selections[conflict.group] = first.source;
  }
  return selections;
}

function defaultConflictSelections(
  conflicts: AutofillFieldConflict[]
): Record<string, string> {
  const selections: Record<string, string> = {};
  for (const conflict of conflicts) {
    const first = conflict.candidates[0];
    if (first) selections[conflict.field] = first.value;
  }
  return selections;
}

export default function RegistrationDocumentAutofillStep({
  registrationKind,
  consultantType,
  entityType,
  onAutofill,
  onContinue,
}: RegistrationDocumentAutofillStepProps) {
  const docSlots = useMemo(
    () => slotsForKind(registrationKind),
    [registrationKind]
  );

  const [files, setFiles] = useState<
    Partial<Record<DocSlot["id"], File | null>>
  >({});
  const [statusByDoc, setStatusByDoc] = useState<
    Partial<Record<DocSlot["id"], DocStatus>>
  >({});
  const [loading, setLoading] = useState(false);
  const [filledFields, setFilledFields] = useState<string[]>([]);
  const [stepError, setStepError] = useState<string | null>(null);
  const [conflicts, setConflicts] = useState<AutofillFieldConflict[]>([]);
  const [groupConflicts, setGroupConflicts] = useState<AutofillGroupConflict[]>(
    []
  );
  const [conflictSelections, setConflictSelections] = useState<
    Record<string, string>
  >({});
  const [groupConflictSelections, setGroupConflictSelections] = useState<
    Partial<Record<AutofillGroupId, AutofillDocSource>>
  >({});

  const agreedRef = useRef<AutofillPatch>({});
  const filesRef = useRef<AutofillFiles>({});
  const extractionsRef = useRef<
    Partial<Record<AutofillDocSource, Record<string, string | null>>>
  >({});

  const validateDocument = async (
    file: File,
    documentType: DocSlot["id"]
  ): Promise<DocumentValidationResult> => {
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
        typeof data?.error === "string"
          ? data.error
          : "Could not validate this document."
      );
    }
    return data as DocumentValidationResult;
  };

  const pushAutofill = (
    agreed: AutofillPatch,
    nextConflicts: AutofillFieldConflict[],
    selections: Record<string, string>,
    nextGroupConflicts: AutofillGroupConflict[],
    groupSelections: Partial<Record<AutofillGroupId, AutofillDocSource>>,
    autofillFiles: AutofillFiles,
    extractions: Partial<
      Record<AutofillDocSource, Record<string, string | null>>
    >
  ) => {
    const patch = resolveAutofillPatch(
      agreed,
      nextConflicts,
      selections,
      nextGroupConflicts,
      groupSelections
    );
    const overwriteKeys = autofillOverwriteKeys(
      nextConflicts,
      nextGroupConflicts
    );
    onAutofill(patch, autofillFiles, extractions, { overwriteKeys });
    setFilledFields(Object.keys(patch));
  };

  const handleExtractAndFill = async () => {
    setStepError(null);
    setFilledFields([]);
    setConflicts([]);
    setGroupConflicts([]);
    setConflictSelections({});
    setGroupConflictSelections({});

    const missingRequired = docSlots.filter(
      (slot) => slot.required && !files[slot.id]
    );
    if (missingRequired.length > 0) {
      setStepError(
        `Please upload: ${missingRequired.map((s) => s.label).join(", ")}.`
      );
      return;
    }

    setLoading(true);
    const nextStatus: Partial<Record<DocSlot["id"], DocStatus>> = {};
    const patchesBySource: Partial<Record<AutofillDocSource, AutofillPatch>> =
      {};
    const extractions: Partial<
      Record<AutofillDocSource, Record<string, string | null>>
    > = {};

    try {
      for (const slot of docSlots) {
        const file = files[slot.id];
        if (!file) continue;

        nextStatus[slot.id] = { loading: true, result: null, error: null };
        setStatusByDoc({ ...nextStatus });

        try {
          const result = await validateDocument(file, slot.id);
          nextStatus[slot.id] = { loading: false, result, error: null };
          extractions[slot.id] = result.extracted;

          patchesBySource[slot.id] = buildAutofillPatch(
            slot.id,
            result.extracted,
            registrationKind,
            { consultantType, entityType }
          );
        } catch (err) {
          const message =
            err instanceof Error ? err.message : "Validation failed.";
          nextStatus[slot.id] = { loading: false, result: null, error: message };
        }

        setStatusByDoc({ ...nextStatus });
      }

      const autofillFiles: AutofillFiles = {
        aadhaarCardFile: files.aadhaar ?? null,
        panCardFile: files.pan ?? null,
        licenseCertificateFile: files["technical-person-license"] ?? null,
      };

      const { agreed, conflicts: nextConflicts, groupConflicts: nextGroupConflicts } =
        collectAutofillConflicts(patchesBySource);
      const selections = defaultConflictSelections(nextConflicts);
      const groupSelections = defaultGroupConflictSelections(nextGroupConflicts);

      agreedRef.current = agreed;
      filesRef.current = autofillFiles;
      extractionsRef.current = extractions;
      setConflicts(nextConflicts);
      setGroupConflicts(nextGroupConflicts);
      setConflictSelections(selections);
      setGroupConflictSelections(groupSelections);

      pushAutofill(
        agreed,
        nextConflicts,
        selections,
        nextGroupConflicts,
        groupSelections,
        autofillFiles,
        extractions
      );
    } catch {
      setStepError("Could not complete document extraction. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleConflictChange = (field: string, value: string) => {
    const nextSelections = { ...conflictSelections, [field]: value };
    setConflictSelections(nextSelections);
    pushAutofill(
      agreedRef.current,
      conflicts,
      nextSelections,
      groupConflicts,
      groupConflictSelections,
      filesRef.current,
      extractionsRef.current
    );
  };

  const handleGroupConflictChange = (
    group: AutofillGroupId,
    source: AutofillDocSource
  ) => {
    const nextGroupSelections = { ...groupConflictSelections, [group]: source };
    setGroupConflictSelections(nextGroupSelections);
    pushAutofill(
      agreedRef.current,
      conflicts,
      conflictSelections,
      groupConflicts,
      nextGroupSelections,
      filesRef.current,
      extractionsRef.current
    );
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-600">
        Upload your identity documents. We will extract details and pre-fill the
        registration form. You can review and edit everything before submitting.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {docSlots.map((slot) => {
          const status = statusByDoc[slot.id];
          return (
            <div key={slot.id} className="space-y-2">
              <label className="block font-medium text-black">
                {slot.label}
                {slot.required && (
                  <span className="text-red-600 font-bold"> *</span>
                )}
              </label>
              <input
                type="file"
                accept={ACCEPTED}
                onChange={(e) =>
                  setFiles((prev) => ({
                    ...prev,
                    [slot.id]: e.target.files?.[0] ?? null,
                  }))
                }
                className="border rounded-lg px-3 py-2 w-full text-black focus:ring-2 focus:ring-emerald-500 outline-none"
              />
              {files[slot.id] && (
                <p className="text-xs text-green-600">✓ {files[slot.id]!.name}</p>
              )}
              {status?.error && (
                <p className="text-xs text-red-600">{status.error}</p>
              )}
              {status?.result && (
                <p
                  className={`text-xs ${
                    status.result.valid ? "text-emerald-700" : "text-amber-700"
                  }`}
                >
                  {status.result.valid
                    ? "All extractable fields found."
                    : `Extracted with ${status.result.missingFields.length} missing field(s) — you can fill those manually.`}
                </p>
              )}
            </div>
          );
        })}
      </div>

      {registrationKind === "consultant" && !consultantType && (
        <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          Select a Consultant Type in Basic Details to map license registration
          numbers. You can still extract now; license registration fields apply
          after type is chosen.
        </p>
      )}

      {stepError && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {stepError}
        </p>
      )}

      {(groupConflicts.length > 0 || conflicts.length > 0) && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-4 space-y-3">
          <div>
            <p className="text-sm font-semibold text-amber-950">
              Conflicting values found
            </p>
            <p className="text-xs text-amber-800 mt-1">
              These fields differ across your documents. Choose which value to use
              for each field.
            </p>
          </div>
          <div className="space-y-3">
            {groupConflicts.map((groupConflict) => (
              <div key={groupConflict.group} className="space-y-1">
                <label className="block text-sm font-medium text-amber-950">
                  {groupConflict.label}
                </label>
                <select
                  value={groupConflictSelections[groupConflict.group] ?? ""}
                  onChange={(e) =>
                    handleGroupConflictChange(
                      groupConflict.group,
                      e.target.value as AutofillDocSource
                    )
                  }
                  className="w-full rounded-lg border border-amber-300 bg-white px-3 py-2 text-sm text-black focus:ring-2 focus:ring-emerald-500 outline-none"
                >
                  {groupConflict.candidates.map((candidate) => (
                    <option
                      key={`${groupConflict.group}-${candidate.source}`}
                      value={candidate.source}
                    >
                      {candidate.sourceLabel}: {candidate.displayValue}
                    </option>
                  ))}
                </select>
              </div>
            ))}
            {conflicts.map((conflict) => (
              <div key={conflict.field} className="space-y-1">
                <label className="block text-sm font-medium text-amber-950">
                  {getFieldLabel(conflict.field)}
                </label>
                <select
                  value={conflictSelections[conflict.field] ?? ""}
                  onChange={(e) =>
                    handleConflictChange(conflict.field, e.target.value)
                  }
                  className="w-full rounded-lg border border-amber-300 bg-white px-3 py-2 text-sm text-black focus:ring-2 focus:ring-emerald-500 outline-none"
                >
                  {conflict.candidates.map((candidate) => (
                    <option
                      key={`${conflict.field}-${candidate.source}-${candidate.value}`}
                      value={candidate.value}
                    >
                      {candidate.sourceLabel}: {candidate.value}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        </div>
      )}

      {filledFields.length > 0 && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          <p className="font-semibold mb-1">Auto-filled fields</p>
          <p>{filledFields.map((key) => getFieldLabel(key)).join(", ")}</p>
        </div>
      )}

      <div className="flex flex-wrap gap-3 pt-2">
        <button
          type="button"
          onClick={handleExtractAndFill}
          disabled={loading}
          className="rounded-lg bg-emerald-700 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? "Extracting…" : "Extract & fill form"}
        </button>
        <button
          type="button"
          onClick={onContinue}
          className="rounded-lg border border-gray-300 bg-white px-5 py-2.5 text-sm font-semibold text-gray-800 hover:bg-gray-50"
        >
          Continue to Basic Details
        </button>
      </div>
    </div>
  );
}
