-- Maharashtra Lift: Permission to Erect + Working Licence.
-- Catalog only. No TypeScript. Reuse site / letter date / client / project / building height tokens.

INSERT INTO public.application_types
  (slug, department, application_title, description, category,
   applicant_type, planning_authorities, requires_roster_match,
   sort_order, icon_key, is_active)
VALUES
  (
    'lift_permission_to_erect',
    'Lift',
    'Permission to Erect Lift',
    'Form A series, architect and structural certificates, and annexures for permission to erect a lift',
    'department_permission',
    NULL,
    '{}'::text[],
    false,
    10,
    'document',
    true
  ),
  (
    'lift_working_licence',
    'Lift',
    'Licence to Work the Lift',
    'Form B series and Annexure C for the licence to work a lift',
    'department_permission',
    NULL,
    '{}'::text[],
    false,
    20,
    'document',
    true
  )
ON CONFLICT (slug) DO UPDATE SET
  department = EXCLUDED.department,
  application_title = EXCLUDED.application_title,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  sort_order = EXCLUDED.sort_order,
  icon_key = EXCLUDED.icon_key,
  is_active = true,
  updated_at = now();

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
      'lift_form_a',
      'Form A — Applicant',
      'Maharashtra_Lift/form_a.html',
      ARRAY['owner']::text[],
      'owner',
      10
    ),
    (
      'lift_form_a1',
      'Form A-1 — Lift Contractor Declaration',
      'Maharashtra_Lift/form_a1.html',
      ARRAY['consultant']::text[],
      'consultant',
      20
    ),
    (
      'lift_form_a2',
      'Form A-2 — Scrutiny / Check List',
      'Maharashtra_Lift/form_a2.html',
      ARRAY['consultant']::text[],
      'consultant',
      30
    ),
    (
      'lift_form_a3',
      'Form A-3 — Permission to Erect Lift',
      'Maharashtra_Lift/form_a3.html',
      ARRAY['owner']::text[],
      'owner',
      40
    ),
    (
      'lift_architect_certificate',
      'Architect Certificate',
      'Maharashtra_Lift/architect_certificate.html',
      ARRAY['architect_or_ls']::text[],
      'architect_or_ls',
      50
    ),
    (
      'lift_structural_stability_certificate',
      'Structural Stability Certificate',
      'Maharashtra_Lift/structural_stability_certificate.html',
      ARRAY['consultant']::text[],
      'consultant',
      60
    ),
    (
      'lift_annexure_1',
      'Annexure 1 — Document List',
      'Maharashtra_Lift/annexure_1_document_list.html',
      ARRAY['owner']::text[],
      'owner',
      70
    ),
    (
      'lift_annexure_c',
      'Annexure C — Numbering and District Codes',
      'Maharashtra_Lift/annexure_c_reference.html',
      ARRAY['owner']::text[],
      'owner',
      80
    )
) AS v(slug, category, html, sign, letterhead_source, sort_order)
WHERE t.slug = 'lift_permission_to_erect'
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
      'lift_form_b',
      'Form B — Completion Notice / Licence Application',
      'Maharashtra_Lift/form_b.html',
      ARRAY['owner']::text[],
      'owner',
      10
    ),
    (
      'lift_form_b1',
      'Form B-1 — Lift Contractor Certificate',
      'Maharashtra_Lift/form_b1.html',
      ARRAY['consultant']::text[],
      'consultant',
      20
    ),
    (
      'lift_form_b2',
      'Form B-2 — Certificate of 17 Conditions',
      'Maharashtra_Lift/form_b2.html',
      ARRAY['owner']::text[],
      'owner',
      30
    ),
    (
      'lift_form_b3',
      'Form B-3 — Inspection Report',
      'Maharashtra_Lift/form_b3.html',
      ARRAY['consultant']::text[],
      'consultant',
      40
    ),
    (
      'lift_form_b4',
      'Form B-4 — Licence for Working of the Lift',
      'Maharashtra_Lift/form_b4.html',
      ARRAY['owner']::text[],
      'owner',
      50
    ),
    (
      'lift_annexure_c_licence',
      'Annexure C — Numbering and District Codes',
      'Maharashtra_Lift/annexure_c_reference.html',
      ARRAY['owner']::text[],
      'owner',
      60
    )
) AS v(slug, category, html, sign, letterhead_source, sort_order)
WHERE t.slug = 'lift_working_licence'
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
  ('lift_a2_arc', '{{LIFT_A2_ARC}}', NULL, 'Arc', 'computed', NULL, 'other'),
  ('lift_a2_basement', '{{LIFT_A2_BASEMENT}}', NULL, 'Basement', 'computed', NULL, 'other'),
  ('lift_a2_belt_h', '{{LIFT_A2_BELT_H}}', NULL, 'Belt height', 'computed', NULL, 'other'),
  ('lift_a2_belt_nos', '{{LIFT_A2_BELT_NOS}}', NULL, 'Belt number', 'computed', NULL, 'other'),
  ('lift_a2_belt_w', '{{LIFT_A2_BELT_W}}', NULL, 'Belt width', 'computed', NULL, 'other'),
  ('lift_a2_buffer', '{{LIFT_A2_BUFFER}}', NULL, 'Buffer', 'computed', NULL, 'other'),
  ('lift_a2_car_area', '{{LIFT_A2_CAR_AREA}}', NULL, 'Car area', 'computed', NULL, 'other'),
  ('lift_a2_car_bottom', '{{LIFT_A2_CAR_BOTTOM}}', NULL, 'Car bottom', 'computed', NULL, 'other'),
  ('lift_a2_car_buff', '{{LIFT_A2_CAR_BUFF}}', NULL, 'Car buffer height', 'computed', NULL, 'other'),
  ('lift_a2_car_d', '{{LIFT_A2_CAR_D}}', NULL, 'Car depth', 'computed', NULL, 'other'),
  ('lift_a2_car_h', '{{LIFT_A2_CAR_H}}', NULL, 'Car height', 'computed', NULL, 'other'),
  ('lift_a2_car_qty', '{{LIFT_A2_CAR_QTY}}', NULL, 'Car quantity', 'computed', NULL, 'other'),
  ('lift_a2_car_t1', '{{LIFT_A2_CAR_T1}}', NULL, 'Car t 1', 'computed', NULL, 'other'),
  ('lift_a2_car_t2', '{{LIFT_A2_CAR_T2}}', NULL, 'Car t 2', 'computed', NULL, 'other'),
  ('lift_a2_car_t3', '{{LIFT_A2_CAR_T3}}', NULL, 'Car t 3', 'computed', NULL, 'other'),
  ('lift_a2_car_top', '{{LIFT_A2_CAR_TOP}}', NULL, 'Car top', 'computed', NULL, 'other'),
  ('lift_a2_car_w', '{{LIFT_A2_CAR_W}}', NULL, 'Car width', 'computed', NULL, 'other'),
  ('lift_a2_cargate', '{{LIFT_A2_CARGATE}}', NULL, 'Cargate', 'computed', NULL, 'other'),
  ('lift_a2_contractor', '{{LIFT_A2_CONTRACTOR}}', NULL, 'Contractor', 'computed', NULL, 'other'),
  ('lift_a2_control', '{{LIFT_A2_CONTROL}}', NULL, 'Control', 'computed', NULL, 'other'),
  ('lift_a2_cwt_bottom', '{{LIFT_A2_CWT_BOTTOM}}', NULL, 'Counterweight bottom', 'computed', NULL, 'other'),
  ('lift_a2_cwt_buff', '{{LIFT_A2_CWT_BUFF}}', NULL, 'Counterweight buffer height', 'computed', NULL, 'other'),
  ('lift_a2_cwt_qty', '{{LIFT_A2_CWT_QTY}}', NULL, 'Counterweight quantity', 'computed', NULL, 'other'),
  ('lift_a2_cwt_t1', '{{LIFT_A2_CWT_T1}}', NULL, 'Counterweight t 1', 'computed', NULL, 'other'),
  ('lift_a2_cwt_t2', '{{LIFT_A2_CWT_T2}}', NULL, 'Counterweight t 2', 'computed', NULL, 'other'),
  ('lift_a2_cwt_t3', '{{LIFT_A2_CWT_T3}}', NULL, 'Counterweight t 3', 'computed', NULL, 'other'),
  ('lift_a2_door_h', '{{LIFT_A2_DOOR_H}}', NULL, 'Door height', 'computed', NULL, 'other'),
  ('lift_a2_door_w', '{{LIFT_A2_DOOR_W}}', NULL, 'Door width', 'computed', NULL, 'other'),
  ('lift_a2_drive', '{{LIFT_A2_DRIVE}}', NULL, 'Drive', 'computed', NULL, 'other'),
  ('lift_a2_drive_loc', '{{LIFT_A2_DRIVE_LOC}}', NULL, 'Drive loc', 'computed', NULL, 'other'),
  ('lift_a2_encl', '{{LIFT_A2_ENCL}}', NULL, 'Encl', 'computed', NULL, 'other'),
  ('lift_a2_entr_h', '{{LIFT_A2_ENTR_H}}', NULL, 'Entr height', 'computed', NULL, 'other'),
  ('lift_a2_entr_w', '{{LIFT_A2_ENTR_W}}', NULL, 'Entr width', 'computed', NULL, 'other'),
  ('lift_a2_fire', '{{LIFT_A2_FIRE}}', NULL, 'Fire', 'computed', NULL, 'other'),
  ('lift_a2_fire_perm', '{{LIFT_A2_FIRE_PERM}}', NULL, 'Fire perm', 'computed', NULL, 'other'),
  ('lift_a2_floors', '{{LIFT_A2_FLOORS}}', NULL, 'Floors', 'computed', NULL, 'other'),
  ('lift_a2_governor', '{{LIFT_A2_GOVERNOR}}', NULL, 'Governor', 'computed', NULL, 'other'),
  ('lift_a2_height', '{{LIFT_A2_HEIGHT}}', NULL, 'Height', 'computed', NULL, 'other'),
  ('lift_a2_independent', '{{LIFT_A2_INDEPENDENT}}', NULL, 'Independent', 'computed', NULL, 'other'),
  ('lift_a2_intent', '{{LIFT_A2_INTENT}}', NULL, 'Intent', 'computed', NULL, 'other'),
  ('lift_a2_kg', '{{LIFT_A2_KG}}', NULL, 'Capacity (kg)', 'computed', NULL, 'other'),
  ('lift_a2_ladder', '{{LIFT_A2_LADDER}}', NULL, 'Ladder', 'computed', NULL, 'other'),
  ('lift_a2_landinggate', '{{LIFT_A2_LANDINGGATE}}', NULL, 'Landinggate', 'computed', NULL, 'other'),
  ('lift_a2_landings', '{{LIFT_A2_LANDINGS}}', NULL, 'Landings', 'computed', NULL, 'other'),
  ('lift_a2_limit', '{{LIFT_A2_LIMIT}}', NULL, 'Limit', 'computed', NULL, 'other'),
  ('lift_a2_machine', '{{LIFT_A2_MACHINE}}', NULL, 'Machine', 'computed', NULL, 'other'),
  ('lift_a2_mr_d', '{{LIFT_A2_MR_D}}', NULL, 'Machine room depth', 'computed', NULL, 'other'),
  ('lift_a2_mr_h', '{{LIFT_A2_MR_H}}', NULL, 'Machine room height', 'computed', NULL, 'other'),
  ('lift_a2_mr_height', '{{LIFT_A2_MR_HEIGHT}}', NULL, 'Machine room height', 'computed', NULL, 'other'),
  ('lift_a2_mr_w', '{{LIFT_A2_MR_W}}', NULL, 'Machine room width', 'computed', NULL, 'other'),
  ('lift_a2_owner', '{{LIFT_A2_OWNER}}', NULL, 'Owner', 'computed', NULL, 'other'),
  ('lift_a2_persons', '{{LIFT_A2_PERSONS}}', NULL, 'Persons', 'computed', NULL, 'other'),
  ('lift_a2_pit_d', '{{LIFT_A2_PIT_D}}', NULL, 'Pit depth', 'computed', NULL, 'other'),
  ('lift_a2_pit_h', '{{LIFT_A2_PIT_H}}', NULL, 'Pit height', 'computed', NULL, 'other'),
  ('lift_a2_pit_w', '{{LIFT_A2_PIT_W}}', NULL, 'Pit width', 'computed', NULL, 'other'),
  ('lift_a2_rope_constr', '{{LIFT_A2_ROPE_CONSTR}}', NULL, 'Rope constr', 'computed', NULL, 'other'),
  ('lift_a2_rope_dia', '{{LIFT_A2_ROPE_DIA}}', NULL, 'Rope dia', 'computed', NULL, 'other'),
  ('lift_a2_rope_nos', '{{LIFT_A2_ROPE_NOS}}', NULL, 'Rope number', 'computed', NULL, 'other'),
  ('lift_a2_shaft', '{{LIFT_A2_SHAFT}}', NULL, 'Shaft', 'computed', NULL, 'other'),
  ('lift_a2_shaft_left', '{{LIFT_A2_SHAFT_LEFT}}', NULL, 'Shaft left', 'computed', NULL, 'other'),
  ('lift_a2_shaft_right', '{{LIFT_A2_SHAFT_RIGHT}}', NULL, 'Shaft right', 'computed', NULL, 'other'),
  ('lift_a2_space_controller', '{{LIFT_A2_SPACE_CONTROLLER}}', NULL, 'Space controller', 'computed', NULL, 'other'),
  ('lift_a2_space_machine', '{{LIFT_A2_SPACE_MACHINE}}', NULL, 'Space machine', 'computed', NULL, 'other'),
  ('lift_a2_speed', '{{LIFT_A2_SPEED}}', NULL, 'Speed', 'computed', NULL, 'other'),
  ('lift_a2_stops', '{{LIFT_A2_STOPS}}', NULL, 'Stops', 'computed', NULL, 'other'),
  ('lift_a2_switchpos', '{{LIFT_A2_SWITCHPOS}}', NULL, 'Switchpos', 'computed', NULL, 'other'),
  ('lift_a2_type', '{{LIFT_A2_TYPE}}', NULL, 'Type', 'computed', NULL, 'other'),
  ('lift_a2_windows', '{{LIFT_A2_WINDOWS}}', NULL, 'Windows', 'computed', NULL, 'other'),
  ('lift_a_form_no', '{{LIFT_A_FORM_NO}}', NULL, 'A form number', 'computed', NULL, 'other'),
  ('lift_agent_owner', '{{LIFT_AGENT_OWNER}}', NULL, 'Agent owner', 'computed', NULL, 'other'),
  ('lift_architect_name_reg', '{{LIFT_ARCHITECT_NAME_REG}}', NULL, 'Architect name registration', 'computed', NULL, 'other'),
  ('lift_b3_aux_current', '{{LIFT_B3_AUX_CURRENT}}', NULL, 'Aux current', 'computed', NULL, 'other'),
  ('lift_b3_aux_ma', '{{LIFT_B3_AUX_MA}}', NULL, 'Aux ma', 'computed', NULL, 'other'),
  ('lift_b3_aux_make', '{{LIFT_B3_AUX_MAKE}}', NULL, 'Aux make', 'computed', NULL, 'other'),
  ('lift_b3_basement', '{{LIFT_B3_BASEMENT}}', NULL, 'Basement', 'computed', NULL, 'other'),
  ('lift_b3_belt_h', '{{LIFT_B3_BELT_H}}', NULL, 'Belt height', 'computed', NULL, 'other'),
  ('lift_b3_belt_nos', '{{LIFT_B3_BELT_NOS}}', NULL, 'Belt number', 'computed', NULL, 'other'),
  ('lift_b3_belt_w', '{{LIFT_B3_BELT_W}}', NULL, 'Belt width', 'computed', NULL, 'other'),
  ('lift_b3_buffer', '{{LIFT_B3_BUFFER}}', NULL, 'Buffer', 'computed', NULL, 'other'),
  ('lift_b3_car_area', '{{LIFT_B3_CAR_AREA}}', NULL, 'Car area', 'computed', NULL, 'other'),
  ('lift_b3_car_bottom', '{{LIFT_B3_CAR_BOTTOM}}', NULL, 'Car bottom', 'computed', NULL, 'other'),
  ('lift_b3_car_buff', '{{LIFT_B3_CAR_BUFF}}', NULL, 'Car buffer height', 'computed', NULL, 'other'),
  ('lift_b3_car_contact', '{{LIFT_B3_CAR_CONTACT}}', NULL, 'Car contact', 'computed', NULL, 'other'),
  ('lift_b3_car_d', '{{LIFT_B3_CAR_D}}', NULL, 'Car depth', 'computed', NULL, 'other'),
  ('lift_b3_car_gate_condition', '{{LIFT_B3_CAR_GATE_CONDITION}}', NULL, 'Car gate condition', 'computed', NULL, 'other'),
  ('lift_b3_car_h', '{{LIFT_B3_CAR_H}}', NULL, 'Car height', 'computed', NULL, 'other'),
  ('lift_b3_car_qty', '{{LIFT_B3_CAR_QTY}}', NULL, 'Car quantity', 'computed', NULL, 'other'),
  ('lift_b3_car_t1', '{{LIFT_B3_CAR_T1}}', NULL, 'Car t 1', 'computed', NULL, 'other'),
  ('lift_b3_car_t2', '{{LIFT_B3_CAR_T2}}', NULL, 'Car t 2', 'computed', NULL, 'other'),
  ('lift_b3_car_t3', '{{LIFT_B3_CAR_T3}}', NULL, 'Car t 3', 'computed', NULL, 'other'),
  ('lift_b3_car_top', '{{LIFT_B3_CAR_TOP}}', NULL, 'Car top', 'computed', NULL, 'other'),
  ('lift_b3_car_w', '{{LIFT_B3_CAR_W}}', NULL, 'Car width', 'computed', NULL, 'other'),
  ('lift_b3_cargate', '{{LIFT_B3_CARGATE}}', NULL, 'Cargate', 'computed', NULL, 'other'),
  ('lift_b3_contractor', '{{LIFT_B3_CONTRACTOR}}', NULL, 'Contractor', 'computed', NULL, 'other'),
  ('lift_b3_control', '{{LIFT_B3_CONTROL}}', NULL, 'Control', 'computed', NULL, 'other'),
  ('lift_b3_cwt_bottom', '{{LIFT_B3_CWT_BOTTOM}}', NULL, 'Counterweight bottom', 'computed', NULL, 'other'),
  ('lift_b3_cwt_buff', '{{LIFT_B3_CWT_BUFF}}', NULL, 'Counterweight buffer height', 'computed', NULL, 'other'),
  ('lift_b3_cwt_gap', '{{LIFT_B3_CWT_GAP}}', NULL, 'Counterweight gap', 'computed', NULL, 'other'),
  ('lift_b3_cwt_qty', '{{LIFT_B3_CWT_QTY}}', NULL, 'Counterweight quantity', 'computed', NULL, 'other'),
  ('lift_b3_cwt_t1', '{{LIFT_B3_CWT_T1}}', NULL, 'Counterweight t 1', 'computed', NULL, 'other'),
  ('lift_b3_cwt_t2', '{{LIFT_B3_CWT_T2}}', NULL, 'Counterweight t 2', 'computed', NULL, 'other'),
  ('lift_b3_cwt_t3', '{{LIFT_B3_CWT_T3}}', NULL, 'Counterweight t 3', 'computed', NULL, 'other'),
  ('lift_b3_drive', '{{LIFT_B3_DRIVE}}', NULL, 'Drive', 'computed', NULL, 'other'),
  ('lift_b3_elcb_current', '{{LIFT_B3_ELCB_CURRENT}}', NULL, 'ELCB current', 'computed', NULL, 'other'),
  ('lift_b3_elcb_ma', '{{LIFT_B3_ELCB_MA}}', NULL, 'ELCB ma', 'computed', NULL, 'other'),
  ('lift_b3_elcb_make', '{{LIFT_B3_ELCB_MAKE}}', NULL, 'ELCB make', 'computed', NULL, 'other'),
  ('lift_b3_encl', '{{LIFT_B3_ENCL}}', NULL, 'Encl', 'computed', NULL, 'other'),
  ('lift_b3_entr_h', '{{LIFT_B3_ENTR_H}}', NULL, 'Entr height', 'computed', NULL, 'other'),
  ('lift_b3_entr_w', '{{LIFT_B3_ENTR_W}}', NULL, 'Entr width', 'computed', NULL, 'other'),
  ('lift_b3_fire', '{{LIFT_B3_FIRE}}', NULL, 'Fire', 'computed', NULL, 'other'),
  ('lift_b3_floors', '{{LIFT_B3_FLOORS}}', NULL, 'Floors', 'computed', NULL, 'other'),
  ('lift_b3_guide_left1', '{{LIFT_B3_GUIDE_LEFT1}}', NULL, 'Guide left 1', 'computed', NULL, 'other'),
  ('lift_b3_guide_left2', '{{LIFT_B3_GUIDE_LEFT2}}', NULL, 'Guide left 2', 'computed', NULL, 'other'),
  ('lift_b3_guide_right1', '{{LIFT_B3_GUIDE_RIGHT1}}', NULL, 'Guide right 1', 'computed', NULL, 'other'),
  ('lift_b3_guide_right2', '{{LIFT_B3_GUIDE_RIGHT2}}', NULL, 'Guide right 2', 'computed', NULL, 'other'),
  ('lift_b3_height', '{{LIFT_B3_HEIGHT}}', NULL, 'Height', 'computed', NULL, 'other'),
  ('lift_b3_indicator', '{{LIFT_B3_INDICATOR}}', NULL, 'Indicator', 'computed', NULL, 'other'),
  ('lift_b3_insp_date', '{{LIFT_B3_INSP_DATE}}', NULL, 'Inspection date', 'computed', NULL, 'other'),
  ('lift_b3_intent', '{{LIFT_B3_INTENT}}', NULL, 'Intent', 'computed', NULL, 'other'),
  ('lift_b3_kg', '{{LIFT_B3_KG}}', NULL, 'Capacity (kg)', 'computed', NULL, 'other'),
  ('lift_b3_landing_condition', '{{LIFT_B3_LANDING_CONDITION}}', NULL, 'Landing condition', 'computed', NULL, 'other'),
  ('lift_b3_landing_contact', '{{LIFT_B3_LANDING_CONTACT}}', NULL, 'Landing contact', 'computed', NULL, 'other'),
  ('lift_b3_landinggate', '{{LIFT_B3_LANDINGGATE}}', NULL, 'Landinggate', 'computed', NULL, 'other'),
  ('lift_b3_landings', '{{LIFT_B3_LANDINGS}}', NULL, 'Landings', 'computed', NULL, 'other'),
  ('lift_b3_machine', '{{LIFT_B3_MACHINE}}', NULL, 'Machine', 'computed', NULL, 'other'),
  ('lift_b3_mc_capacity', '{{LIFT_B3_MC_CAPACITY}}', NULL, 'Machine capacity', 'computed', NULL, 'other'),
  ('lift_b3_mc_current', '{{LIFT_B3_MC_CURRENT}}', NULL, 'Machine current', 'computed', NULL, 'other'),
  ('lift_b3_mc_make', '{{LIFT_B3_MC_MAKE}}', NULL, 'Machine make', 'computed', NULL, 'other'),
  ('lift_b3_mc_speed', '{{LIFT_B3_MC_SPEED}}', NULL, 'Machine speed', 'computed', NULL, 'other'),
  ('lift_b3_mc_sr', '{{LIFT_B3_MC_SR}}', NULL, 'Machine serial number', 'computed', NULL, 'other'),
  ('lift_b3_mc_voltage', '{{LIFT_B3_MC_VOLTAGE}}', NULL, 'Machine voltage', 'computed', NULL, 'other'),
  ('lift_b3_mcb', '{{LIFT_B3_MCB}}', NULL, 'MCB', 'computed', NULL, 'other'),
  ('lift_b3_mcb_current', '{{LIFT_B3_MCB_CURRENT}}', NULL, 'MCB current', 'computed', NULL, 'other'),
  ('lift_b3_officer', '{{LIFT_B3_OFFICER}}', NULL, 'Officer', 'computed', NULL, 'other'),
  ('lift_b3_owner', '{{LIFT_B3_OWNER}}', NULL, 'Owner', 'computed', NULL, 'other'),
  ('lift_b3_persons', '{{LIFT_B3_PERSONS}}', NULL, 'Persons', 'computed', NULL, 'other'),
  ('lift_b3_pit_d', '{{LIFT_B3_PIT_D}}', NULL, 'Pit depth', 'computed', NULL, 'other'),
  ('lift_b3_pit_h', '{{LIFT_B3_PIT_H}}', NULL, 'Pit height', 'computed', NULL, 'other'),
  ('lift_b3_pit_w', '{{LIFT_B3_PIT_W}}', NULL, 'Pit width', 'computed', NULL, 'other'),
  ('lift_b3_push', '{{LIFT_B3_PUSH}}', NULL, 'Push', 'computed', NULL, 'other'),
  ('lift_b3_rope_dia', '{{LIFT_B3_ROPE_DIA}}', NULL, 'Rope dia', 'computed', NULL, 'other'),
  ('lift_b3_rope_nos', '{{LIFT_B3_ROPE_NOS}}', NULL, 'Rope number', 'computed', NULL, 'other'),
  ('lift_b3_shaft', '{{LIFT_B3_SHAFT}}', NULL, 'Shaft', 'computed', NULL, 'other'),
  ('lift_b3_shaft_left', '{{LIFT_B3_SHAFT_LEFT}}', NULL, 'Shaft left', 'computed', NULL, 'other'),
  ('lift_b3_shaft_right', '{{LIFT_B3_SHAFT_RIGHT}}', NULL, 'Shaft right', 'computed', NULL, 'other'),
  ('lift_b3_sill_gap', '{{LIFT_B3_SILL_GAP}}', NULL, 'Sill gap', 'computed', NULL, 'other'),
  ('lift_b3_space_back', '{{LIFT_B3_SPACE_BACK}}', NULL, 'Space back', 'computed', NULL, 'other'),
  ('lift_b3_space_front', '{{LIFT_B3_SPACE_FRONT}}', NULL, 'Space front', 'computed', NULL, 'other'),
  ('lift_b3_space_left', '{{LIFT_B3_SPACE_LEFT}}', NULL, 'Space left', 'computed', NULL, 'other'),
  ('lift_b3_space_right', '{{LIFT_B3_SPACE_RIGHT}}', NULL, 'Space right', 'computed', NULL, 'other'),
  ('lift_b3_speed', '{{LIFT_B3_SPEED}}', NULL, 'Speed', 'computed', NULL, 'other'),
  ('lift_b3_stops', '{{LIFT_B3_STOPS}}', NULL, 'Stops', 'computed', NULL, 'other'),
  ('lift_b3_type', '{{LIFT_B3_TYPE}}', NULL, 'Type', 'computed', NULL, 'other'),
  ('lift_bottom_clearance', '{{LIFT_BOTTOM_CLEARANCE}}', NULL, 'Bottom clearance', 'computed', NULL, 'other'),
  ('lift_building_line2', '{{LIFT_BUILDING_LINE2}}', NULL, 'Building line 2', 'computed', NULL, 'other'),
  ('lift_building_line3', '{{LIFT_BUILDING_LINE3}}', NULL, 'Building line 3', 'computed', NULL, 'other'),
  ('lift_cable_mm', '{{LIFT_CABLE_MM}}', NULL, 'Cable mm', 'computed', NULL, 'other'),
  ('lift_cable_nos', '{{LIFT_CABLE_NOS}}', NULL, 'Cable number', 'computed', NULL, 'other'),
  ('lift_capacity', '{{LIFT_CAPACITY}}', NULL, 'Capacity', 'computed', NULL, 'other'),
  ('lift_circle', '{{LIFT_CIRCLE}}', NULL, 'Circle', 'computed', NULL, 'other'),
  ('lift_client', '{{LIFT_CLIENT}}', NULL, 'Client', 'computed', NULL, 'other'),
  ('lift_company_name', '{{LIFT_COMPANY_NAME}}', NULL, 'Company name', 'computed', NULL, 'other'),
  ('lift_completion_date', '{{LIFT_COMPLETION_DATE}}', NULL, 'Completion date', 'computed', NULL, 'other'),
  ('lift_completion_year', '{{LIFT_COMPLETION_YEAR}}', NULL, 'Completion year', 'computed', NULL, 'other'),
  ('lift_contract_date', '{{LIFT_CONTRACT_DATE}}', NULL, 'Contract date', 'computed', NULL, 'other'),
  ('lift_contract_no', '{{LIFT_CONTRACT_NO}}', NULL, 'Contract number', 'computed', NULL, 'other'),
  ('lift_contractor_name', '{{LIFT_CONTRACTOR_NAME}}', NULL, 'Contractor name', 'computed', NULL, 'other'),
  ('lift_contractor_sign', '{{LIFT_CONTRACTOR_SIGN}}', NULL, 'Contractor sign', 'computed', NULL, 'other'),
  ('lift_counter_weight', '{{LIFT_COUNTER_WEIGHT}}', NULL, 'Counter weight', 'computed', NULL, 'other'),
  ('lift_district', '{{LIFT_DISTRICT}}', NULL, 'District', 'computed', NULL, 'other'),
  ('lift_division', '{{LIFT_DIVISION}}', NULL, 'Division', 'computed', NULL, 'other'),
  ('lift_drive', '{{LIFT_DRIVE}}', NULL, 'Drive', 'computed', NULL, 'other'),
  ('lift_earth_ohms', '{{LIFT_EARTH_OHMS}}', NULL, 'Earth ohms', 'computed', NULL, 'other'),
  ('lift_eebp', '{{LIFT_EEBP}}', NULL, 'EEBP', 'computed', NULL, 'other'),
  ('lift_ei_addr1', '{{LIFT_EI_ADDR1}}', NULL, 'Electrical Inspector address 1', 'computed', NULL, 'other'),
  ('lift_ei_addr2', '{{LIFT_EI_ADDR2}}', NULL, 'Electrical Inspector address 2', 'computed', NULL, 'other'),
  ('lift_ei_address', '{{LIFT_EI_ADDRESS}}', NULL, 'Electrical Inspector address', 'computed', NULL, 'other'),
  ('lift_ei_address1', '{{LIFT_EI_ADDRESS1}}', NULL, 'Electrical Inspector address 1', 'computed', NULL, 'other'),
  ('lift_ei_address2', '{{LIFT_EI_ADDRESS2}}', NULL, 'Electrical Inspector address 2', 'computed', NULL, 'other'),
  ('lift_ei_line1', '{{LIFT_EI_LINE1}}', NULL, 'Electrical Inspector line 1', 'computed', NULL, 'other'),
  ('lift_ei_line2', '{{LIFT_EI_LINE2}}', NULL, 'Electrical Inspector line 2', 'computed', NULL, 'other'),
  ('lift_ei_name', '{{LIFT_EI_NAME}}', NULL, 'Electrical Inspector name', 'computed', NULL, 'other'),
  ('lift_ei_pin', '{{LIFT_EI_PIN}}', NULL, 'Electrical Inspector pincode', 'computed', NULL, 'other'),
  ('lift_email', '{{LIFT_EMAIL}}', NULL, 'Email', 'computed', NULL, 'other'),
  ('lift_engineer_name_reg', '{{LIFT_ENGINEER_NAME_REG}}', NULL, 'Engineer name registration', 'computed', NULL, 'other'),
  ('lift_ex_engineer', '{{LIFT_EX_ENGINEER}}', NULL, 'Ex engineer', 'computed', NULL, 'other'),
  ('lift_fee', '{{LIFT_FEE}}', NULL, 'Fee', 'computed', NULL, 'other'),
  ('lift_fire', '{{LIFT_FIRE}}', NULL, 'Fire', 'computed', NULL, 'other'),
  ('lift_floors', '{{LIFT_FLOORS}}', NULL, 'Floors', 'computed', NULL, 'other'),
  ('lift_glass_mm', '{{LIFT_GLASS_MM}}', NULL, 'Glass mm', 'computed', NULL, 'other'),
  ('lift_hp', '{{LIFT_HP}}', NULL, 'Horsepower', 'computed', NULL, 'other'),
  ('lift_kind', '{{LIFT_KIND}}', NULL, 'Kind', 'computed', NULL, 'other'),
  ('lift_letter_date', '{{LIFT_LETTER_DATE}}', NULL, 'Letter date', 'computed', NULL, 'other'),
  ('lift_letter_no', '{{LIFT_LETTER_NO}}', NULL, 'Letter number', 'computed', NULL, 'other'),
  ('lift_license_no', '{{LIFT_LICENSE_NO}}', NULL, 'License number', 'computed', NULL, 'other'),
  ('lift_lift_company', '{{LIFT_LIFT_COMPANY}}', NULL, 'Lift company', 'computed', NULL, 'other'),
  ('lift_lift_firm', '{{LIFT_LIFT_FIRM}}', NULL, 'Lift firm', 'computed', NULL, 'other'),
  ('lift_lift_make', '{{LIFT_LIFT_MAKE}}', NULL, 'Lift make', 'computed', NULL, 'other'),
  ('lift_lift_maker', '{{LIFT_LIFT_MAKER}}', NULL, 'Lift maker', 'computed', NULL, 'other'),
  ('lift_lift_no', '{{LIFT_LIFT_NO}}', NULL, 'Lift number', 'computed', NULL, 'other'),
  ('lift_lift_no2', '{{LIFT_LIFT_NO2}}', NULL, 'Lift number 2', 'computed', NULL, 'other'),
  ('lift_lifts_installation_stage', '{{LIFT_LIFTS_INSTALLATION_STAGE}}', NULL, 'Lifts installation stage', 'computed', NULL, 'other'),
  ('lift_lifttype', '{{LIFT_LIFTTYPE}}', NULL, 'Lift type', 'computed', NULL, 'other'),
  ('lift_make', '{{LIFT_MAKE}}', NULL, 'Make', 'computed', NULL, 'other'),
  ('lift_office', '{{LIFT_OFFICE}}', NULL, 'Office', 'computed', NULL, 'other'),
  ('lift_office2', '{{LIFT_OFFICE2}}', NULL, 'Office 2', 'computed', NULL, 'other'),
  ('lift_office_address', '{{LIFT_OFFICE_ADDRESS}}', NULL, 'Office address', 'computed', NULL, 'other'),
  ('lift_overhead_details', '{{LIFT_OVERHEAD_DETAILS}}', NULL, 'Overhead details', 'computed', NULL, 'other'),
  ('lift_owner_address', '{{LIFT_OWNER_ADDRESS}}', NULL, 'Owner address', 'computed', NULL, 'other'),
  ('lift_owner_address2', '{{LIFT_OWNER_ADDRESS2}}', NULL, 'Owner address 2', 'computed', NULL, 'other'),
  ('lift_owner_dist', '{{LIFT_OWNER_DIST}}', NULL, 'Owner dist', 'computed', NULL, 'other'),
  ('lift_owner_name_address', '{{LIFT_OWNER_NAME_ADDRESS}}', NULL, 'Owner name address', 'computed', NULL, 'other'),
  ('lift_owner_name_address2', '{{LIFT_OWNER_NAME_ADDRESS2}}', NULL, 'Owner name address 2', 'computed', NULL, 'other'),
  ('lift_owner_name_address3', '{{LIFT_OWNER_NAME_ADDRESS3}}', NULL, 'Owner name address 3', 'computed', NULL, 'other'),
  ('lift_owner_pin', '{{LIFT_OWNER_PIN}}', NULL, 'Owner pincode', 'computed', NULL, 'other'),
  ('lift_owner_taluka', '{{LIFT_OWNER_TALUKA}}', NULL, 'Owner taluka', 'computed', NULL, 'other'),
  ('lift_passengers', '{{LIFT_PASSENGERS}}', NULL, 'Passengers', 'computed', NULL, 'other'),
  ('lift_phone', '{{LIFT_PHONE}}', NULL, 'Phone', 'computed', NULL, 'other'),
  ('lift_prem_dist', '{{LIFT_PREM_DIST}}', NULL, 'Premises dist', 'computed', NULL, 'other'),
  ('lift_prem_pin', '{{LIFT_PREM_PIN}}', NULL, 'Premises pincode', 'computed', NULL, 'other'),
  ('lift_prem_taluka', '{{LIFT_PREM_TALUKA}}', NULL, 'Premises taluka', 'computed', NULL, 'other'),
  ('lift_premises2', '{{LIFT_PREMISES2}}', NULL, 'Premises 2', 'computed', NULL, 'other'),
  ('lift_prevlic', '{{LIFT_PREVLIC}}', NULL, 'Previous licence', 'computed', NULL, 'other'),
  ('lift_prevlic_details', '{{LIFT_PREVLIC_DETAILS}}', NULL, 'Previous licence details', 'computed', NULL, 'other'),
  ('lift_rated_capacity', '{{LIFT_RATED_CAPACITY}}', NULL, 'Rated capacity', 'computed', NULL, 'other'),
  ('lift_ref', '{{LIFT_REF}}', NULL, 'Ref', 'computed', NULL, 'other'),
  ('lift_reference', '{{LIFT_REFERENCE}}', NULL, 'Reference', 'computed', NULL, 'other'),
  ('lift_reg_no', '{{LIFT_REG_NO}}', NULL, 'Registration number', 'computed', NULL, 'other'),
  ('lift_regional_circle', '{{LIFT_REGIONAL_CIRCLE}}', NULL, 'Regional circle', 'computed', NULL, 'other'),
  ('lift_se_name', '{{LIFT_SE_NAME}}', NULL, 'Superintending Engineer name', 'computed', NULL, 'other'),
  ('lift_signatory', '{{LIFT_SIGNATORY}}', NULL, 'Signatory', 'computed', NULL, 'other'),
  ('lift_speed', '{{LIFT_SPEED}}', NULL, 'Speed', 'computed', NULL, 'other'),
  ('lift_stops', '{{LIFT_STOPS}}', NULL, 'Stops', 'computed', NULL, 'other'),
  ('lift_top_clearance', '{{LIFT_TOP_CLEARANCE}}', NULL, 'Top clearance', 'computed', NULL, 'other'),
  ('lift_total_floors', '{{LIFT_TOTAL_FLOORS}}', NULL, 'Total floors', 'computed', NULL, 'other'),
  ('lift_total_weight', '{{LIFT_TOTAL_WEIGHT}}', NULL, 'Total weight', 'computed', NULL, 'other'),
  ('lift_treasury', '{{LIFT_TREASURY}}', NULL, 'Treasury', 'computed', NULL, 'other'),
  ('lift_valid_from', '{{LIFT_VALID_FROM}}', NULL, 'Valid from', 'computed', NULL, 'other'),
  ('lift_valid_from2', '{{LIFT_VALID_FROM2}}', NULL, 'Valid from 2', 'computed', NULL, 'other'),
  ('lift_valid_to', '{{LIFT_VALID_TO}}', NULL, 'Valid to', 'computed', NULL, 'other'),
  ('lift_valid_to2', '{{LIFT_VALID_TO2}}', NULL, 'Valid to 2', 'computed', NULL, 'other')
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
    ('site_address', 10),
    ('client_name', 20),
    ('letter_date', 30),
    ('project_title', 40),
    ('building_height', 50)
) AS v(placeholder_id, sort_order)
WHERE t.slug = 'lift_permission_to_erect'
ON CONFLICT (application_type_id, placeholder_id) DO UPDATE SET
  required = EXCLUDED.required,
  sort_order = EXCLUDED.sort_order;

