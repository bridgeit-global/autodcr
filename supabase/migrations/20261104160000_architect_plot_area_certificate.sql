-- Move Plot Area Certificate off Document Checklist onto Architect appointment
-- type only (General → Consultants → Architect). Extra PR / other roles keep
-- Appointment / Acceptance / Supervision only.

INSERT INTO public.application_documents
  (slug, application_type_id, category, html, sign, letter_variant,
   show_letterhead, show_qrcode, letterhead_source, sort_order, is_active)
SELECT
  'architect_plot_area_certificate',
  t.id,
  'Plot Area Certificate',
  'General/consultants/architect/plot-area-certificate.html',
  ARRAY['architect_or_ls']::text[],
  NULL,
  true,
  false,
  'architect_or_ls'::text,
  40,
  true
FROM public.application_types t
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

-- Annexure + PAC-specific + architect signer placeholders (section_label for accordions)
INSERT INTO public.application_document_placeholders
  (document_id, placeholder_id, required, sort_order, section_label)
SELECT d.id, v.placeholder_id, false, v.sort_order, v.section_label
FROM public.application_documents d
CROSS JOIN (
  VALUES
    ('letter_date', 10, 'Date'),
    ('file_no', 20, 'Reference'),
    ('suburb', 30, 'Addressee'),
    ('bp_address_line_1', 40, 'Addressee'),
    ('bp_address_line_2', 50, 'Addressee'),
    ('bp_address_line_3', 60, 'Addressee'),
    ('project_title', 70, 'Proposal'),
    ('plot_no', 80, 'Proposal'),
    ('cs_no', 90, 'Proposal'),
    ('cts_no', 100, 'Proposal'),
    ('fp_no', 110, 'Proposal'),
    ('plot_cs_cts_no', 120, 'Proposal'),
    ('division', 130, 'Proposal'),
    ('village', 140, 'Proposal'),
    ('tps_no', 150, 'Proposal'),
    ('village_division', 160, 'Proposal'),
    ('type_of_development', 170, 'Proposal'),
    ('property_address', 180, 'Proposal'),
    ('ward', 190, 'Proposal'),
    ('client_name', 200, 'Client'),
    ('applicant_name', 210, 'Client'),
    ('plot_area', 230, 'Plot / area'),
    ('date_of_prc', 240, 'Plot / area'),
    ('consultant_firm', 250, 'Consultant'),
    ('salutation', 260, 'Consultant'),
    ('architect_ls_name', 270, 'Consultant'),
    ('architect_or_ls_role', 275, 'Consultant'),
    ('architect_or_ls_reg_label', 276, 'Consultant'),
    ('architect_ls_reg_no', 280, 'Consultant'),
    ('architect_ls_validity', 285, 'Consultant'),
    ('reg_no', 290, 'Consultant'),
    ('validity', 300, 'Consultant')
) AS v(placeholder_id, sort_order, section_label)
WHERE d.slug = 'architect_plot_area_certificate'
ON CONFLICT (document_id, placeholder_id) DO UPDATE SET
  section_label = EXCLUDED.section_label,
  sort_order = EXCLUDED.sort_order;

-- Remove from Document Checklist
UPDATE public.application_documents
SET is_active = false
WHERE slug = 'gdc_plot_area_certificate';
