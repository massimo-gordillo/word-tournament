/*
  # Cancel (discard) a draft tournament

  Lets the creator move a draft tournament to status 'cancelled'.
  Uses SECURITY DEFINER so it is not blocked by RLS, while still
  enforcing:
  - caller is authenticated
  - caller is the creator
  - tournament is currently in 'draft' status
*/

CREATE OR REPLACE FUNCTION cancel_tournament_draft(p_tournament_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

REVOKE ALL ON FUNCTION cancel_tournament_draft(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION cancel_tournament_draft(uuid) TO authenticated;