INSERT INTO public.application_type_placeholders
  (application_type_id, placeholder_id, required, sort_order)
SELECT t.id, v.placeholder_id, false, v.sort_order
FROM public.application_types t
CROSS JOIN (
  VALUES
    ('site_address', 10),
    ('client_name', 20)
) AS v(placeholder_id, sort_order)
WHERE t.slug = 'lift_working_licence'
ON CONFLICT (application_type_id, placeholder_id) DO UPDATE SET
  required = EXCLUDED.required,
  sort_order = EXCLUDED.sort_order;

INSERT INTO public.application_document_placeholders
  (document_id, placeholder_id, required, sort_order)
SELECT d.id, v.placeholder_id, false, v.sort_order
FROM public.application_documents d
CROSS JOIN (
  VALUES
    ('lift_ei_line1', 10),
    ('lift_ei_line2', 20),
    ('lift_ei_pin', 30),
    ('lift_owner_address', 40),
    ('lift_owner_address2', 50),
    ('lift_owner_taluka', 60),
    ('lift_owner_dist', 70),
    ('lift_owner_pin', 80),
    ('lift_agent_owner', 90),
    ('site_address', 100),
    ('lift_premises2', 110),
    ('lift_prem_taluka', 120),
    ('lift_prem_dist', 130),
    ('lift_prem_pin', 140),
    ('lift_prevlic', 150),
    ('lift_prevlic_details', 160),
    ('lift_lift_firm', 170),
    ('lift_lift_make', 180),
    ('lift_lifttype', 190),
    ('lift_rated_capacity', 200),
    ('lift_speed', 210),
    ('lift_passengers', 220),
    ('lift_total_weight', 230),
    ('lift_counter_weight', 240),
    ('lift_cable_nos', 250),
    ('lift_cable_mm', 260),
    ('lift_bottom_clearance', 270),
    ('lift_top_clearance', 280),
    ('lift_overhead_details', 290),
    ('client_name', 300)
) AS v(placeholder_id, sort_order)
WHERE d.slug = 'lift_form_a'
ON CONFLICT (document_id, placeholder_id) DO UPDATE SET
  required = EXCLUDED.required,
  sort_order = EXCLUDED.sort_order;

