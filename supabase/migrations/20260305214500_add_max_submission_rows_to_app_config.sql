/*
  # Add max_submission_rows to app_config

  Note: We need to DROP and recreate get_app_config to change its return type.
*/

ALTER TABLE app_config
ADD COLUMN IF NOT EXISTS max_submission_rows integer NOT NULL DEFAULT 6;

-- Drop the old function so we can change its return type
DROP FUNCTION IF EXISTS get_app_config();

CREATE OR REPLACE FUNCTION get_app_config()
RETURNS TABLE (
  key text,
  max_tournaments_per_user integer,
  max_participants_per_tournament integer,
  points_guess_1 integer,
  points_guess_2 integer,
  points_guess_3 integer,
  points_guess_4 integer,
  points_guess_5 integer,
  points_guess_6 integer,
  points_missed integer,
  max_submission_rows integer,
  updated_at timestamptz
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
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
    updated_at
  FROM app_config
  ORDER BY updated_at DESC
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION get_app_config() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_app_config() TO authenticated;

