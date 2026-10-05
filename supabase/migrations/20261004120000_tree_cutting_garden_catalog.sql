-- Garden (Tree) / Tree Cutting Application: documents + field mappings.
-- Type slug tree_cutting_application already exists. No TS changes.
-- Reuse master placeholders where tokens match; add aliases / computed for the rest.
-- Do not insert VARIABLE_TAGS.

-- ---------------------------------------------------------------------------
-- Documents (folder-relative html under Application_Templates / html/)
-- ---------------------------------------------------------------------------
INSERT INTO public.application_documents
  (slug, application_type_id, category, html, sign, letter_variant,
   show_letterhead, show_qrcode, letterhead_source, sort_order, is_active)
SELECT
  v.slug,
  t.id,
  v.category,
  v.html,
  v.sign,
  NULL,
  false,
  false,
  'owner',
  v.sort_order,
  true
FROM public.application_types t
CROSS JOIN (
  VALUES
    (
      'application_for_tree_cutting',
      'Application for Tree Cutting / Transplantation',
      'DraftDesk_Tree_Cutting/05_application_for_tree_cutting_VERBATIM.html',
      ARRAY['owner']::text[],
      10
    ),
    (
      'comprehensive_undertaking_tree_cutting',
      'Comprehensive Undertaking – Tree Cutting & Transplanting',
      'DraftDesk_Tree_Cutting/08_comprehensive_undertaking_tree_cutting_transplanting_VERBATIM.html',
      ARRAY['owner']::text[],
      20
    )
) AS v(slug, category, html, sign, sort_order)
WHERE t.slug = 'tree_cutting_application'
ON CONFLICT (slug) DO UPDATE SET
  application_type_id = EXCLUDED.application_type_id,
  category = EXCLUDED.category,
  html = EXCLUDED.html,
  sign = EXCLUDED.sign,
  letter_variant = EXCLUDED.letter_variant,
  show_letterhead = EXCLUDED.show_letterhead,
  show_qrcode = EXCLUDED.show_qrcode,
  letterhead_source = EXCLUDED.letterhead_source,
  sort_order = EXCLUDED.sort_order,
  is_active = true;

-- ---------------------------------------------------------------------------
-- Master placeholders (new tokens only)
-- ---------------------------------------------------------------------------
INSERT INTO public.placeholders
  (id, token, legacy_token, label, source_table, source_column, ui_group)
VALUES
  -- Auto aliases (HTML spelling)
  ('ward_no', '{{WARD_NO}}', NULL, 'Ward no.', 'projects', 'save_plot_details->>ward', 'subject'),
  ('ms_name', '{{MS_NAME}}', NULL, 'M/s. name', 'owner_applicant', 'entity_name', 'client'),
  ('applicant_name', '{{APPLICANT_NAME}}', NULL, 'Applicant name', 'owner_applicant', 'name', 'client'),
  ('city_survey_survey_no', '{{CITY_SURVEY_SURVEY_NO}}', NULL, 'City Survey / Survey No.',
   'projects', 'save_plot_details->>proposedCtsNumber', 'subject'),

  -- Manual / undefined (Letter fields)
  ('proposed_work', '{{PROPOSED_WORK}}', NULL, 'Proposed work', 'computed', NULL, 'other'),
  ('sr_no', '{{SR_NO}}', NULL, 'Sr. No.', 'computed', NULL, 'other'),
  ('existing_no_of_trees', '{{EXISTING_NO_OF_TREES}}', NULL, 'Existing no. of trees', 'computed', NULL, 'other'),
  ('no_of_trees_cut_transplanted', '{{NO_OF_TREES_CUT_TRANSPLANTED}}', NULL,
   'Trees to be cut / transplanted', 'computed', NULL, 'other'),
  ('balance_trees_retained', '{{BALANCE_TREES_RETAINED}}', NULL, 'Balance trees retained', 'computed', NULL, 'other'),
  ('reasons_for_cutting', '{{REASONS_FOR_CUTTING}}', NULL, 'Reasons for cutting', 'computed', NULL, 'other'),
  ('trees_to_plant_transplant_maintain', '{{TREES_TO_PLANT_TRANSPLANT_MAINTAIN}}', NULL,
   'Trees to plant / transplant / maintain', 'computed', NULL, 'other'),
  ('proposed_development', '{{PROPOSED_DEVELOPMENT}}', NULL, 'Proposed development', 'computed', NULL, 'other'),
  ('total_existing_trees', '{{TOTAL_EXISTING_TREES}}', NULL, 'Total existing trees', 'computed', NULL, 'other'),
  ('rg_area_sqm', '{{RG_AREA_SQM}}', NULL, 'R.G. area (sq.m)', 'computed', NULL, 'other'),
  ('trees_to_transplant', '{{TREES_TO_TRANSPLANT}}', NULL, 'Trees to transplant', 'computed', NULL, 'other'),
  ('trees_to_cut', '{{TREES_TO_CUT}}', NULL, 'Trees to cut', 'computed', NULL, 'other'),
  ('trees_in_lieu_of_cutting', '{{TREES_IN_LIEU_OF_CUTTING}}', NULL,
   'Trees in lieu of cutting', 'computed', NULL, 'other'),
  ('trees_required_as_per_norms', '{{TREES_REQUIRED_AS_PER_NORMS}}', NULL,
   'Trees required as per norms', 'computed', NULL, 'other'),
  ('area_available_for_plantation_sqm', '{{AREA_AVAILABLE_FOR_PLANTATION_SQM}}', NULL,
   'Area available for plantation (sq.m)', 'computed', NULL, 'other'),
  ('compensatory_plantation_location', '{{COMPENSATORY_PLANTATION_LOCATION}}', NULL,
   'Compensatory plantation location', 'computed', NULL, 'other'),
  ('owner_developer_signature', '{{OWNER_DEVELOPER_SIGNATURE}}', NULL,
   'Owner / Developer signature', 'computed', NULL, 'other')
