-- Site Supervisor appointment type was added after the shared
-- appointment_letter placeholder bulk insert, so Application Details
-- showed "No letter fields to show yet." Copy Architect's type-level set.

INSERT INTO public.application_type_placeholders
  (application_type_id, placeholder_id, required, sort_order)
SELECT
  target.id,
  src.placeholder_id,
  src.required,
  src.sort_order
FROM public.application_types target
CROSS JOIN public.application_types source
JOIN public.application_type_placeholders src
  ON src.application_type_id = source.id
WHERE target.slug = 'appointment_letter_for_site_supervisor'
  AND source.slug = 'appointment_letter_for_architect'
ON CONFLICT (application_type_id, placeholder_id) DO UPDATE SET
  required = EXCLUDED.required,
  sort_order = EXCLUDED.sort_order;
