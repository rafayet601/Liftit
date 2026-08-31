# Changes — worker-ecosystem — 2026-08-27

Phase C scope (STRATEGY.md §4.C): schema v3 + bodyweight, recovery readiness, share links.
Status: **complete, tests + lint green.** Did NOT run full `npm run check` (concurrent agents); did NOT commit; did NOT touch package.json.

## Files

| File | Change |
|---|---|
| `src/data/schema.js` | EDIT — `SCHEMA_VERSION` 2→3; new `createBodyweightEntry()` (`{ id, date ISO, weightKg, source: 'manual'\|'import' }`); `createDocument` gains `bodyweightEntries` (normalized); `createSettings` gains `recovery: { enabled: false }` (additive — v2 docs get the default on normalization) |
| `src/data/db.js` | EDIT — `load()` persists the upgraded doc when stored version ≠ SCHEMA_VERSION (v2→v3 write-back on first load, mirroring the v1→v2 pattern); `db.import` accepts version **2 OR 3**, still rejects 1/4; new `db.bodyweight { list() (newest-first), add({date, weightKg, source}), remove(id) }` — local-only, no sync-queue ops (no server table; D1 untouched); `export()`/`import()` include bodyweight entries automatically via `createDocument` |
| `src/data/recovery.js` | NEW — pure `computeReadiness(samples)` → `{ score 0..100, inputs: { hrvTrendPct, sleepAvgHrs, rhrTrendPct }, status: 'ready'\|'caution'\|'fatigued'\|'insufficient_data' }` (<3 usable samples ⇒ insufficient; null/NaN metrics ⇒ missing; trends = first-half vs second-half mean; only real metrics contribute, weights renormalized). `createRecoveryProvider()` looks up a Capacitor health plugin (`Health`/`HealthPlugin`) at runtime — **no import, no package.json change**; every failure path (no plugin, denied permission, bad shape) degrades to `[]`. `noopProvider` (available:false) is the named **and** default export |
| `src/contexts/RecoveryContext.jsx` | NEW — `{ provider, readiness, enabled, setEnabled, refresh }`; enabled persisted in `db.settings.recovery.enabled` (default **off**); readiness is `null` when disabled/unavailable. Exported as `RecoveryProvider` + `useRecovery` |
| `src/data/shareLinks.js` | NEW — pure utilities: `programToFragment` / `programFromFragment` (JSON → UTF-8 → hand-rolled base64url, no deps), `buildShareUrl`, `programFromSearchParams`, `ShareLinkError`. Decode path: empty/non-string/charset/size (>100 KB, mirrors `LIMITS.programPayload`) rejection → `JSON.parse` in try/catch → `createProgram` normalization + hard clamps (≤14 days, ≤20 ex/day, name ≤200, text ≤2000, enums whitelisted, number ranges clamped); imported programs get a **fresh id** and `isActive: false` always. Encode path is sanitized too and throws >100 KB |
| `src/pages/Program.jsx` | EDIT — "Share" button on the active program (copies `?program=<fragment>` URL via clipboard, toast feedback); `?program=` import flow with **preview-before-commit** (name / days-per-week / weeks / goal chips, per-day exercise counts + first-6 exercise lists, Confirm/Cancel), invalid-link error state. Works whether or not an active program exists (import view takes precedence over the wizard). No `main.jsx` change needed — the page reads the param via `useSearchParams` |
| `src/components/progress/BodyweightCard.jsx` | NEW — **self-contained** card (own `useSyncExternalStore` subscription on `db`, cached against the doc reference): latest weight in display unit, 30-day plain-SVG sparkline (no deps), inline add form (date + weight, converted to kg at the edge via `useUnit().toKg`), recent-5 list with delete. **Not wired into Progress.jsx** |
| `src/test/schema-v3.test.js` | NEW — v3 defaults; v2→v3 in-place migration incl. storage write-back; `db.import` accepts v2 + v3, rejects 1/4/garbage; v3 export→import round-trip with bodyweight; bodyweight repository (order, defaults, persistence) |
| `src/test/recovery.test.js` | NEW — 0/2/3-sample edges; null/NaN/partial samples; no fabricated baseline from 1 value; synthetic ready/caution/fatigued series; score clamping; half-split trend math; noopProvider; plugin unavailable / denied-permission / bad-shape clean no-ops; row cleaning |
| `src/test/share-links.test.js` | NEW — round trip (faithful + sparse-defaults); URL-safe charset; URL/search-param integration; rejections (empty, >100 KB, bad charset, non-JSON, non-object); clamps (strings, enums, 14 days renumbered 1..n, 20 ex/day, numeric ranges); import never arrives active; encode-side ceiling |

