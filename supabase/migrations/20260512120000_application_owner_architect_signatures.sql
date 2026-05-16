-- Per-application signature audit for In Process → Approved flow (owner first, then architect for Architect letters).

ALTER TABLE public.applications
  ADD COLUMN IF NOT EXISTS owner_signed_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS owner_signed_by uuid NULL,
  ADD COLUMN IF NOT EXISTS architect_signed_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS architect_signed_by uuid NULL;

COMMENT ON COLUMN public.applications.owner_signed_at IS 'When the project owner completed the mock/DSC signing step.';
COMMENT ON COLUMN public.applications.owner_signed_by IS 'auth.users id of the user who signed as owner.';
COMMENT ON COLUMN public.applications.architect_signed_at IS 'When the appointed architect completed signing (Architect template only).';
COMMENT ON COLUMN public.applications.architect_signed_by IS 'auth.users id of the user who signed as architect.';
