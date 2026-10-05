-- MahaRERA: Registration + Quarterly Forms 1/2/3 + Annual Form 2A/Form 5
-- Catalog only. No TypeScript. Reuse project/owner/date tokens; rest computed.

-- ---------------------------------------------------------------------------
-- Application types
-- ---------------------------------------------------------------------------
INSERT INTO public.application_types
  (slug, department, application_title, description, category,
   applicant_type, planning_authorities, requires_roster_match,
   sort_order, icon_key, is_active)
VALUES
  (
    'maharera_registration',
    'MahaRERA',
    'Registration',
    'MahaRERA project registration disclosures, annexures, Format A/D, and Form B',
    'department_permission',
    NULL,
    '{}'::text[],
    false,
    10,
    'rera',
    true
  ),
  (
    'maharera_forms_1_2_3_quarterly',
    'MahaRERA',
    'Quarterly Forms 1 / 2 / 3',
    'Architect, Engineer and CA certificates for designated bank account withdrawal (Order 56/2024)',
    'department_permission',
    NULL,
    '{}'::text[],
    false,
    20,
    'rera',
    true
  ),
  (
    'maharera_form_2a_form_5_annual',
    'MahaRERA',
    'Annual Form 2A / Form 5',
    'Form 2A is due within 3 months after the financial year-end, and Form 5 within 6 months after the financial year-end.',
    'department_permission',
    NULL,
    '{}'::text[],
    false,
    30,
    'rera',
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
      'maharera_disclosure_secured_unsecured_finance',
      'Disclosure – Secured/Unsecured Finance',
      'DraftDesk_MahaRERA_Registration/01_disclosure_secured_unsecured_finance_VERBATIM.html',
      ARRAY['owner']::text[],
      'owner',
      10
    ),
    (
      'maharera_disclosure_interest_other_reo',
      'Disclosure of Interest – Designated Partners',
      'DraftDesk_MahaRERA_Registration/02_disclosure_interest_other_real_estate_organizations_VERBATIM.html',
      ARRAY['owner']::text[],
      'owner',
      20
    ),
    (
      'maharera_annexure_a_declaration_undertaking',
      'Annexure A – Declaration-Cum-Undertaking',
      'DraftDesk_MahaRERA_Registration/03_annexure_a_declaration_cum_undertaking_VERBATIM.html',
      ARRAY['owner']::text[],
      'owner',
      30
    ),
    (
      'maharera_format_a_designated_bank_accounts',
      'Format A – RERA Designated Bank Accounts',
      'DraftDesk_MahaRERA_Registration/04_format_a_rera_designated_bank_accounts_VERBATIM.html',
      ARRAY['owner']::text[],
      'owner',
      40
    ),
    (
      'maharera_format_d_declaration_cc',
      'Format D – Declaration about Commencement Certificate',
      'DraftDesk_MahaRERA_Registration/05_format_d_declaration_commencement_certificate_VERBATIM.html',
      ARRAY['owner']::text[],
      'owner',
      50
    ),
    (
      'maharera_form_b_both_promoters',
      'Form B – Affidavit cum Declaration (Both Promoters)',
      'DraftDesk_MahaRERA_Registration/06_form_b_affidavit_cum_declaration_BOTH_PROMOTERS_VERBATIM.html',
      ARRAY['owner']::text[],
      'owner',
      60
    ),
    (
      'maharera_form_b_promoter_only',
      'Form B – Promoter / Developer',
      'DraftDesk_MahaRERA_Registration/07_form_b_promoter_only_VERBATIM.html',
      ARRAY['owner']::text[],
      'owner',
      70
    ),
    (
      'maharera_form_b_society_landowner',
      'Form B – Society / Landowner',
      'DraftDesk_MahaRERA_Registration/08_form_b_society_landowner_only_VERBATIM.html',
      ARRAY['owner']::text[],
      'owner',
      80
    )
) AS v(slug, category, html, sign, letterhead_source, sort_order)
WHERE t.slug = 'maharera_registration'
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
      'maharera_form_1_architect_certificate',
      'Form 1 – Architect''s Certificate',
      'DraftDesk_MahaRERA_Forms_1_2_3_Quarterly/01_Form_1_Architect_Certificate_VERBATIM.html',
      ARRAY['architect_or_ls']::text[],
      'architect_or_ls',
      10
    ),
    (
      'maharera_form_2_engineer_certificate',
      'Form 2 – Engineer''s Certificate',
      'DraftDesk_MahaRERA_Forms_1_2_3_Quarterly/02_Form_2_Engineer_Certificate_VERBATIM.html',
      ARRAY['consultant']::text[],
      'consultant',
      20
    ),
    (
      'maharera_form_3_ca_certificate',
      'Form 3 – Chartered Accountant''s Certificate',
      'DraftDesk_MahaRERA_Forms_1_2_3_Quarterly/03_Form_3_CA_Certificate_VERBATIM.html',
      ARRAY['owner']::text[],
      'owner',
      30
    )
) AS v(slug, category, html, sign, letterhead_source, sort_order)
WHERE t.slug = 'maharera_forms_1_2_3_quarterly'
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
      'maharera_form_2a_quality_assurance',
      'Form 2A – Quality Assurance (2024)',
      'DraftDesk_MahaRERA_Form_2A_Form_5_Annual/01_Form_2A_Quality_Assurance_2024_VERBATIM.html',
      ARRAY['consultant']::text[],
      'consultant',
      10
    ),
    (
      'maharera_form_5_annual_report_accounts',
      'Form 5 – Annual Report on Statement of Accounts',
      'DraftDesk_MahaRERA_Form_2A_Form_5_Annual/02_Form_5_Annual_Report_Statement_Accounts_VERBATIM.html',
      ARRAY['consultant']::text[],
      'consultant',
      20
    )
) AS v(slug, category, html, sign, letterhead_source, sort_order)
WHERE t.slug = 'maharera_form_2a_form_5_annual'
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
-- New master placeholders (computed / Letter fields)
-- ---------------------------------------------------------------------------
INSERT INTO public.placeholders
  (id, token, legacy_token, label, source_table, source_column, ui_group)
