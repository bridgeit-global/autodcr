-- NOCAS civil aviation forms on the existing Airport Authority of India / AAI NOC type.
-- Catalog only. No TypeScript.

UPDATE public.application_types
SET description = 'NOCAS site elevation certificate and undertakings 1A-1G for AAI height clearance',
    updated_at = now()
WHERE slug = 'aai_noc_for_height_clearance';

INSERT INTO public.application_documents
  (slug, application_type_id, category, html, sign, letter_variant,
   show_letterhead, show_qrcode, letterhead_source, sort_order, is_active)
SELECT
  v.slug, t.id, v.category, v.html, v.sign, NULL, false, false,
  v.letterhead_source, v.sort_order, true
FROM public.application_types t
CROSS JOIN (
  VALUES
    (
      'nocas_site_elevation_coordinates',
      'Site Elevation and Site Coordinates',
      'NOCAS_Civil_Aviation_HTML_Forms/site_elevation_coordinates.html',
      ARRAY['consultant']::text[],
      'consultant',
      10
    ),
    (
      'nocas_undertaking_1a',
      'Undertaking 1A',
      'NOCAS_Civil_Aviation_HTML_Forms/undertaking_1A.html',
      ARRAY['owner']::text[],
      'owner',
      20
    ),
    (
      'nocas_undertaking_1b',
      'Undertaking 1B',
      'NOCAS_Civil_Aviation_HTML_Forms/undertaking_1B.html',
      ARRAY['owner']::text[],
      'owner',
      30
    ),
    (
      'nocas_undertaking_1c',
      'Undertaking 1C',
      'NOCAS_Civil_Aviation_HTML_Forms/undertaking_1C.html',
      ARRAY['owner']::text[],
      'owner',
      40
    ),
    (
      'nocas_undertaking_1d',
      'Undertaking 1D',
      'NOCAS_Civil_Aviation_HTML_Forms/undertaking_1D.html',
      ARRAY['owner']::text[],
      'owner',
      50
    ),
    (
      'nocas_undertaking_1e',
      'Undertaking 1E',
      'NOCAS_Civil_Aviation_HTML_Forms/undertaking_1E.html',
      ARRAY['owner']::text[],
      'owner',
      60
    ),
    (
      'nocas_undertaking_1f',
      'Undertaking 1F',
      'NOCAS_Civil_Aviation_HTML_Forms/undertaking_1F.html',
      ARRAY['owner']::text[],
      'owner',
      70
    ),
    (
      'nocas_undertaking_1g',
      'Undertaking 1G',
      'NOCAS_Civil_Aviation_HTML_Forms/undertaking_1G.html',
      ARRAY['owner']::text[],
      'owner',
      80
    )
) AS v(slug, category, html, sign, letterhead_source, sort_order)
WHERE t.slug = 'aai_noc_for_height_clearance'
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

INSERT INTO public.placeholders
  (id, token, legacy_token, label, source_table, source_column, ui_group)
