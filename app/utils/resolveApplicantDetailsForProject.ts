import type { SupabaseClient } from "@supabase/supabase-js";

export type ApplicantDetailsJson = {
  applicants?: unknown[];
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function applicantMatchKey(rec: Record<string, unknown>): string {
  const userId = String(rec.user_id ?? rec.userId ?? "").trim().toLowerCase();
  if (userId) return `uid:${userId}`;
  const type = String(rec.applicantType ?? rec.applicant_type ?? "")
    .trim()
    .toLowerCase();
  const name = String(rec.name ?? "").trim().toLowerCase();
  const id = String(rec.id ?? "").trim();
  if (id) return `id:${id}`;
  return `type:${type}|name:${name}`;
}

function mergeApplicantRow(
  base: Record<string, unknown> | undefined,
  overlay: Record<string, unknown>
): Record<string, unknown> {
  if (!base) return { ...overlay };
  const merged: Record<string, unknown> = { ...base };
  for (const [key, value] of Object.entries(overlay)) {
    if (value === null || value === undefined) continue;
    if (typeof value === "string" && !value.trim()) continue;
    merged[key] = value;
  }
  return merged;
}

/** Overlay public.applicants rows onto projects.applicant_details (table wins on conflicts). */
export function mergeApplicantDetailsWithTable(
  projectApplicantDetails: ApplicantDetailsJson | null | undefined,
  fromTable: ApplicantDetailsJson | null | undefined
): ApplicantDetailsJson {
  const jsonApplicants = Array.isArray(projectApplicantDetails?.applicants)
    ? projectApplicantDetails.applicants
    : [];
  const tableApplicants = Array.isArray(fromTable?.applicants) ? fromTable.applicants : [];

  if (tableApplicants.length === 0) {
    return { applicants: jsonApplicants };
  }

  const jsonByKey = new Map<string, Record<string, unknown>>();
  for (const row of jsonApplicants) {
    const rec = asRecord(row);
    if (!rec) continue;
    jsonByKey.set(applicantMatchKey(rec), rec);
  }

  const merged: Record<string, unknown>[] = [];
  const seen = new Set<string>();

  for (const row of tableApplicants) {
    const overlay = asRecord(row);
    if (!overlay) continue;
    const key = applicantMatchKey(overlay);
    seen.add(key);
    merged.push(mergeApplicantRow(jsonByKey.get(key), overlay));
  }

  for (const row of jsonApplicants) {
    const rec = asRecord(row);
    if (!rec) {
      merged.push(row as Record<string, unknown>);
      continue;
    }
    const key = applicantMatchKey(rec);
    if (!seen.has(key)) merged.push(rec);
  }

  return { applicants: merged };
}

/** Load roster from public.applicants (source of truth during dual-write). */
export async function fetchApplicantDetailsFromTable(
  supabase: SupabaseClient,
  projectId: string | undefined | null
): Promise<ApplicantDetailsJson | null> {
  const id = projectId?.trim();
  if (!id) return null;

  try {
    const { data, error } = await supabase.rpc("get_applicant_details_for_project", {
      p_project_id: id,
    });
    if (error || !data || typeof data !== "object" || Array.isArray(data)) return null;

    const row = data as ApplicantDetailsJson;
    if (!Array.isArray(row.applicants) || row.applicants.length === 0) return null;
    return row;
  } catch {
    return null;
  }
}

export function mergeApplicantDetailsPreferTable<
  T extends { applicant_details?: ApplicantDetailsJson | null },
>(projectData: T | null | undefined, fromTable: ApplicantDetailsJson | null): T | null | undefined {
  if (!projectData) return projectData;
  const mergedDetails = mergeApplicantDetailsWithTable(
    projectData.applicant_details,
    fromTable
  );
  if (!Array.isArray(mergedDetails.applicants) || mergedDetails.applicants.length === 0) {
    return projectData;
  }
  return {
    ...projectData,
    applicant_details: mergedDetails,
  };
}
