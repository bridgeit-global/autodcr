-- Placeholders from Building Permission IOD HTML
-- (iod-cc-architect-letterhead, report-iod-cc).
-- Reuse existing master rows for {{WARD}}, {{VILLAGE}}, {{DATE}}, {{CTS_NO}},
-- {{OWNER_DEVELOPER}}, {{ZONE}}, {{SITE_ADDRESS}}, open-space REQD/PROP/REMARKS,
-- and other tokens already inserted by Concession / IOD-CC Pending Concession.
-- Do not insert VARIABLE_TAGS.

-- ---------------------------------------------------------------------------
-- Master placeholders (new tokens only)
-- ---------------------------------------------------------------------------
INSERT INTO public.placeholders
  (id, token, legacy_token, label, source_table, source_column, ui_group)
VALUES
  -- Application for IOD/CC on Architect/LS Letterhead
  ('file_no', '{{FILE_NO}}', NULL, 'File number', 'projects', 'project_info->>proposalNo', 'reference'),
  ('your_letter_date', '{{YOUR_LETTER_DATE}}', NULL, 'Your letter date', 'computed', NULL, 'reference'),

  -- Report for IOD/CC
  ('concession_approval_ref_no', '{{CONCESSION_APPROVAL_REF_NO}}', NULL, 'Concession approval reference', 'computed', NULL, 'reference'),
  ('height_of_building', '{{HEIGHT_OF_BUILDING}}', NULL, 'Height of building', 'projects', 'building_details->>height', 'other'),
  ('open_space_approval_ref_no', '{{OPEN_SPACE_APPROVAL_REF_NO}}', NULL, 'Open space approval reference', 'computed', NULL, 'reference'),
  ('open_space_approval_date', '{{OPEN_SPACE_APPROVAL_DATE}}', NULL, 'Open space approval date', 'computed', NULL, 'other'),
  ('open_space_approval_page', '{{OPEN_SPACE_APPROVAL_PAGE}}', NULL, 'Open space approval (page)', 'computed', NULL, 'other'),
  ('parking_provided_nos', '{{PARKING_PROVIDED_NOS}}', NULL, 'Parking provided (nos)', 'computed', NULL, 'other'),
  ('parking_required_nos', '{{PARKING_REQUIRED_NOS}}', NULL, 'Parking required (nos)', 'computed', NULL, 'other'),
  ('basement_count', '{{BASEMENT_COUNT}}', NULL, 'Basement count', 'computed', NULL, 'other'),
  ('stilt_count', '{{STILT_COUNT}}', NULL, 'Stilt count', 'computed', NULL, 'other'),
  ('ground_count', '{{GROUND_COUNT}}', NULL, 'Ground count', 'computed', NULL, 'other'),
  ('office_floor_count', '{{OFFICE_FLOOR_COUNT}}', NULL, 'Office floor count', 'computed', NULL, 'other'),
  ('podium_floor_count', '{{PODIUM_FLOOR_COUNT}}', NULL, 'Podium floor count', 'computed', NULL, 'other'),
  ('podium_count', '{{PODIUM_COUNT}}', NULL, 'Podium count', 'computed', NULL, 'other'),
  ('upper_floor_count', '{{UPPER_FLOOR_COUNT}}', NULL, 'Upper floor count', 'computed', NULL, 'other'),
  ('fees_deposit_page', '{{FEES_DEPOSIT_PAGE}}', NULL, 'Fees / deposit (page)', 'computed', NULL, 'other')
ON CONFLICT (id) DO UPDATE SET
  token = EXCLUDED.token,
  label = EXCLUDED.label,
  source_table = EXCLUDED.source_table,
  source_column = EXCLUDED.source_column,
  ui_group = EXCLUDED.ui_group,
  is_active = true,
  updated_at = now();

INSERT INTO public.placeholders
  (id, token, legacy_token, label, source_table, source_column, ui_group)
SELECT
  lower(seg || '_' || suffix),
  '{{' || seg || '_' || suffix || '}}',
  NULL,
  initcap(replace(lower(seg), '_', ' ')) || ' — ' || suffix_label,
  'computed',
  NULL,
  'other'
FROM (
  VALUES
    ('NORTH_A_B'), ('NORTH_B_C'), ('NORTH_C_D'), ('NORTH_D_E'),
    ('NORTH_F_G'), ('NORTH_G_H'), ('NORTH_H_I'),
    ('WEST_A_R'),
    ('EAST_I_J'), ('EAST_J_K'), ('EAST_K_L'),
    ('SOUTH_L_M'), ('SOUTH_M_N'), ('SOUTH_N_O'), ('SOUTH_O_P'), ('SOUTH_Q_R')
) AS sides(seg)
CROSS JOIN (
  VALUES
    ('DEF_M', 'deficiency (m)'),
    ('DEF_PCT', 'deficiency (%)')
) AS cols(suffix, suffix_label)
ON CONFLICT (id) DO UPDATE SET
  token = EXCLUDED.token,
  label = EXCLUDED.label,
  source_table = EXCLUDED.source_table,
  ui_group = EXCLUDED.ui_group,
  is_active = true,
  updated_at = now();

