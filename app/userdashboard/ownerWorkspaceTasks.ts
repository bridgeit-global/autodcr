import { supabase } from "@/app/utils/supabase";
import {
  normalizeApplicationWorkflowStage,
  type ApplicationWorkflowStage,
} from "@/app/components/DraftApplicationsModal";
import type { DashboardApplication } from "@/app/userdashboard/applicationsList";

export type OwnerWorkspaceApplication = DashboardApplication & {
  ownerSignedAt?: string | null;
  architectSignedAt?: string | null;
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

function mapApplicationRow(row: Record<string, unknown>): OwnerWorkspaceApplication {
  return {
    id: String(row.id),
    projectId: String(row.project_id ?? ""),
    projectTitle: String(row.project_title ?? "Untitled project"),
    permissionType: String(row.permission_type ?? "Application"),
    department: String(row.department ?? ""),
    createdAt: typeof row.created_at === "string" ? row.created_at : undefined,
    workflowStage:
      typeof row.workflow_stage === "string" ? row.workflow_stage : null,
    ownerSignedAt:
      typeof row.owner_signed_at === "string" ? row.owner_signed_at : null,
    architectSignedAt:
      typeof row.architect_signed_at === "string" ? row.architect_signed_at : null,
  };
}

export async function fetchOwnerWorkspaceApplications(params: {
  userId: string;
  isConsultant: boolean;
  projectIds: string[];
}): Promise<OwnerWorkspaceApplication[]> {
  const { userId, isConsultant, projectIds } = params;
  if (projectIds.length === 0) return [];

  const { data, error } = await supabase
    .from("applications")
    .select(
      "id, project_id, project_title, permission_type, department, created_at, workflow_stage, owner_signed_at, architect_signed_at"
    )
    .in("project_id", projectIds)
    .order("created_at", { ascending: false });

  if (!error && data) {
    return (data as Array<Record<string, unknown>>).map(mapApplicationRow);
  }

  const rpcName = isConsultant
    ? "get_applications_for_consultant"
    : "get_applications_for_owner";
  const byId = new Map<string, OwnerWorkspaceApplication>();

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
        byId.set(id, mapApplicationRow({ ...row, department }));
      }
    })
  );

  return Array.from(byId.values());
}

export function getApplicationStage(app: OwnerWorkspaceApplication): ApplicationWorkflowStage {
  return normalizeApplicationWorkflowStage(app.workflowStage);
}
