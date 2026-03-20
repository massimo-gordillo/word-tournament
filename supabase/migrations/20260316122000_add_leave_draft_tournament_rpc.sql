/*
  # Leave draft tournament RPC

  Allows a non-creator participant to leave a tournament while it is still in draft status.
*/

CREATE OR REPLACE FUNCTION leave_draft_tournament(p_tournament_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

REVOKE ALL ON FUNCTION leave_draft_tournament(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION leave_draft_tournament(uuid) TO authenticated;
