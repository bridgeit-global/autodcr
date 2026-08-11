import {
  CONSULTANT_TYPE_OPTIONS,
  EXTRA_REG_REQUIRED_BY_TYPE,
  REGISTRATION_NUMBER_META_BY_TYPE,
} from "@/app/utils/consultantRegistrationShared";
import { normalizeIndianPincode, pincodeDigits } from "@/app/utils/pincode";

export type RegistrationKind = "owner" | "consultant";

export type AutofillContext = {
  consultantType?: string;
  entityType?: string;
};

export type AutofillPatch = Record<string, string>;

export type AutofillDocSource = "aadhaar" | "pan" | "technical-person-license";

export type AutofillFieldCandidate = {
  source: AutofillDocSource;
  sourceLabel: string;
  value: string;
};

export type AutofillFieldConflict = {
  field: string;
  candidates: AutofillFieldCandidate[];
};

export type AutofillGroupId = "name" | "address";

export type AutofillGroupConflictCandidate = {
  source: AutofillDocSource;
  sourceLabel: string;
  displayValue: string;
  patch: AutofillPatch;
};

export type AutofillGroupConflict = {
  group: AutofillGroupId;
  label: string;
  candidates: AutofillGroupConflictCandidate[];
};

export const AUTOFILL_CONFLICT_GROUPS: Record<
  AutofillGroupId,
  { label: string; fields: readonly string[] }
> = {
  name: {
    label: "Name",
    fields: ["firstName", "middleName", "lastName", "fullNameProprietor"],
  },
  address: {
    label: "Address",
    fields: [
      "address",
      "addressLine1",
      "addressLine2",
      "addressLine3",
      "residentialAddress",
      "city",
      "state",
      "pincode",
    ],
  },
};

const GROUPED_AUTOFILL_FIELDS = new Set(
  Object.values(AUTOFILL_CONFLICT_GROUPS).flatMap((g) => g.fields)
);

export type AutofillFiles = {
  aadhaarCardFile?: File | null;
  panCardFile?: File | null;
  licenseCertificateFile?: File | null;
};

export type MergeAutofillOptions = {
  /** Force these keys even if the form already has a value (conflict resolution). */
  overwriteKeys?: readonly string[];
};

export const AUTOFILL_DOC_SOURCE_LABELS: Record<AutofillDocSource, string> = {
  aadhaar: "Aadhaar",
  pan: "PAN",
  "technical-person-license": "License",
};

const AUTOFILL_DOC_SOURCE_ORDER: AutofillDocSource[] = [
  "aadhaar",
  "pan",
  "technical-person-license",
];

const PROFESSION_TO_CONSULTANT_TYPE: Array<{
  patterns: RegExp[];
  consultantType: (typeof CONSULTANT_TYPE_OPTIONS)[number];
}> = [
  {
    patterns: [/\barchitect/i, /\bcoa\b/i],
    consultantType: "Architect",
  },
  {
    patterns: [/\bstructural engineer/i, /\bstructural\b/i],
    consultantType: "Structural Engineer",
  },
  {
    patterns: [/\blicensed surveyor/i, /\bsurveyor/i, /\blbs\b/i],
    consultantType: "Licensed Surveyor",
  },
  {
    patterns: [/\bmep\b/i, /\belectrical consultant/i, /\bmep consultant/i],
    consultantType: "MEP Consultant",
  },
  {
    patterns: [/\bplumber/i, /\bplumbing/i],
    consultantType: "Plumber",
  },
  {
    patterns: [/\bfire consultant/i, /\bfire (safety|protection)/i, /\bcfo\b/i],
    consultantType: "Fire Consultant",
  },
  {
    patterns: [/\blandscape/i],
    consultantType: "Landscape Consultant",
  },
  {
    patterns: [/\bpmc\b/i, /\bproject manager/i],
    consultantType: "PMC / Project Manager",
  },
  {
    patterns: [/\bgeotechnical/i, /\bsoil testing/i, /\bnabl\b/i],
    consultantType: "Geotechnical Consultant",
  },
  {
    patterns: [/\benvironmental consultant/i, /\benvironmental/i],
    consultantType: "Environmental Consultant",
  },
  {
    patterns: [/\btown planner/i, /\btown planning/i],
    consultantType: "Town Planner",
  },
];

