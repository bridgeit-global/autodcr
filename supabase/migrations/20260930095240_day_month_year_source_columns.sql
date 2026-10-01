-- Indemnity keeps “This {{DAY}} day of {{MONTH_YEAR}}.”
-- Format is selected by placeholders.source_column (catalog), not placeholder id.

UPDATE public.placeholders
SET source_table = 'computed',
    source_column = 'current_day',
    updated_at = now()
WHERE id = 'day';

UPDATE public.placeholders
SET source_table = 'computed',
    source_column = 'current_month_year',
    updated_at = now()
WHERE id = 'month_year';
