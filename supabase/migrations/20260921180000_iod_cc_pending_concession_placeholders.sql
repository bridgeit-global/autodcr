-- Placeholders from Building Permission IOD/CC Pending Concession HTML
-- (iod-cc-pending-architect, iod-cc-pending-owner-undertaking,
--  iod-cc-pending-provisional-report, work-start-notice).
-- Reuse existing master rows for {{WARD}}, {{VILLAGE}}, {{DATE}}, {{CTS_NO}},
-- {{BUILDING_NO}}, {{TPS_NO}}, {{OWNER_DEVELOPER}}. Do not insert VARIABLE_TAGS.

-- ---------------------------------------------------------------------------
-- Catalog: keep the four retained forms; drop 9 and 10 from the old bundle
-- ---------------------------------------------------------------------------
INSERT INTO public.application_documents
  (id, application_type_id, category, html, sign, letter_variant, sort_order)
VALUES
  ('iod_cc_pending_architect', 'iod_cc_pending_concession',
   'Application for IOD upto Plinth and CC upto Plinth pending approval of concession',
   'iod-cc-pending-architect.html', ARRAY['architect_or_ls'], NULL, 10),
  ('iod_cc_pending_owner_undertaking', 'iod_cc_pending_concession',
   'Undertaking cum Indemnity',
   'iod-cc-pending-owner-undertaking.html', ARRAY['owner'], NULL, 20),
  ('iod_cc_pending_provisional_report', 'iod_cc_pending_concession',
   'Report Format for Issue of IOD upto Plinth',
   'iod-cc-pending-provisional-report.html', ARRAY['architect_or_ls'], NULL, 30),
  ('work_start_notice', 'iod_cc_pending_concession',
   'Work Start Notice Appendix XV',
   'work-start-notice.html', ARRAY['owner'], NULL, 40)
ON CONFLICT (id) DO UPDATE SET
  application_type_id = EXCLUDED.application_type_id,
  category = EXCLUDED.category,
  html = EXCLUDED.html,
  sign = EXCLUDED.sign,
  sort_order = EXCLUDED.sort_order,
  is_active = true;

UPDATE public.application_documents
SET is_active = false
WHERE id IN (
  'iod_cc_pending_upto_plinth',
  'cc_upto_plinth_pending_concessions'
);

-- ---------------------------------------------------------------------------
-- Master placeholders (new tokens only)
-- ---------------------------------------------------------------------------
INSERT INTO public.placeholders
  (id, token, legacy_token, label, source_table, source_column, ui_group)
