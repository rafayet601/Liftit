import { describe, it, expect } from 'vitest';
import { chunk, clampText, D1_MAX_BOUND_PARAMS, LIMITS } from '../../functions/api/_lib';

/**
 * Guards for the Pages Function's D1 limits.
 *
 * GET /api/workouts used to build `WHERE workout_id IN (?,?,…)` with one
 * placeholder per workout. D1 caps a statement at ~100 bound parameters, so
 * the endpoint returned a hard 500 ("too many SQL variables") the moment a
 * user logged their 101st workout — permanently, and silently, because the
 * client swallowed pull errors. These tests pin the invariant that made that
 * possible.
 */

describe('chunk', () => {
    it('never emits a group larger than D1 can bind', () => {
        // 500 is the endpoint's own LIMIT, i.e. the worst case it can hit.
        for (const total of [1, 89, 90, 91, 100, 101, 150, 500]) {
            const ids = Array.from({ length: total }, (_, i) => `w${i}`);
            const groups = chunk(ids);
            expect(groups.every((g) => g.length <= D1_MAX_BOUND_PARAMS)).toBe(true);
            expect(groups.flat()).toEqual(ids);
        }
    });

    it('stays under the real D1 ceiling of 100', () => {
        expect(D1_MAX_BOUND_PARAMS).toBeLessThanOrEqual(100);
    });

    it('handles the 101-workout case that used to 500', () => {
        const groups = chunk(Array.from({ length: 101 }, (_, i) => i));
        expect(groups).toHaveLength(2);
        expect(groups[0]).toHaveLength(90);
        expect(groups[1]).toHaveLength(11);
    });

    it('returns nothing for empty input so callers can skip the query', () => {
        expect(chunk([])).toEqual([]);
        expect(chunk(null)).toEqual([]);
        expect(chunk(undefined)).toEqual([]);
    });

    it('rejects a nonsensical size rather than looping forever', () => {
        expect(() => chunk([1, 2, 3], 0)).toThrow(RangeError);
    });
});

describe('clampText', () => {
    it('truncates oversized input', () => {
        // A single request stored a 1 MB workout name before this existed.
        expect(clampText('A'.repeat(1_000_000), LIMITS.name)).toHaveLength(LIMITS.name);
    });

    it('leaves ordinary values untouched', () => {
        expect(clampText('Upper A', LIMITS.name)).toBe('Upper A');
    });

    it('maps empty and absent values to null so columns stay NULL', () => {
        expect(clampText(null, 10)).toBeNull();
        expect(clampText(undefined, 10)).toBeNull();
        expect(clampText('', 10)).toBeNull();
    });

    it('coerces non-strings before measuring', () => {
        expect(clampText(12345, 3)).toBe('123');
    });
});
