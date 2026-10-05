-- Tree Cutting Form 8: reuse existing owner address line tokens + mumbai_suffix
-- (same catalog pattern as Part OC indemnity). No app code changes.

INSERT INTO public.application_document_placeholders
  (document_id, placeholder_id, required, sort_order)
SELECT d.id, v.placeholder_id, v.required, v.sort_order
FROM public.application_documents d
CROSS JOIN (
  VALUES
    ('owner_address_line_1', true, 70),
    ('owner_address_line_2', false, 71),
    ('owner_address_line_3', false, 72),
    ('mumbai_suffix', false, 80)
) AS v(placeholder_id, required, sort_order)
WHERE d.slug = 'comprehensive_undertaking_tree_cutting'
ON CONFLICT (document_id, placeholder_id) DO UPDATE SET
  required = EXCLUDED.required,
  sort_order = EXCLUDED.sort_order;

DELETE FROM public.application_document_placeholders adp
USING public.application_documents d
WHERE adp.document_id = d.id
  AND d.slug = 'comprehensive_undertaking_tree_cutting'
  AND adp.placeholder_id IN ('pin_suffix', 'office_address');
