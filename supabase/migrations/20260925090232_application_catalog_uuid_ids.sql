-- application_types.id and application_documents.id become uuid.
-- The previous snake_case id is kept as slug so saved-PDF URL keys stay stable.
-- notifications.application_id matches applications.id (uuid).

DROP VIEW IF EXISTS public.application_catalog_sheet;

ALTER TABLE public.application_types
  ADD COLUMN slug text;

UPDATE public.application_types
SET slug = id
WHERE slug IS NULL;

ALTER TABLE public.application_types
  ALTER COLUMN slug SET NOT NULL;

ALTER TABLE public.application_types
  ADD COLUMN id_uuid uuid DEFAULT gen_random_uuid();

UPDATE public.application_types
SET id_uuid = gen_random_uuid()
WHERE id_uuid IS NULL;

ALTER TABLE public.application_types
  ALTER COLUMN id_uuid SET NOT NULL;

ALTER TABLE public.application_documents
  ADD COLUMN slug text;

UPDATE public.application_documents
SET slug = id
WHERE slug IS NULL;

ALTER TABLE public.application_documents
  ALTER COLUMN slug SET NOT NULL;

ALTER TABLE public.application_documents
  ADD COLUMN id_uuid uuid DEFAULT gen_random_uuid();

UPDATE public.application_documents
SET id_uuid = gen_random_uuid()
WHERE id_uuid IS NULL;

ALTER TABLE public.application_documents
  ALTER COLUMN id_uuid SET NOT NULL;

ALTER TABLE public.application_documents
  ADD COLUMN application_type_uuid uuid;

UPDATE public.application_documents d
SET application_type_uuid = t.id_uuid
FROM public.application_types t
WHERE d.application_type_id = t.id;

ALTER TABLE public.application_documents
  ALTER COLUMN application_type_uuid SET NOT NULL;

ALTER TABLE public.application_type_placeholders
  ADD COLUMN application_type_uuid uuid;

UPDATE public.application_type_placeholders atp
SET application_type_uuid = t.id_uuid
FROM public.application_types t
WHERE atp.application_type_id = t.id;

ALTER TABLE public.application_type_placeholders
  ALTER COLUMN application_type_uuid SET NOT NULL;

ALTER TABLE public.application_document_placeholders
  ADD COLUMN document_uuid uuid;

UPDATE public.application_document_placeholders adp
SET document_uuid = d.id_uuid
FROM public.application_documents d
WHERE adp.document_id = d.id;

ALTER TABLE public.application_document_placeholders
  ALTER COLUMN document_uuid SET NOT NULL;

ALTER TABLE public.application_document_placeholders
  DROP CONSTRAINT application_document_placeholders_pkey;
ALTER TABLE public.application_document_placeholders
  DROP CONSTRAINT application_document_placeholders_document_id_fkey;

ALTER TABLE public.application_type_placeholders
  DROP CONSTRAINT application_type_placeholders_pkey;
ALTER TABLE public.application_type_placeholders
  DROP CONSTRAINT application_type_placeholders_application_type_id_fkey;

ALTER TABLE public.application_documents
  DROP CONSTRAINT application_documents_pkey;
ALTER TABLE public.application_documents
  DROP CONSTRAINT application_documents_application_type_id_fkey;

ALTER TABLE public.application_types
  DROP CONSTRAINT application_types_pkey;

ALTER TABLE public.application_document_placeholders
  DROP COLUMN document_id;
ALTER TABLE public.application_type_placeholders
  DROP COLUMN application_type_id;
ALTER TABLE public.application_documents
  DROP COLUMN id,
  DROP COLUMN application_type_id;
ALTER TABLE public.application_types
  DROP COLUMN id;

ALTER TABLE public.application_types
  RENAME COLUMN id_uuid TO id;
ALTER TABLE public.application_documents
  RENAME COLUMN id_uuid TO id;
ALTER TABLE public.application_documents
  RENAME COLUMN application_type_uuid TO application_type_id;
ALTER TABLE public.application_type_placeholders
  RENAME COLUMN application_type_uuid TO application_type_id;
