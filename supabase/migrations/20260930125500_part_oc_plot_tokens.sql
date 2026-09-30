-- Part OC architect application: plotBelongsTo-aware subject + street/pin tokens.

INSERT INTO public.application_type_placeholders
  (application_type_id, placeholder_id, required, sort_order)
SELECT t.id, v.placeholder_id, v.required, v.sort_order
FROM public.application_types t
CROSS JOIN (
  VALUES
    ('plot_cs_cts_no', true, 125),
    ('tps_no', false, 126),
    ('street_road', false, 145),
    ('pin_code', true, 146),
    ('date', true, 100)
) AS v(placeholder_id, required, sort_order)
WHERE t.slug = 'part_oc'
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
    ('pin_code', 16),
    ('from_level', 10),
    ('to_level', 20),
    ('che_ref', 30),
    ('last_approved_plan_date', 40)
) AS v(placeholder_id, sort_order)
WHERE d.slug = 'application_part_oc_architect'
   OR d.html = 'application-part-oc-architect.html'
ON CONFLICT (document_id, placeholder_id) DO UPDATE SET
  sort_order = EXCLUDED.sort_order,
  required = EXCLUDED.required;
