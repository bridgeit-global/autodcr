-- Further CC application: plotBelongsTo-aware subject tokens (same as IOD letterhead).

INSERT INTO public.application_type_placeholders
  (application_type_id, placeholder_id, required, sort_order)
SELECT t.id, v.placeholder_id, v.required, v.sort_order
FROM public.application_types t
CROSS JOIN (
  VALUES
    ('plot_cs_cts_no', true, 210),
    ('tps_no', false, 211),
    ('street_road', false, 215)
) AS v(placeholder_id, required, sort_order)
WHERE t.slug = 'further_full_cc'
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
    ('iod_cc_no', 10),
    ('further_cc_upto_floors', 20)
) AS v(placeholder_id, sort_order)
WHERE d.slug = 'application_further_cc'
   OR d.html = 'application-further-cc.html'
ON CONFLICT (document_id, placeholder_id) DO UPDATE SET
  sort_order = EXCLUDED.sort_order,
  required = EXCLUDED.required;
