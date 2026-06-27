# Original User Request

## 2026-06-27T02:48:26Z

# Teamwork Project Prompt — Draft

A complete premium revamp of the Liftit local-first fitness application to deliver a best-in-class user interface, a robust backend data-syncing architecture, and a seamless cross-platform experience across Web, iOS, and Android.

Working directory: /Users/rivu/Documents/Documents - Mohammad’s MacBook Pro (2)/GitHub/Liftit
Integrity mode: benchmark

## Requirements

### R1. Elite cross-platform Web, iOS, and Android user experience
The application must present a highly polished, responsive dark-themed glassmorphic user interface that works beautifully on desktop/mobile browsers and as native iOS/Android apps wrapper via Capacitor. The UI must feature Space Grotesk display numerals, rich gradients, CSS shaders/custom animation effects, smooth routing transitions, and clean interactive elements.

### R2. Offline-first local database and robust backend synchronization
The client app must maintain fully functional offline support with local database storage (e.g. IndexedDB or Capacitor Preferences). All user logs, workout programs, custom exercises, and session records must sync bidirectionally in the background with the Express-based MySQL backend when network connectivity is available, handling conflict resolution gracefully.

### R3. Interactive analytics, workout modeling, and AI coach integrations
The application must display dynamic charts for volume, consistency, muscle group load balance, and personal record timelines. It must compute double-progression recommendations and AI coach instructions based on logged user history, and provide interactive features to swap, edit, and adjust workouts mid-session.

## Acceptance Criteria

### UI/UX & Styling
- [ ] All 8 primary screens (Home, Workout, History, Program, Progress, Onboarding, Settings, Login) conform to the dark glassmorphic design system using CSS glassmorphism, glowing borders, custom shaders or canvas gradients, and Space Grotesk fonts.
- [ ] Page transitions and interactive element hovers feature smooth CSS micro-animations under 300ms.
- [ ] Layout is fully responsive, looking equally polished on desktop monitors, tablets, and native mobile screens.

### Data Storage & Sync
- [ ] App operates fully offline, initializing and reading/writing workout history to local storage without any server connections.
- [ ] Bidirectional sync endpoint automatically reconciles local offline changes with the Express backend database when online, passing integration tests.
- [ ] The schema is managed by Prisma ORM on the backend.

### Functional & Analytics
- [ ] Recharts-based graphs in Progress and Home page show interactive hover tooltips, smooth rendering animations, and correct PR metrics derived from user logs.
- [ ] The double progression engine suggestions and Deload detector operate correctly under automated test assertions.
- [ ] AI Coach panel displays grounded advice tailored to user's logged workouts when the model provider API key is configured.

### Build and Deployment
- [ ] Client application compiles successfully via Vite (`npm run build`).
- [ ] Capacitor Android platform is configured and syncs (`npx cap sync android`).
- [ ] All existing and new automated unit tests run and pass without errors (`npm run test`).
