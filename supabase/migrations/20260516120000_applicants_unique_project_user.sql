-- Enforce: applicants.id is unique (PK) and (project_id, user_id) cannot repeat.

-- Remove duplicate rows before adding the composite unique constraint (keep oldest row).
DELETE FROM public.applicants a
USING public.applicants b
WHERE a.project_id = b.project_id
  AND a.user_id IS NOT NULL
  AND b.user_id IS NOT NULL
  AND a.user_id = b.user_id
  AND a.id > b.id;

DROP INDEX IF EXISTS public.applicants_project_user_id_unique;

ALTER TABLE public.applicants
  DROP CONSTRAINT IF EXISTS applicants_project_id_user_id_unique;

ALTER TABLE public.applicants
  ADD CONSTRAINT applicants_project_id_user_id_unique UNIQUE (project_id, user_id);

COMMENT ON CONSTRAINT applicants_project_id_user_id_unique ON public.applicants IS
  'One roster entry per user per project. applicants.id remains the primary key (globally unique).';
