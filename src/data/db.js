/**
 * Liftit local-first repository.
 *
 * Single source of truth for the client: one versioned document persisted
 * to localStorage. Every read goes through the in-memory cache; every write
 * persists synchronously and notifies subscribers (React reads via
 * useSyncExternalStore in DataProvider).
 *
 * Server sync is layered on top in sync.js via the syncQueue — the
 * repository itself never touches the network.
 */

import {
    SCHEMA_VERSION,
    createDocument,
    createWorkout,
    createProgram,
    createSettings,
    uid,
} from './schema';
import {
    EXERCISE_LIBRARY,
    getLibraryExercise,
    matchExerciseByName,
    searchLibrary,
} from './exercises';
import { getItem, setItem, removeItem, __resetForTest as resetStorage } from './storage';

const STORAGE_KEY = 'liftit_data_v2';
const LEGACY_KEY = 'liftit_data_v1';
const LEGACY_UNIT_KEY = 'liftit_unit';

let doc = null;
const listeners = new Set();

/* ------------------------------------------------------------------ */
/* Persistence core                                                    */
/* ------------------------------------------------------------------ */

function load() {
    if (doc) return doc;
    try {
        const raw = getItem(STORAGE_KEY);
        if (raw) {
            doc = createDocument(JSON.parse(raw));
            return doc;
        }
    } catch (e) {
        console.error('[db] failed to parse stored data', e);
    }
    doc = migrateFromV1() ?? createDocument();
    persist();
    return doc;
}

function persist() {
    try {
        setItem(STORAGE_KEY, JSON.stringify(doc));
    } catch (e) {
        console.error('[db] failed to persist', e);
    }
}

function commit(mutator) {
    const current = load();
    const result = mutator(current) ?? current;
    // New top-level reference so useSyncExternalStore snapshots invalidate.
    doc = { ...result };
    persist();
    listeners.forEach((fn) => fn());
}

function subscribe(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
}

/* ------------------------------------------------------------------ */
/* v1 → v2 migration                                                   */
/* ------------------------------------------------------------------ */

function migrateFromV1() {
    let legacy = null;
    try {
        const raw = getItem(LEGACY_KEY);
        if (raw) legacy = JSON.parse(raw);
    } catch {
        return null;
    }
    if (!legacy) return null;

    const customExercises = [];
    const resolveExercise = (name) => {
        const hit = matchExerciseByName(name);
        if (hit) return hit.id;
        if (!name) return null;
        const existing = customExercises.find(
            (c) => c.name.toLowerCase() === String(name).toLowerCase(),
        );
        if (existing) return existing.id;
        const custom = {
            id: uid('custom'),
            name: String(name),
            primaryMuscle: 'core',
            secondaryMuscles: [],
            equipment: 'machine',
            isCompound: false,
        };
        customExercises.push(custom);
        return custom.id;
    };

    const workouts = (legacy.logs || []).map((log) =>
        createWorkout({
            id: log.id || uid('wo'),
            name: log.name || 'Workout',
            startedAt: log.date || new Date().toISOString(),
            completedAt: log.date || null,
            durationSec: Number(log.duration) || 0,
            sets: (log.workout || []).flatMap((exEntry) => {
                const exerciseId = resolveExercise(exEntry.name);
                return (exEntry.sets || []).map((s, i) => ({
                    exerciseId,
                    setNumber: i + 1,
                    weight: Number(s.weight) || 0,
                    reps: Number(s.reps) || 0,
                    rpe: Number(s.rpe) || 0,
                    completedAt: log.date || null,
                }));
            }),
        }),
    );

    const programs = [];
    const meso = legacy.currentMesocycle;
    if (meso?.active) {
        const days = meso.aiProgram?.programDays || meso.programDays || [];
        programs.push(
            createProgram({
                name: meso.name || `${meso.focus || 'Training'} Block`,
                goal: (meso.focus || 'hypertrophy').toLowerCase(),
                daysPerWeek: meso.daysPerWeek || 4,
                durationWeeks: meso.weeks || 6,
                startDate: meso.startDate || new Date().toISOString(),
                isActive: true,
                days: days.map((d, idx) => ({
                    dayNumber: d.dayNumber ?? d.dayOfWeek ?? idx + 1,
                    name: d.name || `Day ${idx + 1}`,
                    isRestDay: Boolean(d.isRestDay) || /rest/i.test(d.name || ''),
                    exercises: (d.exercises || []).map((e, order) => ({
                        exerciseId: resolveExercise(e.exercise?.name || e.name),
                        order: order + 1,
                        targetSets: e.targetSets ?? e.sets ?? 3,
                        ...parseRepRange(e.targetReps ?? e.reps),
                        targetRpe: e.targetRpe ?? e.rpe ?? 8,
                        restSec: e.restSeconds ?? 120,
                    })),
                })),
            }),
        );
    }

    let units = 'kg';
    try {
        units = getItem(LEGACY_UNIT_KEY) === 'lbs' ? 'lbs' : 'kg';
    } catch {
        /* default */
    }

    console.log(
        `[db] migrated v1 data: ${workouts.length} workouts, ${programs.length} programs`,
    );
    return createDocument({
        settings: createSettings({
            name: legacy.user?.name && legacy.user.name !== 'Athlete' ? legacy.user.name : '',
            units,
            experience: (legacy.user?.level || 'intermediate').toLowerCase(),
            onboarded: workouts.length > 0 || programs.length > 0,
        }),
        workouts,
        programs,
        customExercises,
    });
}

