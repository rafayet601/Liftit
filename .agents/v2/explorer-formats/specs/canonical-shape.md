# Canonical Intermediate Shape — Liftit CSV Importer Core

**Status:** Final · **Owner:** explorer-formats · **Date:** 2026-08-27
**Consumer:** `src/data/importers/core.js` (planned in worker-migration's scope).
Parsers in `strong.js` / `hevy.js` / `fitnotes.js` each emit an array of these
objects; the core then fuzzy-matches names, normalizes units, and commits via
`createWorkout()` / `createSet()` from `src/data/schema.js`. Custom-exercise
fallback uses the existing `db.exercises.addCustom({ name })` (`src/data/db.js`).

Per-source specs: [`strong.md`](./strong.md) · [`hevy.md`](./hevy.md) · [`fitnotes.md`](./fitnotes.md)

---

## 1. The shape

```js
// One entry per source workout session, in file order.
{
  date: 'YYYY-MM-DD',           // LOCAL calendar date of the session (collision key)
  startedAt: 'ISO-8601 | null', // best-known start timestamp, local tz; null if source has date only
  endedAt: 'ISO-8601 | null',   // null if source has no end time
  name: 'Push Day',             // workout title ('Workout' if source has none)
  notes: '...',                 // WORKOUT-level notes ('' if none)
  durationSec: 0,               // integer seconds; 0 when source lacks duration
  source: 'strong | hevy | fitnotes',
  exercises: [
    {
      sourceName: 'Bench Press (Barbell)', // EXACT string from the file — never pre-cleaned
      notes: '...',            // EXERCISE-level notes ('' when source has none) [optional]
      supersetId: '1' | null,  // Hevy only; null for Strong/FitNotes        [optional]
      sets: [
        {
          weight: 60,          // NUMBER, ALWAYS KG (§3); 0 for bodyweight/timed
          reps: 10,            // integer, 0 when not applicable
          rpe: null,           // number (may be fractional, e.g. 8.5) or null. NEVER 0 — 0 means "unset" in createSet
          setNumber: 1,        // 1-based order within the exercise (§4)
          isWarmup: false,     // true only from Hevy set_type 'warmup' / Strong 'W' set-order code
        },
      ],
    },
  ],
}
```

Rules that hold for **every** adapter:

1. **Never mutate `sourceName`** — matching/disambiguation happens downstream so
   the user can always see what the file said.
2. **All weights arrive in kg.** Adapters own unit detection and conversion
   (§3); the core does a final sanity assertion (`weight >= 0`, finite).
3. `rpe` is `null` when absent — `createSet()` coerces `null → 0`, which is the
   Liftit "no RPE" convention (`schema.js` `createSet`, `rpe: numberOr(..., 0)`).
4. Exercises keep **first-seen order**; sets keep file order, renumbered
   `setNumber` 1..N per exercise (§4).
5. Rows that are all-empty (no weight, no reps, no distance, no time) are
   dropped and counted in the import report.
6. Distance/time-only rows (cardio) are kept with `weight: 0, reps: 0` if the
   exercise matched; distance/duration values themselves have no Liftit field —
   record them in the import report, not the document. Unmatched cardio
   exercises are reported (not silently dropped — worker-migration "honest
   data" rule).

## 2. Mapping to Liftit documents (`src/data/schema.js`)

| Canonical | `createWorkout()` | `createSet()` | Notes |
|---|---|---|---|
| `date` + `startedAt` | `startedAt` | — | If `startedAt` is null, synthesize `date` + `'12:00'` local so history ordering is stable. Workout `completedAt` = `endedAt` ?? `startedAt`. |
| `durationSec` | `durationSec` | — | |
| `name` | `name` | — | Fallback `'Workout'` (schema default). |
| `notes` | `notes` | — | Workout-level only. Liftit sets have **no** notes field in v2 — per-set/exercise notes go to the import report, never fabricated into the document. |
| `exercises[].sourceName` | — | — | Input to `matchExerciseByName()` (`src/data/exercises.js`); unmatched → `db.exercises.addCustom` with `sourceName` as name (id `custom_*`). |
| `sets[].weight` | — | `weight` | Already kg. |
| `sets[].reps` / `rpe` / `setNumber` / `isWarmup` | — | `reps` / `rpe` / `setNumber` / `isWarmup` | `rpe: null → 0` via `numberOr`. |
| `supersetId` | — | — | No Liftit field in v2. Preserve in the import report; do not fabricate grouping in the document. |

### Exercise matching contract (`matchExerciseByName`, exercises.js:143)

The matcher lowercases/trims, tries an exact map hit, then a **bidirectional
contains** test against library names. Two consequences:

- **Word order matters for exactness but contains-match forgives it**:
  `"barbell bench press".includes("bench press")` — so Strong/Hevy-style
  `"Bench Press (Barbell)"` must first be tried **de-parenthesized**.
- A naive full-string contains match can *mis*-hit: source `"Squat (Barbell)"`
  de-parenthesized to `"squat"` contains-matches nothing, but `"front squat"`
  contains `"squat"` in the other direction only if we test
  `needle.includes(candidate)` too — that would wrongly match `"Squat"` →
  `Front Squat`. **The ladder below forbids short ambiguous needles** (< 2
  tokens) from the reverse-direction contains test; they fall through to
  token matching where `"squat"` + equipment hint `(Barbell)` resolves to
  `Barbell Back Squat`.

Recommended matching ladder (run per unique `sourceName`, cache the result):

1. Full `sourceName` → `matchExerciseByName` (handles exact hits).
2. De-parenthesized name (strip ALL `(...)` groups, trim) → `matchExerciseByName`.
3. Word-order-insensitive token match: all source tokens appear in the library
   name, or vice versa; equipment parenthetical content is a required token when
   the library name contains an equipment word. Special-case aliases:
   `Squat`→`barbell-back-squat`, `Deadlift`→`conventional-deadlift`,
   `Bench Press`→`barbell-bench-press`.
4. Fallback: auto-create custom exercise via `db.exercises.addCustom({ name: sourceName })`.
   Never block the import (same policy as the TraceApps reference importer).

## 3. Unit normalization (all weights → kg at the edge)

| Source | Unit signal | Rule |
|---|---|---|
| Strong | **None in-file** (§ strong.md §5). `Weight` reflects the user's Strong display unit. | Import UI asks: kg / lbs / auto (default **auto**). Auto heuristic: if ≥30% of sets on `(Barbell)`-suffixed exercises are ≥ 90 → lbs, else kg. Surface the chosen unit in the preview; user override always wins. |
| Hevy | **Header declares it**: `weight_kg` or `weight_lbs` column name. Legacy/other variants may use `Weight (kg)` / `Weight (lbs)`. | Read the header. If both kg and lbs columns exist, prefer `weight_kg`, fall back to `weight_lbs` per row (openweight.dev precedent). |
| FitNotes | **Per-row value column** (Android): `Weight Unit` holds `kgs` / `kg` / `lbs` / `lb` next to a unitless `Weight` column. iOS "FitNotes 2" variant instead uses `Weight (kg)` / `Weight (lbs)` columns. | Android: normalize the unit string per row (`kgs|kg|kilogram` → kg; `lbs|lb|pound` → lb). iOS: use whichever column is present; prefer kg when both exist. |

Conversion: `LB_TO_KG = 0.45359237`, multiply, round to **2 decimals**, at the
adapter edge (before the canonical object exists).

**Locale decimal commas.** All three apps export with ASCII `.` decimals in
native English exports — verified in real samples of all three. Hevy's Help
Center additionally requires English-locale files for Strong-format imports.
Defensive rules for files round-tripped through Excel in EU locales:

- Sniff the delimiter first: if a file uses `;` as delimiter, expect `,` decimals.
- Numeric cell matching `^-?\d+,\d{1,3}$` (one comma, no dot) → comma is the
  decimal separator (`"72,5"` → 72.5).
- Comma as thousands separator (`"1,275"` → 1275) is detected by the 3-digit
  final group.
- Strip BOM (`utf-8-sig`) before header parsing (observed in Strong exports).

**Bad-data precedent:** Hevy's own Strong importer reads Strong's unitless
`Weight` as kg unconditionally, so a lbs user's import via Hevy lands ~2.2× too
heavy (sugarwod-to-hevy LEARNINGS). Liftit avoids this class of bug by always
asking/annotating for unitless sources.

## 4. Set ordering normalization

| Source | Raw field | Rule |
|---|---|---|
| Strong | `Set Order` | 1-based, contiguous, resets per exercise. May carry `W`/`D` letter codes (warm-up/drop — see strong.md §6). Trust for order, **renumber 1..N after sorting**. |
| Hevy | `set_index` | Base varies across sources (0-based in the verified sample, documented 1-based elsewhere). Never use the absolute value: sort stable by `set_index` within exercise, renumber 1..N. |
| FitNotes | none | Sets are consecutive same-`(date, exercise)` rows in file order. Renumber 1..N in file order. |

## 5. Duplicate-date (collision) policy — inputs

**Workout identity for collisions = local `date` (`YYYY-MM-DD`), nothing else.**
Two sessions on one calendar day collide even with different names — matching
the TraceApps reference behavior and safe for sources lacking timestamps
(FitNotes has date only).

Inputs the core computes for the preview screen:

- `incoming`: canonical workouts grouped by `date`. A source file with two
  sessions on one date yields two canonical workouts; **each collides
  independently** — do not merge them.
- `existing`: local dates already present in `document.workouts[].startedAt`.
- Per colliding date the user chooses **skip** (default — never clobber logged
  sets) or **replace** (drop the existing Liftit workout, insert the imported
  one). No bulk-replace switch.
- Non-colliding imports commit unconditionally.
- Report inputs per canonical workout: `{ date, name, setCount, exerciseCount,
  matchedCount, unmatchedNames[], contentHash }` — enough to render the
  preview and an honest before/after for `replace`.

## 6. RPE & superset availability matrix (resolved conflict)

TraceApps' import docs claim "RPE is not in Strong, Hevy, FitNotes, or Jefit
exports." **That is correct only for FitNotes.** Verdicts from primary evidence:

| Source | RPE in CSV | Evidence |
|---|---|---|
| Strong | Column **present**; populated only when the user logged RPE (Strong supports per-set RPE — Strong Help "About Warm-up, Drop Sets and Failure Sets": "You can also use RPE to record your level of exertion"). Frequently blank in real exports. | Real export header + sugarwod-to-hevy docs + Strong Help Center |
| Hevy | **Yes** — `rpe` column, 0–10 incl. halves (`8.5` in verified sample), exported when logged. | Verified export sample + two independent parsers |
| FitNotes | **Never** — no RPE column in either Android or iOS export; the Android app has no RPE feature. | Real export file + both official docs |

Supersets: **Hevy only** (`superset_id`, empty string when none). Strong and
FitNotes both support supersets in-app but export **no** marker.

## 7. Sources (researched 2026-08-27; ≥2 per source format)

- TraceApps — LiftTrace workout-history import (canonical-shape precedent, skip/replace duplicate-date behavior, RPE/superset matrix): traceapps.github.io/docs/lifttrace/import
- smyrick/sugarwod-to-hevy — `docs/STRONG_FORMAT.md` (Strong schema; Hevy's kg interpretation of Strong weights)
- Hevy Help Center — Strong CSV import constraints (English headers, one-import limit) + Tutorial: Log Previous Workouts and Import CSV: help.hevyapp.com
- openweight.dev — Hevy migration guide (unit auto-detection, set-type mapping, date-format variance)
- edvanbeinum/StrongCsvParser — Strong edge cases (BOM, `W`/`D` set-order codes, multiple date formats, unit-suffixed weight header variant)
- Real export samples verified byte-level: Strong (`AlexandrosKyriakakis/StrongAppAnalytics/Data/strong.csv`), Hevy (`matanabudy/workout-data-sync/examples/hevy_export_sample.csv` + `adamad44/Hevy-App-Data-Visualiser/parser.js`), FitNotes (`Hypertrophus/LOGBOOK/To Export/FitNotes_Export_2026_05_13_14_26_07.csv`)
