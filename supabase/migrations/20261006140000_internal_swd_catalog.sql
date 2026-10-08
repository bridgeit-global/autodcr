-- Internal SWD: three documents on the existing Storm Water Drain (Internal) type.
-- Type slug swd_internal_remarks already exists. No TypeScript changes.
-- Reuse plot / village / ward / M/s tokens. SWD-only blanks stay computed Letter fields.

UPDATE public.application_types
SET description = 'Consultant report, owner/architect submission letter, and completion certificate for internal storm water drain.',
    updated_at = now()
WHERE slug = 'swd_internal_remarks';

INSERT INTO public.application_documents
  (slug, application_type_id, category, html, sign, letter_variant,
   show_letterhead, show_qrcode, letterhead_source, sort_order, is_active)
SELECT
  v.slug,
  t.id,
  v.category,
  v.html,
  v.sign,
  NULL,
  false,
  false,
  v.letterhead_source,
  v.sort_order,
  true
FROM public.application_types t
CROSS JOIN (
  VALUES
    (
      'swd_report_empanelled_consultant_internal',
      'SWD Report by Empanelled Consultant',
      'Internal_SWD_Remark_Cum_Completion/01_swd_report_empanelled_consultant_internal_VERBATIM.html',
      ARRAY['consultant']::text[],
      'consultant',
      10
    ),
    (
      'swd_letter_owner_architect_to_eebp_eeswd',
      'Letter from Owner / Architect to EEBP and EESWD',
      'Internal_SWD_Remark_Cum_Completion/02_letter_owner_architect_to_eebp_eeswd_VERBATIM.html',
      ARRAY['architect_or_ls']::text[],
      'architect_or_ls',
      20
    ),
    (
      'swd_completion_certificate_by_consultant',
      'Completion Certificate by Consultant',
      'Internal_SWD_Remark_Cum_Completion/03_completion_certificate_by_consultant_VERBATIM.html',
      ARRAY['consultant']::text[],
      'consultant',
      30
    )
) AS v(slug, category, html, sign, letterhead_source, sort_order)
WHERE t.slug = 'swd_internal_remarks'
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
  ('abutting_road_width', '{{ABUTTING_ROAD_WIDTH}}', NULL, 'Abutting Road Width', 'computed', NULL, 'other'),
  ('additional_remarks', '{{ADDITIONAL_REMARKS}}', NULL, 'Additional Remarks', 'computed', NULL, 'other'),
  ('catchment_area_sqm', '{{CATCHMENT_AREA_SQM}}', NULL, 'Catchment Area sq.m', 'computed', NULL, 'other'),
  ('city_builtup_drain_points', '{{CITY_BUILTUP_DRAIN_POINTS}}', NULL, 'City Builtup Drain Points', 'computed', NULL, 'other'),
  ('city_catch_pit_count', '{{CITY_CATCH_PIT_COUNT}}', NULL, 'City Catch Pit Count', 'computed', NULL, 'other'),
  ('city_catch_pit_points', '{{CITY_CATCH_PIT_POINTS}}', NULL, 'City Catch Pit Points', 'computed', NULL, 'other'),
  ('city_rcc_pipe_points', '{{CITY_RCC_PIPE_POINTS}}', NULL, 'City RCC Pipe Points', 'computed', NULL, 'other'),
  ('consultant_signature_name', '{{CONSULTANT_SIGNATURE_NAME}}', NULL, 'Consultant Signature Name', 'computed', NULL, 'other'),
  ('dp_road_width', '{{DP_ROAD_WIDTH}}', NULL, 'DP Road Width', 'computed', NULL, 'other'),
  ('existing_swd_road_name', '{{EXISTING_SWD_ROAD_NAME}}', NULL, 'Existing SWD Road Name', 'computed', NULL, 'other'),
  ('existing_swd_road_width', '{{EXISTING_SWD_ROAD_WIDTH}}', NULL, 'Existing SWD Road Width', 'computed', NULL, 'other'),
  ('existing_water_course_size', '{{EXISTING_WATER_COURSE_SIZE}}', NULL, 'Existing Water Course Size', 'computed', NULL, 'other'),
  ('layout_or_individual_plot', '{{LAYOUT_OR_INDIVIDUAL_PLOT}}', NULL, 'Layout Or Individual Plot', 'computed', NULL, 'other'),
  ('natural_water_course', '{{NATURAL_WATER_COURSE}}', NULL, 'Natural Water Course', 'computed', NULL, 'other'),
  ('net_plot_area_sqm', '{{NET_PLOT_AREA_SQM}}', NULL, 'Net Plot Area sq.m', 'computed', NULL, 'other'),
  ('proposed_building', '{{PROPOSED_BUILDING}}', NULL, 'Proposed Building', 'computed', NULL, 'other'),
  ('rectangular_drain_size_1', '{{RECTANGULAR_DRAIN_SIZE_1}}', NULL, 'Rectangular Drain Size 1', 'computed', NULL, 'other'),
  ('rectangular_drain_size_2', '{{RECTANGULAR_DRAIN_SIZE_2}}', NULL, 'Rectangular Drain Size 2', 'computed', NULL, 'other'),
  ('road', '{{ROAD}}', NULL, 'Road', 'computed', NULL, 'other'),
  ('road_type', '{{ROAD_TYPE}}', NULL, 'Road Type', 'computed', NULL, 'other'),
  ('suburb_swd_area_sqm', '{{SUBURB_SWD_AREA_SQM}}', NULL, 'Suburb SWD Area sq.m', 'computed', NULL, 'other'),
  ('swd_road_type', '{{SWD_ROAD_TYPE}}', NULL, 'SWD Road Type', 'computed', NULL, 'other'),
  ('swd_size_proposed_1', '{{SWD_SIZE_PROPOSED_1}}', NULL, 'SWD Size Proposed 1', 'computed', NULL, 'other'),
  ('swd_size_proposed_2', '{{SWD_SIZE_PROPOSED_2}}', NULL, 'SWD Size Proposed 2', 'computed', NULL, 'other'),
  ('water_entrance_side_1', '{{WATER_ENTRANCE_SIDE_1}}', NULL, 'Water Entrance Side 1', 'computed', NULL, 'other'),
  ('water_entrance_side_2', '{{WATER_ENTRANCE_SIDE_2}}', NULL, 'Water Entrance Side 2', 'computed', NULL, 'other'),
  ('widened_water_course_size', '{{WIDENED_WATER_COURSE_SIZE}}', NULL, 'Widened Water Course Size', 'computed', NULL, 'other'),
  ('consultant_architect_ls_name_signature', '{{CONSULTANT_ARCHITECT_LS_NAME_SIGNATURE}}', NULL, 'Consultant Architect Ls Name Signature', 'computed', NULL, 'other'),
  ('consultant_ms', '{{CONSULTANT_MS}}', NULL, 'Consultant Ms', 'computed', NULL, 'other'),
  ('consultant_name', '{{CONSULTANT_NAME}}', NULL, 'Consultant Name', 'computed', NULL, 'other'),
  ('consultant_office_address', '{{CONSULTANT_OFFICE_ADDRESS}}', NULL, 'Consultant Office Address', 'computed', NULL, 'other'),
  ('consultant_remarks_date', '{{CONSULTANT_REMARKS_DATE}}', NULL, 'Consultant Remarks Date', 'computed', NULL, 'other'),
  ('consultant_signature', '{{CONSULTANT_SIGNATURE}}', NULL, 'Consultant Signature', 'computed', NULL, 'other'),
  ('iod_no_date', '{{IOD_NO_DATE}}', NULL, 'IOD No Date', 'computed', NULL, 'other'),
  ('layout_approval_no_date', '{{LAYOUT_APPROVAL_NO_DATE}}', NULL, 'Layout Approval No Date', 'computed', NULL, 'other'),
  ('licensed_plumber_ms', '{{LICENSED_PLUMBER_MS}}', NULL, 'Licensed Plumber Ms', 'computed', NULL, 'other'),
  ('lp_name', '{{LP_NAME}}', NULL, 'LP Name', 'computed', NULL, 'other'),
  ('lp_office_address', '{{LP_OFFICE_ADDRESS}}', NULL, 'LP Office Address', 'computed', NULL, 'other'),
  ('lp_signature', '{{LP_SIGNATURE}}', NULL, 'LP Signature', 'computed', NULL, 'other'),
  ('swd_remarks_date', '{{SWD_REMARKS_DATE}}', NULL, 'SWD Remarks Date', 'computed', NULL, 'other'),
  ('swd_remarks_no', '{{SWD_REMARKS_NO}}', NULL, 'SWD Remarks No', 'computed', NULL, 'other')
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
SELECT t.id, v.placeholder_id, v.required, v.sort_order
FROM public.application_types t
CROSS JOIN (
  VALUES
    ('plot_cs_cts_no', false, 10),
    ('village_division', false, 20),
    ('ward_no', false, 30),
    ('ms_name', false, 40)
) AS v(placeholder_id, required, sort_order)
WHERE t.slug = 'swd_internal_remarks'
ON CONFLICT (application_type_id, placeholder_id) DO UPDATE SET
  required = EXCLUDED.required,
  sort_order = EXCLUDED.sort_order;

