import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
    callTool,
    estimate1RM,
    formatToolResult,
    liftit_exercise_history,
    liftit_list_exercises,
    liftit_overview,
    liftit_progression,
    liftit_recent_workouts,
    loadDoc,
    titleCaseId,
} from '../../mcp/tools.js';

const NOW = new Date('2026-08-30T12:00:00Z');

function benchSets(weight, reps = 5, count = 4) {
    return Array.from({ length: count }, (_, i) => ({
        exerciseId: 'barbell-bench-press',
        setNumber: i + 1,
        weight,
        reps,
        rpe: 8,
        isWarmup: false,
    }));
}

function squatSets(weight, reps = 5, count = 3) {
    return Array.from({ length: count }, (_, i) => ({
        exerciseId: 'back-squat',
        setNumber: i + 1,
        weight,
        reps,
        rpe: 8,
        isWarmup: false,
    }));
}

function fixtureDoc() {
    return {
        version: 3,
        settings: { units: 'kg' },
        workouts: [
            {
                id: 'wo1',
                name: 'Push Day',
                programId: 'prog1',
                programDayNumber: 1,
                startedAt: '2026-08-26T10:00:00Z',
                completedAt: '2026-08-26T11:00:00Z',
                durationSec: 3600,
                notes: '',
                sets: [
                    ...benchSets(100, 5, 4),
                    { exerciseId: 'back-squat', setNumber: 5, weight: 60, reps: 5, isWarmup: true },
                    ...squatSets(140, 5, 3),
                ],
            },
            {
                id: 'wo2',
                name: 'Push Day',
                startedAt: '2026-08-28T10:00:00Z',
                durationSec: 3000,
                sets: benchSets(101, 5, 4),
            },
            {
                id: 'wo3',
                name: 'Leg Day',
                startedAt: '2026-08-29T10:00:00Z',
                durationSec: 2700,
                sets: squatSets(145, 5, 3),
            },
        ],
        programs: [
            {
                id: 'prog1',
                name: 'Foundation Push/Pull',
                isActive: true,
                startDate: '2026-08-22T12:00:00Z',
                durationWeeks: 6,
                days: [],
            },
        ],
        customExercises: [],
        bodyweightEntries: [
            { id: 'bw1', date: '2026-08-21T08:00:00Z', weightKg: 81.2, source: 'manual' },
            { id: 'bw2', date: '2026-08-28T08:00:00Z', weightKg: 80.5, source: 'manual' },
        ],
    };
}

function threeSessionFlatDoc() {
    return {
        version: 3,
        workouts: ['2026-08-10T10:00:00Z', '2026-08-17T10:00:00Z', '2026-08-24T10:00:00Z'].map(
            (startedAt, i) => ({
                id: `flat${i}`,
                name: 'Bench',
                startedAt,
                sets: benchSets(100, 5, 3),
            }),
        ),
        programs: [],
        customExercises: [],
        bodyweightEntries: [],
    };
}

function regressingDoc() {
    return {
        version: 3,
        workouts: [
            {
                id: 'r1',
                name: 'Press',
                startedAt: '2026-08-20T10:00:00Z',
                sets: benchSets(50, 5, 4).map((s) => ({ ...s, exerciseId: 'overhead-press' })),
            },
            {
                id: 'r2',
                name: 'Press',
                startedAt: '2026-08-27T10:00:00Z',
                sets: benchSets(47.5, 5, 4).map((s) => ({ ...s, exerciseId: 'overhead-press' })),
            },
        ],
        programs: [],
        customExercises: [],
        bodyweightEntries: [],
    };
}

let rawCounter = 0;
function rawDoc(json) {
    return loadDoc(writeTmp(`raw-${++rawCounter}.json`, json));
}

let dir;
let fixturePath;

function writeTmp(name, content) {
    const path = join(dir, name);
    writeFileSync(path, typeof content === 'string' ? content : JSON.stringify(content));
    return path;
}

beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), 'liftit-mcp-test-'));
    fixturePath = writeTmp('liftit_data.json', fixtureDoc());
    writeTmp('v1.json', { version: 1, workouts: [] });
    writeTmp('empty.json', { version: 3, workouts: [], programs: [], bodyweightEntries: [] });
    writeTmp('bad.json', '{ not valid json');
    writeTmp(
        'weird.json', {
            version: 3,
            workouts: [
                { id: 'ok', name: 'Fine', startedAt: '2026-08-25T10:00:00Z', sets: [{ exerciseId: 'pull-ups', weight: '10', reps: '8' }] },
                { id: 'broken', name: 'Bad date', startedAt: 'not-a-date', sets: [{ exerciseId: 'x', weight: 100, reps: 5 }] },
            ],
            programs: [],
            bodyweightEntries: [{ date: 'nope', weightKg: 70 }],
        });
});

