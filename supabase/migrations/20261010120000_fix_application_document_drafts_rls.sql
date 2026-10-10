-- Draft policies must not SELECT applicants or projects directly.
-- Those tables' policies reference each other, which raises
-- "infinite recursion detected in policy for relation applicants".

CREATE OR REPLACE FUNCTION public.can_access_application(p_application_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.applications a
    WHERE a.id = p_application_id
      AND (
        public.can_manage_project(a.project_id::text)
        OR EXISTS (
          SELECT 1
          FROM public.applicants ap
          WHERE ap.project_id::text = a.project_id::text
            AND ap.user_id = auth.uid()
        )
      )
  );
$$;

GRANT EXECUTE ON FUNCTION public.can_access_application(uuid) TO authenticated;

DROP POLICY IF EXISTS application_document_drafts_select_owner ON public.application_document_drafts;
DROP POLICY IF EXISTS application_document_drafts_select_consultant ON public.application_document_drafts;
DROP POLICY IF EXISTS application_document_drafts_insert_owner ON public.application_document_drafts;
DROP POLICY IF EXISTS application_document_drafts_update_owner ON public.application_document_drafts;
DROP POLICY IF EXISTS application_document_drafts_insert_consultant ON public.application_document_drafts;
DROP POLICY IF EXISTS application_document_drafts_update_consultant ON public.application_document_drafts;
DROP POLICY IF EXISTS application_document_drafts_insert_architect ON public.application_document_drafts;
DROP POLICY IF EXISTS application_document_drafts_update_architect ON public.application_document_drafts;

CREATE POLICY application_document_drafts_select ON public.application_document_drafts
  FOR SELECT
  USING (public.can_access_application(application_id));

CREATE POLICY application_document_drafts_insert ON public.application_document_drafts
  FOR INSERT
  WITH CHECK (public.can_access_application(application_id));

CREATE POLICY application_document_drafts_update ON public.application_document_drafts
  FOR UPDATE
  USING (public.can_access_application(application_id))
  WITH CHECK (public.can_access_application(application_id));

NOTIFY pgrst, 'reload schema';