ALTER TABLE public.application_document_placeholders
  RENAME COLUMN document_uuid TO document_id;

ALTER TABLE public.application_types
  ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE public.application_documents
  ALTER COLUMN id SET DEFAULT gen_random_uuid();

ALTER TABLE public.application_types
  ADD CONSTRAINT application_types_pkey PRIMARY KEY (id);
ALTER TABLE public.application_documents
  ADD CONSTRAINT application_documents_pkey PRIMARY KEY (id);

ALTER TABLE public.application_types
  ADD CONSTRAINT application_types_slug_key UNIQUE (slug);
ALTER TABLE public.application_documents
  ADD CONSTRAINT application_documents_slug_key UNIQUE (slug);

ALTER TABLE public.application_documents
  ADD CONSTRAINT application_documents_application_type_id_fkey
  FOREIGN KEY (application_type_id) REFERENCES public.application_types(id) ON DELETE CASCADE;

ALTER TABLE public.application_type_placeholders
  ADD CONSTRAINT application_type_placeholders_pkey PRIMARY KEY (application_type_id, placeholder_id);
ALTER TABLE public.application_type_placeholders
  ADD CONSTRAINT application_type_placeholders_application_type_id_fkey
  FOREIGN KEY (application_type_id) REFERENCES public.application_types(id) ON DELETE CASCADE;

ALTER TABLE public.application_document_placeholders
  ADD CONSTRAINT application_document_placeholders_pkey PRIMARY KEY (document_id, placeholder_id);
ALTER TABLE public.application_document_placeholders
  ADD CONSTRAINT application_document_placeholders_document_id_fkey
  FOREIGN KEY (document_id) REFERENCES public.application_documents(id) ON DELETE CASCADE;

CREATE INDEX application_documents_type_idx
  ON public.application_documents (application_type_id, sort_order);

COMMENT ON COLUMN public.application_types.id IS
  'UUID primary key. Human-readable key is slug.';
COMMENT ON COLUMN public.application_types.slug IS
  'Stable snake_case key (former text id).';
COMMENT ON COLUMN public.application_documents.id IS
  'UUID primary key. Saved PDF URL keys use slug.';
COMMENT ON COLUMN public.application_documents.slug IS
  'Stable snake_case key used as projects.application_urls and Storage path.';

CREATE VIEW public.application_catalog_sheet AS
SELECT
  t.department,
  t.application_title AS application_type,
  d.category,
  d.sub_category,
  d.html,
  d.show_letterhead,
  d.show_qrcode,
  array_to_string(d.sign, ', ') AS sign,
  p.token AS placeholder,
  p.source_column AS "column",
  p.source_table AS "table",
  t.sort_order AS type_sort,
  d.sort_order AS document_sort,
  atp.sort_order AS placeholder_sort
FROM public.application_types t
JOIN public.application_documents d ON d.application_type_id = t.id AND d.is_active
JOIN public.application_type_placeholders atp ON atp.application_type_id = t.id
JOIN public.placeholders p ON p.id = atp.placeholder_id AND p.is_active
WHERE t.is_active
UNION ALL
SELECT
  t.department,
  t.application_title AS application_type,
  d.category,
  d.sub_category,
  d.html,
  d.show_letterhead,
  d.show_qrcode,
  array_to_string(d.sign, ', ') AS sign,
  p.token AS placeholder,
  p.source_column AS "column",
  p.source_table AS "table",
  t.sort_order AS type_sort,
  d.sort_order AS document_sort,
  adp.sort_order AS placeholder_sort
FROM public.application_types t
JOIN public.application_documents d ON d.application_type_id = t.id AND d.is_active
JOIN public.application_document_placeholders adp ON adp.document_id = d.id
JOIN public.placeholders p ON p.id = adp.placeholder_id AND p.is_active
WHERE t.is_active;

GRANT SELECT ON public.application_catalog_sheet TO authenticated;

ALTER TABLE public.notifications
  ALTER COLUMN application_id TYPE uuid USING application_id::uuid;

COMMENT ON COLUMN public.notifications.application_id IS
  'applications.id (uuid).';
