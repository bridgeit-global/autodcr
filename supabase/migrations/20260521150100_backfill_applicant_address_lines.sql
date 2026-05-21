-- Backfill address_line1/2/3 on existing public.applicants rows from residentialAddress.

UPDATE public.applicants a
SET applicant_details = public.normalize_applicant_details_elem(a.applicant_details)
WHERE a.applicant_details IS NOT NULL
  AND (
    NOT (a.applicant_details ? 'address_line1')
    OR trim(COALESCE(a.applicant_details->>'address_line1', '')) = ''
  )
  AND trim(COALESCE(
    a.applicant_details->>'residentialAddress',
    a.applicant_details->>'residential_address',
    a.applicant_details->>'address',
    ''
  )) <> '';

UPDATE public.projects p
SET applicant_details = COALESCE(
  public.get_applicant_details_for_project(p.id),
  '{"applicants":[]}'::jsonb
)
WHERE EXISTS (SELECT 1 FROM public.applicants a WHERE a.project_id = p.id);
