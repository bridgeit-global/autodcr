import type { z } from "zod";

/** Fields that satisfy one requirement when any member is present. */
export type AlternativeFieldGroup = {
  fields: readonly string[];
  /** Reported in missingFields when every member is null/empty. */
  missingLabel: string;
};

export type DocumentValidationRules = {
  alternativeFieldGroups?: readonly AlternativeFieldGroup[];
  /** Fields that may be null/empty without failing validation. */
  optionalFields?: readonly string[];
};

export type DocumentDefinition<T extends z.ZodTypeAny> = {
  id: string;
  label: string;
  schema: T;
  buildPrompt: (documentText: string) => string;
  /** Optional post-extraction business rules (does not change the Zod schema). */
  validation?: DocumentValidationRules;
};
