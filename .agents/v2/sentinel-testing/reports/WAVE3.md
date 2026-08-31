# Gate Report — Wave 3 (sentinel-testing)

Date: 2026-08-30 · Model: GLM (sentinel) · Scope: Wave 3 only (HealthKit wiring, Watch companion, Phase D MCP). Phases A+B+C already gated in `ABC.md`.

## 1. Baselines & counts

| Point | Tests / Files | Source |
|---|---|---|
| Pre-Wave-3 (ABC gate, 2026-08-27) | 356 / 17 | `ABC.md` |
| Wave-3 handoff (tree claim) | **404 / 19** | verified verbatim via `npm run check` at gate start |
| Final (after sentinel gap-closers) | **408 / 19** | verified via full `npm run check` |

## 2. Full check

`npm run check` (eslint `--report-unused-disable-directives --max-warnings 0` → `vitest run` → `vite build`): **exit 0**.

- eslint: clean, 0 warnings
- vitest: `Test Files 19 passed (19) · Tests 408 passed (408)`
- vite build: success; PWA generateSW, 21 precache entries (970.61 KiB). Pre-existing warnings only (chunk >500 kB; `INEFFECTIVE_DYNAMIC_IMPORT` for `@capacitor/core` — expected, the Capacitor plugins now statically import it).

## 3. Targeted adversarial runs

`npx vitest run src/test/recovery.test.js src/test/watch-bridge.test.js src/test/mcp-server.test.js`

**Before gap-closers: 65/65 · after: 69/69.** Confirmed the suites genuinely exercise failure paths, not just happy paths:

- `recovery.test.js` (33 tests): mock official plugin via hoisted Proxy state (`hf.state.native`/`impl`) — permission rejection → no query at all (`getData` not called), per-variable degradation (HRV variable throws → SLEEP/RHR survive; RHR throws → no heart-rate proxying), unimplemented plugin object, web/jsdom never touches the plugin, junk `results` JSON (`'not json at all {{{'`) → `[]` not a throw, PascalCase/`dataValues`-array/epoch-second/wrapper row shapes, absurd sleep magnitudes → missing, zero-value bucket → missing, native date format regex (`yyyy-MM-dd'T'HH:mm:ssZ`, no fractional seconds).
- `watch-bridge.test.js` (13 tests): malformed watch messages (`'not-an-object'`, `null`, `{}`, unknown action, missing weight/reps/setIndex, `'heavy'` as weight, unknown exerciseKey) all reply `{ ok: false }` and never throw; setIndex/negative clamping; `request_state` idle + active; `kind:none` clear marker; context re-push after `log_set`.
- `mcp-server.test.js` (23 tests): v1-doc rejection with version in the error, invalid JSON, unreadable path, workouts with unparseable dates dropped at load, unknown tool → `Unknown tool: nope`, missing/empty `exerciseId` → error, honest empties for unknown lifts / empty docs, all five progression verdicts (holding/progressing/plateaued/regressing/insufficient_data).

## 4. Gap-closers added (test-only, `GATE PASS` requirement 3)

1. **`src/test/watch-bridge.test.js` — duplicate `log_set` (watch retry) is an overwrite, never a double count.** Same message dispatched twice → set count unchanged (3), no duplicate entries. WCSession redelivery can't inflate training volume.
2. **`src/test/watch-bridge.test.js` — second `log_set` for the same set = last-write-wins** with `rpe: 99` clamped to 10.
3. **`src/test/watch-bridge.test.js` — `pushWatchContext` returns `false` when the plugin rejects** (fake `updateApplicationContext.mockRejectedValueOnce`) and recovers on the next push.
4. **`src/test/mcp-server.test.js` — doc re-read after file change.** Writes a tmp export (1 workout), overwrites the same path with 2 workouts, asserts `loadDoc` reflects the change — this is the `server.js` per-call `getDoc()` freshness contract (a re-export is picked up without restarting the MCP server).

No product code was touched by the sentinel.

## 5. Regression sweep

