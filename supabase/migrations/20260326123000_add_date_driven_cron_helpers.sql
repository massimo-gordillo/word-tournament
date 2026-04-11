

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE EXTENSION IF NOT EXISTS "pg_net" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgsodium" WITH SCHEMA "pgsodium";






COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgjwt" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE OR REPLACE FUNCTION "public"."can_access_tournament"("p_tournament_id" "uuid", "p_user_id" "uuid") RETURNS boolean
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT
    EXISTS (
      SELECT 1
      FROM tournaments t
      WHERE t.id = p_tournament_id
        AND t.created_by = p_user_id
    )
    OR EXISTS (
      SELECT 1
      FROM tournament_participants tp
      WHERE tp.tournament_id = p_tournament_id
        AND tp.user_id = p_user_id
    );
$$;


ALTER FUNCTION "public"."can_access_tournament"("p_tournament_id" "uuid", "p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."cancel_tournament_draft"("p_tournament_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_created_by uuid;
  v_status text;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT created_by, status
  INTO v_created_by, v_status
  FROM tournaments
  WHERE id = p_tournament_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Tournament not found';
  END IF;

  IF v_created_by <> v_user_id THEN
    RAISE EXCEPTION 'Only the creator can discard this tournament';
  END IF;

  IF v_status <> 'draft' THEN
    RAISE EXCEPTION 'Only draft tournaments can be discarded';
  END IF;

  UPDATE tournaments
  SET status = 'cancelled'
  WHERE id = p_tournament_id;
END;
$$;


ALTER FUNCTION "public"."cancel_tournament_draft"("p_tournament_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."check_all_submissions_complete"("p_tournament_id" "uuid", "p_submission_date" "date") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  total_participants integer;
  total_submissions integer;
BEGIN
  -- Count non-forfeited participants
  SELECT COUNT(*)
  INTO total_participants
  FROM tournament_participants
  WHERE tournament_id = p_tournament_id
    AND forfeited = false;

  -- Count submissions for this date from participants
  SELECT COUNT(DISTINCT ds.user_id)
  INTO total_submissions
  FROM daily_submissions ds
  JOIN tournament_participants tp ON tp.user_id = ds.user_id
  WHERE tp.tournament_id = p_tournament_id
    AND tp.forfeited = false
    AND ds.submission_date = p_submission_date;

  -- Return true if all participants have submitted
  RETURN total_participants > 0 AND total_participants = total_submissions;
END;
$$;


ALTER FUNCTION "public"."check_all_submissions_complete"("p_tournament_id" "uuid", "p_submission_date" "date") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_tournament_draft"("p_name" "text", "p_start_date" "date", "p_end_date" "date") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_tournament_id uuid;
  v_active_count integer;
  v_max_tournaments integer;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_name IS NULL OR length(trim(p_name)) = 0 THEN
    RAISE EXCEPTION 'Tournament name is required';
  END IF;

  IF p_end_date < p_start_date THEN
    RAISE EXCEPTION 'Invalid date range';
  END IF;

  SELECT max_tournaments_per_user
  INTO v_max_tournaments
  FROM app_config
  ORDER BY updated_at DESC
  LIMIT 1;

  IF v_max_tournaments IS NULL THEN
    v_max_tournaments := 4;
  END IF;

  -- Exclude forfeited participations from count
  SELECT COUNT(*)
  INTO v_active_count
  FROM tournament_participants tp
  JOIN tournaments t ON t.id = tp.tournament_id
  WHERE tp.user_id = v_user_id
    AND t.status IN ('draft', 'active')
    AND (tp.forfeited IS NOT TRUE);

  IF v_active_count >= v_max_tournaments THEN
    RAISE EXCEPTION 'You are already in the maximum number of tournaments (%s)', v_max_tournaments;
  END IF;

  INSERT INTO tournaments (name, start_date, end_date, status, created_by)
  VALUES (trim(p_name), p_start_date, p_end_date, 'draft', v_user_id)
  RETURNING id INTO v_tournament_id;

  INSERT INTO tournament_participants (tournament_id, user_id)
  VALUES (v_tournament_id, v_user_id);

  RETURN v_tournament_id;
END;
$$;


ALTER FUNCTION "public"."create_tournament_draft"("p_name" "text", "p_start_date" "date", "p_end_date" "date") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."enforce_daily_submission_cutoff"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_est_now        timestamptz;
  v_today          date;
  v_cutoff_hour    integer;
  v_current_hour   integer;
BEGIN
  -- Current time in America/New_York
  v_est_now := (now() AT TIME ZONE 'America/New_York');
  v_today := v_est_now::date;
  v_current_hour := EXTRACT(HOUR FROM v_est_now);

  -- Load cutoff hour from app_config (fallback to 23 if missing)
  SELECT cutoff_hour_est
  INTO v_cutoff_hour
  FROM app_config
  ORDER BY updated_at DESC
  LIMIT 1;

  IF v_cutoff_hour IS NULL THEN
    v_cutoff_hour := 23;
  END IF;

  -- Block normal user submissions for "today" once cutoff has passed.
  -- Allow system/cron penalty rows which always use the fixed label
  -- 'NO SUBMISSION - PENALTY'.
  IF NEW.submission_date = v_today
     AND v_current_hour >= v_cutoff_hour
     AND NEW.submission_text <> 'NO SUBMISSION - PENALTY' THEN
    RAISE EXCEPTION 'SUBMISSION_CUTOFF_PASSED'
      USING ERRCODE = 'P0001',
            MESSAGE = 'Submission window for today has closed.';
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."enforce_daily_submission_cutoff"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."forfeit_tournament"("p_tournament_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = 'P0001';
  END IF;

  PERFORM forfeit_tournament_internal(p_tournament_id, v_uid);
END;
$$;


ALTER FUNCTION "public"."forfeit_tournament"("p_tournament_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."forfeit_tournament_internal"("p_tournament_id" "uuid", "p_user_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_updated integer;
  v_remaining_active integer;
  v_today date;
BEGIN
  SELECT COUNT(*) INTO v_updated
  FROM tournament_participants
  WHERE tournament_id = p_tournament_id
    AND user_id = p_user_id
    AND forfeited = false;

  IF v_updated = 0 THEN
    RAISE EXCEPTION 'ALREADY_FORFEITED_OR_NOT_PARTICIPANT'
      USING ERRCODE = 'P0001',
            MESSAGE = 'You have already forfeited this tournament or are not a participant.';
  END IF;

  v_today := (now() AT TIME ZONE 'America/New_York')::date;

  -- Mark forfeited for this tournament only and store when forfeiture occurred.
  UPDATE tournament_participants
  SET forfeited = true,
      forfeited_at_date = v_today
  WHERE tournament_id = p_tournament_id
    AND user_id = p_user_id
    AND forfeited = false;

  -- Recalculate tournament scores so the forfeit penalty is reflected immediately
  -- without mutating global daily_submissions for this user/day.
  PERFORM recalculate_tournament_scores(p_tournament_id, v_today);

  SELECT COUNT(*) INTO v_remaining_active
  FROM tournament_participants
  WHERE tournament_id = p_tournament_id
    AND forfeited = false;

  IF v_remaining_active <= 1 THEN
    UPDATE tournaments
    SET status = 'closed',
        end_date = v_today
    WHERE id = p_tournament_id
      AND status = 'active';
  END IF;
END;
$$;


ALTER FUNCTION "public"."forfeit_tournament_internal"("p_tournament_id" "uuid", "p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."generate_join_code"() RETURNS "text"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  result text := '';
  i integer;
BEGIN
  FOR i IN 1..6 LOOP
    result := result || substr(chars, floor(random() * length(chars) + 1)::integer, 1);
  END LOOP;
  RETURN result;
END;
$$;


ALTER FUNCTION "public"."generate_join_code"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_app_config"() RETURNS TABLE("key" "text", "max_tournaments_per_user" integer, "max_participants_per_tournament" integer, "points_guess_1" integer, "points_guess_2" integer, "points_guess_3" integer, "points_guess_4" integer, "points_guess_5" integer, "points_guess_6" integer, "points_missed" integer, "max_submission_rows" integer, "cutoff_hour_est" integer, "auto_forfeit_consecutive_penalties" integer, "updated_at" timestamp with time zone)
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT
    key,
    max_tournaments_per_user,
    max_participants_per_tournament,
    points_guess_1,
    points_guess_2,
    points_guess_3,
    points_guess_4,
    points_guess_5,
    points_guess_6,
    points_missed,
    max_submission_rows,
    cutoff_hour_est,
    auto_forfeit_consecutive_penalties,
    updated_at
  FROM app_config
  ORDER BY updated_at DESC
  LIMIT 1;
$$;


ALTER FUNCTION "public"."get_app_config"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_tournament_limit_info"() RETURNS TABLE("current_count" integer, "max_limit" integer)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_max_limit integer;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT max_tournaments_per_user
  INTO v_max_limit
  FROM app_config
  ORDER BY updated_at DESC
  LIMIT 1;

  IF v_max_limit IS NULL THEN
    v_max_limit := 4;
  END IF;

  RETURN QUERY
  SELECT
    COUNT(*)::integer AS current_count,
    v_max_limit::integer AS max_limit
  FROM tournament_participants tp
  JOIN tournaments t ON t.id = tp.tournament_id
  WHERE tp.user_id = v_user_id
    AND t.status IN ('draft', 'active')
    AND (tp.forfeited IS NOT TRUE);
END;
$$;


ALTER FUNCTION "public"."get_tournament_limit_info"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."join_tournament_by_code"("p_join_code" "text") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_tournament_id uuid;
  v_active_count integer;
  v_participant_count integer;
  v_max_tournaments integer;
  v_max_participants integer;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT
    max_tournaments_per_user,
    max_participants_per_tournament
  INTO
    v_max_tournaments,
    v_max_participants
  FROM app_config
  ORDER BY updated_at DESC
  LIMIT 1;

  IF v_max_tournaments IS NULL THEN
    v_max_tournaments := 5;
  END IF;

  IF v_max_participants IS NULL THEN
    v_max_participants := 10;
  END IF;

  SELECT id
  INTO v_tournament_id
  FROM tournaments
  WHERE upper(join_code) = upper(p_join_code)
    AND status IN ('draft', 'active')
  LIMIT 1;

  IF v_tournament_id IS NULL THEN
    RAISE EXCEPTION 'Invalid or inactive join code';
  END IF;

  -- Prevent banned users from re-joining this tournament
  IF EXISTS (
    SELECT 1
    FROM tournament_bans b
    WHERE b.tournament_id = v_tournament_id
      AND b.user_id = v_user_id
  ) THEN
    RAISE EXCEPTION 'You have been kicked from this tournament';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM tournament_participants tp
    WHERE tp.tournament_id = v_tournament_id
      AND tp.user_id = v_user_id
  ) THEN
    RAISE EXCEPTION 'You are already in this tournament';
  END IF;

  -- Exclude forfeited participations from count
  SELECT COUNT(*)
  INTO v_active_count
  FROM tournament_participants tp
  JOIN tournaments t ON t.id = tp.tournament_id
  WHERE tp.user_id = v_user_id
    AND t.status IN ('draft', 'active')
    AND (tp.forfeited IS NOT TRUE);

  IF v_active_count >= v_max_tournaments THEN
    RAISE EXCEPTION 'You are already in the maximum number of tournaments (%s)', v_max_tournaments;
  END IF;

  SELECT COUNT(*)
  INTO v_participant_count
  FROM tournament_participants tp
  WHERE tp.tournament_id = v_tournament_id;

  IF v_participant_count >= v_max_participants THEN
    RAISE EXCEPTION 'This tournament is full (%s players max)', v_max_participants;
  END IF;

  INSERT INTO tournament_participants (tournament_id, user_id)
  VALUES (v_tournament_id, v_user_id);

  RETURN v_tournament_id;
END;
$$;


ALTER FUNCTION "public"."join_tournament_by_code"("p_join_code" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."kick_tournament_participant"("p_tournament_id" "uuid", "p_user_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_created_by uuid;
  v_status text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT created_by, status
  INTO v_created_by, v_status
  FROM tournaments
  WHERE id = p_tournament_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Tournament not found';
  END IF;

  IF v_created_by <> v_uid THEN
    RAISE EXCEPTION 'Only the creator can remove players from this tournament';
  END IF;

  IF v_status <> 'draft' THEN
    RAISE EXCEPTION 'Players can only be removed while the tournament is in draft status';
  END IF;

  -- Record ban so the user cannot re-join, then remove from participants
  INSERT INTO tournament_bans (tournament_id, user_id)
  VALUES (p_tournament_id, p_user_id)
  ON CONFLICT (tournament_id, user_id) DO NOTHING;

  DELETE FROM tournament_participants
  WHERE tournament_id = p_tournament_id
    AND user_id = p_user_id;
END;
$$;


ALTER FUNCTION "public"."kick_tournament_participant"("p_tournament_id" "uuid", "p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."leave_draft_tournament"("p_tournament_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_created_by uuid;
  v_status text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = 'P0001';
  END IF;

  SELECT created_by, status
  INTO v_created_by, v_status
  FROM tournaments
  WHERE id = p_tournament_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Tournament not found' USING ERRCODE = 'P0001';
  END IF;

  IF v_status <> 'draft' THEN
    RAISE EXCEPTION 'You can only leave a tournament while it is in draft status'
      USING ERRCODE = 'P0001';
  END IF;

  IF v_created_by = v_uid THEN
    RAISE EXCEPTION 'Tournament creator cannot leave their own draft'
      USING ERRCODE = 'P0001';
  END IF;

  DELETE FROM tournament_participants
  WHERE tournament_id = p_tournament_id
    AND user_id = v_uid;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'You are not a participant in this tournament'
      USING ERRCODE = 'P0001';
  END IF;
END;
$$;


ALTER FUNCTION "public"."leave_draft_tournament"("p_tournament_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."parse_wordle_score"("submission_text" "text") RETURNS integer
    LANGUAGE "plpgsql" IMMUTABLE
    AS $$
DECLARE
  rows text[];
  row text;
  row_count integer;
  total_chars integer;
  last_row text;
  v_max_rows integer;
BEGIN
  -- Load max_submission_rows from app_config (defaults to 6)
  SELECT max_submission_rows
  INTO v_max_rows
  FROM app_config
  ORDER BY updated_at DESC
  LIMIT 1;

  IF v_max_rows IS NULL THEN
    v_max_rows := 6;
  END IF;

  -- Collect all non-empty lines
  SELECT array_agg(line)
  INTO rows
  FROM unnest(string_to_array(submission_text, E'\n')) AS line
  WHERE btrim(line) <> '';

  row_count := coalesce(array_length(rows, 1), 0);

  -- Must have at least one row
  IF row_count = 0 THEN
    RAISE EXCEPTION 'Invalid Wordle grid: no rows found';
  END IF;

  -- Enforce maximum rows
  IF row_count > v_max_rows THEN
    RAISE EXCEPTION 'Invalid Wordle grid: too many rows (max %s)', v_max_rows;
  END IF;

  -- Compute total number of B/Y/G characters across all rows
  SELECT sum(length(regexp_replace(line, '[^BYG]', '', 'g')))
  INTO total_chars
  FROM unnest(rows) AS line;

  -- Total chars must be a multiple of 5 and at least 5
  IF total_chars IS NULL OR total_chars < 5 OR total_chars % 5 <> 0 THEN
    RAISE EXCEPTION 'Invalid Wordle grid: total squares must be a multiple of 5 and at least 5';
  END IF;

  -- Each row must be exactly 5 chars from [BYG]
  FOREACH row IN ARRAY rows LOOP
    row := regexp_replace(row, '[^BYG]', '', 'g');
    IF length(row) <> 5 THEN
      RAISE EXCEPTION 'Invalid Wordle grid: each row must contain exactly 5 squares';
    END IF;
  END LOOP;

  last_row := regexp_replace(rows[row_count], '[^BYG]', '', 'g');

  -- If max rows and the last row is not all green, treat as failure (max rows / no success)
  IF row_count = v_max_rows AND last_row <> 'GGGGG' THEN
    RETURN -2;
  END IF;

  -- For fewer than max rows, the final row must be all green
  IF row_count < v_max_rows AND last_row <> 'GGGGG' THEN
    RAISE EXCEPTION 'Invalid Wordle grid: final row must be all green';
  END IF;

  -- Map guess count (row_count) to score (up to 6 guesses)
  RETURN CASE
    WHEN row_count = 1 THEN 20
    WHEN row_count = 2 THEN 8
    WHEN row_count = 3 THEN 6
    WHEN row_count = 4 THEN 4
    WHEN row_count = 5 THEN 2
    WHEN row_count = 6 THEN 1
    ELSE -2
  END;
END;
$$;


ALTER FUNCTION "public"."parse_wordle_score"("submission_text" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."recalculate_tournament_scores"("p_tournament_id" "uuid", "p_submission_date" "date") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  INSERT INTO tournament_scores (tournament_id, user_id, total_score, last_updated)
  SELECT
    tp.tournament_id,
    tp.user_id,
    COALESCE(
      SUM(
        CASE
          -- Tournament-scoped forfeiture penalty from forfeiture date onward
          WHEN tp.forfeited = true
            AND tp.forfeited_at_date IS NOT NULL
            AND d.day >= tp.forfeited_at_date
          THEN -2
          ELSE COALESCE(ds.wordle_score, 0)
        END
      ),
      0
    ) AS total_score,
    now()
  FROM tournament_participants tp
  JOIN tournaments t ON t.id = tp.tournament_id
  JOIN generate_series(
    t.start_date::timestamp,
    LEAST(p_submission_date, t.end_date)::timestamp,
    interval '1 day'
  ) AS d(day) ON true
  LEFT JOIN daily_submissions ds ON ds.user_id = tp.user_id
    AND ds.submission_date = d.day::date
  WHERE tp.tournament_id = p_tournament_id
    AND t.status IN ('active', 'closed')
  GROUP BY tp.tournament_id, tp.user_id, tp.forfeited, tp.forfeited_at_date
  ON CONFLICT (tournament_id, user_id)
  DO UPDATE SET
    total_score = EXCLUDED.total_score,
    last_updated = EXCLUDED.last_updated;
END;
$$;


ALTER FUNCTION "public"."recalculate_tournament_scores"("p_tournament_id" "uuid", "p_submission_date" "date") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."run_daily_cron"() RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_today_est date;
BEGIN
  v_today_est := (now() AT TIME ZONE 'America/New_York')::date;
  PERFORM run_daily_cron_for_date(v_today_est);
END;
$$;


ALTER FUNCTION "public"."run_daily_cron"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."run_daily_cron_for_active_tournaments_range"("p_max_date" "date") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_start date;
  v_end   date;
  v_day   date;
BEGIN
  SELECT MIN(start_date), MAX(end_date)
  INTO v_start, v_end
  FROM tournaments
  WHERE status = 'active';

  IF v_start IS NULL OR v_end IS NULL THEN
    RETURN;
  END IF;

  IF v_end > p_max_date THEN
    v_end := p_max_date;
  END IF;

  IF v_start > v_end THEN
    RETURN;
  END IF;

  v_day := v_start;
  WHILE v_day <= v_end LOOP
    PERFORM run_daily_cron_for_date(v_day);
    v_day := v_day + INTERVAL '1 day';
  END LOOP;
END;
$$;


ALTER FUNCTION "public"."run_daily_cron_for_active_tournaments_range"("p_max_date" "date") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."run_daily_cron_for_date"("p_run_date" "date") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  today_date date := p_run_date;
  v_auto_n integer;
  first_streak_day date;
  v_eligible record;
BEGIN
  -- Load auto-forfeit config: number of consecutive penalty days before auto-forfeit
  SELECT auto_forfeit_consecutive_penalties
  INTO v_auto_n
  FROM app_config
  ORDER BY updated_at DESC
  LIMIT 1;

  IF v_auto_n IS NULL OR v_auto_n < 1 THEN
    v_auto_n := 3;
  END IF;

  -- First day of the streak window we care about (last N days including today)
  first_streak_day := today_date - (v_auto_n - 1);

  -- ============================================================================
  -- STEP 1: Apply penalties for missing submissions (for today_date)
  -- ============================================================================
  INSERT INTO daily_submissions (user_id, submission_date, submission_text, wordle_score, submitted_at)
  SELECT DISTINCT
    tp.user_id,
    today_date,
    'NO SUBMISSION - PENALTY',
    -2,
    now()
  FROM tournament_participants tp
  JOIN tournaments t ON t.id = tp.tournament_id
  WHERE
    t.status = 'active'
    AND today_date >= t.start_date
    AND today_date <= t.end_date
    AND tp.forfeited = false
    AND NOT EXISTS (
      SELECT 1 FROM daily_submissions ds
      WHERE ds.user_id = tp.user_id
        AND ds.submission_date = today_date
    )
  ON CONFLICT (user_id, submission_date) DO NOTHING;

  -- ============================================================================
  -- STEP 2: Recalculate tournament scores up to today_date
  -- ============================================================================
  INSERT INTO tournament_scores (tournament_id, user_id, total_score, last_updated)
  SELECT
    tp.tournament_id,
    tp.user_id,
    COALESCE(SUM(ds.wordle_score), 0) AS total_score,
    now()
  FROM tournament_participants tp
  JOIN tournaments t ON t.id = tp.tournament_id
  LEFT JOIN daily_submissions ds ON ds.user_id = tp.user_id
    AND ds.submission_date >= t.start_date
    AND ds.submission_date <= today_date
    AND ds.submission_date <= t.end_date
  WHERE t.status IN ('active', 'closed')
  GROUP BY tp.tournament_id, tp.user_id, tp.forfeited
  ON CONFLICT (tournament_id, user_id)
  DO UPDATE SET
    total_score = EXCLUDED.total_score,
    last_updated = EXCLUDED.last_updated;

  -- ============================================================================
  -- STEP 2b: Auto-forfeit users with N consecutive penalty days ending today_date
  -- ============================================================================
  FOR v_eligible IN
    SELECT
      tp.tournament_id,
      tp.user_id
    FROM tournament_participants tp
    JOIN tournaments t ON t.id = tp.tournament_id
    WHERE
      t.status = 'active'
      AND tp.forfeited = false
      AND t.start_date >= first_streak_day
      AND (
        SELECT COUNT(DISTINCT ds.submission_date)
        FROM daily_submissions ds
        WHERE ds.user_id = tp.user_id
          AND ds.submission_text = 'NO SUBMISSION - PENALTY'
          AND ds.submission_date BETWEEN first_streak_day AND today_date
      ) >= v_auto_n
  LOOP
    PERFORM forfeit_tournament_internal(v_eligible.tournament_id, v_eligible.user_id);
  END LOOP;

  -- ============================================================================
  -- STEP 3: Close tournaments that have reached (or passed) their end date
  -- ============================================================================
  UPDATE tournaments
  SET status = 'closed'
  WHERE status = 'active'
    AND end_date <= today_date;
END;
$$;


ALTER FUNCTION "public"."run_daily_cron_for_date"("p_run_date" "date") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."share_any_tournament"("p_user_a" "uuid", "p_user_b" "uuid") RETURNS boolean
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM tournament_participants a
    JOIN tournament_participants b
      ON a.tournament_id = b.tournament_id
    WHERE a.user_id = p_user_a
      AND b.user_id = p_user_b
  );
$$;


ALTER FUNCTION "public"."share_any_tournament"("p_user_a" "uuid", "p_user_b" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."start_draft_tournament"("p_tournament_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_created_by uuid;
  v_status text;
  v_start_date date;
  v_end_date date;
  v_duration_days integer;
  v_today date;
  v_new_end_date date;
  v_participant_count integer;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'NOT_AUTHENTICATED' USING ERRCODE = 'P0001';
  END IF;

  SELECT created_by, status, start_date, end_date
  INTO v_created_by, v_status, v_start_date, v_end_date
  FROM tournaments
  WHERE id = p_tournament_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'TOURNAMENT_NOT_FOUND' USING ERRCODE = 'P0001';
  END IF;

  IF v_created_by <> v_uid THEN
    RAISE EXCEPTION 'ONLY_CREATOR_CAN_START' USING ERRCODE = 'P0001';
  END IF;

  IF v_status <> 'draft' THEN
    RAISE EXCEPTION 'TOURNAMENT_NOT_DRAFT' USING ERRCODE = 'P0001';
  END IF;

  SELECT COUNT(*)
  INTO v_participant_count
  FROM tournament_participants
  WHERE tournament_id = p_tournament_id;

  IF v_participant_count < 2 THEN
    RAISE EXCEPTION 'NOT_ENOUGH_PLAYERS' USING ERRCODE = 'P0001';
  END IF;

  v_duration_days := (v_end_date - v_start_date) + 1;
  IF v_duration_days < 1 THEN
    RAISE EXCEPTION 'INVALID_TOURNAMENT_DURATION' USING ERRCODE = 'P0001';
  END IF;

  v_today := (now() AT TIME ZONE 'America/New_York')::date;
  v_new_end_date := v_today + (v_duration_days - 1);

  UPDATE tournaments
  SET
    status = 'active',
    start_date = v_today,
    end_date = v_new_end_date
  WHERE id = p_tournament_id
    AND status = 'draft';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'TOURNAMENT_NOT_DRAFT' USING ERRCODE = 'P0001';
  END IF;
END;
$$;


ALTER FUNCTION "public"."start_draft_tournament"("p_tournament_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trigger_leaderboard_update"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  active_tournament record;
  all_complete boolean;
  function_url text;
BEGIN
  -- Get Supabase URL from environment (this will be the project URL)
  function_url := current_setting('app.settings.supabase_url', true) || '/functions/v1/update-leaderboard';

  -- For each active tournament the user is in
  FOR active_tournament IN
    SELECT t.id, t.start_date, t.end_date
    FROM tournaments t
    JOIN tournament_participants tp ON tp.tournament_id = t.id
    WHERE tp.user_id = NEW.user_id
      AND t.status = 'active'
      AND NEW.submission_date >= t.start_date
      AND NEW.submission_date <= t.end_date
  LOOP
    -- Check if all submissions are complete for this tournament and date
    all_complete := check_all_submissions_complete(
      active_tournament.id,
      NEW.submission_date
    );

    -- If all complete, trigger immediate leaderboard update
    IF all_complete THEN
      -- Call the edge function using pg_net extension (if available)
      -- Note: This requires pg_net extension to be enabled
      -- Alternative: Update scores directly here
      PERFORM recalculate_tournament_scores(
        active_tournament.id,
        NEW.submission_date
      );
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."trigger_leaderboard_update"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_tournament_scores_on_submission"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  INSERT INTO tournament_scores (tournament_id, user_id, total_score, last_updated)
  SELECT
    tp.tournament_id,
    NEW.user_id,
    COALESCE(SUM(ds.wordle_score), 0) as total_score,
    now()
  FROM tournament_participants tp
  JOIN tournaments t ON t.id = tp.tournament_id
  LEFT JOIN daily_submissions ds ON ds.user_id = NEW.user_id
    AND ds.submission_date >= t.start_date
    AND ds.submission_date <= t.end_date
  WHERE tp.user_id = NEW.user_id
    AND t.status IN ('active', 'closed')
    AND tp.forfeited = false
    AND NEW.submission_date >= t.start_date
    AND NEW.submission_date <= t.end_date
  GROUP BY tp.tournament_id, NEW.user_id
  ON CONFLICT (tournament_id, user_id)
  DO UPDATE SET
    total_score = EXCLUDED.total_score,
    last_updated = EXCLUDED.last_updated;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_tournament_scores_on_submission"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."app_config" (
    "key" "text" NOT NULL,
    "max_tournaments_per_user" integer DEFAULT 5 NOT NULL,
    "max_participants_per_tournament" integer DEFAULT 15 NOT NULL,
    "points_guess_1" integer DEFAULT 20 NOT NULL,
    "points_guess_2" integer DEFAULT 8 NOT NULL,
    "points_guess_3" integer DEFAULT 6 NOT NULL,
    "points_guess_4" integer DEFAULT 4 NOT NULL,
    "points_guess_5" integer DEFAULT 2 NOT NULL,
    "points_guess_6" integer DEFAULT 1 NOT NULL,
    "points_missed" integer DEFAULT '-2'::integer NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "max_submission_rows" integer DEFAULT 6 NOT NULL,
    "cutoff_hour_est" integer DEFAULT 23 NOT NULL,
    "auto_forfeit_consecutive_penalties" integer DEFAULT 3 NOT NULL
);


ALTER TABLE "public"."app_config" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."daily_submissions" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "submission_date" "date" NOT NULL,
    "submission_text" "text" NOT NULL,
    "wordle_score" integer NOT NULL,
    "submitted_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."daily_submissions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tournament_bans" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "tournament_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."tournament_bans" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tournament_chat" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tournament_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "message" "text" NOT NULL,
    "message_type" "text" NOT NULL,
    "submission_date" "date",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "daily_submission_id" "uuid",
    CONSTRAINT "tournament_chat_message_len" CHECK (("char_length"("message") <= 400)),
    CONSTRAINT "tournament_chat_message_type_check" CHECK (("message_type" = ANY (ARRAY['chat'::"text", 'result'::"text"]))),
    CONSTRAINT "tournament_chat_submission_date_matches_type" CHECK (((("message_type" = 'chat'::"text") AND ("submission_date" IS NULL)) OR (("message_type" = 'result'::"text") AND ("submission_date" IS NOT NULL))))
);


ALTER TABLE "public"."tournament_chat" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tournament_participants" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "tournament_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "forfeited" boolean DEFAULT false,
    "joined_at" timestamp with time zone DEFAULT "now"(),
    "forfeited_at_date" "date"
);


ALTER TABLE "public"."tournament_participants" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tournament_scores" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "tournament_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "total_score" integer DEFAULT 0,
    "last_updated" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."tournament_scores" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tournaments" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "name" "text" NOT NULL,
    "join_code" "text" DEFAULT "public"."generate_join_code"() NOT NULL,
    "start_date" "date" NOT NULL,
    "end_date" "date" NOT NULL,
    "status" "text" DEFAULT 'draft'::"text" NOT NULL,
    "created_by" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "tournaments_status_check" CHECK (("status" = ANY (ARRAY['draft'::"text", 'active'::"text", 'closed'::"text", 'cancelled'::"text"]))),
    CONSTRAINT "valid_date_range" CHECK (("end_date" >= "start_date"))
);


ALTER TABLE "public"."tournaments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."users" (
    "id" "uuid" NOT NULL,
    "display_name" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."users" OWNER TO "postgres";


ALTER TABLE ONLY "public"."app_config"
    ADD CONSTRAINT "app_config_pkey" PRIMARY KEY ("key");



ALTER TABLE ONLY "public"."daily_submissions"
    ADD CONSTRAINT "daily_submissions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."daily_submissions"
    ADD CONSTRAINT "daily_submissions_user_id_submission_date_key" UNIQUE ("user_id", "submission_date");



ALTER TABLE ONLY "public"."tournament_bans"
    ADD CONSTRAINT "tournament_bans_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tournament_bans"
    ADD CONSTRAINT "tournament_bans_tournament_id_user_id_key" UNIQUE ("tournament_id", "user_id");



ALTER TABLE ONLY "public"."tournament_chat"
    ADD CONSTRAINT "tournament_chat_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tournament_participants"
    ADD CONSTRAINT "tournament_participants_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tournament_participants"
    ADD CONSTRAINT "tournament_participants_tournament_id_user_id_key" UNIQUE ("tournament_id", "user_id");



ALTER TABLE ONLY "public"."tournament_scores"
    ADD CONSTRAINT "tournament_scores_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tournament_scores"
    ADD CONSTRAINT "tournament_scores_tournament_id_user_id_key" UNIQUE ("tournament_id", "user_id");



ALTER TABLE ONLY "public"."tournaments"
    ADD CONSTRAINT "tournaments_join_code_key" UNIQUE ("join_code");



ALTER TABLE ONLY "public"."tournaments"
    ADD CONSTRAINT "tournaments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_pkey" PRIMARY KEY ("id");



CREATE INDEX "idx_daily_submissions_date" ON "public"."daily_submissions" USING "btree" ("submission_date");



CREATE INDEX "idx_daily_submissions_user_id" ON "public"."daily_submissions" USING "btree" ("user_id");



CREATE INDEX "idx_tournament_chat_daily_submission_id" ON "public"."tournament_chat" USING "btree" ("daily_submission_id") WHERE ("daily_submission_id" IS NOT NULL);



CREATE INDEX "idx_tournament_chat_tournament_created" ON "public"."tournament_chat" USING "btree" ("tournament_id", "created_at");



CREATE INDEX "idx_tournament_participants_tournament_id" ON "public"."tournament_participants" USING "btree" ("tournament_id");



CREATE INDEX "idx_tournament_participants_user_id" ON "public"."tournament_participants" USING "btree" ("user_id");



CREATE INDEX "idx_tournament_scores_tournament_id" ON "public"."tournament_scores" USING "btree" ("tournament_id");



CREATE INDEX "idx_tournament_scores_user_id" ON "public"."tournament_scores" USING "btree" ("user_id");



CREATE INDEX "idx_tournaments_created_by" ON "public"."tournaments" USING "btree" ("created_by");



CREATE INDEX "idx_tournaments_join_code" ON "public"."tournaments" USING "btree" ("join_code");



CREATE INDEX "idx_tournaments_status" ON "public"."tournaments" USING "btree" ("status");



CREATE OR REPLACE TRIGGER "enforce_daily_submission_cutoff" BEFORE INSERT ON "public"."daily_submissions" FOR EACH ROW EXECUTE FUNCTION "public"."enforce_daily_submission_cutoff"();



CREATE OR REPLACE TRIGGER "on_submission_check_leaderboard" AFTER INSERT ON "public"."daily_submissions" FOR EACH ROW EXECUTE FUNCTION "public"."trigger_leaderboard_update"();



CREATE OR REPLACE TRIGGER "on_submission_update_scores" AFTER INSERT ON "public"."daily_submissions" FOR EACH ROW EXECUTE FUNCTION "public"."update_tournament_scores_on_submission"();



ALTER TABLE ONLY "public"."daily_submissions"
    ADD CONSTRAINT "daily_submissions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tournament_bans"
    ADD CONSTRAINT "tournament_bans_tournament_id_fkey" FOREIGN KEY ("tournament_id") REFERENCES "public"."tournaments"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tournament_bans"
    ADD CONSTRAINT "tournament_bans_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tournament_chat"
    ADD CONSTRAINT "tournament_chat_daily_submission_id_fkey" FOREIGN KEY ("daily_submission_id") REFERENCES "public"."daily_submissions"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."tournament_chat"
    ADD CONSTRAINT "tournament_chat_tournament_id_fkey" FOREIGN KEY ("tournament_id") REFERENCES "public"."tournaments"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tournament_chat"
    ADD CONSTRAINT "tournament_chat_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tournament_participants"
    ADD CONSTRAINT "tournament_participants_tournament_id_fkey" FOREIGN KEY ("tournament_id") REFERENCES "public"."tournaments"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tournament_participants"
    ADD CONSTRAINT "tournament_participants_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tournament_scores"
    ADD CONSTRAINT "tournament_scores_tournament_id_fkey" FOREIGN KEY ("tournament_id") REFERENCES "public"."tournaments"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tournament_scores"
    ADD CONSTRAINT "tournament_scores_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tournaments"
    ADD CONSTRAINT "tournaments_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



CREATE POLICY "Creators can delete draft tournaments" ON "public"."tournaments" FOR DELETE TO "authenticated" USING ((("auth"."uid"() = "created_by") AND ("status" = 'draft'::"text")));



CREATE POLICY "Creators can update their tournaments" ON "public"."tournaments" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "created_by")) WITH CHECK (("auth"."uid"() = "created_by"));



CREATE POLICY "Participants can insert chat in active or closed tournaments" ON "public"."tournament_chat" FOR INSERT TO "authenticated" WITH CHECK ((("user_id" = "auth"."uid"()) AND (EXISTS ( SELECT 1
   FROM ("public"."tournament_participants" "tp"
     JOIN "public"."tournaments" "t" ON (("t"."id" = "tp"."tournament_id")))
  WHERE (("tp"."tournament_id" = "tournament_chat"."tournament_id") AND ("tp"."user_id" = "auth"."uid"()) AND ("t"."status" = ANY (ARRAY['active'::"text", 'closed'::"text"])))))));



CREATE POLICY "Participants can read chat in active or closed tournaments" ON "public"."tournament_chat" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."tournament_participants" "tp"
     JOIN "public"."tournaments" "t" ON (("t"."id" = "tp"."tournament_id")))
  WHERE (("tp"."tournament_id" = "tournament_chat"."tournament_id") AND ("tp"."user_id" = "auth"."uid"()) AND ("t"."status" = ANY (ARRAY['active'::"text", 'closed'::"text"]))))));



CREATE POLICY "Users can create tournaments they own" ON "public"."tournaments" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "created_by"));



