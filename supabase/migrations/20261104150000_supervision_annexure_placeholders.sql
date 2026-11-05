-- Supervision memos reuse Document Checklist annexure tokens ({{FILE_NO}},
-- {{CTS_NO}}, suburb, BP lines, …). Appointment letter types only had
-- proposal_number / survey_nos style tokens, so those HTML tokens stayed raw.
-- Wire the annexure set onto every active Supervision document.

INSERT INTO public.application_document_placeholders
  (document_id, placeholder_id, required, sort_order, section_label)
SELECT d.id, v.placeholder_id, false, v.sort_order, v.section_label
FROM public.application_documents d
CROSS JOIN (
  VALUES
    ('letter_date', 10, 'Date'),
    ('file_no', 20, 'Reference'),
    ('suburb', 30, 'Addressee'),
    ('bp_address_line_1', 40, 'Addressee'),
    ('bp_address_line_2', 50, 'Addressee'),
    ('bp_address_line_3', 60, 'Addressee'),
    ('project_title', 70, 'Proposal'),
    ('plot_no', 80, 'Proposal'),
    ('cs_no', 90, 'Proposal'),
    ('cts_no', 100, 'Proposal'),
    ('fp_no', 110, 'Proposal'),
    ('plot_cs_cts_no', 120, 'Proposal'),
    ('division', 130, 'Proposal'),
    ('village', 140, 'Proposal'),
    ('tps_no', 150, 'Proposal'),
    ('village_division', 160, 'Proposal'),
    ('type_of_development', 170, 'Proposal'),
    ('property_address', 180, 'Proposal'),
    ('ward', 190, 'Proposal'),
    ('applicant_name', 200, 'Client')
) AS v(placeholder_id, sort_order, section_label)
WHERE d.category = 'Supervision'
  AND d.is_active = true
  AND d.slug LIKE '%_supervision'
ON CONFLICT (document_id, placeholder_id) DO UPDATE SET
  section_label = EXCLUDED.section_label,
  sort_order = EXCLUDED.sort_order;
