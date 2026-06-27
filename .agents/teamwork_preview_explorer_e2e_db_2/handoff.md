# E2E Data & Sync Investigation Handoff Report

## 1. Observation

During the read-only investigation of the `Liftit` project, the following structures, files, and endpoints were analyzed:

### A. Client Data Layer & Storage Keys
- **`src/data/db.js`**: Exposes the `db` interface. It stores user data inside the browser's `localStorage` under:
  - `liftit_data_v2` (Line 28): Contains the full serialized JSON document containing setting configs, workouts array, programs, custom exercises, sync queue, and meta properties.
  - `liftit_data_v1` (Line 29): Checked on boot for legacy data to perform migration.
  - `liftit_unit` (Line 30): Unit preference ('kg' or 'lbs') for legacy storage.
- **`src/data/sync.js`**: Consumes local storage mapping for synchronization tracking:
  - `liftit_sync_idmap_v1` (Line 13): Maps local entity temporary client IDs (e.g., `wo_...`) to permanent MySQL database IDs (e.g., `cuid` formats) for tracking and duplicate prevention.
- **`src/data/schema.js`**: Defines the root document schema structure:
  - `SCHEMA_VERSION = 2` (Line 9).
  - The document root returned by `createDocument()` is structured as (Line 120-134):
    ```json
    {
      "version": 2,
      "settings": {
        "name": "",
        "units": "kg",
        "experience": "intermediate",
        "goal": "hypertrophy",
        "onboarded": false,
        "restTimerEnabled": true,
        "ai": { "provider": "none", "model": "", "apiKey": "", "baseUrl": "" }
      },
      "workouts": [],
      "programs": [],
      "customExercises": [],
      "syncQueue": [],
      "meta": { "isDemo": false, "createdAt": "...", "lastSyncedAt": null }
    }
    ```
  - **Capacitor Preferences Integration (`@capacitor/preferences`)**: It is present in the root `package.json` dependencies (Line 43: `"@capacitor/preferences": "^8.0.1"`) but is not currently imported or used anywhere in the client code. The codebase relies entirely on synchronous browser `localStorage`.

---

### B. Server REST API Surface
The Express backend router configurations are located in `server/src/routes/` and `server/src/ai/routes/ai.routes.ts`.

#### 1. Authentication (`server/src/routes/auth.ts`)
- `GET /api/auth/google`: Initiates Google OAuth callback routing.
- `GET /api/auth/google/callback`: Finalizes OAuth, retrieves user details, issues cookie session, sets `token` HTTP-only cookie, and redirects user to `/auth/callback`.
- `GET /api/auth/github`: Initiates GitHub OAuth callback routing.
- `GET /api/auth/github/callback`: GitHub callback issuing stateless JWT session cookie.
- `GET /api/auth/me` (requires JWT): Retrieves current user information `{ id, email, name, image }`.
- `POST /api/auth/logout` (requires JWT): Clears cookie session.

#### 2. Workouts (`server/src/routes/workouts.ts`)
- `GET /api/workouts` (requires JWT): Returns paginated list of workout logs `{ data: WorkoutLog[], pagination: { page, limit, total, pages } }`. Supports query parameters `page`, `limit`, `startDate`, and `endDate`.
- `POST /api/workouts` (requires JWT): Creates a new workout log. Validates request body using Zod schema `createWorkoutLogSchema`. Supports nested `WorkoutSet` creation.
- `GET /api/workouts/:id` (requires JWT): Retrieves a single workout log by ID (with sets ordered by `setNumber` and program day).
- `PUT /api/workouts/:id` (requires JWT): Updates an existing workout log. Overwrites sets by deleting existing sets and executing a `createMany` operation.
- `DELETE /api/workouts/:id` (requires JWT): Deletes a workout log.

#### 3. Programs (`server/src/routes/programs.ts`)
- `GET /api/programs` (requires JWT): Returns paginated program lists including program days, exercises, and mesocycles.
- `POST /api/programs` (requires JWT): Creates a new program. Ensures only one program is active by setting others to `isActive: false` if the new program is active. Supports nested creation of days and exercises.
- `GET /api/programs/current` (requires JWT): Retrieves the active program.
- `GET /api/programs/:id` (requires JWT): Returns a specific program.
- `PUT /api/programs/:id` (requires JWT): Updates basic program metadata (name, goal, difficulty, durationWeeks, isActive).
- `DELETE /api/programs/:id` (requires JWT): Deletes a program.

