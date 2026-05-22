import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { TEMPLATE_CONFIG } from "@/app/templates/templateGenerators";
import {
  canUserSaveApplicationPdf,
  type SigningProjectContext,
} from "@/app/utils/applicationSigning";
import { isValidApplicationUrlsKey } from "@/app/utils/applicationPdfUrlKeys";
import { applicationUrlsKeyToStorageSlug } from "@/app/utils/projectSavedApplicationPdfUrl";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() || "";
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || "";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Uploads a saved application PDF to Storage and merges `application_urls` on `projects`.
 * `projectId` is sent in formData (flat route — nested `/api/projects/[id]/save-application-pdf`
 * is not reliably registered under Turbopack in dev).
 */
export async function POST(request: NextRequest) {
  try {
    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.json({ error: "Supabase environment variables are missing." }, { status: 500 });
    }
    if (!serviceRoleKey) {
      return NextResponse.json(
        {
          error:
            "Server misconfigured: set SUPABASE_SERVICE_ROLE_KEY to save files (bypasses Storage RLS).",
        },
        { status: 500 }
      );
    }

    const authHeader = request.headers.get("Authorization");
    const token = authHeader?.replace("Bearer ", "").trim();
    if (!token) {
      return NextResponse.json({ error: "Authorization required." }, { status: 401 });
    }

    const formData = await request.formData();
    const projectIdRaw = formData.get("projectId");
    const projectId = typeof projectIdRaw === "string" ? projectIdRaw.trim() : "";
    if (!projectId) {
      return NextResponse.json({ error: "projectId is required." }, { status: 400 });
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

    const templateTypeRaw = formData.get("templateType");
    const applicationUrlsKeyRaw = formData.get("applicationUrlsKey");
    const applicationUrlsKeyAcceptanceRaw = formData.get("applicationUrlsKey_acceptance");
    const userIdField = formData.get("user_id");
    const fileField = formData.get("pdf") ?? formData.get("file");
    const fileAcceptance = formData.get("pdf_acceptance");

    const templateType = typeof templateTypeRaw === "string" ? templateTypeRaw.trim() : "";
    const applicationUrlsKeyInput =
      typeof applicationUrlsKeyRaw === "string" ? applicationUrlsKeyRaw.trim() : "";
    const applicationUrlsKey = applicationUrlsKeyInput || templateType;
    const applicationUrlsKeyAcceptance =
      typeof applicationUrlsKeyAcceptanceRaw === "string"
        ? applicationUrlsKeyAcceptanceRaw.trim()
        : "";
    const claimedUserId = typeof userIdField === "string" ? userIdField.trim() : "";

    if (!claimedUserId || claimedUserId !== user.id) {
      return NextResponse.json(
        { error: "user_id must match the signed-in user." },
        { status: 403 }
      );
    }

    if (!templateType || !(templateType in TEMPLATE_CONFIG)) {
      return NextResponse.json({ error: "Invalid templateType." }, { status: 400 });
    }

    const hasAppointmentPdf = fileField instanceof Blob && fileField.size > 0;
    const hasAcceptancePdf =
      fileAcceptance instanceof Blob &&
      fileAcceptance.size > 0 &&
      applicationUrlsKeyAcceptance.length > 0;

    if (!hasAppointmentPdf && !hasAcceptancePdf) {
      return NextResponse.json({ error: "Missing or empty PDF file." }, { status: 400 });
    }

    if (hasAppointmentPdf && !isValidApplicationUrlsKey(applicationUrlsKey, templateType)) {
      return NextResponse.json(
        { error: "applicationUrlsKey must match templateType or be a valid acceptance key." },
        { status: 400 }
      );
    }

    if (hasAcceptancePdf && !isValidApplicationUrlsKey(applicationUrlsKeyAcceptance, templateType)) {
      return NextResponse.json(
        { error: "applicationUrlsKey_acceptance must be a valid acceptance key." },
        { status: 400 }
      );
    }

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const [{ data: projectRow, error: projErr }, { data: roster, error: rosterErr }] =
      await Promise.all([
        admin
          .from("projects")
          .select("id, user_id, application_urls, architect_user_id")
          .eq("id", projectId)
          .maybeSingle(),
        admin.rpc("get_applicant_details_for_project", {
          p_project_id: projectId,
        }),
      ]);

    if (projErr) {
      return NextResponse.json(
        { error: "Failed to load project.", details: projErr.message },
        { status: 500 }
      );
    }

    if (!projectRow) {
      return NextResponse.json({ error: "Project not found." }, { status: 404 });
    }

    if (rosterErr) {
      return NextResponse.json(
        { error: "Failed to load applicant roster.", details: rosterErr.message },
        { status: 500 }
      );
    }

    const projectContext: SigningProjectContext = {
      user_id: projectRow.user_id,
      architect_user_id: projectRow.architect_user_id,
      applicant_details: roster as NonNullable<SigningProjectContext>["applicant_details"],
    };

    if (
      !canUserSaveApplicationPdf(
        user.id,
        projectContext,
        typeof projectRow.user_id === "string" ? projectRow.user_id : null
      )
    ) {
      return NextResponse.json({ error: "Project not found or access denied." }, { status: 403 });
    }

    const prevRaw = projectRow.application_urls;
    const prev: Record<string, string> =
      prevRaw && typeof prevRaw === "object" && !Array.isArray(prevRaw)
        ? Object.fromEntries(
            Object.entries(prevRaw as Record<string, unknown>).filter(
              ([, v]) => typeof v === "string" && String(v).trim()
            )
          ) as Record<string, string>
        : {};

    type UploadTarget = { blob: Blob; urlsKey: string };
    const targets: UploadTarget[] = [];
    if (hasAppointmentPdf && fileField instanceof Blob) {
      targets.push({ blob: fileField, urlsKey: applicationUrlsKey });
    }
    if (hasAcceptancePdf && fileAcceptance instanceof Blob) {
      targets.push({ blob: fileAcceptance, urlsKey: applicationUrlsKeyAcceptance });
    }

    const urlEntries = await Promise.all(
      targets.map(async ({ blob, urlsKey }) => {
        const storageSlug = applicationUrlsKeyToStorageSlug(urlsKey);
        const storagePath = `${projectId}/saved-applications/${storageSlug}.pdf`;
        const buffer = Buffer.from(await blob.arrayBuffer());
        const { error: upErr } = await admin.storage
          .from("project-library")
          .upload(storagePath, buffer, {
            upsert: true,
            contentType: "application/pdf",
          });
        if (upErr) {
          throw new Error(`Storage upload failed for ${urlsKey}: ${upErr.message}`);
        }
        const { data: pub } = admin.storage.from("project-library").getPublicUrl(storagePath);
        const publicUrl = pub.publicUrl?.trim();
        if (!publicUrl) {
          throw new Error(`Could not resolve public URL for ${urlsKey}.`);
        }
        return [urlsKey, publicUrl] as const;
      })
    );

    const nextUrls = { ...prev, ...Object.fromEntries(urlEntries) };

    const { error: updErr } = await admin
      .from("projects")
      .update({ application_urls: nextUrls })
      .eq("id", projectId);

    if (updErr) {
      return NextResponse.json(
        { error: "Failed to update project.", details: updErr.message },
        { status: 500 }
      );
    }

    const primaryKey = hasAppointmentPdf
      ? applicationUrlsKey
      : applicationUrlsKeyAcceptance;
    const publicUrl = nextUrls[primaryKey];
    return NextResponse.json({
      success: true,
      publicUrl,
      publicUrls: nextUrls,
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Save failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
