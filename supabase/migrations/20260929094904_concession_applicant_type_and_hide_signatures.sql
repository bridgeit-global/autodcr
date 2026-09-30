-- Concession: resolve applicant-sourced tokens (architect/LS names) like pending concession.
UPDATE public.application_types
SET
  applicant_type = 'Architect',
  updated_at = now()
WHERE slug = 'concession';

-- DSC signature — do not ask in Letter fields (same pattern as owner_signature / tps_no).
UPDATE public.placeholders
SET
  ui_group = 'letterhead',
  updated_at = now()
WHERE id = 'architect_ls_signature'
   OR token ILIKE '%SIGNATURE%';

-- Drop typed-signature links on Concession docs (HTML uses blank DSC slots).
DELETE FROM public.application_document_placeholders adp
USING public.application_documents d,
      public.application_types at
WHERE adp.document_id = d.id
  AND d.application_type_id = at.id
  AND at.slug = 'concession'
  AND adp.placeholder_id = 'architect_ls_signature';
