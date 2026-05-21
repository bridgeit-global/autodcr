-- Reference data: Building Proposal office addresses by region/ward rules (preview letters).

CREATE TABLE IF NOT EXISTS public.building_proposal_offices (
  id text PRIMARY KEY,
  officer_name text NOT NULL,
  line1 text NOT NULL,
  line2 text NOT NULL,
  line3 text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.building_proposal_offices IS
  'BMC Building Proposal office blocks for application preview (city, western I/II, eastern, special cell).';

INSERT INTO public.building_proposal_offices (id, officer_name, line1, line2, line3)
VALUES
  (
    'city',
    'SHRI. VIJAY TAWDE',
    'Dy. Chief Engineer (Building Proposal) - City, New Municipal Building',
    'C.S. No. 355 / B, Bhagwan Walmiki Chowk, Vidyalankar Marg',
    'Opp. Hanuman Mandir, Antop Hill, Wadala (East), Mumbai - 400 037'
  ),
  (
    'western_i',
    'SHRI. BAJIRAO PATIL',
    'Hinduhrudaysamrat Balasaheb Thackeray Market',
    '6th to 9th Floor, New Majas Market,Poonam Nagar',
    'Opp. J. V. Link Road, Jogeshwari (East), Mumbai - 400 093'
  ),
  (
    'western_ii',
    'SHRI. CHANDRAKANT CHAUDHARI',
    'Dy. Chief Engineer, Building Proposals (W. S. - II) 1st Floor',
    'C Wing, Municipal Building, Near Sanskruti Complex',
    '90 Feet D. P. Road,Kandivali (East), Mumbai- 400 101'
  ),
  (
    'eastern',
    'SHRI. MEHUL PAINTER',
    'Near Raj Legacy (Residential Complex),',
    'Paper Mill Compound,L. B. S. Marg,',
    'Vikhroli (West), Mumbai - 400 083'
  ),
  (
    'special_cell',
    'SHRI. RAJENDRA JADHAV',
    'Dy. Chief Engineer (Building Proposal), Special Cell',
    'Ground Floor, Municipal Training Center,Raheja Vihar Complex',
    'Chandivali Farm Road, Powai, Andheri (East), Mumbai - 400 072'
  )
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.building_proposal_offices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS building_proposal_offices_select ON public.building_proposal_offices;
CREATE POLICY building_proposal_offices_select ON public.building_proposal_offices
  FOR SELECT
  TO authenticated
  USING (true);

GRANT SELECT ON public.building_proposal_offices TO authenticated;