INSERT INTO public.application_document_placeholders
  (document_id, placeholder_id, required, sort_order)
SELECT d.id, v.placeholder_id, false, v.sort_order
FROM public.application_documents d
CROSS JOIN (
  VALUES
    ('letter_date', 10),
    ('lift_ei_address1', 20),
    ('lift_ei_address2', 30),
    ('lift_ei_pin', 40),
    ('lift_lifts_installation_stage', 50),
    ('lift_contractor_name', 60)
) AS v(placeholder_id, sort_order)
WHERE d.slug = 'lift_form_a1'
ON CONFLICT (document_id, placeholder_id) DO UPDATE SET
  required = EXCLUDED.required,
  sort_order = EXCLUDED.sort_order;

INSERT INTO public.application_document_placeholders
  (document_id, placeholder_id, required, sort_order)
SELECT d.id, v.placeholder_id, false, v.sort_order
FROM public.application_documents d
CROSS JOIN (
  VALUES
    ('lift_a2_owner', 10),
    ('site_address', 20),
    ('lift_a2_contractor', 30),
    ('lift_a2_intent', 40),
    ('lift_a2_type', 50),
    ('lift_a2_drive', 60),
    ('lift_a2_machine', 70),
    ('lift_a2_kg', 80),
    ('lift_a2_persons', 90),
    ('lift_a2_speed', 100),
    ('lift_a2_floors', 110),
    ('lift_a2_stops', 120),
    ('lift_a2_landings', 130),
    ('lift_a2_control', 140),
    ('lift_a2_height', 150),
    ('lift_a2_fire', 160),
    ('lift_a2_fire_perm', 170),
    ('lift_a2_pit_w', 180),
    ('lift_a2_pit_d', 190),
    ('lift_a2_pit_h', 200),
    ('lift_a2_ladder', 210),
    ('lift_a2_buffer', 220),
    ('lift_a2_car_qty', 230),
    ('lift_a2_car_buff', 240),
    ('lift_a2_cwt_qty', 250),
    ('lift_a2_cwt_buff', 260),
    ('lift_a2_car_bottom', 270),
    ('lift_a2_cwt_bottom', 280),
    ('lift_a2_basement', 290),
    ('lift_a2_encl', 300),
    ('lift_a2_cargate', 310),
    ('lift_a2_landinggate', 320),
    ('lift_a2_entr_w', 330),
    ('lift_a2_entr_h', 340),
    ('lift_a2_car_w', 350),
    ('lift_a2_car_d', 360),
    ('lift_a2_car_h', 370),
    ('lift_a2_car_area', 380),
    ('lift_a2_car_top', 390),
    ('lift_a2_shaft_left', 400),
    ('lift_a2_shaft_right', 410),
    ('lift_a2_shaft', 420),
    ('lift_a2_car_t1', 430),
    ('lift_a2_car_t2', 440),
    ('lift_a2_car_t3', 450),
    ('lift_a2_cwt_t1', 460),
    ('lift_a2_cwt_t2', 470),
    ('lift_a2_cwt_t3', 480),
    ('lift_a2_drive_loc', 490),
    ('lift_a2_mr_w', 500),
    ('lift_a2_mr_d', 510),
    ('lift_a2_mr_h', 520),
    ('lift_a2_door_w', 530),
    ('lift_a2_door_h', 540),
    ('lift_a2_mr_height', 550),
    ('lift_a2_limit', 560),
    ('lift_a2_switchpos', 570),
    ('lift_a2_governor', 580),
    ('lift_a2_space_machine', 590),
    ('lift_a2_windows', 600),
    ('lift_a2_space_controller', 610),
    ('lift_a2_arc', 620),
    ('lift_a2_rope_nos', 630),
    ('lift_a2_rope_dia', 640),
    ('lift_a2_rope_constr', 650),
    ('lift_a2_belt_nos', 660),
    ('lift_a2_belt_w', 670),
    ('lift_a2_belt_h', 680),
    ('lift_a2_independent', 690)
) AS v(placeholder_id, sort_order)
WHERE d.slug = 'lift_form_a2'
ON CONFLICT (document_id, placeholder_id) DO UPDATE SET
  required = EXCLUDED.required,
  sort_order = EXCLUDED.sort_order;

