# BRIEFING — worker-migration

## Mission
Build Phase A (STRATEGY.md §4): the migration wedge — CSV importers, plate calculator, and PR share cards — so users of Strong/Hevy/FitNotes can switch with full history in under a minute.

## 🔒 Identity
- Archetype: v2_worker
- Working directory: `/Users/rivu/GitHub/Liftit/.agents/v2/worker-migration`

## Scope & Files
1. **Importer core** — new `src/data/importers/core.js`: canonical intermediate shape, date parsing (incl. locale decimals), fuzzy exercise-name matching via existing `matchExerciseByName` (`src/data/exercises.js`), custom-exercise auto-creation (reuse `db.exercises.addCustom`), skip-vs-replace collision policy on duplicate dates.
2. **Importers** — `src/data/importers/strong.js`, `hevy.js`, `fitnotes.js` per explorer-formats specs. All weights normalized to kg at the edge (house rule; see `UnitContext`).
3. **UI** — Settings → Data section (`src/pages/Settings.jsx`): file picker, preview (counts: workouts/sets/matched vs unmatched exercises), confirm, result report. Follow existing UI primitives (`src/components/ui/Primitives.jsx`).
4. **Plate calculator** — `src/components/workout/PlateCalculator.jsx`: given kg weight, bar (20kg / 45lb), and standard plate set, render per-side plates. Wire into `SetRow.jsx` and the engine suggestion line in `Workout.jsx`. Respect `UnitContext`.
5. **PR share cards** — `src/components/ui/ShareCard.jsx`: 9:16 canvas card from `prTimeline` events; entry from History PR rows. No external deps — Canvas/SVG + toBlob.

## Constraints
- Read `src/data/db.js` and `src/data/schema.js` first; use `createWorkout`/`createSet` for normalization — never hand-roll document shapes.
- Import must be an explicit user action with preview before commit (no silent merges). Imported workouts follow the same shape the v1 migration produces.
- **Honest data rule**: no fabricated numbers. Unmatched exercises become custom exercises (existing pattern), never silently dropped.
- Never touch AI config during import (see hostile-backup protections in `db.import`).
- Existing 176 tests must keep passing; extend, don't redefine `src/engine/*`.

## Acceptance (mirrors STRATEGY.md §4.A)
- `npm run check` green.
- Vitest unit tests per importer: golden-file round-trip of a real-format export, malformed CSV (bad headers, empty rows, decimal commas, mixed units) handled without crash and reported honestly.
- Plate calculator tests: kg and lbs, weights below bar weight, non-clean plate splits.
- No new dependency heavier than a CSV text parser (prefer hand-rolled parsing).

## Deliverables
Code + tests as scoped, plus a dated `changes.md` in this directory summarizing files touched and decisions made. Hand off to orchestrator when `npm run check` passes locally.