export function parseRepRange(target) {
    if (typeof target === 'number' && Number.isFinite(target)) {
        return { targetRepsMin: target, targetRepsMax: target };
    }
    const matches = String(target ?? '').match(/\d+/g);
    if (!matches?.length) return { targetRepsMin: 8, targetRepsMax: 12 };
    const nums = matches.map(Number);
    return {
        targetRepsMin: Math.min(...nums),
        targetRepsMax: Math.max(...nums),
    };
}

/* ------------------------------------------------------------------ */
/* Sync queue (consumed by sync.js)                                    */
/* ------------------------------------------------------------------ */

function enqueue(type, payload) {
    commit((d) => {
        // Collapse duplicate ops for the same entity: last write wins.
        d.syncQueue = d.syncQueue.filter(
            (op) => !(op.type === type && op.payload?.id === payload?.id),
        );
        d.syncQueue.push({ id: uid('op'), type, payload, ts: new Date().toISOString() });
    });
}

/* ------------------------------------------------------------------ */
/* Public repository                                                   */
/* ------------------------------------------------------------------ */

export const db = {
    subscribe,
    get: () => load(),

    /** Test-only: drop the in-memory cache so the next read re-loads/migrates. */
    __resetForTest() {
        doc = null;
        resetStorage();
    },

    workouts: {
        /** Newest first. */
        list() {
            return [...load().workouts].sort(
                (a, b) => new Date(b.startedAt) - new Date(a.startedAt),
            );
        },
        get(id) {
            return load().workouts.find((w) => w.id === id) ?? null;
        },
        save(workout) {
            const normalized = createWorkout(workout);
            commit((d) => {
                const idx = d.workouts.findIndex((w) => w.id === normalized.id);
                if (idx >= 0) d.workouts[idx] = normalized;
                else d.workouts.push(normalized);
            });
            enqueue('workout.save', normalized);
            return normalized;
        },
        remove(id) {
            commit((d) => {
                d.workouts = d.workouts.filter((w) => w.id !== id);
            });
            enqueue('workout.delete', { id });
        },
        /**
         * Merge workouts pulled down from the server. Unlike save(), this
         * never enqueues sync ops — these records just came *from* the
         * server, so queueing them would echo every pull back as a push.
         * Only ids this device hasn't seen are added; local copies win.
         */
        importRemote(workouts) {
            const existing = new Set(load().workouts.map((w) => w.id));
            const fresh = (workouts ?? [])
                .filter((w) => w?.id && !existing.has(w.id))
                .map((w) => createWorkout(w));
            if (fresh.length) {
                commit((d) => {
                    d.workouts.push(...fresh);
                });
            }
            return fresh.length;
        },
    },

    programs: {
        list() {
            return [...load().programs].sort(
                (a, b) => new Date(b.startDate) - new Date(a.startDate),
            );
        },
        get(id) {
            return load().programs.find((p) => p.id === id) ?? null;
        },
        getActive() {
            return load().programs.find((p) => p.isActive) ?? null;
        },
        save(program) {
            const normalized = createProgram(program);
            commit((d) => {
                if (normalized.isActive) {
                    d.programs.forEach((p) => {
                        if (p.id !== normalized.id) p.isActive = false;
                    });
                }
                const idx = d.programs.findIndex((p) => p.id === normalized.id);
                if (idx >= 0) d.programs[idx] = normalized;
                else d.programs.push(normalized);
            });
            enqueue('program.save', normalized);
            return normalized;
        },
        setActive(id) {
            commit((d) => {
                d.programs.forEach((p) => {
                    p.isActive = p.id === id;
                });
            });
        },
        remove(id) {
            commit((d) => {
                d.programs = d.programs.filter((p) => p.id !== id);
            });
            enqueue('program.delete', { id });
        },
    },

    exercises: {
        all() {
            return [...EXERCISE_LIBRARY, ...load().customExercises];
        },
        byId(id) {
            return (
                getLibraryExercise(id) ??
                load().customExercises.find((e) => e.id === id) ??
                null
            );
        },
        search(query, filters) {
            const builtIn = searchLibrary(query, filters);
            const q = (query ?? '').trim().toLowerCase();
            const custom = load().customExercises.filter((e) => {
                if (filters?.muscle && e.primaryMuscle !== filters.muscle) return false;
                if (filters?.equipment && e.equipment !== filters.equipment) return false;
                return !q || e.name.toLowerCase().includes(q);
            });
            return [...custom, ...builtIn];
        },
        addCustom({ name, primaryMuscle = 'core', equipment = 'machine', isCompound = false }) {
            const exercise = {
                id: uid('custom'),
                name: String(name).trim(),
                primaryMuscle,
                secondaryMuscles: [],
                equipment,
                isCompound,
            };
            commit((d) => {
                d.customExercises.push(exercise);
            });
            return exercise;
        },
    },

    settings: {
        get() {
            return load().settings;
        },
        update(partial) {
            commit((d) => {
                d.settings = createSettings({
                    ...d.settings,
                    ...partial,
                    ai: { ...d.settings.ai, ...(partial.ai ?? {}) },
                });
            });
            return load().settings;
        },
    },

    sync: {
        pendingOps() {
            return [...load().syncQueue];
        },
        markDone(opIds) {
            const done = new Set(opIds);
            commit((d) => {
                d.syncQueue = d.syncQueue.filter((op) => !done.has(op.id));
                d.meta.lastSyncedAt = new Date().toISOString();
            });
        },
    },

    meta: {
        isDemo() {
            return load().meta.isDemo;
        },
    },

    /** Serialize everything except the AI API key. */
    export() {
        const d = load();
        return JSON.stringify(
            {
                ...d,
                settings: { ...d.settings, ai: { ...d.settings.ai, apiKey: '' } },
                syncQueue: [],
            },
            null,
            2,
        );
    },

    import(json) {
        const parsed = JSON.parse(json); // throws on invalid input — caller handles
        if (parsed.version !== SCHEMA_VERSION) {
            throw new Error(`Unsupported backup version: ${parsed.version}`);
        }
        // SECURITY: never let a backup file dictate AI provider config. A
        // malicious backup could otherwise point `provider: custom` at an
        // attacker-controlled `baseUrl` and silently exfiltrate the user's
        // data — and any API key they later paste — to that endpoint. Keep
        // the device's existing AI settings; only workouts/programs/profile
        // come from the file.
        const currentAi = load().settings.ai;
        commit(() => {
            const doc = createDocument(parsed);
            doc.settings = createSettings({ ...doc.settings, ai: currentAi });
            return doc;
        });
    },

    wipe() {
        commit(() => createDocument());
        try {
            removeItem(LEGACY_KEY);
        } catch {
            /* ignore */
        }
    },

    /** Seed clearly-labeled sample data (explicit user action only). */
    seedDemo() {
        commit((d) => {
            const seeded = createDocument(buildDemoDocument());
            seeded.settings = { ...seeded.settings, ...d.settings, onboarded: true };
            seeded.meta.isDemo = true;
            return seeded;
        });
    },
};

