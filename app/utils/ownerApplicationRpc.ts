import { supabase } from "@/app/utils/supabase";

export type OwnerApplicationRow = {
  id: string;
  project_id: string;
  permission_type: string;
  department?: string;
  created_at?: string;
  workflow_stage?: string | null;
  owner_signed_at?: string | null;
  architect_signed_at?: string | null;
};

export async function getAuthUserId(): Promise<string | null> {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user?.id) return null;
  return data.user.id;
}

/** Load one application for an owner (RPC bypasses RLS). Falls back to direct select. */
export async function fetchApplicationForOwner(
  applicationId: string,
  ownerId: string
): Promise<{ data: OwnerApplicationRow | null; error: Error | null }> {
  const { data: rpcRows, error: rpcError } = await supabase.rpc("get_application_for_owner", {
    p_application_id: applicationId,
    p_owner_id: ownerId,
  });

  if (!rpcError) {
    const row = Array.isArray(rpcRows) ? rpcRows[0] : rpcRows;
    if (row && typeof row === "object" && "id" in row) {
      return { data: row as OwnerApplicationRow, error: null };
    }
    return { data: null, error: null };
  }

  console.warn("get_application_for_owner failed, falling back:", rpcError.message);
  const { data, error } = await supabase
    .from("applications")
    .select(
      "id,project_id,permission_type,department,created_at,workflow_stage,owner_signed_at,architect_signed_at"
    )
    .eq("id", applicationId)
    .maybeSingle();

  if (error) return { data: null, error: new Error(error.message) };
  if (!data) return { data: null, error: null };
  return { data: data as OwnerApplicationRow, error: null };
}

/** Delete application as owner. Returns project_id + permission_type for URL cleanup. */
export async function deleteApplicationForOwner(
  applicationId: string,
  ownerId: string
): Promise<{ projectId: string; permissionType: string } | { error: string }> {
  const { data: rpcRows, error: rpcError } = await supabase.rpc("delete_application_for_owner", {
    p_application_id: applicationId,
    p_owner_id: ownerId,
  });

  if (!rpcError) {
    const row = Array.isArray(rpcRows) ? rpcRows[0] : rpcRows;
    if (row && typeof row === "object" && "project_id" in row) {
      const r = row as { project_id: string; permission_type: string };
      return {
        projectId: String(r.project_id),
        permissionType: typeof r.permission_type === "string" ? r.permission_type.trim() : "",
      };
    }
    return { error: "Application not found or you do not have permission to delete it." };
  }

  console.warn("delete_application_for_owner failed, falling back:", rpcError.message);

  const { data: appRow, error: fetchErr } = await supabase
    .from("applications")
    .select("project_id, permission_type")
    .eq("id", applicationId)
    .single();

  if (fetchErr || !appRow?.project_id) {
    return { error: "Could not load application to delete." };
  }

  const { error: delErr } = await supabase.from("applications").delete().eq("id", applicationId);
  if (delErr) {
    return { error: "Failed to delete application. Please try again." };
  }

  return {
    projectId: String(appRow.project_id),
    permissionType: typeof appRow.permission_type === "string" ? appRow.permission_type.trim() : "",
  };
}

type OwnerApplicationUpdate = {
  workflow_stage?: string;
  owner_signed_at?: string;
  owner_signed_by?: string;
  architect_signed_at?: string;
  architect_signed_by?: string;
};

export type CreateApplicationForOwnerInput = {
  projectId: string;
  projectTitle: string;
  department: string;
  permissionType: string;
  workflowStage?: string;
};

/** Create application on owner project (RPC bypasses RLS). */
export async function createApplicationForOwner(
  ownerId: string,
  input: CreateApplicationForOwnerInput
): Promise<{ applicationId: string } | { error: string; code?: string }> {
  const { data, error } = await supabase.rpc("create_application_for_owner", {
    p_owner_id: ownerId,
    p_project_id: input.projectId,
    p_project_title: input.projectTitle,
    p_department: input.department,
    p_permission_type: input.permissionType,
    p_workflow_stage: input.workflowStage ?? "draft",
  });

  if (!error && data) {
    return { applicationId: String(data) };
  }

  if (error) {
    const code = typeof error.code === "string" ? error.code : undefined;
    const message =
      typeof error.message === "string" && error.message.trim()
        ? error.message.trim()
        : "Failed to create application.";
    if (code === "23505" || message.toLowerCase().includes("already added")) {
      return { error: message, code: "23505" };
    }
    console.warn("create_application_for_owner failed, falling back:", message);
  }

  const { data: inserted, error: insertError } = await supabase
    .from("applications")
    .insert({
      project_id: input.projectId,
      project_title: input.projectTitle,
      department: input.department,
      permission_type: input.permissionType,
      workflow_stage: input.workflowStage ?? "draft",
    })
    .select("id")
    .single();

  if (insertError) {
    const code = typeof insertError.code === "string" ? insertError.code : undefined;
    return {
      error:
        typeof insertError.message === "string" && insertError.message.trim()
          ? insertError.message.trim()
          : "Failed to create application. Please try again.",
      code,
    };
  }

  if (!inserted?.id) {
    return { error: "Failed to create application. Please try again." };
  }

  return { applicationId: String(inserted.id) };
}

