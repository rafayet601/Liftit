# Handoff Report: E2E Analytics & AI Coach Investigation

This report compiles the structural details and behavioral mechanics of Liftit's progression engine, active workout session logging, AI Coach services, and client-side Recharts graph rendering, followed by a proposed end-to-end (E2E) testing strategy.

---

## 1. Observation

### A. Double-Progression Engine & Deload Detector
*   **Location**: `src/engine/progression.js`
*   **Mechanics**:
    *   **Increment Definition** (lines 12–15): Compound movements increment by 2.5 kg (or 2.268 kg / 5 lbs); isolation movements increment by 1.25 kg.
    *   **Round to Increment** (lines 17–23): Rounds weights to the nearest 1.25 kg for metric units, or nearest 2.5 lbs for imperial units.
    *   **Stall / Deload Detection** (lines 58–73):
        ```js
        const stalled =
            history.length >= 3 &&
            history.slice(0, 3).every((s) => {
                const sum = summarize(s.sets);
                return sum && Math.abs(sum.topWeight - last.topWeight) < 0.01 && sum.minReps < repsMax;
            });
        if (stalled) {
            const weight = roundToIncrement(last.topWeight * 0.9, units);
            return {
                action: 'deload',
                weight,
                repsMin,
                repsMax,
                reason: `Three sessions stuck at ${fmt(last.topWeight, units)} — back off ~10% and build back up.`,
            };
        }
        ```
    *   **Progression Overload** (lines 75–87): If all sets achieve $\ge$ `repsMax` and average RPE was in budget ($\le$ `targetRpe + 0.5`), it suggests a load increase.
    *   **Overreaching / Reduction** (lines 90–99): If average RPE is $> 9.25$, it suggests a small reduction in weight.
*   **Exact Entry Points**:
    *   UI Integration: `src/pages/Workout.jsx` during program load launcher `begin(day)` (lines 68–72), and within each card block `ExerciseCard` (lines 490–498).
    *   AI Server Integration: `src/ai/coach.js` (lines 56–58).

### B. Workout Modeling & Editing Features
*   **Session State**: Managed via the custom hook `src/hooks/useActiveSession.js`. Drafts are stored in `localStorage` under `liftit_active_session_v1` (line 17) to survive page reloads.
*   **Active Editing**:
    *   **Add/Swap Exercises**: Triggers `ExercisePicker` in `Workout.jsx`. Adding maps standard targets and queries `suggestNextSession` (lines 270–274). Swapping replaces the exercise key in-place (lines 279–283).
    *   **Set Editing & Completion**: Users can dynamically type weight/reps/RPE in `SetRow`. Completing a set triggers `completeSet()` which starts a `RestTimer` (line 253).
    *   **Discarding**: Clears local storage state via `discardSession()` (lines 80–82).
    *   **Finishing & Saving**: Pulls completed sets, executes PR checking via `detectPRs()` in `src/engine/e1rm.js`, and saves to the local database using `db.workouts.save()` (line 337).

### C. AI Coach Endpoints, Integrations & Grounding
*   **Endpoints**: Mounted in `server/src/app.ts` (line 46) under `/api/ai`, defined in `server/src/ai/routes/ai.routes.ts`:
    *   `POST /api/ai/chat` (Chat interaction)
    *   `POST /api/ai/generate-program` (Interactive mesocycle builder)
    *   `POST /api/ai/adjust-program` (Bi-weekly RPE-based microcycle scale)
    *   `GET /api/ai/progression/:exerciseId` (Autoregulation queries)
    *   `POST /api/ai/analyze` (Workout trends diagnostic)
    *   `POST /api/ai/clear-history` & `GET /api/ai/context`
*   **LLM Service Integrations**:
    *   Defined in `server/src/ai/services/claude.service.ts` and `groq.service.ts`.
    *   `groq-sdk` models default to `llama-3.3-70b-versatile`.
    *   `@anthropic-ai/sdk` models default to `claude-sonnet-4-20250514`.
    *   Provider fallback: If `groq` fails, it automatically falls back to `claude` (lines 55-58 of `claude.service.ts`).
*   **Prompts Grounding & Bypass Filters**:
    *   Located in `server/src/ai/services/chat.service.ts` (lines 39–66).
    *   **Bypass Rule**: Specialized queries matching keyword triggers bypass LLM generation entirely, resolving directly using local database state pulled via the `mcpService` layer:
        *   *Form & technique advice*: Matches 'form', 'technique', 'how to'. Resolves from a local static dictionary.
        *   *Motivation requests*: Matches 'motivate', 'tired'. Pulls 14-day user history, computes consistency rates, and appends a motivational quote.
        *   *Progress questions*: Matches 'progress', 'improve'. Pulls 30-day totals (total workouts, logged sets) and gives fitness-level-specific advice.
        *   *Active program questions*: Pulls and displays structural details of the user's active program.
    *   **General Grounding**: General questions compose the user's details (goals, experience, units, injuries, equipment) into a system prompt using `generateSystemPrompt(config)` in `system-prompt.ts` along with the `formCueLibrary` and `exerciseDatabaseContext`. In addition, MCP tools are registered to allow the model to query database state.

