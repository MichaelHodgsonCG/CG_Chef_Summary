/*
  Two-audience weekly summary.

  opening_statement now serves as the INTERNAL EXECUTIVE SUMMARY — the
  candid good/bad/ugly read for the executive team only, never exported.
  team_summary is the softer companion written for the full chef/manager
  audience; it is the version included in the exported report.
*/

ALTER TABLE weekly_summary_executive_reports
  ADD COLUMN IF NOT EXISTS team_summary text DEFAULT ''::text;
