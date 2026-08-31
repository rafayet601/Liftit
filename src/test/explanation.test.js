import { describe, it, expect, beforeEach } from 'vitest';
import { suggestNextSession, explainProgression } from '../engine/progression';
import { weeklyDigest } from '../engine/analytics';
import { parseCoachActions, buildCoachSystemPrompt } from '../ai/coach';
import {
    startSession,
    applySessionAction,
    undoSessionAction,
    getSessionActionLog,
    discardSession,
    makeSessionExercise,
    getActiveSession,
} from '../hooks/useActiveSession';

const targets = { repsMin: 8, repsMax: 12, rpe: 8 };

describe('suggestion explanation', () => {
    it('attaches an explanation even with no history', () => {
        const r = suggestNextSession([], targets);
        expect(r.explanation).toEqual({
            rule: 'start_no_history',
            sessionsAnalyzed: [],
            volumeDeltaPct: null,
            intensityDeltaPct: null,
            plateauWindowWeeks: null,
        });
    });

    it('exposes the sessions analyzed with exact engine values', () => {
        const r = suggestNextSession(
            [{ startedAt: '2026-06-10T10:00:00Z', sets: [{ weight: 80, reps: 12, rpe: 8 }] }],
            targets,
        );
        expect(r.action).toBe('increase');
        expect(r.explanation.rule).toBe('increase_top_of_range');
        expect(r.explanation.sessionsAnalyzed).toEqual([
            { date: '2026-06-10', topWeight: 80, topReps: 12, avgRpe: 8 },
        ]);
        // single session → no deltas to compute
        expect(r.explanation.volumeDeltaPct).toBeNull();
        expect(r.explanation.intensityDeltaPct).toBeNull();
    });

    it('computes real volume/intensity deltas across two sessions', () => {
        const sessions = [
            { startedAt: '2026-06-10T10:00:00Z', sets: [{ weight: 82.5, reps: 12, rpe: 8 }] },
            { startedAt: '2026-06-03T10:00:00Z', sets: [{ weight: 80, reps: 12, rpe: 8 }] },
        ];
        const r = suggestNextSession(sessions, targets);
        const exp = r.explanation;
        expect(exp.volumeDeltaPct).not.toBeNull();
        expect(exp.volumeDeltaPct).toBeGreaterThan(0);
        expect(exp.intensityDeltaPct).toBeGreaterThan(0);
    });

    it('reports the plateau window for a stalled deload', () => {
        const day = 24 * 60 * 60 * 1000;
        const base = Date.now() - 21 * day;
        const stalled = (i) => ({
            startedAt: new Date(base + i * 7 * day).toISOString(),
            sets: [{ weight: 80, reps: 9, rpe: 9 }],
        });
        const r = suggestNextSession([stalled(2), stalled(1), stalled(0)], targets);
        expect(r.action).toBe('deload');
        expect(r.explanation.rule).toBe('deload_stalled_three_sessions');
        expect(r.explanation.plateauWindowWeeks).toBeCloseTo(2, 5);
        // sessions analyzed carry the identical top weight the rule fired on
        expect(r.explanation.sessionsAnalyzed.every((s) => s.topWeight === 80)).toBe(true);
    });

    it('reports the block-plateau window (3+ weeks) when it fires the deload', () => {
        const day = 24 * 60 * 60 * 1000;
        const base = Date.now() - 28 * day;
        const sessions = [3, 2, 1, 0].map((i) => ({
            startedAt: new Date(base + i * 7 * day).toISOString(),
            sets: [
                { weight: 80, reps: 10, rpe: 8 },
                { weight: 80, reps: 10, rpe: 8 },
            ],
        }));
        const r = suggestNextSession(sessions, targets);
        expect(r.explanation.rule).toBe('deload_block_plateau');
        expect(r.explanation.plateauWindowWeeks).toBeGreaterThanOrEqual(3);
    });

    it('explainProgression mirrors the block analysis for the Progress surface', () => {
        const day = 24 * 60 * 60 * 1000;
        const base = Date.now() - 28 * day;
        const sessions = [3, 2, 1, 0].map((i) => ({
            startedAt: new Date(base + i * 7 * day).toISOString(),
            sets: [{ weight: 80, reps: 10, rpe: 8 }],
        }));
        const exp = explainProgression(sessions);
        expect(exp.rule).toBe('deload_block_plateau');
        expect(exp.sessionsAnalyzed.length).toBeGreaterThan(0);
        expect(exp.volumeDeltaPct).toBe(0); // flat history, honestly zero
        expect(exp.plateauWindowWeeks).toBeGreaterThanOrEqual(3);
    });
});

