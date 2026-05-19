-- Allow the appointed architect (projects.architect_user_id) to read the
-- application row for signing, not just those in public.applicants.

CREATE OR REPLACE FUNCTION public.get_application_for_signing(p_application_id uuid)
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
    AND (
      -- Project owner
      p.user_id::text = auth.uid()::text
      OR
      -- Appointed architect stored at project level
      p.architect_user_id = auth.uid()
      OR
      -- Any consultant on the applicants roster
      EXISTS (
        SELECT 1
        FROM public.applicants ap
        WHERE ap.project_id::text = a.project_id::text
          AND ap.user_id = auth.uid()
      )
    )
  LIMIT 1;
$$;

COMMENT ON FUNCTION public.get_application_for_signing(uuid) IS
  'Application row for signing when caller is project owner, appointed architect, or on applicants roster.';

GRANT EXECUTE ON FUNCTION public.get_application_for_signing(uuid) TO authenticated;
