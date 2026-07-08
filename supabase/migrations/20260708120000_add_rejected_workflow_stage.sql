-- Add 'rejected' as a valid workflow_stage for applications.

ALTER TABLE public.applications
  DROP CONSTRAINT IF EXISTS applications_workflow_stage_check;

ALTER TABLE public.applications
  ADD CONSTRAINT applications_workflow_stage_check
  CHECK (workflow_stage IN ('draft', 'in_process', 'approved_verified', 'rejected'));

COMMENT ON COLUMN public.applications.workflow_stage IS
  'Lifecycle: draft → in_process → approved_verified, or rejected at any point';
