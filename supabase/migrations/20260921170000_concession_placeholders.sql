-- Placeholders from Building Permission Concession HTML
-- (proposal-full-potential, list-indicative-concessions, data-sheet-scrutiny-concession,
--  fact-sheet, scrutiny-sheet-iod-cc, report-various-concession-sought).
-- Reuse existing master rows for {{WARD}} and {{VILLAGE}}. Do not insert VARIABLE_TAGS.

-- ---------------------------------------------------------------------------
-- Master placeholders (new tokens only)
-- ---------------------------------------------------------------------------
INSERT INTO public.placeholders
  (id, token, legacy_token, label, source_table, source_column, ui_group)
VALUES
  -- Proposal by Architect for full potential
  ('date', '{{DATE}}', NULL, 'Date', 'computed', 'current_date', 'other'),
  ('marg', '{{MARG}}', NULL, 'Marg', 'computed', NULL, 'office'),
  ('west_east', '{{WEST_EAST}}', NULL, 'West / East', 'projects', 'save_plot_details->>region', 'subject'),
  ('pin_suffix', '{{PIN_SUFFIX}}', NULL, 'Pincode (suffix)', 'projects', 'project_info->>pincode', 'office'),
  ('cts_no', '{{CTS_NO}}', NULL, 'CTS number', 'projects', 'save_plot_details->>proposedCtsNumber', 'subject'),
  ('road', '{{ROAD}}', NULL, 'Road', 'projects', 'save_plot_details->>roadName', 'subject'),
  ('pin_code_suffix', '{{PIN_CODE_SUFFIX}}', NULL, 'Pincode', 'projects', 'project_info->>pincode', 'subject'),
  ('dcr_regulation_no', '{{DCR_REGULATION_NO}}', NULL, 'DCR regulation number', 'projects', 'project_info->>proposalAsPer', 'reference'),
  ('m_s_name', '{{M_S_NAME}}', NULL, 'M/s. name', 'applicants', 'entity_name', 'consultant'),
  ('layout_file_no', '{{LAYOUT_FILE_NO}}', NULL, 'Layout / file number', 'projects', 'project_info->>earlierBuildingProposalFileNo', 'reference'),
  ('building_configuration', '{{BUILDING_CONFIGURATION}}', NULL, 'Building configuration', 'computed', NULL, 'other'),

  -- Fact sheet header
  ('case_no', '{{CASE_NO}}', NULL, 'Case number', 'projects', 'project_info->>proposalNo', 'reference'),
  ('building_no', '{{BUILDING_NO}}', NULL, 'Building number', 'computed', NULL, 'other'),
  ('cts_cs_no', '{{CTS_CS_NO}}', NULL, 'CTS / CS number', 'projects', 'save_plot_details->>proposedCtsNumber', 'subject'),
  ('fp_no', '{{FP_NO}}', NULL, 'F.P. number', 'projects', 'save_plot_details->>plotNo', 'subject'),
  ('tps_no', '{{TPS_NO}}', NULL, 'T.P.S. number', 'computed', NULL, 'subject'),
  ('village_division', '{{VILLAGE_DIVISION}}', NULL, 'Village / division', 'projects', 'save_plot_details->>villageName', 'subject'),
  ('date_of_submission', '{{DATE_OF_SUBMISSION}}', NULL, 'Date of submission', 'computed', 'current_date', 'other'),
  ('brief_description', '{{BRIEF_DESCRIPTION}}', NULL, 'Brief description', 'projects', 'title', 'other'),
  ('licensed_surveyor_architect', '{{LICENSED_SURVEYOR_ARCHITECT}}', NULL, 'Licensed surveyor / architect', 'applicants', 'name', 'consultant'),
  ('owner_developer', '{{OWNER_DEVELOPER}}', NULL, 'Owner / developer', 'owner_applicant', 'name', 'client'),
  ('structural_engineer', '{{STRUCTURAL_ENGINEER}}', NULL, 'Structural engineer', 'computed', NULL, 'consultant'),
  ('site_supervisor', '{{SITE_SUPERVISOR}}', NULL, 'Site supervisor', 'computed', NULL, 'consultant'),
  ('licensed_plumber', '{{LICENSED_PLUMBER}}', NULL, 'Licensed plumber', 'computed', NULL, 'consultant'),
  ('ph_consultant', '{{PH_CONSULTANT}}', NULL, 'P.H. consultant', 'computed', NULL, 'consultant'),
  ('me_consultant', '{{ME_CONSULTANT}}', NULL, 'M.E. consultant', 'computed', NULL, 'consultant'),
  ('road_construction_consultant', '{{ROAD_CONSTRUCTION_CONSULTANT}}', NULL, 'Road construction consultant', 'computed', NULL, 'consultant'),
  ('fire_safety_consultant', '{{FIRE_SAFETY_CONSULTANT}}', NULL, 'Fire safety consultant', 'computed', NULL, 'consultant'),
  ('traffic_parking_consultant', '{{TRAFFIC_PARKING_CONSULTANT}}', NULL, 'Traffic / parking consultant', 'computed', NULL, 'consultant'),
  ('horticulturist', '{{HORTICULTURIST}}', NULL, 'Horticulturist', 'computed', NULL, 'consultant'),
  ('any_other_consultant', '{{ANY_OTHER_CONSULTANT}}', NULL, 'Any other consultant', 'computed', NULL, 'consultant'),

  -- Fact sheet page refs / remarks
  ('plans_for_approval_page', '{{PLANS_FOR_APPROVAL_PAGE}}', NULL, 'Plans for approval (page)', 'computed', NULL, 'other'),
  ('notice_pg', '{{NOTICE_PG}}', NULL, 'Notice (page)', 'computed', NULL, 'other'),
  ('scrutiny_fees_rs', '{{SCRUTINY_FEES_RS}}', NULL, 'Scrutiny fees (Rs.)', 'computed', NULL, 'other'),
  ('cc_application_pg', '{{CC_APPLICATION_PG}}', NULL, 'CC application (page)', 'computed', NULL, 'other'),
  ('title_cert_pg', '{{TITLE_CERT_PG}}', NULL, 'Title certificate (page)', 'computed', NULL, 'other'),
  ('pr_card_pg', '{{PR_CARD_PG}}', NULL, 'P.R. card (page)', 'computed', NULL, 'other'),
  ('other_doc_pg', '{{OTHER_DOC_PG}}', NULL, 'Other documents (page)', 'computed', NULL, 'other'),
  ('poa_pg', '{{POA_PG}}', NULL, 'Power of attorney (page)', 'computed', NULL, 'other'),
  ('estate_tp_pg', '{{ESTATE_TP_PG}}', NULL, 'Estate / T.P. (page)', 'computed', NULL, 'other'),
  ('notice_name_pg', '{{NOTICE_NAME_PG}}', NULL, 'Notice name (page)', 'computed', NULL, 'other'),
  ('ownership_remark', '{{OWNERSHIP_REMARK}}', NULL, 'Ownership remark', 'computed', NULL, 'other'),
  ('plot_area_sqm', '{{PLOT_AREA_SQM}}', NULL, 'Plot area (sq.m)', 'projects', 'save_plot_details->>grossPlotArea', 'other'),
  ('plot_area_pg', '{{PLOT_AREA_PG}}', NULL, 'Plot area (page)', 'computed', NULL, 'other'),
  ('plot_area_remarks', '{{PLOT_AREA_REMARKS}}', NULL, 'Plot area remarks', 'computed', NULL, 'other'),
  ('layout_remark', '{{LAYOUT_REMARK}}', NULL, 'Layout remark', 'computed', NULL, 'other'),
  ('cts_plan_pg', '{{CTS_PLAN_PG}}', NULL, 'CTS plan (page)', 'computed', NULL, 'other'),
  ('assessment_bill_pg', '{{ASSESSMENT_BILL_PG}}', NULL, 'Assessment bill (page)', 'computed', NULL, 'other'),
  ('existing_approved_plan_pg', '{{EXISTING_APPROVED_PLAN_PG}}', NULL, 'Existing approved plan (page)', 'computed', NULL, 'other'),
  ('setback_sqm', '{{SETBACK_SQM}}', NULL, 'Setback (sq.m)', 'computed', NULL, 'other'),
  ('setback_pg', '{{SETBACK_PG}}', NULL, 'Setback (page)', 'computed', NULL, 'other'),
  ('row_pg_12a', '{{ROW_PG_12A}}', NULL, 'R.O.W. page 12A', 'computed', NULL, 'other'),
  ('row_pg_12b', '{{ROW_PG_12B}}', NULL, 'R.O.W. page 12B', 'computed', NULL, 'other'),
  ('row_pg_12c', '{{ROW_PG_12C}}', NULL, 'R.O.W. page 12C', 'computed', NULL, 'other'),
  ('row_pg_12d', '{{ROW_PG_12D}}', NULL, 'R.O.W. page 12D', 'computed', NULL, 'other'),
  ('remarks_from_details', '{{REMARKS_FROM_DETAILS}}', NULL, 'Remarks from details', 'computed', NULL, 'other'),
  ('self_certification_remarks', '{{SELF_CERTIFICATION_REMARKS}}', NULL, 'Self certification remarks', 'computed', NULL, 'other'),
  ('consultant_remarks', '{{CONSULTANT_REMARKS}}', NULL, 'Consultant remarks', 'computed', NULL, 'other'),
  ('reservation_1967', '{{RESERVATION_1967}}', NULL, 'Reservation 1967', 'computed', NULL, 'other'),
  ('reservation_1991', '{{RESERVATION_1991}}', NULL, 'Reservation 1991', 'computed', NULL, 'other'),
  ('reservation_2034', '{{RESERVATION_2034}}', NULL, 'Reservation 2034', 'computed', NULL, 'other'),
  ('zone_1967', '{{ZONE_1967}}', NULL, 'Zone 1967', 'computed', NULL, 'other'),
  ('zone_1991', '{{ZONE_1991}}', NULL, 'Zone 1991', 'computed', NULL, 'other'),
  ('zone_2034', '{{ZONE_2034}}', NULL, 'Zone 2034', 'projects', 'save_plot_details->>dpZone', 'other'),
  ('specific_1967', '{{SPECIFIC_1967}}', NULL, 'Specific 1967', 'computed', NULL, 'other'),
  ('specific_1991', '{{SPECIFIC_1991}}', NULL, 'Specific 1991', 'computed', NULL, 'other'),
  ('specific_2034', '{{SPECIFIC_2034}}', NULL, 'Specific 2034', 'computed', NULL, 'other'),
  ('user_dcr_no', '{{USER_DCR_NO}}', NULL, 'User DCR number', 'computed', NULL, 'reference'),
  ('fsi_plot_potential', '{{FSI_PLOT_POTENTIAL}}', NULL, 'FSI — plot potential', 'computed', NULL, 'other'),
  ('fsi_033', '{{FSI_033}}', NULL, 'FSI — 0.33', 'computed', NULL, 'other'),
  ('fsi_tdr', '{{FSI_TDR}}', NULL, 'FSI — TDR', 'computed', NULL, 'other'),
  ('fsi_fungible', '{{FSI_FUNGIBLE}}', NULL, 'FSI — fungible', 'computed', NULL, 'other'),
  ('fsi_additional', '{{FSI_ADDITIONAL}}', NULL, 'FSI — additional', 'computed', NULL, 'other'),
  ('fsi_total', '{{FSI_TOTAL}}', NULL, 'FSI — total', 'projects', 'building_details->>fsiBuiltUpArea', 'other'),
  ('description_of_building', '{{DESCRIPTION_OF_BUILDING}}', NULL, 'Description of building', 'projects', 'building_details->>buildingType', 'other'),
  ('tenement_below_35', '{{TENEMENT_BELOW_35}}', NULL, 'Tenements below 35 sq.m', 'computed', NULL, 'other'),
  ('tenement_35_45', '{{TENEMENT_35_45}}', NULL, 'Tenements 35–45 sq.m', 'computed', NULL, 'other'),
  ('tenement_45_70', '{{TENEMENT_45_70}}', NULL, 'Tenements 45–70 sq.m', 'computed', NULL, 'other'),
  ('tenement_above_70', '{{TENEMENT_ABOVE_70}}', NULL, 'Tenements above 70 sq.m', 'computed', NULL, 'other'),
  ('tenement_total', '{{TENEMENT_TOTAL}}', NULL, 'Tenements total', 'computed', NULL, 'other'),
  ('parking_carpet_area', '{{PARKING_CARPET_AREA}}', NULL, 'Parking — carpet area', 'computed', NULL, 'other'),
  ('parking_no_flats', '{{PARKING_NO_FLATS}}', NULL, 'Parking — no. of flats', 'computed', NULL, 'other'),
  ('parking_by_rule', '{{PARKING_BY_RULE}}', NULL, 'Parking — by rule', 'computed', NULL, 'other'),
  ('parking_provided', '{{PARKING_PROVIDED}}', NULL, 'Parking — provided', 'computed', NULL, 'other'),
  ('parking_total_residential', '{{PARKING_TOTAL_RESIDENTIAL}}', NULL, 'Parking — total residential', 'computed', NULL, 'other'),
  ('parking_non_residential', '{{PARKING_NON_RESIDENTIAL}}', NULL, 'Parking — non residential', 'computed', NULL, 'other'),
  ('parking_transport_vehicles', '{{PARKING_TRANSPORT_VEHICLES}}', NULL, 'Parking — transport vehicles', 'computed', NULL, 'other'),
  ('parking_total', '{{PARKING_TOTAL}}', NULL, 'Parking — total', 'computed', NULL, 'other'),
  ('architect_ls_name', '{{ARCHITECT_LS_NAME}}', NULL, 'Architect / L.S. name', 'applicants', 'name', 'consultant'),
  ('architect_ls_signature', '{{ARCHITECT_LS_SIGNATURE}}', NULL, 'Architect / L.S. signature', 'computed', NULL, 'consultant'),

  -- Data sheet & site inspection
  ('site_visit_date', '{{SITE_VISIT_DATE}}', NULL, 'Site visit date', 'computed', NULL, 'other'),
  ('no_of_structures', '{{NO_OF_STRUCTURES}}', NULL, 'Number of structures', 'computed', NULL, 'other'),
  ('encroachment_side', '{{ENCROACHMENT_SIDE}}', NULL, 'Encroachment side', 'computed', NULL, 'other'),
  ('access_width_mtrs', '{{ACCESS_WIDTH_MTRS}}', NULL, 'Access width (m)', 'computed', NULL, 'other'),
  ('site_inspection_remark', '{{SITE_INSPECTION_REMARK}}', NULL, 'Site inspection remark', 'computed', NULL, 'office'),

  -- Report on various concessions
  ('open_space_sr_no', '{{OPEN_SPACE_SR_NO}}', NULL, 'Open space — Sr. No.', 'computed', NULL, 'other'),
  ('open_space_justification', '{{OPEN_SPACE_JUSTIFICATION}}', NULL, 'Open space — justification', 'computed', NULL, 'other'),
  ('open_space_dcr', '{{OPEN_SPACE_DCR}}', NULL, 'Open space — DCR', 'computed', NULL, 'reference'),
  ('open_space_approval_authority', '{{OPEN_SPACE_APPROVAL_AUTHORITY}}', NULL, 'Open space — approval authority', 'computed', NULL, 'office'),
  ('open_space_comments_ae', '{{OPEN_SPACE_COMMENTS_AE}}', NULL, 'Open space — comments AE', 'computed', NULL, 'office'),
  ('open_space_comments_ee', '{{OPEN_SPACE_COMMENTS_EE}}', NULL, 'Open space — comments EE', 'computed', NULL, 'office'),
  ('open_space_recommendation', '{{OPEN_SPACE_RECOMMENDATION}}', NULL, 'Open space — recommendation', 'computed', NULL, 'office'),
  ('parking_justification', '{{PARKING_JUSTIFICATION}}', NULL, 'Parking — justification', 'computed', NULL, 'other'),
  ('parking_dcr', '{{PARKING_DCR}}', NULL, 'Parking — DCR', 'computed', NULL, 'reference'),
  ('parking_approval_authority', '{{PARKING_APPROVAL_AUTHORITY}}', NULL, 'Parking — approval authority', 'computed', NULL, 'office'),
  ('parking_comments_ae', '{{PARKING_COMMENTS_AE}}', NULL, 'Parking — comments AE', 'computed', NULL, 'office'),
  ('parking_comments_ee', '{{PARKING_COMMENTS_EE}}', NULL, 'Parking — comments EE', 'computed', NULL, 'office'),
  ('staircase_justification', '{{STAIRCASE_JUSTIFICATION}}', NULL, 'Staircase — justification', 'computed', NULL, 'other'),
  ('staircase_dcr', '{{STAIRCASE_DCR}}', NULL, 'Staircase — DCR', 'computed', NULL, 'reference'),
  ('staircase_approval_authority', '{{STAIRCASE_APPROVAL_AUTHORITY}}', NULL, 'Staircase — approval authority', 'computed', NULL, 'office'),
  ('staircase_comments_ae', '{{STAIRCASE_COMMENTS_AE}}', NULL, 'Staircase — comments AE', 'computed', NULL, 'office'),
  ('staircase_comments_ee', '{{STAIRCASE_COMMENTS_EE}}', NULL, 'Staircase — comments EE', 'computed', NULL, 'office'),
  ('others_justification', '{{OTHERS_JUSTIFICATION}}', NULL, 'Others — justification', 'computed', NULL, 'other'),
  ('others_dcr', '{{OTHERS_DCR}}', NULL, 'Others — DCR', 'computed', NULL, 'reference'),
  ('others_approval_authority', '{{OTHERS_APPROVAL_AUTHORITY}}', NULL, 'Others — approval authority', 'computed', NULL, 'office'),
  ('others_comments_ae', '{{OTHERS_COMMENTS_AE}}', NULL, 'Others — comments AE', 'computed', NULL, 'office'),
  ('others_comments_ee', '{{OTHERS_COMMENTS_EE}}', NULL, 'Others — comments EE', 'computed', NULL, 'office'),
  ('comments_dy_chief_engineer', '{{COMMENTS_DY_CHIEF_ENGINEER}}', NULL, 'Comments — Dy. Chief Engineer', 'computed', NULL, 'office'),
  ('approved_dy_chief_engineer', '{{APPROVED_DY_CHIEF_ENGINEER}}', NULL, 'Approved — Dy. Chief Engineer', 'computed', NULL, 'office'),
  ('recommended_dy_chief_engineer_to_che_dp', '{{RECOMMENDED_DY_CHIEF_ENGINEER_TO_CHE_DP}}', NULL, 'Recommended by Dy. Ch.E. to Ch.E.(DP)', 'computed', NULL, 'office'),
  ('comments_chief_engineer', '{{COMMENTS_CHIEF_ENGINEER}}', NULL, 'Comments — Chief Engineer', 'computed', NULL, 'office'),
  ('approved_chief_engineer_dp', '{{APPROVED_CHIEF_ENGINEER_DP}}', NULL, 'Approved — Chief Engineer (DP)', 'computed', NULL, 'office'),
  ('mc_recommendation_1', '{{MC_RECOMMENDATION_1}}', NULL, 'M.C. recommendation 1', 'computed', NULL, 'office'),
  ('mc_recommendation_2', '{{MC_RECOMMENDATION_2}}', NULL, 'M.C. recommendation 2', 'computed', NULL, 'office'),
  ('mc_recommendation_3', '{{MC_RECOMMENDATION_3}}', NULL, 'M.C. recommendation 3', 'computed', NULL, 'office'),
  ('mc_recommendation_4', '{{MC_RECOMMENDATION_4}}', NULL, 'M.C. recommendation 4', 'computed', NULL, 'office')