VALUES
  ('nocas_a1_address', '{{NOCAS_A1_ADDRESS}}', NULL, '1A address', 'computed', NULL, 'other'),
  ('nocas_a1_auth_address', '{{NOCAS_A1_AUTH_ADDRESS}}', NULL, '1A auth address', 'computed', NULL, 'other'),
  ('nocas_a1_auth_email', '{{NOCAS_A1_AUTH_EMAIL}}', NULL, '1A auth email', 'computed', NULL, 'other'),
  ('nocas_a1_auth_mobile', '{{NOCAS_A1_AUTH_MOBILE}}', NULL, '1A auth mobile', 'computed', NULL, 'other'),
  ('nocas_a1_auth_name', '{{NOCAS_A1_AUTH_NAME}}', NULL, '1A auth name', 'computed', NULL, 'other'),
  ('nocas_a1_building_height', '{{NOCAS_A1_BUILDING_HEIGHT}}', NULL, '1A building height', 'computed', NULL, 'other'),
  ('nocas_a1_noc2_date', '{{NOCAS_A1_NOC2_DATE}}', NULL, '1A NOC 2 date', 'computed', NULL, 'other'),
  ('nocas_a1_noc2_id', '{{NOCAS_A1_NOC2_ID}}', NULL, '1A NOC 2 ID', 'computed', NULL, 'other'),
  ('nocas_a1_noc2_letter', '{{NOCAS_A1_NOC2_LETTER}}', NULL, '1A NOC 2 letter', 'computed', NULL, 'other'),
  ('nocas_a1_noc2_pte', '{{NOCAS_A1_NOC2_PTE}}', NULL, '1A NOC 2 permissible top elevation', 'computed', NULL, 'other'),
  ('nocas_a1_noc3_current', '{{NOCAS_A1_NOC3_CURRENT}}', NULL, '1A NOC 3 current', 'computed', NULL, 'other'),
  ('nocas_a1_noc3_date', '{{NOCAS_A1_NOC3_DATE}}', NULL, '1A NOC 3 date', 'computed', NULL, 'other'),
  ('nocas_a1_noc3_id', '{{NOCAS_A1_NOC3_ID}}', NULL, '1A NOC 3 ID', 'computed', NULL, 'other'),
  ('nocas_a1_noc3_letter', '{{NOCAS_A1_NOC3_LETTER}}', NULL, '1A NOC 3 letter', 'computed', NULL, 'other'),
  ('nocas_a1_noc3_pte', '{{NOCAS_A1_NOC3_PTE}}', NULL, '1A NOC 3 permissible top elevation', 'computed', NULL, 'other'),
  ('nocas_a1_noc4_date', '{{NOCAS_A1_NOC4_DATE}}', NULL, '1A NOC 4 date', 'computed', NULL, 'other'),
  ('nocas_a1_noc4_id', '{{NOCAS_A1_NOC4_ID}}', NULL, '1A NOC 4 ID', 'computed', NULL, 'other'),
  ('nocas_a1_noc4_letter', '{{NOCAS_A1_NOC4_LETTER}}', NULL, '1A NOC 4 letter', 'computed', NULL, 'other'),
  ('nocas_a1_place', '{{NOCAS_A1_PLACE}}', NULL, '1A place', 'computed', NULL, 'other'),
  ('nocas_a1_previous', '{{NOCAS_A1_PREVIOUS}}', NULL, '1A previous', 'computed', NULL, 'other'),
  ('nocas_a1_structure_height', '{{NOCAS_A1_STRUCTURE_HEIGHT}}', NULL, '1A structure height', 'computed', NULL, 'other'),
  ('nocas_a1_sub', '{{NOCAS_A1_SUB}}', NULL, '1A sub', 'computed', NULL, 'other'),
  ('nocas_a1_w1', '{{NOCAS_A1_W1}}', NULL, '1A w 1', 'computed', NULL, 'other'),
  ('nocas_a1_w2', '{{NOCAS_A1_W2}}', NULL, '1A w 2', 'computed', NULL, 'other'),
  ('nocas_airport_1', '{{NOCAS_AIRPORT_1}}', NULL, 'Airport 1', 'computed', NULL, 'other'),
  ('nocas_airport_2', '{{NOCAS_AIRPORT_2}}', NULL, 'Airport 2', 'computed', NULL, 'other'),
  ('nocas_airport_3', '{{NOCAS_AIRPORT_3}}', NULL, 'Airport 3', 'computed', NULL, 'other'),
  ('nocas_b_address', '{{NOCAS_B_ADDRESS}}', NULL, 'Address', 'computed', NULL, 'other'),
  ('nocas_b_place', '{{NOCAS_B_PLACE}}', NULL, 'Place', 'computed', NULL, 'other'),
  ('nocas_b_w1', '{{NOCAS_B_W1}}', NULL, 'Witness 1', 'computed', NULL, 'other'),
  ('nocas_b_w2', '{{NOCAS_B_W2}}', NULL, 'Witness 2', 'computed', NULL, 'other'),
  ('nocas_c_address', '{{NOCAS_C_ADDRESS}}', NULL, 'Address', 'computed', NULL, 'other'),
  ('nocas_c_agl', '{{NOCAS_C_AGL}}', NULL, 'Above ground', 'computed', NULL, 'other'),
  ('nocas_c_constructed_amsl', '{{NOCAS_C_CONSTRUCTED_AMSL}}', NULL, 'Constructed AMSL', 'computed', NULL, 'other'),
  ('nocas_c_delay', '{{NOCAS_C_DELAY}}', NULL, 'Delay', 'computed', NULL, 'other'),
  ('nocas_c_letter', '{{NOCAS_C_LETTER}}', NULL, 'Letter', 'computed', NULL, 'other'),
  ('nocas_c_letter_date', '{{NOCAS_C_LETTER_DATE}}', NULL, 'Letter date', 'computed', NULL, 'other'),
  ('nocas_c_period', '{{NOCAS_C_PERIOD}}', NULL, 'Period', 'computed', NULL, 'other'),
  ('nocas_c_place', '{{NOCAS_C_PLACE}}', NULL, 'Place', 'computed', NULL, 'other'),
  ('nocas_c_pte', '{{NOCAS_C_PTE}}', NULL, 'Permissible top elevation', 'computed', NULL, 'other'),
  ('nocas_c_w1', '{{NOCAS_C_W1}}', NULL, 'Witness 1', 'computed', NULL, 'other'),
  ('nocas_c_w2', '{{NOCAS_C_W2}}', NULL, 'Witness 2', 'computed', NULL, 'other'),
  ('nocas_corner_1', '{{NOCAS_CORNER_1}}', NULL, 'Corner 1', 'computed', NULL, 'other'),
  ('nocas_corner_2', '{{NOCAS_CORNER_2}}', NULL, 'Corner 2', 'computed', NULL, 'other'),
  ('nocas_corner_3', '{{NOCAS_CORNER_3}}', NULL, 'Corner 3', 'computed', NULL, 'other'),
  ('nocas_corner_4', '{{NOCAS_CORNER_4}}', NULL, 'Corner 4', 'computed', NULL, 'other'),
  ('nocas_d_address', '{{NOCAS_D_ADDRESS}}', NULL, 'Address', 'computed', NULL, 'other'),
  ('nocas_d_agl', '{{NOCAS_D_AGL}}', NULL, 'Above ground', 'computed', NULL, 'other'),
  ('nocas_d_constructed_amsl', '{{NOCAS_D_CONSTRUCTED_AMSL}}', NULL, 'Constructed AMSL', 'computed', NULL, 'other'),
  ('nocas_d_letter', '{{NOCAS_D_LETTER}}', NULL, 'Letter', 'computed', NULL, 'other'),
  ('nocas_d_letter_date', '{{NOCAS_D_LETTER_DATE}}', NULL, 'Letter date', 'computed', NULL, 'other'),
  ('nocas_d_place', '{{NOCAS_D_PLACE}}', NULL, 'Place', 'computed', NULL, 'other'),
  ('nocas_d_pte', '{{NOCAS_D_PTE}}', NULL, 'Permissible top elevation', 'computed', NULL, 'other'),
  ('nocas_d_status', '{{NOCAS_D_STATUS}}', NULL, 'Status', 'computed', NULL, 'other'),
  ('nocas_d_w1', '{{NOCAS_D_W1}}', NULL, 'Witness 1', 'computed', NULL, 'other'),
  ('nocas_d_w2', '{{NOCAS_D_W2}}', NULL, 'Witness 2', 'computed', NULL, 'other'),
  ('nocas_distance_1', '{{NOCAS_DISTANCE_1}}', NULL, 'Distance 1', 'computed', NULL, 'other'),
  ('nocas_distance_2', '{{NOCAS_DISTANCE_2}}', NULL, 'Distance 2', 'computed', NULL, 'other'),
  ('nocas_distance_3', '{{NOCAS_DISTANCE_3}}', NULL, 'Distance 3', 'computed', NULL, 'other'),
  ('nocas_e_agl', '{{NOCAS_E_AGL}}', NULL, 'Above ground', 'computed', NULL, 'other'),
  ('nocas_e_amsl', '{{NOCAS_E_AMSL}}', NULL, 'AMSL', 'computed', NULL, 'other'),
  ('nocas_e_designation', '{{NOCAS_E_DESIGNATION}}', NULL, 'Designation', 'computed', NULL, 'other'),
  ('nocas_e_name', '{{NOCAS_E_NAME}}', NULL, 'Name', 'computed', NULL, 'other'),
  ('nocas_e_signature', '{{NOCAS_E_SIGNATURE}}', NULL, 'Signature', 'computed', NULL, 'other'),
  ('nocas_e_status', '{{NOCAS_E_STATUS}}', NULL, 'Status', 'computed', NULL, 'other'),
  ('nocas_e_w1', '{{NOCAS_E_W1}}', NULL, 'Witness 1', 'computed', NULL, 'other'),
  ('nocas_e_w2', '{{NOCAS_E_W2}}', NULL, 'Witness 2', 'computed', NULL, 'other'),
  ('nocas_elev_1', '{{NOCAS_ELEV_1}}', NULL, 'Elevation 1', 'computed', NULL, 'other'),
  ('nocas_elev_2', '{{NOCAS_ELEV_2}}', NULL, 'Elevation 2', 'computed', NULL, 'other'),
  ('nocas_elev_3', '{{NOCAS_ELEV_3}}', NULL, 'Elevation 3', 'computed', NULL, 'other'),
  ('nocas_elev_4', '{{NOCAS_ELEV_4}}', NULL, 'Elevation 4', 'computed', NULL, 'other'),
  ('nocas_f_address', '{{NOCAS_F_ADDRESS}}', NULL, 'Address', 'computed', NULL, 'other'),
  ('nocas_f_auth_address', '{{NOCAS_F_AUTH_ADDRESS}}', NULL, 'Auth address', 'computed', NULL, 'other'),
  ('nocas_f_auth_email', '{{NOCAS_F_AUTH_EMAIL}}', NULL, 'Auth email', 'computed', NULL, 'other'),
  ('nocas_f_auth_mobile', '{{NOCAS_F_AUTH_MOBILE}}', NULL, 'Auth mobile', 'computed', NULL, 'other'),
  ('nocas_f_auth_name', '{{NOCAS_F_AUTH_NAME}}', NULL, 'Auth name', 'computed', NULL, 'other'),
  ('nocas_f_auth_name2', '{{NOCAS_F_AUTH_NAME2}}', NULL, 'Auth name 2', 'computed', NULL, 'other'),
  ('nocas_f_ownership', '{{NOCAS_F_OWNERSHIP}}', NULL, 'Ownership', 'computed', NULL, 'other'),
  ('nocas_f_place', '{{NOCAS_F_PLACE}}', NULL, 'Place', 'computed', NULL, 'other'),
  ('nocas_f_w1', '{{NOCAS_F_W1}}', NULL, 'Witness 1', 'computed', NULL, 'other'),
  ('nocas_f_w2', '{{NOCAS_F_W2}}', NULL, 'Witness 2', 'computed', NULL, 'other'),
  ('nocas_highest_site_elevation', '{{NOCAS_HIGHEST_SITE_ELEVATION}}', NULL, 'Highest site elevation', 'computed', NULL, 'other'),
  ('nocas_lat_1', '{{NOCAS_LAT_1}}', NULL, 'Latitude 1', 'computed', NULL, 'other'),
  ('nocas_lat_2', '{{NOCAS_LAT_2}}', NULL, 'Latitude 2', 'computed', NULL, 'other'),
  ('nocas_lat_3', '{{NOCAS_LAT_3}}', NULL, 'Latitude 3', 'computed', NULL, 'other'),
  ('nocas_lat_4', '{{NOCAS_LAT_4}}', NULL, 'Latitude 4', 'computed', NULL, 'other'),
  ('nocas_license_authority', '{{NOCAS_LICENSE_AUTHORITY}}', NULL, 'License authority', 'computed', NULL, 'other'),
  ('nocas_license_no', '{{NOCAS_LICENSE_NO}}', NULL, 'License no', 'computed', NULL, 'other'),
  ('nocas_license_scope', '{{NOCAS_LICENSE_SCOPE}}', NULL, 'License scope', 'computed', NULL, 'other'),
  ('nocas_license_validity', '{{NOCAS_LICENSE_VALIDITY}}', NULL, 'License validity', 'computed', NULL, 'other'),
  ('nocas_long_1', '{{NOCAS_LONG_1}}', NULL, 'Longitude 1', 'computed', NULL, 'other'),
  ('nocas_long_2', '{{NOCAS_LONG_2}}', NULL, 'Longitude 2', 'computed', NULL, 'other'),
  ('nocas_long_3', '{{NOCAS_LONG_3}}', NULL, 'Longitude 3', 'computed', NULL, 'other'),
  ('nocas_long_4', '{{NOCAS_LONG_4}}', NULL, 'Longitude 4', 'computed', NULL, 'other'),
  ('nocas_pole_1', '{{NOCAS_POLE_1}}', NULL, 'Pole 1', 'computed', NULL, 'other'),
  ('nocas_pole_2', '{{NOCAS_POLE_2}}', NULL, 'Pole 2', 'computed', NULL, 'other'),
  ('nocas_pole_3', '{{NOCAS_POLE_3}}', NULL, 'Pole 3', 'computed', NULL, 'other'),
  ('nocas_polecoord_1', '{{NOCAS_POLECOORD_1}}', NULL, 'Pole coordinate 1', 'computed', NULL, 'other'),
  ('nocas_polecoord_2', '{{NOCAS_POLECOORD_2}}', NULL, 'Pole coordinate 2', 'computed', NULL, 'other'),
  ('nocas_polecoord_3', '{{NOCAS_POLECOORD_3}}', NULL, 'Pole coordinate 3', 'computed', NULL, 'other'),
  ('nocas_surveyor', '{{NOCAS_SURVEYOR}}', NULL, 'Surveyor', 'computed', NULL, 'other'),
  ('nocas_surveyor_address', '{{NOCAS_SURVEYOR_ADDRESS}}', NULL, 'Surveyor address', 'computed', NULL, 'other'),
  ('nocas_surveyor_email', '{{NOCAS_SURVEYOR_EMAIL}}', NULL, 'Surveyor email', 'computed', NULL, 'other'),
  ('nocas_surveyor_mobile', '{{NOCAS_SURVEYOR_MOBILE}}', NULL, 'Surveyor mobile', 'computed', NULL, 'other'),
  ('nocas_topelev_1', '{{NOCAS_TOPELEV_1}}', NULL, 'Top elevation 1', 'computed', NULL, 'other'),
  ('nocas_topelev_2', '{{NOCAS_TOPELEV_2}}', NULL, 'Top elevation 2', 'computed', NULL, 'other'),
  ('nocas_topelev_3', '{{NOCAS_TOPELEV_3}}', NULL, 'Top elevation 3', 'computed', NULL, 'other')
