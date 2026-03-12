# Wordle Tournament Daily Cron Job

## Overview
This cron job should run daily at 11:00 PM EST to handle:
1. Apply -2 point penalties for users who haven't submitted
2. Update all tournament scores (triggers automatic leaderboard update)
3. Close tournaments that have ended

Note: Leaderboard updates also happen automatically when all players submit their daily results.

## Schedule
Run daily at 11:00 PM EST (3:00 AM UTC next day during standard time, 2:00 AM UTC during daylight time)

## SQL Logic

```sql
-- ============================================================================
-- DAILY CRON JOB - Run at 11:00 PM EST
-- ============================================================================

DO $$
DECLARE
  today_date date;
  affected_users record;
  v_auto_n integer;
  first_streak_day date;
BEGIN
  -- Get today's date in EST timezone
  today_date := (now() AT TIME ZONE 'America/New_York')::date;

  -- Load auto-forfeit config: number of consecutive penalty days before auto-forfeit
  SELECT auto_forfeit_consecutive_penalties
  INTO v_auto_n
  FROM app_config
  ORDER BY updated_at DESC
  LIMIT 1;

  IF v_auto_n IS NULL OR v_auto_n < 1 THEN
    v_auto_n := 3;
  END IF;

  -- First day of the streak window we care about (last N days including today)
  first_streak_day := today_date - (v_auto_n - 1);

  -- ============================================================================
  -- STEP 1: Apply penalties for missing submissions
  -- ============================================================================

  -- For each user in an active tournament who hasn't submitted today,
  -- create a penalty submission with -2 points
  INSERT INTO daily_submissions (user_id, submission_date, submission_text, wordle_score, submitted_at)
  SELECT DISTINCT
    tp.user_id,
    today_date,
    'NO SUBMISSION - PENALTY',
    -2,
    now()
  FROM tournament_participants tp
  JOIN tournaments t ON t.id = tp.tournament_id
  WHERE
    -- Tournament is active
    t.status = 'active'
    -- Today is within tournament date range
    AND today_date >= t.start_date
    AND today_date <= t.end_date
    -- User has not forfeited
    AND tp.forfeited = false
    -- User has not submitted today
    AND NOT EXISTS (
      SELECT 1 FROM daily_submissions ds
      WHERE ds.user_id = tp.user_id
      AND ds.submission_date = today_date
    )
  ON CONFLICT (user_id, submission_date) DO NOTHING;

  -- ============================================================================
  -- STEP 2: Recalculate all tournament scores for active tournaments
  -- ============================================================================

  -- Update tournament scores for all participants in active tournaments
  INSERT INTO tournament_scores (tournament_id, user_id, total_score, last_updated)
  SELECT
    tp.tournament_id,
    tp.user_id,
    CASE
      -- If forfeited, score is -1 (displayed as "Forfeited")
      WHEN tp.forfeited THEN -1
      -- Otherwise sum all daily scores within tournament date range
      ELSE COALESCE(SUM(ds.wordle_score), 0)
    END as total_score,
    now()
  FROM tournament_participants tp
  JOIN tournaments t ON t.id = tp.tournament_id
  LEFT JOIN daily_submissions ds ON ds.user_id = tp.user_id
    AND ds.submission_date >= t.start_date
    AND ds.submission_date <= today_date
    AND ds.submission_date <= t.end_date
  WHERE t.status IN ('active', 'closed')
  GROUP BY tp.tournament_id, tp.user_id, tp.forfeited
  ON CONFLICT (tournament_id, user_id)
  DO UPDATE SET
    total_score = EXCLUDED.total_score,
    last_updated = EXCLUDED.last_updated;

  -- ============================================================================
  -- STEP 2b: Auto-forfeit users with N consecutive penalty days
  -- ============================================================================

  -- For each active tournament + participant:
  -- - Tournament must have started on or after the first day of the streak window
  -- - Participant must have a penalty submission for each day in [first_streak_day, today_date]
  --   (we only check within that N-day window)
  -- - Call the shared forfeit_tournament_internal helper so behavior stays consistent
  WITH eligible_forfeit AS (
    SELECT
      tp.tournament_id,
      tp.user_id
    FROM tournament_participants tp
    JOIN tournaments t ON t.id = tp.tournament_id
    WHERE
      t.status = 'active'
      AND tp.forfeited = false
      -- Tournament started on or after the first day of this streak window
      AND t.start_date >= first_streak_day
      -- User has a penalty submission on every day in the streak window
      AND (
        SELECT COUNT(DISTINCT ds.submission_date)
        FROM daily_submissions ds
        WHERE ds.user_id = tp.user_id
          AND ds.submission_text = 'NO SUBMISSION - PENALTY'
          AND ds.submission_date BETWEEN first_streak_day AND today_date
      ) >= v_auto_n
  )
  PERFORM forfeit_tournament_internal(tournament_id, user_id)
  FROM eligible_forfeit;

  -- ============================================================================
  -- STEP 3: Close tournaments that have ended
  -- ============================================================================

  UPDATE tournaments
  SET status = 'closed'
  WHERE status = 'active'
  AND end_date < today_date;

END $$;
```

## Implementation Options

### Option 1: GitHub Actions (Recommended for Expo projects)
Create `.github/workflows/daily-cron.yml`:

```yaml
name: Daily Wordle Cron Job
on:
  schedule:
    - cron: '0 3 * * *'  # 3 AM UTC = 11 PM EST (adjust for DST)
  workflow_dispatch:  # Allow manual triggers

jobs:
  run-cron:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Run SQL Cron Job
        env:
          SUPABASE_DB_URL: ${{ secrets.SUPABASE_DB_URL }}
        run: |
          psql $SUPABASE_DB_URL -f ./cron-job.sql
```

### Option 2: Supabase Edge Function + External Scheduler
Create an Edge Function that runs the SQL and call it from:
- EasyCron (https://www.easycron.com)
- Cron-job.org (https://cron-job.org)
- Any cloud scheduler (AWS EventBridge, Google Cloud Scheduler, etc.)

### Option 3: pg_cron Extension (If available on your Supabase plan)
```sql
SELECT cron.schedule(
  'wordle-daily-cron',
  '0 23 * * *',  -- 11 PM daily
  $$
  -- Insert the SQL logic here
  $$
);
```

## Testing

To test the cron job logic manually:

```sql
-- Test with a specific date
DO $$
DECLARE
  test_date date := '2024-01-15';
BEGIN
  -- Run the cron logic with test_date instead of today_date
  -- (Copy the cron job SQL and replace today_date with test_date)
END $$;
```

## Monitoring

Add logging to track cron job execution:

```sql
CREATE TABLE IF NOT EXISTS cron_job_logs (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_name text NOT NULL,
  run_date date NOT NULL,
  penalties_applied integer,
  scores_updated integer,
  tournaments_closed integer,
  executed_at timestamptz DEFAULT now()
);
```

Then modify the cron job to insert logs:

```sql
INSERT INTO cron_job_logs (job_name, run_date, penalties_applied, scores_updated, tournaments_closed)
VALUES (
  'daily-wordle-cron',
  today_date,
  (SELECT COUNT(*) FROM daily_submissions WHERE submission_date = today_date AND submission_text = 'NO SUBMISSION - PENALTY'),
  (SELECT COUNT(*) FROM tournament_scores WHERE last_updated::date = today_date),
  (SELECT COUNT(*) FROM tournaments WHERE status = 'closed' AND end_date = today_date - 1)
);
```
