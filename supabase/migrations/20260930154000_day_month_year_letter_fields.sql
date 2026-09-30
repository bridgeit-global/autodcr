-- {{DAY}} / {{MONTH_YEAR}} stay as Letter fields (no resolver formatting).
-- HTML keeps: This {{DAY}} day of {{MONTH_YEAR}}.

UPDATE public.placeholders
SET source_table = 'computed',
    source_column = NULL,
    updated_at = now()
WHERE id IN ('day', 'month_year');
