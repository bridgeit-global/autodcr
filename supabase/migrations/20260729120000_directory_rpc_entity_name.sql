-- Expose entity_name from auth.users raw_user_meta_data on directory RPCs
-- used by Applicant Details so consultant/owner firm names persist into
-- applicants.applicant_details without relying only on enrichment.

DROP FUNCTION IF EXISTS public.get_consultants_by_type(text);
CREATE OR REPLACE FUNCTION public.get_consultants_by_type(p_type text)
RETURNS TABLE (
  user_id uuid,
  first_name text,
  middle_name text,
  last_name text,
  email text,
  contact_number text,
  pan text,
  address text,
  address_line1 text,
  address_line2 text,
  address_line3 text,
  city text,
  pincode text,
  registration_number text,
  license_issue_date text,
  entity_name text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT
    u.id AS user_id,
    NULLIF(trim(COALESCE(u.raw_user_meta_data->>'first_name', '')), '') AS first_name,
    NULLIF(trim(COALESCE(u.raw_user_meta_data->>'middle_name', '')), '') AS middle_name,
    NULLIF(trim(COALESCE(u.raw_user_meta_data->>'last_name', '')), '') AS last_name,
    u.email::text AS email,
    COALESCE(
      NULLIF(trim(COALESCE(u.raw_user_meta_data->>'alternate_phone', '')), ''),
      NULLIF(trim(COALESCE(u.raw_user_meta_data->>'mobile', '')), ''),
      ''
    ) AS contact_number,
    COALESCE(
      NULLIF(trim(COALESCE(u.raw_user_meta_data->>'pan', '')), ''),
      NULLIF(trim(COALESCE(u.raw_user_meta_data->>'pan_no', '')), ''),
      ''
    ) AS pan,
    NULLIF(trim(COALESCE(u.raw_user_meta_data->>'address', '')), '') AS address,
    NULLIF(trim(COALESCE(u.raw_user_meta_data->>'address_line1', u.raw_user_meta_data->>'addressLine1', '')), '') AS address_line1,
    NULLIF(trim(COALESCE(u.raw_user_meta_data->>'address_line2', u.raw_user_meta_data->>'addressLine2', '')), '') AS address_line2,
    NULLIF(trim(COALESCE(u.raw_user_meta_data->>'address_line3', u.raw_user_meta_data->>'addressLine3', '')), '') AS address_line3,
    NULLIF(trim(COALESCE(u.raw_user_meta_data->>'city', '')), '') AS city,
    NULLIF(trim(COALESCE(u.raw_user_meta_data->>'pincode', u.raw_user_meta_data->>'pin_code', '')), '') AS pincode,
    CASE lower(trim(COALESCE(p_type, u.raw_user_meta_data->>'consultant_type', '')))
      WHEN 'architect' THEN NULLIF(trim(COALESCE(u.raw_user_meta_data->>'coa_reg_no', '')), '')
      WHEN 'structural engineer' THEN NULLIF(trim(COALESCE(u.raw_user_meta_data->>'structural_license_no', '')), '')
      WHEN 'licensed surveyor' THEN NULLIF(trim(COALESCE(u.raw_user_meta_data->>'lbs_license_no', '')), '')
      WHEN 'mep consultant' THEN NULLIF(trim(COALESCE(u.raw_user_meta_data->>'electrical_license_no', '')), '')
      WHEN 'plumber' THEN NULLIF(trim(COALESCE(u.raw_user_meta_data->>'plumber_license_no', '')), '')
      WHEN 'fire consultant' THEN NULLIF(trim(COALESCE(u.raw_user_meta_data->>'fire_license_no', '')), '')
      WHEN 'landscape consultant' THEN NULLIF(trim(COALESCE(u.raw_user_meta_data->>'landscape_license_no', '')), '')
      WHEN 'pmc / project manager' THEN NULLIF(trim(COALESCE(u.raw_user_meta_data->>'pmc_registration_no', '')), '')
      WHEN 'geotechnical consultant' THEN NULLIF(trim(COALESCE(u.raw_user_meta_data->>'nabl_accreditation_no', '')), '')
      WHEN 'environmental consultant' THEN NULLIF(trim(COALESCE(u.raw_user_meta_data->>'env_license_no', '')), '')
      WHEN 'town planner' THEN NULLIF(trim(COALESCE(u.raw_user_meta_data->>'town_planner_license_no', '')), '')
      ELSE NULL
    END AS registration_number,
    COALESCE(NULLIF(trim(COALESCE(u.raw_user_meta_data->>'registration_date', '')), ''), '') AS license_issue_date,
    NULLIF(trim(COALESCE(
      u.raw_user_meta_data->>'entity_name',
      u.raw_user_meta_data->>'entityName',
      u.raw_user_meta_data->>'firm_name',
      u.raw_user_meta_data->>'company_name',
      ''
    )), '') AS entity_name
  FROM auth.users u
  WHERE lower(trim(COALESCE(u.raw_user_meta_data->>'role', ''))) = 'consultant'
    AND lower(trim(COALESCE(u.raw_user_meta_data->>'consultant_type', ''))) = lower(trim(COALESCE(p_type, '')));
$$;

DROP FUNCTION IF EXISTS public.get_owners();
CREATE OR REPLACE FUNCTION public.get_owners()
RETURNS TABLE (
  user_id uuid,
  first_name text,
  middle_name text,
  last_name text,
  email text,
  contact_number text,
  pan text,
  address text,
  address_line1 text,
  address_line2 text,
  address_line3 text,
  city text,
  pincode text,
  registration_number text,
  license_issue_date text,
  entity_name text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT
    u.id AS user_id,
    NULLIF(trim(COALESCE(u.raw_user_meta_data->>'first_name', '')), '') AS first_name,
    NULLIF(trim(COALESCE(u.raw_user_meta_data->>'middle_name', '')), '') AS middle_name,
    NULLIF(trim(COALESCE(u.raw_user_meta_data->>'last_name', '')), '') AS last_name,
    u.email::text AS email,
    COALESCE(
      NULLIF(trim(COALESCE(u.raw_user_meta_data->>'alternate_phone', '')), ''),
      NULLIF(trim(COALESCE(u.raw_user_meta_data->>'mobile', '')), ''),
      ''
    ) AS contact_number,
    COALESCE(
      NULLIF(trim(COALESCE(u.raw_user_meta_data->>'pan', '')), ''),
      NULLIF(trim(COALESCE(u.raw_user_meta_data->>'pan_no', '')), ''),
      ''
    ) AS pan,
    NULLIF(trim(COALESCE(u.raw_user_meta_data->>'address', '')), '') AS address,
    NULLIF(trim(COALESCE(u.raw_user_meta_data->>'address_line1', u.raw_user_meta_data->>'addressLine1', '')), '') AS address_line1,
    NULLIF(trim(COALESCE(u.raw_user_meta_data->>'address_line2', u.raw_user_meta_data->>'addressLine2', '')), '') AS address_line2,
    NULLIF(trim(COALESCE(u.raw_user_meta_data->>'address_line3', u.raw_user_meta_data->>'addressLine3', '')), '') AS address_line3,
    NULLIF(trim(COALESCE(u.raw_user_meta_data->>'city', '')), '') AS city,
    NULLIF(trim(COALESCE(u.raw_user_meta_data->>'pincode', u.raw_user_meta_data->>'pin_code', '')), '') AS pincode,
    CASE lower(trim(COALESCE(u.raw_user_meta_data->>'entity_type', '')))
      WHEN 'proprietorship' THEN NULLIF(trim(COALESCE(u.raw_user_meta_data->>'proprietorship_registration_no', '')), '')
      WHEN 'individual' THEN NULLIF(trim(COALESCE(u.raw_user_meta_data->>'proprietorship_registration_no', '')), '')
      WHEN 'proprietorship / individual' THEN NULLIF(trim(COALESCE(u.raw_user_meta_data->>'proprietorship_registration_no', '')), '')
      WHEN 'pvt. ltd. / ltd. company' THEN NULLIF(trim(COALESCE(u.raw_user_meta_data->>'cin', '')), '')
      WHEN 'llp' THEN NULLIF(trim(COALESCE(u.raw_user_meta_data->>'llpin', '')), '')
      WHEN 'partnership firm' THEN NULLIF(trim(COALESCE(u.raw_user_meta_data->>'firm_registration_no', '')), '')
      WHEN 'trust / society' THEN NULLIF(trim(COALESCE(u.raw_user_meta_data->>'trust_registration_no', '')), '')
      WHEN 'govt. / psu / local body' THEN NULLIF(trim(COALESCE(u.raw_user_meta_data->>'govt_registration_no', '')), '')
      ELSE NULL
    END AS registration_number,
    CASE lower(trim(COALESCE(u.raw_user_meta_data->>'entity_type', '')))
      WHEN 'proprietorship' THEN COALESCE(NULLIF(trim(COALESCE(u.raw_user_meta_data->>'proprietorship_registration_date', '')), ''), '')
      WHEN 'individual' THEN COALESCE(NULLIF(trim(COALESCE(u.raw_user_meta_data->>'proprietorship_registration_date', '')), ''), '')
      WHEN 'proprietorship / individual' THEN COALESCE(NULLIF(trim(COALESCE(u.raw_user_meta_data->>'proprietorship_registration_date', '')), ''), '')
      WHEN 'pvt. ltd. / ltd. company' THEN COALESCE(NULLIF(trim(COALESCE(u.raw_user_meta_data->>'roc_registration_date', '')), ''), '')
      WHEN 'llp' THEN COALESCE(NULLIF(trim(COALESCE(u.raw_user_meta_data->>'llp_incorporation_date', '')), ''), '')
      WHEN 'partnership firm' THEN COALESCE(NULLIF(trim(COALESCE(u.raw_user_meta_data->>'partnership_registration_date', '')), ''), '')
      WHEN 'trust / society' THEN COALESCE(NULLIF(trim(COALESCE(u.raw_user_meta_data->>'trust_registration_date', '')), ''), '')
      WHEN 'govt. / psu / local body' THEN COALESCE(NULLIF(trim(COALESCE(u.raw_user_meta_data->>'govt_registration_date', '')), ''), '')
      ELSE COALESCE(NULLIF(trim(COALESCE(u.raw_user_meta_data->>'registration_date', '')), ''), '')
    END AS license_issue_date,
    NULLIF(trim(COALESCE(
      u.raw_user_meta_data->>'entity_name',
      u.raw_user_meta_data->>'entityName',
      u.raw_user_meta_data->>'firm_name',
      u.raw_user_meta_data->>'company_name',
      ''
    )), '') AS entity_name
  FROM auth.users u
  WHERE lower(trim(COALESCE(u.raw_user_meta_data->>'role', ''))) = 'owner';
$$;
