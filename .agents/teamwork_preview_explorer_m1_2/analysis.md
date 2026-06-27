# Milestone 1: UI/UX Glassmorphic Revamp Analysis & Design Proposal

This report outlines the technical specifications, styling rules, responsive layout design, and screen-by-screen transition plan for **Milestone 1: UI/UX Glassmorphic Revamp** in the Liftit application.

---

## 1. CSS Transition Rules, Animation Specs, & Router Implementation

To achieve a premium, fluid, and highly responsive feel, all transitions are designed to be under **300ms** (optimal target: **200–240ms**). This maintains the "local-first" instantaneous performance feel of Liftit while adding elegant visual feedback.

### A. Core Glassmorphic Tailwind Utility Classes
We define two core styling components in the design system (`src/index.css`):

```css
@layer components {
    /* High-fidelity glassmorphic cards */
    .glass-surface {
        background: rgba(19, 19, 22, 0.45); /* Translucent dark charcoal base */
        backdrop-filter: blur(16px);
        -webkit-backdrop-filter: blur(16px); /* Safari notch & overlay support */
        border: 1px solid rgba(255, 255, 255, 0.08); /* Hairline edge highlight */
        box-shadow: 
            0 1px 0 rgba(255, 255, 255, 0.03) inset, /* Inner shine */
            0 12px 30px -18px rgba(0, 0, 0, 0.65); /* Soft drop shadow */
    }

    /* Stiffer, premium glassmorphism for modal/sheet structures */
    .glass-surface-strong {
        background: rgba(27, 27, 31, 0.75);
        backdrop-filter: blur(24px);
        -webkit-backdrop-filter: blur(24px);
        border: 1px solid rgba(255, 255, 255, 0.12);
        box-shadow: 
            0 1px 0 rgba(255, 255, 255, 0.04) inset,
            0 24px 60px -24px rgba(0, 0, 0, 0.8);
    }

    /* Transition & Hover behavior for interactive glassmorphic cards */
    .glass-surface-hover {
        transition: 
            background-color 200ms cubic-bezier(0.4, 0, 0.2, 1),
            border-color 200ms cubic-bezier(0.4, 0, 0.2, 1),
            box-shadow 200ms cubic-bezier(0.4, 0, 0.2, 1),
            transform 200ms cubic-bezier(0.34, 1.56, 0.64, 1); /* Quick spring */
    }
    .glass-surface-hover:hover {
        background: rgba(19, 19, 22, 0.6);
        border-color: rgba(255, 255, 255, 0.16);
        box-shadow: 
            0 1px 0 rgba(255, 255, 255, 0.05) inset,
            0 16px 40px -12px rgba(0, 0, 0, 0.85),
            0 0 24px -10px rgba(255, 107, 58, 0.15); /* Soft brand glow */
        transform: translateY(-2px);
    }
}
```

### B. Micro-Animations & Timing Specifications

| Animation Target | CSS/Tailwind Classes | Duration | Easing (Cubic-Bezier) | Description |
| :--- | :--- | :--- | :--- | :--- |
| **Page Route Transition** | `::view-transition-old/new` | 220ms | `cubic-bezier(0.2, 0.8, 0.2, 1)` | Staggered cross-fade and scale for screen swaps. |
| **Button Active States** | `active:scale-[0.96]` | 100ms | `cubic-bezier(0.25, 1, 0.5, 1)` | Instant tactile click shrinking effect. |
| **Checkbox Completion** | `@keyframes check-pop` | 180ms | `cubic-bezier(0.34, 1.56, 0.64, 1)` | Overshooting spring bounce when checkmark pops. |
| **Accordion Expand** | `transition-all` | 240ms | `cubic-bezier(0.4, 0, 0.2, 1)` | Snappy height slide for exercise detail expansion. |
| **Rest Timer Ring** | `transition-[stroke-dashoffset]`| 1000ms| `linear` | Standard uniform tick decrement. |
| **Pill Selector Swap** | `transition-colors` | 150ms | `cubic-bezier(0.25, 0.1, 0.25, 1)` | Fast active state shifts on toggles. |

### C. React Router View Transitions API Integration

To enable hardware-accelerated transitions when changing routes, React Router's built-in View Transitions API is recommended. In `src/App.jsx` (and navigation links), navigation triggers are updated to support view transitions:

```jsx
// 1. In standard Link elements (e.g. MobileNav.jsx or Sidebar.jsx)
<Link key={item.path} to={item.path} unstable_viewTransition onClick={() => hapticSelection()}>
    {/* ... */}
</Link>

// 2. Programmatic view transitions in navigation triggers (e.g. going back to app)
const handleNavigate = (path) => {
    if (document.startViewTransition) {
        document.startViewTransition(() => navigate(path));
    } else {
        navigate(path);
    }
};
```

