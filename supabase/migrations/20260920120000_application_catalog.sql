-- DB-driven application catalog: types, documents, shared placeholders.

CREATE TABLE public.application_types (
  id text PRIMARY KEY,
  department text NOT NULL,
  application_title text NOT NULL UNIQUE,
  description text NOT NULL DEFAULT '',
  category text NOT NULL
    CHECK (category IN ('appointment_letter', 'department_permission')),
  applicant_type text,
  token_suffix text,
  planning_authorities text[] NOT NULL DEFAULT '{}'::text[],
  requires_roster_match boolean NOT NULL DEFAULT false,
  show_building_permission_fields boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  sort_order int NOT NULL DEFAULT 100,
  icon_key text NOT NULL DEFAULT 'document',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX application_types_department_idx
  ON public.application_types (department, is_active, sort_order);

CREATE TABLE public.application_documents (
  id text PRIMARY KEY,
  application_type_id text NOT NULL
    REFERENCES public.application_types(id) ON DELETE CASCADE,
  category text NOT NULL,
  sub_category text,
  html text,
  sign text[] NOT NULL DEFAULT '{}'::text[],
  letter_variant text
    CHECK (letter_variant IS NULL OR letter_variant IN ('appointment', 'acceptance')),
  is_active boolean NOT NULL DEFAULT true,
  sort_order int NOT NULL DEFAULT 100
);

CREATE INDEX application_documents_type_idx
  ON public.application_documents (application_type_id, sort_order);

CREATE TABLE public.placeholders (
  id text PRIMARY KEY,
  token text NOT NULL UNIQUE,
  legacy_token text,
  label text NOT NULL,
  source_table text NOT NULL
    CHECK (source_table IN (
      'projects',
      'applicants',
      'building_proposal_offices',
      'computed',
      'owner_applicant'
    )),
  source_column text,
  ui_group text NOT NULL DEFAULT 'other'
    CHECK (ui_group IN (
      'subject',
      'reference',
      'consultant',
      'client',
      'office',
      'letterhead',
      'other'
    )),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.application_type_placeholders (
  application_type_id text NOT NULL
    REFERENCES public.application_types(id) ON DELETE CASCADE,
  placeholder_id text NOT NULL
    REFERENCES public.placeholders(id) ON DELETE CASCADE,
  required boolean NOT NULL DEFAULT true,
  sort_order int NOT NULL DEFAULT 100,
  PRIMARY KEY (application_type_id, placeholder_id)
);

CREATE TABLE public.application_document_placeholders (
  document_id text NOT NULL
    REFERENCES public.application_documents(id) ON DELETE CASCADE,
  placeholder_id text NOT NULL
    REFERENCES public.placeholders(id) ON DELETE CASCADE,
  required boolean NOT NULL DEFAULT true,
  sort_order int NOT NULL DEFAULT 100,
  PRIMARY KEY (document_id, placeholder_id)
);

CREATE OR REPLACE VIEW public.application_catalog_sheet AS
SELECT
  t.department,
  t.application_title AS application_type,
  d.category,
  d.sub_category,
  d.html,
  array_to_string(d.sign, ', ') AS sign,
  p.token AS placeholder,
  p.source_column AS "column",
  p.source_table AS "table",
  t.sort_order AS type_sort,
  d.sort_order AS document_sort,
  atp.sort_order AS placeholder_sort
FROM public.application_types t
JOIN public.application_documents d ON d.application_type_id = t.id AND d.is_active
JOIN public.application_type_placeholders atp ON atp.application_type_id = t.id
JOIN public.placeholders p ON p.id = atp.placeholder_id AND p.is_active
WHERE t.is_active
UNION ALL
SELECT
  t.department,
  t.application_title AS application_type,
  d.category,
  d.sub_category,
  d.html,
  array_to_string(d.sign, ', ') AS sign,
  p.token AS placeholder,
  p.source_column AS "column",
  p.source_table AS "table",
  t.sort_order AS type_sort,
  d.sort_order AS document_sort,
  adp.sort_order AS placeholder_sort
FROM public.application_types t
JOIN public.application_documents d ON d.application_type_id = t.id AND d.is_active
JOIN public.application_document_placeholders adp ON adp.document_id = d.id
JOIN public.placeholders p ON p.id = adp.placeholder_id AND p.is_active
WHERE t.is_active;

COMMENT ON TABLE public.application_types IS
  'Catalog of creatable application types for Create Application.';
COMMENT ON TABLE public.placeholders IS
  'Shared placeholder master. New HTML uses {{WARD}}; legacy_token holds existing $project_* names.';

-- ---------------------------------------------------------------------------
-- Placeholders
-- ---------------------------------------------------------------------------
INSERT INTO public.placeholders
  (id, token, legacy_token, label, source_table, source_column, ui_group)
VALUES
  ('letter_date', '{{LETTER_DATE}}', '$project_date_generation', 'Letter date', 'computed', 'current_date', 'other'),
  ('appointment_role', '{{APPOINTMENT_ROLE}}', '$project_Letter_Appointment_Role', 'Consultant role', 'computed', 'applicant_role', 'subject'),
  ('survey_nos', '{{SURVEY_NOS}}', '$project_CS/CTSNos.', 'Survey numbers', 'projects', 'save_plot_details->>proposedCtsNumber', 'subject'),
  ('village', '{{VILLAGE}}', '$project_Division/Village', 'Division / village', 'projects', 'save_plot_details->>villageName', 'subject'),
  ('street', '{{STREET}}', '$project_Street', 'Street / road', 'projects', 'save_plot_details->>roadName', 'subject'),
  ('ward', '{{WARD}}', '$project_Ward.', 'Ward', 'projects', 'save_plot_details->>ward', 'subject'),
  ('planning_authority', '{{PLANNING_AUTHORITY}}', '$project_Planning_Authority', 'Planning authority', 'projects', 'save_plot_details->>planningAuthority', 'reference'),
  ('proposal_number', '{{PROPOSAL_NUMBER}}', '$project_Proposal_Number', 'Proposal number', 'projects', 'project_info->>proposalNo', 'reference'),
  ('project_title', '{{PROJECT_TITLE}}', '$project_Project_Title', 'Project name', 'projects', 'title', 'other'),
  ('type_of_development', '{{TYPE_OF_DEVELOPMENT}}', '$project_Type_of_Development', 'Major use of plot', 'projects', 'save_plot_details->>majorUseOfPlot', 'other'),
  ('plot_area', '{{PLOT_AREA}}', NULL, 'Plot area', 'projects', 'save_plot_details->>grossPlotArea', 'other'),
  ('building_height', '{{BUILDING_HEIGHT}}', NULL, 'Building height', 'projects', 'building_details->>height', 'other'),
  ('building_type', '{{BUILDING_TYPE}}', NULL, 'Building type', 'projects', 'building_details->>buildingType', 'other'),
  ('property_address', '{{PROPERTY_ADDRESS}}', NULL, 'Property address', 'projects', 'project_info->>propertyAddress', 'other'),
  ('client_company', '{{CLIENT_COMPANY}}', '$project_Client_Company_Name', 'Client company name', 'owner_applicant', 'entity_name', 'client'),
  ('client_name', '{{CLIENT_NAME}}', '$project_Client_Name', 'Client name', 'owner_applicant', 'name', 'client'),
  ('client_addr1', '{{CLIENT_ADDRESS_LINE1}}', '$project_addressline1_Client', 'Client — address line 1', 'owner_applicant', 'address_line1', 'client'),
  ('client_addr2', '{{CLIENT_ADDRESS_LINE2}}', '$project_addressline2_Client', 'Client — address line 2', 'owner_applicant', 'address_line2', 'client'),
  ('client_addr3', '{{CLIENT_ADDRESS_LINE3}}', '$project_addressline3_Client', 'Client — address line 3', 'owner_applicant', 'address_line3', 'client'),
  ('letterhead_url', '{{LETTERHEAD_URL}}', '$project_Letterhead_Image_Url', 'Letterhead URL', 'computed', 'letterhead', 'letterhead'),
  ('consultant_name', '{{CONSULTANT_NAME}}', NULL, 'Consultant name', 'applicants', 'name', 'consultant'),
  ('consultant_firm', '{{CONSULTANT_FIRM}}', NULL, 'Consultant firm name', 'applicants', 'entity_name', 'consultant'),
  ('consultant_addr1', '{{CONSULTANT_ADDRESS_LINE1}}', NULL, 'Consultant address line 1', 'applicants', 'address_line1', 'consultant'),
  ('consultant_addr2', '{{CONSULTANT_ADDRESS_LINE2}}', NULL, 'Consultant address line 2', 'applicants', 'address_line2', 'consultant'),
  ('consultant_addr3', '{{CONSULTANT_ADDRESS_LINE3}}', NULL, 'Consultant address line 3', 'applicants', 'address_line3', 'consultant'),
  ('reg_no', '{{REG_NO}}', NULL, 'Registration number', 'applicants', 'registrationNumber', 'consultant'),
  ('validity', '{{VALIDITY}}', NULL, 'Registration validity', 'computed', 'consultant_validity', 'consultant'),
  ('eebp_pincode', '{{EEBP_PINCODE}}', '$project_Acceptance_EEBP_Pincode', 'Pincode (EEBP acceptance)', 'projects', 'project_info->>pincode', 'other'),
  ('saved_pdf_qr', '{{SAVED_PDF_QR}}', '$project_Saved_Pdf_QR', 'Saved PDF QR', 'computed', 'saved_pdf_qr', 'other');

-- ---------------------------------------------------------------------------
-- Application types
-- ---------------------------------------------------------------------------
INSERT INTO public.application_types
  (id, department, application_title, description, category, applicant_type, token_suffix,
   planning_authorities, requires_roster_match, show_building_permission_fields, sort_order, icon_key)
VALUES
  -- Building Permission
  ('commencement', 'Building Permission', 'Commencement', 'Concession - Building Permission',
   'department_permission', NULL, NULL, '{}', false, true, 10, 'check'),
  ('commencement_other', 'Building Permission', 'Commencement (Other)', 'Concession for other application types',
   'department_permission', NULL, NULL, '{}', false, true, 20, 'check'),
  ('change_of_developer', 'Building Permission', 'Change of Developer', 'Update developer information',
   'department_permission', NULL, NULL, '{}', false, true, 30, 'clipboard'),
  ('change_of_architect', 'Building Permission', 'Change of Architect', 'Submit architect change request',
   'department_permission', NULL, NULL, '{}', false, true, 40, 'clipboard'),
  ('common_completion_request', 'Building Permission', 'Common Completion Request', 'Common completion request form',
   'department_permission', NULL, NULL, '{}', false, true, 50, 'document'),
  ('iod', 'Building Permission', 'IOD', 'Intimation of Disapproval',
   'department_permission', NULL, NULL, '{}', false, true, 60, 'document'),
  ('loa', 'Building Permission', 'LOA', 'Letter of Acceptance',
   'department_permission', NULL, NULL, '{}', false, true, 70, 'document'),
  ('occupancy', 'Building Permission', 'Occupancy', 'For buildings/floors ready to occupy',
   'department_permission', NULL, NULL, '{}', false, true, 80, 'building'),
  -- General appointment letters
  ('appointment_letter_for_architect', 'General', 'Appointment Letter for Architect',
   'Upload and manage architect appointment letter', 'appointment_letter', 'Architect', 'architect',
   '{}', true, false, 10, 'document'),
  ('appointment_letter_for_licensed_surveyor', 'General', 'Appointment Letter for Licensed Surveyor',
   'Upload and manage licensed surveyor appointment letter', 'appointment_letter', 'Licensed Surveyor', 'ls',
   '{}', true, false, 20, 'document'),
  ('appointment_letter_for_fire_consultant', 'General', 'Appointment Letter for Fire Consultant',
   'Upload and manage fire consultant appointment letter', 'appointment_letter', 'Fire Consultant', 'fire_safety',
   '{}', true, false, 30, 'document'),
  ('appointment_letter_for_mep_consultant', 'General', 'Appointment Letter for MEP Consultant',
   'Upload and manage MEP consultant appointment letter', 'appointment_letter', 'MEP Consultant', 'me_consultant',
   '{}', true, false, 40, 'document'),
  ('appointment_letter_for_plumber', 'General', 'Appointment Letter for Plumber',
   'Upload and manage plumber appointment letter', 'appointment_letter', 'Plumber', 'plumber',
   '{}', true, false, 50, 'document'),
  ('appointment_letter_for_town_planner', 'General', 'Appointment Letter for Town Planner',
   'Upload and manage town planner appointment letter', 'appointment_letter', 'Town Planner', 'town_planner',
   '{}', true, false, 60, 'document'),
  ('appointment_letter_for_structural_engineer', 'General', 'Appointment Letter for Structural Engineer',
   'Upload and manage structural engineer appointment letter', 'appointment_letter', 'Structural Engineer', 'structural_engineer',
   '{}', true, false, 70, 'document'),
  ('appointment_letter_for_environmental_consultant', 'General', 'Appointment Letter for Environmental Consultant',
   'Upload and manage environmental consultant appointment letter', 'appointment_letter', 'Environmental Consultant', 'environmental_consultant',
   '{}', true, false, 80, 'document'),
  ('appointment_letter_for_landscape_consultant', 'General', 'Appointment Letter for Landscape Consultant',
   'Upload and manage landscape consultant appointment letter', 'appointment_letter', 'Landscape Consultant', 'landscape_consultant',
   '{}', true, false, 90, 'document'),
  ('appointment_letter_for_geotechnical_consultant', 'General', 'Appointment Letter for Geotechnical Consultant',
   'Upload and manage geotechnical consultant appointment letter', 'appointment_letter', 'Geotechnical Consultant', 'geotechnical_consultant',
   '{}', true, false, 100, 'document'),
  ('appointment_letter_for_pmc_project_manager', 'General', 'Appointment Letter for PMC / Project Manager',
   'Upload and manage PMC / project manager appointment letter', 'appointment_letter', 'PMC / Project Manager', 'pmc_project_manager',
   '{}', true, false, 110, 'document'),
  -- Other departments
  ('provisional_fire_noc', 'Fire', 'Provisional Fire NOC', 'Post-application and pre-concession',
   'department_permission', NULL, NULL, '{}', false, false, 10, 'warning'),
  ('cfo_refund_process', 'Fire', 'CFO Refund Process', 'Initiate CFO fee refunds',
   'department_permission', NULL, NULL, '{}', false, false, 20, 'flow'),
  ('final_fire_noc', 'Fire', 'Final Fire NOC', 'Final fire approval',
   'department_permission', NULL, NULL, '{}', false, false, 30, 'shield'),
  ('parking_layout_remarks', 'Traffic and Co-ordination', 'Parking Layout Remarks', 'Traffic department remarks',
   'department_permission', NULL, NULL, '{}', false, false, 10, 'road'),
  ('construction_and_demolition_waste_management_remarks', 'Solid Waste Management',
   'C&D Waste Remarks', 'Construction & demolition waste management',
   'department_permission', NULL, NULL, '{}', false, false, 10, 'warning'),
  ('new_assessment_of_plot_of_land', 'Assessment and Collection Dept', 'New Land Assessment', 'Assess plot of land',
   'department_permission', NULL, NULL, '{}', false, false, 10, 'assessment'),
  ('no_dues_certificate_against_sac_numbers', 'Assessment and Collection Dept', 'No Dues Certificate',
   'Certificate against SAC numbers', 'department_permission', NULL, NULL, '{}', false, false, 20, 'document'),
  ('swd_internal_remarks', 'Storm Water Drain (Internal)', 'SWD Internal Remarks', 'Storm water drain review',
   'department_permission', NULL, NULL, '{}', false, false, 10, 'waves'),
  ('tree_cutting_application', 'Garden (Tree)', 'Tree Cutting Application', 'Apply for tree cutting permission',
   'department_permission', NULL, NULL, '{}', false, false, 10, 'tree'),
  ('roads_planning', 'Road Planning', 'Road Planning', 'Road planning remarks',
   'department_permission', NULL, NULL, '{}', false, false, 10, 'road'),
  ('initial_application_mechanical_ventilation_and_air_conditioning', 'Mechanical & Electrical',
   'Mechanical Ventilation & AC', 'Initial application for M&E',
   'department_permission', NULL, NULL, '{}', false, false, 10, 'gear'),
  ('application_for_he_remarks', 'Hydraulic Engineering', 'HE Remarks', 'Hydraulic engineering remarks',
   'department_permission', NULL, NULL, '{}', false, false, 10, 'water'),
  ('hydraulic_engineer', 'Hydraulic Engineering', 'Hydraulic Engineer', 'Hydraulic engineer requests',
   'department_permission', NULL, NULL, '{}', false, false, 20, 'water'),
  ('permanent_water_connection', 'Hydraulic Engineering', 'Permanent Water Connection',
   'Apply for permanent water connection', 'department_permission', NULL, NULL, '{}', false, false, 30, 'water'),
  ('application_for_insecticide_treatment', 'Pest Control', 'Insecticide Treatment', 'Pest control application',
   'department_permission', NULL, NULL, '{}', false, false, 10, 'shield'),
  ('permission_for_digging_of_tube_well_or_bore_well', 'Pest Control', 'Tube/Bore Well Permission',
   'Permission for tube/bore wells', 'department_permission', NULL, NULL, '{}', false, false, 20, 'water'),
  ('sewerage_remarks', 'Sewerage', 'Sewerage Remarks', 'Drainage & sewerage review',
   'department_permission', NULL, NULL, '{}', false, false, 10, 'water'),
  ('highrise_initial_application', 'High Rise Building Commitee', 'High-rise Application',
   'High-rise initial application', 'department_permission', NULL, NULL, '{}', false, false, 10, 'building'),
  ('mhcc_noc', 'Mumbai Heritage Conservation Committee', 'MHCC NOC', 'Heritage committee approval',
   'department_permission', NULL, NULL, '{}', false, false, 10, 'document'),
  ('survey', 'Development Plan', 'Survey', 'Development plan survey',
   'department_permission', NULL, NULL, '{}', false, false, 10, 'document'),
  ('electricity', 'Electricity', 'Electricity', 'Electricity department requests',
   'department_permission', NULL, NULL, '{}', false, false, 10, 'network'),
  ('tdr_utilization', 'DP(TDR)', 'TDR Utilization', 'Utilize development rights',
   'department_permission', NULL, NULL, '{}', false, false, 10, 'document'),
  ('tdr_stage_1', 'DP(TDR)', 'TDR Stage I', 'TDR Stage I (Letter of Intent)',
   'department_permission', NULL, NULL, ARRAY['bmc'], false, false, 20, 'document'),
  ('tdr_stage_2', 'DP(TDR)', 'TDR Stage II', 'TDR Stage II (Possession)',
   'department_permission', NULL, NULL, ARRAY['bmc'], false, false, 30, 'document'),
  ('tdr_stage_3', 'DP(TDR)', 'TDR Stage III', 'TDR Stage III (DRC)',
   'department_permission', NULL, NULL, ARRAY['bmc'], false, false, 40, 'document'),
  ('tdr_transfer', 'DP(TDR)', 'TDR Transfer', 'Transfer of DRC',
   'department_permission', NULL, NULL, ARRAY['bmc'], false, false, 50, 'document'),
  ('aai_noc_for_height_clearance', 'Airport Authority of India', 'AAI NOC',
   'Airport Authority height clearance', 'department_permission', NULL, NULL, '{}', false, false, 10, 'plane');

-- ---------------------------------------------------------------------------
-- Documents (appointment + acceptance HTML; IOD/CC nested forms)
-- ---------------------------------------------------------------------------
INSERT INTO public.application_documents
  (id, application_type_id, category, html, sign, letter_variant, sort_order)
VALUES
  ('architect_appointment', 'appointment_letter_for_architect', 'Appointment',
   'architect.html', ARRAY['owner', 'consultant'], 'appointment', 10),
  ('architect_acceptance', 'appointment_letter_for_architect', 'Acceptance',
   'architect_acceptance.html', ARRAY['consultant'], 'acceptance', 20),
  ('licensed_surveyor_appointment', 'appointment_letter_for_licensed_surveyor', 'Appointment',
   'licensed-surveyor.html', ARRAY['owner', 'consultant'], 'appointment', 10),
  ('licensed_surveyor_acceptance', 'appointment_letter_for_licensed_surveyor', 'Acceptance',
   'licensed-surveyor_acceptance.html', ARRAY['consultant'], 'acceptance', 20),
  ('fire_consultant_appointment', 'appointment_letter_for_fire_consultant', 'Appointment',
   'fire-safety-consultant.html', ARRAY['owner'], 'appointment', 10),
  ('fire_consultant_acceptance', 'appointment_letter_for_fire_consultant', 'Acceptance',
   'fire-safety-consultant_acceptance.html', ARRAY['consultant'], 'acceptance', 20),
  ('mep_consultant_appointment', 'appointment_letter_for_mep_consultant', 'Appointment',
   'me-consultant.html', ARRAY['owner'], 'appointment', 10),
  ('mep_consultant_acceptance', 'appointment_letter_for_mep_consultant', 'Acceptance',
   'me-consultant_acceptance.html', ARRAY['consultant'], 'acceptance', 20),
  ('plumber_appointment', 'appointment_letter_for_plumber', 'Appointment',
   'plumber.html', ARRAY['owner'], 'appointment', 10),
  ('plumber_acceptance', 'appointment_letter_for_plumber', 'Acceptance',
   'plumber_acceptance.html', ARRAY['consultant'], 'acceptance', 20),
  ('town_planner_appointment', 'appointment_letter_for_town_planner', 'Appointment',
   'town-planner.html', ARRAY['owner'], 'appointment', 10),
  ('town_planner_acceptance', 'appointment_letter_for_town_planner', 'Acceptance',
   'town-planner_acceptance.html', ARRAY['consultant'], 'acceptance', 20),
  ('structural_engineer_appointment', 'appointment_letter_for_structural_engineer', 'Appointment',
   'structural-engineer.html', ARRAY['owner'], 'appointment', 10),
  ('structural_engineer_acceptance', 'appointment_letter_for_structural_engineer', 'Acceptance',
   'structural-engineer_acceptance.html', ARRAY['consultant'], 'acceptance', 20),
  ('environmental_consultant_appointment', 'appointment_letter_for_environmental_consultant', 'Appointment',
   'environmental-consultant.html', ARRAY['owner'], 'appointment', 10),
  ('environmental_consultant_acceptance', 'appointment_letter_for_environmental_consultant', 'Acceptance',
   'environmental-consultant_acceptance.html', ARRAY['consultant'], 'acceptance', 20),
  ('landscape_consultant_appointment', 'appointment_letter_for_landscape_consultant', 'Appointment',
   'landscape-consultant.html', ARRAY['owner'], 'appointment', 10),
  ('landscape_consultant_acceptance', 'appointment_letter_for_landscape_consultant', 'Acceptance',
   'landscape-consultant_acceptance.html', ARRAY['consultant'], 'acceptance', 20),
  ('geotechnical_consultant_appointment', 'appointment_letter_for_geotechnical_consultant', 'Appointment',
   'geotechnical-consultant.html', ARRAY['owner'], 'appointment', 10),
  ('geotechnical_consultant_acceptance', 'appointment_letter_for_geotechnical_consultant', 'Acceptance',
   'geotechnical-consultant_acceptance.html', ARRAY['consultant'], 'acceptance', 20),
  ('pmc_project_manager_appointment', 'appointment_letter_for_pmc_project_manager', 'Appointment',
   'pmc-project-manager.html', ARRAY['owner'], 'appointment', 10),
  ('pmc_project_manager_acceptance', 'appointment_letter_for_pmc_project_manager', 'Acceptance',
   'pmc-project-manager_acceptance.html', ARRAY['consultant'], 'acceptance', 20),
  ('iod_cc_pending_architect', 'iod',
   'Application for IOD/CC pending concession by Architect/LS',
   NULL, ARRAY['architect_or_ls'], NULL, 10),
  ('iod_cc_pending_owner_undertaking', 'iod',
   'Registered Undertaking by Owner for starting work prior to obtaining',
   NULL, ARRAY['owner'], NULL, 20),
  ('iod_cc_pending_provisional_report', 'iod',
   'Report for provisional IOD/CC',
   NULL, ARRAY['architect_or_ls'], NULL, 30),
  ('iod_cc_pending_upto_plinth', 'iod',
   'IOD upto plinth pending Concessions approval',
   NULL, ARRAY['architect_or_ls'], NULL, 40);

-- Shared type-level placeholders for every appointment letter
INSERT INTO public.application_type_placeholders (application_type_id, placeholder_id, sort_order)
SELECT t.id, p.id, p.sort
FROM public.application_types t
CROSS JOIN (
  VALUES
    ('letter_date', 10),
    ('appointment_role', 20),
    ('survey_nos', 30),
    ('village', 40),
    ('street', 50),
    ('ward', 60),
    ('planning_authority', 70),
    ('proposal_number', 80),
    ('project_title', 90),
    ('type_of_development', 100),
    ('plot_area', 110),
    ('building_height', 120),
    ('building_type', 130),
    ('property_address', 140),
    ('client_company', 150),
    ('client_name', 160),
    ('client_addr1', 170),
    ('consultant_name', 180),
    ('consultant_firm', 190),
    ('consultant_addr1', 200),
    ('reg_no', 210),
    ('validity', 220)
) AS p(id, sort)
WHERE t.category = 'appointment_letter';

-- Building Permission types share project key-variable placeholders
INSERT INTO public.application_type_placeholders (application_type_id, placeholder_id, sort_order)
SELECT t.id, p.id, p.sort
FROM public.application_types t
CROSS JOIN (
  VALUES
    ('project_title', 10),
    ('proposal_number', 20),
    ('plot_area', 30),
    ('building_height', 40),
    ('planning_authority', 50),
    ('type_of_development', 60),
    ('ward', 70),
    ('building_type', 80),
    ('property_address', 90),
    ('survey_nos', 100)
) AS p(id, sort)
WHERE t.category = 'department_permission';

INSERT INTO public.application_document_placeholders (document_id, placeholder_id, sort_order)
VALUES ('architect_acceptance', 'eebp_pincode', 10);

-- ---------------------------------------------------------------------------
-- Create RPC: reject unknown / inactive catalog titles
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_application_for_owner(
  p_owner_id uuid,
  p_project_id text,
  p_project_title text,
  p_department text,
  p_permission_type text,
  p_workflow_stage text DEFAULT 'draft'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
  v_stage text;
  v_catalog public.application_types%ROWTYPE;
BEGIN
  IF NOT public.user_can_manage_project(p_project_id, p_owner_id) THEN
    RAISE EXCEPTION 'You do not have permission to create an application for this project.'
      USING ERRCODE = '42501';
  END IF;

  SELECT *
  INTO v_catalog
  FROM public.application_types t
  WHERE t.is_active
    AND lower(trim(t.application_title)) = lower(trim(p_permission_type))
    AND lower(trim(t.department)) = lower(trim(p_department))
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Unknown or inactive application type for this department.'
      USING ERRCODE = '22023';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.applications a
    WHERE a.project_id::text = p_project_id
      AND lower(trim(a.department)) = lower(trim(p_department))
      AND lower(trim(a.permission_type)) = lower(trim(p_permission_type))
  ) THEN
    RAISE EXCEPTION 'This permission type is already added for the selected project.'
      USING ERRCODE = '23505';
  END IF;

  v_stage := COALESCE(NULLIF(trim(p_workflow_stage), ''), 'draft');

  INSERT INTO public.applications (
    project_id,
    project_title,
    department,
    permission_type,
    workflow_stage
  )
  VALUES (
    p_project_id,
    p_project_title,
    p_department,
    v_catalog.application_title,
    v_stage
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_application_for_owner(
  uuid, text, text, text, text, text
) TO authenticated;

COMMENT ON FUNCTION public.create_application_for_owner(uuid, text, text, text, text, text) IS
  'Insert a draft application on a manageable project; catalog title must be active; duplicate permission type blocked.';

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
ALTER TABLE public.application_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.application_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.placeholders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.application_type_placeholders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.application_document_placeholders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS application_types_select ON public.application_types;
CREATE POLICY application_types_select ON public.application_types
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS application_documents_select ON public.application_documents;
CREATE POLICY application_documents_select ON public.application_documents
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS placeholders_select ON public.placeholders;
CREATE POLICY placeholders_select ON public.placeholders
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS application_type_placeholders_select ON public.application_type_placeholders;
CREATE POLICY application_type_placeholders_select ON public.application_type_placeholders
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS application_document_placeholders_select ON public.application_document_placeholders;
CREATE POLICY application_document_placeholders_select ON public.application_document_placeholders
  FOR SELECT TO authenticated USING (true);

GRANT SELECT ON public.application_types TO authenticated;
GRANT SELECT ON public.application_documents TO authenticated;
GRANT SELECT ON public.placeholders TO authenticated;
GRANT SELECT ON public.application_type_placeholders TO authenticated;
GRANT SELECT ON public.application_document_placeholders TO authenticated;
GRANT SELECT ON public.application_catalog_sheet TO authenticated;
