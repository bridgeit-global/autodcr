import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/app/utils/supabase";

export function useProjectData() {
  const searchParams = useSearchParams();
  const projectId = searchParams.get("projectId");
  const isEditMode = !!projectId;
  const [isLoading, setIsLoading] = useState(isEditMode);
  const [projectData, setProjectData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isEditMode || !projectId) {
      setIsLoading(false);
      return;
    }

    const fetchProject = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const { data, error: fetchError } = await supabase
          .from("projects")
          .select("*")
          .eq("id", projectId)
          .single();

        if (fetchError) {
          console.error("Error fetching project:", fetchError);
          setError("Failed to load project data. Please try again.");
          return;
        }

        if (data) {
          setProjectData(data);
        }
      } catch (err) {
        console.error("Error fetching project:", err);
        setError("Failed to load project data. Please try again.");
      } finally {
        setIsLoading(false);
      }
    };

    fetchProject();
  }, [projectId, isEditMode]);

  return {
    projectId,
    isEditMode,
    isLoading,
    projectData,
    error,
  };
}