Global view transition styling rules to inject into `src/index.css`:
```css
/* Route transitions via native browser View Transitions */
::view-transition-old(root) {
    animation: page-exit 200ms cubic-bezier(0.2, 0.8, 0.2, 1) both;
}
::view-transition-new(root) {
    animation: page-enter 220ms cubic-bezier(0.2, 0.8, 0.2, 1) both;
}

@keyframes page-exit {
    from { opacity: 1; transform: scale(1) translateY(0); }
    to { opacity: 0; transform: scale(0.98) translateY(-4px); }
}
@keyframes page-enter {
    from { opacity: 0; transform: scale(1.02) translateY(6px); }
    to { opacity: 1; transform: scale(1) translateY(0); }
}
```

---

## 2. Responsive Breakpoints, Layout Wrappers, & Viewport Settings

To ensure the layout remains pixel-perfect across mobile phones, tablets (portrait/landscape), and desktop displays, a responsive positioning strategy is enforced.

### A. Global Layout Architecture & Breakpoints
Liftit relies on a single layout wrapper (`Layout` in `App.jsx`) which shifts layouts at the **`md` (768px)** boundary:

```
[Viewport < 768px (Mobile)]
+-----------------------------------+
|               Main                |
|              Content              |
|        (Full-width, padded)       |
+-----------------------------------+
|     MobileNav (Bottom Tab Bar)    |
+-----------------------------------+

[Viewport >= 768px (Tablet & Desktop)]
+-----------+-----------------------+
|  Sidebar  |         Main          |
|  (Fixed   |        Content        |
|   width   |   (Offset by ml-64,   |
|   64rem)  |    max-width-5xl)     |
+-----------+-----------------------+
```

1. **Desktop/Tablet Landscape (`lg` 1024px, `xl` 1280px)**:
   - Left vertical sidebar is fixed (`w-64 h-screen`).
   - Main content is centered with `mx-auto max-w-5xl px-8 py-10`.
   - Grid configurations transition to 3 or 4 columns (e.g. home dashboard tiles, program selectors).
2. **Tablet Portrait (`md` 768px to 1023px)**:
   - Sidebar remains visible, but content grids collapse to 2 columns to prevent text truncation.
   - Text sizes scale slightly downward to accommodate narrow tablet sidebars.
3. **Mobile (`sm` < 768px)**:
   - Vertical sidebar is hidden (`hidden md:flex`).
   - Bottom tab navigation `MobileNav` appears (`md:hidden fixed bottom-0`).
   - Content area stretches to `w-full` with custom safe-area offsets (`pb-safe`, `pt-safe`).

### B. Viewport & Capacitor iOS Settings
For native-app wrapper installations (Capacitor/iOS), specific web-safe viewport rules prevent layout shifting and keyboard zooming issues.

1. **Zoom Prevention**:
   On iOS, if an input text size is smaller than `16px` or scaling is allowed, the browser automatically zooms the viewport when focus enters a set input. This breaks the grid.
   - **Resolution**: Force a standard meta tag in `index.html`:
     ```html
     <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover" />
     ```
     Additionally, all text inputs in active gym set steppers are styled to be at least `16px` font size (e.g., `.set-input` class is modified to `text-base md:text-lg`).

2. **Notch & Safe Areas**:
   - Dynamic viewports: `min-h-dvh` is used on the layout wrapper to ensure the bottom tab bar floats exactly above native device controls regardless of hidden URL bars.
   - Padding utilities: `pt-safe` and `pb-safe` are mapped directly to `env(safe-area-inset-top)` and `env(safe-area-inset-bottom)` to shield layout content from native notches, status bars, and home indicators.

---

## 3. Screen-by-Screen Transition & UX Adjustments

Here is the step-by-step design revamp breakdown for each of Liftit's 8 core screens.

### 1. Onboarding Screen (`src/pages/Onboarding.jsx`)
* **Visual Revamp**:
  - Convert step containers into translucent glass panels (`glass-surface`).
  - Active text input fields styled with soft focus glow colors (`focus:border-accent/50 focus:ring-accent/10`).
  - Brand progress indicators at the top transition width dynamically.
* **Transitions & Micro-animations**:
  - Standard step increments slide horizontally (`slide-left` or `slide-right`) using a React `key={step}` element trigger combined with an entry/exit animation (250ms).
  - Pressing segment options triggers a spring scale shift (`scale-95 -> scale-100`).
* **Responsive Layout**:
  - Centered box alignment (`max-w-md`) with bottom-aligned navigation buttons that shift to side-by-side positioning on desktop/tablet.

### 2. Login Screen (`src/pages/Login.jsx`)
* **Visual Revamp**:
  - The login card is wrapped in a glassy, frosted overlay (`glass-surface-strong`).
  - Amplify the ambient background glow by scaling up the radial ember element behind the card container (`scale-125 opacity-15`).
* **Transitions & Micro-animations**:
  - Google and GitHub auth buttons shift background-colors on hover with a smooth transition (`duration-200`).
  - Back-to-app arrow slides left slightly on hover (`hover:translate-x-[-2px] transition-transform`).
