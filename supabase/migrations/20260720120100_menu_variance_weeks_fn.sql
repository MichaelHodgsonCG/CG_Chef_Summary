-- Distinct weeks with item-variance data for a menu, plus how many of the menu's
-- locations reported each week (coverage). Powers the Menu Variance week picker.
create or replace function public.menu_variance_weeks(p_menu text)
returns table (
  week_ending_date date,
  fiscal_year int,
  period_number int,
  week_number int,
  location_count bigint
)
language sql
stable
security definer
set search_path = public
as $$
  select v.week_ending_date, v.fiscal_year, v.period_number, v.week_number,
         count(distinct v.location_id) as location_count
  from public.weekly_summary_item_variances v
  join public.locations l on l.id = v.location_id
  where l.menu = p_menu and v.week_ending_date is not null
  group by v.week_ending_date, v.fiscal_year, v.period_number, v.week_number
  order by v.week_ending_date desc;
$$;

grant execute on function public.menu_variance_weeks(text) to anon, authenticated;
