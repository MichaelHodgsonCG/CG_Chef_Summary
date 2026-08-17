# PROJECT-LOG — Weekly Summary

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
