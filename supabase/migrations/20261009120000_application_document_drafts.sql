-- One row per application document: typed field drafts and the confirmed PDF path.
-- Application workflow_stage stays draft until every document is saved and the user submits.

CREATE TABLE public.application_document_drafts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid NOT NULL REFERENCES public.applications(id) ON DELETE CASCADE,
  catalog_document_id uuid NOT NULL REFERENCES public.application_documents(id) ON DELETE CASCADE,
  field_values jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'saved')),
  pdf_path text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (application_id, catalog_document_id)
);

CREATE INDEX application_document_drafts_application_id_idx
  ON public.application_document_drafts (application_id);

CREATE INDEX application_document_drafts_saved_idx
  ON public.application_document_drafts (catalog_document_id)
  WHERE status = 'saved';

ALTER TABLE public.application_document_drafts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS application_document_drafts_select_owner ON public.application_document_drafts;
CREATE POLICY application_document_drafts_select_owner ON public.application_document_drafts
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.applications a
      JOIN public.projects p ON p.id::text = a.project_id::text
      WHERE a.id = application_document_drafts.application_id
        AND p.user_id::text = auth.uid()::text
    )
  );

DROP POLICY IF EXISTS application_document_drafts_select_consultant ON public.application_document_drafts;
CREATE POLICY application_document_drafts_select_consultant ON public.application_document_drafts
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.applications a
      WHERE a.id = application_document_drafts.application_id
        AND (
          EXISTS (
            SELECT 1
            FROM public.applicants ap
            WHERE ap.project_id::text = a.project_id::text
              AND ap.user_id = auth.uid()
          )
          OR EXISTS (
            SELECT 1
            FROM public.projects p
            WHERE p.id::text = a.project_id::text
              AND p.architect_user_id = auth.uid()
          )
        )
    )
  );

DROP POLICY IF EXISTS application_document_drafts_insert_owner ON public.application_document_drafts;
CREATE POLICY application_document_drafts_insert_owner ON public.application_document_drafts
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.applications a
      JOIN public.projects p ON p.id::text = a.project_id::text
      WHERE a.id = application_document_drafts.application_id
        AND p.user_id::text = auth.uid()::text
    )
  );

DROP POLICY IF EXISTS application_document_drafts_update_owner ON public.application_document_drafts;
CREATE POLICY application_document_drafts_update_owner ON public.application_document_drafts
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM public.applications a
      JOIN public.projects p ON p.id::text = a.project_id::text
      WHERE a.id = application_document_drafts.application_id
        AND p.user_id::text = auth.uid()::text
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.applications a
      JOIN public.projects p ON p.id::text = a.project_id::text
      WHERE a.id = application_document_drafts.application_id
        AND p.user_id::text = auth.uid()::text
    )
  );

DROP POLICY IF EXISTS application_document_drafts_insert_consultant ON public.application_document_drafts;
CREATE POLICY application_document_drafts_insert_consultant ON public.application_document_drafts
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.applications a
      JOIN public.applicants ap ON ap.project_id::text = a.project_id::text
      WHERE a.id = application_document_drafts.application_id
        AND ap.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS application_document_drafts_update_consultant ON public.application_document_drafts;
CREATE POLICY application_document_drafts_update_consultant ON public.application_document_drafts
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM public.applications a
      JOIN public.applicants ap ON ap.project_id::text = a.project_id::text
      WHERE a.id = application_document_drafts.application_id
        AND ap.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.applications a
      JOIN public.applicants ap ON ap.project_id::text = a.project_id::text
      WHERE a.id = application_document_drafts.application_id
        AND ap.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS application_document_drafts_insert_architect ON public.application_document_drafts;
CREATE POLICY application_document_drafts_insert_architect ON public.application_document_drafts
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.applications a
      WHERE a.id = application_document_drafts.application_id
        AND public.can_manage_project(a.project_id::text)
    )
  );

DROP POLICY IF EXISTS application_document_drafts_update_architect ON public.application_document_drafts;
CREATE POLICY application_document_drafts_update_architect ON public.application_document_drafts
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM public.applications a
      WHERE a.id = application_document_drafts.application_id
        AND public.can_manage_project(a.project_id::text)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.applications a
      WHERE a.id = application_document_drafts.application_id
        AND public.can_manage_project(a.project_id::text)
    )
  );

GRANT SELECT, INSERT, UPDATE ON public.application_document_drafts TO authenticated;

NOTIFY pgrst, 'reload schema';
