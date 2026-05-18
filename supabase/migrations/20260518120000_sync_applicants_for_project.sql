-- Sync public.applicants from projects.applicant_details.applicants[] after owner saves roster.

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
