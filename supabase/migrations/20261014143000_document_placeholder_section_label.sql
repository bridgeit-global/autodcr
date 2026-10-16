-- Document-level letter field headings. Concession letters are filled first.
ALTER TABLE public.application_document_placeholders
  ADD COLUMN IF NOT EXISTS section_label text;


INSERT INTO public.application_document_placeholders
  (document_id, placeholder_id, required, sort_order, section_label)
SELECT d.id, p.id, false, v.sort_order, v.section_label
FROM public.application_documents d
JOIN (
  VALUES
    ('{{DATE}}', 'Date', 10),
    ('{{CTS_NO}}', 'Subject', 20),
    ('{{VILLAGE}}', 'Subject', 30),
    ('{{ROAD}}', 'Subject', 40),
    ('{{PIN_CODE_SUFFIX}}', 'Subject', 50),
    ('{{DCR_REGULATION_NO}}', 'Subject', 60),
    ('{{M_S_NAME}}', 'Subject', 70),
    ('{{LAYOUT_FILE_NO}}', 'Reference', 80),
    ('$project_BuildingProposal_ToHeaderLine1', 'Addressee', 90),
    ('$project_BuildingProposal_ToHeaderLine2', 'Addressee', 100),
    ('$project_Organisation_BuildingProposal', 'Addressee', 110),
    ('$project_addressline1_BuildingProposal', 'Addressee', 120),
    ('$project_addressline2_BuildingProposal', 'Addressee', 130),
    ('$project_addressline3_BuildingProposal', 'Addressee', 140),
    ('{{BUILDING_CONFIGURATION}}', 'Proposal', 150)
) AS v(token, section_label, sort_order) ON true
JOIN public.placeholders p
  ON p.token = v.token
  OR p.legacy_token = v.token
  OR (v.token LIKE '$%' AND p.legacy_token = substring(v.token from 2))
WHERE d.html IN ('concession/proposal-full-potential.html', 'proposal-full-potential.html')
ON CONFLICT (document_id, placeholder_id) DO UPDATE
SET section_label = EXCLUDED.section_label;


INSERT INTO public.application_document_placeholders
  (document_id, placeholder_id, required, sort_order, section_label)
SELECT d.id, p.id, false, v.sort_order, v.section_label
FROM public.application_documents d
JOIN (
  VALUES
    ('{{BUILDING_NO}}', 'Subject', 10),
    ('{{PLOT_CS_CTS_NO}}', 'Subject', 20),
    ('{{TPS_NO}}', 'Subject', 30),
    ('{{VILLAGE_DIVISION}}', 'Subject', 40),
    ('{{DATE_OF_SUBMISSION}}', 'Date of Submission of Proposal', 50),
    ('{{BRIEF_DESCRIPTION}}', 'Brief description of prop. Work', 60),
    ('{{LICENSED_SURVEYOR_ARCHITECT}}', 'Licensed Surveyor / Architect', 70),
    ('{{OWNER_DEVELOPER}}', 'Owner / Developer', 80),
    ('{{STRUCTURAL_ENGINEER}}', 'a. Structural Engineer', 90),
    ('{{SITE_SUPERVISOR}}', 'b. Site Supervisor', 100),
    ('{{LICENSED_PLUMBER}}', 'c. Licensed Plumber', 110),
    ('{{PH_CONSULTANT}}', 'd. PH consultant', 120),
    ('{{ME_CONSULTANT}}', 'e. M&E consultant', 130),
    ('{{ROAD_CONSTRUCTION_CONSULTANT}}', 'f. Road Construction', 140),
    ('{{FIRE_SAFETY_CONSULTANT}}', 'g. Fire safety', 150),
    ('{{TRAFFIC_PARKING_CONSULTANT}}', 'h. Traffic / Parking', 160),
    ('{{HORTICULTURIST}}', 'i. Horticulturist', 170),
    ('{{ANY_OTHER_CONSULTANT}}', 'j. Any Other', 180),
    ('{{WARD}}', 'Other fields', 190),
    ('{{CASE_NO}}', 'Other fields', 200),
    ('{{PLANS_FOR_APPROVAL_PAGE}}', 'Other fields', 210)
) AS v(token, section_label, sort_order) ON true
JOIN public.placeholders p
  ON p.token = v.token
  OR p.legacy_token = v.token
  OR (v.token LIKE '$%' AND p.legacy_token = substring(v.token from 2))