/** Permission type titles already created for a project + department (RPC bypasses RLS). */
export async function fetchExistingPermissionTypesForProject(
  projectId: string,
  department: string,
  ownerId: string
): Promise<string[]> {
  const { data: rpcData, error: rpcError } = await supabase.rpc("get_applications_for_owner", {
    p_owner_id: ownerId,
    p_department: department,
    p_project_ids: [projectId],
  });

  if (!rpcError) {
    const rows = (rpcData ?? []) as Array<{ permission_type?: string }>;
    return rows
      .map((row) => (typeof row.permission_type === "string" ? row.permission_type.trim() : ""))
      .filter((title) => title.length > 0);
  }

  console.warn("get_applications_for_owner failed, falling back:", rpcError.message);
  const { data, error } = await supabase
    .from("applications")
    .select("permission_type")
    .eq("project_id", projectId)
    .eq("department", department);

  if (error) {
    console.error("Error loading existing permission types:", error);
    return [];
  }

  return (data ?? [])
    .map((row: { permission_type: string }) =>
      typeof row.permission_type === "string" ? row.permission_type.trim() : ""
    )
    .filter((title) => title.length > 0);
}

/** Load application for signing (owner or consultant on roster). */
export async function fetchApplicationForSigning(
  applicationId: string
): Promise<{ data: OwnerApplicationRow | null; error: Error | null }> {
  const { data: rpcRows, error: rpcError } = await supabase.rpc("get_application_for_signing", {
    p_application_id: applicationId,
  });

  if (!rpcError) {
    const row = Array.isArray(rpcRows) ? rpcRows[0] : rpcRows;
    if (row && typeof row === "object" && "id" in row) {
      return { data: row as OwnerApplicationRow, error: null };
    }
    return { data: null, error: null };
  }

  console.warn("get_application_for_signing failed, falling back:", rpcError.message);
  const signerId = await getAuthUserId();
  if (!signerId) {
    return { data: null, error: new Error("Not authenticated") };
  }
  return fetchApplicationForOwner(applicationId, signerId);
}

type SigningApplicationUpdate = OwnerApplicationUpdate;

/** Patch application workflow/signature fields (owner or appointed architect). */
export async function updateApplicationForSigning(
  applicationId: string,
  signerId: string,
  patch: SigningApplicationUpdate
): Promise<{ ok: boolean; error: Error | null }> {
  const { data: rpcOk, error: rpcError } = await supabase.rpc("update_application_for_signing", {
    p_application_id: applicationId,
    p_signer_id: signerId,
    p_workflow_stage: patch.workflow_stage ?? undefined,
    p_owner_signed_at: patch.owner_signed_at ?? undefined,
    p_owner_signed_by: patch.owner_signed_by ?? undefined,
    p_architect_signed_at: patch.architect_signed_at ?? undefined,
    p_architect_signed_by: patch.architect_signed_by ?? undefined,
  });

  if (!rpcError) {
    return {
      ok: Boolean(rpcOk),
      error: rpcOk ? null : new Error("Application not found or signing not allowed."),
    };
  }

  console.warn("update_application_for_signing failed, falling back:", rpcError.message);
  return updateApplicationForOwner(applicationId, signerId, patch);
}

/** Patch application workflow/signature fields as owner. */
export async function updateApplicationForOwner(
  applicationId: string,
  ownerId: string,
  patch: OwnerApplicationUpdate
): Promise<{ ok: boolean; error: Error | null }> {
  const { data: rpcOk, error: rpcError } = await supabase.rpc("update_application_for_owner", {
    p_application_id: applicationId,
    p_owner_id: ownerId,
    p_workflow_stage: patch.workflow_stage ?? undefined,
    p_owner_signed_at: patch.owner_signed_at ?? undefined,
    p_owner_signed_by: patch.owner_signed_by ?? undefined,
    p_architect_signed_at: patch.architect_signed_at ?? undefined,
    p_architect_signed_by: patch.architect_signed_by ?? undefined,
  });

  if (!rpcError) {
    return { ok: Boolean(rpcOk), error: rpcOk ? null : new Error("Application not found or not owned.") };
  }

  console.warn("update_application_for_owner failed, falling back:", rpcError.message);
  const { error } = await supabase.from("applications").update(patch).eq("id", applicationId);
  if (error) return { ok: false, error: new Error(error.message) };
  return { ok: true, error: null };
}