/* ------------------------------------------------------------------ */
describe('weeklyDigest', () => {
    const now = new Date('2026-06-11T12:00:00Z');
    const DAY = 24 * 60 * 60 * 1000;
    const wo = (daysAgo, sets) => ({
        id: `w${daysAgo}`,
        startedAt: new Date(now.getTime() - daysAgo * DAY).toISOString(),
        sets,
    });

    it('degrades to an honest empty state with no workouts', () => {
        const d = weeklyDigest([], null, now);
        expect(d.sessions).toBe(0);
        expect(d.prCount).toBe(0);
        expect(d.acwrStatus).toBe('insufficient_data');
        expect(d.message).toMatch(/No sessions logged yet/i);
    });

    it('assembles the message from real computed values', () => {
        const workouts = [
            wo(1, [{ exerciseId: 'barbell-bench-press', weight: 82.5, reps: 8, setNumber: 1 }]),
            wo(2, [{ exerciseId: 'barbell-back-squat', weight: 100, reps: 6, setNumber: 1 }]),
            wo(9, [{ exerciseId: 'barbell-bench-press', weight: 80, reps: 8, setNumber: 1 }]),
        ];
        const d = weeklyDigest(workouts, null, now);
        expect(d.sessions).toBe(2);
        expect(d.volumeCmp.current).toBe(82.5 * 8 + 100 * 6);
        expect(d.volumeCmp.previous).toBe(80 * 8);
        expect(d.volumeDeltaPct).toBe(Math.round(((d.volumeCmp.current - d.volumeCmp.previous) / d.volumeCmp.previous) * 1000) / 10);
        // PR timeline: bench 82.5 > 80 is the only PR event, and it's within 7 days
        expect(d.prCount).toBe(1);
        expect(d.message).toContain('2 sessions');
        expect(d.message).toContain('+96.9%');
        expect(d.message).toContain('1 PR');
    });

    it('reports zero PRs when the week set no records', () => {
        const workouts = [
            wo(1, [{ exerciseId: 'barbell-bench-press', weight: 70, reps: 8, setNumber: 1 }]),
            wo(9, [{ exerciseId: 'barbell-bench-press', weight: 80, reps: 8, setNumber: 1 }]),
        ];
        const d = weeklyDigest(workouts, null, now);
        expect(d.prCount).toBe(0);
        expect(d.message).toContain('no new PRs');
    });

    it('includes program week context when a program is active', () => {
        const program = {
            name: 'Base Builder',
            startDate: new Date(now.getTime() - 8 * DAY).toISOString(),
            durationWeeks: 6,
            days: [{ isRestDay: true, exercises: [] }],
        };
        const d = weeklyDigest([wo(1, [{ exerciseId: 'e', weight: 50, reps: 10 }])], program, now);
        expect(d.programWeek).toBe('program week 2 of 6');
        expect(d.message).toContain('program week 2 of 6');
    });
});

