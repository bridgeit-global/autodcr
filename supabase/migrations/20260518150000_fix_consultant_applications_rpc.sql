-- Case-insensitive department match; ensure consultant application join uses text ids.

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
  INNER JOIN public.applicants ap
    ON ap.project_id::text = a.project_id::text
    AND ap.user_id = p_consultant_id
  WHERE lower(trim(a.department)) = lower(trim(p_department))
    AND (
      p_project_ids IS NULL
      OR cardinality(p_project_ids) = 0
      OR a.project_id::text = ANY (p_project_ids)
    );
$$;

CREATE OR REPLACE FUNCTION public.get_applications_for_owner(
  p_owner_id uuid,
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
  INNER JOIN public.projects p ON p.id::text = a.project_id::text
  WHERE p.user_id::text = p_owner_id::text
    AND lower(trim(a.department)) = lower(trim(p_department))
    AND (
      p_project_ids IS NULL
      OR cardinality(p_project_ids) = 0
      OR a.project_id::text = ANY (p_project_ids)
    );
$$;