## Decisions
- **Migration strategy**: normalization-through-`createDocument` (the established pattern) — v2 docs are upgraded lazily on load and the upgraded doc is persisted immediately; `db.import` accepts 2 or 3 so old backups stay importable forever. Storage key stays `liftit_data_v2` (key name ≠ schema version, left alone to avoid a pointless migration of the migration).
- **Bodyweight is local-only** (like customExercises): no `enqueue()` calls, no D1 changes, no server contract — the syncQueue would echo entries to a server that has no table.
- **Readiness math**: HRV 0.4 / sleep 0.4 / RHR 0.2 weights, renormalized over available metrics; score 0 = worst, status cut-offs 70/45. No medical copy anywhere — "readiness" only.
- **Health plugin surface** is defined but *defensive*: `requestPermissions()` + `queryDaily({startDate, endDate}) → { days: [...] }`. Adapt the mapping in `createRecoveryProvider` when the actual Capacitor package is chosen.
- **Encode-side sanitization** for share links: emitted fragments are always within clamps; absurd programs (>100 KB after clamping) throw instead of producing an unsharable link.

## Test results
- `npx vitest run src/test/schema-v3.test.js src/test/recovery.test.js src/test/share-links.test.js src/test/db.test.js` → **4 files, 56 tests, all pass** (incl. the pre-existing `db.test.js` — v1 migration untouched).
- Also verified `sync.test.jsx` + `smoke.test.jsx` (13 tests) still pass.
- `npx eslint` on all owned files, `--max-warnings 0` → clean.

## Orchestrator follow-ups (wire these later)
1. **BodyweightCard mount**: import `src/components/progress/BodyweightCard.jsx` and mount it in `Progress.jsx` (or Home). It needs no props; it must sit inside `DataProvider` + `UnitProvider` (both already wrap the app).
2. **RecoveryProvider**: mount `<RecoveryProvider>` (from `src/contexts/RecoveryContext.jsx`) in `App.jsx`/`main.jsx` after `DataProvider`. Then:
   - Pass `readiness` into `src/engine/fatigue.js` as an *option* that only modulates Phase B thresholds (deterministic engine stays the decision-maker). Recovery files never import engine — the wiring is yours.
   - UI toggle lives at `settings.recovery.enabled` via `useRecovery().setEnabled` (Settings.jsx surface is yours).
3. **HealthKit/Health Connect plugin**: install the Capacitor health package (I did not touch package.json). `createRecoveryProvider()` auto-detects `Capacitor.Plugins.Health`/`HealthPlugin`; adjust `fetchRecent`'s `queryDaily` mapping to the real plugin API. Until then it's a clean no-op.
4. **Share-link entry point**: handled entirely inside `Program.jsx` (`?program=` via `useSearchParams`) — **no main.jsx change was needed**. Deep links land on `/program?program=…`; if you want a landing route elsewhere, reuse `programFromSearchParams` from `src/data/shareLinks.js`.
5. Optional Phase D hook: `src/data/importers/program.js` (community templates) can build on `programFromFragment`'s sanitize path.

---

# Changes — worker-ecosystem — 2026-08-30

## Recovery provider wired to the REAL official plugin `@capacitor/health-fitness` (v1.0.1)

Status: **complete — `npx vitest run src/test/recovery.test.js src/test/schema-v3.test.js` green (43/43), full `npm run check` green (lint + 404/404 tests + build), eslint clean on touched files.** No commits; package.json untouched; no other agent files touched.

