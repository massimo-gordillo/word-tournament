/*
  # Tournament limit info RPC

  Returns how many draft/active tournaments the current user is in,
  and the maximum allowed, so the client can gate UI before showing
  create/join prompts.
*/

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
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  RETURN QUERY
  SELECT
    COUNT(*)::integer AS current_count,
    4::integer AS max_limit
  FROM tournament_participants tp
  JOIN tournaments t ON t.id = tp.tournament_id
  WHERE tp.user_id = v_user_id
    AND t.status IN ('draft', 'active');
END;
$$;

REVOKE ALL ON FUNCTION get_tournament_limit_info() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_tournament_limit_info() TO authenticated;

