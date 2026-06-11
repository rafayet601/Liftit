# Liftit v4 — Forge

A local-first lift tracker and program builder (web + iOS via Capacitor). Track your sets, get transparent rule-based progression, and generate periodized programs instantly — with an optional AI Coach powered by **your own choice of model**.

## What's new in v4 (full revamp)

- **Local-first architecture** — one canonical store on-device (`src/data/db.js`); everything works offline. Signing in adds background sync (`src/data/sync.js`); it's never required. Old v3 data migrates automatically.
- **Deterministic training engine** (`src/engine/`) — no black boxes:
  - `e1rm.js` — Epley/Brzycki estimated 1RM + PR detection (weight / reps / e1RM)
  - `progression.js` — double progression with RPE autoregulation, stall detection, deloads
  - `generator.js` — instant program generation (Full Body / Upper-Lower / PPL) with mesocycle phases (accumulation → intensification → realization → deload) scaling weekly targets
  - `analytics.js` — volume, muscle balance, streaks, PR timeline; all derived from real logs only (no demo blending)
- **Bring-your-own AI Coach** (`src/ai/providers.js`) — pick Anthropic, OpenAI, Groq, or any OpenAI-compatible endpoint in Settings and paste your API key. The key never leaves your device (excluded from sync and export). Chat is grounded in your actual program and recent sessions. Falls back to the server's built-in coach when signed in.
- **Forge design system** — carbon base, ember-orange accent, Space Grotesk numerals, hairline surfaces. Tokens in `src/index.css` + `tailwind.config.js`.
- **Rebuilt screens** — Home · Workout · History · Program · Progress:
  - Workout: program day or freestyle, exercise picker with search/filters + custom exercises, previous-session ghost values, rest timer with haptics, mid-session swap/add/remove, finish summary with PRs
  - History: full log, session detail, edit/delete, per-exercise e1RM trend
  - Program: editable days (swap/add/remove/sets), week-by-week phase targets, "why this program" rationale
  - Progress: e1RM trend for any lift, muscle-group set balance, PR timeline, consistency heatmap
  - Onboarding: four questions → optional instant program. Demo data is opt-in and clearly labeled.
- **Data ownership** — JSON export/import and full wipe in Settings.

## Stack

- **Frontend**: React 18 + Vite, Tailwind, Recharts, Capacitor (iOS), PWA
- **Backend (optional, for sync + OAuth + built-in coach)**: Express + TypeScript, Prisma, MySQL, Anthropic API
- **Tests**: Vitest + Testing Library (`npm test`) — engine, repository (incl. v1→v2 migration), and screen smoke tests

## Project structure

```
src/
├── data/        # local-first repository, schema, exercise library, sync
├── engine/      # e1RM, progression, program generator, analytics (pure, tested)
├── ai/          # BYO-provider adapters + coach grounding
├── pages/       # Home, Workout, History, Program, Progress, Onboarding, Settings
├── components/  # workout/ (picker, rest timer, set row), ui/ primitives, ai/ chat
└── lib/         # thin API client (auth + sync only), platform helpers
server/          # optional sync/auth/AI backend (unchanged from v3)
```

## Quick start

```bash
npm install
npm run dev        # app at http://localhost:5173 — fully usable with no backend
npm run check      # lint + tests + build
```

Optional backend (sync, OAuth, built-in coach):

```bash
npm run server     # see server/.env.example for MySQL + OAuth + Anthropic config
```

### iOS

```bash
npm run ios:sync && npm run ios:open
```

## Philosophy

- **Your data is real.** Charts and stats come from your logged sets, or they say "no data yet" — nothing is fabricated.
- **The engine is explainable.** Every suggestion ("add 2.5 kg", "deload 10%") comes with the rule that produced it.
- **AI is yours.** Bring whichever model you trust; the app is fully functional without any.

## License

ISC
