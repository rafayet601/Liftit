import { describe, it, expect } from 'vitest';
import { epley, brzycki, estimate1RM, detectPRs } from '../engine/e1rm';
import { suggestNextSession, sessionsForExercise, getDeloadRecommendation, analyzeDoubleProgression } from '../engine/progression';
import {
    generateProgram,
    phaseForWeek,
    currentProgramWeek,
    scaleTargetsForWeek,
} from '../engine/generator';
import {
    dailyVolumeSeries,
    weeklyVolumeComparison,
    weeklyVolumeTarget,
    muscleGroupSets,
    e1rmTrend,
    prTimeline,
    trainingStreak,
    volumeTrend,
} from '../engine/analytics';
import { getLibraryExercise } from '../data/exercises';

/* ------------------------------------------------------------------ */
describe('e1rm', () => {
    it('matches known formula values', () => {
        expect(epley(100, 1)).toBe(100);
        expect(epley(100, 10)).toBeCloseTo(133.33, 1);
        expect(brzycki(100, 10)).toBeCloseTo(133.33, 1);
        expect(estimate1RM(100, 5)).toBeGreaterThan(110);
        expect(estimate1RM(0, 5)).toBe(0);
        expect(estimate1RM(100, 0)).toBe(0);
    });

    it('caps rep count to avoid junk estimates', () => {
        expect(estimate1RM(60, 30)).toBe(estimate1RM(60, 12));
    });

    it('detects weight, rep, and e1rm PRs against prior history', () => {
        const prior = [
            { weight: 100, reps: 5 },
            { weight: 95, reps: 8 },
        ];
        const today = [
            { weight: 102.5, reps: 5, setNumber: 1 },
            { weight: 95, reps: 9, setNumber: 2 },
        ];
        const prs = detectPRs(today, prior);
        const types = prs.map((p) => p.type);
        expect(types).toContain('weight');
        expect(types).toContain('e1rm');
        expect(types).toContain('reps');
    });

    it('reports no PRs for a first-ever session (no baseline)', () => {
        expect(detectPRs([{ weight: 100, reps: 5 }], [])).toEqual([]);
    });
});

/* ------------------------------------------------------------------ */
describe('progression', () => {
    const targets = { repsMin: 8, repsMax: 12, rpe: 8 };

    it('suggests starting guidance with no history', () => {
        const r = suggestNextSession([], targets);
        expect(r.action).toBe('start');
    });

    it('adds load when every set hit the top of the range', () => {
        const r = suggestNextSession(
            [{ sets: [{ weight: 80, reps: 12, rpe: 8 }, { weight: 80, reps: 12, rpe: 8 }] }],
            targets,
            { units: 'kg', isCompound: true },
        );
        expect(r.action).toBe('increase');
        expect(r.weight).toBeCloseTo(82.5, 1);
    });

    it('holds weight while reps are inside the range', () => {
        const r = suggestNextSession(
            [{ sets: [{ weight: 80, reps: 10, rpe: 8 }] }],
            targets,
        );
        expect(r.action).toBe('hold');
        expect(r.weight).toBe(80);
    });

    it('backs off after a very hard session', () => {
        const r = suggestNextSession(
            [{ sets: [{ weight: 80, reps: 9, rpe: 9.5 }] }],
            targets,
        );
        expect(r.action).toBe('reduce');
        expect(r.weight).toBeLessThan(80);
    });

    it('deloads ~10% after three stalled sessions', () => {
        const stalledSession = { sets: [{ weight: 80, reps: 9, rpe: 9 }] };
        const r = suggestNextSession(
            [stalledSession, stalledSession, stalledSession],
            targets,
        );
        expect(r.action).toBe('deload');
        expect(r.weight).toBeCloseTo(72.5, 0.6);
    });

    it('escalates to a block deload when volume and intensity plateau for 3+ weeks', () => {
        // Flat four weeks: same weight, same reps, RPE fine — the per-session
        // rule alone would say "hold", but the block analyzer sees a plateau.
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
        expect(r.action).toBe('deload');
        expect(r.weight).toBeCloseTo(72.5, 0.6);
        expect(r.reason).toMatch(/plateaued|recover/i);
    });

    it('does not block progression when the block analysis is healthy', () => {
        const day = 24 * 60 * 60 * 1000;
        const base = Date.now() - 14 * day;
        const sessions = [2, 1, 0].map((i) => ({
            startedAt: new Date(base + i * 7 * day).toISOString(),
            sets: [{ weight: 80 + i * 2.5, reps: 12, rpe: 8 }],
        }));
        const r = suggestNextSession(sessions, targets);
        expect(r.action).toBe('increase');
    });

    it('recommends a deload from the block-level analysis', () => {
        const day = 24 * 60 * 60 * 1000;
        const base = Date.now() - 28 * day;
        const sessions = [3, 2, 1, 0].map((i) => ({
            startedAt: new Date(base + i * 7 * day).toISOString(),
            sets: [{ weight: 80, reps: 10, rpe: 8 }],
        }));
        const rec = getDeloadRecommendation(analyzeDoubleProgression(sessions));
        expect(rec.shouldDeload).toBe(true);
        expect(rec.suggestedIntensityReduction).toBeCloseTo(0.9, 5);
    });

    it('groups history per exercise newest-first', () => {
        const workouts = [
            { id: 'w2', startedAt: '2026-06-08', sets: [{ exerciseId: 'a', weight: 82.5, reps: 8 }] },
            { id: 'w1', startedAt: '2026-06-01', sets: [{ exerciseId: 'a', weight: 80, reps: 8 }, { exerciseId: 'b', weight: 40, reps: 10 }] },
        ];
        const sessions = sessionsForExercise(workouts, 'a');
        expect(sessions).toHaveLength(2);
        expect(sessions[0].sets[0].weight).toBe(82.5);
    });
});

