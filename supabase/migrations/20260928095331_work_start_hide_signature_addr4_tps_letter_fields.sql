-- Work Start Notice Letter fields: drop typed owner signature (DSC) and address line 4.
-- {{TPS_NO}} stays mapped for F.P. auto-fill in preview, but is not asked in Letter fields
-- (ui_group = letterhead uses the existing Letter-fields skip). CTS plots already clear the token.

DELETE FROM public.application_document_placeholders adp
USING public.application_documents d
WHERE adp.document_id = d.id
  AND d.html = 'work-start-notice.html'
  AND adp.placeholder_id IN ('owner_signature', 'owner_address_line_4');

UPDATE public.placeholders
SET
  is_active = false,
  updated_at = now()
WHERE id = 'owner_address_line_4';

UPDATE public.placeholders
SET
  ui_group = 'letterhead',
  updated_at = now()
WHERE id IN ('owner_signature', 'tps_no');
