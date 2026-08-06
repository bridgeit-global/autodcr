/**
 * Post-extraction validation — null/empty values become missingFields.
 */
export type ValidationResult<T> = {
  valid: boolean;
  missingFields: string[];
  extracted: T;
};

export function validateExtractedFields<T extends Record<string, string | null>>(
  extracted: T
): ValidationResult<T> {
  const missingFields = Object.entries(extracted)
    .filter(([, value]) => value === null || value.trim() === "")
    .map(([key]) => key);

  return {
    valid: missingFields.length === 0,
    missingFields,
    extracted,
  };
}
