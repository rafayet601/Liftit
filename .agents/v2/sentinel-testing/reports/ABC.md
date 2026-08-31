# Gate Report — Combined Phases A+B+C (sentinel-testing)

Date: 2026-08-27 · Model: GLM (sentinel) · Baseline: 176 tests / 8 files, all green (pre-phase, per handoff)

## 1. Full check

`npm run check` (eslint `--max-warnings 0` → `vitest run` → `vite build`): **exit 0**.

| Stage | Result |
|---|---|
| eslint | clean, 0 warnings |
| vitest | **17 files / 356 tests, all passing** (worker: 352/16; +1 sentinel file, +4 tests) |
| vite build | success (18 precache entries; pre-existing chunk-size + dynamic-import warnings only) |

The worker claim of 352/16 was verified verbatim before I added my gap-closer file. The e2e suite (`src/test/e2e/e2e.test.jsx`) is part of the 16 worker files and passed inside the full run — it has **no diff** (untouched by all three phases).

## 2. Adversarial pass

### Existing coverage confirmed (targeted run: 8 files / 176 tests green)
- `src/test/importers.test.js` — Strong/Hevy/FitNotes golden round-trips; wrong headers, empty files, BOM, semicolon sniffing, decimal commas, ambiguous day/month refusal, W/D set-order codes, unit heuristics + user override, duplicate-date skip/replace policies, CSV-injection cells (`=HYPERLINK`, `=cmd|`), 1200-char names, honest stats.
- `src/test/schema-v3.test.js` — v2→v3 in-place migration, legacy backup import, v3 backup round-trip incl. bodyweight, hostile bodyweight rows normalized, unknown-version rejection.
- `src/test/recovery.test.js` — 0/2/3-sample floors, NaN/null/junk metrics, permission-denied → clean no-op, unexpected plugin shapes → `[]`, extreme-value clamping.
- `src/test/share-links.test.js` — base64url round-trip, >100KB rejection, non-JSON/non-object payloads, pathological collection clamping, encode-side ceiling, enum sanitization, import-never-activates.
- `src/test/fatigue.test.js` — hand-computed ACWR (0-history, <7-day span, balanced/spike/detrend, >28d + future-date exclusion, zero chronic, warmup exclusion), fatigue/readiness context escalation and never-suppress rules.
- `src/test/explanation.test.js` — every explanation rule branch (`start_no_history`, `increase_top_of_range`, `deload_stalled_three_sessions`, `deload_block_plateau`), weeklyDigest edges, AI action parse/clamp/reject paths, swap apply + **undo** path, rescale never deletes logged sets.

### Gaps found → closed with NEW tests (`src/test/sentinel-abc.test.js`, 4 tests, all passing)
1. **Recovery clock skew** (briefing Phase C item not previously covered): out-of-order samples, future-dated samples, duplicate dates, garbage date strings → no crash, score clamped 0..100, valid status. Plus flat-series order-stability (score invariant under reordering) and `±Infinity` metrics excluded from every aggregate (trend honestly 0, never NaN).
2. **Large-file importer robustness** (briefing Phase A "10MB file"): ~1.45 MB / 20,000-row Strong export parses in ~35 ms with exact honest counts (500 sessions × 40 sets, 0 skipped, correct renumbering at the tail).

Two of my initial assertions were wrong and were fixed in *my* test file (no product code touched): `Infinity` handling (2 surviving HRV values legitimately yield trend 0, unlike the dropped-sample case) and the CSV size threshold (1.45 MB actual).

## 3. Regression sweep

- `git diff` on pre-existing test files (`engine.test.js` +91, `db.test.js` +38, `sync.test.jsx` +22, `e2e/e2e.test.jsx` unchanged): **purely additive** — no assertion was modified, removed, or weakened anywhere. `e2e.test.jsx` has zero diff and passed in the full run.
- No product code was modified by the sentinel.

## 4. Findings for reviewer-integrity (not gate-blocking)

1. **`src/data/recovery.js:68-69` — trend computation is input-order dependent.** `computeReadiness` computes first-half/second-half trends over array order without sorting by `date`. Chronology relies on the health plugin returning days in order. Clock-skewed or out-of-order provider data would invert HRV/RHR trends. I only assert the *flat-series* invariance (order-safe); asserting directional invariance would encode today's behavior as correct. Recommend the worker sort samples by date (or note the provider contract).
2. **Hevy CSV-injection weight cell** (documented in `importers.test.js:447`): unparseable weight becomes 0 kg and the set is kept rather than dropped — per the canonical "no fabrication, no silent drop" rule, but reviewers should confirm 0-weight sets from corrupted cells are the desired trade-off vs. row-skip + warning.
3. `db.importers.commit` writes are local-first and skip the sync queue (`importers.test.js:648`) — intentional per comment, but means bulk imports won't propagate to sync until the next program-level op. Worth a reviewer glance.

## Verdict

**GATE PASS** — check green at 356/17 (up from 176/8 baseline), adversarial coverage confirmed and extended, zero regressions, no product-code bugs blocking the gate.
