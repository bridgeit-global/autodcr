-- Placeholders from Building Permission Part OC HTML
-- (application-part-oc-architect, indemnity-bond-part-oc).
-- Reuse existing master rows for {{WARD}}, {{CTS_CS_NO}}, {{VILLAGE_DIVISION}},
-- {{SITE_ADDRESS}}, {{CHE_REF}}, {{LAST_APPROVED_PLAN_DATE}}, {{CTS_NO}},
-- {{VILLAGE}}, {{M_S_NAME}}. Do not insert VARIABLE_TAGS.

-- ---------------------------------------------------------------------------
-- Catalog: keep the two retained forms; drop the Part OC checklist
-- ---------------------------------------------------------------------------
INSERT INTO public.application_documents
  (id, application_type_id, category, html, sign, letter_variant, sort_order)
VALUES
  ('application_part_oc_architect', 'part_oc',
   'Application for Part OC by Architect/L.S.',
   'application-part-oc-architect.html', ARRAY['architect_or_ls'], NULL, 10),
  ('indemnity_bond_part_oc', 'part_oc',
   'Indemnity Bond for Part OC',
   'indemnity-bond-part-oc.html', ARRAY['owner'], NULL, 20)
ON CONFLICT (id) DO UPDATE SET
  application_type_id = EXCLUDED.application_type_id,
  category = EXCLUDED.category,
  html = EXCLUDED.html,
  sign = EXCLUDED.sign,
  sort_order = EXCLUDED.sort_order,
  is_active = true;

UPDATE public.application_documents
SET is_active = false
WHERE id = 'checklist_documents_part_oc';

-- ---------------------------------------------------------------------------
-- Master placeholders (new tokens only)
-- ---------------------------------------------------------------------------
INSERT INTO public.placeholders
  (id, token, legacy_token, label, source_table, source_column, ui_group)
VALUES
  -- Application for Part OC by Architect/L.S.
  ('from_level', '{{FROM_LEVEL}}', NULL, 'From level / floor', 'computed', NULL, 'other'),
  ('to_level', '{{TO_LEVEL}}', NULL, 'To level / floor', 'computed', NULL, 'other'),

  -- Indemnity Bond for Part OC
  ('reference', '{{REFERENCE}}', NULL, 'Reference', 'computed', NULL, 'reference'),
  ('undersigned_name', '{{UNDERSIGNED_NAME}}', NULL, 'Undersigned name', 'owner_applicant', 'name', 'client'),
  ('office_address', '{{OFFICE_ADDRESS}}', NULL, 'Office address', 'owner_applicant', 'address_line1', 'client'),
  ('mumbai_suffix', '{{MUMBAI_SUFFIX}}', NULL, 'Mumbai (suffix)', 'computed', NULL, 'other'),
  ('no_of_floors', '{{NO_OF_FLOORS}}', NULL, 'Number of floors', 'computed', NULL, 'other'),
  ('wings', '{{WINGS}}', NULL, 'Wings', 'computed', NULL, 'other'),
  ('day', '{{DAY}}', NULL, 'Day', 'computed', 'current_date', 'other'),
  ('month_year', '{{MONTH_YEAR}}', NULL, 'Month / year', 'computed', 'current_date', 'other'),
  ('for_entity', '{{FOR_ENTITY}}', NULL, 'For (entity)', 'owner_applicant', 'entity_name', 'client')
ON CONFLICT (id) DO UPDATE SET
  token = EXCLUDED.token,
  label = EXCLUDED.label,
  source_table = EXCLUDED.source_table,
  source_column = EXCLUDED.source_column,
  ui_group = EXCLUDED.ui_group,
  is_active = true,
  updated_at = now();

-- ---------------------------------------------------------------------------
-- Type-level: letter header / key variables shared across Part OC HTML
-- ---------------------------------------------------------------------------
INSERT INTO public.application_type_placeholders
  (application_type_id, placeholder_id, required, sort_order)
VALUES
  ('part_oc', 'ward', true, 110),
  ('part_oc', 'cts_cs_no', true, 120),
  ('part_oc', 'village_division', true, 130),
  ('part_oc', 'site_address', true, 140),
  ('part_oc', 'cts_no', true, 150),
  ('part_oc', 'village', true, 160),
  ('part_oc', 'che_ref', true, 170),
  ('part_oc', 'last_approved_plan_date', false, 180),
  ('part_oc', 'm_s_name', true, 190)
ON CONFLICT (application_type_id, placeholder_id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Document-level: tokens unique to each Part OC HTML
-- ---------------------------------------------------------------------------
INSERT INTO public.application_document_placeholders
  (document_id, placeholder_id, required, sort_order)
VALUES
  -- application-part-oc-architect.html
  ('application_part_oc_architect', 'from_level', false, 10),
  ('application_part_oc_architect', 'to_level', false, 20),

  -- indemnity-bond-part-oc.html
  ('indemnity_bond_part_oc', 'reference', false, 10),
  ('indemnity_bond_part_oc', 'undersigned_name', false, 20),
  ('indemnity_bond_part_oc', 'office_address', false, 30),
  ('indemnity_bond_part_oc', 'mumbai_suffix', false, 40),
  ('indemnity_bond_part_oc', 'no_of_floors', false, 50),
  ('indemnity_bond_part_oc', 'wings', false, 60),
  ('indemnity_bond_part_oc', 'day', false, 70),
  ('indemnity_bond_part_oc', 'month_year', false, 80),
  ('indemnity_bond_part_oc', 'for_entity', false, 90)
ON CONFLICT (document_id, placeholder_id) DO NOTHING;