ON CONFLICT (id) DO UPDATE SET
  token = EXCLUDED.token,
  label = EXCLUDED.label,
  source_table = EXCLUDED.source_table,
  source_column = EXCLUDED.source_column,
  ui_group = EXCLUDED.ui_group,
  is_active = true,
  updated_at = now();

INSERT INTO public.application_type_placeholders
  (application_type_id, placeholder_id, required, sort_order)
SELECT t.id, v.placeholder_id, false, v.sort_order
FROM public.application_types t
CROSS JOIN (
  VALUES
    ('letter_date', 10),
    ('plot_cs_cts_no', 20),
    ('site_address', 30),
    ('client_name', 40)
) AS v(placeholder_id, sort_order)
WHERE t.slug = 'aai_noc_for_height_clearance'
ON CONFLICT (application_type_id, placeholder_id) DO UPDATE SET
  required = EXCLUDED.required,
  sort_order = EXCLUDED.sort_order;

INSERT INTO public.application_document_placeholders
  (document_id, placeholder_id, required, sort_order)
SELECT d.id, v.placeholder_id, false, v.sort_order
FROM public.application_documents d
CROSS JOIN (
  VALUES
    ('letter_date', 10),
    ('nocas_surveyor', 20),
    ('nocas_surveyor_address', 30),
    ('nocas_surveyor_email', 40),
    ('nocas_surveyor_mobile', 50),
    ('nocas_license_no', 60),
    ('nocas_license_validity', 70),
    ('nocas_license_scope', 80),
    ('nocas_license_authority', 90),
    ('plot_cs_cts_no', 100),
    ('site_address', 110),
    ('client_name', 120),
    ('nocas_corner_1', 130),
    ('nocas_lat_1', 140),
    ('nocas_long_1', 150),
    ('nocas_elev_1', 160),
    ('nocas_corner_2', 170),
    ('nocas_lat_2', 180),
    ('nocas_long_2', 190),
    ('nocas_elev_2', 200),
    ('nocas_corner_3', 210),
    ('nocas_lat_3', 220),
    ('nocas_long_3', 230),
    ('nocas_elev_3', 240),
    ('nocas_corner_4', 250),
    ('nocas_lat_4', 260),
    ('nocas_long_4', 270),
    ('nocas_elev_4', 280),
    ('nocas_highest_site_elevation', 290)
) AS v(placeholder_id, sort_order)
WHERE d.slug = 'nocas_site_elevation_coordinates'
ON CONFLICT (document_id, placeholder_id) DO UPDATE SET
  required = EXCLUDED.required,
  sort_order = EXCLUDED.sort_order;

