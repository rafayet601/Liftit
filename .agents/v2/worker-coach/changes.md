# changes.md — worker-coach · 2026-08-27

Phase B (STRATEGY.md §4.B): the explainable coach. All four scope items implemented additively on top of the concurrent working tree.

## Files

**Created**
- `src/engine/fatigue.js` — ACWR model
- `src/components/workout/SuggestionWhy.jsx` — Why? sheet + WhyButton
- `src/components/home/DigestCard.jsx` — weekly digest card
- `src/test/fatigue.test.js` — 13 tests, hand-computed fixtures
- `src/test/explanation.test.js` — 17 tests (explanations, digest, AI protocol, round-trip)

**Edited (additive)**
- `src/engine/progression.js` — every `suggestNextSession` result now carries `explanation`; new `explainProgression(sessions)` export for the Progress surface. No existing export changed; existing results gain one key.
- `src/engine/analytics.js` — new `weeklyDigest(workouts, program, now)`; imports `acwr` (fatigue) and `currentProgramWeek` (both cycle-free).
- `src/hooks/useActiveSession.js` — additive: `getActiveSession()`, `applySessionAction(action)`, `undoSessionAction(snapshot)`, `getSessionActionLog()`. Existing mutators untouched.
- `src/ai/coach.js` — active-session block + action protocol appended to the system prompt (only when a session is live); new `parseCoachActions(reply)` export.
- `src/components/ai/TrainerChat.jsx` — action-confirm chips (Apply/Dismiss) + applied·Undo chip; action JSON stripped from displayed text.
- `src/pages/Workout.jsx` — Why? button (Info icon) on the ExerciseCard suggestion line → SuggestionWhy sheet.
- `src/pages/Progress.jsx` — ACWR status chip near the recommendation card; `applyFatigueContext` applied to the deload recommendation; Why? on the recommendation card via `explainProgression`.
- `src/pages/Home.jsx` — DigestCard mounted below the stat tiles / above the main grid.

## Item status

### 1. "Why?" surface ✅
- Every `suggestNextSession` branch (start/no-history, start/no-working-sets, block-plateau deload, regression deload, 3-session-stall deload, increase, reduce, hold) returns:
  `{ rule, sessionsAnalyzed: [{date, topWeight, topReps, avgRpe}], volumeDeltaPct, intensityDeltaPct, plateauWindowWeeks }`.
- All values computed from the sessions the engine actually examined (`topReps` = min reps at top weight, same definition the decision uses; deltas = newest vs oldest of the analyzed span, `null` when <2 sessions; plateau weeks = block analyzer value, or the real 3-session span for the stalled rule).
- `SuggestionWhy.jsx` renders these verbatim (raw engine kg, explicitly labeled) — no invented prose anywhere. Deltas render "—" when null.

### 2. ACWR ✅
- `acwr(workouts, now)` → `{ ratio, status, acuteVolume, chronicWeeklyVolume }`.
  - acute = working volume (no warmups/zero sets) trailing 7d; chronic = 28d total / 4.
  - `spike` >1.3, `detrend` <0.8, else `balanced`; `insufficient_data` (ratio `null`) when history spans <7 days or chronic volume is 0. Future-dated logs ignored.
- `applyFatigueContext(deloadRec, acwrResult)`: on `spike` it ESCALATES a non-deload to a deload (reason string embeds the real ratio + acute/chronic volumes) and confirms (never suppresses) an existing deload. Any other status returns the rec untouched. Wired into Progress via `applyFatigueContext(getDeloadRecommendation(analysis), acwr(workouts))`.

### 3. Weekly digest ✅
- `weeklyDigest` returns `{ volumeCmp, volumeDeltaPct, prCount, sessions, acwrStatus, programWeek, message }`. Reuses `weeklyVolumeComparison` + `prTimeline` (PR events within trailing 7d) + `acwr`; `message` is assembled exclusively from those computed values. No OS notifications, no package.json changes (explicitly deferred per dispatch).
- DigestCard renders the engine message verbatim + chips; empty data degrades to the honest "No sessions logged yet" state.

### 4. Mid-workout AI actions ✅
- Protocol (appended to system prompt only when an active session exists): the model may end its reply with ONE strict-JSON line or one fenced ```json block — a single action object or an array of ≤3:
  - `{"action":"swap_exercise","exerciseKey":"sx_…","newExerciseId":"<library id>"}`
  - `{"action":"rescale_targets","exerciseKey":"sx_…","targetSets":1-10}`
  - `{"action":"set_target_reps","exerciseKey":"sx_…","repsMin":n,"repsMax":n}`
- Parsing is defensive: try/catch per candidate, dedupe, cap 3; validation requires the exerciseKey to exist in the live session and the newExerciseId to resolve via `db.exercises.byId`; `targetSets` clamped 1–10; reps clamped 1–50 with `repsMin < repsMax` enforced; anything malformed is ignored and raw text still shows.
- Execution only via `applySessionAction` (through `updateSession`): swaps replace the exercise in place (fresh sets, same key), rescales only ever GROW the set list (logged sets are never deleted), and every apply captures a deep snapshot for `undoSessionAction`. All applies/undos append to `getSessionActionLog()`.
- TrainerChat NEVER auto-applies: chips show "Apply swap: X → Y" with Apply/Dismiss; after Apply an "Applied · …Undo" chip restores the snapshot. BYO-key only, unchanged (`src/ai/providers.js` untouched; key never leaves the device).

## Decisions / notes for orchestrator & reviewer
- `fatigue.js` duplicates the 3-line working-volume definition instead of importing `analytics.js`, so `analytics → fatigue` stays cycle-free.
- Escalated deloads surface in the existing DeloadCard (reason text replaced by the ACWR-escalation string when escalated; `suggestedIntensityReduction` defaults to 0.9 if absent).
- Digest `programWeek` clamps via the existing `currentProgramWeek(program, now)` (caught by test: forgetting `now` clamps to the real today).
- Bug found & fixed during testing: initial ACWR used min-age for "oldest workout"; fixtures caught it (now max-age → history span).
- Did NOT run full `npm run check` (concurrent agents); ran the scoped commands below instead. No commits made.

## Verification
- `npx vitest run src/test/fatigue.test.js src/test/explanation.test.js src/test/engine.test.js` → **3 files, 59/59 passed** (existing engine tests untouched and green).
- `npx vitest run src/test/smoke.test.jsx` → 6/6 passed (page-mount sanity after Home/Progress/Workout edits).
- `npx eslint <all 13 owned files> --max-warnings 0` → clean.
