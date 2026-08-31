/**
 * Importer tests — golden round-trips for real Strong / Hevy / FitNotes
 * export formats (fixtures inline per .agents/v2/explorer-formats/specs/
 * example rows), plus malformed/hostile inputs. Every assertion checks
 * honest report counts — no fabricated numbers anywhere.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
    parseCsvText,
    parseCsvNumber,
    parseSessionDate,
    parseDurationToken,
    parseTimeToken,
    stripBom,
    resolveSourceName,
    renumberSets,
    lbToKg,
} from '../data/importers/core';
import { parseStrongCsv } from '../data/importers/strong';
import { parseHevyCsv } from '../data/importers/hevy';
import { parseFitNotesCsv } from '../data/importers/fitnotes';
import { db } from '../data/db';

/* ------------------------------------------------------------------ */
/* Golden fixtures — shapes verbatim from the specs' real exports      */
/* ------------------------------------------------------------------ */

// strong.md §4 example rows (rows 1–5 and the swimming row are from a
// real export; plank/MURPH follow documented patterns).
const STRONG_GOLDEN = [
    'Date,Workout Name,Duration,Exercise Name,Set Order,Weight,Reps,Distance,Seconds,Notes,Workout Notes,RPE',
    '2020-12-30 18:51:52,Evening Workout,2h 38m,Snatch (Barbell),1,40.0,3,0,0,,,',
    '2020-12-30 18:51:52,Evening Workout,2h 38m,Snatch (Barbell),2,50.0,2,0,0,,,',
    '2020-12-30 18:51:52,Evening Workout,2h 38m,Bench Press (Barbell),1,80.0,8,0,0,,,',
    '2020-12-30 18:51:52,Evening Workout,2h 38m,Plank,1,0,0,0,60,,,',
    '2020-12-30 18:51:52,Evening Workout,2h 38m,Plank,2,0,0,0,45,,,',
    '2021-05-13 12:00:00,Evening Workout,5m,Swimming,1,0,0,1.0,30,,,',
    '2022-05-30 12:00:00,MURPH,46m,MURPH,1,0,0,0,2762,"Partition the pull-ups | 46:02 | SCALED","No weight vest | SCALED | PR",',
].join('\n');

// hevy.md §4 sample — first four rows verbatim from the verified export,
// rest show warmup / superset / timed / RPE-blank patterns.
const HEVY_GOLDEN = [
    'title,start_time,end_time,description,exercise_title,superset_id,exercise_notes,set_index,set_type,weight_kg,reps,distance_km,duration_seconds,rpe',
    '"Morning workout","22 Dec 2025, 08:00","22 Dec 2025, 08:37","","Pull Up (Assisted)",,"",0,"normal",21,10,,0,8.5',
    '"Morning workout","22 Dec 2025, 08:00","22 Dec 2025, 08:37","","Leg Press (Machine)",,"",1,"normal",90,12,,0,7.5',
    '"Morning workout","22 Dec 2025, 08:00","22 Dec 2025, 08:37","","Crunch (Weighted)",,"",2,"normal",10,15,,0,8',
    '"Morning workout","22 Dec 2025, 08:00","22 Dec 2025, 08:37","","Seated Shoulder Press (Machine)",,"",3,"normal",25,8,,0,9',
    '"Bench Day","10 Jun 2024, 08:15","10 Jun 2024, 09:05","","Bench Press (Barbell)",,"Pause at bottom",0,"warmup",60,8,,0,',
    '"Bench Day","10 Jun 2024, 08:15","10 Jun 2024, 09:05","","Bench Press (Barbell)",,"",1,"normal",100,8,,0,8',
    '"Bench Day","10 Jun 2024, 08:15","10 Jun 2024, 09:05","","Bent Over Row (Barbell)","1","",0,"normal",70,8,,0,7.5',
    '"Bench Day","10 Jun 2024, 08:15","10 Jun 2024, 09:05","","Plank",,"",0,"normal",,,,60,',
].join('\n');

// fitnotes.md §4 rows (Android variant; mixed units + cardio + timed).
const FITNOTES_GOLDEN = [
    'Date,Exercise,Category,Weight,Weight Unit,Reps,Distance,Distance Unit,Time,Comment',
    '2026-04-29,Flies At 35,Chest,14,kgs,12,,,,',
    '2026-05-01,Bench Press,Chest,135,lbs,8,,,,slow tempo',
    '2026-05-02,Treadmill,Cardio,,,,5,km,30:00,zone 2',
    '2026-05-02,Plank,Core,,,,,,01:00,',
    '2026-05-02,Mystery Machine 3000,Unknown,20,stone,5,,,,',
].join('\n');

