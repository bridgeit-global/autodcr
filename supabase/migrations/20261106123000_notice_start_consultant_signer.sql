-- Notice for Start of Work: consultant (pack role) signs — not the owner.

UPDATE public.application_documents
SET
  sign = ARRAY['consultant']::text[],
  letterhead_source = CASE
    WHEN slug IN (
      'architect_notice_start_of_work',
      'licensed_surveyor_notice_start_of_work'
    ) THEN 'architect_or_ls'
    ELSE 'consultant'
  END
WHERE slug LIKE '%_notice_start_of_work'
  AND is_active = true;

-- Drop owner closing placeholders from all active notices
DELETE FROM public.application_document_placeholders adp
USING public.application_documents d
WHERE adp.document_id = d.id
  AND d.slug LIKE '%_notice_start_of_work'
  AND d.is_active = true
  AND adp.placeholder_id IN (
    'owner_or_developer',
    'owner_name',
    'owner_address_line_1',
    'owner_address_line_2',
    'owner_address_line_3'
  );

-- Architect / L.S. address lines
INSERT INTO public.application_document_placeholders
  (document_id, placeholder_id, required, sort_order, section_label)
SELECT d.id, v.placeholder_id, false, v.sort_order, v.section_label
FROM public.application_documents d
CROSS JOIN (
  VALUES
    ('architect_address_line_1', 300, 'Consultant'),
    ('architect_address_line_2', 310, 'Consultant'),
    ('architect_address_line_3', 320, 'Consultant')
) AS v(placeholder_id, sort_order, section_label)
WHERE d.slug IN (
  'architect_notice_start_of_work',
  'licensed_surveyor_notice_start_of_work'
)
ON CONFLICT (document_id, placeholder_id) DO UPDATE SET
  section_label = EXCLUDED.section_label,
  sort_order = EXCLUDED.sort_order;

-- Other consultant packs — address from that pack's applicant
INSERT INTO public.application_document_placeholders
  (document_id, placeholder_id, required, sort_order, section_label)
SELECT d.id, v.placeholder_id, false, v.sort_order, v.section_label
FROM public.application_documents d
CROSS JOIN (
  VALUES
    ('consultant_addr1', 300, 'Consultant'),
    ('consultant_addr2', 310, 'Consultant'),
    ('consultant_addr3', 320, 'Consultant')
) AS v(placeholder_id, sort_order, section_label)
WHERE d.slug LIKE '%_notice_start_of_work'
  AND d.slug NOT IN (
    'architect_notice_start_of_work',
    'licensed_surveyor_notice_start_of_work',
    'gdc_notice_start_of_work'
  )
  AND d.is_active = true
ON CONFLICT (document_id, placeholder_id) DO UPDATE SET
  section_label = EXCLUDED.section_label,
  sort_order = EXCLUDED.sort_order;
