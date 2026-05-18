import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { fetchProjectForEdit, type ProjectRecord } from "@/app/utils/fetchProjectForEdit";

export function useProjectData() {
  const searchParams = useSearchParams();
  const projectId = searchParams.get("projectId");
  const isEditMode = !!projectId;
  const [isLoading, setIsLoading] = useState(isEditMode);
  const [projectData, setProjectData] = useState<ProjectRecord | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isEditMode || !projectId) {
      setIsLoading(false);
      return;
    }

    let cancelled = false;

    const load = async () => {
      setIsLoading(true);
      setError(null);
      const { project, error: loadError } = await fetchProjectForEdit(projectId);
      if (cancelled) return;
      if (loadError || !project) {
        setError(loadError || "Failed to load project data. Please try again.");
        setProjectData(null);
      } else {
        setProjectData(project);
      }
      setIsLoading(false);
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [projectId, isEditMode]);

  return {
    projectId,
    isEditMode,
    isLoading,
    projectData,
    error,
  };
}
