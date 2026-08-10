-- Budget-only (provisional) P&L uploads.
-- Lets a new period's budget targets load before the period closes, without the
-- partial actuals that would skew PTD. The upload's actuals are stored as zero;
-- readers exclude budget-only uploads from every ACTUALS computation (they still
-- read the budget), so PTD/YTD accumulate from the chef's own weekly usage until
-- the finalized P&L is uploaded (which replaces the provisional one).
alter table public.weekly_summary_pl_uploads
  add column if not exists is_budget_only boolean not null default false;
