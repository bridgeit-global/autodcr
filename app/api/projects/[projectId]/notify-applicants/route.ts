import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  sendApplicantNotificationEmail,
  type NotificationType,
} from "@/app/utils/email";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() || "";
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || "";

const appBaseUrl =
  process.env.NEXT_PUBLIC_APP_URL?.trim() ||
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");

function isValidEmail(value: string): boolean {
  if (!value || value === "-") return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.json(
        { error: "Supabase environment variables are missing." },
        { status: 500 }
      );
    }

    const { projectId } = await params;
    if (!projectId) {
      return NextResponse.json(
        { error: "Project ID is required." },
        { status: 400 }
      );
    }

    const body = await request.json();
    const type: NotificationType = body.type === "updated" ? "updated" : "submitted";

    const authHeader = request.headers.get("Authorization");
    const token = authHeader?.replace("Bearer ", "").trim();
    if (!token) {
      return NextResponse.json(
        { error: "Authorization required." },
        { status: 401 }
      );
    }

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });

    const {
      data: { user },
      error: authErr,
    } = await userClient.auth.getUser();

    if (authErr || !user?.id) {
      return NextResponse.json(
        { error: "Invalid or expired session." },
        { status: 401 }
      );
    }

    const readClient =
      serviceRoleKey.length > 0
        ? createClient(supabaseUrl, serviceRoleKey, {
            auth: { persistSession: false, autoRefreshToken: false },
          })
        : userClient;

    const { data: project, error: projectErr } = await readClient
      .from("projects")
      .select("id, title, user_id, architect_user_id")
      .eq("id", projectId)
      .maybeSingle();

    if (projectErr || !project) {
      return NextResponse.json(
        { error: "Project not found." },
        { status: 404 }
      );
    }

    const callerIsOwner = String(project.user_id) === String(user.id);
    const callerIsArchitect = String(project.architect_user_id || "") === String(user.id);
    if (!callerIsOwner && !callerIsArchitect) {
      return NextResponse.json(
        { error: "Unauthorized." },
        { status: 403 }
      );
    }

    const { data: rosterData, error: rosterErr } = await readClient.rpc(
      "get_applicant_details_for_project",
      { p_project_id: projectId }
    );

    if (rosterErr || !rosterData) {
      console.error("[notify-applicants] Failed to fetch roster:", rosterErr);
      return NextResponse.json(
        { error: "Failed to fetch applicant roster." },
        { status: 500 }
      );
    }

    const applicants: Record<string, unknown>[] =
      Array.isArray((rosterData as { applicants?: unknown }).applicants)
        ? ((rosterData as { applicants: unknown[] }).applicants as Record<string, unknown>[])
        : [];

    const projectTitle = String(project.title || "Untitled Project");
    const projectUrl = `${appBaseUrl}/dashboard/project-details?projectId=${projectId}`;

    const results: { email: string; success: boolean; error?: string }[] = [];

    for (const applicant of applicants) {
      const email = String(
        applicant.email || applicant.emailAddress || applicant.email_address || ""
      ).trim();
      const name = String(applicant.name || "Applicant").trim();
      const role = String(
        applicant.applicantType || applicant.applicant_type || "Team Member"
      ).trim();

      if (!isValidEmail(email)) continue;

      const result = await sendApplicantNotificationEmail({
        to: email,
        applicantName: name === "-" ? "Applicant" : name,
        role,
        projectTitle,
        projectUrl,
        type,
      });

      results.push({ email, ...result });
    }

    const sent = results.filter((r) => r.success).length;
    const failed = results.filter((r) => !r.success).length;

    console.log(
      `[notify-applicants] Project ${projectId}: ${sent} sent, ${failed} failed out of ${results.length} emails`
    );

    return NextResponse.json({ sent, failed, total: results.length });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    console.error("[notify-applicants] Error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
