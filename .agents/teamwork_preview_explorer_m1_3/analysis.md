# UI/UX Glassmorphic Revamp & Mobile Integration Design Proposal

**Project**: Liftit  
**Author**: teamwork_preview_explorer  
**Milestone**: Milestone 1 (UI/UX Glassmorphic Revamp)  
**Target Output**: Proposal Report  

---

## Executive Summary
This design proposal outlines the structural UI/UX improvements, typography scale, and viewport adjustments required to transform the **Liftit** mobile and web client into an elite, dark glassmorphic strength tracking application. 

Key enhancements focus on making the application robustly offline-ready by hosting typography files locally, securing layouts against native OS safe areas (notches and gesture bars), locking down web view overscroll bounces, and standardizing typography scales and component behaviors across all 8 screens of the application.

---

## 1. Typography & Font Setup

### 1.1 Local Font Loading (Offline-First Polish)
The current implementation imports fonts dynamically from external CDNs (Google Fonts and rsms.me):
```css
@import url('https://rsms.me/inter/inter.css');
@import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&display=swap');
```

When running in native environments (iOS/Android WebViews) wrapped via Capacitor, the application is offline-first. If a user opens the app in a basement gym with zero cellular connection:
1. **CDN Failure**: Font imports fail, causing fallback to browser defaults (e.g. system sans-serif or Times New Roman).
2. **Visual Clutter / CLS**: Layouts break or shift dynamically (Cumulative Layout Shift) once network connection is established and fonts resolve.

**Proposed Solution**: Download `.woff2` files for Space Grotesk and Inter, save them in the `/public/fonts/` directory, and load them locally via `@font-face` rules in `src/index.css`:

```css
/* ============================================================
   LOCAL FONTS — OFFLINE-READY COMPATIBILITY
   ============================================================ */

@font-face {
    font-family: 'Space Grotesk';
    src: url('/fonts/SpaceGrotesk-Regular.woff2') format('woff2');
    font-weight: 400;
    font-style: normal;
    font-display: swap;
}

@font-face {
    font-family: 'Space Grotesk';
    src: url('/fonts/SpaceGrotesk-Medium.woff2') format('woff2');
    font-weight: 500;
    font-style: normal;
    font-display: swap;
}

@font-face {
    font-family: 'Space Grotesk';
    src: url('/fonts/SpaceGrotesk-SemiBold.woff2') format('woff2');
    font-weight: 600;
    font-style: normal;
    font-display: swap;
}

@font-face {
    font-family: 'Space Grotesk';
    src: url('/fonts/SpaceGrotesk-Bold.woff2') format('woff2');
    font-weight: 700;
    font-style: normal;
    font-display: swap;
}

@font-face {
    font-family: 'Inter';
    src: url('/fonts/Inter-Regular.woff2') format('woff2');
    font-weight: 400;
    font-style: normal;
    font-display: swap;
}

@font-face {
    font-family: 'Inter';
    src: url('/fonts/Inter-Medium.woff2') format('woff2');
    font-weight: 500;
    font-style: normal;
    font-display: swap;
}

@font-face {
    font-family: 'Inter';
    src: url('/fonts/Inter-SemiBold.woff2') format('woff2');
    font-weight: 600;
    font-style: normal;
    font-display: swap;
}

@font-face {
    font-family: 'Inter';
    src: url('/fonts/Inter-Bold.woff2') format('woff2');
    font-weight: 700;
    font-style: normal;
    font-display: swap;
}
```

---

### 1.2 Unified Typography Scale
A consistent typography hierarchy is established to contrast Display values (Space Grotesk) and Interface copy (Inter). Space Grotesk is dedicated to headers, displays, and inputs, while Inter handles body text, form labels, and button labels.

