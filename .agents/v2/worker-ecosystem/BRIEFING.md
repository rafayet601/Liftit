# BRIEFING — worker-ecosystem

## Mission
Build Phase C (STRATEGY.md §4): recovery context and ecosystem — HealthKit/Health Connect readiness, bodyweight tracking with schema migration, and routine share links. Blocked until Phase B gates pass.

## 🔒 Identity
- Archetype: v2_worker
- Working directory: `/Users/rivu/GitHub/Liftit/.agents/v2/worker-ecosystem`

## Scope & Files
1. **Recovery readiness** — new `src/data/recovery.js` + `src/contexts/RecoveryContext.jsx`: read HRV trend, sleep duration, resting-HR via a Capacitor health plugin (HealthKit / Health Connect). Derive an on-device, opt-in daily readiness. It must only *modulate* Phase B fatigue thresholds (pass as options into `src/engine/fatigue.js`); the deterministic engine always remains the decision-maker. Default off; graceful no-op when no wearable or permission denied.
2. **Bodyweight + measurements** — schema v2→v3 bump in `src/data/schema.js` with a tested migration in `src/data/db.js` (pattern: existing v1→v2 migration). New collections, quick-log UI in `Progress.jsx`, and e1RM/bodyweight ratio metric. Include bodyweight in `db.export()`/`import()`.
3. **Routine share links** — compact program serialization (JSON → base64url fragment) + `.liftit.json` file export/import in `Program.jsx`; import validates via `createProgram` and preview-before-commit. Reject oversized/hostile payloads (clamp like `functions/api/_lib.js` does).

## Constraints
- **Local-first invariants**: recovery data stays on device; readiness computation on-device; nothing new required server-side. D1 schema untouched unless a work item explicitly demands it.
- Health claims: none. Copy says "readiness", never medical language.
- Schema migration must be reversible-safe (old exports still importable) and tested both directions.
- Existing engine/tests keep passing; all changes additive.

## Acceptance (mirrors STRATEGY.md §4.C)
- `npm run check` green.
- Readiness: unit tests with synthetic HRV/sleep series; off-by-default verified; permission-denied path is a clean no-op.
- Migration: v2 document → v3 round-trip test; `db.import` accepts legacy v2 exports.
- Share links: round-trip test, hostile-payload rejection test.

## Deliverables
Code + tests + dated `changes.md` in this directory. Hand off to orchestrator when `npm run check` passes locally.