* **Responsive Layout**:
  - Centered flexbox layouts. Compact margins ensure the card does not touch device borders on smaller screens like iPhone SE.

### 3. Home Screen (`src/pages/Home.jsx`)
* **Visual Revamp**:
  - Refactor the 4 primary dashboard metrics (This week, 7-day volume, All-time, Program) into standard `glass-surface` cards.
  - The training streak flame card gets a soft radial glow (`shadow-glow-sm`) with a low-frequency breathing pulse animation.
* **Transitions & Micro-animations**:
  - Hovering over individual dashboard cards applies `glass-surface-hover` scaling and border highlight modifications.
  - The Weekly Volume Bar Chart renders bars with a progressive ease-out fill animation (duration: 350ms).
* **Responsive Layout**:
  - Layout transitions dynamically from a stacked list on mobile, to a 2x2 grid on portrait tablet, to a 4-column row on desktop views.

### 4. Workout Screen (`src/pages/Workout.jsx`)
* **Visual Revamp**:
  - Workout day selectors and launcher cards revamped to `glass-surface`.
  - Active session exercise accordion cards feature full glass backdrops.
  - Completed exercise cards render a glowing green border (`border-emerald-500/30 bg-emerald-500/5`).
  - Rest timer overlay uses a deep frosted glass cover (`backdrop-blur-xl bg-ink-950/60`).
* **Transitions & Micro-animations**:
  - Ticking the completed set checkbox triggers a fast scale spring pop (`scale-115` to `scale-100` in 180ms) and animates the active workout progress bar width smoothly.
  - Expand/collapse details on exercise cards transition height smoothly (`max-h-0` to `max-h-screen` in 240ms).
* **Responsive Layout**:
  - Active stepper buttons (`+` and `-` increments) are styled with at least 44x44px target fields for easy one-handed touch in the gym.
  - Text columns align tabularly on smaller screens.

### 5. History Screen (`src/pages/History.jsx`)
* **Visual Revamp**:
  - Workout log row list items use `glass-surface` and `glass-surface-hover` styles.
  - Detail summary sheets (active via React Router route params) styled with ultra-frosted background styles (`glass-surface-strong`).
* **Transitions & Micro-animations**:
  - Tapping a history item triggers a slide-up transition of the bottom detail sheet on mobile (250ms), and a scale-in zoom on desktop (200ms).
  - PR trophies hover with a subtle rotation wobble.
* **Responsive Layout**:
  - The details sheet behaves as a slide-up bottom sheet on mobile devices, wrapping to a centered layout card dialog (`max-w-xl`, `rounded-2xl`) on tablet and desktop viewports.

### 6. Program Screen (`src/pages/Program.jsx`)
* **Visual Revamp**:
  - Active week progression bar and program blocks utilize `glass-surface` panels.
  - Target exercise lists style their boundaries with hairline rules (`border-white/[0.04]`).
  - Wizard goal selectors use glass panel segment containers.
* **Transitions & Micro-animations**:
  - Selecting weeks (e.g. W1 to W2) triggers a snappy content cross-fade transition (<200ms) to update specific target weights and reps.
  - Wizard panels enter using standard fade-scale transitions.
* **Responsive Layout**:
  - The horizontal week navigation pills use a swipable tag row layout (`overflow-x-auto no-scrollbar`) on mobile viewports and wrap to a multi-row grid structure on wider screens.

### 7. Progress Screen (`src/pages/Progress.jsx`)
* **Visual Revamp**:
  - Horizontal selection pills for tracked exercises are converted to glassy rounded tag components.
  - Recharts Area Chart container utilizes glass styling.
  - Muscle balance bar meters use a clean track backdrop with glowing ember fills.
* **Transitions & Micro-animations**:
  - Switching between different tracked lifts triggers a morph transition on the area chart path (300ms).
  - Hovering over chart datapoints triggers Recharts interactive tooltip fade-ins.
* **Responsive Layout**:
  - Horizontal exercise lists are touch-swipable. Charts scale down gracefully inside `ResponsiveContainer` on small displays, keeping margins tight to maximize active data density.

### 8. Settings Screen (`src/pages/Settings.jsx`)
* **Visual Revamp**:
  - Section categories (Profile, Units, AI configuration, Sync management, Data backup) grouped in separated `glass-surface` layouts.
  - Import/Export action buttons utilize standard glass borders.
* **Transitions & Micro-animations**:
  - Segmented control options (e.g. kg/lbs toggle) feature a sliding backdrop indicator transition (<150ms).
  - Tap states on danger options (Wipe data) trigger a pulsing red outline border state.
* **Responsive Layout**:
  - Text input fields and control rows stretch to full-width constraints on phone viewports but clamp to a compact side-by-side orientation (`max-w-md`) on desktop browsers.
