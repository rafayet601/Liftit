# Review — Wave 3 (uncommitted working tree; Phase ABC previously APPROVED)

**Reviewer:** reviewer-integrity · **Date:** 2026-08-30 · **Scope:** Wave 3 only — recovery rewrite (`@capacitor/health-fitness`), Apple Watch bridge (`@capgo/capacitor-watch`), local MCP server (`@modelcontextprotocol/sdk`), dependency changes. All files read in full; plugin/native claims verified against `node_modules` sources.

## VERDICT: APPROVED

`npm run test` → **19 files, 408 tests, 0 failures** (reviewer-run); `npx eslint` over all wave-3 files → clean. All five veto-level checks pass. Four non-blocking acknowledgments below (3 of them should be actioned before a release build); none is a veto.

---

## 1. Honest data rule — PASS

- **HEART_RATE is never used as a resting-HR substitute.** `OFFICIAL_VARIABLES` contains only `HEART_RATE_VARIABILITY`/`SLEEP`/`RESTING_HEART_RATE` (`src/data/recovery.js:133-137`); `HEART_RATE` appears only in the permission list and is never queried (see §2 note). Explicit no-proxy comment at `recovery.js:130-131`; regression test "keeps HRV when the RHR variable fails (no heart-rate proxy)" asserts `restingHr: null` when RHR is unavailable (`src/test/recovery.test.js:401-419`).
- **0-valued buckets are missing, not zero.** HRV/RHR require `> 0` (`positiveOrMissing`, `recovery.js:41`, applied `416,418`); sleep `raw <= 0 → null` (`recovery.js:359`); tests `recovery.test.js:541-544` (zero sleep bucket → sample dropped).
- **Impossible sleep magnitudes → null, never rescaled.** `sleepRawToHours` normalizes by magnitude but the final gate is `hours > 0 && hours <= 24 ? hours : null` (`recovery.js:372-378`); a `5e9` value is dropped, not rescaled (`recovery.test.js:535-539`). Values whose only plausible unit yields >24 h (e.g. 1700 "minutes" = 28.3 h) also go null — no unit is forced to fit.
- **Row parsing refuses to guess.** Ambiguous multi-number objects → null (`recovery.js:242-243`); `count` deliberately excluded from value keys (`recovery.js:202`); no date key → row dropped (`recovery.js:260`); junk JSON → empty, not throw (`recovery.test.js:499-506`).
- **computeReadiness renormalizes over real metrics only** and reports `insufficient_data` with score 0 below 3 usable samples (`recovery.js:80-82, 101-115`); trend needs ≥2 real values (`recovery.js:50`, test `136-144`).
- **Watch bridge never invents set data.** Phone side: `weight`/`reps` must be finite numbers from the message or the log is rejected, not coerced (`src/lib/watchBridge.js:104-109`); unknown exercise key → honest `exercise_not_found` (`watchBridge.js:130`); duplicate `log_set` is an overwrite, never a double count (`src/test/watch-bridge.test.js:229-240`). Watch side: optimistic done-marking is corrected by the phone's authoritative snapshot on any rejection (`ios/Watch/LiftitWatch/WatchSessionModel.swift:120-141`); steppers clamp ≥0 (`WatchSessionModel.swift:174-188`).
- **MCP derives everything from the doc.** Unknown exercises → `[]`; single-session → `insufficient_data` with null percents; empty doc → nulls/zeros (`mcp/tools.js:347-359`, tests `src/test/mcp-server.test.js:271-282, 431-450`). Names resolve only from `customExercises`, else title-cased slugs — "no names are ever invented" is tested (`mcp-server.test.js:476-481`). Broken-date workouts dropped at load, not fabricated around (`tools.js:158-160`, test `220-225`).

## 2. Security — PASS