/* ------------------------------------------------------------------ */
/* Core primitives                                                     */
/* ------------------------------------------------------------------ */

describe('importer core — CSV text parsing', () => {
    it('strips a UTF-8 BOM before header parsing', () => {
        expect(stripBom('\uFEFFDate,Reps')[0]).toBe('D'); // BOM gone
        const rows = parseCsvText('\uFEFFa,b\n1,2');
        expect(rows[0]).toEqual(['a', 'b']);
    });

    it('handles quoted cells: commas, escaped quotes, embedded newlines', () => {
        const rows = parseCsvText('a,b,c\n"x, y","say ""hi""","line1\nline2"');
        expect(rows[1]).toEqual(['x, y', 'say "hi"', 'line1\nline2']);
    });

    it('sniffs semicolon delimiters from Excel round-trips', () => {
        const rows = parseCsvText('a;b\n1;2');
        expect(rows[1]).toEqual(['1', '2']);
    });

    it('skips blank lines but keeps all-empty column rows for the adapters', () => {
        const rows = parseCsvText('a,b\n\n1,2\n');
        expect(rows).toHaveLength(2);
    });
});

describe('importer core — numeric cells (decimal commas, thousands)', () => {
    it.each([
        ['72,5', 72.5], // decimal comma
        ['-12,25', -12.25],
        ['1,275', 1275], // exactly-3-digit final group → thousands
        ['1,275,000', 1275000],
        ['40.0', 40],
        ['135', 135],
        ['', null],
        ['abc', null],
        ['1.2.3', null],
    ])('parses %j → %j', (raw, expected) => {
        expect(parseCsvNumber(raw)).toBe(expected);
    });
});

describe('importer core — dates and durations', () => {
    it.each([
        ['2020-12-30 18:51:52', '2020-12-30'],
        ['2020-12-30 18:51', '2020-12-30'],
        ['2020-12-30T18:51:52', '2020-12-30'],
        ['2026-04-29', '2026-04-29'],
        ['2026/04/29', '2026-04-29'],
        ['22 Dec 2025, 08:00', '2025-12-22'],
        ['10 Jun 2024, 8:15 PM', '2024-06-10'],
        ['Jun 10, 2024, 8:15 AM', '2024-06-10'],
    ])('parses %j → date %j', (raw, date) => {
        expect(parseSessionDate(raw)?.date).toBe(date);
    });

    it('keeps startedAt null for date-only inputs and sets it otherwise', () => {
        expect(parseSessionDate('2026-04-29')?.startedAt).toBeNull();
        expect(parseSessionDate('2020-12-30 18:51:52')?.startedAt).not.toBeNull();
    });

    it('refuses ambiguous day/month orders instead of guessing', () => {
        expect(parseSessionDate('29/04/2026')).toBeNull();
        expect(parseSessionDate('not a date')).toBeNull();
        expect(parseSessionDate('')).toBeNull();
    });

    it('parses Strong duration tokens as elapsed seconds, not clock times', () => {
        expect(parseDurationToken('2h 38m')).toBe(9480);
        expect(parseDurationToken('45m')).toBe(2700);
        expect(parseDurationToken('3h')).toBe(10800);
        expect(parseDurationToken('')).toBe(0);
    });

    it('parses FitNotes Time cells (HH:MM:ss and MM:ss)', () => {
        expect(parseTimeToken('01:00')).toBe(60);
        expect(parseTimeToken('00:30:00')).toBe(1800);
        expect(parseTimeToken('30:00')).toBe(1800);
        expect(parseTimeToken('weird')).toBeNull();
    });
});

describe('importer core — matching ladder', () => {
    it.each([
        ['Bench Press (Barbell)', 'barbell-bench-press'],
        ['Squat (Barbell)', 'barbell-back-squat'],
        ['Deadlift (Barbell)', 'conventional-deadlift'],
        ['Back Squat (Barbell)', 'barbell-back-squat'],
        ['Bent Over Row (Barbell)', 'barbell-row'],
        ['Squats', 'barbell-back-squat'],
        ['Plank', 'plank'],
        ['Preacher Curl - Star Trac', 'preacher-curl'],
        ['Lat Pulldown (Cable)', 'lat-pulldown'],
        ['Totally Unknown Machine 3000', null],
    ])('resolves %j → %j', (sourceName, id) => {
        expect(resolveSourceName(sourceName)?.id ?? null).toBe(id);
    });

    it('never lets a short ambiguous needle mis-hit in reverse', () => {
        // "Squat" must land on Barbell Back Squat via alias, never Front Squat.
        expect(resolveSourceName('Squat').id).toBe('barbell-back-squat');
    });
});

