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
    ('village_division', true, 130),
    ('che_ref', false, 170),
    ('last_approved_plan_date', false, 180)
) AS v(placeholder_id, required, sort_order)
WHERE t.slug = 'full_part_oc'
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
    ('village_division', 7),
    ('street_road', 8),
    ('pin_code', 9),
    ('che_ref', 10),
    ('building_level_1', 20),
    ('building_level_2', 30),
    ('upper_floors', 40),
    ('last_approved_plan_date', 50)
) AS v(placeholder_id, sort_order)
WHERE d.slug = 'application_full_oc_bcc'
   OR d.html = 'application-full-oc-bcc.html'
ON CONFLICT (document_id, placeholder_id) DO UPDATE SET
  sort_order = EXCLUDED.sort_order,
  required = EXCLUDED.required;
