# Plan — Premium Revamp of Liftit

This plan outlines the steps for executing the premium revamp of the Liftit local-first fitness application.

## Step 1: Initial Discovery & Codebase Analysis (Explorer)

- Analyze the client code structure (`src/`) and technologies used (framework, router, state management, design system).
- Analyze the backend code structure (`server/`), Prisma schema, and database integration.
- Identify how offline data storage, sync endpoints, and analytics are currently implemented or structured.
- Recommend architectural design for the glassmorphic UI, Prisma schema extensions, sync reconciliation strategy, and double-progression logic.

## Step 2: Formulate Project milestones and Interface Contracts
- Establish `PROJECT.md` at the project root.
- Define explicit interface contracts between the client and server (especially sync protocols).
- Group work items into 3-7 distinct milestones.

## Step 3: Dual Track Execution
### Track A: E2E Testing Track (Opaque-box, requirement-driven)
- Set up E2E testing infrastructure.
- Develop test cases across 4 tiers:
  - Tier 1: Feature Coverage (Home, Workout, History, Program, Progress, Onboarding, Settings, Login).
  - Tier 2: Boundary & Corner Cases.
  - Tier 3: Cross-feature combinations (pairwise).
  - Tier 4: Real-world application scenarios.
- Verify test runner works and publish `TEST_READY.md`.

### Track B: Implementation Track
- Milestone 1: Authentication & Onboarding (Client UI & Backend logic).
- Milestone 2: Dark Glassmorphic UI/UX Revamp (8 primary screens, Space Grotesk display fonts, Space-themed CSS animations, smooth transitions).
- Milestone 3: Local-first Storage & Bidirectional Sync (IndexedDB/Preferences client storage, sync API with conflict resolution, Prisma backend).
- Milestone 4: Analytics & Workout Modeling (Recharts graphs, PR tracking, double-progression recommendations, Deload detector).
- Milestone 5: AI Coach Integration (Tailored advice panel using API key).
- Milestone 6: E2E Test Suite Pass (Iterate on code until 100% of E2E tests pass).
- Milestone 7: white-box Adversarial Hardening (Identify untested code paths and write adversarial tests).

## Step 4: Verification & Audit
- Run all unit and integration tests.
- Execute Forensic Auditor checks to ensure genuine implementations (no hardcoding, no dummy facades).
- Submit final verification reports to the parent agent.
