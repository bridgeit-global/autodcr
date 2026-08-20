-- Persist like / unlike on regulation chat messages, and allow the owner to update them.

ALTER TABLE public.regulation_chat_messages
  ADD COLUMN IF NOT EXISTS reaction text NULL;

ALTER TABLE public.regulation_chat_messages
  DROP CONSTRAINT IF EXISTS regulation_chat_messages_reaction_check;

ALTER TABLE public.regulation_chat_messages
  ADD CONSTRAINT regulation_chat_messages_reaction_check
  CHECK (reaction IS NULL OR reaction IN ('like', 'unlike'));

COMMENT ON COLUMN public.regulation_chat_messages.reaction IS
  'Owner reaction on a turn: like, unlike, or none.';

DROP POLICY IF EXISTS regulation_chat_messages_update ON public.regulation_chat_messages;
CREATE POLICY regulation_chat_messages_update ON public.regulation_chat_messages
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM public.regulation_chats c
      WHERE c.id = regulation_chat_messages.chat_id
        AND c.user_id = auth.uid()
        AND public.user_can_access_project(c.project_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.regulation_chats c
      WHERE c.id = regulation_chat_messages.chat_id
        AND c.user_id = auth.uid()
        AND public.user_can_access_project(c.project_id)
    )
  );

GRANT UPDATE ON public.regulation_chat_messages TO authenticated;

NOTIFY pgrst, 'reload schema';
