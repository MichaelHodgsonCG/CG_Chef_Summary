import { supabase } from './supabase';
import { refreshSummaryPlFieldsForPeriod } from './summaryPlFields';

export type PlAdjustmentResult = { error: string | null; summariesRefreshed: number };

/**
 * Apply a manual correction to one P&L line item's value and keep the row's
 * derived figures consistent. current_actual is period-cumulative and the same
 * row's qtd/ytd columns include it, so the correction delta carries into those
 * columns too (when they're populated). Later uploads are separate Sage
 * snapshots and are left untouched — a corrected re-upload supersedes them.
 * Afterwards the period's saved chef summaries are refreshed so their
 * P&L-driven fields don't go stale (previously only a fresh upload did this).
 */
export async function applyPlAdjustment(params: {
  lineItemId: string;
  locationId: string;
  salesLineItemName: string;
  newValue: number;
}): Promise<PlAdjustmentResult> {
  const { lineItemId, locationId, salesLineItemName, newValue } = params;

  const { data: row, error: rowError } = await supabase
    .from('weekly_summary_pl_line_items')
    .select('upload_id, week_ending_date, current_actual, ytd_actual, qtd_actual')
    .eq('id', lineItemId)
    .single();
  if (rowError || !row) return { error: 'Could not find line item', summariesRefreshed: 0 };

  const { data: sales } = await supabase
    .from('weekly_summary_pl_line_items')
    .select('current_actual, ytd_actual, qtd_actual')
    .eq('upload_id', row.upload_id)
    .eq('line_item_name', salesLineItemName)
    .maybeSingle();

  const delta = newValue - (row.current_actual || 0);
  const pctOf = (num: number, den: number | null | undefined) =>
    den && den > 0 ? (num / den) * 100 : null;

  const update: Record<string, number | null> = {
    current_actual: newValue,
    current_actual_pct: pctOf(newValue, sales?.current_actual),
  };
  if (row.ytd_actual !== null) {
    const ytd = row.ytd_actual + delta;
    update.ytd_actual = ytd;
    update.ytd_actual_pct = pctOf(ytd, sales?.ytd_actual);
  }
  if (row.qtd_actual !== null) {
    const qtd = row.qtd_actual + delta;
    update.qtd_actual = qtd;
    update.qtd_actual_pct = pctOf(qtd, sales?.qtd_actual);
  }

  const { error: updateError } = await supabase
    .from('weekly_summary_pl_line_items')
    .update(update)
    .eq('id', lineItemId);
  if (updateError) return { error: updateError.message, summariesRefreshed: 0 };

  const { data: calWeek } = await supabase
    .from('fiscal_calendar')
    .select('fiscal_year, period')
    .lte('start_date', row.week_ending_date)
    .gte('end_date', row.week_ending_date)
    .maybeSingle();

  let summariesRefreshed = 0;
  if (calWeek) {
    try {
      summariesRefreshed = await refreshSummaryPlFieldsForPeriod(locationId, calWeek.fiscal_year, calWeek.period);
    } catch {
      // Best-effort: the adjustment itself is saved either way.
    }
  }
  return { error: null, summariesRefreshed };
}
