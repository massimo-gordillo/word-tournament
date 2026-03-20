/*
  # Start draft tournament RPC

  Prevents race conditions by validating current DB state at start time.
  The tournament can only be started by its creator, while in draft status,
  and only when at least 2 participants are currently joined.
*/

CREATE OR REPLACE FUNCTION start_draft_tournament(p_tournament_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

REVOKE ALL ON FUNCTION start_draft_tournament(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION start_draft_tournament(uuid) TO authenticated;
