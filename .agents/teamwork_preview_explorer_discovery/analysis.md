# Codebase Discovery & Architectural Analysis Report

**Project**: Liftit  
**Author**: teamwork_preview_explorer  
**Date**: 2026-06-27  
**Working Directory**: `/Users/rivu/Documents/Documents - Mohammad’s MacBook Pro (2)/GitHub/Liftit`  

---

## Executive Summary
This report presents an in-depth, read-only code analysis and discovery of the **Liftit** local-first fitness application. Liftit is designed as a hybrid mobile/web application (React/Capacitor/Vite) backed by an Express/TypeScript server utilizing Prisma ORM and MySQL. 

Key discoveries show a solid offline-first foundation on the client side using a modular local-store repository. However, critical gaps exist: **programs and settings are currently excluded from cloud synchronization**, the local store relies solely on synchronous `localStorage` (limited to 5MB and prone to blocking the main thread), and the AI Trainer conversation history on the server is volatile (stored in an in-memory Map). 

This analysis details the current codebase architecture, maps out the existing 8 primary client screens, evaluates the database and test suite setup, and outlines a recommended implementation strategy divided into actionable milestones for the upcoming premium glassmorphic revamp.

---

## Codebase Directory Layout Map

Below is a map of the key directories and configuration files across the codebase:

```
Liftit/ (Workspace Root)
├── .github/                 # GitHub CI/CD workflows
├── .agents/                 # Teamwork agent metadata & reports
├── public/                  # Static assets for frontend
├── src/                     # Frontend Application Source (React)
│   ├── ai/                  # Client-side AI configuration & adapters
│   │   ├── coach.js         # Grounding system prompt builder
│   │   └── providers.js     # Client-side LLM providers (Anthropic, OpenAI, etc.)
│   ├── components/          # Reusable React components
│   │   ├── ai/              # AI Chat interface elements
│   │   ├── auth/            # Auth pages (e.g. LoginPage, AuthCallback)
│   │   ├── charts/          # Recharts components (WeeklyVolumeBarChart)
│   │   ├── layout/          # Desktop Sidebar, MobileNav layout
│   │   ├── ui/              # UI primitives (Card, Sheet, StatTile, ProgressBar)
│   │   └── workout/         # Workout session widgets (SetRow, RestTimer)
│   ├── contexts/            # Context API (Auth, Units, Modals)
│   ├── data/                # Data storage layer
│   │   ├── DataProvider.jsx # External store sync & listeners
│   │   ├── db.js            # Local store repository wrapper (LocalStorage)
│   │   ├── exercises.js     # Static exercise database library
│   │   ├── schema.js        # Canonical client shapes (v2)
│   │   └── sync.js          # Background synchronization worker
│   ├── engine/              # Mathematical calculation modules
│   │   ├── analytics.js     # Consistency, streaks, and set calculations
│   │   ├── e1rm.js          # Estimated 1RM formulas (Epley, Brzycki)
│   │   ├── generator.js     # Split/program generators (Full Body, Upper/Lower)
│   │   └── progression.js   # Autoregulation & load scaling suggestions
│   ├── hooks/               # Custom hooks (useActiveSession)
│   ├── pages/               # Primary application screens
│   ├── test/                # Test suite files (Vitest + JSDom)
│   ├── App.jsx              # Main routing and provider setup
│   ├── index.css            # LIFTIT · FORGE global design system stylesheet
│   └── main.jsx             # React DOM entry point
├── server/                  # Backend Application Source (Express + TypeScript)
│   ├── prisma/              # Prisma configuration & seeding
│   │   ├── schema.prisma    # Database schemas (MySQL)
│   │   ├── seed.ts          # Database seed scripts
│   │   └── lib.ts           # Global Prisma Client wrapper
│   ├── src/                 # Server Source
│   │   ├── ai/              # AI Coach routes and logic
│   │   │   ├── routes/      # AI API router
│   │   │   ├── services/    # Progression engines and prompt templates
│   │   │   └── trainer.ts   # AITrainer state class
│   │   ├── config/          # Configurations (env, passport)
│   │   ├── mcp/             # Model Context Protocol hosting
│   │   ├── middleware/      # Express middlewares (auth, error validation)
│   │   ├── routes/          # CRUD API Routes (workouts, programs, users)
│   │   ├── services/        # Backend business logic (auth, user)
│   │   └── app.ts           # Express Application definition
│   └── tsconfig.json        # Server TypeScript configuration
├── capacitor.config.json    # Capacitor configuration file
├── package.json             # Workspace dependencies and script config
├── tailwind.config.js       # Tailwind CSS configuration
├── vite.config.js           # Vite configuration
└── vitest.config.js         # Vitest configuration
```

