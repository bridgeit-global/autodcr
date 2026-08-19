-- In-app inbox for application-status events (header bell).
-- Writes go through the service role in /api/applications/[id]/notify.
-- Recipients read and mark their own rows.

CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  application_id text NOT NULL,
  project_id text NULL,
  stage text NOT NULL,
  title text NOT NULL,
  body text NOT NULL DEFAULT '',
  link_url text NOT NULL DEFAULT '',
  read_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT notifications_stage_check CHECK (
    stage IN ('draft', 'saved', 'in_process', 'approved_verified', 'rejected')
  )
);

COMMENT ON TABLE public.notifications IS
  'Per-user in-app notifications for application workflow events.';

CREATE INDEX IF NOT EXISTS notifications_user_created_at_idx
  ON public.notifications (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS notifications_user_unread_idx
  ON public.notifications (user_id)
  WHERE read_at IS NULL;

ALTER TABLE public.notifications
  DROP CONSTRAINT IF EXISTS notifications_user_application_stage_key;

ALTER TABLE public.notifications
  ADD CONSTRAINT notifications_user_application_stage_key
  UNIQUE (user_id, application_id, stage);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications REPLICA IDENTITY FULL;

DROP POLICY IF EXISTS notifications_select_own ON public.notifications;
CREATE POLICY notifications_select_own ON public.notifications
  FOR SELECT
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS notifications_update_own ON public.notifications;
CREATE POLICY notifications_update_own ON public.notifications
  FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

GRANT SELECT, UPDATE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_object THEN NULL;
END $$;
