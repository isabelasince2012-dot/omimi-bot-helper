-- 1. Add owner_id to all workspace tables
ALTER TABLE public.bot_settings ADD COLUMN IF NOT EXISTS owner_id uuid;
ALTER TABLE public.bot_settings ADD COLUMN IF NOT EXISTS webhook_token text;
ALTER TABLE public.telegram_users ADD COLUMN IF NOT EXISTS owner_id uuid;
ALTER TABLE public.broadcasts ADD COLUMN IF NOT EXISTS owner_id uuid;
ALTER TABLE public.announcements ADD COLUMN IF NOT EXISTS owner_id uuid;
ALTER TABLE public.reminders ADD COLUMN IF NOT EXISTS owner_id uuid;
ALTER TABLE public.reply_templates ADD COLUMN IF NOT EXISTS owner_id uuid;
ALTER TABLE public.inbox_messages ADD COLUMN IF NOT EXISTS owner_id uuid;
ALTER TABLE public.message_logs ADD COLUMN IF NOT EXISTS owner_id uuid;

-- 2. Backfill existing data to the first admin account
DO $$
DECLARE first_admin uuid;
BEGIN
  SELECT user_id INTO first_admin FROM public.user_roles WHERE role = 'admin' ORDER BY created_at LIMIT 1;
  IF first_admin IS NOT NULL THEN
    UPDATE public.bot_settings SET owner_id = first_admin WHERE owner_id IS NULL;
    UPDATE public.telegram_users SET owner_id = first_admin WHERE owner_id IS NULL;
    UPDATE public.broadcasts SET owner_id = first_admin WHERE owner_id IS NULL;
    UPDATE public.announcements SET owner_id = first_admin WHERE owner_id IS NULL;
    UPDATE public.reminders SET owner_id = first_admin WHERE owner_id IS NULL;
    UPDATE public.reply_templates SET owner_id = first_admin WHERE owner_id IS NULL;
    UPDATE public.inbox_messages SET owner_id = first_admin WHERE owner_id IS NULL;
    UPDATE public.message_logs SET owner_id = first_admin WHERE owner_id IS NULL;
  END IF;
END $$;

-- Drop any bot_settings rows that still have no owner (cannot be attributed)
DELETE FROM public.bot_settings WHERE owner_id IS NULL;

UPDATE public.bot_settings SET webhook_token = encode(gen_random_bytes(16), 'hex') WHERE webhook_token IS NULL;

ALTER TABLE public.bot_settings ALTER COLUMN owner_id SET NOT NULL;
ALTER TABLE public.bot_settings ALTER COLUMN webhook_token SET NOT NULL;
ALTER TABLE public.bot_settings ALTER COLUMN webhook_token SET DEFAULT encode(gen_random_bytes(16), 'hex');
CREATE UNIQUE INDEX IF NOT EXISTS bot_settings_owner_key ON public.bot_settings (owner_id);
CREATE UNIQUE INDEX IF NOT EXISTS bot_settings_webhook_token_key ON public.bot_settings (webhook_token);

-- 3. Subscribers unique per owner instead of globally
ALTER TABLE public.telegram_users DROP CONSTRAINT IF EXISTS telegram_users_telegram_id_key;
DELETE FROM public.telegram_users WHERE owner_id IS NULL;
ALTER TABLE public.telegram_users ALTER COLUMN owner_id SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS telegram_users_owner_telegram_key ON public.telegram_users (owner_id, telegram_id);

-- 4. Owner-scoped RLS
DROP POLICY IF EXISTS "admins manage bot_settings" ON public.bot_settings;
CREATE POLICY "own bot_settings" ON public.bot_settings FOR ALL TO authenticated
  USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS "admins manage telegram_users" ON public.telegram_users;
CREATE POLICY "own telegram_users" ON public.telegram_users FOR ALL TO authenticated
  USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS "admins manage broadcasts" ON public.broadcasts;
CREATE POLICY "own broadcasts" ON public.broadcasts FOR ALL TO authenticated
  USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS "admins manage announcements" ON public.announcements;
CREATE POLICY "own announcements" ON public.announcements FOR ALL TO authenticated
  USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS "admins manage reminders" ON public.reminders;
CREATE POLICY "own reminders" ON public.reminders FOR ALL TO authenticated
  USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS "Admins manage reply templates" ON public.reply_templates;
CREATE POLICY "own reply_templates" ON public.reply_templates FOR ALL TO authenticated
  USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS "Admins manage inbox" ON public.inbox_messages;
CREATE POLICY "own inbox_messages" ON public.inbox_messages FOR ALL TO authenticated
  USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS "admins manage message_logs" ON public.message_logs;
CREATE POLICY "own message_logs" ON public.message_logs FOR ALL TO authenticated
  USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

-- 5. Defaults so inserts from the app fill owner automatically
ALTER TABLE public.bot_settings ALTER COLUMN owner_id SET DEFAULT auth.uid();
ALTER TABLE public.telegram_users ALTER COLUMN owner_id SET DEFAULT auth.uid();
ALTER TABLE public.broadcasts ALTER COLUMN owner_id SET DEFAULT auth.uid();
ALTER TABLE public.announcements ALTER COLUMN owner_id SET DEFAULT auth.uid();
ALTER TABLE public.reminders ALTER COLUMN owner_id SET DEFAULT auth.uid();
ALTER TABLE public.reply_templates ALTER COLUMN owner_id SET DEFAULT auth.uid();
ALTER TABLE public.inbox_messages ALTER COLUMN owner_id SET DEFAULT auth.uid();
ALTER TABLE public.message_logs ALTER COLUMN owner_id SET DEFAULT auth.uid();

GRANT SELECT, INSERT, UPDATE, DELETE ON public.bot_settings TO authenticated;
GRANT ALL ON public.bot_settings TO service_role;

-- 6. Every new signup gets its own workspace
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin')
    ON CONFLICT (user_id, role) DO NOTHING;
  INSERT INTO public.bot_settings (owner_id) VALUES (NEW.id)
    ON CONFLICT (owner_id) DO NOTHING;
  RETURN NEW;
END;
$function$;

-- Make sure existing accounts have a workspace row + admin role
INSERT INTO public.user_roles (user_id, role)
  SELECT id, 'admin'::app_role FROM auth.users
  ON CONFLICT (user_id, role) DO NOTHING;
INSERT INTO public.bot_settings (owner_id)
  SELECT id FROM auth.users
  ON CONFLICT (owner_id) DO NOTHING;