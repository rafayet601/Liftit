import { describe, it, expect, beforeEach, vi } from 'vitest';

/**
 * Fake for @capgo/capacitor-watch — captures listeners, context pushes and
 * replies so tests can drive the bridge end-to-end without Capacitor.
 */
const listeners = new Map(); // event name → registered callbacks
const sentContexts = [];
const sentReplies = [];

vi.mock('@capgo/capacitor-watch', () => {
    const fake = {
        getInfo: vi.fn(async () => ({
            isSupported: true,
            isPaired: true,
            isWatchAppInstalled: true,
            isReachable: true,
            activationState: 2,
        })),
        updateApplicationContext: vi.fn(async ({ context }) => {
            sentContexts.push(context);
        }),
        sendMessage: vi.fn(async () => {}),
        replyToMessage: vi.fn(async ({ data }) => {
            sentReplies.push(data);
        }),
        addListener: vi.fn((event, cb) => {
            const arr = listeners.get(event) ?? [];
            arr.push(cb);
            listeners.set(event, arr);
            return Promise.resolve({ remove: vi.fn() });
        }),
        removeAllListeners: vi.fn(async () => {}),
    };
    return { CapgoWatch: fake, Watch: fake };
});

import { CapgoWatch } from '@capgo/capacitor-watch'; // the vi.mock fake below
import { db } from '../data/db';
import {
    startSession,
    makeSessionExercise,
    getActiveSession,
    discardSession,
} from '../hooks/useActiveSession';
import {
    initWatchBridge,
    pushWatchContext,
    compactSessionSnapshot,
    handleWatchMessage,
} from '../lib/watchBridge';

const replyListener = () => listeners.get('messageReceivedWithReply')?.[0];

async function dispatch(message, callbackId = 'cb-test') {
    const listener = replyListener();
    if (!listener) throw new Error('bridge did not register the reply listener');
    await listener({ message, callbackId });
    return sentReplies[sentReplies.length - 1];
}

function seedSession({ weight = 62.5, reps = 0 } = {}) {
    startSession({
        name: 'Push Day',
        exercises: [
            makeSessionExercise({
                exerciseId: 'barbell-bench-press',
                targetSets: 3,
                targetRepsMin: 8,
                targetRepsMax: 12,
                suggestedWeight: weight,
            }),
        ],
    });
    const session = getActiveSession();
    return { session, exerciseKey: session.exercises[0].key };
}

