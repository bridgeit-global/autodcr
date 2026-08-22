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

export type AutofillDocSource =
  | "aadhaar"
  | "pan"
  | "entity-pan"
  | "gst-certificate"
  | "llp-incorporation-certificate"
  | "signatory-photo"
  | "signatory-signature"
  | "technical-person-license";

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
  authorizedSignatoryPhotoFile?: File | null;
  authorizedSignatorySignatureFile?: File | null;
  entityDocuments?: Partial<Record<string, File | null>>;
};

export type MergeAutofillOptions = {
  /** Force these keys even if the form already has a value (conflict resolution). */
  overwriteKeys?: readonly string[];
};

export const AUTOFILL_DOC_SOURCE_LABELS: Record<AutofillDocSource, string> = {
  aadhaar: "Aadhaar",
  pan: "PAN",
  "entity-pan": "Entity PAN",
  "gst-certificate": "GST Certificate",
  "llp-incorporation-certificate": "LLP Incorporation",
  "signatory-photo": "Signatory Photograph",
  "signatory-signature": "Signatory Signature",
  "technical-person-license": "License",
};

const BASE_AUTOFILL_DOC_SOURCE_ORDER: AutofillDocSource[] = [
  "aadhaar",
  "pan",
  "entity-pan",
  "gst-certificate",
  "llp-incorporation-certificate",
  "signatory-photo",
  "signatory-signature",
  "technical-person-license",
];

