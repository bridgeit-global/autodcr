/**
 * Post-extraction validation — null/empty values become missingFields.
 * Supports optional alternative field groups (any-one-present satisfies the requirement).
 */
import type { DocumentValidationRules } from "./types";

export type ValidationResult<T> = {
  valid: boolean;
  missingFields: string[];
  extracted: T;
};

function isEmpty(value: string | null | undefined): boolean {
  return value === null || value === undefined || value.trim() === "";
}

export function validateExtractedFields<T extends Record<string, string | null>>(
  extracted: T,
  rules?: DocumentValidationRules
): ValidationResult<T> {
  const alternativeGroups = rules?.alternativeFieldGroups ?? [];
  const groupedKeys = new Set(
    alternativeGroups.flatMap((group) => group.fields)
  );

  const missingFields: string[] = [];

  for (const group of alternativeGroups) {
    const hasAny = group.fields.some((key) => !isEmpty(extracted[key] ?? null));
    if (!hasAny) {
      missingFields.push(group.missingLabel);
    }
  }

  for (const [key, value] of Object.entries(extracted)) {
    if (groupedKeys.has(key)) continue;
    if (isEmpty(value)) {
      missingFields.push(key);
    }
  }

  return {
    valid: missingFields.length === 0,
    missingFields,
    extracted,
  };
}