describe('importer core — set renumbering', () => {
    it('sorts stably by order index and renumbers 1..N', () => {
        const out = renumberSets([
            { weight: 3, reps: 1, rpe: null, isWarmup: false, orderIndex: 5 },
            { weight: 1, reps: 1, rpe: null, isWarmup: false, orderIndex: 2 },
            { weight: 2, reps: 1, rpe: null, isWarmup: false, orderIndex: 2 },
        ]);
        expect(out.map((s) => s.weight)).toEqual([1, 2, 3]); // stable among ties
        expect(out.map((s) => s.setNumber)).toEqual([1, 2, 3]);
    });
});

/* ------------------------------------------------------------------ */
/* Strong adapter                                                      */
/* ------------------------------------------------------------------ */

describe('Strong adapter — golden round-trip', () => {
    const parsed = parseStrongCsv(STRONG_GOLDEN);

    it('accepts the real 12-column header and reports kg via the heuristic', () => {
        expect(parsed.ok).toBe(true);
        expect(parsed.unitMode).toBe('kg'); // 0% of (Barbell) sets ≥ 90
        expect(parsed.unitReason).toContain('heuristic');
    });

    it('groups sessions by (Date, Workout Name) — three dates → three workouts', () => {
        expect(parsed.workouts).toHaveLength(3);
        const [w1, w2] = parsed.workouts;
        expect(w1.date).toBe('2020-12-30');
        expect(w1.name).toBe('Evening Workout');
        expect(w2.date).toBe('2021-05-13');
    });

    it('maps every field honestly: duration, notes, per-exercise sets', () => {
        const [w1, , murph] = parsed.workouts;
        expect(w1.durationSec).toBe(9480); // 2h 38m
        expect(w1.startedAt).toContain('2020-12-30T'); // local session start
        expect(w1.exercises.map((e) => e.sourceName)).toEqual([
            'Snatch (Barbell)', 'Bench Press (Barbell)', 'Plank',
        ]);
        expect(w1.exercises[0].sets).toEqual([
            { weight: 40, reps: 3, rpe: null, setNumber: 1, isWarmup: false },
            { weight: 50, reps: 2, rpe: null, setNumber: 2, isWarmup: false },
        ]);
        // Timed row kept with weight 0 / reps 0 (canonical rule 6).
        expect(w1.exercises[2].sets[0]).toEqual({
            weight: 0, reps: 0, rpe: null, setNumber: 1, isWarmup: false,
        });
        // Workout-level notes go to the workout, per-set notes counted only.
        expect(murph.notes).toContain('PR');
        expect(murph.durationSec).toBe(2760); // 46m
        expect(parsed.stats.setNotesObserved).toBe(1);
        expect(parsed.stats.warnings.some((w) => w.includes('per-set note'))).toBe(true);
    });

    it('counts honestly', () => {
        expect(parsed.stats.totalRows).toBe(7);
        expect(parsed.stats.parsedSets).toBe(7);
        expect(parsed.stats.skippedRows).toBe(0);
        expect(parsed.stats.emptyRowsDropped).toBe(0);
    });
});

describe('Strong adapter — W/D set-order codes', () => {
    const csv = [
        'Date,Workout Name,Duration,Exercise Name,Set Order,Weight,Reps,Distance,Seconds,Notes,Workout Notes,RPE',
        '2023-01-05 07:00:00,Push,1h,Bench Press (Barbell),W1,40,8,0,0,,,',
        '2023-01-05 07:00:00,Push,1h,Bench Press (Barbell),W2,60,5,0,0,,,',
        '2023-01-05 07:00:00,Push,1h,Bench Press (Barbell),1,100,5,0,0,,,',
        '2023-01-05 07:00:00,Push,1h,Bench Press (Barbell),D1,60,8,0,0,,,',
    ].join('\n');
    const parsed = parseStrongCsv(csv);

    it('maps W codes to isWarmup and keeps D sets (never drops them)', () => {
        expect(parsed.ok).toBe(true);
        const sets = parsed.workouts[0].exercises[0].sets;
        expect(sets).toHaveLength(4);
        expect(sets.map((s) => s.isWarmup)).toEqual([true, true, false, false]);
        expect(sets.map((s) => s.setNumber)).toEqual([1, 2, 3, 4]); // renumbered, file order
        expect(parsed.stats.dropSetCount).toBe(1);
        expect(parsed.stats.warnings.some((w) => w.includes('Drop set'))).toBe(true);
    });
});

