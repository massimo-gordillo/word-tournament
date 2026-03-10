/*
  # Store Wordle submissions as chars (B/Y/G)

  - Clear existing daily_submissions (destructive, acceptable per requirements).
  - Update parse_wordle_score to expect B/Y/G instead of emoji.
*/

TRUNCATE TABLE daily_submissions CASCADE;

CREATE OR REPLACE FUNCTION parse_wordle_score(submission_text text)
RETURNS integer AS $$
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
$$ LANGUAGE plpgsql IMMUTABLE;