CREATE POLICY "Users can insert their own daily submission" ON "public"."daily_submissions" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert their own profile" ON "public"."users" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "id"));



CREATE POLICY "Users can leave tournaments" ON "public"."tournament_participants" FOR DELETE TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can read accessible tournaments" ON "public"."tournaments" FOR SELECT TO "authenticated" USING ((("status" = ANY (ARRAY['draft'::"text", 'active'::"text", 'closed'::"text"])) AND "public"."can_access_tournament"("id", "auth"."uid"())));



CREATE POLICY "Users can read all user profiles" ON "public"."users" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Users can read participants of accessible tournaments" ON "public"."tournament_participants" FOR SELECT TO "authenticated" USING ("public"."can_access_tournament"("tournament_id", "auth"."uid"()));



CREATE POLICY "Users can read scores for accessible tournaments" ON "public"."tournament_scores" FOR SELECT TO "authenticated" USING ("public"."can_access_tournament"("tournament_id", "auth"."uid"()));



CREATE POLICY "Users can read submissions from shared tournaments" ON "public"."daily_submissions" FOR SELECT TO "authenticated" USING ("public"."share_any_tournament"("auth"."uid"(), "user_id"));



CREATE POLICY "Users can read their own submissions" ON "public"."daily_submissions" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can update their own participation" ON "public"."tournament_participants" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update their own profile" ON "public"."users" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "id")) WITH CHECK (("auth"."uid"() = "id"));



