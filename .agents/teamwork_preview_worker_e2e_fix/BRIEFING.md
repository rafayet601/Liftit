# BRIEFING — 2026-06-27T06:00:00Z

## Mission
Fix the 90 failing E2E tests by restoring the missing `AppRoutes` named export and ensuring shader components degrade gracefully under JSDOM.

## 🔒 My Identity
- Archetype: teamwork_preview_worker
- Roles: implementer, qa
- Working directory: /Users/rivu/Documents/Documents - Mohammad's MacBook Pro (2)/GitHub/Liftit/.agents/teamwork_preview_worker_e2e_fix
- Milestone: E2E Test Fix

## 🔒 Key Constraints
- CODE_ONLY network mode.
- Keep existing component APIs and structure intact.
- Shader effects must gracefully handle WebGL failures (try-catch + null checks already present).
- Only touch `src/App.jsx` (export fix) and `src/test/e2e/e2e.test.jsx` (mocks if strictly needed).

## Root Cause Analysis
1. `src/App.jsx:215` declares `function AppRoutes()` WITHOUT `export`.
2. `src/test/e2e/e2e.test.jsx:12` imports `import { AppRoutes } from '../../App'`.
3. Named import of a non-exported function → `undefined` → React throws "Element type is invalid".
4. This affects ALL 90 tests that render `<AppRoutes />` inside `<Providers>`.

## Fix Plan
1. Change `function AppRoutes()` → `export function AppRoutes()` in `src/App.jsx`.
2. Run `npm run test` to check if shader components cause secondary JSDOM failures.
3. If shaders fail: add `vi.mock` for shader component paths in `e2e.test.jsx` that render lightweight stubs (canvas with aria-hidden). Prefer mocking at component level, not globally.
4. Re-run until 93 tests pass.

## Quality Gates
- `npm run lint` — 0 warnings
- `npm run build` — success
- `npm run test` — 93 E2E + existing unit tests pass

## Artifact Index
- `src/App.jsx` — AppRoutes export fix
- `src/test/e2e/e2e.test.jsx` — mock additions (if needed)
