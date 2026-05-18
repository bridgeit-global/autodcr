"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/app/utils/supabase";
import {
  applicantTypeToPermissionTitle,
  normalizeProjectId,
} from "@/app/utils/applicantAppointmentPermissions";

export type DashboardProject = {
  id: string;
  title: string;
  status?: string;
  project_info?: { proposalNo?: string };
  save_plot_details?: {
    selectedSurveyNos?: string[];
    plotEntries?: Array<{ ctsNumber?: string }>;
  };
};

type ProjectRow = {
  id: string;
  title: string;
  status: string | null;
  project_info: unknown;
  save_plot_details: unknown;
};

function mapProjectRows(rows: ProjectRow[]): DashboardProject[] {
  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    status: row.status ?? undefined,
    project_info: row.project_info as DashboardProject["project_info"],
    save_plot_details: row.save_plot_details as DashboardProject["save_plot_details"],
  }));
}

export function useDashboardProjects() {
  const [projects, setProjects] = useState<DashboardProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [isConsultant, setIsConsultant] = useState(false);
  const [permissionTitlesByProject, setPermissionTitlesByProject] = useState<
    Record<string, string | null>
  >({});
  const [consultantType, setConsultantType] = useState<string | null>(null);

  const loadProjects = useCallback(async () => {
    setLoading(true);
    try {
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError) {
        console.error("Error fetching auth user:", authError);
        setProjects([]);
        setPermissionTitlesByProject({});
        setConsultantType(null);
        setIsConsultant(false);
        return;
      }

      const user = authData.user;
      const userId = user?.id;
      if (!userId) {
        setProjects([]);
        setPermissionTitlesByProject({});
        setConsultantType(null);
        setIsConsultant(false);
        return;
      }

      const meta = user.user_metadata as Record<string, unknown> | undefined;
      let role = typeof meta?.role === "string" ? meta.role : "";
      let resolvedConsultantType =
        typeof meta?.consultant_type === "string" ? meta.consultant_type : "";
      if ((!role || !resolvedConsultantType) && typeof window !== "undefined") {
        try {
          const stored = localStorage.getItem("userMetadata");
          if (stored) {
            const parsed = JSON.parse(stored) as {
              role?: string;
              consultant_type?: string;
            };
            if (!role) role = parsed?.role ?? "";
            if (!resolvedConsultantType) {
              resolvedConsultantType = parsed?.consultant_type ?? "";
            }
          }
          if (!resolvedConsultantType) {
            resolvedConsultantType = localStorage.getItem("consultantType") ?? "";
          }
        } catch {
          /* ignore */
        }
      }

      const consultant = role === "Consultant";
      setIsConsultant(consultant);
      setConsultantType(consultant ? resolvedConsultantType || null : null);

      if (consultant) {
        const [projectsRes, applicantsRes] = await Promise.all([
          supabase.rpc("get_projects_for_consultant", { p_consultant_id: userId }),
          supabase.from("applicants").select("project_id, applicant_details").eq("user_id", userId),
        ]);

        if (projectsRes.error) {
          console.error("Error loading consultant projects:", projectsRes.error);
          setProjects([]);
          setPermissionTitlesByProject({});
          return;
        }

        if (applicantsRes.error) {
          console.error("Error loading consultant applicant rows:", applicantsRes.error);
        }

        setProjects(mapProjectRows((projectsRes.data ?? []) as ProjectRow[]));

        const defaultTitle = resolvedConsultantType
          ? applicantTypeToPermissionTitle(resolvedConsultantType)
          : null;
        const titlesByProject: Record<string, string | null> = {};
        for (const row of applicantsRes.data ?? []) {
          const details = row.applicant_details as Record<string, unknown> | null;
          const applicantType =
            (typeof details?.applicantType === "string" && details.applicantType) ||
            (typeof details?.applicant_type === "string" && details.applicant_type) ||
            resolvedConsultantType ||
            "";
          const key = normalizeProjectId(row.project_id);
          titlesByProject[key] = applicantType
            ? applicantTypeToPermissionTitle(applicantType)
            : defaultTitle;
        }
        setPermissionTitlesByProject(titlesByProject);
        return;
      }

      let ownerRows: ProjectRow[] | null = null;

      const { data: rpcData, error: rpcError } = await supabase.rpc("get_projects_for_owner", {
        p_owner_id: userId,
      });

      if (!rpcError) {
        ownerRows = (rpcData ?? []) as ProjectRow[];
      } else {
        console.warn("get_projects_for_owner failed, falling back to direct query:", rpcError.message);
        const { data: fallbackData, error: fallbackError } = await supabase
          .from("projects")
          .select("id,title,status,project_info,save_plot_details")
          .eq("user_id", userId)
          .order("created_at", { ascending: false });

        if (fallbackError) {
          console.error("Error loading owner projects:", fallbackError);
          setProjects([]);
          setPermissionTitlesByProject({});
          return;
        }
        ownerRows = (fallbackData ?? []) as ProjectRow[];
      }

      setProjects(mapProjectRows(ownerRows));
      setPermissionTitlesByProject({});
      setConsultantType(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadProjects();
  }, [loadProjects]);

  return {
    projects,
    loading,
    isConsultant,
    consultantType,
    permissionTitlesByProject,
    reloadProjects: loadProjects,
  };
}