/* ------------------------------------------------------------------ */
/* Demo seed — only created when the user explicitly asks for it       */
/* ------------------------------------------------------------------ */

function buildDemoDocument() {
    const day = 24 * 60 * 60 * 1000;
    const now = Date.now();
    const session = (offsetDays, name, entries) => ({
        id: uid('wo'),
        name,
        startedAt: new Date(now - offsetDays * day).toISOString(),
        completedAt: new Date(now - offsetDays * day + 3600 * 1000).toISOString(),
        durationSec: 3600,
        sets: entries.flatMap(([exerciseId, sets]) =>
            sets.map(([weight, reps, rpe], i) => ({
                exerciseId,
                setNumber: i + 1,
                weight,
                reps,
                rpe,
                completedAt: new Date(now - offsetDays * day).toISOString(),
            })),
        ),
    });

    return {
        workouts: [
            session(13, 'Upper A', [
                ['barbell-bench-press', [[80, 8, 7.5], [80, 8, 8], [80, 7, 8.5]]],
                ['barbell-row', [[70, 10, 7], [70, 9, 8], [70, 9, 8]]],
                ['overhead-press', [[45, 8, 8], [45, 7, 8.5]]],
                ['cable-pushdown', [[25, 12, 7], [25, 12, 8]]],
            ]),
            session(11, 'Lower A', [
                ['barbell-back-squat', [[100, 6, 8], [100, 6, 8], [100, 5, 9]]],
                ['romanian-deadlift', [[90, 9, 7.5], [90, 8, 8]]],
                ['leg-extension', [[40, 12, 7], [40, 12, 8]]],
                ['standing-calf-raise', [[60, 14, 7], [60, 12, 8]]],
            ]),
            session(8, 'Upper B', [
                ['incline-dumbbell-press', [[28, 10, 7.5], [28, 9, 8], [28, 9, 8.5]]],
                ['lat-pulldown', [[60, 10, 7], [60, 10, 8]]],
                ['lateral-raise', [[10, 14, 7.5], [10, 13, 8]]],
                ['barbell-curl', [[32, 10, 8], [32, 9, 8.5]]],
            ]),
            session(6, 'Lower B', [
                ['conventional-deadlift', [[140, 5, 8], [140, 5, 8.5]]],
                ['leg-press', [[180, 10, 7.5], [180, 10, 8]]],
                ['lying-leg-curl', [[35, 11, 8], [35, 10, 8.5]]],
            ]),
            session(4, 'Upper A', [
                ['barbell-bench-press', [[82.5, 8, 8], [82.5, 7, 8.5], [82.5, 7, 9]]],
                ['barbell-row', [[72.5, 10, 7.5], [72.5, 9, 8]]],
                ['overhead-press', [[47.5, 7, 8.5], [47.5, 6, 9]]],
                ['cable-pushdown', [[27.5, 12, 8]]],
            ]),
            session(1, 'Lower A', [
                ['barbell-back-squat', [[102.5, 6, 8], [102.5, 6, 8.5], [102.5, 5, 9]]],
                ['romanian-deadlift', [[92.5, 8, 8], [92.5, 8, 8.5]]],
                ['leg-extension', [[42.5, 12, 8]]],
            ]),
        ],
        programs: [],
        meta: { isDemo: true },
    };
}