ON CONFLICT (id) DO UPDATE SET
  token = EXCLUDED.token,
  label = EXCLUDED.label,
  source_table = EXCLUDED.source_table,
  source_column = EXCLUDED.source_column,
  ui_group = EXCLUDED.ui_group,
  is_active = true,
  updated_at = now();

INSERT INTO public.placeholders
  (id, token, legacy_token, label, source_table, source_column, ui_group)
SELECT
  format('office_remark_%s', lpad(n::text, 2, '0')),
  format('{{OFFICE_REMARK_%s}}', lpad(n::text, 2, '0')),
  NULL,
  format('Office remark %s', lpad(n::text, 2, '0')),
  'computed',
  NULL,
  'office'
FROM generate_series(1, 22) AS t(n)
ON CONFLICT (id) DO UPDATE SET
  token = EXCLUDED.token,
  label = EXCLUDED.label,
  source_table = EXCLUDED.source_table,
  ui_group = EXCLUDED.ui_group,
  is_active = true,
  updated_at = now();

INSERT INTO public.placeholders
  (id, token, legacy_token, label, source_table, source_column, ui_group)
SELECT
  format('fact_remark_%s', lpad(n::text, 2, '0')),
  format('{{FACT_REMARK_%s}}', lpad(n::text, 2, '0')),
  NULL,
  format('Fact remark %s', lpad(n::text, 2, '0')),
  'computed',
  NULL,
  'other'
