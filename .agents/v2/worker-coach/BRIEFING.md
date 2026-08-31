# BRIEFING — worker-coach

## Mission
Build Phase B (STRATEGY.md §4): the explainable coach — "Why?" surfaces, the ACWR fatigue model, the weekly digest, and mid-workout AI actions. This is the moat phase: make Liftit the only tracker whose coaching can be audited by the user.

## 🔒 Identity
- Archetype: v2_worker
- Working directory: `/Users/rivu/GitHub/Liftit/.agents/v2/worker-coach`

## Scope & Files
1. **"Why?" explanation surface** — extend `src/engine/progression.js`: every `suggestNextSession` result carries an `explanation` object (fired rule id, the sessions analyzed with dates/weights, volume & intensity deltas, plateau window). New `src/components/workout/SuggestionWhy.jsx` renders it as a tap-through sheet; wire into `Workout.jsx` (ExerciseCard suggestion) and `Progress.jsx` (recommendation card).
2. **ACWR fatigue model** — new `src/engine/fatigue.js`: `acwr(workouts, now)` computing acute (7d) : chronic (28d) workload from real logged volume; flag >1.3 (spike) and <0.8 (detrend). Feed as an option into `getDeloadRecommendation`/`suggestNextSession` thresholds (modulate, never override, deterministic rules). Surface status on `Progress.jsx`.
3. **Weekly digest** — extend `src/engine/analytics.js` with `weeklyDigest(workouts, program, now)`: volume trend, PR count, planned week context, ACWR status. Render as a Home card (`src/components/home/DigestCard.jsx`); optional Capacitor Local Notifications behind a Settings toggle (default off).
4. **Mid-workout AI actions** — upgrade `src/ai/coach.js` + `src/components/ai/TrainerChat.jsx` from Q&A to constrained actions: swap exercise, rescale targets, adjust sets. Actions must operate through `src/hooks/useActiveSession.js` mutators, be logged, and be reversible (undo toast). BYO-key only; never ship a hosted default.

## Constraints
- **Honest data rule**: explanation text must show real computed values, never prose invented to sound good. The whole point of this phase is auditability.
- Engine contracts: existing exports and all 176 tests keep passing; additive changes only.
- The LLM never invents loads/reps: it may only call the provided actions, which execute the deterministic engine (hybrid pattern per STRATEGY.md §2/Finding 2).
- AI key handling: follow existing BYO-key rules (`src/ai/providers.js`; key never leaves device).

## Acceptance (mirrors STRATEGY.md §4.B)
- `npm run check` green.
- Engine tests: explanation object present and accurate for each action type; ACWR math unit-tested against hand-computed fixtures (incl. 0-history and single-workout edges).
- UI tests: Why? sheet renders real values; AI action round-trip swaps an exercise and is undoable.
- Digest card degrades to honest empty states.

## Deliverables
Code + tests + dated `changes.md` in this directory. Hand off to orchestrator when `npm run check` passes locally.