/* ------------------------------------------------------------------ */
describe('AI action protocol', () => {
    it('parses a trailing strict-JSON action and strips it from the text', () => {
        const session = { exercises: [makeSessionExercise({ exerciseId: 'barbell-bench-press' })] };
        startSession({ name: 'Test', exercises: session.exercises });
        try {
            const key = session.exercises[0].key;
            const reply = `Sure — swapping that in.\n{"action":"rescale_targets","exerciseKey":"${key}","targetSets":25}`;
            const { text, actions } = parseCoachActions(reply);
            expect(actions).toHaveLength(1);
            expect(actions[0]).toEqual({ action: 'rescale_targets', exerciseKey: key, targetSets: 10 }); // clamped
            expect(text).toBe('Sure — swapping that in.');
        } finally {
            discardSession();
        }
    });

    it('parses a fenced json block with an array of actions', () => {
        const ex = [makeSessionExercise({ exerciseId: 'barbell-bench-press' }), makeSessionExercise({ exerciseId: 'barbell-row' })];
        startSession({ name: 'Test', exercises: ex });
        try {
            const reply = [
                'Here is my plan.',
                '```json',
                `[{"action":"swap_exercise","exerciseKey":"${ex[0].key}","newExerciseId":"machine-chest-press"},` +
                    `{"action":"rescale_targets","exerciseKey":"${ex[1].key}","targetSets":4}]`,
                '```',
            ].join('\n');
            const { actions, text } = parseCoachActions(reply);
            expect(actions).toHaveLength(2);
            expect(actions[0].newExerciseId).toBe('machine-chest-press');
            expect(actions[1].targetSets).toBe(4);
            expect(text).toBe('Here is my plan.');
        } finally {
            discardSession();
        }
    });

    it('rejects unknown exercises, bad values, and malformed JSON defensively', () => {
        const ex = [makeSessionExercise({ exerciseId: 'barbell-bench-press' })];
        startSession({ name: 'Test', exercises: ex });
        try {
            const key = ex[0].key;
            const bad = [
                `{"action":"swap_exercise","exerciseKey":"${key}","newExerciseId":"not-a-real-id"}`,
                `{"action":"swap_exercise","exerciseKey":"sx_missing","newExerciseId":"machine-chest-press"}`,
                `{"action":"rescale_targets","exerciseKey":"${key}","targetSets":"lots"}`,
                `{"action":"log_sets","exerciseKey":"${key}","sets":[{}]}`, // not a supported action
                `{this is not json`,
                `{"action":"set_target_reps","exerciseKey":"${key}","repsMin":5,"repsMax":5}`, // min==max → max bumped
            ];
            for (const line of bad) {
                const { actions } = parseCoachActions(`note\n${line}`);
                if (line.includes('set_target_reps')) {
                    expect(actions[0].repsMax).toBe(6); // clamped to keep min < max
                } else {
                    expect(actions).toHaveLength(0);
                }
            }
        } finally {
            discardSession();
        }
    });

    it('returns no actions when there is no active session', () => {
        discardSession();
        const { actions } = parseCoachActions('{"action":"rescale_targets","exerciseKey":"sx_1","targetSets":3}');
        expect(actions).toHaveLength(0);
    });

    it('round-trips a swap through the mutator and undoes it', () => {
        const ex = [makeSessionExercise({ exerciseId: 'barbell-bench-press', targetSets: 3 })];
        startSession({ name: 'Test', exercises: ex });
        try {
            const key = ex[0].key;
            const res = applySessionAction({ action: 'swap_exercise', exerciseKey: key, newExerciseId: 'machine-chest-press' });
            expect(res.ok).toBe(true);
            expect(res.detail).toEqual({ type: 'swap_exercise', from: 'Barbell Bench Press', to: 'Machine Chest Press' });

            const undone = undoSessionAction(res.snapshot);
            expect(undone).toBe(true);
            expect(getSessionActionLog().some((l) => l.action === 'undo')).toBe(true);
        } finally {
            discardSession();
        }
    });

    it('rescale grows the set list but never deletes logged sets', () => {
        const ex = [makeSessionExercise({ exerciseId: 'barbell-bench-press', targetSets: 2 })];
        startSession({ name: 'Test', exercises: ex });
        try {
            const key = ex[0].key;
            const down = applySessionAction({ action: 'rescale_targets', exerciseKey: key, targetSets: 1 });
            expect(down.ok).toBe(true);
            // target shrank, but the existing set rows survive
            expect(getActiveSession().exercises[0].sets).toHaveLength(2);
            expect(getActiveSession().exercises[0].targetSets).toBe(1);
            const up = applySessionAction({ action: 'rescale_targets', exerciseKey: key, targetSets: 5 });
            expect(up.ok).toBe(true);
            expect(getActiveSession().exercises[0].sets).toHaveLength(5);
            expect(getSessionActionLog().at(-1).targetSets).toBe(5);
        } finally {
            discardSession();
        }
    });

    it('the system prompt includes the active session and action protocol', () => {
        const ex = [makeSessionExercise({ exerciseId: 'barbell-bench-press' })];
        startSession({ name: 'Test', exercises: ex });
        try {
            const prompt = buildCoachSystemPrompt();
            expect(prompt).toContain('ACTIVE SESSION');
            expect(prompt).toContain(ex[0].key);
            expect(prompt).toContain('"swap_exercise"');
            expect(prompt).toContain('Machine Chest Press');
        } finally {
            discardSession();
        }
    });
});
