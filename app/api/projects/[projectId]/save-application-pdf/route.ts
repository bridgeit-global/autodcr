import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { TEMPLATE_CONFIG } from "@/app/templates/templateGenerators";
import {
  canUserSaveApplicationPdf,
  type SigningProjectContext,
} from "@/app/utils/applicationSigning";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() || "";
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || "";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Uploads the saved appointment PDF to Storage and merges
 * `application_urls` on `projects`.
 * Uses the service role for Storage/DB so client Storage RLS cannot block saves.
 * Caller must present a valid Bearer token; authorized: project owner, appointed
 * architect, or consultant on the applicants roster.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
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

    const { projectId } = await params;
    if (!projectId?.trim()) {
      return NextResponse.json({ error: "projectId is required." }, { status: 400 });
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

    const formData = await request.formData();
    const templateTypeRaw = formData.get("templateType");
    const applicationUrlsKeyRaw = formData.get("applicationUrlsKey");
    const userIdField = formData.get("user_id");
    const fileField = formData.get("pdf") ?? formData.get("file");

    const templateType = typeof templateTypeRaw === "string" ? templateTypeRaw.trim() : "";
    const applicationUrlsKeyInput =
      typeof applicationUrlsKeyRaw === "string" ? applicationUrlsKeyRaw.trim() : "";
    const applicationUrlsKey = applicationUrlsKeyInput || templateType;
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

    const VALID_ACCEPTANCE_URL_KEYS = new Set([
      "Architect_acceptance",
      "Licensed_Surveyor_acceptance",
      "Fire_Safety_acceptance",
      "Landscape_Consultant_acceptance",
      "Geotechnical_Consultant_acceptance",
      "ME_Consultant_acceptance",
      "Plumber_acceptance",
      "Town_Planner_acceptance",
      "Structural_Engineer_acceptance",
      "Environmental_Consultant_acceptance",
      "PMC_Project_Manager_acceptance",
    ]);

    const keyIsValid =
      applicationUrlsKey === templateType || VALID_ACCEPTANCE_URL_KEYS.has(applicationUrlsKey);

    if (!keyIsValid) {
      return NextResponse.json(
        { error: "applicationUrlsKey must match templateType or be a valid acceptance key." },
        { status: 400 }
      );
    }

    if (!(fileField instanceof Blob) || fileField.size < 1) {
      return NextResponse.json({ error: "Missing or empty PDF file." }, { status: 400 });
    }

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: projectRow, error: projErr } = await admin
      .from("projects")
      .select("id, user_id, application_urls, architect_user_id, applicant_details")
      .eq("id", projectId.trim())
      .maybeSingle();

    if (projErr) {
      return NextResponse.json(
        { error: "Failed to load project.", details: projErr.message },
        { status: 500 }
      );
    }

    if (!projectRow) {
      return NextResponse.json({ error: "Project not found." }, { status: 404 });
    }

    const projectContext: SigningProjectContext = {
      user_id: projectRow.user_id,
      architect_user_id: projectRow.architect_user_id,
      applicant_details: projectRow.applicant_details as unknown as NonNullable<SigningProjectContext>["applicant_details"],
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

    const storageSlug = applicationUrlsKey.replace(/[/\\]/g, "-").replace(/\s+/g, "_");
    const path = `${projectId.trim()}/saved-applications/${storageSlug}.pdf`;

    const buffer = Buffer.from(await fileField.arrayBuffer());

    const { error: upErr } = await admin.storage.from("project-library").upload(path, buffer, {
      upsert: true,
      contentType: "application/pdf",
    });

    if (upErr) {
      return NextResponse.json(
        { error: "Storage upload failed.", details: upErr.message },
        { status: 500 }
      );
    }

    const { data: pub } = admin.storage.from("project-library").getPublicUrl(path);
    const publicUrl = pub.publicUrl?.trim();
    if (!publicUrl) {
      return NextResponse.json({ error: "Could not resolve public URL for upload." }, { status: 500 });
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

    const nextUrls = { ...prev, [applicationUrlsKey]: publicUrl };

    const { error: updErr } = await admin
      .from("projects")
      .update({ application_urls: nextUrls })
      .eq("id", projectId.trim());

    if (updErr) {
      return NextResponse.json(
        { error: "Failed to update project.", details: updErr.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      publicUrl,
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Save failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
