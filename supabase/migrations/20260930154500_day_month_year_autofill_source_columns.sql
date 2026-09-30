-- Autofill {{DAY}} / {{MONTH_YEAR}} from today via catalog source_column
-- (same mechanism as {{DATE}} → current_date). HTML wording unchanged.

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
