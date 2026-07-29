-- Allow owner and appointed architect/consultant to record signatures independently.
-- Second-party (architect_signed_*) no longer requires owner_signed_at first.
-- workflow_stage transitions (e.g. to approved_verified) are explicit via p_workflow_stage.

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
  v_permission_type text;
  v_owner_user_id text;
  v_owner_signed_at timestamptz;
  v_architect_signed_at timestamptz;
  v_architect_user_id uuid;
  v_is_owner boolean := false;
  v_is_architect boolean := false;
  v_is_appointed_consultant boolean := false;
  v_roster jsonb;
  elem jsonb;
  v_applicant_type text;
  v_architect_may_owner_sign boolean := false;
BEGIN
  SELECT
    a.project_id::text,
    a.permission_type,
    p.user_id::text,
    a.owner_signed_at,
    a.architect_signed_at,
    p.architect_user_id
  INTO
    v_project_id,
    v_permission_type,
    v_owner_user_id,
    v_owner_signed_at,
    v_architect_signed_at,
    v_architect_user_id
  FROM public.applications a
  INNER JOIN public.projects p ON p.id::text = a.project_id::text
  WHERE a.id = p_application_id
  LIMIT 1;

  IF v_project_id IS NULL THEN
    RETURN false;
  END IF;

  v_is_owner := v_owner_user_id IS NOT NULL AND v_owner_user_id = p_signer_id::text;

  v_roster := COALESCE(
    public.get_applicant_details_for_project(v_project_id::uuid) -> 'applicants',
    '[]'::jsonb
  );

  IF v_architect_user_id IS NOT NULL AND v_architect_user_id = p_signer_id THEN
    v_is_architect := true;
  ELSE
    FOR elem IN SELECT value FROM jsonb_array_elements(v_roster) AS value
    LOOP
      v_applicant_type := COALESCE(elem->>'applicantType', elem->>'applicant_type', '');
      IF lower(v_applicant_type) LIKE '%architect%'
        AND NULLIF(TRIM(COALESCE(elem->>'user_id', elem->>'userId')), '')::uuid = p_signer_id
      THEN
        v_is_architect := true;
        EXIT;
      END IF;
    END LOOP;
  END IF;

  IF NOT v_is_architect THEN
    FOR elem IN SELECT value FROM jsonb_array_elements(v_roster) AS value
    LOOP
      v_applicant_type := COALESCE(elem->>'applicantType', elem->>'applicant_type', '');
      IF NULLIF(TRIM(COALESCE(elem->>'user_id', elem->>'userId')), '')::uuid = p_signer_id
        AND public.applicant_matches_appointment_permission(v_applicant_type, v_permission_type)
      THEN
        v_is_appointed_consultant := true;
        EXIT;
      END IF;
    END LOOP;
  END IF;

  IF NOT v_is_owner AND NOT v_is_architect AND NOT v_is_appointed_consultant THEN
    IF NOT EXISTS (
      SELECT 1
      FROM public.applicants ap
      WHERE ap.project_id::text = v_project_id
        AND ap.user_id = p_signer_id
    ) THEN
      RETURN false;
    END IF;
  END IF;

  -- Owner fields: project owner, OR appointed architect on Architect letter
  -- (owner DSC on-behalf) before owner_signed_at is set.
  v_architect_may_owner_sign :=
    v_is_architect
    AND v_owner_signed_at IS NULL
    AND lower(COALESCE(v_permission_type, '')) LIKE '%architect%';

  IF p_owner_signed_at IS NOT NULL OR p_owner_signed_by IS NOT NULL THEN
    -- Do not overwrite an existing owner signature.
    IF v_owner_signed_at IS NOT NULL THEN
      RETURN false;
    END IF;
    IF NOT v_is_owner AND NOT v_architect_may_owner_sign THEN
      RETURN false;
    END IF;
  END IF;

  IF p_architect_signed_at IS NOT NULL OR p_architect_signed_by IS NOT NULL THEN
    -- Independent: do not require owner_signed_at first.
    -- Do not overwrite an existing second-party signature.
    IF v_architect_signed_at IS NOT NULL THEN
      RETURN false;
    END IF;
    IF NOT v_is_architect AND NOT v_is_appointed_consultant THEN
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
  'Patch application signatures independently: owner fields require project owner or Architect on-behalf before owner signed; second-party fields require appointed architect/consultant without requiring owner signature first. Stage changes are explicit via p_workflow_stage.';
