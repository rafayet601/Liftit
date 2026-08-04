/**
 * Best-effort background sync of the local repository to the server.
 *
 * The local document is always the source of truth. When the user is
 * authenticated and online we drain db's syncQueue against the Pages
 * Function API. Failures leave ops in the queue for the next attempt —
 * nothing in the UI ever blocks on this.
 *
 * Workouts are addressed by their *client* id: the server upserts on
 * (user, clientId), so replaying an op is idempotent. That replaces the old
 * localStorage id-map, which duplicated every workout server-side if the
 * user ever cleared site data, and the exercise name→id mapping, which
 * silently dropped sets for any exercise the server didn't know about
 * (i.e. every custom exercise).
 */

import { put, del, isAuthenticated, backendAvailable } from '../lib/api';
import { db } from './db';

function mapWorkoutPayload(workout) {
    return {
        name: workout.name,
        notes: workout.notes || undefined,
        startedAt: new Date(workout.startedAt).toISOString(),
        completedAt: workout.completedAt
            ? new Date(workout.completedAt).toISOString()
            : undefined,
        durationSec: workout.durationSec || 0,
        sets: workout.sets.map((s) => ({
            exerciseId: s.exerciseId,
            setNumber: s.setNumber,
            weight: s.weight,
            reps: s.reps,
            rpe: s.rpe,
            isWarmup: Boolean(s.isWarmup),
            completedAt: s.completedAt ?? undefined,
        })),
    };
}

let syncing = false;

/**
 * Drain the sync queue. Returns { pushed, remaining } counts.
 * Safe to call repeatedly; concurrent calls coalesce.
 */
export async function runSync() {
    if (syncing) return { pushed: 0, remaining: db.sync.pendingOps().length };
    if (!backendAvailable() || !isAuthenticated() || !navigator.onLine || db.meta.isDemo()) {
        return { pushed: 0, remaining: db.sync.pendingOps().length };
    }

    syncing = true;
    const done = [];
    try {
        const ops = db.sync.pendingOps();
        if (!ops.length) return { pushed: 0, remaining: 0 };

        for (const op of ops) {
            try {
                if (op.type === 'workout.save') {
                    await put(`/workouts/${op.payload.id}`, mapWorkoutPayload(op.payload));
                } else if (op.type === 'workout.delete') {
                    await del(`/workouts/${op.payload.id}`);
                } else if (op.type === 'program.save' || op.type === 'program.delete') {
                    // Programs are generated deterministically on-device from
                    // settings, so there's nothing worth round-tripping yet.
                    // Drop the op rather than leaving it queued forever.
                }
                done.push(op.id);
            } catch (err) {
                // Leave failed ops queued; stop on auth errors.
                if (err?.response?.status === 401) break;
                console.warn(`[sync] op ${op.type} failed`, err?.message ?? err);
            }
        }

        if (done.length) db.sync.markDone(done);
        return { pushed: done.length, remaining: db.sync.pendingOps().length };
    } finally {
        syncing = false;
    }
}
