-- Application read/update for owner OR consultant on applicants roster (architect signing).

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
      p.user_id::text = auth.uid()::text
      OR EXISTS (
        SELECT 1
        FROM public.applicants ap
        WHERE ap.project_id::text = a.project_id::text
          AND ap.user_id = auth.uid()
      )
    )
  LIMIT 1;
$$;

COMMENT ON FUNCTION public.get_application_for_signing(uuid) IS
  'Application row for signing when caller is project owner or on applicants roster.';

GRANT EXECUTE ON FUNCTION public.get_application_for_signing(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.update_application_for_signing(
  p_application_id uuid,
  p_signer_id uuid,
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
DECLARE
  v_project_id text;
  v_owner_user_id text;
  v_owner_signed_at timestamptz;
  v_architect_user_id uuid;
  v_is_owner boolean := false;
  v_is_architect boolean := false;
  elem jsonb;
BEGIN
  SELECT
    a.project_id::text,
    p.user_id::text,
    a.owner_signed_at,
    p.architect_user_id
  INTO v_project_id, v_owner_user_id, v_owner_signed_at, v_architect_user_id
  FROM public.applications a
  INNER JOIN public.projects p ON p.id::text = a.project_id::text
  WHERE a.id = p_application_id
  LIMIT 1;

  IF v_project_id IS NULL THEN
    RETURN false;
  END IF;

  v_is_owner := v_owner_user_id IS NOT NULL AND v_owner_user_id = p_signer_id::text;

  IF v_architect_user_id IS NOT NULL AND v_architect_user_id = p_signer_id THEN
    v_is_architect := true;
  ELSE
    FOR elem IN
      SELECT value
      FROM jsonb_array_elements(
        COALESCE(
          (SELECT applicant_details -> 'applicants' FROM public.projects WHERE id::text = v_project_id),
          '[]'::jsonb
        )
      ) AS value
    LOOP
      IF lower(COALESCE(elem->>'applicantType', elem->>'applicant_type', '')) LIKE '%architect%'
        AND NULLIF(TRIM(COALESCE(elem->>'user_id', elem->>'userId')), '')::uuid = p_signer_id
      THEN
        v_is_architect := true;
        EXIT;
      END IF;
    END LOOP;
  END IF;

  IF NOT v_is_owner AND NOT v_is_architect THEN
  IF NOT EXISTS (
    SELECT 1
    FROM public.applicants ap
    WHERE ap.project_id::text = v_project_id
      AND ap.user_id = p_signer_id
  ) THEN
    RETURN false;
  END IF;
  END IF;

  IF p_owner_signed_at IS NOT NULL OR p_owner_signed_by IS NOT NULL THEN
    IF NOT v_is_owner THEN
      RETURN false;
    END IF;
  END IF;

  IF p_architect_signed_at IS NOT NULL OR p_architect_signed_by IS NOT NULL THEN
    IF NOT v_is_architect OR v_owner_signed_at IS NULL THEN
      RETURN false;
    END IF;
  END IF;

  UPDATE public.applications a
  SET
    workflow_stage = COALESCE(p_workflow_stage, a.workflow_stage),
    owner_signed_at = COALESCE(p_owner_signed_at, a.owner_signed_at),
    owner_signed_by = COALESCE(p_owner_signed_by, a.owner_signed_by),
    architect_signed_at = COALESCE(p_architect_signed_at, a.architect_signed_at),
    architect_signed_by = COALESCE(p_architect_signed_by, a.architect_signed_by)
  WHERE a.id = p_application_id;

  RETURN FOUND;
END;
$$;

COMMENT ON FUNCTION public.update_application_for_signing(uuid, uuid, text, timestamptz, uuid, timestamptz, uuid) IS
  'Patch application signatures: owner fields require project owner; architect fields require appointed architect after owner signed.';

GRANT EXECUTE ON FUNCTION public.update_application_for_signing(uuid, uuid, text, timestamptz, uuid, timestamptz, uuid) TO authenticated;