VALUES
  -- Application for IOD upto Plinth / CC upto Plinth
  ('zone', '{{ZONE}}', NULL, 'Zone', 'projects', 'save_plot_details->>zone', 'subject'),
  ('property_no_2', '{{PROPERTY_NO_2}}', NULL, 'Property number', 'projects', 'save_plot_details->>plotNo', 'subject'),
  ('location_1', '{{LOCATION_1}}', NULL, 'Location', 'projects', 'project_info->>landmark', 'subject'),
  ('site_address', '{{SITE_ADDRESS}}', NULL, 'Site address', 'projects', 'project_info->>propertyAddress', 'subject'),
  ('pin_code', '{{PIN_CODE}}', NULL, 'Pincode', 'projects', 'project_info->>pincode', 'subject'),
  ('ref_1', '{{REF_1}}', NULL, 'Reference 1', 'computed', NULL, 'reference'),
  ('ref_2', '{{REF_2}}', NULL, 'Reference 2', 'computed', NULL, 'reference'),
  ('subject', '{{SUBJECT}}', NULL, 'Subject', 'projects', 'title', 'subject'),
  ('che_ref_no', '{{CHE_REF_NO}}', NULL, 'Ch.E. reference number', 'computed', NULL, 'reference'),
  ('owner_ca_name', '{{OWNER_CA_NAME}}', NULL, 'Owner / C.A. name', 'owner_applicant', 'name', 'client'),
  ('architects_name', '{{ARCHITECTS_NAME}}', NULL, 'Architect name', 'applicants', 'name', 'consultant'),

  -- Undertaking cum Indemnity
  ('che_no', '{{CHE_NO}}', NULL, 'Ch.E. number', 'computed', NULL, 'reference'),
  ('bp_zone', '{{BP_ZONE}}', NULL, 'BP zone', 'projects', 'save_plot_details->>zone', 'office'),
  ('a_suffix', '{{A_SUFFIX}}', NULL, 'A suffix', 'computed', NULL, 'other'),
  ('architect', '{{ARCHITECT}}', NULL, 'Architect', 'applicants', 'name', 'consultant'),
  ('plan_ref_page', '{{PLAN_REF_PAGE}}', NULL, 'Plan reference (page)', 'computed', NULL, 'other'),
  ('eebp_zone', '{{EEBP_ZONE}}', NULL, 'EEBP zone', 'projects', 'save_plot_details->>region', 'office'),
  ('concession_date', '{{CONCESSION_DATE}}', NULL, 'Concession date', 'computed', NULL, 'other'),

  -- Report Format for Issue of IOD upto Plinth
  ('pr_card_page', '{{PR_CARD_PAGE}}', NULL, 'P.R. card (page)', 'computed', NULL, 'other'),
  ('pr_card_area', '{{PR_CARD_AREA}}', NULL, 'P.R. card area', 'computed', NULL, 'other'),
  ('ca_affidavit_page', '{{CA_AFFIDAVIT_PAGE}}', NULL, 'C.A. affidavit (page)', 'computed', NULL, 'other'),
  ('ca_affidavit_area', '{{CA_AFFIDAVIT_AREA}}', NULL, 'C.A. affidavit area', 'computed', NULL, 'other'),
  ('arch_cert_page', '{{ARCH_CERT_PAGE}}', NULL, 'Architect certificate (page)', 'computed', NULL, 'other'),
  ('arch_cert_area', '{{ARCH_CERT_AREA}}', NULL, 'Architect certificate area', 'computed', NULL, 'other'),
  ('performa_a_page', '{{PERFORMA_A_PAGE}}', NULL, 'Performa A (page)', 'computed', NULL, 'other'),
  ('performa_a_area', '{{PERFORMA_A_AREA}}', NULL, 'Performa A area', 'computed', NULL, 'other'),
  ('triangulation_page', '{{TRIANGULATION_PAGE}}', NULL, 'Triangulation (page)', 'computed', NULL, 'other'),
  ('triangulation_area', '{{TRIANGULATION_AREA}}', NULL, 'Triangulation area', 'computed', NULL, 'other'),
  ('accepted_area_page', '{{ACCEPTED_AREA_PAGE}}', NULL, 'Accepted area (page)', 'computed', NULL, 'other'),
  ('accepted_area', '{{ACCEPTED_AREA}}', NULL, 'Accepted area', 'computed', NULL, 'other'),
  ('auto_scrutiny_area', '{{AUTO_SCRUTINY_AREA}}', NULL, 'Auto scrutiny area', 'computed', NULL, 'other'),
  ('total_permissible_fsi', '{{TOTAL_PERMISSIBLE_FSI}}', NULL, 'Total permissible FSI', 'projects', 'building_details->>fsiBuiltUpArea', 'other'),
  ('total_area_approvable', '{{TOTAL_AREA_APPROVABLE}}', NULL, 'Total area approvable', 'computed', NULL, 'other'),
  ('total_area_approved', '{{TOTAL_AREA_APPROVED}}', NULL, 'Total area approved', 'computed', NULL, 'other'),
  ('balance_approvable_area', '{{BALANCE_APPROVABLE_AREA}}', NULL, 'Balance approvable area', 'computed', NULL, 'other'),
  ('area_proposed_iod_plinth_cc', '{{AREA_PROPOSED_IOD_PLINTH_CC}}', NULL, 'Area proposed for IOD / plinth CC', 'computed', NULL, 'other'),
  ('payments_payable_page', '{{PAYMENTS_PAYABLE_PAGE}}', NULL, 'Payments payable (page)', 'computed', NULL, 'other'),
  ('payments_paid_page', '{{PAYMENTS_PAID_PAGE}}', NULL, 'Payments paid (page)', 'computed', NULL, 'other'),
  ('iod_plinth_cc_page', '{{IOD_PLINTH_CC_PAGE}}', NULL, 'IOD / plinth CC (page)', 'computed', NULL, 'other'),
  ('draft_plan_page', '{{DRAFT_PLAN_PAGE}}', NULL, 'Draft plan (page)', 'computed', NULL, 'other'),
  ('sebp_ward', '{{SEBP_WARD}}', NULL, 'SEBP ward', 'projects', 'save_plot_details->>ward', 'office'),
  ('aebp_ward', '{{AEBP_WARD}}', NULL, 'AEBP ward', 'projects', 'save_plot_details->>ward', 'office'),
  ('eebp_zone_2', '{{EEBP_ZONE_2}}', NULL, 'EEBP zone (2)', 'projects', 'save_plot_details->>region', 'office'),
  ('eebp_ward_2', '{{EEBP_WARD_2}}', NULL, 'EEBP ward (2)', 'projects', 'save_plot_details->>ward', 'office'),

  -- Work Start Notice Appendix XV
  ('plot_cs_cts_no', '{{PLOT_CS_CTS_NO}}', NULL, 'Plot CS / CTS number', 'projects', 'save_plot_details->>proposedCtsNumber', 'subject'),
  ('street_road', '{{STREET_ROAD}}', NULL, 'Street / road', 'projects', 'save_plot_details->>roadName', 'subject'),
  ('ward_2', '{{WARD_2}}', NULL, 'Ward (2)', 'projects', 'save_plot_details->>ward', 'subject'),
  ('work_start_date', '{{WORK_START_DATE}}', NULL, 'Work start date', 'computed', NULL, 'other'),
  ('work_start_date_2', '{{WORK_START_DATE_2}}', NULL, 'Work start date (2)', 'computed', NULL, 'other'),
  ('permission_no', '{{PERMISSION_NO}}', NULL, 'Permission number', 'projects', 'project_info->>proposalNo', 'reference'),
  ('permission_date', '{{PERMISSION_DATE}}', NULL, 'Permission date', 'computed', NULL, 'other'),
  ('supervisor_name', '{{SUPERVISOR_NAME}}', NULL, 'Supervisor name', 'computed', NULL, 'consultant'),
  ('license_no', '{{LICENSE_NO}}', NULL, 'License number', 'applicants', 'registrationNumber', 'consultant'),
  ('owner_signature', '{{OWNER_SIGNATURE}}', NULL, 'Owner signature', 'computed', NULL, 'client'),
  ('owner_name', '{{OWNER_NAME}}', NULL, 'Owner name', 'owner_applicant', 'name', 'client'),
  ('owner_name_block', '{{OWNER_NAME_BLOCK}}', NULL, 'Owner name (block)', 'owner_applicant', 'name', 'client'),
  ('owner_address_line_1', '{{OWNER_ADDRESS_LINE_1}}', NULL, 'Owner address line 1', 'owner_applicant', 'address_line1', 'client'),
  ('owner_address_line_2', '{{OWNER_ADDRESS_LINE_2}}', NULL, 'Owner address line 2', 'owner_applicant', 'address_line2', 'client'),
  ('owner_address_line_3', '{{OWNER_ADDRESS_LINE_3}}', NULL, 'Owner address line 3', 'owner_applicant', 'address_line3', 'client'),
  ('owner_address_line_4', '{{OWNER_ADDRESS_LINE_4}}', NULL, 'Owner address line 4', 'computed', NULL, 'client')
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
    ('REQD', 'required'),
    ('PROP', 'proposed'),
    ('REMARKS', 'remarks')
) AS cols(suffix, suffix_label)
ON CONFLICT (id) DO UPDATE SET
  token = EXCLUDED.token,
  label = EXCLUDED.label,
  source_table = EXCLUDED.source_table,
  ui_group = EXCLUDED.ui_group,
  is_active = true,
  updated_at = now();

