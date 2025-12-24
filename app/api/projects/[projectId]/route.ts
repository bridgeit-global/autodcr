import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://mgxbetsxswaislwhtygw.supabase.co'
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1neGJldHN4c3dhaXNsd2h0eWd3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ2NzcwNjksImV4cCI6MjA4MDI1MzA2OX0.tJPN5_q4EMrQHjAZpGT4_NSzxIvLMyLiotjbkTltavs'

// Update a project by ID
// Supports partial updates - only updates fields that are provided
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
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

    // Get auth token from Authorization header
    const authHeader = request.headers.get("Authorization");
    const token = authHeader?.replace("Bearer ", "");

    // Create Supabase client with auth token if available (needed for RLS)
    const supabaseOptions: any = {};
    if (token) {
      supabaseOptions.global = {
        headers: { Authorization: `Bearer ${token}` },
      };
    }
    const supabase = createClient(supabaseUrl, supabaseAnonKey, supabaseOptions);

    // First, check if project exists (without user_id filter to see if it exists at all)
    console.log("Checking project:", { projectId, userId, projectIdType: typeof projectId, userIdType: typeof userId, hasToken: !!token });
    
    // Try to fetch project by ID only first
    const { data: projectCheck, error: checkError } = await supabase
      .from("projects")
      .select("id, user_id")
      .eq("id", projectId)
      .maybeSingle(); // Use maybeSingle instead of single to avoid error if not found
    
    console.log("Project check result:", { projectCheck, checkError });

    if (checkError && checkError.code !== "PGRST116") {
      console.error("Error checking project:", checkError);
      return NextResponse.json(
        { error: "Failed to check project", details: checkError.message },
        { status: 500 }
      );
    }

    if (!projectCheck) {
      console.log("Project not found by ID:", projectId);
      return NextResponse.json(
        { error: "Project not found", details: `No project found with ID: ${projectId}` },
        { status: 404 }
      );
    }

    const existingProject = projectCheck;
    console.log("Project found:", { id: existingProject.id, userId: existingProject.user_id, requestUserId: userId });

    // Compare user_id as strings to handle UUID type differences
    const projectUserId = String(existingProject.user_id || "");
    const requestUserId = String(userId || "");
    
    console.log("User ID comparison:", { projectUserId, requestUserId, match: projectUserId === requestUserId });
    
    if (projectUserId !== requestUserId) {
      return NextResponse.json(
        { error: "Unauthorized - You can only update your own projects", details: `Project belongs to ${projectUserId}, but request is from ${requestUserId}` },
        { status: 403 }
      );
    }

    // Build update object - only include fields that are provided
    // For form submissions, we replace the entire section (not merge) since forms send complete data
    const updateData: any = {};

    if (body.project_info !== undefined) {
      updateData.project_info = body.project_info;
    }

    if (body.save_plot_details !== undefined) {
      updateData.save_plot_details = body.save_plot_details;
    }

    if (body.applicant_details !== undefined) {
      updateData.applicant_details = body.applicant_details;
    }

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

    // Update the project
    const { data, error } = await supabase
      .from("projects")
      .update(updateData)
      .eq("id", projectId)
      .eq("user_id", userId) // Extra security check
      .select()
      .single();

    if (error) {
      console.error("Error updating project:", error);
      return NextResponse.json(
        { error: "Failed to update project", details: error.message },
        { status: 500 }
      );
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
    const { projectId } = await params;

    if (!projectId) {
      return NextResponse.json(
        { error: "Project ID is required" },
        { status: 400 }
      );
    }

    // Get auth token from Authorization header
    const authHeader = request.headers.get("Authorization");
    const token = authHeader?.replace("Bearer ", "");

    // Get user_id from query parameter or from auth token
    const url = new URL(request.url);
    let userId = url.searchParams.get("user_id");

    // If user_id not in query, try to get from auth token
    if (!userId && token) {
      const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
        global: {
          headers: { Authorization: `Bearer ${token}` },
        },
      });
      const { data: { user } } = await supabaseAuth.auth.getUser();
      userId = user?.id || null;
    }
    
    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized - User ID is required" },
        { status: 401 }
      );
    }

    // Create Supabase client with auth token if available
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      },
    });

    // Fetch the project
    const { data, error } = await supabase
      .from("projects")
      .select("*")
      .eq("id", projectId)
      .eq("user_id", userId) // Ensure user can only access their own projects
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return NextResponse.json(
          { error: "Project not found" },
          { status: 404 }
        );
      }
      console.error("Error fetching project:", error);
      return NextResponse.json(
        { error: "Failed to fetch project", details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        project: data,
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

