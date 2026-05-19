-- Allow architects to see their projects and applications even when their
-- applicant_details entry lacks a user_id (so they are absent from public.applicants).
-- We fall back to projects.architect_user_id which is always set when an architect is appointed.

-- Fix 1: Project list
CREATE OR REPLACE FUNCTION public.get_projects_for_consultant(p_consultant_id uuid)
RETURNS TABLE (
  id uuid,
  title text,
  status text,
  project_info jsonb,
  save_plot_details jsonb
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT
    p.id,
    p.title,
    p.status,
    p.project_info,
    p.save_plot_details
  FROM public.projects p
  WHERE
    -- Primary: consultant is in the applicants roster
    EXISTS (
      SELECT 1 FROM public.applicants a
      WHERE a.project_id = p.id
        AND a.user_id = p_consultant_id
    )
    OR
    -- Fallback: consultant is the appointed architect stored at project level
    p.architect_user_id = p_consultant_id
  ORDER BY p.title;
$$;

COMMENT ON FUNCTION public.get_projects_for_consultant(uuid) IS
  'Projects where the consultant appears in public.applicants or is the appointed architect.';

GRANT EXECUTE ON FUNCTION public.get_projects_for_consultant(uuid) TO authenticated;

-- Fix 2: Application list
CREATE OR REPLACE FUNCTION public.get_applications_for_consultant(
  p_consultant_id uuid,
  p_department text,
  p_project_ids text[] DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  project_id text,
  project_title text,
  permission_type text,
  created_at timestamptz,
  workflow_stage text,
  owner_signed_at timestamptz,
  architect_signed_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    a.id,
    a.project_id::text,
    a.project_title,
    a.permission_type,
    a.created_at,
    a.workflow_stage,
    a.owner_signed_at,
    a.architect_signed_at
  FROM public.applications a
  WHERE lower(trim(a.department)) = lower(trim(p_department))
    AND (
      p_project_ids IS NULL
      OR cardinality(p_project_ids) = 0
      OR a.project_id::text = ANY (p_project_ids)
    )
    AND (
      -- Primary: consultant is in the applicants roster for this project
      EXISTS (
        SELECT 1
        FROM public.applicants ap
        WHERE ap.project_id::text = a.project_id::text
          AND ap.user_id = p_consultant_id
      )
      OR
      -- Fallback: consultant is the appointed architect stored at project level
      EXISTS (
        SELECT 1
        FROM public.projects pr
        WHERE pr.id::text = a.project_id::text
          AND pr.architect_user_id = p_consultant_id
      )
    );
$$;

GRANT EXECUTE ON FUNCTION public.get_applications_for_consultant(uuid, text, text[]) TO authenticated;
