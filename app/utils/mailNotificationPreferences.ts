import type { ApplicationStage } from "@/app/utils/email";

export type MailNotificationPhase = "draft" | "in_process" | "approved" | "rejected";

export type MailNotificationPreferences = Record<MailNotificationPhase, boolean>;

const PREFERENCE_KEYS: Record<MailNotificationPhase, string> = {
  draft: "mail_notify_draft",
  in_process: "mail_notify_in_process",
  approved: "mail_notify_approved",
  rejected: "mail_notify_rejected",
};

export const DEFAULT_MAIL_NOTIFICATION_PREFERENCES: MailNotificationPreferences = {
  draft: true,
  in_process: true,
  approved: true,
  rejected: true,
};

export const MAIL_NOTIFICATION_LABELS: Record<
  MailNotificationPhase,
  { title: string; description: string }
> = {
  draft: {
    title: "Draft",
    description: "When a new application is created and saved as draft",
  },
  in_process: {
    title: "In Process",
    description: "When an application moves to In Process or requires your signature",
  },
  approved: {
    title: "Approved or Verified",
    description: "When all required signatures are complete",
  },
  rejected: {
    title: "Rejected or Cancelled",
    description: "When an application is rejected by the owner or consultant",
  },
};

function readBooleanPref(metadata: Record<string, unknown> | null | undefined, key: string): boolean {
  const value = metadata?.[key];
  if (value === false) return false;
  if (value === true) return true;
  return true;
}

export function getMailNotificationPreferences(
  metadata: Record<string, unknown> | null | undefined
): MailNotificationPreferences {
  return {
    draft: readBooleanPref(metadata, PREFERENCE_KEYS.draft),
    in_process: readBooleanPref(metadata, PREFERENCE_KEYS.in_process),
    approved: readBooleanPref(metadata, PREFERENCE_KEYS.approved),
    rejected: readBooleanPref(metadata, PREFERENCE_KEYS.rejected),
  };
}

export function mailNotificationPreferencesToMetadata(
  prefs: MailNotificationPreferences
): Record<string, boolean> {
  return {
    [PREFERENCE_KEYS.draft]: prefs.draft,
    [PREFERENCE_KEYS.in_process]: prefs.in_process,
    [PREFERENCE_KEYS.approved]: prefs.approved,
    [PREFERENCE_KEYS.rejected]: prefs.rejected,
  };
}

export function applicationStageToNotificationPhase(
  stage: ApplicationStage
): MailNotificationPhase {
  switch (stage) {
    case "draft":
      return "draft";
    case "saved":
    case "in_process":
      return "in_process";
    case "approved_verified":
      return "approved";
    case "rejected":
      return "rejected";
    default:
      return "draft";
  }
}

export function isMailNotificationEnabledForStage(
  metadata: Record<string, unknown> | null | undefined,
  stage: ApplicationStage
): boolean {
  const prefs = getMailNotificationPreferences(metadata);
  const phase = applicationStageToNotificationPhase(stage);
  return prefs[phase];
}
