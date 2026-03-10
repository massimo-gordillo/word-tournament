/*
  # parse_wordle_score: reject invalid grids

  Change: instead of returning -2 on invalid input, raise an error
  so the backend rejects malformed grids outright, except for the
  special case:
    - 6 rows where the final row is not all green -> score -2.
*/

CREATE OR REPLACE FUNCTION parse_wordle_score(submission_text text)
RETURNS integer AS $$
DECLARE
  emoji_lines text[];
  row text;
  row_count integer;
  total_squares integer;
  last_row text;
BEGIN
  -- Collect all lines that contain any Wordle emoji
  SELECT array_agg(line)
  INTO emoji_lines
  FROM unnest(string_to_array(submission_text, E'\n')) AS line
  WHERE line ~ '[🟩🟨⬜⬛]';

  row_count := coalesce(array_length(emoji_lines, 1), 0);

  -- Must have at least one emoji row
  IF row_count = 0 THEN
    RAISE EXCEPTION 'Invalid Wordle grid: no emoji rows found';
  END IF;

  -- Compute total number of square emojis across all rows
  SELECT sum(length(regexp_replace(line, '[^🟩🟨⬜⬛]', '', 'g')))
  INTO total_squares
  FROM unnest(emoji_lines) AS line;

  -- Total squares must be a multiple of 5 and at least 5
  IF total_squares IS NULL OR total_squares < 5 OR total_squares % 5 <> 0 THEN
    RAISE EXCEPTION 'Invalid Wordle grid: total squares must be a multiple of 5 and at least 5';
  END IF;

  -- Each row must be exactly 5 squares from the allowed set
  FOREACH row IN ARRAY emoji_lines LOOP
    IF row !~ '^[🟩🟨⬜⬛]{5}$' THEN
      RAISE EXCEPTION 'Invalid Wordle grid: each row must be exactly 5 squares';
    END IF;
  END LOOP;

  last_row := emoji_lines[row_count];

  -- If 6 rows and the last row is not all green, treat as failure (6+ guesses / no success)
  IF row_count = 6 AND last_row !~ '^[🟩]{5}$' THEN
    RETURN -2;
  END IF;

  -- For fewer than 6 rows, the final row must be all green
  IF row_count < 6 AND last_row !~ '^[🟩]{5}$' THEN
    RAISE EXCEPTION 'Invalid Wordle grid: final row must be all green';
  END IF;

  -- Map guess count (row_count) to score
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