describe('Strong adapter — unit decisions', () => {
    const lbsish = [
        'Date,Workout Name,Duration,Exercise Name,Set Order,Weight,Reps,Distance,Seconds,Notes,Workout Notes,RPE',
        '2024-03-01 10:00:00,Heavy,1h,Squat (Barbell),1,135,5,0,0,,,',
        '2024-03-01 10:00:00,Heavy,1h,Squat (Barbell),2,185,5,0,0,,,',
        '2024-03-01 10:00:00,Heavy,1h,Squat (Barbell),3,225,5,0,0,,,',
    ].join('\n');

    it('auto-detects lbs when ≥30% of (Barbell) sets are ≥ 90, and converts', () => {
        const parsed = parseStrongCsv(lbsish);
        expect(parsed.unitMode).toBe('lbs');
        expect(parsed.unitReason).toContain('3/3');
        // × 0.45359237, rounded to 2 decimals at the edge.
        expect(parsed.workouts[0].exercises[0].sets.map((s) => s.weight)).toEqual([
            lbToKg(135), lbToKg(185), lbToKg(225),
        ]);
        expect(parsed.workouts[0].exercises[0].sets[0].weight).toBe(61.23);
    });

    it('lets the user override the heuristic (user pick always wins)', () => {
        const parsed = parseStrongCsv(lbsish, { unitMode: 'kg' });
        expect(parsed.unitMode).toBe('kg');
        expect(parsed.unitReason).toContain('your selection');
        expect(parsed.workouts[0].exercises[0].sets[0].weight).toBe(135);
    });

    it('a unit-suffixed weight header overrides the heuristic in auto mode', () => {
        const header = 'Date,Workout Name,Duration,Exercise Name,Set Order,Weight (lbs),Reps,Distance,Seconds,Notes,Workout Notes,RPE';
        const csv = [
            header,
            '2024-03-01 10:00:00,Light,1h,Cable Pushdown,1,22.5,12,0,0,,,', // tiny weights…
            '2024-03-01 10:00:00,Light,1h,Cable Pushdown,2,22.5,12,0,0,,,',
        ].join('\n');
        const parsed = parseStrongCsv(csv);
        expect(parsed.unitMode).toBe('lbs'); // …but the header declares lbs
        expect(parsed.unitReason).toContain('header');
        expect(parsed.workouts[0].exercises[0].sets[0].weight).toBe(lbToKg(22.5));
    });
});

describe('Strong adapter — malformed and hostile input', () => {
    it('rejects wrong headers without crashing (Hevy file fed to Strong)', () => {
        const parsed = parseStrongCsv(HEVY_GOLDEN);
        expect(parsed.ok).toBe(false);
        expect(parsed.error).toContain("doesn't look like a Strong export");
        expect(parsed.missingHeaders).toContain('set order');
    });

    it('rejects empty files', () => {
        expect(parseStrongCsv('').ok).toBe(false);
        expect(parseStrongCsv('\n\n').ok).toBe(false);
    });

    it('handles BOM + semicolon delimiter + decimal commas (Excel round-trip)', () => {
        const csv = `\uFEFF${[
            'Date;Workout Name;Duration;Exercise Name;Set Order;Weight;Reps;Distance;Seconds;Notes;Workout Notes;RPE',
            '2020-12-30 18:51:52;Evening Workout;45m;Bench Press (Barbell);1;72,5;8;0;0;;;',
        ].join('\n')}`;
        const parsed = parseStrongCsv(csv);
        expect(parsed.ok).toBe(true);
        expect(parsed.workouts[0].exercises[0].sets[0].weight).toBe(72.5);
        expect(parsed.workouts[0].durationSec).toBe(2700);
    });

    it('reports rows with unparseable dates instead of guessing or crashing', () => {
        const csv = [
            'Date,Workout Name,Duration,Exercise Name,Set Order,Weight,Reps,Distance,Seconds,Notes,Workout Notes,RPE',
            '30/12/2020,Evening Workout,45m,Bench Press (Barbell),1,80,8,0,0,,,',
        ].join('\n');
        const parsed = parseStrongCsv(csv);
        expect(parsed.ok).toBe(true); // file is otherwise parseable
        expect(parsed.workouts).toHaveLength(0);
        expect(parsed.stats.skippedRows).toBe(1);
        expect(parsed.stats.warnings.some((w) => w.includes('date'))).toBe(true);
    });

    it('survives 1000+ char exercise names and CSV-injection cells', () => {
        const longName = `Extreme ${'A'.repeat(1200)} Machine`;
        const csv = [
            'Date,Workout Name,Duration,Exercise Name,Set Order,Weight,Reps,Distance,Seconds,Notes,Workout Notes,RPE',
            `2024-01-01 10:00:00,Day,30m,${longName},1,60,8,0,0,,,`,
            `2024-01-01 10:00:00,Day,30m,=HYPERLINK("http://evil.example","click"),1,60,8,0,0,,,`,
        ].join('\n');
        const parsed = parseStrongCsv(csv);
        expect(parsed.ok).toBe(true);
        expect(parsed.workouts[0].exercises[0].sourceName).toBe(longName);
        // Injection cells are inert strings — stored verbatim, never evaluated.
        expect(parsed.workouts[0].exercises[1].sourceName.startsWith('=')).toBe(true);
    });
});

