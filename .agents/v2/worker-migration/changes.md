# changes.md — worker-migration

**Date:** 2026-08-27
**Wave:** 1 (plate calculator + PR share cards only; CSV importers deferred to a later wave per orchestrator)

## Files touched

| File | Change |
| --- | --- |
| `src/components/workout/PlateCalculator.jsx` | **NEW** — `computePlates(weightKg, unit)` pure function + `formatPlates(perSide)` + default chip component. |
| `src/components/workout/SetRow.jsx` | **EDIT** — mounts `<PlateCalculator weightKg={set.weight} />` under the weight Stepper (2-line change: import + mount). |
| `src/pages/History.jsx` | **EDIT** — ExerciseDetail sheet computes the latest `prTimeline` event for the exercise and renders `<ShareCard event={prEvent} />` below the stats grid (hidden when the exercise has no PR event). |
| `src/components/ui/ShareCard.jsx` | **NEW** — `buildPrCardModel(event, unit, displayWeight)` pure model builder + `drawPrCard(ctx, card)` canvas painter + default Share button component. |
| `src/test/plate-calculator.test.jsx` | **NEW** — 12 tests (see below). |
| `src/test/share-card.test.jsx` | **NEW** — 7 tests (see below). |

## Decisions

- **Plate math (kg stored, unit-aware display):** input is always stored KG (house rule). For kg: 20kg bar, plates `[25,20,15,10,5,2.5,1.25]`. For lbs: 45lb bar, plates `[45,35,25,10,5,2.5]`, bar/plates converted to kg internally; `perSide` returns display-unit values so the chip reads `2×20 + 1×5 /side` in the user's unit. Greedy largest-first per side, with a 0.05kg epsilon for float/rounding noise (lbs↔kg round-trips).
- **Feasibility (honest data rule):** `feasible=false` when weight ≤ bar or the load can't be exactly made with standard plates (e.g. 21kg in kg mode → 0.5kg/side unmakeable). `leftoverKg` reports the per-side unmakeable remainder; `perSide` is emptied when infeasible so the chip hides. Cross-unit artifacts are honest: a kg-native weight like 100kg in lbs mode reports infeasible + leftover rather than faking a match; native-increment loads (220lb etc.) resolve exactly.
- **Chip styling:** matches SetRow idioms — `text-[10px] font-bold uppercase tracking-widest`, zinc/ink palette (`text-ink-500`, `border-white/[0.07]`, `bg-white/[0.02]`), rounded-md. Renders `null` when infeasible.
- **ShareCard model:** picks the headline PR with priority `weight` → `e1rm` → first; label/value/unit via `useUnit` (`displayWeight`), long-form date, wordmark "Liftit" with accent square. 1080×1920, bg `#0b0b0c`, accent `#8b5cf6`, Space Grotesk font stack, radial purple glow, thin accent frame.
- **Canvas guards (jsdom-safe):** `getContext` existence + null-result checked, `toBlob` wrapped (resolves `null`), share path guarded by `navigator.canShare?.({files})`, everything inside try/catch → console.warn fallback, never a crash. Button renders only when a PR exists; component returns `null` otherwise.
- **No new dependencies**; no engine/schema changes; did not touch Workout.jsx, Progress.jsx, Home.jsx, engine files, schema.js, db.js, Settings.jsx, or `src/data/importers/**`.

## Test results

`npx vitest run src/test/plate-calculator.test.jsx src/test/share-card.test.jsx` → **20 passed / 0 failed**
- plate-calculator (12): clean kg split (100→[25,15]), non-clean (102.5→[25,15,1.25]), plate repetition, bar/below-bar/NaN infeasibility, sub-smallest-plate infeasibility with leftover, lbs bar+greedy combos (220lb native), honest kg-in-lbs leftover, unknown-unit fallback, formatPlates grouping.
- share-card (7): PR priority/model shape, e1rm/reps fallbacks, unit conversion, null for PR-less events (no fabricated numbers), share button renders, hides on no PRs, click degrades to console-safe no-op under jsdom (canvas unavailable).

`npx eslint` on all six files → **0 errors, 0 warnings**.

Regression sanity: `src/test/smoke.test.jsx` (exercises History + Workout/SetRow mounting) still **6/6 green** after my edits. Full `npm run check` intentionally **not** run per orchestrator instruction (concurrent agents own other files).

## Notes for orchestrator / next wave

- `computePlates` is exported pure from `PlateCalculator.jsx`, so the Workout.jsx engine-suggestion wiring (briefing item 4, deferred here due to file ownership) can import it without new plumbing.
- `buildPrCardModel`/`drawPrCard` are exported pure from `ShareCard.jsx`; a PR-row-level share entry (Progress.jsx Recent PRs) can reuse them as-is.
- Importer specs at `.agents/v2/explorer-formats/specs/` were absent at time of writing — consistent with deferring CSV work to the owning agent.