VALUES
  ('bank_branch_name_address', '{{BANK_BRANCH_NAME_ADDRESS}}', NULL, 'Bank Branch Name Address', 'computed', NULL, 'other'),
  ('bank_ifsc', '{{BANK_IFSC}}', NULL, 'Bank Ifsc', 'computed', NULL, 'other'),
  ('bank_name', '{{BANK_NAME}}', NULL, 'Bank Name', 'computed', NULL, 'other'),
  ('borrowing_disbursement_date', '{{BORROWING_DISBURSEMENT_DATE}}', NULL, 'Borrowing Disbursement Date', 'computed', NULL, 'other'),
  ('branch_manager_email', '{{BRANCH_MANAGER_EMAIL}}', NULL, 'Branch Manager Email', 'computed', NULL, 'other'),
  ('building_approval_date', '{{BUILDING_APPROVAL_DATE}}', NULL, 'Building Approval Date', 'computed', NULL, 'other'),
  ('building_approved_configuration', '{{BUILDING_APPROVED_CONFIGURATION}}', NULL, 'Building Approved Configuration', 'computed', NULL, 'other'),
  ('cc_approval_date', '{{CC_APPROVAL_DATE}}', NULL, 'Cc Approval Date', 'computed', NULL, 'other'),
  ('cc_granted_habitable_floors', '{{CC_GRANTED_HABITABLE_FLOORS}}', NULL, 'Cc Granted Habitable Floors', 'computed', NULL, 'other'),
  ('collection_account_no', '{{COLLECTION_ACCOUNT_NO}}', NULL, 'Collection Account No', 'computed', NULL, 'other'),
  ('declarant_capacity', '{{DECLARANT_CAPACITY}}', NULL, 'Declarant Capacity', 'computed', NULL, 'other'),
  ('declarant_capacity_2', '{{DECLARANT_CAPACITY_2}}', NULL, 'Declarant Capacity 2', 'computed', NULL, 'other'),
  ('designated_promoter_name', '{{DESIGNATED_PROMOTER_NAME}}', NULL, 'Designated Promoter Name', 'computed', NULL, 'other'),
  ('disbursed_amount', '{{DISBURSED_AMOUNT}}', NULL, 'Disbursed Amount', 'computed', NULL, 'other'),
  ('f1_common_01_details', '{{F1_COMMON_01_DETAILS}}', NULL, 'F1 Common 01 Details', 'computed', NULL, 'other'),
  ('f1_common_01_percent', '{{F1_COMMON_01_PERCENT}}', NULL, 'F1 Common 01 Percent', 'computed', NULL, 'other'),
  ('f1_common_01_proposed', '{{F1_COMMON_01_PROPOSED}}', NULL, 'F1 Common 01 Proposed', 'computed', NULL, 'other'),
  ('f1_common_02_details', '{{F1_COMMON_02_DETAILS}}', NULL, 'F1 Common 02 Details', 'computed', NULL, 'other'),
  ('f1_common_02_percent', '{{F1_COMMON_02_PERCENT}}', NULL, 'F1 Common 02 Percent', 'computed', NULL, 'other'),
  ('f1_common_02_proposed', '{{F1_COMMON_02_PROPOSED}}', NULL, 'F1 Common 02 Proposed', 'computed', NULL, 'other'),
  ('f1_common_03_details', '{{F1_COMMON_03_DETAILS}}', NULL, 'F1 Common 03 Details', 'computed', NULL, 'other'),
  ('f1_common_03_percent', '{{F1_COMMON_03_PERCENT}}', NULL, 'F1 Common 03 Percent', 'computed', NULL, 'other'),
  ('f1_common_03_proposed', '{{F1_COMMON_03_PROPOSED}}', NULL, 'F1 Common 03 Proposed', 'computed', NULL, 'other'),
  ('f1_common_04_details', '{{F1_COMMON_04_DETAILS}}', NULL, 'F1 Common 04 Details', 'computed', NULL, 'other'),
  ('f1_common_04_percent', '{{F1_COMMON_04_PERCENT}}', NULL, 'F1 Common 04 Percent', 'computed', NULL, 'other'),
  ('f1_common_04_proposed', '{{F1_COMMON_04_PROPOSED}}', NULL, 'F1 Common 04 Proposed', 'computed', NULL, 'other'),
  ('f1_common_05_details', '{{F1_COMMON_05_DETAILS}}', NULL, 'F1 Common 05 Details', 'computed', NULL, 'other'),
  ('f1_common_05_percent', '{{F1_COMMON_05_PERCENT}}', NULL, 'F1 Common 05 Percent', 'computed', NULL, 'other'),
  ('f1_common_05_proposed', '{{F1_COMMON_05_PROPOSED}}', NULL, 'F1 Common 05 Proposed', 'computed', NULL, 'other'),
  ('f1_common_06_details', '{{F1_COMMON_06_DETAILS}}', NULL, 'F1 Common 06 Details', 'computed', NULL, 'other'),
  ('f1_common_06_percent', '{{F1_COMMON_06_PERCENT}}', NULL, 'F1 Common 06 Percent', 'computed', NULL, 'other'),
  ('f1_common_06_proposed', '{{F1_COMMON_06_PROPOSED}}', NULL, 'F1 Common 06 Proposed', 'computed', NULL, 'other'),
  ('f1_common_07_details', '{{F1_COMMON_07_DETAILS}}', NULL, 'F1 Common 07 Details', 'computed', NULL, 'other'),
  ('f1_common_07_percent', '{{F1_COMMON_07_PERCENT}}', NULL, 'F1 Common 07 Percent', 'computed', NULL, 'other'),
  ('f1_common_07_proposed', '{{F1_COMMON_07_PROPOSED}}', NULL, 'F1 Common 07 Proposed', 'computed', NULL, 'other'),
  ('f1_common_08_details', '{{F1_COMMON_08_DETAILS}}', NULL, 'F1 Common 08 Details', 'computed', NULL, 'other'),
  ('f1_common_08_percent', '{{F1_COMMON_08_PERCENT}}', NULL, 'F1 Common 08 Percent', 'computed', NULL, 'other'),
  ('f1_common_08_proposed', '{{F1_COMMON_08_PROPOSED}}', NULL, 'F1 Common 08 Proposed', 'computed', NULL, 'other'),
  ('f1_common_09_details', '{{F1_COMMON_09_DETAILS}}', NULL, 'F1 Common 09 Details', 'computed', NULL, 'other'),
  ('f1_common_09_percent', '{{F1_COMMON_09_PERCENT}}', NULL, 'F1 Common 09 Percent', 'computed', NULL, 'other'),
  ('f1_common_09_proposed', '{{F1_COMMON_09_PROPOSED}}', NULL, 'F1 Common 09 Proposed', 'computed', NULL, 'other'),
  ('f1_common_10_details', '{{F1_COMMON_10_DETAILS}}', NULL, 'F1 Common 10 Details', 'computed', NULL, 'other'),
  ('f1_common_10_percent', '{{F1_COMMON_10_PERCENT}}', NULL, 'F1 Common 10 Percent', 'computed', NULL, 'other'),
  ('f1_common_10_proposed', '{{F1_COMMON_10_PROPOSED}}', NULL, 'F1 Common 10 Proposed', 'computed', NULL, 'other'),
  ('f1_common_11_details', '{{F1_COMMON_11_DETAILS}}', NULL, 'F1 Common 11 Details', 'computed', NULL, 'other'),
  ('f1_common_11_percent', '{{F1_COMMON_11_PERCENT}}', NULL, 'F1 Common 11 Percent', 'computed', NULL, 'other'),
  ('f1_common_11_proposed', '{{F1_COMMON_11_PROPOSED}}', NULL, 'F1 Common 11 Proposed', 'computed', NULL, 'other'),
  ('f1_common_12_details', '{{F1_COMMON_12_DETAILS}}', NULL, 'F1 Common 12 Details', 'computed', NULL, 'other'),
  ('f1_common_12_percent', '{{F1_COMMON_12_PERCENT}}', NULL, 'F1 Common 12 Percent', 'computed', NULL, 'other'),
  ('f1_common_12_proposed', '{{F1_COMMON_12_PROPOSED}}', NULL, 'F1 Common 12 Proposed', 'computed', NULL, 'other'),
  ('f1_common_13_details', '{{F1_COMMON_13_DETAILS}}', NULL, 'F1 Common 13 Details', 'computed', NULL, 'other'),
  ('f1_common_13_percent', '{{F1_COMMON_13_PERCENT}}', NULL, 'F1 Common 13 Percent', 'computed', NULL, 'other'),
  ('f1_common_13_proposed', '{{F1_COMMON_13_PROPOSED}}', NULL, 'F1 Common 13 Proposed', 'computed', NULL, 'other'),
  ('f1_common_14_details', '{{F1_COMMON_14_DETAILS}}', NULL, 'F1 Common 14 Details', 'computed', NULL, 'other'),
  ('f1_common_14_percent', '{{F1_COMMON_14_PERCENT}}', NULL, 'F1 Common 14 Percent', 'computed', NULL, 'other'),
  ('f1_common_14_proposed', '{{F1_COMMON_14_PROPOSED}}', NULL, 'F1 Common 14 Proposed', 'computed', NULL, 'other'),
  ('f1_layout_building_wing_no', '{{F1_LAYOUT_BUILDING_WING_NO}}', NULL, 'F1 Layout Building Wing No', 'computed', NULL, 'other'),
  ('f1_license_no', '{{F1_LICENSE_NO}}', NULL, 'F1 License No', 'computed', NULL, 'other'),
  ('f1_promoter_name_address', '{{F1_PROMOTER_NAME_ADDRESS}}', NULL, 'F1 Promoter Name Address', 'computed', NULL, 'other'),
  ('f1_promoter_signature', '{{F1_PROMOTER_SIGNATURE}}', NULL, 'F1 Promoter Signature', 'computed', NULL, 'other'),
  ('f1_registered_phase_project_no', '{{F1_REGISTERED_PHASE_PROJECT_NO}}', NULL, 'F1 Registered Phase Project No', 'computed', NULL, 'other'),
  ('f1_task_01_percent', '{{F1_TASK_01_PERCENT}}', NULL, 'F1 Task 01 Percent', 'computed', NULL, 'other'),
  ('f1_task_02_percent', '{{F1_TASK_02_PERCENT}}', NULL, 'F1 Task 02 Percent', 'computed', NULL, 'other'),
  ('f1_task_03_percent', '{{F1_TASK_03_PERCENT}}', NULL, 'F1 Task 03 Percent', 'computed', NULL, 'other'),
  ('f1_task_04_percent', '{{F1_TASK_04_PERCENT}}', NULL, 'F1 Task 04 Percent', 'computed', NULL, 'other'),
  ('f1_task_05_percent', '{{F1_TASK_05_PERCENT}}', NULL, 'F1 Task 05 Percent', 'computed', NULL, 'other'),
  ('f1_task_06_percent', '{{F1_TASK_06_PERCENT}}', NULL, 'F1 Task 06 Percent', 'computed', NULL, 'other'),
  ('f1_task_07_percent', '{{F1_TASK_07_PERCENT}}', NULL, 'F1 Task 07 Percent', 'computed', NULL, 'other'),
  ('f1_task_08_percent', '{{F1_TASK_08_PERCENT}}', NULL, 'F1 Task 08 Percent', 'computed', NULL, 'other'),
  ('f1_task_09_percent', '{{F1_TASK_09_PERCENT}}', NULL, 'F1 Task 09 Percent', 'computed', NULL, 'other'),
  ('f1_task_10_percent', '{{F1_TASK_10_PERCENT}}', NULL, 'F1 Task 10 Percent', 'computed', NULL, 'other'),
  ('f1_task_11_percent', '{{F1_TASK_11_PERCENT}}', NULL, 'F1 Task 11 Percent', 'computed', NULL, 'other'),
  ('f2a_certificate_no', '{{F2A_CERTIFICATE_NO}}', NULL, 'F2A Certificate No', 'computed', NULL, 'other'),
  ('f2a_engineer_name', '{{F2A_ENGINEER_NAME}}', NULL, 'F2A Engineer Name', 'computed', NULL, 'other'),
  ('f2a_engineer_site_supervisor_name', '{{F2A_ENGINEER_SITE_SUPERVISOR_NAME}}', NULL, 'F2A Engineer Site Supervisor Name', 'computed', NULL, 'other'),
  ('f2a_input_01_no', '{{F2A_INPUT_01_NO}}', NULL, 'F2A Input 01 No', 'computed', NULL, 'other'),
  ('f2a_input_01_remarks', '{{F2A_INPUT_01_REMARKS}}', NULL, 'F2A Input 01 Remarks', 'computed', NULL, 'other'),
  ('f2a_input_01_yes', '{{F2A_INPUT_01_YES}}', NULL, 'F2A Input 01 Yes', 'computed', NULL, 'other'),
  ('f2a_input_02_no', '{{F2A_INPUT_02_NO}}', NULL, 'F2A Input 02 No', 'computed', NULL, 'other'),
  ('f2a_input_02_remarks', '{{F2A_INPUT_02_REMARKS}}', NULL, 'F2A Input 02 Remarks', 'computed', NULL, 'other')
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
VALUES
  ('f2a_input_02_yes', '{{F2A_INPUT_02_YES}}', NULL, 'F2A Input 02 Yes', 'computed', NULL, 'other'),
  ('f2a_input_03_no', '{{F2A_INPUT_03_NO}}', NULL, 'F2A Input 03 No', 'computed', NULL, 'other'),
  ('f2a_input_03_remarks', '{{F2A_INPUT_03_REMARKS}}', NULL, 'F2A Input 03 Remarks', 'computed', NULL, 'other'),
  ('f2a_input_03_yes', '{{F2A_INPUT_03_YES}}', NULL, 'F2A Input 03 Yes', 'computed', NULL, 'other'),
  ('f2a_input_04_no', '{{F2A_INPUT_04_NO}}', NULL, 'F2A Input 04 No', 'computed', NULL, 'other'),
  ('f2a_input_04_remarks', '{{F2A_INPUT_04_REMARKS}}', NULL, 'F2A Input 04 Remarks', 'computed', NULL, 'other'),
  ('f2a_input_04_yes', '{{F2A_INPUT_04_YES}}', NULL, 'F2A Input 04 Yes', 'computed', NULL, 'other'),
  ('f2a_license_no', '{{F2A_LICENSE_NO}}', NULL, 'F2A License No', 'computed', NULL, 'other'),
  ('f2a_misc_01_no', '{{F2A_MISC_01_NO}}', NULL, 'F2A Misc 01 No', 'computed', NULL, 'other'),
  ('f2a_misc_01_remarks', '{{F2A_MISC_01_REMARKS}}', NULL, 'F2A Misc 01 Remarks', 'computed', NULL, 'other'),
  ('f2a_misc_01_yes', '{{F2A_MISC_01_YES}}', NULL, 'F2A Misc 01 Yes', 'computed', NULL, 'other'),
  ('f2a_misc_02_no', '{{F2A_MISC_02_NO}}', NULL, 'F2A Misc 02 No', 'computed', NULL, 'other'),
  ('f2a_misc_02_remarks', '{{F2A_MISC_02_REMARKS}}', NULL, 'F2A Misc 02 Remarks', 'computed', NULL, 'other'),
  ('f2a_misc_02_yes', '{{F2A_MISC_02_YES}}', NULL, 'F2A Misc 02 Yes', 'computed', NULL, 'other'),
  ('f2a_misc_03_no', '{{F2A_MISC_03_NO}}', NULL, 'F2A Misc 03 No', 'computed', NULL, 'other'),
  ('f2a_misc_03_remarks', '{{F2A_MISC_03_REMARKS}}', NULL, 'F2A Misc 03 Remarks', 'computed', NULL, 'other'),
  ('f2a_misc_03_yes', '{{F2A_MISC_03_YES}}', NULL, 'F2A Misc 03 Yes', 'computed', NULL, 'other'),
  ('f2a_misc_04_no', '{{F2A_MISC_04_NO}}', NULL, 'F2A Misc 04 No', 'computed', NULL, 'other'),
  ('f2a_misc_04_remarks', '{{F2A_MISC_04_REMARKS}}', NULL, 'F2A Misc 04 Remarks', 'computed', NULL, 'other'),
  ('f2a_misc_04_yes', '{{F2A_MISC_04_YES}}', NULL, 'F2A Misc 04 Yes', 'computed', NULL, 'other'),
  ('f2a_misc_05_no', '{{F2A_MISC_05_NO}}', NULL, 'F2A Misc 05 No', 'computed', NULL, 'other'),
  ('f2a_misc_05_remarks', '{{F2A_MISC_05_REMARKS}}', NULL, 'F2A Misc 05 Remarks', 'computed', NULL, 'other'),
  ('f2a_misc_05_yes', '{{F2A_MISC_05_YES}}', NULL, 'F2A Misc 05 Yes', 'computed', NULL, 'other'),
  ('f2a_misc_06_no', '{{F2A_MISC_06_NO}}', NULL, 'F2A Misc 06 No', 'computed', NULL, 'other'),
  ('f2a_misc_06_remarks', '{{F2A_MISC_06_REMARKS}}', NULL, 'F2A Misc 06 Remarks', 'computed', NULL, 'other'),
  ('f2a_misc_06_yes', '{{F2A_MISC_06_YES}}', NULL, 'F2A Misc 06 Yes', 'computed', NULL, 'other'),
  ('f2a_misc_07_no', '{{F2A_MISC_07_NO}}', NULL, 'F2A Misc 07 No', 'computed', NULL, 'other'),
  ('f2a_misc_07_remarks', '{{F2A_MISC_07_REMARKS}}', NULL, 'F2A Misc 07 Remarks', 'computed', NULL, 'other'),
  ('f2a_misc_07_yes', '{{F2A_MISC_07_YES}}', NULL, 'F2A Misc 07 Yes', 'computed', NULL, 'other'),
  ('f2a_misc_08_no', '{{F2A_MISC_08_NO}}', NULL, 'F2A Misc 08 No', 'computed', NULL, 'other'),
  ('f2a_misc_08_remarks', '{{F2A_MISC_08_REMARKS}}', NULL, 'F2A Misc 08 Remarks', 'computed', NULL, 'other'),
  ('f2a_misc_08_yes', '{{F2A_MISC_08_YES}}', NULL, 'F2A Misc 08 Yes', 'computed', NULL, 'other'),
  ('f2a_phone_no', '{{F2A_PHONE_NO}}', NULL, 'F2A Phone No', 'computed', NULL, 'other'),
  ('f2a_promoter_name_address', '{{F2A_PROMOTER_NAME_ADDRESS}}', NULL, 'F2A Promoter Name Address', 'computed', NULL, 'other'),
  ('f2a_promoter_signature', '{{F2A_PROMOTER_SIGNATURE}}', NULL, 'F2A Promoter Signature', 'computed', NULL, 'other'),
  ('f2a_qualification', '{{F2A_QUALIFICATION}}', NULL, 'F2A Qualification', 'computed', NULL, 'other'),
  ('f2a_struct_01_no', '{{F2A_STRUCT_01_NO}}', NULL, 'F2A Struct 01 No', 'computed', NULL, 'other'),
  ('f2a_struct_01_remarks', '{{F2A_STRUCT_01_REMARKS}}', NULL, 'F2A Struct 01 Remarks', 'computed', NULL, 'other'),
  ('f2a_struct_01_yes', '{{F2A_STRUCT_01_YES}}', NULL, 'F2A Struct 01 Yes', 'computed', NULL, 'other'),
  ('f2a_struct_02_no', '{{F2A_STRUCT_02_NO}}', NULL, 'F2A Struct 02 No', 'computed', NULL, 'other'),
  ('f2a_struct_02_yes', '{{F2A_STRUCT_02_YES}}', NULL, 'F2A Struct 02 Yes', 'computed', NULL, 'other'),
  ('f2a_struct_03_no', '{{F2A_STRUCT_03_NO}}', NULL, 'F2A Struct 03 No', 'computed', NULL, 'other'),
  ('f2a_struct_03_remarks', '{{F2A_STRUCT_03_REMARKS}}', NULL, 'F2A Struct 03 Remarks', 'computed', NULL, 'other'),
  ('f2a_struct_03_yes', '{{F2A_STRUCT_03_YES}}', NULL, 'F2A Struct 03 Yes', 'computed', NULL, 'other'),
  ('f2a_struct_04_no', '{{F2A_STRUCT_04_NO}}', NULL, 'F2A Struct 04 No', 'computed', NULL, 'other'),
  ('f2a_struct_04_remarks', '{{F2A_STRUCT_04_REMARKS}}', NULL, 'F2A Struct 04 Remarks', 'computed', NULL, 'other'),
  ('f2a_struct_04_yes', '{{F2A_STRUCT_04_YES}}', NULL, 'F2A Struct 04 Yes', 'computed', NULL, 'other'),
  ('f2a_struct_05_no', '{{F2A_STRUCT_05_NO}}', NULL, 'F2A Struct 05 No', 'computed', NULL, 'other'),
  ('f2a_struct_05_remarks', '{{F2A_STRUCT_05_REMARKS}}', NULL, 'F2A Struct 05 Remarks', 'computed', NULL, 'other'),
  ('f2a_struct_05_yes', '{{F2A_STRUCT_05_YES}}', NULL, 'F2A Struct 05 Yes', 'computed', NULL, 'other'),
  ('f2a_struct_06_no', '{{F2A_STRUCT_06_NO}}', NULL, 'F2A Struct 06 No', 'computed', NULL, 'other'),
  ('f2a_struct_06_remarks', '{{F2A_STRUCT_06_REMARKS}}', NULL, 'F2A Struct 06 Remarks', 'computed', NULL, 'other'),
  ('f2a_struct_06_yes', '{{F2A_STRUCT_06_YES}}', NULL, 'F2A Struct 06 Yes', 'computed', NULL, 'other'),
  ('f2a_struct_engineer_email', '{{F2A_STRUCT_ENGINEER_EMAIL}}', NULL, 'F2A Struct Engineer Email', 'computed', NULL, 'other'),
  ('f2a_struct_engineer_license', '{{F2A_STRUCT_ENGINEER_LICENSE}}', NULL, 'F2A Struct Engineer License', 'computed', NULL, 'other'),
  ('f2a_struct_engineer_mobile', '{{F2A_STRUCT_ENGINEER_MOBILE}}', NULL, 'F2A Struct Engineer Mobile', 'computed', NULL, 'other'),
  ('f2a_struct_engineer_name', '{{F2A_STRUCT_ENGINEER_NAME}}', NULL, 'F2A Struct Engineer Name', 'computed', NULL, 'other'),
  ('f2a_work_01_no', '{{F2A_WORK_01_NO}}', NULL, 'F2A Work 01 No', 'computed', NULL, 'other'),
  ('f2a_work_01_remarks', '{{F2A_WORK_01_REMARKS}}', NULL, 'F2A Work 01 Remarks', 'computed', NULL, 'other'),
  ('f2a_work_01_yes', '{{F2A_WORK_01_YES}}', NULL, 'F2A Work 01 Yes', 'computed', NULL, 'other'),
  ('f2a_work_02_no', '{{F2A_WORK_02_NO}}', NULL, 'F2A Work 02 No', 'computed', NULL, 'other'),
  ('f2a_work_02_remarks', '{{F2A_WORK_02_REMARKS}}', NULL, 'F2A Work 02 Remarks', 'computed', NULL, 'other'),
  ('f2a_work_02_yes', '{{F2A_WORK_02_YES}}', NULL, 'F2A Work 02 Yes', 'computed', NULL, 'other'),
  ('f2a_work_03_no', '{{F2A_WORK_03_NO}}', NULL, 'F2A Work 03 No', 'computed', NULL, 'other'),
  ('f2a_work_03_remarks', '{{F2A_WORK_03_REMARKS}}', NULL, 'F2A Work 03 Remarks', 'computed', NULL, 'other'),
  ('f2a_work_03_yes', '{{F2A_WORK_03_YES}}', NULL, 'F2A Work 03 Yes', 'computed', NULL, 'other'),
  ('f2a_work_04_no', '{{F2A_WORK_04_NO}}', NULL, 'F2A Work 04 No', 'computed', NULL, 'other'),
  ('f2a_work_04_remarks', '{{F2A_WORK_04_REMARKS}}', NULL, 'F2A Work 04 Remarks', 'computed', NULL, 'other'),
  ('f2a_work_04_yes', '{{F2A_WORK_04_YES}}', NULL, 'F2A Work 04 Yes', 'computed', NULL, 'other'),
  ('f2a_work_05_no', '{{F2A_WORK_05_NO}}', NULL, 'F2A Work 05 No', 'computed', NULL, 'other'),
  ('f2a_work_05_remarks', '{{F2A_WORK_05_REMARKS}}', NULL, 'F2A Work 05 Remarks', 'computed', NULL, 'other'),
  ('f2a_work_05_yes', '{{F2A_WORK_05_YES}}', NULL, 'F2A Work 05 Yes', 'computed', NULL, 'other'),
  ('f2a_year_ending', '{{F2A_YEAR_ENDING}}', NULL, 'F2A Year Ending', 'computed', NULL, 'other'),
  ('f2_a_balance_cost', '{{F2_A_BALANCE_COST}}', NULL, 'F2 A Balance Cost', 'computed', NULL, 'other'),
  ('f2_a_cost_incurred', '{{F2_A_COST_INCURRED}}', NULL, 'F2 A Cost Incurred', 'computed', NULL, 'other'),
  ('f2_a_estimated_cost', '{{F2_A_ESTIMATED_COST}}', NULL, 'F2 A Estimated Cost', 'computed', NULL, 'other'),
  ('f2_a_extra_cost', '{{F2_A_EXTRA_COST}}', NULL, 'F2 A Extra Cost', 'computed', NULL, 'other'),
  ('f2_a_work_percent', '{{F2_A_WORK_PERCENT}}', NULL, 'F2 A Work Percent', 'computed', NULL, 'other'),
  ('f2_balance_cost_completion', '{{F2_BALANCE_COST_COMPLETION}}', NULL, 'F2 Balance Cost Completion', 'computed', NULL, 'other'),
  ('f2_building_wing_layout_name', '{{F2_BUILDING_WING_LAYOUT_NAME}}', NULL, 'F2 Building Wing Layout Name', 'computed', NULL, 'other')
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
VALUES
  ('f2_building_wing_layout_no', '{{F2_BUILDING_WING_LAYOUT_NO}}', NULL, 'F2 Building Wing Layout No', 'computed', NULL, 'other'),
  ('f2_b_balance_cost', '{{F2_B_BALANCE_COST}}', NULL, 'F2 B Balance Cost', 'computed', NULL, 'other'),
  ('f2_b_cost_incurred', '{{F2_B_COST_INCURRED}}', NULL, 'F2 B Cost Incurred', 'computed', NULL, 'other'),
  ('f2_b_estimated_cost', '{{F2_B_ESTIMATED_COST}}', NULL, 'F2 B Estimated Cost', 'computed', NULL, 'other'),
  ('f2_b_extra_cost', '{{F2_B_EXTRA_COST}}', NULL, 'F2 B Extra Cost', 'computed', NULL, 'other'),
  ('f2_b_work_percent', '{{F2_B_WORK_PERCENT}}', NULL, 'F2 B Work Percent', 'computed', NULL, 'other'),
  ('f2_c_amount_1', '{{F2_C_AMOUNT_1}}', NULL, 'F2 C Amount 1', 'computed', NULL, 'other'),
  ('f2_c_amount_2', '{{F2_C_AMOUNT_2}}', NULL, 'F2 C Amount 2', 'computed', NULL, 'other'),
  ('f2_c_item_1', '{{F2_C_ITEM_1}}', NULL, 'F2 C Item 1', 'computed', NULL, 'other'),
  ('f2_c_item_2', '{{F2_C_ITEM_2}}', NULL, 'F2 C Item 2', 'computed', NULL, 'other'),
  ('f2_engineer_name', '{{F2_ENGINEER_NAME}}', NULL, 'F2 Engineer Name', 'computed', NULL, 'other'),
  ('f2_engineer_signature_name', '{{F2_ENGINEER_SIGNATURE_NAME}}', NULL, 'F2 Engineer Signature Name', 'computed', NULL, 'other'),
  ('f2_estimated_cost_incurred', '{{F2_ESTIMATED_COST_INCURRED}}', NULL, 'F2 Estimated Cost Incurred', 'computed', NULL, 'other'),
  ('f2_local_authority_license_no', '{{F2_LOCAL_AUTHORITY_LICENSE_NO}}', NULL, 'F2 Local Authority License No', 'computed', NULL, 'other'),
  ('f2_promoter_name_address', '{{F2_PROMOTER_NAME_ADDRESS}}', NULL, 'F2 Promoter Name Address', 'computed', NULL, 'other'),
  ('f2_promoter_signature', '{{F2_PROMOTER_SIGNATURE}}', NULL, 'F2 Promoter Signature', 'computed', NULL, 'other'),
  ('f2_quantity_surveyor_name', '{{F2_QUANTITY_SURVEYOR_NAME}}', NULL, 'F2 Quantity Surveyor Name', 'computed', NULL, 'other'),
  ('f2_total_estimated_cost', '{{F2_TOTAL_ESTIMATED_COST}}', NULL, 'F2 Total Estimated Cost', 'computed', NULL, 'other'),
  ('f3_a_additional', '{{F3_A_ADDITIONAL}}', NULL, 'F3 A Additional', 'computed', NULL, 'other'),
  ('f3_a_clearance', '{{F3_A_CLEARANCE}}', NULL, 'F3 A Clearance', 'computed', NULL, 'other'),
  ('f3_a_construction', '{{F3_A_CONSTRUCTION}}', NULL, 'F3 A Construction', 'computed', NULL, 'other'),
  ('f3_a_development_exp', '{{F3_A_DEVELOPMENT_EXP}}', NULL, 'F3 A Development Exp', 'computed', NULL, 'other'),
  ('f3_a_interest', '{{F3_A_INTEREST}}', NULL, 'F3 A Interest', 'computed', NULL, 'other'),
  ('f3_a_land_asr', '{{F3_A_LAND_ASR}}', NULL, 'F3 A Land Asr', 'computed', NULL, 'other'),
  ('f3_a_land_premium', '{{F3_A_LAND_PREMIUM}}', NULL, 'F3 A Land Premium', 'computed', NULL, 'other'),
  ('f3_a_premium', '{{F3_A_PREMIUM}}', NULL, 'F3 A Premium', 'computed', NULL, 'other'),
  ('f3_a_rehab_construction', '{{F3_A_REHAB_CONSTRUCTION}}', NULL, 'F3 A Rehab Construction', 'computed', NULL, 'other'),
  ('f3_a_rehab_other', '{{F3_A_REHAB_OTHER}}', NULL, 'F3 A Rehab Other', 'computed', NULL, 'other'),
  ('f3_a_rehab_premium', '{{F3_A_REHAB_PREMIUM}}', NULL, 'F3 A Rehab Premium', 'computed', NULL, 'other'),
  ('f3_a_stamp_duty', '{{F3_A_STAMP_DUTY}}', NULL, 'F3 A Stamp Duty', 'computed', NULL, 'other'),
  ('f3_a_subtotal_development', '{{F3_A_SUBTOTAL_DEVELOPMENT}}', NULL, 'F3 A Subtotal Development', 'computed', NULL, 'other'),
  ('f3_a_subtotal_land', '{{F3_A_SUBTOTAL_LAND}}', NULL, 'F3 A Subtotal Land', 'computed', NULL, 'other'),
  ('f3_a_taxes', '{{F3_A_TAXES}}', NULL, 'F3 A Taxes', 'computed', NULL, 'other'),
  ('f3_a_tdr', '{{F3_A_TDR}}', NULL, 'F3 A Tdr', 'computed', NULL, 'other'),
  ('f3_a_total_project', '{{F3_A_TOTAL_PROJECT}}', NULL, 'F3 A Total Project', 'computed', NULL, 'other'),
  ('f3_b_additional', '{{F3_B_ADDITIONAL}}', NULL, 'F3 B Additional', 'computed', NULL, 'other'),
  ('f3_b_clearance', '{{F3_B_CLEARANCE}}', NULL, 'F3 B Clearance', 'computed', NULL, 'other'),
  ('f3_b_construction', '{{F3_B_CONSTRUCTION}}', NULL, 'F3 B Construction', 'computed', NULL, 'other'),
  ('f3_b_development_exp', '{{F3_B_DEVELOPMENT_EXP}}', NULL, 'F3 B Development Exp', 'computed', NULL, 'other'),
  ('f3_b_interest', '{{F3_B_INTEREST}}', NULL, 'F3 B Interest', 'computed', NULL, 'other'),
  ('f3_b_land_asr', '{{F3_B_LAND_ASR}}', NULL, 'F3 B Land Asr', 'computed', NULL, 'other'),
  ('f3_b_land_premium', '{{F3_B_LAND_PREMIUM}}', NULL, 'F3 B Land Premium', 'computed', NULL, 'other'),
  ('f3_b_net_withdrawal', '{{F3_B_NET_WITHDRAWAL}}', NULL, 'F3 B Net Withdrawal', 'computed', NULL, 'other'),
  ('f3_b_premium', '{{F3_B_PREMIUM}}', NULL, 'F3 B Premium', 'computed', NULL, 'other'),
  ('f3_b_proportion', '{{F3_B_PROPORTION}}', NULL, 'F3 B Proportion', 'computed', NULL, 'other'),
  ('f3_b_rehab_construction', '{{F3_B_REHAB_CONSTRUCTION}}', NULL, 'F3 B Rehab Construction', 'computed', NULL, 'other'),
  ('f3_b_rehab_other', '{{F3_B_REHAB_OTHER}}', NULL, 'F3 B Rehab Other', 'computed', NULL, 'other'),
  ('f3_b_rehab_premium', '{{F3_B_REHAB_PREMIUM}}', NULL, 'F3 B Rehab Premium', 'computed', NULL, 'other'),
  ('f3_b_stamp_duty', '{{F3_B_STAMP_DUTY}}', NULL, 'F3 B Stamp Duty', 'computed', NULL, 'other'),
  ('f3_b_subtotal_development', '{{F3_B_SUBTOTAL_DEVELOPMENT}}', NULL, 'F3 B Subtotal Development', 'computed', NULL, 'other'),
  ('f3_b_subtotal_land', '{{F3_B_SUBTOTAL_LAND}}', NULL, 'F3 B Subtotal Land', 'computed', NULL, 'other'),
  ('f3_b_taxes', '{{F3_B_TAXES}}', NULL, 'F3 B Taxes', 'computed', NULL, 'other'),
  ('f3_b_tdr', '{{F3_B_TDR}}', NULL, 'F3 B Tdr', 'computed', NULL, 'other'),
  ('f3_b_total_actual', '{{F3_B_TOTAL_ACTUAL}}', NULL, 'F3 B Total Actual', 'computed', NULL, 'other'),
  ('f3_b_withdrawable', '{{F3_B_WITHDRAWABLE}}', NULL, 'F3 B Withdrawable', 'computed', NULL, 'other'),
  ('f3_b_withdrawn_till_date', '{{F3_B_WITHDRAWN_TILL_DATE}}', NULL, 'F3 B Withdrawn Till Date', 'computed', NULL, 'other'),
  ('f3_ca_name', '{{F3_CA_NAME}}', NULL, 'F3 Ca Name', 'computed', NULL, 'other'),
  ('f3_ca_signature_name', '{{F3_CA_SIGNATURE_NAME}}', NULL, 'F3 Ca Signature Name', 'computed', NULL, 'other'),
  ('f3_c_sold_1_area', '{{F3_C_SOLD_1_AREA}}', NULL, 'F3 C Sold 1 Area', 'computed', NULL, 'other'),
  ('f3_c_sold_1_balance', '{{F3_C_SOLD_1_BALANCE}}', NULL, 'F3 C Sold 1 Balance', 'computed', NULL, 'other'),
  ('f3_c_sold_1_consideration', '{{F3_C_SOLD_1_CONSIDERATION}}', NULL, 'F3 C Sold 1 Consideration', 'computed', NULL, 'other'),
  ('f3_c_sold_1_flat', '{{F3_C_SOLD_1_FLAT}}', NULL, 'F3 C Sold 1 Flat', 'computed', NULL, 'other'),
  ('f3_c_sold_1_received', '{{F3_C_SOLD_1_RECEIVED}}', NULL, 'F3 C Sold 1 Received', 'computed', NULL, 'other'),
  ('f3_c_sold_2_area', '{{F3_C_SOLD_2_AREA}}', NULL, 'F3 C Sold 2 Area', 'computed', NULL, 'other'),
  ('f3_c_sold_2_balance', '{{F3_C_SOLD_2_BALANCE}}', NULL, 'F3 C Sold 2 Balance', 'computed', NULL, 'other'),
  ('f3_c_sold_2_consideration', '{{F3_C_SOLD_2_CONSIDERATION}}', NULL, 'F3 C Sold 2 Consideration', 'computed', NULL, 'other'),
  ('f3_c_sold_2_flat', '{{F3_C_SOLD_2_FLAT}}', NULL, 'F3 C Sold 2 Flat', 'computed', NULL, 'other'),
  ('f3_c_sold_2_received', '{{F3_C_SOLD_2_RECEIVED}}', NULL, 'F3 C Sold 2 Received', 'computed', NULL, 'other'),
  ('f3_c_sold_3_area', '{{F3_C_SOLD_3_AREA}}', NULL, 'F3 C Sold 3 Area', 'computed', NULL, 'other'),
  ('f3_c_sold_3_balance', '{{F3_C_SOLD_3_BALANCE}}', NULL, 'F3 C Sold 3 Balance', 'computed', NULL, 'other'),
  ('f3_c_sold_3_consideration', '{{F3_C_SOLD_3_CONSIDERATION}}', NULL, 'F3 C Sold 3 Consideration', 'computed', NULL, 'other'),
  ('f3_c_sold_3_flat', '{{F3_C_SOLD_3_FLAT}}', NULL, 'F3 C Sold 3 Flat', 'computed', NULL, 'other'),
  ('f3_c_sold_3_received', '{{F3_C_SOLD_3_RECEIVED}}', NULL, 'F3 C Sold 3 Received', 'computed', NULL, 'other'),
  ('f3_c_sold_total_area', '{{F3_C_SOLD_TOTAL_AREA}}', NULL, 'F3 C Sold Total Area', 'computed', NULL, 'other'),
  ('f3_c_sold_total_balance', '{{F3_C_SOLD_TOTAL_BALANCE}}', NULL, 'F3 C Sold Total Balance', 'computed', NULL, 'other'),
  ('f3_c_sold_total_consideration', '{{F3_C_SOLD_TOTAL_CONSIDERATION}}', NULL, 'F3 C Sold Total Consideration', 'computed', NULL, 'other'),
  ('f3_c_sold_total_received', '{{F3_C_SOLD_TOTAL_RECEIVED}}', NULL, 'F3 C Sold Total Received', 'computed', NULL, 'other'),
  ('f3_c_unsold_1_area', '{{F3_C_UNSOLD_1_AREA}}', NULL, 'F3 C Unsold 1 Area', 'computed', NULL, 'other'),
  ('f3_c_unsold_1_flat', '{{F3_C_UNSOLD_1_FLAT}}', NULL, 'F3 C Unsold 1 Flat', 'computed', NULL, 'other'),
  ('f3_c_unsold_1_rr_value', '{{F3_C_UNSOLD_1_RR_VALUE}}', NULL, 'F3 C Unsold 1 Rr Value', 'computed', NULL, 'other')
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
VALUES
  ('f3_c_unsold_2_area', '{{F3_C_UNSOLD_2_AREA}}', NULL, 'F3 C Unsold 2 Area', 'computed', NULL, 'other'),
  ('f3_c_unsold_2_flat', '{{F3_C_UNSOLD_2_FLAT}}', NULL, 'F3 C Unsold 2 Flat', 'computed', NULL, 'other'),
  ('f3_c_unsold_2_rr_value', '{{F3_C_UNSOLD_2_RR_VALUE}}', NULL, 'F3 C Unsold 2 Rr Value', 'computed', NULL, 'other'),
  ('f3_c_unsold_3_area', '{{F3_C_UNSOLD_3_AREA}}', NULL, 'F3 C Unsold 3 Area', 'computed', NULL, 'other'),
  ('f3_c_unsold_3_flat', '{{F3_C_UNSOLD_3_FLAT}}', NULL, 'F3 C Unsold 3 Flat', 'computed', NULL, 'other'),
  ('f3_c_unsold_3_rr_value', '{{F3_C_UNSOLD_3_RR_VALUE}}', NULL, 'F3 C Unsold 3 Rr Value', 'computed', NULL, 'other'),
  ('f3_c_unsold_total_area', '{{F3_C_UNSOLD_TOTAL_AREA}}', NULL, 'F3 C Unsold Total Area', 'computed', NULL, 'other'),
  ('f3_c_unsold_total_rr_value', '{{F3_C_UNSOLD_TOTAL_RR_VALUE}}', NULL, 'F3 C Unsold Total Rr Value', 'computed', NULL, 'other'),
  ('f3_d_balance_cost', '{{F3_D_BALANCE_COST}}', NULL, 'F3 D Balance Cost', 'computed', NULL, 'other'),
  ('f3_d_deposit_percent', '{{F3_D_DEPOSIT_PERCENT}}', NULL, 'F3 D Deposit Percent', 'computed', NULL, 'other'),
  ('f3_d_estimated_receivables', '{{F3_D_ESTIMATED_RECEIVABLES}}', NULL, 'F3 D Estimated Receivables', 'computed', NULL, 'other'),
  ('f3_d_sold_receivables', '{{F3_D_SOLD_RECEIVABLES}}', NULL, 'F3 D Sold Receivables', 'computed', NULL, 'other'),
  ('f3_d_unsold_area', '{{F3_D_UNSOLD_AREA}}', NULL, 'F3 D Unsold Area', 'computed', NULL, 'other'),
  ('f3_d_unsold_sales_proceeds', '{{F3_D_UNSOLD_SALES_PROCEEDS}}', NULL, 'F3 D Unsold Sales Proceeds', 'computed', NULL, 'other'),
  ('f3_e_closing_balance', '{{F3_E_CLOSING_BALANCE}}', NULL, 'F3 E Closing Balance', 'computed', NULL, 'other'),
  ('f3_e_deposits', '{{F3_E_DEPOSITS}}', NULL, 'F3 E Deposits', 'computed', NULL, 'other'),
  ('f3_e_opening_balance', '{{F3_E_OPENING_BALANCE}}', NULL, 'F3 E Opening Balance', 'computed', NULL, 'other'),
  ('f3_e_withdrawals', '{{F3_E_WITHDRAWALS}}', NULL, 'F3 E Withdrawals', 'computed', NULL, 'other'),
  ('f3_f_cost_act', '{{F3_F_COST_ACT}}', NULL, 'F3 F Cost Act', 'computed', NULL, 'other'),
  ('f3_f_cost_est', '{{F3_F_COST_EST}}', NULL, 'F3 F Cost Est', 'computed', NULL, 'other'),
  ('f3_f_cost_prop', '{{F3_F_COST_PROP}}', NULL, 'F3 F Cost Prop', 'computed', NULL, 'other'),
  ('f3_f_customer_act', '{{F3_F_CUSTOMER_ACT}}', NULL, 'F3 F Customer Act', 'computed', NULL, 'other'),
  ('f3_f_customer_est', '{{F3_F_CUSTOMER_EST}}', NULL, 'F3 F Customer Est', 'computed', NULL, 'other'),
  ('f3_f_customer_prop', '{{F3_F_CUSTOMER_PROP}}', NULL, 'F3 F Customer Prop', 'computed', NULL, 'other'),
  ('f3_f_own_act', '{{F3_F_OWN_ACT}}', NULL, 'F3 F Own Act', 'computed', NULL, 'other'),
  ('f3_f_own_est', '{{F3_F_OWN_EST}}', NULL, 'F3 F Own Est', 'computed', NULL, 'other'),
  ('f3_f_own_prop', '{{F3_F_OWN_PROP}}', NULL, 'F3 F Own Prop', 'computed', NULL, 'other'),
  ('f3_f_secured_act', '{{F3_F_SECURED_ACT}}', NULL, 'F3 F Secured Act', 'computed', NULL, 'other'),
  ('f3_f_secured_est', '{{F3_F_SECURED_EST}}', NULL, 'F3 F Secured Est', 'computed', NULL, 'other'),
  ('f3_f_secured_prop', '{{F3_F_SECURED_PROP}}', NULL, 'F3 F Secured Prop', 'computed', NULL, 'other'),
  ('f3_f_total_act', '{{F3_F_TOTAL_ACT}}', NULL, 'F3 F Total Act', 'computed', NULL, 'other'),
  ('f3_f_total_est', '{{F3_F_TOTAL_EST}}', NULL, 'F3 F Total Est', 'computed', NULL, 'other'),
  ('f3_f_total_prop', '{{F3_F_TOTAL_PROP}}', NULL, 'F3 F Total Prop', 'computed', NULL, 'other'),
  ('f3_f_unsecured_act', '{{F3_F_UNSECURED_ACT}}', NULL, 'F3 F Unsecured Act', 'computed', NULL, 'other'),
  ('f3_f_unsecured_est', '{{F3_F_UNSECURED_EST}}', NULL, 'F3 F Unsecured Est', 'computed', NULL, 'other'),
  ('f3_f_unsecured_prop', '{{F3_F_UNSECURED_PROP}}', NULL, 'F3 F Unsecured Prop', 'computed', NULL, 'other'),
  ('f3_g_comment_1', '{{F3_G_COMMENT_1}}', NULL, 'F3 G Comment 1', 'computed', NULL, 'other'),
  ('f3_g_comment_2', '{{F3_G_COMMENT_2}}', NULL, 'F3 G Comment 2', 'computed', NULL, 'other'),
  ('f3_g_comment_3', '{{F3_G_COMMENT_3}}', NULL, 'F3 G Comment 3', 'computed', NULL, 'other'),
  ('f3_g_comment_4', '{{F3_G_COMMENT_4}}', NULL, 'F3 G Comment 4', 'computed', NULL, 'other'),
  ('f3_membership_no', '{{F3_MEMBERSHIP_NO}}', NULL, 'F3 Membership No', 'computed', NULL, 'other'),
  ('f3_promoter_name_address', '{{F3_PROMOTER_NAME_ADDRESS}}', NULL, 'F3 Promoter Name Address', 'computed', NULL, 'other'),
  ('f3_promoter_signature', '{{F3_PROMOTER_SIGNATURE}}', NULL, 'F3 Promoter Signature', 'computed', NULL, 'other'),
  ('f3_udin', '{{F3_UDIN}}', NULL, 'F3 Udin', 'computed', NULL, 'other'),
  ('f5_amount_collected_during_year', '{{F5_AMOUNT_COLLECTED_DURING_YEAR}}', NULL, 'F5 Amount Collected During Year', 'computed', NULL, 'other'),
  ('f5_amount_collected_till_date', '{{F5_AMOUNT_COLLECTED_TILL_DATE}}', NULL, 'F5 Amount Collected Till Date', 'computed', NULL, 'other'),
  ('f5_amount_withdrawn_during_year', '{{F5_AMOUNT_WITHDRAWN_DURING_YEAR}}', NULL, 'F5 Amount Withdrawn During Year', 'computed', NULL, 'other'),
  ('f5_amount_withdrawn_till_date', '{{F5_AMOUNT_WITHDRAWN_TILL_DATE}}', NULL, 'F5 Amount Withdrawn Till Date', 'computed', NULL, 'other'),
  ('f5_ca_full_address', '{{F5_CA_FULL_ADDRESS}}', NULL, 'F5 Ca Full Address', 'computed', NULL, 'other'),
  ('f5_ca_signatory_name', '{{F5_CA_SIGNATORY_NAME}}', NULL, 'F5 Ca Signatory Name', 'computed', NULL, 'other'),
  ('f5_contact_no', '{{F5_CONTACT_NO}}', NULL, 'F5 Contact No', 'computed', NULL, 'other'),
  ('f5_email', '{{F5_EMAIL}}', NULL, 'F5 Email', 'computed', NULL, 'other'),
  ('f5_exception_details', '{{F5_EXCEPTION_DETAILS}}', NULL, 'F5 Exception Details', 'computed', NULL, 'other'),
  ('f5_membership_no', '{{F5_MEMBERSHIP_NO}}', NULL, 'F5 Membership No', 'computed', NULL, 'other'),
  ('f5_period_ended', '{{F5_PERIOD_ENDED}}', NULL, 'F5 Period Ended', 'computed', NULL, 'other'),
  ('f5_period_from', '{{F5_PERIOD_FROM}}', NULL, 'F5 Period From', 'computed', NULL, 'other'),
  ('f5_period_to', '{{F5_PERIOD_TO}}', NULL, 'F5 Period To', 'computed', NULL, 'other'),
  ('f5_project_completion_percent', '{{F5_PROJECT_COMPLETION_PERCENT}}', NULL, 'F5 Project Completion Percent', 'computed', NULL, 'other'),
  ('f5_project_location', '{{F5_PROJECT_LOCATION}}', NULL, 'F5 Project Location', 'computed', NULL, 'other'),
  ('f5_project_reference', '{{F5_PROJECT_REFERENCE}}', NULL, 'F5 Project Reference', 'computed', NULL, 'other'),
  ('f5_promoter_name_address', '{{F5_PROMOTER_NAME_ADDRESS}}', NULL, 'F5 Promoter Name Address', 'computed', NULL, 'other'),
  ('land_description', '{{LAND_DESCRIPTION}}', NULL, 'Land Description', 'computed', NULL, 'other'),
  ('lender_address_branch', '{{LENDER_ADDRESS_BRANCH}}', NULL, 'Lender Address Branch', 'computed', NULL, 'other'),
  ('lender_name', '{{LENDER_NAME}}', NULL, 'Lender Name', 'computed', NULL, 'other'),
  ('maharera_no', '{{MAHARERA_NO}}', NULL, 'Maharera No', 'computed', NULL, 'other'),
  ('mortgage_details', '{{MORTGAGE_DETAILS}}', NULL, 'Mortgage Details', 'computed', NULL, 'other'),
  ('outstanding_amount', '{{OUTSTANDING_AMOUNT}}', NULL, 'Outstanding Amount', 'computed', NULL, 'other'),
  ('partner_1_din_dpin', '{{PARTNER_1_DIN_DPIN}}', NULL, 'Partner 1 Din Dpin', 'computed', NULL, 'other'),
  ('partner_1_name', '{{PARTNER_1_NAME}}', NULL, 'Partner 1 Name', 'computed', NULL, 'other'),
  ('partner_1_org1_address', '{{PARTNER_1_ORG1_ADDRESS}}', NULL, 'Partner 1 Org1 Address', 'computed', NULL, 'other'),
  ('partner_1_org1_name', '{{PARTNER_1_ORG1_NAME}}', NULL, 'Partner 1 Org1 Name', 'computed', NULL, 'other'),
  ('partner_1_org1_rera_no', '{{PARTNER_1_ORG1_RERA_NO}}', NULL, 'Partner 1 Org1 Rera No', 'computed', NULL, 'other'),
  ('partner_1_org2_address', '{{PARTNER_1_ORG2_ADDRESS}}', NULL, 'Partner 1 Org2 Address', 'computed', NULL, 'other'),
  ('partner_1_org2_name', '{{PARTNER_1_ORG2_NAME}}', NULL, 'Partner 1 Org2 Name', 'computed', NULL, 'other'),
  ('partner_1_org2_rera_no', '{{PARTNER_1_ORG2_RERA_NO}}', NULL, 'Partner 1 Org2 Rera No', 'computed', NULL, 'other'),
  ('partner_1_org3_address', '{{PARTNER_1_ORG3_ADDRESS}}', NULL, 'Partner 1 Org3 Address', 'computed', NULL, 'other'),
  ('partner_1_org3_name', '{{PARTNER_1_ORG3_NAME}}', NULL, 'Partner 1 Org3 Name', 'computed', NULL, 'other'),
  ('partner_1_org3_rera_no', '{{PARTNER_1_ORG3_RERA_NO}}', NULL, 'Partner 1 Org3 Rera No', 'computed', NULL, 'other'),
  ('partner_1_org4_address', '{{PARTNER_1_ORG4_ADDRESS}}', NULL, 'Partner 1 Org4 Address', 'computed', NULL, 'other'),
  ('partner_1_org4_name', '{{PARTNER_1_ORG4_NAME}}', NULL, 'Partner 1 Org4 Name', 'computed', NULL, 'other')
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
VALUES
  ('partner_1_org4_rera_no', '{{PARTNER_1_ORG4_RERA_NO}}', NULL, 'Partner 1 Org4 Rera No', 'computed', NULL, 'other'),
  ('partner_1_role_answer', '{{PARTNER_1_ROLE_ANSWER}}', NULL, 'Partner 1 Role Answer', 'computed', NULL, 'other'),
  ('partner_1_signatory_designation', '{{PARTNER_1_SIGNATORY_DESIGNATION}}', NULL, 'Partner 1 Signatory Designation', 'computed', NULL, 'other'),
  ('partner_1_status1_complaint', '{{PARTNER_1_STATUS1_COMPLAINT}}', NULL, 'Partner 1 Status1 Complaint', 'computed', NULL, 'other'),
  ('partner_1_status1_completion', '{{PARTNER_1_STATUS1_COMPLETION}}', NULL, 'Partner 1 Status1 Completion', 'computed', NULL, 'other'),
  ('partner_1_status1_rera_no', '{{PARTNER_1_STATUS1_RERA_NO}}', NULL, 'Partner 1 Status1 Rera No', 'computed', NULL, 'other'),
  ('partner_1_status1_revoked', '{{PARTNER_1_STATUS1_REVOKED}}', NULL, 'Partner 1 Status1 Revoked', 'computed', NULL, 'other'),
  ('partner_1_status1_warrant', '{{PARTNER_1_STATUS1_WARRANT}}', NULL, 'Partner 1 Status1 Warrant', 'computed', NULL, 'other'),
  ('partner_1_status2_complaint', '{{PARTNER_1_STATUS2_COMPLAINT}}', NULL, 'Partner 1 Status2 Complaint', 'computed', NULL, 'other'),
  ('partner_1_status2_completion', '{{PARTNER_1_STATUS2_COMPLETION}}', NULL, 'Partner 1 Status2 Completion', 'computed', NULL, 'other'),
  ('partner_1_status2_rera_no', '{{PARTNER_1_STATUS2_RERA_NO}}', NULL, 'Partner 1 Status2 Rera No', 'computed', NULL, 'other'),
  ('partner_1_status2_revoked', '{{PARTNER_1_STATUS2_REVOKED}}', NULL, 'Partner 1 Status2 Revoked', 'computed', NULL, 'other'),
  ('partner_1_status2_warrant', '{{PARTNER_1_STATUS2_WARRANT}}', NULL, 'Partner 1 Status2 Warrant', 'computed', NULL, 'other'),
  ('partner_1_status3_complaint', '{{PARTNER_1_STATUS3_COMPLAINT}}', NULL, 'Partner 1 Status3 Complaint', 'computed', NULL, 'other'),
  ('partner_1_status3_completion', '{{PARTNER_1_STATUS3_COMPLETION}}', NULL, 'Partner 1 Status3 Completion', 'computed', NULL, 'other'),
  ('partner_1_status3_rera_no', '{{PARTNER_1_STATUS3_RERA_NO}}', NULL, 'Partner 1 Status3 Rera No', 'computed', NULL, 'other'),
  ('partner_1_status3_revoked', '{{PARTNER_1_STATUS3_REVOKED}}', NULL, 'Partner 1 Status3 Revoked', 'computed', NULL, 'other'),
  ('partner_1_status3_warrant', '{{PARTNER_1_STATUS3_WARRANT}}', NULL, 'Partner 1 Status3 Warrant', 'computed', NULL, 'other'),
  ('partner_1_status4_complaint', '{{PARTNER_1_STATUS4_COMPLAINT}}', NULL, 'Partner 1 Status4 Complaint', 'computed', NULL, 'other'),
  ('partner_1_status4_completion', '{{PARTNER_1_STATUS4_COMPLETION}}', NULL, 'Partner 1 Status4 Completion', 'computed', NULL, 'other'),
  ('partner_1_status4_rera_no', '{{PARTNER_1_STATUS4_RERA_NO}}', NULL, 'Partner 1 Status4 Rera No', 'computed', NULL, 'other'),
  ('partner_1_status4_revoked', '{{PARTNER_1_STATUS4_REVOKED}}', NULL, 'Partner 1 Status4 Revoked', 'computed', NULL, 'other'),
  ('partner_1_status4_warrant', '{{PARTNER_1_STATUS4_WARRANT}}', NULL, 'Partner 1 Status4 Warrant', 'computed', NULL, 'other'),
  ('partner_2_din_dpin', '{{PARTNER_2_DIN_DPIN}}', NULL, 'Partner 2 Din Dpin', 'computed', NULL, 'other'),
  ('partner_2_name', '{{PARTNER_2_NAME}}', NULL, 'Partner 2 Name', 'computed', NULL, 'other'),
  ('partner_2_org1_address', '{{PARTNER_2_ORG1_ADDRESS}}', NULL, 'Partner 2 Org1 Address', 'computed', NULL, 'other'),
  ('partner_2_org1_name', '{{PARTNER_2_ORG1_NAME}}', NULL, 'Partner 2 Org1 Name', 'computed', NULL, 'other'),
  ('partner_2_org1_rera_no', '{{PARTNER_2_ORG1_RERA_NO}}', NULL, 'Partner 2 Org1 Rera No', 'computed', NULL, 'other'),
  ('partner_2_org2_address', '{{PARTNER_2_ORG2_ADDRESS}}', NULL, 'Partner 2 Org2 Address', 'computed', NULL, 'other'),
  ('partner_2_org2_name', '{{PARTNER_2_ORG2_NAME}}', NULL, 'Partner 2 Org2 Name', 'computed', NULL, 'other'),
  ('partner_2_org2_rera_no', '{{PARTNER_2_ORG2_RERA_NO}}', NULL, 'Partner 2 Org2 Rera No', 'computed', NULL, 'other'),
  ('partner_2_org3_address', '{{PARTNER_2_ORG3_ADDRESS}}', NULL, 'Partner 2 Org3 Address', 'computed', NULL, 'other'),
  ('partner_2_org3_name', '{{PARTNER_2_ORG3_NAME}}', NULL, 'Partner 2 Org3 Name', 'computed', NULL, 'other'),
  ('partner_2_org3_rera_no', '{{PARTNER_2_ORG3_RERA_NO}}', NULL, 'Partner 2 Org3 Rera No', 'computed', NULL, 'other'),
  ('partner_2_org4_address', '{{PARTNER_2_ORG4_ADDRESS}}', NULL, 'Partner 2 Org4 Address', 'computed', NULL, 'other'),
  ('partner_2_org4_name', '{{PARTNER_2_ORG4_NAME}}', NULL, 'Partner 2 Org4 Name', 'computed', NULL, 'other'),
  ('partner_2_org4_rera_no', '{{PARTNER_2_ORG4_RERA_NO}}', NULL, 'Partner 2 Org4 Rera No', 'computed', NULL, 'other'),
  ('partner_2_role_answer', '{{PARTNER_2_ROLE_ANSWER}}', NULL, 'Partner 2 Role Answer', 'computed', NULL, 'other'),
  ('partner_2_signatory_designation', '{{PARTNER_2_SIGNATORY_DESIGNATION}}', NULL, 'Partner 2 Signatory Designation', 'computed', NULL, 'other'),
  ('partner_2_status1_complaint', '{{PARTNER_2_STATUS1_COMPLAINT}}', NULL, 'Partner 2 Status1 Complaint', 'computed', NULL, 'other'),
  ('partner_2_status1_completion', '{{PARTNER_2_STATUS1_COMPLETION}}', NULL, 'Partner 2 Status1 Completion', 'computed', NULL, 'other'),
  ('partner_2_status1_rera_no', '{{PARTNER_2_STATUS1_RERA_NO}}', NULL, 'Partner 2 Status1 Rera No', 'computed', NULL, 'other'),
  ('partner_2_status1_revoked', '{{PARTNER_2_STATUS1_REVOKED}}', NULL, 'Partner 2 Status1 Revoked', 'computed', NULL, 'other'),
  ('partner_2_status1_warrant', '{{PARTNER_2_STATUS1_WARRANT}}', NULL, 'Partner 2 Status1 Warrant', 'computed', NULL, 'other'),
  ('partner_2_status2_complaint', '{{PARTNER_2_STATUS2_COMPLAINT}}', NULL, 'Partner 2 Status2 Complaint', 'computed', NULL, 'other'),
  ('partner_2_status2_completion', '{{PARTNER_2_STATUS2_COMPLETION}}', NULL, 'Partner 2 Status2 Completion', 'computed', NULL, 'other'),
  ('partner_2_status2_rera_no', '{{PARTNER_2_STATUS2_RERA_NO}}', NULL, 'Partner 2 Status2 Rera No', 'computed', NULL, 'other'),
  ('partner_2_status2_revoked', '{{PARTNER_2_STATUS2_REVOKED}}', NULL, 'Partner 2 Status2 Revoked', 'computed', NULL, 'other'),
  ('partner_2_status2_warrant', '{{PARTNER_2_STATUS2_WARRANT}}', NULL, 'Partner 2 Status2 Warrant', 'computed', NULL, 'other'),
  ('partner_2_status3_complaint', '{{PARTNER_2_STATUS3_COMPLAINT}}', NULL, 'Partner 2 Status3 Complaint', 'computed', NULL, 'other'),
  ('partner_2_status3_completion', '{{PARTNER_2_STATUS3_COMPLETION}}', NULL, 'Partner 2 Status3 Completion', 'computed', NULL, 'other'),
  ('partner_2_status3_rera_no', '{{PARTNER_2_STATUS3_RERA_NO}}', NULL, 'Partner 2 Status3 Rera No', 'computed', NULL, 'other'),
  ('partner_2_status3_revoked', '{{PARTNER_2_STATUS3_REVOKED}}', NULL, 'Partner 2 Status3 Revoked', 'computed', NULL, 'other'),
  ('partner_2_status3_warrant', '{{PARTNER_2_STATUS3_WARRANT}}', NULL, 'Partner 2 Status3 Warrant', 'computed', NULL, 'other'),
  ('partner_2_status4_complaint', '{{PARTNER_2_STATUS4_COMPLAINT}}', NULL, 'Partner 2 Status4 Complaint', 'computed', NULL, 'other'),
  ('partner_2_status4_completion', '{{PARTNER_2_STATUS4_COMPLETION}}', NULL, 'Partner 2 Status4 Completion', 'computed', NULL, 'other'),
  ('partner_2_status4_rera_no', '{{PARTNER_2_STATUS4_RERA_NO}}', NULL, 'Partner 2 Status4 Rera No', 'computed', NULL, 'other'),
  ('partner_2_status4_revoked', '{{PARTNER_2_STATUS4_REVOKED}}', NULL, 'Partner 2 Status4 Revoked', 'computed', NULL, 'other'),
  ('partner_2_status4_warrant', '{{PARTNER_2_STATUS4_WARRANT}}', NULL, 'Partner 2 Status4 Warrant', 'computed', NULL, 'other'),
  ('place', '{{PLACE}}', NULL, 'Place', 'computed', NULL, 'other'),
  ('project_land_area', '{{PROJECT_LAND_AREA}}', NULL, 'Project Land Area', 'computed', NULL, 'other'),
  ('promoter_authorization_date', '{{PROMOTER_AUTHORIZATION_DATE}}', NULL, 'Promoter Authorization Date', 'computed', NULL, 'other'),
  ('promoter_declarant_designation', '{{PROMOTER_DECLARANT_DESIGNATION}}', NULL, 'Promoter Declarant Designation', 'computed', NULL, 'other'),
  ('promoter_declarant_designation_2', '{{PROMOTER_DECLARANT_DESIGNATION_2}}', NULL, 'Promoter Declarant Designation 2', 'computed', NULL, 'other'),
  ('promoter_deponent_designation', '{{PROMOTER_DEPONENT_DESIGNATION}}', NULL, 'Promoter Deponent Designation', 'computed', NULL, 'other'),
  ('promoter_deponent_designation_2', '{{PROMOTER_DEPONENT_DESIGNATION_2}}', NULL, 'Promoter Deponent Designation 2', 'computed', NULL, 'other'),
  ('promoter_deponent_entity', '{{PROMOTER_DEPONENT_ENTITY}}', NULL, 'Promoter Deponent Entity', 'computed', NULL, 'other'),
  ('promoter_deponent_entity_2', '{{PROMOTER_DEPONENT_ENTITY_2}}', NULL, 'Promoter Deponent Entity 2', 'computed', NULL, 'other'),
  ('promoter_encumbrance_details', '{{PROMOTER_ENCUMBRANCE_DETAILS}}', NULL, 'Promoter Encumbrance Details', 'computed', NULL, 'other'),
  ('promoter_landowner_entity', '{{PROMOTER_LANDOWNER_ENTITY}}', NULL, 'Promoter Landowner Entity', 'computed', NULL, 'other'),
  ('promoter_office_address', '{{PROMOTER_OFFICE_ADDRESS}}', NULL, 'Promoter Office Address', 'computed', NULL, 'other'),
  ('promoter_project_completion_date', '{{PROMOTER_PROJECT_COMPLETION_DATE}}', NULL, 'Promoter Project Completion Date', 'computed', NULL, 'other'),
  ('promoter_verification_day', '{{PROMOTER_VERIFICATION_DAY}}', NULL, 'Promoter Verification Day', 'computed', NULL, 'other'),
  ('promoter_verification_month', '{{PROMOTER_VERIFICATION_MONTH}}', NULL, 'Promoter Verification Month', 'computed', NULL, 'other'),
  ('promoter_verification_year', '{{PROMOTER_VERIFICATION_YEAR}}', NULL, 'Promoter Verification Year', 'computed', NULL, 'other'),
  ('sanctioned_amount', '{{SANCTIONED_AMOUNT}}', NULL, 'Sanctioned Amount', 'computed', NULL, 'other'),
  ('separate_account_no', '{{SEPARATE_ACCOUNT_NO}}', NULL, 'Separate Account No', 'computed', NULL, 'other'),
  ('signatory_designation', '{{SIGNATORY_DESIGNATION}}', NULL, 'Signatory Designation', 'computed', NULL, 'other'),
  ('society_authorization_date', '{{SOCIETY_AUTHORIZATION_DATE}}', NULL, 'Society Authorization Date', 'computed', NULL, 'other'),
  ('society_declarant_designation', '{{SOCIETY_DECLARANT_DESIGNATION}}', NULL, 'Society Declarant Designation', 'computed', NULL, 'other')
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
VALUES
  ('society_declarant_designation_2', '{{SOCIETY_DECLARANT_DESIGNATION_2}}', NULL, 'Society Declarant Designation 2', 'computed', NULL, 'other'),
  ('society_declarant_name', '{{SOCIETY_DECLARANT_NAME}}', NULL, 'Society Declarant Name', 'computed', NULL, 'other'),
  ('society_declarant_name_2', '{{SOCIETY_DECLARANT_NAME_2}}', NULL, 'Society Declarant Name 2', 'computed', NULL, 'other'),
  ('society_deponent_designation', '{{SOCIETY_DEPONENT_DESIGNATION}}', NULL, 'Society Deponent Designation', 'computed', NULL, 'other'),
  ('society_deponent_designation_2', '{{SOCIETY_DEPONENT_DESIGNATION_2}}', NULL, 'Society Deponent Designation 2', 'computed', NULL, 'other'),
  ('society_deponent_entity', '{{SOCIETY_DEPONENT_ENTITY}}', NULL, 'Society Deponent Entity', 'computed', NULL, 'other'),
  ('society_deponent_entity_2', '{{SOCIETY_DEPONENT_ENTITY_2}}', NULL, 'Society Deponent Entity 2', 'computed', NULL, 'other'),
  ('society_encumbrance_details', '{{SOCIETY_ENCUMBRANCE_DETAILS}}', NULL, 'Society Encumbrance Details', 'computed', NULL, 'other'),
  ('society_landowner_entity', '{{SOCIETY_LANDOWNER_ENTITY}}', NULL, 'Society Landowner Entity', 'computed', NULL, 'other'),
  ('society_project_completion_date', '{{SOCIETY_PROJECT_COMPLETION_DATE}}', NULL, 'Society Project Completion Date', 'computed', NULL, 'other'),
  ('society_verification_day', '{{SOCIETY_VERIFICATION_DAY}}', NULL, 'Society Verification Day', 'computed', NULL, 'other'),
  ('society_verification_month', '{{SOCIETY_VERIFICATION_MONTH}}', NULL, 'Society Verification Month', 'computed', NULL, 'other'),
  ('society_verification_year', '{{SOCIETY_VERIFICATION_YEAR}}', NULL, 'Society Verification Year', 'computed', NULL, 'other'),
  ('total_approved_habitable_floors', '{{TOTAL_APPROVED_HABITABLE_FLOORS}}', NULL, 'Total Approved Habitable Floors', 'computed', NULL, 'other'),
  ('transaction_account_no', '{{TRANSACTION_ACCOUNT_NO}}', NULL, 'Transaction Account No', 'computed', NULL, 'other')
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
    ('project_title', true, 10),
    ('ms_name', false, 20),
    ('owner_ca_name', false, 30),
    ('plot_cs_cts_no', false, 40),
    ('planning_authority', false, 50),
    ('date', true, 60),
    ('place', false, 70)
) AS v(placeholder_id, required, sort_order)
WHERE t.slug = 'maharera_registration'
ON CONFLICT (application_type_id, placeholder_id) DO UPDATE SET
  required = EXCLUDED.required,
  sort_order = EXCLUDED.sort_order;