---

## 1. System Architecture Map

The Liftit application implements a **local-first** visual client synced asynchronously with a secure, stateless REST API. The complete architectural stack is broken down below:

```
                  +----------------------------------------------+
                  |               Vite/React Client              |
                  |                                              |
                  |  +----------------+      +----------------+  |
                  |  |  React Pages   |      | Recharts/SVGs  |  |
                  |  +-------+--------+      +-------+--------+  |
                  |          |                       ^           |
                  |          v                       |           |
                  |  +-------+--------+      +-------+--------+  |
                  |  |  DataProvider  |<---->| Engine Modules |  |
                  |  +-------+--------+      +----------------+  |
                  |          |                                   |
                  |          v                                   |
                  |  +-------+--------+      +----------------+  |
                  |  |  Local Store   |<---->|  LocalStorage  |  |
                  |  |  (db.js cache) |      | (JSON, v2 schema)|
                  |  +-------+--------+      +----------------+  |
                  |          | (syncQueue)                       |
                  |          v                                   |
                  |  +-------+--------+                          |
                  |  |  Sync Worker   |                          |
                  |  |   (sync.js)    |                          |
                  |  +-------+--------+                          |
                  +----------|-----------------------------------+
                             |
                             | (HTTPS Requests / Cookie / Authorization)
                             v
                  +----------------------------------------------+
                  |         Express Backend Server (Node/TS)      |
                  |                                              |
                  |  +----------------+      +----------------+  |
                  |  |  REST Routes   |<---->|   MCP Server   |  |
                  |  | (workouts/auth)|      | (SSE & Stream) |  |
                  |  +-------+--------+      +-------+--------+  |
                  |          |                       |           |
                  |          v                       v           |
                  |  +-------+-----------------------+--------+  |
                  |  |         Prisma ORM Database Client        |  |
                  |  +-------------------+--------------------+  |
                  +----------------------|-----------------------+
                                         |
                                         v
                               +-------------------+
                               |  MySQL Database   |
                               | (Docker Service)  |
                               +-------------------+
```

### Frontend Stack (Client)
- **Framework**: React 18.2.0 (rendered with Vite)
- **Routing**: React Router Dom v6.22.0
- **Styling**: TailwindCSS 3.4.19 (uses global variables, dynamic CSS classes, gradient utilities)
- **Visualization**: Recharts 2.12.0 (for progress graphs) and custom inline SVG drawings for history sparklines.
- **Native Wrapper**: Capacitor v8.3.1 (configured for iOS and CLI capabilities).
- **Offline Data Store**: Custom module cache writing to `localStorage` (Key: `liftit_data_v2`).
- **Client AI Layer**: Direct client-to-API fetch calls (with user-provided API keys) targeting Anthropic, OpenAI, or Groq. If not configured, it proxies requests through the app server.

### Backend Stack (Server)
- **Runtime**: Node.js & TypeScript
- **Framework**: Express v4.21.0
- **Database Client**: Prisma Client v5.22.0
- **Authentication**: JWT stateless authentication, validating tokens supplied via `Authorization` headers (`Bearer <token>`) or `token` HTTP cookies (`lax` sameSite, `httpOnly`). Passport.js handles Google and GitHub OAuth redirection.
- **AI Coach Integration**: Groq SDK (`groq-sdk` v1.1.1) and Anthropic SDK (`@anthropic-ai/sdk` v0.90.0). Keeps active conversation structures in-memory via `trainers` cache.
- **Model Context Protocol (MCP)**: Implemented using `@modelcontextprotocol/sdk` v1.0.0. Mounts an MCP endpoint under `/api/mcp` supporting Server-Sent Events (SSE) and exposes tools mapping to users, workouts, programs, and progression structures.

---

## 2. Existing 8 Primary Screens Status

All 8 user interfaces reside in `src/pages/` and utilize layout wrappers defined in `src/App.jsx`.

