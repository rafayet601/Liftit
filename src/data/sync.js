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

/** Short, user-showable description of a failed request. */
function describeFailure(err) {
    const status = err?.response?.status;
    if (status) return `server responded ${status}`;
    return err?.message ?? String(err);
}

let syncing = false;

/**
 * Sync with the server: push queued local mutations, then pull down any
 * workouts this device hasn't seen (first sign-in on a new device, or
 * sessions logged elsewhere).
 *
 * Returns { pushed, pulled, remaining, error }, where `error` is null on a
 * clean run and otherwise { stage, message }. Failures are reported, never
 * thrown: a swallowed pull error is indistinguishable from an empty account,
 * so a broken server used to look like a successful sync on a fresh device.
 * Safe to call repeatedly; concurrent calls coalesce.
 */
export async function runSync() {
    const idle = () => ({
        pushed: 0,
        pulled: 0,
        remaining: db.sync.pendingOps().length,
        error: null,
    });
    if (syncing) return idle();
    if (!backendAvailable() || !isAuthenticated() || !navigator.onLine || db.meta.isDemo()) {
        return idle();
    }

    syncing = true;
    const done = [];
    let pulled = 0;
    let authFailed = false;
    let authError = null;
    let pushError = null;
    let pullError = null;
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
                    authError = { stage: 'auth', message: 'your session expired' };
                    break;
                }
                console.warn(`[sync] op ${op.type} failed`, err?.message ?? err);
                // Report the first failure only — the rest are usually the
                // same outage, and the ops stay queued for the next attempt.
                pushError = pushError ?? { stage: 'push', message: describeFailure(err) };
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
                pullError = { stage: 'pull', message: describeFailure(err) };
            }
        }

        return {
            pushed: done.length,
            pulled,
            remaining: db.sync.pendingOps().length,
            // Auth first (it aborted the run), then pull — a failed pull can
            // leave this device missing history, while a failed push op is
            // still queued and will be retried.
            error: authError ?? pullError ?? pushError,
        };
    } finally {
        syncing = false;
    }
}