| Font Class / Element | Font Family | Size (px / rem) | Weight | Line Height | Tracking | Purpose / Usage |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Display Large (PRs, Stats)** | Space Grotesk | 36px / 2.25rem | Bold (700) | Tight (1.1) | `-0.02em` | Large numbers, streaks, PR metrics, hero metrics (Home, Progress) |
| **Page Title** | Space Grotesk | 28px - 36px / 1.75 - 2.25rem | Bold (700) | Tight (1.15) | `-0.02em` | Primary Page Header titles |
| **Section Title** | Space Grotesk | 20px - 24px / 1.25 - 1.5rem | Bold (700) | Tight (1.2) | `-0.02em` | `h2` headings, card-level sections (Home, Workout) |
| **Card Title / Log Title** | Space Grotesk | 16px - 18px / 1.0 - 1.125rem | Bold (700) | Tight (1.2) | `-0.01em` | Exercise names, sub-components, workout items |
| **Numeric Log Inputs** | Space Grotesk | 20px / 1.25rem | Bold (700) | Normal (1.25) | Normal | Set weight and rep input fields (SetRow) |
| **Eyebrows (Caps Label)** | Inter | 11px / 0.6875rem | Bold (700) | Normal (1.4) | `0.2em` | Group headers, indicators, uppercase badges (ALL CAPS) |
| **Body Primary** | Inter | 15px - 16px / 0.9375 - 1.0rem | Medium (500) | Normal (1.5) | Normal | Main paragraphs, descriptive items, button text labels |
| **Secondary / Subtext** | Inter | 13px - 14px / 0.8125 - 0.875rem | Regular (400) | Normal (1.4) | Normal | Form guidelines, rest timer summaries, card metadata |
| **Micro Labels** | Inter | 10px / 0.625rem | Bold (700) | Normal (1.3) | `0.22em` | Tab bar labels, small badges, inline captions |

---

### 1.3 Tailwind Font Mapping
To map this typography layout system directly to Tailwind classes, update `tailwind.config.js` to ensure proper fallback stacks:
```javascript
fontFamily: {
    sans: [
        'Inter',
        '-apple-system',
        'BlinkMacSystemFont',
        'Segoe UI',
        'Roboto',
        'Helvetica Neue',
        'Arial',
        'sans-serif',
    ],
    display: [
        'Space Grotesk',
        'Inter',
        '-apple-system',
        'BlinkMacSystemFont',
        'sans-serif',
    ],
    mono: ['ui-monospace', 'SFMono-Regular', 'SF Mono', 'Menlo', 'monospace'],
}
```

---

## 2. Capacitor & Mobile Viewport Integrations

### 2.1 Safe Area Constraints
The application viewport is configured in `index.html` with:
```html
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, viewport-fit=cover" />
```
This is correct for rendering inside Capacitor platforms. However, safe area classes must be enforced systematically to handle the camera notch (top) and home swipe indicators (bottom):

1. **Top Insets**:
   - The global layout (`App.jsx` line 178) adds `pt-safe` (`padding-top: calc(env(safe-area-inset-top) + 0.5rem)`).
   - This ensures the main scroll view sits below the status bar overlays on iOS/Android.
2. **Bottom Insets**:
   - The fixed bottom navigation menu (`MobileNav.jsx`) applies `pb-safe` to prevent the tap areas of navigation items from colliding with the native home gesture line.
   - For page views that feature sticky footer action buttons (e.g. "Save Workout" or "Finish Session"), a padding-bottom class must include `pb-safe` to prevent blocking the interactive elements.
3. **Keyboard Handling**:
   - Inside `capacitor.config.json` (lines 22-26), the Keyboard plug-in is configured to `"resize": "native"`.
   - On input focus, this resizes the viewport window. Containers with absolute height (`h-screen` or `h-[100dvh]`) will shrink, which might squeeze vertical layouts.
   - **Recommendation**: Ensure scrollable pages use `min-h-screen` or flexible flexbox wrappers (`flex-1 min-h-0 overflow-y-auto`) so layouts dynamically scroll instead of shrinking and clipping.

---

### 2.2 Viewport Overscroll Behavior
Standard mobile web views allow elastic "rubber-banding" when scrolling past the upper or lower screen bounds. This visual bounce reveals the white background behind the app, instantly exposing it as a website wrapper.

**Recommendation**: Add the following rules in `src/index.css` to restrict the viewport container while permitting internal inertia-scrolling:
```css
/* Disable global viewport elastic rubber-banding on iOS/Android */
html,
body,
#root {
    height: 100%;
    overflow: hidden; /* Lock the viewport */
    overscroll-behavior-y: none;
}

/* Allow momentum scrolling inside page content containers */
main {
    height: 100%;
    overflow-y: auto;
    -webkit-overflow-scrolling: touch; /* Momentum scrolling */
}
```