INSERT INTO public.application_type_placeholders
  (application_type_id, placeholder_id, required, sort_order)
SELECT t.id, v.placeholder_id, v.required, v.sort_order
FROM public.application_types t
CROSS JOIN (
  VALUES
    ('project_title', true, 10),
    ('ms_name', false, 20),
    ('owner_ca_name', false, 30),
    ('maharera_no', true, 40),
    ('planning_authority', false, 50),
    ('architects_name', false, 60),
    ('date', true, 70)
) AS v(placeholder_id, required, sort_order)
WHERE t.slug = 'maharera_forms_1_2_3_quarterly'
ON CONFLICT (application_type_id, placeholder_id) DO UPDATE SET
  required = EXCLUDED.required,
  sort_order = EXCLUDED.sort_order;

INSERT INTO public.application_type_placeholders
  (application_type_id, placeholder_id, required, sort_order)
SELECT t.id, v.placeholder_id, v.required, v.sort_order
FROM public.application_types t
CROSS JOIN (
  VALUES
    ('project_title', true, 10),
    ('ms_name', false, 20),
    ('owner_ca_name', false, 30),
    ('maharera_no', true, 40),
    ('date', true, 50),
    ('place', false, 60)
) AS v(placeholder_id, required, sort_order)
WHERE t.slug = 'maharera_form_2a_form_5_annual'
ON CONFLICT (application_type_id, placeholder_id) DO UPDATE SET
  required = EXCLUDED.required,
  sort_order = EXCLUDED.sort_order;

