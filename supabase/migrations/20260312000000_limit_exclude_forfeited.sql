/*
  # Exclude forfeited tournaments from limit count

  get_tournament_limit_info, create_tournament_draft, and join_tournament_by_code
  should not count tournaments where the user has forfeited when checking the
  max tournaments per user limit.
*/

-- ============================================================================
-- get_tournament_limit_info: exclude forfeited participations from current_count
-- ============================================================================

CREATE OR REPLACE FUNCTION get_tournament_limit_info()
RETURNS TABLE (
  current_count integer,
  max_limit integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

-- ============================================================================
-- create_tournament_draft: exclude forfeited when checking limit before create
-- ============================================================================

CREATE OR REPLACE FUNCTION create_tournament_draft(
  p_name text,
  p_start_date date,
  p_end_date date
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

-- ============================================================================
-- join_tournament_by_code: exclude forfeited when checking limit before join
-- ============================================================================

CREATE OR REPLACE FUNCTION join_tournament_by_code(p_join_code text)
RETURNS uuid AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION get_tournament_limit_info() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_tournament_limit_info() TO authenticated;

REVOKE ALL ON FUNCTION create_tournament_draft(text, date, date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION create_tournament_draft(text, date, date) TO authenticated;

REVOKE ALL ON FUNCTION join_tournament_by_code(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION join_tournament_by_code(text) TO authenticated;
