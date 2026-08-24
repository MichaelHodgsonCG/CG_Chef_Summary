/*
  The executive report loader created a new row whenever its lookup failed —
  and the lookup (maybeSingle) fails as soon as duplicates exist, so rows
  compounded on every dashboard load (29 rows piled up for FY2026 P13 W3).

  Keep the most substantive row per week (most statement/notes content,
  newest as tiebreak), delete the rest, and add the unique constraint that
  should have existed so this cannot recur. The app and the statements edge
  function upsert against this constraint from now on.
*/

WITH ranked AS (
  SELECT id, ROW_NUMBER() OVER (
    PARTITION BY fiscal_year, period_number, week_number
    ORDER BY
      (length(coalesce(opening_statement, ''))
        + length(coalesce(closing_statement, ''))
        + length(coalesce(leadership_notes, ''))
        + length(coalesce(executive_summary, ''))
        + length(coalesce(action_plan, ''))) DESC,
      updated_at DESC
  ) AS rn
  FROM weekly_summary_executive_reports
)
DELETE FROM weekly_summary_executive_reports w
USING ranked r
WHERE w.id = r.id AND r.rn > 1;

ALTER TABLE weekly_summary_executive_reports
  ADD CONSTRAINT weekly_summary_executive_reports_week_key
  UNIQUE (fiscal_year, period_number, week_number);