-- ---------------------------------------------------------------------------
-- Type-level: letter header / key variables shared across IOD/CC Pending HTML
-- ---------------------------------------------------------------------------
INSERT INTO public.application_type_placeholders
  (application_type_id, placeholder_id, required, sort_order)
VALUES
  ('iod_cc_pending_concession', 'date', true, 110),
  ('iod_cc_pending_concession', 'village', true, 120),
  ('iod_cc_pending_concession', 'ward', true, 130),
  ('iod_cc_pending_concession', 'zone', true, 140),
  ('iod_cc_pending_concession', 'cts_no', true, 150),
  ('iod_cc_pending_concession', 'property_no_2', false, 160),
  ('iod_cc_pending_concession', 'location_1', false, 170),
  ('iod_cc_pending_concession', 'site_address', true, 180),
  ('iod_cc_pending_concession', 'pin_code', true, 190),
  ('iod_cc_pending_concession', 'architects_name', true, 200),
  ('iod_cc_pending_concession', 'architect', true, 210),
  ('iod_cc_pending_concession', 'owner_developer', true, 220),
  ('iod_cc_pending_concession', 'owner_name', true, 230),
  ('iod_cc_pending_concession', 'plot_cs_cts_no', true, 240),
  ('iod_cc_pending_concession', 'street_road', true, 250),
  ('iod_cc_pending_concession', 'building_no', false, 260),
  ('iod_cc_pending_concession', 'tps_no', false, 270),
  ('iod_cc_pending_concession', 'permission_no', true, 280)
