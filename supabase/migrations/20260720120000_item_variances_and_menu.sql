-- Full per-item weekly usage variances (Silverware "Usage Summary - Count Amounts")
-- + a `menu` grouping on locations that drives the consolidated Menu Variance report.
-- Beertown menu = 12 active Beertown locations + Sociable Kitchen Tavern (shared menu).

alter table public.locations add column if not exists menu text;

update public.locations
set menu = 'Beertown'
where code in ('BTBA','BTB','BTC','BTE','BTG','BTLM','BTLW','BTN','BTO','BTT','BTW','BTWH','SKT');

-- One row per item, per location, per week. Replace-on-reupload; auto-pruned after 13 weeks.
create table if not exists public.weekly_summary_item_variances (
  id uuid primary key default gen_random_uuid(),
  location_id uuid not null references public.locations(id) on delete cascade,
  fiscal_year int not null,
  period_number int not null,
  week_number int not null,
  week_ending_date date,
  item_name text not null,
  category text,
  uom text,
  net_variance_amount numeric,
  actual_usage_amount numeric,
  ideal_usage_amount numeric,
  waste_amount numeric,
  source text not null default 'count_amounts',
  created_at timestamptz not null default now(),
  unique (location_id, fiscal_year, period_number, week_number, item_name)
);

create index if not exists idx_wsiv_period_week
  on public.weekly_summary_item_variances (fiscal_year, period_number, week_number);
create index if not exists idx_wsiv_item_name
  on public.weekly_summary_item_variances (item_name);
create index if not exists idx_wsiv_location_week
  on public.weekly_summary_item_variances (location_id, week_ending_date);

alter table public.weekly_summary_item_variances enable row level security;
create policy weekly_summary_item_variances_all
  on public.weekly_summary_item_variances
  for all to anon, authenticated using (true) with check (true);
grant all on public.weekly_summary_item_variances to anon, authenticated;
