-- Building Permission – IOD/CC Pending Concession
-- Placeholders from retained HTML:
--   6. Application for IOD upto Plinth and CC upto Plinth pending approval of concession
--   7. Undertaking cum Indemnity
--   8. Report Format for Issue of IOD upto Plinth
--  11. Work Start Notice Appendix XV
-- Skip {{VARIABLE_TAGS}}. Reuse {{WARD}} and {{VILLAGE}}.

-- 1) Application type
INSERT INTO public.application_types
  (id, department, application_title, description, category, applicant_type, token_suffix,
   planning_authorities, requires_roster_match, show_building_permission_fields, sort_order, icon_key)
VALUES
  ('iod_cc_pending_concession', 'Building Permission', 'IOD/CC pending concession',
   'IOD/CC pending concession by Architect/LS',
   'department_permission', NULL, NULL, '{}', false, true, 14, 'document')
ON CONFLICT (id) DO UPDATE SET
  department = EXCLUDED.department,
  application_title = EXCLUDED.application_title,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  show_building_permission_fields = EXCLUDED.show_building_permission_fields,
  sort_order = EXCLUDED.sort_order,
  icon_key = EXCLUDED.icon_key,
  is_active = true,
  updated_at = now();

-- 2) Documents (HTML files)
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

-- 3) Placeholders from HTML tokens
INSERT INTO public.placeholders
  (id, token, legacy_token, label, source_table, source_column, ui_group)
VALUES
  ('date', '{{DATE}}', NULL, 'Date', 'computed', 'current_date', 'other'),
  ('zone', '{{ZONE}}', NULL, 'Zone', 'projects', 'save_plot_details->>zone', 'subject'),
  ('cts_no', '{{CTS_NO}}', NULL, 'CTS number', 'projects', 'save_plot_details->>proposedCtsNumber', 'subject'),
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
  ('che_no', '{{CHE_NO}}', NULL, 'Ch.E. number', 'computed', NULL, 'reference'),
  ('bp_zone', '{{BP_ZONE}}', NULL, 'BP zone', 'projects', 'save_plot_details->>zone', 'office'),
  ('a_suffix', '{{A_SUFFIX}}', NULL, 'A suffix', 'computed', NULL, 'other'),
  ('architect', '{{ARCHITECT}}', NULL, 'Architect', 'applicants', 'name', 'consultant'),
  ('plan_ref_page', '{{PLAN_REF_PAGE}}', NULL, 'Plan reference (page)', 'computed', NULL, 'other'),
  ('owner_developer', '{{OWNER_DEVELOPER}}', NULL, 'Owner / developer', 'owner_applicant', 'name', 'client'),
  ('eebp_zone', '{{EEBP_ZONE}}', NULL, 'EEBP zone', 'projects', 'save_plot_details->>region', 'office'),
  ('concession_date', '{{CONCESSION_DATE}}', NULL, 'Concession date', 'computed', NULL, 'other'),
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
  ('building_no', '{{BUILDING_NO}}', NULL, 'Building number', 'computed', NULL, 'other'),
  ('plot_cs_cts_no', '{{PLOT_CS_CTS_NO}}', NULL, 'Plot CS / CTS number', 'projects', 'save_plot_details->>proposedCtsNumber', 'subject'),
  ('tps_no', '{{TPS_NO}}', NULL, 'T.P.S. number', 'computed', NULL, 'subject'),
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
  initcap(replace(lower(seg || ' ' || suffix_label), '_', ' ')),
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

-- 4) Link all IOD/CC pending concession HTML tokens to the type
INSERT INTO public.application_type_placeholders
  (application_type_id, placeholder_id, required, sort_order)
SELECT
  'iod_cc_pending_concession',
  p.id,
  p.id IN (
    'ward', 'village', 'date', 'cts_no', 'zone', 'site_address', 'pin_code',
    'owner_developer', 'architects_name', 'architect', 'plot_cs_cts_no',
    'street_road', 'owner_name', 'permission_no'
  ),
  10 * ROW_NUMBER() OVER (ORDER BY p.id)
FROM public.placeholders p
WHERE p.id IN (
  'ward', 'village',
  'date', 'zone', 'cts_no', 'property_no_2', 'location_1', 'site_address', 'pin_code',
  'ref_1', 'ref_2', 'subject', 'che_ref_no', 'owner_ca_name', 'architects_name',
  'che_no', 'bp_zone', 'a_suffix', 'architect', 'plan_ref_page', 'owner_developer',
  'eebp_zone', 'concession_date', 'pr_card_page', 'pr_card_area',
  'ca_affidavit_page', 'ca_affidavit_area', 'arch_cert_page', 'arch_cert_area',
  'performa_a_page', 'performa_a_area', 'triangulation_page', 'triangulation_area',
  'accepted_area_page', 'accepted_area', 'auto_scrutiny_area',
  'total_permissible_fsi', 'total_area_approvable', 'total_area_approved',
  'balance_approvable_area', 'area_proposed_iod_plinth_cc',
  'payments_payable_page', 'payments_paid_page', 'iod_plinth_cc_page', 'draft_plan_page',
  'sebp_ward', 'aebp_ward', 'eebp_zone_2', 'eebp_ward_2',
  'building_no', 'plot_cs_cts_no', 'tps_no', 'street_road', 'ward_2',
  'work_start_date', 'work_start_date_2', 'permission_no', 'permission_date',
  'supervisor_name', 'license_no', 'owner_signature', 'owner_name', 'owner_name_block',
  'owner_address_line_1', 'owner_address_line_2', 'owner_address_line_3', 'owner_address_line_4'
)
   OR p.id LIKE 'north_%'
   OR p.id LIKE 'west_a_r_%'
   OR p.id LIKE 'east_%'
   OR p.id LIKE 'south_%'
ON CONFLICT (application_type_id, placeholder_id) DO NOTHING;
