-- Rebalance fire_consultant address lines for even horizontal width on letters.
-- Display mapping: officer_name | line1 | line2 | line3 (one line each).

UPDATE public.building_proposal_offices
SET
  line1 = 'Mumbai Fire Brigade, Byculla Command Centre,',
  line2 = '2nd Floor, Bapurao Jagtap Marg,',
  line3 = 'Byculla (West), Mumbai – 400008.',
  updated_at = now()
WHERE correspondence_type = 'fire_consultant' AND id = 'rcc_i';

UPDATE public.building_proposal_offices
SET
  line1 = 'Mumbai Fire Brigade, Wadala Command Centre,',
  line2 = '1st Floor, Shaikh Mistry Darga Road, CGS Colony,',
  line3 = 'Antop Hill, Wadala (West), Mumbai – 400037.',
  updated_at = now()
WHERE correspondence_type = 'fire_consultant' AND id = 'rcc_ii';

UPDATE public.building_proposal_offices
SET
  line1 = 'Mumbai Fire Brigade, Marol Command Centre,',
  line2 = '1st Floor, M.V. Road, Agnishaman Dal Road,',
  line3 = 'Marol, Andheri (East), Mumbai – 400059.',
  updated_at = now()
WHERE correspondence_type = 'fire_consultant' AND id = 'rcc_iii';

UPDATE public.building_proposal_offices
SET
  line1 = 'Mumbai Fire Brigade, Borivali Command Centre,',
  line2 = '1st Floor, Opp. Don Bosco High School, L.T. Road,',
  line3 = 'Borivali (West), Mumbai – 400091.',
  updated_at = now()
WHERE correspondence_type = 'fire_consultant' AND id = 'rcc_iv';

UPDATE public.building_proposal_offices
SET
  line1 = 'Mumbai Fire Brigade, Mankhurd Command Centre,',
  line2 = '2nd Floor, Ghatkopar–Mankhurd Link Road, Opp. Sathenagar,',
  line3 = 'Mankhurd, Mumbai – 400043.',
  updated_at = now()
WHERE correspondence_type = 'fire_consultant' AND id = 'rcc_v';

UPDATE public.building_proposal_offices
SET
  line1 = 'Mumbai Fire Brigade, Vikhroli Command Centre,',
  line2 = '1st Floor, L.B.S. Road, Park Site,',
  line3 = 'Vikhroli (West), Mumbai – 400079.',
  updated_at = now()
WHERE correspondence_type = 'fire_consultant' AND id = 'rcc_vi';
