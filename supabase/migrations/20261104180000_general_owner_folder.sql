-- General → Owner folder (plinth, development completion, owner's plot area affidavit).
-- Plinth + Development Completion also on Architect appointment type.
-- Retire Document Checklist.

INSERT INTO public.application_types
  (slug, department, application_title, description, category,
   applicant_type, planning_authorities, requires_roster_match,
   sort_order, icon_key, is_active)
VALUES
  (
    'general_owner',
    'General',
    'Owner',
    'Owner annexures: plinth completion, development completion certificate, and owner plot area affidavit',
    'department_permission',
    NULL,
    '{}'::text[],
    false,
    190,
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

-- Shared type-level placeholders (same set Document Checklist used for annexures)
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
WHERE t.slug = 'general_owner'
ON CONFLICT (application_type_id, placeholder_id) DO UPDATE SET
  required = EXCLUDED.required,
  sort_order = EXCLUDED.sort_order;

-- Owner documents (3)
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
      'owner_plinth_completion',
      'Intimation of Completion upto Plinth',
      'General/owner/plinth-completion.html',
      ARRAY['architect_or_ls']::text[],
      true,
      'owner'::text,
      10
    ),
    (
      'owner_development_completion',
      'Development Completion Certificate',
      'General/owner/development-completion-certificate.html',
      ARRAY['architect_or_ls']::text[],
      true,
      'owner'::text,
      20
    ),
    (
      'owner_plot_area_affidavit',
      'Owner''s Plot Area Affidavit',
      'General/owner/owners-plot-area-affidavit.html',
      ARRAY['owner']::text[],
      false,
      'owner'::text,
      30
    )
) AS v(slug, category, html, sign, show_letterhead, letterhead_source, sort_order)
WHERE t.slug = 'general_owner'
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

-- Architect also gets plinth + development completion (shared HTML under General/owner/)
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
      'architect_plinth_completion',
      'Intimation of Completion upto Plinth',
      'General/owner/plinth-completion.html',
      ARRAY['architect_or_ls']::text[],
      true,
      'owner'::text,
      60
    ),
    (
      'architect_development_completion',
      'Development Completion Certificate',
      'General/owner/development-completion-certificate.html',
      ARRAY['architect_or_ls']::text[],
      true,
      'owner'::text,
      70
    )
) AS v(slug, category, html, sign, show_letterhead, letterhead_source, sort_order)
WHERE t.slug = 'appointment_letter_for_architect'
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

-- Annexure + completion-specific placeholders (Owner + Architect copies)
INSERT INTO public.application_document_placeholders
  (document_id, placeholder_id, required, sort_order, section_label)
SELECT d.id, v.placeholder_id, false, v.sort_order, v.section_label
FROM public.application_documents d
CROSS JOIN (
  VALUES
    ('letter_date', 10, 'Date'),
    ('file_no', 20, 'Reference'),
    ('building_no', 30, 'Reference'),
    ('last_approval_no', 40, 'Reference'),
    ('suburb', 50, 'Addressee'),
    ('bp_address_line_1', 60, 'Addressee'),
    ('bp_address_line_2', 70, 'Addressee'),
    ('bp_address_line_3', 80, 'Addressee'),
    ('plot_cs_cts_no', 90, 'Proposal'),
    ('village_division', 100, 'Proposal'),
    ('property_address', 110, 'Proposal'),
    ('ward', 120, 'Proposal'),
    ('consultant_firm', 200, 'Consultant'),
    ('salutation', 210, 'Consultant'),
    ('architect_ls_name', 220, 'Consultant'),
    ('architect_or_ls_role', 225, 'Consultant'),
    ('architect_or_ls_reg_label', 226, 'Consultant'),
    ('architect_ls_reg_no', 230, 'Consultant'),
    ('architect_ls_validity', 235, 'Consultant'),
    ('reg_no', 240, 'Consultant'),
    ('validity', 250, 'Consultant')
) AS v(placeholder_id, sort_order, section_label)
WHERE d.slug IN (
  'owner_plinth_completion',
  'owner_development_completion',
  'architect_plinth_completion',
  'architect_development_completion'
)
ON CONFLICT (document_id, placeholder_id) DO UPDATE SET
  section_label = EXCLUDED.section_label,
  sort_order = EXCLUDED.sort_order;

-- Owner's Plot Area Affidavit (Owner folder only)
INSERT INTO public.application_document_placeholders
  (document_id, placeholder_id, required, sort_order, section_label)
SELECT d.id, v.placeholder_id, false, v.sort_order, v.section_label
FROM public.application_documents d
CROSS JOIN (
  VALUES
    ('affidavit_day', 10, 'Date'),
    ('affidavit_month', 20, 'Date'),
    ('affidavit_year', 30, 'Date'),
    ('letter_date', 40, 'Date'),
    ('file_no', 50, 'Reference'),
    ('development_rights_date', 60, 'Reference'),
    ('suburb', 70, 'Addressee'),
    ('bp_address_line_1', 80, 'Addressee'),
    ('bp_address_line_2', 90, 'Addressee'),
    ('bp_address_line_3', 100, 'Addressee'),
    ('project_title', 110, 'Subject'),
    ('s_no', 120, 'Subject'),
    ('h_no', 130, 'Subject'),
    ('plot_cs_cts_no', 140, 'Subject'),
    ('village', 150, 'Subject'),
    ('property_address', 160, 'Subject'),
    ('ward', 170, 'Subject'),
    ('city', 180, 'Subject'),
    ('salutation', 200, 'Client'),
    ('applicant_name', 210, 'Client'),
    ('signatory_designation', 220, 'Client'),
    ('owner_firm', 230, 'Client'),
    ('communication_address', 240, 'Client'),
    ('owner_address_line_1', 250, 'Client'),
    ('architect_ls_name', 300, 'Consultant'),
    ('architect_ls_reg_no', 310, 'Consultant'),
    ('plot_area', 400, 'Plot / area'),
    ('plot_area_words', 410, 'Plot / area')
) AS v(placeholder_id, sort_order, section_label)
WHERE d.slug = 'owner_plot_area_affidavit'
ON CONFLICT (document_id, placeholder_id) DO UPDATE SET
  section_label = EXCLUDED.section_label,
  sort_order = EXCLUDED.sort_order;

-- Retire Document Checklist
UPDATE public.application_documents
SET is_active = false
WHERE slug IN (
  'gdc_plinth_completion',
  'gdc_development_completion',
  'gdc_owners_plot_area_affidavit',
  'gdc_plot_area_certificate',
  'gdc_notice_start_of_work'
);

UPDATE public.application_types
SET is_active = false, updated_at = now()
WHERE slug = 'general_document_checklist';
