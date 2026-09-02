-- Persist the model and token usage for each regulation chat turn.

ALTER TABLE public.regulation_chat_messages
  ADD COLUMN IF NOT EXISTS model text NULL;

ALTER TABLE public.regulation_chat_messages
  ADD COLUMN IF NOT EXISTS prompt_tokens integer NULL;

ALTER TABLE public.regulation_chat_messages
  ADD COLUMN IF NOT EXISTS completion_tokens integer NULL;

ALTER TABLE public.regulation_chat_messages
  ADD COLUMN IF NOT EXISTS total_tokens integer NULL;

COMMENT ON COLUMN public.regulation_chat_messages.model IS
  'Chat model id used to generate an assistant reply.';

COMMENT ON COLUMN public.regulation_chat_messages.prompt_tokens IS
  'Prompt tokens consumed for this assistant turn.';

COMMENT ON COLUMN public.regulation_chat_messages.completion_tokens IS
  'Completion tokens generated for this assistant turn.';

COMMENT ON COLUMN public.regulation_chat_messages.total_tokens IS
  'Total tokens consumed for this assistant turn.';

NOTIFY pgrst, 'reload schema';