ALTER TABLE "public"."daily_submissions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tournament_chat" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tournament_participants" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tournament_scores" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tournaments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."users" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";





GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";


























































































































































































REVOKE ALL ON FUNCTION "public"."can_access_tournament"("p_tournament_id" "uuid", "p_user_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."can_access_tournament"("p_tournament_id" "uuid", "p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."can_access_tournament"("p_tournament_id" "uuid", "p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."can_access_tournament"("p_tournament_id" "uuid", "p_user_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."cancel_tournament_draft"("p_tournament_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."cancel_tournament_draft"("p_tournament_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."cancel_tournament_draft"("p_tournament_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."cancel_tournament_draft"("p_tournament_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."check_all_submissions_complete"("p_tournament_id" "uuid", "p_submission_date" "date") TO "anon";
GRANT ALL ON FUNCTION "public"."check_all_submissions_complete"("p_tournament_id" "uuid", "p_submission_date" "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_all_submissions_complete"("p_tournament_id" "uuid", "p_submission_date" "date") TO "service_role";



REVOKE ALL ON FUNCTION "public"."create_tournament_draft"("p_name" "text", "p_start_date" "date", "p_end_date" "date") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."create_tournament_draft"("p_name" "text", "p_start_date" "date", "p_end_date" "date") TO "anon";
GRANT ALL ON FUNCTION "public"."create_tournament_draft"("p_name" "text", "p_start_date" "date", "p_end_date" "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_tournament_draft"("p_name" "text", "p_start_date" "date", "p_end_date" "date") TO "service_role";



GRANT ALL ON FUNCTION "public"."enforce_daily_submission_cutoff"() TO "anon";
GRANT ALL ON FUNCTION "public"."enforce_daily_submission_cutoff"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."enforce_daily_submission_cutoff"() TO "service_role";



GRANT ALL ON FUNCTION "public"."forfeit_tournament"("p_tournament_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."forfeit_tournament"("p_tournament_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."forfeit_tournament"("p_tournament_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."forfeit_tournament_internal"("p_tournament_id" "uuid", "p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."forfeit_tournament_internal"("p_tournament_id" "uuid", "p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."forfeit_tournament_internal"("p_tournament_id" "uuid", "p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."generate_join_code"() TO "anon";
GRANT ALL ON FUNCTION "public"."generate_join_code"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."generate_join_code"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_app_config"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_app_config"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_app_config"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_app_config"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_tournament_limit_info"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_tournament_limit_info"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_tournament_limit_info"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_tournament_limit_info"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."join_tournament_by_code"("p_join_code" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."join_tournament_by_code"("p_join_code" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."join_tournament_by_code"("p_join_code" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."join_tournament_by_code"("p_join_code" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."kick_tournament_participant"("p_tournament_id" "uuid", "p_user_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."kick_tournament_participant"("p_tournament_id" "uuid", "p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."kick_tournament_participant"("p_tournament_id" "uuid", "p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."kick_tournament_participant"("p_tournament_id" "uuid", "p_user_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."leave_draft_tournament"("p_tournament_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."leave_draft_tournament"("p_tournament_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."leave_draft_tournament"("p_tournament_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."leave_draft_tournament"("p_tournament_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."parse_wordle_score"("submission_text" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."parse_wordle_score"("submission_text" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."parse_wordle_score"("submission_text" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."recalculate_tournament_scores"("p_tournament_id" "uuid", "p_submission_date" "date") TO "anon";
GRANT ALL ON FUNCTION "public"."recalculate_tournament_scores"("p_tournament_id" "uuid", "p_submission_date" "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."recalculate_tournament_scores"("p_tournament_id" "uuid", "p_submission_date" "date") TO "service_role";



GRANT ALL ON FUNCTION "public"."run_daily_cron"() TO "anon";
GRANT ALL ON FUNCTION "public"."run_daily_cron"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."run_daily_cron"() TO "service_role";



GRANT ALL ON FUNCTION "public"."run_daily_cron_for_active_tournaments_range"("p_max_date" "date") TO "anon";
GRANT ALL ON FUNCTION "public"."run_daily_cron_for_active_tournaments_range"("p_max_date" "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."run_daily_cron_for_active_tournaments_range"("p_max_date" "date") TO "service_role";



GRANT ALL ON FUNCTION "public"."run_daily_cron_for_date"("p_run_date" "date") TO "anon";
GRANT ALL ON FUNCTION "public"."run_daily_cron_for_date"("p_run_date" "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."run_daily_cron_for_date"("p_run_date" "date") TO "service_role";



REVOKE ALL ON FUNCTION "public"."share_any_tournament"("p_user_a" "uuid", "p_user_b" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."share_any_tournament"("p_user_a" "uuid", "p_user_b" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."share_any_tournament"("p_user_a" "uuid", "p_user_b" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."share_any_tournament"("p_user_a" "uuid", "p_user_b" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."start_draft_tournament"("p_tournament_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."start_draft_tournament"("p_tournament_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."start_draft_tournament"("p_tournament_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."start_draft_tournament"("p_tournament_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."trigger_leaderboard_update"() TO "anon";
GRANT ALL ON FUNCTION "public"."trigger_leaderboard_update"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trigger_leaderboard_update"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_tournament_scores_on_submission"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_tournament_scores_on_submission"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_tournament_scores_on_submission"() TO "service_role";


















GRANT ALL ON TABLE "public"."app_config" TO "anon";
GRANT ALL ON TABLE "public"."app_config" TO "authenticated";
GRANT ALL ON TABLE "public"."app_config" TO "service_role";



GRANT ALL ON TABLE "public"."daily_submissions" TO "anon";
GRANT ALL ON TABLE "public"."daily_submissions" TO "authenticated";
GRANT ALL ON TABLE "public"."daily_submissions" TO "service_role";



GRANT ALL ON TABLE "public"."tournament_bans" TO "anon";
GRANT ALL ON TABLE "public"."tournament_bans" TO "authenticated";
GRANT ALL ON TABLE "public"."tournament_bans" TO "service_role";



GRANT ALL ON TABLE "public"."tournament_chat" TO "anon";
GRANT ALL ON TABLE "public"."tournament_chat" TO "authenticated";
GRANT ALL ON TABLE "public"."tournament_chat" TO "service_role";



GRANT ALL ON TABLE "public"."tournament_participants" TO "anon";
GRANT ALL ON TABLE "public"."tournament_participants" TO "authenticated";
GRANT ALL ON TABLE "public"."tournament_participants" TO "service_role";



GRANT ALL ON TABLE "public"."tournament_scores" TO "anon";
GRANT ALL ON TABLE "public"."tournament_scores" TO "authenticated";
GRANT ALL ON TABLE "public"."tournament_scores" TO "service_role";



GRANT ALL ON TABLE "public"."tournaments" TO "anon";
GRANT ALL ON TABLE "public"."tournaments" TO "authenticated";
GRANT ALL ON TABLE "public"."tournaments" TO "service_role";



GRANT ALL ON TABLE "public"."users" TO "anon";
GRANT ALL ON TABLE "public"."users" TO "authenticated";
GRANT ALL ON TABLE "public"."users" TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "service_role";






























RESET ALL;

--
-- Dumped schema changes for auth and storage
--

