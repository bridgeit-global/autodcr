import type { ApplicationStage } from "@/app/utils/email";

export type MailNotificationPhase =
  | "draft"
  | "in_process"
  | "approved"
  | "rejected"
  | "signing";

export type MailNotificationPreferences = Record<MailNotificationPhase, boolean>;

const PREFERENCE_KEYS: Record<MailNotificationPhase, string> = {
  draft: "mail_notify_draft",
  in_process: "mail_notify_in_process",
  approved: "mail_notify_approved",
  rejected: "mail_notify_rejected",
  signing: "mail_notify_signing",
};

export const DEFAULT_MAIL_NOTIFICATION_PREFERENCES: MailNotificationPreferences = {
  draft: true,
  in_process: true,
  approved: true,
  rejected: true,
  signing: true,
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
    description: "When an application moves to In Process",
  },
  approved: {
    title: "Approved or Verified",
    description: "When all required signatures are complete",
  },
  rejected: {
    title: "Rejected or Cancelled",
    description: "When an application is rejected by the owner or consultant",
  },
  signing: {
    title: "Signature required",
    description: "When the owner has signed and your signature is needed",
  },
};

/** Phases shown to every user in Profile. */
export const SHARED_MAIL_NOTIFICATION_PHASES: MailNotificationPhase[] = [
  "draft",
  "in_process",
  "approved",
  "rejected",
];

/** Consultant-only phase for owner-signed / please-sign emails. */
export const CONSULTANT_ONLY_MAIL_NOTIFICATION_PHASES: MailNotificationPhase[] = [
  "signing",
];

export function getVisibleMailNotificationPhases(
  role: string | null | undefined
): MailNotificationPhase[] {
  if (role === "Consultant") {
    return [...SHARED_MAIL_NOTIFICATION_PHASES, ...CONSULTANT_ONLY_MAIL_NOTIFICATION_PHASES];
  }
  return SHARED_MAIL_NOTIFICATION_PHASES;
}

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
    signing: readBooleanPref(metadata, PREFERENCE_KEYS.signing),
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
    [PREFERENCE_KEYS.signing]: prefs.signing,
  };
}

export function applicationStageToNotificationPhase(
  stage: ApplicationStage,
  recipientRole?: string
): MailNotificationPhase {
  switch (stage) {
    case "draft":
      return "draft";
    case "saved":
      return "in_process";
    case "in_process": {
      const isOwner = (recipientRole || "").trim().toLowerCase() === "owner";
      return isOwner ? "in_process" : "signing";
    }
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
  stage: ApplicationStage,
  recipientRole?: string
): boolean {
  const prefs = getMailNotificationPreferences(metadata);
  const phase = applicationStageToNotificationPhase(stage, recipientRole);
  return prefs[phase];
}
