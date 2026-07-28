import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() || "";
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || "";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  owner_signed_at?: string;
  owner_signed_by?: string;
  workflow_stage?: string;
};

/**
 * Record owner signature fields when the appointed architect signed with the owner's DSC.
 * Uses service role after auth + architect + Architect-letter checks (RPC historically
 * blocked non-owners from setting owner_signed_*).
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ applicationId: string }> }
) {
  try {
    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.json(
        { error: "Supabase environment variables are missing." },
        { status: 500 }
      );
    }
    if (!serviceRoleKey) {
      return NextResponse.json(
        {
          error:
            "Server misconfigured: set SUPABASE_SERVICE_ROLE_KEY for on-behalf owner signing.",
        },
        { status: 500 }
      );
    }

    const { applicationId } = await params;
    if (!applicationId?.trim()) {
      return NextResponse.json({ error: "applicationId is required." }, { status: 400 });
    }

    const authHeader = request.headers.get("Authorization");
    const token = authHeader?.replace("Bearer ", "").trim();
    if (!token) {
      return NextResponse.json({ error: "Authorization required." }, { status: 401 });
    }

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });

    const {
      data: { user },
      error: authErr,
    } = await userClient.auth.getUser();

    if (authErr || !user?.id) {
      return NextResponse.json({ error: "Invalid or expired session." }, { status: 401 });
    }

    let body: Body = {};
    try {
      body = (await request.json()) as Body;
    } catch {
      return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
    }

    const ownerSignedAt =
      typeof body.owner_signed_at === "string" ? body.owner_signed_at.trim() : "";
    const ownerSignedBy =
      typeof body.owner_signed_by === "string" ? body.owner_signed_by.trim() : "";
    const workflowStage =
      typeof body.workflow_stage === "string" ? body.workflow_stage.trim() : "in_process";

    if (!ownerSignedAt || !ownerSignedBy) {
      return NextResponse.json(
        { error: "owner_signed_at and owner_signed_by are required." },
        { status: 400 }
      );
    }

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: appRow, error: appErr } = await admin
      .from("applications")
      .select("id, project_id, permission_type, owner_signed_at, architect_signed_at")
      .eq("id", applicationId.trim())
      .maybeSingle();

    if (appErr || !appRow?.project_id) {
      return NextResponse.json({ error: "Application not found." }, { status: 404 });
    }

    const permissionType =
      typeof appRow.permission_type === "string" ? appRow.permission_type : "";
    if (!permissionType.toLowerCase().includes("architect")) {
      return NextResponse.json(
        { error: "On-behalf owner signing is only allowed for Architect applications." },
        { status: 403 }
      );
    }

    if (
      typeof appRow.owner_signed_at === "string" &&
      appRow.owner_signed_at.trim().length > 0
    ) {
      return NextResponse.json(
        { error: "Owner has already signed this application." },
        { status: 409 }
      );
    }

    const { data: project, error: projErr } = await admin
      .from("projects")
      .select("id, user_id, architect_user_id")
      .eq("id", appRow.project_id)
      .maybeSingle();

    if (projErr || !project) {
      return NextResponse.json({ error: "Project not found." }, { status: 404 });
    }

    const architectId =
      typeof project.architect_user_id === "string" ? project.architect_user_id.trim() : "";
    if (!architectId || architectId !== user.id) {
      return NextResponse.json(
        { error: "Only the appointed architect can sign on behalf of the owner." },
        { status: 403 }
      );
    }

    const projectOwnerId =
      typeof project.user_id === "string" ? project.user_id.trim() : "";
    if (projectOwnerId && projectOwnerId === user.id) {
      return NextResponse.json(
        { error: "Use the normal owner signing flow for your own signature." },
        { status: 400 }
      );
    }

    const { error: updErr } = await admin
      .from("applications")
      .update({
        owner_signed_at: ownerSignedAt,
        owner_signed_by: ownerSignedBy,
        workflow_stage: workflowStage || "in_process",
      })
      .eq("id", applicationId.trim());

    if (updErr) {
      console.error("[sign-on-behalf-owner] update failed:", updErr.message);
      return NextResponse.json(
        { error: updErr.message || "Failed to update application signing state." },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unexpected error.";
    console.error("[sign-on-behalf-owner]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
