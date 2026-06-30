ALTER TABLE public.broadcasts
  ADD COLUMN IF NOT EXISTS audience_days integer,
  ADD COLUMN IF NOT EXISTS audience_user_ids uuid[];