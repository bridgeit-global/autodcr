-- Owner project list via SECURITY DEFINER (avoids RLS/type mismatch on direct SELECT).

DROP FUNCTION IF EXISTS public.get_projects_for_owner(uuid);

CREATE OR REPLACE FUNCTION public.get_projects_for_owner(p_owner_id uuid)
RETURNS TABLE (
  id uuid,
  title text,
  status text,
  project_info jsonb,
  save_plot_details jsonb
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p.id,
    p.title,
    p.status,
    p.project_info,
    p.save_plot_details
  FROM public.projects p
  WHERE p.user_id::text = p_owner_id::text
  ORDER BY p.created_at DESC NULLS LAST;
$$;

COMMENT ON FUNCTION public.get_projects_for_owner(uuid) IS
  'Projects owned by p_owner_id (matches projects.user_id to auth user id).';

GRANT EXECUTE ON FUNCTION public.get_projects_for_owner(uuid) TO authenticated;

-- Centralized owner check for RLS (handles text/uuid project_id and user_id columns).
CREATE OR REPLACE FUNCTION public.is_project_owner_of(p_project_id text)
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
      AND p.user_id::text = auth.uid()::text
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_project_owner_of(text) TO authenticated;

-- Replace owner policies that failed on mixed uuid/text types.
DROP POLICY IF EXISTS projects_select_owner ON public.projects;
CREATE POLICY projects_select_owner ON public.projects
  FOR SELECT
  USING (user_id::text = auth.uid()::text);

DROP POLICY IF EXISTS applications_select_owner ON public.applications;
CREATE POLICY applications_select_owner ON public.applications
  FOR SELECT
  USING (public.is_project_owner_of(applications.project_id::text));

DROP POLICY IF EXISTS applications_insert_owner ON public.applications;
CREATE POLICY applications_insert_owner ON public.applications
  FOR INSERT
  WITH CHECK (public.is_project_owner_of(applications.project_id::text));

DROP POLICY IF EXISTS applications_update_owner ON public.applications;
CREATE POLICY applications_update_owner ON public.applications
  FOR UPDATE
  USING (public.is_project_owner_of(applications.project_id::text))
  WITH CHECK (public.is_project_owner_of(applications.project_id::text));

DROP POLICY IF EXISTS applications_delete_owner ON public.applications;
CREATE POLICY applications_delete_owner ON public.applications
  FOR DELETE
  USING (public.is_project_owner_of(applications.project_id::text));

DROP POLICY IF EXISTS projects_insert_owner ON public.projects;
CREATE POLICY projects_insert_owner ON public.projects
  FOR INSERT
  WITH CHECK (user_id::text = auth.uid()::text);

DROP POLICY IF EXISTS projects_update_owner ON public.projects;
CREATE POLICY projects_update_owner ON public.projects
  FOR UPDATE
  USING (user_id::text = auth.uid()::text)
  WITH CHECK (user_id::text = auth.uid()::text);

DROP POLICY IF EXISTS projects_delete_owner ON public.projects;
CREATE POLICY projects_delete_owner ON public.projects
  FOR DELETE
  USING (user_id::text = auth.uid()::text);