INSERT INTO public.application_document_placeholders
  (document_id, placeholder_id, required, sort_order)
SELECT d.id, v.placeholder_id, false, v.sort_order
FROM public.application_documents d
CROSS JOIN (
  VALUES
    ('lift_circle', 10),
    ('lift_email', 20),
    ('lift_phone', 30),
    ('lift_office_address', 40),
    ('lift_reg_no', 50),
    ('letter_date', 60),
    ('lift_owner_name_address', 70),
    ('lift_owner_name_address2', 80),
    ('lift_owner_name_address3', 90),
    ('lift_lift_no', 100),
    ('site_address', 110),
    ('lift_reference', 120),
    ('lift_ei_name', 130),
    ('lift_lift_no2', 140),
    ('lift_valid_from', 150),
    ('lift_valid_to', 160),
    ('lift_valid_to2', 170),
    ('lift_valid_from2', 180),
    ('lift_stops', 190),
    ('lift_division', 200),
    ('lift_se_name', 210),
    ('lift_regional_circle', 220)
) AS v(placeholder_id, sort_order)
WHERE d.slug = 'lift_form_a3'
ON CONFLICT (document_id, placeholder_id) DO UPDATE SET
  required = EXCLUDED.required,
  sort_order = EXCLUDED.sort_order;

