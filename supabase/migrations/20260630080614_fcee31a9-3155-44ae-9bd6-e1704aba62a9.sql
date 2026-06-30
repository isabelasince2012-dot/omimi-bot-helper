
CREATE TABLE public.reply_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.reply_templates TO authenticated;
GRANT ALL ON public.reply_templates TO service_role;

ALTER TABLE public.reply_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage reply templates"
  ON public.reply_templates FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER set_reply_templates_updated_at
  BEFORE UPDATE ON public.reply_templates
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.reply_templates (title, content) VALUES
  ('👋 Welcome', 'Hi {name}! 👋 Thanks for reaching out — how can we help you today?'),
  ('🙏 Thanks', 'Thanks for your message, {name}! We really appreciate it. 🙌'),
  ('🔍 Looking into it', 'Thanks {name} — we''re looking into this right now and will get back to you shortly.'),
  ('✅ Resolved', 'Good news {name}! This has been resolved on our side. Please let us know if you still see any issues.'),
  ('📩 Need more info', 'Hi {name}, could you share a bit more detail (a screenshot or the exact steps you took) so we can help faster?');
