-- Supervision memos must use the signing professional's letterhead
-- (letterhead_source), not the project owner's as a default.

UPDATE public.application_documents d
SET letterhead_source = v.letterhead_source
FROM (
  VALUES
    ('gdc_supervision_architect', 'architect_or_ls'),
    ('gdc_supervision_structural', 'consultant'),
    ('gdc_supervision_plumber', 'consultant'),
    ('gdc_supervision_site_supervisor', 'consultant')
) AS v(slug, letterhead_source)
WHERE d.slug = v.slug;
