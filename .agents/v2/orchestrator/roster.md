# Team Roster — v2

| Agent | Archetype | Phase | Responsibility | Edit | Bash | Status |
|---|---|---|---|---|---|---|
| orchestrator (self) | v2_orchestrator | A–D | Decompose, dispatch, verify gates, report | deny | ask | active |
| explorer-formats | v2_explorer | A | Pin exact Strong/Hevy/FitNotes CSV schemas; write `specs/*.md` | deny | ask | idle |
| worker-migration | v2_worker | A | Importer core + 3 importers, Settings UI, plate calculator, PR cards | allow | ask | idle |
| worker-coach | v2_worker | B | "Why?" surface, ACWR engine, weekly digest, AI actions | allow | ask | idle |
| worker-ecosystem | v2_worker | C | Recovery readiness, bodyweight + schema v3, share links | allow | ask | idle |
| reviewer-integrity | v2_reviewer | A–D | Integrity/security/code review; hard veto authority | deny | ask | idle |
| sentinel-testing | v2_sentinel | A–D | Owns `npm run check`; adversarial tests; gate reports | allow | ask | idle |

## Rules
- One agent owns one work item at a time (see orchestrator BRIEFING work-item table).
- Never reuse an agent for a second item after its handoff is delivered — spawn a fresh session with the same briefing.
- Reviewer-integrity and sentinel-testing are **non-skippable** gates for every phase.

## Dispatch Log
| Date | Agent | Work item | Outcome |
|---|---|---|---|
| 2026-08-27 | self | Stand-up (briefings + wiring) | complete |
| 2026-08-27 | explorer-formats | A1 CSV specs | 4 specs, Strong/Hevy zero open questions |
| 2026-08-27 | worker-migration (w1) | A3 plates + PR cards | done, 20/20 targeted |
| 2026-08-27 | worker-coach | B1–B3 explainable coach | done, 59/59 targeted |
| 2026-08-27 | worker-ecosystem | C1–C3 ecosystem | done, 56/56 targeted |
| 2026-08-27 | worker-migration (w2) | A2 importers | done, 349/349 full |
| 2026-08-27 | sentinel-testing | ABC gate | GATE PASS 356/17 |
| 2026-08-27 | reviewer-integrity | ABC review | APPROVED (block-deload signed off) |
| 2026-08-30 | worker-ecosystem | HealthKit provider wiring | done, 43/43 targeted |
| 2026-08-30 | worker-migration (w3) | Watch companion | done, 15/15 targeted |
| 2026-08-30 | general | Phase D MCP server | done, 25/25 + stdio smoke |
| 2026-08-30 | sentinel-testing | Wave-3 gate | GATE PASS 408/19 |
| 2026-08-30 | reviewer-integrity | Wave-3 review | APPROVED |
| 2026-08-30 | self | Ship to GitHub | committed + pushed |
