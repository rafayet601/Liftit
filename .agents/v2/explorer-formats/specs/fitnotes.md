# FitNotes (Android) — CSV Export Format Spec

**Status:** Final — verified against a real FitNotes Android export file
(inspected byte-level), the official FitNotes Android docs, and the FitNotes
iOS ("FitNotes 2") import docs which define the same Android format as their
migration target. · **Date:** 2026-08-27
**Target parser:** `src/data/importers/fitnotes.js` → emits canonical shape
([canonical-shape.md](./canonical-shape.md)).

FitNotes is the thinnest of the three formats: date-only, no workout names, no
set order, no RPE, no superset markers. The parser is simple; the interest is
in what's *missing* and how the collision policy absorbs it.

---

## 1. File shape

| Property | Value |
|---|---|
| Encoding | UTF-8 (real-world file carried non-ASCII exercise names — handle Unicode; strip BOM defensively) |
| Delimiter | Comma; RFC 4180 quoting for fields with commas |
| Header | Required; exact names below |
| Row model | **One row per set** — confirmed by a real export and by LOGBOOK's migration doc ("The CSV gives us one line for each set") |
| Order | Rows are grouped by date ascending; within a date, exercises appear in workout order; within an exercise, sets in order (file order is the only ordering signal) |

Export path: FitNotes Android → ☰ → Settings → **Spreadsheet Export** →
Workout Data → CSV (official docs; older versions: Settings → "Export
Workouts to CSV").

## 2. Column schema — 10 columns

```
Date,Exercise,Category,Weight,Weight Unit,Reps,Distance,Distance Unit,Time,Comment
```

Verified verbatim against a real 2026 export
(`Hypertrophus/LOGBOOK/To Export/FitNotes_Export_2026_05_13_14_26_07.csv`).

| # | Header | Scope | Type / format | Notes |
|---|---|---|---|---|
| 1 | `Date` | workout | `YYYY-MM-DD` (verified: `2026-04-29`) | **Date only — no time.** Identical on every row of that day's session(s). |
| 2 | `Exercise` | exercise | string | Library name **or user-created name**, verbatim — including machine/brand suffixes (§9). May be any language. |
| 3 | `Category` | exercise | string | Muscle group (`Chest`, `Back`, …; localized). No Liftit equivalent — use as a *hint* for matching, never as data. |
| 4 | `Weight` | set | number, **unitless** | Load in the unit named by column 5. Empty for timed/distance-only rows. |
| 5 | `Weight Unit` | set | string: `kgs` / `kg` / `lbs` / `lb` (normalize; `kgs` verified) | **Per-row unit declaration.** May vary row-to-row if the user mixed unit systems (FitNotes Supporter allows per-exercise units). |
| 6 | `Reps` | set | integer | Empty for timed/distance-only rows. |
| 7 | `Distance` | set | number | Distance-based (cardio) rows only. |
| 8 | `Distance Unit` | set | string (`km`, `mi`, …) | With column 7. |
| 9 | `Time` | set | `HH:MM:ss` (or `MM:ss`) per FitNotes iOS format doc | Timed rows only (planks, cardio). Android emission format UNVERIFIED — see §10. |
| 10 | `Comment` | set | string | **Per-set** comment ("Slow mo", "5+5"). No workout-level notes column exists. |

**Not exported:** workout name, workout duration, set order/index, RPE,
superset grouping, warm-up flags, per-set timestamps. (FitNotes Android
supports supersets in-app but does not export them — TraceApps concurs.)

## 3. Date format & grouping

- `YYYY-MM-DD`, date-only, no time, no timezone (verified in real file).
  Some historic/locale exports in the wild use slash dates — parse
  `YYYY-MM-DD` first, then `YYYY/MM/DD`; treat `DD/MM/YYYY` as ambiguous and
  report rather than guess (UNVERIFIED which versions emit it — see §10).
- **Grouping key = `Date` alone.** Two sessions on the same day are
  indistinguishable in the file → they merge into one canonical workout with
  all of that date's exercises. This is a data limitation, not a choice;
  note it in the import report.
- Canonical mapping: `date` = the raw date; `startedAt` = null (core
  synthesizes `date` + `12:00` local per canonical §2); `endedAt` = null;
  `durationSec` = 0; `name` = `'Workout'` (schema default — FitNotes has no
  names).

## 4. Example rows

Rows 1–6 verbatim from the verified real export (Hebrew-language user —
demonstrates Unicode and machine-name suffixes); rows 7–9 show lbs, cardio,
and timed patterns per the official field semantics:

```csv
Date,Exercise,Category,Weight,Weight Unit,Reps,Distance,Distance Unit,Time,Comment
2026-04-29,לחיצת חזה קרוס 25,חזה,20,kgs,10,,,,
2026-04-29,Flies At 35,חזה,14,kgs,12,,,,
2026-04-30,Preacher Curl - Star Trac,יד קדמית,15,kgs,10,,,,
2026-04-30,פשיטת מרפק קאבל בעמידה,יד אחורית,32.5,kgs,16,,,,
2026-05-01,Bench Press,Chest,135,lbs,8,,,,slow tempo
2026-05-02,Treadmill,Cardio,,,,5,km,30:00,zone 2
2026-05-02,Plank,Core,,,,,,01:00,
```

Parsing walkthrough, row 3 → canonical:
`{ date: '2026-04-30', startedAt: null, name: 'Workout', notes: '',
durationSec: 0, source: 'fitnotes', exercises: [{ sourceName: 'Preacher Curl
- Star Trac', sets: [{ weight: 15, reps: 10, rpe: null, setNumber: 1,
isWarmup: false }] }] }` (weight 15 kgs → 15 kg; matching lands on
`Preacher Curl` via §9).

## 5. Weight units & detection

- **The `Weight Unit` column declares the unit per row** — the most explicit
  of the three formats. Normalization table:
  `kgs`, `kg`, `kilo(s)`, `kilogram(s)` → kg · `lbs`, `lb`, `pound(s)` → lb.
- Case-insensitive; trim whitespace; unknown token → report the row, default
  kg (flag it in the preview) — never silently guess.
- lb rows: multiply `0.45359237`, round to 2 decimals, at the adapter edge.
- Mixed-unit files are legal (per-exercise units are a paid feature); handle
  per-row, not per-file.
- **iOS variant trap:** files from "FitNotes 2" (iOS) use a different schema —
  `Weight (kg)` / `Weight (lbs)` columns instead of `Weight` + `Weight Unit`
  (see §8). Header-sniff before parsing.

**Locale decimals:** verified export uses `.` (`32.5`). Excel round-trips in
EU locales may produce decimal commas — apply canonical §3 defensive rules.

## 6. RPE — verdict

**Never present.** FitNotes Android has no RPE feature at all; the export has
no RPE column (verified in a real file). TraceApps' claim is **correct** for
FitNotes. All canonical `rpe` values are `null`. (FitNotes *iOS* supports
RPE in-app, but even its CSV export schema has no RPE column.)

## 7. Supersets — verdict

**Not exported.** FitNotes Android supports supersets in-app (official docs:
"Add To Group") but the CSV carries no marker. All canonical `supersetId`
values are `null`.

## 8. The iOS variant (secondary target)

"FitNotes 2" (iOS, Ginger Technologies) is a different app whose export users
may also bring. Its documented workout-CSV header:

```
Date,Exercise,Category,Weight (kg),Weight (lbs),Reps,Distance,Distance Unit,Time,Notes,Kind
```

- Date `YYYY-MM-dd`, **must be ascending**, sets for an exercise grouped.
- Exactly one of `Weight (kg)` / `Weight (lbs)` is filled per row (≤2 dp).
- `Time` is `HH:MM:ss` (or `MM:ss`).
- `Notes` = per-set notes; `Kind` = exercise metric kind, letters
  `w`/`r`/`d`/`t` (e.g. `wr` = weight+reps, `dt` = distance+time).
- No workout name/notes, no RPE, no superset column either.
- Parser: same canonical emission; unit from whichever weight column is
  populated; `Kind` can validate weight/reps presence. Detection: header
  contains `Weight (kg)` or `Kind` → iOS variant.

## 9. Naming quirks & matching

- **Machine/brand suffixes are common**: real export shows
  `Preacher Curl - Star Trac`, `חתירה מתקן 28 - Low Row`
  (`<translated name> - <brand/model>`). Matching ladder (canonical §2):
  full string first (likely custom), then **strip trailing ` - <tail>`
  segments** and retry → `Preacher Curl` matches Liftit's `Preacher Curl`
  exactly.
- **Equipment-suffix style also appears parenthesized** on translated names
  (`בעמידה` … `(ידית)` = handle) — the standard de-parenthesize step applies.
- Non-Latin scripts: pass through UTF-8 untouched; expect the whole exercise
  to become a custom exercise when the name has no Latin/Liftit overlap —
  that is honest behavior, not a bug.
- FitNotes default library uses plain names (`Bench Press`, `Squats`) without
  equipment suffixes — these often hit `matchExerciseByName` directly
  (`"bench press"` ⊂ `"barbell bench press"`). Watch `Squats` → token ladder →
  `Barbell Back Squat` (alias `squat`/`squats`).

## 10. Edge cases checklist

- Same-date multiple sessions merge into one canonical workout (§3) — surface
  in the preview ("2026-04-30: 7 exercises treated as one session").
- `Weight` empty + `Time` empty + `Distance` empty + `Reps > 0` → bodyweight
  set; keep with `weight: 0`.
- `Time` parse: accept `HH:MM:ss` and `MM:ss` → seconds. Android's exact
  emission format UNVERIFIED (iOS doc says `HH:MM:ss`; no verified Android
  timed row was inspected) — accept both, log format if exotic.
- Slash-date variants: parse `YYYY/MM/DD`; anything else → report row,
  don't guess day/month order.
- `Comment` may contain commas → quoted; trim before storing to report.
- Files are small; no BOM observed but strip defensively.
- Category values are localized — never branch on them; hint only.

## 11. Sources (cross-checked ≥2)

1. Real Android export (fetched, inspected): `Hypertrophus/LOGBOOK → To Export/FitNotes_Export_2026_05_13_14_26_07.csv` — exact header, `YYYY-MM-DD` dates, `kgs` unit values, one-row-per-set, `Comment` usage, machine-brand names, Unicode
2. FitNotes Android official docs (`fitnotesapp.com`) — Spreadsheet Export location; unit system setting (Metric/Imperial); Supporter per-exercise units; superset feature exists in-app
3. FitNotes iOS official docs (`getfitnotes.com/docs/migrate-from-other-apps.html`) — defines the Android-format import target (header, `YYYY-mm-dd`, ascending dates, field formats incl. `Kind` letters and `HH:MM:ss` times) + the iOS-native variant header
4. TraceApps LiftTrace import docs — FitNotes: no supersets, no RPE, "nothing is lost that was ever there"
5. LOGBOOK `IMPORT_INSTRUCTIONS.md` — independent analysis of the same real export: grouping-by-date strategy, per-set comments, volume semantics
