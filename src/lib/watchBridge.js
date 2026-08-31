/**
 * Apple Watch bridge (phone side) — logging-only companion.
 *
 * Built on @capgo/capacitor-watch v8.1.3. The plugin is imported dynamically
 * so this module loads (and tests) cleanly without Capacitor — on web/jsdom
 * every call degrades to a no-op instead of crashing the app.
 *
 * Note on the JS export: the installed plugin registers itself as
 * `CapgoWatch` (jsName in the native source). Some plugin docs also mention
 * a `Watch` named export; we accept either, preferring `CapgoWatch`.
 *
 * The phone pushes STATE via updateApplicationContext (latest-value-wins,
 * delivered even when the watch is briefly unreachable) — never sendMessage,
 * which requires reachability and is reserved for interactive exchanges.
 *
 * ---------------------------------------------------------------------------
 * Message protocol v1 (weights are always kg — the app's storage unit)
 * ---------------------------------------------------------------------------
 * Phone → watch (application context):
 *   { v: 1, kind: 'session', sessionId, name,
 *     exercises: [{ key, name, targetRepsMin, targetRepsMax,
 *                   sets: [{ i, w, r, done }] }] }        // i=0-based, w=kg
 *   { v: 1, kind: 'none' }                                 // no active session
 *
 * Watch → phone (message; may carry a reply):
 *   { action: 'log_set', exerciseKey, setIndex, weight, reps, rpe? }
 *   { action: 'request_state' }
 *   { action: 'ping' }
 *
 * Phone replies: { ok: true, applied: true } for log_set,
 *   { ok: true, session: <snapshot|null> } for request_state,
 *   { ok: true, pong: true } for ping, { ok: false, error? } when malformed.
 * ---------------------------------------------------------------------------
 */

import { getActiveSession, updateSession } from '../hooks/useActiveSession';
import { db } from '../data/db';

const PROTOCOL_VERSION = 1;

let initPromise = null;
let plugin = null; // CapgoWatch plugin instance once available
let available = false;
let messageHandler = null; // test hook — see handleWatchMessage below

/* ------------------------------------------------------------------ */
/* Snapshot building                                                    */
/* ------------------------------------------------------------------ */

/**
 * Compact, serializable session snapshot for the watch. Every field must
 * survive WCSession serialization — plain strings/numbers/booleans only.
 * Returns null when there is no active session.
 */
export function compactSessionSnapshot(session) {
    if (!session) return null;
    return {
        v: PROTOCOL_VERSION,
        kind: 'session',
        sessionId: session.id,
        name: session.name ?? 'Workout',
        exercises: (session.exercises ?? []).map((ex) => ({
            key: ex.key,
            name: db.exercises.byId(ex.exerciseId)?.name ?? ex.exerciseId,
            targetRepsMin: ex.targetRepsMin ?? 0,
            targetRepsMax: ex.targetRepsMax ?? 0,
            sets: (ex.sets ?? []).map((s, i) => ({
                i,
                w: s.weight ?? 0,
                r: s.reps ?? 0,
                done: Boolean(s.completed),
            })),
        })),
    };
}

/* ------------------------------------------------------------------ */
/* Incoming message handling                                            */
/* ------------------------------------------------------------------ */

function clampIndex(n, length) {
    return Math.min(length - 1, Math.max(0, n));
}

/** Finite number ≥ 0 after clamping; null when the value isn't a number. */
function clampNonNegative(v) {
    const n = Number(v);
    if (!Number.isFinite(n)) return null;
    return Math.max(0, n);
}

function findSessionExercise(draft, exerciseKey) {
    return draft.exercises.find((e) => e.key === exerciseKey) ?? null;
}

async function applyLogSet(msg) {
    const session = getActiveSession();
    if (!session) return { ok: false, error: 'no_active_session' };
    if (typeof msg.exerciseKey !== 'string') return { ok: false, error: 'invalid_exercise_key' };

    const setIndex = Number(msg.setIndex);
    if (!Number.isFinite(setIndex)) return { ok: false, error: 'invalid_set_index' };

    // Required per protocol — the watch always sends both; garbage is
    // rejected rather than silently coerced into a fabricated log entry.
    const weight = clampNonNegative(msg.weight);
    const reps = clampNonNegative(msg.reps);
    if (weight === null) return { ok: false, error: 'invalid_weight' };
    if (reps === null) return { ok: false, error: 'invalid_reps' };

    let rpe = null;
    if (msg.rpe !== undefined && msg.rpe !== null) {
        rpe = clampNonNegative(msg.rpe);
        if (rpe === null) return { ok: false, error: 'invalid_rpe' };
        rpe = Math.min(10, rpe);
    }

    let applied = false;
    updateSession((draft) => {
        const ex = findSessionExercise(draft, msg.exerciseKey);
        if (!ex || !ex.sets.length) return;
        const set = ex.sets[clampIndex(Math.round(setIndex), ex.sets.length)];
        set.weight = weight;
        set.reps = Math.round(reps);
        if (rpe !== null) set.rpe = rpe;
        set.completed = true;
        applied = true;
    });

    if (!applied) return { ok: false, error: 'exercise_not_found' };

    // Reflect the new state on the watch immediately — the Workout page only
    // pushes on render, and the user may be on another route when the watch
    // logs. Latest-value-wins, so this converges with the page-side push.
    // Awaited so the reply implies the watch refresh is queued.
    await pushWatchContext(compactSessionSnapshot(getActiveSession()));
    return { ok: true, applied: true };
}

