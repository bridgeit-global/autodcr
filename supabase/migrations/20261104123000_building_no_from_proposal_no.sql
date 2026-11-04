-- {{BUILDING_NO}} = Project Details proposal number (same source as {{FILE_NO}} / proposalNo).

UPDATE public.placeholders
SET
  label = 'Building number (proposal no.)',
  source_table = 'projects',
  source_column = 'project_info->>proposalNo',
  ui_group = 'reference',
  is_active = true,
  updated_at = now()
WHERE id = 'building_no';

INSERT INTO public.placeholders
  (id, token, legacy_token, label, source_table, source_column, ui_group)
VALUES
  (
    'building_no',
    '{{BUILDING_NO}}',
    NULL,
    'Building number (proposal no.)',
    'projects',
    'project_info->>proposalNo',
    'reference'
  )
ON CONFLICT (id) DO UPDATE SET
  token = EXCLUDED.token,
  label = EXCLUDED.label,
  source_table = EXCLUDED.source_table,
  source_column = EXCLUDED.source_column,
  ui_group = EXCLUDED.ui_group,
  is_active = true,
  updated_at = now();
