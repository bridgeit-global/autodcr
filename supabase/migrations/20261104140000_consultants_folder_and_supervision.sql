-- Consolidate Appointment + Acceptance HTML under General/consultants/<role>/.
-- Move supervision memos off Document Checklist onto each appointment_letter type
-- (roster-matched consultants only). Deactivate gdc_supervision_* checklist docs.

-- Ensure Architect/L.S. role tokens exist (may be missing if earlier migration not applied).
INSERT INTO public.placeholders
  (id, token, legacy_token, label, source_table, source_column, ui_group)
VALUES
  ('architect_or_ls_role', '{{ARCHITECT_OR_LS_ROLE}}', NULL, 'Architect or L.S. role', 'computed', NULL, 'consultant'),
  ('architect_or_ls_reg_label', '{{ARCHITECT_OR_LS_REG_LABEL}}', NULL, 'Architect or L.S. reg label', 'computed', NULL, 'consultant'),
  ('architect_ls_validity', '{{ARCHITECT_LS_VALIDITY}}', NULL, 'Architect / L.S. validity', 'computed', NULL, 'consultant'),
  ('architect_ls_reg_no', '{{ARCHITECT_LS_REG_NO}}', NULL, 'Architect / L.S. reg no', 'computed', NULL, 'consultant')
ON CONFLICT (id) DO UPDATE SET
  token = EXCLUDED.token,
  label = EXCLUDED.label,
  source_table = EXCLUDED.source_table,
  source_column = EXCLUDED.source_column,
  ui_group = EXCLUDED.ui_group,
  is_active = true,
  updated_at = now();

-- ---------------------------------------------------------------------------
-- 1) Repoint appointment + acceptance html paths
-- ---------------------------------------------------------------------------
UPDATE public.application_documents d
SET html = v.html
FROM (
  VALUES
    ('architect_appointment', 'General/consultants/architect/appointment.html'),
    ('architect_acceptance', 'General/consultants/architect/acceptance.html'),
    ('licensed_surveyor_appointment', 'General/consultants/licensed-surveyor/appointment.html'),
    ('licensed_surveyor_acceptance', 'General/consultants/licensed-surveyor/acceptance.html'),
    ('structural_engineer_appointment', 'General/consultants/structural-engineer/appointment.html'),
    ('structural_engineer_acceptance', 'General/consultants/structural-engineer/acceptance.html'),
    ('plumber_appointment', 'General/consultants/plumber/appointment.html'),
    ('plumber_acceptance', 'General/consultants/plumber/acceptance.html'),
    ('site_supervisor_appointment', 'General/consultants/site-supervisor/appointment.html'),
    ('site_supervisor_acceptance', 'General/consultants/site-supervisor/acceptance.html'),
    ('fire_consultant_appointment', 'General/consultants/fire-safety-consultant/appointment.html'),
    ('fire_consultant_acceptance', 'General/consultants/fire-safety-consultant/acceptance.html'),
    ('mep_consultant_appointment', 'General/consultants/me-consultant/appointment.html'),
    ('mep_consultant_acceptance', 'General/consultants/me-consultant/acceptance.html'),
    ('town_planner_appointment', 'General/consultants/town-planner/appointment.html'),
    ('town_planner_acceptance', 'General/consultants/town-planner/acceptance.html'),
    ('environmental_consultant_appointment', 'General/consultants/environmental-consultant/appointment.html'),
    ('environmental_consultant_acceptance', 'General/consultants/environmental-consultant/acceptance.html'),
    ('landscape_consultant_appointment', 'General/consultants/landscape-consultant/appointment.html'),
    ('landscape_consultant_acceptance', 'General/consultants/landscape-consultant/acceptance.html'),
    ('geotechnical_consultant_appointment', 'General/consultants/geotechnical-consultant/appointment.html'),
    ('geotechnical_consultant_acceptance', 'General/consultants/geotechnical-consultant/acceptance.html'),
    ('pmc_project_manager_appointment', 'General/consultants/pmc-project-manager/appointment.html'),
    ('pmc_project_manager_acceptance', 'General/consultants/pmc-project-manager/acceptance.html')
) AS v(slug, html)
WHERE d.slug = v.slug;

