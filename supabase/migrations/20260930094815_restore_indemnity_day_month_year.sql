-- Restore indemnity “This {{DAY}} day of {{MONTH_YEAR}}” catalog sources.

UPDATE public.placeholders
SET source_table = 'computed',
    source_column = 'current_date',
    updated_at = now()
WHERE id IN ('day', 'month_year');
