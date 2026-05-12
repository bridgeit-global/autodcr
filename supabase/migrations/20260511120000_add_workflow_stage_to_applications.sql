-- Per-application workflow for dashboard columns (Draft / In Process / Approved or Verified).
-- Application code uses: draft | in_process | approved_verified

ALTER TABLE public.applications
  ADD COLUMN IF NOT EXISTS workflow_stage text NOT NULL DEFAULT 'draft';

ALTER TABLE public.applications
  DROP CONSTRAINT IF EXISTS applications_workflow_stage_check;

ALTER TABLE public.applications
  ADD CONSTRAINT applications_workflow_stage_check
  CHECK (workflow_stage IN ('draft', 'in_process', 'approved_verified'));

COMMENT ON COLUMN public.applications.workflow_stage IS 'Lifecycle: draft → in_process → approved_verified';

UPDATE public.applications
SET workflow_stage = 'draft'
WHERE workflow_stage IS NULL;

-- If updates fail from the client, add or adjust RLS on public.applications so authenticated users
-- can UPDATE workflow_stage for rows they own (often via project user_id / membership).