---

# Wave 2 — CSV importers (Strong / Hevy / FitNotes)

**Date:** 2026-08-27
**Scope:** Phase A §4.A migration wedge — importer core, three format adapters, `db.importers` preview/commit, Settings import UI, tests. Wave 1 (PlateCalculator, ShareCard, SetRow/History edits) untouched.

## Files touched

| File | Change |
| --- | --- |
| `src/data/importers/core.js` | **NEW** — pure pipeline shared by all adapters: hand-rolled RFC-4180 CSV parser (quoted cells, `""` escapes, embedded newlines, BOM strip, `,` vs `;` delimiter sniff), decimal-comma/thousands numeric rules (`72,5`→72.5, `1,275`→1275, spec §3 exactly), multi-format date parser (`YYYY-MM-DD HH:MM:SS`, `HH:MM`, `T`-form, `22 Dec 2025, 08:00`, `10 Jun 2024, 8:15 PM`, ISO, `YYYY-MM-DD`, `YYYY/MM/DD`; ambiguous `DD/MM` refused, never guessed), Strong duration tokens (`2h 38m`→9480), FitNotes `Time` cells, the exercise-matching ladder (full → de-parenthesized → trailing ` - <machine>` strip → alias table → guarded token match), set renumbering, FNV-1a content hash, session grouping. **Deliberately imports only `exercises.js`** — no `db` import, so preview can never mutate. |
| `src/data/importers/strong.js` | **NEW** — 12-column adapter. Unit resolution precedence: **explicit user pick > `Weight (kg)`/`Weight (lbs)` header variant > auto heuristic** (≥30% of `(Barbell)` sets ≥90 → lbs; surfaced with the exact ratio in the preview). `W`/`D` Set-Order codes → `isWarmup` / report-note-keep-as-normal (never dropped). Session key = (`Date`, `Workout Name`). Duration tokens; blank-RPE → `null`; per-set `Notes` counted in the report, never fabricated into docs (v2 sets have no notes). |
| `src/data/importers/hevy.js` | **NEW** — snake_case 14-column adapter. Unit from the **header name** (`weight_kg`/`weight_lbs`/legacy parenthesized); both columns → prefer kg per row; **no weight column → refuses the file rather than guessing** (the Hevy-imports-Strong-as-kg bug class). `set_index` order-only (renumbered 1..N, never trusted as number), `set_type` lower/title/numeric-1-4 variants, fractional RPE preserved (`8.5`), superset ids captured in report only, duration = `end_time − start_time`. |
| `src/data/importers/fitnotes.js` | **NEW** — Android (per-row `Weight Unit`, mixed-unit legal; unknown/empty token → flagged warning + kg default, never silent) and iOS "FitNotes 2" variant (header-sniffed via `Weight (kg)`/`Kind`; prefer kg when both weight columns filled). Date-only grouping → one canonical workout per date (data limitation, surfaced in warnings). `rpe` always `null` — no fabrication. |
| `src/data/db.js` | **EDIT, additive only** — new `db.importers` namespace (`existingDates()`, `preview(parsed, {collision})`, `commit(parsed, {collision})`) plus `createSet` import and two module helpers. Preview is read-only and returns per-workout `{date, name, setCount, exerciseCount, matchedCount, unmatchedNames, contentHash, dateExists, action}`. Commit resolves unique source names (unmatched → `db.exercises.addCustom`, case-insensitively deduped), builds via `createWorkout`/`createSet` (kg in, `rpe null→0` via `numberOr`, FitNotes/`startedAt:null` synthesized as local 12:00), applies skip (default) / replace per duplicate local date in one mutation. v2/v3 migration, bodyweight repo, sync queue untouched; imports deliberately enqueue **no** sync ops (bulk-history precedent: `importRemote`, v1 migration). |
| `src/pages/Settings.jsx` | **EDIT** — new `ImporterCard` in the Data section: source picker (Strong/Hevy/FitNotes), Strong unit-mode segmented (Detect/Kilos/LB; heuristic ratio shown in preview), duplicate-date policy (Keep mine default / Replace), file input, honest preview (counts, matched vs unmatched names, unit-mode chip, warnings, per-date action rows), commit → result report incl. created custom exercises and zero-import honesty. Labels "Kilos"/"LB" chosen so the e2e suite's `getByRole('radio', {name: /Pounds/i})` stays unique. |
| `src/test/importers.test.js` | **NEW** — 78 tests: golden round-trips inline from the specs' real-export example rows (all three formats incl. Hevy lbs + both-column variants, FitNotes mixed-unit + iOS variant), malformed inputs (wrong headers, empty file, BOM, `;` delimiters, decimal commas, thousands, unparseable/ambiguous dates, unitless Hevy refusal), hostile inputs (1000+ char names, `=HYPERLINK(...)`/`=cmd|' /C calc'!A1` CSV-injection cells stored as inert strings), collision policy (skip never clobbers, replace removes exactly the colliding workout, re-import idempotence, no custom-exercise duplication), and untouched-neighbor guarantees (bodyweight, sync queue, AI key). |

