-- Idempotent: ensure projects.applicant_details exists after cutover/revert.
-- Run this if the column is missing in Table Editor or API returns PGRST204.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'projects'
      AND column_name = 'applicant_details'
  ) THEN
    ALTER TABLE public.projects
      ADD COLUMN applicant_details jsonb NOT NULL DEFAULT '{"applicants":[]}'::jsonb;
  END IF;
END $$;

COMMENT ON COLUMN public.projects.applicant_details IS
  'Project applicant roster JSON: { "applicants": [ ... ] }. Synced to public.applicants via sync_applicants_for_project.';

-- Backfill from public.applicants when JSON roster is empty.
UPDATE public.projects p
SET applicant_details = COALESCE(
  public.get_applicant_details_for_project(p.id),
  '{"applicants":[]}'::jsonb
)
WHERE jsonb_array_length(COALESCE(p.applicant_details -> 'applicants', '[]'::jsonb)) = 0
  AND jsonb_array_length(
    COALESCE(public.get_applicant_details_for_project(p.id) -> 'applicants', '[]'::jsonb)
  ) > 0;

NOTIFY pgrst, 'reload schema';
