-- Acceptance letter for Site Supervisor (dual appointment + acceptance).

INSERT INTO public.application_documents
  (slug, application_type_id, category, html, sign, letter_variant,
   show_letterhead, show_qrcode, letterhead_source, sort_order, is_active)
SELECT
  v.slug,
  t.id,
  v.category,
  v.html,
  v.sign,
  v.letter_variant,
  true,
  true,
  v.letterhead_source,
  v.sort_order,
  true
FROM public.application_types t
CROSS JOIN (
  VALUES
    (
      'site_supervisor_acceptance',
      'Acceptance',
      'Acceptance/site-supervisor_acceptance.html',
      ARRAY['consultant']::text[],
      'acceptance'::text,
      'consultant'::text,
      20
    )
) AS v(slug, category, html, sign, letter_variant, letterhead_source, sort_order)
WHERE t.slug = 'appointment_letter_for_site_supervisor'
ON CONFLICT (slug) DO UPDATE SET
  application_type_id = EXCLUDED.application_type_id,
  category = EXCLUDED.category,
  html = EXCLUDED.html,
  sign = EXCLUDED.sign,
  letter_variant = EXCLUDED.letter_variant,
  show_letterhead = EXCLUDED.show_letterhead,
  show_qrcode = EXCLUDED.show_qrcode,
  letterhead_source = EXCLUDED.letterhead_source,
  sort_order = EXCLUDED.sort_order,
  is_active = true;