-- ---------------------------------------------------------------------------
-- Document-level placeholder links
-- ---------------------------------------------------------------------------
INSERT INTO public.application_document_placeholders
  (document_id, placeholder_id, required, sort_order)
SELECT d.id, v.placeholder_id, v.required, v.sort_order
FROM public.application_documents d
CROSS JOIN (
  VALUES
    ('date', true, 10),
    ('project_title', true, 20),
    ('ms_name', false, 30),
    ('owner_ca_name', false, 40),
    ('place', false, 50),
    ('borrowing_disbursement_date', false, 60),
    ('declarant_capacity', false, 70),
    ('disbursed_amount', false, 80),
    ('lender_address_branch', false, 90),
    ('lender_name', false, 100),
    ('mortgage_details', false, 110),
    ('outstanding_amount', false, 120),
    ('sanctioned_amount', false, 130),
    ('signatory_designation', false, 140)
) AS v(placeholder_id, required, sort_order)
WHERE d.slug = 'maharera_disclosure_secured_unsecured_finance'
ON CONFLICT (document_id, placeholder_id) DO UPDATE SET
  required = EXCLUDED.required,
  sort_order = EXCLUDED.sort_order;

INSERT INTO public.application_document_placeholders
  (document_id, placeholder_id, required, sort_order)
