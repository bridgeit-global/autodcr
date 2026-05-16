-- project_user_key was empty: IF NOT EXISTS skipped the GENERATED definition.
-- Use a trigger + backfill so values show in Supabase Table Editor.

ALTER TABLE public.applicants
  DROP COLUMN IF EXISTS project_user_key;

ALTER TABLE public.applicants
  ADD COLUMN project_user_key text;

UPDATE public.applicants
SET project_user_key = project_id::text || '|' || user_id::text
WHERE project_user_key IS DISTINCT FROM project_id::text || '|' || user_id::text;

ALTER TABLE public.applicants
  ALTER COLUMN project_user_key SET NOT NULL;

CREATE OR REPLACE FUNCTION public.applicants_set_project_user_key()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.project_user_key := NEW.project_id::text || '|' || NEW.user_id::text;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS applicants_set_project_user_key ON public.applicants;
CREATE TRIGGER applicants_set_project_user_key
  BEFORE INSERT OR UPDATE OF project_id, user_id
  ON public.applicants
  FOR EACH ROW
  EXECUTE FUNCTION public.applicants_set_project_user_key();

COMMENT ON COLUMN public.applicants.project_user_key IS
  'Readable pair project_id|user_id; kept in sync by trigger.';
