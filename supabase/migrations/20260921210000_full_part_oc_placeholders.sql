-- Placeholders from Building Permission Full OC/BCC HTML
-- (application-full-oc-bcc, report-documents-full-oc-bcc,
--  report-compliance-iod-conditions-d-form).
-- Reuse existing master rows for {{WARD}}, {{CTS_CS_NO}}, {{VILLAGE_DIVISION}},
-- {{SITE_ADDRESS}}, {{FILE_NO}}, {{ARCHITECT}}, {{CC_REVALIDATED_UPTO}}.
-- Do not insert VARIABLE_TAGS.

-- ---------------------------------------------------------------------------
-- Catalog: keep the three retained forms (OC/BCC letter is not in this bundle)
-- ---------------------------------------------------------------------------
INSERT INTO public.application_documents
  (id, application_type_id, category, html, sign, letter_variant, sort_order)
VALUES
  ('application_full_oc_bcc', 'full_part_oc',
   'Application for OC/BCC by Architect/L.S.',
   'application-full-oc-bcc.html', ARRAY['architect_or_ls'], NULL, 10),
  ('report_documents_full_oc_bcc', 'full_part_oc',
   'Report of Documents for OC-BCC',
   'report-documents-full-oc-bcc.html', ARRAY['architect_or_ls'], NULL, 20),
  ('report_compliance_iod_conditions_d_form', 'full_part_oc',
   'Report of Compliance of IOD Conditions D Form',
   'report-compliance-iod-conditions-d-form.html', ARRAY['architect_or_ls'], NULL, 30)
ON CONFLICT (id) DO UPDATE SET
  application_type_id = EXCLUDED.application_type_id,
  category = EXCLUDED.category,
  html = EXCLUDED.html,
  sign = EXCLUDED.sign,
  sort_order = EXCLUDED.sort_order,
  is_active = true;

-- ---------------------------------------------------------------------------
-- Master placeholders (new tokens only)
-- ---------------------------------------------------------------------------
INSERT INTO public.placeholders
  (id, token, legacy_token, label, source_table, source_column, ui_group)
