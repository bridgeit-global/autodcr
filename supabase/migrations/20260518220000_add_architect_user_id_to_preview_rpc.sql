-- Add architect_user_id to get_project_for_preview so the client can use it
-- as a fallback when applicant_details.applicants lacks a user_id for the architect.

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
    'applicant_details', CASE
      WHEN jsonb_array_length(COALESCE(p.applicant_details -> 'applicants', '[]'::jsonb)) > 0
        THEN p.applicant_details
      ELSE COALESCE(
        public.get_applicant_details_for_project(p.id),
        '{"applicants":[]}'::jsonb
      )
    END,
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
    )
  LIMIT 1;
$$;