---

### 2.3 Mobile-First Form Polish
To avoid zooming on iOS Safari / WebViews, any HTML text input elements must default to at least a size of `16px` on focus.
While the CSS contains a media check:
```css
@supports (-webkit-touch-callout: none) {
    input,
    select,
    textarea {
        font-size: 16px;
    }
}
```
Any utility-class overrides (like `text-xs` or `text-sm` applied directly inside React components) will bypass this rule.
- **Guideline**: Do not apply custom text sizing tailwind classes (e.g. `text-xs`, `text-sm`) directly on raw input/textarea markup. Keep size formatting encapsulated in UI wrappers (like `.input` or `.set-input`).

---

## 3. Screen-by-Screen Layout Consistency Audit

Below is a detailed audit of the current 8 primary screens in `src/pages/` and recommendations to unify them under the new glassmorphic spec.

### 3.1 Home Screen (`src/pages/Home.jsx`)
- **Current Setup**: Displays user stats, streaks, weekly volume comparison chart (Recharts), personal records (PRs), and active program logs.
- **Audit Findings**:
  - The Recharts chart is rendered inside a flat card surface. Under the glassmorphic revamp, this card needs consistent styling.
  - The radial glow is applied inline inside the background body.
- **Recommendations**:
  - Apply the glassmorphic styles (`bg-white/[0.03] backdrop-blur-xl border-white/[0.08] shadow-card`) to all `StatTile` containers.
  - Add a faint animated radial ember glow behind the main Streaks card to guide focus to user consistency.

### 3.2 Workout Screen (`src/pages/Workout.jsx`)
- **Current Setup**: Manages workout launch paths and active logging views. Features exercise expandable list cards with embedded `SetRow` weights and reps inputs.
- **Audit Findings**:
  - **Inconvenient Scroll Layout**: The Active Session header containing the duration timer, "Finish" button, and progress indicators is inlined within the main page content. As the user adds exercises and logs sets, the header scrolls off-screen. Users are forced to scroll to the top to press "Finish".
  - **Overlays / Modal clash**: The `RestTimer` overlay sits relative to the window, but doesn't lock parent scroll on some devices.
- **Recommendations**:
  - **Fixed Active Header**: Pin the Active Session header to the top of the viewport (`sticky top-0 z-30 bg-ink-950/85 backdrop-blur-xl border-b border-white/[0.08] pt-safe-top`).
  - **Tabular Numerics**: Ensure weight/rep steppers inside `SetRow` explicitly carry the `tabular-nums` property, ensuring alignment as users tap increments.
  - **Hold-to-Increment**: Hook mouse-down/touch-start events to the stepper buttons (`+` / `-`) to auto-increment values when held, preventing fatigue.

### 3.3 History Screen (`src/pages/History.jsx`)
- **Current Setup**: Chronological lists of completed workouts. Tapping a row summons a `SessionDetail` overlay panel.
- **Audit Findings**:
  - Double modal overlap: If a user clicks an exercise in the `SessionDetail` sheet, it opens an `ExerciseDetail` sheet directly on top of the first. This creates visual clutter on small viewports.
  - Custom inline sparkline SVGs are used for trends instead of a unified layout.
- **Recommendations**:
  - **Overlay Management**: When opening the second sheet (`ExerciseDetail`), transitionally fade-out or slide-under the first sheet, restoring it once the detail sheet is closed.
  - **Design Unification**: Ensure the workout duration, set count, and volume text labels align perfectly in font sizes and colors with the Home stats.

### 3.4 Program Screen (`src/pages/Program.jsx`)
- **Current Setup**: Active periodization logs, timeline track, and generator split wizard.
- **Audit Findings**:
  - The horizontal week-selector timeline container (`W1`, `W2`, `W3`...) has scrollbars visible on some Android WebViews, causing visual layout noise.
