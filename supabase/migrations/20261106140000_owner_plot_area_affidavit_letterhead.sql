-- Owner's Plot Area Affidavit: enable letterhead; Subject/Project/Ref field groups.
UPDATE public.application_documents
SET
  show_letterhead = true,
  letterhead_source = 'owner',
  sign = ARRAY['owner']::text[]
WHERE slug = 'owner_plot_area_affidavit';

-- Drop unused project_title from Subject (title is now static in HTML).
DELETE FROM public.application_document_placeholders adp
USING public.application_documents d
WHERE adp.document_id = d.id
  AND d.slug = 'owner_plot_area_affidavit'
  AND adp.placeholder_id = 'project_title';

INSERT INTO public.application_document_placeholders
  (document_id, placeholder_id, required, sort_order, section_label)
SELECT d.id, v.placeholder_id, false, v.sort_order, v.section_label
FROM public.application_documents d
CROSS JOIN (
  VALUES
    ('plot_cs_cts_no', 120, 'Project'),
    ('village', 130, 'Project'),
    ('property_address', 140, 'Project'),
    ('ward', 150, 'Project'),
    ('city', 160, 'Project'),
    ('s_no', 170, 'Project'),
    ('h_no', 180, 'Project'),
    ('planning_authority', 45, 'Reference'),
    ('file_no', 50, 'Reference'),
    ('development_rights_date', 60, 'Reference')
) AS v(placeholder_id, sort_order, section_label)
WHERE d.slug = 'owner_plot_area_affidavit'
ON CONFLICT (document_id, placeholder_id) DO UPDATE SET
  section_label = EXCLUDED.section_label,
  sort_order = EXCLUDED.sort_order;
