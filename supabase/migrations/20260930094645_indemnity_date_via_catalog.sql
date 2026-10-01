-- Indemnity date via catalog {{DATE}} only (no day/month_year resolver branches).

UPDATE public.placeholders
SET source_table = 'computed',
    source_column = NULL,
    updated_at = now()
WHERE id IN ('day', 'month_year');

INSERT INTO public.application_document_placeholders
  (document_id, placeholder_id, required, sort_order)
SELECT d.id, 'date', false, 70
FROM public.application_documents d
WHERE d.slug = 'indemnity_bond_part_oc'
   OR d.html = 'indemnity-bond-part-oc.html'
ON CONFLICT (document_id, placeholder_id) DO UPDATE SET
  sort_order = EXCLUDED.sort_order,
  required = EXCLUDED.required;
