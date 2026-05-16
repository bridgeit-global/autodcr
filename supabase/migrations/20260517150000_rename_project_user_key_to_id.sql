-- Rename project_user_key → id; use as unique primary key (project_id|user_id).

ALTER TABLE public.applicants
  DROP CONSTRAINT IF EXISTS applicants_pkey;

ALTER TABLE public.applicants
  RENAME COLUMN project_user_key TO id;

UPDATE public.applicants
SET id = project_id::text || '|' || user_id::text
WHERE id IS DISTINCT FROM project_id::text || '|' || user_id::text;

ALTER TABLE public.applicants
  ALTER COLUMN id SET NOT NULL;

ALTER TABLE public.applicants
  ADD CONSTRAINT applicants_pkey PRIMARY KEY (id);

ALTER TABLE public.applicants
  DROP CONSTRAINT IF EXISTS applicants_project_user_unique;

ALTER TABLE public.applicants
  ADD CONSTRAINT applicants_project_user_unique UNIQUE (project_id, user_id);

DROP TRIGGER IF EXISTS applicants_set_project_user_key ON public.applicants;
DROP FUNCTION IF EXISTS public.applicants_set_project_user_key();

CREATE OR REPLACE FUNCTION public.applicants_set_id()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.id := NEW.project_id::text || '|' || NEW.user_id::text;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS applicants_set_id ON public.applicants;
CREATE TRIGGER applicants_set_id
  BEFORE INSERT OR UPDATE OF project_id, user_id
  ON public.applicants
  FOR EACH ROW
  EXECUTE FUNCTION public.applicants_set_id();

COMMENT ON COLUMN public.applicants.id IS
  'Primary key: project_id|user_id (unique per project+user pair).';