afterAll(() => {
    rmSync(dir, { recursive: true, force: true });
});

describe('loadDoc', () => {
    it('loads and normalizes a v3 export', () => {
        const doc = loadDoc(fixturePath);
        expect(doc.version).toBe(3);
        expect(doc.workouts).toHaveLength(3);
        expect(doc.workouts[0].sets[0]).toMatchObject({
            exerciseId: 'barbell-bench-press',
            weight: 100,
            reps: 5,
            isWarmup: false,
        });
        expect(doc.programs[0].name).toBe('Foundation Push/Pull');
        expect(doc.bodyweightEntries).toHaveLength(2);
    });

    it('rejects unsupported versions with a clear error', () => {
        expect(() => loadDoc(join(dir, 'v1.json'))).toThrowError(/Unsupported Liftit export version: 1/);
        expect(() => loadDoc(join(dir, 'v1.json'))).toThrowError(/version 2 or 3/);
    });

    it('rejects invalid JSON and unreadable paths', () => {
        expect(() => loadDoc(join(dir, 'bad.json'))).toThrowError(/Invalid JSON/);
        expect(() => loadDoc(join(dir, 'missing.json'))).toThrowError(/Cannot read Liftit export/);
    });

    it('re-reads the file on every load — a re-exported doc is picked up (no cache)', () => {
        const path = writeTmp('reread.json', {
            version: 3,
            workouts: [{ id: 'a', name: 'One', startedAt: '2026-08-20T10:00:00Z', sets: [] }],
            programs: [],
            customExercises: [],
            bodyweightEntries: [],
        });
        expect(loadDoc(path).workouts).toHaveLength(1);
        writeFileSync(path, JSON.stringify({
            version: 3,
            workouts: [
                { id: 'a', name: 'One', startedAt: '2026-08-20T10:00:00Z', sets: [] },
                { id: 'b', name: 'Two', startedAt: '2026-08-21T10:00:00Z', sets: [] },
            ],
            programs: [],
            customExercises: [],
            bodyweightEntries: [],
        }));
        // server.js calls loadDoc per tool call, so an updated export is
        // served without restarting the server.
        expect(loadDoc(path).workouts).toHaveLength(2);
    });

    it('drops workouts with unparseable dates and coerces set fields', () => {
        const doc = loadDoc(join(dir, 'weird.json'));
        expect(doc.workouts).toHaveLength(1);
        expect(doc.workouts[0].sets[0]).toMatchObject({ exerciseId: 'pull-ups', weight: 10, reps: 8 });
        expect(doc.bodyweightEntries).toHaveLength(0);
    });
});

describe('estimate1RM (Epley/Brzycki blend, 12-rep cap)', () => {
    it('matches known values', () => {
        expect(estimate1RM(100, 1)).toBe(100);
        expect(estimate1RM(100, 5)).toBe(114.6);
        expect(estimate1RM(100, 5)).toBeGreaterThan(110);
        expect(estimate1RM(140, 5)).toBe(160.4);
        expect(estimate1RM(102.5, 5)).toBe(117.4);
        expect(estimate1RM(145, 5)).toBe(166.1);
    });

    it('caps reps at 12 and returns 0 for invalid input', () => {
        expect(estimate1RM(100, 20)).toBe(estimate1RM(100, 12));
        expect(estimate1RM(0, 5)).toBe(0);
        expect(estimate1RM(100, 0)).toBe(0);
    });
});

describe('liftit_overview', () => {
    it('computes counts, dates, volume, streak, program week and bodyweight from the doc', () => {
        const doc = loadDoc(fixturePath);
        const overview = liftit_overview(doc, NOW);
        expect(overview).toEqual({
            workoutCount: 3,
            firstWorkoutDate: '2026-08-26',
            lastWorkoutDate: '2026-08-29',
            totalVolumeKg: 8295,
            currentStreak: 3,
            activeProgram: { name: 'Foundation Push/Pull', week: 2, totalWeeks: 6 },
            bodyweightLatest: { date: '2026-08-28', weightKg: 80.5 },
        });
    });

    it('counts the streak across a single rest day', () => {
        const doc = loadDoc(fixturePath);
        expect(doc.workouts.map((w) => w.startedAt.slice(0, 10))).toEqual([
            '2026-08-26',
            '2026-08-28',
            '2026-08-29',
        ]);
        expect(liftit_overview(doc, NOW).currentStreak).toBe(3);
        expect(liftit_overview(doc, new Date('2026-09-15T12:00:00Z')).currentStreak).toBe(0);
    });

    it('returns honest empty values for an empty doc', () => {
        const doc = loadDoc(join(dir, 'empty.json'));
        expect(liftit_overview(doc, NOW)).toEqual({
            workoutCount: 0,
            firstWorkoutDate: null,
            lastWorkoutDate: null,
            totalVolumeKg: 0,
            currentStreak: 0,
            activeProgram: null,
            bodyweightLatest: null,
        });
    });
});

