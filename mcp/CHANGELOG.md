# mcp/ changelog

## 2026-08-30 — Phase D: "Bring your own agent" (MCP)

Built the local stdio MCP server that exposes a Liftit export to the user's own Claude/ChatGPT/Claude Code. Scope per STRATEGY.md §4.D. No commits made; `package.json` untouched (uses the already-installed `@modelcontextprotocol/sdk` 1.30.0 devDependency).

### Files

- `mcp/tools.js` (new) — pure, testable tool implementations over the parsed export doc. Plain Node ESM, **zero `src/*` imports** (Vite-isms avoided); small local helpers replicate engine math.
- `mcp/server.js` (new) — thin entry: `Server` + `StdioServerTransport` from the SDK, `ListToolsRequestSchema`/`CallToolRequestSchema` handlers, lazy doc load at first tool call (bad path → `isError` tool response, never a crash), doc re-read per call (fresh export picked up without restart), `process.exit(0)` on transport close, `console.error` only (stdout reserved for MCP framing).
- `mcp/README.md` (new) — export instructions, run/`claude mcp add`/Claude Desktop snippets, tool table, privacy notes (local file, read-only, no network), re-export note.
- `src/test/mcp-server.test.js` (new) — 25 tests: fixture doc (v3, 3 workouts / 2 exercises / 1 program / 2 bodyweight entries), v1-reject, invalid-JSON, light-normalization, overview math, e1RM known values, history/recent shapes, all five progression verdicts, empty-doc honest empties, unknown-tool/malformed-arg errors, content-wrapping.

### Tools

`liftit_overview`, `liftit_list_exercises`, `liftit_exercise_history`, `liftit_recent_workouts`, `liftit_progression` — all return `{ content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] }`; unknown tool → `isError`; missing/empty `exerciseId` → `isError` with message.

### Mirrored engine logic (keep in sync)

- `estimate1RM` = (Epley + Brzycki)/2, reps capped at 12, round 0.1 — from `src/engine/e1rm.js`.
- Working-set filter `!isWarmup && reps>0 && weight>0`; `trainingStreak` (1 rest day allowed, 365-day cap) — from `src/engine/analytics.js`.
- `currentProgramWeek` (floor(ms/7d)+1, clamped 1..durationWeeks) — from `src/engine/generator.js`.
- Progression trend rules from `src/engine/progression.js` `analyzeDoubleProgression`: volume plateau = recent-3 window within ±2% (0.98..1.02) of window-first; trend `progressing` (vol >3% or e1RM >2%), `plateaued` (both plateaus + ≥3 sessions), `regressing` (vol <−2% or e1RM <−1%), else `holding`; `insufficient_data` when <2 sessions (task spec; the app's UI layer additionally has a `starting` state for empty history).

Note for reviewers: the engine checks trend thresholds on **unrounded** deltas. A two-session bump of +2.4% e1RM reads `progressing` even though the reported (1-dp) number shows 2.4 — faithful to `progression.js`, verified in tests.

### Honest-data rule

Every value is derived from the export: unknown exercises → `[]`, single-session lifts → `insufficient_data`, empty doc → nulls/zeros/streak 0. Names resolve only from the doc's `customExercises`; other ids are title-cased slugs (`barbell-bench-press` → "Barbell Bench Press"), never invented. Records with unparseable dates are dropped at load, not fabricated around.

### Verification

- `npx vitest run src/test/mcp-server.test.js` → 25/25 pass.
- `npx eslint mcp/ src/test/mcp-server.test.js` → clean (mcp/ **is** covered by the existing flat config: `**/*.{js,jsx}` + node globals; no config change needed).
- Live stdio smoke test (spawned `node mcp/server.js <fixture>`): `initialize` handshake, `tools/list`, `tools/call` return real computed JSON on stdout; unknown tool returns `isError`; bad doc path returns `isError` ("Cannot read…"); no-path startup exits 1 with usage on stderr; server exits cleanly when stdin closes.

### Not done / notes

- No commits, no `package.json` changes, did not touch files owned by other agents (`src/data/recovery.js`, `src/lib/watchBridge.js`, `src/App.jsx`, `ios/Watch/**`).
- The legacy Express host under `server/src/mcp/` was not revived (out of scope; strategy mentions it as inspiration for the tool surface).
- Possible follow-ups: a bodyweight-series / ACWR read tool if agents want fatigue context; optional polling for re-exports; only `argv[2]`/`LIFTIT_DOC` file paths are accepted — URLs/remote sources intentionally unsupported (file-only by design).
