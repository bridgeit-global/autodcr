-- Plinth + Development Completion: pack-specific HTML, signer, letterhead.
-- Owner pack → owner signs / owner letterhead
-- Architect pack → Architect/L.S. signs / architect letterhead

-- Owner documents
UPDATE public.application_documents
SET
  html = CASE slug
    WHEN 'owner_plinth_completion' THEN 'General/owner/plinth-completion.html'
    WHEN 'owner_development_completion' THEN 'General/owner/development-completion-certificate.html'
    ELSE html
  END,
  sign = ARRAY['owner']::text[],
  letterhead_source = 'owner',
  show_letterhead = true
WHERE slug IN ('owner_plinth_completion', 'owner_development_completion');

-- Architect documents → dedicated HTML under consultants/architect
UPDATE public.application_documents
SET
  html = CASE slug
    WHEN 'architect_plinth_completion' THEN 'General/consultants/architect/plinth-completion.html'
    WHEN 'architect_development_completion' THEN 'General/consultants/architect/development-completion-certificate.html'
    ELSE html
  END,
  sign = ARRAY['architect_or_ls']::text[],
  letterhead_source = 'architect_or_ls',
  show_letterhead = true
WHERE slug IN ('architect_plinth_completion', 'architect_development_completion');

-- Owner: drop Architect closing placeholders; add Owner closing
DELETE FROM public.application_document_placeholders adp
USING public.application_documents d
WHERE adp.document_id = d.id
  AND d.slug IN ('owner_plinth_completion', 'owner_development_completion')
  AND adp.placeholder_id IN (
    'consultant_firm',
    'salutation',
    'architect_ls_name',
    'architect_or_ls_role',
    'architect_or_ls_reg_label',
    'architect_ls_reg_no',
    'architect_ls_validity',
    'reg_no',
    'validity'
  );

INSERT INTO public.application_document_placeholders
  (document_id, placeholder_id, required, sort_order, section_label)
SELECT d.id, v.placeholder_id, false, v.sort_order, v.section_label
FROM public.application_documents d
CROSS JOIN (
  VALUES
    ('owner_or_developer', 200, 'Client'),
    ('owner_name', 210, 'Client'),
    ('owner_address_line_1', 220, 'Client'),
    ('owner_address_line_2', 230, 'Client'),
    ('owner_address_line_3', 240, 'Client')
) AS v(placeholder_id, sort_order, section_label)
WHERE d.slug IN ('owner_plinth_completion', 'owner_development_completion')
ON CONFLICT (document_id, placeholder_id) DO UPDATE SET
  section_label = EXCLUDED.section_label,
  sort_order = EXCLUDED.sort_order;

-- Architect: ensure Architect closing placeholders remain (no owner closing)
DELETE FROM public.application_document_placeholders adp
USING public.application_documents d
WHERE adp.document_id = d.id
  AND d.slug IN ('architect_plinth_completion', 'architect_development_completion')
  AND adp.placeholder_id IN (
    'owner_or_developer',
    'owner_name',
    'owner_address_line_1',
    'owner_address_line_2',
    'owner_address_line_3'
  );

INSERT INTO public.application_document_placeholders
  (document_id, placeholder_id, required, sort_order, section_label)
SELECT d.id, v.placeholder_id, false, v.sort_order, v.section_label
FROM public.application_documents d
CROSS JOIN (
  VALUES
    ('consultant_firm', 200, 'Consultant'),
    ('architect_ls_name', 220, 'Consultant'),
    ('architect_or_ls_role', 225, 'Consultant'),
    ('architect_or_ls_reg_label', 226, 'Consultant'),
    ('architect_ls_reg_no', 230, 'Consultant'),
    ('architect_ls_validity', 235, 'Consultant')
) AS v(placeholder_id, sort_order, section_label)
WHERE d.slug IN ('architect_plinth_completion', 'architect_development_completion')
ON CONFLICT (document_id, placeholder_id) DO UPDATE SET
  section_label = EXCLUDED.section_label,
  sort_order = EXCLUDED.sort_order;
