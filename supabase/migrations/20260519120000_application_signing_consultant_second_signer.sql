-- Allow appointed consultants (Plumber, Town Planner, etc.) to record architect_signed_* after owner signed.

CREATE OR REPLACE FUNCTION public.applicant_matches_appointment_permission(
  p_applicant_type text,
  p_permission_type text
)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_type text := lower(trim(COALESCE(p_applicant_type, '')));
  v_perm text := lower(trim(COALESCE(p_permission_type, '')));
  v_role text;
BEGIN
  IF v_type = '' OR v_perm = '' THEN
    RETURN false;
  END IF;

  IF v_type LIKE '%owner%' THEN
    RETURN false;
  END IF;

  v_role := trim(regexp_replace(v_perm, '^appointment letter for\s+', '', 'i'));

  IF v_role = '' THEN
    RETURN false;
  END IF;

  IF v_role LIKE '%architect%' AND v_type LIKE '%architect%' THEN
    RETURN true;
  END IF;
  IF v_role LIKE '%plumber%' AND v_type LIKE '%plumb%' THEN
    RETURN true;
  END IF;
  IF v_role LIKE '%town planner%' AND (v_type LIKE '%town planner%' OR v_type LIKE '%townplanner%') THEN
    RETURN true;
  END IF;
  IF v_role LIKE '%structural%' AND v_type LIKE '%structural%' THEN
    RETURN true;
  END IF;
  IF v_role LIKE '%fire%' AND v_type LIKE '%fire%' THEN
    RETURN true;
  END IF;
  IF v_role LIKE '%landscape%' AND v_type LIKE '%landscape%' THEN
    RETURN true;
  END IF;
  IF v_role LIKE '%geotechnical%' AND v_type LIKE '%geotechnical%' THEN
    RETURN true;
  END IF;
  IF v_role LIKE '%environmental%' AND v_type LIKE '%environment%' THEN
    RETURN true;
  END IF;
  IF (v_role LIKE '%mep%' OR v_role LIKE '%m&e%') AND (v_type LIKE '%mep%' OR v_type LIKE '%m&e%') THEN
    RETURN true;
  END IF;
  IF v_role LIKE '%licensed surveyor%' AND v_type LIKE '%surveyor%' THEN
    RETURN true;
  END IF;
  IF (v_role LIKE '%pmc%' OR v_role LIKE '%project manager%')
    AND (v_type LIKE '%pmc%' OR v_type LIKE '%project manager%') THEN
    RETURN true;
  END IF;

  RETURN v_perm LIKE '%' || v_type || '%' OR v_type LIKE '%' || v_role || '%';
END;
$$;

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
  v_architect_user_id uuid;
  v_is_owner boolean := false;
  v_is_architect boolean := false;
  v_is_appointed_consultant boolean := false;
  elem jsonb;
  v_applicant_type text;
BEGIN
  SELECT
    a.project_id::text,
    a.permission_type,
    p.user_id::text,
    a.owner_signed_at,
    p.architect_user_id
  INTO v_project_id, v_permission_type, v_owner_user_id, v_owner_signed_at, v_architect_user_id
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
    FOR elem IN
      SELECT value
      FROM jsonb_array_elements(
        COALESCE(
          (SELECT applicant_details -> 'applicants' FROM public.projects WHERE id::text = v_project_id),
          '[]'::jsonb
        )
      ) AS value
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

  IF p_owner_signed_at IS NOT NULL OR p_owner_signed_by IS NOT NULL THEN
    IF NOT v_is_owner THEN
      RETURN false;
    END IF;
  END IF;

  IF p_architect_signed_at IS NOT NULL OR p_architect_signed_by IS NOT NULL THEN
    IF v_owner_signed_at IS NULL THEN
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
  'Patch application signatures: owner fields require project owner; second-party fields require appointed architect or matching consultant after owner signed.';

GRANT EXECUTE ON FUNCTION public.update_application_for_signing(uuid, uuid, text, timestamptz, uuid, timestamptz, uuid) TO authenticated;
