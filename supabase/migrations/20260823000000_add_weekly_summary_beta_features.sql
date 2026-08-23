/*
  Weekly Package 2.0 beta gating.

  Per-location feature flags for Weekly Summary. The guided package checks
  `guided_package_v2` here; locations without a row (or with enabled=false)
  get the existing workflow unchanged. Rows are managed by admins out-of-band
  for now (no anon write policy on purpose) — reads are open to the app like
  the other weekly_summary_* tables so the PIN (anon) cohort can see flags.
*/

CREATE TABLE IF NOT EXISTS weekly_summary_beta_features (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id uuid NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  feature text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (location_id, feature)
);

ALTER TABLE weekly_summary_beta_features ENABLE ROW LEVEL SECURITY;

CREATE POLICY "weekly_summary_beta_features_read"
  ON weekly_summary_beta_features FOR SELECT
  TO anon, authenticated
  USING (true);