SELECT d.id, v.placeholder_id, v.required, v.sort_order
FROM public.application_documents d
CROSS JOIN (
  VALUES
    ('date', true, 10),
    ('ms_name', false, 20),
    ('owner_ca_name', false, 30),
    ('place', false, 40),
    ('partner_1_din_dpin', false, 50),
    ('partner_1_name', false, 60),
    ('partner_1_org1_address', false, 70),
    ('partner_1_org1_name', false, 80),
    ('partner_1_org1_rera_no', false, 90),
    ('partner_1_org2_address', false, 100),
    ('partner_1_org2_name', false, 110),
    ('partner_1_org2_rera_no', false, 120),
    ('partner_1_org3_address', false, 130),
    ('partner_1_org3_name', false, 140),
    ('partner_1_org3_rera_no', false, 150),
    ('partner_1_org4_address', false, 160),
    ('partner_1_org4_name', false, 170),
    ('partner_1_org4_rera_no', false, 180),
    ('partner_1_role_answer', false, 190),
    ('partner_1_signatory_designation', false, 200),
    ('partner_1_status1_complaint', false, 210),
    ('partner_1_status1_completion', false, 220),
    ('partner_1_status1_rera_no', false, 230),
    ('partner_1_status1_revoked', false, 240),
    ('partner_1_status1_warrant', false, 250),
    ('partner_1_status2_complaint', false, 260),
    ('partner_1_status2_completion', false, 270),
    ('partner_1_status2_rera_no', false, 280),
    ('partner_1_status2_revoked', false, 290),
    ('partner_1_status2_warrant', false, 300),
    ('partner_1_status3_complaint', false, 310),
    ('partner_1_status3_completion', false, 320),
    ('partner_1_status3_rera_no', false, 330),
    ('partner_1_status3_revoked', false, 340),
    ('partner_1_status3_warrant', false, 350),
    ('partner_1_status4_complaint', false, 360),
    ('partner_1_status4_completion', false, 370),
    ('partner_1_status4_rera_no', false, 380),
    ('partner_1_status4_revoked', false, 390),
    ('partner_1_status4_warrant', false, 400),
    ('partner_2_din_dpin', false, 410),
    ('partner_2_name', false, 420),
    ('partner_2_org1_address', false, 430),
    ('partner_2_org1_name', false, 440),
    ('partner_2_org1_rera_no', false, 450),
    ('partner_2_org2_address', false, 460),
    ('partner_2_org2_name', false, 470),
    ('partner_2_org2_rera_no', false, 480),
    ('partner_2_org3_address', false, 490),
    ('partner_2_org3_name', false, 500),
    ('partner_2_org3_rera_no', false, 510),
    ('partner_2_org4_address', false, 520),
    ('partner_2_org4_name', false, 530),
    ('partner_2_org4_rera_no', false, 540),
    ('partner_2_role_answer', false, 550),
    ('partner_2_signatory_designation', false, 560),
    ('partner_2_status1_complaint', false, 570),
    ('partner_2_status1_completion', false, 580),
    ('partner_2_status1_rera_no', false, 590),
    ('partner_2_status1_revoked', false, 600),
    ('partner_2_status1_warrant', false, 610),
    ('partner_2_status2_complaint', false, 620),
    ('partner_2_status2_completion', false, 630),
    ('partner_2_status2_rera_no', false, 640),
    ('partner_2_status2_revoked', false, 650),
    ('partner_2_status2_warrant', false, 660),
    ('partner_2_status3_complaint', false, 670),
    ('partner_2_status3_completion', false, 680),
    ('partner_2_status3_rera_no', false, 690),
    ('partner_2_status3_revoked', false, 700),
    ('partner_2_status3_warrant', false, 710),
    ('partner_2_status4_complaint', false, 720),
    ('partner_2_status4_completion', false, 730),
    ('partner_2_status4_rera_no', false, 740),
    ('partner_2_status4_revoked', false, 750),
    ('partner_2_status4_warrant', false, 760)
) AS v(placeholder_id, required, sort_order)
WHERE d.slug = 'maharera_disclosure_interest_other_reo'
ON CONFLICT (document_id, placeholder_id) DO UPDATE SET
  required = EXCLUDED.required,
  sort_order = EXCLUDED.sort_order;

