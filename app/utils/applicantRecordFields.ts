export function addressLinesFromResidential(raw: string): {
  line1: string;
  line2: string;
  line3: string;
} {
  const text = raw.trim();
  if (!text) return { line1: "", line2: "", line3: "" };
  const parts = text
    .split(/\n|,/)
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length <= 1) return { line1: parts[0] ?? "", line2: "", line3: "" };
  if (parts.length === 2) return { line1: parts[0], line2: parts[1], line3: "" };
  return {
    line1: parts[0],
    line2: parts.slice(1, -1).join(", "),
    line3: parts[parts.length - 1],
  };
}

function pickText(...values: Array<unknown>): string {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

/** Company / firm name from auth.users `raw_user_meta_data` (owner registration). */
export function pickEntityNameFromUserMeta(
  meta: Record<string, unknown> | null | undefined
): string {
  if (!meta) return "";
  return pickText(
    meta.entity_name,
    meta.entityName,
    meta.firm_name,
    meta.company_name,
    meta.companyName
  );
}

/** Legal entity type from auth.users `raw_user_meta_data` or applicant row. */
export function pickEntityTypeFromUserMeta(
  meta: Record<string, unknown> | null | undefined
): string {
  if (!meta) return "";
  return pickText(meta.entity_type, meta.entityType);
}

/** Registration entity types (must match RegistrationForm ENTITY_TYPES). */
export const KNOWN_ENTITY_TYPES = [
  "Proprietorship / Individual",
  "Partnership Firm",
  "Pvt. Ltd. / Ltd. Company",
  "LLP",
  "Trust / Society",
  "Govt. / PSU / Local Body",
] as const;

export function isKnownEntityType(value: string): boolean {
  const normalized = value.trim().toLowerCase();
  if (!normalized) return false;
  return KNOWN_ENTITY_TYPES.some((t) => t.toLowerCase() === normalized);
}

/** Prefer auth metadata `entity_type`; ignore company names stored in the wrong field. */
export function resolveOwnerEntityTypeForDesignation(opts: {
  applicantEntityType?: string | null;
  ownerMeta?: Record<string, unknown> | null;
  companyName?: string | null;
}): string {
  const company = opts.companyName?.trim().toLowerCase() || "";
  const fromMeta = pickEntityTypeFromUserMeta(opts.ownerMeta);
  if (fromMeta && isKnownEntityType(fromMeta)) return fromMeta;

  const fromApplicant = opts.applicantEntityType?.trim() || "";
  if (
    fromApplicant &&
    isKnownEntityType(fromApplicant) &&
    fromApplicant.toLowerCase() !== company
  ) {
    return fromApplicant;
  }

  if (fromMeta && fromMeta.toLowerCase() !== company) return fromMeta;
  return "";
}

/** Map owner `entity_type` to the signatory line under the DSC (e.g. Director). */
export function entityTypeToSignatoryDesignation(entityType: string): string {
  if (!isKnownEntityType(entityType)) return "";
  const normalized = entityType.trim().toLowerCase();
  switch (normalized) {
    case "proprietorship / individual":
    case "pvt. ltd. / ltd. company":
      return "Director";
    case "llp":
      return "Designated Partner";
    case "trust / society":
      return "Trustee";
    case "partnership firm":
      return "Partner";
    case "govt. / psu / local body":
      return "Authorized Signatory";
    default:
      return "";
  }
}

export type ApplicantRosterJson = { applicants: Record<string, unknown>[] };

/** Canonical applicant row for public.applicants.applicant_details (includes address_line1–3). */
export function serializeApplicantRowForStorage(
  row: Record<string, unknown>
): Record<string, unknown> {
  const user_id = pickText(row.user_id, row.userId);
  const applicantType = pickText(row.applicantType, row.applicant_type);
  const name = pickText(row.name) || "-";
  const residentialRaw = pickText(row.residentialAddress, row.residential_address, row.address);

  let line1 = pickText(row.address_line1, row.addressLine1);
  let line2 = pickText(row.address_line2, row.addressLine2);
  let line3 = pickText(row.address_line3, row.addressLine3);
  if (!line1 && !line2 && !line3 && residentialRaw) {
    const split = addressLinesFromResidential(residentialRaw);
    line1 = split.line1;
    line2 = split.line2;
    line3 = split.line3;
  }

  const residentialAddress =
    residentialRaw || [line1, line2, line3].filter(Boolean).join(", ") || "-";

  const out: Record<string, unknown> = {
    applicantType,
    name,
    contactNumber: pickText(row.contactNumber, row.contact_number) || "-",
    email: pickText(row.email, row.emailAddress, row.email_address) || "-",
    registrationNumber:
      pickText(row.registrationNumber, row.registrationNo, row.registration_number) || "-",
    panNo: pickText(row.panNo, row.pan_no, row.pan) || "-",
    licenseIssueDate: pickText(row.licenseIssueDate, row.license_issue_date) || "-",
    residentialAddress,
    officeAddress: pickText(row.officeAddress, row.office_address) || "-",
  };

  if (user_id) out.user_id = user_id;
  if (line1) out.address_line1 = line1;
  if (line2) out.address_line2 = line2;
  if (line3) out.address_line3 = line3;
  const entityType = pickText(row.entity_type, row.entityType);
  if (entityType) out.entity_type = entityType;

  return out;
}

export function serializeApplicantRosterForStorage(applicants: unknown[]): ApplicantRosterJson {
  const rows = (Array.isArray(applicants) ? applicants : [])
    .filter(
      (a): a is Record<string, unknown> =>
        !!a && typeof a === "object" && !Array.isArray(a)
    )
    .map(serializeApplicantRowForStorage)
    .filter((a) => typeof a.user_id === "string" && String(a.user_id).trim());

  return { applicants: rows };
}

export function addressLinesFromApplicantRecord(
  rec: Record<string, unknown> | null | undefined
): { line1: string; line2: string; line3: string; company: string } {
  if (!rec) return { line1: "", line2: "", line3: "", company: "" };
  let line1 = pickText(rec.address_line1, rec.addressLine1);
  let line2 = pickText(rec.address_line2, rec.addressLine2);
  let line3 = pickText(rec.address_line3, rec.addressLine3);
  if (!line1 && !line2 && !line3) {
    const combined = pickText(rec.residentialAddress, rec.residential_address, rec.address);
    if (combined) {
      const split = addressLinesFromResidential(combined);
      line1 = split.line1;
      line2 = split.line2;
      line3 = split.line3;
    }
  }
  const company = pickText(
    rec.entity_name,
    rec.entityName,
    rec.firm_name,
    rec.company_name
  );
  return { line1, line2, line3, company };
}

export function ensureTrailingPeriodOnAddressLine3(value: string): string {
  const s = value.trim();
  if (!s) return "";
  if (/[.!?…]\s*$/.test(s)) return s;
  return `${s}.`;
}

/** Strip trailing commas, periods, and whitespace before letter formatting. */
export function stripTrailingAddressPunctuation(value: string): string {
  return value.replace(/[,.!?…\s]+$/g, "").trim();
}

export function formatAddressLineWithComma(value: string): string {
  const s = stripTrailingAddressPunctuation(value);
  if (!s) return "";
  return `${s},`;
}

/**
 * Formats up to three address lines for appointment/acceptance HTML letters:
 * non-final non-empty lines end with ",", the last non-empty line ends with ".".
 */
export function formatAddressLinesForLetterDisplay(
  line1: string,
  line2: string,
  line3: string
): { line1: string; line2: string; line3: string } {
  const sanitized = [
    stripTrailingAddressPunctuation(line1),
    stripTrailingAddressPunctuation(line2),
    stripTrailingAddressPunctuation(line3),
  ];
  const nonEmpty = sanitized
    .map((line, index) => ({ line, index }))
    .filter((entry) => entry.line.length > 0);
  const result: [string, string, string] = ["", "", ""];
  nonEmpty.forEach((entry, idx) => {
    const isLast = idx === nonEmpty.length - 1;
    result[entry.index] = isLast
      ? ensureTrailingPeriodOnAddressLine3(entry.line)
      : formatAddressLineWithComma(entry.line);
  });
  return { line1: result[0], line2: result[1], line3: result[2] };
}
