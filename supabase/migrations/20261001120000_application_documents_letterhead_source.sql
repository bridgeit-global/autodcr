-- Explicit letterhead choice per catalog document (owner | architect_or_ls | consultant).
-- Same naming as application_documents.sign. Review before applying.
-- Does not use letter_variant (column being removed).

ALTER TABLE public.application_documents
  ADD COLUMN IF NOT EXISTS letterhead_source text
    CHECK (letterhead_source IN ('owner', 'architect_or_ls', 'consultant'));

COMMENT ON COLUMN public.application_documents.letterhead_source IS
  'owner | architect_or_ls | consultant — whose letterhead to paint (ignored if show_letterhead is false).';

-- Backfill from sign only (order matters: architect_or_ls, then owner, then consultant)
UPDATE public.application_documents
SET letterhead_source = 'architect_or_ls'
WHERE 'architect_or_ls' = ANY (sign);

UPDATE public.application_documents
SET letterhead_source = 'owner'
WHERE letterhead_source IS NULL
  AND 'owner' = ANY (sign);

UPDATE public.application_documents
SET letterhead_source = 'consultant'
WHERE letterhead_source IS NULL
  AND 'consultant' = ANY (sign);

UPDATE public.application_documents
SET letterhead_source = 'owner'
WHERE letterhead_source IS NULL;

ALTER TABLE public.application_documents
  ALTER COLUMN letterhead_source SET DEFAULT 'owner',
  ALTER COLUMN letterhead_source SET NOT NULL;