-- ---------------------------------------------------------------------------
-- 2) Add Supervision document per appointment_letter type
-- ---------------------------------------------------------------------------
INSERT INTO public.application_documents
  (slug, application_type_id, category, html, sign, letter_variant,
   show_letterhead, show_qrcode, letterhead_source, sort_order, is_active)
SELECT
  v.slug,
  t.id,
  'Supervision',
  v.html,
  v.sign,
  NULL,
  true,
  false,
  v.letterhead_source,
  30,
  true
FROM public.application_types t
JOIN (
  VALUES
    (
      'appointment_letter_for_architect',
      'architect_supervision',
      'General/consultants/architect/supervision-memo.html',
      ARRAY['architect_or_ls']::text[],
      'architect_or_ls'::text
    ),
    (
      'appointment_letter_for_licensed_surveyor',
      'licensed_surveyor_supervision',
      'General/consultants/licensed-surveyor/supervision-memo.html',
      ARRAY['architect_or_ls']::text[],
      'architect_or_ls'::text
    ),
    (
      'appointment_letter_for_structural_engineer',
      'structural_engineer_supervision',
      'General/consultants/structural-engineer/supervision-memo.html',
      ARRAY['consultant']::text[],
      'consultant'::text
    ),
    (
      'appointment_letter_for_plumber',
      'plumber_supervision',
      'General/consultants/plumber/supervision-memo.html',
      ARRAY['consultant']::text[],
      'consultant'::text
    ),
    (
      'appointment_letter_for_site_supervisor',
      'site_supervisor_supervision',
      'General/consultants/site-supervisor/supervision-memo.html',
      ARRAY['consultant']::text[],
      'consultant'::text
    ),
    (
      'appointment_letter_for_fire_consultant',
      'fire_consultant_supervision',
      'General/consultants/fire-safety-consultant/supervision-memo.html',
      ARRAY['consultant']::text[],
      'consultant'::text
    ),
    (
      'appointment_letter_for_mep_consultant',
      'mep_consultant_supervision',
      'General/consultants/me-consultant/supervision-memo.html',
      ARRAY['consultant']::text[],
      'consultant'::text
    ),
    (
      'appointment_letter_for_town_planner',
      'town_planner_supervision',
      'General/consultants/town-planner/supervision-memo.html',
      ARRAY['consultant']::text[],
      'consultant'::text
    ),
    (
      'appointment_letter_for_environmental_consultant',
      'environmental_consultant_supervision',
      'General/consultants/environmental-consultant/supervision-memo.html',
      ARRAY['consultant']::text[],
      'consultant'::text
    ),
    (
      'appointment_letter_for_landscape_consultant',
      'landscape_consultant_supervision',
      'General/consultants/landscape-consultant/supervision-memo.html',
      ARRAY['consultant']::text[],
      'consultant'::text
    ),
    (
      'appointment_letter_for_geotechnical_consultant',
      'geotechnical_consultant_supervision',
      'General/consultants/geotechnical-consultant/supervision-memo.html',
      ARRAY['consultant']::text[],
      'consultant'::text
    ),
    (
      'appointment_letter_for_pmc_project_manager',
      'pmc_project_manager_supervision',
      'General/consultants/pmc-project-manager/supervision-memo.html',
      ARRAY['consultant']::text[],
      'consultant'::text
    )
) AS v(type_slug, slug, html, sign, letterhead_source)
  ON t.slug = v.type_slug
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

-- ---------------------------------------------------------------------------
-- 3) Document placeholders for supervision memos (section_label for accordions)
-- ---------------------------------------------------------------------------

-- Shared BMC annexure fields already on appointment types via type-level
-- placeholders; document-level adds supervision-specific + CC blocks.