INSERT INTO public.application_document_placeholders
  (document_id, placeholder_id, required, sort_order)
SELECT d.id, v.placeholder_id, false, v.sort_order
FROM public.application_documents d
CROSS JOIN (
  VALUES
    ('client_name', 10),
    ('nocas_a1_address', 20),
    ('site_address', 30),
    ('nocas_a1_previous', 40),
    ('nocas_a1_sub', 50),
    ('nocas_a1_structure_height', 60),
    ('nocas_a1_building_height', 70),
    ('nocas_a1_noc2_id', 80),
    ('nocas_a1_noc2_letter', 90),
    ('nocas_a1_noc2_date', 100),
    ('nocas_a1_noc2_pte', 110),
    ('nocas_a1_noc3_id', 120),
    ('nocas_a1_noc3_letter', 130),
    ('nocas_a1_noc3_date', 140),
    ('nocas_a1_noc3_current', 150),
    ('nocas_a1_noc3_pte', 160),
    ('nocas_a1_noc4_id', 170),
    ('nocas_a1_noc4_letter', 180),
    ('nocas_a1_noc4_date', 190),
    ('nocas_a1_auth_name', 200),
    ('nocas_a1_auth_address', 210),
    ('nocas_a1_auth_mobile', 220),
    ('nocas_a1_auth_email', 230),
    ('nocas_a1_w1', 240),
    ('nocas_a1_w2', 250),
    ('letter_date', 260),
    ('nocas_a1_place', 270)
) AS v(placeholder_id, sort_order)
WHERE d.slug = 'nocas_undertaking_1a'
ON CONFLICT (document_id, placeholder_id) DO UPDATE SET
  required = EXCLUDED.required,
  sort_order = EXCLUDED.sort_order;

