-- Do not clear projects.architect_user_id when roster lacks an Architect row.
-- Re-attach appointed architect to applicants if missing from roster payload.

CREATE OR REPLACE FUNCTION public.sync_architect_user_id_from_roster(p_project_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_architect uuid;
BEGIN
  SELECT a.user_id
  INTO v_architect
  FROM public.applicants a
  WHERE a.project_id = p_project_id
    AND lower(
      COALESCE(
        a.applicant_details ->> 'applicantType',
        a.applicant_details ->> 'applicant_type',
        ''
      )
    ) LIKE '%architect%'
    AND a.user_id IS NOT NULL
  ORDER BY a.updated_at DESC NULLS LAST
  LIMIT 1;

  UPDATE public.projects
  SET architect_user_id = COALESCE(v_architect, architect_user_id)
  WHERE id = p_project_id;
END;
$$;

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
  v_project_architect uuid;
BEGIN
  IF NOT public.can_manage_project(p_project_id::text) THEN
    RAISE EXCEPTION 'Not authorized to update applicants for this project';
  END IF;

  SELECT p.architect_user_id
  INTO v_project_architect
  FROM public.projects p
  WHERE p.id = p_project_id;

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

    v_details := public.normalize_applicant_details_elem(elem);
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

  IF v_project_architect IS NOT NULL
    AND NOT (v_project_architect = ANY(COALESCE(kept_user_ids, '{}'::uuid[])))
  THEN
    INSERT INTO public.applicants (project_id, user_id, applicant_details)
    VALUES (
      p_project_id,
      v_project_architect,
      jsonb_build_object('applicantType', 'Architect')
    )
    ON CONFLICT (project_id, user_id)
    DO UPDATE SET
      applicant_details = EXCLUDED.applicant_details,
      updated_at = now();
  END IF;

  UPDATE public.projects
  SET applicant_details = COALESCE(
    public.get_applicant_details_for_project(p_project_id),
    '{"applicants":[]}'::jsonb
  )
  WHERE id = p_project_id;

  PERFORM public.sync_architect_user_id_from_roster(p_project_id);
END;
$$;

-- Repair projects already cleared by the previous sync bug.
UPDATE public.projects p
SET architect_user_id = a.user_id
FROM public.applicants a
WHERE p.id = a.project_id
  AND p.architect_user_id IS NULL
  AND lower(
    COALESCE(
      a.applicant_details ->> 'applicantType',
      a.applicant_details ->> 'applicant_type',
      ''
    )
  ) LIKE '%architect%'
  AND a.user_id IS NOT NULL;

NOTIFY pgrst, 'reload schema';
