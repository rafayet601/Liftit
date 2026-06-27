# TEST_READY — Liftit E2E Test Suite

**Published**: 2026-06-27T06:20:00Z  
**Test runner**: `npm run test`  
**Environment**: Vitest + React Testing Library (JSDOM)

---

## Summary

| Tier | Description | Count | Status |
|------|-------------|-------|--------|
| Tier 1 | Feature Coverage | 40 | ✅ All pass |
| Tier 2 | Boundary & Corner Cases | 40 | ✅ All pass |
| Tier 3 | Cross-Feature Combinations | 8 | ✅ All pass |
| Tier 4 | Real-World Application Scenarios | 5 | ✅ All pass |
| **Total** | | **93** | **✅ All pass** |

Plus 37 non-E2E tests (db, engine, smoke) pass, totaling **130/130 passing tests**.

---

## Test Results

```
Test Files  4 passed (4)
     Tests  130 passed (130)
```

- `src/test/db.test.js` — ✅ 30 tests
- `src/test/engine.test.js` — ✅ 1 test
- `src/test/smoke.test.jsx` — ✅ 6 tests
- `src/test/e2e/e2e.test.jsx` — ✅ 93 tests

---

## Mocks

The E2E test suite uses the following mocks:
- `recharts` — `ResponsiveContainer` replaced with a `<div>` to avoid JSDOM layout issues
- `../../lib/api` — `get`, `post`, `put`, `del` handlers with controllable mock state
- `../../lib/platform` — native shell, haptic, and standalone detection stubs
- `Element.prototype.scrollIntoView` — polyfill for JSDOM (not implemented in jsdom)
- No shader component mocks needed — all WebGL shader components degrade gracefully via try-catch when `canvas.getContext('webgl')` returns null in JSDOM

---

## Fixes Applied

### 1. Missing AppRoutes export (root cause of all E2E failures)
- `src/App.jsx`: Added `export` to `function AppRoutes()` — tests import `{ AppRoutes }` as a named export

### 2. Test assertion updates for theme migration
- Button text changes: `"Finish"` → `"Finish Workout"`, `"Generate"` → `"Start this program"`
- Component structure: pages wrapped in `<Glass>`, PR timeline uses `pr-timeline-item` class
- Exercise card expanded by default (no toggle click needed)
- History detail format: `"70 kg × 10"` not `"10 reps @ 70 kg"`
- Duration format: `"60 min"` not `"60m"`
- Empty state text: `"No workouts yet"` not `"No workouts logged yet"`
- Coach selector: `getAllByRole('button', { name: /Coach/i })[0]` handles duplicate buttons

### 3. AI Provider config fix
- Tests set `ai: { provider: 'none' }` to route chat through mocked `post('/ai/chat')` instead of unmocked `fetch()` to OpenAI

### 4. ExercisePicker search
- Added `fireEvent.change` on search input to filter exercises when selecting from large lists

### 5. Negative value reset fix
- Changed event sequence to trigger React state change detection in SetRow

---

## Build & Lint

- `npm run lint` — ✅ Clean (0 warnings)
- `npm run build` — ✅ Succeeds
