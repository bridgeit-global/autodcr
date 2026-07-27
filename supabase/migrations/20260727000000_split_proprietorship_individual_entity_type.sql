-- Migration: split 'Proprietorship / Individual' into 'Proprietorship' and 'Individual'
-- New owners will be stored with one of the two new values.
-- This migration:
--   1. Backfills any existing 'Proprietorship / Individual' rows to 'Proprietorship'.
--   2. Recreates get_owners() (used by Applicant Details directory) with updated CASE branches.
--   3. Recreates get_owners_by_entity_type with updated CASE branches.
--   4. Recreates the build_owner_applicant_json helper with updated CASE branches.

-- ─── 1. Backfill existing auth.users metadata ─────────────────────────────────
-- Update raw_user_meta_data entity_type from old combined value to 'Proprietorship'.
-- Individual registrations did not exist before this migration so no 'Individual' backfill needed.
UPDATE auth.users
SET raw_user_meta_data = jsonb_set(
  raw_user_meta_data,
  '{entity_type}',
  '"Proprietorship"'::jsonb
)
WHERE lower(trim(raw_user_meta_data->>'entity_type')) = 'proprietorship / individual';

-- ─── 2. Recreate get_owners() used by Applicant Details Owner directory ────────
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
  license_issue_date text
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
    END AS license_issue_date
  FROM auth.users u
  WHERE lower(trim(COALESCE(u.raw_user_meta_data->>'role', ''))) = 'owner';
$$;

-- ─── 3. Recreate get_owners_by_entity_type ────────────────────────────────────
DROP FUNCTION IF EXISTS public.get_owners_by_entity_type(text);
CREATE OR REPLACE FUNCTION public.get_owners_by_entity_type(p_type text)
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
  license_issue_date text
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
    NULLIF(trim(COALESCE(u.email, '')), '') AS email,
    NULLIF(trim(COALESCE(u.raw_user_meta_data->>'alternate_phone', '')), '') AS contact_number,
    NULLIF(trim(COALESCE(u.raw_user_meta_data->>'pan', '')), '') AS pan,
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
    END AS license_issue_date
  FROM auth.users u
  WHERE lower(trim(COALESCE(u.raw_user_meta_data->>'role', ''))) = 'owner'
    AND (p_type IS NULL OR lower(trim(COALESCE(u.raw_user_meta_data->>'entity_type', ''))) = lower(trim(p_type)));
$$;

-- ─── 4. Update applicant roster JSON builder CASE branches ────────────────────
-- Re-create the build_owner_applicant_json helper used by backfill/RPC pipelines.
-- Replaces 'proprietorship / individual' with 'proprietorship' and adds 'individual'.

CREATE OR REPLACE FUNCTION public.build_owner_applicant_json(p_meta jsonb)
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT jsonb_build_object(
    'registrationNo', CASE lower(trim(COALESCE(p_meta->>'entity_type', '')))
      WHEN 'proprietorship' THEN NULLIF(trim(p_meta->>'proprietorship_registration_no'), '')
      WHEN 'individual' THEN NULLIF(trim(p_meta->>'proprietorship_registration_no'), '')
      WHEN 'proprietorship / individual' THEN NULLIF(trim(p_meta->>'proprietorship_registration_no'), '')
      WHEN 'pvt. ltd. / ltd. company' THEN NULLIF(trim(p_meta->>'cin'), '')
      WHEN 'llp' THEN NULLIF(trim(p_meta->>'llpin'), '')
      WHEN 'partnership firm' THEN NULLIF(trim(p_meta->>'firm_registration_no'), '')
      WHEN 'trust / society' THEN NULLIF(trim(p_meta->>'trust_registration_no'), '')
      WHEN 'govt. / psu / local body' THEN NULLIF(trim(p_meta->>'govt_registration_no'), '')
      ELSE NULL
    END,
    'licenseIssueDate', CASE lower(trim(COALESCE(p_meta->>'entity_type', '')))
      WHEN 'proprietorship' THEN COALESCE(NULLIF(trim(p_meta->>'proprietorship_registration_date'), ''), '-')
      WHEN 'individual' THEN COALESCE(NULLIF(trim(p_meta->>'proprietorship_registration_date'), ''), '-')
      WHEN 'proprietorship / individual' THEN COALESCE(NULLIF(trim(p_meta->>'proprietorship_registration_date'), ''), '-')
      WHEN 'pvt. ltd. / ltd. company' THEN COALESCE(NULLIF(trim(p_meta->>'roc_registration_date'), ''), '-')
      WHEN 'llp' THEN COALESCE(NULLIF(trim(p_meta->>'llp_incorporation_date'), ''), '-')
      WHEN 'partnership firm' THEN COALESCE(NULLIF(trim(p_meta->>'partnership_registration_date'), ''), '-')
      WHEN 'trust / society' THEN COALESCE(NULLIF(trim(p_meta->>'trust_registration_date'), ''), '-')
      WHEN 'govt. / psu / local body' THEN COALESCE(NULLIF(trim(p_meta->>'govt_registration_date'), ''), '-')
      ELSE '-'
    END,
    'entity_type', NULLIF(trim(p_meta->>'entity_type'), ''),
    'entity_name', NULLIF(trim(p_meta->>'entity_name'), '')
  );
$$;
