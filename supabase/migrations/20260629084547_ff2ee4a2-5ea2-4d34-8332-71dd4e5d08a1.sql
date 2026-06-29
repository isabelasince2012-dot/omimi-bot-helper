
CREATE TABLE public.inbox_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  telegram_user_id UUID REFERENCES public.telegram_users(id) ON DELETE SET NULL,
  telegram_id BIGINT NOT NULL,
  username TEXT,
  first_name TEXT,
  last_name TEXT,
  chat_id BIGINT NOT NULL,
  message_id BIGINT,
  text TEXT NOT NULL,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_inbox_created ON public.inbox_messages (created_at DESC);
CREATE INDEX idx_inbox_unread ON public.inbox_messages (is_read) WHERE is_read = false;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.inbox_messages TO authenticated;
GRANT ALL ON public.inbox_messages TO service_role;

ALTER TABLE public.inbox_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage inbox" ON public.inbox_messages
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
