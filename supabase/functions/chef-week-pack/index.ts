import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

// Assembles the "week pack" for one location/week from the CGOPS daily feeds:
//   • daily food sales (POS daily summary, FOOD-* sales classes)
//   • BOH labour estimate (SLP daily labour report)
//   • discounts grouped into the chef-review reason categories (discount_records)
//   • an AI "week that was" recap (daily logbook journals + location daily
//     recaps + guest feedback), for the chef to read before entering their week.
//
// The daily-feed tables are only readable by authenticated CGOPS users, so this
// function runs with the service role and exposes just the aggregates the
// guided package needs. Values are PREFILLS — the app always lets the chef
// overwrite them (editing daily sales, or uploading the reports as before).

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

// Mirrors DISCOUNT_REASON_CATEGORIES + normalizeDiscountReason in
// GuidedWeeklyPackage.tsx so the pack drops into the same review UI.
const DISCOUNT_REASON_CATEGORIES = [
  { label: "Guest Did Not Like", match: "guest did not like s" },
  { label: "Quality Issue", match: "quality issue s" },
  { label: "Slow", match: "slow s" },
  { label: "Steak Over/Under", match: "steak over under s" },
];

function normalizeDiscountReason(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { location_id, fiscal_year, period, week } = (await req.json()) as {
      location_id: string;
      fiscal_year: number;
      period: number;
      week: number;
    };
    if (!location_id || !fiscal_year || !period || !week) {
      return new Response(JSON.stringify({ error: "location_id, fiscal_year, period, week required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: cal } = await supabase
      .from("fiscal_calendar")
      .select("end_date")
      .eq("fiscal_year", fiscal_year)
      .eq("period", period)
      .eq("week", week)
      .maybeSingle();
    if (!cal?.end_date) {
      return new Response(JSON.stringify({ error: "No fiscal calendar entry for that week" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const endDate = new Date(cal.end_date + "T00:00:00Z");
    const dates: string[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(endDate);
      d.setUTCDate(d.getUTCDate() - i);
      dates.push(isoDate(d));
    }
    const startDate = dates[0];
    const dayIndex = (dateStr: string) => dates.indexOf(dateStr);

    const { data: loc } = await supabase
      .from("locations")
      .select("name")
      .eq("id", location_id)
      .maybeSingle();
    const locationName = loc?.name ?? "";

    // ---- Daily food sales from the POS feed (FOOD-* sales classes only) ----
    const salesDaily = [0, 0, 0, 0, 0, 0, 0];
    let posDaysFound = 0;
    const { data: posRows } = await supabase
      .from("pos_daily_summary")
      .select("business_date, net, gross, amount, major_class")
      .eq("location_id", location_id)
      .eq("section", "sales")
      .ilike("major_class", "FOOD%")
      .gte("business_date", startDate)
      .lte("business_date", dates[6]);
    const posDates = new Set<string>();
    for (const row of posRows ?? []) {
      const i = dayIndex(row.business_date);
      if (i >= 0) {
        // Sales rows in the POS feed populate `gross`; some exports use `net`
        // or `amount` instead, so take the first present value.
        salesDaily[i] += Number(row.net ?? row.gross ?? row.amount) || 0;
        posDates.add(row.business_date);
      }
    }
    posDaysFound = posDates.size;
    const salesTotal = salesDaily.reduce((s, v) => s + v, 0);

    // ---- SLP feed: WTD sales cross-check + BOH labour estimate ----
    const { data: slpReports } = await supabase
      .from("slp_reports")
      .select("id, report_date")
      .gte("report_date", startDate)
      .lte("report_date", dates[6])
      .order("report_date");
    const reportIds = (slpReports ?? []).map((r) => r.id);
    const reportDateById = new Map((slpReports ?? []).map((r) => [r.id, r.report_date]));

    let slpWtdSales: number | null = null;
    const dailySalesByDate = new Map<string, number>();
    let labourTotal: number | null = null;
    const labourDaily = [0, 0, 0, 0, 0, 0, 0];
    let slpDaysFound = 0;

    if (reportIds.length > 0) {
      const { data: slpSales } = await supabase
        .from("slp_sales_data")
        .select("report_id, total_daily_sales, total_wtd_sales")
        .in("report_id", reportIds)
        .eq("location_name", locationName);
      let latestSalesDate = "";
      for (const row of slpSales ?? []) {
        const date = reportDateById.get(row.report_id) ?? "";
        dailySalesByDate.set(date, Number(row.total_daily_sales) || 0);
        if (date > latestSalesDate) {
          latestSalesDate = date;
          slpWtdSales = Number(row.total_wtd_sales) || 0;
        }
      }

      const { data: slpLabour } = await supabase
        .from("slp_labor_data")
        .select("report_id, daily_labour_actual_pct, wtd_labour_dollars")
        .in("report_id", reportIds)
        .eq("location_name", locationName)
        .eq("department", "BOH");
      let latestLabourDate = "";
      const labourDates = new Set<string>();
      for (const row of slpLabour ?? []) {
        const date = reportDateById.get(row.report_id) ?? "";
        const i = dayIndex(date);
        if (i >= 0) {
          const daySales = dailySalesByDate.get(date) ?? 0;
          labourDaily[i] = Math.round(((Number(row.daily_labour_actual_pct) || 0) / 100) * daySales * 100) / 100;
          labourDates.add(date);
        }
        if (date > latestLabourDate && row.wtd_labour_dollars != null) {
          latestLabourDate = date;
          labourTotal = Number(row.wtd_labour_dollars) || 0;
        }
      }
      slpDaysFound = labourDates.size;
      if (labourTotal == null && slpDaysFound > 0) {
        labourTotal = Math.round(labourDaily.reduce((s, v) => s + v, 0) * 100) / 100;
      }
    }

    // ---- Discounts grouped into the chef-review reason categories ----
    const { data: discountRows } = await supabase
      .from("discount_records")
      .select("report_date, item_name, discount_type, quantity, discount_amount")
      .eq("store", locationName)
      .gte("report_date", startDate)
      .lte("report_date", dates[6]);

    const categories = DISCOUNT_REASON_CATEGORIES.map((cat) => ({
      label: cat.label,
      match: cat.match,
      dailyCounts: [0, 0, 0, 0, 0, 0, 0],
      dailyAmounts: [0, 0, 0, 0, 0, 0, 0],
      totalCount: 0,
      totalAmount: 0,
      itemMap: new Map<string, { count: number; amount: number }>(),
    }));
    for (const row of discountRows ?? []) {
      const norm = normalizeDiscountReason(row.discount_type ?? "");
      const cat = categories.find((c) => c.match === norm);
      if (!cat) continue;
      const i = dayIndex(row.report_date);
      const qty = Number(row.quantity) || 1;
      const amount = Number(row.discount_amount) || 0;
      if (i >= 0) {
        cat.dailyCounts[i] += qty;
        cat.dailyAmounts[i] += amount;
      }
      cat.totalCount += qty;
      cat.totalAmount += amount;
      const key = (row.item_name ?? "").trim() || "(unnamed item)";
      const item = cat.itemMap.get(key) ?? { count: 0, amount: 0 };
      item.count += qty;
      item.amount += amount;
      cat.itemMap.set(key, item);
    }
    const discounts = {
      days: [1, 2, 3, 4, 5, 6, 7],
      categories: categories.map((c) => ({
        label: c.label,
        dailyCounts: c.dailyCounts,
        dailyAmounts: c.dailyAmounts.map((v) => Math.round(v * 100) / 100),
        totalCount: c.totalCount,
        totalAmount: Math.round(c.totalAmount * 100) / 100,
        items: [...c.itemMap.entries()]
          .map(([itemDesc, v]) => ({ itemDesc, count: v.count, amount: Math.round(v.amount * 100) / 100 }))
          .sort((a, b) => b.amount - a.amount),
      })),
    };
    const discountRowCount = (discountRows ?? []).length;

    // ---- AI "week that was" recap ----
    let recap: string | null = null;
    const { data: recapRows } = await supabase
      .from("location_daily_recaps")
      .select("recap_date, recap_text")
      .eq("location_name", locationName)
      .gte("recap_date", startDate)
      .lte("recap_date", dates[6])
      .order("recap_date");
    const { data: logbookRows } = await supabase
      .from("daily_logbook")
      .select("report_date, sales_actual, sales_forecast, journal_entry, weather_conditions")
      .eq("location_id", location_id)
      .gte("report_date", startDate)
      .lte("report_date", dates[6])
      .order("report_date");
    const { data: feedbackRows } = await supabase
      .from("guest_feedback")
      .select("overall_rating")
      .eq("location_name", locationName)
      .gte("report_date", startDate)
      .lte("report_date", dates[6]);

    const recapSourceDays = new Set([
      ...(recapRows ?? []).map((r) => r.recap_date),
      ...(logbookRows ?? []).map((r) => r.report_date),
    ]).size;

    const apiKey = Deno.env.get("OPENAI_API_KEY");
    if (apiKey && recapSourceDays > 0) {
      const ratings = (feedbackRows ?? [])
        .map((r) => Number(r.overall_rating))
        .filter((v) => v > 0);
      const avgRating = ratings.length > 0 ? ratings.reduce((s, v) => s + v, 0) / ratings.length : null;
      const context = [
        `Location: ${locationName}. Week ending ${cal.end_date}.`,
        salesTotal > 0 ? `Food sales for the week (POS): $${salesTotal.toFixed(0)}.` : "",
        avgRating != null ? `Guest feedback: ${ratings.length} reviews, average ${avgRating.toFixed(1)}/5.` : "",
        ...(logbookRows ?? []).map((r) =>
          `${r.report_date}: sales $${Number(r.sales_actual || 0).toFixed(0)} vs forecast $${Number(r.sales_forecast || 0).toFixed(0)}${r.weather_conditions ? `, weather ${r.weather_conditions}` : ""}${r.journal_entry ? `. Manager journal: ${String(r.journal_entry).slice(0, 500)}` : ""}`),
        ...(recapRows ?? []).map((r) => `${r.recap_date} recap: ${String(r.recap_text).slice(0, 600)}`),
      ].filter(Boolean).join("\n");

      const aiResp = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [
            {
              role: "system",
              content:
                "You are briefing a restaurant chef who is about to write their weekly report. From the daily journals, recaps, and numbers below, write a 4-6 sentence 'week that was' recap of THEIR location's week: how sales tracked against forecast, the standout busy/quiet days and why (weather, events), guest-feedback signals, and anything operationally notable a chef should remember when writing their summary. Address the chef directly and factually. No bullet points, no headers.",
            },
            { role: "user", content: context },
          ],
          max_tokens: 300,
          temperature: 0.3,
        }),
      });
      if (aiResp.ok) {
        const aiData = await aiResp.json();
        recap = aiData.choices?.[0]?.message?.content?.trim() || null;
      } else {
        console.error("OpenAI error:", await aiResp.text());
      }
    }

    return new Response(
      JSON.stringify({
        ok: true,
        locationName,
        weekEnding: cal.end_date,
        sales: { salesDaily: salesDaily.map((v) => Math.round(v * 100) / 100), salesTotal: Math.round(salesTotal * 100) / 100, slpWtdSales },
        labour: { labourDaily, labourTotal, source: "SLP daily report, BOH department" },
        discounts,
        recap,
        meta: { posDaysFound, slpDaysFound, discountRowCount, recapSourceDays },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in chef-week-pack:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
