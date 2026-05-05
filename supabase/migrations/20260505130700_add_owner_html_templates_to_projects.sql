-- Adds per-project owner appointment-letter HTML template paths.
-- Stores a map of TemplateType -> Storage object path, e.g.
-- {
--   "Architect Licensed Surveyor": "owners/<owner_user_id>/appointment-letters/Architect Licensed Surveyor.html",
--   "Fire Safety Consultant": "owners/<owner_user_id>/appointment-letters/Fire Safety Consultant.html"
-- }

alter table if exists public.projects
add column if not exists owner_html_templates jsonb not null default '{}'::jsonb;

-- Adds per-project owner appointment-letter HTML template paths.
-- Stores a map of TemplateType -> Storage object path, e.g.
-- {
--   "Architect Licensed Surveyor": "owners/<owner_user_id>/templates/architect.html",
--   "Fire Safety Consultant": "owners/<owner_user_id>/templates/fire.html"
-- }

alter table if exists public.projects
add column if not exists owner_html_templates jsonb not null default '{}'::jsonb;

