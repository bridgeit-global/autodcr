-- Data-sheet Sub line uses {{PLOT_CS_CTS_NO}} (plotBelongsTo label + numbers).
-- Link it to this document so catalogPlaceholderFieldMap formatters run.

INSERT INTO public.application_document_placeholders
  (document_id, placeholder_id, required, sort_order)
SELECT d.id, 'plot_cs_cts_no', false, 5
FROM public.application_documents d
WHERE d.html = 'data-sheet-scrutiny-concession.html'
ON CONFLICT (document_id, placeholder_id) DO UPDATE SET
  sort_order = EXCLUDED.sort_order,
  required = EXCLUDED.required;
