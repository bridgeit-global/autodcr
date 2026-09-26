import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { applicationUrlKeysForPermissionType } from "@/app/utils/applicantAppointmentPermissions";
import {
  fetchApplicationCatalogTypeByTitle,
  fetchDocumentsForApplicationType,
} from "@/app/utils/applicationCatalog";
import {
  legacySavedApplicationPdfStoragePath,
  resolveSavedApplicationStorageLocation,
  savedApplicationCategoryFolder,
  storagePathFromPublicUrl,
} from "@/app/utils/projectSavedApplicationPdfUrl";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() || "";
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || "";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STORAGE_BUCKET = "project-library";

async function storagePathsForUrlKey(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  admin: { from: (table: string) => any; storage: { from: (bucket: string) => any } },
  projectId: string,
  urlKey: string
): Promise<string[]> {
  const paths = [legacySavedApplicationPdfStoragePath(projectId, urlKey)];
  const location = await resolveSavedApplicationStorageLocation(urlKey, admin);
  if (!location) return paths;
  const folder = savedApplicationCategoryFolder({ projectId, ...location });
  const { data: files, error } = await admin.storage.from(STORAGE_BUCKET).list(folder, {
    limit: 1000,
  });
  if (error || !Array.isArray(files)) return paths;
  for (const file of files) {
    if (typeof file?.name === "string" && file.name.trim()) {
      paths.push(`${folder}/${file.name}`);
    }
  }
  return paths;
}

/**
 * All `application_urls` / Storage keys for this permission type:
 * consultant appointment/acceptance keys + catalog document ids (Concession, IOD, …).
 */
async function resolveApplicationUrlKeysForDelete(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  admin: { from: (table: string) => any },
  permissionType: string
): Promise<string[]> {
  const keys = new Set<string>();

  for (const key of applicationUrlKeysForPermissionType(permissionType)) {
    if (key.trim()) keys.add(key.trim());
  }

  const catalogType = await fetchApplicationCatalogTypeByTitle(permissionType, admin);
  if (catalogType?.id) {
    const docs = await fetchDocumentsForApplicationType(catalogType.id, admin);
    for (const doc of docs) {
      const urlKey = doc.slug.trim() || doc.id.trim();
      if (urlKey) keys.add(urlKey);
    }
  }

  return [...keys];
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
      .select("id, project_id, permission_type, workflow_stage")
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
      .select("id, user_id, architect_user_id, application_urls, applicant_details")
      .eq("id", projectId)
      .maybeSingle();

    if (projErr || !projectRow) {
      return NextResponse.json({ error: "Project not found." }, { status: 404 });
    }

    const uid = String(user.id);
    const canManage =
      String(projectRow.user_id) === uid ||
      String(projectRow.architect_user_id || "") === uid;
    if (!canManage) {
      return NextResponse.json({ error: "Access denied." }, { status: 403 });
    }

    const stage = String(appRow.workflow_stage || "");
    if (stage !== "draft" && stage !== "in_process") {
      return NextResponse.json(
        { error: "Only draft or in-process applications can be deleted." },
        { status: 409 }
      );
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

    // Resolve Storage keys before deleting the row (catalog lookup is independent of the row).
    const urlKeys =
      (siblingCount ?? 0) === 0 && permissionType
        ? await resolveApplicationUrlKeysForDelete(admin, permissionType)
        : [];

    const { error: delAppErr } = await admin.from("applications").delete().eq("id", applicationId.trim());

    if (delAppErr) {
      return NextResponse.json(
        { error: "Failed to delete application.", details: delAppErr.message },
        { status: 500 }
      );
    }

    const cleanupArtifacts = (siblingCount ?? 0) === 0 && urlKeys.length > 0;

    if (cleanupArtifacts) {
      const urlKeySet = new Set(urlKeys);
      const storagePaths = new Set<string>();

      const prevUrls = projectRow.application_urls;
      if (prevUrls && typeof prevUrls === "object" && !Array.isArray(prevUrls)) {
        const urlRecord = prevUrls as Record<string, unknown>;
        for (const key of urlKeys) {
          const v = urlRecord[key];
          if (typeof v === "string" && v.trim()) {
            const fromUrl = storagePathFromPublicUrl(v.trim());
            if (fromUrl) storagePaths.add(fromUrl);
          }
        }
      }
      const listed = await Promise.all(
        urlKeys.map((key) => storagePathsForUrlKey(admin, projectId, key))
      );
      for (const group of listed) {
        for (const path of group) storagePaths.add(path);
      }

      if (storagePaths.size > 0) {
        const { error: storageErr } = await admin.storage
          .from(STORAGE_BUCKET)
          .remove([...storagePaths]);
        if (storageErr) {
          console.error("Storage delete warning:", storageErr.message);
        }
      }

      // Drop matching keys from application_urls.
      const nextUrls: Record<string, string> =
        prevUrls && typeof prevUrls === "object" && !Array.isArray(prevUrls)
          ? Object.fromEntries(
              Object.entries(prevUrls as Record<string, unknown>).filter(
                ([k, v]) =>
                  typeof v === "string" && v.trim().length > 0 && !urlKeySet.has(k)
              ) as [string, string][]
            )
          : {};

      const { error: projUpdErr } = await admin
        .from("projects")
        .update({
          application_urls: nextUrls,
        })
        .eq("id", projectId);

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
      removedUrlKeys: cleanupArtifacts ? urlKeys : [],
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Delete failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
