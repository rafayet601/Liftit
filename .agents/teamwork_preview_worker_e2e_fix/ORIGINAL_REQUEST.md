# Original User Request — E2E Fix Worker

## 2026-06-27T06:00:00Z

Fix the 90 failing E2E tests in the Liftit fitness app. Root cause identified: `AppRoutes` is not exported from `src/App.jsx`, causing `import { AppRoutes } from '../../App'` to resolve to `undefined` and React to throw "Element type is invalid: expected a string... but got: undefined" for every test that renders `<AppRoutes />`.

## Scope
- Add `export` keyword to `function AppRoutes()` in `src/App.jsx`.
- Verify WebGL shader components (ShaderBackground, WaveDistortion, Glass) gracefully degrade in JSDOM (no WebGL context).
- Add mocks to `src/test/e2e/e2e.test.jsx` for shader components ONLY if they cause JSDOM failures after the export fix (shader components already have try-catch + null checks).
- Ensure all 93 E2E tests pass via `npm run test`.

## Constraints
- CODE_ONLY network mode.
- Do NOT change component APIs or structure — keep existing component contracts intact.
- All shader effects must gracefully handle WebGL failures (already implemented with try-catch).
- Do not modify non-test application logic unless fixing a genuine bug blocking tests.

## File Ownership (non-overlapping)
- `src/App.jsx` (add export keyword only)
- `src/test/e2e/e2e.test.jsx` (add mocks only if strictly necessary)

## Success Criteria
- `npm run lint` passes with 0 warnings.
- `npm run build` succeeds.
- `npm run test` shows 93 E2E tests passing (plus existing unit/engine/db tests).
