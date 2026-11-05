-- Existing projects still have applications.permission_type = 'Document Checklist',
-- so the UI keeps showing that folder. Catalog type is already inactive / replaced
-- by general_owner ("Owner"). Rename live apps so General shows Owner instead.

UPDATE public.applications
SET permission_type = 'Owner',
    updated_at = now()
WHERE permission_type = 'Document Checklist';
