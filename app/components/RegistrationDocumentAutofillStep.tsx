"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { getFieldLabel } from "@/app/lib/documentValidation/fieldLabels";
import type { DocumentValidationResult } from "@/app/components/DocumentValidationResultModal";
import {
  classifyAndValidateDocumentFile,
  validateDocumentFile,
} from "@/app/utils/validateDocumentApi";
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
  "application/pdf,image/jpeg,image/jpg,image/png,image/webp,image/gif,image/bmp";

const ACCEPTED_MIME = new Set([
  "application/pdf",
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/bmp",
]);

type DocSlot = {
  id: AutofillDocSource;
  label: string;
  required: boolean;
};

type UploadItem = {
  id: string;
  file: File;
  detectedType: AutofillDocSource | null;
  overrideType: AutofillDocSource | null;
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
  onExtractedChange?: (extracted: boolean) => void;
  /** Consultant only: Aadhaar, PAN, and license — no signatory uploads. */
  skipSignatorySlots?: boolean;
  /** Dev/testing: show control to skip upload and AI extraction. */
  allowSkipExtraction?: boolean;
  onSkipExtraction?: () => void;
};

function signatorySlots(): DocSlot[] {
  return [
    {
      id: "signatory-photo",
      label: "Authorized Signatory Photograph",
      required: true,
    },
    {
      id: "signatory-signature",
      label: "Authorized Signatory Signature",
      required: true,
    },
  ];
}

function consultantIdentitySlots(): DocSlot[] {
  return [
    { id: "aadhaar", label: "Aadhaar Card", required: true },
    { id: "pan", label: "PAN Card", required: true },
    {
      id: "technical-person-license",
      label: "Technical Person License",
      required: true,
    },
  ];
}

function slotsForKind(
  kind: RegistrationKind,
  entityType?: string,
  skipSignatorySlots = false
): DocSlot[] {
  if (kind === "consultant" && skipSignatorySlots) {
    return consultantIdentitySlots();
  }

  if (kind === "owner" && entityType === "LLP") {
    return [
      { id: "aadhaar", label: "Aadhaar Card", required: true },
      {
        id: "llp-incorporation-certificate",
        label: "Certificate of LLP Incorporation",
        required: true,
      },
      { id: "entity-pan", label: "Entity PAN Card", required: true },
      {
        id: "gst-certificate",
        label: "GST Registration Certificate",
        required: true,
      },
      ...signatorySlots(),
    ];
  }

  const common: DocSlot[] = [
    { id: "aadhaar", label: "Aadhaar Card", required: true },
  ];
  const skipPersonalPan = kind === "owner" && entityType === "LLP";
  if (!skipPersonalPan) {
    common.push({ id: "pan", label: "PAN Card", required: true });
  }
  if (kind === "consultant") {
    common.push({
      id: "technical-person-license",
      label: "Technical Person License",
      required: true,
    });
  }
  return [...common, ...signatorySlots()];
}

const ENTITY_DOC_FILE_MAP: Partial<Record<AutofillDocSource, string>> = {
  "llp-incorporation-certificate": "llpCertificate",
  "entity-pan": "llpEntityPan",
  "gst-certificate": "llpGstCertificate",
};

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function newUploadId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function isAutofillDocSource(
  value: string,
  slots: DocSlot[]
): value is AutofillDocSource {
  return slots.some((slot) => slot.id === value);
}

function effectiveType(item: UploadItem): AutofillDocSource | null {
  return item.overrideType ?? item.detectedType;
}

