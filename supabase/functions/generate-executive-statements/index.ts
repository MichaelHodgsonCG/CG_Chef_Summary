import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

// Generates THE OPENING STATEMENT for the Weekly Culinary Summary (the closing
// statement was retired). Two modes:
//   • mode 'auto'   — called when a chef finishes their package and when the
//     executive report opens: generates ONLY if every reporting location has
//     filed for the week and no statement exists yet, then saves it to the
//     report row server-side.
//   • mode 'manual' — the dashboard's button: regenerates and saves regardless.
//
// The statement is built from a full consolidated read of the week: every
// location's numbers and notes, the usage variances compared BY CONCEPT, and a
// set of deterministic anomaly findings (persistent item offenders, count-error
// suspects, execution gaps, week-over-week swings, chef-narrative-vs-data
// contradictions) computed here so the model reasons over evidence, not vibes.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

type Loc = { id: string; name: string; code: string; menu: string | null };
type ChefRow = Record<string, unknown> & { location_id: string };
type VarRow = { location_id: string; item_name: string; net_variance_amount: number | null; week_ending_date: string };

const money = (v: number) => `$${Math.round(v).toLocaleString("en-US")}`;
const pct = (v: number) => `${v.toFixed(2)}%`;
const num = (v: unknown) => Number(v) || 0;

function conceptOf(loc: Loc): string {
  if (loc.menu) return loc.menu;
  if (["WC", "TBK", "SOLE"].includes(loc.code)) return "Trinity";
  return "Other";
}