## Key decisions

- **Core is pure.** `core.js` never imports `db.js`; custom-exercise creation lives only in `db.importers.commit` via `db.exercises.addCustom`. Preview is incapable of mutating the document, and there is no import cycle.
- **Strong unit precedence** resolves a genuine spec tension: canonical-shape §3 says "user override always wins", strong.md §5 says header variants "override the heuristic" — implemented as user > header > heuristic > kg-default, with the resolution and its evidence (`3/3 (100%) of (Barbell) sets are ≥ 90`) shown in the preview.
- **Strong set order:** renumber from file order rather than sorting the raw number — `W1/W2` codes share the working-set counter, so a numeric sort could reorder warm-ups past working sets. Normal contiguous exports are unaffected (identity).
- **Honest-data rule everywhere:** unmatched names → custom exercises + listed in preview; drop/failure sets kept as normal sets with report notes; cardio/timed rows kept at weight 0; unparseable numbers → 0-with-row-counted, never a fabricated figure; every skip/replace is enumerated per date before commit.
- **No new dependencies** (hand-rolled CSV parser); no package.json edits; did not touch Progress.jsx, App.jsx, main.jsx, Workout.jsx, or engine files.

## Verification

- `npx vitest run src/test/importers.test.js src/test/db.test.js` → **89 passed / 0 failed** (78 new + 11 existing db).
- `npx vitest run` (full suite) → **349 passed / 0 failed** (271 pre-existing + 78 new; none weakened).
- `npx eslint src/data/importers src/pages/Settings.jsx src/data/db.js` → **0 errors, 0 warnings**.
- `npm run check` (lint + test + build) → **green**.

---

# Wave 3 — Apple Watch companion (logging-only)

**Date:** 2026-08-30
**Scope:** Phase §4 watch companion (STRATEGY.md: "Native watch target reusing the sync API; logging-only first"). Phone-side bridge + watchOS SwiftUI sources + setup docs, on `@capgo/capacitor-watch@8.1.3`. No history/programs on the watch. No commits, no package.json changes.

## Files touched

