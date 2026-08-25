# PROJECT-LOG — Weekly Summary

[2026-08-25] OC item renumber: match across suffix changes
Shipped:   Reviewed the OC rename Michael flagged: not just 25→26 — every suffix (22/23/24/25) moved to 26 in the week of Aug 16-23, splitting item histories (105 confirmed splits, ~300 more coming as weeks upload). Fix: all matching/aggregation now keys on the suffix-stripped name, displaying the newest variant — consolidated report + print sheet, guided week-vs-4-week comparison (sums old+new variants), and the executive statement's persistence/concept analysis (deployed). No historical data rewritten; future renumbers handled automatically. Verified BTW Butter Unsalted reads as one continuous 22→26 series.
Roadmap:   Menu variance data reliability -> item matching hardened
Decisions: Normalize at comparison time instead of renaming history — a one-time rename would re-fragment weekly as the ~300 remaining items' new names appear, and would need redoing at the next renumber.
Blockers:  none
Next:      Merge (frontend matching needs the deploy; the statement function is already live).

[2026-08-24] Team summary: no locations named beside negatives
Shipped:   Team-summary prompt rule changed per Michael: location names appear only beside wins; all challenges stay broad and collective ("a few locations fell short..."), with per-location detail left to the report tables below. Deployed (server-side only, no frontend change) and W3 regenerated — verified the new team summary names Burlington/Bauer/Toronto for wins only, challenges unnamed, and the row saved.
Roadmap:   Executive statements -> live and tuned
Decisions: Public praise by name, private accountability — the split is now enforced in the prompt.
Blockers:  none
Next:      Cambridge chef re-uploads Count Amounts for P13 W1-W3; watch next week's first fully-automatic generation.

[2026-08-24] Merged: ingest visibility + two-audience summaries live
Shipped:   PR #61 merged to main (4f93c74); Vercel production deployment of that commit verified READY. Live now: chef variance-store confirmations, HQ Data completeness panel, Internal Executive Summary (exec-only) + Team Summary (export-only), auto-generation at 16/16, closing statement removed.
Roadmap:   Executive statements -> live; Menu variance reliability -> live (Cambridge re-upload still pending)
Decisions: none
Blockers:  none
Next:      Michael reviews both W3 summaries in the live UI; Cambridge chef re-uploads Count Amounts for P13 W1-W3 to backfill and surface their store error.

