-- Garden (Tree) — Tree NOC for OCC: type, documents, placeholders, links.
-- No TypeScript changes. Reuse existing plot/village/ward/site/ms tokens.

-- ---------------------------------------------------------------------------
-- Application type
-- ---------------------------------------------------------------------------
INSERT INTO public.application_types
  (slug, department, application_title, description, category,
   applicant_type, planning_authorities, requires_roster_match,
   sort_order, icon_key, is_active)
VALUES
  (
    'tree_noc_for_occ',
    'Garden (Tree)',
    'Tree NOC for OCC',
    'Application for Tree Authority NOC / clearance for OCC/BCC',
    'department_permission',
    NULL,
    '{}'::text[],
    false,
    20,
    'tree',
    true
  )
ON CONFLICT (slug) DO UPDATE SET
  department = EXCLUDED.department,
  application_title = EXCLUDED.application_title,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  sort_order = EXCLUDED.sort_order,
  icon_key = EXCLUDED.icon_key,
  is_active = true,
  updated_at = now();

-- ---------------------------------------------------------------------------
-- Documents
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
  v.letterhead_source,
  v.sort_order,
  true
FROM public.application_types t
CROSS JOIN (
  VALUES
    (
      'application_for_noc_for_occ',
      'Application for NOC for OCC',
      'DraftDesk_Tree_NOC_for_OCC/11A_application_for_noc_for_occ_VERBATIM.html',
      ARRAY['architect_or_ls']::text[],
      'architect_or_ls',
      10
    ),
    (
      'compliance_report_owner_occupier',
      'Compliance Report by Owner/Occupier (Sec 8/9/10)',
      'DraftDesk_Tree_NOC_for_OCC/11B_compliance_report_owner_occupier_VERBATIM.html',
      ARRAY['owner']::text[],
      'owner',
      20
    )
) AS v(slug, category, html, sign, letterhead_source, sort_order)
WHERE t.slug = 'tree_noc_for_occ'
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
-- New master placeholders (NOC-only / manual)
-- ---------------------------------------------------------------------------
INSERT INTO public.placeholders
  (id, token, legacy_token, label, source_table, source_column, ui_group)
VALUES
  ('oc_bcc_of', '{{OC_BCC_OF}}', NULL, 'OC/BCC of', 'computed', NULL, 'subject'),
  ('tree_remarks_letter_no', '{{TREE_REMARKS_LETTER_NO}}', NULL, 'Tree remarks letter no.', 'computed', NULL, 'reference'),
  ('tree_remarks_date', '{{TREE_REMARKS_DATE}}', NULL, 'Tree remarks date', 'computed', NULL, 'reference'),
  ('trees_retained', '{{TREES_RETAINED}}', NULL, 'Trees retained', 'computed', NULL, 'other'),
  ('new_trees_planted', '{{NEW_TREES_PLANTED}}', NULL, 'New trees planted', 'computed', NULL, 'other'),
  ('order_date', '{{ORDER_DATE}}', NULL, 'Date of order of Tree Officer', 'computed', NULL, 'other'),
  ('trees_required_as_per_spec', '{{TREES_REQUIRED_AS_PER_SPEC}}', NULL,
   'Trees required as per specifications', 'computed', NULL, 'other'),
  ('existing_trees', '{{EXISTING_TREES}}', NULL, 'Number of existing trees', 'computed', NULL, 'other'),
  ('trees_required_to_be_planted', '{{TREES_REQUIRED_TO_BE_PLANTED}}', NULL,
   'Trees required to be planted', 'computed', NULL, 'other'),
  ('place_of_plantation', '{{PLACE_OF_PLANTATION}}', NULL, 'Place of plantation', 'computed', NULL, 'other'),
  ('compliance_6', '{{COMPLIANCE_6}}', NULL, 'Compliance by owner (6)', 'computed', NULL, 'other'),
  ('compliance_7', '{{COMPLIANCE_7}}', NULL, 'Compliance by owner (7)', 'computed', NULL, 'other'),
  ('compliance_8', '{{COMPLIANCE_8}}', NULL, 'Compliance by owner (8)', 'computed', NULL, 'other'),
  ('compliance_9', '{{COMPLIANCE_9}}', NULL, 'Compliance by owner (9)', 'computed', NULL, 'other'),
  ('date_of_compliance', '{{DATE_OF_COMPLIANCE}}', NULL, 'Date of compliance', 'computed', NULL, 'other'),
  ('remarks', '{{REMARKS}}', NULL, 'Remarks', 'computed', NULL, 'other')
