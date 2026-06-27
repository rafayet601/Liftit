# Handoff Report: E2E UI Investigation of Liftit

## 1. Observation
From the investigation of the Liftit client-side codebase, the following exact paths, styling structures, and selectors were observed:

### Routing and Layout Guard
In `/src/App.jsx`, routing and onboarding checks are defined as follows:
- **Routes list (lines 203–218):**
  ```jsx
  return (
      <Routes>
          <Route path="/onboarding" element={<Onboarding />} />
          <Route path="/login" element={<Login />} />
          <Route path="/auth/callback" element={<AuthCallback />} />
          <Route path="/" element={page(Home)} />
          <Route path="/workout" element={page(Workout)} />
          <Route path="/history" element={page(History)} />
          <Route path="/history/:id" element={page(History)} />
          <Route path="/program" element={page(Program)} />
          <Route path="/progress" element={page(Progress)} />
          <Route path="/settings" element={page(SettingsPage)} />
          <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
  );
  ```
- **Onboarding Gate (lines 171–173):**
  ```jsx
  if (!settings.onboarded) {
      return <Navigate to="/onboarding" replace state={{ from: location.pathname }} />;
  }
  ```

### Design System and Typography (Space Grotesk & Inter)
In `/src/index.css`, fonts and base styles are imported and applied:
- **Font loading (lines 2–3):**
  ```css
  @import url('https://rsms.me/inter/inter.css');
  @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&display=swap');
  ```
- **Space Grotesk Headings application (lines 112–118):**
  ```css
  h1,
  h2,
  h3,
  .font-display {
      font-family: 'Space Grotesk', 'Inter', -apple-system, sans-serif;
      letter-spacing: -0.02em;
  }
  ```

### Dark Glassmorphic Design Variables and Classes
In `/src/index.css`, colors and surface properties are configured as:
- **Semantic Variables (lines 21–36):**
  ```css
  /* Surfaces */
  --bg: #0b0b0c;
  --surface: #131316;
  --surface-2: #1b1b1f;
  --surface-3: #232328;
  ...
  /* Hairlines */
  --border: rgba(255, 255, 255, 0.07);
  --border-strong: rgba(255, 255, 255, 0.12);
  ```
- **Reflective Box Shadow (lines 55–57):**
  ```css
  --shadow-card:
      0 1px 0 rgba(255, 255, 255, 0.03) inset,
      0 12px 28px -18px rgba(0, 0, 0, 0.55);
  ```
- **Surface Styles (lines 190–200):**
  ```css
  .surface {
      @apply relative rounded-2xl border border-white/[0.07] bg-ink-900;
      box-shadow: var(--shadow-card);
  }
  .surface-strong {
      @apply relative rounded-2xl border border-white/[0.12] bg-ink-800;
      box-shadow: var(--shadow-card);
  }
  ```

### Animation and Transition Durations
In `/tailwind.config.js`, custom animations and cubic-bezier curves are defined (lines 107–113):
```javascript
animation: {
    'fade-in': 'fade-in 240ms cubic-bezier(0.2,0.7,0.2,1) both',
    'scale-in': 'scale-in 200ms cubic-bezier(0.2,0.7,0.2,1) both',
    'slide-up': 'slide-up 320ms cubic-bezier(0.2,0.7,0.2,1) both',
    shimmer: 'shimmer 2.2s linear infinite',
    'pulse-glow': 'pulseGlow 2.4s ease-in-out infinite',
},
```
Additionally, card hover states transition with `transition-[border-color,background-color] duration-200` (`/src/index.css` line 199) and buttons use `transition-all duration-150` (`/src/index.css` line 213).

---