VALUES
  -- Application for OC/BCC by Architect/L.S.
  ('che_ref', '{{CHE_REF}}', NULL, 'Ch.E. reference', 'computed', NULL, 'reference'),
  ('building_level_1', '{{BUILDING_LEVEL_1}}', NULL, 'Building level 1', 'computed', NULL, 'other'),
  ('building_level_2', '{{BUILDING_LEVEL_2}}', NULL, 'Building level 2', 'computed', NULL, 'other'),
  ('upper_floors', '{{UPPER_FLOORS}}', NULL, 'Upper floors', 'computed', NULL, 'other'),
  ('last_approved_plan_date', '{{LAST_APPROVED_PLAN_DATE}}', NULL, 'Last approved plan date', 'computed', NULL, 'other'),

  -- Report of Documents for OC-BCC (header also used on D Form)
  ('cs_cts_no', '{{CS_CTS_NO}}', NULL, 'C.S. / C.T.S. number', 'projects', 'save_plot_details->>proposedCtsNumber', 'subject'),
  ('division_village', '{{DIVISION_VILLAGE}}', NULL, 'Division / village', 'projects', 'save_plot_details->>villageName', 'subject'),
  ('road_name', '{{ROAD_NAME}}', NULL, 'Road name', 'projects', 'save_plot_details->>roadName', 'subject'),
  ('locality', '{{LOCALITY}}', NULL, 'Locality', 'projects', 'project_info->>landmark', 'subject'),
  ('item_21_1', '{{ITEM_21_1}}', NULL, 'Item 21 — 1', 'computed', NULL, 'other'),
  ('item_21_2', '{{ITEM_21_2}}', NULL, 'Item 21 — 2', 'computed', NULL, 'other'),
  ('approved_building_comprising', '{{APPROVED_BUILDING_COMPRISING}}', NULL, 'Approved building comprising', 'computed', NULL, 'other'),
  ('approved_plot_bearing', '{{APPROVED_PLOT_BEARING}}', NULL, 'Approved plot bearing', 'projects', 'save_plot_details->>proposedCtsNumber', 'subject'),

  -- Report of Compliance of IOD Conditions D Form
  ('subject_continuation', '{{SUBJECT_CONTINUATION}}', NULL, 'Subject continuation', 'computed', NULL, 'subject'),
  ('completion_plans_pg', '{{COMPLETION_PLANS_PG}}', NULL, 'Completion plans (page)', 'computed', NULL, 'other'),
  ('last_approved_plan_pg', '{{LAST_APPROVED_PLAN_PG}}', NULL, 'Last approved plan (page)', 'computed', NULL, 'other'),
  ('iod_plinth_cc_pg', '{{IOD_PLINTH_CC_PG}}', NULL, 'IOD / plinth CC (page)', 'computed', NULL, 'other'),
  ('further_cc_pg', '{{FURTHER_CC_PG}}', NULL, 'Further CC (page)', 'computed', NULL, 'other'),
  ('cc_revalidated_pg', '{{CC_REVALIDATED_PG}}', NULL, 'C.C. revalidated (page)', 'computed', NULL, 'other'),
  ('bcc_pg', '{{BCC_PG}}', NULL, 'B.C.C. (page)', 'computed', NULL, 'other'),
  ('bcc_refusal_pg', '{{BCC_REFUSAL_PG}}', NULL, 'B.C.C. refusal (page)', 'computed', NULL, 'other'),
  ('dcc_pg', '{{DCC_PG}}', NULL, 'D.C.C. (page)', 'computed', NULL, 'other'),
  ('layout_file_pg', '{{LAYOUT_FILE_PG}}', NULL, 'Layout file (page)', 'computed', NULL, 'other'),
  ('b_form_i_pg', '{{B_FORM_I_PG}}', NULL, 'B Form I (page)', 'computed', NULL, 'other'),
  ('start_work_pg_from', '{{START_WORK_PG_FROM}}', NULL, 'Start work (page from)', 'computed', NULL, 'other'),
  ('start_work_pg_to', '{{START_WORK_PG_TO}}', NULL, 'Start work (page to)', 'computed', NULL, 'other'),
  ('further_cc_compliance_pg_from', '{{FURTHER_CC_COMPLIANCE_PG_FROM}}', NULL, 'Further CC compliance (page from)', 'computed', NULL, 'other'),
  ('further_cc_compliance_pg_to', '{{FURTHER_CC_COMPLIANCE_PG_TO}}', NULL, 'Further CC compliance (page to)', 'computed', NULL, 'other'),
  ('mhada_noc_pg', '{{MHADA_NOC_PG}}', NULL, 'MHADA NOC (page)', 'computed', NULL, 'other'),
  ('consultants_noc_pg', '{{CONSULTANTS_NOC_PG}}', NULL, 'Consultants NOC (page)', 'computed', NULL, 'other'),
  ('aac_noc_pg', '{{AAC_NOC_PG}}', NULL, 'AA&C NOC (page)', 'computed', NULL, 'other'),
  ('structural_stability_pg', '{{STRUCTURAL_STABILITY_PG}}', NULL, 'Structural stability (page)', 'computed', NULL, 'other'),
  ('site_supervisor_cert_pg', '{{SITE_SUPERVISOR_CERT_PG}}', NULL, 'Site supervisor certificate (page)', 'computed', NULL, 'other'),
  ('nr_users_mhada_pg', '{{NR_USERS_MHADA_PG}}', NULL, 'N.R. users MHADA (page)', 'computed', NULL, 'other'),
  ('regd_ut_prc_pg', '{{REGD_UT_PRC_PG}}', NULL, 'Registered U.T. / P.R.C. (page)', 'computed', NULL, 'other'),
  ('pr_card_society_pg', '{{PR_CARD_SOCIETY_PG}}', NULL, 'P.R. card society (page)', 'computed', NULL, 'other'),
  ('mutation_entry_pg', '{{MUTATION_ENTRY_PG}}', NULL, 'Mutation entry (page)', 'computed', NULL, 'other'),
  ('pr_card_mcgm_pg', '{{PR_CARD_MCGM_PG}}', NULL, 'P.R. card MCGM (page)', 'computed', NULL, 'other'),
  ('sample_agreement_pg', '{{SAMPLE_AGREEMENT_PG}}', NULL, 'Sample agreement (page)', 'computed', NULL, 'other'),
  ('any_other_payment', '{{ANY_OTHER_PAYMENT}}', NULL, 'Any other payment', 'computed', NULL, 'other')
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
  format('%s_remark_%s', prefix, lpad(n::text, 2, '0')),
  format('{{%s_REMARK_%s}}', upper(prefix), lpad(n::text, 2, '0')),
  NULL,
  format('%s remark %s', prefix_label, lpad(n::text, 2, '0')),
  'computed',
  NULL,
  ui
FROM generate_series(1, 20) AS t(n)
CROSS JOIN (
  VALUES
    ('arch', 'Architect', 'other'),
    ('se', 'SE', 'office')
) AS p(prefix, prefix_label, ui)
ON CONFLICT (id) DO UPDATE SET
  token = EXCLUDED.token,
  label = EXCLUDED.label,
  source_table = EXCLUDED.source_table,
  ui_group = EXCLUDED.ui_group,
  is_active = true,
  updated_at = now();

-- ---------------------------------------------------------------------------
-- Type-level: letter header / key variables shared across Full OC/BCC HTML
-- ---------------------------------------------------------------------------
INSERT INTO public.application_type_placeholders
  (application_type_id, placeholder_id, required, sort_order)
