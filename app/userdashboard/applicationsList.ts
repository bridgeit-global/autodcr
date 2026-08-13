import { supabase } from "@/app/utils/supabase";
import {
  normalizeApplicationWorkflowStage,
  type ApplicationWorkflowStage,
} from "@/app/components/DraftApplicationsModal";

export type DashboardApplication = {
  id: string;
  projectId: string;
  projectTitle: string;
  permissionType: string;
  department: string;
  createdAt?: string;
  workflowStage?: string | null;
};

export type ApplicationStageFilter = ApplicationWorkflowStage | "all";

export type ApplicationHealthSplit = {
  total: number;
  draft: number;
  inProcess: number;
  approved: number;
  rejected: number;
};

const DEPARTMENTS = [
  "Building Permission",
  "Fire",
  "Traffic and Co-ordination",
  "Solid Waste Management",
  "Assessment and Collection Dept",
  "Storm Water Drain (Internal)",
  "Garden (Tree)",
  "Road Planning",
  "Mechanical & Electrical",
  "Hydraulic Engineering",
  "Pest Control",
  "Sewerage",
  "High Rise Building Commitee",
  "Mumbai Heritage Conservation Committee",
  "Revenue- Excavation Permission",
  "Development Plan",
  "Electricity",
  "National Monuments Authority",
  "Advertisement",
  "Indian Railways",
  "DP(TDR)",
  "Estate and Land Management",
  "Airport Authority of India",
  "General",
];

export function applicationHref(app: DashboardApplication) {
  const query = new URLSearchParams({
    projectId: app.projectId,
    applicationId: app.id,
    applicationNo: app.permissionType || app.id,
    selectedApplication: app.permissionType || "Application",
    mode: "readonly",
  });
  return `/dashboard/application-details?${query.toString()}`;
}

export function getApplicationStage(app: DashboardApplication): ApplicationWorkflowStage {
  return normalizeApplicationWorkflowStage(app.workflowStage);
}

export function bucketApplicationHealth(
  applications: DashboardApplication[]
): ApplicationHealthSplit {
  const split: ApplicationHealthSplit = {
    total: applications.length,
    draft: 0,
    inProcess: 0,
    approved: 0,
    rejected: 0,
  };

  for (const app of applications) {
    const stage = getApplicationStage(app);
    if (stage === "draft") split.draft += 1;
    else if (stage === "in_process") split.inProcess += 1;
    else if (stage === "approved_verified") split.approved += 1;
    else if (stage === "rejected") split.rejected += 1;
  }

  return split;
}

export function filterApplicationsByStage(
  applications: DashboardApplication[],
  filter: ApplicationStageFilter
): DashboardApplication[] {
  if (filter === "all") return applications;
  return applications.filter((app) => getApplicationStage(app) === filter);
}

export async function fetchApplicationsList(params: {
  userId: string;
  isConsultant: boolean;
  projectIds: string[];
}): Promise<DashboardApplication[]> {
  const { userId, isConsultant, projectIds } = params;
  if (projectIds.length === 0) return [];

  const { data, error } = await supabase
    .from("applications")
    .select(
      "id, project_id, project_title, permission_type, department, created_at, workflow_stage"
    )
    .in("project_id", projectIds)
    .order("created_at", { ascending: false });

  if (!error && data) {
    return (data as Array<Record<string, unknown>>).map((row) => ({
      id: String(row.id),
      projectId: String(row.project_id ?? ""),
      projectTitle: String(row.project_title ?? "Untitled project"),
      permissionType: String(row.permission_type ?? "Application"),
      department: String(row.department ?? ""),
      createdAt: typeof row.created_at === "string" ? row.created_at : undefined,
      workflowStage:
        typeof row.workflow_stage === "string" ? row.workflow_stage : null,
    }));
  }

  const rpcName = isConsultant
    ? "get_applications_for_consultant"
    : "get_applications_for_owner";
  const byId = new Map<string, DashboardApplication>();

  await Promise.all(
    DEPARTMENTS.map(async (department) => {
      const rpcArgs = isConsultant
        ? {
            p_consultant_id: userId,
            p_department: department,
            p_project_ids: projectIds,
          }
        : {
            p_owner_id: userId,
            p_department: department,
            p_project_ids: projectIds,
          };
      const { data: rpcData, error: rpcError } = await supabase.rpc(rpcName, rpcArgs);
      if (rpcError || !rpcData) return;
      for (const row of rpcData as Array<Record<string, unknown>>) {
        const id = row?.id ? String(row.id) : "";
        if (!id || byId.has(id)) continue;
        byId.set(id, {
          id,
          projectId: String(row.project_id ?? ""),
          projectTitle: String(row.project_title ?? "Untitled project"),
          permissionType: String(row.permission_type ?? "Application"),
          department,
          createdAt: typeof row.created_at === "string" ? row.created_at : undefined,
          workflowStage:
            typeof row.workflow_stage === "string" ? row.workflow_stage : null,
        });
      }
    })
  );

  return Array.from(byId.values());
}
