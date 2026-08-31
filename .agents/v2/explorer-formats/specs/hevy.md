# Hevy App — CSV Export Format Spec

**Status:** Final — verified against a real export sample, two independent
community parsers, the openweight migration guide, and Hevy Help Center.
· **Date:** 2026-08-27
**Target parser:** `src/data/importers/hevy.js` → emits canonical shape
([canonical-shape.md](./canonical-shape.md)).

⚠️ **Two distinct formats exist.** This spec documents Hevy's own **export**
(`hevy_export.csv`, snake_case headers) — the format Liftit users will feed us.
Hevy's *import* endpoint separately accepts the **Strong 12-column format**
(see [strong.md](./strong.md)); community "Hevy CSV" templates floating around
(e.g. the 14-column `Date,Workout Name,Exercise Name,Set Order,Weight,Weight
Unit,Reps,RPE,Distance,Distance Unit,Seconds,Notes,Workout Notes,Workout
Duration` layout from r/Hevy) are Strong-style *import* files, not Hevy
exports. Detection: snake_case header names → Hevy export; Strong 12-column
header → run the Strong parser.

---

## 1. File shape

| Property | Value |
|---|---|
| Encoding | UTF-8 (strip BOM defensively) |
| Delimiter | Comma; RFC 4180 quoting (sample shows all-string fields quoted, numerics bare) |
| Header | Required; exact snake_case names below |
| Row model | **One row per set** (workout/exercise columns repeat on every row) — confirmed by sample and by every parser examined |
| Filename | Typically `hevy_export.csv` (path: Profile → Settings → Export & Import Data → Export Data → Export Workouts) |

## 2. Column schema — 14 columns

```
title,start_time,end_time,description,exercise_title,superset_id,exercise_notes,set_index,set_type,weight_kg,reps,distance_km,duration_seconds,rpe
```

⚠️ **Unit-variant columns:** the weight column is `weight_kg` **or**
`weight_lbs` (exactly one), and the distance column is `distance_km` **or**
`distance_miles` (exactly one) — depending on the user's in-app unit setting
at export time. The header name itself declares the unit. Total column count
stays 14. (See §5 and the conflict resolution in §5.1.)

| # | Header | Scope | Type / format | Notes |
|---|---|---|---|---|
| 1 | `title` | workout | string | Workout name (Hevy default-names these, e.g. `Morning workout`). |
| 2 | `start_time` | workout | `"10 Jun 2024, 08:15"` style (see §3) | Session start; identical on every row of the session. |
| 3 | `end_time` | workout | same format as `start_time` | Session end. `end_time − start_time` = workout duration (only duration signal — there is no duration column). |
| 4 | `description` | workout | string | **Workout-level notes.** Often empty. |
| 5 | `exercise_title` | exercise | string | Hevy library style `"Exercise (Equipment)"`: `Bench Press (Barbell)`, `Lat Pulldown (Cable)`. Custom exercises verbatim. |
| 6 | `superset_id` | exercise | small integer or **empty string** | Groups exercises performed as a superset/circuit. Empty string (bare empty cell) when not in one — **never null-literal**. Same id across the whole superset group. |
| 7 | `exercise_notes` | exercise | string | Per-exercise notes. Often empty. |
| 8 | `set_index` | set | integer | Set ordering within the exercise. **Absolute base varies (0 vs 1) — order-only, never take the value as `setNumber`** (canonical §4). |
| 9 | `set_type` | set | string, lowercase in verified sample: `normal` \| `warmup` \| `dropset` \| `failure` | Variants observed/documented: lowercase strings (sample, adamad44 parser), title-case `Normal`/`Warm Up`/`Drop Set`/`Failure` (openweight issue), numeric codes `1`/`2`/`3`/`4` (openweight.dev). Parser: case-insensitive string + numeric-code fallback (§7). |
| 10 | `weight_kg` **or** `weight_lbs` | set | number | Load. Empty for bodyweight/timed/cardio rows. |
| 11 | `reps` | set | integer | Empty when not applicable. |
| 12 | `distance_km` **or** `distance_miles` | set | number | Distance-based rows only. |
| 13 | `duration_seconds` | set | integer | Timed rows only. |
| 14 | `rpe` | set | number 0–10, may be fractional (`8.5`) | Exported **when the user logged RPE** (§6). Empty otherwise. |

## 3. Date/time formats

Multiple formats occur across export versions/locales (openweight.dev
explicitly handles both; verified sample uses the second):

