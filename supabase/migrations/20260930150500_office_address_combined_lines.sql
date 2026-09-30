-- {{OFFICE_ADDRESS}} = owner address_line1 + address_line2 + address_line3
-- (joined in resolveCatalogPlaceholderValue).

UPDATE public.placeholders
SET source_table = 'owner_applicant',
    source_column = 'address_lines',
    updated_at = now()
WHERE id = 'office_address';
