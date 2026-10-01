-- Unused. Create Application fields come from catalog placeholders.
ALTER TABLE public.application_types
  DROP COLUMN IF EXISTS show_building_permission_fields;