1. `"10 Jun 2024, 08:15"` — `d MMM yyyy, HH:mm` (24h) — **verified in sample** (`"22 Dec 2025, 08:00"`)
2. `"MMM DD, YYYY, h:mm AM/PM"` — 12-hour with AM/PM (anduslau converter documents this emission)
3. ISO 8601 (`2024-01-15T08:30:00Z`-style) in some exports (LiftShift/openweight.dev)

Parser rule: try `d MMM yyyy, h:mm[ ]AM/PM`, then `d MMM yyyy, HH:mm`, then
ISO. No timezone marker in forms 1–2 → treat as local time. **Grouping key =
(`title`, `start_time`)** — both change together at a session boundary.

`durationSec = end_time − start_time` (floor to seconds); if either end is
unparseable, 0.

## 4. Example rows

First four rows verbatim from the verified real export sample
(`matanabudy/workout-data-sync/examples/hevy_export_sample.csv`, kg variant);
rows 5–9 show the documented lbs variant, superset, warm-up, timed, and RPE
patterns from the same corpus of sources:

```csv
title,start_time,end_time,description,exercise_title,superset_id,exercise_notes,set_index,set_type,weight_kg,reps,distance_km,duration_seconds,rpe
"Morning workout","22 Dec 2025, 08:00","22 Dec 2025, 08:37","","Pull Up (Assisted)",,"",0,"normal",21,10,,0,8.5
"Morning workout","22 Dec 2025, 08:00","22 Dec 2025, 08:37","","Leg Press (Machine)",,"",1,"normal",90,12,,0,7.5
"Morning workout","22 Dec 2025, 08:00","22 Dec 2025, 08:37","","Crunch (Weighted)",,"",2,"normal",10,15,,0,8
"Morning workout","22 Dec 2025, 08:00","22 Dec 2025, 08:37","","Seated Shoulder Press (Machine)",,"",3,"normal",25,8,,0,9
"Bench Day","10 Jun 2024, 08:15","10 Jun 2024, 09:05","","Bench Press (Barbell)",,"Pause at bottom",0,"warmup",60,8,,0,
"Bench Day","10 Jun 2024, 08:15","10 Jun 2024, 09:05","","Bench Press (Barbell)",,"",1,"normal",100,8,,0,8
"Bench Day","10 Jun 2024, 08:15","10 Jun 2024, 09:05","","Bent Over Row (Barbell)","1","",0,"normal",70,8,,0,7.5
"Bench Day","10 Jun 2024, 08:15","10 Jun 2024, 09:05","","Plank",,"",0,"normal",,,,60,
```

(Lbs exports are identical with `weight_lbs` replacing `weight_kg`, e.g. `"Bench Day",…,"weight_lbs" header with 135,225` values.)

Parsing walkthrough, row 7 → canonical (already kg):
`{ date: '2024-06-10', startedAt: '2024-06-10T08:15', name: 'Bench Day',
notes: 'Felt strong', durationSec: 3000, source: 'hevy', exercises:
[{ sourceName: 'Bench Press (Barbell)', sets: [{ weight: 100, reps: 8, rpe: 8,
setNumber: 2, isWarmup: false }] }] }` — `setNumber` renumbered across the
exercise's rows (canonical §4).

## 5. Weight units & detection

- **The header column name is the unit signal** — `weight_kg` → kg (no
  conversion), `weight_lbs` → lbs (multiply `0.45359237`, round 2 decimals).
  This is the only source of the three with an in-file unit declaration.
- If a file (round-tripped/edited) contains **both** columns, prefer
  `weight_kg` and fall back to `weight_lbs` per row (openweight.dev rule).
- Legacy/parenthesized variants `Weight (kg)` / `Weight (lbs)` should also be
  accepted (same convention as the Strong-format ecosystem).
- Distance: same pattern — `distance_km` preferred over `distance_miles`.
  Liftit drops distance values (no field) but uses the row-presence rules in
  canonical §1 rule 6.

### 5.1 Conflict resolution — "Hevy always exports lbs"

