-- Proposal full-potential To-address: catalog {{BP_*}} tokens (editable Letter fields).
-- Drop obsolete hand-built WARD/MARG/region/pincode fragments on this document.

INSERT INTO public.placeholders
  (id, token, legacy_token, label, source_table, source_column, ui_group)
VALUES
  ('bp_officer_name', '{{BP_OFFICER_NAME}}', NULL, 'Building proposal — officer', 'computed', NULL, 'office'),
  ('bp_organisation', '{{BP_ORGANISATION}}', NULL, 'Building proposal — organisation', 'computed', NULL, 'office'),
  ('bp_address_line_1', '{{BP_ADDRESS_LINE_1}}', NULL, 'Building proposal — address line 1', 'computed', NULL, 'office'),
  ('bp_address_line_2', '{{BP_ADDRESS_LINE_2}}', NULL, 'Building proposal — address line 2', 'computed', NULL, 'office'),
  ('bp_address_line_3', '{{BP_ADDRESS_LINE_3}}', NULL, 'Building proposal — address line 3', 'computed', NULL, 'office')
ON CONFLICT (id) DO UPDATE SET
  token = EXCLUDED.token,
  label = EXCLUDED.label,
  source_table = EXCLUDED.source_table,
  source_column = EXCLUDED.source_column,
  ui_group = EXCLUDED.ui_group,
  updated_at = now();

DELETE FROM public.application_document_placeholders adp
USING public.application_documents d
WHERE adp.document_id = d.id
  AND d.html = 'proposal-full-potential.html'
  AND adp.placeholder_id IN ('marg', 'west_east', 'pin_suffix', 'ward');

INSERT INTO public.application_document_placeholders
  (document_id, placeholder_id, required, sort_order)
SELECT d.id, v.placeholder_id, false, v.sort_order
FROM public.application_documents d
CROSS JOIN (
  VALUES
    ('bp_officer_name', 10),
    ('bp_organisation', 20),
    ('bp_address_line_1', 30),
    ('bp_address_line_2', 40),
    ('bp_address_line_3', 50)
) AS v(placeholder_id, sort_order)
WHERE d.html = 'proposal-full-potential.html'
ON CONFLICT (document_id, placeholder_id) DO UPDATE SET
  sort_order = EXCLUDED.sort_order,
  required = EXCLUDED.required;