- **Recovery: nothing leaves the device, READ-only.** No network code anywhere in `recovery.js` (grep clean; only Capacitor plugin IPC). Permission request is READ for exactly 4 variables with all group descriptors `IsActive:false` (`recovery.js:139-188`); permission failure → zero queries (`recovery.test.js:423-431`). Web/no-native → permanent clean no-op (`recovery.test.js:432-443`).
- **Watch bridge: malformed input cannot corrupt the doc.** Clamps verified: `clampIndex` (`watchBridge.js:81-83`) applied to setIndex (`122`); `clampNonNegative` (`86-90`) applied to weight/reps/rpe (`106-115`), rpe additionally ≤10 (`115`); non-object messages rejected (`151-154`); handler never throws (`166-170`). The handler can only mutate fields of an existing set in the active session (`119-128`) — it cannot create sets, touch `settings`, or repoint AI config. No eval/dynamic code (grep clean). Reply path failure is caught (`213-216`).
- **MCP: read-only, offline, stderr-only.** Sole I/O is `readFileSync` (`mcp/tools.js:142`); no write/fs/network/child_process anywhere (grep clean). Transport is stdio only; all logging via `console.error` (`mcp/server.js:19,40,56,60`) — **no `console.log` in the codebase, so stdout carries only MCP framing** (matches README claim, `mcp/README.md:69`). Doc path is argv/env file-only — a URL would fail as ENOENT; remote sources intentionally unsupported (`mcp/CHANGELOG.md:41`). `loadDoc` **excludes `settings` entirely** (allowlist `tools.js:183-189`), so even if an export contains AI config it is never parsed or returned. Unknown tool → `isError` (`server.js:39-45`).
- **Dependencies: exactly the 3 declared.** `package.json` diff adds `@capacitor/health-fitness ^1.0.1`, `@capgo/capacitor-watch ^8.1.3`, devDep `@modelcontextprotocol/sdk ^1.30.0` — nothing else. Full lockfile comparison vs HEAD: **0 packages removed, 0 non-registry URLs, 1 version change** (`side-channel` 1.1.0→1.1.1, transitive patch bump from the npm registry), 72 new packages all tracing to the three deps (express/jose/eventsource/zod-to-json-schema/`@hono/node-server`/pkce-challenge → MCP SDK; `bplist-*`/`@babel/preset-typescript`/wrappy → capgo-watch; `@xmldom/xmldom` → health-fitness). All three are legitimate first-party packages (Ionic team, Capgo, Anthropic).
- **AndroidManifest permission inflation is plugin-generated, not hand-written.** The READ+WRITE health permissions and background/foreground-service/exact-alarm entries are injected by the health-fitness install hook (`node_modules/@capacitor/health-fitness/hooks/capacitorCopyHealthFitnessConfigs.js`, `addBackgroundJobPermissionsToManifest` ~line 428ff). Actual data access is runtime-gated by Health Connect consent, and the JS layer requests READ only for its 4 variables and never calls `writeData`. See acknowledgment #3.

## 3. Local-first — PASS

Nothing in wave 3 requires the backend. Recovery is device-local plugin IPC; the watch bridge is phone↔watch over WCSession with no backend involvement; MCP is a local stdio server over a local file. Web degradation verified end-to-end: the plugin's web stub returns `isSupported:false` (`dist/esm/web.js:17`), the bridge keeps listeners off (`watchBridge.js:239-242`), and `pushWatchContext` is a guarded no-op (`watchBridge.js:183`, false + caught rejection test `253-263`). No wave-3 code touches the sync queue. `initWatchBridge` is idempotent and no-op-safe on web (`src/App.jsx:249`).

## 4. Migration safety — PASS

- No schema bump in this wave: `SCHEMA_VERSION` remains 3 (`src/data/schema.js:9`; the 2→3 change was the already-approved ABC wave).
- `settings.recovery` shape unchanged: `{ enabled: Boolean(...) }` (`schema.js:121`); no wave-3 code writes it. `RecoveryContext`'s contract with the rewritten module is intact (`fetchRecent(30)` → `computeReadiness(samples)`, `src/contexts/RecoveryContext.jsx:50-51`) and the full suite (including all ABC-era tests) passes.

## 5. iOS native edits — PASS (worker's claim verified honest)