-- Architect / Licensed Surveyor supervision
INSERT INTO public.application_document_placeholders
  (document_id, placeholder_id, required, sort_order, section_label)
SELECT d.id, v.placeholder_id, false, v.sort_order, v.section_label
FROM public.application_documents d
CROSS JOIN (
  VALUES
    ('consultant_firm', 230, 'Consultant'),
    ('architect_ls_name', 240, 'Consultant'),
    ('architect_or_ls_role', 245, 'Consultant'),
    ('architect_or_ls_reg_label', 246, 'Consultant'),
    ('architect_ls_reg_no', 250, 'Consultant'),
    ('architect_ls_validity', 255, 'Consultant'),
    ('reg_no', 260, 'Consultant'),
    ('validity', 270, 'Consultant'),
    ('owner_or_developer', 280, 'Client'),
    ('owner_firm', 290, 'Client'),
    ('owner_address_line_1', 300, 'Client'),
    ('owner_address_line_2', 310, 'Client'),
    ('owner_address_line_3', 320, 'Client')
) AS v(placeholder_id, sort_order, section_label)
WHERE d.slug IN ('architect_supervision', 'licensed_surveyor_supervision')
ON CONFLICT (document_id, placeholder_id) DO UPDATE SET
  section_label = EXCLUDED.section_label,
  sort_order = EXCLUDED.sort_order;

-- Structural Engineer
INSERT INTO public.application_document_placeholders
  (document_id, placeholder_id, required, sort_order, section_label)
SELECT d.id, v.placeholder_id, false, v.sort_order, v.section_label
FROM public.application_documents d
CROSS JOIN (
  VALUES
    ('appointment_date', 225, 'Reference'),
    ('consultant_firm', 230, 'Consultant'),
    ('structural_engineer', 240, 'Consultant'),
    ('reg_no', 250, 'Consultant'),
    ('validity', 260, 'Consultant'),
    ('owner_or_developer', 270, 'Client'),
    ('owner_firm', 280, 'Client'),
    ('owner_address_line_1', 290, 'Client'),
    ('owner_address_line_2', 300, 'Client'),
    ('owner_address_line_3', 310, 'Client'),
    ('architect_ls_name', 320, 'Consultant'),
    ('architect_or_ls_role', 325, 'Consultant'),
    ('architect_or_ls_reg_label', 326, 'Consultant'),
    ('architect_ls_reg_no', 330, 'Consultant'),
    ('architect_ls_validity', 335, 'Consultant'),
    ('architect_ls_office', 340, 'Consultant'),
    ('architect_address_line_1', 350, 'Consultant'),
    ('architect_address_line_2', 360, 'Consultant'),
    ('architect_address_line_3', 370, 'Consultant')
) AS v(placeholder_id, sort_order, section_label)
WHERE d.slug = 'structural_engineer_supervision'
ON CONFLICT (document_id, placeholder_id) DO UPDATE SET
  section_label = EXCLUDED.section_label,
  sort_order = EXCLUDED.sort_order;

-- Plumber
INSERT INTO public.application_document_placeholders
  (document_id, placeholder_id, required, sort_order, section_label)
SELECT d.id, v.placeholder_id, false, v.sort_order, v.section_label
FROM public.application_documents d
CROSS JOIN (
  VALUES
    ('consultant_firm', 230, 'Consultant'),
    ('licensed_plumber', 240, 'Consultant'),
    ('reg_no', 250, 'Consultant'),
    ('validity', 260, 'Consultant'),
    ('owner_or_developer', 270, 'Client'),
    ('owner_firm', 280, 'Client'),
    ('owner_address_line_1', 290, 'Client'),
    ('owner_address_line_2', 300, 'Client'),
    ('owner_address_line_3', 310, 'Client'),
    ('architect_ls_name', 320, 'Consultant'),
    ('architect_or_ls_role', 325, 'Consultant'),
    ('architect_or_ls_reg_label', 326, 'Consultant'),
    ('architect_ls_reg_no', 330, 'Consultant'),
    ('architect_ls_validity', 335, 'Consultant'),
    ('architect_ls_office', 340, 'Consultant'),
    ('architect_address_line_1', 350, 'Consultant'),
    ('architect_address_line_2', 360, 'Consultant'),
    ('architect_address_line_3', 370, 'Consultant')
) AS v(placeholder_id, sort_order, section_label)
WHERE d.slug = 'plumber_supervision'
ON CONFLICT (document_id, placeholder_id) DO UPDATE SET
  section_label = EXCLUDED.section_label,
  sort_order = EXCLUDED.sort_order;

