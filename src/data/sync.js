/**
 * Best-effort background sync of the local repository to the server.
 *
 * The local document is always the source of truth. When the user is
 * authenticated and online we drain db's syncQueue against the existing
 * Express routes. Failures leave ops in the queue for the next attempt —
 * nothing in the UI ever blocks on this.
 */

import { get, post, put, del, isAuthenticated } from '../lib/api';
import { db } from './db';

const ID_MAP_KEY = 'liftit_sync_idmap_v1';

function loadIdMap() {
    try {
        return JSON.parse(localStorage.getItem(ID_MAP_KEY)) || {};
    } catch {
        return {};
    }
}

function saveIdMap(map) {
    try {
        localStorage.setItem(ID_MAP_KEY, JSON.stringify(map));
    } catch {
        /* non-fatal */
    }
}

let serverExerciseIndex = null; // name (lowercase) -> server exercise id

async function getServerExerciseIndex() {
    if (serverExerciseIndex) return serverExerciseIndex;
    const res = await get('/exercises?limit=500');
    const list = res?.data?.data ?? res?.data ?? [];
    serverExerciseIndex = new Map();
    for (const e of list) {
        if (e?.name) serverExerciseIndex.set(e.name.toLowerCase(), e.id);
        if (e?.slug) serverExerciseIndex.set(e.slug, e.id);
    }
    return serverExerciseIndex;
}

function mapWorkoutPayload(workout, exerciseIndex) {
    const sets = [];
    for (const s of workout.sets) {
        const local = db.exercises.byId(s.exerciseId);
        const serverId =
            exerciseIndex.get(s.exerciseId) ??
            (local ? exerciseIndex.get(local.name.toLowerCase()) : undefined);
        if (!serverId) continue; // exercise unknown server-side — skip set
        sets.push({
            exerciseId: serverId,
            setNumber: s.setNumber,
            reps: s.reps > 0 ? s.reps : undefined,
            weight: s.weight >= 0 ? s.weight : undefined,
            rpe: s.rpe > 0 ? s.rpe : undefined,
            isWarmup: s.isWarmup,
        });
    }
    return {
        name: workout.name,
        notes: workout.notes || undefined,
        startedAt: new Date(workout.startedAt).toISOString(),
        completedAt: workout.completedAt
            ? new Date(workout.completedAt).toISOString()
            : undefined,
        duration: workout.durationSec || undefined,
        isCompleted: Boolean(workout.completedAt),
        sets,
    };
}

let syncing = false;

/**
 * Drain the sync queue. Returns { pushed, remaining } counts.
 * Safe to call repeatedly; concurrent calls coalesce.
 */
export async function runSync() {
    if (syncing) return { pushed: 0, remaining: db.sync.pendingOps().length };
    if (!isAuthenticated() || !navigator.onLine || db.meta.isDemo()) {
        return { pushed: 0, remaining: db.sync.pendingOps().length };
    }

    syncing = true;
    const done = [];
    try {
        const ops = db.sync.pendingOps();
        if (!ops.length) return { pushed: 0, remaining: 0 };

        const idMap = loadIdMap();
        const exerciseIndex = await getServerExerciseIndex();

        for (const op of ops) {
            try {
                if (op.type === 'workout.save') {
                    const payload = mapWorkoutPayload(op.payload, exerciseIndex);
                    const serverId = idMap[op.payload.id];
                    if (serverId) {
                        await put(`/workouts/${serverId}`, payload);
                    } else {
                        const res = await post('/workouts', payload);
                        const createdId = res?.data?.data?.id ?? res?.data?.id;
                        if (createdId) idMap[op.payload.id] = createdId;
                    }
                } else if (op.type === 'workout.delete') {
                    const serverId = idMap[op.payload.id];
                    if (serverId) {
                        await del(`/workouts/${serverId}`);
                        delete idMap[op.payload.id];
                    }
                } else if (op.type === 'program.save' || op.type === 'program.delete') {
                    // Program sync is local-only for now: the server program
                    // model requires server-side generation. Drop the op.
                }
                done.push(op.id);
            } catch (err) {
                // Leave failed ops queued; stop on auth errors.
                if (err?.response?.status === 401) break;
                console.warn(`[sync] op ${op.type} failed`, err?.message ?? err);
            }
        }

        saveIdMap(idMap);
        if (done.length) db.sync.markDone(done);
        return { pushed: done.length, remaining: db.sync.pendingOps().length };
    } finally {
        syncing = false;
    }
}