- **AppDelegate claim confirmed against the installed v8.1.3 sources.** The plugin's real delegate class is `WatchSessionDelegate` (`node_modules/@capgo/capacitor-watch/ios/Sources/CapgoWatchPlugin/CapgoWatchPlugin.swift:198`), which the plugin itself installs and activates in `load()` (`:31-33`). The README's `CapWatchSessionDelegate.shared` (`README.md:125`) **does not exist anywhere in the v8.1.3 sources** — the worker's report is accurate. The AppDelegate diff only adds `import WatchConnectivity` + a guarded early `WCSession.default.activate()` and deliberately never assigns the delegate (`ios/App/App/AppDelegate.swift:11-19`), which would have clobbered the plugin's delegate and silently dropped watch messages. Comment and `ios/WATCH_SETUP.md:15-19` both state this correctly.
- **Info.plist: exactly 2 keys, both claim-free and true.** `NSHealthShareUsageDescription` accurately describes read-only sleep/HRV/RHR on-device use; `NSHealthUpdateUsageDescription` says "Liftit does not write health data" — true, the app never calls the plugin's `writeData`.
- Watch SDK symbols used by the watch app all exist in `watch-sdk/Sources/CapgoWatchSDK/WatchConnector.swift` (`WatchConnectorDelegate` :6, `WatchConnector` :41, `activate()` :72, `phoneIsReachable` :150).

## Required acknowledgments / follow-ups (non-blocking, none a veto)

1. **`RESTING_HEART_RATE` is not documented anywhere in the plugin package** (grep across `node_modules/@capacitor/health-fitness` → zero hits; README's variable groups list `HEART_RATE`, not RHR; the authoritative enum lives in the binary `IONHealthFitnessLib`). If the name is unrecognized on a platform, `queryDailySafe` degrades honestly (warn once + `restingHr: null`, `recovery.js:335-348`) — no fabrication — but the 0.2-weight RHR component would silently never populate. **Orchestrator must acknowledge; verify on a real device (iOS + Android) that RHR resolves before release**, and fix the variable name if not.
2. **`HEART_RATE` is requested READ but never queried** (`recovery.js:144`). One extra consent toggle with no consumer — over-broad consent unless the native lib internally derives resting HR from heart-rate samples (unverifiable in-repo, the lib is binary). If #1's device check shows RHR works without it, drop `HEART_RATE` from `PERMISSION_VARIABLES` (least privilege).
3. **Android manifest over-declaration**: WRITE_* health permissions + background/foreground-service/exact-alarm permissions are the plugin hook's defaults (`capacitorCopyHealthFitnessConfigs.js:428-448`), runtime-gated by Health Connect consent and unused by Liftit (background jobs / `writeData` never called). Consider the plugin's documented opt-outs (`disableBackgroundJobs`, `disableReadHealthDataHistory`) at the next `npx cap sync` to shrink the declared surface.
4. **`android/healthfitness.config.json` is not yet reflected in the build**: `android/app/src/main/res/values/strings.xml` has an empty `privacy_policy_url` resource, and the hook only injects the URL from the config during sync (fill-when-empty, hook lines ~371-398) — the strings.xml appears to predate the config file. Run `npx cap sync android` before the next release build, or the Health Connect consent dialog ships without the privacy-policy link (a Health Connect approval requirement).

## Minor notes

- `mcp/CHANGELOG.md:12` says "25 tests"; the file contains 26. Cosmetic drift.
- Pre-existing lint nit from ABC still present: `src/pages/Workout.jsx:16` two imports on one line. Lint passes.
- `mcp/CHANGELOG.md:5` ("package.json untouched") was true when the MCP worker finished; the orchestrator then performed the disclosed dependency installs, which is exactly what the lockfile diff shows. Consistent, no conflict.
- `ios/App/CapApp-SPM/Package.swift` adds the two plugin products and aligns `capacitor-swift-pm` 8.4.1→8.5.0 with the existing `@capacitor/ios` 8.5.0 — consistent, no unexpected sources.

## Test evidence

- `npm run test` → 19 files, **408 tests, 0 failures** (reviewer-run; up from 356 at ABC — wave 3 adds 52).
- `npx eslint` over `mcp/`, `src/data/recovery.js`, `src/lib/watchBridge.js`, all three new test files, `src/App.jsx`, `src/pages/Workout.jsx` → clean.
- Grep sweeps: no `eval(`/`new Function`/`innerHTML`/`document.write`; no network primitives in any wave-3 module; no suspicious constants (plateau 0.98, 12-rep cap, streak window 365 all mirror the real engine — verified side-by-side against `src/engine/e1rm.js`, `src/engine/analytics.js:128-140`).
