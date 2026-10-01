-- IOD architect letterhead subject: use plotBelongsTo-aware plot + road tokens.

INSERT INTO public.application_type_placeholders
  (application_type_id, placeholder_id, required, sort_order)
SELECT t.id, v.placeholder_id, v.required, v.sort_order
FROM public.application_types t
CROSS JOIN (
  VALUES
    ('plot_cs_cts_no', true, 155),
    ('tps_no', false, 156),
    ('street_road', false, 175)
) AS v(placeholder_id, required, sort_order)
WHERE t.slug = 'iod'
ON CONFLICT (application_type_id, placeholder_id) DO UPDATE SET
  sort_order = EXCLUDED.sort_order,
  required = EXCLUDED.required;

INSERT INTO public.application_document_placeholders
  (document_id, placeholder_id, required, sort_order)
SELECT d.id, v.placeholder_id, false, v.sort_order
FROM public.application_documents d
CROSS JOIN (
  VALUES
    ('plot_cs_cts_no', 5),
    ('tps_no', 6),
    ('street_road', 15),
    ('file_no', 10),
    ('your_letter_date', 20)
) AS v(placeholder_id, sort_order)
WHERE d.slug = 'iod_cc_architect_letterhead'
   OR d.html = 'iod-cc-architect-letterhead.html'
ON CONFLICT (document_id, placeholder_id) DO UPDATE SET
  sort_order = EXCLUDED.sort_order,
  required = EXCLUDED.required;
