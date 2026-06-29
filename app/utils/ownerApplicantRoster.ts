import { supabase } from "@/app/utils/supabase";
import {
  applicantRosterHasOwner,
  ensureOwnerInApplicantRoster,
  sameUserId,
  type ApplicantLike,
  type OwnerApplicantMeta,
} from "@/app/utils/projectAccess";

function asApplicantLikeList(applicants: unknown[] | undefined): ApplicantLike[] {
  return Array.isArray(applicants) ? (applicants as ApplicantLike[]) : [];
}

function pickText(...values: Array<unknown>): string {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

function mapOwnerDirectoryRow(row: Record<string, unknown>): OwnerApplicantMeta {
  const userMeta =
    row.user_metadata && typeof row.user_metadata === "object"
      ? (row.user_metadata as Record<string, unknown>)
      : {};
  return {
    first_name: pickText(row.first_name, userMeta.first_name),
    middle_name: pickText(row.middle_name, userMeta.middle_name),
    last_name: pickText(row.last_name, userMeta.last_name),
    email: pickText(row.email, userMeta.email),
    mobile: pickText(row.contact_number, userMeta.mobile),
    alternate_phone: pickText(row.contact_number, userMeta.alternate_phone, userMeta.mobile),
    address: pickText(row.address, userMeta.address),
    address_line1: pickText(row.address_line1, row.addressLine1, userMeta.address_line1),
    address_line2: pickText(row.address_line2, row.addressLine2, userMeta.address_line2),
    address_line3: pickText(row.address_line3, row.addressLine3, userMeta.address_line3),
    pan_no: pickText(row.pan, userMeta.pan_no, userMeta.pan),
    pan: pickText(row.pan, userMeta.pan),
    entity_type: pickText(row.entity_type, userMeta.entity_type),
    proprietorship_registration_no: pickText(
      userMeta.proprietorship_registration_no
    ),
    proprietorship_registration_date: pickText(
      userMeta.proprietorship_registration_date
    ),
    cin: pickText(userMeta.cin),
    roc_registration_date: pickText(userMeta.roc_registration_date),
    llpin: pickText(userMeta.llpin),
    llp_incorporation_date: pickText(userMeta.llp_incorporation_date),
    firm_registration_no: pickText(userMeta.firm_registration_no),
    partnership_registration_date: pickText(userMeta.partnership_registration_date),
    trust_registration_no: pickText(userMeta.trust_registration_no),
    trust_registration_date: pickText(userMeta.trust_registration_date),
    govt_registration_no: pickText(userMeta.govt_registration_no),
    govt_registration_date: pickText(userMeta.govt_registration_date),
    letterhead_url: pickText(userMeta.letterhead_url, userMeta.letterheadUrl),
    letterheadUrl: pickText(userMeta.letterhead_url, userMeta.letterheadUrl),
  };
}

/** Load owner profile from the directory RPC for roster seeding. */
export async function fetchOwnerApplicantMeta(
  ownerUserId: string
): Promise<OwnerApplicantMeta | null> {
  const id = ownerUserId.trim();
  if (!id) return null;
  const { data, error } = await supabase.rpc("get_owners");
  if (error || !data) return null;
  const row = (data as Record<string, unknown>[]).find(
    (entry) => pickText(entry.user_id) === id
  );
  return row ? mapOwnerDirectoryRow(row) : null;
}

/** Add projects.user_id as Owner on the roster when absent (fetches profile if needed). */
export async function ensureProjectOwnerOnRoster(
  roster: { applicants?: unknown[] },
  ownerUserId: string,
  opts?: { fallbackMeta?: OwnerApplicantMeta | null; sessionUserId?: string | null }
): Promise<{ applicants: unknown[] }> {
  const applicants = asApplicantLikeList(roster.applicants);
  if (applicantRosterHasOwner(applicants)) {
    return { applicants: [...(roster.applicants ?? [])] };
  }
  const id = ownerUserId.trim();
  if (!id) return { applicants: roster.applicants ?? [] };

  let meta = opts?.fallbackMeta ?? null;
  if (!meta && opts?.sessionUserId && sameUserId(opts.sessionUserId, id)) {
    meta = opts.fallbackMeta ?? null;
  }
  if (!meta) {
    meta = await fetchOwnerApplicantMeta(id);
  }
  return ensureOwnerInApplicantRoster(roster, id, meta);
}