## 2. Logic Chain
The observations directly support the following reasoning:
1. **Onboarding Guard Redirection:** Because `/src/App.jsx` blocks all navigation if `settings.onboarded` is false (redirecting to `/onboarding`), any E2E tests targetting other screens must either run through the onboarding steps first or initialize Capacitor Preferences database state (`liftit_data_v2`) with `onboarded: true` to bypass the guard.
2. **Space Grotesk Font Compliance:** Typography rules indicate headings (`h1`, `h2`, `h3`) and components using `.font-display` must render with `Space Grotesk`. E2E tests can verify this by checking computed styles in a browser environment.
3. **Glassmorphic Surface Compliance:** Glassmorphism depends on cards having `.surface`, `.surface-strong`, or `.glass-morphism` classes combined with explicit border opacity (`rgba(255,255,255,0.07)`) and inset shadows (`--shadow-card`). Programmatic tests can evaluate class structures and computed border/box-shadow variables.
4. **Transition Duration Discrepancy:** The target styling constraint mandates that transitions and animations must be `< 300ms`. In `tailwind.config.js`, the `fade-in` (240ms) and `scale-in` (200ms) animations conform to this budget. However, **`slide-up` (320ms)** exceeds the 300ms limit. This can be verified via configuration analysis or computed DOM styles.
5. **JSDOM vs. Browser E2E:** While the current test suite uses Vitest with `jsdom`, JSDOM does not parse or evaluate computed styles, CSS variables, gradients, or animations. Therefore, to assert styling constraints and visual structures, a real browser-based E2E framework (like Playwright) is required.

---

## 3. Caveats
- **JSDOM Limitations:** Assertions verifying computed styles (e.g. `window.getComputedStyle(element).fontFamily`) will return fallback strings or default styles in Vitest/JSDOM since JSDOM does not render layouts. Playwright is required for full evaluation.
- **Capacitor Haptics Mocking:** Frontend actions call mobile wrapper functions (`hapticMedium()`, `hapticSuccess()`). These must be mocked in unit and integration environments to prevent exceptions during test execution.

---

## 4. Conclusion

### The 8 Primary Screens: Routing, Rendering, and Structure
1. **Login (`/login`)**: Renders `LoginPage.jsx`. Independent page structure providing OAuth links (Google/GitHub), local-only usage (`btn-primary`), and a quick demo-data loader (`btn-ghost` for sample data).
2. **Onboarding (`/onboarding`)**: Renders `Onboarding.jsx`. Page shell wizard step-by-step manager: name input, weight units toggle (`Kilograms`/`Pounds`), target splits/days picker, and a final "Build my program" spark button.
3. **Home (`/`)**: Renders `Home.jsx` wrapped in `Layout`. Dashboard including streak details, custom greeting header, 4 stats cards (`This week`, `7-day volume`, `All-time`, `Program`), Recharts volume bar chart, recent PR cards, and a quick-action "Start Workout" button.
4. **Workout (`/workout`)**: Renders `Workout.jsx` wrapped in `Layout`. Renders either the `SessionLauncher` (program recommendation, focus targets list, "Start freestyle" button) or `ActiveSession` (elapsed clock, active set-count progress bar, exercise checklists, overlays for discarding or completing workouts).
5. **History (`/history` & `/history/:id`)**: Renders `History.jsx` wrapped in `Layout`. Standard list of historical logs, drilling down into an overlay modal sheet (`SessionDetail`) with detailed weights/reps, exercise trend analysis, and a delete action.
6. **Program (`/program`)**: Renders `Program.jsx` wrapped in `Layout`. Displays active program phase, weeks timeline navigation buttons, day details with target adjusters (swap/add/remove/sets adjustments), or a deterministic setup wizard if no program exists.
7. **Progress (`/progress`)**: Renders `Progress.jsx` wrapped in `Layout`. High-fidelity Recharts AreaChart graphing `Estimated 1RM`, muscle group balance indicators, historical PR listings, and a 12-week consistency heatmap chart.
8. **Settings (`/settings`)**: Renders `Settings.jsx` wrapped in `Layout`. Profile configs (name/experience), unit controls (`kg`/`lbs`), API configuration inputs for AI Coach providers, OAuth Sync, and data management tools (backup JSON exports, backup imports, database erasure options).

### E2E Testing Selector Dictionary
To automate testing across all screens, target the following specific DOM selectors:

