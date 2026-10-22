-- Layout department: Layout Approval and Layout Completion.
-- Catalog only. No TypeScript. Reuse project tokens; remaining blanks stay computed.

INSERT INTO public.application_types
  (slug, department, application_title, description, category,
   applicant_type, planning_authorities, requires_roster_match,
   sort_order, icon_key, is_active)
VALUES
  (
    'layout_approval',
    'Layout',
    'Layout Approval',
    'Application, fact sheet, scrutiny report, undertaking, and development permission terms for layout approval',
    'department_permission',
    NULL,
    '{}'::text[],
    false,
    10,
    'document',
    true
  ),
  (
    'layout_completion',
    'Layout',
    'Layout Completion',
    'Application for the layout completion certificate and the report of compliance of layout conditions',
    'department_permission',
    NULL,
    '{}'::text[],
    false,
    20,
    'document',
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

INSERT INTO public.application_documents
  (slug, application_type_id, category, html, sign, letter_variant,
   show_letterhead, show_qrcode, letterhead_source, sort_order, is_active)
SELECT
  v.slug, t.id, v.category, v.html, v.sign, NULL, false, false,
  v.letterhead_source, v.sort_order, true
FROM public.application_types t
CROSS JOIN (
  VALUES
    (
      'layout_approval_application',
      'Application for Layout Approval by Owner/architect',
      'DraftDesk_Layout_Approval (1)/08_application_for_layout_approval_by_owner_architect_VERBATIM.html',
      ARRAY['owner']::text[],
      'owner',
      10
    ),
    (
      'layout_architect_ls_fact_sheet',
      'Architects/ L.S. Fact Sheet for Layout',
      'DraftDesk_Layout_Approval (1)/10_architect_ls_fact_sheet_for_layout_VERBATIM.html',
      ARRAY['architect_or_ls']::text[],
      'architect_or_ls',
      20
    ),
    (
      'layout_permission_scrutiny_report',
      'Layout Permission Scrutiny Report by EEBP',
      'DraftDesk_Layout_Approval (1)/11_layout_permission_scrutiny_report_by_eebp_VERBATIM.html',
      ARRAY['architect_or_ls']::text[],
      'architect_or_ls',
      30
    ),
    (
      'layout_undertaking_terms_conditions',
      'Undertaking for layout terms & conditions',
      'DraftDesk_Layout_Approval (1)/12_undertaking_layout_terms_conditions_VERBATIM.html',
      ARRAY['owner', 'architect_or_ls']::text[],
      'architect_or_ls',
      40
    ),
    (
      'layout_terms_development_permission',
      'Terms and Conditions for Development Permission',
      'DraftDesk_Layout_Approval (1)/14_terms_conditions_development_permission_VERBATIM.html',
      ARRAY['architect_or_ls']::text[],
      'architect_or_ls',
      50
    )
) AS v(slug, category, html, sign, letterhead_source, sort_order)
WHERE t.slug = 'layout_approval'
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

INSERT INTO public.application_documents
  (slug, application_type_id, category, html, sign, letter_variant,
   show_letterhead, show_qrcode, letterhead_source, sort_order, is_active)
SELECT
  v.slug, t.id, v.category, v.html, v.sign, NULL, false, false,
  v.letterhead_source, v.sort_order, true
FROM public.application_types t
CROSS JOIN (
  VALUES
    (
      'layout_completion_certificate_application',
      'Application for Layout Completion Certificate',
      'DraftDesk_Layout_Completion/15_application_for_layout_completion_certificate_VERBATIM.html',
      ARRAY['architect_or_ls']::text[],
      'architect_or_ls',
      10
    ),
    (
      'layout_compliances_report',
      'Report of Compliance of Layout Conditions',
      'DraftDesk_Layout_Completion/17_report_of_layout_compliances_VERBATIM.html',
      ARRAY['architect_or_ls']::text[],
      'architect_or_ls',
      20
    )
) AS v(slug, category, html, sign, letterhead_source, sort_order)
WHERE t.slug = 'layout_completion'
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

INSERT INTO public.placeholders
  (id, token, legacy_token, label, source_table, source_column, ui_group)
VALUES
  ('cts_cno_fp_no', '{{CTS_CNO_FP_NO}}', NULL, 'CTS CNO FP NO', 'computed', NULL, 'other'),
  ('architect_ls_office', '{{ARCHITECT_LS_OFFICE}}', NULL, 'Architect LS Office', 'computed', NULL, 'other'),
  ('pay_order_no', '{{PAY_ORDER_NO}}', NULL, 'PAY Order NO', 'computed', NULL, 'other'),
  ('pay_order_date', '{{PAY_ORDER_DATE}}', NULL, 'PAY Order Date', 'computed', NULL, 'other'),
  ('dp_reservation', '{{DP_RESERVATION}}', NULL, 'DP Reservation', 'computed', NULL, 'other'),
  ('sanctioned_dp_plan', '{{SANCTIONED_DP_PLAN}}', NULL, 'Sanctioned DP Plan', 'computed', NULL, 'other'),
  ('owner_name_signature', '{{OWNER_NAME_SIGNATURE}}', NULL, 'Owner Name Signature', 'computed', NULL, 'other'),
  ('road_consultant', '{{ROAD_CONSULTANT}}', NULL, 'Road Consultant', 'computed', NULL, 'other'),
  ('plans_approval_page', '{{PLANS_APPROVAL_PAGE}}', NULL, 'Plans Approval Page', 'computed', NULL, 'other'),
  ('fs_01_details', '{{FS_01_DETAILS}}', NULL, 'FS 01 Details', 'computed', NULL, 'other'),
  ('fs_01_remark', '{{FS_01_REMARK}}', NULL, 'FS 01 Remark', 'computed', NULL, 'other'),
  ('fs_01_office', '{{FS_01_OFFICE}}', NULL, 'FS 01 Office', 'computed', NULL, 'other'),
  ('fs_02_details', '{{FS_02_DETAILS}}', NULL, 'FS 02 Details', 'computed', NULL, 'other'),
  ('fs_02_remark', '{{FS_02_REMARK}}', NULL, 'FS 02 Remark', 'computed', NULL, 'other'),
  ('fs_02_office', '{{FS_02_OFFICE}}', NULL, 'FS 02 Office', 'computed', NULL, 'other'),
  ('fs_03_details', '{{FS_03_DETAILS}}', NULL, 'FS 03 Details', 'computed', NULL, 'other'),
  ('fs_03_remark', '{{FS_03_REMARK}}', NULL, 'FS 03 Remark', 'computed', NULL, 'other'),
  ('fs_03_office', '{{FS_03_OFFICE}}', NULL, 'FS 03 Office', 'computed', NULL, 'other'),
  ('fs_04_details', '{{FS_04_DETAILS}}', NULL, 'FS 04 Details', 'computed', NULL, 'other'),
  ('fs_04_remark', '{{FS_04_REMARK}}', NULL, 'FS 04 Remark', 'computed', NULL, 'other'),
  ('fs_04_office', '{{FS_04_OFFICE}}', NULL, 'FS 04 Office', 'computed', NULL, 'other'),
  ('fs_05_details', '{{FS_05_DETAILS}}', NULL, 'FS 05 Details', 'computed', NULL, 'other'),
  ('fs_05_remark', '{{FS_05_REMARK}}', NULL, 'FS 05 Remark', 'computed', NULL, 'other'),
  ('fs_05_office', '{{FS_05_OFFICE}}', NULL, 'FS 05 Office', 'computed', NULL, 'other'),
  ('fs_06_details', '{{FS_06_DETAILS}}', NULL, 'FS 06 Details', 'computed', NULL, 'other'),
  ('fs_06_remark', '{{FS_06_REMARK}}', NULL, 'FS 06 Remark', 'computed', NULL, 'other'),
  ('fs_06_office', '{{FS_06_OFFICE}}', NULL, 'FS 06 Office', 'computed', NULL, 'other'),
  ('fs_07_details', '{{FS_07_DETAILS}}', NULL, 'FS 07 Details', 'computed', NULL, 'other'),
  ('fs_07_remark', '{{FS_07_REMARK}}', NULL, 'FS 07 Remark', 'computed', NULL, 'other'),
  ('fs_07_office', '{{FS_07_OFFICE}}', NULL, 'FS 07 Office', 'computed', NULL, 'other'),
  ('fs_08_details', '{{FS_08_DETAILS}}', NULL, 'FS 08 Details', 'computed', NULL, 'other'),
  ('fs_08_remark', '{{FS_08_REMARK}}', NULL, 'FS 08 Remark', 'computed', NULL, 'other'),
  ('fs_08_office', '{{FS_08_OFFICE}}', NULL, 'FS 08 Office', 'computed', NULL, 'other'),
  ('fs_09_details', '{{FS_09_DETAILS}}', NULL, 'FS 09 Details', 'computed', NULL, 'other'),
  ('fs_09_remark', '{{FS_09_REMARK}}', NULL, 'FS 09 Remark', 'computed', NULL, 'other'),
  ('fs_09_office', '{{FS_09_OFFICE}}', NULL, 'FS 09 Office', 'computed', NULL, 'other'),
  ('fs_dp_1967_des', '{{FS_DP_1967_DES}}', NULL, 'FS DP 1967 DES', 'computed', NULL, 'other'),
  ('fs_dp_1991_des', '{{FS_DP_1991_DES}}', NULL, 'FS DP 1991 DES', 'computed', NULL, 'other'),
  ('fs_dp_2034_des', '{{FS_DP_2034_DES}}', NULL, 'FS DP 2034 DES', 'computed', NULL, 'other'),
  ('fs_dp_1967_res', '{{FS_DP_1967_RES}}', NULL, 'FS DP 1967 RES', 'computed', NULL, 'other'),
  ('fs_dp_1991_res', '{{FS_DP_1991_RES}}', NULL, 'FS DP 1991 RES', 'computed', NULL, 'other'),
  ('fs_dp_2034_res', '{{FS_DP_2034_RES}}', NULL, 'FS DP 2034 RES', 'computed', NULL, 'other'),
  ('fs_dp_1967_zone', '{{FS_DP_1967_ZONE}}', NULL, 'FS DP 1967 Zone', 'computed', NULL, 'other'),
  ('fs_dp_1991_zone', '{{FS_DP_1991_ZONE}}', NULL, 'FS DP 1991 Zone', 'computed', NULL, 'other'),
  ('fs_dp_2034_zone', '{{FS_DP_2034_ZONE}}', NULL, 'FS DP 2034 Zone', 'computed', NULL, 'other'),
  ('fs_dp_1967_rem', '{{FS_DP_1967_REM}}', NULL, 'FS DP 1967 REM', 'computed', NULL, 'other'),
  ('fs_dp_1991_rem', '{{FS_DP_1991_REM}}', NULL, 'FS DP 1991 REM', 'computed', NULL, 'other'),
  ('fs_dp_2034_rem', '{{FS_DP_2034_REM}}', NULL, 'FS DP 2034 REM', 'computed', NULL, 'other'),
  ('fs_10_details', '{{FS_10_DETAILS}}', NULL, 'FS 10 Details', 'computed', NULL, 'other'),
  ('fs_10_remark', '{{FS_10_REMARK}}', NULL, 'FS 10 Remark', 'computed', NULL, 'other'),
  ('fs_10_office', '{{FS_10_OFFICE}}', NULL, 'FS 10 Office', 'computed', NULL, 'other'),
  ('fs_11_details', '{{FS_11_DETAILS}}', NULL, 'FS 11 Details', 'computed', NULL, 'other'),
  ('fs_11_remark', '{{FS_11_REMARK}}', NULL, 'FS 11 Remark', 'computed', NULL, 'other'),
  ('fs_11_office', '{{FS_11_OFFICE}}', NULL, 'FS 11 Office', 'computed', NULL, 'other'),
  ('fs_12_details', '{{FS_12_DETAILS}}', NULL, 'FS 12 Details', 'computed', NULL, 'other'),
  ('fs_12_remark', '{{FS_12_REMARK}}', NULL, 'FS 12 Remark', 'computed', NULL, 'other'),
  ('fs_12_office', '{{FS_12_OFFICE}}', NULL, 'FS 12 Office', 'computed', NULL, 'other'),
  ('fs_13_details', '{{FS_13_DETAILS}}', NULL, 'FS 13 Details', 'computed', NULL, 'other'),
  ('fs_13_remark', '{{FS_13_REMARK}}', NULL, 'FS 13 Remark', 'computed', NULL, 'other'),
  ('fs_13_office', '{{FS_13_OFFICE}}', NULL, 'FS 13 Office', 'computed', NULL, 'other'),
  ('fs_14_details', '{{FS_14_DETAILS}}', NULL, 'FS 14 Details', 'computed', NULL, 'other'),
  ('fs_14_remark', '{{FS_14_REMARK}}', NULL, 'FS 14 Remark', 'computed', NULL, 'other'),
  ('fs_14_office', '{{FS_14_OFFICE}}', NULL, 'FS 14 Office', 'computed', NULL, 'other'),
  ('fs_fsi_plot', '{{FS_FSI_PLOT}}', NULL, 'FS FSI Plot', 'computed', NULL, 'other'),
  ('fs_fsi_033', '{{FS_FSI_033}}', NULL, 'FS FSI 033', 'computed', NULL, 'other'),
  ('fs_fsi_tdr', '{{FS_FSI_TDR}}', NULL, 'FS FSI TDR', 'computed', NULL, 'other'),
  ('fs_fsi_dcr', '{{FS_FSI_DCR}}', NULL, 'FS FSI DCR', 'computed', NULL, 'other'),
  ('fs_fsi_total', '{{FS_FSI_TOTAL}}', NULL, 'FS FSI Total', 'computed', NULL, 'other'),
  ('fs_15_details', '{{FS_15_DETAILS}}', NULL, 'FS 15 Details', 'computed', NULL, 'other'),
  ('fs_15_remark', '{{FS_15_REMARK}}', NULL, 'FS 15 Remark', 'computed', NULL, 'other'),
  ('fs_15_office', '{{FS_15_OFFICE}}', NULL, 'FS 15 Office', 'computed', NULL, 'other'),
  ('fs_16_details', '{{FS_16_DETAILS}}', NULL, 'FS 16 Details', 'computed', NULL, 'other'),
  ('fs_16_remark', '{{FS_16_REMARK}}', NULL, 'FS 16 Remark', 'computed', NULL, 'other'),
  ('fs_16_office', '{{FS_16_OFFICE}}', NULL, 'FS 16 Office', 'computed', NULL, 'other'),
  ('fs_17_details', '{{FS_17_DETAILS}}', NULL, 'FS 17 Details', 'computed', NULL, 'other'),
  ('fs_17_remark', '{{FS_17_REMARK}}', NULL, 'FS 17 Remark', 'computed', NULL, 'other'),
  ('fs_17_office', '{{FS_17_OFFICE}}', NULL, 'FS 17 Office', 'computed', NULL, 'other'),
  ('fs_18_details', '{{FS_18_DETAILS}}', NULL, 'FS 18 Details', 'computed', NULL, 'other'),
  ('fs_18_remark', '{{FS_18_REMARK}}', NULL, 'FS 18 Remark', 'computed', NULL, 'other'),
  ('fs_18_office', '{{FS_18_OFFICE}}', NULL, 'FS 18 Office', 'computed', NULL, 'other'),
  ('fs_19_details', '{{FS_19_DETAILS}}', NULL, 'FS 19 Details', 'computed', NULL, 'other'),
  ('fs_19_remark', '{{FS_19_REMARK}}', NULL, 'FS 19 Remark', 'computed', NULL, 'other'),
  ('fs_19_office', '{{FS_19_OFFICE}}', NULL, 'FS 19 Office', 'computed', NULL, 'other'),
  ('fs_20_details', '{{FS_20_DETAILS}}', NULL, 'FS 20 Details', 'computed', NULL, 'other'),
  ('fs_20_remark', '{{FS_20_REMARK}}', NULL, 'FS 20 Remark', 'computed', NULL, 'other'),
  ('fs_20_office', '{{FS_20_OFFICE}}', NULL, 'FS 20 Office', 'computed', NULL, 'other'),
  ('architect_ls_reg_no', '{{ARCHITECT_LS_REG_NO}}', NULL, 'Architect LS REG NO', 'computed', NULL, 'other'),
  ('occupied_vacated_structures_count', '{{OCCUPIED_VACATED_STRUCTURES_COUNT}}', NULL, 'Occupied Vacated Structures Count', 'computed', NULL, 'other'),
  ('access_width', '{{ACCESS_WIDTH}}', NULL, 'Access Width', 'computed', NULL, 'other'),
  ('other_site_observation', '{{OTHER_SITE_OBSERVATION}}', NULL, 'Other Site Observation', 'computed', NULL, 'other'),
  ('scr_01_approval_required', '{{SCR_01_APPROVAL_REQUIRED}}', NULL, 'SCR 01 Approval Required', 'computed', NULL, 'other'),
  ('scr_01_justification', '{{SCR_01_JUSTIFICATION}}', NULL, 'SCR 01 Justification', 'computed', NULL, 'other'),
  ('scr_01_ae_se_comments', '{{SCR_01_AE_SE_COMMENTS}}', NULL, 'SCR 01 AE SE Comments', 'computed', NULL, 'other'),
  ('scr_01_ee_comments', '{{SCR_01_EE_COMMENTS}}', NULL, 'SCR 01 EE Comments', 'computed', NULL, 'other'),
  ('scr_02_approval_required', '{{SCR_02_APPROVAL_REQUIRED}}', NULL, 'SCR 02 Approval Required', 'computed', NULL, 'other'),
  ('scr_02_justification', '{{SCR_02_JUSTIFICATION}}', NULL, 'SCR 02 Justification', 'computed', NULL, 'other'),
  ('scr_02_ae_se_comments', '{{SCR_02_AE_SE_COMMENTS}}', NULL, 'SCR 02 AE SE Comments', 'computed', NULL, 'other'),
  ('scr_02_ee_comments', '{{SCR_02_EE_COMMENTS}}', NULL, 'SCR 02 EE Comments', 'computed', NULL, 'other'),
  ('scr_03_approval_required', '{{SCR_03_APPROVAL_REQUIRED}}', NULL, 'SCR 03 Approval Required', 'computed', NULL, 'other'),
  ('scr_03_justification', '{{SCR_03_JUSTIFICATION}}', NULL, 'SCR 03 Justification', 'computed', NULL, 'other'),
  ('scr_03_ae_se_comments', '{{SCR_03_AE_SE_COMMENTS}}', NULL, 'SCR 03 AE SE Comments', 'computed', NULL, 'other'),
  ('scr_03_ee_comments', '{{SCR_03_EE_COMMENTS}}', NULL, 'SCR 03 EE Comments', 'computed', NULL, 'other'),
  ('comments_dy_che_chce_dp', '{{COMMENTS_DY_CHE_CHCE_DP}}', NULL, 'Comments DY CHE Chce DP', 'computed', NULL, 'other'),
  ('recommended_che_dp_to_mc', '{{RECOMMENDED_CHE_DP_TO_MC}}', NULL, 'Recommended CHE DP TO MC', 'computed', NULL, 'other'),
  ('location', '{{LOCATION}}', NULL, 'Location', 'computed', NULL, 'other'),
  ('dp_road_fsi_advantage', '{{DP_ROAD_FSI_ADVANTAGE}}', NULL, 'DP Road FSI Advantage', 'computed', NULL, 'other'),
  ('sewer_distance_meters', '{{SEWER_DISTANCE_METERS}}', NULL, 'Sewer Distance Meters', 'computed', NULL, 'other'),
  ('plot_user', '{{PLOT_USER}}', NULL, 'Plot User', 'computed', NULL, 'other'),
  ('rg_percent', '{{RG_PERCENT}}', NULL, 'RG Percent', 'computed', NULL, 'other'),
  ('low_lying_rl', '{{LOW_LYING_RL}}', NULL, 'LOW Lying RL', 'computed', NULL, 'other'),
  ('security_deposit', '{{SECURITY_DEPOSIT}}', NULL, 'Security Deposit', 'computed', NULL, 'other'),
  ('rg_plot_reference', '{{RG_PLOT_REFERENCE}}', NULL, 'RG Plot Reference', 'computed', NULL, 'other'),
  ('schedule_of_property', '{{SCHEDULE_OF_PROPERTY}}', NULL, 'Schedule OF Property', 'computed', NULL, 'other'),
  ('architect_full_name_address', '{{ARCHITECT_FULL_NAME_ADDRESS}}', NULL, 'Architect Full Name Address', 'computed', NULL, 'other'),
  ('owner_full_name_address', '{{OWNER_FULL_NAME_ADDRESS}}', NULL, 'Owner Full Name Address', 'computed', NULL, 'other'),
  ('che_no_1', '{{CHE_NO_1}}', NULL, 'CHE NO 1', 'computed', NULL, 'other'),
  ('che_no_2', '{{CHE_NO_2}}', NULL, 'CHE NO 2', 'computed', NULL, 'other'),
  ('che_no_3', '{{CHE_NO_3}}', NULL, 'CHE NO 3', 'computed', NULL, 'other'),
  ('architect_name_address', '{{ARCHITECT_NAME_ADDRESS}}', NULL, 'Architect Name Address', 'computed', NULL, 'other'),
  ('cscts_no', '{{CSCTS_NO}}', NULL, 'Cscts NO', 'computed', NULL, 'other'),
  ('public_purpose_reservation', '{{PUBLIC_PURPOSE_RESERVATION}}', NULL, 'Public Purpose Reservation', 'computed', NULL, 'other'),
  ('reservation_area_use', '{{RESERVATION_AREA_USE}}', NULL, 'Reservation Area USE', 'computed', NULL, 'other'),
  ('board_reservation_use', '{{BOARD_RESERVATION_USE}}', NULL, 'Board Reservation USE', 'computed', NULL, 'other'),
  ('specific_term_1', '{{SPECIFIC_TERM_1}}', NULL, 'Specific Term 1', 'computed', NULL, 'other'),
  ('specific_term_2', '{{SPECIFIC_TERM_2}}', NULL, 'Specific Term 2', 'computed', NULL, 'other'),
  ('specific_term_3', '{{SPECIFIC_TERM_3}}', NULL, 'Specific Term 3', 'computed', NULL, 'other'),
  ('specific_term_4', '{{SPECIFIC_TERM_4}}', NULL, 'Specific Term 4', 'computed', NULL, 'other'),
  ('division', '{{DIVISION}}', NULL, 'Division', 'computed', NULL, 'other'),
  ('layout_approval_date', '{{LAYOUT_APPROVAL_DATE}}', NULL, 'Layout Approval Date', 'computed', NULL, 'other'),
  ('compliance_remark_01', '{{COMPLIANCE_REMARK_01}}', NULL, 'Compliance Remark 01', 'computed', NULL, 'other'),
  ('compliance_remark_02', '{{COMPLIANCE_REMARK_02}}', NULL, 'Compliance Remark 02', 'computed', NULL, 'other'),
  ('compliance_remark_03', '{{COMPLIANCE_REMARK_03}}', NULL, 'Compliance Remark 03', 'computed', NULL, 'other'),
  ('compliance_remark_04', '{{COMPLIANCE_REMARK_04}}', NULL, 'Compliance Remark 04', 'computed', NULL, 'other'),
  ('compliance_remark_05', '{{COMPLIANCE_REMARK_05}}', NULL, 'Compliance Remark 05', 'computed', NULL, 'other'),
  ('compliance_remark_06', '{{COMPLIANCE_REMARK_06}}', NULL, 'Compliance Remark 06', 'computed', NULL, 'other'),
  ('compliance_remark_07', '{{COMPLIANCE_REMARK_07}}', NULL, 'Compliance Remark 07', 'computed', NULL, 'other'),
  ('compliance_remark_08', '{{COMPLIANCE_REMARK_08}}', NULL, 'Compliance Remark 08', 'computed', NULL, 'other'),
  ('compliance_remark_09', '{{COMPLIANCE_REMARK_09}}', NULL, 'Compliance Remark 09', 'computed', NULL, 'other'),
  ('compliance_remark_10', '{{COMPLIANCE_REMARK_10}}', NULL, 'Compliance Remark 10', 'computed', NULL, 'other'),
  ('compliance_remark_11', '{{COMPLIANCE_REMARK_11}}', NULL, 'Compliance Remark 11', 'computed', NULL, 'other'),
  ('plot_user_purpose', '{{PLOT_USER_PURPOSE}}', NULL, 'Plot User Purpose', 'computed', NULL, 'other'),
  ('compliance_remark_12', '{{COMPLIANCE_REMARK_12}}', NULL, 'Compliance Remark 12', 'computed', NULL, 'other'),
  ('rg_percent_of_layout', '{{RG_PERCENT_OF_LAYOUT}}', NULL, 'RG Percent OF Layout', 'computed', NULL, 'other'),
  ('compliance_remark_13', '{{COMPLIANCE_REMARK_13}}', NULL, 'Compliance Remark 13', 'computed', NULL, 'other'),
  ('compliance_remark_14', '{{COMPLIANCE_REMARK_14}}', NULL, 'Compliance Remark 14', 'computed', NULL, 'other'),
  ('compliance_remark_15', '{{COMPLIANCE_REMARK_15}}', NULL, 'Compliance Remark 15', 'computed', NULL, 'other'),
  ('compliance_remark_16', '{{COMPLIANCE_REMARK_16}}', NULL, 'Compliance Remark 16', 'computed', NULL, 'other'),
  ('reduced_level_thd', '{{REDUCED_LEVEL_THD}}', NULL, 'Reduced Level THD', 'computed', NULL, 'other'),
  ('compliance_remark_17', '{{COMPLIANCE_REMARK_17}}', NULL, 'Compliance Remark 17', 'computed', NULL, 'other'),
  ('compliance_remark_18', '{{COMPLIANCE_REMARK_18}}', NULL, 'Compliance Remark 18', 'computed', NULL, 'other'),
  ('security_deposit_rs', '{{SECURITY_DEPOSIT_RS}}', NULL, 'Security Deposit RS', 'computed', NULL, 'other'),
  ('compliance_remark_19', '{{COMPLIANCE_REMARK_19}}', NULL, 'Compliance Remark 19', 'computed', NULL, 'other'),
  ('compliance_remark_20', '{{COMPLIANCE_REMARK_20}}', NULL, 'Compliance Remark 20', 'computed', NULL, 'other'),
  ('compliance_remark_21', '{{COMPLIANCE_REMARK_21}}', NULL, 'Compliance Remark 21', 'computed', NULL, 'other'),
  ('compliance_remark_22', '{{COMPLIANCE_REMARK_22}}', NULL, 'Compliance Remark 22', 'computed', NULL, 'other'),
  ('compliance_remark_23', '{{COMPLIANCE_REMARK_23}}', NULL, 'Compliance Remark 23', 'computed', NULL, 'other'),
  ('compliance_remark_24', '{{COMPLIANCE_REMARK_24}}', NULL, 'Compliance Remark 24', 'computed', NULL, 'other'),
  ('compliance_remark_25', '{{COMPLIANCE_REMARK_25}}', NULL, 'Compliance Remark 25', 'computed', NULL, 'other'),
  ('rg_plot_identification', '{{RG_PLOT_IDENTIFICATION}}', NULL, 'RG Plot Identification', 'computed', NULL, 'other'),
  ('compliance_remark_26', '{{COMPLIANCE_REMARK_26}}', NULL, 'Compliance Remark 26', 'computed', NULL, 'other'),
  ('compliance_remark_27', '{{COMPLIANCE_REMARK_27}}', NULL, 'Compliance Remark 27', 'computed', NULL, 'other'),
  ('compliance_remark_28', '{{COMPLIANCE_REMARK_28}}', NULL, 'Compliance Remark 28', 'computed', NULL, 'other'),
  ('compliance_remark_29', '{{COMPLIANCE_REMARK_29}}', NULL, 'Compliance Remark 29', 'computed', NULL, 'other'),
  ('compliance_remark_30', '{{COMPLIANCE_REMARK_30}}', NULL, 'Compliance Remark 30', 'computed', NULL, 'other'),
  ('compliance_remark_31', '{{COMPLIANCE_REMARK_31}}', NULL, 'Compliance Remark 31', 'computed', NULL, 'other')
ON CONFLICT (id) DO UPDATE SET
  token = EXCLUDED.token,
  label = EXCLUDED.label,
  source_table = EXCLUDED.source_table,
  source_column = EXCLUDED.source_column,
  ui_group = EXCLUDED.ui_group,
  is_active = true,
  updated_at = now();

INSERT INTO public.application_type_placeholders
  (application_type_id, placeholder_id, required, sort_order)
SELECT t.id, v.placeholder_id, false, v.sort_order
FROM public.application_types t
CROSS JOIN (
  VALUES
    ('village_division', 10),
    ('cts_cs_no', 20),
    ('architect_ls_name', 30)
) AS v(placeholder_id, sort_order)
WHERE t.slug = 'layout_approval'
ON CONFLICT (application_type_id, placeholder_id) DO UPDATE SET
  required = EXCLUDED.required,
  sort_order = EXCLUDED.sort_order;

INSERT INTO public.application_type_placeholders
  (application_type_id, placeholder_id, required, sort_order)
SELECT t.id, v.placeholder_id, false, v.sort_order
FROM public.application_types t
CROSS JOIN (
  VALUES
    ('layout_file_no', 10),
    ('cts_cs_no', 20),
    ('village', 30)
) AS v(placeholder_id, sort_order)
WHERE t.slug = 'layout_completion'
ON CONFLICT (application_type_id, placeholder_id) DO UPDATE SET
  required = EXCLUDED.required,
  sort_order = EXCLUDED.sort_order;

INSERT INTO public.application_document_placeholders
  (document_id, placeholder_id, required, sort_order)
SELECT d.id, v.placeholder_id, false, v.sort_order
FROM public.application_documents d
CROSS JOIN (
  VALUES
    ('cts_cno_fp_no', 10),
    ('village_division', 20),
    ('architect_ls_name', 30),
    ('architect_ls_office', 40),
    ('pay_order_no', 50),
    ('pay_order_date', 60),
    ('dp_reservation', 70),
    ('sanctioned_dp_plan', 80),
    ('owner_name_signature', 90)
) AS v(placeholder_id, sort_order)
WHERE d.slug = 'layout_approval_application'
ON CONFLICT (document_id, placeholder_id) DO UPDATE SET
  required = EXCLUDED.required,
  sort_order = EXCLUDED.sort_order;

INSERT INTO public.application_document_placeholders
  (document_id, placeholder_id, required, sort_order)
SELECT d.id, v.placeholder_id, false, v.sort_order
FROM public.application_documents d
CROSS JOIN (
  VALUES
    ('ward', 10),
    ('case_no', 20),
    ('cts_cs_no', 30),
    ('fp_no', 40),
    ('tps_no', 50),
    ('village_division', 60),
    ('date_of_submission', 70),
    ('brief_description', 80),
    ('owner_developer', 90),
    ('licensed_plumber', 100),
    ('road_consultant', 110),
    ('plans_approval_page', 120),
    ('fs_01_details', 130),
    ('fs_01_remark', 140),
    ('fs_01_office', 150),
    ('fs_02_details', 160),
    ('fs_02_remark', 170),
    ('fs_02_office', 180),
    ('fs_03_details', 190),
    ('fs_03_remark', 200),
    ('fs_03_office', 210),
    ('fs_04_details', 220),
    ('fs_04_remark', 230),
    ('fs_04_office', 240),
    ('fs_05_details', 250),
    ('fs_05_remark', 260),
    ('fs_05_office', 270),
    ('fs_06_details', 280),
    ('fs_06_remark', 290),
    ('fs_06_office', 300),
    ('fs_07_details', 310),
    ('fs_07_remark', 320),
    ('fs_07_office', 330),
    ('fs_08_details', 340),
    ('fs_08_remark', 350),
    ('fs_08_office', 360),
    ('fs_09_details', 370),
    ('fs_09_remark', 380),
    ('fs_09_office', 390),
    ('fs_dp_1967_des', 400),
    ('fs_dp_1991_des', 410),
    ('fs_dp_2034_des', 420),
    ('fs_dp_1967_res', 430),
    ('fs_dp_1991_res', 440),
    ('fs_dp_2034_res', 450),
    ('fs_dp_1967_zone', 460),
    ('fs_dp_1991_zone', 470),
    ('fs_dp_2034_zone', 480),
    ('fs_dp_1967_rem', 490),
    ('fs_dp_1991_rem', 500),
    ('fs_dp_2034_rem', 510),
    ('fs_10_details', 520),
    ('fs_10_remark', 530),
    ('fs_10_office', 540),
    ('fs_11_details', 550),
    ('fs_11_remark', 560),
    ('fs_11_office', 570),
    ('fs_12_details', 580),
    ('fs_12_remark', 590),
    ('fs_12_office', 600),
    ('fs_13_details', 610),
    ('fs_13_remark', 620),
    ('fs_13_office', 630),
    ('fs_14_details', 640),
    ('fs_14_remark', 650),
    ('fs_14_office', 660),
    ('fs_fsi_plot', 670),
    ('fs_fsi_033', 680),
    ('fs_fsi_tdr', 690),
    ('fs_fsi_dcr', 700),
    ('fs_fsi_total', 710),
    ('fs_15_details', 720),
    ('fs_15_remark', 730),
    ('fs_15_office', 740),
    ('fs_16_details', 750),
    ('fs_16_remark', 760),
    ('fs_16_office', 770),
    ('fs_17_details', 780),
    ('fs_17_remark', 790),
    ('fs_17_office', 800),
    ('fs_18_details', 810),
    ('fs_18_remark', 820),
    ('fs_18_office', 830),
    ('fs_19_details', 840),
    ('fs_19_remark', 850),
    ('fs_19_office', 860),
    ('fs_20_details', 870),
    ('fs_20_remark', 880),
    ('fs_20_office', 890),
    ('architect_ls_name', 900),
    ('architect_ls_signature', 910),
    ('architect_ls_reg_no', 920),
    ('site_visit_date', 930),
    ('occupied_vacated_structures_count', 940),
    ('encroachment_side', 950),
    ('access_width', 960),
    ('other_site_observation', 970)
) AS v(placeholder_id, sort_order)
WHERE d.slug = 'layout_architect_ls_fact_sheet'
ON CONFLICT (document_id, placeholder_id) DO UPDATE SET
  required = EXCLUDED.required,
  sort_order = EXCLUDED.sort_order;

INSERT INTO public.application_document_placeholders
  (document_id, placeholder_id, required, sort_order)
SELECT d.id, v.placeholder_id, false, v.sort_order
FROM public.application_documents d
CROSS JOIN (
  VALUES
    ('scr_01_approval_required', 10),
    ('scr_01_justification', 20),
    ('scr_01_ae_se_comments', 30),
    ('scr_01_ee_comments', 40),
    ('scr_02_approval_required', 50),
    ('scr_02_justification', 60),
    ('scr_02_ae_se_comments', 70),
    ('scr_02_ee_comments', 80),
    ('scr_03_approval_required', 90),
    ('scr_03_justification', 100),
    ('scr_03_ae_se_comments', 110),
    ('scr_03_ee_comments', 120),
    ('comments_dy_che_chce_dp', 130),
    ('comments_chief_engineer', 140),
    ('recommended_che_dp_to_mc', 150)
) AS v(placeholder_id, sort_order)
WHERE d.slug = 'layout_permission_scrutiny_report'
ON CONFLICT (document_id, placeholder_id) DO UPDATE SET
  required = EXCLUDED.required,
  sort_order = EXCLUDED.sort_order;

INSERT INTO public.application_document_placeholders
  (document_id, placeholder_id, required, sort_order)
SELECT d.id, v.placeholder_id, false, v.sort_order
FROM public.application_documents d
CROSS JOIN (
  VALUES
    ('cts_cs_no', 10),
    ('village_division', 20),
    ('location', 30),
    ('file_no', 40),
    ('dp_road_width', 50),
    ('dp_road_fsi_advantage', 60),
    ('sewer_distance_meters', 70),
    ('plot_user', 80),
    ('rg_percent', 90),
    ('low_lying_rl', 100),
    ('security_deposit', 110),
    ('rg_plot_reference', 120),
    ('schedule_of_property', 130),
    ('architect_full_name_address', 140),
    ('owner_full_name_address', 150)
) AS v(placeholder_id, sort_order)
WHERE d.slug = 'layout_undertaking_terms_conditions'
ON CONFLICT (document_id, placeholder_id) DO UPDATE SET
  required = EXCLUDED.required,
  sort_order = EXCLUDED.sort_order;

INSERT INTO public.application_document_placeholders
  (document_id, placeholder_id, required, sort_order)
SELECT d.id, v.placeholder_id, false, v.sort_order
FROM public.application_documents d
CROSS JOIN (
  VALUES
    ('che_no_1', 10),
    ('che_no_2', 20),
    ('che_no_3', 30),
    ('architect_name_address', 40),
    ('cscts_no', 50),
    ('public_purpose_reservation', 60),
    ('reservation_area_use', 70),
    ('board_reservation_use', 80),
    ('specific_term_1', 90),
    ('specific_term_2', 100),
    ('specific_term_3', 110),
    ('specific_term_4', 120)
) AS v(placeholder_id, sort_order)
WHERE d.slug = 'layout_terms_development_permission'
ON CONFLICT (document_id, placeholder_id) DO UPDATE SET
  required = EXCLUDED.required,
  sort_order = EXCLUDED.sort_order;

INSERT INTO public.application_document_placeholders
  (document_id, placeholder_id, required, sort_order)
SELECT d.id, v.placeholder_id, false, v.sort_order
FROM public.application_documents d
CROSS JOIN (
  VALUES
    ('cts_cs_no', 10),
    ('village', 20),
    ('division', 30),
    ('layout_file_no', 40),
    ('layout_approval_date', 50)
) AS v(placeholder_id, sort_order)
WHERE d.slug = 'layout_completion_certificate_application'
ON CONFLICT (document_id, placeholder_id) DO UPDATE SET
  required = EXCLUDED.required,
  sort_order = EXCLUDED.sort_order;

INSERT INTO public.application_document_placeholders
  (document_id, placeholder_id, required, sort_order)
SELECT d.id, v.placeholder_id, false, v.sort_order
FROM public.application_documents d
CROSS JOIN (
  VALUES
    ('layout_file_no', 10),
    ('compliance_remark_01', 20),
    ('compliance_remark_02', 30),
    ('compliance_remark_03', 40),
    ('compliance_remark_04', 50),
    ('compliance_remark_05', 60),
    ('compliance_remark_06', 70),
    ('compliance_remark_07', 80),
    ('compliance_remark_08', 90),
    ('compliance_remark_09', 100),
    ('compliance_remark_10', 110),
    ('compliance_remark_11', 120),
    ('plot_user_purpose', 130),
    ('compliance_remark_12', 140),
    ('rg_percent_of_layout', 150),
    ('compliance_remark_13', 160),
    ('compliance_remark_14', 170),
    ('compliance_remark_15', 180),
    ('compliance_remark_16', 190),
    ('reduced_level_thd', 200),
    ('compliance_remark_17', 210),
    ('compliance_remark_18', 220),
    ('security_deposit_rs', 230),
    ('compliance_remark_19', 240),
    ('compliance_remark_20', 250),
    ('compliance_remark_21', 260),
    ('compliance_remark_22', 270),
    ('compliance_remark_23', 280),
    ('compliance_remark_24', 290),
    ('compliance_remark_25', 300),
    ('rg_plot_identification', 310),
    ('compliance_remark_26', 320),
    ('compliance_remark_27', 330),
    ('compliance_remark_28', 340),
    ('compliance_remark_29', 350),
    ('compliance_remark_30', 360),
    ('compliance_remark_31', 370)
) AS v(placeholder_id, sort_order)
WHERE d.slug = 'layout_compliances_report'
ON CONFLICT (document_id, placeholder_id) DO UPDATE SET
  required = EXCLUDED.required,
  sort_order = EXCLUDED.sort_order;