INSERT INTO public.application_document_placeholders
  (document_id, placeholder_id, required, sort_order)
SELECT d.id, v.placeholder_id, false, v.sort_order
FROM public.application_documents d
CROSS JOIN (
  VALUES
    ('lift_ref', 10),
    ('letter_date', 20),
    ('project_title', 30),
    ('lift_building_line2', 40),
    ('lift_building_line3', 50),
    ('lift_ex_engineer', 60),
    ('lift_district', 70),
    ('lift_letter_no', 80),
    ('lift_letter_date', 90),
    ('lift_floors', 100),
    ('lift_total_floors', 110),
    ('building_height', 120),
    ('lift_architect_name_reg', 130),
    ('lift_ei_addr1', 140),
    ('lift_ei_addr2', 150),
    ('lift_ei_pin', 160)
) AS v(placeholder_id, sort_order)
WHERE d.slug = 'lift_architect_certificate'
ON CONFLICT (document_id, placeholder_id) DO UPDATE SET
  required = EXCLUDED.required,
  sort_order = EXCLUDED.sort_order;

INSERT INTO public.application_document_placeholders
  (document_id, placeholder_id, required, sort_order)
SELECT d.id, v.placeholder_id, false, v.sort_order
FROM public.application_documents d
CROSS JOIN (
  VALUES
    ('lift_ref', 10),
    ('letter_date', 20),
    ('project_title', 30),
    ('lift_building_line2', 40),
    ('lift_building_line3', 50),
    ('lift_eebp', 60),
    ('lift_district', 70),
    ('lift_letter_no', 80),
    ('lift_letter_date', 90),
    ('lift_floors', 100),
    ('lift_glass_mm', 110),
    ('lift_engineer_name_reg', 120),
    ('lift_ei_addr1', 130),
    ('lift_ei_addr2', 140),
    ('lift_ei_pin', 150)
) AS v(placeholder_id, sort_order)
WHERE d.slug = 'lift_structural_stability_certificate'
ON CONFLICT (document_id, placeholder_id) DO UPDATE SET
  required = EXCLUDED.required,
  sort_order = EXCLUDED.sort_order;

