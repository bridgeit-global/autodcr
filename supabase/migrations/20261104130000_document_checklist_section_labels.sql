-- Document Checklist letter-field accordion sections (Date / Subject / Reference / …).
-- Application Details groups by application_document_placeholders.section_label;
-- explicit labels win over placeholders.ui_group fallback in the app.

-- Shared sections applied to every gdc_* document (type-level fields need a doc link for section_label).
INSERT INTO public.application_document_placeholders
  (document_id, placeholder_id, required, sort_order, section_label)
SELECT d.id, v.placeholder_id, false, v.sort_order, v.section_label
FROM public.application_documents d
CROSS JOIN (
  VALUES
    -- Date
    ('letter_date', 10, 'Date'),
    -- Addressee (To-block)
    ('ward', 20, 'Addressee'),
    ('suburb', 30, 'Addressee'),
    ('bp_organisation', 40, 'Addressee'),
    ('bp_address_line_1', 50, 'Addressee'),
    ('bp_address_line_2', 60, 'Addressee'),
    ('bp_address_line_3', 70, 'Addressee'),
    -- Reference
    ('file_no', 80, 'Reference'),
    -- Subject / plot
    ('project_title', 90, 'Subject'),
    ('plot_no', 100, 'Subject'),
    ('plot_cs_cts_no', 105, 'Subject'),
    ('cs_no', 110, 'Subject'),
    ('cts_no', 120, 'Subject'),
    ('fp_no', 130, 'Subject'),
    ('village', 140, 'Subject'),
    ('division', 150, 'Subject'),
    ('village_division', 155, 'Subject'),
    ('tps_no', 160, 'Subject'),
    ('property_address', 170, 'Subject'),
    ('type_of_development', 180, 'Subject'),
    -- Client
    ('client_name', 190, 'Client'),
    ('applicant_name', 200, 'Client'),
    ('owner_name', 210, 'Client'),
    ('owner_or_developer', 220, 'Client')
) AS v(placeholder_id, sort_order, section_label)
WHERE d.slug LIKE 'gdc_%'
ON CONFLICT (document_id, placeholder_id) DO UPDATE SET
  section_label = EXCLUDED.section_label,
  sort_order = EXCLUDED.sort_order;

-- Plot Area Certificate — plot / area + consultant signer
INSERT INTO public.application_document_placeholders
  (document_id, placeholder_id, required, sort_order, section_label)
SELECT d.id, v.placeholder_id, false, v.sort_order, v.section_label
FROM public.application_documents d
CROSS JOIN (
  VALUES
    ('plot_area', 230, 'Plot / area'),
    ('date_of_prc', 240, 'Plot / area'),
    ('consultant_firm', 250, 'Consultant'),
    ('salutation', 260, 'Consultant'),
    ('architect_ls_name', 270, 'Consultant'),
    ('architect_or_ls_role', 275, 'Consultant'),
    ('architect_or_ls_reg_label', 276, 'Consultant'),
    ('architect_ls_reg_no', 280, 'Consultant'),
    ('architect_ls_validity', 285, 'Consultant'),
    ('reg_no', 290, 'Consultant'),
    ('validity', 300, 'Consultant')
) AS v(placeholder_id, sort_order, section_label)
WHERE d.slug = 'gdc_plot_area_certificate'
ON CONFLICT (document_id, placeholder_id) DO UPDATE SET
  section_label = EXCLUDED.section_label,
  sort_order = EXCLUDED.sort_order;

-- Supervision Memo — Architect
INSERT INTO public.application_document_placeholders
  (document_id, placeholder_id, required, sort_order, section_label)
SELECT d.id, v.placeholder_id, false, v.sort_order, v.section_label
FROM public.application_documents d
CROSS JOIN (
  VALUES
    ('consultant_firm', 230, 'Consultant'),
    ('salutation', 240, 'Consultant'),
    ('architect_ls_name', 250, 'Consultant'),
    ('architect_or_ls_role', 255, 'Consultant'),
    ('architect_or_ls_reg_label', 256, 'Consultant'),
    ('architect_ls_reg_no', 260, 'Consultant'),
    ('architect_ls_validity', 265, 'Consultant'),
    ('reg_no', 270, 'Consultant'),
    ('validity', 280, 'Consultant'),
    ('owner_or_developer', 290, 'Client'),
    ('owner_firm', 300, 'Client'),
    ('owner_address_line_1', 310, 'Client'),
    ('owner_address_line_2', 320, 'Client'),
    ('owner_address_line_3', 330, 'Client')
) AS v(placeholder_id, sort_order, section_label)
WHERE d.slug = 'gdc_supervision_architect'
ON CONFLICT (document_id, placeholder_id) DO UPDATE SET
  section_label = EXCLUDED.section_label,
  sort_order = EXCLUDED.sort_order;

-- Supervision Memo — Structural Engineer
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
WHERE d.slug = 'gdc_supervision_structural'
ON CONFLICT (document_id, placeholder_id) DO UPDATE SET
  section_label = EXCLUDED.section_label,
  sort_order = EXCLUDED.sort_order;

