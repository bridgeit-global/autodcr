-- Merge public.applicants over projects.applicant_details JSON instead of replacing it.
-- Replacing dropped Owner rows that exist only in projects JSON (no user_id sync).

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
