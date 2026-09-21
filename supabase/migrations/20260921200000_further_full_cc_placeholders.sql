-- Placeholders from Building Permission Further / Full CC HTML
-- (application-further-cc, site-supervisor-memo, report-further-cc).
-- Reuse existing master rows for {{WARD}}, {{VILLAGE}}, {{DATE}}, {{ZONE}},
-- {{CTS_NO}}, {{SITE_ADDRESS}}, {{BUILDING_NO}}, {{PLOT_CS_CTS_NO}},
-- {{PERMISSION_NO}}, {{PERMISSION_DATE}}, {{IOD_PLINTH_CC_PAGE}},
-- {{ARCHITECT_LS_NAME}}, {{ARCHITECT_LS_SIGNATURE}}.
-- Do not insert VARIABLE_TAGS.

-- ---------------------------------------------------------------------------
-- Catalog: three retained forms (application, Appendix XVI memo, report)
-- ---------------------------------------------------------------------------
INSERT INTO public.application_documents
  (id, application_type_id, category, html, sign, letter_variant, sort_order)
VALUES
  ('application_further_cc', 'further_full_cc',
   'Application for Further CC',
   'application-further-cc.html', ARRAY['architect_or_ls'], NULL, 10),
  ('site_supervisor_memo', 'further_full_cc',
   'Site Supervisor Memo Appendix XVI',
   'site-supervisor-memo.html', ARRAY['architect_or_ls'], NULL, 20),
  ('report_further_cc', 'further_full_cc',
   'Report for Further CC',
   'report-further-cc.html', ARRAY['architect_or_ls'], NULL, 30)
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
  -- Application for Further CC
  ('iod_cc_no', '{{IOD_CC_NO}}', NULL, 'IOD / C.C. number', 'projects', 'project_info->>proposalNo', 'reference'),
  ('further_cc_upto_floors', '{{FURTHER_CC_UPTO_FLOORS}}', NULL, 'Further CC up to floors', 'computed', NULL, 'other'),

  -- Site Supervisor Memo Appendix XVI
  ('division_village_tps_no', '{{DIVISION_VILLAGE_TPS_NO}}', NULL, 'Division / village / T.P.S. number', 'projects', 'save_plot_details->>villageName', 'subject'),
  ('road_street', '{{ROAD_STREET}}', NULL, 'Road / street', 'projects', 'save_plot_details->>roadName', 'subject'),
  ('additional_location', '{{ADDITIONAL_LOCATION}}', NULL, 'Additional location', 'computed', NULL, 'subject'),
  ('professional_name', '{{PROFESSIONAL_NAME}}', NULL, 'Professional name', 'applicants', 'name', 'consultant'),
  ('address_line_1', '{{ADDRESS_LINE_1}}', NULL, 'Address line 1', 'applicants', 'address_line1', 'consultant'),
  ('address_line_2', '{{ADDRESS_LINE_2}}', NULL, 'Address line 2', 'applicants', 'address_line2', 'consultant'),
  ('address_line_3', '{{ADDRESS_LINE_3}}', NULL, 'Address line 3', 'applicants', 'address_line3', 'consultant'),

  -- Report for Further CC
  ('last_approved_plan_page', '{{LAST_APPROVED_PLAN_PAGE}}', NULL, 'Last approved plan (page)', 'computed', NULL, 'other'),
  ('provisional_iod_plinth_page', '{{PROVISIONAL_IOD_PLINTH_PAGE}}', NULL, 'Provisional IOD / plinth (page)', 'computed', NULL, 'other'),
  ('cc_revalidated_upto', '{{CC_REVALIDATED_UPTO}}', NULL, 'C.C. revalidated up to', 'computed', NULL, 'other'),
  ('cc_revalidated_page', '{{CC_REVALIDATED_PAGE}}', NULL, 'C.C. revalidated (page)', 'computed', NULL, 'other'),
  ('layout_no', '{{LAYOUT_NO}}', NULL, 'Layout number', 'projects', 'project_info->>earlierBuildingProposalFileNo', 'reference'),
  ('layout_date', '{{LAYOUT_DATE}}', NULL, 'Layout date', 'computed', NULL, 'other'),
  ('se_remark_b03', '{{SE_REMARK_B03}}', NULL, 'SE remark B03', 'computed', NULL, 'office'),
  ('se_remark_b06', '{{SE_REMARK_B06}}', NULL, 'SE remark B06', 'computed', NULL, 'office'),
  ('site_visited_on', '{{SITE_VISITED_ON}}', NULL, 'Site visited on', 'computed', NULL, 'office'),
  ('work_beyond_approval_remark', '{{WORK_BEYOND_APPROVAL_REMARK}}', NULL, 'Work beyond approval remark', 'computed', NULL, 'office')
