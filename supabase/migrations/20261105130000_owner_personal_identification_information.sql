-- Personal Identification Information → General / Owner (catalog + HTML).

INSERT INTO public.placeholders
  (id, token, legacy_token, label, source_table, source_column, ui_group)
VALUES
  ('entity_pan', '{{ENTITY_PAN}}', NULL, 'Entity Permanent Account No.', 'owner_applicant', 'panNo', 'client'),
  ('pan', '{{PAN}}', NULL, 'Permanent Account No.', 'owner_applicant', 'panNo', 'client'),
  ('mobile', '{{MOBILE}}', NULL, 'Mobile number', 'owner_applicant', 'contactNumber', 'client'),
  ('email_id', '{{EMAIL_ID}}', NULL, 'Email ID', 'owner_applicant', 'email', 'client'),
  ('aadhar', '{{AADHAR}}', NULL, 'Aadhaar number', 'computed', NULL, 'client'),
  ('date_of_birth', '{{DATE_OF_BIRTH}}', NULL, 'Date of birth', 'computed', NULL, 'client'),
  ('occupation', '{{OCCUPATION}}', NULL, 'Occupation', 'computed', NULL, 'client')
ON CONFLICT (id) DO UPDATE SET
  token = EXCLUDED.token,
  label = EXCLUDED.label,
  source_table = EXCLUDED.source_table,
  source_column = EXCLUDED.source_column,
  ui_group = EXCLUDED.ui_group,
  is_active = true,
  updated_at = now();

INSERT INTO public.application_documents
  (slug, application_type_id, category, html, sign, letter_variant,
   show_letterhead, show_qrcode, letterhead_source, sort_order, is_active)
SELECT
  'owner_personal_identification_information',
  t.id,
  'Personal Identification Information',
  'General/owner/personal-identification-information.html',
  ARRAY['owner']::text[],
  NULL,
  false,
  false,
  'owner'::text,
  40,
  true
FROM public.application_types t
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

INSERT INTO public.application_document_placeholders
  (document_id, placeholder_id, required, sort_order, section_label)
SELECT d.id, v.placeholder_id, false, v.sort_order, v.section_label
FROM public.application_documents d
CROSS JOIN (
  VALUES
    ('project_title', 10, 'Project'),
    ('plot_cs_cts_no', 20, 'Project'),
    ('village_division', 30, 'Project'),
    ('property_address', 40, 'Project'),
    ('ward', 50, 'Project'),
    ('owner_firm', 100, 'Entity'),
    ('entity_pan', 110, 'Entity'),
    ('salutation', 200, 'Person'),
    ('applicant_name', 210, 'Person'),
    ('owner_address_line_1', 220, 'Person'),
    ('owner_address_line_2', 230, 'Person'),
    ('owner_address_line_3', 240, 'Person'),
    ('communication_address', 250, 'Person'),
    ('mobile', 260, 'Person'),
    ('email_id', 270, 'Person'),
    ('pan', 280, 'Person'),
    ('aadhar', 290, 'Person'),
    ('date_of_birth', 300, 'Person'),
    ('occupation', 310, 'Person')
) AS v(placeholder_id, sort_order, section_label)
WHERE d.slug = 'owner_personal_identification_information'
ON CONFLICT (document_id, placeholder_id) DO UPDATE SET
  section_label = EXCLUDED.section_label,
  sort_order = EXCLUDED.sort_order;
