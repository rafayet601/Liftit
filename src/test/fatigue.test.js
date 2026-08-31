import { describe, it, expect } from 'vitest';
import { acwr, applyFatigueContext, applyReadinessContext } from '../engine/fatigue';

/* ------------------------------------------------------------------ */
/* Hand-computed ACWR fixtures.                                        */
/* now = 2026-06-11T12:00:00Z; volume in kg computed from sets.        */
/* ------------------------------------------------------------------ */
const DAY = 24 * 60 * 60 * 1000;
const now = new Date('2026-06-11T12:00:00Z');
const wo = (daysAgo, sets) => ({
    id: `w${daysAgo}`,
    startedAt: new Date(now.getTime() - daysAgo * DAY).toISOString(),
    sets,
});
const set = (weight, reps) => ({ exerciseId: 'e1', weight, reps, setNumber: 1 });

describe('acwr', () => {
    it('returns insufficient_data with no history', () => {
        const r = acwr([], now);
        expect(r.status).toBe('insufficient_data');
        expect(r.ratio).toBeNull();
    });

    it('returns insufficient_data when history spans less than 7 days', () => {
        const workouts = [wo(1, [set(100, 5)]), wo(3, [set(100, 5)])];
        const r = acwr(workouts, now);
        expect(r.status).toBe('insufficient_data');
        expect(r.ratio).toBeNull();
    });

    it('is sufficient once history spans at least 7 days', () => {
        // 8-day span. acute: daysAgo 1 → 1000. chronic: (1000 + 1000)/4 = 500.
        // ratio = 2.0 → spike (boundary check is span sufficiency, not ratio).
        const workouts = [wo(1, [set(100, 10)]), wo(8, [set(100, 10)])];
        const r = acwr(workouts, now);
        expect(r.status).toBe('spike');
        expect(r.ratio).toBe(2);
    });

    it('reports balanced at ratio 1 (even weekly volume)', () => {
        // 1000 kg in each of the 4 weeks → acute 1000, chronic 4000/4 = 1000.
        const workouts = [wo(1, [set(100, 10)]), wo(10, [set(100, 10)]), wo(17, [set(100, 10)]), wo(24, [set(100, 10)])];
        const r = acwr(workouts, now);
        expect(r.status).toBe('balanced');
        expect(r.ratio).toBe(1);
        expect(r.acuteVolume).toBe(1000);
        expect(r.chronicWeeklyVolume).toBe(1000);
    });

    it('flags a spike when acute load exceeds 1.3× chronic', () => {
        // acute: daysAgo 1 + 3 → 2000. chronic: 2000 + 3×500 = 3500/4 = 875.
        // ratio = 2000/875 ≈ 2.29.
        const workouts = [
            wo(1, [set(100, 10)]),
            wo(3, [set(100, 10)]),
            wo(10, [set(50, 10)]),
            wo(17, [set(50, 10)]),
            wo(24, [set(50, 10)]),
        ];
        const r = acwr(workouts, now);
        expect(r.status).toBe('spike');
        expect(r.ratio).toBeCloseTo(2.29, 1);
    });

    it('flags a detrend when acute load falls below 0.8× chronic', () => {
        // acute: daysAgo 2 → 300. chronic: 300 + 3×500 = 1800/4 = 450.
        // ratio = 300/450 ≈ 0.667.
        const workouts = [
            wo(2, [set(60, 5)]),
            wo(10, [set(50, 10)]),
            wo(17, [set(50, 10)]),
            wo(24, [set(50, 10)]),
        ];
        const r = acwr(workouts, now);
        expect(r.status).toBe('detrend');
        expect(r.ratio).toBeCloseTo(0.67, 1);
    });

    it('ignores workouts older than the 28-day window and future dates', () => {
        // 40 days ago is outside chronic; a future log must not count.
        const workouts = [
            wo(1, [set(100, 10)]),
            wo(10, [set(100, 10)]),
            wo(17, [set(100, 10)]),
            wo(24, [set(100, 10)]),
            wo(40, [set(9999, 10)]),
            wo(-5, [set(9999, 10)]),
        ];
        const r = acwr(workouts, now);
        expect(r.status).toBe('balanced');
        expect(r.ratio).toBe(1);
    });

    it('returns insufficient_data when chronic volume is zero (no working sets)', () => {
        const workouts = [wo(1, [{ exerciseId: 'e1', weight: 0, reps: 10 }]), wo(8, [{ exerciseId: 'e1', weight: 0, reps: 10 }])];
        const r = acwr(workouts, now);
        expect(r.status).toBe('insufficient_data');
        expect(r.ratio).toBeNull();
    });

    it('excludes warmup sets from volume', () => {
        const workouts = [
            wo(1, [{ exerciseId: 'e1', weight: 20, reps: 10, isWarmup: true }, set(100, 10)]),
            wo(10, [set(100, 10)]),
            wo(17, [set(100, 10)]),
            wo(24, [set(100, 10)]),
        ];
        const r = acwr(workouts, now);
        expect(r.acuteVolume).toBe(1000);
        expect(r.status).toBe('balanced');
    });
});