| Screen Name | File Path | Current Design & Visual Setup | Functional Status |
| :--- | :--- | :--- | :--- |
| **1. Home** | `src/pages/Home.jsx` | Dark background with static gradient radial glow. CustomStatTiles, interactive Recharts-based bar chart, PR list, and "Ask Coach" modal button. | **Fully Functional**. Reacts to local data updates using `useSyncExternalStore` hooks. Seeding demo data is supported. |
| **2. Workout** | `src/pages/Workout.jsx` | Launcher lists program days or initiates empty workouts. Session tracks elapsedTime, progress-bar completeness, editable sets, inline input fields, rest timers, and summary overlays. | **Fully Functional**. Auto-regulates weights using progression engine suggestions. Launches overlay timer sheets. |
| **3. History** | `src/pages/History.jsx` | Chronological list showing dates, duration, set count, and PR trophies. Tapping logs brings up detailed workout sheets. | **Fully Functional**. Generates inline SVG sparklines for long-term exercise trends (e1RM). |
| **4. Program** | `src/pages/Program.jsx` | Displays current periodized block, weeks timeline, day summaries, target sets/reps/RPE, and Rest interval info. If empty, starts wizard. | **Fully Functional**. Wizard collects data and creates custom split structures. Swap and reorder actions are supported locally. |
| **5. Progress** | `src/pages/Progress.jsx` | Multi-tab page with interactive Recharts AreaChart showing e1RM history. Features a GitHub-likeconsistency heatmap (last 12 weeks) and muscle-group load balance lines. | **Fully Functional**. Calculations are completely client-side. Interactive tooltips are implemented. |
| **6. Onboarding**| `src/pages/Onboarding.jsx`| Progressive form asking for Name, Units, Experience, Goals, and Days. Seeds initial settings and redirects to wizard/home. | **Fully Functional**. Prevents home navigation unless settings indicate completion. |
| **7. Settings** | `src/pages/Settings.jsx` | Grouped sections for profile details, weight units, AI provider (provider selectors, model info inputs, API key textboxes), account sync triggers, and JSON data transfer. | **Fully Functional**. Changes persist to local cache instantly on input focus loss (`onBlur`). |
| **8. Login** | `src/pages/Login.jsx` | Renders `LoginPage` component. Renders brand headers, Continue with Google/GitHub oauth actions, Local Drive button, and Sample Data explore options. | **Fully Functional**. Connects to OAuth redirect URLs. Allows completely offline skip paths. |

---

## 3. Database, Storage, and Sync Setup

### Local Storage Architecture
1. **The Client DB Wrapper (`src/data/db.js`)**:
   - Stores the entire application dataset inside one JSON document in `localStorage` under `liftit_data_v2`.
   - On runtime, the JSON string is parsed once into an in-memory object cache `doc`.
   - Every write operation runs `commit()`, which updates the `doc` reference, stringifies it back to `localStorage`, and triggers subscribers to recalculate the state.
2. **Local Schema Configuration (`src/data/schema.js`)**:
   - Schema version is configured at `SCHEMA_VERSION = 2`.
   - Holds arrays of `workouts`, `programs`, `customExercises`, settings (`name`, `units`, `experience`, `onboarded`, `restTimerEnabled`, `ai`), and a `syncQueue`.

### Synchronization Strategy & Gaps
1. **Background Sync Worker (`src/data/sync.js`)**:
   - Employs a local `syncQueue` stored in the document. Every CRUD call (e.g. `workouts.save`) adds an operations entry (`workout.save` or `workout.delete`) to this queue.
   - When connection is detected (`navigator.onLine`), `runSync()` is fired in the background. It reads the local ID mapping (`liftit_sync_idmap_v1` inside localStorage) to convert client-generated UUIDs (e.g. `wo_xxxx`) into server-side database IDs.
   - It performs REST calls: `POST` to `/workouts` (saving ID mapping on return), `PUT` to `/workouts/:id`, or `DELETE` to `/workouts/:id`.
2. **Critical Sync Gaps**:
   - **No Program Synchronization**: `sync.js` (lines 114–117) drops all `program.save` and `program.delete` actions:
     ```javascript
     } else if (op.type === 'program.save' || op.type === 'program.delete') {
         // Program sync is local-only for now: the server program
         // model requires server-side generation. Drop the op.
     }
     ```
     This means program schedules, user goals, and program variations are **never** synced to the MySQL database.
   - **No Settings Synchronization**: Profile changes, custom exercise libraries, and unit configurations are not backed up.
   - **One-way Sync Direction**: The worker only pushes local client updates upstream. There is no automated routine to pull data recorded from other devices.