ON CONFLICT (id) DO UPDATE SET
  token = EXCLUDED.token,
  label = EXCLUDED.label,
  source_table = EXCLUDED.source_table,
  source_column = EXCLUDED.source_column,
  ui_group = EXCLUDED.ui_group,
  is_active = true,
  updated_at = now();

-- ---------------------------------------------------------------------------
-- Type-level shared fields
-- ---------------------------------------------------------------------------
INSERT INTO public.application_type_placeholders
  (application_type_id, placeholder_id, required, sort_order)
SELECT t.id, v.placeholder_id, v.required, v.sort_order
FROM public.application_types t
CROSS JOIN (
  VALUES
    ('plot_cs_cts_no', true, 10),
    ('village_division', true, 20),
    ('street_road', false, 30),
    ('site_address', true, 40),
    ('ms_name', false, 50),
    ('ward_no', true, 60),
    ('trees_to_cut', false, 70),
    ('trees_to_transplant', false, 80)
) AS v(placeholder_id, required, sort_order)
WHERE t.slug = 'tree_noc_for_occ'
ON CONFLICT (application_type_id, placeholder_id) DO UPDATE SET
  required = EXCLUDED.required,
  sort_order = EXCLUDED.sort_order;

-- ---------------------------------------------------------------------------
-- Document-level: 11A
-- ---------------------------------------------------------------------------
INSERT INTO public.application_document_placeholders
  (document_id, placeholder_id, required, sort_order)
SELECT d.id, v.placeholder_id, v.required, v.sort_order
FROM public.application_documents d
CROSS JOIN (
  VALUES
    ('oc_bcc_of', true, 10),
    ('plot_cs_cts_no', true, 20),
    ('village_division', true, 30),
    ('street_road', false, 40),
    ('site_address', true, 50),
    ('tree_remarks_letter_no', true, 60),
    ('tree_remarks_date', true, 70),
    ('trees_to_cut', true, 80),
    ('trees_to_transplant', true, 90),
    ('trees_retained', true, 100),
    ('new_trees_planted', true, 110),
    ('ms_name', false, 120)
) AS v(placeholder_id, required, sort_order)
WHERE d.slug = 'application_for_noc_for_occ'
ON CONFLICT (document_id, placeholder_id) DO UPDATE SET
  required = EXCLUDED.required,
  sort_order = EXCLUDED.sort_order;

-- ---------------------------------------------------------------------------
-- Document-level: 11B
-- ---------------------------------------------------------------------------
INSERT INTO public.application_document_placeholders
  (document_id, placeholder_id, required, sort_order)
SELECT d.id, v.placeholder_id, v.required, v.sort_order
FROM public.application_documents d
CROSS JOIN (
  VALUES
    ('order_date', true, 10),
    ('trees_required_as_per_spec', true, 20),
    ('existing_trees', true, 30),
    ('trees_required_to_be_planted', true, 40),
    ('place_of_plantation', true, 50),
    ('compliance_6', false, 60),
    ('compliance_7', false, 70),
    ('compliance_8', false, 80),
    ('compliance_9', false, 90),
    ('date_of_compliance', false, 100),
    ('remarks', false, 110),
    ('plot_cs_cts_no', true, 120),
    ('site_address', true, 130),
    ('ward_no', true, 140)
) AS v(placeholder_id, required, sort_order)
WHERE d.slug = 'compliance_report_owner_occupier'
ON CONFLICT (document_id, placeholder_id) DO UPDATE SET
  required = EXCLUDED.required,
  sort_order = EXCLUDED.sort_order;