-- Supervision Memo — Licensed Plumber
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
WHERE d.slug = 'gdc_supervision_plumber'
ON CONFLICT (document_id, placeholder_id) DO UPDATE SET
  section_label = EXCLUDED.section_label,
  sort_order = EXCLUDED.sort_order;

-- Supervision Memo — Site Supervisor
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
WHERE d.slug = 'gdc_supervision_site_supervisor'
ON CONFLICT (document_id, placeholder_id) DO UPDATE SET
  section_label = EXCLUDED.section_label,
  sort_order = EXCLUDED.sort_order;

-- Notice for Start of Work
INSERT INTO public.application_document_placeholders
  (document_id, placeholder_id, required, sort_order, section_label)
SELECT d.id, v.placeholder_id, false, v.sort_order, v.section_label
FROM public.application_documents d
CROSS JOIN (
  VALUES
    ('building_no', 230, 'Reference'),
    ('work_start_date', 240, 'Date'),
    ('last_approval_no', 250, 'Reference'),
    ('architects_name', 260, 'Consultant'),
    ('architect_ls_reg_no', 270, 'Consultant'),
    ('owner_address_line_1', 280, 'Client'),
    ('owner_address_line_2', 290, 'Client'),
    ('owner_address_line_3', 300, 'Client')
) AS v(placeholder_id, sort_order, section_label)
WHERE d.slug = 'gdc_notice_start_of_work'
ON CONFLICT (document_id, placeholder_id) DO UPDATE SET
  section_label = EXCLUDED.section_label,
  sort_order = EXCLUDED.sort_order;

-- Plinth completion
INSERT INTO public.application_document_placeholders
  (document_id, placeholder_id, required, sort_order, section_label)
SELECT d.id, v.placeholder_id, false, v.sort_order, v.section_label
FROM public.application_documents d
CROSS JOIN (
  VALUES
    ('building_no', 230, 'Reference'),
    ('last_approval_no', 240, 'Reference'),
    ('consultant_firm', 250, 'Consultant'),
    ('salutation', 260, 'Consultant'),
    ('architect_ls_name', 270, 'Consultant'),
    ('architect_or_ls_role', 275, 'Consultant'),
    ('architect_or_ls_reg_label', 276, 'Consultant'),
    ('architect_ls_reg_no', 280, 'Consultant'),
    ('architect_ls_validity', 285, 'Consultant'),
    ('reg_no', 290, 'Consultant'),
    ('validity', 300, 'Consultant')
) AS v(placeholder_id, sort_order, section_label)
WHERE d.slug = 'gdc_plinth_completion'
ON CONFLICT (document_id, placeholder_id) DO UPDATE SET
  section_label = EXCLUDED.section_label,
  sort_order = EXCLUDED.sort_order;

-- Development completion
INSERT INTO public.application_document_placeholders
  (document_id, placeholder_id, required, sort_order, section_label)
SELECT d.id, v.placeholder_id, false, v.sort_order, v.section_label
FROM public.application_documents d
CROSS JOIN (
  VALUES
    ('building_no', 230, 'Reference'),
    ('last_approval_no', 240, 'Reference'),
    ('consultant_firm', 250, 'Consultant'),
    ('salutation', 260, 'Consultant'),
    ('architect_ls_name', 270, 'Consultant'),
    ('architect_or_ls_role', 275, 'Consultant'),
    ('architect_or_ls_reg_label', 276, 'Consultant'),
    ('architect_ls_reg_no', 280, 'Consultant'),
    ('architect_ls_validity', 285, 'Consultant'),
    ('reg_no', 290, 'Consultant'),
    ('validity', 300, 'Consultant')
) AS v(placeholder_id, sort_order, section_label)
WHERE d.slug = 'gdc_development_completion'
ON CONFLICT (document_id, placeholder_id) DO UPDATE SET
  section_label = EXCLUDED.section_label,
  sort_order = EXCLUDED.sort_order;

-- Owner's Plot Area Affidavit
INSERT INTO public.application_document_placeholders
  (document_id, placeholder_id, required, sort_order, section_label)
SELECT d.id, v.placeholder_id, false, v.sort_order, v.section_label
FROM public.application_documents d
CROSS JOIN (
  VALUES
    ('salutation', 230, 'Client'),
    ('signatory_designation', 240, 'Client'),
    ('owner_firm', 250, 'Client'),
    ('communication_address', 260, 'Client'),
    ('owner_address_line_1', 270, 'Client'),
    ('development_rights_date', 280, 'Reference'),
    ('s_no', 290, 'Subject'),
    ('h_no', 300, 'Subject'),
    ('architect_ls_name', 310, 'Consultant'),
    ('architect_ls_reg_no', 320, 'Consultant'),
    ('plot_area', 330, 'Plot / area'),
    ('plot_area_words', 340, 'Plot / area'),
    ('city', 350, 'Subject'),
    ('affidavit_day', 360, 'Date'),
    ('affidavit_month', 370, 'Date'),
    ('affidavit_year', 380, 'Date')
) AS v(placeholder_id, sort_order, section_label)
WHERE d.slug = 'gdc_owners_plot_area_affidavit'
ON CONFLICT (document_id, placeholder_id) DO UPDATE SET
  section_label = EXCLUDED.section_label,
  sort_order = EXCLUDED.sort_order;
