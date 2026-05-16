-- Normalized applicants: one row per owner/consultant on a project.
-- Dual-write phase keeps projects.applicant_details in sync from the app.

-- Remote projects table was created without a PK/unique on id; FK requires one.
CREATE UNIQUE INDEX IF NOT EXISTS projects_id_key ON public.projects (id);

CREATE TABLE IF NOT EXISTS public.applicants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  applicant_details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.applicants IS 'Per-project applicant roster (owner + consultants); replaces JSON-only storage over time.';
COMMENT ON COLUMN public.applicants.user_id IS 'auth.users id of the applicant (directory user).';
COMMENT ON COLUMN public.applicants.applicant_details IS 'Single-applicant fields (type, name, addresses, etc.) without top-level user_id.';

CREATE UNIQUE INDEX IF NOT EXISTS applicants_project_user_id_unique
  ON public.applicants (project_id, user_id)
  WHERE user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS applicants_project_id_idx ON public.applicants (project_id);
CREATE INDEX IF NOT EXISTS applicants_user_id_idx ON public.applicants (user_id);
CREATE INDEX IF NOT EXISTS applicants_project_applicant_type_idx
  ON public.applicants (project_id, ((applicant_details ->> 'applicantType')));

CREATE OR REPLACE FUNCTION public.set_applicants_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS applicants_set_updated_at ON public.applicants;
CREATE TRIGGER applicants_set_updated_at
  BEFORE UPDATE ON public.applicants
  FOR EACH ROW
  EXECUTE FUNCTION public.set_applicants_updated_at();

-- Backfill from projects.applicant_details.applicants[]
INSERT INTO public.applicants (project_id, user_id, applicant_details)
SELECT
  p.id,
  NULLIF(TRIM(a->>'user_id'), '')::uuid,
  CASE
    WHEN a ? 'user_id' THEN a - 'user_id'
    ELSE a
  END
FROM public.projects p
CROSS JOIN LATERAL jsonb_array_elements(
  COALESCE(p.applicant_details -> 'applicants', '[]'::jsonb)
) AS a
WHERE jsonb_array_length(COALESCE(p.applicant_details -> 'applicants', '[]'::jsonb)) > 0
ON CONFLICT DO NOTHING;

-- Aggregate helper for reads during dual-write
CREATE OR REPLACE FUNCTION public.get_applicant_details_for_project(p_project_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    jsonb_build_object(
      'applicants',
      COALESCE(
        jsonb_agg(
          (a.applicant_details || CASE
            WHEN a.user_id IS NOT NULL THEN jsonb_build_object('user_id', a.user_id::text)
            ELSE '{}'::jsonb
          END)
          ORDER BY a.created_at, a.id
        ),
        '[]'::jsonb
      )
    ),
    '{"applicants":[]}'::jsonb
  )
  FROM public.applicants a
  WHERE a.project_id = p_project_id;
$$;

COMMENT ON FUNCTION public.get_applicant_details_for_project(uuid) IS
  'Returns { applicants: [...] } aggregated from public.applicants for a project.';

-- Consultant project list via applicants.user_id (drop first: remote may have older return type)
DROP FUNCTION IF EXISTS public.get_projects_for_consultant(uuid);

CREATE OR REPLACE FUNCTION public.get_projects_for_consultant(p_consultant_id uuid)
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
  SELECT DISTINCT
    p.id,
    p.title,
    p.status,
    p.project_info,
    p.save_plot_details
  FROM public.projects p
  INNER JOIN public.applicants a ON a.project_id = p.id
  WHERE a.user_id = p_consultant_id
  ORDER BY p.title;
$$;

COMMENT ON FUNCTION public.get_projects_for_consultant(uuid) IS
  'Projects where the consultant appears in public.applicants.';

-- RLS
ALTER TABLE public.applicants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS applicants_select ON public.applicants;
CREATE POLICY applicants_select ON public.applicants
  FOR SELECT
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = applicants.project_id
        AND p.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS applicants_insert ON public.applicants;
CREATE POLICY applicants_insert ON public.applicants
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = applicants.project_id
        AND p.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS applicants_update ON public.applicants;
CREATE POLICY applicants_update ON public.applicants
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = applicants.project_id
        AND p.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = applicants.project_id
        AND p.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS applicants_delete ON public.applicants;
CREATE POLICY applicants_delete ON public.applicants
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = applicants.project_id
        AND p.user_id = auth.uid()
    )
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.applicants TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_applicant_details_for_project(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_projects_for_consultant(uuid) TO authenticated;
