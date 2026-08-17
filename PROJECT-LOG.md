# PROJECT-LOG — Weekly Summary

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