FROM unnest(ARRAY[6, 8, 9, 10, 12, 16, 17, 18, 19, 21, 22]) AS t(n)
ON CONFLICT (id) DO UPDATE SET
  token = EXCLUDED.token,
  label = EXCLUDED.label,
  source_table = EXCLUDED.source_table,
  ui_group = EXCLUDED.ui_group,
  is_active = true,
  updated_at = now();

INSERT INTO public.placeholders
  (id, token, legacy_token, label, source_table, source_column, ui_group)
SELECT
  format('scr_%s_%s', lpad(n::text, 2, '0'), suffix),
  format('{{SCR_%s_%s}}', lpad(n::text, 2, '0'), upper(suffix)),
  NULL,
  format('Scrutiny %s — %s', lpad(n::text, 2, '0'), suffix_label),
  'computed',
  NULL,
  'other'
FROM generate_series(1, 21) AS t(n)
CROSS JOIN (
  VALUES
    ('reqd', 'required'),
    ('proposed', 'proposed'),
    ('deficiency', 'deficiency'),
    ('se_remark', 'SE remark')
) AS s(suffix, suffix_label)
ON CONFLICT (id) DO UPDATE SET
  token = EXCLUDED.token,
  label = EXCLUDED.label,
  source_table = EXCLUDED.source_table,
  ui_group = EXCLUDED.ui_group,
  is_active = true,
  updated_at = now();

