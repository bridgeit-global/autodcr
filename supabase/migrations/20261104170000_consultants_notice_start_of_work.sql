-- Move Notice for Start of Work off Document Checklist onto every
-- roster-matched appointment_letter type (General → Consultants → <role>).

INSERT INTO public.application_documents
  (slug, application_type_id, category, html, sign, letter_variant,
   show_letterhead, show_qrcode, letterhead_source, sort_order, is_active)
SELECT
  v.slug,
  t.id,
  'Notice for Start of Work',
  v.html,
  ARRAY['owner']::text[],
  NULL,
  false,
  false,
  'owner'::text,
  50,
  true
FROM public.application_types t
JOIN (
  VALUES
    (
      'appointment_letter_for_architect',
      'architect_notice_start_of_work',
      'General/consultants/architect/notice-start-of-work.html'
    ),
    (
      'appointment_letter_for_licensed_surveyor',
      'licensed_surveyor_notice_start_of_work',
      'General/consultants/licensed-surveyor/notice-start-of-work.html'
    ),
    (
      'appointment_letter_for_structural_engineer',
      'structural_engineer_notice_start_of_work',
      'General/consultants/structural-engineer/notice-start-of-work.html'
    ),
    (
      'appointment_letter_for_plumber',
      'plumber_notice_start_of_work',
      'General/consultants/plumber/notice-start-of-work.html'
    ),
    (
      'appointment_letter_for_site_supervisor',
      'site_supervisor_notice_start_of_work',
      'General/consultants/site-supervisor/notice-start-of-work.html'
    ),
    (
      'appointment_letter_for_fire_consultant',
      'fire_consultant_notice_start_of_work',
      'General/consultants/fire-safety-consultant/notice-start-of-work.html'
    ),
    (
      'appointment_letter_for_mep_consultant',
      'mep_consultant_notice_start_of_work',
      'General/consultants/me-consultant/notice-start-of-work.html'
    ),
    (
      'appointment_letter_for_town_planner',
      'town_planner_notice_start_of_work',
      'General/consultants/town-planner/notice-start-of-work.html'
    ),
    (
      'appointment_letter_for_environmental_consultant',
      'environmental_consultant_notice_start_of_work',
      'General/consultants/environmental-consultant/notice-start-of-work.html'
    ),
    (
      'appointment_letter_for_landscape_consultant',
      'landscape_consultant_notice_start_of_work',
      'General/consultants/landscape-consultant/notice-start-of-work.html'
    ),
    (
      'appointment_letter_for_geotechnical_consultant',
      'geotechnical_consultant_notice_start_of_work',
      'General/consultants/geotechnical-consultant/notice-start-of-work.html'
    ),
    (
      'appointment_letter_for_pmc_project_manager',
      'pmc_project_manager_notice_start_of_work',
      'General/consultants/pmc-project-manager/notice-start-of-work.html'
    )
) AS v(type_slug, slug, html)
  ON t.slug = v.type_slug
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

-- Annexure To-block / plot prose + notice-specific fields
INSERT INTO public.application_document_placeholders
  (document_id, placeholder_id, required, sort_order, section_label)
SELECT d.id, v.placeholder_id, false, v.sort_order, v.section_label
FROM public.application_documents d
CROSS JOIN (
  VALUES
    ('letter_date', 10, 'Date'),
    ('work_start_date', 20, 'Date'),
    ('file_no', 30, 'Reference'),
    ('building_no', 40, 'Reference'),
    ('last_approval_no', 50, 'Reference'),
    ('suburb', 60, 'Addressee'),
    ('bp_address_line_1', 70, 'Addressee'),
    ('bp_address_line_2', 80, 'Addressee'),
    ('bp_address_line_3', 90, 'Addressee'),
    ('plot_cs_cts_no', 100, 'Proposal'),
    ('village_division', 110, 'Proposal'),
    ('property_address', 120, 'Proposal'),
    ('ward', 130, 'Proposal'),
    ('architects_name', 200, 'Consultant'),
    ('architect_ls_reg_no', 210, 'Consultant'),
    ('owner_or_developer', 300, 'Client'),
    ('owner_name', 310, 'Client'),
    ('owner_address_line_1', 320, 'Client'),
    ('owner_address_line_2', 330, 'Client'),
    ('owner_address_line_3', 340, 'Client')
) AS v(placeholder_id, sort_order, section_label)
WHERE d.slug LIKE '%_notice_start_of_work'
  AND d.is_active = true
ON CONFLICT (document_id, placeholder_id) DO UPDATE SET
  section_label = EXCLUDED.section_label,
  sort_order = EXCLUDED.sort_order;

UPDATE public.application_documents
SET is_active = false
WHERE slug = 'gdc_notice_start_of_work';
