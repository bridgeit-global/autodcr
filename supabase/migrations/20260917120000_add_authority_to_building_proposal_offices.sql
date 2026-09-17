-- Correspondence offices are now selected by planning authority (BMC, SRA, …).
-- Existing rows keep serving every authority via the 'ALL' bucket; an authority
-- with its own rows (e.g. SRA) uses those instead.

ALTER TABLE public.building_proposal_offices
  ADD COLUMN IF NOT EXISTS authority text NOT NULL DEFAULT 'ALL';

UPDATE public.building_proposal_offices
SET authority = 'ALL'
WHERE authority IS NULL OR authority = '';

ALTER TABLE public.building_proposal_offices
  DROP CONSTRAINT IF EXISTS building_proposal_offices_pkey;

ALTER TABLE public.building_proposal_offices
  ADD PRIMARY KEY (correspondence_type, authority, id);

COMMENT ON COLUMN public.building_proposal_offices.authority IS
  'Planning authority the office belongs to: ALL (fallback for every authority), BMC, SRA, MHADA, MMRDA, CIDCO, MIDC.';

COMMENT ON COLUMN public.building_proposal_offices.officer_name IS
  'Addressee designation/name. Supports the {ward} placeholder, replaced with the plot ward code (e.g. "Executive Engineer - {ward} Ward").';

-- SRA has a single office for all wards; the ward code is filled in at letter time.
INSERT INTO public.building_proposal_offices
  (correspondence_type, authority, id, officer_name, organisation, line1, line2, line3)
VALUES
  (
    'building_proposal',
    'SRA',
    'default',
    'Executive Engineer - {ward} Ward',
    '',
    'Slum Rehabilitation Authority, Brihanmumbai,',
    'Administrative Building, Anant Kanekar Marg,',
    'Bandra (E), Mumbai - 400051.'
  )
ON CONFLICT (correspondence_type, authority, id) DO NOTHING;