-- Site Supervisor
INSERT INTO public.application_document_placeholders
  (document_id, placeholder_id, required, sort_order, section_label)
SELECT d.id, v.placeholder_id, false, v.sort_order, v.section_label
FROM public.application_documents d
CROSS JOIN (
  VALUES
    ('appointment_date', 225, 'Reference'),
    ('consultant_firm', 230, 'Consultant'),
    ('site_supervisor', 240, 'Consultant'),
    ('reg_no', 250, 'Consultant'),
    ('validity', 260, 'Consultant'),
    ('owner_or_developer', 270, 'Client'),
    ('owner_firm', 280, 'Client'),
    ('owner_address_line_1', 290, 'Client'),
    ('owner_address_line_2', 300, 'Client'),
    ('owner_address_line_3', 310, 'Client'),
    ('architect_ls_name', 320, 'Consultant'),
    ('architect_or_ls_role', 325, 'Consultant'),
    ('architect_or_ls_reg_label', 326, 'Consultant'),
    ('architect_ls_reg_no', 330, 'Consultant'),
    ('architect_ls_validity', 335, 'Consultant'),
    ('architect_ls_office', 340, 'Consultant'),
    ('architect_address_line_1', 350, 'Consultant'),
    ('architect_address_line_2', 360, 'Consultant'),
    ('architect_address_line_3', 370, 'Consultant')
) AS v(placeholder_id, sort_order, section_label)
WHERE d.slug = 'site_supervisor_supervision'
ON CONFLICT (document_id, placeholder_id) DO UPDATE SET
  section_label = EXCLUDED.section_label,
  sort_order = EXCLUDED.sort_order;

-- Fire / M&E — role-specific name tokens
INSERT INTO public.application_document_placeholders
  (document_id, placeholder_id, required, sort_order, section_label)
SELECT d.id, v.placeholder_id, false, v.sort_order, v.section_label
FROM public.application_documents d
CROSS JOIN (
  VALUES
    ('appointment_date', 225, 'Reference'),
    ('consultant_firm', 230, 'Consultant'),
    ('fire_safety_consultant', 240, 'Consultant'),
    ('reg_no', 250, 'Consultant'),
    ('validity', 260, 'Consultant'),
    ('owner_or_developer', 270, 'Client'),
    ('owner_firm', 280, 'Client'),
    ('owner_address_line_1', 290, 'Client'),
    ('owner_address_line_2', 300, 'Client'),
    ('owner_address_line_3', 310, 'Client'),
    ('architect_ls_name', 320, 'Consultant'),
    ('architect_or_ls_role', 325, 'Consultant'),
    ('architect_or_ls_reg_label', 326, 'Consultant'),
    ('architect_ls_reg_no', 330, 'Consultant'),
    ('architect_ls_validity', 335, 'Consultant'),
    ('architect_ls_office', 340, 'Consultant'),
    ('architect_address_line_1', 350, 'Consultant'),
    ('architect_address_line_2', 360, 'Consultant'),
    ('architect_address_line_3', 370, 'Consultant')
) AS v(placeholder_id, sort_order, section_label)
WHERE d.slug = 'fire_consultant_supervision'
ON CONFLICT (document_id, placeholder_id) DO UPDATE SET
  section_label = EXCLUDED.section_label,
  sort_order = EXCLUDED.sort_order;

