import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { applicationUrlKeysForPermissionType } from "@/app/utils/applicantAppointmentPermissions";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() || "";
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || "";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STORAGE_BUCKET = "project-library";

function publicUrlToStoragePath(publicUrl: string): string | null {
  const marker = `/object/public/${STORAGE_BUCKET}/`;
  const altMarker = `/${STORAGE_BUCKET}/`;
  let idx = publicUrl.indexOf(marker);
  if (idx >= 0) {
    return decodeURIComponent(publicUrl.slice(idx + marker.length).split("?")[0] ?? "");
  }
  idx = publicUrl.indexOf(altMarker);
  if (idx >= 0) {
    return decodeURIComponent(publicUrl.slice(idx + altMarker.length).split("?")[0] ?? "");
  }
  return null;
}

function storagePathFromUrlKey(projectId: string, urlKey: string): string {
  const slug = urlKey.replace(/[/\\]/g, "-").replace(/\s+/g, "_");
  return `${projectId.trim()}/saved-applications/${slug}.pdf`;
}

/**
 * Owner delete: applications row, saved PDFs in Storage, and application_urls.
 * Consultant roster (applicants / applicant_details) is kept so the permission can be re-created.
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ applicationId: string }> }
) {
  try {
    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.json({ error: "Supabase environment variables are missing." }, { status: 500 });
    }
    if (!serviceRoleKey) {
      return NextResponse.json(
        {
          error:
            "Server misconfigured: set SUPABASE_SERVICE_ROLE_KEY to delete application files.",
        },
        { status: 500 }
      );
    }

    const { applicationId } = await params;
    if (!applicationId?.trim()) {
      return NextResponse.json({ error: "applicationId is required." }, { status: 400 });
    }

    const authHeader = _request.headers.get("Authorization");
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
      .select("id, project_id, permission_type")
      .eq("id", applicationId.trim())
      .maybeSingle();

    if (appErr) {
      return NextResponse.json(
        { error: "Failed to load application.", details: appErr.message },
        { status: 500 }
      );
    }

    if (!appRow?.project_id) {
      return NextResponse.json({ error: "Application not found." }, { status: 404 });
    }

    const projectId = String(appRow.project_id);
    const permissionType =
      typeof appRow.permission_type === "string" ? appRow.permission_type.trim() : "";

    const { data: projectRow, error: projErr } = await admin
      .from("projects")
      .select("id, user_id, application_urls, applicant_details")
      .eq("id", projectId)
      .maybeSingle();

    if (projErr || !projectRow) {
      return NextResponse.json({ error: "Project not found." }, { status: 404 });
    }

    if (String(projectRow.user_id) !== user.id) {
      return NextResponse.json({ error: "Access denied." }, { status: 403 });
    }

    const { count: siblingCount, error: sibErr } = await admin
      .from("applications")
      .select("id", { count: "exact", head: true })
      .eq("project_id", projectId)
      .eq("permission_type", permissionType)
      .neq("id", applicationId.trim());

    if (sibErr) {
      return NextResponse.json(
        { error: "Failed to check related applications.", details: sibErr.message },
        { status: 500 }
      );
    }

    const { error: delAppErr } = await admin.from("applications").delete().eq("id", applicationId.trim());

    if (delAppErr) {
      return NextResponse.json(
        { error: "Failed to delete application.", details: delAppErr.message },
        { status: 500 }
      );
    }

    const cleanupArtifacts = (siblingCount ?? 0) === 0;

    if (cleanupArtifacts && permissionType) {
      const urlKeys = applicationUrlKeysForPermissionType(permissionType);
      const storagePaths = new Set<string>();

      const prevUrls = projectRow.application_urls;
      if (prevUrls && typeof prevUrls === "object" && !Array.isArray(prevUrls)) {
        const urlRecord = prevUrls as Record<string, unknown>;
        for (const key of urlKeys) {
          const v = urlRecord[key];
          if (typeof v === "string" && v.trim()) {
            const fromUrl = publicUrlToStoragePath(v.trim());
            if (fromUrl) storagePaths.add(fromUrl);
          }
          storagePaths.add(storagePathFromUrlKey(projectId, key));
        }
      } else {
        for (const key of urlKeys) {
          storagePaths.add(storagePathFromUrlKey(projectId, key));
        }
      }

      if (storagePaths.size > 0) {
        const { error: storageErr } = await admin.storage
          .from(STORAGE_BUCKET)
          .remove([...storagePaths]);
        if (storageErr) {
          console.error("Storage delete warning:", storageErr.message);
        }
      }

      const nextUrls: Record<string, string> =
        prevUrls && typeof prevUrls === "object" && !Array.isArray(prevUrls)
          ? Object.fromEntries(
              Object.entries(prevUrls as Record<string, unknown>).filter(
                ([k, v]) =>
                  typeof v === "string" &&
                  v.trim().length > 0 &&
                  !urlKeys.includes(k)
              ) as [string, string][]
            )
          : {};

      const { error: projUpdErr } = await admin
        .from("projects")
        .update({
          application_urls: nextUrls,
        })
        .eq("id", projectId)
        .eq("user_id", user.id);

      if (projUpdErr) {
        return NextResponse.json(
          {
            error: "Application deleted but project cleanup failed.",
            details: projUpdErr.message,
          },
          { status: 500 }
        );
      }

    }

    return NextResponse.json({
      success: true,
      projectId,
      permissionType,
      cleanedArtifacts: cleanupArtifacts,
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Delete failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
