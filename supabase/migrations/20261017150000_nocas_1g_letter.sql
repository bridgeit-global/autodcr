-- Undertaking 1G blanks, taken from the official NOCAS PDF.

INSERT INTO public.placeholders
  (id, token, legacy_token, label, source_table, source_column, ui_group)
VALUES
  ('nocas_1g_noc_id', '{{NOCAS_1G_NOC_ID}}', NULL, 'NOC ID', 'computed', NULL, 'other'),
  ('nocas_1g_reason', '{{NOCAS_1G_REASON}}', NULL, 'Reason for transfer', 'computed', NULL, 'other'),
  ('nocas_1g_previous_name', '{{NOCAS_1G_PREVIOUS_NAME}}', NULL, 'Earlier authorised firm', 'computed', NULL, 'other'),
  ('nocas_1g_previous_email', '{{NOCAS_1G_PREVIOUS_EMAIL}}', NULL, 'Earlier NOCAS email', 'computed', NULL, 'other'),
  ('nocas_1g_new_applicant', '{{NOCAS_1G_NEW_APPLICANT}}', NULL, 'New applicant', 'computed', NULL, 'other'),
  ('nocas_1g_new_email', '{{NOCAS_1G_NEW_EMAIL}}', NULL, 'New NOCAS email', 'computed', NULL, 'other'),
  ('nocas_1g_communication', '{{NOCAS_1G_COMMUNICATION}}', NULL, 'Communication', 'computed', NULL, 'other'),
  ('nocas_1g_mobile', '{{NOCAS_1G_MOBILE}}', NULL, 'Mobile no', 'computed', NULL, 'other'),
  ('nocas_1g_dashboard_name', '{{NOCAS_1G_DASHBOARD_NAME}}', NULL, 'Dashboard name', 'computed', NULL, 'other'),
  ('nocas_1g_dashboard_email', '{{NOCAS_1G_DASHBOARD_EMAIL}}', NULL, 'Dashboard NOCAS email', 'computed', NULL, 'other'),
  ('nocas_1g_witness', '{{NOCAS_1G_WITNESS}}', NULL, 'Witness', 'computed', NULL, 'other'),
  ('nocas_1g_place', '{{NOCAS_1G_PLACE}}', NULL, 'Place', 'computed', NULL, 'other')
ON CONFLICT (id) DO UPDATE SET
  token = EXCLUDED.token,
  label = EXCLUDED.label,
  source_table = EXCLUDED.source_table,
  source_column = EXCLUDED.source_column,
  ui_group = EXCLUDED.ui_group,
  is_active = true,
  updated_at = now();

INSERT INTO public.application_document_placeholders
  (document_id, placeholder_id, required, sort_order)
SELECT d.id, v.placeholder_id, false, v.sort_order
FROM public.application_documents d
CROSS JOIN (
  VALUES
    ('client_name', 10),
    ('site_address', 20),
    ('nocas_1g_noc_id', 30),
    ('nocas_1g_reason', 40),
    ('nocas_1g_previous_name', 50),
    ('nocas_1g_previous_email', 60),
    ('nocas_1g_new_applicant', 70),
    ('nocas_1g_new_email', 80),
    ('nocas_1g_communication', 90),
    ('nocas_1g_mobile', 100),
    ('nocas_1g_dashboard_name', 110),
    ('nocas_1g_dashboard_email', 120),
    ('nocas_1g_witness', 130),
    ('letter_date', 140),
    ('nocas_1g_place', 150)
) AS v(placeholder_id, sort_order)
WHERE d.slug = 'nocas_undertaking_1g'
ON CONFLICT (document_id, placeholder_id) DO UPDATE SET
  required = EXCLUDED.required,
  sort_order = EXCLUDED.sort_order;