/* ------------------------------------------------------------------ */
/* Hevy adapter                                                        */
/* ------------------------------------------------------------------ */

describe('Hevy adapter — golden round-trip', () => {
    const parsed = parseHevyCsv(HEVY_GOLDEN);

    it('reads the unit from the header column name', () => {
        expect(parsed.ok).toBe(true);
        expect(parsed.unitMode).toBe('kg');
        expect(parsed.unitReason).toContain('weight_kg');
    });

    it('groups by (title, start_time) and computes duration from end − start', () => {
        expect(parsed.workouts).toHaveLength(2);
        const morning = parsed.workouts[0];
        expect(morning.date).toBe('2025-12-22'); // "22 Dec 2025, 08:00"
        expect(morning.durationSec).toBe(2220); // 08:00 → 08:37
        const benchDay = parsed.workouts[1];
        expect(benchDay.durationSec).toBe(3000); // 08:15 → 09:05
    });

    it('preserves fractional RPE, warm-up flags, and renumbers 0-based set_index', () => {
        const bench = parsed.workouts[1].exercises[0];
        expect(bench.sets[0]).toMatchObject({ weight: 60, reps: 8, rpe: null, setNumber: 1, isWarmup: true });
        expect(bench.sets[1]).toMatchObject({ weight: 100, reps: 8, rpe: 8, setNumber: 2, isWarmup: false });
        const morning = parsed.workouts[0].exercises[0];
        expect(morning.sets[0].rpe).toBe(8.5); // fractional, not rounded
    });

    it('captures superset ids in the report (no Liftit field fabricated)', () => {
        const row = parsed.workouts[1].exercises[1];
        expect(row.sourceName).toBe('Bent Over Row (Barbell)');
        expect(row.supersetId).toBe('1');
        expect(parsed.stats.supersetExercises).toBe(1);
        expect(parsed.stats.warnings.some((w) => w.includes('superset'))).toBe(true);
    });

    it('keeps timed rows with weight 0 and counts honestly', () => {
        const plank = parsed.workouts[1].exercises[2];
        expect(plank.sets[0]).toMatchObject({ weight: 0, reps: 0, rpe: null });
        expect(parsed.stats.totalRows).toBe(8);
        expect(parsed.stats.parsedSets).toBe(8);
        expect(parsed.stats.emptyRowsDropped).toBe(0);
    });
});

describe('Hevy adapter — unit variants', () => {
    const lbsFile = (weightCol) => [
        `title,start_time,end_time,description,exercise_title,superset_id,exercise_notes,set_index,set_type,${weightCol},reps,distance_km,duration_seconds,rpe`,
        `"Bench Day","10 Jun 2024, 08:15","10 Jun 2024, 09:05","","Bench Press (Barbell)",,"",0,"normal",135,5,,0,`,
        `"Bench Day","10 Jun 2024, 08:15","10 Jun 2024, 09:05","","Bench Press (Barbell)",,"",1,"normal",225,3,,0,`,
    ].join('\n');

    it('converts weight_lbs exports to kg at the edge', () => {
        const parsed = parseHevyCsv(lbsFile('weight_lbs'));
        expect(parsed.unitMode).toBe('lbs');
        expect(parsed.workouts[0].exercises[0].sets.map((s) => s.weight)).toEqual([
            lbToKg(135), lbToKg(225),
        ]);
    });

    it('leaves weight_kg exports untouched', () => {
        const parsed = parseHevyCsv(lbsFile('weight_kg'));
        expect(parsed.unitMode).toBe('kg');
        expect(parsed.workouts[0].exercises[0].sets.map((s) => s.weight)).toEqual([135, 225]);
    });

    it('prefers weight_kg per row when a round-tripped file has both columns', () => {
        const csv = [
            'title,start_time,end_time,description,exercise_title,superset_id,exercise_notes,set_index,set_type,weight_kg,weight_lbs,reps,distance_km,duration_seconds,rpe',
            '"Mixed","10 Jun 2024, 08:15",,,"Bench Press (Barbell)",,"",0,"normal",50,,5,,0,',
            '"Mixed","10 Jun 2024, 08:15",,,"Bench Press (Barbell)",,"",1,"normal",,110,5,,0,',
        ].join('\n');
        const parsed = parseHevyCsv(csv);
        expect(parsed.ok).toBe(true);
        expect(parsed.unitMode).toBe('kg');
        const sets = parsed.workouts[0].exercises[0].sets;
        expect(sets[0].weight).toBe(50);
        expect(sets[1].weight).toBe(lbToKg(110)); // 49.9
    });

    it('refuses a unitless file rather than guessing (the Hevy-import bug class)', () => {
        const csv = lbsFile('weight');
        const parsed = parseHevyCsv(csv);
        expect(parsed.ok).toBe(false);
        expect(parsed.error).toContain('weight_kg');
        expect(parsed.error).toContain('guess');
    });
});

