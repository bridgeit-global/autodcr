import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

import {
  getApplicationNotificationCopy,
  sendApplicationStatusEmail,
  type ApplicationStage,
} from "@/app/utils/email";
import { isMailNotificationEnabledForStage } from "@/app/utils/mailNotificationPreferences";
import { permissionTitleToApplicantType } from "@/app/utils/applicantAppointmentPermissions";
import {
  buildApplicationDetailsUrl,
  getAppBaseUrl,
  resolveApplicationNo,
} from "@/app/utils/applicationDeepLink";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() || "";
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || "";

const VALID_STAGES: ApplicationStage[] = [
  "draft",
  "saved",
  "in_process",
  "approved_verified",
  "rejected",
];

function isValidEmail(value: string): boolean {
  if (!value || value === "-") return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

type Recipient = {
  email: string;
  name: string;
  role: string;
  userId?: string;
};

type AdminUserLookupClient = {
  auth: {
    admin: {
      getUserById: (
        id: string
      ) => Promise<{
        data: { user?: { user_metadata?: Record<string, unknown> } | null } | null;
        error: { message: string } | null;
      }>;
    };
  };
};

async function getRecipientMetadata(
  admin: AdminUserLookupClient,
  recipient: Recipient
): Promise<Record<string, unknown> | null> {
  if (!recipient.userId?.trim()) return null;
  try {
    const { data, error } = await admin.auth.admin.getUserById(recipient.userId.trim());
    if (error || !data?.user?.user_metadata) return null;
    return data.user.user_metadata as Record<string, unknown>;
  } catch {
    return null;
  }
}

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

    const { applicationId } = await params;
    if (!applicationId) {
      return NextResponse.json(
        { error: "Application ID is required." },
        { status: 400 }
      );
    }

    const body = await request.json();
    const stage = VALID_STAGES.includes(body.stage) ? body.stage as ApplicationStage : null;
    if (!stage) {
      return NextResponse.json(
        {
          error:
            "Valid stage is required (draft, saved, in_process, approved_verified, rejected).",
        },
        { status: 400 }
      );
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

    const readClient =
      serviceRoleKey.length > 0
        ? createClient(supabaseUrl, serviceRoleKey, {
            auth: { persistSession: false, autoRefreshToken: false },
          })
        : userClient;

    const adminClient =
      serviceRoleKey.length > 0
        ? readClient
        : null;

    const { data: application, error: appErr } = await readClient
      .from("applications")
      .select("id, project_id, project_title, permission_type, department, workflow_stage")
      .eq("id", applicationId)
      .maybeSingle();

    if (appErr || !application) {
      return NextResponse.json({ error: "Application not found." }, { status: 404 });
    }

    const projectId = String(application.project_id);
    const projectTitle = String(application.project_title || "Untitled Project");
    const permissionType = String(application.permission_type || "");

    const { data: project, error: projErr } = await readClient
      .from("projects")
      .select("user_id, architect_user_id, project_info, save_plot_details")
      .eq("id", projectId)
      .maybeSingle();

    if (projErr || !project) {
      return NextResponse.json({ error: "Project not found." }, { status: 404 });
    }

    const applicationNo = resolveApplicationNo(project, application);
    const projectUrl = buildApplicationDetailsUrl(getAppBaseUrl(), {
      projectId,
      applicationId,
      applicationNo,
      selectedApplication: permissionType,
    });

    const { data: rosterData } = await readClient.rpc(
      "get_applicant_details_for_project",
      { p_project_id: projectId }
    );

    const applicants: Record<string, unknown>[] =
      Array.isArray((rosterData as { applicants?: unknown })?.applicants)
        ? ((rosterData as { applicants: unknown[] }).applicants as Record<string, unknown>[])
        : [];

    const consultantApplicantType = permissionTitleToApplicantType(permissionType);

    const recipients: Recipient[] = [];

    for (const applicant of applicants) {
      const email = String(applicant.email || applicant.emailAddress || "").trim();
      const name = String(applicant.name || "").trim();
      const type = String(applicant.applicantType || applicant.applicant_type || "").trim();
      const userId = String(applicant.user_id || applicant.userId || "").trim() || undefined;

      if (!userId && !isValidEmail(email)) continue;

      const isOwner = type.toLowerCase() === "owner";
      const isTargetConsultant =
        consultantApplicantType &&
        type.toLowerCase() === consultantApplicantType.toLowerCase();

      if (isOwner || isTargetConsultant) {
        recipients.push({
          email,
          name: name === "-" ? (isOwner ? "Owner" : "Consultant") : name,
          role: type,
          userId,
        });
      }
    }

    const results: { email: string; success: boolean; skipped?: boolean; error?: string }[] = [];
    let inAppCreated = 0;
    let inAppFailed = 0;

    for (const recipient of recipients) {
      if (recipient.userId && adminClient) {
        const copy = getApplicationNotificationCopy({
          stage,
          permissionType,
          projectTitle,
          recipientRole: recipient.role,
        });
        const { error: inboxErr } = await adminClient
          .from("notifications")
          .upsert(
            {
              user_id: recipient.userId,
              application_id: applicationId,
              project_id: projectId,
              stage,
              title: copy.title,
              body: copy.body,
              link_url: projectUrl,
              read_at: null,
              created_at: new Date().toISOString(),
            },
            { onConflict: "user_id,application_id,stage" }
          );
        if (inboxErr) {
          inAppFailed += 1;
          console.error(
            `[notify-application] In-app insert failed for ${recipient.userId}:`,
            inboxErr.message
          );
        } else {
          inAppCreated += 1;
        }
      }

      if (!isValidEmail(recipient.email)) {
        results.push({
          email: recipient.email || "(no email)",
          success: true,
          skipped: true,
        });
        continue;
      }

      if (adminClient) {
        const metadata = await getRecipientMetadata(adminClient, recipient);
        if (metadata && !isMailNotificationEnabledForStage(metadata, stage, recipient.role)) {
          results.push({ email: recipient.email, success: true, skipped: true });
          continue;
        }
      }

      const result = await sendApplicationStatusEmail({
        to: recipient.email,
        recipientName: recipient.name,
        projectTitle,
        permissionType,
        stage,
        projectUrl,
        recipientRole: recipient.role,
      });

      results.push({ email: recipient.email, ...result });
    }

    const sent = results.filter((r) => r.success && !r.skipped).length;
    const skipped = results.filter((r) => r.skipped).length;
    const failed = results.filter((r) => !r.success).length;

    console.log(
      `[notify-application] App ${applicationId} stage=${stage}: ${sent} sent, ${skipped} skipped, ${failed} failed out of ${results.length} emails; in-app ${inAppCreated} upserted, ${inAppFailed} failed`
    );

    return NextResponse.json({
      sent,
      skipped,
      failed,
      total: results.length,
      inAppCreated,
      inAppFailed,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    console.error("[notify-application] Error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
