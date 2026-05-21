import type { SupabaseClient } from "@supabase/supabase-js";
import { serializeApplicantRosterForStorage } from "@/app/utils/applicantRecordFields";

export type ApplicantDetailsJson = {
  applicants?: unknown[];
};

function normalizeApplicantDetailsPayload(data: unknown): ApplicantDetailsJson {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return { applicants: [] };
  }
  const row = data as ApplicantDetailsJson;
  return { applicants: Array.isArray(row.applicants) ? row.applicants : [] };
}

/** Load roster from public.applicants (source of truth). Null only when RPC fails. */
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
    if (error) {
      if (process.env.NODE_ENV === "development") {
        console.warn("[applicants] get_applicant_details_for_project failed:", error.message);
      }
      return null;
    }
    return normalizeApplicantDetailsPayload(data);
  } catch (err) {
    if (process.env.NODE_ENV === "development") {
      console.warn("[applicants] get_applicant_details_for_project exception:", err);
    }
    return null;
  }
}

/** Table roster when available; otherwise keep embedded JSON (legacy rows). */
export function mergeApplicantDetailsPreferTable<
  T extends { applicant_details?: ApplicantDetailsJson | null },
>(projectData: T | null | undefined, fromTable: ApplicantDetailsJson | null): T | null | undefined {
  if (!projectData) return projectData;
  if (fromTable == null) return projectData;
  return {
    ...projectData,
    applicant_details: fromTable,
  };
}

/** Attach table-sourced applicant_details onto a project record. */
export async function enrichProjectRecordWithApplicants<
  T extends { id?: string; applicant_details?: ApplicantDetailsJson | null },
>(supabase: SupabaseClient, project: T | null | undefined): Promise<T | null | undefined> {
  const projectId = project?.id?.trim();
  if (!projectId) return project;

  const fromTable = await fetchApplicantDetailsFromTable(supabase, projectId);
  return mergeApplicantDetailsPreferTable(project, fromTable) ?? project;
}

/** Table first, then preview RPC (also table-backed). */
export async function fetchApplicantDetailsWithFallback(
  supabase: SupabaseClient,
  projectId: string | undefined | null
): Promise<ApplicantDetailsJson | null> {
  const fromTable = await fetchApplicantDetailsFromTable(supabase, projectId);
  if (fromTable) return fromTable;

  const id = projectId?.trim();
  if (!id) return null;

  try {
    const { data, error } = await supabase.rpc("get_project_for_preview", {
      p_project_id: id,
    });
    if (error || !data || typeof data !== "object" || Array.isArray(data)) return null;
    return normalizeApplicantDetailsPayload(
      (data as { applicant_details?: unknown }).applicant_details
    );
  } catch {
    return null;
  }
}

/** Write roster to public.applicants; mirrors projects.applicant_details in DB. Owner session required. */
export async function persistApplicantRosterForProject(
  supabase: SupabaseClient,
  projectId: string,
  roster: ApplicantDetailsJson | unknown[]
): Promise<{ error: string | null }> {
  const applicants = Array.isArray(roster)
    ? roster
    : Array.isArray(roster.applicants)
      ? roster.applicants
      : [];
  const serialized = serializeApplicantRosterForStorage(applicants);

  const { error } = await supabase.rpc("replace_applicants_for_project", {
    p_project_id: projectId,
    p_roster: serialized,
  });
  return { error: error?.message ?? null };
}

/** Batch-load rosters from public.applicants for many projects. */
export async function fetchApplicantDetailsMapForProjects(
  supabase: SupabaseClient,
  projectIds: string[]
): Promise<Record<string, ApplicantDetailsJson>> {
  const ids = [...new Set(projectIds.map((id) => id?.trim()).filter(Boolean))] as string[];
  const map: Record<string, ApplicantDetailsJson> = {};
  if (!ids.length) return map;

  for (const id of ids) {
    map[id] = { applicants: [] };
  }

  const { data, error } = await supabase
    .from("applicants")
    .select("project_id, user_id, applicant_details")
    .in("project_id", ids);

  if (error || !data) return map;

  for (const row of data) {
    const projectId = String(row.project_id ?? "");
    if (!projectId || !map[projectId]) continue;
    const details =
      row.applicant_details && typeof row.applicant_details === "object" && !Array.isArray(row.applicant_details)
        ? (row.applicant_details as Record<string, unknown>)
        : {};
    map[projectId].applicants!.push({
      ...details,
      user_id: String(row.user_id ?? ""),
    });
  }

  return map;
}
