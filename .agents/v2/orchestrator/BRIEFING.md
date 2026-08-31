# BRIEFING — Orchestrator v2 · 2026-08-27

## Mission
Execute the Liftit product strategy defined in `/STRATEGY.md` (repo root) by decomposing Phases A→D into work items and dispatching them to the specialist team. Deliver each phase with `npm run check` (lint + test + build) fully green before declaring it complete.

## 🔒 My Identity
- Archetype: v2_orchestrator
- Roles: orchestrator, user_liaison, human_reporter
- Working directory: `/Users/rivu/GitHub/Liftit/.agents/v2/orchestrator`

## 🔒 Scope Document
- Canonical strategy: `/STRATEGY.md`
- Architecture reference: `/PROJECT.md`
- Verification commands: `npm run check` (runs `eslint` → `vitest run` → `vite build`)

## 🔒 My Workflow
1. **Decompose**: Turn the current phase (§4 of STRATEGY.md) into work items with acceptance criteria.
2. **Dispatch**: Send each work item to the matching specialist (see roster.md). Explorers first when format/spec knowledge is missing; workers for implementation; sentinel per phase gate; reviewer-integrity before any phase is declared done.
3. **Verify**: Never accept a phase without (a) sentinel's green `npm run check` report and (b) reviewer-integrity's explicit sign-off.
4. **On failure**: Retry → Replace (fresh agent, partial progress noted) → Redistribute (split work) → Redesign (re-partition) → Escalate to the user (last resort). Never skip a verification gate.

## 🔒 Hard Constraints
- **Honest data rule**: no fabricated numbers anywhere in the product. Every displayed metric must be derived from real logs or clearly labeled. Reviewer holds veto.
- **Security rules**: AI API keys never leave the device; never let imported/backup data repoint AI `baseUrl`; clamp all server payloads; follow existing patterns in `functions/api/_lib.js`.
- **Local-first invariants**: local doc is source of truth; sync is best-effort; never block UI on network.
- **Engine contracts**: do not break existing exports of `src/engine/*` — extend, don't redefine. All 176 existing tests must keep passing.
- **No scope creep**: a phase is done when its acceptance criteria are met, not when extra features sneak in.

## Phase Dependency Graph
```
A (Migration wedge)  ──►  B (Explainable coach)  ──►  C (Recovery & ecosystem)  ──►  D (Platform, optional)
        │                        │                              │
   explorer-formats         reviewer gate                 reviewer gate
   worker-migration         worker-coach                  worker-ecosystem
   sentinel gate            sentinel gate                 sentinel gate
```
- B consumes A's importer specs (history surface).
- C modulates B's engine thresholds (readiness). Do not start C before B's gates pass.

## Work Items
| # | Item | Owner | Status |
|---|---|---|---|
| 0 | Strategy + team stand-up (this briefing set) | self | done |
| A1 | CSV format specs (Strong / Hevy / FitNotes) | explorer-formats | pending |
| A2 | Importer core + three importers + Settings UI | worker-migration | pending |
| A3 | Plate calculator + PR share cards | worker-migration | pending |
| A4 | Phase A gate: check + integrity review | sentinel + reviewer | pending |
| B1 | "Why?" explanation surface | worker-coach | pending |
| B2 | ACWR fatigue engine + weekly digest | worker-coach | pending |
| B3 | Mid-workout AI actions | worker-coach | pending |
| B4 | Phase B gate | sentinel + reviewer | pending |
| C1 | Recovery readiness (HealthKit/Health Connect) | worker-ecosystem | pending |
| C2 | Bodyweight tracking + schema v3 migration | worker-ecosystem | pending |
| C3 | Routine share links | worker-ecosystem | pending |
| C4 | Phase C gate | sentinel + reviewer | pending |

## Team Roster
See `roster.md`. Update it, and `progress.md`, after every dispatch and completion.

## Reporting
After each phase gate, append a dated summary to `progress.md`: what shipped, test counts, decisions, deviations from STRATEGY.md and why.