ON CONFLICT (id) DO UPDATE SET
  token = EXCLUDED.token,
  label = EXCLUDED.label,
  source_table = EXCLUDED.source_table,
  source_column = EXCLUDED.source_column,
  ui_group = EXCLUDED.ui_group,
  is_active = true,
  updated_at = now();

-- ---------------------------------------------------------------------------
-- Type-level: shared project / owner fields
-- ---------------------------------------------------------------------------
INSERT INTO public.application_type_placeholders
  (application_type_id, placeholder_id, required, sort_order)
SELECT t.id, v.placeholder_id, v.required, v.sort_order
FROM public.application_types t
CROSS JOIN (
  VALUES
    ('ward_no', true, 10),
    ('city_survey_survey_no', true, 20),
    ('plot_cs_cts_no', true, 25),
    ('cts_no', true, 30),
    ('village', true, 40),
    ('site_address', true, 50),
    ('applicant_name', true, 60),
    ('owner_ca_name', true, 70),
    ('ms_name', false, 80),
    ('office_address', true, 90),
    ('pin_suffix', false, 100),
    ('plot_area_sqm', true, 110),
    ('date', true, 120)
) AS v(placeholder_id, required, sort_order)
WHERE t.slug = 'tree_cutting_application'
ON CONFLICT (application_type_id, placeholder_id) DO UPDATE SET
  required = EXCLUDED.required,
  sort_order = EXCLUDED.sort_order;

-- ---------------------------------------------------------------------------
-- Document-level: Form 5 – Application for Tree Cutting
-- ---------------------------------------------------------------------------
INSERT INTO public.application_document_placeholders
  (document_id, placeholder_id, required, sort_order)
SELECT d.id, v.placeholder_id, v.required, v.sort_order
FROM public.application_documents d
CROSS JOIN (
  VALUES
    ('proposed_work', true, 10),
    ('applicant_name', true, 20),
    ('plot_cs_cts_no', true, 30),
    ('ward_no', true, 40),
    ('sr_no', false, 50),
    ('existing_no_of_trees', true, 60),
    ('no_of_trees_cut_transplanted', true, 70),
    ('balance_trees_retained', true, 80),
    ('reasons_for_cutting', true, 90),
    ('trees_to_plant_transplant_maintain', true, 100)
) AS v(placeholder_id, required, sort_order)
WHERE d.slug = 'application_for_tree_cutting'
ON CONFLICT (document_id, placeholder_id) DO UPDATE SET
  required = EXCLUDED.required,
  sort_order = EXCLUDED.sort_order;

-- ---------------------------------------------------------------------------
-- Document-level: Form 8 – Comprehensive Undertaking
-- ---------------------------------------------------------------------------
INSERT INTO public.application_document_placeholders
  (document_id, placeholder_id, required, sort_order)
SELECT d.id, v.placeholder_id, v.required, v.sort_order
FROM public.application_documents d
CROSS JOIN (
  VALUES
    ('proposed_development', true, 10),
    ('plot_cs_cts_no', true, 20),
    ('village', true, 30),
    ('site_address', true, 40),
    ('owner_ca_name', true, 50),
    ('ms_name', false, 60),
    ('office_address', true, 70),
    ('pin_suffix', false, 80),
    ('plot_area_sqm', true, 90),
    ('total_existing_trees', true, 100),
    ('rg_area_sqm', true, 110),
    ('trees_to_transplant', true, 120),
    ('trees_to_cut', true, 130),
    ('trees_in_lieu_of_cutting', true, 140),
    ('trees_required_as_per_norms', true, 150),
    ('area_available_for_plantation_sqm', true, 160),
    ('compensatory_plantation_location', false, 170),
    ('owner_developer_signature', false, 180),
    ('date', true, 190)
) AS v(placeholder_id, required, sort_order)
WHERE d.slug = 'comprehensive_undertaking_tree_cutting'
ON CONFLICT (document_id, placeholder_id) DO UPDATE SET
  required = EXCLUDED.required,
  sort_order = EXCLUDED.sort_order;
