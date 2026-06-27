# Liftit Test Infrastructure

This document details the testing strategy, feature inventory, layout structure, and instructions for running the E2E test suite of the Liftit application.

## 1. Test Strategy & Approach
We implement our E2E test suite in the existing Vitest + React Testing Library (JSDOM) environment. JSDOM simulates DOM rendering and browser behaviors, and allows full app-level integration testing by mounting `<AppRoutes />` inside custom React Router memory providers. 
This is opaque-box testing: it interacts only with DOM selectors, inputs, and buttons, simulating actual user behavior.

All network-level sync calls and AI integrations are mocked using Vitest mock objects (`vi.mock` and `vi.spyOn`).

## 2. Directory Layout
- `TEST_INFRA.md` (Project Root): Details test design, features, test case inventory, and runner command (this file).
- `TEST_READY.md` (Project Root): Published when tests pass, showing E2E coverage results.
- `src/test/e2e/e2e.test.jsx`: Contains the 93 test cases organized by Tier.

## 3. Test Cases Inventory

The suite is divided into four tiers of tests:

### Tier 1: Feature Coverage (40 test cases)
#### Feature 1: Authentication & Login
- **T1.1.1**: Renders login page with local-first option "Use on this device only".
- **T1.1.2**: Renders login page with "Explore with sample data".
- **T1.1.3**: Renders login page showing Google and GitHub OAuth options.
- **T1.1.4**: Handles redirect processing on `/auth/callback` when token exists.
- **T1.1.5**: Logout action clears session cookie/state and redirects back to Login page.

#### Feature 2: Onboarding Wizard
- **T1.2.1**: Blocks access to Home `/` and redirects to `/onboarding` if not onboarded.
- **T1.2.2**: Renders Onboarding Step 0: Name Input field and validation.
- **T1.2.3**: Renders Onboarding Step 1: Unit picker (kg vs lbs) and persists selection.
- **T1.2.4**: Renders Onboarding Step 2: Experience level and training goal selectors.
- **T1.2.5**: Completes onboarding successfully and redirects to Home `/`.

#### Feature 3: Home Dashboard
- **T1.3.1**: Displays personalized greeting with user's name from settings.
- **T1.3.2**: Shows empty weekly volume status ("No sets logged yet this week") when clean.
- **T1.3.3**: Renders all four metric summary cards (This week, 7-day volume, All-time, current program).
- **T1.3.4**: Displays recent personal records section when PR logs exist.
- **T1.3.5**: "Start Workout" button on Home navigates user to `/workout`.

#### Feature 4: Workout active session logging & editing
- **T1.4.1**: Renders Workout Launcher screen with freestyle and program list options.
- **T1.4.2**: Initiates a freestyle active session showing elapsed timer and "In session".
- **T1.4.3**: Allows adding a new exercise to the active workout session.
- **T1.4.4**: Supports completing sets via set-row checkboxes (toggling completed status).
- **T1.4.5**: Discarding active session prompts modal, clears active draft from preferences, and returns to launcher.

#### Feature 5: Workout program manager
- **T1.5.1**: Renders Program page empty state with "No program yet" and options to build.
- **T1.5.2**: Launching program wizard allows select split (e.g. 3-day full body) and builds program.
- **T1.5.3**: Displays current program layout: weeks, workout days, and exercises.
- **T1.5.4**: Allows mid-session swapping of exercises on a program day.
- **T1.5.5**: Saves edits to program day details (sets, reps) to local storage.

#### Feature 6: Workout History log
- **T1.6.1**: History screen shows chronological list of completed workouts.
- **T1.6.2**: Clicking a history item opens SessionDetail modal showing set details.
- **T1.6.3**: History log detail displays correct total volume and duration.
- **T1.6.4**: Deleting a logged workout removes it from list and updates settings database.
- **T1.6.5**: Drilling down into exercises shows historical weight trends.

#### Feature 7: Progress analytics charts
- **T1.7.1**: Progress page displays AreaChart for Estimated 1RM.
- **T1.7.2**: Renders Weekly Volume BarChart mapping target sets.
- **T1.7.3**: Renders Radar Chart representing muscle group load balances.
- **T1.7.4**: Shows 12-week consistency heatmap with days squares.
- **T1.7.5**: Displays estimated 1RM calculated value for major lifts.

#### Feature 8: AI Coach panel & integrations
- **T1.8.1**: Toggles AI Coach side-panel visibility from nav or header.
- **T1.8.2**: Motivation request matches bypass rule and returns immediate custom local quote.
- **T1.8.3**: Form advice request matches bypass and displays static technique rules.
- **T1.8.4**: Progress queries return local summary based on 30-day logs.
- **T1.8.5**: Fallback general query forwards query to LLM and renders response.

---

### Tier 2: Boundary & Corner Cases (40 test cases)
#### Feature 1: Authentication & Login
- **T2.1.1**: Google/GitHub OAuth links show warning toast if device is offline.
- **T2.1.2**: Processing `/auth/callback` with invalid/expired token triggers error page.
- **T2.1.3**: Clicking login button repeatedly disables double submissions.
- **T2.1.4**: Entering invalid email patterns displays inline form validation error.
- **T2.1.5**: Offline login fallback operates on cached device session seamlessly.

#### Feature 2: Onboarding Wizard
- **T2.2.1**: Leaving name empty blocks progression to Step 1.
- **T2.2.2**: Name exceeding 50 characters is truncated or displays validation.
- **T2.2.3**: Reloading page mid-onboarding retains progress via local state.
- **T2.2.4**: Bypassing steps via URL manipulation redirects to current step.
- **T2.2.5**: Pressing back button on wizard correctly retains previously selected values.

