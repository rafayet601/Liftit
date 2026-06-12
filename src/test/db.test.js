import { describe, it, expect, beforeEach } from 'vitest';
import { db, parseRepRange } from '../data/db';

describe('repository', () => {
    beforeEach(() => {
        localStorage.clear();
        db.wipe();
    });

    it('saves and lists workouts newest-first', () => {
        db.workouts.save({ id: 'a', name: 'Old', startedAt: '2026-01-01T10:00:00Z' });
        db.workouts.save({ id: 'b', name: 'New', startedAt: '2026-02-01T10:00:00Z' });
        const list = db.workouts.list();
        expect(list.map((w) => w.id)).toEqual(['b', 'a']);
    });

    it('updates an existing workout in place', () => {
        db.workouts.save({ id: 'a', name: 'First' });
        db.workouts.save({ id: 'a', name: 'Renamed' });
        expect(db.workouts.list()).toHaveLength(1);
        expect(db.workouts.get('a').name).toBe('Renamed');
    });

    it('keeps only one active program', () => {
        db.programs.save({ id: 'p1', name: 'One', isActive: true });
        db.programs.save({ id: 'p2', name: 'Two', isActive: true });
        expect(db.programs.getActive().id).toBe('p2');
        expect(db.programs.get('p1').isActive).toBe(false);
    });

    it('queues sync ops and collapses duplicates per entity', () => {
        db.workouts.save({ id: 'a', name: 'One' });
        db.workouts.save({ id: 'a', name: 'Two' });
        const ops = db.sync.pendingOps().filter((o) => o.type === 'workout.save');
        expect(ops).toHaveLength(1);
        expect(ops[0].payload.name).toBe('Two');
    });

    it('resolves built-in and custom exercises', () => {
        expect(db.exercises.byId('barbell-bench-press').name).toBe('Barbell Bench Press');
        const custom = db.exercises.addCustom({ name: 'Belt Squat', primaryMuscle: 'quads' });
        expect(db.exercises.byId(custom.id).name).toBe('Belt Squat');
        expect(db.exercises.search('belt')[0].id).toBe(custom.id);
    });

    it('round-trips export/import without the AI key', () => {
        db.settings.update({ name: 'Rivu', ai: { provider: 'openai', apiKey: 'secret' } });
        db.workouts.save({ id: 'a', name: 'Push' });
        const json = db.export();
        expect(json).not.toContain('secret');
        db.wipe();
        db.import(json);
        expect(db.workouts.get('a').name).toBe('Push');
        expect(db.settings.get().name).toBe('Rivu');
        expect(db.settings.get().ai.apiKey).toBe('');
    });

    it('ignores AI provider config embedded in an imported backup', () => {
        // The device has its own (empty) AI config.
        db.settings.update({ ai: { provider: 'none', apiKey: '', baseUrl: '' } });
        // A malicious backup tries to repoint the coach at an attacker endpoint.
        const malicious = JSON.stringify({
            version: 2,
            settings: {
                name: 'Victim',
                ai: { provider: 'custom', apiKey: 'planted', baseUrl: 'https://attacker.example/v1' },
            },
            workouts: [],
            programs: [],
            customExercises: [],
        });
        db.import(malicious);
        const ai = db.settings.get().ai;
        // Profile data imports, but AI routing is untouched.
        expect(db.settings.get().name).toBe('Victim');
        expect(ai.provider).toBe('none');
        expect(ai.apiKey).toBe('');
        expect(ai.baseUrl).toBe('');
    });
});

describe('v1 migration', () => {
    it('converts legacy logs and mesocycle into canonical shapes', () => {
        localStorage.clear();
        localStorage.setItem(
            'liftit_data_v1',
            JSON.stringify({
                user: { name: 'Mo', level: 'Advanced' },
                currentMesocycle: {
                    active: true,
                    name: 'Hypertrophy Block 1',
                    weeks: 6,
                    daysPerWeek: 4,
                    focus: 'Hypertrophy',
                    startDate: '2026-05-01T00:00:00Z',
                },
                logs: [
                    {
                        id: 'log-1',
                        date: '2026-05-10T18:00:00Z',
                        name: 'Push Day',
                        duration: 3200,
                        workout: [
                            {
                                name: 'Bench Press',
                                sets: [
                                    { weight: 80, reps: 8, rpe: 8 },
                                    { weight: 80, reps: 7, rpe: 9 },
                                ],
                            },
                            { name: 'Mystery Machine Thing', sets: [{ weight: 30, reps: 12, rpe: 7 }] },
                        ],
                    },
                ],
            }),
        );
        localStorage.setItem('liftit_unit', 'lbs');
        db.__resetForTest?.();

        // Force a fresh load by wiping the module cache path: wipe writes a new
        // doc, so instead remove v2 and re-require via dynamic import isn't
        // available — rely on load() seeing no v2 key.
        localStorage.removeItem('liftit_data_v2');
        const fresh = dbReload();
        const workouts = fresh.workouts.list();
        expect(workouts).toHaveLength(1);
        expect(workouts[0].name).toBe('Push Day');
        expect(workouts[0].sets).toHaveLength(3);
        expect(workouts[0].sets[0].exerciseId).toBe('barbell-bench-press');
        // Unknown exercise becomes a custom one
        const customId = workouts[0].sets[2].exerciseId;
        expect(fresh.exercises.byId(customId).name).toBe('Mystery Machine Thing');
        expect(fresh.programs.getActive().name).toBe('Hypertrophy Block 1');
        expect(fresh.settings.get().units).toBe('lbs');
        expect(fresh.settings.get().experience).toBe('advanced');
    });
});

describe('parseRepRange', () => {
    it('parses ranges, numbers, and garbage', () => {
        expect(parseRepRange('8-12')).toEqual({ targetRepsMin: 8, targetRepsMax: 12 });
        expect(parseRepRange(5)).toEqual({ targetRepsMin: 5, targetRepsMax: 5 });
        expect(parseRepRange('30-60s')).toEqual({ targetRepsMin: 30, targetRepsMax: 60 });
        expect(parseRepRange(null)).toEqual({ targetRepsMin: 8, targetRepsMax: 12 });
    });
});

/**
 * The db module caches its document in module state. For the migration test
 * we need a reload; db.wipe() would erase the legacy fixture's result, so we
 * reach for the internal reset hook if present, else re-import.
 */
function dbReload() {
    if (db.__resetForTest) {
        db.__resetForTest();
        return db;
    }
    return db;
}
