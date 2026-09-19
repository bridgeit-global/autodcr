import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

import { canManageProject } from "@/app/utils/projectAccess";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() || "";
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || "";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Move an in-process application back to draft.
 * Clears signature fields so a re-submit starts clean.
 * Allowed for project owner / developer or the appointed architect.
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
            "Server misconfigured: set SUPABASE_SERVICE_ROLE_KEY to move applications back to draft.",
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

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: appRow, error: appErr } = await admin
      .from("applications")
      .select("id, project_id, permission_type, workflow_stage")
      .eq("id", applicationId.trim())
      .maybeSingle();

    if (appErr || !appRow?.project_id) {
      return NextResponse.json({ error: "Application not found." }, { status: 404 });
    }

    if (String(appRow.workflow_stage || "") !== "in_process") {
      return NextResponse.json(
        { error: "Only in-process applications can be moved back to draft." },
        { status: 409 }
      );
    }

    const projectId = String(appRow.project_id);

    const { data: projectRow, error: projErr } = await admin
      .from("projects")
      .select("id, user_id, architect_user_id")
      .eq("id", projectId)
      .maybeSingle();

    if (projErr || !projectRow) {
      return NextResponse.json({ error: "Project not found." }, { status: 404 });
    }

    const uid = String(user.id);
    if (!canManageProject(projectRow, uid)) {
      return NextResponse.json({ error: "Access denied." }, { status: 403 });
    }

    const { error: updateErr } = await admin
      .from("applications")
      .update({
        workflow_stage: "draft",
        owner_signed_at: null,
        owner_signed_by: null,
        architect_signed_at: null,
        architect_signed_by: null,
      })
      .eq("id", applicationId.trim());

    if (updateErr) {
      return NextResponse.json(
        { error: "Failed to move application back to draft.", details: updateErr.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, workflow_stage: "draft" });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Back to draft failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
