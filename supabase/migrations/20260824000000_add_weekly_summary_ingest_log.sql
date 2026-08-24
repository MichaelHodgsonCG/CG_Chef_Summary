/*
  Ingest log for chef-side data stores.

  The consolidated menu-variance report depends on each chef's weekly
  Count Amounts upload storing item variances. That store used to fail
  silently (Cambridge stored nothing for three weeks and nobody knew).
  Every attempt now writes an outcome row here — success with the item
  count, or failure with the error — so HQ can see gaps the same week.

  anon needs INSERT because chefs use the PIN (anon) cohort, matching the
  other weekly_summary_* tables.
*/

CREATE TABLE IF NOT EXISTS weekly_summary_ingest_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id uuid NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  fiscal_year integer NOT NULL,
  period_number integer NOT NULL,
  week_number integer NOT NULL,
  week_ending_date date,
  kind text NOT NULL DEFAULT 'item_variances',
  status text NOT NULL CHECK (status IN ('stored', 'failed')),
  item_count integer,
  error_text text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS weekly_summary_ingest_log_week_idx
  ON weekly_summary_ingest_log (kind, fiscal_year, period_number, week_number);

ALTER TABLE weekly_summary_ingest_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "weekly_summary_ingest_log_all"
  ON weekly_summary_ingest_log FOR ALL
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);
