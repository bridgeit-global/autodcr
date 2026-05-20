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
