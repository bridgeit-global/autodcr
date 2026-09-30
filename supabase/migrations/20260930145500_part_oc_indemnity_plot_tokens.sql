-- Part OC indemnity bond: plot subject tokens + CHE ref on the document.

INSERT INTO public.application_document_placeholders
  (document_id, placeholder_id, required, sort_order)
SELECT d.id, v.placeholder_id, false, v.sort_order
FROM public.application_documents d
CROSS JOIN (
  VALUES
    ('plot_cs_cts_no', 5),
    ('tps_no', 6),
    ('village', 7),
    ('che_ref', 10),
    ('undersigned_name', 20),
    ('m_s_name', 25),
    ('office_address', 30),
    ('mumbai_suffix', 40),
    ('no_of_floors', 50),
    ('wings', 60),
    ('day', 70),
    ('month_year', 80),
    ('for_entity', 90)
) AS v(placeholder_id, sort_order)
WHERE d.slug = 'indemnity_bond_part_oc'
   OR d.html = 'indemnity-bond-part-oc.html'
ON CONFLICT (document_id, placeholder_id) DO UPDATE SET
  sort_order = EXCLUDED.sort_order,
  required = EXCLUDED.required;
