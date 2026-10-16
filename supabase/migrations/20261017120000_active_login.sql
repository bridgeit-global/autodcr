-- One winning session per account. Login checks auth.sessions for another
-- live session (activity inside the 2-hour app window) before replacing this row.

CREATE TABLE IF NOT EXISTS public.active_login (
  user_id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  session_id uuid NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.active_login ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.active_login FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.count_other_live_sessions(p_user_id uuid, p_session_id uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT count(*)::integer
  FROM auth.sessions AS s
  WHERE s.user_id = p_user_id
    AND s.id IS DISTINCT FROM p_session_id
    AND (s.not_after IS NULL OR s.not_after > now())
    AND coalesce(s.refreshed_at, s.updated_at, s.created_at) > now() - interval '2 hours';
$$;

CREATE OR REPLACE FUNCTION public.claim_active_login(p_user_id uuid, p_session_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.active_login (user_id, session_id, updated_at)
  VALUES (p_user_id, p_session_id, now())
  ON CONFLICT (user_id) DO UPDATE
    SET session_id = excluded.session_id,
        updated_at = now();
END;
$$;

CREATE OR REPLACE FUNCTION public.is_current_login_active()
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_session uuid;
  recorded uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN false;
  END IF;

  BEGIN
    current_session := nullif(auth.jwt() ->> 'session_id', '')::uuid;
  EXCEPTION
    WHEN others THEN
      RETURN false;
  END;

  IF current_session IS NULL THEN
    RETURN false;
  END IF;

  SELECT a.session_id
  INTO recorded
  FROM public.active_login AS a
  WHERE a.user_id = auth.uid();

  RETURN recorded IS NOT NULL AND recorded = current_session;
END;
$$;

-- Password verification signs in again and rotates the browser session.
-- The signed-in user can point the lock at the session they just received.
CREATE OR REPLACE FUNCTION public.adopt_current_login()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_session uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  current_session := nullif(auth.jwt() ->> 'session_id', '')::uuid;
  IF current_session IS NULL THEN
    RAISE EXCEPTION 'missing session';
  END IF;

  INSERT INTO public.active_login (user_id, session_id, updated_at)
  VALUES (auth.uid(), current_session, now())
  ON CONFLICT (user_id) DO UPDATE
    SET session_id = excluded.session_id,
        updated_at = now();
END;
$$;

REVOKE ALL ON FUNCTION public.count_other_live_sessions(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.claim_active_login(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.is_current_login_active() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.adopt_current_login() FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.count_other_live_sessions(uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.claim_active_login(uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.is_current_login_active() TO authenticated;
GRANT EXECUTE ON FUNCTION public.adopt_current_login() TO authenticated;