INSERT INTO public.application_document_placeholders
  (document_id, placeholder_id, required, sort_order)
SELECT d.id, v.placeholder_id, false, v.sort_order
FROM public.application_documents d
CROSS JOIN (
  VALUES
    ('client_name', 10),
    ('nocas_b_address', 20),
    ('site_address', 30),
    ('nocas_pole_1', 40),
    ('nocas_polecoord_1', 50),
    ('nocas_airport_1', 60),
    ('nocas_distance_1', 70),
    ('nocas_topelev_1', 80),
    ('nocas_pole_2', 90),
    ('nocas_polecoord_2', 100),
    ('nocas_airport_2', 110),
    ('nocas_distance_2', 120),
    ('nocas_topelev_2', 130),
    ('nocas_pole_3', 140),
    ('nocas_polecoord_3', 150),
    ('nocas_airport_3', 160),
    ('nocas_distance_3', 170),
    ('nocas_topelev_3', 180),
    ('nocas_b_w1', 190),
    ('nocas_b_w2', 200),
    ('letter_date', 210),
    ('nocas_b_place', 220)
) AS v(placeholder_id, sort_order)
WHERE d.slug = 'nocas_undertaking_1b'
ON CONFLICT (document_id, placeholder_id) DO UPDATE SET
  required = EXCLUDED.required,
  sort_order = EXCLUDED.sort_order;