| File | Change |
| --- | --- |
| `src/lib/watchBridge.js` | **NEW** — phone-side bridge. Dynamic-imports the plugin (`mod.CapgoWatch ?? mod.Watch` — verified v8.1.3 exports only `CapgoWatch`), so it loads/tests without Capacitor; every plugin call try/catch-guarded. `initWatchBridge()` idempotent (single init promise, listeners wired once), degrades permanently on web (`getInfo().isSupported === false` → listeners never wired). `pushWatchContext(snapshot)` via `updateApplicationContext` (state push, NOT sendMessage); `null` → `{v:1, kind:'none'}` clear marker (WCSession can't serialize null). Exports `compactSessionSnapshot(session)` (single source of truth for the wire shape) and `handleWatchMessage(msg)` (returns the reply object; never throws). `log_set` applies through `updateSession()` from `useActiveSession`, then awaits a fresh context re-push so the watch refreshes even when the phone is on another route. |
| `src/App.jsx` | **EDIT (2 lines)** — import + one `initWatchBridge()` call in `NativeShell`'s existing `useEffect` (idempotent, no-op on web). |
| `src/pages/Workout.jsx` | **EDIT (1 effect + 2 imports)** — in `ActiveSession`, effect on `[session]` pushes `compactSessionSnapshot(session)`; cleanup pushes `null` when `getActiveSession()` is gone (finish/discard) so the watch can't log into an ended session. |
| `ios/Watch/LiftitWatch/LiftitWatchApp.swift` | **NEW** — `@main` SwiftUI app + theme extensions (`#0b0b0c` bg, `#8b5cf6` accent, Space Grotesk with `UIFont` presence check falling back to system rounded). |
| `ios/Watch/LiftitWatch/WatchSessionModel.swift` | **NEW** — `ObservableObject` + `WatchConnectorDelegate` per the CapgoWatchSDK README pattern (uses `WatchConnector.shared` — the SDK exists at `node_modules/@capgo/capacitor-watch/watch-sdk/`, verified). Parses context into `WatchExercise`/`WatchSet`, optimistic done-marking, `completeSet`/`requestState`/`ping` sends with error handlers, re-syncs `receivedApplicationContext` on activation. |
| `ios/Watch/LiftitWatch/ContentView.swift` | **NEW** — logging UI: connection badge, exercise picker, tappable set list, weight (2.5 kg steps) / reps steppers, purple Complete button (disabled when offline), honest "Phone didn't accept that set" error + auto re-sync on rejected log. watchOS 9 API level only. |
| `ios/Watch/LiftitWatch/SetRowView.swift` | **NEW** — set row: number chip, `62.5kg × 8`, target-reps hint, done checkmark, selection highlight. |
| `ios/App/App/AppDelegate.swift` | **EDIT (minimal)** — `import WatchConnectivity` + early `WCSession.default.activate()` guarded by `isSupported()`. **Deliberately does NOT set the delegate**: the plugin README's `CapWatchSessionDelegate.shared` does not exist in the installed 8.1.3 source — the plugin's `load()` installs its own internal `WatchSessionDelegate` and activates; assigning a delegate in AppDelegate would overwrite it and silently drop all watch messages. Comment in-file documents this. |
| `ios/WATCH_SETUP.md` | **NEW** — numbered Xcode steps: watchOS App target `LiftitWatch` at `com.liftit.app.watchkitapp` (main id verified from pbxproj), capabilities (Background Modes: fetch+remote notifications, Push) on both targets, CapgoWatchSDK SPM (GitHub URL preferred, local `watch-sdk/` path as offline alternative, watch target only — main app already gets the plugin via CapApp-SPM), source drop-in, signing, real-device requirement, degradation table, troubleshooting. |
| `src/test/watch-bridge.test.js` | **NEW** — 9 tests via `vi.mock('@capgo/capacitor-watch')` fake that captures listeners/contexts/replies: init idempotency (listeners exactly once), `log_set` happy path into a seeded session (through the real `useActiveSession` store + localStorage), setIndex/negative-value clamping, malformed messages → `{ok:false}` without throw (6 garbage shapes + unknown exercise), `request_state` reply shape (null and full snapshot), ping, `pushWatchContext` payload (compact key sets asserted exactly, 62.5 kg preserved), `kind:'none'` clear, and post-`log_set` context re-push. |

## Protocol (v1, documented in watchBridge.js header)

- Phone→watch context: `{ v:1, kind:'session', sessionId, name, exercises:[{ key, name, targetRepsMin, targetRepsMax, sets:[{ i, w, r, done }] }] }` — i 0-based, w in kg; `{ v:1, kind:'none' }` clears.
- Watch→phone: `{ action:'log_set', exerciseKey, setIndex, weight, reps, rpe? }` | `{ action:'request_state' }` | `{ action:'ping' }`.
- Replies: `{ ok:true, applied:true }` / `{ ok:true, session:<snapshot|null> }` / `{ ok:true, pong:true }` / `{ ok:false, error? }`.
- Transport: state via `updateApplicationContext` (latest-value-wins, works when watch unreachable); replies via `replyToMessage` on `messageReceivedWithReply`.

## Decisions

- **Delegate verification over docs:** README's AppDelegate snippet references a nonexistent symbol; adapted to activate-only and documented (see AppDelegate row). This is the load-bearing correctness decision — replacing the plugin's delegate would break message routing silently.
- **Strict-but-clamped validation:** `setIndex` clamped into range per spec; weight/reps must be finite numbers (present-but-garbage → `{ok:false}` rather than coerced — honest data rule: no fabricated log entries); negatives clamp to 0; rpe clamped 0–10 only when provided.
- **Bridge re-pushes after `log_set`** (beyond spec): keeps the watch authoritative-state honest when the phone isn't on the Workout route; the Workout-page effect still pushes on render, and latest-value-wins makes both paths converge.
- **Watch side uses CapgoWatchSDK** (not a hand-rolled `WCSessionDelegate`) since the SDK ships in the installed package; protocol parsing kept in one model class.
- **No engine/schema/db changes, no new dependencies, did not touch** recovery.js, android/**, mcp/**, or any other agent's files.

## What stays manual (Xcode — cannot be CLI-automated)

Registering the `LiftitWatch` watchOS App target, capability toggles, adding the CapgoWatchSDK product to the watch target, dragging in the four Swift sources, and signing. All steps numbered in `ios/WATCH_SETUP.md`; until done, the bridge degrades silently (no watch app → pushes queue/no-op, no phone-side errors).

## Verification

- `npx vitest run src/test/watch-bridge.test.js src/test/smoke.test.jsx` → **15 passed / 0 failed** (9 new + 6 smoke).
- `npx eslint` on the four JS/JSX files → **0 errors, 0 warnings**.
- `npm run check` (lint --max-warnings 0 + full test suite + build) → **exit 0**.
- Full suite at time of handoff: **19 files, 404/404 passed** (includes other agents' concurrent work).