INSERT INTO public.application_document_placeholders
  (document_id, placeholder_id, required, sort_order)
SELECT d.id, v.placeholder_id, v.required, v.sort_order
FROM public.application_documents d
CROSS JOIN (
  VALUES
    ('date', true, 10),
    ('project_title', true, 20),
    ('ms_name', false, 30),
    ('owner_ca_name', false, 40),
    ('place', false, 50),
    ('declarant_capacity', false, 60),
    ('declarant_capacity_2', false, 70),
    ('land_description', false, 80),
    ('project_land_area', false, 90),
    ('promoter_office_address', false, 100),
    ('signatory_designation', false, 110)
) AS v(placeholder_id, required, sort_order)
WHERE d.slug = 'maharera_annexure_a_declaration_undertaking'
ON CONFLICT (document_id, placeholder_id) DO UPDATE SET
  required = EXCLUDED.required,
  sort_order = EXCLUDED.sort_order;

INSERT INTO public.application_document_placeholders
  (document_id, placeholder_id, required, sort_order)
SELECT d.id, v.placeholder_id, v.required, v.sort_order
FROM public.application_documents d
CROSS JOIN (
  VALUES
    ('date', true, 10),
    ('project_title', true, 20),
    ('ms_name', false, 30),
    ('owner_ca_name', false, 40),
    ('place', false, 50),
    ('bank_branch_name_address', false, 60),
    ('bank_ifsc', false, 70),
    ('bank_name', false, 80),
    ('branch_manager_email', false, 90),
    ('collection_account_no', false, 100),
    ('designated_promoter_name', false, 110),
    ('separate_account_no', false, 120),
    ('signatory_designation', false, 130),
    ('transaction_account_no', false, 140)
) AS v(placeholder_id, required, sort_order)
WHERE d.slug = 'maharera_format_a_designated_bank_accounts'
ON CONFLICT (document_id, placeholder_id) DO UPDATE SET
  required = EXCLUDED.required,
  sort_order = EXCLUDED.sort_order;

