# Project: Liftit Premium Revamp

## Architecture

Liftit follows a local-first architecture where the client maintains its database locally (using `@capacitor/preferences` asynchronously, with a synchronous in-memory document cache) and synchronizes background changes bidirectionally with an Express/TypeScript server backed by a MySQL database using Prisma ORM.

### Client-Side Architecture
- **View Layer**: React 18 with Vite, React Router, Tailwind CSS, Recharts.
- **Data Layer**: `DataProvider.jsx` provides state contexts, listening to subscribers from `db.js`.
- **Local Storage**: `@capacitor/preferences` stores `liftit_data_v2`.
- **Sync Layer**: `sync.js` drains the sync operations queue against backend endpoints when online.

### Server-Side Architecture
- **REST APIs**: Express endpoints for authentication, workouts, programs, exercises, and synchronization.
- **AI Coach**: Persisted conversation session models connected with LLM providers (Groq/Anthropic).
- **ORM**: Prisma client interacting with MySQL database.
- **MCP Host**: Exposes local-first domain context tools to LLMs.

---

## Milestones

| # | Name | Scope | Dependencies | Status |
|---|---|---|---|---|
| M1 | UI/UX Glassmorphic Revamp | Refactor 8 primary screens to dark glassmorphic styling; add transitions and animations (<300ms) | None | PLANNED |
| M2 | Storage & Platform Sync | Migrate client local storage to `@capacitor/preferences`; configure Capacitor Android wrapper | M1 | PLANNED |
| M3 | Bidirectional Sync | Implement full bidirectional sync for Workouts, Programs, and Settings with conflict resolution | M2 | PLANNED |
| M4 | Analytics & Autoregulation | Enable interactive Recharts tooltips; add mid-session workout editing and double-progression tests | M3 | PLANNED |
| M5 | AI Coach Persistence | Save AI Coach conversation history to DB; ground prompts with user logs | M3 | PLANNED |
| M6 | Verification & Hardening | Opaque-box test suite integration (Tiers 1-4); white-box adversarial testing (Tier 5); final audit | M4, M5 | PLANNED |

---

## Code Layout

### Client Codebase
- `/src/pages/`: 8 core screens (Home.jsx, Workout.jsx, History.jsx, Program.jsx, Progress.jsx, Onboarding.jsx, Settings.jsx, Login.jsx)
- `/src/components/`: Reusable widgets (charts, auth, layout, ui, workout)
- `/src/data/`: Data access, schema v2 definition, sync worker, db cache wrapper
- `/src/engine/`: Analytics, progression logic, split generators, 1RM formulas
- `/src/test/`: Vitest test suites (db.test.js, engine.test.js, smoke.test.jsx)

### Server Codebase
- `/server/src/routes/`: API controllers (auth.ts, workouts.ts, programs.ts, users.ts, exercises.ts)
- `/server/src/ai/`: AI routes, prompts, trainers, conversation cached state
- `/server/prisma/`: Prisma schema.prisma and seed.ts

---

## Interface Contracts

### 1. Unified Bidirectional Sync Contract (`POST /api/sync`)
Client calls this endpoint to synchronize all local changes and pull down server changes.
- **Request Body**:
  ```json
  {
    "lastSyncedAt": "2026-06-26T22:00:00.000Z",
    "operations": [
      {
        "id": "op_123",
        "type": "workout.save",
        "payload": { ... },
        "ts": "2026-06-26T22:30:00.000Z"
      }
    ]
  }
  ```
- **Response Body**:
  ```json
  {
    "lastSyncedAt": "2026-06-26T22:48:00.000Z",
    "appliedOpIds": ["op_123"],
    "serverUpdates": {
      "workouts": [ ... ],
      "programs": [ ... ],
      "settings": { ... }
    }
  }
  ```

### 2. AI Coach Conversation History Contract (`GET/POST /api/ai/chat`)
Saves chat messages into a relational table.
- **POST /api/ai/chat**
  Request: `{ "message": "Can you review my squats?" }`
  Response: `{ "reply": "...", "conversationId": "..." }`
- **GET /api/ai/chat/history**
  Response: `[ { "role": "user", "content": "..." }, { "role": "assistant", "content": "..." } ]`
