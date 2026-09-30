-- proposal-full-potential To-address uses existing $project_BuildingProposal_*
-- preview fields (same as appointment C.C.). Drop the empty {{BP_*}} Letter-field links.

DELETE FROM public.application_document_placeholders adp
USING public.application_documents d
WHERE adp.document_id = d.id
  AND d.html = 'proposal-full-potential.html'
  AND adp.placeholder_id IN (
    'bp_officer_name',
    'bp_organisation',
    'bp_address_line_1',
    'bp_address_line_2',
    'bp_address_line_3'
  );

UPDATE public.placeholders
SET
  ui_group = 'letterhead',
  updated_at = now()
WHERE id IN (
  'bp_officer_name',
  'bp_organisation',
  'bp_address_line_1',
  'bp_address_line_2',
  'bp_address_line_3'
);
