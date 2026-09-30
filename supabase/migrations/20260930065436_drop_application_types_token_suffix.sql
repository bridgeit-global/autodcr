-- Unused. Consultant tokens are filled from applicant_type.
ALTER TABLE public.application_types
  DROP COLUMN IF EXISTS token_suffix;