describe('Hevy adapter — malformed input', () => {
    it('rejects files without the snake_case export header', () => {
        const parsed = parseHevyCsv(STRONG_GOLDEN);
        expect(parsed.ok).toBe(false);
        expect(parsed.missingHeaders).toContain('start_time');
    });

    it('rejects empty files', () => {
        expect(parseHevyCsv('').ok).toBe(false);
    });

    it('survives a CSV-injection weight cell by reporting it, not crashing', () => {
        const csv = [
            'title,start_time,end_time,description,exercise_title,superset_id,exercise_notes,set_index,set_type,weight_kg,reps,distance_km,duration_seconds,rpe',
            '"D","10 Jun 2024, 08:15",,,"Bench Press (Barbell)",,"",0,"normal",=SUM(A1:A2),8,,0,',
        ].join('\n');
        const parsed = parseHevyCsv(csv);
        expect(parsed.ok).toBe(true);
        // Unparseable number → empty weight → bodyweight-style 0 kg, never a
        // fabricated figure. Honest, and the row is not silently dropped.
        expect(parsed.workouts[0].exercises[0].sets[0].weight).toBe(0);
        expect(parsed.workouts[0].exercises[0].sets[0].reps).toBe(8);
    });
});

/* ------------------------------------------------------------------ */
/* FitNotes adapter                                                    */
/* ------------------------------------------------------------------ */

describe('FitNotes adapter — golden round-trip (Android)', () => {
    const parsed = parseFitNotesCsv(FITNOTES_GOLDEN);

    it('treats units as per-row (mixed-unit files are legal)', () => {
        expect(parsed.ok).toBe(true);
        expect(parsed.unitMode).toBe('mixed');
        const flies = parsed.workouts.find((w) => w.date === '2026-04-29');
        const bench = parsed.workouts.find((w) => w.date === '2026-05-01');
        expect(flies.exercises[0].sets[0].weight).toBe(14); // kgs → kg
        expect(bench.exercises[0].sets[0].weight).toBe(lbToKg(135)); // lbs row
    });

    it('merges same-date rows into ONE session (date-only format)', () => {
        const may2 = parsed.workouts.find((w) => w.date === '2026-05-02');
        expect(may2.exercises.map((e) => e.sourceName)).toEqual([
            'Treadmill', 'Plank', 'Mystery Machine 3000',
        ]);
        expect(may2.name).toBe('Workout');
        expect(may2.startedAt).toBeNull(); // core/db synthesizes 12:00 local
    });

    it('never fabricates RPE, warm-up flags, or workout names', () => {
        for (const w of parsed.workouts) {
            for (const e of w.exercises) {
                for (const s of e.sets) {
                    expect(s.rpe).toBeNull();
                    expect(s.isWarmup).toBe(false);
                }
            }
        }
    });

    it('keeps cardio/timed rows at weight 0 and reports unknown units', () => {
        const may2 = parsed.workouts.find((w) => w.date === '2026-05-02');
        expect(may2.exercises[0].sets[0]).toMatchObject({ weight: 0, reps: 0 }); // treadmill
        expect(may2.exercises[1].sets[0]).toMatchObject({ weight: 0, reps: 0 }); // plank 01:00
        expect(parsed.stats.warnings.some((w) => w.includes('stone'))).toBe(true);
        expect(parsed.stats.setNotesObserved).toBe(2); // 'slow tempo', 'zone 2'
        expect(parsed.stats.parsedSets).toBe(5);
    });
});

