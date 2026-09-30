-- Indemnity office address / Mumbai suffix via catalog only (no resolver special-cases).
-- Address = three owner line tokens in HTML; Mumbai suffix = project pincode.

UPDATE public.placeholders
SET source_table = 'projects',
    source_column = 'project_info->>pincode',
    updated_at = now()
WHERE id = 'mumbai_suffix';

-- Keep office_address mapped to line 1 for any legacy HTML still using it.
UPDATE public.placeholders
SET source_table = 'owner_applicant',
    source_column = 'address_line1',
    updated_at = now()
WHERE id = 'office_address';

INSERT INTO public.application_document_placeholders
  (document_id, placeholder_id, required, sort_order)
SELECT d.id, v.placeholder_id, false, v.sort_order
FROM public.application_documents d
CROSS JOIN (
  VALUES
    ('owner_address_line_1', 30),
    ('owner_address_line_2', 31),
    ('owner_address_line_3', 32),
    ('mumbai_suffix', 40)
) AS v(placeholder_id, sort_order)
WHERE d.slug = 'indemnity_bond_part_oc'
   OR d.html = 'indemnity-bond-part-oc.html'
ON CONFLICT (document_id, placeholder_id) DO UPDATE SET
  sort_order = EXCLUDED.sort_order,
  required = EXCLUDED.required;