INSERT INTO public.application_document_placeholders
  (document_id, placeholder_id, required, sort_order)
SELECT d.id, v.placeholder_id, v.required, v.sort_order
FROM public.application_documents d
CROSS JOIN (
  VALUES
    ('plot_cs_cts_no', false, 10),
    ('village_division', false, 20),
    ('ward_no', false, 30),
    ('ms_name', false, 40),
    ('abutting_road_width', false, 50),
    ('additional_remarks', false, 60),
    ('catchment_area_sqm', false, 70),
    ('city_builtup_drain_points', false, 80),
    ('city_catch_pit_count', false, 90),
    ('city_catch_pit_points', false, 100),
    ('city_rcc_pipe_points', false, 110),
    ('consultant_signature_name', false, 120),
    ('dp_road_width', false, 130),
    ('existing_swd_road_name', false, 140),
    ('existing_swd_road_width', false, 150),
    ('existing_water_course_size', false, 160),
    ('layout_or_individual_plot', false, 170),
    ('natural_water_course', false, 180),
    ('net_plot_area_sqm', false, 190),
    ('proposal_number', false, 200),
    ('rectangular_drain_size_1', false, 210),
    ('rectangular_drain_size_2', false, 220),
    ('road_name', false, 230),
    ('road_type', false, 240),
    ('suburb_swd_area_sqm', false, 250),
    ('swd_road_type', false, 260),
    ('swd_size_proposed_1', false, 270),
    ('swd_size_proposed_2', false, 280),
    ('water_entrance_side_1', false, 290),
    ('water_entrance_side_2', false, 300),
    ('widened_water_course_size', false, 310)
) AS v(placeholder_id, required, sort_order)
WHERE d.slug = 'swd_report_empanelled_consultant_internal'
ON CONFLICT (document_id, placeholder_id) DO UPDATE SET
  required = EXCLUDED.required,
  sort_order = EXCLUDED.sort_order;