describe('FitNotes adapter — iOS variant and edge cases', () => {
    const iosCsv = [
        'Date,Exercise,Category,Weight (kg),Weight (lbs),Reps,Distance,Distance Unit,Time,Notes,Kind',
        '2026-04-29,Bench Press,Chest,100,,8,,,,wr',
        '2026-04-29,Bench Press,Chest,,225,5,,,,wr',
    ].join('\n');

    it('sniffs the iOS variant and reads whichever weight column is filled', () => {
        const parsed = parseFitNotesCsv(iosCsv);
        expect(parsed.ok).toBe(true);
        expect(parsed.workouts[0].exercises[0].sets).toEqual([
            { weight: 100, reps: 8, rpe: null, setNumber: 1, isWarmup: false },
            { weight: lbToKg(225), reps: 5, rpe: null, setNumber: 2, isWarmup: false },
        ]);
    });

    it('parses slash dates but refuses ambiguous day/month orders', () => {
        const slash = parseFitNotesCsv(
            'Date,Exercise,Category,Weight,Weight Unit,Reps,Distance,Distance Unit,Time,Comment\n2026/04/29,Bench Press,Chest,60,kgs,8,,,,',
        );
        expect(slash.workouts[0].date).toBe('2026-04-29');

        const ambiguous = parseFitNotesCsv(
            'Date,Exercise,Category,Weight,Weight Unit,Reps,Distance,Distance Unit,Time,Comment\n29/04/2026,Bench Press,Chest,60,kgs,8,,,,',
        );
        expect(ambiguous.workouts).toHaveLength(0);
        expect(ambiguous.stats.skippedRows).toBe(1);
    });

    it('rejects wrong headers and empty files', () => {
        expect(parseFitNotesCsv(HEVY_GOLDEN).ok).toBe(false);
        expect(parseFitNotesCsv('').ok).toBe(false);
    });
});

/* ------------------------------------------------------------------ */
/* db.importers — preview / commit / collision policy                  */
/* ------------------------------------------------------------------ */

