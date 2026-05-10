-- Saved appointment letter PDF public URLs per consultant template type.
-- Shape: { "<TemplateType>": "https://.../object/public/project-library/..." }

alter table if exists public.projects
add column if not exists application_urls jsonb not null default '{}'::jsonb;