INSERT INTO public.application_document_placeholders
  (document_id, placeholder_id, required, sort_order)
SELECT d.id, v.placeholder_id, false, v.sort_order
FROM public.application_documents d
CROSS JOIN (
  VALUES
    ('lift_division', 10),
    ('site_address', 20),
    ('lift_letter_no', 30),
    ('lift_letter_date', 40),
    ('lift_circle', 50),
    ('lift_completion_date', 60),
    ('lift_completion_year', 70),
    ('lift_fee', 80),
    ('lift_treasury', 90),
    ('client_name', 100)
) AS v(placeholder_id, sort_order)
WHERE d.slug = 'lift_form_b'
ON CONFLICT (document_id, placeholder_id) DO UPDATE SET
  required = EXCLUDED.required,
  sort_order = EXCLUDED.sort_order;

INSERT INTO public.application_document_placeholders
  (document_id, placeholder_id, required, sort_order)
SELECT d.id, v.placeholder_id, false, v.sort_order
FROM public.application_documents d
CROSS JOIN (
  VALUES
    ('lift_division', 10),
    ('lift_ei_address', 20),
    ('site_address', 30),
    ('lift_contract_no', 40),
    ('lift_contract_date', 50),
    ('lift_client', 60),
    ('lift_lift_maker', 70),
    ('lift_company_name', 80),
    ('lift_contractor_sign', 90)
) AS v(placeholder_id, sort_order)
WHERE d.slug = 'lift_form_b1'
ON CONFLICT (document_id, placeholder_id) DO UPDATE SET
  required = EXCLUDED.required,
  sort_order = EXCLUDED.sort_order;