### D. Recharts Graphs & Hover Tooltips
*   **Components & Templates**: Defined in `src/components/charts/VolumeChart.jsx` and instantiated on the `Progress` page (`src/pages/Progress.jsx`).
*   **Graphs**:
    *   `VolumeProgressionChart` (`AreaChart` with gradient fill)
    *   `WeeklyVolumeBarChart` (`BarChart` contrasting actual vs target sets)
    *   `StrengthTrendChart` (`LineChart` tracking Squat, Bench, and Deadlift over time)
    *   `MuscleBalanceRadar` (`RadarChart` evaluating set distribution per muscle)
    *   `e1RM Trend AreaChart` on the `Progress` page (renders estimated 1RM calculations over time)
*   **Custom Tooltips**: Configured to display a custom React panel displaying the series name, value, and measurement unit.
    *   Uses a `<Tooltip content={<CustomTooltip unit={unit} />} />` which fetches the user's dynamic unit (`kg` or `lbs`) from `UnitContext` to render formatted labels (e.g., `100 kg` or `220 lbs`).

---

## 2. Logic Chain

1.  **Stall Detection Deload Logic**:
    *   *Observation*: `history.slice(0, 3).every(s => Math.abs(sum.topWeight - last.topWeight) < 0.01 && sum.minReps < repsMax)` in `progression.js`.
    *   *Reasoning*: Because it scans the 3 most recent logged sessions for an exercise, if they are identical in weight but fail to meet the maximum repetitions target, it marks the athlete as stalled. The progression logic immediately returns `action: 'deload'` and decreases the target load by 10%, which prevents overreaching and promotes recovery.
2.  **AI Coach Local Grounding & Bypass**:
    *   *Observation*: `isFormQuestion()`, `isMotivationRequest()`, `isProgressQuestion()`, and `isProgramQuestion()` inside `chat.service.ts` redirect execution to helper methods like `handleMotivationRequest()` rather than calling `claudeService.chat()`.
    *   *Reasoning*: To optimize API token usage and ensure factual responses, the system intercepts queries that have structured local answers. Only generalized questions are routed to the LLM (Groq/Anthropic), where they are grounded by injectively pasting the user's profile info directly into the LLM system prompt.
3.  **Recharts Programmatic Verification Challenges**:
    *   *Observation*: `src/test/setup.js` mocks `ResizeObserver` (lines 23-28).
    *   *Reasoning*: When rendering SVGs or ResponsiveContainers in JSDOM, element dimensions evaluate to 0 because JSDOM lacks a layout engine. Hover states and layout measurements are stubbed out. Testing libraries cannot perform real hover movements or inspect real layout bounding boxes. Thus, validating tooltip interactions requires either a mocking strategy (injecting state props) or a real browser environment via an E2E tool (Playwright).

---

## 3. Caveats

*   **Database Mock/Real Sync**: The investigation assumes the local sync queue successfully pushes edits back to the Express server `/api/sync` endpoint, and that database seeds are populated. E2E tests will need either a seeded test database or direct endpoint stubbing.
*   **Mobile Simulator**: Capacitor native mobile features (such as haptic feedback via `@capacitor/haptics`) are ignored in normal browser environments and must be mocked or disabled during test runs.

---

## 4. Conclusion

*   The double-progression, deload stall logic, and workout modeling work entirely offline using local calculations and are fully unit-tested inside `src/test/engine.test.js`.
*   The AI Coach is a hybrid helper that uses local rule-based filters to bypass LLM execution for high-frequency queries (Motivation, Form cues, Progress stats), routing only general inquiries to Claude or Groq under fallback configuration.
*   Recharts tooltips are rendered dynamically using SVG overlays and React components. Programmatic verification requires simulating actual mouse hover actions or directly rendering tooltips with predefined `active` state flags.

---

## 5. Verification & E2E Testing Strategy

To verify these features programmatically, we propose a Playwright-based E2E testing framework. Playwright is chosen as it runs in actual browser environments (enabling mouse movement hover events on SVG elements) and supports network API mocking.

### Proposed Playwright Test Suite (`tests/e2e/analytics-ai.spec.js`)