#### 4. Exercises (`server/src/routes/exercises.ts`)
- `GET /api/exercises`: Returns global exercises paginated. Supports query filtering: `search`, `muscleGroup`, `equipment`, `difficulty`, `isCompound`, `isIsolation`, `isCardio`.
- `GET /api/exercises/muscle-groups`: Returns unique list of muscle groups.
- `GET /api/exercises/equipment`: Returns unique list of equipment.
- `GET /api/exercises/:id`: Returns single exercise metadata.
- `GET /api/exercises/muscle/:muscleGroup`: Returns exercises matching the group.

#### 5. Current `POST /api/sync` Implementation (`server/src/app.ts` - Lines 48-194)
- Acts as a **one-way upload sync endpoint** accepting `{ workoutLogs: Array, programs: Array }` (validates with Zod schema `syncPayloadSchema`).
- Decodes JWT to retrieve `userId`.
- Loops through `workoutLogs`:
  - Queries database for a duplicate log by matching `{ userId, name, startedAt: Date(startedAt || date) }`.
  - If a match exists, skips creating the log (`results.skipped++`).
  - If a match is missing, inserts the workout log and sets.
- Loops through `programs`:
  - Queries database for a duplicate program by matching `{ userId, name }`.
  - If a match exists, skips creating the program.
  - If missing, inserts the program, program days, and program exercises.
- Responds with:
  ```json
  {
    "message": "Sync completed",
    "results": {
      "imported": 2,
      "skipped": 1,
      "errors": []
    }
  }
  ```

---

### C. Database Structure (Prisma / MySQL)
Located in `server/prisma/schema.prisma`. Essential tables:
- **`User`**: Root user entity.
- **`Profile`**: User bio, level, goal, and measurement units preference (`preferredUnits`, `measurementUnit`).
- **`WorkoutLog`**: Workouts with `userId`, `name`, `startedAt`, `completedAt`, `duration`, `isCompleted`. Linked to `User` and optionally `ProgramDay`.
- **`WorkoutSet`**: Linked to `WorkoutLog` and `Exercise`. Tracks `setNumber`, `reps`, `weight`, `rpe`, `isWarmup`, `isDropSet`, `isFailure`, and `completedAt`.
- **`Program`**: Training program metadata linked to `User`.
- **`ProgramDay`**: Unique day number slot per program (e.g. Day 1, Day 2). Linked to `Program`.
- **`ProgramDayExercise`**: Specific exercise in a program day with target reps, sets, RPE, rest seconds, and ordering index.
- **`Mesocycle`**: Training block grouping programs.

---

## 2. Logic Chain

From the observed code files, we can reason about the migration and E2E testing framework as follows:

### A. Capacitor Preferences Asynchronous Local Cache Architecture
1. **Observation**: Currently, `db.js` performs synchronous reads/writes to `localStorage` (via `load()` and `persist()`). But the `@capacitor/preferences` API is asynchronous (returns Promises).
2. **Problem**: Direct synchronous conversion of `db.get()`, `db.workouts.list()`, etc., to async functions will break synchronous UI state bindings (`useSyncExternalStore` in React).
3. **Proposed Design**:
   - Introduce a **write-through in-memory document cache** on the client.
   - At application boot, the app executes an async call:
     ```javascript
     const { value } = await Preferences.get({ key: 'liftit_data_v2' });
     inMemoryDoc = value ? JSON.parse(value) : createDocument();
     ```
   - All client reads (e.g. `db.workouts.list()`) reference the `inMemoryDoc` synchronously.
   - All client modifications (e.g. `db.workouts.save()`) modify `inMemoryDoc` synchronously and invoke listeners to notify React to re-render.
   - In the background, `persist()` is triggered asynchronously without delaying user interaction:
     ```javascript
     Preferences.set({ key: 'liftit_data_v2', value: JSON.stringify(inMemoryDoc) }).catch(e => console.error(e));
     ```

### B. Bidirectional Sync Protocol Design
1. **Observation**: The current server `POST /api/sync` does not handle server-to-client updates, delete operations, or conflict resolution.
2. **Proposed Bidirectional Sync Flow (M3)**:
   - **Client Sync Queue Structure**:
     - Client tracks operations in `syncQueue` (e.g., `{ id, type: 'workout.save' | 'workout.delete' | 'settings.save', payload, ts }`).
   - **Sync Request Payload**:
     ```json
     {
       "lastSyncedAt": "2026-06-26T22:00:00.000Z",
       "operations": [
         {
           "id": "op_client_1",
           "type": "workout.save",
           "payload": { "id": "wo_client_abc", "name": "Squat Day", "startedAt": "...", "sets": [...] },
           "ts": "2026-06-27T02:00:00.000Z"
         }
       ]
     }
     ```
   - **Server Synchronization Loop**:
     1. Start transaction.
     2. Process each client operation in `operations` array:
        - Check if the entity (e.g., `WorkoutLog` with client ID mapped via `idMap` or stored on the server as `clientUuid`) exists on the server.
        - **Conflict Handling**:
          - If the entity was modified on the server after the client's `lastSyncedAt` (based on comparing database `updatedAt` to operation `ts`), use Last-Write-Wins (LWW) resolution:
            - If client `ts` is newer than server `updatedAt`: Apply client changes.
            - If server `updatedAt` is newer than client `ts`: Keep server state, skip processing client operation (client will pull the newer server state in the response).
          - If no conflict: Apply the client operation (insert or update).
     3. Fetch server updates:
        - Query database for all entries (`WorkoutLog`, `Program`, `Profile`) belonging to the user that have `updatedAt > lastSyncedAt`.
     4. Finalize transaction and return response:
        ```json
        {
          "lastSyncedAt": "2026-06-27T02:52:00.000Z",
          "appliedOpIds": ["op_client_1"],
          "serverUpdates": {
            "workouts": [ /* server-updated workouts */ ],
            "programs": [ /* server-updated programs */ ],
            "settings": { /* server-updated profile/settings */ }
          }
        }
        ```

