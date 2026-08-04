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

import { get, put, del, isAuthenticated, backendAvailable } from '../lib/api';
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
 * Sync with the server: push queued local mutations, then pull down any
 * workouts this device hasn't seen (first sign-in on a new device, or
 * sessions logged elsewhere). Returns { pushed, pulled, remaining }.
 * Safe to call repeatedly; concurrent calls coalesce.
 */
export async function runSync() {
    const idle = () => ({ pushed: 0, pulled: 0, remaining: db.sync.pendingOps().length });
    if (syncing) return idle();
    if (!backendAvailable() || !isAuthenticated() || !navigator.onLine || db.meta.isDemo()) {
        return idle();
    }

    syncing = true;
    const done = [];
    let pulled = 0;
    let authFailed = false;
    try {
        // Push. Note no early-out on an empty queue: a fresh device has
        // nothing to push but still needs the pull below.
        for (const op of db.sync.pendingOps()) {
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
                if (err?.response?.status === 401) {
                    authFailed = true;
                    break;
                }
                console.warn(`[sync] op ${op.type} failed`, err?.message ?? err);
            }
        }

        if (done.length) db.sync.markDone(done);

        // Pull — pushed ops are on the server now, so merging only adds ids
        // this device is missing; local copies always win.
        if (!authFailed) {
            try {
                const res = await get('/workouts');
                const remote = res?.data?.data;
                if (Array.isArray(remote)) pulled = db.workouts.importRemote(remote);
            } catch (err) {
                console.warn('[sync] pull failed', err?.message ?? err);
            }
        }

        return { pushed: done.length, pulled, remaining: db.sync.pendingOps().length };
    } finally {
        syncing = false;
    }
}