describe('watchBridge · Apple Watch companion', () => {
    beforeEach(() => {
        localStorage.clear();
        discardSession();
        sentContexts.length = 0;
        sentReplies.length = 0;
        // NOTE: `listeners` is intentionally NOT cleared — the bridge is a
        // module-level singleton that registers exactly once per file.
    });

    it('init is idempotent — listeners registered exactly once', async () => {
        const first = await initWatchBridge();
        const second = await initWatchBridge();
        expect(second).toBe(first);
        expect(listeners.get('messageReceived')).toHaveLength(1);
        expect(listeners.get('messageReceivedWithReply')).toHaveLength(1);
    });

    it('log_set happy path applies weight/reps to the seeded active session', async () => {
        await initWatchBridge();
        const { session, exerciseKey } = seedSession();

        const reply = await dispatch({
            action: 'log_set',
            exerciseKey,
            setIndex: 0,
            weight: 65,
            reps: 9,
            rpe: 8,
        });

        expect(reply).toEqual({ ok: true, applied: true });
        const set = getActiveSession().exercises.find((e) => e.key === exerciseKey).sets[0];
        expect(set).toMatchObject({ weight: 65, reps: 9, rpe: 8, completed: true });
        // Snapshots carry the original session id — no new document invented.
        expect(getActiveSession().id).toBe(session.id);
    });

    it('log_set clamps setIndex and non-negative numbers', async () => {
        await initWatchBridge();
        const { exerciseKey } = seedSession();

        // setIndex 99 → last set; negative values clamp to 0.
        await dispatch({
            action: 'log_set',
            exerciseKey,
            setIndex: 99,
            weight: -20,
            reps: -5,
        });

        const sets = getActiveSession().exercises.find((e) => e.key === exerciseKey).sets;
        expect(sets[2]).toMatchObject({ weight: 0, reps: 0, completed: true });
        expect(sets[0].completed).toBe(false);
    });

    it('malformed messages reply { ok: false } and never throw', async () => {
        await initWatchBridge();
        const { exerciseKey } = seedSession();

        const garbage = [
            'not-an-object',
            null,
            {},
            { action: 'unexpected_action' },
            { action: 'log_set', exerciseKey }, // missing weight/reps/setIndex
            { action: 'log_set', exerciseKey, setIndex: 0, weight: 'heavy', reps: 5 },
        ];
        for (const message of garbage) {
            const reply = await dispatch(message, `cb-${garbage.indexOf(message)}`);
            expect(reply.ok).toBe(false);
        }
        // Unknown exercise key — honest rejection, not a fabricated log.
        const missing = await dispatch({
            action: 'log_set',
            exerciseKey: 'sx-does-not-exist',
            setIndex: 0,
            weight: 40,
            reps: 5,
        });
        expect(missing.ok).toBe(false);

        // Direct handler path must not throw either.
        await expect(handleWatchMessage(undefined)).resolves.toMatchObject({ ok: false });
    });

    it('request_state replies with the session snapshot, or null when idle', async () => {
        await initWatchBridge();

        expect(await dispatch({ action: 'request_state' })).toEqual({
            ok: true,
            session: null,
        });

        const { session, exerciseKey } = seedSession();
        const reply = await dispatch({ action: 'request_state' });
        expect(reply.ok).toBe(true);
        expect(reply.session).toEqual({
            v: 1,
            kind: 'session',
            sessionId: session.id,
            name: 'Push Day',
            exercises: [
                {
                    key: exerciseKey,
                    name: db.exercises.byId('barbell-bench-press').name,
                    targetRepsMin: 8,
                    targetRepsMax: 12,
                    sets: [
                        { i: 0, w: 62.5, r: 0, done: false },
                        { i: 1, w: 62.5, r: 0, done: false },
                        { i: 2, w: 62.5, r: 0, done: false },
                    ],
                },
            ],
        });
    });

    it('ping replies with pong', async () => {
        await initWatchBridge();
        expect(await dispatch({ action: 'ping' })).toEqual({ ok: true, pong: true });
    });

    it('pushWatchContext sends the compact payload — kg preserved', async () => {
        await initWatchBridge();
        const { session } = seedSession();

        const delivered = await pushWatchContext(compactSessionSnapshot(session));
        expect(delivered).toBe(true);

        const ctx = sentContexts[sentContexts.length - 1];
        expect(ctx.v).toBe(1);
        expect(ctx.kind).toBe('session');
        expect(ctx.sessionId).toBe(session.id);
        expect(ctx.exercises).toHaveLength(1);
        expect(Object.keys(ctx.exercises[0]).sort()).toEqual(
            ['key', 'name', 'sets', 'targetRepsMax', 'targetRepsMin'].sort(),
        );
        // Compact set keys, 0-based index, weight untouched in kg.
        expect(Object.keys(ctx.exercises[0].sets[0]).sort()).toEqual(['done', 'i', 'r', 'w']);
        expect(ctx.exercises[0].sets[0]).toEqual({ i: 0, w: 62.5, r: 0, done: false });
    });

    it('pushWatchContext(null) sends the kind:none clear marker', async () => {
        await initWatchBridge();
        const delivered = await pushWatchContext(null);
        expect(delivered).toBe(true);
        expect(sentContexts[sentContexts.length - 1]).toEqual({ v: 1, kind: 'none' });
    });

    it('a duplicate log_set (watch retry) is an overwrite, never a double count', async () => {
        await initWatchBridge();
        const { exerciseKey } = seedSession();

        const msg = { action: 'log_set', exerciseKey, setIndex: 0, weight: 65, reps: 9 };
        await dispatch(msg);
        await dispatch(msg);

        const sets = getActiveSession().exercises.find((e) => e.key === exerciseKey).sets;
        expect(sets).toHaveLength(3); // retry adds no entries
        expect(sets[0]).toMatchObject({ weight: 65, reps: 9, completed: true });
    });

    it('a second log_set for the same set overwrites (last write wins, rpe clamped to 10)', async () => {
        await initWatchBridge();
        const { exerciseKey } = seedSession();

        await dispatch({ action: 'log_set', exerciseKey, setIndex: 0, weight: 65, reps: 9, rpe: 8 });
        await dispatch({ action: 'log_set', exerciseKey, setIndex: 0, weight: 70, reps: 8, rpe: 99 });

        const set = getActiveSession().exercises.find((e) => e.key === exerciseKey).sets[0];
        expect(set).toMatchObject({ weight: 70, reps: 8, rpe: 10, completed: true });
    });

    it('pushWatchContext reports false when the plugin rejects, and recovers on the next push', async () => {
        await initWatchBridge();
        const { session } = seedSession();

        CapgoWatch.updateApplicationContext.mockRejectedValueOnce(
            new Error('session not activated'),
        );
        expect(await pushWatchContext(compactSessionSnapshot(session))).toBe(false);
        // No permanent poison — a later push still goes through.
        expect(await pushWatchContext(compactSessionSnapshot(session))).toBe(true);
    });

    it('a successful log_set re-pushes the updated context to the watch', async () => {
        await initWatchBridge();
        const { exerciseKey } = seedSession();
        sentContexts.length = 0;

        await dispatch({
            action: 'log_set',
            exerciseKey,
            setIndex: 1,
            weight: 70,
            reps: 10,
        });

        const ctx = sentContexts[sentContexts.length - 1];
        expect(ctx.kind).toBe('session');
        expect(ctx.exercises[0].sets[1]).toEqual({ i: 1, w: 70, r: 10, done: true });
    });
});
