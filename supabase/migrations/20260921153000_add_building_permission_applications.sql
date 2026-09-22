-- Add Building Permission application types and their nested documents.
-- Existing `iod` type is kept; its pending-concession documents move onto the new type.

INSERT INTO public.application_types
  (id, department, application_title, description, category, applicant_type, token_suffix,
   planning_authorities, requires_roster_match, show_building_permission_fields, sort_order, icon_key)
VALUES
  ('concession', 'Building Permission', 'Concession',
   'Concession proposal for full potential',
   'department_permission', NULL, NULL, '{}', false, true, 12, 'check'),
  ('iod_cc_pending_concession', 'Building Permission', 'IOD/CC pending concession',
   'IOD/CC pending concession by Architect/LS',
   'department_permission', NULL, NULL, '{}', false, true, 14, 'document'),
  ('plinth_cc', 'Building Permission', 'Plinth CC',
   'Commencement certificate up to plinth',
   'department_permission', NULL, NULL, '{}', false, true, 61, 'document'),
  ('further_full_cc', 'Building Permission', 'Further / Full CC',
   'Further or full commencement certificate',
   'department_permission', NULL, NULL, '{}', false, true, 62, 'document'),
  ('full_part_oc', 'Building Permission', 'Full / Part OC',
   'Full or part occupancy certificate / BCC',
   'department_permission', NULL, NULL, '{}', false, true, 81, 'building'),
  ('part_oc', 'Building Permission', 'Part OC',
   'Part occupancy certificate',
   'department_permission', NULL, NULL, '{}', false, true, 82, 'building')
ON CONFLICT (id) DO UPDATE SET
  department = EXCLUDED.department,
  application_title = EXCLUDED.application_title,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  show_building_permission_fields = EXCLUDED.show_building_permission_fields,
  sort_order = EXCLUDED.sort_order,
  icon_key = EXCLUDED.icon_key,
  is_active = true,
  updated_at = now();

INSERT INTO public.application_documents
  (id, application_type_id, category, html, sign, letter_variant, sort_order)
