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

/** Appointment letter names from the legacy General department table that map to bot docs. */
const GENERAL_APPOINTMENT_TYPES = [
  "Appointment Letter for Architect",
  "Appointment Letter for Licensed Surveyor",
  "Appointment Letter for Fire Consultant",
  "Appointment Letter for MEP Consultant",
  "Appointment Letter for Plumber",
  "Appointment Letter for Town Planner",
  "Appointment Letter for Structural Engineer",
  "Appointment Letter for Environmental Consultant",
  "Appointment Letter for Landscape Consultant",
  "Appointment Letter for Geotechnical Consultant",
  "Appointment Letter for PMC / Project Manager",
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
export function listApplicationDocumentOptions(): ApplicationDocumentOption[] {
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
  if (applicationType.startsWith("Appointment Letter for")) {
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
  const formData = new FormData();
  formData.append("file", params.file);
  if (params.applicationType) {
    formData.append("applicationType", params.applicationType);
  }
  if (params.documentType) {
    formData.append("documentType", params.documentType);
  }

  try {
    const response = await fetch("/api/validate-document", {
      method: "POST",
      body: formData,
    });
    const data = await response.json();

    if (!response.ok) {
      return {
        ok: false,
        error:
          typeof data?.error === "string"
            ? data.error
            : "Could not validate this document. Please try again.",
      };
    }

    return { ok: true, result: data as DocumentValidationResult };
  } catch {
    return {
      ok: false,
      error: "Could not reach the validation service. Please try again.",
    };
  }
}