-- ---------------------------------------------------------------------------
-- Type-level: letter header / key variables shared across Concession HTML
-- ---------------------------------------------------------------------------
INSERT INTO public.application_type_placeholders
  (application_type_id, placeholder_id, required, sort_order)
VALUES
  ('concession', 'date', true, 110),
  ('concession', 'village', true, 120),
  ('concession', 'cts_no', true, 130),
  ('concession', 'road', true, 140),
  ('concession', 'pin_code_suffix', true, 150),
  ('concession', 'dcr_regulation_no', true, 160),
  ('concession', 'm_s_name', true, 170),
  ('concession', 'layout_file_no', true, 180),
  ('concession', 'building_configuration', false, 190),
  ('concession', 'case_no', true, 200),
  ('concession', 'building_no', false, 210),
  ('concession', 'cts_cs_no', true, 220),
  ('concession', 'fp_no', false, 230),
  ('concession', 'tps_no', false, 240),
  ('concession', 'village_division', true, 250),
  ('concession', 'date_of_submission', true, 260),
  ('concession', 'brief_description', true, 270),
  ('concession', 'licensed_surveyor_architect', true, 280),
  ('concession', 'owner_developer', true, 290),
  ('concession', 'architect_ls_name', true, 300),
  ('concession', 'plot_area_sqm', true, 310)
