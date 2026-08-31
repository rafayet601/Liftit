import { describe, it, expect } from 'vitest';
import { createProgram } from '../data/schema';
import {
    programToFragment,
    programFromFragment,
    buildShareUrl,
    programFromSearchParams,
    ShareLinkError,
    MAX_SHARE_FRAGMENT_CHARS,
} from '../data/shareLinks';

function sampleProgram(overrides = {}) {
    return createProgram({
        name: 'Push/Pull Power',
        goal: 'strength',
        daysPerWeek: 4,
        durationWeeks: 8,
        rationale: 'Built for pressing volume',
        days: [
            {
                dayNumber: 1,
                name: 'Push A',
                focus: 'chest',
                exercises: [
                    {
                        exerciseId: 'barbell-bench-press',
                        order: 1,
                        targetSets: 4,
                        targetRepsMin: 5,
                        targetRepsMax: 8,
                        targetRpe: 8,
                        restSec: 180,
                    },
                    {
                        exerciseId: 'overhead-press',
                        order: 2,
                        targetSets: 3,
                        targetRepsMin: 8,
                        targetRepsMax: 12,
                        targetRpe: 8,
                        restSec: 120,
                    },
                ],
            },
            {
                dayNumber: 2,
                name: 'Pull A',
                focus: 'back',
                exercises: [
                    {
                        exerciseId: 'barbell-row',
                        order: 1,
                        targetSets: 4,
                        targetRepsMin: 6,
                        targetRepsMax: 10,
                        targetRpe: 8,
                        restSec: 150,
                    },
                ],
            },
        ],
        ...overrides,
    });
}

describe('share links — round trip', () => {
    it('encodes to URL-safe base64url without padding', () => {
        const fragment = programToFragment(sampleProgram());
        expect(fragment).toMatch(/^[A-Za-z0-9_-]+$/);
        expect(fragment).not.toContain('+');
        expect(fragment).not.toContain('/');
        expect(fragment).not.toContain('=');
    });

    it('restores the program faithfully', () => {
        const program = sampleProgram();
        const restored = programFromFragment(programToFragment(program));
        expect(restored.name).toBe('Push/Pull Power');
        expect(restored.goal).toBe('strength');
        expect(restored.daysPerWeek).toBe(4);
        expect(restored.durationWeeks).toBe(8);
        expect(restored.days).toHaveLength(2);
        expect(restored.days[0].name).toBe('Push A');
        expect(restored.days[0].exercises[0]).toMatchObject({
            exerciseId: 'barbell-bench-press',
            targetSets: 4,
            targetRepsMin: 5,
            targetRepsMax: 8,
            targetRpe: 8,
            restSec: 180,
        });
        expect(restored.days[1].exercises[0].exerciseId).toBe('barbell-row');
    });

    it('fills defaults for sparse payloads via createProgram', () => {
        const sparse = createProgram({ name: 'Bare', days: [{ name: 'Day 1' }] });
        const restored = programFromFragment(programToFragment(sparse));
        expect(restored.name).toBe('Bare');
        expect(restored.days[0].exercises).toEqual([]);
        expect(restored.days[0].targetRpe).toBeUndefined(); // untouched day passthrough
        expect(restored.daysPerWeek).toBe(4);
    });

    it('deactivates imported programs and issues a fresh id', () => {
        const program = sampleProgram({ isActive: true, id: 'prog_attacker' });
        const restored = programFromFragment(programToFragment(program));
        expect(restored.isActive).toBe(false);
        expect(restored.id).not.toBe('prog_attacker');
    });

    it('works through buildShareUrl and search params', () => {
        const url = buildShareUrl(sampleProgram(), {
            origin: 'https://liftit.app',
            path: '/program',
        });
        expect(url).toMatch(/^https:\/\/liftit\.app\/program\?program=/);
        const param = new URL(url).searchParams.get('program');
        expect(programFromFragment(param).name).toBe('Push/Pull Power');
        expect(programFromSearchParams(new URLSearchParams(`program=${param}`)).name).toBe(
            'Push/Pull Power',
        );
    });

    it('returns null when no program param exists', () => {
        expect(programFromSearchParams(new URLSearchParams(''))).toBeNull();
        expect(programFromSearchParams(null)).toBeNull();
    });
});

