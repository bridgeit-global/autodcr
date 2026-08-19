export const HELP_DESK_CATEGORIES = [
  "Applications",
  "Signing",
  "Account",
  "Other",
] as const;

export type HelpDeskCategory = (typeof HELP_DESK_CATEGORIES)[number];

export function isHelpDeskCategory(value: string): value is HelpDeskCategory {
  return (HELP_DESK_CATEGORIES as readonly string[]).includes(value);
}
