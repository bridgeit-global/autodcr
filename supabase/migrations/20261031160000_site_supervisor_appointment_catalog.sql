-- Site Supervisor appointment letter was mapped in app code but missing from
-- application_types, so Create Application never showed a roster-matched card.

INSERT INTO public.application_types
  (slug, department, application_title, description, category,
   applicant_type, planning_authorities, requires_roster_match,
   sort_order, icon_key, is_active)
VALUES
  (
    'appointment_letter_for_site_supervisor',
    'General',
    'Appointment Letter for Site Supervisor',
    'Upload and manage site supervisor appointment letter',
    'appointment_letter',
    'Site Supervisor',
    '{}'::text[],
    true,
    120,
    'document',
    true
  )
ON CONFLICT (slug) DO UPDATE SET
  department = EXCLUDED.department,
  application_title = EXCLUDED.application_title,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  applicant_type = EXCLUDED.applicant_type,
  requires_roster_match = EXCLUDED.requires_roster_match,
  sort_order = EXCLUDED.sort_order,
  icon_key = EXCLUDED.icon_key,
  is_active = true,
  updated_at = now();

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
      'site_supervisor_appointment',
      'Appointment',
      'Appointment/site-supervisor.html',
      ARRAY['owner']::text[],
      'appointment'::text,
      'owner'::text,
      10
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