/* ------------------------------------------------------------------ */
describe('generator', () => {
    it('picks the split from training frequency', () => {
        expect(generateProgram({ daysPerWeek: 3 }).name).toContain('Full Body');
        expect(generateProgram({ daysPerWeek: 4 }).name).toContain('Upper / Lower');
        expect(generateProgram({ daysPerWeek: 6 }).name).toContain('Push / Pull / Legs');
    });

    it('produces the requested number of days with resolvable exercises', () => {
        const p = generateProgram({ goal: 'strength', daysPerWeek: 4, durationWeeks: 6 });
        expect(p.days).toHaveLength(4);
        for (const day of p.days) {
            expect(day.exercises.length).toBeGreaterThanOrEqual(4);
            for (const e of day.exercises) {
                expect(getLibraryExercise(e.exerciseId)).toBeTruthy();
            }
        }
        expect(p.rationale).toContain('Upper / Lower');
    });

    it('applies goal parameters to compounds', () => {
        const strength = generateProgram({ goal: 'strength', daysPerWeek: 4 });
        const squat = strength.days
            .flatMap((d) => d.exercises)
            .find((e) => e.exerciseId === 'barbell-back-squat');
        expect(squat.targetRepsMax).toBeLessThanOrEqual(6);
    });

    it('respects equipment restrictions', () => {
        const p = generateProgram({ daysPerWeek: 3, equipment: 'home-dumbbell' });
        for (const day of p.days) {
            for (const e of day.exercises) {
                const exercise = getLibraryExercise(e.exerciseId);
                expect(['dumbbell', 'bodyweight', 'kettlebell']).toContain(exercise.equipment);
            }
        }
    });

    it('phases scale volume down and end in a deload', () => {
        expect(phaseForWeek(1, 6).name).toBe('Accumulation');
        expect(phaseForWeek(6, 6).name).toBe('Deload');
        const base = { targetSets: 4, targetRpe: 8 };
        expect(scaleTargetsForWeek(base, 6, 6).targetSets).toBe(2);
        expect(scaleTargetsForWeek(base, 1, 6).targetRpe).toBe(7.5);
    });

    it('computes the current program week from startDate', () => {
        const p = { startDate: new Date(Date.now() - 8 * 24 * 3600 * 1000).toISOString(), durationWeeks: 6 };
        expect(currentProgramWeek(p)).toBe(2);
    });
});

