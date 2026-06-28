INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'::app_role FROM auth.users WHERE email = 'fanueldx25@gmail.com'
ON CONFLICT (user_id, role) DO NOTHING;
DELETE FROM public.user_roles WHERE role = 'user'
  AND user_id = (SELECT id FROM auth.users WHERE email = 'fanueldx25@gmail.com');