### Server Database Schema (Prisma & MySQL)
The backend model (`server/prisma/schema.prisma`) represents 10 tables:
- **`User` / `Profile`**: Keeps track of oauth profiles, displayName, level, goal, weight, height, units, and `activeMesocycleId`.
- **`Exercise`**: System library containing name, description, difficulty, equipment, and compound/isolation flags.
- **`WorkoutLog` / `WorkoutSet`**: Stores duration, completed states, mood, and sets metrics (reps, weight, RPE, distance, warmth flags).
- **`Program` / `ProgramDay` / `ProgramDayExercise`**: Periodized blocks generated by AI or templates, mapping days and individual targets.
- **`Mesocycle`**: Tracked block groups spanning multiple weeks.
- **`ProgressionRule`**: Custom formulas linking exercise progressions to specific increments or deload thresholds.

---

## 4. Existing Test Suite Analysis

### Test Environment
- **Framework**: Vitest (v4.1.4)
- **Environment**: `jsdom` (browser simulator)
- **Mocks & Polyfills**: `src/test/setup.js` sets up jest-dom overrides and polyfills `window.matchMedia`, `window.scrollTo`, and Recharts' dependency `window.ResizeObserver`.

### Test Coverage Map
The client-side features 3 test files under `src/test/`:

1. **`db.test.js` (Database & Cache Checks)**:
   - Validates that workouts are sorted by date and updated in-place.
   - Assures that only one program can be marked `isActive` concurrently.
   - Validates that the local queue correctly merges duplicate save/delete operations to save bandwidth.
   - Assures security: confirms custom AI API keys are stripped out before backup files are generated, and imports reject malicious embedded configurations (preventing SSRF).
   - Validates the legacy database migration logic (converting v1 logs and mesocycles to v2 schemas).
2. **`engine.test.js` (Logic & Math Calculations)**:
   - Validates Estimated 1RM formulas (Epley, Brzycki) and PR detection logic.
   - Tests progression rules: validates that completing all sets increases load, dropping sets triggers back-offs, and 3 consecutive stalls recommend a ~10% deload.
   - Verifies the generator split logic (3 days = Full Body, 4 days = Upper/Lower, 6 days = Push/Pull/Legs) and equipment filter settings.
   - Assures volume scaling checks: volume decreases on the final deload week.
3. **`smoke.test.jsx` (Component Rendering)**:
   - Renders `LoginPage` and checks for the local-first button actions.
   - Tests `Home` page empty states.
   - Evaluates unit toggling: converting 100kg to 220.5lbs dynamically.
   - Launches a freestyle session, validating DOM elements ("In session", "Add exercise").

### Major Testing Gaps
- **Zero Server-Side Testing**: The `server/` directory contains no automated testing configuration. None of the Express endpoints, Passport auth routes, or Prisma query operations are covered by tests.
- **No Concurrent Sync Tests**: Conflict resolution, sync retries, and schema version changes during background sync are completely untested.

---

## 5. Recommended Implementation Strategy

### R1. Elite Dark Glassmorphic UX & Capacitor Mobile Wrappers
- **Tailwind Backdrop Filter**: Apply backdrop-filter properties globally. Define glass containers using:
  ```css
  .glass-card {
    background: rgba(255, 255, 255, 0.03);
    backdrop-filter: blur(12px);
    border: 1px solid rgba(255, 255, 255, 0.08);
  }
  ```
- **Custom Shaders / Glowing Borders**: Create custom CSS glow styles utilizing Tailwind animations:
  ```css
  @keyframes glow-border {
    0% { border-color: rgba(255, 107, 58, 0.2); }
    50% { border-color: rgba(255, 107, 58, 0.5); }
    100% { border-color: rgba(255, 107, 58, 0.2); }
  }
  ```
- **Capacitor Mobile Configuration**: Initialize Capacitor Android integration. Establish safe area variables in CSS using `env(safe-area-inset-bottom)` to prevent overlays from covering device navigation bars. Disable page scroll elastic effects for standalone apps using `overscroll-behavior: none`.

