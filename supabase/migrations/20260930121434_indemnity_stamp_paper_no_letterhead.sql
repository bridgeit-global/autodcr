UPDATE public.application_documents
SET show_letterhead = false,
    show_qrcode = false
WHERE slug = 'indemnity_bond_part_oc'
   OR html = 'indemnity-bond-part-oc.html';
