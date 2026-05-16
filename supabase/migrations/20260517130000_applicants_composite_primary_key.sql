-- Primary key IS (project_id, user_id). Drop separate id column.
-- Add project_user_key so the pair is visible in one column in Table Editor.

DROP TRIGGER IF EXISTS applicants_set_id ON public.applicants;

ALTER TABLE public.applicants
  DROP CONSTRAINT IF EXISTS applicants_pkey;

ALTER TABLE public.applicants
  DROP CONSTRAINT IF EXISTS applicants_project_id_user_id_unique;

-- Rows without user_id cannot be part of the composite key
DELETE FROM public.applicants
WHERE user_id IS NULL;

ALTER TABLE public.applicants
  DROP COLUMN IF EXISTS id;

ALTER TABLE public.applicants
  ALTER COLUMN user_id SET NOT NULL;

ALTER TABLE public.applicants
  ADD PRIMARY KEY (project_id, user_id);

ALTER TABLE public.applicants
  ADD COLUMN IF NOT EXISTS project_user_key text
  GENERATED ALWAYS AS (project_id::text || '|' || user_id::text) STORED;

COMMENT ON COLUMN public.applicants.project_user_key IS
  'Readable pair: project_id|user_id (same as primary key, for exports/UI).';

-- Rebuild aggregate RPC (no row id column)
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
          (a.applicant_details || jsonb_build_object('user_id', a.user_id::text))
          ORDER BY a.created_at
        ),
        '[]'::jsonb
      )
    ),
    '{"applicants":[]}'::jsonb
  )
  FROM public.applicants a
  WHERE a.project_id = p_project_id;
$$;
