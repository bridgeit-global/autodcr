-- Optional indexes for signature columns (dashboards / “awaiting architect” lists).

CREATE INDEX IF NOT EXISTS idx_applications_owner_signed_at
  ON public.applications (owner_signed_at);

CREATE INDEX IF NOT EXISTS idx_applications_architect_signed_at
  ON public.applications (architect_signed_at);

-- In Process, owner done, architect not yet (Architect second-sign queue).
CREATE INDEX IF NOT EXISTS idx_applications_in_process_pending_architect_sign
  ON public.applications (project_id)
  WHERE workflow_stage = 'in_process'
    AND owner_signed_at IS NOT NULL
    AND architect_signed_at IS NULL;
