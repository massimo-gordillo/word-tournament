/*
  # Set end_date when auto-closing on forfeit

  When a tournament is closed early because forfeits leave <= 1 active participant,
  set tournaments.end_date to today's EST date so the DB reflects the actual finish date.
*/

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
    SET status = 'closed',
        end_date = v_today
    WHERE id = p_tournament_id
      AND status = 'active';
  END IF;
END;
$$;
