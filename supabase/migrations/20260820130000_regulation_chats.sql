-- Regulation chat: per-user threads scoped to a project, with optional uploaded proposal text.

CREATE TABLE IF NOT EXISTS public.regulation_chats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT 'New chat',
  authorities text[] NOT NULL DEFAULT '{}'::text[],
  document_filename text NULL,
  document_pages integer NULL,
  document_chars integer NULL,
  document_text text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.regulation_chats IS
  'User-owned regulation / compliance chat threads, one project per thread.';

CREATE INDEX IF NOT EXISTS regulation_chats_user_project_updated_idx
  ON public.regulation_chats (user_id, project_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS public.regulation_chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id uuid NOT NULL REFERENCES public.regulation_chats(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('user', 'assistant')),
  content text NOT NULL DEFAULT '',
  kind text NOT NULL DEFAULT 'text'
    CHECK (kind IN ('text', 'ask', 'compliance', 'document')),
  sources jsonb NOT NULL DEFAULT '[]'::jsonb,
  compliance jsonb NULL,
  filename text NULL,
  error boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.regulation_chat_messages IS
  'Turns in a regulation chat: questions, document uploads, and compliance results.';

CREATE INDEX IF NOT EXISTS regulation_chat_messages_chat_id_created_at_idx
  ON public.regulation_chat_messages (chat_id, created_at ASC);

ALTER TABLE public.regulation_chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.regulation_chat_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS regulation_chats_select ON public.regulation_chats;
CREATE POLICY regulation_chats_select ON public.regulation_chats
  FOR SELECT
  USING (
    user_id = auth.uid()
    AND public.user_can_access_project(project_id)
  );

DROP POLICY IF EXISTS regulation_chats_insert ON public.regulation_chats;
CREATE POLICY regulation_chats_insert ON public.regulation_chats
  FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND public.user_can_access_project(project_id)
  );

DROP POLICY IF EXISTS regulation_chats_update ON public.regulation_chats;
CREATE POLICY regulation_chats_update ON public.regulation_chats
  FOR UPDATE
  USING (
    user_id = auth.uid()
    AND public.user_can_access_project(project_id)
  )
  WITH CHECK (
    user_id = auth.uid()
    AND public.user_can_access_project(project_id)
  );

DROP POLICY IF EXISTS regulation_chats_delete ON public.regulation_chats;
CREATE POLICY regulation_chats_delete ON public.regulation_chats
  FOR DELETE
  USING (
    user_id = auth.uid()
    AND public.user_can_access_project(project_id)
  );

DROP POLICY IF EXISTS regulation_chat_messages_select ON public.regulation_chat_messages;
CREATE POLICY regulation_chat_messages_select ON public.regulation_chat_messages
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.regulation_chats c
      WHERE c.id = regulation_chat_messages.chat_id
        AND c.user_id = auth.uid()
        AND public.user_can_access_project(c.project_id)
    )
  );

DROP POLICY IF EXISTS regulation_chat_messages_insert ON public.regulation_chat_messages;
CREATE POLICY regulation_chat_messages_insert ON public.regulation_chat_messages
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.regulation_chats c
      WHERE c.id = regulation_chat_messages.chat_id
        AND c.user_id = auth.uid()
        AND public.user_can_access_project(c.project_id)
    )
  );

DROP POLICY IF EXISTS regulation_chat_messages_delete ON public.regulation_chat_messages;
CREATE POLICY regulation_chat_messages_delete ON public.regulation_chat_messages
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1
      FROM public.regulation_chats c
      WHERE c.id = regulation_chat_messages.chat_id
        AND c.user_id = auth.uid()
        AND public.user_can_access_project(c.project_id)
    )
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.regulation_chats TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.regulation_chat_messages TO authenticated;

NOTIFY pgrst, 'reload schema';
