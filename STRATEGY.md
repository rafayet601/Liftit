# Liftit Strategy — "The Tracker That Shows Its Work"

**Classification:** Internal. Contains competitor attack angles and file-level implementation mappings. Not for public distribution.

**Date:** 2026-08-27 · **Owner:** Liftit team · **Status:** Active

---

## 1. Market Landscape 2026

The strength-tracking category splits into **loggers** (you bring the program, they record) and **generators** (the app decides what you do). Everyone is converging on an "AI coach," but the coaches are algorithmic or shallow.

| Player | Position | Price (verified) | Exposed weakness |
|---|---|---|---|
| **Strong** | Fastest logger; r/weightroom & r/powerlifting default | $4.99/mo · $29.99/yr · $99.99 lifetime | Zero AI. Dev pace "maintenance-level" (v6.2, Mar 2026 = bug fixes). No recovery, no web app, 3-routine free cap. |
| **Hevy** | Value king + social + Hevy Trainer | $2.99/mo · $23.99/yr · $74.99 lifetime | Pro users publicly angry that overload recommendations aren't built in (r/Hevy threads, 2026). AI is algorithmic, not conversational. Free tier: 3-month history wall. 4-routine / 7-custom-exercise free caps. |
| **Fitbod** | AI workout generator | $15.99/mo · $95.99/yr · no lifetime | Black-box heuristics. Rotating exercise selection **destroys per-lift progression tracking**. Users run Strong+Fitbod in parallel. Free tier = trial only; app stops working when you stop paying. |
| **Jefit** | Analytics depth + 1,400+ exercises | $12.99/mo · $69.99/yr Elite | Dated UX. No lifetime option. |
| **Liftosaur** | Scripted programs (Liftoscript) | ~$4.99/mo · $39.99/yr · $99.99 lifetime | Power-user niche; steep scripting learning curve. |
| **SensAI / Cora** | Recovery-aware LLM coaching (HealthKit) | SensAI subscription tier | iOS-only, wearable-dependent, subscription-first. No strength-tracking depth. |

**Cross-cutting gaps nobody fills:**

