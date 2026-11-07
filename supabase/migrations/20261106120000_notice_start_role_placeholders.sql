-- Notice for Start of Work: supervision clause follows each consultant pack.
-- Owner still signs the closing block.

-- Drop Architect-name tokens from every notice (were shared incorrectly).
DELETE FROM public.application_document_placeholders adp
USING public.application_documents d
WHERE adp.document_id = d.id
  AND d.slug LIKE '%_notice_start_of_work'
  AND adp.placeholder_id IN ('architects_name', 'architect_ls_reg_no');

-- Architect / Licensed Surveyor notices
INSERT INTO public.application_document_placeholders
  (document_id, placeholder_id, required, sort_order, section_label)
SELECT d.id, v.placeholder_id, false, v.sort_order, v.section_label
FROM public.application_documents d
CROSS JOIN (
  VALUES
    ('architect_ls_name', 200, 'Consultant'),
    ('architect_or_ls_role', 205, 'Consultant'),
    ('architect_ls_reg_no', 210, 'Consultant')
) AS v(placeholder_id, sort_order, section_label)
WHERE d.slug IN (
  'architect_notice_start_of_work',
  'licensed_surveyor_notice_start_of_work'
)
ON CONFLICT (document_id, placeholder_id) DO UPDATE SET
  section_label = EXCLUDED.section_label,
  sort_order = EXCLUDED.sort_order;

-- Role-specific name + shared reg_no for other consultant packs
WITH role_map(slug, name_ph) AS (
  VALUES
    ('structural_engineer_notice_start_of_work', 'structural_engineer'),
    ('plumber_notice_start_of_work', 'licensed_plumber'),
    ('site_supervisor_notice_start_of_work', 'site_supervisor'),
    ('fire_consultant_notice_start_of_work', 'fire_safety_consultant'),
    ('mep_consultant_notice_start_of_work', 'me_consultant'),
    ('town_planner_notice_start_of_work', 'consultant_name'),
    ('environmental_consultant_notice_start_of_work', 'consultant_name'),
    ('landscape_consultant_notice_start_of_work', 'consultant_name'),
    ('geotechnical_consultant_notice_start_of_work', 'consultant_name'),
    ('pmc_project_manager_notice_start_of_work', 'consultant_name')
)
INSERT INTO public.application_document_placeholders
  (document_id, placeholder_id, required, sort_order, section_label)
SELECT d.id, v.placeholder_id, false, v.sort_order, v.section_label
FROM public.application_documents d
JOIN role_map rm ON rm.slug = d.slug
CROSS JOIN LATERAL (
  VALUES
    (rm.name_ph, 200, 'Consultant'),
    ('reg_no', 210, 'Consultant')
) AS v(placeholder_id, sort_order, section_label)
WHERE d.is_active = true
ON CONFLICT (document_id, placeholder_id) DO UPDATE SET
  section_label = EXCLUDED.section_label,
  sort_order = EXCLUDED.sort_order;
