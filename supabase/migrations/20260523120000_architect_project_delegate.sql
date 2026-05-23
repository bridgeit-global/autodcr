-- Architect delegate: can_manage_project, owner RPCs for appointed architect,
-- create_project_by_architect, roster sync of architect_user_id.

CREATE OR REPLACE FUNCTION public.can_manage_project(p_project_id text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.projects p
    WHERE p.id::text = p_project_id
      AND (
        p.user_id::text = auth.uid()::text
        OR p.architect_user_id = auth.uid()
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.user_can_manage_project(p_project_id text, p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.projects p
    WHERE p.id::text = p_project_id
      AND (
        p.user_id::text = p_user_id::text
        OR p.architect_user_id = p_user_id
      )
  );
$$;

GRANT EXECUTE ON FUNCTION public.can_manage_project(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_can_manage_project(text, uuid) TO authenticated;

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
  SET architect_user_id = v_architect
  WHERE id = p_project_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.sync_architect_user_id_from_roster(uuid) TO authenticated;

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
  IF NOT public.can_manage_project(p_project_id::text) THEN
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

  PERFORM public.sync_architect_user_id_from_roster(p_project_id);
END;
$$;

-- Postgres cannot change OUT/return row type via CREATE OR REPLACE alone.
DROP FUNCTION IF EXISTS public.get_projects_for_consultant(uuid);

CREATE FUNCTION public.get_projects_for_consultant(p_consultant_id uuid)
RETURNS TABLE (
  id uuid,
  title text,
  status text,
  project_info jsonb,
  save_plot_details jsonb,
  user_id uuid,
  architect_user_id uuid
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT
    p.id,
    p.title,
    p.status,
    p.project_info,
    p.save_plot_details,
    p.user_id,
    p.architect_user_id
  FROM public.projects p
  WHERE
    EXISTS (
      SELECT 1 FROM public.applicants a
      WHERE a.project_id = p.id
        AND a.user_id = p_consultant_id
    )
    OR p.architect_user_id = p_consultant_id
  ORDER BY p.title;
$$;

GRANT EXECUTE ON FUNCTION public.get_projects_for_consultant(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_application_for_owner(
  p_application_id uuid,
  p_owner_id uuid
)
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
      p.user_id::text = p_owner_id::text
      OR p.architect_user_id = p_owner_id
    )
  LIMIT 1;
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
  WHERE (
      p.user_id::text = p_owner_id::text
      OR p.architect_user_id = p_owner_id
    )
    AND lower(trim(a.department)) = lower(trim(p_department))
    AND (
      p_project_ids IS NULL
      OR cardinality(p_project_ids) = 0
      OR a.project_id::text = ANY (p_project_ids)
    );
$$;

CREATE OR REPLACE FUNCTION public.create_application_for_owner(
  p_owner_id uuid,
  p_project_id text,
  p_project_title text,
  p_department text,
  p_permission_type text,
  p_workflow_stage text DEFAULT 'draft'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
  v_stage text;
BEGIN
  IF NOT public.user_can_manage_project(p_project_id, p_owner_id) THEN
    RAISE EXCEPTION 'You do not have permission to create an application for this project.'
      USING ERRCODE = '42501';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.applications a
    WHERE a.project_id::text = p_project_id
      AND lower(trim(a.department)) = lower(trim(p_department))
      AND lower(trim(a.permission_type)) = lower(trim(p_permission_type))
  ) THEN
    RAISE EXCEPTION 'This permission type is already added for the selected project.'
      USING ERRCODE = '23505';
  END IF;

  v_stage := COALESCE(NULLIF(trim(p_workflow_stage), ''), 'draft');

  INSERT INTO public.applications (
    project_id,
    project_title,
    department,
    permission_type,
    workflow_stage
  )
  VALUES (
    p_project_id,
    p_project_title,
    p_department,
    p_permission_type,
    v_stage
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_application_for_owner(
  p_application_id uuid,
  p_owner_id uuid
)
RETURNS TABLE (project_id text, permission_type text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_project_id text;
  v_permission_type text;
BEGIN
  SELECT a.project_id::text, a.permission_type
  INTO v_project_id, v_permission_type
  FROM public.applications a
  INNER JOIN public.projects p ON p.id::text = a.project_id::text
  WHERE a.id = p_application_id
    AND (
      p.user_id::text = p_owner_id::text
      OR p.architect_user_id = p_owner_id
    )
  LIMIT 1;

  IF v_project_id IS NULL THEN
    RETURN;
  END IF;

  DELETE FROM public.applications a
  USING public.projects p
  WHERE a.id = p_application_id
    AND p.id::text = a.project_id::text
    AND (
      p.user_id::text = p_owner_id::text
      OR p.architect_user_id = p_owner_id
    );

  project_id := v_project_id;
  permission_type := v_permission_type;
  RETURN NEXT;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_application_for_owner(
  p_application_id uuid,
  p_owner_id uuid,
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
  v_is_owner boolean := false;
  v_can_manage boolean := false;
BEGIN
  SELECT
    p.user_id::text = p_owner_id::text,
    public.user_can_manage_project(a.project_id::text, p_owner_id)
  INTO v_is_owner, v_can_manage
  FROM public.applications a
  INNER JOIN public.projects p ON p.id::text = a.project_id::text
  WHERE a.id = p_application_id
  LIMIT 1;

  IF NOT COALESCE(v_can_manage, false) THEN
    RETURN false;
  END IF;

  IF (p_owner_signed_at IS NOT NULL OR p_owner_signed_by IS NOT NULL)
    AND NOT COALESCE(v_is_owner, false)
  THEN
    RETURN false;
  END IF;

  UPDATE public.applications a
  SET
    workflow_stage = COALESCE(p_workflow_stage, a.workflow_stage),
    owner_signed_at = COALESCE(p_owner_signed_at, a.owner_signed_at),
    owner_signed_by = COALESCE(p_owner_signed_by, a.owner_signed_by),
    architect_signed_at = COALESCE(p_architect_signed_at, a.architect_signed_at),
    architect_signed_by = COALESCE(p_architect_signed_by, a.architect_signed_by)
  FROM public.projects p
  WHERE a.id = p_application_id
    AND p.id::text = a.project_id::text
    AND (
      p.user_id::text = p_owner_id::text
      OR p.architect_user_id = p_owner_id
    );

  RETURN FOUND;
END;
$$;

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
    AND (
      p.user_id::text = auth.uid()::text
      OR p.architect_user_id = auth.uid()
    )
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.create_project_by_architect(
  p_owner_user_id uuid,
  p_title text,
  p_status text DEFAULT 'draft',
  p_project_info jsonb DEFAULT '{}'::jsonb,
  p_save_plot_details jsonb DEFAULT '{}'::jsonb,
  p_applicant_details jsonb DEFAULT '{}'::jsonb,
  p_building_details jsonb DEFAULT '{}'::jsonb,
  p_area_details jsonb DEFAULT '{}'::jsonb,
  p_project_library jsonb DEFAULT '{}'::jsonb,
  p_bg_details jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.projects%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;

  IF p_owner_user_id IS NULL THEN
    RAISE EXCEPTION 'Project owner is required.' USING ERRCODE = '22023';
  END IF;

  IF p_owner_user_id = auth.uid() THEN
    RAISE EXCEPTION 'Architect must designate a different user as project owner.'
      USING ERRCODE = '22023';
  END IF;

  IF p_title IS NULL OR trim(p_title) = '' THEN
    RAISE EXCEPTION 'Project title is required.' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.projects (
    user_id,
    architect_user_id,
    title,
    status,
    project_info,
    save_plot_details,
    applicant_details,
    building_details,
    area_details,
    project_library,
    bg_details,
    application_urls
  )
  VALUES (
    p_owner_user_id,
    auth.uid(),
    trim(p_title),
    COALESCE(NULLIF(trim(p_status), ''), 'draft'),
    COALESCE(p_project_info, '{}'::jsonb),
    COALESCE(p_save_plot_details, '{}'::jsonb),
    COALESCE(p_applicant_details, '{"applicants":[]}'::jsonb),
    COALESCE(p_building_details, '{}'::jsonb),
    COALESCE(p_area_details, '{}'::jsonb),
    COALESCE(p_project_library, '{}'::jsonb),
    COALESCE(p_bg_details, '{}'::jsonb),
    '{}'::jsonb
  )
  RETURNING * INTO v_row;

  RETURN to_jsonb(v_row);
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_project_by_architect(
  uuid, text, text, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb
) TO authenticated;

DROP POLICY IF EXISTS projects_update_architect ON public.projects;
CREATE POLICY projects_update_architect ON public.projects
  FOR UPDATE
  USING (architect_user_id = auth.uid())
  WITH CHECK (architect_user_id = auth.uid());

DROP POLICY IF EXISTS applications_insert_architect ON public.applications;
CREATE POLICY applications_insert_architect ON public.applications
  FOR INSERT
  WITH CHECK (public.can_manage_project(applications.project_id::text));

DROP POLICY IF EXISTS applications_update_architect ON public.applications;
CREATE POLICY applications_update_architect ON public.applications
  FOR UPDATE
  USING (public.can_manage_project(applications.project_id::text))
  WITH CHECK (public.can_manage_project(applications.project_id::text));

DROP POLICY IF EXISTS applications_delete_architect ON public.applications;
CREATE POLICY applications_delete_architect ON public.applications
  FOR DELETE
  USING (public.can_manage_project(applications.project_id::text));

NOTIFY pgrst, 'reload schema';
