import { supabase } from "@/app/utils/supabase";

export type ProjectRecord = Record<string, unknown> & {
  id?: string;
  title?: string;
  status?: string;
  user_id?: string;
  project_info?: Record<string, unknown>;
  save_plot_details?: Record<string, unknown>;
  applicant_details?: { applicants?: unknown[] };
  building_details?: Record<string, unknown>;
  area_details?: { plots?: unknown[]; totals?: unknown };
  project_library?: { uploads?: unknown[] };
  bg_details?: { entries?: unknown[] };
};

/** Load a project row for dashboard edit/update (direct select → API → RPC). */
export async function fetchProjectForEdit(
  projectId: string
): Promise<{ project: ProjectRecord | null; error: string | null }> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const userId =
    session?.user?.id ??
    (typeof window !== "undefined" ? window.localStorage.getItem("consultantId") : null);

  if (!userId) {
    return { project: null, error: "Not authenticated. Please log in again." };
  }

  const { data: direct, error: directError } = await supabase
    .from("projects")
    .select("*")
    .eq("id", projectId)
    .maybeSingle();

  if (!directError && direct) {
    return { project: direct as ProjectRecord, error: null };
  }

  const headers: HeadersInit = {};
  if (session?.access_token) {
    headers.Authorization = `Bearer ${session.access_token}`;
  }

  try {
    const res = await fetch(
      `/api/projects/${encodeURIComponent(projectId)}?user_id=${encodeURIComponent(userId)}`,
      { headers }
    );
    if (res.ok) {
      const json = (await res.json()) as { project?: ProjectRecord };
      if (json.project) {
        return { project: json.project, error: null };
      }
    }
  } catch {
    // fall through to RPC
  }

  const { data: ownerRpcData, error: ownerRpcError } = await supabase.rpc(
    "get_project_by_id_for_owner",
    { p_project_id: projectId }
  );

  if (
    !ownerRpcError &&
    ownerRpcData &&
    typeof ownerRpcData === "object" &&
    !Array.isArray(ownerRpcData)
  ) {
    return { project: ownerRpcData as ProjectRecord, error: null };
  }

  const { data: consultantRpcData, error: consultantRpcError } = await supabase.rpc(
    "get_project_by_id_for_consultant",
    { p_project_id: projectId }
  );

  if (
    !consultantRpcError &&
    consultantRpcData &&
    typeof consultantRpcData === "object" &&
    !Array.isArray(consultantRpcData)
  ) {
    return { project: consultantRpcData as ProjectRecord, error: null };
  }

  return {
    project: null,
    error:
      directError?.message ||
      ownerRpcError?.message ||
      consultantRpcError?.message ||
      "Failed to load project",
  };
}
