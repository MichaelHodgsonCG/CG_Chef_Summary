import { supabase } from './supabase';

// Weekly Package 2.0 (beta): CGOPS-daily-data prefills for the guided package.
// Everything here is a PREFILL the chef can overwrite — editing daily sales or
// uploading the usual reports always replaces these values.

export const GUIDED_PACKAGE_V2 = 'guided_package_v2';

export interface WeekPackDiscountItem {
  itemDesc: string;
  count: number;
  amount: number;
}

export interface WeekPackDiscountCategory {
  label: string;
  dailyCounts: number[];
  dailyAmounts: number[];
  totalCount: number;
  totalAmount: number;
  items: WeekPackDiscountItem[];
}

export interface ChefWeekPack {
  ok: boolean;
  locationName: string;
  weekEnding: string;
  sales: { salesDaily: number[]; salesTotal: number; slpWtdSales: number | null };
  labour: { labourDaily: number[]; labourTotal: number | null; source: string };
  discounts: { days: number[]; categories: WeekPackDiscountCategory[] };
  recap: string | null;
  meta: { posDaysFound: number; slpDaysFound: number; discountRowCount: number; recapSourceDays: number };
}

export async function isBetaFeatureEnabled(locationId: string, feature: string): Promise<boolean> {
  const { data } = await supabase
    .from('weekly_summary_beta_features')
    .select('enabled')
    .eq('location_id', locationId)
    .eq('feature', feature)
    .maybeSingle();
  return data?.enabled === true;
}

export async function fetchChefWeekPack(
  locationId: string,
  fiscalYear: number,
  period: number,
  week: number
): Promise<ChefWeekPack | null> {
  try {
    const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chef-week-pack`;
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ location_id: locationId, fiscal_year: fiscalYear, period, week }),
    });
    if (!response.ok) return null;
    const pack = (await response.json()) as ChefWeekPack;
    return pack.ok ? pack : null;
  } catch {
    return null;
  }
}