```javascript
import { test, expect } from '@playwright/test';

test.describe('Liftit E2E - Progression, AI Coach, and Charts', () => {
    
    test.beforeEach(async ({ page }) => {
        // 1. Clear storage and navigate to app
        await page.goto('/');
        await page.evaluate(() => localStorage.clear());
        
        // 2. Seed default local database settings
        await page.evaluate(() => {
            window.db.settings.update({ onboarded: true, name: 'Alex', units: 'kg' });
        });
    });

    test('Flow 1: Double-Progression Stall Detection and Deload', async ({ page }) => {
        // Seed 3 consecutive sessions stuck at 100kg for 8 reps (when target max is 10)
        await page.evaluate(() => {
            const exerciseId = 'barbell-back-squat';
            const logWorkout = (date) => window.db.workouts.save({
                id: 'wo_' + Date.now() + Math.random(),
                name: 'Leg Day',
                startedAt: date,
                completedAt: date,
                durationSec: 1800,
                sets: [
                    { exerciseId, setNumber: 1, weight: 100, reps: 8, rpe: 8, completedAt: date }
                ]
            });
            logWorkout('2026-06-20T18:00:00Z');
            logWorkout('2026-06-22T18:00:00Z');
            logWorkout('2026-06-24T18:00:00Z');
        });

        // Navigate to Workout launcher
        await page.goto('/workout');
        
        // Assert that the engine recommends a Deload (10% drop, i.e., 90kg)
        const teaser = page.locator('.card'); // targeted card wrapper
        await expect(teaser).toContainText('Barbell Back Squat');
        await expect(teaser).toContainText('90 kg');
        await expect(teaser).toContainText('Three sessions stuck');
    });

    test('Flow 2: Active Workout Session Custom Modifications', async ({ page }) => {
        await page.goto('/workout');
        
        // Start a blank freestyle session
        await page.click('button:has-text("Empty workout")');
        await expect(page.locator('text=In session')).toBeVisible();

        // Add Exercise
        await page.click('button:has-text("Add exercise")');
        await page.click('text=Barbell Bench Press');
        
        // Verify set rows are rendered
        await expect(page.locator('text=Barbell Bench Press')).toBeVisible();
        await expect(page.locator('input[type="number"]').first()).toBeVisible();

        // Add a set
        await page.click('button:has-text("Add set")');
        // Assert row length is incremented
        const setRows = page.locator('.set-row');
        await expect(setRows).toHaveCount(4); // Default 3 + 1 added
    });

    test('Flow 3: AI Coach Local Grounding & Bypass Filters', async ({ page }) => {
        // Intercept AI API endpoints
        await page.route('**/api/ai/chat', async (route) => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({ success: true, response: { message: "Mocked LLM Response", type: "answer" } })
            });
        });

        await page.goto('/coach'); // navigate to chat screen

        // Form Cue Bypass Test
        await page.fill('textarea[placeholder*="Ask"]', 'How do do a barbell back squat?');
        await page.click('button[type="submit"]');
        // Assert that the response displays localized form tips (and bypassed LLM request)
        await expect(page.locator('.chat-bubble')).toContainText('drive knees out');

        // Progress Bypass Test
        await page.fill('textarea[placeholder*="Ask"]', 'What is my progress?');
        await page.click('button[type="submit"]');
        await expect(page.locator('.chat-bubble')).toContainText('Your Progress Summary');
    });

    test('Flow 4: Recharts Hover Tooltip Verification', async ({ page }) => {
        // Seed 2 data points for bench press trend
        await page.evaluate(() => {
            const exerciseId = 'barbell-bench-press';
            window.db.workouts.save({
                id: 'w1',
                name: 'Push',
                startedAt: '2026-06-01T12:00:00Z',
                sets: [{ exerciseId, setNumber: 1, weight: 80, reps: 8, rpe: 8 }]
            });
            window.db.workouts.save({
                id: 'w2',
                name: 'Push',
                startedAt: '2026-06-08T12:00:00Z',
                sets: [{ exerciseId, setNumber: 1, weight: 85, reps: 8, rpe: 8 }]
            });
        });

        await page.goto('/progress');

        // Select Bench Press in tracked selector
        await page.click('button:has-text("Barbell Bench Press")');

        // Locate AreaChart element
        const areaChart = page.locator('.recharts-responsive-container');
        await expect(areaChart).toBeVisible();

        // Perform mouse hover onto the chart canvas center/dot
        const activeDot = page.locator('.recharts-active-dot');
        if (await activeDot.count() > 0) {
            await activeDot.hover();
        } else {
            // Fallback: Hover over SVG center
            const boundingBox = await areaChart.boundingBox();
            if (boundingBox) {
                await page.mouse.move(boundingBox.x + boundingBox.width * 0.75, boundingBox.y + boundingBox.height / 2);
            }
        }

        // Verify the custom tooltip is visible and contains unit values
        const tooltip = page.locator('.recharts-tooltip-wrapper');
        await expect(tooltip).toBeVisible();
        await expect(tooltip).toContainText('kg');
    });
});
```

### Invalidation Conditions & Test Execution
*   To run current engine tests: `npm run test`
*   To run the proposed E2E test suite, save it to `src/test/e2e/analytics-ai.spec.js` and execute:
    ```bash
    npx playwright test
    ```
*   *Invalidation Conditions*:
    *   Removing the `ResizeObserver` mock setup inside `src/test/setup.js` will cause chart renders in Vitest to crash.
    *   If `@capacitor/preferences` lacks a proper JS-memory fallback wrapper during tests, session persistence tests will fail in Node/Vitest environments.
