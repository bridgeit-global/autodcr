-- One offices table for all correspondence types (building_proposal, fire_consultant, …).

ALTER TABLE public.building_proposal_offices
  ADD COLUMN IF NOT EXISTS correspondence_type text NOT NULL DEFAULT 'building_proposal';

UPDATE public.building_proposal_offices
SET correspondence_type = 'building_proposal'
WHERE correspondence_type IS NULL OR correspondence_type = '';

ALTER TABLE public.building_proposal_offices
  DROP CONSTRAINT IF EXISTS building_proposal_offices_pkey;

ALTER TABLE public.building_proposal_offices
  ADD PRIMARY KEY (correspondence_type, id);

COMMENT ON COLUMN public.building_proposal_offices.correspondence_type IS
  'Letter routing profile: building_proposal, fire_consultant, etc.';

COMMENT ON TABLE public.building_proposal_offices IS
  'Correspondence office blocks for application preview letters (BP, fire consultant RCC, …).';

INSERT INTO public.building_proposal_offices (correspondence_type, id, officer_name, line1, line2, line3)
VALUES
  (
    'fire_consultant',
    'rcc_i',
    'The Dy. Chief Fire Officer (Region-I)',
    'Mumbai Fire Brigade, Byculla Command Centre,',
    '2nd Floor, Bapurao Jagtap Marg,',
    'Byculla (West), Mumbai – 400008.'
  ),
  (
    'fire_consultant',
    'rcc_ii',
    'The Dy. Chief Fire Officer (Region-II)',
    'Mumbai Fire Brigade, Wadala Command Centre,',
    '1st Floor, Shaikh Mistry Darga Road, CGS Colony,',
    'Antop Hill, Wadala (West), Mumbai – 400037.'
  ),
  (
    'fire_consultant',
    'rcc_iii',
    'The Dy. Chief Fire Officer (Region-III)',
    'Mumbai Fire Brigade, Marol Command Centre,',
    '1st Floor, M.V. Road, Agnishaman Dal Road,',
    'Marol, Andheri (East), Mumbai – 400059.'
  ),
  (
    'fire_consultant',
    'rcc_iv',
    'The Dy. Chief Fire Officer (Region-IV)',
    'Mumbai Fire Brigade, Borivali Command Centre,',
    '1st Floor, Opp. Don Bosco High School, L.T. Road,',
    'Borivali (West), Mumbai – 400091.'
  ),
  (
    'fire_consultant',
    'rcc_v',
    'The Dy. Chief Fire Officer (Region-V)',
    'Mumbai Fire Brigade, Mankhurd Command Centre,',
    '2nd Floor, Ghatkopar–Mankhurd Link Road, Opp. Sathenagar,',
    'Mankhurd, Mumbai – 400043.'
  ),
  (
    'fire_consultant',
    'rcc_vi',
    'The Dy. Chief Fire Officer (Region-VI)',
    'Mumbai Fire Brigade, Vikhroli Command Centre,',
    '1st Floor, L.B.S. Road, Park Site,',
    'Vikhroli (West), Mumbai – 400079.'
  )
ON CONFLICT (correspondence_type, id) DO NOTHING;
