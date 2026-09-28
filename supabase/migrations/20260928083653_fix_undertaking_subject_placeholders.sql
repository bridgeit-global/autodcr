-- Link Undertaking cum Indemnity tokens that the HTML actually uses.
-- {{SUBJECT}}, {{CHE_REF_NO}}, {{OWNER_CA_NAME}} were incorrectly document-scoped
-- only to iod-cc-pending-architect.html, so the undertaking preview left them blank.

INSERT INTO public.application_document_placeholders
  (document_id, placeholder_id, required, sort_order)
SELECT
  d.id,
  v.placeholder_id,
  v.required,
  v.sort_order
FROM public.application_documents d
CROSS JOIN (
  VALUES
    ('subject', true, 5),
    ('che_ref_no', false, 6),
    ('owner_ca_name', true, 7)
) AS v(placeholder_id, required, sort_order)
WHERE d.html = 'iod-cc-pending-owner-undertaking.html'
ON CONFLICT (document_id, placeholder_id) DO UPDATE SET
  required = EXCLUDED.required,
  sort_order = EXCLUDED.sort_order;
