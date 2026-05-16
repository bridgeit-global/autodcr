-- applicants.id = deterministic UUID from project_id + user_id (UUID v5).
-- Same project + same user always yields the same id.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA extensions;

CREATE OR REPLACE FUNCTION public.applicants_compute_id(
  p_project_id uuid,
  p_user_id uuid,
  p_applicant_type text DEFAULT NULL
)
RETURNS uuid
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT extensions.uuid_generate_v5(
    'a0000000-0000-4000-8000-000000000001'::uuid,
    p_project_id::text || '|' || COALESCE(
      p_user_id::text,
      'type:' || COALESCE(NULLIF(TRIM(p_applicant_type), ''), 'unknown')
    )
  );
$$;

COMMENT ON FUNCTION public.applicants_compute_id(uuid, uuid, text) IS
  'Stable applicants.id from project_id + user_id (or project_id + applicant type when user_id is null).';

-- Remove duplicate (project_id, user_id) before re-keying
DELETE FROM public.applicants a
USING public.applicants b
WHERE a.project_id = b.project_id
  AND a.user_id IS NOT NULL
  AND b.user_id IS NOT NULL
  AND a.user_id = b.user_id
  AND a.ctid > b.ctid;

-- Safe PK swap via id_new (avoids transient UUID collisions during UPDATE)
ALTER TABLE public.applicants
  ADD COLUMN IF NOT EXISTS id_new uuid;

UPDATE public.applicants a
SET id_new = public.applicants_compute_id(
  a.project_id,
  a.user_id,
  COALESCE(a.applicant_details->>'applicantType', a.applicant_details->>'applicant_type')
);

DELETE FROM public.applicants a
USING public.applicants b
WHERE a.id_new = b.id_new
  AND a.ctid > b.ctid;

ALTER TABLE public.applicants
  DROP CONSTRAINT IF EXISTS applicants_pkey;

ALTER TABLE public.applicants
  DROP COLUMN id;

ALTER TABLE public.applicants
  RENAME COLUMN id_new TO id;

ALTER TABLE public.applicants
  ADD PRIMARY KEY (id);

ALTER TABLE public.applicants
  ALTER COLUMN id SET NOT NULL;

CREATE OR REPLACE FUNCTION public.applicants_set_id_before_write()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.id := public.applicants_compute_id(
    NEW.project_id,
    NEW.user_id,
    COALESCE(NEW.applicant_details->>'applicantType', NEW.applicant_details->>'applicant_type')
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS applicants_set_id ON public.applicants;
CREATE TRIGGER applicants_set_id
  BEFORE INSERT OR UPDATE OF project_id, user_id, applicant_details
  ON public.applicants
  FOR EACH ROW
  EXECUTE FUNCTION public.applicants_set_id_before_write();

COMMENT ON COLUMN public.applicants.id IS
  'Deterministic UUID (v5) from project_id + user_id. Re-inserting the same pair updates the same row id.';