ON CONFLICT (application_type_id, placeholder_id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Document-level: tokens unique to each Concession HTML
-- ---------------------------------------------------------------------------
INSERT INTO public.application_document_placeholders
  (document_id, placeholder_id, required, sort_order)
VALUES
  -- proposal-full-potential.html
  ('proposal_full_potential', 'marg', false, 10),
  ('proposal_full_potential', 'west_east', false, 20),
  ('proposal_full_potential', 'pin_suffix', false, 30),
  ('proposal_full_potential', 'architect_ls_signature', false, 40),

  -- fact-sheet.html (consultants + description)
  ('fact_sheet', 'structural_engineer', false, 10),
  ('fact_sheet', 'site_supervisor', false, 20),
  ('fact_sheet', 'licensed_plumber', false, 30),
  ('fact_sheet', 'ph_consultant', false, 40),
  ('fact_sheet', 'me_consultant', false, 50),
  ('fact_sheet', 'road_construction_consultant', false, 60),
  ('fact_sheet', 'fire_safety_consultant', false, 70),
  ('fact_sheet', 'traffic_parking_consultant', false, 80),
  ('fact_sheet', 'horticulturist', false, 90),
  ('fact_sheet', 'any_other_consultant', false, 100),
  ('fact_sheet', 'plans_for_approval_page', false, 110),
  ('fact_sheet', 'notice_pg', false, 120),
  ('fact_sheet', 'scrutiny_fees_rs', false, 130),
  ('fact_sheet', 'cc_application_pg', false, 140),
  ('fact_sheet', 'title_cert_pg', false, 150),
  ('fact_sheet', 'pr_card_pg', false, 160),
  ('fact_sheet', 'other_doc_pg', false, 170),
  ('fact_sheet', 'poa_pg', false, 180),
  ('fact_sheet', 'estate_tp_pg', false, 190),
  ('fact_sheet', 'notice_name_pg', false, 200),
  ('fact_sheet', 'ownership_remark', false, 210),
  ('fact_sheet', 'plot_area_pg', false, 220),
  ('fact_sheet', 'plot_area_remarks', false, 230),
  ('fact_sheet', 'layout_remark', false, 240),
  ('fact_sheet', 'cts_plan_pg', false, 250),
  ('fact_sheet', 'assessment_bill_pg', false, 260),
  ('fact_sheet', 'existing_approved_plan_pg', false, 270),
  ('fact_sheet', 'setback_sqm', false, 280),
  ('fact_sheet', 'setback_pg', false, 290),
  ('fact_sheet', 'row_pg_12a', false, 300),
  ('fact_sheet', 'row_pg_12b', false, 310),
  ('fact_sheet', 'row_pg_12c', false, 320),
  ('fact_sheet', 'row_pg_12d', false, 330),
  ('fact_sheet', 'remarks_from_details', false, 340),
  ('fact_sheet', 'self_certification_remarks', false, 350),
  ('fact_sheet', 'consultant_remarks', false, 360),
  ('fact_sheet', 'reservation_1967', false, 370),
  ('fact_sheet', 'reservation_1991', false, 380),
  ('fact_sheet', 'reservation_2034', false, 390),
  ('fact_sheet', 'zone_1967', false, 400),
  ('fact_sheet', 'zone_1991', false, 410),
  ('fact_sheet', 'zone_2034', false, 420),
  ('fact_sheet', 'specific_1967', false, 430),
  ('fact_sheet', 'specific_1991', false, 440),
  ('fact_sheet', 'specific_2034', false, 450),
  ('fact_sheet', 'user_dcr_no', false, 460),
  ('fact_sheet', 'fsi_plot_potential', false, 470),
  ('fact_sheet', 'fsi_033', false, 480),
  ('fact_sheet', 'fsi_tdr', false, 490),
  ('fact_sheet', 'fsi_fungible', false, 500),
  ('fact_sheet', 'fsi_additional', false, 510),
  ('fact_sheet', 'fsi_total', false, 520),
  ('fact_sheet', 'description_of_building', false, 530),
  ('fact_sheet', 'tenement_below_35', false, 540),
  ('fact_sheet', 'tenement_35_45', false, 550),
  ('fact_sheet', 'tenement_45_70', false, 560),
  ('fact_sheet', 'tenement_above_70', false, 570),
  ('fact_sheet', 'tenement_total', false, 580),
  ('fact_sheet', 'parking_carpet_area', false, 590),
  ('fact_sheet', 'parking_no_flats', false, 600),
  ('fact_sheet', 'parking_by_rule', false, 610),
  ('fact_sheet', 'parking_provided', false, 620),
  ('fact_sheet', 'parking_total_residential', false, 630),
  ('fact_sheet', 'parking_non_residential', false, 640),
  ('fact_sheet', 'parking_transport_vehicles', false, 650),
  ('fact_sheet', 'parking_total', false, 660),

  -- data-sheet-scrutiny-concession.html
  ('data_sheet_scrutiny_concession', 'site_visit_date', false, 10),
  ('data_sheet_scrutiny_concession', 'no_of_structures', false, 20),
  ('data_sheet_scrutiny_concession', 'encroachment_side', false, 30),
  ('data_sheet_scrutiny_concession', 'access_width_mtrs', false, 40),
  ('data_sheet_scrutiny_concession', 'site_inspection_remark', false, 50),
  ('data_sheet_scrutiny_concession', 'architect_ls_signature', false, 60),

  -- report-various-concession-sought.html
  ('report_various_concession_sought', 'open_space_sr_no', false, 10),
  ('report_various_concession_sought', 'open_space_justification', false, 20),
  ('report_various_concession_sought', 'open_space_dcr', false, 30),
  ('report_various_concession_sought', 'open_space_approval_authority', false, 40),
  ('report_various_concession_sought', 'open_space_comments_ae', false, 50),
  ('report_various_concession_sought', 'open_space_comments_ee', false, 60),
  ('report_various_concession_sought', 'open_space_recommendation', false, 70),
  ('report_various_concession_sought', 'parking_justification', false, 80),
  ('report_various_concession_sought', 'parking_dcr', false, 90),
  ('report_various_concession_sought', 'parking_approval_authority', false, 100),
  ('report_various_concession_sought', 'parking_comments_ae', false, 110),
  ('report_various_concession_sought', 'parking_comments_ee', false, 120),
  ('report_various_concession_sought', 'staircase_justification', false, 130),
  ('report_various_concession_sought', 'staircase_dcr', false, 140),
  ('report_various_concession_sought', 'staircase_approval_authority', false, 150),
  ('report_various_concession_sought', 'staircase_comments_ae', false, 160),
  ('report_various_concession_sought', 'staircase_comments_ee', false, 170),
  ('report_various_concession_sought', 'others_justification', false, 180),
  ('report_various_concession_sought', 'others_dcr', false, 190),
  ('report_various_concession_sought', 'others_approval_authority', false, 200),
  ('report_various_concession_sought', 'others_comments_ae', false, 210),
  ('report_various_concession_sought', 'others_comments_ee', false, 220),
  ('report_various_concession_sought', 'comments_dy_chief_engineer', false, 230),
  ('report_various_concession_sought', 'approved_dy_chief_engineer', false, 240),
  ('report_various_concession_sought', 'recommended_dy_chief_engineer_to_che_dp', false, 250),
  ('report_various_concession_sought', 'comments_chief_engineer', false, 260),
  ('report_various_concession_sought', 'approved_chief_engineer_dp', false, 270),
  ('report_various_concession_sought', 'mc_recommendation_1', false, 280),
  ('report_various_concession_sought', 'mc_recommendation_2', false, 290),
  ('report_various_concession_sought', 'mc_recommendation_3', false, 300),
  ('report_various_concession_sought', 'mc_recommendation_4', false, 310)
ON CONFLICT (document_id, placeholder_id) DO NOTHING;

INSERT INTO public.application_document_placeholders
  (document_id, placeholder_id, required, sort_order)
SELECT
  'fact_sheet',
  p.id,
  false,
  700 + ROW_NUMBER() OVER (ORDER BY p.id)
FROM public.placeholders p
WHERE p.id LIKE 'office_remark_%'
   OR p.id LIKE 'fact_remark_%'
ON CONFLICT (document_id, placeholder_id) DO NOTHING;

INSERT INTO public.application_document_placeholders
  (document_id, placeholder_id, required, sort_order)
SELECT
  'scrutiny_sheet_iod_cc',
  p.id,
  false,
  10 * ROW_NUMBER() OVER (ORDER BY p.id)
FROM public.placeholders p
WHERE p.id LIKE 'scr_%'
ON CONFLICT (document_id, placeholder_id) DO NOTHING;
