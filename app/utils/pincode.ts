/** Strip non-digits from a pincode string (e.g. "400 070" → "400070"). */
export function pincodeDigits(value: string | null | undefined): string {
  return String(value ?? "").replace(/\D/g, "");
}

/** True when the value contains exactly 6 digits, ignoring spaces or other separators. */
export function isValidIndianPincode(value: string | null | undefined): boolean {
  return pincodeDigits(value).length === 6;
}

/** Normalize to 6 digits when valid; otherwise return trimmed input unchanged. */
export function normalizeIndianPincode(
  value: string | null | undefined
): string {
  const trimmed = String(value ?? "").trim();
  const digits = pincodeDigits(trimmed);
  return digits.length === 6 ? digits : trimmed;
}
