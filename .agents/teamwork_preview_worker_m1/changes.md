# Milestone 1: UI/UX Glassmorphic Revamp — Changes Report

This report documents the implementation details of the dark glassmorphic design system and smooth navigation transitions across the Liftit client application.

---

## 1. Global Viewport & Configuration

- **`index.html`**:
  - Viewport meta tag updated to: `<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover" />`
  - Prevents accidental zooming on inputs/selectors, stabilizing layout grids on mobile devices.
- **`tailwind.config.js`**:
  - Extended theme custom box shadows for glass card glowing borders: `glass-glow-ember`, `glass-glow-steel`, `glass-glow-success`, and `glass-glow-danger`.

---

## 2. Global CSS & Design Tokens (`src/index.css`)

- **Rubber-Banding & Overscroll Lock**:
  - Set `overscroll-behavior-y: none` on `html`, `body`, and `#root` to prevent elastic web-view bounce that exposes raw system background, securing a native-like mobile shell.
- **Fixed Ambient Gradients**:
  - Replaced the single header gradient with a fixed background comprising three overlapping radial gradients (ember top-right, steel bottom-left, warm center ambient glow) overlaying a deep carbon base. This ensures backdrops show through card translucency without content clipping during scroll.
- **Glassmorphic Surface Upgrades**:
  - Upgraded `.surface` utility to: `rounded-2xl border border-white/[0.08] bg-ink-950/45 backdrop-blur-xl` + custom inset lighting shadows.
  - Upgraded `.surface-strong` to: `rounded-2xl border border-white/[0.12] bg-ink-900/60 backdrop-blur-2xl` + deeper shadow values for popups and overlay sheets.
  - Upgraded `.surface-hover` to include a transition transition-all duration-200 and custom scale translations (`translate-y-[-1.5px]`).
- **Glass Glow Components**:
  - Added CSS classes for specific element glows: `.glass-card`, `.glass-card-glow` (ember brand accent), `.glass-card-glow-steel`, `.glass-card-glow-success`, and `.glass-card-glow-danger`.
- **View Transitions keyframes**:
  - Defined exit/entry animations using native browser view transitions cubic-bezier timings (under 240ms) to ensure Snappy, fluid route navigation.

---

## 3. Layout Shell & Navigation (`src/App.jsx` & `src/components/layout/MobileNav.jsx`)

- **Main Wrapper**:
  - Changed main container wrapping background color from `bg-ink-950` to `bg-transparent` so body gradient orbs render behind the elements.
- **Snappy View Transitions**:
  - Added React Router 6 `unstable_viewTransition` properties to both Sidebar Links, brand branding target, settings user badge, and mobile tab bar `Link` items, which triggers native view transitions during navigation.

---

## 4. Screen-by-Screen Revamp

1. **Home Screen (`Home.jsx`)**:
   - Styled demo banner configuration wrapper to use steel glass glows.
   - Streak flame tile wraps with brand `glass-card-glow` and ember shadow bounds.
   - Active training program block wraps in high-end steel glassmorphic layouts (`glass-card-glow-steel`).
2. **Workout Screen (`Workout.jsx`)**:
   - Program day launcher cards style dynamically using `glass-card-glow` when recommended ("Up Next").
   - Pinned the active session header controls sticky at the top using `sticky top-0 z-50 bg-ink-950/65 backdrop-blur-xl border-b border-white/[0.08] shadow-[0_4px_30px_rgba(0,0,0,0.4)]` so timer and finish button remain visible.
   - Collapsible exercise active cards apply `glass-card-glow` brand borders on active expand, and completed cards apply green success glows (`glass-card-glow-success`).
3. **History Screen (`History.jsx`)**:
   - Chronological session rows apply premium `.glass-card` and `.glass-card-hover` styles.
4. **Program Screen (`Program.jsx`)**:
   - Program generation wizard card updated to use `glass-card-glow` with ember theme to highlight block parameters.
5. **Progress Screen (`Progress.jsx`)**:
   - Tracked exercise selector horizontal pills use glass borders and soft highlights.
   - Recharts e1RM Area chart tooltip custom styled with translucent backdrop blurs and matching token colors.
   - Heatmap frequency blocks styled with custom drop glows (`shadow-[0_0_8px_rgba(255,107,58,0.3)] bg-accent/90`) on peak training consistency days.
6. **Onboarding Screen (`Onboarding.jsx`)**:
   - Background set to transparent.
   - Nested steps Shell wrapped inside a centered, floating glassmorphic Card container (`glass-card-glow p-6 md:p-8 animate-scale-in`).
7. **Settings Screen (`Settings.jsx`)**:
   - AI Coach model integrations block styled with modern, high-tech `glass-card-glow-steel`.
   - Critical data erasure card styled with cautionary red glow `glass-card-glow-danger`.
8. **Login Screen (`LoginPage.jsx`)**:
   - Back button container safe-area padded (`pt-safe`) with 44x44px mobile touch layout.
   - Google & GitHub OAuth buttons custom rendered with translucent background borders and active scaling springs.
