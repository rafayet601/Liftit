/**
 * Helpers for the Pages Function API.
 *
 * Filenames beginning with `_` are ignored by Pages' file-based router, so
 * this is a plain module rather than a route — which also makes it directly
 * unit-testable, unlike [[route]].js.
 */

/**
 * D1 rejects any single statement carrying more than this many bound
 * parameters with "too many SQL variables". It bites on `IN (?,?,…)` lists
 * built from a result set: 101 workouts meant 101 placeholders and a hard
 * 500. Kept a little under the true ceiling so a query can add its own
 * parameters alongside a chunked list.
 */
export const D1_MAX_BOUND_PARAMS = 90;

/**
 * Split `items` into runs of at most `size`, so each run can be bound to its
 * own statement. Returns [] for empty input — callers can skip the query.
 */
export function chunk(items, size = D1_MAX_BOUND_PARAMS) {
    const list = Array.isArray(items) ? items : [];
    if (size < 1) throw new RangeError('chunk size must be >= 1');
    const out = [];
    for (let i = 0; i < list.length; i += size) {
        out.push(list.slice(i, i + size));
    }
    return out;
}

/**
 * Clamp untrusted text before it reaches the database. Workout names and
 * notes come straight from a client we don't control, and D1's free tier is
 * a shared 5 GB — a single request stored a 1 MB name before this existed.
 * Returns null for empty/absent input so columns stay NULL rather than ''.
 */
export function clampText(value, max) {
    if (value == null) return null;
    const s = String(value);
    if (!s) return null;
    return s.length > max ? s.slice(0, max) : s;
}

export const LIMITS = {
    name: 200,
    notes: 2000,
    exerciseId: 100,
    clientId: 100,
    sets: 500,
    workouts: 500,
};