VALUES
  -- IOD/CC pending concession
  ('iod_cc_pending_architect', 'iod_cc_pending_concession',
   'Application for IOD/CC pending concession by Architect/LS',
   'iod-cc-pending-architect.html', ARRAY['architect_or_ls'], NULL, 10),
  ('iod_cc_pending_owner_undertaking', 'iod_cc_pending_concession',
   'Registered Undertaking by Owner for starting work prior to obtaining',
   'iod-cc-pending-owner-undertaking.html', ARRAY['owner'], NULL, 20),
  ('iod_cc_pending_provisional_report', 'iod_cc_pending_concession',
   'Report for provisional IOD/CC',
   'iod-cc-pending-provisional-report.html', ARRAY['architect_or_ls'], NULL, 30),
  ('iod_cc_pending_upto_plinth', 'iod_cc_pending_concession',
   'IOD upto plinth pending Concessions approval',
   'iod-cc-pending-upto-plinth.html', ARRAY['architect_or_ls'], NULL, 40),
  ('cc_upto_plinth_pending_concessions', 'iod_cc_pending_concession',
   'CC upto plinth pending Concessions approval',
   'cc-upto-plinth-pending-concessions.html', ARRAY['architect_or_ls'], NULL, 50),
  ('work_start_notice', 'iod_cc_pending_concession',
   'Work Start Notice',
   'work-start-notice.html', ARRAY['architect_or_ls'], NULL, 60),

  -- Concession
  ('proposal_full_potential', 'concession',
   'Application for Proposal by Architect for full potential',
   'proposal-full-potential.html', ARRAY['architect_or_ls'], NULL, 10),
  ('list_indicative_concessions', 'concession',
   'List of indicative Concessions',
   'list-indicative-concessions.html', ARRAY['architect_or_ls'], NULL, 20),
  ('data_sheet_scrutiny_concession', 'concession',
   'Data sheet & Scrutiny by Architect/SE/AE/EE for Concession',
   'data-sheet-scrutiny-concession.html', ARRAY['architect_or_ls'], NULL, 30),
  ('fact_sheet', 'concession',
   'Fact Sheet',
   'fact-sheet.html', ARRAY['architect_or_ls'], NULL, 40),
  ('scrutiny_sheet_iod_cc', 'concession',
   'Scrutiny Sheet for IOD/CC',
   'scrutiny-sheet-iod-cc.html', ARRAY['architect_or_ls'], NULL, 50),
  ('report_various_concession_sought', 'concession',
   'Report on Various Concession sought',
   'report-various-concession-sought.html', ARRAY['architect_or_ls'], NULL, 60),

  -- IOD (existing type)
  ('iod_cc_architect_letterhead', 'iod',
   'Application for IOD/CC on Architect/LS Letterhead',
   'iod-cc-architect-letterhead.html', ARRAY['architect_or_ls'], NULL, 10),
  ('report_iod_cc', 'iod',
   'Report for IOD/CC',
   'report-iod-cc.html', ARRAY['architect_or_ls'], NULL, 20),

  -- Plinth CC
  ('application_plinth_cc', 'plinth_cc',
   'Application for Plinth CC',
   'application-plinth-cc.html', ARRAY['architect_or_ls'], NULL, 10),
  ('report_plinth_cc', 'plinth_cc',
   'Report for Plinth CC',
   'report-plinth-cc.html', ARRAY['architect_or_ls'], NULL, 20),

  -- Further / Full CC
  ('application_further_cc', 'further_full_cc',
   'Application for Further CC',
   'application-further-cc.html', ARRAY['architect_or_ls'], NULL, 10),
  ('report_further_cc', 'further_full_cc',
   'Report for Further CC',
   'report-further-cc.html', ARRAY['architect_or_ls'], NULL, 20),

  -- Full / Part OC
  ('application_full_oc_bcc', 'full_part_oc',
   'Application for Full OC/BCC',
   'application-full-oc-bcc.html', ARRAY['architect_or_ls'], NULL, 10),
  ('report_documents_full_oc_bcc', 'full_part_oc',
   'Report of Documents for Full OC/BCC',
   'report-documents-full-oc-bcc.html', ARRAY['architect_or_ls'], NULL, 20),
  ('report_compliance_iod_conditions_d_form', 'full_part_oc',
   'Report of Compliance of IOD Conditions D Form',
   'report-compliance-iod-conditions-d-form.html', ARRAY['architect_or_ls'], NULL, 30),

  -- Part OC
  ('indemnity_bond_part_oc', 'part_oc',
   'Indemnity Bond for Part OC',
   'indemnity-bond-part-oc.html', ARRAY['owner'], NULL, 10),
  ('application_part_oc_architect', 'part_oc',
   'Application for Part OC by Architect',
   'application-part-oc-architect.html', ARRAY['architect_or_ls'], NULL, 20),
  ('checklist_documents_part_oc', 'part_oc',
   'Checklist of Documents for Part OC',
   'checklist-documents-part-oc.html', ARRAY['architect_or_ls'], NULL, 30)
ON CONFLICT (id) DO UPDATE SET
  application_type_id = EXCLUDED.application_type_id,
  category = EXCLUDED.category,
  html = EXCLUDED.html,
  sign = EXCLUDED.sign,
  sort_order = EXCLUDED.sort_order,
  is_active = true;

-- Reuse the same project key-variable placeholders as other Building Permission types
INSERT INTO public.application_type_placeholders (application_type_id, placeholder_id, sort_order)
SELECT t.id, src.placeholder_id, src.sort_order
FROM public.application_types t
JOIN public.application_type_placeholders src ON src.application_type_id = 'iod'
WHERE t.id IN (
  'concession',
  'iod_cc_pending_concession',
  'plinth_cc',
  'further_full_cc',
  'full_part_oc',
  'part_oc'
)
ON CONFLICT (application_type_id, placeholder_id) DO NOTHING;
