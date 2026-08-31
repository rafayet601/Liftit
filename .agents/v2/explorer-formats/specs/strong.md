# Strong App — CSV Export Format Spec

**Status:** Final — verified against Strong Help Center, Hevy Help Center, the
sugarwod-to-hevy format reference, StrongCsvParser edge-case notes, and a real
native export file (fetched and inspected). · **Date:** 2026-08-27
**Target parser:** `src/data/importers/strong.js` → emits canonical shape
([canonical-shape.md](./canonical-shape.md)).

This is also the format Hevy's "Import Strong CSV" consumes, so it is the most
cross-documented of the three formats.

---

## 1. File shape

| Property | Value |
|---|---|
| Encoding | UTF-8 (**strip BOM** — BOM-prefixed exports observed in the wild per StrongCsvParser) |
| Delimiter | Comma; RFC 4180 minimal quoting (fields containing commas/quotes are double-quoted) |
| Header | Required, English, exact names below (Hevy's importer enforces English — treat as stability guarantee) |
| Row model | **One row per set.** Workout-level columns (`Date`, `Workout Name`, `Duration`, `Workout Notes`) repeat identically on every row of the session |
| Header order | Fixed in exports; parsers should still match by name, not position |

Export path: Strong → Settings → **Export Strong Data** (iOS) / **Export Data**
(Android). Strong cannot re-import its own CSV; it is a pure export format.

## 2. Column schema — 12 columns, fixed order

```
Date,Workout Name,Duration,Exercise Name,Set Order,Weight,Reps,Distance,Seconds,Notes,Workout Notes,RPE
```

Verified against a real native export (StrongAppAnalytics `strong.csv`, 2020
export — header matches today's documented schema exactly).

| # | Header | Scope | Type / format | Notes |
|---|---|---|---|---|
| 1 | `Date` | workout | `YYYY-MM-DD HH:MM:SS`, 24h, local time | Session start; identical on every row of the session. |
| 2 | `Workout Name` | workout | string | e.g. `Evening Workout`, `Push Day`. May contain commas → quoted. |
| 3 | `Duration` | workout | human token: `45m`, `2h 38m`, `3h`, `1h 8m` | **Elapsed session length — NOT `HH:MM:SS`**, not rest. Minimum observed `1m`. |
| 4 | `Exercise Name` | exercise | string | Strong library names carry an equipment suffix: `Bench Press (Barbell)`, `Squat (Barbell)`, `Lat Pulldown (Cable)`. Custom/user names appear verbatim (WOD names, cardio). |
| 5 | `Set Order` | set | integer `1..N`, **resets to 1 per exercise** — OR letter-coded (§6) | Plain integers are the normal case; warm-up/drop tags mutate this field. |
| 6 | `Weight` | set | number, **unitless** | Reflects the user's Strong display unit (kg or lbs) — no in-file signal. `0` for bodyweight/timed/cardio. Often one decimal (`40.0`, `135.0`). |
| 7 | `Reps` | set | integer | `0` when not applicable. |
| 8 | `Distance` | set | number | User's distance unit (km/mi). `0` when unused. |
| 9 | `Seconds` | set | integer | Per-set duration (planks, timed WOD results). `0` when unused. (Not labeled "Time" — older summaries calling it that are wrong.) |
| 10 | `Notes` | set / exercise | string | Per-set note; WOD descriptions/results often live here. May be empty (`""` or bare empty). |
| 11 | `Workout Notes` | workout | string | Session-level notes (RX/SCALED, PR flags). Repeated on every row. |
| 12 | `RPE` | set | number 1–10 | Present in header; **empty unless the user logged per-set RPE** (§7). |

**Not exported** (confirmed by ≥2 sources): weight unit, superset grouping,
rest between sets. (Warm-up flags ARE exported, but encoded inside `Set Order`
— see §6.)

## 3. Date format & grouping

- Primary: `YYYY-MM-DD HH:MM:SS` (24h), local wall-clock time, no timezone
  marker — e.g. `2020-12-30 18:51:52`. Treat as local time.
- StrongCsvParser documents **three date formats** occurring across export
  versions/locales. Parser must accept at minimum: `YYYY-MM-DD HH:MM:SS`,
  `YYYY-MM-DD HH:MM`, and `YYYY-MM-DDTHH:MM:SS`. Any other shape → report the
  row, don't crash.
- **Session grouping key = (`Date`, `Workout Name`).** Both change together at a
  session boundary. A user can log two same-named sessions on one date; emit
  two canonical workouts and let the collision policy handle the shared date.

## 4. Example rows (first 3 + variety rows are from a real export)

```csv
Date,Workout Name,Duration,Exercise Name,Set Order,Weight,Reps,Distance,Seconds,Notes,Workout Notes,RPE
2020-12-30 18:51:52,Evening Workout,2h 38m,Snatch (Barbell),1,40.0,3,0,0,,,
2020-12-30 18:51:52,Evening Workout,2h 38m,Snatch (Barbell),2,50.0,2,0,0,,,
2020-12-30 18:51:52,Evening Workout,2h 38m,Snatch (Barbell),3,60.0,1,0,0,,,
2020-12-30 18:51:52,Evening Workout,2h 38m,Bench Press (Barbell),1,80.0,8,0,0,,,
2020-12-30 18:51:52,Evening Workout,2h 38m,Plank,1,0,0,0,60,,,
2021-05-13 12:00:00,Evening Workout,5m,Swimming,1,0,0,1.0,30,,,
2022-05-30 12:00:00,MURPH,46m,MURPH,1,0,0,0,2762,"Partition the pull-ups... | result: 46:02 | SCALED","No weight vest... | SCALED | PR",
```

Rows 1–3 and the swimming row are verbatim from the verified real export; the
bench/plank/MURPH rows follow the exact documented patterns (RepStack's Strong
template and sugarwod-to-hevy show the same shapes).

Parsing walkthrough, row 1 → canonical (assuming kg):
`{ date: '2020-12-30', startedAt: '2020-12-30T18:51:52', name: 'Evening Workout',
notes: '', durationSec: 9480, source: 'strong', exercises: [{ sourceName:
'Snatch (Barbell)', sets: [{ weight: 40, reps: 3, rpe: null, setNumber: 1,
isWarmup: false }] }] }`

## 5. Weight units — the central problem

The schema has **one `Weight` column and no unit field**. Values reflect
whatever unit the user chose in Strong at logging time; the file does not say
which. Decisions (binding):

- **Primary: ask the user** (kg / lbs / auto-detect), default auto. Show the
  resolution in the preview ("214 workouts will be read as **kg**").
- **Auto heuristic:** if ≥30% of sets belonging to `(Barbell)`-suffixed
  exercises have `weight ≥ 90` → lbs; else kg. (lbs barbell training routinely
  shows 135/185/225; kg above 90 is elite-only per lift.) Advisory only.
- lbs → kg: `× 0.45359237`, round to 2 decimals, at the adapter edge.
- **Header variant trap:** StrongCsvParser reports "unit-suffixed weight
  headers" in some Strong-like exports — accept `Weight (kg)` / `Weight (lbs)`
  as header variants; **if present they authoritatively declare the unit** and
  override the heuristic.
- Precedent: Hevy's importer reads Strong `Weight` as kg unconditionally,
  silently ~2.2×-ing lbs users' loads. Liftit must not repeat this.

**Locale decimals:** native exports use `.` (verified; English export is the
norm and Hevy requires English). Apply canonical-shape.md §3 defensive
comma-decimal rules for Excel-round-tripped files.

## 6. Set Order — plain integers AND letter codes

- Normal sets: contiguous integers `1..N`, resetting per exercise.
- **Warm-up / drop-set tags are encoded in `Set Order`** as letter codes
  (`W` = warm-up, `D` = drop set) rather than a separate column — documented by
  StrongCsvParser ("the W / D set-order codes"). Strong's Help Center confirms
  Warm-up/Drop/Failure set tags exist in-app.
- Parser rule: `^(W|D)?\s*(\d+)?$` —
  - plain/`N` → `setNumber` input, `isWarmup: false`
  - `W…` → `isWarmup: true` (maps to Liftit's `isWarmup` flag)
  - `D…` → drop set: Liftit has no drop flag → `isWarmup: false`, note it in
    the import report. Never drop the set.
- Re-number 1..N after sorting regardless (canonical §4).

## 7. RPE — verdict (conflict resolved)

- **TraceApps claims** "RPE is not in Strong … exports." **sugarwod-to-hevy
  shows** an `RPE` column present in the 12-column header. **Both are right:**
  the column exists in the schema but is *usually blank*; Strong's Help Center
  ("About Warm-up, Drop Sets and Failure Sets", Feb 2021) confirms per-set RPE
  exists in-app ("You can also use RPE to record your level of exertion"), so
  exports from users who log RPE may carry values.
- Adapter behavior: parse `RPE` as an optional float; blank/invalid → `null`.
  Do not fabricate RPE.

## 8. Notes — three distinct scopes

| Column | Scope | Canonical destination |
|---|---|---|
| `Workout Notes` | session | `notes` |
| `Notes` | per-set (often doubles as exercise note) | import report only — Liftit v2 sets have no notes field |
| `Exercise Name` suffix | none — equipment hint, not a note | matching input only |

## 9. Supersets — verdict

**Not exported.** Strong supports supersets/circuits in-app (Help Center), but
the CSV carries no marker. All canonical `supersetId` values are `null`.

## 10. Naming quirks & matching

- Strong library style: `"Exercise (Equipment)"` — `Bench Press (Barbell)`,
  `Squat (Barbell)`, `Deadlift (Barbell)`, `Lat Pulldown (Cable)`,
  `Shrug (Dumbbell)`.
- Liftit library style (exercises.js) is word-order-reversed:
  `Barbell Bench Press`, `Barbell Back Squat`, `Conventional Deadlift`.
  The de-parenthesize + bidirectional-contains ladder (canonical §2) resolves
  most: `"Bench Press"` ⊂ `"barbell bench press"`.
- Known hard cases → alias table (canonical §2 step 3): `Squat (Barbell)` →
  `Barbell Back Squat`; `Deadlift (Barbell)` → `Conventional Deadlift`;
  `Bench Press (Barbell)` → `Barbell Bench Press`. Unmatched → custom exercise.

## 11. Edge cases checklist

- `Duration` token parser: `(\d+)\s*h` + `(\d+)\s*m` → seconds (`2h 38m` =
  9480, `45m` = 2700, `3h` = 10800). Bare empty `Duration` → 0.
- Quoted fields with commas (Workout Names like `"Back Squat 5x3"` are plain,
  but notes routinely contain commas/pipes) — use a real CSV parser.
- Empty trailing `RPE` field → line ends with `,`.
- Weight `0` + Reps `> 0` → bodyweight set; keep with `weight: 0`.
- `Distance > 0` or `Seconds > 0` with weight 0 → cardio/timed row (see
  canonical rule 6).
- BOM before header → strip before matching headers.
- Two sessions same `Date`, different `Workout Name` → two canonical workouts;
  collision policy operates per-date (canonical §5).

## 12. Sources (cross-checked ≥2)

1. Real native export (fetched): `AlexandrosKyriakakis/StrongAppAnalytics → Data/strong.csv` — exact 12-column header, date `YYYY-MM-DD HH:MM:SS`, `40.0`-style weights, `2h 38m` durations, quoted names, blank RPE
2. smyrick/sugarwod-to-hevy `docs/STRONG_FORMAT.md` — full schema, column semantics, duration tokens, unused-field `0` convention, Hevy kg interpretation, one-import-per-account
3. Strong Help Center — export location & no re-import (`help.strongapp.io/article/235-export-workout-data`); set tags incl. RPE (`article/166-set-tags`)
4. Hevy Help Center — "How to Import Strong App CSV Files…" (English-header requirement; import UI path)
5. edvanbeinum/StrongCsvParser — BOM, `W`/`D` set-order codes, three date formats, unit-suffixed weight header
6. RepStack Strong CSV template — same 12 columns incl. `Seconds`, one-row-per-set rule
7. TraceApps LiftTrace import docs — Strong: no superset data; RPE expectation
