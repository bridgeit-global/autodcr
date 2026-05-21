-- public.applicants is the execution source of truth for project rosters.
-- projects.applicant_details is mirrored from the table until that column is removed.

CREATE OR REPLACE FUNCTION public.replace_applicants_for_project(
  p_project_id uuid,
  p_roster jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  elem jsonb;
  v_user_id uuid;
  v_details jsonb;
  kept_user_ids uuid[] := '{}';
  applicants_json jsonb;
  arr_len int;
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.projects p
    WHERE p.id = p_project_id
      AND p.user_id::text = auth.uid()::text
  ) THEN
    RAISE EXCEPTION 'Not authorized to update applicants for this project';
  END IF;

  applicants_json := CASE
    WHEN jsonb_typeof(p_roster) = 'array' THEN p_roster
    ELSE COALESCE(p_roster -> 'applicants', '[]'::jsonb)
  END;

  arr_len := jsonb_array_length(applicants_json);

  FOR elem IN SELECT value FROM jsonb_array_elements(applicants_json) AS value
  LOOP
    v_user_id := NULLIF(TRIM(COALESCE(elem->>'user_id', elem->>'userId')), '')::uuid;
    IF v_user_id IS NULL THEN
      CONTINUE;
    END IF;

    v_details := elem;
    IF elem ? 'user_id' THEN
      v_details := v_details - 'user_id';
    END IF;
    IF elem ? 'userId' THEN
      v_details := v_details - 'userId';
    END IF;

    INSERT INTO public.applicants (project_id, user_id, applicant_details)
    VALUES (p_project_id, v_user_id, v_details)
    ON CONFLICT (project_id, user_id)
    DO UPDATE SET
      applicant_details = EXCLUDED.applicant_details,
      updated_at = now();

    kept_user_ids := array_append(kept_user_ids, v_user_id);
  END LOOP;

  IF cardinality(kept_user_ids) > 0 THEN
    DELETE FROM public.applicants a
    WHERE a.project_id = p_project_id
      AND NOT (a.user_id = ANY(kept_user_ids));
  ELSIF arr_len = 0 THEN
    DELETE FROM public.applicants WHERE project_id = p_project_id;
  END IF;

  UPDATE public.projects
  SET applicant_details = COALESCE(
    public.get_applicant_details_for_project(p_project_id),
    '{"applicants":[]}'::jsonb
  )
  WHERE id = p_project_id;
END;
$$;

COMMENT ON FUNCTION public.replace_applicants_for_project(uuid, jsonb) IS
  'Replace public.applicants roster for a project; mirror JSON on projects.applicant_details. Owner-only.';

GRANT EXECUTE ON FUNCTION public.replace_applicants_for_project(uuid, jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_project_by_id_for_owner(p_project_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT (
    to_jsonb(p)
    - 'applicant_details'
  ) || jsonb_build_object(
    'applicant_details',
    COALESCE(
      public.get_applicant_details_for_project(p.id),
      '{"applicants":[]}'::jsonb
    )
  )
  FROM public.projects p
  WHERE p.id = p_project_id
    AND p.user_id::text = auth.uid()::text
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.get_project_by_id_for_consultant(p_project_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT (
    to_jsonb(p)
    - 'applicant_details'
  ) || jsonb_build_object(
    'applicant_details',
    COALESCE(
      public.get_applicant_details_for_project(p.id),
      '{"applicants":[]}'::jsonb
    )
  )
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
    'applicant_details', COALESCE(
      public.get_applicant_details_for_project(p.id),
      '{"applicants":[]}'::jsonb
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
  'Preview/signing project snapshot; applicant_details from public.applicants only.';

-- Signing reads roster from table (not stale projects JSON).
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
  v_roster jsonb;
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

-- One-time: populate public.applicants from existing projects.applicant_details JSON.
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT p.id
    FROM public.projects p
    WHERE p.applicant_details IS NOT NULL
      AND jsonb_array_length(COALESCE(p.applicant_details -> 'applicants', '[]'::jsonb)) > 0
      AND NOT EXISTS (
        SELECT 1 FROM public.applicants a WHERE a.project_id = p.id
      )
  LOOP
    PERFORM public.sync_applicants_for_project(r.id);
  END LOOP;
END;
$$;
