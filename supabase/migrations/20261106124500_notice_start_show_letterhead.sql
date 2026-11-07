-- Notice for Start of Work should reserve/paint letterhead like Supervision.
UPDATE public.application_documents
SET show_letterhead = true
WHERE slug LIKE '%_notice_start_of_work'
  AND is_active = true;