### R2. Offline-First Storage Migration & Bidirectional Sync
- **IndexedDB Transition**: Replace the current `localStorage` cache with a robust database engine (such as Dexie.js). This removes the 5MB size limit and avoids freezing the UI thread when sorting large exercise datasets.
- **Sync Endpoints Expansion**:
  - Implement server routes to synchronize programs (`POST/PUT /api/programs`) and progression rules.
  - Redesign client `sync.js` to process local program operations instead of discarding them.
- **Bidirectional Sync Protocol**:
  - Introduce `updatedAt` timestamps on all models.
  - Implement a two-step sync protocol:
    1. **Pull**: Retrieve database changes made since the client's `lastSyncedAt` timestamp.
    2. **Push**: Send pending client operations queue.
    3. **Conflict Resolution**: If the same workout was edited on two devices, apply a last-write-wins (LWW) resolution based on the `updatedAt` timestamp.

### R3. Analytics, Autoregulation, and AI Grounding
- **Interactive Recharts**: Incorporate hover crosshairs and active tooltip states inside `Progress.jsx` to render precise weight and rep data.
- **Mid-Session Edits**: Extend the custom `useActiveSession` hook to support reordering lists and modifying targets mid-workout.
- **AI Coach Persistence**: Save AI Trainer conversations to the backend database. Currently, chat history is lost whenever the server restarts because it is stored in an in-memory Map:
  ```typescript
  const trainers: Map<string, AITrainer> = new Map();
  ```
  Persisting trainer conversation states to the database will prevent this data loss.

---

## 6. Proposed Project Milestones

```
+-----------------------------------------------------------------------------------+
| MILESTONE 1: Visual Glassmorphic Revamp & Capacitor Platform Setup                 |
| - Apply glass-morphism style definitions across all 8 core screens.               |
| - Configure page-to-page router transitions and animation timings (<300ms).        |
| - Initialize Capacitor Android build integration.                                 |
+-----------------------------------------------------------------------------------+
                                         |
                                         v
+-----------------------------------------------------------------------------------+
| MILESTONE 2: Local Storage Upgrade to IndexedDB                                   |
| - Migrate client from LocalStorage to IndexedDB (Dexie.js).                       |
| - Write data migration routines from local-store v2 to the new DB system.          |
| - Adapt DataProvider queries and update existing unit tests.                      |
+-----------------------------------------------------------------------------------+
                                         |
                                         v
+-----------------------------------------------------------------------------------+
| MILESTONE 3: Complete Bidirectional Sync & Programs API                           |
| - Build backend sync controllers and Prisma CRUD paths for Programs & Rules.       |
| - Update client sync worker to pull server updates and push program changes.      |
| - Implement last-write-wins conflict resolution on sync.                          |
+-----------------------------------------------------------------------------------+
                                         |
                                         v
+-----------------------------------------------------------------------------------+
| MILESTONE 4: Enhanced Mid-Session Customizations & Progression Engine             |
| - Add drag-and-drop exercise reordering inside the active workout screen.         |
| - Implement inline exercise swapping and targets adjustment during sessions.      |
| - Write unit tests for progression rules under edge conditions.                   |
+-----------------------------------------------------------------------------------+
                                         |
                                         v
+-----------------------------------------------------------------------------------+
| MILESTONE 5: Grounded AI Coach Chat & DB Persistence                              |
| - Create database schema for AI chat conversations and message history.            |
| - Persist backend AITrainer state to DB to survive server restarts.               |
| - Refine grounding prompts with user metrics (volume, PRs, fatigue levels).       |
+-----------------------------------------------------------------------------------+
                                         |
                                         v
+-----------------------------------------------------------------------------------+
| MILESTONE 6: Deployment & Verification                                            |
| - Write backend integration tests for API endpoints.                              |
| - Verify native builds on simulated devices.                                      |
| - Run test checks on Vite compiling, PWA assets, and Capacitor syncs.             |
+-----------------------------------------------------------------------------------+
```

---

## Conclusion
The Liftit project is built on a solid offline-first foundation. Moving the storage layer to a robust IndexedDB, syncing programs and settings, and persisting the AI Trainer state to the database will ensure the application is ready to scale. These changes, paired with the glassmorphic design revamp and Capacitor native adjustments, will prepare Liftit for a polished cross-platform release.
