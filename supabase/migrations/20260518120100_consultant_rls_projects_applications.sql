-- Consultant read via applicants roster; owners retain access via projects.user_id.
-- Cast project/user ids to text where remote columns mix uuid and text types.

ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.applications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS projects_select_owner ON public.projects;
CREATE POLICY projects_select_owner ON public.projects
  FOR SELECT
  USING (user_id::text = auth.uid()::text);

DROP POLICY IF EXISTS applications_select_owner ON public.applications;
CREATE POLICY applications_select_owner ON public.applications
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.projects p
      WHERE p.id::text = applications.project_id::text
        AND p.user_id::text = auth.uid()::text
    )
  );

DROP POLICY IF EXISTS projects_select_consultant ON public.projects;
CREATE POLICY projects_select_consultant ON public.projects
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.applicants a
      WHERE a.project_id::text = projects.id::text
        AND a.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS applications_select_consultant ON public.applications;
CREATE POLICY applications_select_consultant ON public.applications
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.applicants a
      WHERE a.project_id::text = applications.project_id::text
        AND a.user_id = auth.uid()
    )
  );

-- Owner write access (required once RLS is enabled)
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

DROP POLICY IF EXISTS applications_insert_owner ON public.applications;
CREATE POLICY applications_insert_owner ON public.applications
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.projects p
      WHERE p.id::text = applications.project_id::text
        AND p.user_id::text = auth.uid()::text
    )
  );

DROP POLICY IF EXISTS applications_update_owner ON public.applications;
CREATE POLICY applications_update_owner ON public.applications
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM public.projects p
      WHERE p.id::text = applications.project_id::text
        AND p.user_id::text = auth.uid()::text
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.projects p
      WHERE p.id::text = applications.project_id::text
        AND p.user_id::text = auth.uid()::text
    )
  );

DROP POLICY IF EXISTS applications_delete_owner ON public.applications;
CREATE POLICY applications_delete_owner ON public.applications
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1
      FROM public.projects p
      WHERE p.id::text = applications.project_id::text
        AND p.user_id::text = auth.uid()::text
    )
  );

DROP POLICY IF EXISTS applications_update_consultant ON public.applications;
CREATE POLICY applications_update_consultant ON public.applications
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM public.applicants a
      WHERE a.project_id::text = applications.project_id::text
        AND a.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.applicants a
      WHERE a.project_id::text = applications.project_id::text
        AND a.user_id = auth.uid()
    )
  );