1. **Nobody imports competitor history properly.** There is no standard format and most apps refuse to build importers — yet Strong and Hevy CSV formats are documented, stable, and public (see Hevy Help Center "Import Strong CSV"; LastLift's 2026 switching study: "Most apps don't import it").
2. **Nobody reads recovery signals into strength programming.** Fitbod syncs activity; Hevy's Watch integration is logging-only. Recovery-aware coaching is owned by wearables (Whoop Coach, Oura Advisor) and iOS-only newcomers — not by any tracker.
3. **No explainable coach exists.** Fitbod's algorithm is explicitly criticized as "too opaque to audit or challenge." Strong says nothing at all. Every AI coach in adjacent categories runs on the same OpenAI/Gemini models — the model is no longer a differentiator; **the explanation layer is**.

---

## 2. Structural Findings (why the market is winnable)

### Finding 1 — Migration friction, not features, is the incumbents' moat
Logging speed is the #1 stated reason people switch tracker apps (dominant theme across 200+ analyzed Reddit threads). But switching is punished: export exists, import mostly doesn't. Incumbents' lock-in is **friction**, not product quality. A tracker with one-tap Strong/Hevy/FitNotes import turns their entire installed base into our top-of-funnel.

### Finding 2 — The AI coach war commoditized; explainability is the new ground
2026 saw ChatGPT Health, Google's Gemini coach, Samsung's AI overhaul, Apple's delayed Mulberry — all racing to interpret the same data with the same models. Industry analysis (Sahha, "Health AI Wars") concludes differentiation moved to (a) data trust and (b) verticalized, explainable depth. Apple *delayed its flagship coach* rather than ship unexplainable advice. A strength tracker whose every suggestion can answer "why?" with the exact rule, sessions analyzed, and plateau math is a position no incumbent can copy without rewriting their product.

### Finding 3 — Hevy's power users handed us our wedge
r/Hevy (2026): loyal pro users in open revolt that overload/next-weight recommendations still aren't integrated ("…so easy to do but Hevy's been neglecting longtime pro users"). Liftit **already ships** the unified double-progression + deload engine with plain-language reasons. This is a ready-made comparison-marketing angle.

---

## 3. Positioning

> **Liftit: the tracker that shows its work.**

| Axis | Fitbod | Strong | Hevy | **Liftit** |
|---|---|---|---|---|
| Coaching decisions | Yes, black box | None | Algorithmic | **Yes, fully auditable** |
| "Why this weight?" | ✗ | ✗ | ✗ | **✓ (rule + data shown)** |
| History paywall | Trial-only app | Free forever | 3-month wall | **Free forever, local-first** |
| Migration import | ✗ | Export only | Strong-only import | **Strong + Hevy + FitNotes** |
| AI coach cost model | Server $ per user | — | Server $ per user | **BYO-key → $0 marginal** |
| Data ownership | Subscription-gated export | CSV | CSV (Pro on some accounts) | **Local doc + JSON + CSV, always** |

Monetization stays aligned: local use is free forever; **Pro = cloud sync (D1) + hosted AI conveniences**. We never paywall history, export, or the engine.

---

## 4. Roadmap

### Phase A — Migration Wedge *(growth unlock, ~1 week)*
The single highest-leverage feature in the market: let incumbents' users bring three years of history in 60 seconds.

| Item | Implementation | Files |
|---|---|---|
| Strong CSV importer | Parse documented Strong export schema; fuzzy-match names via existing `matchExerciseByName`; preview + commit two-step; auto-create custom exercises for unmatched names | new `src/data/importers/strong.js`; register in `src/data/db.js` (`import()` / new `importWorkouts()`); UI in `src/pages/Settings.jsx` (Data section) |
| Hevy CSV importer | Same pipeline; reconstruct superset markers if trivial, else drop | new `src/data/importers/hevy.js` |
| FitNotes CSV importer | Android free-pick audience; same pipeline | new `src/data/importers/fitnotes.js` |
| Shared importer core | Canonical intermediate shape `{ date, name, notes, exercises:[{ sourceName, sets }] }`; dedupe/skip-vs-replace on date collisions; all weights → kg at the edge | new `src/data/importers/core.js` |
| Plate calculator | Per-set chip: "2×20 + 1×5 /side" from bar=20kg (45lb) + plate set; respects `UnitContext` | new `src/components/workout/PlateCalculator.jsx`; wire into `src/components/workout/SetRow.jsx` + suggestion line in `src/pages/Workout.jsx` |
| PR share cards | 9:16 canvas-rendered card from `prTimeline` events | new `src/components/ui/ShareCard.jsx`; entry from `src/pages/History.jsx` PR rows |

**Acceptance:** `npm run check` green; importer unit tests incl. malformed CSVs, decimal commas, unit ambiguity; golden-file round-trips for real Strong/Hevy exports.

### Phase B — The Explainable Coach *(the moat, ~1–2 weeks)*
Depends on A (imported history = more engine signal).

| Item | Implementation | Files |
|---|---|---|
| "Why?" button | Every engine suggestion (`suggestNextSession` output) gets a tap-through sheet: fired rule ID, the ≤4 sessions analyzed, volume/intensity deltas, plateau window | extend `src/engine/progression.js` (attach `explanation` object to results); new `src/components/workout/SuggestionWhy.jsx`; used in `Workout.jsx`, `Progress.jsx` |
| ACWR fatigue model | Acute:chronic workload ratio (Gabbett) from logged volume; flag >1.3 (spike) / <0.8 (detrend); feeds deload threshold | new `src/engine/fatigue.js` (`acwr(workouts, now)`); consumed by `Progress.jsx` + `suggestNextSession` options |
| Weekly digest | Local notification + Home card: volume trend, PRs, next-week plan, ACWR status | extend `src/engine/analytics.js` (`weeklyDigest`); new `src/components/home/DigestCard.jsx`; Capacitor local notifications |
| Mid-workout AI actions | TrainerChat upgrades from Q&A to doing: "shoulder hurts, swap this" → swap + rescale + re-suggest. Grounded prompt already in `src/ai/coach.js`; add tool-calling into active session | extend `src/ai/coach.js`, `src/components/ai/TrainerChat.jsx`, `src/hooks/useActiveSession.js` |

**Acceptance:** engine contracts keep passing; every AI action is logged + reversible; no fabricated numbers anywhere (house rule).

### Phase C — Recovery Context & Ecosystem *(category jump, ~2–3 weeks)*
Depends on B (readiness modulates the engine).

| Item | Implementation | Files |
|---|---|---|
| HealthKit / Health Connect readiness | Capacitor health plugin; derive daily readiness from HRV trend + sleep duration + RHR drift; on-device, opt-in, private. Readiness only *modulates* Phase B thresholds — never overrides the deterministic engine | new `src/data/recovery.js` + `src/contexts/RecoveryContext.jsx`; consumed by `src/engine/fatigue.js` options |
| Bodyweight + measurements | New doc collections (schema bump v2→v3 with migration); unlocks e1RM/bodyweight + mass-normalized volume targets | `src/data/schema.js`, `src/data/db.js`, chart in `src/pages/Progress.jsx` |
| Routine share links | Export/import programs as compact URL fragments (JSON → base64url) + `.liftit.json` files; Boostcamp proved free program distribution drives adoption | extend `src/pages/Program.jsx` + `src/data/db.js` |
| Watch companion (Apple Watch) | Native watch target reusing the sync API; logging-only first (the retention feature Hevy users cite most) | new `ios/` watch target; `functions/api/` unchanged |

**Acceptance:** readiness is off by default and degrades gracefully; schema migration tested both directions; no health claims in copy.

### Phase D — Platform Play *(optionality)*
| Item | Implementation | Files |
|---|---|---|
| "Bring your own agent" (MCP) | Expose the local doc to the user's own Claude/ChatGPT via MCP. The legacy Express MCP host under `server/src/mcp/` already sketches the tool surface; port the read-tools to the Pages Function or a local stdlib server | revive `server/src/mcp/` tools against current schema |
| Community program templates | Git-backed JSON repo of program files importable via Phase C share links | docs + `src/data/importers/program.js` |

---

## 5. Why this wins

- **A+B alone** dominate the two axes research says drive switching — logging/migration and progression guidance — while being the only transparent coach on the market.
- **C** jumps categories from "logger" to "recovery-aware coach," the exact position Apple/Google/Whoop are racing toward, at a price point they can't match because our AI layer is BYO-key ($0 marginal).
- **D** owns the data-nerd segment (r/weightroom) the way FitNotes owned free Android — via radical openness.
- Architecture tax ≈ 0: the local-first document, deterministic engine hooks, D1 sync, and Capacitor shell were all built for exactly this.

## 6. Sources (researched 2026-08-27)

- SensAI — Hevy vs Strong vs Fitbod (pricing/feature matrix, recovery gap): sensai.fit/blog/hevy-vs-strong-vs-fitbod
- Push/Pull — Hevy vs Strong vs Fitbod (free-tier boundaries): push-pull.app/blog/hevy-vs-strong-vs-fitbod
- AI Fit Hub — 2026 verified pricing + 3-year TCO: aifithub.io/articles/hevy-vs-strong-vs-fitbod-2026
- Workout Lab — 10-app comparison (Liftosaur, Jefit, metric flexibility): workoutlab.app/blog/workout-lab-vs-strong-hevy-fitbod-comparison
- Cora — Best Workout Tracker per Reddit (200+ thread analysis; switching drivers): corahealth.app/blog/best-workout-tracker-reddit
- Cora — State of Fitness Tracking 2026 (HRV-guided training evidence; AI adherence data): corahealth.app/state-of-fitness-tracking-2026
- Sahha — iOS 27 for Health & Fitness Developers (GymKit, HR engine, HealthKit): sahha.ai/blog/ios-27-health-fitness-developers
- Sahha — Health AI Coach Wars 2026 (coach commoditization; data trust): sahha.ai/blog/health-ai-coach-wars-2026
- PRPath — Strong vs Hevy 2026 (Strong maintenance-level releases; Hevy Trainer launch): prpath.app/blog/strong-vs-hevy-2026.html
- r/Hevy — "Hevy's AI Trainer: slap in the face for everyone else" (power-user revolt): reddit.com/r/Hevy/comments/1rsxl9w
- LastLift — How to Switch Workout Tracker Apps (import-format gap): lastlift.app/articles/how-to-switch-workout-tracker-apps
- Hevy Help Center — Strong CSV import docs (format stability): help.hevyapp.com
- TraceApps — multi-source CSV import spec (canonical intermediate shape): traceapps.github.io/docs/lifttrace/import
- SpeedMVPs — AI Fitness Coaching App 2026 (hybrid deterministic+LLM pattern): speedmvps.com/blog/ai-fitness-coaching-app-development
