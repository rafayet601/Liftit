import { useCallback, useSyncExternalStore } from 'react';
import { uid } from '../data/schema';

/**
 * The in-progress workout draft. Lives outside the main document so an
 * abandoned draft never pollutes history; persisted to localStorage so a
 * page reload mid-session loses nothing.
 *
 * Shape: {
 *   id, name, programId, programDayNumber, startedAt,
 *   exercises: [{ key, exerciseId, targetSets, targetRepsMin, targetRepsMax,
 *                 targetRpe, restSec,
 *                 sets: [{ weight, reps, rpe, completed }] }]
 * }
 */

const KEY = 'liftit_active_session_v1';

let cache;
try {
    cache = JSON.parse(localStorage.getItem(KEY)) ?? null;
} catch {
    cache = null;
}

const listeners = new Set();

function write(next) {
    cache = next;
    try {
        if (next === null) localStorage.removeItem(KEY);
        else localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
        /* storage full — keep going in memory */
    }
    listeners.forEach((fn) => fn());
}

const subscribe = (fn) => {
    listeners.add(fn);
    return () => listeners.delete(fn);
};

export function startSession({ name, programId = null, programDayNumber = null, exercises = [] }) {
    write({
        id: uid('wo'),
        name: name || 'Workout',
        programId,
        programDayNumber,
        startedAt: new Date().toISOString(),
        exercises,
    });
}

export function makeSessionExercise({ exerciseId, targetSets = 3, targetRepsMin = 8, targetRepsMax = 12, targetRpe = 8, restSec = 120, suggestedWeight = null }) {
    return {
        key: uid('sx'),
        exerciseId,
        targetSets,
        targetRepsMin,
        targetRepsMax,
        targetRpe,
        restSec,
        sets: Array.from({ length: targetSets }, () => ({
            weight: suggestedWeight ?? 0,
            reps: 0,
            rpe: 0,
            completed: false,
        })),
    };
}

export function updateSession(mutator) {
    if (!cache) return;
    const draft = JSON.parse(JSON.stringify(cache));
    mutator(draft);
    write(draft);
}

export function discardSession() {
    write(null);
}

export function useActiveSession() {
    const session = useSyncExternalStore(subscribe, () => cache);
    const mutate = useCallback((mutator) => updateSession(mutator), []);
    return { session, mutate };
}
