-- Architect OR Licensed Surveyor role/reg label from project roster (never "Architect/ Licensed Surveyor").
-- Used on Document Checklist signer + Supervision Memo C.C. labeled blocks.

INSERT INTO public.placeholders
  (id, token, legacy_token, label, source_table, source_column, ui_group)
VALUES
  ('architect_or_ls_role', '{{ARCHITECT_OR_LS_ROLE}}', NULL, 'Architect or L.S. role', 'computed', NULL, 'consultant'),
  ('architect_or_ls_reg_label', '{{ARCHITECT_OR_LS_REG_LABEL}}', NULL, 'Architect or L.S. reg label', 'computed', NULL, 'consultant'),
  ('architect_ls_validity', '{{ARCHITECT_LS_VALIDITY}}', NULL, 'Architect / L.S. validity', 'computed', NULL, 'consultant')
ON CONFLICT (id) DO UPDATE SET
  token = EXCLUDED.token,
  label = EXCLUDED.label,
  source_table = EXCLUDED.source_table,
  source_column = EXCLUDED.source_column,
  ui_group = EXCLUDED.ui_group,
  is_active = true,
  updated_at = now();

-- Ensure architect_ls_reg_no stays computed (layout approval may already have it).
INSERT INTO public.placeholders
  (id, token, legacy_token, label, source_table, source_column, ui_group)
VALUES
  ('architect_ls_reg_no', '{{ARCHITECT_LS_REG_NO}}', NULL, 'Architect / L.S. reg no', 'computed', NULL, 'consultant')
ON CONFLICT (id) DO UPDATE SET
  token = EXCLUDED.token,
  label = EXCLUDED.label,
  source_table = 'computed',
  source_column = NULL,
  ui_group = EXCLUDED.ui_group,
  is_active = true,
  updated_at = now();

-- Wire into Supervision Memo C.C. docs (Structural / Plumber / Site Supervisor).
INSERT INTO public.application_document_placeholders
  (document_id, placeholder_id, required, sort_order)
SELECT d.id, v.placeholder_id, false, v.sort_order
FROM public.application_documents d
CROSS JOIN (
  VALUES
    ('architect_or_ls_role', 105),
    ('architect_or_ls_reg_label', 106),
    ('architect_ls_reg_no', 107),
    ('architect_ls_validity', 108)
) AS v(placeholder_id, sort_order)
WHERE d.slug IN (
  'gdc_supervision_structural',
  'gdc_supervision_plumber',
  'gdc_supervision_site_supervisor',
  'gdc_supervision_architect',
  'gdc_plot_area_certificate'
)
ON CONFLICT (document_id, placeholder_id) DO UPDATE SET
  required = EXCLUDED.required,
  sort_order = EXCLUDED.sort_order;