WHERE d.html IN ('concession/data-sheet-scrutiny-concession.html', 'data-sheet-scrutiny-concession.html')
ON CONFLICT (document_id, placeholder_id) DO UPDATE
SET section_label = EXCLUDED.section_label;


INSERT INTO public.application_document_placeholders
  (document_id, placeholder_id, required, sort_order, section_label)
SELECT d.id, p.id, false, v.sort_order, v.section_label
FROM public.application_documents d
JOIN (
  VALUES
    ('{{RESERVATION_1967}}', 'Reservation', 10),
    ('{{RESERVATION_1991}}', 'Reservation', 20),
    ('{{RESERVATION_2034}}', 'Reservation', 30),
    ('{{ZONE_1967}}', 'Zone', 40),
    ('{{ZONE_1991}}', 'Zone', 50),
    ('{{ZONE_2034}}', 'Zone', 60),
    ('{{SPECIFIC_1967}}', 'Specific Remarks', 70),
    ('{{SPECIFIC_1991}}', 'Specific Remarks', 80),
    ('{{SPECIFIC_2034}}', 'Specific Remarks', 90),
    ('{{FSI_PLOT_POTENTIAL}}', 'Other fields', 100),
    ('{{FSI_033}}', 'Other fields', 110),
    ('{{FSI_TDR}}', 'Other fields', 120),
    ('{{FSI_FUNGIBLE}}', 'Other fields', 130),
    ('{{FSI_ADDITIONAL}}', 'Other fields', 140),
    ('{{FSI_TOTAL}}', 'Other fields', 150),
    ('{{TENEMENT_35_45}}', 'Other fields', 160),
    ('{{TENEMENT_45_70}}', 'Other fields', 170),
    ('{{PARKING_CARPET_AREA}}', 'Other fields', 180),
    ('{{PARKING_NO_FLATS}}', 'Other fields', 190),
    ('{{PARKING_BY_RULE}}', 'Other fields', 200),
    ('{{PARKING_PROVIDED}}', 'Other fields', 210),
    ('{{TENEMENT_BELOW_35}}', 'Below 35', 220),
    ('{{TENEMENT_ABOVE_70}}', 'Above 70', 230),
    ('{{TENEMENT_TOTAL}}', 'Total', 240),
    ('{{PARKING_TOTAL_RESIDENTIAL}}', 'Total for Residential', 250),
    ('{{PARKING_NON_RESIDENTIAL}}', 'Non Residential ( specify User )', 260),
    ('{{PARKING_TRANSPORT_VEHICLES}}', 'Transport Vehicles', 270),
    ('{{PARKING_TOTAL}}', 'Total', 280),
    ('{{NOTICE_PG}}', 'Notice under section 337 /342 of B.M.C. Act 1888', 290),
    ('{{OFFICE_REMARK_01}}', 'Notice under section 337 /342 of B.M.C. Act 1888', 300),
    ('{{SCRUTINY_FEES_RS}}', 'Scrutiny Fees', 310),
    ('{{OFFICE_REMARK_02}}', 'Scrutiny Fees', 320),
    ('{{CC_APPLICATION_PG}}', 'Application for C.C. u/s. 44/69 MRTP Act', 330),
    ('{{OFFICE_REMARK_03}}', 'Application for C.C. u/s. 44/69 MRTP Act', 340),
    ('{{TITLE_CERT_PG}}', 'OWNERSHIP', 350),
    ('{{PR_CARD_PG}}', 'OWNERSHIP', 360),
    ('{{OTHER_DOC_PG}}', 'OWNERSHIP', 370),
    ('{{POA_PG}}', 'OWNERSHIP', 380),
    ('{{ESTATE_TP_PG}}', 'OWNERSHIP', 390),
    ('{{NOTICE_NAME_PG}}', 'OWNERSHIP', 400),
    ('{{OWNERSHIP_REMARK}}', 'OWNERSHIP', 410),
    ('{{OFFICE_REMARK_04}}', 'OWNERSHIP', 420),
    ('{{PLOT_AREA_SQM}}', 'PLOT AREA', 430),
    ('{{PLOT_AREA_PG}}', 'PLOT AREA', 440),
    ('{{PLOT_AREA_REMARKS}}', 'PLOT AREA', 450),
    ('{{OFFICE_REMARK_05}}', 'PLOT AREA', 460),
    ('{{FACT_REMARK_06}}', 'Is the entire contiguous holding of the owner declared and shown on the…', 470),
    ('{{OFFICE_REMARK_06}}', 'Is the entire contiguous holding of the owner declared and shown on the…', 480),
    ('{{LAYOUT_REMARK}}', 'Layout/sub-division/ Amalgamation (D.C. Regulation No. 21)', 490),
    ('{{OFFICE_REMARK_07}}', 'Layout/sub-division/ Amalgamation (D.C. Regulation No. 21)', 500),
    ('{{CTS_PLAN_PG}}', 'Existing Structures/Trees /Wells. a) Whether all are shown on the plan…', 510),
    ('{{ASSESSMENT_BILL_PG}}', 'Existing Structures/Trees /Wells. a) Whether all are shown on the plan…', 520),
    ('{{EXISTING_APPROVED_PLAN_PG}}', 'Existing Structures/Trees /Wells. a) Whether all are shown on the plan…', 530),
    ('{{FACT_REMARK_08}}', 'Existing Structures/Trees /Wells. a) Whether all are shown on the plan…', 540),
    ('{{OFFICE_REMARK_08}}', 'Existing Structures/Trees /Wells. a) Whether all are shown on the plan…', 550),
    ('{{FACT_REMARK_09}}', 'Whether plan showing existing structure & proposed tenement in new…', 560),
    ('{{OFFICE_REMARK_09}}', 'Whether plan showing existing structure & proposed tenement in new…', 570),
    ('{{FACT_REMARK_10}}', 'R.L. of street Sanctioned / Proposed', 580),
    ('{{OFFICE_REMARK_10}}', 'R.L. of street Sanctioned / Proposed', 590),
    ('{{SETBACK_SQM}}', 'SET BACK LAND', 600),
    ('{{SETBACK_PG}}', 'SET BACK LAND', 610),
    ('{{OFFICE_REMARK_11}}', 'SET BACK LAND', 620),
    ('{{ROW_PG_12A}}', 'MEANS OF ACCESS (D.C. Regulation No. 17 &22)', 630),
    ('{{ROW_PG_12B}}', 'MEANS OF ACCESS (D.C. Regulation No. 17 &22)', 640),
    ('{{ROW_PG_12C}}', 'MEANS OF ACCESS (D.C. Regulation No. 17 &22)', 650),
    ('{{ROW_PG_12D}}', 'MEANS OF ACCESS (D.C. Regulation No. 17 &22)', 660),
    ('{{FACT_REMARK_12}}', 'MEANS OF ACCESS (D.C. Regulation No. 17 &22)', 670),
    ('{{OFFICE_REMARK_12}}', 'MEANS OF ACCESS (D.C. Regulation No. 17 &22)', 680),
    ('{{REMARKS_FROM_DETAILS}}', 'REMARKS FROM', 690),
    ('{{OFFICE_REMARK_13}}', 'REMARKS FROM', 700),
    ('{{SELF_CERTIFICATION_REMARKS}}', 'SELF CERTIFICATION BY OWNER /ARCHITECT', 710),
    ('{{OFFICE_REMARK_14}}', 'SELF CERTIFICATION BY OWNER /ARCHITECT', 720),
    ('{{CONSULTANT_REMARKS}}', 'REMARKS BY CONSULTANTS', 730),
    ('{{OFFICE_REMARK_15}}', 'REMARKS BY CONSULTANTS', 740),
    ('{{FACT_REMARK_16}}', 'RESERVATIONS', 750),
    ('{{OFFICE_REMARK_16}}', 'RESERVATIONS', 760),
    ('{{USER_DCR_NO}}', 'U S E R (D.C. Regulation 51 to 57, 60, 61)', 770),
    ('{{FACT_REMARK_17}}', 'U S E R (D.C. Regulation 51 to 57, 60, 61)', 780),
    ('{{OFFICE_REMARK_17}}', 'U S E R (D.C. Regulation 51 to 57, 60, 61)', 790),
    ('{{FACT_REMARK_18}}', 'F.S.I. PERMISSIBLE AS PER D. C. REGULATION', 800),
    ('{{OFFICE_REMARK_18}}', 'F.S.I. PERMISSIBLE AS PER D. C. REGULATION', 810),
    ('{{FACT_REMARK_19}}', 'TYPE OF BUILDING', 820),
    ('{{OFFICE_REMARK_19}}', 'TYPE OF BUILDING', 830),
    ('{{DESCRIPTION_OF_BUILDING}}', 'DESCRIPTION OF BUILDING', 840),
    ('{{OFFICE_REMARK_20}}', 'DESCRIPTION OF BUILDING', 850),
    ('{{FACT_REMARK_21}}', 'TENEMENT STATEMENT', 860),
    ('{{OFFICE_REMARK_21}}', 'TENEMENT STATEMENT', 870),
    ('{{FACT_REMARK_22}}', 'PARKING STATEMENT', 880),
    ('{{OFFICE_REMARK_22}}', 'PARKING STATEMENT', 890)
) AS v(token, section_label, sort_order) ON true
JOIN public.placeholders p
  ON p.token = v.token
  OR p.legacy_token = v.token
  OR (v.token LIKE '$%' AND p.legacy_token = substring(v.token from 2))
