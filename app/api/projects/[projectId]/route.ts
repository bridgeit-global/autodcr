import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { serializeApplicantRosterForStorage } from "@/app/utils/applicantRecordFields";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() || "";
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || "";

const normalizeApplicantDetails = (raw: unknown) => {
  if (!raw || typeof raw !== "object") {
    return serializeApplicantRosterForStorage([]);
  }
  const applicants = Array.isArray((raw as { applicants?: unknown }).applicants)
    ? (raw as { applicants: unknown[] }).applicants
    : [];
  return serializeApplicantRosterForStorage(applicants);
};

// Update a project by ID
// Supports partial updates - only updates fields that are provided
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.json(
        { error: "Supabase environment variables are missing on server." },
        { status: 500 }
      );
    }

    const { projectId } = await params;
    const body = await request.json();

    console.log("API Route - Received body keys:", Object.keys(body));
    console.log("API Route - Body user_id:", body.user_id);

    if (!projectId) {
      return NextResponse.json(
        { error: "Project ID is required" },
        { status: 400 }
      );
    }

    // Get user_id from request body (sent from client)
    const userId = body.user_id;
    
    if (!userId) {
      console.error("API Route - Missing user_id in body. Body:", JSON.stringify(body, null, 2));
      return NextResponse.json(
        { error: "Unauthorized - User ID is required" },
        { status: 401 }
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

    const requestUserId = String(userId || "");
    if (requestUserId !== String(user.id)) {
      return NextResponse.json(
        { error: "Unauthorized - User ID does not match session." },
        { status: 403 }
      );
    }

    const readClient =
      serviceRoleKey.length > 0
        ? createClient(supabaseUrl, serviceRoleKey, {
            auth: { persistSession: false, autoRefreshToken: false },
          })
        : userClient;

    const { data: projectCheck, error: checkError } = await readClient
      .from("projects")
      .select("id, user_id, architect_user_id")
      .eq("id", projectId)
      .maybeSingle();

    if (checkError && checkError.code !== "PGRST116") {
      console.error("Error checking project:", checkError);
      return NextResponse.json(
        { error: "Failed to check project", details: checkError.message },
        { status: 500 }
      );
    }

    if (!projectCheck) {
      return NextResponse.json(
        { error: "Project not found", details: `No project found with ID: ${projectId}` },
        { status: 404 }
      );
    }

    const projectUserId = String(projectCheck.user_id || "");
    const projectArchitectId = String(projectCheck.architect_user_id || "");
    const canManage =
      projectUserId === requestUserId || projectArchitectId === requestUserId;
    if (!canManage) {
      return NextResponse.json(
        { error: "Unauthorized - You do not have permission to update this project" },
        { status: 403 }
      );
    }

    const supabase = readClient;

    // Build update object - only include fields that are provided
    // For form submissions, we replace the entire section (not merge) since forms send complete data
    const updateData: any = {};

    if (body.project_info !== undefined) {
      updateData.project_info = body.project_info;
    }

    if (body.save_plot_details !== undefined) {
      updateData.save_plot_details = body.save_plot_details;
    }

    const applicantRoster =
      body.applicant_details !== undefined
        ? normalizeApplicantDetails(body.applicant_details)
        : undefined;

    if (body.building_details !== undefined) {
      updateData.building_details = body.building_details;
    }

    if (body.area_details !== undefined) {
      updateData.area_details = body.area_details;
    }

    if (body.project_library !== undefined) {
      updateData.project_library = body.project_library;
    }

    if (body.bg_details !== undefined) {
      updateData.bg_details = body.bg_details;
    }

    if (body.title !== undefined) {
      updateData.title = body.title;
    }

    if (body.status !== undefined) {
      updateData.status = body.status;
    }

    if (body.application_urls !== undefined && body.application_urls !== null) {
      if (typeof body.application_urls !== "object" || Array.isArray(body.application_urls)) {
        return NextResponse.json(
          { error: "application_urls must be a plain object mapping template keys to URL strings." },
          { status: 400 }
        );
      }
      const { data: urlsRow, error: urlsErr } = await supabase
        .from("projects")
        .select("application_urls, user_id, architect_user_id")
        .eq("id", projectId)
        .maybeSingle();

      if (
        urlsRow &&
        String(urlsRow.user_id || "") !== requestUserId &&
        String(urlsRow.architect_user_id || "") !== requestUserId
      ) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
      }

      if (urlsErr) {
        console.error("application_urls fetch failed:", urlsErr);
        return NextResponse.json(
          { error: "Failed to load application_urls", details: urlsErr.message },
          { status: 500 }
        );
      }

      const prevRaw = urlsRow?.application_urls;
      const prev: Record<string, string> =
        prevRaw && typeof prevRaw === "object" && !Array.isArray(prevRaw)
          ? Object.fromEntries(
              Object.entries(prevRaw as Record<string, unknown>).filter(
                ([, v]) => typeof v === "string" && String(v).trim()
              )
            ) as Record<string, string>
          : {};

      const patch = body.application_urls as Record<string, unknown>;
      const merged: Record<string, string> = { ...prev };
      for (const [key, value] of Object.entries(patch)) {
        if (typeof value === "string" && value.trim()) {
          merged[key] = value.trim();
        }
      }
      updateData.application_urls = merged;
    }

    if (applicantRoster !== undefined) {
      const { error: replaceError } = await userClient.rpc("replace_applicants_for_project", {
        p_project_id: projectId,
        p_roster: applicantRoster,
      });
      if (replaceError) {
        console.error("replace_applicants_for_project failed:", replaceError);
        return NextResponse.json(
          {
            error: "Failed to save applicant roster",
            details: replaceError.message,
          },
          { status: 500 }
        );
      }
    }

    let data: Record<string, unknown> | null = null;

    if (Object.keys(updateData).length > 0) {
      const updateQuery = supabase.from("projects").update(updateData).eq("id", projectId);
      const { data: updated, error } = await updateQuery.select().single();

      if (error) {
        console.error("Error updating project:", error);
        return NextResponse.json(
          { error: "Failed to update project", details: error.message },
          { status: 500 }
        );
      }
      data = updated as Record<string, unknown>;
    } else {
      const { data: existing, error: fetchError } = await supabase
        .from("projects")
        .select("*")
        .eq("id", projectId)
        .maybeSingle();

      if (
        existing &&
        String(existing.user_id || "") !== requestUserId &&
        String(existing.architect_user_id || "") !== requestUserId
      ) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
      }

      if (fetchError) {
        console.error("Error loading project after applicant save:", fetchError);
        return NextResponse.json(
          { error: "Failed to load project", details: fetchError.message },
          { status: 500 }
        );
      }
      data = existing as Record<string, unknown> | null;
    }

    if (data) {
      const { data: roster, error: rosterError } = await userClient.rpc(
        "get_applicant_details_for_project",
        { p_project_id: projectId }
      );
      if (!rosterError && roster != null) {
        data.applicant_details = roster;
      }
    }

    return NextResponse.json(
      {
        success: true,
        project: data,
      },
      { status: 200 }
    );
  } catch (err: any) {
    console.error("API /api/projects/[projectId] PUT error:", err);
    return NextResponse.json(
      { error: err?.message || "Internal server error" },
      { status: 500 }
    );
  }
}

