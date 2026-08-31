import { describe, it, expect, beforeEach } from 'vitest';
import {
    SCHEMA_VERSION,
    createDocument,
    createSettings,
    createBodyweightEntry,
} from '../data/schema';
import { db } from '../data/db';

const STORAGE_KEY = 'liftit_data_v2';

describe('schema v3', () => {
    it('bumps SCHEMA_VERSION to 3 and defaults new collections', () => {
        expect(SCHEMA_VERSION).toBe(3);
        const doc = createDocument();
        expect(doc.version).toBe(3);
        expect(doc.bodyweightEntries).toEqual([]);
    });

    it('normalizes bodyweight entries and coerces bad weights', () => {
        const entry = createBodyweightEntry({ date: '2026-08-01T00:00:00Z', weightKg: '82.5' });
        expect(entry.weightKg).toBe(82.5);
        expect(entry.source).toBe('manual');
        expect(entry.id).toBeTruthy();
        expect(createBodyweightEntry({ weightKg: 'abc', source: 'import' }).weightKg).toBe(0);
        expect(createBodyweightEntry({ weightKg: 80, source: 'import' }).source).toBe('import');
        expect(createBodyweightEntry({ weightKg: 80, source: 'garbage' }).source).toBe('manual');
    });

    it('defaults recovery settings off and preserves explicit values', () => {
        expect(createSettings().recovery).toEqual({ enabled: false });
        expect(createSettings({ recovery: { enabled: true } }).recovery.enabled).toBe(true);
    });

    it('adds recovery + bodyweight defaults to legacy v2 settings without dropping fields', () => {
        const settings = createSettings({
            name: 'Rivu',
            units: 'lbs',
            ai: { provider: 'openai', model: 'gpt', apiKey: 'k', baseUrl: '' },
        });
        expect(settings.name).toBe('Rivu');
        expect(settings.units).toBe('lbs');
        expect(settings.ai.model).toBe('gpt');
        expect(settings.recovery).toEqual({ enabled: false });
    });
});

describe('v2 → v3 migration', () => {
    beforeEach(() => {
        localStorage.clear();
        db.__resetForTest();
    });

    const v2Document = {
        version: 2,
        settings: { name: 'Mo', units: 'kg', onboarded: true },
        workouts: [
            {
                id: 'wo-1',
                name: 'Push Day',
                startedAt: '2026-06-01T10:00:00Z',
                completedAt: '2026-06-01T11:00:00Z',
                durationSec: 3600,
                notes: '',
                sets: [
                    {
                        exerciseId: 'barbell-bench-press',
                        setNumber: 1,
                        weight: 80,
                        reps: 8,
                        rpe: 8,
                        isWarmup: false,
                        completedAt: '2026-06-01T10:30:00Z',
                    },
                ],
            },
        ],
        programs: [],
        customExercises: [],
        syncQueue: [],
        meta: { isDemo: false, createdAt: '2026-06-01T00:00:00Z', lastSyncedAt: null },
        // Intentionally NO bodyweightEntries and NO settings.recovery.
    };

    it('migrates a stored v2 document in place on load', () => {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(v2Document));
        db.__resetForTest();

        const d = db.get();
        expect(d.version).toBe(3);
        expect(d.bodyweightEntries).toEqual([]);
        expect(d.settings.recovery).toEqual({ enabled: false });
        expect(d.workouts).toHaveLength(1);
        expect(d.workouts[0].name).toBe('Push Day');
        expect(d.settings.name).toBe('Mo');

        // The migrated doc persists as v3.
        expect(JSON.parse(localStorage.getItem(STORAGE_KEY)).version).toBe(3);
    });

    it('accepts legacy v2 backups via db.import', () => {
        db.import(JSON.stringify(v2Document));
        expect(db.get().version).toBe(3);
        expect(db.workouts.get('wo-1').name).toBe('Push Day');
        expect(db.bodyweight.list()).toEqual([]);
        expect(db.settings.get().recovery).toEqual({ enabled: false });
    });

    it('round-trips a v3 backup including bodyweight entries', () => {
        db.settings.update({ name: 'Rivu' });
        db.bodyweight.add({ date: '2026-08-20T12:00:00Z', weightKg: 82.5 });
        db.bodyweight.add({ date: '2026-08-25T12:00:00Z', weightKg: 83, source: 'import' });

        const json = db.export();
        db.wipe();
        db.import(json);

        expect(db.get().version).toBe(3);
        const entries = db.bodyweight.list();
        expect(entries).toHaveLength(2);
        expect(entries[0].weightKg).toBe(83);
        expect(entries[0].source).toBe('import');
        expect(entries[1].weightKg).toBe(82.5);
        expect(db.settings.get().name).toBe('Rivu');
    });

    it('imports a backup that already carries v3 bodyweight entries', () => {
        const backup = JSON.stringify({
            ...v2Document,
            version: 3,
            bodyweightEntries: [
                { id: 'bw-1', date: '2026-08-01T12:00:00Z', weightKg: 84, source: 'manual' },
            ],
        });
        db.import(backup);
        const entries = db.bodyweight.list();
        expect(entries).toHaveLength(1);
        expect(entries[0].id).toBe('bw-1');
        // Hostile/garbage rows are normalized, not fatal.
        db.import(
            JSON.stringify({
                ...v2Document,
                version: 3,
                bodyweightEntries: [{ weightKg: 'nope', source: 42 }],
            }),
        );
        expect(db.bodyweight.list()[0].weightKg).toBe(0);
        expect(db.bodyweight.list()[0].source).toBe('manual');
    });

    it('still rejects unknown backup versions', () => {
        expect(() => db.import(JSON.stringify({ ...v2Document, version: 1 }))).toThrow();
        expect(() => db.import(JSON.stringify({ ...v2Document, version: 4 }))).toThrow();
        expect(() => db.import('not json')).toThrow();
    });
});

describe('bodyweight repository', () => {
    beforeEach(() => {
        localStorage.clear();
        db.wipe();
    });

    it('lists newest first, adds, and removes', () => {
        db.bodyweight.add({ date: '2026-08-01T12:00:00Z', weightKg: 82 });
        db.bodyweight.add({ date: '2026-08-20T12:00:00Z', weightKg: 83 });
        const list = db.bodyweight.list();
        expect(list.map((e) => e.date)).toEqual([
            '2026-08-20T12:00:00Z',
            '2026-08-01T12:00:00Z',
        ]);

        db.bodyweight.remove(list[0].id);
        expect(db.bodyweight.list()).toHaveLength(1);
        expect(db.bodyweight.list()[0].weightKg).toBe(82);
    });

    it('defaults date to now and coerces bad weight to 0', () => {
        const entry = db.bodyweight.add({ weightKg: null });
        expect(entry.date).toBeTruthy();
        expect(entry.weightKg).toBe(0);
    });

    it('persists across a reload from storage', () => {
        db.bodyweight.add({ date: '2026-08-20T12:00:00Z', weightKg: 83 });
        db.__resetForTest();
        expect(db.bodyweight.list()).toHaveLength(1);
    });
});
