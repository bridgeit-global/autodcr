-- General / Document Checklist: annexures & notices (catalog only, no TypeScript).
-- HTML lives in Storage Application_Templates under General/document checklist/.

INSERT INTO public.placeholders
  (id, token, legacy_token, label, source_table, source_column, ui_group)
VALUES
  ('suburb', '{{SUBURB}}', NULL, 'Suburb', 'computed', NULL, 'letterhead'),
  ('plot_no', '{{PLOT_NO}}', NULL, 'Plot number', 'projects', 'save_plot_details->>plotNo', 'subject'),
  ('cs_no', '{{CS_NO}}', NULL, 'C.S. number', 'projects', 'save_plot_details->>proposedCtsNumber', 'subject'),
  ('salutation', '{{SALUTATION}}', NULL, 'Salutation', 'computed', NULL, 'consultant'),
  ('last_approval_no', '{{LAST_APPROVAL_NO}}', NULL, 'Last approval number / date', 'computed', NULL, 'reference'),
  ('date_of_prc', '{{DATE_OF_PRC}}', NULL, 'Date of P.R. Card', 'computed', NULL, 'other'),
  ('owner_firm', '{{OWNER_FIRM}}', NULL, 'Owner / applicant firm name', 'owner_applicant', 'entity_name', 'client'),
  ('communication_address', '{{COMMUNICATION_ADDRESS}}', NULL, 'Communication address', 'owner_applicant', 'address_line1', 'client'),
  ('s_no', '{{S_NO}}', NULL, 'Survey number', 'projects', 'save_plot_details->>surveyNo', 'subject'),
  ('h_no', '{{H_NO}}', NULL, 'Hissa number', 'projects', 'save_plot_details->>hissaNo', 'subject'),
  ('appointment_date', '{{APPOINTMENT_DATE}}', NULL, 'Appointment date', 'computed', NULL, 'other'),
  ('architect_address_line_1', '{{ARCHITECT_ADDRESS_LINE_1}}', NULL, 'Architect address line 1', 'applicants', 'address_line1', 'consultant'),
  ('architect_address_line_2', '{{ARCHITECT_ADDRESS_LINE_2}}', NULL, 'Architect address line 2', 'applicants', 'address_line2', 'consultant'),
  ('architect_address_line_3', '{{ARCHITECT_ADDRESS_LINE_3}}', NULL, 'Architect address line 3', 'applicants', 'address_line3', 'consultant'),
  ('plot_area_words', '{{PLOT_AREA_WORDS}}', NULL, 'Plot area in words', 'computed', NULL, 'other'),
  ('city', '{{CITY}}', NULL, 'City', 'computed', NULL, 'other'),
  ('affidavit_day', '{{AFFIDAVIT_DAY}}', NULL, 'Affidavit day', 'computed', NULL, 'other'),
  ('affidavit_month', '{{AFFIDAVIT_MONTH}}', NULL, 'Affidavit month', 'computed', NULL, 'other'),
  ('affidavit_year', '{{AFFIDAVIT_YEAR}}', NULL, 'Affidavit year', 'computed', NULL, 'other'),
  ('development_rights_date', '{{DEVELOPMENT_RIGHTS_DATE}}', NULL, 'Development rights instrument date', 'computed', NULL, 'other'),
  ('owner_or_developer', '{{OWNER_OR_DEVELOPER}}', NULL, 'Owner or Developer', 'computed', NULL, 'client')
ON CONFLICT (id) DO UPDATE SET
  token = EXCLUDED.token,
  label = EXCLUDED.label,
  source_table = EXCLUDED.source_table,
  source_column = EXCLUDED.source_column,
  ui_group = EXCLUDED.ui_group,
  is_active = true,
  updated_at = now();

INSERT INTO public.application_types
  (slug, department, application_title, description, category,
   applicant_type, planning_authorities, requires_roster_match,
   sort_order, icon_key, is_active)