// Get a project by ID
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.json(
        { error: "Supabase environment variables are missing on server." },
        { status: 500 }
      );
    }

    const { projectId } = await params;

    if (!projectId) {
      return NextResponse.json(
        { error: "Project ID is required" },
        { status: 400 }
      );
    }

    const authHeader = request.headers.get("Authorization");
    const token = authHeader?.replace("Bearer ", "").trim();

    const url = new URL(request.url);
    let userId = url.searchParams.get("user_id");

    if (!userId && token) {
      const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: `Bearer ${token}` } },
      });
      const { data: { user } } = await supabaseAuth.auth.getUser();
      userId = user?.id || null;
    }

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized - User ID is required" }, { status: 401 });
    }

    if (token) {
      const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: `Bearer ${token}` } },
      });
      const { data: { user }, error: authErr } = await supabaseAuth.auth.getUser();
      if (authErr || !user?.id || String(user.id) !== String(userId)) {
        return NextResponse.json({ error: "Invalid or expired session." }, { status: 401 });
      }
    }

    const supabase =
      serviceRoleKey.length > 0
        ? createClient(supabaseUrl, serviceRoleKey, {
            auth: { persistSession: false, autoRefreshToken: false },
          })
        : createClient(supabaseUrl, supabaseAnonKey, {
            global: { headers: token ? { Authorization: `Bearer ${token}` } : {} },
          });

    const { data: project, error } = await supabase
      .from("projects")
      .select("*")
      .eq("id", projectId)
      .maybeSingle();

    if (error && error.code !== "PGRST116") {
      console.error("Error fetching project:", error);
      return NextResponse.json(
        { error: "Failed to fetch project", details: error.message },
        { status: 500 }
      );
    }

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const requestUserId = String(userId);
    const isOwner = String(project.user_id || "") === requestUserId;
    const isAppointedArchitect = String(project.architect_user_id || "") === requestUserId;

    let isRosterConsultant = false;
    if (!isOwner && !isAppointedArchitect) {
      const { data: applicantRow } = await supabase
        .from("applicants")
        .select("user_id")
        .eq("project_id", projectId)
        .eq("user_id", requestUserId)
        .maybeSingle();
      isRosterConsultant = !!applicantRow;
    }

    if (!isOwner && !isAppointedArchitect && !isRosterConsultant) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const rosterClient = token
      ? createClient(supabaseUrl, supabaseAnonKey, {
          global: { headers: { Authorization: `Bearer ${token}` } },
        })
      : supabase;

    const { data: roster, error: rosterError } = await rosterClient.rpc(
      "get_applicant_details_for_project",
      { p_project_id: projectId }
    );

    const enrichedProject =
      !rosterError && roster != null
        ? { ...project, applicant_details: roster }
        : project;

    return NextResponse.json(
      {
        success: true,
        project: enrichedProject,
      },
      { status: 200 }
    );
  } catch (err: any) {
    console.error("API /api/projects/[projectId] GET error:", err);
    return NextResponse.json(
      { error: err?.message || "Internal server error" },
      { status: 500 }
    );
  }
}