The openweight GitHub issue (#74) claims weight is "always exported in lbs
regardless of user setting." **Rejected** on the weight of evidence: the
verified export sample uses `weight_kg` with metric-plausible values
(21/90/10/25 kg), the adamad44 Hevy-App-Data-Visualiser parser explicitly
branches on `weight_kg` vs `weight_lbs` headers (i.e., real user files come in
both), and openweight's own published guide says "Hevy's CSV includes weight in
both kg and lbs columns, so units are auto-detected." Issue #74 evidently
described one lbs-configured export. **Binding rule for Liftit: trust the
header name; never assume a fixed unit.**

## 6. RPE — verdict

**Yes — exported when logged.** Verified: `rpe` column with fractional values
(`8.5`, `7.5`, `8`, `9`) in the real sample; LiftShift's Hevy importer and the
HevyExporter project both read RPE from this export; Hevy's Help Center
documents per-set RPE as a first-class feature ("RPE vs RIR"). TraceApps'
claim ("RPE is not exported" by Hevy) is **wrong** for the current export
format. Empty cell → `null` (users who never log RPE get an empty column).

## 7. Supersets — verdict

**Yes — `superset_id` column.** Empty string when the exercise is not in a
superset; a shared small integer (stringify it) groups superset members.
Mapping rule: consecutive exercises sharing a non-empty `superset_id` within
one workout form a group. Liftit v2 has no superset field → preserve in the
import report only (canonical §2); never reorder sets to "interleave" the
group (file order is the truth).

`set_type` normalization (all observed/documented variants):

| Raw value(s) | Meaning | Canonical |
|---|---|---|
| `normal` / `Normal` / `1` | working set | `isWarmup: false` |
| `warmup` / `Warm Up` / `2` | warm-up | `isWarmup: true` |
| `dropset` / `Drop Set` / `3` | drop set | `isWarmup: false` + report note (no Liftit flag) |
| `failure` / `Failure` / `4` | taken to failure | `isWarmup: false` + report note |
| empty | untagged (common) | `isWarmup: false` |

## 8. Notes — three scopes

| Column | Scope | Canonical destination |
|---|---|---|
| `description` | workout | `notes` |
| `exercise_notes` | exercise | import report (Liftit v2 sets have no notes field) |
| (none) | per-set | — Hevy has no per-set notes column; set-level commentary lives in `exercise_notes` |

## 9. Naming quirks & matching

- Hevy library style matches Strong's: `"Exercise (Equipment)"` —
  `Bench Press (Barbell)`, `Back Squat (Barbell)`, `Deadlift (Barbell)`,
  `Lat Pulldown (Cable)`, `Lateral Raise (Dumbbell)`.
- Same alias table as Strong applies (canonical §2): `Back Squat (Barbell)` →
  `Barbell Back Squat`, `Bent Over Row (Barbell)` → `Barbell Row`,
  `Bench Press (Barbell)` → `Barbell Bench Press`.
- Hevy also emits bodyweight variants: `Pull Up (Assisted)`,
  `Crunch (Weighted)` — de-parenthesized match usually lands
  (`Pull-Up`, hanging-leg-raise/cable-crunch need the token ladder); otherwise
  custom exercise.

## 10. Edge cases checklist

- Header detection: snake_case names → Hevy export parser; Strong 12-column
  header → Strong parser. Never run the Strong parser blindly on a Hevy file.
- Unit column missing entirely (malformed) → treat as malformed file, report;
  do not guess (there is no legitimate unitless Hevy export).
- `set_index` may restart per exercise or (in one suspect sample) count
  globally — order-only usage makes this moot.
- Superset empty cell vs `"0"`: `0` is a legitimate superset id in principle;
  treat any non-empty token (including `0`) as an id. Only bare-empty means
  "not in a superset."
- Fractional RPE (`8.5`) — parse as float, don't round.
- 12-hour times (`8:15 PM`) — the `h:mm AM/PM` branch; ambiguous midnight/noon
  values parse per standard rules.
- Edited files with semicolon delimiters + decimal commas — canonical §3
  defensive rules.

## 11. Sources (cross-checked ≥2)

1. Real export sample (fetched): `matanabudy/workout-data-sync → examples/hevy_export_sample.csv` — exact header, date format, 0-based-ish `set_index`, `set_type: normal`, fractional RPE
2. `adamad44/Hevy-App-Data-Visualiser` (`parser.js`, `calculations.js`) — parses real user exports; `weight_kg` vs `weight_lbs` dual detection; `set_type === "warmup"`; duration from `end_time − start_time`
3. `anduslau/health-dashboard → convert_hevy_json_to_csv.py` — documents emission format incl. 12-hour date variant and the full column list
4. openweight.dev — Migrate from Hevy (unit auto-detection, set-type mapping incl. numeric codes, superset preservation, date-format variance, "both kg and lbs columns" statement)
5. Hevy Help Center — export path; "How to Import Strong App CSV…" (confirms export vs import are separate features); "RPE vs RIR" (RPE is first-class)
6. r/Hevy community thread (Jan 2026) — documents Hevy's *import* (Strong-format) file: included here to disambiguate the two formats, not as export evidence
7. TraceApps LiftTrace import docs — Hevy adapter reconstructs superset groupings (corroborates `superset_id` semantics)