| Page / Element | Interactive Action / Selector | Target CSS / Attribute |
|---|---|---|
| **Global Sidebar / Mobile Nav** | Navigation Links | `a[href="/"]`, `a[href="/workout"]`, `a[href="/history"]`, `a[href="/program"]`, `a[href="/progress"]`, `a[href="/settings"]` |
| **Global AI Coach Trigger** | Toggle Coach Side Panel | `button:has-text("Coach")` or `button:has(svg.lucide-message-circle)` |
| **Global Modal Dialogs** | Sheet Overlays | `div[role="dialog"]` |
| **Global Toast System** | Toast Box | `div[role="status"]` inside `div[aria-live="polite"]` |
| **Onboarding Wizard** | Step 0: Name Input | `input[placeholder="Your name"]` or `input[aria-label="Your name"]` |
| **Onboarding Wizard** | Continue Step | `button:has-text("Continue")` |
| **Onboarding Wizard** | Step 1: Units selector | `button[role="radio"]:has-text("Kilograms")` or `button[role="radio"]:has-text("Pounds")` |
| **Onboarding Wizard** | Finish Wizard | `button:has-text("Build my program")` or `button:has-text("Skip — I'll log freestyle")` |
| **Login Page** | Demo Seeds | `button:has-text("Explore with sample data")` |
| **Login Page** | Device-Only Gate | `button:has-text("Use on this device only")` |
| **Workout Launcher** | Freestyle Session | `button:has-text("Start freestyle")` |
| **Workout Launcher** | Program Day Session | `button:has-text("Start")` inside day card |
| **Active Session** | Add/Remove Exercise | `button:has-text("Add exercise")` |
| **Active Session** | Set Row input fields | `input[aria-label="reps"]`, `input[aria-label^="weight in "]` |
| **Active Session** | Complete Set Checkbox | `button[aria-label^="Complete set "]` |
| **Active Session** | RPE Pickers | `button:has-text("6")`, `button:has-text("7")`, `button:has-text("8")`, `button:has-text("9")`, `button:has-text("10")` |
| **Active Session** | Finish / Discard session | `button:has-text("Finish")`, `button:has-text("Discard")` |
| **Settings Page** | Erase Everything | `button:has-text("Erase everything")` -> click `button.btn-danger` in modal |

### Styling Constraints Compliance Check
1. **Typography Verification:**
   Headings (`h1`, `h2`, `h3`) and display numbers (`.font-display`) must match `'Space Grotesk'`.
   *Programmatic Assertion (Playwright):*
   ```javascript
   const fontFamily = await page.locator('h1').first().evaluate(el => window.getComputedStyle(el).fontFamily);
   expect(fontFamily).toContain('Space Grotesk');
   ```
2. **Glassmorphic Appearance Verification:**
   Verify elements use `.surface` or `.surface-strong` with transparent border colors and shadow values.
   *Programmatic Assertion (Playwright):*
   ```javascript
   const card = page.locator('.surface').first();
   const border = await card.evaluate(el => window.getComputedStyle(el).borderColor);
   expect(border).toBe('rgba(255, 255, 255, 0.07)');
   ```
3. **Transition/Animation Time Constraint Check:**
   Animations must take `< 300ms`. As noted, **`animate-slide-up` takes 320ms**, violating this constraint.
   *Programmatic Assertion (Playwright):*
   ```javascript
   const duration = await page.locator('.animate-slide-up').first().evaluate(el => window.getComputedStyle(el).animationDuration);
   expect(parseFloat(duration)).toBeLessThanOrEqual(0.3); // Fails for 0.32s!
   ```

---

## 5. Verification Method

### Testing the Current Setup
1. Execute the Vitest suite to verify current mounting behavior of the app:
   ```bash
   npm run test
   ```
   This runs local unit tests inside `src/test/smoke.test.jsx`.

### Playwright E2E Setup Simulation
To verify selectors, one can load the app locally and test the locators with the Playwright locator inspector:
```bash
npx playwright codegen http://localhost:5173
```
- Verify you can click through `/onboarding` using `input[aria-label="Your name"]`.
- Verify the freestyle workout triggers `button[aria-label^="Complete set 1"]` when in active session.
- Validate that the active session duration displays inside `span.font-mono.tabular-nums`.
