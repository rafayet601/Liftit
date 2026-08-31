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
    programs: 50,
    // A serialized program document (days × exercises targets). A few tens of
    // KB covers any legitimate program; clamping here keeps hostile payloads
    // from writing megabytes of JSON per row.
    programPayload: 100000,
};

export const PLANS = {
    FREE: 'free',
    PRO: 'pro',
};

/**
 * Effective entitlement for a user, from their `entitlements` row (or null —
 * most users won't have one) and whether this deployment enforces billing.
 *
 * The enforcement flag is the launch switch: while it's off, every account
 * resolves to Pro so the beta behaves exactly as before entitlements existed.
 * Rows only start to matter the moment BILLING_ENFORCED flips to "true" —
 * from then on a missing or expired row means the free plan.
 */
export function effectiveEntitlement(row, { now = Date.now(), enforced = false } = {}) {
    const active = Boolean(
        row
            && row.plan === PLANS.PRO
            && (row.expires_at == null || row.expires_at > now),
    );
    if (!enforced) {
        return {
            plan: PLANS.PRO,
            source: active ? row.source : 'preview',
            expiresAt: active ? (row.expires_at ?? null) : null,
            billingEnforced: false,
        };
    }
    if (active) {
        return {
            plan: PLANS.PRO,
            source: row.source,
            expiresAt: row.expires_at ?? null,
            billingEnforced: true,
        };
    }
    return { plan: PLANS.FREE, source: 'none', expiresAt: null, billingEnforced: true };
}

/**
 * Decide whether a billing-system event may replace the stored entitlement.
 *
 * Upgrades apply unless they would shorten a non-expiring Pro grant.
 * Downgrades only apply when they come from the same billing system that
 * granted the current plan, and never against a non-expiring grant — so a
 * Stripe cancellation can't strip a beta grandfather or lifetime purchase,
 * and an App Store expiry can't kill an active Stripe subscription.
 * Returns the update to store, or null to skip the write entirely.
 */
export function resolveEntitlementUpdate(existing, update) {
    const lifetime =
        Boolean(existing) && existing.plan === PLANS.PRO && existing.expires_at == null;
    if (update.plan === PLANS.PRO) {
        if (lifetime && update.expiresAt != null) return null;
        return update;
    }
    if (!existing || existing.plan !== PLANS.PRO) return update;
    if (lifetime) return null;
    if (existing.source !== update.source) return null;
    return update;
}

/**
 * Parse a Stripe-Signature header: "t=<unix>,v1=<hex>[,v1=<hex>…]".
 * Returns { t, signatures } or null when the header is malformed.
 */
export function parseStripeSignature(header) {
    if (typeof header !== 'string' || !header) return null;
    let t = null;
    const signatures = [];
    for (const part of header.split(',')) {
        const eq = part.indexOf('=');
        if (eq === -1) continue;
        const k = part.slice(0, eq).trim();
        const v = part.slice(eq + 1).trim();
        if (k === 't' && /^\d+$/.test(v)) t = Number(v);
        else if (k === 'v1' && v) signatures.push(v);
    }
    if (!t || !signatures.length) return null;
    return { t, signatures };
}

/** Decode a hex string to bytes; null for anything that isn't clean hex. */
export function hexToBytes(hex) {
    if (typeof hex !== 'string' || !hex.length || hex.length % 2 || /[^0-9a-f]/i.test(hex)) {
        return null;
    }
    const out = new Uint8Array(hex.length / 2);
    for (let i = 0; i < out.length; i += 1) {
        out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
    }
    return out;
}
