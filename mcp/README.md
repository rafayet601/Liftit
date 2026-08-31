# Liftit MCP server (bring your own agent)

A local-only [Model Context Protocol](https://modelcontextprotocol.io) server that lets **your own** AI agent — Claude Desktop, Claude Code, ChatGPT desktop, any MCP client — read your Liftit training data. It runs on your machine over stdio, reads a JSON export from disk, and answers questions with real, computed numbers (same math as the app's engine). It is the "Platform Play" piece of the roadmap: your data, your model, no middleman.

## 1. Export your data

In the Liftit app: **Settings → Export → `liftit_data.json`**.

The file is your whole training document (schema version 2 or 3): workouts with sets, programs, custom exercises and — on v3 — bodyweight entries. All weights are kg. The server rejects anything that isn't a v2/v3 export with a clear error, and skips individual records it can't parse (e.g. a workout with a broken date) rather than guessing.

## 2. Run it

```sh
node mcp/server.js /path/to/liftit_data.json
```

or point it at the file via the environment:

```sh
LIFTIT_DOC=/path/to/liftit_data.json node mcp/server.js
```

The document is loaded lazily on the first tool call and re-read from disk on each call — a bad path surfaces as a tool error (never a crash), and a fresh export is picked up without restarting the server.

## 3. Connect your agent

### Claude Desktop

Edit `claude_desktop_config.json` (macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "liftit": {
      "command": "node",
      "args": ["/absolute/path/to/Liftit/mcp/server.js", "/absolute/path/to/liftit_data.json"]
    }
  }
}
```

### Claude Code

```sh
claude mcp add liftit -- node /absolute/path/to/Liftit/mcp/server.js /absolute/path/to/liftit_data.json
```

### Any other MCP client

It's a plain stdio server: spawn `node mcp/server.js <doc-path>` and speak MCP over stdin/stdout. `LIFTIT_DOC` is accepted instead of `argv[2]`.

## 4. Tools

| Tool | What it returns |
|---|---|
| `liftit_overview` | Workout count, first/last workout date, total volume (kg), current streak (consecutive days, 1 rest day allowed), active program with current week, latest bodyweight. |
| `liftit_list_exercises` | Distinct exercises (most recent first) with session count, last trained date, best estimated 1RM (kg). |
| `liftit_exercise_history` | Newest-first per-session history for one exercise: top weight, reps at top weight, e1RM, session volume. `{ exerciseId, limit? }`. |
| `liftit_recent_workouts` | Newest-first sessions with name, duration, volume, working-set count, exercise names. `{ limit? }`. |
| `liftit_progression` | Trend verdict over the last ≤8 sessions of one lift — `progressing / plateaued / holding / regressing / insufficient_data` — plus per-session top weight/reps and volume/intensity deltas. `{ exerciseId }`. |

Exercise names come from your export's custom exercises when they match; otherwise the exercise id (a slug like `barbell-bench-press`) is title-cased — **no names are ever invented**.

## 5. Privacy & security

- **Local file only.** The server reads the JSON export you point it at. It never contacts a Liftit server, the app, or any API. There is no network code at all.
- **Read-only.** Nothing is written: no file writes, no database, no state beyond a single process lifetime.
- **You run it.** The process is spawned by your MCP client, under your user account, on your machine. Kill it any time.
- **stdout is the protocol channel.** All logs go to stderr; the server never `console.log`s.

## 6. Keeping it fresh

Re-export from the app **after each session** (Settings → Export) and the server will serve the new data on its next tool call — no restart needed. If your agent reports a wrong date range, check that the export path points at the newest file.

## 7. Development

- `mcp/tools.js` — pure, testable tool implementations (plain Node ESM, zero `src/*` imports). Mirrors `src/engine/e1rm.js`, `src/engine/analytics.js` (streak), `src/engine/generator.js` (program week) and `src/engine/progression.js` (trend rules) — keep them in sync.
- `mcp/server.js` — thin stdio transport using `@modelcontextprotocol/sdk` (`Server`, `StdioServerTransport`, `ListToolsRequestSchema`, `CallToolRequestSchema`).
- Tests: `npx vitest run src/test/mcp-server.test.js`.
