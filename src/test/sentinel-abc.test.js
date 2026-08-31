/**
 * Sentinel gate — adversarial gap-closers for the combined A+B+C phase.
 * These complement (never replace) the suites owned by the phase workers:
 *   - recovery clock skew (out-of-order / future-dated / infinite samples)
 *   - importer throughput on a very large export (~1.6 MB, 20k rows)
 * All assertions are on honest, deterministic outputs.
 */
import { describe, it, expect } from 'vitest';
import { computeReadiness } from '../data/recovery';
import { parseStrongCsv } from '../data/importers/strong';

const day = (i) => new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString();

describe('sentinel · recovery clock skew', () => {
    const flat = (date, i) => ({
        date,
        hrv: 60,
        sleepHours: 8,
        restingHr: 50 + (i % 2), // flat-ish so order shouldn't move the score much
    });

    it('never crashes on out-of-order, future-dated, or duplicated dates', () => {
        const skewed = [
            flat(day(-5), 0), // clock 5 days in the future
            flat(day(1), 1),
            flat(day(1), 2), // duplicate date
            flat(day(2), 3),
            flat('not-a-date', 4), // garbage date string
            flat(day(0), 5),
        ];
        const r = computeReadiness(skewed);
        expect(Number.isFinite(r.score)).toBe(true);
        expect(r.score).toBeGreaterThanOrEqual(0);
        expect(r.score).toBeLessThanOrEqual(100);
        expect(['ready', 'caution', 'fatigued']).toContain(r.status);
    });

    it('is score-stable under reordering when the underlying series is flat', () => {
        const base = [flat(day(2), 0), flat(day(1), 1), flat(day(0), 2)];
        const forward = computeReadiness(base);
        const reversed = computeReadiness([...base].reverse());
        // Flat HRV/RHR → trend 0 either way; sleep identical → same score.
        expect(reversed.score).toBe(forward.score);
        expect(forward.inputs.hrvTrendPct).toBe(0);
        expect(reversed.inputs.hrvTrendPct).toBe(0);
    });

    it('treats ±Infinity metrics as missing (isFinite guard), not as values', () => {
        const r = computeReadiness([
            { date: day(2), hrv: Infinity, sleepHours: -Infinity, restingHr: 50 },
            { date: day(1), hrv: 60, sleepHours: 8, restingHr: Infinity },
            { date: day(0), hrv: 60, sleepHours: 8, restingHr: 50 },
        ]);
        // Infinity metrics excluded from every aggregate; the surviving real
        // values are flat, so the trends are honestly 0 — never NaN/Infinity.
        expect(r.inputs.hrvTrendPct).toBe(0);
        expect(r.inputs.rhrTrendPct).toBe(0);
        expect(r.inputs.sleepAvgHrs).toBe(8);
        expect(Number.isFinite(r.score)).toBe(true);
    });
});

describe('sentinel · importer large-file robustness', () => {
    it('parses a ~20k-row (~1.6 MB) Strong export with honest counts', () => {
        const header = 'Date,Workout Name,Duration,Exercise Name,Set Order,Weight,Reps,Distance,Seconds,Notes,Workout Notes,RPE';
        const rows = [header];
        const days = 500;
        for (let d = 0; d < days; d += 1) {
            const date = new Date(Date.UTC(2025, 0, 1) - d * 24 * 60 * 60 * 1000)
                .toISOString()
                .slice(0, 10);
            for (let s = 1; s <= 40; s += 1) {
                rows.push(
                    `${date} 18:00:00,Volume Block,1h,Bench Press (Barbell),${s},${60 + (s % 10)},8,0,0,,,`,
                );
            }
        }
        const csv = rows.join('\n');
        expect(csv.length).toBeGreaterThan(1_400_000); // ~1.5 MB of rows

        const parsed = parseStrongCsv(csv);
        expect(parsed.ok).toBe(true);
        expect(parsed.stats.totalRows).toBe(days * 40);
        expect(parsed.stats.parsedSets).toBe(days * 40);
        expect(parsed.stats.skippedRows).toBe(0);
        expect(parsed.workouts).toHaveLength(days); // one session per date
        // Spot-check the last session instead of deep-equals on 20k sets.
        const last = parsed.workouts[parsed.workouts.length - 1];
        expect(last.exercises[0].sets).toHaveLength(40);
        expect(last.exercises[0].sets[39].setNumber).toBe(40);
    });
});