### C. Offline Simulation and Database State Verification
1. **Offline Simulation**:
   - To realistically test local-first functionality, we must verify the client works when offline and syncs on reconnection.
   - For E2E browser tests (Playwright): Toggling network connectivity can be done via browser context emulation:
     - `await context.setOffline(true);` forces standard network interfaces to fail, triggering `window` offline listeners.
     - Intercepting `/api/sync` endpoints via `page.route('**/api/sync', route => route.abort('failed'))` isolates backend api failures while frontend client assets load.
2. **Database Verification**:
   - For integration testing, Prisma's TypeScript client can connect directly to the test database inside the Playwright Node.js runner to read and clean tables.

---

## 3. Caveats

- **OAuth Bypass**: Because Google/GitHub OAuth screens cannot be realistically automated in headless E2E testing without running into CAPTCHAs or hitting limits, a dedicated auth bypass mechanism is assumed. We propose exposing a developer-only endpoint `POST /api/auth/bypass` or validating a specialized token payload for testing environments.
- **Clock Drift**: Last-Write-Wins (LWW) conflict resolution depends heavily on accurate device timestamps. Large local clock drifts on client devices can lead to unexpected overrides. A clock skew detection and correction algorithm (like calculating client-server offset on sync and normalizing `ts` values) will be required for production.
- **Physical Device Limitations**: In an E2E test suite running on a standard macOS/Linux environment, `@capacitor/preferences` defaults to browser `localStorage`. Real native execution in iOS Simulator / Android Emulator is out of scope for browser-based Playwright suites and must be simulated or tested in dedicated app automation setups (Appium).

---

## 4. Conclusion & Action Plan

A comprehensive E2E testing approach is feasible using a standard Playwright + Prisma + Docker test runner.

### Proposed Test Setup & Directory Layout
```
/src/test/e2e/
├── helpers/
│   ├── db-utils.ts       # Database clean/query utilities using Prisma
│   └── auth-utils.ts     # Helpers to inject JWT cookies for bypass login
├── sync.spec.ts          # E2E test suite for offline/online and bidirectional sync
└── storage.spec.ts       # E2E test suite for Capacitor Preferences migration
```

### Flowchart: Local-First E2E Offline Write & Reconnect Sync Test

```
[ Test Setup: Clear MySQL Database & Set JWT Cookie ]
                         │
                         ▼
[ Load App in Playwright: Verify Preferences Initialized ]
                         │
                         ▼
[ Trigger Offline Mode: context.setOffline(true) ]
                         │
                         ▼
[ Perform Client Write: Add Workout "Deadlift PR" in UI ]
                         │
                         ▼
[ Client Assertions: Verify "Deadlift PR" in local state/Preferences ]
[ Database Assertions: Verify WorkoutLog table in MySQL remains empty ]
                         │
                         ▼
[ Trigger Online Mode: context.setOffline(false) ]
                         │
                         ▼
[ Wait for Sync: Wait for POST /api/sync endpoint call ]
                         │
                         ▼
[ Client Assertions: Verify Sync Queue is empty ]
[ Database Assertions: Verify "Deadlift PR" exists in MySQL via Prisma query ]
```

---

## 5. Verification Method

To verify the test suite run conditions and database interactions:

1. **Verify Database connection**:
   Confirm Prisma schema validity and DB schema push status using:
   ```bash
   npm run db:push
   ```
2. **Run Tests**:
   Execute the local frontend tests to verify the cache migration behavior:
   ```bash
   npm run test
   ```
3. **Trace API Request**:
   Test a standard authentication request via curl or script using the development server:
   ```bash
   curl -I http://localhost:3001/api/exercises
   ```