function toAutofillFiles(
  mapped: Partial<Record<AutofillDocSource, File | null>>
): AutofillFiles {
  const entityDocuments: Record<string, File | null> = {};
  for (const [source, docId] of Object.entries(ENTITY_DOC_FILE_MAP)) {
    const file = mapped[source as AutofillDocSource];
    if (file) entityDocuments[docId] = file;
  }

  return {
    aadhaarCardFile: mapped.aadhaar ?? null,
    panCardFile: mapped.pan ?? mapped["entity-pan"] ?? null,
    licenseCertificateFile: mapped["technical-person-license"] ?? null,
    authorizedSignatoryPhotoFile: mapped["signatory-photo"] ?? null,
    authorizedSignatorySignatureFile: mapped["signatory-signature"] ?? null,
    entityDocuments:
      Object.keys(entityDocuments).length > 0 ? entityDocuments : undefined,
  };
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

function helperCopy(slots: DocSlot[]): string {
  const labels = slots.map((s) => s.label).join(", ");
  return `Upload ${labels} together — we’ll detect each document and fill your details.`;
}

export default function RegistrationDocumentAutofillStep({
  registrationKind,
  consultantType,
  entityType,
  onAutofill,
  onContinue,
  onExtractedChange,
  skipSignatorySlots = false,
  allowSkipExtraction = false,
  onSkipExtraction,
}: RegistrationDocumentAutofillStepProps) {
  const docSlots = useMemo(
    () => slotsForKind(registrationKind, entityType, skipSignatorySlots),
    [registrationKind, entityType, skipSignatorySlots]
  );
  const requiredCount = docSlots.filter((s) => s.required).length;
  const allowedTypes = useMemo(
    () => docSlots.map((s) => s.id),
    [docSlots]
  );
  const labelByType = useMemo(() => {
    const map: Partial<Record<AutofillDocSource, string>> = {};
    for (const slot of docSlots) map[slot.id] = slot.label;
    return map;
  }, [docSlots]);

  const [uploads, setUploads] = useState<UploadItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasExtracted, setHasExtracted] = useState(false);
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
  const [dragOver, setDragOver] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const agreedRef = useRef<AutofillPatch>({});
  const filesRef = useRef<AutofillFiles>({});
  const extractionsRef = useRef<
    Partial<Record<AutofillDocSource, Record<string, string | null>>>
  >({});

  useEffect(() => {
    const entityDocuments: Record<string, File | null> = {};
    const files: AutofillFiles = {};
    for (const item of uploads) {
      const type = effectiveType(item);
      if (!type) continue;
      if (type === "aadhaar") files.aadhaarCardFile = item.file;
      else if (type === "pan") files.panCardFile = item.file;
      else if (type === "entity-pan") files.panCardFile = item.file;
      else if (type === "technical-person-license") {
        files.licenseCertificateFile = item.file;
      } else if (type === "signatory-photo") {
        files.authorizedSignatoryPhotoFile = item.file;
      } else if (type === "signatory-signature") {
        files.authorizedSignatorySignatureFile = item.file;
      }

      const entityDocId = ENTITY_DOC_FILE_MAP[type];
      if (entityDocId) {
        entityDocuments[entityDocId] = item.file;
      }
    }
    if (Object.keys(entityDocuments).length > 0) {
      files.entityDocuments = entityDocuments;
    }
    if (Object.keys(files).length > 0) {
      onAutofill({}, files);
    }
    // Keep parent form files in sync with this step so they are submitted once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uploads]);

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

  const applyMappedResults = (
    nextUploads: UploadItem[],
    continueOnSuccess: boolean
  ) => {
    const patchesBySource: Partial<Record<AutofillDocSource, AutofillPatch>> =
      {};
    const extractions: Partial<
      Record<AutofillDocSource, Record<string, string | null>>
    > = {};
    const mapped: Partial<Record<AutofillDocSource, File | null>> = {};
    const typeCounts: Partial<Record<AutofillDocSource, number>> = {};

    for (const item of nextUploads) {
      const type = effectiveType(item);
      if (!type || !item.result || item.error) continue;
      if (!item.result.valid) {
        setStepError(
          `${item.file.name} is not a valid ${labelByType[type] ?? type}. Choose the type manually or upload a different file.`
        );
        setHasExtracted(false);
        onExtractedChange?.(false);
        return false;
      }
      typeCounts[type] = (typeCounts[type] ?? 0) + 1;
      mapped[type] = item.file;
      extractions[type] = item.result.extracted;
      patchesBySource[type] = buildAutofillPatch(
        type,
        item.result.extracted,
        registrationKind,
        { consultantType, entityType }
      );
    }

    const duplicates = Object.entries(typeCounts)
      .filter(([, count]) => (count ?? 0) > 1)
      .map(([type]) => labelByType[type as AutofillDocSource] ?? type);

    if (duplicates.length > 0) {
      setStepError(
        `Duplicate document types detected: ${duplicates.join(", ")}. Remove extras or correct the type.`
      );
      setHasExtracted(false);
      onExtractedChange?.(false);
      return false;
    }

    const missingRequired = docSlots.filter(
      (slot) => slot.required && !extractions[slot.id]
    );
    if (missingRequired.length > 0) {
      setStepError(
        `Missing after detection: ${missingRequired.map((s) => s.label).join(", ")}. Upload the correct files or set the type manually.`
      );
      setHasExtracted(false);
      onExtractedChange?.(false);
      return false;
    }

    const autofillFiles = toAutofillFiles(mapped);
    const {
      agreed,
      conflicts: nextConflicts,
      groupConflicts: nextGroupConflicts,
    } = collectAutofillConflicts(patchesBySource, { consultantType, entityType });
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

    setHasExtracted(true);
    onExtractedChange?.(true);
    setStepError(null);
    if (continueOnSuccess) onContinue();
    return true;
  };

  const addFiles = (fileList: FileList | File[]) => {
    const incoming = Array.from(fileList).filter((file) => {
      const type = file.type || "";
      if (!ACCEPTED_MIME.has(type) && !/\.(pdf|jpe?g|png|webp|gif|bmp)$/i.test(file.name)) {
        return false;
      }
      return true;
    });

    if (incoming.length === 0) {
      setStepError("Please upload PDF or image files (JPEG, PNG, WebP, GIF, or BMP).");
      return;
    }

    setHasExtracted(false);
    onExtractedChange?.(false);
    setStepError(null);
    setConflicts([]);
    setGroupConflicts([]);
    setFilledFields([]);

    setUploads((prev) => {
      const room = Math.max(0, requiredCount - prev.length);
      const toAdd = incoming.slice(0, room);
      if (toAdd.length < incoming.length) {
        setStepError(
          `Please upload exactly ${requiredCount} files (${docSlots.map((s) => s.label).join(", ")}).`
        );
      }
      return [
        ...prev,
        ...toAdd.map((file) => ({
          id: newUploadId(),
          file,
          detectedType: null,
          overrideType: null,
          loading: false,
          result: null,
          error: null,
        })),
      ];
    });
  };

  const removeUpload = (id: string) => {
    setHasExtracted(false);
    onExtractedChange?.(false);
    setUploads((prev) => prev.filter((u) => u.id !== id));
    setStepError(null);
    setConflicts([]);
    setGroupConflicts([]);
    setFilledFields([]);
  };

  const handleExtractAndFill = async () => {
    setStepError(null);
    setFilledFields([]);
    setHasExtracted(false);
    onExtractedChange?.(false);
    setConflicts([]);
    setGroupConflicts([]);
    setConflictSelections({});
    setGroupConflictSelections({});

    if (uploads.length !== requiredCount) {
      setStepError(
        `Please upload exactly ${requiredCount} files: ${docSlots.map((s) => s.label).join(", ")}.`
      );
      return;
    }

    setLoading(true);
    setUploads((prev) =>
      prev.map((u) => ({
        ...u,
        loading: true,
        error: null,
        result: null,
        detectedType: u.overrideType ? u.detectedType : null,
      }))
    );

    try {
      const outcomes = await Promise.all(
        uploads.map(async (item) => {
          try {
            if (item.overrideType) {
              const result = await validateDocumentFile(
                item.file,
                item.overrideType
              );
              if (!result.valid) {
                const label = labelByType[item.overrideType] ?? "document";
                return {
                  id: item.id,
                  detectedType: item.overrideType,
                  result,
                  error: `Not a valid ${label}. Upload a different file.`,
                };
              }
              return {
                id: item.id,
                detectedType: item.overrideType,
                result,
                error: null as string | null,
              };
            }
            const result = await classifyAndValidateDocumentFile(
              item.file,
              allowedTypes
            );
            const detected = isAutofillDocSource(result.documentType, docSlots)
              ? result.documentType
              : null;
            if (!detected) {
              return {
                id: item.id,
                detectedType: null,
                result: null,
                error:
                  "Could not identify this document. Choose the type manually.",
              };
            }
            if (!result.valid) {
              const label = labelByType[detected] ?? "document";
              return {
                id: item.id,
                detectedType: detected,
                result,
                error: `Not a valid ${label}. Choose the type manually or upload a different file.`,
              };
            }
            return {
              id: item.id,
              detectedType: detected,
              result,
              error: null as string | null,
            };
          } catch (err) {
            return {
              id: item.id,
              detectedType: null as AutofillDocSource | null,
              result: null as DocumentValidationResult | null,
              error:
                err instanceof Error ? err.message : "Validation failed.",
            };
          }
        })
      );

      const nextUploads = uploads.map((item) => {
        const outcome = outcomes.find((o) => o.id === item.id);
        if (!outcome) {
          return { ...item, loading: false, error: "Validation failed." };
        }
        return {
          ...item,
          loading: false,
          detectedType: outcome.detectedType ?? item.detectedType,
          result: outcome.result,
          error: outcome.error,
        };
      });
      setUploads(nextUploads);

      const anyError = nextUploads.some((u) => u.error);
      if (anyError) {
        setStepError(
          "Some documents could not be processed. Fix errors or set the type manually, then try again."
        );
        setHasExtracted(false);
        onExtractedChange?.(false);
        return;
      }

      applyMappedResults(nextUploads, true);
    } catch {
      setHasExtracted(false);
      onExtractedChange?.(false);
      setStepError("Could not complete document extraction. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleTypeOverride = async (
    id: string,
    nextType: AutofillDocSource | ""
  ) => {
    const item = uploads.find((u) => u.id === id);
    if (!item) return;

    if (!nextType) {
      setUploads((prev) =>
        prev.map((u) =>
          u.id === id
            ? {
                ...u,
                overrideType: null,
                result: null,
                error: null,
              }
            : u
        )
      );
      setHasExtracted(false);
      onExtractedChange?.(false);
      return;
    }

    setStepError(null);
    setUploads((prev) =>
      prev.map((u) =>
        u.id === id
          ? {
              ...u,
              overrideType: nextType,
              loading: true,
              error: null,
            }
          : u
      )
    );

    try {
      const result = await validateDocumentFile(item.file, nextType);
      if (!result.valid) {
        const label = labelByType[nextType] ?? "document";
        setUploads((prev) =>
          prev.map((u) =>
            u.id === id
              ? {
                  ...u,
                  overrideType: nextType,
                  loading: false,
                  result,
                  error: `Not a valid ${label}. Upload a different file.`,
                }
              : u
          )
        );
        setHasExtracted(false);
        onExtractedChange?.(false);
        return;
      }
      setUploads((prev) => {
        const nextUploads = prev.map((u) =>
          u.id === id
            ? {
                ...u,
                overrideType: nextType,
                detectedType: u.detectedType ?? nextType,
                loading: false,
                result,
                error: null,
              }
            : u
        );
        const allReady =
          nextUploads.length === requiredCount &&
          nextUploads.every((u) => u.result && !u.error && effectiveType(u));
        if (allReady) {
          applyMappedResults(nextUploads, false);
        } else {
          setHasExtracted(false);
          onExtractedChange?.(false);
        }
        return nextUploads;
      });
    } catch (err) {
      setUploads((prev) =>
        prev.map((u) =>
          u.id === id
            ? {
                ...u,
                overrideType: nextType,
                loading: false,
                result: null,
                error:
                  err instanceof Error ? err.message : "Validation failed.",
              }
            : u
        )
      );
      setHasExtracted(false);
      onExtractedChange?.(false);
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
      {allowSkipExtraction && !hasExtracted && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-amber-900">
            Testing only: skip document upload and AI extraction to save API tokens.
            Fill the remaining fields manually.
          </p>
          <button
            type="button"
            onClick={() => {
              setHasExtracted(true);
              onExtractedChange?.(true);
              onSkipExtraction?.();
              onContinue();
            }}
            className="shrink-0 rounded-lg border border-amber-300 bg-white px-4 py-2 text-sm font-medium text-amber-900 hover:bg-amber-100"
          >
            Skip documents (dev)
          </button>
        </div>
      )}

      <p className="text-sm text-gray-600 ml-0 md:ml-11 -mt-1 mb-1">
        {helperCopy(docSlots)}
      </p>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          if (e.dataTransfer.files?.length) {
            addFiles(e.dataTransfer.files);
          }
        }}
        className={`rounded-xl border-2 border-dashed px-4 py-6 text-center transition-colors ${
          dragOver
            ? "border-brand-blue bg-blue-50/60"
            : "border-gray-200 bg-gray-50/80 hover:border-gray-300"
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPTED}
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files?.length) {
              addFiles(e.target.files);
            }
            e.target.value = "";
          }}
        />
        <p className="text-sm font-medium text-gray-800">
          Drop {requiredCount} files here, or{" "}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="text-brand-blue underline-offset-2 hover:underline"
          >
            browse
          </button>
        </p>
        <p className="mt-1 text-xs text-gray-500">
          PDF, JPEG, PNG, WebP, GIF, or BMP — exactly {requiredCount} documents (
          {docSlots.map((s) => s.label).join(", ")})
        </p>
      </div>

      {uploads.length > 0 && (
        <ul className="space-y-3">
          {uploads.map((item) => {
            const type = effectiveType(item);
            return (
              <li
                key={item.id}
                className="rounded-xl border border-gray-200 bg-white px-4 py-3"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 flex-1 space-y-1">
                    <p className="truncate text-sm font-medium text-gray-900">
                      {item.file.name}
                    </p>
                    <p className="text-xs text-gray-500">
                      {formatFileSize(item.file.size)}
                      {item.loading
                        ? " · Detecting…"
                        : type
                          ? ` · ${labelByType[type] ?? type}`
                          : ""}
                    </p>
                    {item.error && (
                      <p className="text-xs text-red-600">{item.error}</p>
                    )}
                    {!item.loading && item.result && !item.error && type && (
                      <p className="text-xs text-green-700">
                        Detected as {labelByType[type] ?? type}
                        {item.overrideType ? " (manual)" : ""}
                      </p>
                    )}
                  </div>
                  <div className="flex shrink-0 flex-wrap items-center gap-2">
                    <select
                      value={item.overrideType ?? item.detectedType ?? ""}
                      disabled={item.loading || loading}
                      onChange={(e) => {
                        const value = e.target.value;
                        void handleTypeOverride(
                          item.id,
                          isAutofillDocSource(value, docSlots) ? value : ""
                        );
                      }}
                      className="rounded-lg border border-gray-200 bg-gray-50 px-2.5 py-1.5 text-xs text-gray-900 outline-none focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20"
                      aria-label={`Document type for ${item.file.name}`}
                    >
                      <option value="">
                        {item.loading ? "Detecting…" : "Set type…"}
                      </option>
                      {docSlots.map((slot) => (
                        <option key={slot.id} value={slot.id}>
                          {slot.label}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => removeUpload(item.id)}
                      disabled={item.loading || loading}
                      className="rounded-lg border border-red-200 bg-red-50 px-2.5 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100 disabled:opacity-50"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
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
                  className="w-full rounded-lg border border-amber-300 bg-white px-3 py-2 text-sm text-black outline-none transition-colors hover:border-gray-300 focus:border-brand-blue focus:bg-white focus:ring-2 focus:ring-brand-blue/20"
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
                  className="w-full rounded-lg border border-amber-300 bg-white px-3 py-2 text-sm text-black outline-none transition-colors hover:border-gray-300 focus:border-brand-blue focus:bg-white focus:ring-2 focus:ring-brand-blue/20"
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
        <div className="rounded-lg border border-sky-100 bg-sky-50/70 px-4 py-3 text-sm text-brand-navy">
          <p className="font-semibold mb-1">Auto-filled fields</p>
          <p>{filledFields.map((key) => getFieldLabel(key)).join(", ")}</p>
        </div>
      )}

      <div className="flex flex-wrap gap-3 pt-2">
        <button
          type="button"
          onClick={handleExtractAndFill}
          disabled={loading || uploads.some((u) => u.loading)}
          className="rounded-lg bg-brand-blue px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-blue-hover disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading || uploads.some((u) => u.loading)
            ? "Detecting & saving…"
            : "Save"}
        </button>
      </div>
    </div>
  );
}
