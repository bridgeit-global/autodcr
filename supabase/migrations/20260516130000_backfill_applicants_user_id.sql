-- Backfill missing applicants.user_id so (project_id, user_id) is populated.
-- Sources: projects.applicant_details JSON, project owner for Owner rows, same email+type on other projects.

-- 1) From projects.applicant_details.applicants[].user_id (match type + name)
UPDATE public.applicants a
SET user_id = src.uid
FROM (
  SELECT
    p.id AS project_id,
    NULLIF(TRIM(COALESCE(elem->>'user_id', elem->>'userId')), '')::uuid AS uid,
    LOWER(TRIM(COALESCE(elem->>'applicantType', elem->>'applicant_type', ''))) AS applicant_type,
    LOWER(TRIM(COALESCE(elem->>'name', ''))) AS applicant_name
  FROM public.projects p
  CROSS JOIN LATERAL jsonb_array_elements(
    COALESCE(p.applicant_details -> 'applicants', '[]'::jsonb)
  ) AS elem
  WHERE NULLIF(TRIM(COALESCE(elem->>'user_id', elem->>'userId')), '') IS NOT NULL
) AS src
WHERE a.project_id = src.project_id
  AND a.user_id IS NULL
  AND LOWER(TRIM(COALESCE(a.applicant_details->>'applicantType', a.applicant_details->>'applicant_type', ''))) = src.applicant_type
  AND (
    src.applicant_name = ''
    OR LOWER(TRIM(COALESCE(a.applicant_details->>'name', ''))) = src.applicant_name
  );

-- 2) Owner rows: use projects.user_id (project owner auth id)
UPDATE public.applicants a
SET user_id = p.user_id
FROM public.projects p
WHERE a.project_id = p.id
  AND a.user_id IS NULL
  AND LOWER(TRIM(COALESCE(a.applicant_details->>'applicantType', a.applicant_details->>'applicant_type', ''))) = 'owner'
  AND p.user_id IS NOT NULL;

-- 3) Same person on another project (email + applicant type)
UPDATE public.applicants a
SET user_id = src.user_id
FROM public.applicants src
WHERE a.user_id IS NULL
  AND src.user_id IS NOT NULL
  AND LOWER(TRIM(COALESCE(a.applicant_details->>'applicantType', a.applicant_details->>'applicant_type', '')))
    = LOWER(TRIM(COALESCE(src.applicant_details->>'applicantType', src.applicant_details->>'applicant_type', '')))
  AND LOWER(TRIM(COALESCE(a.applicant_details->>'email', ''))) = LOWER(TRIM(COALESCE(src.applicant_details->>'email', '')))
  AND TRIM(COALESCE(a.applicant_details->>'email', '')) <> '';

-- 4) Remove duplicate (project_id, user_id) after backfill — keep oldest row
DELETE FROM public.applicants a
USING public.applicants b
WHERE a.project_id = b.project_id
  AND a.user_id IS NOT NULL
  AND b.user_id IS NOT NULL
  AND a.user_id = b.user_id
  AND a.id > b.id;

-- 5) One row per applicant type when user_id still null (legacy); keep oldest
DELETE FROM public.applicants a
USING public.applicants b
WHERE a.project_id = b.project_id
  AND a.user_id IS NULL
  AND b.user_id IS NULL
  AND a.id > b.id
  AND LOWER(TRIM(COALESCE(a.applicant_details->>'applicantType', a.applicant_details->>'applicant_type', '')))
    = LOWER(TRIM(COALESCE(b.applicant_details->>'applicantType', b.applicant_details->>'applicant_type', '')));

COMMENT ON COLUMN public.applicants.user_id IS
  'auth.users id — with project_id forms applicants_project_id_user_id_unique when set.';