INSERT INTO public.application_document_placeholders
  (document_id, placeholder_id, required, sort_order)
SELECT d.id, v.placeholder_id, v.required, v.sort_order
FROM public.application_documents d
CROSS JOIN (
  VALUES
    ('date', true, 10),
    ('ms_name', false, 20),
    ('owner_ca_name', false, 30),
    ('planning_authority', false, 40),
    ('plot_cs_cts_no', true, 50),
    ('place', false, 60),
    ('building_approval_date', false, 70),
    ('building_approved_configuration', false, 80),
    ('cc_approval_date', false, 90),
    ('cc_granted_habitable_floors', false, 100),
    ('signatory_designation', false, 110),
    ('total_approved_habitable_floors', false, 120)
) AS v(placeholder_id, required, sort_order)
WHERE d.slug = 'maharera_format_d_declaration_cc'
ON CONFLICT (document_id, placeholder_id) DO UPDATE SET
  required = EXCLUDED.required,
  sort_order = EXCLUDED.sort_order;

INSERT INTO public.application_document_placeholders
  (document_id, placeholder_id, required, sort_order)
SELECT d.id, v.placeholder_id, v.required, v.sort_order
FROM public.application_documents d
CROSS JOIN (
  VALUES
    ('ms_name', false, 10),
    ('owner_ca_name', false, 20),
    ('place', false, 30),
    ('promoter_authorization_date', false, 40),
    ('promoter_declarant_designation', false, 50),
    ('promoter_declarant_designation_2', false, 60),
    ('promoter_deponent_designation', false, 70),
    ('promoter_deponent_designation_2', false, 80),
    ('promoter_deponent_entity', false, 90),
    ('promoter_deponent_entity_2', false, 100),
    ('promoter_encumbrance_details', false, 110),
    ('promoter_landowner_entity', false, 120),
    ('promoter_project_completion_date', false, 130),
    ('promoter_verification_day', false, 140),
    ('promoter_verification_month', false, 150),
    ('promoter_verification_year', false, 160),
    ('society_authorization_date', false, 170),
    ('society_declarant_designation', false, 180),
    ('society_declarant_designation_2', false, 190),
    ('society_declarant_name', false, 200),
    ('society_declarant_name_2', false, 210),
    ('society_deponent_designation', false, 220),
    ('society_deponent_designation_2', false, 230),
    ('society_deponent_entity', false, 240),
    ('society_deponent_entity_2', false, 250),
    ('society_encumbrance_details', false, 260),
    ('society_landowner_entity', false, 270),
    ('society_project_completion_date', false, 280),
    ('society_verification_day', false, 290),
    ('society_verification_month', false, 300),
    ('society_verification_year', false, 310)
) AS v(placeholder_id, required, sort_order)
WHERE d.slug = 'maharera_form_b_both_promoters'
ON CONFLICT (document_id, placeholder_id) DO UPDATE SET
  required = EXCLUDED.required,
  sort_order = EXCLUDED.sort_order;

INSERT INTO public.application_document_placeholders
  (document_id, placeholder_id, required, sort_order)
SELECT d.id, v.placeholder_id, v.required, v.sort_order
FROM public.application_documents d
CROSS JOIN (
  VALUES
    ('ms_name', false, 10),
    ('owner_ca_name', false, 20),
    ('place', false, 30),
    ('promoter_authorization_date', false, 40),
    ('promoter_declarant_designation', false, 50),
    ('promoter_declarant_designation_2', false, 60),
    ('promoter_deponent_designation', false, 70),
    ('promoter_deponent_designation_2', false, 80),
    ('promoter_deponent_entity', false, 90),
    ('promoter_deponent_entity_2', false, 100),
    ('promoter_encumbrance_details', false, 110),
    ('promoter_landowner_entity', false, 120),
    ('promoter_project_completion_date', false, 130),
    ('promoter_verification_day', false, 140),
    ('promoter_verification_month', false, 150),
    ('promoter_verification_year', false, 160)
) AS v(placeholder_id, required, sort_order)
WHERE d.slug = 'maharera_form_b_promoter_only'
ON CONFLICT (document_id, placeholder_id) DO UPDATE SET
  required = EXCLUDED.required,
  sort_order = EXCLUDED.sort_order;

INSERT INTO public.application_document_placeholders
  (document_id, placeholder_id, required, sort_order)
SELECT d.id, v.placeholder_id, v.required, v.sort_order
FROM public.application_documents d
CROSS JOIN (
  VALUES
    ('ms_name', false, 10),
    ('place', false, 20),
    ('society_authorization_date', false, 30),
    ('society_declarant_designation', false, 40),
    ('society_declarant_designation_2', false, 50),
    ('society_declarant_name', false, 60),
    ('society_declarant_name_2', false, 70),
    ('society_deponent_designation', false, 80),
    ('society_deponent_designation_2', false, 90),
    ('society_deponent_entity', false, 100),
    ('society_deponent_entity_2', false, 110),
    ('society_encumbrance_details', false, 120),
    ('society_landowner_entity', false, 130),
    ('society_project_completion_date', false, 140),
    ('society_verification_day', false, 150),
    ('society_verification_month', false, 160),
    ('society_verification_year', false, 170)
) AS v(placeholder_id, required, sort_order)
WHERE d.slug = 'maharera_form_b_society_landowner'
ON CONFLICT (document_id, placeholder_id) DO UPDATE SET
  required = EXCLUDED.required,
  sort_order = EXCLUDED.sort_order;

INSERT INTO public.application_document_placeholders
  (document_id, placeholder_id, required, sort_order)
SELECT d.id, v.placeholder_id, v.required, v.sort_order
FROM public.application_documents d
CROSS JOIN (
  VALUES
    ('date', true, 10),
    ('project_title', true, 20),
    ('ms_name', false, 30),
    ('owner_ca_name', false, 40),
    ('maharera_no', true, 50),
    ('architects_name', false, 60),
    ('f1_common_01_details', false, 70),
    ('f1_common_01_percent', false, 80),
    ('f1_common_01_proposed', false, 90),
    ('f1_common_02_details', false, 100),
    ('f1_common_02_percent', false, 110),
    ('f1_common_02_proposed', false, 120),
    ('f1_common_03_details', false, 130),
    ('f1_common_03_percent', false, 140),
    ('f1_common_03_proposed', false, 150),
    ('f1_common_04_details', false, 160),
    ('f1_common_04_percent', false, 170),
    ('f1_common_04_proposed', false, 180),
    ('f1_common_05_details', false, 190),
    ('f1_common_05_percent', false, 200),
    ('f1_common_05_proposed', false, 210),
    ('f1_common_06_details', false, 220),
    ('f1_common_06_percent', false, 230),
    ('f1_common_06_proposed', false, 240),
    ('f1_common_07_details', false, 250),
    ('f1_common_07_percent', false, 260),
    ('f1_common_07_proposed', false, 270),
    ('f1_common_08_details', false, 280),
    ('f1_common_08_percent', false, 290),
    ('f1_common_08_proposed', false, 300),
    ('f1_common_09_details', false, 310),
    ('f1_common_09_percent', false, 320),
    ('f1_common_09_proposed', false, 330),
    ('f1_common_10_details', false, 340),
    ('f1_common_10_percent', false, 350),
    ('f1_common_10_proposed', false, 360),
    ('f1_common_11_details', false, 370),
    ('f1_common_11_percent', false, 380),
    ('f1_common_11_proposed', false, 390),
    ('f1_common_12_details', false, 400),
    ('f1_common_12_percent', false, 410),
    ('f1_common_12_proposed', false, 420),
    ('f1_common_13_details', false, 430),
    ('f1_common_13_percent', false, 440),
    ('f1_common_13_proposed', false, 450),
    ('f1_common_14_details', false, 460),
    ('f1_common_14_percent', false, 470),
    ('f1_common_14_proposed', false, 480),
    ('f1_layout_building_wing_no', false, 490),
    ('f1_license_no', false, 500),
    ('f1_promoter_name_address', false, 510),
    ('f1_promoter_signature', false, 520),
    ('f1_registered_phase_project_no', false, 530),
    ('f1_task_01_percent', false, 540),
    ('f1_task_02_percent', false, 550),
    ('f1_task_03_percent', false, 560),
    ('f1_task_04_percent', false, 570),
    ('f1_task_05_percent', false, 580),
    ('f1_task_06_percent', false, 590),
    ('f1_task_07_percent', false, 600),
    ('f1_task_08_percent', false, 610),
    ('f1_task_09_percent', false, 620),
    ('f1_task_10_percent', false, 630),
    ('f1_task_11_percent', false, 640)
) AS v(placeholder_id, required, sort_order)
WHERE d.slug = 'maharera_form_1_architect_certificate'
ON CONFLICT (document_id, placeholder_id) DO UPDATE SET
  required = EXCLUDED.required,
  sort_order = EXCLUDED.sort_order;

INSERT INTO public.application_document_placeholders
  (document_id, placeholder_id, required, sort_order)
