/*
  # parse_wordle_score: tolerate extra characters on emoji lines

  Some clients may include spaces or other characters on the emoji lines.
  We now:
  - Strip everything except [🟩🟨⬜⬛] when validating each row.
  - Require exactly 5 square emojis per row after stripping.
  - Keep the same overall rules:
      - total squares is a multiple of 5 and at least 5
      - 1–6 emoji rows
      - final row all green, except:
          - 6 rows with non-green final row -> score -2 instead of rejection.
*/

CREATE OR REPLACE FUNCTION parse_wordle_score(submission_text text)
RETURNS integer AS $$
DECLARE
  emoji_lines text[];
  row text;
  row_count integer;
  total_squares integer;
  last_row_squares text;
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

  -- Each row must be exactly 5 squares after stripping non-square characters
  FOREACH row IN ARRAY emoji_lines LOOP
    row := regexp_replace(row, '[^🟩🟨⬜⬛]', '', 'g');
    IF length(row) <> 5 THEN
      RAISE EXCEPTION 'Invalid Wordle grid: each row must contain exactly 5 squares';
    END IF;
  END LOOP;

  -- Final row squares (stripped version)
  last_row_squares := regexp_replace(emoji_lines[row_count], '[^🟩🟨⬜⬛]', '', 'g');

  -- If 6 rows and the last row is not all green, treat as failure (6+ guesses / no success)
  IF row_count = 6 AND last_row_squares !~ '^[🟩]{5}$' THEN
    RETURN -2;
  END IF;

  -- For fewer than 6 rows, the final row must be all green
  IF row_count < 6 AND last_row_squares !~ '^[🟩]{5}$' THEN
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