VALUES
  (
    'general_document_checklist',
    'General',
    'Document Checklist',
    'Plot area, supervision memos, start-of-work notice, plinth and development completion forms, and owner plot area affidavit',
    'department_permission',
    NULL,
    '{}'::text[],
    false,
    200,
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
  v.slug, t.id, v.category, v.html, v.sign, NULL,
  v.show_letterhead, false, v.letterhead_source, v.sort_order, true
FROM public.application_types t
CROSS JOIN (
  VALUES
    (
      'gdc_plot_area_certificate',
      'Plot Area Certificate',
      'General/document checklist/Plot Area Certificate.html',
      ARRAY['architect_or_ls']::text[],
      true,
      'owner'::text,
      10
    ),
    (
      'gdc_supervision_architect',
      'Supervision Memo — Architect',
      'General/document checklist/Supervision Memo Of Architect.html',
      ARRAY['architect_or_ls']::text[],
      true,
      'architect_or_ls'::text,
      20
    ),
    (
      'gdc_supervision_structural',
      'Supervision Memo — Structural Engineer',
      'General/document checklist/Supervision Memo Of Structural Engineer.html',
      ARRAY['consultant']::text[],
      true,
      'consultant'::text,
      30
    ),
    (
      'gdc_supervision_plumber',
      'Supervision Memo — Licensed Plumber',
      'General/document checklist/Supervision Memo Of Licensed Plumber.html',
      ARRAY['consultant']::text[],
      true,
      'consultant'::text,
      40
    ),
    (
      'gdc_supervision_site_supervisor',
      'Supervision Memo — Site Supervisor',
      'General/document checklist/Supervision Memo Of Site Supervisor.html',
      ARRAY['consultant']::text[],
      true,
      'consultant'::text,
      50
    ),
    (
      'gdc_notice_start_of_work',
      'Notice for Start of Work',
      'General/document checklist/Form of Notice for Start of Work.html',
      ARRAY['owner']::text[],
      false,
      'owner'::text,
      60
    ),
    (
      'gdc_plinth_completion',
      'Intimation of Completion upto Plinth',
      'General/document checklist/Intimation of Completion of Work upto Plinth Level.html',
      ARRAY['architect_or_ls']::text[],
      true,
      'owner'::text,
      70
    ),
    (
      'gdc_development_completion',
      'Development Completion Certificate',
      'General/document checklist/Development completion certificate.html',
      ARRAY['architect_or_ls']::text[],
      true,
      'owner'::text,
      80
    ),
    (
      'gdc_owners_plot_area_affidavit',
      'Owner''s Plot Area Affidavit',
      'General/document checklist/Owners Plot Area Affidavit.html',
      ARRAY['owner']::text[],
      false,
      'owner'::text,
      90
    )
) AS v(slug, category, html, sign, show_letterhead, letterhead_source, sort_order)
WHERE t.slug = 'general_document_checklist'
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

-- Shared type-level placeholders
INSERT INTO public.application_type_placeholders
  (application_type_id, placeholder_id, required, sort_order)
SELECT t.id, v.placeholder_id, false, v.sort_order
FROM public.application_types t
CROSS JOIN (
  VALUES
    ('ward', 10),
    ('suburb', 20),
    ('bp_organisation', 30),
    ('bp_address_line_1', 40),
    ('bp_address_line_2', 50),
    ('bp_address_line_3', 60),
    ('file_no', 70),
    ('project_title', 80),
    ('plot_no', 90),
    ('plot_cs_cts_no', 95),
    ('cs_no', 100),
    ('cts_no', 110),
    ('fp_no', 120),
    ('village', 130),
    ('division', 140),
    ('village_division', 145),
    ('tps_no', 150),
    ('property_address', 160),
    ('type_of_development', 170),
    ('letter_date', 180),
    ('client_name', 190),
    ('applicant_name', 200),
    ('owner_name', 210),
    ('owner_or_developer', 220)
) AS v(placeholder_id, sort_order)
WHERE t.slug = 'general_document_checklist'
ON CONFLICT (application_type_id, placeholder_id) DO UPDATE SET
  required = EXCLUDED.required,
  sort_order = EXCLUDED.sort_order;

-- Per-document placeholders
INSERT INTO public.application_document_placeholders
  (document_id, placeholder_id, required, sort_order)
SELECT d.id, v.placeholder_id, false, v.sort_order
FROM public.application_documents d
CROSS JOIN (
  VALUES
    ('plot_area', 10),
    ('date_of_prc', 20),
    ('consultant_firm', 30),
    ('salutation', 40),
    ('architect_ls_name', 50),
    ('reg_no', 60),
    ('validity', 70)
) AS v(placeholder_id, sort_order)
WHERE d.slug = 'gdc_plot_area_certificate'
ON CONFLICT (document_id, placeholder_id) DO UPDATE SET
  required = EXCLUDED.required,
  sort_order = EXCLUDED.sort_order;

INSERT INTO public.application_document_placeholders
  (document_id, placeholder_id, required, sort_order)
SELECT d.id, v.placeholder_id, false, v.sort_order
FROM public.application_documents d
CROSS JOIN (
  VALUES
    ('consultant_firm', 10),
    ('salutation', 20),
    ('architect_ls_name', 30),
    ('reg_no', 40),
    ('validity', 50),
    ('owner_or_developer', 55),
    ('owner_firm', 60),
    ('owner_address_line_1', 70),
    ('owner_address_line_2', 80),
    ('owner_address_line_3', 90)
) AS v(placeholder_id, sort_order)
WHERE d.slug = 'gdc_supervision_architect'
ON CONFLICT (document_id, placeholder_id) DO UPDATE SET
  required = EXCLUDED.required,
  sort_order = EXCLUDED.sort_order;

INSERT INTO public.application_document_placeholders
  (document_id, placeholder_id, required, sort_order)
SELECT d.id, v.placeholder_id, false, v.sort_order
FROM public.application_documents d
CROSS JOIN (
  VALUES
    ('appointment_date', 10),
    ('consultant_firm', 20),
    ('structural_engineer', 30),
    ('reg_no', 40),
    ('validity', 50),
    ('owner_or_developer', 55),
    ('owner_firm', 60),
    ('owner_address_line_1', 70),
    ('owner_address_line_2', 80),
    ('owner_address_line_3', 90),
    ('architect_ls_name', 100),
    ('architect_ls_office', 110),
    ('architect_address_line_1', 120),
    ('architect_address_line_2', 130),
    ('architect_address_line_3', 140)
) AS v(placeholder_id, sort_order)
WHERE d.slug = 'gdc_supervision_structural'
ON CONFLICT (document_id, placeholder_id) DO UPDATE SET
  required = EXCLUDED.required,
  sort_order = EXCLUDED.sort_order;

INSERT INTO public.application_document_placeholders
  (document_id, placeholder_id, required, sort_order)
SELECT d.id, v.placeholder_id, false, v.sort_order
FROM public.application_documents d
CROSS JOIN (
  VALUES
    ('consultant_firm', 10),
    ('licensed_plumber', 20),
    ('reg_no', 30),
    ('validity', 40),
    ('owner_or_developer', 45),
    ('owner_firm', 50),
    ('owner_address_line_1', 60),
    ('owner_address_line_2', 70),
    ('owner_address_line_3', 80),
    ('architect_ls_name', 90),
    ('architect_ls_office', 100),
    ('architect_address_line_1', 110),
    ('architect_address_line_2', 120),
    ('architect_address_line_3', 130)
) AS v(placeholder_id, sort_order)
WHERE d.slug = 'gdc_supervision_plumber'
ON CONFLICT (document_id, placeholder_id) DO UPDATE SET
  required = EXCLUDED.required,
  sort_order = EXCLUDED.sort_order;

INSERT INTO public.application_document_placeholders
  (document_id, placeholder_id, required, sort_order)
SELECT d.id, v.placeholder_id, false, v.sort_order
FROM public.application_documents d
CROSS JOIN (
  VALUES
    ('appointment_date', 10),
    ('consultant_firm', 20),
    ('site_supervisor', 30),
    ('reg_no', 40),
    ('validity', 50),
    ('owner_or_developer', 55),
    ('owner_firm', 60),
    ('owner_address_line_1', 70),
    ('owner_address_line_2', 80),
    ('owner_address_line_3', 90),
    ('architect_ls_name', 100),
    ('architect_ls_office', 110),
    ('architect_address_line_1', 120),
    ('architect_address_line_2', 130),
    ('architect_address_line_3', 140)
) AS v(placeholder_id, sort_order)
WHERE d.slug = 'gdc_supervision_site_supervisor'
ON CONFLICT (document_id, placeholder_id) DO UPDATE SET
  required = EXCLUDED.required,
  sort_order = EXCLUDED.sort_order;

INSERT INTO public.application_document_placeholders
  (document_id, placeholder_id, required, sort_order)
SELECT d.id, v.placeholder_id, false, v.sort_order
FROM public.application_documents d
CROSS JOIN (
  VALUES
    ('building_no', 10),
    ('work_start_date', 20),
    ('last_approval_no', 30),
    ('architects_name', 40),
    ('architect_ls_reg_no', 50),
    ('owner_address_line_1', 60),
    ('owner_address_line_2', 70),
    ('owner_address_line_3', 80)
) AS v(placeholder_id, sort_order)
WHERE d.slug = 'gdc_notice_start_of_work'
ON CONFLICT (document_id, placeholder_id) DO UPDATE SET
  required = EXCLUDED.required,
  sort_order = EXCLUDED.sort_order;

INSERT INTO public.application_document_placeholders
  (document_id, placeholder_id, required, sort_order)
SELECT d.id, v.placeholder_id, false, v.sort_order
FROM public.application_documents d
CROSS JOIN (
  VALUES
    ('building_no', 10),
    ('last_approval_no', 20),
    ('consultant_firm', 30),
    ('salutation', 40),
    ('architect_ls_name', 50),
    ('reg_no', 60),
    ('validity', 70)
) AS v(placeholder_id, sort_order)
WHERE d.slug = 'gdc_plinth_completion'
ON CONFLICT (document_id, placeholder_id) DO UPDATE SET
  required = EXCLUDED.required,
  sort_order = EXCLUDED.sort_order;

INSERT INTO public.application_document_placeholders
  (document_id, placeholder_id, required, sort_order)
SELECT d.id, v.placeholder_id, false, v.sort_order
FROM public.application_documents d
CROSS JOIN (
  VALUES
    ('building_no', 10),
    ('last_approval_no', 20),
    ('consultant_firm', 30),
    ('salutation', 40),
    ('architect_ls_name', 50),
    ('reg_no', 60),
    ('validity', 70)
) AS v(placeholder_id, sort_order)
WHERE d.slug = 'gdc_development_completion'
ON CONFLICT (document_id, placeholder_id) DO UPDATE SET
  required = EXCLUDED.required,
  sort_order = EXCLUDED.sort_order;

INSERT INTO public.application_document_placeholders
  (document_id, placeholder_id, required, sort_order)
SELECT d.id, v.placeholder_id, false, v.sort_order
FROM public.application_documents d
CROSS JOIN (
  VALUES
    ('salutation', 10),
    ('signatory_designation', 20),
    ('owner_firm', 30),
    ('communication_address', 40),
    ('development_rights_date', 50),
    ('s_no', 60),
    ('h_no', 70),
    ('architect_ls_name', 80),
    ('architect_ls_reg_no', 90),
    ('plot_area', 100),
    ('plot_area_words', 110),
    ('city', 120),
    ('affidavit_day', 130),
    ('affidavit_month', 140),
    ('affidavit_year', 150),
    ('owner_address_line_1', 160)
) AS v(placeholder_id, sort_order)
WHERE d.slug = 'gdc_owners_plot_area_affidavit'
ON CONFLICT (document_id, placeholder_id) DO UPDATE SET
  required = EXCLUDED.required,
  sort_order = EXCLUDED.sort_order;