describe('liftit_list_exercises', () => {
    it('lists distinct exercises newest-first with real per-lift stats', () => {
        const doc = loadDoc(fixturePath);
        expect(liftit_list_exercises(doc)).toEqual([
            { exerciseId: 'back-squat', sessions: 2, lastDate: '2026-08-29', bestE1rmKg: 166.1 },
            { exerciseId: 'barbell-bench-press', sessions: 2, lastDate: '2026-08-28', bestE1rmKg: 115.7 },
        ]);
    });

    it('excludes warmup sets and returns [] for empty docs', () => {
        const doc = loadDoc(fixturePath);
        const squat = liftit_list_exercises(doc).find((e) => e.exerciseId === 'back-squat');
        expect(squat.bestE1rmKg).toBe(166.1);
        expect(liftit_list_exercises(loadDoc(join(dir, 'empty.json')))).toEqual([]);
    });
});

describe('liftit_exercise_history', () => {
    it('returns newest-first per-session records', () => {
        const doc = loadDoc(fixturePath);
        expect(liftit_exercise_history(doc, { exerciseId: 'barbell-bench-press' })).toEqual([
            {
                date: '2026-08-28',
                topWeightKg: 101,
                topRepsAtTopWeight: 5,
                e1rmKg: 115.7,
                sessionVolumeKg: 2020,
            },
            {
                date: '2026-08-26',
                topWeightKg: 100,
                topRepsAtTopWeight: 5,
                e1rmKg: 114.6,
                sessionVolumeKg: 2000,
            },
        ]);
    });

    it('respects limit and returns [] for unknown exercises', () => {
        const doc = loadDoc(fixturePath);
        expect(liftit_exercise_history(doc, { exerciseId: 'barbell-bench-press', limit: 1 })).toHaveLength(1);
        expect(liftit_exercise_history(doc, { exerciseId: 'leg-press' })).toEqual([]);
    });

    it('throws on missing exerciseId', () => {
        const doc = loadDoc(fixturePath);
        expect(() => liftit_exercise_history(doc, {})).toThrowError(/exerciseId/);
    });
});

describe('liftit_recent_workouts', () => {
    it('returns newest-first sessions with title-cased slug names and working-set counts', () => {
        const doc = loadDoc(fixturePath);
        const recent = liftit_recent_workouts(doc, {});
        expect(recent).toEqual([
            {
                date: '2026-08-29',
                name: 'Leg Day',
                durationMin: 45,
                volumeKg: 2175,
                setCount: 3,
                exercises: ['Back Squat'],
            },
            {
                date: '2026-08-28',
                name: 'Push Day',
                durationMin: 50,
                volumeKg: 2020,
                setCount: 4,
                exercises: ['Barbell Bench Press'],
            },
            {
                date: '2026-08-26',
                name: 'Push Day',
                durationMin: 60,
                volumeKg: 4100,
                setCount: 7,
                exercises: ['Barbell Bench Press', 'Back Squat'],
            },
        ]);
    });

    it('respects limit, uses custom exercise names when resolvable, and returns [] for empty docs', () => {
        const doc = loadDoc(fixturePath);
        expect(liftit_recent_workouts(doc, { limit: 2 })).toHaveLength(2);
        const withCustom = {
            ...fixtureDoc(),
            customExercises: [{ id: 'custom_abc', name: 'Mystery Machine Row' }],
            workouts: [
                {
                    id: 'w9',
                    name: 'Extras',
                    startedAt: '2026-08-27T10:00:00Z',
                    sets: [
                        { exerciseId: 'custom_abc', weight: 30, reps: 10, isWarmup: false },
                        { exerciseId: 'never-done-before', weight: 20, reps: 10, isWarmup: false },
                    ],
                },
            ],
        };
        expect(liftit_recent_workouts(rawDoc(withCustom), {})[0].exercises).toEqual([
            'Mystery Machine Row',
            'Never Done Before',
        ]);
        expect(liftit_recent_workouts(loadDoc(join(dir, 'empty.json')), {})).toEqual([]);
    });
});