VALUES
  ('full_part_oc', 'ward', true, 110),
  ('full_part_oc', 'cts_cs_no', true, 120),
  ('full_part_oc', 'village_division', true, 130),
  ('full_part_oc', 'site_address', true, 140),
  ('full_part_oc', 'file_no', true, 150),
  ('full_part_oc', 'cs_cts_no', true, 160),
  ('full_part_oc', 'division_village', true, 170),
  ('full_part_oc', 'road_name', true, 180),
  ('full_part_oc', 'locality', false, 190),
  ('full_part_oc', 'architect', true, 200)
ON CONFLICT (application_type_id, placeholder_id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Document-level: tokens unique to each Full OC/BCC HTML
-- ---------------------------------------------------------------------------
INSERT INTO public.application_document_placeholders
  (document_id, placeholder_id, required, sort_order)
VALUES
  -- application-full-oc-bcc.html
  ('application_full_oc_bcc', 'che_ref', false, 10),
  ('application_full_oc_bcc', 'building_level_1', false, 20),
  ('application_full_oc_bcc', 'building_level_2', false, 30),
  ('application_full_oc_bcc', 'upper_floors', false, 40),
  ('application_full_oc_bcc', 'last_approved_plan_date', false, 50),

  -- report-documents-full-oc-bcc.html
  ('report_documents_full_oc_bcc', 'item_21_1', false, 210),
  ('report_documents_full_oc_bcc', 'item_21_2', false, 220),
  ('report_documents_full_oc_bcc', 'approved_building_comprising', false, 230),
  ('report_documents_full_oc_bcc', 'approved_plot_bearing', false, 240),

  -- report-compliance-iod-conditions-d-form.html
  ('report_compliance_iod_conditions_d_form', 'subject_continuation', false, 10),
  ('report_compliance_iod_conditions_d_form', 'completion_plans_pg', false, 20),
  ('report_compliance_iod_conditions_d_form', 'last_approved_plan_pg', false, 30),
  ('report_compliance_iod_conditions_d_form', 'iod_plinth_cc_pg', false, 40),
  ('report_compliance_iod_conditions_d_form', 'further_cc_pg', false, 50),
  ('report_compliance_iod_conditions_d_form', 'cc_revalidated_upto', false, 60),
  ('report_compliance_iod_conditions_d_form', 'cc_revalidated_pg', false, 70),
  ('report_compliance_iod_conditions_d_form', 'bcc_pg', false, 80),
  ('report_compliance_iod_conditions_d_form', 'bcc_refusal_pg', false, 90),
  ('report_compliance_iod_conditions_d_form', 'dcc_pg', false, 100),
  ('report_compliance_iod_conditions_d_form', 'layout_file_pg', false, 110),
  ('report_compliance_iod_conditions_d_form', 'b_form_i_pg', false, 120),
  ('report_compliance_iod_conditions_d_form', 'start_work_pg_from', false, 130),
  ('report_compliance_iod_conditions_d_form', 'start_work_pg_to', false, 140),
  ('report_compliance_iod_conditions_d_form', 'further_cc_compliance_pg_from', false, 150),
  ('report_compliance_iod_conditions_d_form', 'further_cc_compliance_pg_to', false, 160),
  ('report_compliance_iod_conditions_d_form', 'mhada_noc_pg', false, 170),
  ('report_compliance_iod_conditions_d_form', 'consultants_noc_pg', false, 180),
  ('report_compliance_iod_conditions_d_form', 'aac_noc_pg', false, 190),
  ('report_compliance_iod_conditions_d_form', 'structural_stability_pg', false, 200),
  ('report_compliance_iod_conditions_d_form', 'site_supervisor_cert_pg', false, 210),
  ('report_compliance_iod_conditions_d_form', 'nr_users_mhada_pg', false, 220),
  ('report_compliance_iod_conditions_d_form', 'regd_ut_prc_pg', false, 230),
  ('report_compliance_iod_conditions_d_form', 'pr_card_society_pg', false, 240),
  ('report_compliance_iod_conditions_d_form', 'mutation_entry_pg', false, 250),
  ('report_compliance_iod_conditions_d_form', 'pr_card_mcgm_pg', false, 260),
  ('report_compliance_iod_conditions_d_form', 'sample_agreement_pg', false, 270),
  ('report_compliance_iod_conditions_d_form', 'any_other_payment', false, 280)
ON CONFLICT (document_id, placeholder_id) DO NOTHING;

INSERT INTO public.application_document_placeholders
  (document_id, placeholder_id, required, sort_order)
SELECT
  'report_documents_full_oc_bcc',
  p.id,
  false,
  10 * ROW_NUMBER() OVER (ORDER BY p.id)
FROM public.placeholders p
WHERE p.id ~ '^arch_remark_[0-9]{2}$'
   OR p.id ~ '^se_remark_[0-9]{2}$'
ON CONFLICT (document_id, placeholder_id) DO NOTHING;