INSERT INTO public.application_document_placeholders
  (document_id, placeholder_id, required, sort_order)
SELECT d.id, v.placeholder_id, false, v.sort_order
FROM public.application_documents d
CROSS JOIN (
  VALUES
    ('lift_division', 10),
    ('lift_ei_address', 20),
    ('site_address', 30),
    ('lift_lift_company', 40),
    ('lift_contract_no', 50),
    ('lift_a_form_no', 60),
    ('lift_earth_ohms', 70),
    ('lift_signatory', 80)
) AS v(placeholder_id, sort_order)
WHERE d.slug = 'lift_form_b2'
ON CONFLICT (document_id, placeholder_id) DO UPDATE SET
  required = EXCLUDED.required,
  sort_order = EXCLUDED.sort_order;

INSERT INTO public.application_document_placeholders
  (document_id, placeholder_id, required, sort_order)
SELECT d.id, v.placeholder_id, false, v.sort_order
FROM public.application_documents d
CROSS JOIN (
  VALUES
    ('lift_b3_insp_date', 10),
    ('lift_b3_owner', 20),
    ('site_address', 30),
    ('lift_b3_contractor', 40),
    ('lift_b3_officer', 50),
    ('lift_b3_intent', 60),
    ('lift_b3_type', 70),
    ('lift_b3_drive', 80),
    ('lift_b3_machine', 90),
    ('lift_b3_kg', 100),
    ('lift_b3_persons', 110),
    ('lift_b3_speed', 120),
    ('lift_b3_floors', 130),
    ('lift_b3_stops', 140),
    ('lift_b3_landings', 150),
    ('lift_b3_control', 160),
    ('lift_b3_height', 170),
    ('lift_b3_fire', 180),
    ('lift_b3_pit_w', 190),
    ('lift_b3_pit_d', 200),
    ('lift_b3_pit_h', 210),
    ('lift_b3_buffer', 220),
    ('lift_b3_car_qty', 230),
    ('lift_b3_car_buff', 240),
    ('lift_b3_cwt_qty', 250),
    ('lift_b3_cwt_buff', 260),
    ('lift_b3_car_bottom', 270),
    ('lift_b3_cwt_bottom', 280),
    ('lift_b3_basement', 290),
    ('lift_b3_encl', 300),
    ('lift_b3_push', 310),
    ('lift_b3_indicator', 320),
    ('lift_b3_cargate', 330),
    ('lift_b3_car_gate_condition', 340),
    ('lift_b3_car_contact', 350),
    ('lift_b3_landinggate', 360),
    ('lift_b3_landing_condition', 370),
    ('lift_b3_landing_contact', 380),
    ('lift_b3_entr_w', 390),
    ('lift_b3_entr_h', 400),
    ('lift_b3_car_w', 410),
    ('lift_b3_car_d', 420),
    ('lift_b3_car_h', 430),
    ('lift_b3_car_area', 440),
    ('lift_b3_sill_gap', 450),
    ('lift_b3_car_top', 460),
    ('lift_b3_shaft_left', 470),
    ('lift_b3_shaft_right', 480),
    ('lift_b3_shaft', 490),
    ('lift_b3_car_t1', 500),
    ('lift_b3_car_t2', 510),
    ('lift_b3_car_t3', 520),
    ('lift_b3_cwt_t1', 530),
    ('lift_b3_cwt_t2', 540),
    ('lift_b3_cwt_t3', 550),
    ('lift_b3_guide_left1', 560),
    ('lift_b3_guide_left2', 570),
    ('lift_b3_guide_right1', 580),
    ('lift_b3_guide_right2', 590),
    ('lift_b3_cwt_gap', 600),
    ('lift_b3_elcb_make', 610),
    ('lift_b3_elcb_current', 620),
    ('lift_b3_elcb_ma', 630),
    ('lift_b3_mcb', 640),
    ('lift_b3_mcb_current', 650),
    ('lift_b3_aux_make', 660),
    ('lift_b3_aux_current', 670),
    ('lift_b3_aux_ma', 680),
    ('lift_b3_mc_make', 690),
    ('lift_b3_mc_capacity', 700),
    ('lift_b3_mc_sr', 710),
    ('lift_b3_mc_current', 720),
    ('lift_b3_mc_voltage', 730),
    ('lift_b3_mc_speed', 740),
    ('lift_b3_space_front', 750),
    ('lift_b3_space_back', 760),
    ('lift_b3_space_right', 770),
    ('lift_b3_space_left', 780),
    ('lift_b3_rope_nos', 790),
    ('lift_b3_rope_dia', 800),
    ('lift_b3_belt_nos', 810),
    ('lift_b3_belt_w', 820),
    ('lift_b3_belt_h', 830)
) AS v(placeholder_id, sort_order)
WHERE d.slug = 'lift_form_b3'
ON CONFLICT (document_id, placeholder_id) DO UPDATE SET
  required = EXCLUDED.required,
  sort_order = EXCLUDED.sort_order;

INSERT INTO public.application_document_placeholders
  (document_id, placeholder_id, required, sort_order)
SELECT d.id, v.placeholder_id, false, v.sort_order
FROM public.application_documents d
CROSS JOIN (
  VALUES
    ('lift_office', 10),
    ('lift_office2', 20),
    ('lift_reg_no', 30),
    ('lift_license_no', 40),
    ('lift_fire', 50),
    ('lift_kind', 60),
    ('client_name', 70),
    ('lift_owner_address', 80),
    ('lift_lift_no', 90),
    ('site_address', 100),
    ('lift_make', 110),
    ('lift_hp', 120),
    ('lift_drive', 130),
    ('lift_capacity', 140),
    ('lift_speed', 150),
    ('lift_stops', 160),
    ('lift_division', 170),
    ('lift_circle', 180)
) AS v(placeholder_id, sort_order)
WHERE d.slug = 'lift_form_b4'
ON CONFLICT (document_id, placeholder_id) DO UPDATE SET
  required = EXCLUDED.required,
  sort_order = EXCLUDED.sort_order;

