-- {{OWNER_CA_NAME}}: resolve via existing owner_applicant mapper (name where applicantType is Owner).
-- No app code change required — source_table owner_applicant already picks the Owner roster row.
UPDATE public.placeholders
SET
  source_table = 'owner_applicant',
  source_column = 'name',
  label = 'Owner / C.A. name',
  updated_at = now()
WHERE id = 'owner_ca_name';
