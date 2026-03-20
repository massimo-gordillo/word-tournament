/*
  # Fix forfeit penalties to be tournament-scoped

  Problem fixed:
  - Inserting "NO SUBMISSION - PENALTY" into daily_submissions during forfeit is global
    per (user_id, submission_date) and unintentionally affects all tournaments.

  New behavior:
  - Forfeit marks only tournament_participants row for that tournament.
  - No daily_submissions row is inserted at forfeit time.
  - Scoring applies -2 per day from forfeiture date onward for that tournament only.
  - User's actual daily submission remains available for tournaments where they are still active.
*/

ALTER TABLE tournament_participants
ADD COLUMN IF NOT EXISTS forfeited_at_date date;

-- Backfill existing forfeited rows so new scoring logic has a baseline date.
UPDATE tournament_participants
SET forfeited_at_date = (now() AT TIME ZONE 'America/New_York')::date
WHERE forfeited = true
  AND forfeited_at_date IS NULL;

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
