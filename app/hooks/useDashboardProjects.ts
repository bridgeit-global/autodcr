"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/app/utils/supabase";
import {
  applicantTypeToPermissionTitle,
  normalizeProjectId,
} from "@/app/utils/applicantAppointmentPermissions";
import {
  isAppointedArchitect,
  isArchitectConsultantRole,
} from "@/app/utils/projectAccess";

export type DashboardProject = {
  id: string;
  title: string;
  status?: string;
  user_id?: string;
  architect_user_id?: string;
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
  user_id?: string | null;
  architect_user_id?: string | null;
};

function mapProjectRows(rows: ProjectRow[]): DashboardProject[] {
  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    status: row.status ?? undefined,
    user_id: row.user_id ?? undefined,
    architect_user_id: row.architect_user_id ?? undefined,
    project_info: row.project_info as DashboardProject["project_info"],
    save_plot_details: row.save_plot_details as DashboardProject["save_plot_details"],
  }));
}

export function useDashboardProjects() {
  const [projects, setProjects] = useState<DashboardProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [isConsultant, setIsConsultant] = useState(false);
  const [isArchitectConsultant, setIsArchitectConsultant] = useState(false);
  const [permissionTitlesByProject, setPermissionTitlesByProject] = useState<
    Record<string, string | null>
  >({});
  const [consultantType, setConsultantType] = useState<string | null>(null);
  const [architectDelegateProjectIds, setArchitectDelegateProjectIds] = useState<Set<string>>(
    () => new Set()
  );

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
        setIsArchitectConsultant(false);
        setArchitectDelegateProjectIds(new Set());
        return;
      }

      const user = authData.user;
      const userId = user?.id;
      if (!userId) {
        setProjects([]);
        setPermissionTitlesByProject({});
        setConsultantType(null);
        setIsConsultant(false);
        setIsArchitectConsultant(false);
        setArchitectDelegateProjectIds(new Set());
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
      const architectConsultant = isArchitectConsultantRole({
        role,
        consultant_type: resolvedConsultantType,
      });
      setIsConsultant(consultant);
      setIsArchitectConsultant(architectConsultant);
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
          setArchitectDelegateProjectIds(new Set());
          return;
        }

        if (applicantsRes.error) {
          console.error("Error loading consultant applicant rows:", applicantsRes.error);
        }

        const projectRows = (projectsRes.data ?? []) as ProjectRow[];
        const delegateIds = new Set<string>();
        for (const row of projectRows) {
          if (isAppointedArchitect(row, userId)) {
            delegateIds.add(normalizeProjectId(row.id));
          }
        }
        setArchitectDelegateProjectIds(delegateIds);
        setProjects(mapProjectRows(projectRows));

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
          setArchitectDelegateProjectIds(new Set());
          return;
        }
        ownerRows = (fallbackData ?? []) as ProjectRow[];
      }

      setProjects(mapProjectRows(ownerRows));
      setPermissionTitlesByProject({});
      setArchitectDelegateProjectIds(new Set());
      setConsultantType(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadProjects();
  }, [loadProjects]);

  const hasArchitectDelegateAccess = useMemo(
    () => architectDelegateProjectIds.size > 0,
    [architectDelegateProjectIds]
  );

  return {
    projects,
    loading,
    isConsultant,
    isArchitectConsultant,
    hasArchitectDelegateAccess,
    architectDelegateProjectIds,
    consultantType,
    permissionTitlesByProject,
    reloadProjects: loadProjects,
  };
}
