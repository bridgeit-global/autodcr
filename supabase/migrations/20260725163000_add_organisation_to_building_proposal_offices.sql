-- Add organisation line for BP / fire correspondence office letter blocks
-- (e.g. "Brihanmumbai Municipal Corporation," between O/o designation and address).

ALTER TABLE public.building_proposal_offices
  ADD COLUMN IF NOT EXISTS organisation text NOT NULL DEFAULT '';

UPDATE public.building_proposal_offices
SET organisation = 'Brihanmumbai Municipal Corporation,'
WHERE organisation IS NULL OR organisation = '';

COMMENT ON COLUMN public.building_proposal_offices.organisation IS
  'Organisation name line printed between officer designation and physical address on letters.';