#### Feature 3: Home Dashboard
- **T2.3.1**: Long user names wrap gracefully without overlapping stats cards.
- **T2.3.2**: Streaks count resets to zero if last logged workout > 7 days ago.
- **T2.3.3**: Zero sets this week shows empty volume bar but renders zero state grid.
- **T2.3.4**: Future dates in seeded workout logs are filtered out of current week metrics.
- **T2.3.5**: Extremely large workout counts (e.g. 9999) format cleanly in All-time card.

#### Feature 4: Workout active session logging & editing
- **T2.4.1**: Entering negative weights or reps inside set-row automatically resets to 0.
- **T2.4.2**: Extremely large weights (e.g., 1000kg) render cleanly without breaking layout.
- **T2.4.3**: App survival: closing page and reloading recovers active session draft.
- **T2.4.4**: Deleting all exercises from active session renders empty workout screen.
- **T2.4.5**: Saving a session with zero duration defaults to 1 minute duration.

#### Feature 5: Workout program manager
- **T2.5.1**: Creating program with 0 days/week is rejected with validation.
- **T2.5.2**: Swapping an exercise with the same exercise is handled as a no-op.
- **T2.5.3**: Custom program names exceeding limits are truncated.
- **T2.5.4**: Modifying a completed program's routine does not affect historical logs.
- **T2.5.5**: Adding more than 20 exercises to a program day handles layout scrolling.

#### Feature 6: Workout History log
- **T2.6.1**: History log with empty sets list renders with "No sets logged".
- **T2.6.2**: Displaying workouts logged exactly on timezone boundaries (midnight) renders correct day.
- **T2.6.3**: Large notes strings (1000+ words) inside history details render in scrollable box.
- **T2.6.4**: Deleting all history logs displays honest zero-state message.
- **T2.6.5**: Attempting to view a non-existent history ID redirects to history index `/history`.

#### Feature 7: Progress analytics charts
- **T2.7.1**: Only one data point in volume history shows dot instead of line chart.
- **T2.7.2**: Swapping weight units (lbs/kg) dynamically updates Recharts data series and tooltips.
- **T2.7.3**: Muscle group balance radar works correctly when some muscle groups have 0 volume.
- **T2.7.4**: Chart tooltips render at correct boundaries without clipping off-screen.
- **T2.7.5**: 1RM calculations return 0 or handle division by zero for reps = 0.

#### Feature 8: AI Coach panel & integrations
- **T2.8.1**: Sending empty chat messages blocks API submission.
- **T2.8.2**: Chat history size exceeding 100 messages scrolls message box.
- **T2.8.3**: LLM timeout or server error renders retry action inside chatbot bubble.
- **T2.8.4**: Form queries with special characters are sanitized before bypass matching.
- **T2.8.5**: Offline status displays connection banner inside coach side-panel.

---

### Tier 3: Cross-Feature Combinations (8 test cases)
- **T3.1**: **Onboarding to Program Setup**: Completing onboarding with 3-day hypertrophy goal automatically seeds and activates corresponding program in Program Manager.
- **T3.2**: **Active Workout to History and Home Update**: Completing active freestyle session adds it to History log and increments weekly set count on Home dashboard.
- **T3.3**: **Double-Progression Stall to Workout Suggestion**: Having 3 consecutive stalled history logs updates the Workout launcher to recommend a Deload weight on the next session.
- **T3.4**: **Settings Unit Toggle to Home, History & Progress**: Toggling weight units from kg to lbs in Settings updates the unit labels across Home cards, History details, and Progress graph tooltips.
- **T3.5**: **AI Coach program generation to active program**: Asking the AI Coach to build a hypertrophy program updates the active program in Program manager.
- **T3.6**: **Active Session Exercise Swap to custom exercise**: Swapping an exercise in active session with a newly created custom exercise in Settings updates session sets.
- **T3.7**: **Sync queue backup and database restore**: Exporting backup data to JSON, erasing everything in Settings, and restoring from backup successfully recovers history logs, settings, and programs.
- **T3.8**: **Background sync of offline edits**: Queuing workout save/delete operations while offline, toggling online, and executing sync correctly drains the queue and syncs to backend API.

---

### Tier 4: Real-World Application Scenarios (5 test cases)
- **T4.1**: **Freestyle Progression Flow**: User logs in -> skips onboarding -> starts freestyle workout -> adds Squat, Bench, and Deadlift -> logs sets with reps/weight -> completes sets -> checks RestTimer -> finishes session -> verifies PR toast -> checks Progress charts for computed 1RMs -> checks History.
- **T4.2**: **Program Execution Flow**: User selects Full Body program -> starts Day 1 -> swaps first exercise due to equipment unavailability -> completes recommended sets -> notes progression target -> logs an extra set -> completes session -> verifies volume increment on Home page.
- **T4.3**: **Interactive AI Coaching and Scaling**: User chats with AI Coach asking for program scaling due to knee fatigue -> coach adjusts program days -> user goes to Program page to verify adjustments -> starts session -> verifies the adjusted target weights.
- **T4.4**: **Full Offline Training Cycle**: User logs workout offline -> logs custom exercise offline -> views progress charts (operating locally) -> opens AI Coach (gets local offline motive/technique bypass response) -> reconnects network -> sync queue drains -> verify MySQL DB contains records.
- **T4.5**: **Platform Storage Migration and Account Link**: Legacy user boots app -> checks `liftit_data_v1` migration to `liftit_data_v2` -> links Google account in Settings -> syncs offline data -> logs out -> logs back in on a fresh simulated browser -> data pulls down from backend database.

## 4. How to Run the Tests
To execute the test suite, run the following command from the project root:
```bash
npm run test
```
This runs Vitest in single-run execution mode. To watch and run tests interactively, run:
```bash
npm run test:watch
```