describe('share links — hostile payloads', () => {
    it('rejects empty and non-string fragments', () => {
        expect(() => programFromFragment('')).toThrow(ShareLinkError);
        expect(() => programFromFragment(null)).toThrow(ShareLinkError);
        expect(() => programFromFragment(42)).toThrow(ShareLinkError);
    });

    it('rejects fragments over the 100KB ceiling', () => {
        const huge = 'A'.repeat(MAX_SHARE_FRAGMENT_CHARS + 1);
        expect(() => programFromFragment(huge)).toThrow(/too large/);
    });

    it('rejects non-base64url characters', () => {
        expect(() => programFromFragment('!!!not-base64url!!!')).toThrow(ShareLinkError);
        expect(() => programFromFragment('a+b/c==')).toThrow(ShareLinkError);
    });

    it('rejects valid base64url that is not JSON', () => {
        const notJson = btoa('this is not json')
            .replace(/\+/g, '-')
            .replace(/\//g, '_')
            .replace(/=+$/, '');
        expect(() => programFromFragment(notJson)).toThrow(/not a valid program/);
    });

    it('rejects JSON that is not an object', () => {
        const encode = (s) =>
            btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
        expect(() => programFromFragment(encode('[1,2,3]'))).toThrow(ShareLinkError);
        expect(() => programFromFragment(encode('"string"'))).toThrow(ShareLinkError);
        expect(() => programFromFragment(encode('null'))).toThrow(ShareLinkError);
    });

    it('clamps pathological collections instead of blowing up', () => {
        const hostile = {
            name: 'x'.repeat(10000),
            description: 'y'.repeat(10000),
            daysPerWeek: 9999,
            durationWeeks: 99999,
            days: Array.from({ length: 3 }, (_, d) => ({
                name: `Day ${d}`,
                exercises: Array.from({ length: 25 }, (_, e) => ({
                    exerciseId: 'bench',
                    targetSets: 9999,
                    targetRepsMin: -50,
                    targetRepsMax: 100000,
                    restSec: 99999,
                    notes: 'n'.repeat(1000),
                })),
            })),
        };
        const restored = programFromFragment(programToFragment(hostile));
        expect(restored.name).toHaveLength(200);
        expect(restored.description).toHaveLength(2000);
        expect(restored.daysPerWeek).toBe(7);
        expect(restored.durationWeeks).toBe(52);
        expect(restored.days).toHaveLength(3);
        for (const dayEntry of restored.days) {
            expect(dayEntry.exercises).toHaveLength(20);
            for (const ex of dayEntry.exercises) {
                expect(ex.targetSets).toBeLessThanOrEqual(8);
                expect(ex.targetRepsMin).toBeGreaterThanOrEqual(1);
                expect(ex.targetRepsMax).toBeLessThanOrEqual(100);
                expect(ex.restSec).toBeLessThanOrEqual(600);
                expect(ex.notes.length).toBeLessThanOrEqual(500);
            }
        }
    });

    it('clamps day count and renumbers 1..n', () => {
        const hostile = {
            name: 'Wide',
            days: Array.from({ length: 30 }, (_, d) => ({
                name: `Day ${d}`,
                exercises: [{ exerciseId: 'bench' }],
            })),
        };
        const restored = programFromFragment(programToFragment(hostile));
        expect(restored.days).toHaveLength(14);
        expect(restored.days.map((d) => d.dayNumber)).toEqual(
            Array.from({ length: 14 }, (_, i) => i + 1),
        );
    });

    it('refuses to encode an absurd program (encode-side ceiling)', () => {
        const absurd = {
            name: 'Mega',
            days: Array.from({ length: 14 }, () => ({
                exercises: Array.from({ length: 20 }, () => ({
                    exerciseId: 'bench',
                    notes: 'n'.repeat(500),
                })),
            })),
        };
        expect(() => programToFragment(absurd)).toThrow(/too large/);
    });

    it('never lets a shared link activate itself on arrival', () => {
        const restored = programFromFragment(
            programToFragment(sampleProgram({ isActive: true })),
        );
        expect(restored.isActive).toBe(false);
    });

    it('clamps unknown goal/experience enums to safe values', () => {
        const restored = programFromFragment(
            programToFragment({ ...sampleProgram(), goal: '-drop-tables', experience: '<script>' }),
        );
        expect(restored.goal).toBe('general');
        expect(restored.experience).toBe('intermediate');
    });
});