INSERT INTO public.application_document_placeholders
  (document_id, placeholder_id, required, sort_order)
SELECT d.id, v.placeholder_id, v.required, v.sort_order
FROM public.application_documents d
CROSS JOIN (
  VALUES
    ('plot_cs_cts_no', false, 10),
    ('village_division', false, 20),
    ('ward_no', false, 30),
    ('ms_name', false, 40),
    ('consultant_architect_ls_name_signature', false, 50)
) AS v(placeholder_id, required, sort_order)
WHERE d.slug = 'swd_letter_owner_architect_to_eebp_eeswd'
ON CONFLICT (document_id, placeholder_id) DO UPDATE SET
  required = EXCLUDED.required,
  sort_order = EXCLUDED.sort_order;

INSERT INTO public.application_document_placeholders
  (document_id, placeholder_id, required, sort_order)
SELECT d.id, v.placeholder_id, v.required, v.sort_order
FROM public.application_documents d
CROSS JOIN (
  VALUES
    ('plot_cs_cts_no', false, 10),
    ('village_division', false, 20),
    ('ward_no', false, 30),
    ('ms_name', false, 40),
    ('consultant_ms', false, 50),
    ('consultant_name', false, 60),
    ('consultant_office_address', false, 70),
    ('consultant_remarks_date', false, 80),
    ('consultant_signature', false, 90),
    ('iod_no_date', false, 100),
    ('layout_approval_no_date', false, 110),
    ('licensed_plumber_ms', false, 120),
    ('lp_name', false, 130),
    ('lp_office_address', false, 140),
    ('lp_signature', false, 150),
    ('swd_remarks_date', false, 160),
    ('swd_remarks_no', false, 170)
) AS v(placeholder_id, required, sort_order)
WHERE d.slug = 'swd_completion_certificate_by_consultant'
ON CONFLICT (document_id, placeholder_id) DO UPDATE SET
  required = EXCLUDED.required,
  sort_order = EXCLUDED.sort_order;

