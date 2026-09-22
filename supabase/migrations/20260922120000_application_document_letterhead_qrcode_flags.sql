-- Per-document preview flags: letterhead background and saved-PDF QR.
-- Preview reads these from application_documents; SQL is the writer (no admin UI).

ALTER TABLE public.application_documents
  ADD COLUMN IF NOT EXISTS show_letterhead boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS show_qrcode boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.application_documents.show_letterhead IS
  'When true, application preview paints the owner/consultant letterhead.';
COMMENT ON COLUMN public.application_documents.show_qrcode IS
  'When true, application preview injects a QR code for the saved application PDF.';

-- Letters that already render as correspondence: appointment/acceptance, Application*, *Letterhead*.
UPDATE public.application_documents
SET
  show_letterhead = true,
  show_qrcode = true
WHERE letter_variant IN ('appointment', 'acceptance')
   OR category ILIKE 'Application%'
   OR category ILIKE '%Letterhead%';

-- CREATE OR REPLACE cannot insert columns before existing ones (sign would be
-- renamed). Drop and recreate so show_letterhead / show_qrcode can be added.
DROP VIEW IF EXISTS public.application_catalog_sheet;

CREATE VIEW public.application_catalog_sheet AS
SELECT
  t.department,
  t.application_title AS application_type,
  d.category,
  d.sub_category,
  d.html,
  d.show_letterhead,
  d.show_qrcode,
  array_to_string(d.sign, ', ') AS sign,
  p.token AS placeholder,
  p.source_column AS "column",
  p.source_table AS "table",
  t.sort_order AS type_sort,
  d.sort_order AS document_sort,
  atp.sort_order AS placeholder_sort
FROM public.application_types t
JOIN public.application_documents d ON d.application_type_id = t.id AND d.is_active
JOIN public.application_type_placeholders atp ON atp.application_type_id = t.id
JOIN public.placeholders p ON p.id = atp.placeholder_id AND p.is_active
WHERE t.is_active
UNION ALL
SELECT
  t.department,
  t.application_title AS application_type,
  d.category,
  d.sub_category,
  d.html,
  d.show_letterhead,
  d.show_qrcode,
  array_to_string(d.sign, ', ') AS sign,
  p.token AS placeholder,
  p.source_column AS "column",
  p.source_table AS "table",
  t.sort_order AS type_sort,
  d.sort_order AS document_sort,
  adp.sort_order AS placeholder_sort
FROM public.application_types t
JOIN public.application_documents d ON d.application_type_id = t.id AND d.is_active
JOIN public.application_document_placeholders adp ON adp.document_id = d.id
JOIN public.placeholders p ON p.id = adp.placeholder_id AND p.is_active
WHERE t.is_active;

GRANT SELECT ON public.application_catalog_sheet TO authenticated;
