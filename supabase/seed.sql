-- Seed data used by local reset and optional linked-remote push include-seed.
--
-- Google Play / demo reviewer login is generated from .env (see npm run supabase:seed and
-- supabase/seed_play_review.generated.sql). Postgres cannot read .env directly.
--
-- Set in repo-root .env (optional; defaults are used if unset):
--   SUPABASE_PLAY_REVIEW_PASSWORD=...
--   SUPABASE_PLAY_REVIEW_EMAIL=play-review@wordle-tracker.invalid
--
-- Preferred automated flow:
--   npm run supabase:db:push   (linked remote, includes seed)
--   npm run supabase:db:reset  (local reset, includes seed)
--
-- Manual hosted fallback: create the user in Supabase Dashboard (Authentication) with the
-- email/password you give Google, then if needed:
--   INSERT INTO public.users (id, display_name)
--   SELECT id, 'Google Play Review' FROM auth.users WHERE email = 'your-email@example.com'
--   ON CONFLICT (id) DO NOTHING;

CREATE EXTENSION IF NOT EXISTS "pgcrypto";
