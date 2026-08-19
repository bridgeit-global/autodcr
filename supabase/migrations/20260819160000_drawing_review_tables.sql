-- Drawing review: versions, remarks, and redlines scoped by project membership.

CREATE OR REPLACE FUNCTION public.user_can_access_project(p_project_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.projects p
    WHERE p.id = p_project_id
      AND (
        p.user_id::text = auth.uid()::text
        OR p.architect_user_id = auth.uid()
        OR EXISTS (
          SELECT 1
          FROM public.applicants a
          WHERE a.project_id = p.id
            AND a.user_id = auth.uid()
        )
      )
  );
$$;

COMMENT ON FUNCTION public.user_can_access_project(uuid) IS
  'True when the current user is the project owner, appointed architect, or on the applicants roster.';

GRANT EXECUTE ON FUNCTION public.user_can_access_project(uuid) TO authenticated;

CREATE TABLE IF NOT EXISTS public.drawing_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  file_name text NOT NULL,
  storage_path text NOT NULL,
  file_size_bytes bigint,
  status text NOT NULL DEFAULT 'current'
    CHECK (status IN ('current', 'previous', 'approved', 'revision_requested')),
  key_changes jsonb NOT NULL DEFAULT '[]'::jsonb,
  uploaded_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS drawing_versions_project_id_created_at_idx
  ON public.drawing_versions (project_id, created_at DESC);

COMMENT ON TABLE public.drawing_versions IS 'CAD drawing versions per project (DWG/DXF in project-library storage).';

CREATE TABLE IF NOT EXISTS public.drawing_remarks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  drawing_version_id uuid NOT NULL REFERENCES public.drawing_versions(id) ON DELETE CASCADE,
  author_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  author_name text NOT NULL DEFAULT '',
  author_role text NOT NULL DEFAULT '',
  kind text NOT NULL DEFAULT 'comment'
    CHECK (kind IN ('comment', 'revision_request', 'approval')),
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS drawing_remarks_version_id_created_at_idx
  ON public.drawing_remarks (drawing_version_id, created_at DESC);

COMMENT ON TABLE public.drawing_remarks IS 'Review comments, revision requests, and approvals on a drawing version.';

CREATE TABLE IF NOT EXISTS public.drawing_redlines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  drawing_version_id uuid NOT NULL REFERENCES public.drawing_versions(id) ON DELETE CASCADE,
  author_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  kind text NOT NULL CHECK (kind IN ('rect', 'pin')),
  geometry jsonb NOT NULL DEFAULT '{}'::jsonb,
  color text,
  label text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS drawing_redlines_version_id_idx
  ON public.drawing_redlines (drawing_version_id);

COMMENT ON TABLE public.drawing_redlines IS 'SVG redline marks (percent coordinates) on a drawing version.';

ALTER TABLE public.drawing_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.drawing_remarks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.drawing_redlines ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS drawing_versions_select ON public.drawing_versions;
CREATE POLICY drawing_versions_select ON public.drawing_versions
  FOR SELECT
  USING (public.user_can_access_project(project_id));

DROP POLICY IF EXISTS drawing_versions_insert ON public.drawing_versions;
CREATE POLICY drawing_versions_insert ON public.drawing_versions
  FOR INSERT
  WITH CHECK (public.user_can_access_project(project_id));

DROP POLICY IF EXISTS drawing_versions_update ON public.drawing_versions;
CREATE POLICY drawing_versions_update ON public.drawing_versions
  FOR UPDATE
  USING (public.user_can_access_project(project_id))
  WITH CHECK (public.user_can_access_project(project_id));

DROP POLICY IF EXISTS drawing_versions_delete ON public.drawing_versions;
CREATE POLICY drawing_versions_delete ON public.drawing_versions
  FOR DELETE
  USING (public.user_can_access_project(project_id));

DROP POLICY IF EXISTS drawing_remarks_select ON public.drawing_remarks;
CREATE POLICY drawing_remarks_select ON public.drawing_remarks
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.drawing_versions dv
      WHERE dv.id = drawing_remarks.drawing_version_id
        AND public.user_can_access_project(dv.project_id)
    )
  );

DROP POLICY IF EXISTS drawing_remarks_insert ON public.drawing_remarks;
CREATE POLICY drawing_remarks_insert ON public.drawing_remarks
  FOR INSERT
  WITH CHECK (
    author_user_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.drawing_versions dv
      WHERE dv.id = drawing_remarks.drawing_version_id
        AND public.user_can_access_project(dv.project_id)
    )
  );

DROP POLICY IF EXISTS drawing_redlines_select ON public.drawing_redlines;
CREATE POLICY drawing_redlines_select ON public.drawing_redlines
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.drawing_versions dv
      WHERE dv.id = drawing_redlines.drawing_version_id
        AND public.user_can_access_project(dv.project_id)
    )
  );

DROP POLICY IF EXISTS drawing_redlines_insert ON public.drawing_redlines;
CREATE POLICY drawing_redlines_insert ON public.drawing_redlines
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.drawing_versions dv
      WHERE dv.id = drawing_redlines.drawing_version_id
        AND public.user_can_access_project(dv.project_id)
    )
  );

DROP POLICY IF EXISTS drawing_redlines_delete ON public.drawing_redlines;
CREATE POLICY drawing_redlines_delete ON public.drawing_redlines
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1
      FROM public.drawing_versions dv
      WHERE dv.id = drawing_redlines.drawing_version_id
        AND public.user_can_access_project(dv.project_id)
    )
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.drawing_versions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.drawing_remarks TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.drawing_redlines TO authenticated;

NOTIFY pgrst, 'reload schema';
