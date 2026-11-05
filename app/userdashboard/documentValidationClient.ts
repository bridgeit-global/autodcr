import type { DocumentValidationResult } from "@/app/components/DocumentValidationResultModal";
import {
  APPLICATION_DOCUMENTS,
  getDocumentIdsForApplication,
} from "@/app/lib/documentValidation/applications";
import {
  APPOINTMENT_PERMISSION_ID_TO_TITLE,
  getAppointmentPermissionIdsFromApplicantDetails,
} from "@/app/utils/applicantAppointmentPermissions";
import {
  getDocumentDefinition,
  isDocumentType,
  listDocumentTypes,
  type DocumentType,
} from "@/app/lib/documentValidation/registry";
import { validateDocumentFile } from "@/app/utils/validateDocumentApi";

export type DocumentTypeOption = {
  id: DocumentType;
  label: string;
};

export type ApplicationDocumentOption = {
  /** Application / permission type name sent as applicationType when useful */
  applicationType: string;
  label: string;
  documentTypes: DocumentTypeOption[];
};

/** Consultant document-pack titles (catalog / applications.permission_type). */
const GENERAL_APPOINTMENT_TYPES = [
  "Documents of Architect",
  "Documents of Licensed Surveyor",
  "Documents of Fire Consultant",
  "Documents of MEP Consultant",
  "Documents of Plumber",
  "Documents of Town Planner",
  "Documents of Structural Engineer",
  "Documents of Environmental Consultant",
  "Documents of Landscape Consultant",
  "Documents of Geotechnical Consultant",
  "Documents of PMC / Project Manager",
] as const;

function toDocumentTypeOption(id: string): DocumentTypeOption | null {
  if (!isDocumentType(id)) return null;
  return {
    id,
    label: getDocumentDefinition(id).label,
  };
}

/**
 * Options for the Document Generator document-type selector.
 * Includes registry-backed application names + appointment letters that share
 * architect-appointment-letter when mapped in APPLICATION_DOCUMENTS.
 */
export function listApplicationDocumentOptions(
  extraApplicationTypes: readonly string[] = []
): ApplicationDocumentOption[] {
  const seen = new Set<string>();
  const options: ApplicationDocumentOption[] = [];

  const push = (applicationType: string, label?: string) => {
    if (seen.has(applicationType)) return;
    const ids = getDocumentIdsForApplication(applicationType);
    const documentTypes = ids
      .map((id) => toDocumentTypeOption(id))
      .filter((x): x is DocumentTypeOption => Boolean(x));

    // Appointment letters without an APPLICATION_DOCUMENTS entry still use architect letter
    if (
      documentTypes.length === 0 &&
      applicationType.startsWith("Documents of ") ||
      applicationType.startsWith("Appointment Letter for")
    ) {
      const arch = toDocumentTypeOption("architect-appointment-letter");
      if (arch) documentTypes.push(arch);
    }

    if (documentTypes.length === 0) return;
    seen.add(applicationType);
    options.push({
      applicationType,
      label: label ?? applicationType,
      documentTypes,
    });
  };

  for (const name of Object.keys(APPLICATION_DOCUMENTS)) {
    push(name);
  }
  for (const name of GENERAL_APPOINTMENT_TYPES) {
    push(name);
  }
  for (const name of extraApplicationTypes) {
    push(name);
  }

  // Also expose bare registry types as selectable rows
  for (const id of listDocumentTypes()) {
    const def = getDocumentDefinition(id);
    push(def.label, def.label);
  }

  return options.sort((a, b) => a.label.localeCompare(b.label));
}

/** Appointment letters allowed for a project based on Applicant Details roster. */
export function filterApplicationDocumentOptionsByApplicantDetails(
  allOptions: ApplicationDocumentOption[],
  applicantDetails: unknown
): ApplicationDocumentOption[] {
  const allowedIds = getAppointmentPermissionIdsFromApplicantDetails(applicantDetails);
  if (allowedIds.size === 0) return [];

  const allowedTitles = new Set<string>();
  for (const id of allowedIds) {
    const title = APPOINTMENT_PERMISSION_ID_TO_TITLE[id];
    if (title) allowedTitles.add(title);
  }

  return allOptions
    .filter((opt) => allowedTitles.has(opt.applicationType))
    .sort((a, b) => a.label.localeCompare(b.label));
}

export function resolveDocumentTypeOptions(
  applicationType: string
): DocumentTypeOption[] {
  const ids = getDocumentIdsForApplication(applicationType);
  const mapped = ids
    .map((id) => toDocumentTypeOption(id))
    .filter((x): x is DocumentTypeOption => Boolean(x));
  if (mapped.length > 0) return mapped;
  if (
    applicationType.startsWith("Documents of ") ||
    applicationType.startsWith("Appointment Letter for")
  ) {
    const arch = toDocumentTypeOption("architect-appointment-letter");
    return arch ? [arch] : [];
  }
  return [];
}

export async function validateDocumentUpload(params: {
  file: File;
  applicationType?: string;
  documentType?: string;
}): Promise<
  | { ok: true; result: DocumentValidationResult }
  | { ok: false; error: string }
> {
  if (!params.documentType) {
    return { ok: false, error: "Missing documentType." };
  }
  try {
    const result = await validateDocumentFile(
      params.file,
      params.documentType as DocumentType,
      params.applicationType
    );
    return { ok: true, result };
  } catch (err) {
    return {
      ok: false,
      error:
        err instanceof Error
          ? err.message
          : "Could not reach the validation service. Please try again.",
    };
  }
}