INSERT INTO public.application_document_placeholders
  (document_id, placeholder_id, required, sort_order)
SELECT d.id, v.placeholder_id, false, v.sort_order
FROM public.application_documents d
CROSS JOIN (
  VALUES
    ('client_name', 10),
    ('nocas_c_address', 20),
    ('site_address', 30),
    ('nocas_c_pte', 40),
    ('nocas_c_letter', 50),
    ('nocas_c_letter_date', 60),
    ('nocas_c_period', 70),
    ('nocas_c_delay', 80),
    ('nocas_c_constructed_amsl', 90),
    ('nocas_c_agl', 100),
    ('nocas_c_w1', 110),
    ('nocas_c_w2', 120),
    ('letter_date', 130),
    ('nocas_c_place', 140)
) AS v(placeholder_id, sort_order)
WHERE d.slug = 'nocas_undertaking_1c'
ON CONFLICT (document_id, placeholder_id) DO UPDATE SET
  required = EXCLUDED.required,
  sort_order = EXCLUDED.sort_order;

INSERT INTO public.application_document_placeholders
  (document_id, placeholder_id, required, sort_order)
SELECT d.id, v.placeholder_id, false, v.sort_order
FROM public.application_documents d
CROSS JOIN (
  VALUES
    ('client_name', 10),
    ('nocas_d_address', 20),
    ('site_address', 30),
    ('nocas_d_pte', 40),
    ('nocas_d_letter', 50),
    ('nocas_d_letter_date', 60),
    ('nocas_d_status', 70),
    ('nocas_d_constructed_amsl', 80),
    ('nocas_d_agl', 90),
    ('nocas_d_w1', 100),
    ('nocas_d_w2', 110),
    ('letter_date', 120),
    ('nocas_d_place', 130)
) AS v(placeholder_id, sort_order)
WHERE d.slug = 'nocas_undertaking_1d'
ON CONFLICT (document_id, placeholder_id) DO UPDATE SET
  required = EXCLUDED.required,
  sort_order = EXCLUDED.sort_order;

