-- Rename department "General" → "Pre requisites documents".
-- Rename appointment apps "Appointment Letter for X" → "Documents of X".

UPDATE public.application_types
SET
  department = 'Pre requisites documents',
  updated_at = now()
WHERE department = 'General';

UPDATE public.application_types t
SET
  application_title = v.new_title,
  updated_at = now()
FROM (
  VALUES
    ('appointment_letter_for_architect', 'Documents of Architect'),
    ('appointment_letter_for_licensed_surveyor', 'Documents of Licensed Surveyor'),
    ('appointment_letter_for_fire_consultant', 'Documents of Fire Consultant'),
    ('appointment_letter_for_mep_consultant', 'Documents of MEP Consultant'),
    ('appointment_letter_for_plumber', 'Documents of Plumber'),
    ('appointment_letter_for_town_planner', 'Documents of Town Planner'),
    ('appointment_letter_for_structural_engineer', 'Documents of Structural Engineer'),
    ('appointment_letter_for_environmental_consultant', 'Documents of Environmental Consultant'),
    ('appointment_letter_for_landscape_consultant', 'Documents of Landscape Consultant'),
    ('appointment_letter_for_geotechnical_consultant', 'Documents of Geotechnical Consultant'),
    ('appointment_letter_for_pmc_project_manager', 'Documents of PMC / Project Manager'),
    ('appointment_letter_for_site_supervisor', 'Documents of Site Supervisor')
) AS v(slug, new_title)
WHERE t.slug = v.slug;

-- Live application rows (folder labels come from these)
UPDATE public.applications
SET
  department = 'Pre requisites documents',
  updated_at = now()
WHERE department = 'General';

UPDATE public.applications a
SET
  permission_type = v.new_title,
  updated_at = now()
FROM (
  VALUES
    ('Appointment Letter for Architect', 'Documents of Architect'),
    ('Appointment Letter for Licensed Surveyor', 'Documents of Licensed Surveyor'),
    ('Appointment Letter for Fire Consultant', 'Documents of Fire Consultant'),
    ('Appointment Letter for MEP Consultant', 'Documents of MEP Consultant'),
    ('Appointment Letter for Plumber', 'Documents of Plumber'),
    ('Appointment Letter for Town Planner', 'Documents of Town Planner'),
    ('Appointment Letter for Structural Engineer', 'Documents of Structural Engineer'),
    ('Appointment Letter for Environmental Consultant', 'Documents of Environmental Consultant'),
    ('Appointment Letter for Landscape Consultant', 'Documents of Landscape Consultant'),
    ('Appointment Letter for Geotechnical Consultant', 'Documents of Geotechnical Consultant'),
    ('Appointment Letter for PMC / Project Manager', 'Documents of PMC / Project Manager'),
    ('Appointment Letter for Site Supervisor', 'Documents of Site Supervisor')
) AS v(old_title, new_title)
WHERE a.permission_type = v.old_title;
