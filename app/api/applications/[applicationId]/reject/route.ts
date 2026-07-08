import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

import { canUserAccessApplication } from "@/app/utils/applicationAccess";
import { canManageProject } from "@/app/utils/projectAccess";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() || "";
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || "";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Reject an application: sets workflow_stage to 'rejected' and notifies owner + consultant.
 * Allowed for project owner, appointed architect delegate, or the assigned consultant.
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
            "Server misconfigured: set SUPABASE_SERVICE_ROLE_KEY to reject applications.",
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

    if (appRow.workflow_stage === "rejected") {
      return NextResponse.json(
        { error: "Application is already rejected." },
        { status: 400 }
      );
    }

    if (appRow.workflow_stage === "approved_verified") {
      return NextResponse.json(
        { error: "Approved or verified applications cannot be rejected." },
        { status: 400 }
      );
    }

    const projectId = String(appRow.project_id);
    const permissionType =
      typeof appRow.permission_type === "string" ? appRow.permission_type.trim() : "";

    const { data: projectRow, error: projErr } = await admin
      .from("projects")
      .select("id, user_id, architect_user_id")
      .eq("id", projectId)
      .maybeSingle();

    if (projErr || !projectRow) {
      return NextResponse.json({ error: "Project not found." }, { status: 404 });
    }

    const { data: rosterData } = await admin.rpc("get_applicant_details_for_project", {
      p_project_id: projectId,
    });

    const applicants: Record<string, unknown>[] =
      Array.isArray((rosterData as { applicants?: unknown })?.applicants)
        ? ((rosterData as { applicants: unknown[] }).applicants as Record<string, unknown>[])
        : [];

    const uid = String(user.id);
    const canReject =
      canManageProject(projectRow, uid) ||
      canUserAccessApplication({
        authUserId: uid,
        project: projectRow,
        applicants,
        permissionType,
      });

    if (!canReject) {
      return NextResponse.json({ error: "Access denied." }, { status: 403 });
    }

    const { error: updateErr } = await admin
      .from("applications")
      .update({ workflow_stage: "rejected" })
      .eq("id", applicationId.trim());

    if (updateErr) {
      return NextResponse.json(
        { error: "Failed to reject application.", details: updateErr.message },
        { status: 500 }
      );
    }

    // Fire notification (fire-and-forget from server side)
    const notifyUrl = new URL(
      `/api/applications/${encodeURIComponent(applicationId.trim())}/notify`,
      request.nextUrl.origin
    );

    fetch(notifyUrl.toString(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ stage: "rejected" }),
    }).catch((err) => console.error("[reject-application] Notification failed:", err));

    return NextResponse.json({ success: true, workflow_stage: "rejected" });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Reject failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
