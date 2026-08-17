import type { SupabaseClient } from "@supabase/supabase-js";
import { serializeApplicantRosterForStorage } from "@/app/utils/applicantRecordFields";

export type ApplicantDetailsJson = {
  applicants?: unknown[];
};

function normalizeApplicantDetailsPayload(data: unknown): ApplicantDetailsJson {
  if (Array.isArray(data)) {
    return { applicants: data };
  }
  if (!data || typeof data !== "object") {
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
  if (fromTable && (fromTable.applicants?.length ?? 0) > 0) return fromTable;

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

  if (serialized.applicants.length === 0) {
    return {
      error:
        "No applicants were saved. Add each person from the directory dropdown so they are linked to an account.",
    };
  }

  const { error } = await supabase.rpc("replace_applicants_for_project", {
    p_project_id: projectId,
    p_roster: serialized,
  });
  return { error: error?.message ?? null };
}

/** Batch-load rosters via SECURITY DEFINER RPC (direct table SELECT can miss roster rows). */
export async function fetchApplicantDetailsMapForProjects(
  supabase: SupabaseClient,
  projectIds: string[]
): Promise<Record<string, ApplicantDetailsJson>> {
  const ids = [...new Set(projectIds.map((id) => id?.trim()).filter(Boolean))] as string[];
  const map: Record<string, ApplicantDetailsJson> = {};
  if (!ids.length) return map;

  const results = await Promise.all(
    ids.map(async (id) => {
      const roster = await fetchApplicantDetailsWithFallback(supabase, id);
      return [id, roster ?? { applicants: [] }] as const;
    })
  );

  for (const [id, roster] of results) {
    map[id] = roster;
  }

  return map;
}
