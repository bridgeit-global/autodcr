-- Name of Consultants tokens: resolve from project applicant_details by role
-- (see resolveCatalogPlaceholderValue consultant placeholder map).
-- Tokens live in data-sheet-scrutiny-concession.html (also linked on fact_sheet historically).

UPDATE public.placeholders
SET source_table = 'applicants', source_column = 'name', updated_at = now()
WHERE id IN (
  'structural_engineer',
  'site_supervisor',
  'licensed_plumber',
  'ph_consultant',
  'me_consultant',
  'road_construction_consultant',
  'fire_safety_consultant',
  'traffic_parking_consultant',
  'horticulturist'
);

-- Link consultant name tokens to the data-sheet document that actually contains them.
INSERT INTO public.application_document_placeholders
  (document_id, placeholder_id, required, sort_order)
SELECT d.id, v.placeholder_id, false, v.sort_order
FROM public.application_documents d
CROSS JOIN (
  VALUES
    ('structural_engineer', 10),
    ('site_supervisor', 20),
    ('licensed_plumber', 30),
    ('ph_consultant', 40),
    ('me_consultant', 50),
    ('road_construction_consultant', 60),
    ('fire_safety_consultant', 70),
    ('traffic_parking_consultant', 80),
    ('horticulturist', 90),
    ('any_other_consultant', 100),
    ('plans_for_approval_page', 110)
) AS v(placeholder_id, sort_order)
WHERE d.slug = 'data_sheet_scrutiny_concession'
   OR d.html = 'data-sheet-scrutiny-concession.html'
ON CONFLICT (document_id, placeholder_id) DO UPDATE SET
  sort_order = EXCLUDED.sort_order,
  required = EXCLUDED.required;