export function isEmptyAutofillValue(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === "string") return value.trim() === "";
  return false;
}

export function mergeAutofill<T extends Record<string, unknown>>(
  existing: T,
  patch: AutofillPatch,
  options?: MergeAutofillOptions
): T {
  const overwrite = new Set(options?.overwriteKeys ?? []);
  const merged = { ...existing };
  for (const [key, value] of Object.entries(patch)) {
    if (isEmptyAutofillValue(value)) continue;
    const current = merged[key];
    if (overwrite.has(key) || isEmptyAutofillValue(current)) {
      (merged as Record<string, unknown>)[key] = value;
    }
  }
  return merged;
}

export function normalizeAutofillCompareValue(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

function pickGroupPatch(
  patch: AutofillPatch,
  fields: readonly string[]
): AutofillPatch {
  const out: AutofillPatch = {};
  for (const field of fields) {
    const value = patch[field];
    if (!isEmptyAutofillValue(value)) {
      out[field] = value;
    }
  }
  return out;
}

function formatNameDisplay(patch: AutofillPatch): string {
  const parts = [patch.firstName, patch.middleName, patch.lastName]
    .map((v) => (typeof v === "string" ? v.trim() : ""))
    .filter(Boolean);
  if (parts.length > 0) return parts.join(" ");
  return typeof patch.fullNameProprietor === "string"
    ? patch.fullNameProprietor.trim()
    : "";
}

function formatAddressDisplay(patch: AutofillPatch): string {
  if (typeof patch.address === "string" && patch.address.trim()) {
    return patch.address.trim();
  }
  const lines = [patch.addressLine1, patch.addressLine2, patch.addressLine3]
    .map((v) => (typeof v === "string" ? v.trim() : ""))
    .filter(Boolean);
  return lines.join(", ");
}

function collectGroupConflicts(
  patchesBySource: Partial<Record<AutofillDocSource, AutofillPatch>>
): {
  agreed: AutofillPatch;
  groupConflicts: AutofillGroupConflict[];
} {
  const agreed: AutofillPatch = {};
  const groupConflicts: AutofillGroupConflict[] = [];

  for (const [groupId, config] of Object.entries(AUTOFILL_CONFLICT_GROUPS) as [
    AutofillGroupId,
    (typeof AUTOFILL_CONFLICT_GROUPS)[AutofillGroupId],
  ][]) {
    const candidates: AutofillGroupConflictCandidate[] = [];

    for (const source of AUTOFILL_DOC_SOURCE_ORDER) {
      const patch = patchesBySource[source];
      if (!patch) continue;

      const groupPatch = pickGroupPatch(patch, config.fields);
      const displayValue =
        groupId === "name"
          ? formatNameDisplay(groupPatch)
          : formatAddressDisplay(groupPatch);

      if (!displayValue) continue;

      candidates.push({
        source,
        sourceLabel: AUTOFILL_DOC_SOURCE_LABELS[source],
        displayValue,
        patch: groupPatch,
      });
    }

    if (candidates.length === 0) continue;

    const unique = new Map<string, AutofillGroupConflictCandidate>();
    for (const candidate of candidates) {
      const key = normalizeAutofillCompareValue(candidate.displayValue);
      if (!unique.has(key)) unique.set(key, candidate);
    }

    if (unique.size <= 1) {
      const only = unique.values().next().value;
      if (only) Object.assign(agreed, only.patch);
      continue;
    }

    groupConflicts.push({
      group: groupId,
      label: config.label,
      candidates: Array.from(unique.values()),
    });
  }

  return { agreed, groupConflicts };
}

/**
 * Compare per-document patches. Agreed fields share one value;
 * name/address groups get one dropdown each; other conflicts are per-field.
 */
export function collectAutofillConflicts(
  patchesBySource: Partial<Record<AutofillDocSource, AutofillPatch>>
): {
  agreed: AutofillPatch;
  conflicts: AutofillFieldConflict[];
  groupConflicts: AutofillGroupConflict[];
} {
  const { agreed: groupAgreed, groupConflicts } =
    collectGroupConflicts(patchesBySource);

  const byField = new Map<string, AutofillFieldCandidate[]>();

  for (const source of AUTOFILL_DOC_SOURCE_ORDER) {
    const patch = patchesBySource[source];
    if (!patch) continue;
    for (const [field, value] of Object.entries(patch)) {
      if (GROUPED_AUTOFILL_FIELDS.has(field)) continue;
      if (isEmptyAutofillValue(value)) continue;
      const list = byField.get(field) ?? [];
      list.push({
        source,
        sourceLabel: AUTOFILL_DOC_SOURCE_LABELS[source],
        value,
      });
      byField.set(field, list);
    }
  }

  const agreed: AutofillPatch = { ...groupAgreed };
  const conflicts: AutofillFieldConflict[] = [];

  for (const [field, candidates] of byField) {
    const unique = new Map<string, AutofillFieldCandidate>();
    for (const candidate of candidates) {
      const key = normalizeAutofillCompareValue(candidate.value);
      if (!unique.has(key)) unique.set(key, candidate);
    }

    if (unique.size <= 1) {
      const only = unique.values().next().value;
      if (only) agreed[field] = only.value;
      continue;
    }

    conflicts.push({
      field,
      candidates: Array.from(unique.values()),
    });
  }

  conflicts.sort((a, b) => a.field.localeCompare(b.field));
  return { agreed, conflicts, groupConflicts };
}

/** Build final patch from agreed values + group/field conflict selections. */
export function resolveAutofillPatch(
  agreed: AutofillPatch,
  conflicts: AutofillFieldConflict[],
  selections: Record<string, string>,
  groupConflicts: AutofillGroupConflict[] = [],
  groupSelections: Partial<Record<AutofillGroupId, AutofillDocSource>> = {}
): AutofillPatch {
  const patch: AutofillPatch = { ...agreed };

  for (const groupConflict of groupConflicts) {
    const selectedSource =
      groupSelections[groupConflict.group] ??
      groupConflict.candidates[0]?.source;
    const selected = groupConflict.candidates.find(
      (c) => c.source === selectedSource
    );
    if (selected) {
      Object.assign(patch, selected.patch);
    }
  }

  for (const conflict of conflicts) {
    const selected =
      selections[conflict.field] ?? conflict.candidates[0]?.value ?? "";
    if (!isEmptyAutofillValue(selected)) {
      patch[conflict.field] = selected;
    }
  }

  return patch;
}

export function autofillOverwriteKeys(
  conflicts: AutofillFieldConflict[],
  groupConflicts: AutofillGroupConflict[]
): string[] {
  const keys = new Set<string>();
  for (const conflict of conflicts) {
    keys.add(conflict.field);
  }
  for (const groupConflict of groupConflicts) {
    for (const field of AUTOFILL_CONFLICT_GROUPS[groupConflict.group].fields) {
      keys.add(field);
    }
  }
  return Array.from(keys);
}

export function splitFullName(name: string | null | undefined): {
  firstName: string;
  middleName: string;
  lastName: string;
} {
  const parts = String(name || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (parts.length === 0) {
    return { firstName: "", middleName: "", lastName: "" };
  }
  if (parts.length === 1) {
    return { firstName: parts[0]!, middleName: "", lastName: "" };
  }
  if (parts.length === 2) {
    return { firstName: parts[0]!, middleName: "", lastName: parts[1]! };
  }

  return {
    firstName: parts[0]!,
    middleName: parts.slice(1, -1).join(" "),
    lastName: parts[parts.length - 1]!,
  };
}

export function splitAddressLines(address: string | null | undefined): {
  addressLine1: string;
  addressLine2: string;
  addressLine3: string;
  residentialAddress: string;
} {
  const lines = String(address || "")
    .split(/\r?\n|,/)
    .map((line) => line.trim())
    .filter(Boolean);

  return {
    addressLine1: lines[0] ?? "",
    addressLine2: lines[1] ?? "",
    addressLine3: lines.slice(2).join(", "),
    residentialAddress: lines.join("\n"),
  };
}

/** Extract 6-digit pincode and city/locality from a typical Indian address block. */
function extractPincodeFromAddressText(text: string): {
  pincode: string;
  rawMatch: string;
} {
  const normalized = text.replace(/\n/g, " ");

  const pinLabelMatch =
    /(?:pin\s*code|pincode|pin)\s*[:\-]?\s*(\d{3}\s*\d{3}|\d{6})/i.exec(
      normalized
    );
  if (pinLabelMatch?.[1]) {
    return {
      pincode: normalizeIndianPincode(pinLabelMatch[1]),
      rawMatch: pinLabelMatch[1],
    };
  }

  const spacedMatch = /\b(\d{3}\s+\d{3})\b/.exec(normalized);
  if (spacedMatch?.[1]) {
    return {
      pincode: normalizeIndianPincode(spacedMatch[1]),
      rawMatch: spacedMatch[1],
    };
  }

  const compactMatch =
    /\b(\d{6})\b(?!.*\b\d{6}\b)/.exec(normalized)?.[1] ??
    /\b(\d{6})\b/.exec(normalized)?.[1];
  if (compactMatch) {
    return { pincode: compactMatch, rawMatch: compactMatch };
  }

  return { pincode: "", rawMatch: "" };
}

export function parseCityPincodeFromAddress(
  address: string | null | undefined
): { city: string; pincode: string } {
  const text = String(address || "").trim();
  if (!text) return { city: "", pincode: "" };

  const { pincode, rawMatch } = extractPincodeFromAddressText(text);
  if (!pincode || pincodeDigits(pincode).length !== 6) {
    return { city: "", pincode: "" };
  }

  const beforePin = rawMatch ? text.split(rawMatch)[0] ?? "" : "";
  const segments = beforePin
    .split(/[\n,]/)
    .map((part) => part.trim())
    .filter(Boolean);

  let city = segments[segments.length - 1] ?? "";
  city = city
    .replace(/\(\s*[WE]\s*\)/gi, "")
    .replace(/\s*-\s*$/, "")
    .replace(/\bdist(?:rict)?\.?\b.*$/i, "")
    .trim();

  if (!city && segments.length >= 2) {
    city = segments[segments.length - 2]!
      .replace(/\(\s*[WE]\s*\)/gi, "")
      .trim();
  }

  return { city, pincode };
}

export function normalizePhoneForAutofill(value: string | null | undefined): string {
  const digits = String(value || "").replace(/\D/g, "");
  if (digits.length >= 10) return digits.slice(-10);
  return digits;
}

/** Map license profession text to a dashboard consultant type option. */
export function resolveConsultantTypeFromProfession(
  profession: string | null | undefined
): string | null {
  const raw = String(profession || "").trim();
  if (!raw) return null;

  for (const entry of PROFESSION_TO_CONSULTANT_TYPE) {
    if (entry.patterns.some((pattern) => pattern.test(raw))) {
      return entry.consultantType;
    }
  }

  const exact = CONSULTANT_TYPE_OPTIONS.find(
    (option) => option.toLowerCase() === raw.toLowerCase()
  );
  return exact ?? null;
}

/** Parse printed dates to HTML date input format (YYYY-MM-DD). */
export function parseDateForInput(value: string | null | undefined): string {
  const raw = String(value || "").trim();
  if (!raw) return "";

  const dmy = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(raw);
  if (dmy) {
    const [, d, m, y] = dmy;
    return `${y}-${m!.padStart(2, "0")}-${d!.padStart(2, "0")}`;
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;

  return "";
}

function applyNamePatch(
  patch: AutofillPatch,
  name: string | null | undefined,
  includeProprietorName: boolean
): void {
  if (!name?.trim()) return;
  const split = splitFullName(name);
  if (split.firstName) patch.firstName = split.firstName;
  if (split.middleName) patch.middleName = split.middleName;
  if (split.lastName) patch.lastName = split.lastName;
  if (includeProprietorName) {
    patch.fullNameProprietor = name.trim();
  }
}

function applyCityStatePincodeFromExtracted(
  patch: AutofillPatch,
  extracted: Record<string, string | null>,
  addressFallback?: string | null
): void {
  if (extracted.city?.trim()) {
    patch.city = extracted.city.trim();
  }
  if (extracted.state?.trim()) {
    patch.state = extracted.state.trim();
  }
  if (extracted.pincode?.trim()) {
    patch.pincode = normalizeIndianPincode(extracted.pincode);
  }

  // Fallback: parse from address only when extraction left city/pincode empty.
  if (addressFallback?.trim()) {
    const parsed = parseCityPincodeFromAddress(addressFallback);
    if (!patch.city && parsed.city) patch.city = parsed.city;
    if (!patch.pincode && parsed.pincode) patch.pincode = parsed.pincode;
  }
}

function applyAddressPatch(
  patch: AutofillPatch,
  address: string | null | undefined,
  includeResidential: boolean
): void {
  if (!address?.trim()) return;
  const lines = splitAddressLines(address);
  if (lines.addressLine1) patch.addressLine1 = lines.addressLine1;
  if (lines.addressLine2) patch.addressLine2 = lines.addressLine2;
  if (lines.addressLine3) patch.addressLine3 = lines.addressLine3;
  patch.address = lines.residentialAddress;
  if (includeResidential) {
    patch.residentialAddress = lines.residentialAddress;
  }
}

function applyPhonePatch(
  patch: AutofillPatch,
  contactNumber: string | null | undefined
): void {
  const phone = normalizePhoneForAutofill(contactNumber);
  if (phone.length === 10) {
    patch.alternatePhone = phone;
  }
}

export function buildAadhaarAutofillPatch(
  extracted: Record<string, string | null>,
  registrationKind: RegistrationKind,
  context: AutofillContext
): AutofillPatch {
  const patch: AutofillPatch = {};
  const includeProprietor =
    context.entityType === "Proprietorship" || context.entityType === "Individual";

  if (extracted.aadhaarNumber?.trim()) {
    patch.aadhaarNo = extracted.aadhaarNumber.trim();
  }

  applyNamePatch(patch, extracted.name, includeProprietor);
  applyAddressPatch(patch, extracted.address, registrationKind === "owner");
  applyCityStatePincodeFromExtracted(patch, extracted, extracted.address);
  applyPhonePatch(patch, extracted.contactNumber);

  return patch;
}

export function buildPanAutofillPatch(
  extracted: Record<string, string | null>
): AutofillPatch {
  const patch: AutofillPatch = {};
  if (extracted.panNumber?.trim()) {
    patch.pan = extracted.panNumber.trim().toUpperCase();
  }
  applyNamePatch(patch, extracted.name, false);
  applyCityStatePincodeFromExtracted(patch, extracted);
  return patch;
}

const CONSULTANT_CERTIFICATE_FILE_BY_TYPE: Record<string, string> = {
  Architect: "coaCertificateFile",
  "Structural Engineer": "structuralLicenseFile",
  "Licensed Surveyor": "lbsCertificateFile",
  "MEP Consultant": "mepExperienceFile",
  Plumber: "pheAccreditationFile",
  "Fire Consultant": "pastNocFile",
  "Landscape Consultant": "landscapeCertificateFile",
  "PMC / Project Manager": "pmcCertificateFile",
  "Geotechnical Consultant": "labRegistrationFile",
  "Environmental Consultant": "envCertificateFile",
  "Town Planner": "townPlannerCertificateFile",
};

function firstExpiryField(consultantType: string): string | null {
  const extras = EXTRA_REG_REQUIRED_BY_TYPE[consultantType] ?? [];
  return (
    extras.find(
      (field) =>
        field.toLowerCase().includes("expiry") ||
        field.toLowerCase().includes("validity")
    ) ??
    extras[0] ??
    null
  );
}

export function buildLicenseAutofillPatch(
  extracted: Record<string, string | null>,
  consultantType?: string,
  registrationKind: RegistrationKind = "consultant"
): AutofillPatch {
  const patch: AutofillPatch = {};
  const inferredType = resolveConsultantTypeFromProfession(extracted.profession);
  const effectiveType =
    registrationKind === "consultant"
      ? consultantType || inferredType || undefined
      : undefined;

  if (registrationKind === "consultant" && !consultantType && inferredType) {
    patch.consultantType = inferredType;
  }

  if (effectiveType) {
    const regMapping = REGISTRATION_NUMBER_META_BY_TYPE[effectiveType];
    const regNo =
      extracted.coaCertificateNumber?.trim() ||
      extracted.certificateNumber?.trim();

    if (regMapping && regNo) {
      patch[regMapping.formField] = regNo;
    }

    const regDate =
      parseDateForInput(extracted.approvalDate) ||
      parseDateForInput(extracted.applicationDate);
    if (regDate) {
      patch.registrationDate = regDate;
    }

    const expiryField = firstExpiryField(effectiveType);
    const expiryDate =
      parseDateForInput(extracted.validityDate) ||
      parseDateForInput(extracted.coaLicenseExpiryDate);
    if (expiryField && expiryDate) {
      patch[expiryField] = expiryDate;
    }
  }

  applyNamePatch(patch, extracted.technicalPersonName, false);
  applyAddressPatch(patch, extracted.address, registrationKind === "owner");
  applyCityStatePincodeFromExtracted(patch, extracted, extracted.address);

  if (extracted.organizationName?.trim()) {
    patch.entityName = extracted.organizationName.trim();
  }

  // Last resort for city only when extraction + address parse left it empty.
  if (!patch.city && extracted.officeLocation?.trim()) {
    patch.city = extracted.officeLocation.trim();
  }

  return patch;
}

export function getConsultantCertificateFileField(
  consultantType?: string
): string | null {
  if (!consultantType) return null;
  return CONSULTANT_CERTIFICATE_FILE_BY_TYPE[consultantType] ?? null;
}

export function buildAutofillPatch(
  documentType: "aadhaar" | "pan" | "technical-person-license",
  extracted: Record<string, string | null>,
  registrationKind: RegistrationKind,
  context: AutofillContext = {}
): AutofillPatch {
  switch (documentType) {
    case "aadhaar":
      return buildAadhaarAutofillPatch(extracted, registrationKind, context);
    case "pan":
      return buildPanAutofillPatch(extracted);
    case "technical-person-license":
      if (registrationKind !== "consultant") return {};
      return buildLicenseAutofillPatch(
        extracted,
        context.consultantType,
        registrationKind
      );
    default:
      return {};
  }
}

export function listFilledAutofillKeys(
  before: Record<string, unknown>,
  after: Record<string, unknown>
): string[] {
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  const filled: string[] = [];
  for (const key of keys) {
    if (isEmptyAutofillValue(before[key]) && !isEmptyAutofillValue(after[key])) {
      filled.push(key);
    }
  }
  return filled.sort();
}
