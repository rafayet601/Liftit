# Review — combined Phase A+B+C (uncommitted working tree, reviewed against HEAD)

**Reviewer:** reviewer-integrity · **Date:** 2026-08-27 · **Scope:** everything since HEAD (22 modified files, all untracked new files), per the three workers' handoffs + orchestrator integration (functions/api, schema.sql, sync.js, App.jsx) + a late-arriving sentinel test file.

## VERDICT: APPROVED

`npm run check` (lint + 356 tests + build) green at time of review, run by me. All five veto-level checks pass. Findings below are evidence-backed; two are required acknowledgments before merge, none is a veto.

---

## 1. Honest data rule — PASS

- **The old fabricated target is gone.** `src/pages/Home.jsx` deleted `weekCmp.previous * 1.05` and replaced it with engine-computed `weeklyVolumeTarget` (avg real set volume × planned sets, or last week's real volume; honest 0 when no data — ring hidden when target is 0, Home.jsx:159-165, 375-382; engine at `src/engine/analytics.js` weeklyVolumeTarget).
- **Plate calculator is honest about infeasible loads.** `computePlates` returns `feasible:false` + real `leftoverKg` when a load can't be made (below-bar, sub-plate remainders, cross-unit artifacts); the chip renders `null` when infeasible (`src/components/workout/PlateCalculator.jsx:27-29, 43, 65`).
- **Importer reports real counts incl. zero-import honesty.** Preview counts are computed from parsed rows (`src/data/db.js` previewImport); commit returns `{imported, skipped, replaced, removedWorkouts, createdCustomExercises, setCount}`; the Settings result card shows "Nothing was written — every workout … collided" when `imported === 0` (`src/pages/Settings.jsx`, ImporterCard result block). FitNotes RPE is always `null` — never fabricated (`src/data/importers/fitnotes.js:167`); skipped/failed rows are counted and warned, never silently rewritten (`strong.js:103-137`, `hevy.js:93-125`).
- **Explanations show engine-computed values only.** `buildExplanation` derives every field from the sessions the engine analyzed (`src/engine/progression.js:160-183`); `SuggestionWhy.jsx` renders them verbatim, "—" for null deltas, raw kg explicitly labeled (`SuggestionWhy.jsx:41-90`).
- **ACWR/readiness degrade honestly.** `acwr` returns `ratio:null, status:'insufficient_data'` with <7 days history or zero chronic volume; future-dated logs ignored (`src/engine/fatigue.js:57-59`); `computeReadiness` requires ≥3 usable samples and renormalizes weights over only the metrics that actually exist (`src/data/recovery.js:63-90`); Progress chip shows "Building load history" for insufficient data (`src/pages/Progress.jsx` acwrChip map).
- **Digest/PR cards use real events.** `weeklyDigest` reuses `weeklyVolumeComparison`, real `prTimeline` events in the trailing 7 days, and `acwr`; message assembled only from those (`src/engine/analytics.js` weeklyDigest). `buildPrCardModel` returns `null` with no PR — no invented numbers (`src/components/ui/ShareCard.jsx:31-33, 195`); History hides the card when the exercise has no PR event (`src/pages/History.jsx:250-253`).
- Grep sweep for suspicious multipliers/randomness across new engine/UI code: clean.

## 2. Security — PASS

- **`src/ai/providers.js` untouched** (not in `git status`). Export still strips `apiKey` (`src/data/db.js:634-645`); import still keeps the device's AI config and only takes workouts/programs/profile from the file (`src/data/db.js:656-667`). The schema v3 change did not weaken this — `createSettings` re-normalizes with `ai` preserved (`src/data/schema.js:111-130`), and `settings.update` merges AI rather than replacing (`src/data/db.js:603-612`).
- **AI action protocol cannot execute code or act on unvalidated targets.** `parseCoachActions` is pure JSON parsing (no eval/Function anywhere — grep clean), whitelist of exactly 3 action shapes, cap 3, per-candidate try/catch (`src/ai/coach.js:100-160`). `validateAction` requires `exerciseKey` to exist in the live session and `newExerciseId` to resolve via `db.exercises.byId`; ranges clamped (`coach.js:70-97`). Execution only via `applySessionAction` — never auto-applied; TrainerChat shows Apply/Dismiss chips, `applySessionAction` re-validates independently of the parser, rescale only ever grows the set list (logged sets never deleted), every apply snapshots for undo (`src/hooks/useActiveSession.js:100-210`; `src/components/ai/TrainerChat.jsx` chips + undo).
- **Share links are clamped and cannot repoint AI config.** `programFromFragment` rejects >100 KB / bad charset / non-JSON / non-object, then `sanitizeProgram`: `createProgram` normalization + hard clamps (≤14 days renumbered, ≤20 ex/day, text ≤2000, enums whitelisted, numeric ranges), fresh id, `isActive:false` always (`src/data/shareLinks.js:72-146`). The imported program is written only to `d.programs` via `db.programs.save` (`src/pages/Program.jsx` ImportShare `confirm`) — it cannot touch `settings.ai`. Import is preview-before-commit with Cancel.
- **Importers can't inject via CSV cells.** Hostile tests exist and pass: `=HYPERLINK("http://evil.example",…)`, `=cmd|' /C calc'!A1`, 1000+ char names stored as inert strings; AI key provably untouched by import (`src/test/importers.test.js:330-337, 660-674`). Import commit never enqueues sync ops and never writes settings (`src/data/db.js` commitImport — only `d.workouts` mutation + `db.exercises.addCustom`).
- **Recovery sends nothing off-device.** `createRecoveryProvider` only looks up a local Capacitor plugin at runtime, no network calls, every failure degrades to `[]`; default is `noopProvider` (`src/data/recovery.js:96-163`). `RecoveryContext` computes locally, opt-in default off (`src/contexts/RecoveryContext.jsx`).

## 3. Local-first invariants — PASS

- Bodyweight is local-only: `db.bodyweight.add/remove` mutate the document only — no `enqueue()` (`src/data/db.js:564-596`). Same for importer commit. Sync queue untouched by both (asserted in `src/test/importers.test.js`).
- Orchestrator's program sync (`src/data/sync.js`) keeps the local-first contract: push is best-effort with per-op failure, program pull failure is logged and reported without masking workout pull (`sync.js:134-150`); pulled programs are add-only, local active program wins unless the remote explicitly activated one (`src/data/db.js` `programs.importRemote`, covered by new `db.test.js` tests incl. replay-idempotence).
- Server side (`functions/api/[[route]].js`, `schema.sql`) mirrors the workouts contract: auth-gated, Pro-gated writes, payload clamped to `LIMITS.programPayload` (100 KB), name clamped, idempotent `(user, client_id)` upsert. No new third-party dependencies anywhere (hand-rolled CSV parser, base64url, SVG sparkline).

## 4. Engine contracts — PASS with one flag

- `git diff` on `engine.test.js`, `db.test.js`, `sync.test.jsx`: **additions only; no existing assertion weakened or removed.** e2e untouched.
- ⚠️ **Flag (orchestrator must acknowledge):** `src/engine/progression.js:70-93` is **not purely additive** — a new block-level deload branch short-circuits before the increase/reduce/hold branches, changing `suggestNextSession` outputs for multi-week-plateau inputs. This contradicts worker-coach's handoff ("No existing export changed"). I did not veto it because: it is driven by the pre-existing `analyzeDoubleProgression`/`getDeloadRecommendation` (real data, no fabrication), it can only *escalate* a deload (never suppress — healthy progression covered by a new test), and all pre-existing engine tests still pass unchanged (`engine.test.js:105-144` adds three new tests for it). But it is a user-visible recommendation change and it was misreported in the handoff — the orchestrator should sign off explicitly.

## 5. Migration safety — PASS

- v2→v3: `load()` detects `parsed.version !== SCHEMA_VERSION` on the raw stored JSON, normalizes through `createDocument` (which stamps `version: SCHEMA_VERSION`, `src/data/schema.js:138`), and persists once (`src/data/db.js:45-62`) — no re-migration loop (next load sees version 3; verified by `schema-v3.test.js` write-back test).
- `db.import` accepts version 2 **or** 3, rejects 1/4/garbage (`src/data/db.js:648-655`); v2 docs gain `bodyweightEntries`/`settings.recovery` defaults via normalization. v1 migration path (`migrateFromV1`) untouched.
- Share-link decode path is the same normalization-plus-clamps posture; encode side throws >100 KB instead of emitting a dead link.

## Non-blocking findings

1. **progression.js behavior change** — see §4 flag. Required: orchestrator acknowledgment in the phase record.
2. **`db.programs.importRemote` sanitization asymmetry** (defense-in-depth, `src/data/db.js` ~line 505-530): pulled payloads go through `createProgram` (numeric coercion) but not the string/collection clamps that `shareLinks.sanitizeProgram` applies. The server clamps total payload to 100 KB and is first-party, so exploitability is low — but if programs ever come from a less trusted path, route them through `sanitizeProgram`. Optional hardening.
3. **Dead code:** `mergedDates` in `src/data/importers/fitnotes.js:135,172` is populated but never read.
4. **Formatting nits:** `src/pages/Workout.jsx:15` has two imports collapsed onto one line (`} from 'lucide-react';import clsx …`); History.jsx indentation churn around the stats grid (diff-only noise). Lint passes regardless.
5. **Process note:** `src/test/sentinel-abc.test.js` (untracked, sentinel-testing agent) appeared mid-review and was briefly red with two incorrect assertions (expected `trendPct` to be null with exactly 2 flat values — the documented contract returns 0; and a 1.45 MB fixture asserted >1.5 MB). The sentinel agent corrected both (file now asserts the honest values); my final full `npm run check` at 18:10 is green. The corrected assertions match the product's documented behavior — not weakened tests.

## Test evidence

- `npm run test` → **17 files, 356 tests, 0 failures** (run by reviewer, twice; the mid-review red was the in-flight sentinel file above).
- `npm run check` → lint + tests + build all green.
- Grep sweeps: no `eval(`/`new Function`/`innerHTML` in any new module; no suspicious constants; `apiKey` appears in new code only in the export-strip path (`db.js:640`).
