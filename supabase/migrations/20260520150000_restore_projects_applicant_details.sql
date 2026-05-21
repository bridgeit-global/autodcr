-- Revert applicants-table-only cutover: restore projects.applicant_details JSON column
-- and dual-write helpers (JSON is source on projects; public.applicants stays in sync).

ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS applicant_details jsonb NOT NULL DEFAULT '{"applicants":[]}'::jsonb;

-- Backfill JSON from public.applicants where the column is empty.
UPDATE public.projects p
SET applicant_details = COALESCE(
  public.get_applicant_details_for_project(p.id),
  '{"applicants":[]}'::jsonb
)
WHERE jsonb_array_length(COALESCE(p.applicant_details -> 'applicants', '[]'::jsonb)) = 0
  AND jsonb_array_length(
    COALESCE(public.get_applicant_details_for_project(p.id) -> 'applicants', '[]'::jsonb)
  ) > 0;

-- Restore sync from projects.applicant_details -> public.applicants
CREATE OR REPLACE FUNCTION public.sync_applicants_for_project(p_project_id uuid)
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
  SELECT COALESCE(applicant_details -> 'applicants', '[]'::jsonb)
  INTO applicants_json
  FROM public.projects
  WHERE id = p_project_id;

  IF applicants_json IS NULL THEN
    RETURN;
  END IF;

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
END;
$$;

COMMENT ON FUNCTION public.sync_applicants_for_project(uuid) IS
  'Upsert applicants rows from projects.applicant_details; remove roster entries no longer in JSON.';

GRANT EXECUTE ON FUNCTION public.sync_applicants_for_project(uuid) TO authenticated;

-- Restore merge helper + preview RPC (JSON preferred, table merged in)
CREATE OR REPLACE FUNCTION public.merge_applicant_details_for_preview(
  p_json jsonb,
  p_table jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  json_arr jsonb := COALESCE(p_json -> 'applicants', '[]'::jsonb);
  table_arr jsonb := COALESCE(p_table -> 'applicants', '[]'::jsonb);
  elem jsonb;
  merged jsonb := '[]'::jsonb;
  base jsonb;
  match jsonb;
BEGIN
  IF jsonb_array_length(table_arr) = 0 THEN
    RETURN jsonb_build_object('applicants', json_arr);
  END IF;

  FOR elem IN SELECT value FROM jsonb_array_elements(table_arr) AS value
  LOOP
    base := NULL;
    FOR match IN SELECT value FROM jsonb_array_elements(json_arr) AS value
    LOOP
      IF NULLIF(TRIM(COALESCE(elem->>'user_id', elem->>'userId')), '') IS NOT NULL
         AND NULLIF(TRIM(COALESCE(match->>'user_id', match->>'userId')), '') IS NOT NULL
         AND TRIM(COALESCE(elem->>'user_id', elem->>'userId')) =
             TRIM(COALESCE(match->>'user_id', match->>'userId'))
      THEN
        base := match;
        EXIT;
      END IF;
      IF LOWER(TRIM(COALESCE(elem->>'applicantType', elem->>'applicant_type', ''))) =
         LOWER(TRIM(COALESCE(match->>'applicantType', match->>'applicant_type', '')))
         AND (
           TRIM(COALESCE(elem->>'name', '')) = ''
           OR TRIM(COALESCE(match->>'name', '')) = ''
           OR LOWER(TRIM(COALESCE(elem->>'name', ''))) =
              LOWER(TRIM(COALESCE(match->>'name', '')))
         )
      THEN
        base := match;
        EXIT;
      END IF;
    END LOOP;

    IF base IS NULL THEN
      merged := merged || jsonb_build_array(elem);
    ELSE
      merged := merged || jsonb_build_array(base || elem);
    END IF;
  END LOOP;

  FOR match IN SELECT value FROM jsonb_array_elements(json_arr) AS value
  LOOP
    IF NOT EXISTS (
      SELECT 1
      FROM jsonb_array_elements(merged) AS m(value)
      WHERE (
        NULLIF(TRIM(COALESCE(match->>'user_id', match->>'userId')), '') IS NOT NULL
        AND NULLIF(TRIM(COALESCE(m.value->>'user_id', m.value->>'userId')), '') IS NOT NULL
        AND TRIM(COALESCE(match->>'user_id', match->>'userId')) =
            TRIM(COALESCE(m.value->>'user_id', m.value->>'userId'))
      )
      OR (
        LOWER(TRIM(COALESCE(match->>'applicantType', match->>'applicant_type', ''))) =
        LOWER(TRIM(COALESCE(m.value->>'applicantType', m.value->>'applicant_type', '')))
        AND LOWER(TRIM(COALESCE(match->>'name', ''))) =
            LOWER(TRIM(COALESCE(m.value->>'name', '')))
      )
    ) THEN
      merged := merged || jsonb_build_array(match);
    END IF;
  END LOOP;

  RETURN jsonb_build_object('applicants', merged);
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
    )
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.merge_applicant_details_for_preview(jsonb, jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_project_by_id_for_owner(p_project_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT to_jsonb(p)
  FROM public.projects p
  WHERE p.id = p_project_id
    AND p.user_id::text = auth.uid()::text
  LIMIT 1;
$$;

COMMENT ON FUNCTION public.get_project_by_id_for_owner(uuid) IS
  'Returns full project row for the authenticated owner (dashboard edit/update).';

-- Signing: read roster from projects.applicant_details again
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