export function getAutofillDocSourceOrder(
  context: AutofillContext = {}
): AutofillDocSource[] {
  if (context.entityType === "LLP") {
    return [
      "gst-certificate",
      "llp-incorporation-certificate",
      "entity-pan",
      "aadhaar",
      "pan",
      "technical-person-license",
    ];
  }
  return BASE_AUTOFILL_DOC_SOURCE_ORDER;
}

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
  patchesBySource: Partial<Record<AutofillDocSource, AutofillPatch>>,
  context: AutofillContext = {}
): {
  agreed: AutofillPatch;
  groupConflicts: AutofillGroupConflict[];
} {
  const agreed: AutofillPatch = {};
  const groupConflicts: AutofillGroupConflict[] = [];
  const sourceOrder = getAutofillDocSourceOrder(context);

  for (const [groupId, config] of Object.entries(AUTOFILL_CONFLICT_GROUPS) as [
    AutofillGroupId,
    (typeof AUTOFILL_CONFLICT_GROUPS)[AutofillGroupId],
  ][]) {
    const candidates: AutofillGroupConflictCandidate[] = [];

    for (const source of sourceOrder) {
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
  patchesBySource: Partial<Record<AutofillDocSource, AutofillPatch>>,
  context: AutofillContext = {}
): {
  agreed: AutofillPatch;
  conflicts: AutofillFieldConflict[];
  groupConflicts: AutofillGroupConflict[];
} {
  const { agreed: groupAgreed, groupConflicts } =
    collectGroupConflicts(patchesBySource, context);

  const byField = new Map<string, AutofillFieldCandidate[]>();
  const sourceOrder = getAutofillDocSourceOrder(context);

  for (const source of sourceOrder) {
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

/** Infer consultant type from license extraction, not a manual Basic Details choice. */
export function resolveConsultantTypeFromLicense(
  extracted: Record<string, string | null>
): string | null {
  const fromProfession = resolveConsultantTypeFromProfession(extracted.profession);
  if (fromProfession) return fromProfession;

  const coaNo = extracted.coaCertificateNumber?.trim() || "";
  if (/^CA\//i.test(coaNo)) return "Architect";

  const haystack = [
    extracted.profession,
    extracted.certificateNumber,
    extracted.coaCertificateNumber,
    extracted.regulationNumber,
    extracted.department,
  ]
    .filter((value): value is string => Boolean(value && value.trim()))
    .join(" ");

  return resolveConsultantTypeFromProfession(haystack);
}

const MONTH_NAME_TO_NUMBER: Record<string, string> = {
  jan: "01",
  january: "01",
  feb: "02",
  february: "02",
  mar: "03",
  march: "03",
  apr: "04",
  april: "04",
  may: "05",
  jun: "06",
  june: "06",
  jul: "07",
  july: "07",
  aug: "08",
  august: "08",
  sep: "09",
  sept: "09",
  september: "09",
  oct: "10",
  october: "10",
  nov: "11",
  november: "11",
  dec: "12",
  december: "12",
};

function monthNameToNumber(value: string): string | null {
  const key = value.trim().toLowerCase();
  return MONTH_NAME_TO_NUMBER[key] ?? MONTH_NAME_TO_NUMBER[key.slice(0, 3)] ?? null;
}

const WORD_NUMBERS: Record<string, number> = {
  zero: 0,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  thirteen: 13,
  fourteen: 14,
  fifteen: 15,
  sixteen: 16,
  seventeen: 17,
  eighteen: 18,
  nineteen: 19,
  twenty: 20,
  thirty: 30,
  forty: 40,
  fifty: 50,
  first: 1,
  second: 2,
  third: 3,
  fourth: 4,
  fifth: 5,
  sixth: 6,
  seventh: 7,
  eighth: 8,
  ninth: 9,
  tenth: 10,
  eleventh: 11,
  twelfth: 12,
  thirteenth: 13,
  fourteenth: 14,
  fifteenth: 15,
  sixteenth: 16,
  seventeenth: 17,
  eighteenth: 18,
  nineteenth: 19,
  twentieth: 20,
  thirtieth: 30,
  thirtyfirst: 31,
};

function wordsToDayOrYear(text: string): number | null {
  const tokens = text
    .toLowerCase()
    .replace(/-/g, " ")
    .split(/\s+/)
    .filter(Boolean);
  if (tokens.length === 0) return null;

  let total = 0;
  for (const token of tokens) {
    const value = WORD_NUMBERS[token];
    if (value === undefined) return null;
    total += value;
  }
  return total > 0 ? total : null;
}

function parseWrittenYear(text: string): string | null {
  const digitYear = text.match(/\b(19|20)\d{2}\b/);
  if (digitYear) return digitYear[0];

  const lower = text.toLowerCase();
  const thousandMatch = lower.match(
    /two\s+thousand(?:\s+and)?\s+([\w\s-]+)/
  );
  if (thousandMatch) {
    const suffix = wordsToDayOrYear(thousandMatch[1]);
    if (suffix !== null && suffix >= 0 && suffix <= 99) {
      return String(2000 + suffix);
    }
  }

  return null;
}

function parseWrittenMcaDate(raw: string): string {
  const lower = raw.toLowerCase();

  let month: string | null = null;
  for (const [name, num] of Object.entries(MONTH_NAME_TO_NUMBER)) {
    if (name.length >= 3 && lower.includes(name)) {
      month = num;
      break;
    }
  }
  if (!month) return "";

  const year = parseWrittenYear(raw);
  if (!year) return "";

  let day: number | null = null;
  const dayOfMatch = lower.match(/([\w\s-]+?)\s+day\s+of/);
  if (dayOfMatch) {
    day = wordsToDayOrYear(dayOfMatch[1]);
  }
  if (!day) {
    const digitDay = lower.match(/\b(\d{1,2})(?:st|nd|rd|th)?\b/);
    if (digitDay) day = Number.parseInt(digitDay[1], 10);
  }
  if (!day || day < 1 || day > 31) return "";

  return `${year}-${month}-${String(day).padStart(2, "0")}`;
}

/** Normalize LLPIN to AAA-XXXX for form validation. */
export function normalizeLlpin(value: string | null | undefined): string {
  const raw = String(value || "").trim().toUpperCase();
  if (!raw) return "";

  if (/^[A-Z]{3}-[A-Z0-9]{4}$/.test(raw)) return raw;

  const compact = raw.replace(/[^A-Z0-9]/g, "");
  if (/^[A-Z]{3}[A-Z0-9]{4}$/.test(compact)) {
    return `${compact.slice(0, 3)}-${compact.slice(3)}`;
  }

  return raw;
}

/** Parse printed dates to HTML date input format (YYYY-MM-DD). */
export function parseDateForInput(value: string | null | undefined): string {
  const raw = String(value || "").trim();
  if (!raw) return "";

  const normalized = raw.replace(/(\d{1,2})(st|nd|rd|th)/gi, "$1");

  const dmy = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(normalized);
  if (dmy) {
    const [, d, m, y] = dmy;
    return `${y}-${m!.padStart(2, "0")}-${d!.padStart(2, "0")}`;
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) return normalized;

  const dMonthY = /^(\d{1,2})[\s./-]+([A-Za-z]+)[\s./-]+(\d{4})$/.exec(normalized);
  if (dMonthY) {
    const [, d, monthName, y] = dMonthY;
    const m = monthNameToNumber(monthName);
    if (m) return `${y}-${m}-${d!.padStart(2, "0")}`;
  }

  const monthDY = /^([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})$/.exec(normalized);
  if (monthDY) {
    const [, monthName, d, y] = monthDY;
    const m = monthNameToNumber(monthName);
    if (m) return `${y}-${m}-${d!.padStart(2, "0")}`;
  }

  return parseWrittenMcaDate(raw);
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

  const shouldApplyAadhaarAddress =
    registrationKind !== "owner" || context.entityType === "Individual";
  if (shouldApplyAadhaarAddress) {
    applyAddressPatch(patch, extracted.address, registrationKind === "owner");
    applyCityStatePincodeFromExtracted(patch, extracted, extracted.address);
  }

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

export function buildEntityPanAutofillPatch(
  extracted: Record<string, string | null>
): AutofillPatch {
  const patch: AutofillPatch = {};
  if (extracted.panNumber?.trim()) {
    patch.pan = extracted.panNumber.trim().toUpperCase();
  }
  if (extracted.name?.trim()) {
    patch.entityName = extracted.name.trim();
  }
  return patch;
}

export function buildGstAutofillPatch(
  extracted: Record<string, string | null>,
  registrationKind: RegistrationKind
): AutofillPatch {
  const patch: AutofillPatch = {};
  if (extracted.registrationNumber?.trim()) {
    patch.gstNo = extracted.registrationNumber.trim().toUpperCase();
  }
  const legalName =
    extracted.legalName?.trim() || extracted.tradeName?.trim() || "";
  if (legalName) {
    patch.entityName = legalName;
  }
  applyAddressPatch(
    patch,
    extracted.principalPlaceOfBusiness,
    registrationKind === "owner"
  );
  applyCityStatePincodeFromExtracted(
    patch,
    extracted,
    extracted.principalPlaceOfBusiness
  );
  return patch;
}

export function buildLlpIncorporationAutofillPatch(
  extracted: Record<string, string | null>
): AutofillPatch {
  const patch: AutofillPatch = {};
  const llpin = normalizeLlpin(extracted.llpin);
  if (llpin) {
    patch.llpin = llpin;
  }
  if (extracted.entityName?.trim()) {
    patch.entityName = extracted.entityName.trim();
  }
  const incorporationDate =
    parseDateForInput(extracted.incorporationDate) ||
    parseDateForInput(extracted.dateOfRegistration);
  if (incorporationDate) {
    patch.llpIncorporationDate = incorporationDate;
  }
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

const CONSULTANT_CERTIFICATE_STORAGE_BY_TYPE: Record<string, string> = {
  Architect: "coa_certificate",
  "Structural Engineer": "structural_license",
  "Licensed Surveyor": "lbs_certificate",
  "MEP Consultant": "mep_experience",
  Plumber: "phe_accreditation",
  "Fire Consultant": "fire_noc",
  "Landscape Consultant": "landscape_certificate",
  "PMC / Project Manager": "pmc_certificate",
  "Geotechnical Consultant": "lab_registration",
  "Environmental Consultant": "env_certificate",
  "Town Planner": "town_planner_certificate",
};

export function resolveConsultantCertificateUpload(
  consultantType: string,
  formData: Record<string, unknown>
): { file: File; storageType: string } | null {
  const field = CONSULTANT_CERTIFICATE_FILE_BY_TYPE[consultantType];
  const typed = field ? formData[field] : null;
  const license = formData.licenseCertificateFile;
  const file =
    typed instanceof File ? typed : license instanceof File ? license : null;
  if (!file) return null;
  return {
    file,
    storageType:
      CONSULTANT_CERTIFICATE_STORAGE_BY_TYPE[consultantType] ??
      "license_certificate",
  };
}

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
  const inferredType = resolveConsultantTypeFromLicense(extracted);
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
  documentType: AutofillDocSource,
  extracted: Record<string, string | null>,
  registrationKind: RegistrationKind,
  context: AutofillContext = {}
): AutofillPatch {
  switch (documentType) {
    case "aadhaar":
      return buildAadhaarAutofillPatch(extracted, registrationKind, context);
    case "pan":
      return buildPanAutofillPatch(extracted);
    case "entity-pan":
      return buildEntityPanAutofillPatch(extracted);
    case "gst-certificate":
      return buildGstAutofillPatch(extracted, registrationKind);
    case "llp-incorporation-certificate":
      return buildLlpIncorporationAutofillPatch(extracted);
    case "signatory-photo":
    case "signatory-signature":
      return {};
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
