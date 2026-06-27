# Handoff Report — Discovery & Code Analysis

## 1. Observation
The codebase consists of a React client wrapped in Capacitor for native builds, and an Express TypeScript backend database application running Prisma ORM with MySQL.
- **Frontend Stack**: Defined in `package.json` with `"react": "^18.2.0"`, `"react-router-dom": "^6.22.0"`, `"recharts": "^2.12.0"`, and `"@capacitor/core": "^8.3.1"`.
- **Backend Stack**: Defined in `server/package.json` with `"express": "^4.21.0"`, `"@prisma/client": "^5.22.0"`, and `"@modelcontextprotocol/sdk": "^1.0.0"`.
- **Database Schema**: Located in `server/prisma/schema.prisma` with 10 schemas (User, Profile, Exercise, WorkoutLog, WorkoutSet, Program, ProgramDay, ProgramDayExercise, Mesocycle, ProgressionRule).
- **LocalStorage Data Cache**: Located in `src/data/db.js` where the root document parses from and stringifies to `localStorage.getItem('liftit_data_v2')`.
- **Client Synchronization Gaps**: Located in `src/data/sync.js`, specifically:
  ```javascript
  } else if (op.type === 'program.save' || op.type === 'program.delete') {
      // Program sync is local-only for now: the server program
      // model requires server-side generation. Drop the op.
  }
  ```
- **Volatile Trainer State**: Located in `server/src/ai/routes/ai.routes.ts` where sessions are cached on an in-memory Map:
  ```typescript
  const trainers: Map<string, AITrainer> = new Map();
  ```
- **Test Suite structure**: Located in `src/test/` containing `db.test.js`, `engine.test.js`, and `smoke.test.jsx`, run via `vitest run` as defined in `package.json`. No tests exist under the `server/` directory.

## 2. Logic Chain
1. From the observation of `sync.js` lines 114–117, workout logs are synced via endpoints, but program creation/deletion operations are discarded client-side. Thus, user training programs and routines are currently local-only and not synced.
2. From the observation of `db.js` using `localStorage`, the data size is constrained by the browser's ~5MB synchronous LocalStorage storage limit, which can block the main React thread when reading or writing large logs.
3. From the observation of `ai.routes.ts` line 68, the `trainers` cache is stored in memory (`new Map()`). If the backend process restarts or scales, active AI Coach conversations and context caches will be lost.
4. From the observation of `vitest.config.js` and `package.json` test scripts, the test environment relies on `jsdom` to execute frontend tests. The lack of test suites in the `server/` folder indicates that server routes, token security, and Prisma query operations are currently unverified.

## 3. Caveats
- No code was executed during this initial discovery (per read-only instructions). We assumed the current production configuration and credentials configurations work out-of-the-box in the local docker database environment.
- External oauth callback redirect URL verification was not performed because it relies on active Google/GitHub client clientSecrets.

## 4. Conclusion
The Liftit application has a solid local-first design, but needs key upgrades to be production-ready:
1. Migrate the client-side database from `localStorage` to `IndexedDB` to handle large local logs and avoid UI-blocking processes.
2. Implement backend endpoints to sync Programs and Progression Rules, and update the client-side `sync.js` to process these operations.
3. Persist AI Coach chat histories to the MySQL database via Prisma to prevent data loss on server restarts.
4. Set up backend integration tests (using Vitest or supertest) to verify API routing and security.

## 5. Verification Method
1. **Frontend compilation and checks**: Run `npm run build` to verify the React client compiles without bundler issues.
2. **Client-side test execution**: Run `npm run test` to verify all 3 test files (`db.test.js`, `engine.test.js`, `smoke.test.jsx`) run and pass successfully.
3. **Report file inspection**: Review the complete generated report in `.agents/teamwork_preview_explorer_discovery/analysis.md` to confirm detailed architecture mappings, screen catalogs, database setups, and milestone breakdowns.
