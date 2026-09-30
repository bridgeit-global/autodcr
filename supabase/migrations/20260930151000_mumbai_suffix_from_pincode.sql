-- {{MUMBAI_SUFFIX}} = owner pincode (falls back to project_info.pincode in resolver).

UPDATE public.placeholders
SET source_table = 'owner_applicant',
    source_column = 'pincode',
    updated_at = now()
WHERE id = 'mumbai_suffix';
