import { supabase } from "@/app/utils/supabase";

export type OwnerProjectSelectRow = {
  id: string;
  title: string;
  status?: string;
  project_info?: { proposalNo?: string } | null;
  save_plot_details?: { planningAuthority?: string } | null;
  applicant_details?: unknown;
};

type ProjectRow = {
  id: string;
  title: string;
  status: string | null;
  project_info: unknown;
  save_plot_details: unknown;
  applicant_details?: unknown;
};

/** Matches preview defaults when save-plot authority was never set. */
export function getProjectPlanningAuthority(
  project: Pick<OwnerProjectSelectRow, "save_plot_details">
): string {
  const v = project.save_plot_details?.planningAuthority?.trim().toUpperCase();
  return v || "BMC";
}

/** Submitted / non-draft projects only (draft projects are not ready for applications). */
export function isProjectEligibleForNewApplication(status: string | null | undefined): boolean {
  return (status ?? "").trim().toLowerCase() !== "draft";
}

export async function fetchOwnerProjectsForSelect(): Promise<OwnerProjectSelectRow[]> {
  const { data: authData } = await supabase.auth.getUser();
  const userId = authData?.user?.id;
  if (!userId) return [];

  let rows: ProjectRow[] = [];
  const { data: rpcData, error: rpcError } = await supabase.rpc("get_projects_for_owner", {
    p_owner_id: userId,
  });

  if (!rpcError) {
    rows = (rpcData ?? []) as ProjectRow[];
  } else {
    console.warn("get_projects_for_owner failed, falling back to direct query:", rpcError.message);
    const { data, error } = await supabase
      .from("projects")
      .select("id,title,status,project_info,save_plot_details,applicant_details")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error loading owner projects:", error);
      return [];
    }
    rows = (data ?? []) as ProjectRow[];
  }

  return rows
    .filter((row) => isProjectEligibleForNewApplication(row.status))
    .map((row) => ({
      id: row.id,
      title: row.title,
      status: row.status ?? undefined,
      project_info: row.project_info as OwnerProjectSelectRow["project_info"],
      save_plot_details: row.save_plot_details as OwnerProjectSelectRow["save_plot_details"],
      applicant_details: row.applicant_details,
    }));
}