[2026-08-24] Two-audience summaries: internal executive + shared team version
Shipped:   The candid good/bad/ugly read is renamed Internal Executive Summary (badged "executive team only — not included in the export"). New team_summary column + second AI pass writes the softer Team Summary for all chefs/managers: wins credited by name with numbers, challenges framed as shared priorities, no watchlist/count-error/data-gap/contradiction content. The exported report now carries ONLY the team version. Both generate together (auto on 16/16 or Regenerate Summaries). Live-verified on P13 W3: both saved (internal 2,187 chars, team 1,390) and the tones separate cleanly.
Roadmap:   Executive statements -> complete (two-audience; pending Michael's read + merge)
Decisions: Team version may name locations for factual results but never for discipline failures or reporting contradictions — that split is in the prompt per Michael's direction.
Blockers:  none
Next:      Michael to read both W3 versions on the dashboard, then merge (auto-trigger + export swap need the deploy).

[2026-08-24] Opening statement rebuilt: auto-generates from full consolidated read
Shipped:   Root cause of "AI disabled": generate-executive-statements was never deployed and its repo copy queried pre-rename tables. Rebuilt + deployed: opening statement auto-generates when all 16 locations have filed (triggered by the last chef's finish and by dashboard open; manual Regenerate button kept), built from every location's numbers/notes, usage variance compared by concept (systemic vs concentrated), and deterministic findings — persistent item offenders (trailing 4 wks), count-error suspects, execution gaps in dollars, WoW swings, data gaps/ingest failures — structured as The Good / The Bad / The Ugly / Watchlist with narrative-vs-data contradiction call-outs. Closing statement removed from dashboard + export. Also found and fixed executive-report row duplication (loader re-inserted on every dashboard open once maybeSingle failed on duplicates: 689 rows for 23 weeks → deduped, unique week constraint added, writers upsert). Live-verified on P13 W3: statement generated and saved, repeat auto call skips.
Roadmap:   Executive statements -> complete (pending Michael's read of the live W3 statement)
Decisions: Statement saved server-side so auto triggers from chef finish and dashboard land in one place; closing statement retired per Michael.
Blockers:  none
Next:      Michael to review the generated P13 W3 statement on the dashboard and tune tone/length preferences; then merge.

[2026-08-24] Cambridge variance gap: diagnosed + made ingest failures visible
Shipped:   Diagnosis: the consolidated menu report's per-item data comes solely from each chef's weekly Count Amounts upload; Cambridge's store has failed/skipped silently since WE 2026-07-26 (three weeks of filed summaries, zero variance rows) and Burlington's W1 stored 1 row — the code swallowed store errors. Fix (commit ba1f73d): chefs now see an explicit "N items stored" confirmation or a failure banner with the real error on the usage step; a missing location/week context reports instead of silently skipping; every attempt is recorded in new weekly_summary_ingest_log (migration applied); the Usage Variance by Concept page shows a Data completeness panel naming each location/week with no stored items plus logged failures. Typecheck/lint/build deltas clean vs baseline.
Roadmap:   Menu variance data reliability -> in progress (visibility shipped; Cambridge backfill pending re-upload)
Decisions: none
Blockers:  Root cause of Cambridge's specific failure unknown until their chef re-uploads and the error surfaces.
Next:      Merge; then have the Cambridge chef re-open the usage step and re-upload Count Amounts for P13 W1–W3 — the banner/log will show the exact error and backfill the print sheet.
Note:      Correction — yesterday's diagnosis message claimed this was already filed to the bus; it was not. Filed now with this entry.

[2026-08-23] Weekly Package 2.0 beta live: merged, deployed, Guelph piloting
Shipped:   PR #60 merged to main (c59535a); Vercel production deployment of that commit verified READY. Beta flag guided_package_v2 enabled for Beertown Guelph (verified by read-back — the only flagged location). From this week's filing, Guelph's chef sees the week recap and the sales/discounts prefills; every other location is unchanged.
Roadmap:   Chef workflow auto-prefill -> beta live at one pilot location
Decisions: Pilot = Beertown Guelph (Michael's pick).
Blockers:  none
Next:      Watch Guelph's first beta filing this week; then decide on expanding the pilot and building the next prefills (labour/promo/team).

[2026-08-23] Weekly Package 2.0 beta: CGOPS prefills + AI week recap
Shipped:   chef-week-pack edge function (deployed) assembles a location's week from the CGOPS daily feeds: daily food sales (POS FOOD-* classes), BOH labour estimate (SLP), discounts pre-grouped into the chef review categories, and an AI "week that was" recap from daily journals/recaps/guest feedback. Guided package shows prefill panels on the sales and discounts steps plus the recap on the start step — one click to apply, always chef-overwritable (editing dailies or uploading the usual reports replaces the prefill). Gated per-location by new weekly_summary_beta_features table (flag guided_package_v2, default OFF — existing workflow untouched). Verified live against Wildcraft P13 W3: 6/7 POS days summed correctly, labour $18,928.82, discounts categorized (Quality Issue 4/$119.50, Steak Over/Under 4/$107), recap generated. POS feed history starts 2026-08-17, so prefills only exist from this reporting week forward.
Roadmap:   Chef workflow auto-prefill -> in progress (sales + discounts + recap shipped to beta; labour/promo/team next)
Decisions: Beta gate is a per-location DB flag, not a build split — one codebase, pilots opt in, everyone else unchanged on Monday. SLP total-sales figure not shown as a "mismatch warning" against food-only sales (different denominators).
Blockers:  Branch not yet merged to main; no pilot locations flagged yet — both are Michael's call.
Next:      Michael to name the pilot locations (one SQL insert each) and merge when ready; then watch the first beta filings.

[2026-08-23] Audit: chef workflow fields CGOPS daily data could prefill
Shipped:   Audit only, no code. Mapped all 18 guided-package steps against CGOPS platform daily tables and verified feed freshness (slp_sales/labor/promo, pos_daily_summary, pos_void_items, discount_records, daily_logbook, location_daily_recaps, guest_feedback all current through 2026-08-22). Strong prefill candidates: sales step (slp_sales_data / POS FOOD-* classes replace the profit-centre upload), discounts step (discount_records replace the CSV upload), kitchen labour (slp_labor_data BOH dept), BOH promo (slp_promo_data), team/staffing + hires (People Center), narrative enrichment (logbook journals, daily recaps, AI findings, guest feedback), audit score (Audit Center once adopted), usage review possibly from HQ's existing item-variance ingest. Not coverable yet: speed-of-service times, GL purchases by category, inventory/on-hand, explicit overtime split, per-item feature sales.
Roadmap:   Chef workflow auto-prefill -> planned (scope pending Michael's pick of candidates)
Decisions: none
Blockers:  none
Next:      Michael to pick which prefills to build first; recommend starting with the three file-upload replacements (sales, discounts, usage).

[2026-08-17] Decision: chef email login runs parallel to PINs, then PINs retire
Shipped:   Nothing built — decision session. Reviewed the current auth: chefs use plaintext PINs against weekly_summary_users; office cohort already enters via CGOPS SSO handoff (cgopsSession.ts). Advised against sharing PIN credentials with Production Center (extends a known git-history exposure into a new app); Production Center launches on CGOPS email login instead.
Roadmap:   Chef email auth (parallel run) -> planned; PIN retirement -> planned (after adoption)
Decisions: Michael: Production Center uses email auth from day one. Weekly Summary adds CGOPS email login for chefs alongside the existing PIN door, team migrates gradually, PINs retire once adoption is complete. PIN rotation deliberately skipped given the retirement path.
Blockers:  none
Next:      When Michael green-lights the build: bind chef CGOPS accounts to locations, add the email door to the Weekly Summary login, and track PIN vs email usage to time retirement.

[2026-08-17] Fixed consolidated YTD sales variance
Shipped:   Consolidated YTD variance is now a straight actual-minus-budget — the old formula deducted "unelapsed weeks" from a YTD budget that already ran only through the reporting week, overstating performance by (4−week)/4 × period budget (P13 W2: showed +$961,262, truth −$1,566,781; new formula reproduces Intacct to the dollar, PTD unchanged at −$2,613). Also: no-P&L locations' YTD actuals now anchor to their latest chef recap estimate (matching the per-restaurant lines so totals tie), and YTD budget comes from that same anchor row so a location that missed filing this week no longer adds actuals with zero budget. Typecheck/lint/build identical to baseline.
Roadmap:   Consolidated YTD accuracy -> complete (pending Michael regenerating the email against live data)
Decisions: PTD pro-rating kept — the P&L period budget genuinely is a full-period figure, verified against the email's −$2,613.
Blockers:  none
Next:      Michael to regenerate the Weekly Culinary Summary email for P13 W2 and confirm the CG Consolidated YTD variance reads ≈ −$1.57M against Intacct.

[2026-08-17] Diagnosed wrong YTD sales variance on consolidated summary
Shipped:   Diagnosis only, no code change. The consolidated YTD sales variance in the Weekly Culinary Summary email subtracts "unelapsed weeks" budget from the P&L's ytd_budget, but that budget (and the chef recap's) is already through the reporting week — so the variance is inflated favourably by (4−week)/4 × period budget. Verified to the dollar against Intacct FY2026 P13 W2: true YTD food sales variance −$1,566,781; email shows +$961,262; difference exactly 2/4 × $5,056,086. Per-restaurant rows use the correct straight subtraction, so restaurant lines and brand totals disagree. Secondary: locations without a finalized current-week P&L get YTD actuals rebuilt purely from chef-entered weekly sales (unfiled weeks count $0, earlier P&Ls ignored), and a location with year rows but no current-week chef row adds actuals with no budget.
Roadmap:   Chef PDF correctness -> complete; Consolidated YTD accuracy -> in progress (diagnosed, fix pending Michael's go-ahead)
Decisions: none
Blockers:  none
Next:      On Michael's go-ahead: drop the unelapsed-week subtraction in WeeklyExecutiveReport (one line) and decide how Path-B YTD actuals should anchor to the latest P&L baseline.

[2026-08-17] Chef PDF: all notes now print; page 1 = numbers + summary
Shipped:   The seven missing chef note fields now render in a new Plans & Commentary section (food-cost commentary, overtime, labour-transfer reasons, discount review, speed of service, features commentary, usage-review table with per-item chef comments). Hard truncation removed from hiring/development/team-members/R&M/cleaning/audit/feature notes — long text paginates. Page 1 is the restaurant's numbers plus one week-in-review summary; the AI summary prompt now includes every note the chef writes. Verified by smoke-rendering a fully populated PDF in Node and probing the output for every section (all present; empty and malformed-data cases render cleanly).
Roadmap:   Chef PDF correctness -> complete (pending Michael's live check)
Decisions: Sales/labour action plans moved off page 1 into Plans & Commentary so page 1 stays numbers + summary, per Michael's direction. Committed-actions cap of 8 left in place — still Michael's open call.
Blockers:  none
Next:      Michael to regenerate one real week's PDF and confirm layout; then decide on the 8-action cap and dropped-action status handling.

[2026-08-17] Chef name restored to PDF header; chef-notes audit
Shipped:   Shared PDF builder now looks up the location's chef of record from weekly_summary_users (one chef per restaurant, verified) and prints it in the header — all three generation paths (main screen, guided Regenerate, HQ viewer) name the same person, better than the old behaviour of printing whoever was logged in. Typecheck/lint/build clean vs baseline. Also audited every chef-entered field against what the PDF renders.
Roadmap:   Chef PDF correctness -> in progress (audit found gaps, awaiting Michael's ruling)
Decisions: Chef name comes from the chef-of-record lookup, not the logged-in exporter, so HQ-generated PDFs also carry it.
Blockers:  none
Next:      Michael to rule on the audit findings: seven chef-entered note fields never render in the PDF (food-cost commentary, features commentary, overtime notes, labour-transfer reasons, discount review, speed-of-service, usage-review comments) and several rendered ones are hard-truncated.

[2026-08-17] Fix chef-downloaded PDFs missing committed actions
Shipped:   Main-screen "Export to PDF" on the Weekly Chef Summary now routes through buildChefSummaryReport (the shared builder used by the guided package's Regenerate PDF and the HQ Executive Report). The legacy hand-assembled path passed undefined for weekAheadActions and never queried weekly_summary_actions, so chef-downloaded/emailed PDFs showed the "no committed actions" placeholder despite saved actions. ~100 lines of duplicated FCAP/food-cost assembly deleted; save-before-export guard unchanged. Verified root cause in code myself (WeeklyChefSummary.tsx:969 passed undefined); typecheck/lint deltas clean vs baseline; production build passes. Not yet verified against live data.
Roadmap:   Chef PDF correctness -> complete (pending Michael's live check)
Decisions: Main-screen PDFs no longer print the exporting chef's name — the shared builder omits it, matching the guided Regenerate and HQ PDFs; accepted as the cost of one canonical output.
Blockers:  none
Next:      Michael to spot-check one live week (e.g. Wildcraft FY2026 P13 W2) from the main screen's Export to PDF, and rule on the actions-table polish items below.

[2026-08-13] Adopt CG Universal Task List Standard protocol
Shipped:   New protocol persisted in CLAUDE.md: before designing/building any task/checklist/action/assignment feature, read the "CG Universal Task List Standard" from the CG bus (newest active version, metadata kind='standard') and conform to its §6 checklist; deviations need Michael's explicit sign-off filed as a decision. Verified the standard exists on the bus (UTL v1, active). No application code changed.
Roadmap:   Task list standard adoption -> complete (protocol persisted; applies at build time)
Decisions: none
Blockers:  none
Next:      Apply the standard's §6 checklist the first time a task/checklist feature is designed in this app.

[2026-08-13] Adopt session log + filing protocol (v2, CG)
Shipped:   PROJECT-LOG.md created at repo root; filing protocol persisted verbatim in CLAUDE.md (including the CG bus ref) so future sessions inherit it. This entry filed to the CG bus. No application code changed.
Roadmap:   Session log + filing protocol -> complete
Decisions: File to the bus as project "Weekly Summary", filed_by "Weekly Summary (Claude Code)" — matches the naming pattern already used by sibling CG projects on the bus.
Blockers:  none
Next:      Prepend a log entry here and file it to the bus at the end of every working session.