-- ---------------------------------------------------------------------------
-- Type-level: letter header / key variables shared across IOD HTML
-- ---------------------------------------------------------------------------
INSERT INTO public.application_type_placeholders
  (application_type_id, placeholder_id, required, sort_order)
VALUES
  ('iod', 'date', true, 110),
  ('iod', 'village', true, 120),
  ('iod', 'ward', true, 130),
  ('iod', 'zone', true, 140),
  ('iod', 'cts_no', true, 150),
  ('iod', 'property_no_2', false, 160),
  ('iod', 'location_1', false, 170),
  ('iod', 'site_address', true, 180),
  ('iod', 'pin_code', true, 190),
  ('iod', 'architect', true, 200),
  ('iod', 'owner_developer', true, 210)
ON CONFLICT (application_type_id, placeholder_id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Document-level: tokens unique to each IOD HTML
-- ---------------------------------------------------------------------------
INSERT INTO public.application_document_placeholders
  (document_id, placeholder_id, required, sort_order)
VALUES
  -- iod-cc-architect-letterhead.html
  ('iod_cc_architect_letterhead', 'file_no', false, 10),
  ('iod_cc_architect_letterhead', 'your_letter_date', false, 20),

  -- report-iod-cc.html
  ('report_iod_cc', 'che_no', false, 10),
  ('report_iod_cc', 'bp_zone', false, 20),
  ('report_iod_cc', 'a_suffix', false, 30),
  ('report_iod_cc', 'plan_ref_page', false, 40),
  ('report_iod_cc', 'eebp_zone', false, 50),
  ('report_iod_cc', 'concession_approval_ref_no', false, 60),
  ('report_iod_cc', 'pr_card_page', false, 70),
  ('report_iod_cc', 'pr_card_area', false, 80),
  ('report_iod_cc', 'ca_affidavit_page', false, 90),
  ('report_iod_cc', 'ca_affidavit_area', false, 100),
  ('report_iod_cc', 'arch_cert_page', false, 110),
  ('report_iod_cc', 'arch_cert_area', false, 120),
  ('report_iod_cc', 'performa_a_page', false, 130),
  ('report_iod_cc', 'performa_a_area', false, 140),
  ('report_iod_cc', 'triangulation_page', false, 150),
  ('report_iod_cc', 'triangulation_area', false, 160),
  ('report_iod_cc', 'accepted_area_page', false, 170),
  ('report_iod_cc', 'accepted_area', false, 180),
  ('report_iod_cc', 'total_permissible_fsi', false, 190),
  ('report_iod_cc', 'total_area_approvable', false, 200),
  ('report_iod_cc', 'total_area_approved', false, 210),
  ('report_iod_cc', 'balance_approvable_area', false, 220),
  ('report_iod_cc', 'area_proposed_iod_plinth_cc', false, 230),
  ('report_iod_cc', 'payments_payable_page', false, 240),
  ('report_iod_cc', 'payments_paid_page', false, 250),
  ('report_iod_cc', 'height_of_building', false, 260),
  ('report_iod_cc', 'open_space_approval_ref_no', false, 270),
  ('report_iod_cc', 'open_space_approval_date', false, 280),
  ('report_iod_cc', 'open_space_approval_page', false, 290),
  ('report_iod_cc', 'parking_provided_nos', false, 300),
  ('report_iod_cc', 'parking_required_nos', false, 310),
  ('report_iod_cc', 'basement_count', false, 320),
  ('report_iod_cc', 'stilt_count', false, 330),
  ('report_iod_cc', 'ground_count', false, 340),
  ('report_iod_cc', 'office_floor_count', false, 350),
  ('report_iod_cc', 'podium_floor_count', false, 360),
  ('report_iod_cc', 'podium_count', false, 370),
  ('report_iod_cc', 'upper_floor_count', false, 380),
  ('report_iod_cc', 'fees_deposit_page', false, 390),
  ('report_iod_cc', 'iod_plinth_cc_page', false, 400),
  ('report_iod_cc', 'draft_plan_page', false, 410),
  ('report_iod_cc', 'sebp_ward', false, 420),
  ('report_iod_cc', 'aebp_ward', false, 430),
  ('report_iod_cc', 'eebp_zone_2', false, 440),
  ('report_iod_cc', 'eebp_ward_2', false, 450)
ON CONFLICT (document_id, placeholder_id) DO NOTHING;

INSERT INTO public.application_document_placeholders
  (document_id, placeholder_id, required, sort_order)
SELECT
  'report_iod_cc',
  p.id,
  false,
  460 + 10 * ROW_NUMBER() OVER (ORDER BY p.id)
FROM public.placeholders p
WHERE p.id LIKE 'north_%'
   OR p.id LIKE 'west_a_r_%'
   OR p.id LIKE 'east_%'
   OR p.id LIKE 'south_%'
ON CONFLICT (document_id, placeholder_id) DO NOTHING;
