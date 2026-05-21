-- Prepend missing Owner row to projects.applicant_details.applicants from project owner (auth.users).
-- Data fix only — no app code should synthesize Owner at read time.

CREATE OR REPLACE FUNCTION public.build_owner_applicant_json(
  p_owner_id uuid,
  p_meta jsonb,
  p_email text
)
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT jsonb_strip_nulls(
    jsonb_build_object(
      'id', 1,
      'user_id', p_owner_id::text,
      'applicantType', 'Owner',
      'name', NULLIF(trim(concat_ws(' ',
        p_meta->>'first_name',
        p_meta->>'middle_name',
        p_meta->>'last_name'
      )), ''),
      'contactNumber', COALESCE(NULLIF(trim(p_meta->>'alternate_phone'), ''), NULLIF(trim(p_meta->>'mobile'), ''), '-'),
      'email', COALESCE(NULLIF(trim(p_email), ''), NULLIF(trim(p_meta->>'email'), ''), '-'),
      'panNo', COALESCE(NULLIF(trim(p_meta->>'pan_no'), ''), NULLIF(trim(p_meta->>'pan'), ''), '-'),
      'registrationNo', CASE lower(trim(COALESCE(p_meta->>'entity_type', '')))
        WHEN 'proprietorship / individual' THEN NULLIF(trim(p_meta->>'proprietorship_registration_no'), '')
        WHEN 'pvt. ltd. / ltd. company' THEN NULLIF(trim(p_meta->>'cin'), '')
        WHEN 'llp' THEN NULLIF(trim(p_meta->>'llpin'), '')
        WHEN 'partnership firm' THEN NULLIF(trim(p_meta->>'firm_registration_no'), '')
        WHEN 'trust / society' THEN NULLIF(trim(p_meta->>'trust_registration_no'), '')
        WHEN 'govt. / psu / local body' THEN NULLIF(trim(p_meta->>'govt_registration_no'), '')
        ELSE NULL
      END,
      'licenseIssueDate', CASE lower(trim(COALESCE(p_meta->>'entity_type', '')))
        WHEN 'proprietorship / individual' THEN COALESCE(NULLIF(trim(p_meta->>'proprietorship_registration_date'), ''), '-')
        WHEN 'pvt. ltd. / ltd. company' THEN COALESCE(NULLIF(trim(p_meta->>'roc_registration_date'), ''), '-')
        WHEN 'llp' THEN COALESCE(NULLIF(trim(p_meta->>'llp_incorporation_date'), ''), '-')
        WHEN 'partnership firm' THEN COALESCE(NULLIF(trim(p_meta->>'partnership_registration_date'), ''), '-')
        WHEN 'trust / society' THEN COALESCE(NULLIF(trim(p_meta->>'trust_registration_date'), ''), '-')
        WHEN 'govt. / psu / local body' THEN COALESCE(NULLIF(trim(p_meta->>'govt_registration_date'), ''), '-')
        ELSE '-'
      END,
      'address_line1', NULLIF(trim(COALESCE(p_meta->>'address_line1', p_meta->>'addressLine1', '')), ''),
      'address_line2', NULLIF(trim(COALESCE(p_meta->>'address_line2', p_meta->>'addressLine2', '')), ''),
      'address_line3', NULLIF(trim(COALESCE(p_meta->>'address_line3', p_meta->>'addressLine3', '')), ''),
      'residentialAddress', NULLIF(trim(COALESCE(p_meta->>'address', '')), ''),
      'officeAddress', COALESCE(NULLIF(trim(p_meta->>'address'), ''), '-'),
      'entity_type', NULLIF(trim(p_meta->>'entity_type'), ''),
      'letterhead_url', NULLIF(trim(COALESCE(p_meta->>'letterhead_url', p_meta->>'letterheadUrl', '')), ''),
      'letterheadUrl', NULLIF(trim(COALESCE(p_meta->>'letterhead_url', p_meta->>'letterheadUrl', '')), '')
    )
  );
$$;

WITH missing_owner AS (
  SELECT
    p.id AS project_id,
    p.user_id AS owner_id,
    u.email,
    COALESCE(u.raw_user_meta_data, '{}'::jsonb) AS meta,
    COALESCE(p.applicant_details, '{"applicants":[]}'::jsonb) AS details
  FROM public.projects p
  INNER JOIN auth.users u ON u.id = p.user_id
  WHERE p.user_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1
      FROM jsonb_array_elements(COALESCE(p.applicant_details -> 'applicants', '[]'::jsonb)) elem
      WHERE lower(trim(COALESCE(elem->>'applicantType', elem->>'applicant_type', ''))) LIKE '%owner%'
    )
),
prepended AS (
  SELECT
    m.project_id,
    jsonb_build_object(
      'applicants',
      jsonb_build_array(public.build_owner_applicant_json(m.owner_id, m.meta, m.email))
        || COALESCE(m.details -> 'applicants', '[]'::jsonb)
    ) AS new_details
  FROM missing_owner m
)
UPDATE public.projects p
SET applicant_details = pr.new_details
FROM prepended pr
WHERE p.id = pr.project_id;

-- Keep public.applicants in sync with JSON after backfill.
DO $$
DECLARE
  v_project_id uuid;
BEGIN
  FOR v_project_id IN
    SELECT p.id
    FROM public.projects p
    WHERE p.user_id IS NOT NULL
      AND jsonb_array_length(COALESCE(p.applicant_details -> 'applicants', '[]'::jsonb)) > 0
  LOOP
    PERFORM public.sync_applicants_for_project(v_project_id);
  END LOOP;
END $$;

COMMENT ON FUNCTION public.build_owner_applicant_json(uuid, jsonb, text) IS
  'Builds one Owner applicant_details.applicants[] element from auth.users metadata (backfill helper).';
