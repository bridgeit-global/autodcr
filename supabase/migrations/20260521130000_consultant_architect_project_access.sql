-- Architects appointed via projects.architect_user_id can list projects but could not
-- load project details (RLS, get_project_for_preview, get_project_by_id_for_owner).

DROP POLICY IF EXISTS projects_select_consultant ON public.projects;
CREATE POLICY projects_select_consultant ON public.projects
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.applicants a
      WHERE a.project_id::text = projects.id::text
        AND a.user_id = auth.uid()
    )
    OR projects.architect_user_id = auth.uid()
  );

DROP POLICY IF EXISTS applications_select_consultant ON public.applications;
CREATE POLICY applications_select_consultant ON public.applications
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.applicants a
      WHERE a.project_id::text = applications.project_id::text
        AND a.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1
      FROM public.projects p
      WHERE p.id::text = applications.project_id::text
        AND p.architect_user_id = auth.uid()
    )
  );

CREATE OR REPLACE FUNCTION public.get_project_by_id_for_consultant(p_project_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT to_jsonb(p)
  FROM public.projects p
  WHERE p.id = p_project_id
    AND (
      EXISTS (
        SELECT 1
        FROM public.applicants a
        WHERE a.project_id = p.id
          AND a.user_id = auth.uid()
      )
      OR p.architect_user_id = auth.uid()
    )
  LIMIT 1;
$$;

COMMENT ON FUNCTION public.get_project_by_id_for_consultant(uuid) IS
  'Full project row when caller is on applicants roster or appointed architect.';

GRANT EXECUTE ON FUNCTION public.get_project_by_id_for_consultant(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_project_for_preview(p_project_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'title', p.title,
    'architect_user_id', p.architect_user_id,
    'project_info', COALESCE(p.project_info, '{}'::jsonb),
    'save_plot_details', COALESCE(p.save_plot_details, '{}'::jsonb),
    'applicant_details', public.merge_applicant_details_for_preview(
      CASE
        WHEN jsonb_array_length(COALESCE(p.applicant_details -> 'applicants', '[]'::jsonb)) > 0
          THEN p.applicant_details
        ELSE COALESCE(
          public.get_applicant_details_for_project(p.id),
          '{"applicants":[]}'::jsonb
        )
      END,
      COALESCE(
        public.get_applicant_details_for_project(p.id),
        '{"applicants":[]}'::jsonb
      )
    ),
    'user_id', p.user_id,
    'application_urls', COALESCE(p.application_urls, '{}'::jsonb)
  )
  FROM public.projects p
  WHERE p.id::text = p_project_id::text
    AND (
      p.user_id::text = auth.uid()::text
      OR EXISTS (
        SELECT 1
        FROM public.applicants a
        WHERE a.project_id::text = p.id::text
          AND a.user_id = auth.uid()
      )
      OR p.architect_user_id = auth.uid()
    )
  LIMIT 1;
$$;

COMMENT ON FUNCTION public.get_project_for_preview(uuid) IS
  'Project row for preview when caller is owner, on applicants roster, or appointed architect.';