// PostgREST caps a response at 1,000 rows; a 4-week variance read is ~21k.
async function pageAll<T>(build: (from: number, to: number) => PromiseLike<{ data: T[] | null }>): Promise<T[]> {
  const PAGE = 1000;
  const all: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data } = await build(from, from + PAGE - 1);
    if (!data || data.length === 0) break;
    all.push(...data);
    if (data.length < PAGE) break;
  }
  return all;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { fiscalYear, period, week, leadershipNotes, mode } = await req.json() as {
      fiscalYear: number; period: number; week: number; leadershipNotes?: string; mode?: "auto" | "manual";
    };
    if (!fiscalYear || !period || !week) {
      return new Response(JSON.stringify({ error: "Missing required fields: fiscalYear, period, week" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const apiKey = Deno.env.get("OPENAI_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "OpenAI API key not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { data: locsRaw } = await supabase
      .from("locations")
      .select("id, name, code, menu")
      .eq("exclude_from_reporting", false);
    const locs: Loc[] = (locsRaw as Loc[]) || [];
    const locIds = locs.map((l) => l.id);
    const locById = new Map(locs.map((l) => [l.id, l]));

    const { data: chefRowsRaw } = await supabase
      .from("weekly_summary_chef_summary")
      .select("*")
      .eq("fiscal_year", fiscalYear)
      .eq("period_number", period)
      .eq("week_number", week)
      .in("location_id", locIds);
    const chefRows: ChefRow[] = (chefRowsRaw as ChefRow[]) || [];
    const filed = chefRows.length;
    const total = locs.length;

    // The existing report row (statement + leadership notes live here).
    const { data: reportRow } = await supabase
      .from("weekly_summary_executive_reports")
      .select("id, opening_statement, leadership_notes")
      .eq("fiscal_year", fiscalYear)
      .eq("period_number", period)
      .eq("week_number", week)
      .maybeSingle();

    if (mode === "auto") {
      if (filed < total) {
        return new Response(JSON.stringify({ skipped: "incomplete", filed, total }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (reportRow?.opening_statement && reportRow.opening_statement.trim()) {
        return new Response(JSON.stringify({ skipped: "exists", filed, total }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }
    const notes = (leadershipNotes ?? reportRow?.leadership_notes ?? "").trim();

    // Fiscal calendar: this week's end date plus the three prior week-endings
    // (for persistence / flip-flop detection) and the prior week (for swings).
    const { data: calRows } = await supabase
      .from("fiscal_calendar")
      .select("fiscal_year, period, week, end_date")
      .eq("fiscal_year", fiscalYear)
      .order("end_date");
    const cal = (calRows || []) as { fiscal_year: number; period: number; week: number; end_date: string }[];
    const curIdx = cal.findIndex((c) => c.period === period && c.week === week);
    const endDate = curIdx >= 0 ? cal[curIdx].end_date : null;
    if (!endDate) {
      return new Response(JSON.stringify({ error: "No fiscal calendar entry for that week" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const trailingDates = cal.slice(Math.max(0, curIdx - 3), curIdx + 1).map((c) => c.end_date);
    const prevCal = curIdx > 0 ? cal[curIdx - 1] : null;

    const prevRows: ChefRow[] = prevCal
      ? ((await supabase
          .from("weekly_summary_chef_summary")
          .select("location_id, actual_food_cost_pct, labour_cost_pct, food_sales_labour_push")
          .eq("fiscal_year", prevCal.fiscal_year)
          .eq("period_number", prevCal.period)
          .eq("week_number", prevCal.week)
          .in("location_id", locIds)).data as ChefRow[]) || []
      : [];
    const prevByLoc = new Map(prevRows.map((r) => [r.location_id, r]));

    const varRows = await pageAll<VarRow>((from, to) =>
      supabase
        .from("weekly_summary_item_variances")
        .select("location_id, item_name, net_variance_amount, week_ending_date")
        .in("location_id", locIds)
        .in("week_ending_date", trailingDates)
        .range(from, to)
    );
    const weekVarRows = varRows.filter((r) => r.week_ending_date === endDate);

    const { data: failRows } = await supabase
      .from("weekly_summary_ingest_log")
      .select("location_id, error_text")
      .eq("kind", "item_variances")
      .eq("status", "failed")
      .eq("week_ending_date", endDate);

    // ---------- Per-location numbers ----------
    const locLines = chefRows
      .map((r) => {
        const loc = locById.get(r.location_id);
        if (!loc) return "";
        const sales = num(r.food_sales_labour_push);
        const weekBudget = num(r.budget_food_sales_period) / 4;
        const fc = num(r.actual_food_cost_pct);
        const fcBudget = num(r.budget_food_cost_pct);
        const fcTheo = num(r.theoretical_food_cost_pct);
        const lab = num(r.labour_cost_pct);
        const labBudget = num(r.labour_budget_pct);
        const prev = prevByLoc.get(r.location_id);
        const gapDollars = ((fc - fcTheo) / 100) * sales;
        return [
          `${loc.name} (${loc.code}, ${conceptOf(loc)}):`,
          ` sales ${money(sales)} vs wk budget ${money(weekBudget)} (${sales >= weekBudget ? "+" : ""}${money(sales - weekBudget)})`,
          ` FC ${pct(fc)} vs budget ${pct(fcBudget)} vs theoretical ${pct(fcTheo)} (execution gap ${money(gapDollars)})`,
          ` labour ${pct(lab)} vs budget ${pct(labBudget)}`,
          ` overtime ${money(num(r.overtime_amount))}, waste ${money(num(r.waste_amount))}, promo ${money(num(r.boh_promo_amount))}`,
          prev ? ` WoW: FC ${(fc - num(prev.actual_food_cost_pct)) >= 0 ? "+" : ""}${(fc - num(prev.actual_food_cost_pct)).toFixed(2)}pt, labour ${(lab - num(prev.labour_cost_pct)) >= 0 ? "+" : ""}${(lab - num(prev.labour_cost_pct)).toFixed(2)}pt vs last week` : "",
        ].filter(Boolean).join("\n");
      })
      .filter(Boolean)
      .join("\n\n");

    // ---------- Chef narratives (for contradiction checks) ----------
    const narrativeLines = chefRows
      .map((r) => {
        const loc = locById.get(r.location_id);
        const bits = [
          r.ai_summary && `Summary: ${String(r.ai_summary).slice(0, 500)}`,
          r.final_food_cost_comments && `Food cost commentary: ${String(r.final_food_cost_comments).slice(0, 300)}`,
          r.labour_review_action_plan && `Labour plan: ${String(r.labour_review_action_plan).slice(0, 300)}`,
          r.sales_action_plan && `Sales plan: ${String(r.sales_action_plan).slice(0, 300)}`,
        ].filter(Boolean);
        return bits.length ? `${loc?.name ?? "?"}:\n${bits.join("\n")}` : "";
      })
      .filter(Boolean)
      .join("\n\n");

    // ---------- Usage variance BY CONCEPT (this week) ----------
    const byConcept = new Map<string, Map<string, { total: number; byLoc: Map<string, number> }>>();
    for (const r of weekVarRows) {
      const loc = locById.get(r.location_id);
      if (!loc) continue;
      const concept = conceptOf(loc);
      const items = byConcept.get(concept) ?? new Map();
      byConcept.set(concept, items);
      const agg = items.get(r.item_name) ?? { total: 0, byLoc: new Map() };
      items.set(r.item_name, agg);
      const v = num(r.net_variance_amount);
      agg.total += v;
      agg.byLoc.set(loc.code, (agg.byLoc.get(loc.code) || 0) + v);
    }
    const conceptSize = new Map<string, number>();
    for (const l of locs) conceptSize.set(conceptOf(l), (conceptSize.get(conceptOf(l)) || 0) + 1);
    const conceptText = [...byConcept.entries()]
      .map(([concept, items]) => {
        const arr = [...items.entries()].map(([name, a]) => ({ name, ...a }));
        const over = arr.filter((a) => a.total > 0).sort((a, b) => b.total - a.total).slice(0, 8);
        const under = arr.filter((a) => a.total < 0).sort((a, b) => a.total - b.total).slice(0, 5);
        const size = conceptSize.get(concept) || 0;
        const line = (a: { name: string; total: number; byLoc: Map<string, number> }) => {
          const overLocs = [...a.byLoc.entries()].filter(([, v]) => v > 50);
          const worst = [...a.byLoc.entries()].sort((x, y) => Math.abs(y[1]) - Math.abs(x[1]))[0];
          const spread = overLocs.length >= Math.max(2, Math.round(size * 0.6))
            ? `systemic (${overLocs.length}/${size} stores over)`
            : `concentrated (worst: ${worst?.[0]} ${money(worst?.[1] ?? 0)})`;
          return `  ${a.name}: ${money(a.total)} — ${spread}`;
        };
        return `${concept} (${size} stores):\nTop over-used:\n${over.map(line).join("\n") || "  none"}\nTop under-used:\n${under.map((a) => `  ${a.name}: ${money(a.total)}`).join("\n") || "  none"}`;
      })
      .join("\n\n");

    // ---------- Anomaly findings across the trailing 4 weeks ----------
    const perLocItem = new Map<string, Map<string, number>>(); // "code|item" -> date -> value
    for (const r of varRows) {
      const loc = locById.get(r.location_id);
      if (!loc) continue;
      const key = `${loc.code}|${r.item_name}`;
      const m = perLocItem.get(key) ?? new Map();
      perLocItem.set(key, m);
      m.set(r.week_ending_date, (m.get(r.week_ending_date) || 0) + num(r.net_variance_amount));
    }
    const persistent: string[] = [];
    const flipflop: string[] = [];
    for (const [key, m] of perLocItem) {
      const vals = trailingDates.map((d) => m.get(d)).filter((v): v is number => v !== undefined);
      if (vals.length < 3) continue;
      const totalV = vals.reduce((s, v) => s + v, 0);
      const positives = vals.filter((v) => v > 0).length;
      if (positives >= 3 && totalV >= 300) {
        persistent.push(`${key.replace("|", ": ")} — over-used ${positives}/${vals.length} wks, ${money(totalV)} total`);
      }
      let flips = 0;
      for (let i = 1; i < vals.length; i++) if (Math.sign(vals[i]) !== Math.sign(vals[i - 1]) && Math.abs(vals[i]) >= 150 && Math.abs(vals[i - 1]) >= 150) flips++;
      if (flips >= 2) {
        flipflop.push(`${key.replace("|", ": ")} — swings ${vals.map((v) => money(v)).join(" → ")} (likely count timing/error, not usage)`);
      }
    }
    persistent.sort((a, b) => (Number(b.match(/\$([\d,]+) total/)?.[1]?.replace(/,/g, "")) || 0) - (Number(a.match(/\$([\d,]+) total/)?.[1]?.replace(/,/g, "")) || 0));

    const missingVar = locs
      .filter((l) => !weekVarRows.some((r) => r.location_id === l.id))
      .map((l) => l.name);
    const failText = (failRows || [])
      .map((f: { location_id: string; error_text: string | null }) =>
        `${locById.get(f.location_id)?.name ?? "?"}: store FAILED${f.error_text ? ` (${f.error_text})` : ""}`);

    const findingsText = [
      persistent.length ? `PERSISTENT OFFENDERS (same item over-used 3+ of last ${trailingDates.length} weeks):\n${persistent.slice(0, 12).join("\n")}` : "",
      flipflop.length ? `COUNT-ERROR SUSPECTS (large alternating swings):\n${flipflop.slice(0, 8).join("\n")}` : "",
      missingVar.length ? `DATA GAPS: no item-variance data stored this week for: ${missingVar.join(", ")} — their usage numbers are missing from the concept comparison.` : "",
      failText.length ? `INGEST FAILURES: ${failText.join("; ")}` : "",
    ].filter(Boolean).join("\n\n");

    const systemPrompt = `You are preparing the OPENING STATEMENT of the Weekly Culinary Performance Summary for the Vice President of Food & Beverage of a multi-unit Canadian restaurant group. The audience is Executive Chefs, Regional Directors, Operations Leaders, and the Executive Team. Use Canadian spelling throughout (Labour, Colour, Flavour, Honour, Organise).

Write like a Vice President briefing senior operators: confident, precise, accountable, zero motivational filler (never "keep up the great work", "let's rally", "momentum"). Every sentence must be supported by the supplied data or Leadership Notes — never invent explanations. Leadership Notes are intentional senior-leadership context: let them frame tone and priorities without repeating them verbatim.

Structure the statement in four labelled parts, plain text, no markdown:

The Good: — the genuine wins of the week, with the numbers that prove them (2-4 specifics, not a list of everyone who was fine).

The Bad: — underperformance that needs management attention this week: budget misses, labour drift, concept-level usage problems. Name locations and dollars.

The Ugly: — the most serious or persistent problems, stated plainly: chronic offenders, widening execution gaps, anything trending the wrong way for multiple weeks. If a chef's own narrative reads fine but the computed findings contradict it, say so factually (e.g. "X reports food cost under control; the item data shows Y over-used for a fourth straight week").

Watchlist: — 3-5 one-line items surfaced by the data that leaders might not be seeing: persistent item offenders, count-error suspects, systemic-vs-single-store patterns from the concept comparison, data gaps that undermine the numbers. Each line: what, where, dollars, and the one action that would confirm or fix it.

Total length: roughly 350-500 words. It must read differently every week because it is driven by this week's data.`;

    const userContent = `Generate the opening statement for FY${fiscalYear} Period ${period} Week ${week} (week ending ${endDate}). ${filed} of ${total} locations filed.

[LEADERSHIP NOTES]
${notes || "None provided."}

[PER-LOCATION RESULTS]
${locLines || "None."}

[CHEF NARRATIVES]
${narrativeLines || "None."}

[USAGE VARIANCE BY CONCEPT — THIS WEEK]
${conceptText || "No item variance data this week."}

[COMPUTED FINDINGS — TRAILING ${trailingDates.length} WEEKS]
${findingsText || "No anomalies detected."}`;

    const aiResp = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userContent },
        ],
        max_tokens: 1100,
        temperature: 0.4,
      }),
    });
    if (!aiResp.ok) {
      console.error("OpenAI error:", await aiResp.text());
      return new Response(JSON.stringify({ error: "Failed to generate AI content" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const aiData = await aiResp.json();
    const opening = aiData.choices?.[0]?.message?.content?.trim() || "";
    if (!opening) {
      return new Response(JSON.stringify({ error: "Empty AI response" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Second pass: the TEAM SUMMARY — the version that ships on the exported
    // report to every chef and manager. Same facts, different audience: it
    // celebrates by name, frames problems as shared priorities without
    // singling anyone out, and carries none of the internal watchlist.
    const teamPrompt = `You are writing the weekly summary that opens the Weekly Culinary Summary report distributed to every Executive Chef and manager in a multi-unit Canadian restaurant group. Use Canadian spelling (Labour, Flavour, Honour).

You are given the same weekly data as the executive team, plus the internal executive analysis. Your version is for the FULL TEAM, so the rules are different:
- Credit wins specifically and by location — recognition should be earned and precise, with the numbers.
- NEVER name a location in connection with anything negative: no budget misses, cost overruns, waste, labour drift, or struggles attributed to a named location. Keep every challenge broad and collective — "a few locations fell short of sales budget", "several stores are running heavy on oil portioning". The detailed per-location numbers appear further down the report for anyone who wants specifics; this summary never singles anyone out. Location names appear ONLY beside wins.
- Do NOT include: the internal watchlist, count-error suspicions, data-gap or ingest commentary, or any narrative-vs-data contradiction call-outs.
- No motivational filler ("keep up the great work", "let's rally"). Professional, warm, and direct — a leader who respects the room.
- 2-3 concise paragraphs, plain text, no headers, no markdown. End with the one or two operational priorities for the week ahead.`;

    let teamSummary = "";
    const teamResp = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: teamPrompt },
          { role: "user", content: `${userContent}\n\n[INTERNAL EXECUTIVE ANALYSIS — context only, do not quote or reveal]\n${opening}` },
        ],
        max_tokens: 550,
        temperature: 0.4,
      }),
    });
    if (teamResp.ok) {
      const teamData = await teamResp.json();
      teamSummary = teamData.choices?.[0]?.message?.content?.trim() || "";
    } else {
      console.error("OpenAI error (team summary):", await teamResp.text());
    }

    // Save server-side so auto triggers from any surface land in one place.
    if (reportRow?.id) {
      let update = supabase
        .from("weekly_summary_executive_reports")
        .update({
          opening_statement: opening,
          ...(teamSummary ? { team_summary: teamSummary } : {}),
          updated_at: new Date().toISOString(),
        })
        .eq("id", reportRow.id);
      // Auto mode never overwrites a statement that appeared since we checked.
      if (mode === "auto") update = update.eq("opening_statement", reportRow.opening_statement ?? "");
      await update;
    } else {
      await supabase.from("weekly_summary_executive_reports").upsert({
        fiscal_year: fiscalYear,
        period_number: period,
        week_number: week,
        opening_statement: opening,
        team_summary: teamSummary,
        leadership_notes: notes,
      }, { onConflict: "fiscal_year,period_number,week_number" });
    }

    return new Response(JSON.stringify({ opening, teamSummary, filed, total }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error in generate-executive-statements:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