ON CONFLICT (id) DO UPDATE SET
  token = EXCLUDED.token,
  label = EXCLUDED.label,
  source_table = EXCLUDED.source_table,
  source_column = EXCLUDED.source_column,
  ui_group = EXCLUDED.ui_group,
  is_active = true,
  updated_at = now();

-- ---------------------------------------------------------------------------
-- Type-level: letter header / key variables shared across Further CC HTML
-- ---------------------------------------------------------------------------
INSERT INTO public.application_type_placeholders
  (application_type_id, placeholder_id, required, sort_order)
VALUES
  ('further_full_cc', 'date', true, 110),
  ('further_full_cc', 'village', true, 120),
  ('further_full_cc', 'ward', true, 130),
  ('further_full_cc', 'zone', true, 140),
  ('further_full_cc', 'cts_no', true, 150),
  ('further_full_cc', 'property_no_2', false, 160),
  ('further_full_cc', 'location_1', false, 170),
  ('further_full_cc', 'site_address', true, 180),
  ('further_full_cc', 'pin_code', true, 190),
  ('further_full_cc', 'building_no', false, 200),
  ('further_full_cc', 'plot_cs_cts_no', true, 210),
  ('further_full_cc', 'permission_no', true, 220)
ON CONFLICT (application_type_id, placeholder_id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Document-level: tokens unique to each Further / Full CC HTML
-- ---------------------------------------------------------------------------
INSERT INTO public.application_document_placeholders
  (document_id, placeholder_id, required, sort_order)
VALUES
  -- application-further-cc.html
  ('application_further_cc', 'iod_cc_no', false, 10),
  ('application_further_cc', 'further_cc_upto_floors', false, 20),

  -- site-supervisor-memo.html
  ('site_supervisor_memo', 'division_village_tps_no', false, 10),
  ('site_supervisor_memo', 'road_street', false, 20),
  ('site_supervisor_memo', 'ward_2', false, 30),
  ('site_supervisor_memo', 'additional_location', false, 40),
  ('site_supervisor_memo', 'permission_date', false, 50),
  ('site_supervisor_memo', 'professional_name', false, 60),
  ('site_supervisor_memo', 'address_line_1', false, 70),
  ('site_supervisor_memo', 'address_line_2', false, 80),
  ('site_supervisor_memo', 'address_line_3', false, 90),

  -- report-further-cc.html
  ('report_further_cc', 'last_approved_plan_page', false, 10),
  ('report_further_cc', 'provisional_iod_plinth_page', false, 20),
  ('report_further_cc', 'iod_plinth_cc_page', false, 30),
  ('report_further_cc', 'cc_revalidated_upto', false, 40),
  ('report_further_cc', 'cc_revalidated_page', false, 50),
  ('report_further_cc', 'layout_no', false, 60),
  ('report_further_cc', 'layout_date', false, 70),
  ('report_further_cc', 'se_remark_b03', false, 80),
  ('report_further_cc', 'se_remark_b06', false, 90),
  ('report_further_cc', 'architect_ls_name', false, 100),
  ('report_further_cc', 'architect_ls_signature', false, 110),
  ('report_further_cc', 'site_visited_on', false, 120),
  ('report_further_cc', 'work_beyond_approval_remark', false, 130)
ON CONFLICT (document_id, placeholder_id) DO NOTHING;