function buildStateReply() {
    const snapshot = compactSessionSnapshot(getActiveSession());
    return { ok: true, session: snapshot };
}

/**
 * Handle one watch→phone message and produce the reply object. Exported for
 * direct testing; the Capacitor listeners below wrap this. Never throws.
 */
export async function handleWatchMessage(message) {
    try {
        if (!message || typeof message !== 'object' || Array.isArray(message)) {
            console.warn('[watchBridge] malformed message from watch:', message);
            return { ok: false, error: 'malformed' };
        }
        switch (message.action) {
            case 'log_set':
                return applyLogSet(message);
            case 'request_state':
                return buildStateReply();
            case 'ping':
                return { ok: true, pong: true };
            default:
                console.warn('[watchBridge] unknown action from watch:', message.action);
                return { ok: false, error: 'unknown_action' };
        }
    } catch (err) {
        // Belt and braces: a broken handler must never take the app down.
        console.warn('[watchBridge] message handling failed:', err);
        return { ok: false, error: 'handler_error' };
    }
}

/* ------------------------------------------------------------------ */
/* Outgoing state push                                                  */
/* ------------------------------------------------------------------ */

/**
 * Push the latest session state to the watch. `null` clears it (the watch
 * shows "no active session"). Safe no-op when the bridge isn't available.
 * @returns {Promise<boolean>} true when the context was handed to the plugin
 */
export async function pushWatchContext(snapshot) {
    if (!available || !plugin) return false;
    const context = snapshot
        ? snapshot
        : { v: PROTOCOL_VERSION, kind: 'none' };
    try {
        // WCSession can't serialize null/undefined — 'none' is the null mark.
        await plugin.updateApplicationContext({ context });
        return true;
    } catch (err) {
        // Expected on web or when the session hasn't activated yet; state
        // pushes resume with the next snapshot.
        console.warn('[watchBridge] context push skipped:', err?.message ?? err);
        return false;
    }
}

/* ------------------------------------------------------------------ */
/* Init                                                                 */
/* ------------------------------------------------------------------ */

function wireListeners(watch) {
    // Fire-and-forget messages (watch didn't ask for a reply). Async so
    // tests can await the full handler chain; the plugin ignores the return.
    watch.addListener?.('messageReceived', async (event) => {
        await handleWatchMessage(event?.message);
    });
    // Messages that expect a reply.
    watch.addListener?.('messageReceivedWithReply', async (event) => {
        const reply = await handleWatchMessage(event?.message);
        try {
            await watch.replyToMessage({ callbackId: event.callbackId, data: reply });
        } catch (err) {
            console.warn('[watchBridge] reply failed:', err);
        }
    });
}

/**
 * Initialize the watch bridge. Idempotent — safe to call on every app mount.
 * On web (or when the plugin can't load) this is a permanent no-op; every
 * plugin call is individually guarded so a missing native side degrades
 * silently instead of throwing.
 */
export function initWatchBridge() {
    if (initPromise) return initPromise;
    initPromise = (async () => {
        try {
            // Dynamic import keeps the plugin out of the web bundle and lets
            // tests run without a Capacitor runtime.
            const mod = await import('@capgo/capacitor-watch');
            const watch = mod?.CapgoWatch ?? mod?.Watch ?? null;
            if (!watch) return { supported: false };
            plugin = watch;
            messageHandler = handleWatchMessage;

            const info = await watch.getInfo().catch(() => null);
            if (info && info.isSupported === false) {
                // Web fallback implementation — keep listeners off.
                return { supported: false, info };
            }
            available = true;
            wireListeners(watch);
            if (info) console.info('[watchBridge] ready:', info);
            return { supported: true, info };
        } catch (err) {
            console.warn('[watchBridge] unavailable:', err?.message ?? err);
            return { supported: false };
        }
    })();
    return initPromise;
}

/** Test seam — resolves once init has finished and exposes current state. */
export function watchBridgeState() {
    return { available, plugin: Boolean(plugin), handler: messageHandler, initPromise };
}