### Files touched
| File | Change |
|---|---|
| `src/data/recovery.js` | EDIT — `createRecoveryProvider()` now prefers the official `@capacitor/health-fitness` plugin on native platforms: gates on `Capacitor.isNativePlatform()` (from `@capacitor/core`) + static `import { HealthFitness }`, and try/catches every path. Requests `requestHealthPermissions` FIRST (READ-only, `customPermissions` = HEART_RATE_VARIABILITY / SLEEP / RESTING_HEART_RATE / HEART_RATE; all group descriptors passed inactive), then runs one `getData` advanced query per variable (`TimeUnit: 'DAY'`, `TimeUnitLength: 1`, `AdvancedQueryReturnType: 'ALL_DATA'`, `AdvancedQueryResultType: 'RAW_DATA'`, dates via `toISOString().split('.')[0] + 'Z'` — no fractional seconds, the native parser rejects them). **Legacy global `Capacitor.Plugins.Health`/`HealthPlugin` (`requestPermissions`/`queryDaily`) surface kept as a fallback** — this is what keeps the pre-existing provider tests passing verbatim. Public contract unchanged: `available()`, `fetchRecent(days=30)` (chronological), `computeReadiness` pure, `noopProvider` default. |
| `src/test/recovery.test.js` | EDIT — all existing tests kept passing (legacy global-plugin tests now exercise the fallback path); added ~15 cases against a mocked `@capacitor/health-fitness` + mocked `@capacitor/core` (`vi.mock` + `vi.hoisted` Proxy so the impl can be swapped per test and the "unimplemented on web" case is representable). |
| `android/healthfitness.config.json` | NEW — `{ "privacyPolicyUrl": "https://liftit-4mq.pages.dev/privacy" }` (fixes the cap-sync warning; Health Connect requires a real https privacy-policy URL or `requestHealthPermissions()` rejects). Note: per the plugin's sync hook, a config without `permissions`/`groupPermissions` keys keeps the default "declare all Health Connect permissions" manifest behavior — no Android permission regression. |
| `ios/App/App/Info.plist` | EDIT — added ONLY `NSHealthShareUsageDescription` + `NSHealthUpdateUsageDescription` (required by HealthKit when linking the framework; copy is honest and claim-free: read-only, on-device). Nothing else in the file touched; `plutil -lint` OK. |

### Mapping decisions (variable → sample field)
- `HEART_RATE_VARIABILITY` → `hrv`, daily bucket `OperationType: 'AVG'` → mean of the day's values if multiple blocks share a date.
- `SLEEP` → `sleepHours`, daily bucket `OperationType: 'SUM'`.
- `RESTING_HEART_RATE` → `restingHr`, daily bucket `OperationType: 'AVG'`. **NO fallback to `HEART_RATE` data** — HEART_RATE is requested for permission parity only and never queried; if RHR is unsupported, `restingHr` stays `null` and `computeReadiness` renormalizes weights over present metrics.
- Row shapes are undocumented ("raw result blocks" vary per platform) so extraction is defensive: case-insensitive key matching (`startDate`/`StartDate`/`date`/`day`/`timestamp`/epoch numbers → ISO day; `value`/`Value`/`dataValues` (array → mean)/`avg`/`sum`/… → number), `results` accepts a bare array or wrapper objects (`results`/`data`/`blocks`/`dataPoints`), junk JSON parses as empty. Keys like `count` are deliberately excluded (sample count ≠ metric). A row with no recognizable date or value is dropped, never guessed.
- Zero-value daily buckets are treated as missing (no wearable reports 0 HRV / 0 RHR / 0.0h sleep for a day — 0 means no data). Sleep unit normalization by magnitude: ≤24 → hours; ≤1800 → minutes (÷60); ≤172800 → seconds (÷3600); else milliseconds (÷3.6e6); anything that still exceeds 24h after conversion → `null` (one-time `console.warn` on the first non-hour conversion). No physiological range filtering beyond >0 on HRV/RHR — the engine clamps.

### Per-variable degradation behavior
- Each variable's `getData` call is wrapped in its own try/catch (warn-once per variable per session). One variable failing (unsupported on a platform, permission gap, bad payload) yields `null` for that metric while the others still populate — samples keep their per-day partial shape.
- `requestHealthPermissions` rejection (user denial / missing privacy policy) aborts before any query → `fetchRecent` resolves `[]` (clean no-op, never a throw).
- Web/PWA/jsdom: `isNativePlatform()` false → `available()` false, plugin methods never called → honest no-op; PWA users keep the null-readiness path. All failures funnel to the same top-level catch → `[]`.

### Notes for orchestrator
- `RecoveryContext.jsx` untouched (its `available()`/`fetchRecent(30)` contract is unchanged and now resolves against the real plugin).
- Static import of `@capacitor/health-fitness` adds the web shim (~1 kB) to the bundle; `registerPlugin`'s web fallback throws `unimplemented` per call, which we never reach on web due to the native gate. Vite's `INEFFECTIVE_DYNAMIC_IMPORT` warning for `@capacitor/core` is pre-existing (haptics/keyboard already static-import it).
- iOS side note (outside my scope): the official plugin docs also want the HealthKit capability + entitlements (`com.apple.developer.healthkit`) and, only for `setBackgroundJob`, `UIBackgroundModes`/`BGTaskSchedulerPermittedIdentifiers` — we don't use background jobs. Flagging so the iOS agent can enable the capability.
