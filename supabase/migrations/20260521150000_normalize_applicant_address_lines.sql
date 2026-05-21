-- Ensure address_line1/2/3 are stored in public.applicants.applicant_details when saving roster.

CREATE OR REPLACE FUNCTION public.normalize_applicant_details_elem(elem jsonb)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v jsonb;
  residential text;
  parts text[];
  line1 text;
  line2 text;
  line3 text;
BEGIN
  v := elem;

  line1 := NULLIF(trim(COALESCE(v->>'address_line1', v->>'addressLine1', '')), '');
  line2 := NULLIF(trim(COALESCE(v->>'address_line2', v->>'addressLine2', '')), '');
  line3 := NULLIF(trim(COALESCE(v->>'address_line3', v->>'addressLine3', '')), '');

  IF line1 IS NULL AND line2 IS NULL AND line3 IS NULL THEN
    residential := NULLIF(trim(COALESCE(v->>'residentialAddress', v->>'residential_address', v->>'address', '')), '');
    IF residential IS NOT NULL THEN
      parts := regexp_split_to_array(regexp_replace(residential, E'[\\n\\r]+', ',', 'g'), '\\s*,\\s*');
      parts := array_remove(parts, NULL);
      IF array_length(parts, 1) >= 1 THEN
        line1 := parts[1];
      END IF;
      IF array_length(parts, 1) = 2 THEN
        line2 := parts[2];
      ELSIF array_length(parts, 1) > 2 THEN
        line2 := array_to_string(parts[2:array_length(parts, 1) - 1], ', ');
        line3 := parts[array_length(parts, 1)];
      END IF;
    END IF;
  END IF;

  IF line1 IS NOT NULL THEN
    v := v || jsonb_build_object('address_line1', line1);
  END IF;
  IF line2 IS NOT NULL THEN
    v := v || jsonb_build_object('address_line2', line2);
  END IF;
  IF line3 IS NOT NULL THEN
    v := v || jsonb_build_object('address_line3', line3);
  END IF;

  RETURN v;
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

  UPDATE public.projects
  SET applicant_details = COALESCE(
    public.get_applicant_details_for_project(p_project_id),
    '{"applicants":[]}'::jsonb
  )
  WHERE id = p_project_id;
END;
$$;

-- Preview RPC: applicants table only (no merge with stale projects JSON).
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