INSERT INTO public.application_document_placeholders
  (document_id, placeholder_id, required, sort_order, section_label)
SELECT d.id, v.placeholder_id, false, v.sort_order, v.section_label
FROM public.application_documents d
CROSS JOIN (
  VALUES
    ('appointment_date', 225, 'Reference'),
    ('consultant_firm', 230, 'Consultant'),
    ('me_consultant', 240, 'Consultant'),
    ('reg_no', 250, 'Consultant'),
    ('validity', 260, 'Consultant'),
    ('owner_or_developer', 270, 'Client'),
    ('owner_firm', 280, 'Client'),
    ('owner_address_line_1', 290, 'Client'),
    ('owner_address_line_2', 300, 'Client'),
    ('owner_address_line_3', 310, 'Client'),
    ('architect_ls_name', 320, 'Consultant'),
    ('architect_or_ls_role', 325, 'Consultant'),
    ('architect_or_ls_reg_label', 326, 'Consultant'),
    ('architect_ls_reg_no', 330, 'Consultant'),
    ('architect_ls_validity', 335, 'Consultant'),
    ('architect_ls_office', 340, 'Consultant'),
    ('architect_address_line_1', 350, 'Consultant'),
    ('architect_address_line_2', 360, 'Consultant'),
    ('architect_address_line_3', 370, 'Consultant')
) AS v(placeholder_id, sort_order, section_label)
WHERE d.slug = 'mep_consultant_supervision'
ON CONFLICT (document_id, placeholder_id) DO UPDATE SET
  section_label = EXCLUDED.section_label,
  sort_order = EXCLUDED.sort_order;

-- Remaining consultants — generic consultant_name + CC Architect/L.S.
INSERT INTO public.application_document_placeholders
  (document_id, placeholder_id, required, sort_order, section_label)
SELECT d.id, v.placeholder_id, false, v.sort_order, v.section_label
FROM public.application_documents d
CROSS JOIN (
  VALUES
    ('appointment_date', 225, 'Reference'),
    ('consultant_firm', 230, 'Consultant'),
    ('consultant_name', 240, 'Consultant'),
    ('reg_no', 250, 'Consultant'),
    ('validity', 260, 'Consultant'),
    ('owner_or_developer', 270, 'Client'),
    ('owner_firm', 280, 'Client'),
    ('owner_address_line_1', 290, 'Client'),
    ('owner_address_line_2', 300, 'Client'),
    ('owner_address_line_3', 310, 'Client'),
    ('architect_ls_name', 320, 'Consultant'),
    ('architect_or_ls_role', 325, 'Consultant'),
    ('architect_or_ls_reg_label', 326, 'Consultant'),
    ('architect_ls_reg_no', 330, 'Consultant'),
    ('architect_ls_validity', 335, 'Consultant'),
    ('architect_ls_office', 340, 'Consultant'),
    ('architect_address_line_1', 350, 'Consultant'),
    ('architect_address_line_2', 360, 'Consultant'),
    ('architect_address_line_3', 370, 'Consultant')
) AS v(placeholder_id, sort_order, section_label)
WHERE d.slug IN (
  'town_planner_supervision',
  'environmental_consultant_supervision',
  'landscape_consultant_supervision',
  'geotechnical_consultant_supervision',
  'pmc_project_manager_supervision'
)
ON CONFLICT (document_id, placeholder_id) DO UPDATE SET
  section_label = EXCLUDED.section_label,
  sort_order = EXCLUDED.sort_order;

-- ---------------------------------------------------------------------------
-- 4) Remove supervision from Document Checklist
-- ---------------------------------------------------------------------------
UPDATE public.application_documents
SET is_active = false
WHERE slug IN (
  'gdc_supervision_architect',
  'gdc_supervision_structural',
  'gdc_supervision_plumber',
  'gdc_supervision_site_supervisor'
);
