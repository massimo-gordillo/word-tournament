/*
  # Ensure tournaments auto-close when only one active participant remains

  Why:
  - Some environments can drift when older migration files are edited after they have
    already been applied.
  - This migration re-applies the forfeit RPC logic and includes a one-time backfill
    for tournaments that are currently stuck in 'active' with <= 1 non-forfeited participant.
*/

-- Keep score calculation based on summed daily submissions (including penalties)
CREATE OR REPLACE FUNCTION recalculate_tournament_scores(
  p_tournament_id uuid,
  p_submission_date date
)
RETURNS void AS $$
BEGIN
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
    AND ds.submission_date <= p_submission_date
    AND ds.submission_date <= t.end_date
  WHERE tp.tournament_id = p_tournament_id
    AND t.status = 'active'
  GROUP BY tp.tournament_id, tp.user_id, tp.forfeited
  ON CONFLICT (tournament_id, user_id)
  DO UPDATE SET
    total_score = EXCLUDED.total_score,
    last_updated = EXCLUDED.last_updated;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION forfeit_tournament_internal(
  p_tournament_id uuid,
  p_user_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_updated integer;
  v_remaining_active integer;
  v_today date;
  v_tournament record;
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

  UPDATE tournament_participants
  SET forfeited = true
  WHERE tournament_id = p_tournament_id
    AND user_id = p_user_id
    AND forfeited = false;

  v_today := (now() AT TIME ZONE 'America/New_York')::date;

  SELECT id, start_date, end_date, status
  INTO v_tournament
  FROM tournaments
  WHERE id = p_tournament_id;

  IF v_tournament.status = 'active'
     AND v_today >= v_tournament.start_date
     AND v_today <= v_tournament.end_date THEN
    IF NOT EXISTS (
      SELECT 1
      FROM daily_submissions ds
      WHERE ds.user_id = p_user_id
        AND ds.submission_date = v_today
    ) THEN
      INSERT INTO daily_submissions (user_id, submission_date, submission_text, wordle_score, submitted_at)
      VALUES (p_user_id, v_today, 'NO SUBMISSION - PENALTY', -2, now());
    END IF;

    PERFORM recalculate_tournament_scores(p_tournament_id, v_today);
  END IF;

  SELECT COUNT(*) INTO v_remaining_active
  FROM tournament_participants
  WHERE tournament_id = p_tournament_id
    AND forfeited = false;

  IF v_remaining_active <= 1 THEN
    UPDATE tournaments
    SET status = 'closed'
    WHERE id = p_tournament_id
      AND status = 'active';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION forfeit_tournament(p_tournament_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

GRANT EXECUTE ON FUNCTION forfeit_tournament(uuid) TO authenticated;

-- Backfill: close any active tournament that already has <=1 non-forfeited participant.
UPDATE tournaments t
SET status = 'closed'
WHERE t.status = 'active'
  AND (
    SELECT COUNT(*)
    FROM tournament_participants tp
    WHERE tp.tournament_id = t.id
      AND tp.forfeited = false
  ) <= 1;
