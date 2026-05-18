-- Create application as project owner (bypasses RLS on INSERT).

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
  IF NOT EXISTS (
    SELECT 1
    FROM public.projects p
    WHERE p.id::text = p_project_id
      AND p.user_id::text = p_owner_id::text
  ) THEN
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

GRANT EXECUTE ON FUNCTION public.create_application_for_owner(
  uuid, text, text, text, text, text
) TO authenticated;

COMMENT ON FUNCTION public.create_application_for_owner(uuid, text, text, text, text, text) IS
  'Insert a draft application on an owner project; enforces ownership and duplicate permission type.';