ON CONFLICT (application_type_id, placeholder_id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Document-level: tokens unique to each IOD/CC Pending Concession HTML
-- ---------------------------------------------------------------------------
INSERT INTO public.application_document_placeholders
  (document_id, placeholder_id, required, sort_order)
VALUES
  -- iod-cc-pending-architect.html
  ('iod_cc_pending_architect', 'ref_1', false, 10),
  ('iod_cc_pending_architect', 'ref_2', false, 20),
  ('iod_cc_pending_architect', 'subject', false, 30),
  ('iod_cc_pending_architect', 'che_ref_no', false, 40),
  ('iod_cc_pending_architect', 'owner_ca_name', false, 50),

  -- iod-cc-pending-owner-undertaking.html
  ('iod_cc_pending_owner_undertaking', 'che_no', false, 10),
  ('iod_cc_pending_owner_undertaking', 'bp_zone', false, 20),
  ('iod_cc_pending_owner_undertaking', 'a_suffix', false, 30),
  ('iod_cc_pending_owner_undertaking', 'plan_ref_page', false, 40),
  ('iod_cc_pending_owner_undertaking', 'eebp_zone', false, 50),
  ('iod_cc_pending_owner_undertaking', 'concession_date', false, 60),

  -- iod-cc-pending-provisional-report.html
  ('iod_cc_pending_provisional_report', 'pr_card_page', false, 10),
  ('iod_cc_pending_provisional_report', 'pr_card_area', false, 20),
  ('iod_cc_pending_provisional_report', 'ca_affidavit_page', false, 30),
  ('iod_cc_pending_provisional_report', 'ca_affidavit_area', false, 40),
  ('iod_cc_pending_provisional_report', 'arch_cert_page', false, 50),
  ('iod_cc_pending_provisional_report', 'arch_cert_area', false, 60),
  ('iod_cc_pending_provisional_report', 'performa_a_page', false, 70),
  ('iod_cc_pending_provisional_report', 'performa_a_area', false, 80),
  ('iod_cc_pending_provisional_report', 'triangulation_page', false, 90),
  ('iod_cc_pending_provisional_report', 'triangulation_area', false, 100),
  ('iod_cc_pending_provisional_report', 'accepted_area_page', false, 110),
  ('iod_cc_pending_provisional_report', 'accepted_area', false, 120),
  ('iod_cc_pending_provisional_report', 'auto_scrutiny_area', false, 130),
  ('iod_cc_pending_provisional_report', 'total_permissible_fsi', false, 140),
  ('iod_cc_pending_provisional_report', 'total_area_approvable', false, 150),
  ('iod_cc_pending_provisional_report', 'total_area_approved', false, 160),
  ('iod_cc_pending_provisional_report', 'balance_approvable_area', false, 170),
  ('iod_cc_pending_provisional_report', 'area_proposed_iod_plinth_cc', false, 180),
  ('iod_cc_pending_provisional_report', 'payments_payable_page', false, 190),
  ('iod_cc_pending_provisional_report', 'payments_paid_page', false, 200),
  ('iod_cc_pending_provisional_report', 'iod_plinth_cc_page', false, 210),
  ('iod_cc_pending_provisional_report', 'draft_plan_page', false, 220),
  ('iod_cc_pending_provisional_report', 'sebp_ward', false, 230),
  ('iod_cc_pending_provisional_report', 'aebp_ward', false, 240),
  ('iod_cc_pending_provisional_report', 'eebp_zone_2', false, 250),
  ('iod_cc_pending_provisional_report', 'eebp_ward_2', false, 260),

  -- work-start-notice.html
  ('work_start_notice', 'ward_2', false, 10),
  ('work_start_notice', 'work_start_date', false, 20),
  ('work_start_notice', 'work_start_date_2', false, 30),
  ('work_start_notice', 'permission_date', false, 40),
  ('work_start_notice', 'supervisor_name', false, 50),
  ('work_start_notice', 'license_no', false, 60),
  ('work_start_notice', 'owner_signature', false, 70),
  ('work_start_notice', 'owner_name_block', false, 80),
  ('work_start_notice', 'owner_address_line_1', false, 90),
  ('work_start_notice', 'owner_address_line_2', false, 100),
  ('work_start_notice', 'owner_address_line_3', false, 110),
  ('work_start_notice', 'owner_address_line_4', false, 120)
ON CONFLICT (document_id, placeholder_id) DO NOTHING;

INSERT INTO public.application_document_placeholders
  (document_id, placeholder_id, required, sort_order)
SELECT
  'iod_cc_pending_provisional_report',
  p.id,
  false,
  270 + 10 * ROW_NUMBER() OVER (ORDER BY p.id)
FROM public.placeholders p
WHERE p.id LIKE 'north_%'
   OR p.id LIKE 'west_a_r_%'
   OR p.id LIKE 'east_%'
   OR p.id LIKE 'south_%'
ON CONFLICT (document_id, placeholder_id) DO NOTHING;