- **Recommendations**:
  - Ensure the `.no-scrollbar` utility is applied to the horizontal week slider.
  - Wrap the timeline and progression rules in transparent glassmorphic panels, matching card definitions.

### 3.5 Progress Screen (`src/pages/Progress.jsx`)
- **Current Setup**: Focuses on charting metrics: e1RM charts (Recharts Area), muscle-group sets distribution, and consistency logs.
- **Audit Findings**:
  - AreaChart tooltip popups use hardcoded, dark styling values that clash with the dark glassmorphic design token colors.
  - Selected exercise horizontal selection pills can wrap on narrow widths.
- **Recommendations**:
  - Refactor the Recharts tooltip component to use a styled React custom tooltip wrapper:
    ```javascript
    const GlassTooltip = ({ active, payload }) => {
        if (!active || !payload?.length) return null;
        return (
            <div className="bg-ink-900/90 backdrop-blur-md border border-white/[0.08] p-3 rounded-xl shadow-glow-sm text-xs font-semibold">
                <p className="text-ink-400">{payload[0].payload.label}</p>
                <p className="text-accent mt-1 text-sm">{payload[0].value} {unit}</p>
            </div>
        );
    };
    ```

### 3.6 Onboarding Screen (`src/pages/Onboarding.jsx`)
- **Current Setup**: Four-step form (Name, Weight Units, Goals, Experience) prompting first-time setups.
- **Audit Findings**:
  - The form container uses `safe-top safe-bottom flex min-h-dvh flex-col bg-ink-950 px-5 py-8`.
  - Views transition with a simple react state fade-in, which feels static compared to native onboarding views.
- **Recommendations**:
  - Lock scrolling on this page (`h-screen overflow-hidden`) to center components on mobile screens.
  - Animate steps with sliding CSS transitions (e.g. slide left to slide right) to mimic native mobile navigation transitions.

### 3.7 Settings Screen (`src/pages/Settings.jsx`)
- **Current Setup**: Configurations for name, units, AI providers, and backups.
- **Audit Findings**:
  - Modifying the text input for Profile Name persists on `onBlur` via a direct hook to `db.settings.update`. However, there is zero UI confirmation (e.g., loading spinner or checkmark) confirming the write succeeded.
- **Recommendations**:
  - Introduce an inline auto-save feedback label next to the input header showing a brief "Saving..." to "Saved" status check.
  - Style input boundaries with thin glowing highlights on focus.

### 3.8 Login Screen (`src/pages/Login.jsx` & `src/components/auth/LoginPage.jsx`)
- **Current Setup**: Handles account linking triggers and sample-data paths.
- **Audit Findings**:
  - The screen layout is vertically centered, which is clean, but doesn't verify top safe area clipping on notched devices if back links are added.
- **Recommendations**:
  - Ensure the back button is enclosed in `pt-safe` and positioned with a minimum tap target of `44x44px`.
  - Maintain the glassmorphic styling inside button hover highlights.

---

## 4. UI/UX Glassmorphic Theme Directives

To establish consistency across all page refactors, developers should strictly adhere to the following design system classes in Tailwind:

### 4.1 Card / Content Panels
Use the unified `.glass-card` definition rather than mixing custom transparency percentages:
```css
.glass-card {
    background: rgba(255, 255, 255, 0.02);
    backdrop-filter: blur(16px) saturate(120%);
    -webkit-backdrop-filter: blur(16px) saturate(120%);
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-top: 1px solid rgba(255, 255, 255, 0.1); /* Subtle top highlights */
    border-radius: 16px;
    box-shadow: 0 4px 30px rgba(0, 0, 0, 0.4);
}
```

### 4.2 Interactive Elements
- **Focused Inputs**: Under glassmorphism, inputs should transition borders to the accent color (`--accent: #ff6b3a`) with a mild outer blur:
  ```css
  .glass-input:focus {
      border-color: rgba(255, 107, 58, 0.5);
      background-color: rgba(255, 255, 255, 0.05);
      box-shadow: 0 0 0 4px rgba(255, 107, 58, 0.1);
  }
  ```
- **Active State Scale**: Apply `active:scale-[0.98] transition-transform duration-100` to all primary click targets (buttons, list item buttons) to give tactile feedback.