WHERE d.html IN ('concession/fact-sheet.html', 'fact-sheet.html')
ON CONFLICT (document_id, placeholder_id) DO UPDATE
SET section_label = EXCLUDED.section_label;


INSERT INTO public.application_document_placeholders
  (document_id, placeholder_id, required, sort_order, section_label)
SELECT d.id, p.id, false, v.sort_order, v.section_label
FROM public.application_documents d
JOIN (
  VALUES
    ('{{SCR_01_REQD}}', 'Type of building A. Only Residential B. Only Commercial C. Residential…', 10),
    ('{{SCR_01_PROPOSED}}', 'Type of building A. Only Residential B. Only Commercial C. Residential…', 20),
    ('{{SCR_01_DEFICIENCY}}', 'Type of building A. Only Residential B. Only Commercial C. Residential…', 30),
    ('{{SCR_01_SE_REMARK}}', 'Type of building A. Only Residential B. Only Commercial C. Residential…', 40),
    ('{{SCR_02_REQD}}', 'STAIRCASE REQUIREMENTS', 50),
    ('{{SCR_02_PROPOSED}}', 'STAIRCASE REQUIREMENTS', 60),
    ('{{SCR_02_DEFICIENCY}}', 'STAIRCASE REQUIREMENTS', 70),
    ('{{SCR_02_SE_REMARK}}', 'STAIRCASE REQUIREMENTS', 80),
    ('{{SCR_03_REQD}}', 'HEIGHT PERMISSIBLE: as per D.C. Reg. No. 31', 90),
    ('{{SCR_03_PROPOSED}}', 'HEIGHT PERMISSIBLE: as per D.C. Reg. No. 31', 100),
    ('{{SCR_03_DEFICIENCY}}', 'HEIGHT PERMISSIBLE: as per D.C. Reg. No. 31', 110),
    ('{{SCR_03_SE_REMARK}}', 'HEIGHT PERMISSIBLE: as per D.C. Reg. No. 31', 120),
    ('{{SCR_04_REQD}}', 'Distance from center line of street as per D.C.Reg. 29[5] Table 10-B', 130),
    ('{{SCR_04_PROPOSED}}', 'Distance from center line of street as per D.C.Reg. 29[5] Table 10-B', 140),
    ('{{SCR_04_DEFICIENCY}}', 'Distance from center line of street as per D.C.Reg. 29[5] Table 10-B', 150),
    ('{{SCR_04_SE_REMARK}}', 'Distance from center line of street as per D.C.Reg. 29[5] Table 10-B', 160),
    ('{{SCR_05_REQD}}', 'OPEN SPACE i. Front ii. Side (Right ) iii. Side (Left) iv. Rear', 170),
    ('{{SCR_05_PROPOSED}}', 'OPEN SPACE i. Front ii. Side (Right ) iii. Side (Left) iv. Rear', 180),
    ('{{SCR_05_DEFICIENCY}}', 'OPEN SPACE i. Front ii. Side (Right ) iii. Side (Left) iv. Rear', 190),
    ('{{SCR_05_SE_REMARK}}', 'OPEN SPACE i. Front ii. Side (Right ) iii. Side (Left) iv. Rear', 200),
    ('{{SCR_06_REQD}}', 'R.G. AMENITY / OPEN SPACE (D.C. Reg. no. 23) i) 10% ii) 15% iii) 20%…', 210),
    ('{{SCR_06_PROPOSED}}', 'R.G. AMENITY / OPEN SPACE (D.C. Reg. no. 23) i) 10% ii) 15% iii) 20%…', 220),
    ('{{SCR_06_DEFICIENCY}}', 'R.G. AMENITY / OPEN SPACE (D.C. Reg. no. 23) i) 10% ii) 15% iii) 20%…', 230),
    ('{{SCR_06_SE_REMARK}}', 'R.G. AMENITY / OPEN SPACE (D.C. Reg. no. 23) i) 10% ii) 15% iii) 20%…', 240),
    ('{{SCR_07_REQD}}', 'CHOWKS', 250),
    ('{{SCR_07_PROPOSED}}', 'CHOWKS', 260),
    ('{{SCR_07_DEFICIENCY}}', 'CHOWKS', 270),
    ('{{SCR_07_SE_REMARK}}', 'CHOWKS', 280),
    ('{{SCR_08_REQD}}', 'SERVICE DUCTS', 290),
    ('{{SCR_08_PROPOSED}}', 'SERVICE DUCTS', 300),
    ('{{SCR_08_DEFICIENCY}}', 'SERVICE DUCTS', 310),
    ('{{SCR_08_SE_REMARK}}', 'SERVICE DUCTS', 320),
    ('{{SCR_09_REQD}}', 'PROJECTIONS', 330),
    ('{{SCR_09_PROPOSED}}', 'PROJECTIONS', 340),
    ('{{SCR_09_DEFICIENCY}}', 'PROJECTIONS', 350),
    ('{{SCR_09_SE_REMARK}}', 'PROJECTIONS', 360),
    ('{{SCR_10_REQD}}', 'TENEMENTS DENSITY', 370),
    ('{{SCR_10_PROPOSED}}', 'TENEMENTS DENSITY', 380),
    ('{{SCR_10_DEFICIENCY}}', 'TENEMENTS DENSITY', 390),
    ('{{SCR_10_SE_REMARK}}', 'TENEMENTS DENSITY', 400),
    ('{{SCR_11_REQD}}', 'MECHANICAL VENTILATION SHAFT a. Size b. Cross sectional area', 410),
    ('{{SCR_11_PROPOSED}}', 'MECHANICAL VENTILATION SHAFT a. Size b. Cross sectional area', 420),
    ('{{SCR_11_DEFICIENCY}}', 'MECHANICAL VENTILATION SHAFT a. Size b. Cross sectional area', 430),
    ('{{SCR_11_SE_REMARK}}', 'MECHANICAL VENTILATION SHAFT a. Size b. Cross sectional area', 440),
    ('{{SCR_12_REQD}}', 'PARKING SPACES (D.C. Reg.No. 36 Table 15)', 450),
    ('{{SCR_12_PROPOSED}}', 'PARKING SPACES (D.C. Reg.No. 36 Table 15)', 460),
    ('{{SCR_12_DEFICIENCY}}', 'PARKING SPACES (D.C. Reg.No. 36 Table 15)', 470),
    ('{{SCR_12_SE_REMARK}}', 'PARKING SPACES (D.C. Reg.No. 36 Table 15)', 480),
    ('{{SCR_13_REQD}}', 'Means of access for parking a) Ramps b) Car lifts c) Mechanical Parking', 490),
    ('{{SCR_13_PROPOSED}}', 'Means of access for parking a) Ramps b) Car lifts c) Mechanical Parking', 500),
    ('{{SCR_13_DEFICIENCY}}', 'Means of access for parking a) Ramps b) Car lifts c) Mechanical Parking', 510),
    ('{{SCR_13_SE_REMARK}}', 'Means of access for parking a) Ramps b) Car lifts c) Mechanical Parking', 520),
    ('{{SCR_14_REQD}}', 'SUBSTATION As per D.C. Reg. No. 26.', 530),
    ('{{SCR_14_PROPOSED}}', 'SUBSTATION As per D.C. Reg. No. 26.', 540),
    ('{{SCR_14_DEFICIENCY}}', 'SUBSTATION As per D.C. Reg. No. 26.', 550),
    ('{{SCR_14_SE_REMARK}}', 'SUBSTATION As per D.C. Reg. No. 26.', 560),
    ('{{SCR_15_REQD}}', 'OCCUPANCY STATEMENT As per DCR', 570),
    ('{{SCR_15_PROPOSED}}', 'OCCUPANCY STATEMENT As per DCR', 580),
    ('{{SCR_15_DEFICIENCY}}', 'OCCUPANCY STATEMENT As per DCR', 590),
    ('{{SCR_15_SE_REMARK}}', 'OCCUPANCY STATEMENT As per DCR', 600),
    ('{{SCR_16_REQD}}', 'SANITATION REQUIREMENT for shops, Market, Industries etc.', 610),
    ('{{SCR_16_PROPOSED}}', 'SANITATION REQUIREMENT for shops, Market, Industries etc.', 620),
    ('{{SCR_16_DEFICIENCY}}', 'SANITATION REQUIREMENT for shops, Market, Industries etc.', 630),
    ('{{SCR_16_SE_REMARK}}', 'SANITATION REQUIREMENT for shops, Market, Industries etc.', 640),
    ('{{SCR_17_REQD}}', 'FREE OF FSI as per DCR 35(2)', 650),
    ('{{SCR_17_PROPOSED}}', 'FREE OF FSI as per DCR 35(2)', 660),
    ('{{SCR_17_DEFICIENCY}}', 'FREE OF FSI as per DCR 35(2)', 670),
    ('{{SCR_17_SE_REMARK}}', 'FREE OF FSI as per DCR 35(2)', 680),
    ('{{SCR_18_REQD}}', 'Details of contravening structure', 690),
    ('{{SCR_18_PROPOSED}}', 'Details of contravening structure', 700),
    ('{{SCR_18_DEFICIENCY}}', 'Details of contravening structure', 710),
    ('{{SCR_18_SE_REMARK}}', 'Details of contravening structure', 720),
    ('{{SCR_19_REQD}}', 'Details of buildable reservation A. Built up area to be handed over.', 730),
    ('{{SCR_19_PROPOSED}}', 'Details of buildable reservation A. Built up area to be handed over.', 740),
    ('{{SCR_19_DEFICIENCY}}', 'Details of buildable reservation A. Built up area to be handed over.', 750),
    ('{{SCR_19_SE_REMARK}}', 'Details of buildable reservation A. Built up area to be handed over.', 760),
    ('{{SCR_20_REQD}}', 'Details of EWS A. Built up area to be handed over', 770),
    ('{{SCR_20_PROPOSED}}', 'Details of EWS A. Built up area to be handed over', 780),
    ('{{SCR_20_DEFICIENCY}}', 'Details of EWS A. Built up area to be handed over', 790),
    ('{{SCR_20_SE_REMARK}}', 'Details of EWS A. Built up area to be handed over', 800),
    ('{{SCR_21_REQD}}', 'Any Other details', 810),
    ('{{SCR_21_PROPOSED}}', 'Any Other details', 820),
    ('{{SCR_21_DEFICIENCY}}', 'Any Other details', 830),
    ('{{SCR_21_SE_REMARK}}', 'Any Other details', 840),
    ('{{ARCHITECT_LS_NAME}}', 'Other fields', 850),
    ('{{SITE_VISIT_DATE}}', 'Other fields', 860),
    ('{{NO_OF_STRUCTURES}}', 'Other fields', 870),
    ('{{ENCROACHMENT_SIDE}}', 'Other fields', 880),
    ('{{ACCESS_WIDTH_MTRS}}', 'Other fields', 890)
) AS v(token, section_label, sort_order) ON true
JOIN public.placeholders p
  ON p.token = v.token
  OR p.legacy_token = v.token
  OR (v.token LIKE '$%' AND p.legacy_token = substring(v.token from 2))
