-- Owner delete / read / update for applications (bypass RLS after consultant policies enabled).
-- Restore architect_user_id on preview RPC (removed in 20260518170000).

CREATE OR REPLACE FUNCTION public.get_application_for_owner(
  p_application_id uuid,
  p_owner_id uuid
)
RETURNS TABLE (
  id uuid,
  project_id text,
  permission_type text,
  department text,
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
    a.permission_type,
    a.department,
    a.created_at,
    a.workflow_stage,
    a.owner_signed_at,
    a.architect_signed_at
  FROM public.applications a
  INNER JOIN public.projects p ON p.id::text = a.project_id::text
  WHERE a.id = p_application_id
    AND p.user_id::text = p_owner_id::text
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.delete_application_for_owner(
  p_application_id uuid,
  p_owner_id uuid
)
RETURNS TABLE (project_id text, permission_type text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_project_id text;
  v_permission_type text;
BEGIN
  SELECT a.project_id::text, a.permission_type
  INTO v_project_id, v_permission_type
  FROM public.applications a
  INNER JOIN public.projects p ON p.id::text = a.project_id::text
  WHERE a.id = p_application_id
    AND p.user_id::text = p_owner_id::text
  LIMIT 1;

  IF v_project_id IS NULL THEN
    RETURN;
  END IF;

  DELETE FROM public.applications a
  USING public.projects p
  WHERE a.id = p_application_id
    AND p.id::text = a.project_id::text
    AND p.user_id::text = p_owner_id::text;

  project_id := v_project_id;
  permission_type := v_permission_type;
  RETURN NEXT;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_application_for_owner(
  p_application_id uuid,
  p_owner_id uuid,
  p_workflow_stage text DEFAULT NULL,
  p_owner_signed_at timestamptz DEFAULT NULL,
  p_owner_signed_by uuid DEFAULT NULL,
  p_architect_signed_at timestamptz DEFAULT NULL,
  p_architect_signed_by uuid DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.applications a
  SET
    workflow_stage = COALESCE(p_workflow_stage, a.workflow_stage),
    owner_signed_at = COALESCE(p_owner_signed_at, a.owner_signed_at),
    owner_signed_by = COALESCE(p_owner_signed_by, a.owner_signed_by),
    architect_signed_at = COALESCE(p_architect_signed_at, a.architect_signed_at),
    architect_signed_by = COALESCE(p_architect_signed_by, a.architect_signed_by)
  FROM public.projects p
  WHERE a.id = p_application_id
    AND p.id::text = a.project_id::text
    AND p.user_id::text = p_owner_id::text;

  RETURN FOUND;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_project_for_preview(p_project_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'title', p.title,
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
    'architect_user_id', p.architect_user_id,
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

GRANT EXECUTE ON FUNCTION public.get_application_for_owner(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_application_for_owner(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_application_for_owner(
  uuid, uuid, text, timestamptz, uuid, timestamptz, uuid
) TO authenticated;

COMMENT ON FUNCTION public.get_application_for_owner(uuid, uuid) IS
  'Single application row when p_owner_id owns the project.';
COMMENT ON FUNCTION public.delete_application_for_owner(uuid, uuid) IS
  'Delete application when p_owner_id owns the project; returns deleted row ids for UI cleanup.';
COMMENT ON FUNCTION public.update_application_for_owner(uuid, uuid, text, timestamptz, uuid, timestamptz, uuid) IS
  'Update workflow/signature columns on owner applications.';
