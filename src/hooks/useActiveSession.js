import { useCallback, useSyncExternalStore } from 'react';
import { uid } from '../data/schema';
import { db } from '../data/db';

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

/** Plain (non-hook) read of the current draft — for prompts and labels. */
export function getActiveSession() {
    return cache;
}

/* ==================================================================
   AI actions — the ONLY way an LLM-initiated change touches the
   session. Every action is validated, logged, and undoable; nothing
   auto-applies (TrainerChat shows Apply/Dismiss chips first).
   ================================================================== */

const AI_TARGET_SETS_MIN = 1;
const AI_TARGET_SETS_MAX = 10;
const AI_REPS_MIN = 1;
const AI_REPS_MAX = 50;

const actionLog = [];

/** Audit trail of AI-initiated session changes, oldest first. */
export function getSessionActionLog() {
    return [...actionLog];
}

function logAction(entry) {
    actionLog.push({ at: new Date().toISOString(), ...entry });
    if (actionLog.length > 100) actionLog.shift();
}

function clampInt(v, lo, hi) {
    const n = Math.round(Number(v));
    return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : null;
}

/**
 * Apply one parsed, validated AI action to the active session through the
 * standard mutator path. Returns { ok, snapshot, detail } on success or
 * { ok: false, error }. The snapshot restores the exact prior draft via
 * undoSessionAction. Logged sets are never deleted: rescaling only grows
 * the set list, and swaps reset the sets of the swapped entry only.
 */
export function applySessionAction(action) {
    if (!cache) return { ok: false, error: 'No active session.' };
    if (!action || typeof action.exerciseKey !== 'string') {
        return { ok: false, error: 'Malformed action.' };
    }
    const ex = cache.exercises.find((e) => e.key === action.exerciseKey);
    if (!ex) return { ok: false, error: 'That exercise is not in the active session.' };
    const exerciseName = db.exercises.byId(ex.exerciseId)?.name ?? ex.exerciseId;
    const snapshot = JSON.parse(JSON.stringify(cache));

    if (action.action === 'swap_exercise') {
        const newExercise = db.exercises.byId(action.newExerciseId);
        if (!newExercise) return { ok: false, error: `Unknown exercise id: ${action.newExerciseId}` };
        updateSession((d) => {
            const target = d.exercises.find((e) => e.key === action.exerciseKey);
            if (!target) return;
            target.exerciseId = newExercise.id;
            target.sets = Array.from({ length: target.targetSets }, () => ({
                weight: 0,
                reps: 0,
                rpe: 0,
                completed: false,
            }));
        });
        const detail = { type: 'swap_exercise', from: exerciseName, to: newExercise.name };
        logAction({ action: 'swap_exercise', exerciseKey: action.exerciseKey, ...detail });
        return { ok: true, snapshot, detail };
    }

    if (action.action === 'rescale_targets') {
        const targetSets = clampInt(action.targetSets, AI_TARGET_SETS_MIN, AI_TARGET_SETS_MAX);
        if (targetSets === null) return { ok: false, error: 'targetSets must be a number 1–10.' };
        updateSession((d) => {
            const target = d.exercises.find((e) => e.key === action.exerciseKey);
            if (!target) return;
            target.targetSets = targetSets;
            while (target.sets.length < targetSets) {
                target.sets.push({ weight: 0, reps: 0, rpe: 0, completed: false });
            }
            // Sets are never removed — logged work always survives a rescale.
        });
        const detail = { type: 'rescale_targets', exercise: exerciseName, targetSets };
        logAction({ action: 'rescale_targets', exerciseKey: action.exerciseKey, targetSets });
        return { ok: true, snapshot, detail };
    }

    if (action.action === 'set_target_reps') {
        let repsMin = clampInt(action.repsMin, AI_REPS_MIN, AI_REPS_MAX - 1);
        let repsMax = clampInt(action.repsMax, AI_REPS_MIN, AI_REPS_MAX);
        if (repsMin === null || repsMax === null) {
            return { ok: false, error: 'repsMin/repsMax must be numbers 1–50.' };
        }
        if (repsMin >= repsMax) [repsMin, repsMax] = [Math.min(repsMin, repsMax - 1), Math.max(repsMin + 1, repsMax)];
        updateSession((d) => {
            const target = d.exercises.find((e) => e.key === action.exerciseKey);
            if (!target) return;
            target.targetRepsMin = repsMin;
            target.targetRepsMax = repsMax;
        });
        const detail = { type: 'set_target_reps', exercise: exerciseName, repsMin, repsMax };
        logAction({ action: 'set_target_reps', exerciseKey: action.exerciseKey, repsMin, repsMax });
        return { ok: true, snapshot, detail };
    }

    return { ok: false, error: `Unsupported action: ${action.action}` };
}

/** Restore the draft captured before an applied action. */
export function undoSessionAction(snapshot) {
    if (!snapshot) return false;
    write(JSON.parse(JSON.stringify(snapshot)));
    logAction({ action: 'undo' });
    return true;
}

export function useActiveSession() {
    const session = useSyncExternalStore(subscribe, () => cache);
    const mutate = useCallback((mutator) => updateSession(mutator), []);
    return { session, mutate };
}