INSERT INTO public.application_document_placeholders
  (document_id, placeholder_id, required, sort_order)
SELECT d.id, v.placeholder_id, false, v.sort_order
FROM public.application_documents d
CROSS JOIN (
  VALUES
    ('client_name', 10),
    ('site_address', 20),
    ('nocas_e_status', 30),
    ('nocas_e_amsl', 40),
    ('nocas_e_agl', 50),
    ('nocas_e_signature', 60),
    ('nocas_e_name', 70),
    ('nocas_e_designation', 80),
    ('letter_date', 90),
    ('nocas_e_w1', 100),
    ('nocas_e_w2', 110)
) AS v(placeholder_id, sort_order)
WHERE d.slug = 'nocas_undertaking_1e'
ON CONFLICT (document_id, placeholder_id) DO UPDATE SET
  required = EXCLUDED.required,
  sort_order = EXCLUDED.sort_order;

INSERT INTO public.application_document_placeholders
  (document_id, placeholder_id, required, sort_order)
SELECT d.id, v.placeholder_id, false, v.sort_order
FROM public.application_documents d
CROSS JOIN (
  VALUES
    ('client_name', 10),
    ('nocas_f_address', 20),
    ('site_address', 30),
    ('nocas_f_ownership', 40),
    ('nocas_f_auth_name', 50),
    ('nocas_f_auth_address', 60),
    ('nocas_f_auth_mobile', 70),
    ('nocas_f_auth_email', 80),
    ('nocas_f_auth_name2', 90),
    ('nocas_f_w1', 100),
    ('nocas_f_w2', 110),
    ('letter_date', 120),
    ('nocas_f_place', 130)
) AS v(placeholder_id, sort_order)
WHERE d.slug = 'nocas_undertaking_1f'
ON CONFLICT (document_id, placeholder_id) DO UPDATE SET
  required = EXCLUDED.required,
  sort_order = EXCLUDED.sort_order;

