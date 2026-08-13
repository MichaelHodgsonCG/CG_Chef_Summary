# PROJECT-LOG — Weekly Summary

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