describe('db.importers', () => {
    beforeEach(() => {
        localStorage.clear();
        db.wipe();
    });

    it('preview reports honest counts and never mutates the document', () => {
        const parsed = parseStrongCsv(STRONG_GOLDEN);
        const before = db.get().workouts.length;
        const preview = db.importers.preview(parsed.workouts, { collision: 'skip' });
        expect(preview.workoutCount).toBe(3);
        expect(preview.setCount).toBe(7);
        expect(preview.matchedNames.map((m) => m.id)).toEqual(
            expect.arrayContaining(['barbell-bench-press', 'plank']),
        );
        expect(preview.unmatchedNames).toEqual(
            expect.arrayContaining(['Snatch (Barbell)', 'Swimming', 'MURPH']),
        );
        expect(preview.willImport).toBe(3);
        expect(preview.willSkip).toBe(0);
        expect(db.get().workouts.length).toBe(before); // no mutation
        expect(db.exercises.all().some((e) => e.name === 'Swimming')).toBe(false);
    });

    it('commit creates custom exercises for unmatched names and never drops them', () => {
        const parsed = parseStrongCsv(STRONG_GOLDEN);
        const result = db.importers.commit(parsed.workouts, { collision: 'skip' });
        expect(result.imported).toBe(3);
        expect(result.setCount).toBe(7);
        expect(result.createdCustomExercises.sort()).toEqual(['MURPH', 'Snatch (Barbell)', 'Swimming']);

        const w1 = db.get().workouts.find((w) => w.name === 'Evening Workout' && w.durationSec === 9480);
        expect(w1.sets).toHaveLength(5);
        // createWorkout/createSet normalization: null RPE → 0, isWarmup default false.
        expect(w1.sets.every((s) => s.rpe === 0 && s.isWarmup === false)).toBe(true);
        const snatchSet = w1.sets[0];
        expect(db.exercises.byId(snatchSet.exerciseId).name).toBe('Snatch (Barbell)');
        expect(db.exercises.byId(w1.sets[2].exerciseId).id).toBe('barbell-bench-press');
    });

    it('imports W/D sets with isWarmup preserved and sets renumbered', () => {
        const csv = [
            'Date,Workout Name,Duration,Exercise Name,Set Order,Weight,Reps,Distance,Seconds,Notes,Workout Notes,RPE',
            '2023-01-05 07:00:00,Push,1h,Bench Press (Barbell),W1,40,8,0,0,,,',
            '2023-01-05 07:00:00,Push,1h,Bench Press (Barbell),W2,60,5,0,0,,,',
            '2023-01-05 07:00:00,Push,1h,Bench Press (Barbell),1,100,5,0,0,,,',
        ].join('\n');
        const parsed = parseStrongCsv(csv, { unitMode: 'kg' });
        db.importers.commit(parsed.workouts);
        const w = db.workouts.list()[0];
        expect(w.sets.map((s) => s.isWarmup)).toEqual([true, true, false]);
        expect(w.sets.map((s) => s.setNumber)).toEqual([1, 2, 3]);
        expect(w.sets.map((s) => s.weight)).toEqual([40, 60, 100]); // kg mode
    });

    it('duplicate dates + skip policy: never clobbers logged sets', () => {
        const parsed = parseStrongCsv(STRONG_GOLDEN);
        db.importers.commit(parsed.workouts);

        // Re-import the identical file: all three dates now exist.
        const preview = db.importers.preview(parsed.workouts, { collision: 'skip' });
        expect(preview.willSkip).toBe(3);
        expect(preview.items.every((i) => i.action === 'skip' && i.dateExists)).toBe(true);

        const result = db.importers.commit(parsed.workouts, { collision: 'skip' });
        expect(result.imported).toBe(0);
        expect(result.skipped).toBe(3);
        expect(db.get().workouts).toHaveLength(3); // untouched
    });

    it('duplicate dates + replace policy: drops the existing workout, inserts the import', () => {
        const parsed = parseStrongCsv(STRONG_GOLDEN);
        // Seed one local workout on 2020-12-30 (local-noon start, same
        // local-date key the import computes).
        db.workouts.save({
            id: 'old-one',
            name: 'Old Log',
            startedAt: new Date('2020-12-30T12:00:00').toISOString(),
        });
        const preview = db.importers.preview(parsed.workouts, { collision: 'replace' });
        expect(preview.items.find((i) => i.date === '2020-12-30').action).toBe('replace');
        expect(preview.willReplace).toBe(1);

        const result = db.importers.commit(parsed.workouts, { collision: 'replace' });
        expect(result.imported).toBe(3);
        expect(result.replaced).toBe(1);
        expect(result.removedWorkouts).toBe(1);
        expect(db.workouts.get('old-one')).toBeNull();
        expect(db.get().workouts.filter((w) => w.name === 'Evening Workout')).toHaveLength(2);
        // Non-colliding date committed unconditionally.
        expect(db.get().workouts.some((w) => w.durationSec === 2760)).toBe(true);
    });

    it('does not duplicate custom exercises on re-commit after a replace', () => {
        const parsed = parseStrongCsv(STRONG_GOLDEN);
        db.importers.commit(parsed.workouts, { collision: 'skip' });
        const customs = db.get().customExercises.length;
        const second = db.importers.commit(parsed.workouts, { collision: 'replace' });
        expect(second.createdCustomExercises).toHaveLength(0); // deduped by name
        expect(db.get().customExercises).toHaveLength(customs);
    });

    it('leaves bodyweight entries, the sync queue, and AI config untouched', () => {
        db.settings.update({ ai: { provider: 'openai', apiKey: 'secret-key' } });
        db.bodyweight.add({ date: new Date().toISOString(), weightKg: 82.5 });
        const parsed = parseStrongCsv(STRONG_GOLDEN);
        db.importers.commit(parsed.workouts);
        expect(db.bodyweight.list()).toHaveLength(1);
        expect(db.settings.get().ai.apiKey).toBe('secret-key');
        // Bulk imports are local-first writes (importRemote precedent): they
        // must not echo every historical set into the sync queue.
        expect(db.sync.pendingOps()).toHaveLength(0);
    });

    it('handles hostile exercise names end-to-end via the custom fallback', () => {
        const longName = `Extreme ${'A'.repeat(1200)} Machine`;
        const csv = [
            'Date,Workout Name,Duration,Exercise Name,Set Order,Weight,Reps,Distance,Seconds,Notes,Workout Notes,RPE',
            `2024-01-01 10:00:00,Day,30m,${longName},1,60,8,0,0,,,`,
            `2024-01-01 10:00:00,Day,30m,=cmd|' /C calc'!A1,1,60,8,0,0,,,`,
        ].join('\n');
        const parsed = parseStrongCsv(csv);
        const result = db.importers.commit(parsed.workouts);
        expect(result.imported).toBe(1);
        expect(result.createdCustomExercises).toHaveLength(2);
        const customs = db.get().customExercises;
        expect(customs.some((c) => c.name === longName && c.name.length > 1000)).toBe(true);
        // Injection cell stored as an inert literal string.
        expect(customs.some((c) => c.name.startsWith('=cmd|'))).toBe(true);
    });

    it('commits Hevy and FitNotes goldens with honest set counts', () => {
        const hevy = parseHevyCsv(HEVY_GOLDEN);
        const hevyResult = db.importers.commit(hevy.workouts);
        expect(hevyResult.imported).toBe(2);
        expect(hevyResult.setCount).toBe(8);

        const fitnotes = parseFitNotesCsv(FITNOTES_GOLDEN);
        const fnResult = db.importers.commit(fitnotes.workouts);
        expect(fnResult.imported).toBe(3);
        expect(fnResult.setCount).toBe(5); // flies + bench + treadmill + plank + machine
        // Mixed-unit FitNotes: 135 lbs row landed as kg, 14 kgs row unchanged.
        const fnWorkouts = db.get().workouts.filter((w) => w.name === 'Workout');
        const allSets = fnWorkouts.flatMap((w) => w.sets);
        expect(allSets.some((s) => s.weight === 14)).toBe(true);
        expect(allSets.some((s) => s.weight === lbToKg(135))).toBe(true);
    });
});