describe('liftit_progression', () => {
    it('verdicts holding for small gains on two sessions', () => {
        const doc = loadDoc(fixturePath);
        const result = liftit_progression(doc, { exerciseId: 'barbell-bench-press' });
        expect(result.analysis.trend).toBe('holding');
        expect(result.analysis.volumeProgressionPercent).toBeCloseTo(1.0, 5);
        expect(result.analysis.intensityProgressionPercent).toBeCloseTo(1.0, 5);
        expect(result.sessions[0]).toEqual({
            date: '2026-08-28',
            topWeightKg: 101,
            avgRepsAtTopWeight: 5,
            e1rmKg: 115.7,
            volumePerSetKg: 505,
        });
        expect(result.sessions).toHaveLength(2);
    });

    it('verdicts progressing for a clear jump', () => {
        const doc = loadDoc(fixturePath);
        const result = liftit_progression(doc, { exerciseId: 'back-squat' });
        expect(result.analysis.trend).toBe('progressing');
        expect(result.analysis.volumeProgressionPercent).toBeCloseTo(3.6, 5);
        expect(result.analysis.intensityProgressionPercent).toBeCloseTo(3.6, 5);
    });

    it('verdicts plateaued for three flat sessions', () => {
        const result = liftit_progression(threeSessionFlatDoc(), { exerciseId: 'barbell-bench-press' });
        expect(result.analysis.trend).toBe('plateaued');
        expect(result.analysis.isVolumePlateau).toBe(true);
        expect(result.analysis.isIntensityPlateau).toBe(true);
    });

    it('verdicts regressing for declining loads', () => {
        const result = liftit_progression(regressingDoc(), { exerciseId: 'overhead-press' });
        expect(result.analysis.trend).toBe('regressing');
        expect(result.analysis.volumeProgressionPercent).toBeCloseTo(-5, 5);
    });

    it('is honestly insufficient for unknown or single-session lifts', () => {
        const doc = loadDoc(fixturePath);
        const unknown = liftit_progression(doc, { exerciseId: 'leg-press' });
        expect(unknown.sessions).toEqual([]);
        expect(unknown.analysis.trend).toBe('insufficient_data');
        expect(unknown.analysis.volumeProgressionPercent).toBeNull();

        const single = {
            version: 3,
            workouts: [
                { id: 's1', name: 'One', startedAt: '2026-08-20T10:00:00Z', sets: benchSets(100, 5, 1) },
            ],
            programs: [],
            customExercises: [],
            bodyweightEntries: [],
        };
        const result = liftit_progression(rawDoc(single), { exerciseId: 'barbell-bench-press' });
        expect(result.sessions).toHaveLength(1);
        expect(result.analysis.trend).toBe('insufficient_data');
    });
});

describe('tool surface plumbing', () => {
    it('dispatches known tools and throws on unknown tools', () => {
        const doc = loadDoc(fixturePath);
        expect(callTool(doc, 'liftit_overview', {}, { now: NOW }).workoutCount).toBe(3);
        expect(callTool(doc, 'liftit_list_exercises')).toHaveLength(2);
        expect(() => callTool(doc, 'nope', {})).toThrowError('Unknown tool: nope');
    });

    it('reports malformed args as errors', () => {
        const doc = loadDoc(fixturePath);
        expect(() => callTool(doc, 'liftit_exercise_history', {})).toThrowError(/exerciseId/);
        expect(() => callTool(doc, 'liftit_progression', { exerciseId: '' })).toThrowError(/exerciseId/);
    });

    it('wraps results in MCP content format', () => {
        const doc = loadDoc(fixturePath);
        const response = formatToolResult(callTool(doc, 'liftit_overview', {}, { now: NOW }));
        expect(response).toEqual({
            content: [{ type: 'text', text: JSON.stringify(liftit_overview(doc, NOW), null, 2) }],
        });
    });
});

describe('honest naming', () => {
    it('title-cases slugs without inventing names', () => {
        expect(titleCaseId('barbell-bench-press')).toBe('Barbell Bench Press');
        expect(titleCaseId('pull-ups')).toBe('Pull Ups');
        expect(titleCaseId('leg_press')).toBe('Leg Press');
    });
});
