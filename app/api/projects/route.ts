import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/app/utils/supabase";

// Create a project using the simple JSONB-sections RPC:
// create_project(
//   p_user_id uuid,
//   p_title text,
//   p_status text DEFAULT 'draft',
//   p_project_info jsonb DEFAULT '{}'::jsonb,
//   p_save_plot_details jsonb DEFAULT '{}'::jsonb,
//   p_applicant_details jsonb DEFAULT '{}'::jsonb,
//   p_building_details jsonb DEFAULT '{}'::jsonb,
//   p_area_details jsonb DEFAULT '{}'::jsonb,
//   p_project_library jsonb DEFAULT '{}'::jsonb,
//   p_bg_details jsonb DEFAULT '{}'::jsonb
// )

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const {
      user_id,
      userId,
      title,
      status,
      project_info,
      projectInfo,
      save_plot_details,
      savePlotDetails,
      applicant_details,
      applicantDetails,
      building_details,
      buildingDetails,
      area_details,
      areaDetails,
      project_library,
      projectLibrary,
      bg_details,
      bgDetails,
    } = body || {};

    // Normalize keys coming from dashboard layout payload
    const normalizedUserId = user_id || userId;
    const normalizedProjectInfo = project_info || projectInfo || body?.project_info || body?.projectInfo;
    const normalizedSavePlotDetails = save_plot_details || savePlotDetails || body?.save_plot_details || body?.savePlotDetails;
    const normalizedApplicantDetails = applicant_details || applicantDetails || body?.applicant_details || body?.applicantDetails;
    const normalizedBuildingDetails = building_details || buildingDetails || body?.building_details || body?.buildingDetails;
    const normalizedAreaDetails = area_details || areaDetails || body?.area_details || body?.areaDetails;
    const normalizedProjectLibrary = project_library || projectLibrary || body?.project_library || body?.projectLibrary;
    const normalizedBgDetails = bg_details || bgDetails || body?.bg_details || body?.bgDetails;

    if (!normalizedUserId) {
      return NextResponse.json(
        { error: "User ID is required to create a project" },
        { status: 400 }
      );
    }

    if (!title || typeof title !== "string" || title.trim() === "") {
      return NextResponse.json(
        { error: "Project title is required" },
        { status: 400 }
      );
    }

    const { data, error } = await supabase.rpc("create_project", {
      p_user_id: normalizedUserId,
      p_title: title,
      p_status: status || "submitted",
      p_project_info: normalizedProjectInfo ?? {},
      p_save_plot_details: normalizedSavePlotDetails ?? {},
      p_applicant_details: normalizedApplicantDetails ?? {},
      p_building_details: normalizedBuildingDetails ?? {},
      p_area_details: normalizedAreaDetails ?? {},
      p_project_library: normalizedProjectLibrary ?? {},
      p_bg_details: normalizedBgDetails ?? {},
    });

    if (error) {
      console.error("Error creating project via RPC:", error);
      return NextResponse.json(
        { error: "Failed to create project", details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        project: data,
      },
      { status: 201 }
    );
  } catch (err: any) {
    console.error("API /api/projects error:", err);
    return NextResponse.json(
      { error: err?.message || "Internal server error" },
      { status: 500 }
    );
  }
}