/* ------------------------------------------------------------------ */
describe('analytics', () => {
    const now = new Date('2026-06-11T12:00:00Z');
    const wo = (daysAgo, sets) => ({
        id: `w${daysAgo}`,
        startedAt: new Date(now.getTime() - daysAgo * 24 * 3600 * 1000).toISOString(),
        sets,
    });
    const workouts = [
        wo(1, [{ exerciseId: 'barbell-bench-press', weight: 82.5, reps: 8, setNumber: 1 }]),
        wo(2, [{ exerciseId: 'barbell-back-squat', weight: 100, reps: 6, setNumber: 1 }]),
        wo(9, [{ exerciseId: 'barbell-bench-press', weight: 80, reps: 8, setNumber: 1 }]),
    ];

    it('builds honest series — zero when nothing was logged', () => {
        const series = dailyVolumeSeries([], 7, now);
        expect(series).toHaveLength(7);
        expect(series.every((d) => d.volume === 0)).toBe(true);
    });

    it('compares trailing weeks', () => {
        const { current, previous } = weeklyVolumeComparison(workouts, now);
        expect(current).toBe(82.5 * 8 + 100 * 6);
        expect(previous).toBe(80 * 8);
    });

    it('tallies muscle group sets via the library mapping', () => {
        const tally = muscleGroupSets(workouts, getLibraryExercise, 28, now);
        expect(tally.chest).toBe(2);
        expect(tally.quads).toBe(1);
        expect(tally.triceps).toBe(1); // secondary 0.5 × 2 bench sessions
    });

    it('produces an e1rm trend oldest-first', () => {
        const trend = e1rmTrend(workouts, 'barbell-bench-press');
        expect(trend).toHaveLength(2);
        expect(trend[0].weight).toBe(80);
        expect(trend[1].e1rm).toBeGreaterThan(trend[0].e1rm);
    });

    it('finds PR events chronologically', () => {
        const events = prTimeline(workouts);
        expect(events).toHaveLength(1);
        expect(events[0].exerciseId).toBe('barbell-bench-press');
    });

    it('counts streaks with single rest days allowed', () => {
        expect(trainingStreak([], now)).toBe(0);
        expect(trainingStreak(workouts, now)).toBe(2);
    });

    it('builds a per-session volume trend oldest-first', () => {
        const trend = volumeTrend(workouts, 'barbell-bench-press');
        expect(trend).toHaveLength(2);
        expect(trend[0]).toEqual({ date: expect.any(String), volume: 640 }); // 80 × 8
        expect(trend[1].volume).toBe(660); // 82.5 × 8
        // warmup sets are excluded
        const withWarmup = [
            wo(1, [
                { exerciseId: 'barbell-bench-press', weight: 40, reps: 8, setNumber: 1, isWarmup: true },
                { exerciseId: 'barbell-bench-press', weight: 82.5, reps: 8, setNumber: 2 },
            ]),
        ];
        expect(volumeTrend(withWarmup, 'barbell-bench-press')[0].volume).toBe(660);
    });

    it('derives the weekly volume target from program sets and recent set average', () => {
        const program = {
            days: [
                {
                    isRestDay: false,
                    exercises: [
                        { targetSets: 3 },
                        { targetSets: 3 },
                    ],
                },
                { isRestDay: true, exercises: [] },
            ],
        };
        // Recent 28 days: 3 working sets averaging (82.5×8 + 100×6 + 80×8)/3.
        const avg = (82.5 * 8 + 100 * 6 + 80 * 8) / 3;
        expect(weeklyVolumeTarget(workouts, program, getLibraryExercise, now)).toBe(
            Math.round(avg * 6),
        );
    });

    it('falls back to matching last week when no program is active', () => {
        expect(weeklyVolumeTarget(workouts, null, getLibraryExercise, now)).toBe(640);
    });

    it('returns zero target when there is no data to justify one', () => {
        expect(weeklyVolumeTarget([], null, getLibraryExercise, now)).toBe(0);
        expect(
            weeklyVolumeTarget([], { days: [{ isRestDay: false, exercises: [{ targetSets: 3 }] }] }, getLibraryExercise, now),
        ).toBe(0);
    });
});