- **`git diff --numstat` on test files:** `db.test.js` 38/0, `sync.test.jsx` 22/0, `engine.test.js` 90/1 — the single deletion is the ABC-era import-line extension (`getDeloadRecommendation, analyzeDoubleProgression`). **No assertion modified, removed, or weakened anywhere.** (`e2e/e2e.test.jsx` unchanged.)
- **`recovery.test.js` was heavily rewritten** (file is untracked, so no git diff): old coverage per `ABC.md` — 0/2/3-sample floors, NaN/null/junk metrics, permission-denied → clean no-op, unexpected plugin shapes → `[]`, extreme-value clamping — **all survived** in the new file (describes: sample-count edges, garbage handling, providers, clamping test). The ABC clock-skew suite (`sentinel-abc.test.js`) still targets the rewritten module and passes. Superseded deliberately: the legacy global-plugin tests remain as a fallback tier, and the new official-plugin tiers (`@capacitor/health-fitness` happy path, per-variable degradation, availability gating, defensive row normalization, sleep unit normalization) are purely additive. Note: ABC finding #1 (order-dependent trends, `recovery.js:68-69`) is **resolved** — `computeReadiness` now sorts by date before trending (`recovery.js:87-91`).
- Wave-3 tracked product diffs are scoped and expected: `AppDelegate.swift` (+11, early `WCSession.activate()`), `Info.plist` (+4, health privacy keys), `package.json` (+3 deps), `App.jsx` (init + provider restructure), `Workout.jsx` (context push, clear-on-discard).

## 6. Platform artifacts (not executable here — plausibility + presence only)

- `ios/Watch/LiftitWatch/{LiftitWatchApp,ContentView,SetRowView,WatchSessionModel}.swift` — plausible standalone SwiftUI/watchOS sources; `WatchSessionModel` mirrors protocol v1 (`log_set`/`request_state`/`ping`), handles NSNumber→Double fallback for set weights, and on `ok:false` re-syncs via `requestState()`.
- `ios/App/App/AppDelegate.swift` — early `WCSession.default.activate()` guarded by `isSupported()`, comment correctly explains it must NOT own the delegate (plugin owns it).
- `ios/WATCH_SETUP.md` — exists, 22 numbered steps across 8 sections incl. a "How the bridge degrades" + troubleshooting section.
- `ios/App/App/Info.plist` — `NSHealthShareUsageDescription` + `NSHealthUpdateUsageDescription` ("read-only"). `android/healthfitness.config.json` — privacy policy URL present.
- `mcp/{server,tools}.js`, `README.md`, `CHANGELOG.md` — server is a thin stdio entry; `stdout` reserved for MCP framing (errors to `stderr`); `tools.js` has zero `src/*` imports and documents the mirrored-engine keep-in-sync list.

## 7. Findings for reviewer-integrity (non-blocking)

1. **`src/lib/watchBridge.js:122` — out-of-range `setIndex` clamps to the last set** rather than being rejected. A watch holding a stale snapshot could mark the wrong (last) set complete on the phone. The behavior is deliberate and now test-enshrined ("setIndex 99 → last set"); reviewer should confirm clamp-vs-reject is the desired trade-off.
2. **`src/data/recovery.js:362-363` — sleep unit sniffing boundary:** a genuinely >24 h value expressed in *hours* (25–1800) is reinterpreted as minutes. Implausible for real sleep, and values that still don't fit a day become honest `null`s, but the magnitude heuristic is a guess by design — worth a reviewer glance.
3. **`mcp/tools.js` mirrors engine math locally** (e1RM blend, working-set filter, streak, program week, plateau thresholds). Drift risk is documented in `mcp/CHANGELOG.md`; no automated cross-check exists between `tools.js` and `src/engine/*`.
4. `@capgo/capacitor-watch` fake registers listeners once per file (module-level singleton); if a future test file imports the bridge, listener-count assertions there remain valid only because `initWatchBridge` is idempotent — fine today.

## Verdict

**GATE PASS** — full check green at 408/19 (from 356/17 pre-wave; 404/19 at handoff, verified), adversarial failure paths confirmed and extended with 4 test-only gap-closers, zero regressions, no weakened assertions, no product-code bugs blocking the gate.
