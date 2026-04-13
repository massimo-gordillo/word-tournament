-- Create public.users profile when an auth user is created (including before email confirmation).
-- Client inserts fail under RLS when there is no session yet (anon role).

CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_display_name text;
BEGIN
  v_display_name := COALESCE(
    NULLIF(trim(NEW.raw_user_meta_data ->> 'display_name'), ''),
    NULLIF(trim(split_part(NEW.email, '@', 1)), ''),
    'Player'
  );

  INSERT INTO public.users (id, display_name)
  VALUES (NEW.id, v_display_name)
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created_public_profile ON auth.users;

CREATE TRIGGER on_auth_user_created_public_profile
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_auth_user();
