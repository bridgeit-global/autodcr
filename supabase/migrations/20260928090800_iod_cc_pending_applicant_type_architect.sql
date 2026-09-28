-- {{ARCHITECTS_NAME}} uses source_table = applicants, which filters roster by
-- application_types.applicant_type. IOD/CC pending had NULL, so the token stayed blank.
UPDATE public.application_types
SET
  applicant_type = 'Architect',
  updated_at = now()
WHERE slug = 'iod_cc_pending_concession';