describe('applyFatigueContext', () => {
    const noDeload = { shouldDeload: false, reason: 'No deload needed.', suggestedIntensityReduction: 0 };
    const deload = {
        shouldDeload: true,
        reason: 'Both volume and intensity plateaued for 3+ weeks.',
        suggestedIntensityReduction: 0.9,
        plateauWeeks: 3,
    };

    it('escalates to a deload on an ACWR spike', () => {
        const out = applyFatigueContext(noDeload, { status: 'spike', ratio: 1.6, acuteVolume: 2000, chronicWeeklyVolume: 1250 });
        expect(out.shouldDeload).toBe(true);
        expect(out.fatigue.escalated).toBe(true);
        expect(out.reason).toContain('1.6');
        expect(out.reason).toContain('2000');
        expect(out.reason).toContain('1250');
    });

    it('never suppresses an existing deload — only confirms it', () => {
        const out = applyFatigueContext(deload, { status: 'spike', ratio: 1.45, acuteVolume: 2600, chronicWeeklyVolume: 1793 });
        expect(out.shouldDeload).toBe(true);
        expect(out.suggestedIntensityReduction).toBeCloseTo(0.9, 5);
        expect(out.fatigue.escalated).toBe(false);
        expect(out.reason).toContain('1.45');
    });

    it('leaves the recommendation untouched when status is not a spike', () => {
        for (const status of ['balanced', 'detrend', 'insufficient_data']) {
            expect(applyFatigueContext(noDeload, { status, ratio: 1 })).toBe(noDeload);
            expect(applyFatigueContext(deload, { status, ratio: 1 })).toBe(deload);
        }
    });

    it('passes through null inputs', () => {
        expect(applyFatigueContext(null, { status: 'spike', ratio: 2 })).toBeNull();
        expect(applyFatigueContext(noDeload, null)).toBe(noDeload);
    });
});

describe('applyReadinessContext', () => {
    const noDeload = { shouldDeload: false, reason: 'No deload needed — keep progressing.', suggestedIntensityReduction: 0 };
    const deload = { shouldDeload: true, reason: 'Both volume and intensity plateaued for 3+ weeks.', suggestedIntensityReduction: 0.9, plateauWeeks: 3 };

    it('escalates to a deload when readiness is fatigued, citing the real score', () => {
        const out = applyReadinessContext(noDeload, { status: 'fatigued', score: 38 });
        expect(out.shouldDeload).toBe(true);
        expect(out.suggestedIntensityReduction).toBeCloseTo(0.9, 5);
        expect(out.reason).toContain('38');
        expect(out.readiness).toEqual({ status: 'fatigued', score: 38 });
    });

    it('never suppresses an existing deload — only confirms it', () => {
        const out = applyReadinessContext(deload, { status: 'fatigued', score: 30 });
        expect(out.shouldDeload).toBe(true);
        expect(out.plateauWeeks).toBe(3);
        expect(out.reason).toContain('30');
    });

    it('leaves the recommendation untouched for non-fatigued or malformed readiness', () => {
        for (const status of ['ready', 'caution', 'insufficient_data']) {
            expect(applyReadinessContext(noDeload, { status, score: 70 })).toBe(noDeload);
            expect(applyReadinessContext(deload, { status, score: 70 })).toBe(deload);
        }
        expect(applyReadinessContext(noDeload, { status: 'fatigued', score: NaN })).toBe(noDeload);
        expect(applyReadinessContext(null, { status: 'fatigued', score: 20 })).toBeNull();
        expect(applyReadinessContext(noDeload, null)).toBe(noDeload);
    });
});