SELECT d.id, v.placeholder_id, v.required, v.sort_order
FROM public.application_documents d
CROSS JOIN (
  VALUES
    ('date', true, 10),
    ('project_title', true, 20),
    ('ms_name', false, 30),
    ('owner_ca_name', false, 40),
    ('maharera_no', true, 50),
    ('planning_authority', false, 60),
    ('f2_a_balance_cost', false, 70),
    ('f2_a_cost_incurred', false, 80),
    ('f2_a_estimated_cost', false, 90),
    ('f2_a_extra_cost', false, 100),
    ('f2_a_work_percent', false, 110),
    ('f2_b_balance_cost', false, 120),
    ('f2_b_cost_incurred', false, 130),
    ('f2_b_estimated_cost', false, 140),
    ('f2_b_extra_cost', false, 150),
    ('f2_b_work_percent', false, 160),
    ('f2_balance_cost_completion', false, 170),
    ('f2_building_wing_layout_name', false, 180),
    ('f2_building_wing_layout_no', false, 190),
    ('f2_c_amount_1', false, 200),
    ('f2_c_amount_2', false, 210),
    ('f2_c_item_1', false, 220),
    ('f2_c_item_2', false, 230),
    ('f2_engineer_name', false, 240),
    ('f2_engineer_signature_name', false, 250),
    ('f2_estimated_cost_incurred', false, 260),
    ('f2_local_authority_license_no', false, 270),
    ('f2_promoter_name_address', false, 280),
    ('f2_promoter_signature', false, 290),
    ('f2_quantity_surveyor_name', false, 300),
    ('f2_total_estimated_cost', false, 310)
) AS v(placeholder_id, required, sort_order)
WHERE d.slug = 'maharera_form_2_engineer_certificate'
ON CONFLICT (document_id, placeholder_id) DO UPDATE SET
  required = EXCLUDED.required,
  sort_order = EXCLUDED.sort_order;

INSERT INTO public.application_document_placeholders
  (document_id, placeholder_id, required, sort_order)
SELECT d.id, v.placeholder_id, v.required, v.sort_order
FROM public.application_documents d
CROSS JOIN (
  VALUES
    ('date', true, 10),
    ('project_title', true, 20),
    ('ms_name', false, 30),
    ('owner_ca_name', false, 40),
    ('maharera_no', true, 50),
    ('f3_a_additional', false, 60),
    ('f3_a_clearance', false, 70),
    ('f3_a_construction', false, 80),
    ('f3_a_development_exp', false, 90),
    ('f3_a_interest', false, 100),
    ('f3_a_land_asr', false, 110),
    ('f3_a_land_premium', false, 120),
    ('f3_a_premium', false, 130),
    ('f3_a_rehab_construction', false, 140),
    ('f3_a_rehab_other', false, 150),
    ('f3_a_rehab_premium', false, 160),
    ('f3_a_stamp_duty', false, 170),
    ('f3_a_subtotal_development', false, 180),
    ('f3_a_subtotal_land', false, 190),
    ('f3_a_taxes', false, 200),
    ('f3_a_tdr', false, 210),
    ('f3_a_total_project', false, 220),
    ('f3_b_additional', false, 230),
    ('f3_b_clearance', false, 240),
    ('f3_b_construction', false, 250),
    ('f3_b_development_exp', false, 260),
    ('f3_b_interest', false, 270),
    ('f3_b_land_asr', false, 280),
    ('f3_b_land_premium', false, 290),
    ('f3_b_net_withdrawal', false, 300),
    ('f3_b_premium', false, 310),
    ('f3_b_proportion', false, 320),
    ('f3_b_rehab_construction', false, 330),
    ('f3_b_rehab_other', false, 340),
    ('f3_b_rehab_premium', false, 350),
    ('f3_b_stamp_duty', false, 360),
    ('f3_b_subtotal_development', false, 370),
    ('f3_b_subtotal_land', false, 380),
    ('f3_b_taxes', false, 390),
    ('f3_b_tdr', false, 400),
    ('f3_b_total_actual', false, 410),
    ('f3_b_withdrawable', false, 420),
    ('f3_b_withdrawn_till_date', false, 430),
    ('f3_c_sold_1_area', false, 440),
    ('f3_c_sold_1_balance', false, 450),
    ('f3_c_sold_1_consideration', false, 460),
    ('f3_c_sold_1_flat', false, 470),
    ('f3_c_sold_1_received', false, 480),
    ('f3_c_sold_2_area', false, 490),
    ('f3_c_sold_2_balance', false, 500),
    ('f3_c_sold_2_consideration', false, 510),
    ('f3_c_sold_2_flat', false, 520),
    ('f3_c_sold_2_received', false, 530),
    ('f3_c_sold_3_area', false, 540),
    ('f3_c_sold_3_balance', false, 550),
    ('f3_c_sold_3_consideration', false, 560),
    ('f3_c_sold_3_flat', false, 570),
    ('f3_c_sold_3_received', false, 580),
    ('f3_c_sold_total_area', false, 590),
    ('f3_c_sold_total_balance', false, 600),
    ('f3_c_sold_total_consideration', false, 610),
    ('f3_c_sold_total_received', false, 620),
    ('f3_c_unsold_1_area', false, 630),
    ('f3_c_unsold_1_flat', false, 640),
    ('f3_c_unsold_1_rr_value', false, 650),
    ('f3_c_unsold_2_area', false, 660),
    ('f3_c_unsold_2_flat', false, 670),
    ('f3_c_unsold_2_rr_value', false, 680),
    ('f3_c_unsold_3_area', false, 690),
    ('f3_c_unsold_3_flat', false, 700),
    ('f3_c_unsold_3_rr_value', false, 710),
    ('f3_c_unsold_total_area', false, 720),
    ('f3_c_unsold_total_rr_value', false, 730),
    ('f3_ca_name', false, 740),
    ('f3_ca_signature_name', false, 750),
    ('f3_d_balance_cost', false, 760),
    ('f3_d_deposit_percent', false, 770),
    ('f3_d_estimated_receivables', false, 780),
    ('f3_d_sold_receivables', false, 790),
    ('f3_d_unsold_area', false, 800),
    ('f3_d_unsold_sales_proceeds', false, 810),
    ('f3_e_closing_balance', false, 820),
    ('f3_e_deposits', false, 830),
    ('f3_e_opening_balance', false, 840),
    ('f3_e_withdrawals', false, 850),
    ('f3_f_cost_act', false, 860),
    ('f3_f_cost_est', false, 870),
    ('f3_f_cost_prop', false, 880),
    ('f3_f_customer_act', false, 890),
    ('f3_f_customer_est', false, 900),
    ('f3_f_customer_prop', false, 910),
    ('f3_f_own_act', false, 920),
    ('f3_f_own_est', false, 930),
    ('f3_f_own_prop', false, 940),
    ('f3_f_secured_act', false, 950),
    ('f3_f_secured_est', false, 960),
    ('f3_f_secured_prop', false, 970),
    ('f3_f_total_act', false, 980),
    ('f3_f_total_est', false, 990),
    ('f3_f_total_prop', false, 1000),
    ('f3_f_unsecured_act', false, 1010),
    ('f3_f_unsecured_est', false, 1020),
    ('f3_f_unsecured_prop', false, 1030),
    ('f3_g_comment_1', false, 1040),
    ('f3_g_comment_2', false, 1050),
    ('f3_g_comment_3', false, 1060),
    ('f3_g_comment_4', false, 1070),
    ('f3_membership_no', false, 1080),
    ('f3_promoter_name_address', false, 1090),
    ('f3_promoter_signature', false, 1100),
    ('f3_udin', false, 1110)
) AS v(placeholder_id, required, sort_order)
WHERE d.slug = 'maharera_form_3_ca_certificate'
ON CONFLICT (document_id, placeholder_id) DO UPDATE SET
  required = EXCLUDED.required,
  sort_order = EXCLUDED.sort_order;

INSERT INTO public.application_document_placeholders
  (document_id, placeholder_id, required, sort_order)
SELECT d.id, v.placeholder_id, v.required, v.sort_order
FROM public.application_documents d
CROSS JOIN (
  VALUES
    ('date', true, 10),
    ('project_title', true, 20),
    ('ms_name', false, 30),
    ('owner_ca_name', false, 40),
    ('maharera_no', true, 50),
    ('place', false, 60),
    ('f2a_certificate_no', false, 70),
    ('f2a_engineer_name', false, 80),
    ('f2a_engineer_site_supervisor_name', false, 90),
    ('f2a_input_01_no', false, 100),
    ('f2a_input_01_remarks', false, 110),
    ('f2a_input_01_yes', false, 120),
    ('f2a_input_02_no', false, 130),
    ('f2a_input_02_remarks', false, 140),
    ('f2a_input_02_yes', false, 150),
    ('f2a_input_03_no', false, 160),
    ('f2a_input_03_remarks', false, 170),
    ('f2a_input_03_yes', false, 180),
    ('f2a_input_04_no', false, 190),
    ('f2a_input_04_remarks', false, 200),
    ('f2a_input_04_yes', false, 210),
    ('f2a_license_no', false, 220),
    ('f2a_misc_01_no', false, 230),
    ('f2a_misc_01_remarks', false, 240),
    ('f2a_misc_01_yes', false, 250),
    ('f2a_misc_02_no', false, 260),
    ('f2a_misc_02_remarks', false, 270),
    ('f2a_misc_02_yes', false, 280),
    ('f2a_misc_03_no', false, 290),
    ('f2a_misc_03_remarks', false, 300),
    ('f2a_misc_03_yes', false, 310),
    ('f2a_misc_04_no', false, 320),
    ('f2a_misc_04_remarks', false, 330),
    ('f2a_misc_04_yes', false, 340),
    ('f2a_misc_05_no', false, 350),
    ('f2a_misc_05_remarks', false, 360),
    ('f2a_misc_05_yes', false, 370),
    ('f2a_misc_06_no', false, 380),
    ('f2a_misc_06_remarks', false, 390),
    ('f2a_misc_06_yes', false, 400),
    ('f2a_misc_07_no', false, 410),
    ('f2a_misc_07_remarks', false, 420),
    ('f2a_misc_07_yes', false, 430),
    ('f2a_misc_08_no', false, 440),
    ('f2a_misc_08_remarks', false, 450),
    ('f2a_misc_08_yes', false, 460),
    ('f2a_phone_no', false, 470),
    ('f2a_promoter_name_address', false, 480),
    ('f2a_promoter_signature', false, 490),
    ('f2a_qualification', false, 500),
    ('f2a_struct_01_no', false, 510),
    ('f2a_struct_01_remarks', false, 520),
    ('f2a_struct_01_yes', false, 530),
    ('f2a_struct_02_no', false, 540),
    ('f2a_struct_02_yes', false, 550),
    ('f2a_struct_03_no', false, 560),
    ('f2a_struct_03_remarks', false, 570),
    ('f2a_struct_03_yes', false, 580),
    ('f2a_struct_04_no', false, 590),
    ('f2a_struct_04_remarks', false, 600),
    ('f2a_struct_04_yes', false, 610),
    ('f2a_struct_05_no', false, 620),
    ('f2a_struct_05_remarks', false, 630),
    ('f2a_struct_05_yes', false, 640),
    ('f2a_struct_06_no', false, 650),
    ('f2a_struct_06_remarks', false, 660),
    ('f2a_struct_06_yes', false, 670),
    ('f2a_struct_engineer_email', false, 680),
    ('f2a_struct_engineer_license', false, 690),
    ('f2a_struct_engineer_mobile', false, 700),
    ('f2a_struct_engineer_name', false, 710),
    ('f2a_work_01_no', false, 720),
    ('f2a_work_01_remarks', false, 730),
    ('f2a_work_01_yes', false, 740),
    ('f2a_work_02_no', false, 750),
    ('f2a_work_02_remarks', false, 760),
    ('f2a_work_02_yes', false, 770),
    ('f2a_work_03_no', false, 780),
    ('f2a_work_03_remarks', false, 790),
    ('f2a_work_03_yes', false, 800),
    ('f2a_work_04_no', false, 810),
    ('f2a_work_04_remarks', false, 820),
    ('f2a_work_04_yes', false, 830),
    ('f2a_work_05_no', false, 840),
    ('f2a_work_05_remarks', false, 850),
    ('f2a_work_05_yes', false, 860),
    ('f2a_year_ending', false, 870)
) AS v(placeholder_id, required, sort_order)
WHERE d.slug = 'maharera_form_2a_quality_assurance'
ON CONFLICT (document_id, placeholder_id) DO UPDATE SET
  required = EXCLUDED.required,
  sort_order = EXCLUDED.sort_order;

INSERT INTO public.application_document_placeholders
  (document_id, placeholder_id, required, sort_order)
SELECT d.id, v.placeholder_id, v.required, v.sort_order
FROM public.application_documents d
CROSS JOIN (
  VALUES
    ('date', true, 10),
    ('project_title', true, 20),
    ('ms_name', false, 30),
    ('maharera_no', true, 40),
    ('place', false, 50),
    ('f5_amount_collected_during_year', false, 60),
    ('f5_amount_collected_till_date', false, 70),
    ('f5_amount_withdrawn_during_year', false, 80),
    ('f5_amount_withdrawn_till_date', false, 90),
    ('f5_ca_full_address', false, 100),
    ('f5_ca_signatory_name', false, 110),
    ('f5_contact_no', false, 120),
    ('f5_email', false, 130),
    ('f5_exception_details', false, 140),
    ('f5_membership_no', false, 150),
    ('f5_period_ended', false, 160),
    ('f5_period_from', false, 170),
    ('f5_period_to', false, 180),
    ('f5_project_completion_percent', false, 190),
    ('f5_project_location', false, 200),
    ('f5_project_reference', false, 210),
    ('f5_promoter_name_address', false, 220)
) AS v(placeholder_id, required, sort_order)
WHERE d.slug = 'maharera_form_5_annual_report_accounts'
ON CONFLICT (document_id, placeholder_id) DO UPDATE SET
  required = EXCLUDED.required,
  sort_order = EXCLUDED.sort_order;