WHERE d.html IN ('concession/scrutiny-sheet-iod-cc.html', 'scrutiny-sheet-iod-cc.html')
ON CONFLICT (document_id, placeholder_id) DO UPDATE
SET section_label = EXCLUDED.section_label;


INSERT INTO public.application_document_placeholders
  (document_id, placeholder_id, required, sort_order, section_label)
SELECT d.id, p.id, false, v.sort_order, v.section_label
FROM public.application_documents d
JOIN (
  VALUES
    ('{{OPEN_SPACE_SR_NO}}', 'Open space mentioned in Sr. no.', 10),
    ('{{OPEN_SPACE_JUSTIFICATION}}', 'Open space mentioned in Sr. no.', 20),
    ('{{OPEN_SPACE_DCR}}', 'Open space mentioned in Sr. no.', 30),
    ('{{OPEN_SPACE_APPROVAL_AUTHORITY}}', 'Open space mentioned in Sr. no.', 40),
    ('{{OPEN_SPACE_COMMENTS_AE}}', 'Comments by AE', 50),
    ('{{SITE_INSPECTION_REMARK}}', 'Site is inspected and found to be in accordance with justification…', 60),
    ('{{OPEN_SPACE_COMMENTS_EE}}', 'Comments by EE', 70),
    ('{{OPEN_SPACE_RECOMMENDATION}}', 'Recommended for approval to concession as per DCR by DyCh.E/Ch.E/ MC', 80),
    ('{{PARKING_JUSTIFICATION}}', 'Parking spaces', 90),
    ('{{PARKING_DCR}}', 'Parking spaces', 100),
    ('{{PARKING_APPROVAL_AUTHORITY}}', 'Parking spaces', 110),
    ('{{PARKING_COMMENTS_AE}}', 'Comments by AE', 120),
    ('{{PARKING_COMMENTS_EE}}', 'Comments by EE', 130),
    ('{{STAIRCASE_JUSTIFICATION}}', 'Staircase , Staircase lobby, Lift , Lift Lobby', 140),
    ('{{STAIRCASE_DCR}}', 'Staircase , Staircase lobby, Lift , Lift Lobby', 150),
    ('{{STAIRCASE_APPROVAL_AUTHORITY}}', 'Staircase , Staircase lobby, Lift , Lift Lobby', 160),
    ('{{STAIRCASE_COMMENTS_AE}}', 'Comments by AE', 170),
    ('{{STAIRCASE_COMMENTS_EE}}', 'Comments by EE', 180),
    ('{{OTHERS_JUSTIFICATION}}', 'Others *', 190),
    ('{{OTHERS_DCR}}', 'Others *', 200),
    ('{{OTHERS_APPROVAL_AUTHORITY}}', 'Others *', 210),
    ('{{OTHERS_COMMENTS_AE}}', 'Comments by AE', 220),
    ('{{OTHERS_COMMENTS_EE}}', 'Comments by EE', 230),
    ('{{COMMENTS_DY_CHIEF_ENGINEER}}', 'Other fields', 240),
    ('{{APPROVED_DY_CHIEF_ENGINEER}}', 'Other fields', 250),
    ('{{RECOMMENDED_DY_CHIEF_ENGINEER_TO_CHE_DP}}', 'Other fields', 260),
    ('{{COMMENTS_CHIEF_ENGINEER}}', 'Other fields', 270),
    ('{{APPROVED_CHIEF_ENGINEER_DP}}', 'Other fields', 280),
    ('{{MC_RECOMMENDATION_1}}', 'Other fields', 290),
    ('{{MC_RECOMMENDATION_2}}', 'Other fields', 300),
    ('{{MC_RECOMMENDATION_3}}', 'Other fields', 310),
    ('{{MC_RECOMMENDATION_4}}', 'Other fields', 320)
) AS v(token, section_label, sort_order) ON true
JOIN public.placeholders p
  ON p.token = v.token
  OR p.legacy_token = v.token
  OR (v.token LIKE '$%' AND p.legacy_token = substring(v.token from 2))
WHERE d.html IN ('concession/report-various-concession-sought.html', 'report-various-concession-sought.html')
ON CONFLICT (document_id, placeholder_id) DO UPDATE
SET section_label = EXCLUDED.section_label;
