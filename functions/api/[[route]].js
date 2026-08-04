/**
 * Liftit sync API — Cloudflare Pages Function.
 *
 * Mounted at /api/* on the same origin as the app. That co-location is the
 * whole point: a standalone Worker would sit on a different domain, making
 * the session cookie third-party, which Safari's ITP blocks outright. Here
 * the cookie is first-party and there is no CORS surface at all.
 *
 * Runs on the Workers runtime, so nothing Node-specific is available:
 * passport, jsonwebtoken and bcrypt are replaced by a hand-rolled OAuth
 * code flow and HMAC-signed tokens over Web Crypto.
 *
 * Bindings (wrangler.toml / Pages dashboard):
 *   DB                    D1 database
 *   JWT_SECRET            random 64-char string  (secret)
 *   GOOGLE_CLIENT_ID/_SECRET, GITHUB_CLIENT_ID/_SECRET  (secret, optional)
 */

import { Hono } from 'hono';
import { handle } from 'hono/cloudflare-pages';
import { getCookie, setCookie, deleteCookie } from 'hono/cookie';

const SESSION_COOKIE = 'token';
const STATE_COOKIE = 'oauth_state';
const SESSION_TTL = 60 * 60 * 24 * 7; // 7 days

/* ------------------------------------------------------------------ */
/* Tokens — HMAC-SHA256 over Web Crypto (no jsonwebtoken on Workers)   */
/* ------------------------------------------------------------------ */

const enc = new TextEncoder();

const b64url = (bytes) =>
    btoa(String.fromCharCode(...new Uint8Array(bytes)))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');

const b64urlDecode = (str) => {
    const pad = str.length % 4 ? '='.repeat(4 - (str.length % 4)) : '';
    const bin = atob(str.replace(/-/g, '+').replace(/_/g, '/') + pad);
    return Uint8Array.from(bin, (c) => c.charCodeAt(0));
};

async function hmacKey(secret) {
    return crypto.subtle.importKey(
        'raw',
        enc.encode(secret),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign', 'verify'],
    );
}

async function signToken(payload, secret, ttlSec = SESSION_TTL) {
    const body = { ...payload, exp: Math.floor(Date.now() / 1000) + ttlSec };
    const data = b64url(enc.encode(JSON.stringify(body)));
    const sig = await crypto.subtle.sign('HMAC', await hmacKey(secret), enc.encode(data));
    return `${data}.${b64url(sig)}`;
}

async function verifyToken(token, secret) {
    if (!token || !token.includes('.')) return null;
    const [data, sig] = token.split('.');
    let ok = false;
    try {
        ok = await crypto.subtle.verify(
            'HMAC',
            await hmacKey(secret),
            b64urlDecode(sig),
            enc.encode(data),
        );
    } catch {
        return null;
    }
    if (!ok) return null;
    try {
        const payload = JSON.parse(new TextDecoder().decode(b64urlDecode(data)));
        if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000)) return null;
        return payload;
    } catch {
        return null;
    }
}

const uid = () => crypto.randomUUID();

/* ------------------------------------------------------------------ */
/* OAuth providers                                                     */
/* ------------------------------------------------------------------ */

const PROVIDERS = {
    google: {
        authorize: 'https://accounts.google.com/o/oauth2/v2/auth',
        token: 'https://oauth2.googleapis.com/token',
        userinfo: 'https://openidconnect.googleapis.com/v1/userinfo',
        scope: 'openid email profile',
        idKey: 'GOOGLE_CLIENT_ID',
        secretKey: 'GOOGLE_CLIENT_SECRET',
        normalize: (u) => ({ providerId: u.sub, email: u.email, name: u.name, image: u.picture }),
    },
    github: {
        authorize: 'https://github.com/login/oauth/authorize',
        token: 'https://github.com/login/oauth/access_token',
        userinfo: 'https://api.github.com/user',
        scope: 'read:user user:email',
        idKey: 'GITHUB_CLIENT_ID',
        secretKey: 'GITHUB_CLIENT_SECRET',
        normalize: (u) => ({
            providerId: String(u.id),
            email: u.email,
            name: u.name || u.login,
            image: u.avatar_url,
        }),
    },
};

const appOrigin = (c) => c.env.APP_URL || new URL(c.req.url).origin;
const callbackUrl = (c, provider) => `${appOrigin(c)}/api/auth/${provider}/callback`;

/* ------------------------------------------------------------------ */
/* App                                                                 */
/* ------------------------------------------------------------------ */

const app = new Hono().basePath('/api');

app.get('/health', (c) =>
    c.json({ status: 'ok', timestamp: new Date().toISOString() }),
);

/** Resolve the signed-in user, or null. */
async function currentUser(c) {
    const token = getCookie(c, SESSION_COOKIE);
    const payload = await verifyToken(token, c.env.JWT_SECRET);
    if (!payload?.userId) return null;
    return c.env.DB.prepare(
        'SELECT id, email, name, image FROM users WHERE id = ?',
    )
        .bind(payload.userId)
        .first();
}

/** Gate a route on a valid session. */
async function requireUser(c) {
    const user = await currentUser(c);
    if (!user) return { user: null, response: c.json({ error: 'Authentication required' }, 401) };
    return { user, response: null };
}

/* ---------- auth ---------- */

// Registered before /auth/:provider — otherwise the wildcard captures "me"
// and "logout" as provider names and they 404 as unknown providers.
//
// Shape matters: the client reads response.data.user. Returning a bare user
// object here is what previously made sign-in silently never persist.
app.get('/auth/me', async (c) => {
    const user = await currentUser(c);
    if (!user) return c.json({ error: 'Session expired' }, 401);
    return c.json({ user });
});

app.post('/auth/logout', (c) => {
    deleteCookie(c, SESSION_COOKIE, { path: '/' });
    return c.json({ message: 'Logged out' });
});

// Which providers this deployment has credentials for. The login page only
// renders buttons for these, so an instance with no OAuth apps configured
// shows no dead sign-in buttons. Also must precede /auth/:provider.
app.get('/auth/providers', (c) => {
    const providers = Object.keys(PROVIDERS).filter(
        (name) => c.env[PROVIDERS[name].idKey] && c.env[PROVIDERS[name].secretKey],
    );
    return c.json({ providers });
});

app.get('/auth/:provider', async (c) => {
    const name = c.req.param('provider');
    const provider = PROVIDERS[name];
    if (!provider) return c.json({ error: 'Unknown provider' }, 404);

    const clientId = c.env[provider.idKey];
    if (!clientId) {
        // /auth/callback is the screen that renders sign-in errors.
        return c.redirect(`${appOrigin(c)}/auth/callback?error=provider_not_configured`);
    }

    // CSRF: round-trip an unguessable value through a short-lived cookie.
    const state = b64url(crypto.getRandomValues(new Uint8Array(24)));
    setCookie(c, STATE_COOKIE, state, {
        httpOnly: true,
        secure: true,
        sameSite: 'Lax',
        path: '/',
        maxAge: 600,
    });

    const url = new URL(provider.authorize);
    url.searchParams.set('client_id', clientId);
    url.searchParams.set('redirect_uri', callbackUrl(c, name));
    url.searchParams.set('scope', provider.scope);
    url.searchParams.set('state', state);
    url.searchParams.set('response_type', 'code');
    return c.redirect(url.toString());
});

app.get('/auth/:provider/callback', async (c) => {
    const name = c.req.param('provider');
    const provider = PROVIDERS[name];
    const origin = appOrigin(c);
    if (!provider) return c.json({ error: 'Unknown provider' }, 404);

    const fail = (reason) => c.redirect(`${origin}/auth/callback?error=${reason}`);

    const code = c.req.query('code');
    const state = c.req.query('state');
    const expected = getCookie(c, STATE_COOKIE);
    deleteCookie(c, STATE_COOKIE, { path: '/' });

    if (!code) return fail('oauth_failed');
    if (!state || !expected || state !== expected) return fail('state_mismatch');

    try {
        const tokenRes = await fetch(provider.token, {
            method: 'POST',
            headers: { 'content-type': 'application/x-www-form-urlencoded', accept: 'application/json' },
            body: new URLSearchParams({
                client_id: c.env[provider.idKey],
                client_secret: c.env[provider.secretKey],
                code,
                redirect_uri: callbackUrl(c, name),
                grant_type: 'authorization_code',
            }),
        });
        const tokenJson = await tokenRes.json();
        const accessToken = tokenJson.access_token;
        if (!accessToken) return fail('token_exchange_failed');

        const userRes = await fetch(provider.userinfo, {
            headers: {
                authorization: `Bearer ${accessToken}`,
                accept: 'application/json',
                'user-agent': 'liftit',
            },
        });
        const raw = await userRes.json();
        const profile = provider.normalize(raw);

        // GitHub hides addresses when the user marks them private; ask the
        // dedicated endpoint for the verified primary before giving up.
        if (!profile.email && name === 'github') {
            const emailRes = await fetch('https://api.github.com/user/emails', {
                headers: {
                    authorization: `Bearer ${accessToken}`,
                    accept: 'application/json',
                    'user-agent': 'liftit',
                },
            });
            if (emailRes.ok) {
                const emails = await emailRes.json();
                profile.email = emails.find((e) => e.primary && e.verified)?.email
                    ?? emails.find((e) => e.verified)?.email;
            }
        }
        if (!profile.email) return fail('no_email');

        const now = Date.now();
        const existing = await c.env.DB.prepare('SELECT id FROM users WHERE email = ?')
            .bind(profile.email)
            .first();

        let userId;
        if (existing) {
            userId = existing.id;
            await c.env.DB.prepare(
                'UPDATE users SET name = ?, image = ?, provider = ?, provider_id = ?, updated_at = ? WHERE id = ?',
            )
                .bind(profile.name ?? null, profile.image ?? null, name, profile.providerId, now, userId)
                .run();
        } else {
            userId = uid();
            await c.env.DB.prepare(
                `INSERT INTO users (id, email, name, image, provider, provider_id, created_at, updated_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            )
                .bind(
                    userId,
                    profile.email,
                    profile.name ?? null,
                    profile.image ?? null,
                    name,
                    profile.providerId,
                    now,
                    now,
                )
                .run();
        }

        const token = await signToken({ userId }, c.env.JWT_SECRET);
        setCookie(c, SESSION_COOKIE, token, {
            httpOnly: true,
            secure: true,
            sameSite: 'Lax',
            path: '/',
            maxAge: SESSION_TTL,
        });
        return c.redirect(`${origin}/auth/callback`);
    } catch {
        return fail('server_error');
    }
});

/* ---------- workouts ---------- */

const toMillis = (v) => {
    if (v == null) return null;
    const t = new Date(v).getTime();
    return Number.isFinite(t) ? t : null;
};

app.get('/workouts', async (c) => {
    const { user, response } = await requireUser(c);
    if (response) return response;

    const { results: workouts } = await c.env.DB.prepare(
        `SELECT id, client_id, name, notes, started_at, completed_at, duration_sec
         FROM workouts WHERE user_id = ? ORDER BY started_at DESC LIMIT 500`,
    )
        .bind(user.id)
        .all();

    if (!workouts.length) return c.json({ data: [] });

    const placeholders = workouts.map(() => '?').join(',');
    const { results: sets } = await c.env.DB.prepare(
        `SELECT workout_id, exercise_id, set_number, weight, reps, rpe, is_warmup, completed_at
         FROM workout_sets WHERE workout_id IN (${placeholders}) ORDER BY set_number`,
    )
        .bind(...workouts.map((w) => w.id))
        .all();

    const byWorkout = new Map();
    for (const s of sets) {
        if (!byWorkout.has(s.workout_id)) byWorkout.set(s.workout_id, []);
        byWorkout.get(s.workout_id).push({
            exerciseId: s.exercise_id,
            setNumber: s.set_number,
            weight: s.weight,
            reps: s.reps,
            rpe: s.rpe,
            isWarmup: Boolean(s.is_warmup),
            completedAt: s.completed_at ? new Date(s.completed_at).toISOString() : null,
        });
    }

    return c.json({
        data: workouts.map((w) => ({
            id: w.client_id,
            serverId: w.id,
            name: w.name,
            notes: w.notes,
            startedAt: new Date(w.started_at).toISOString(),
            completedAt: w.completed_at ? new Date(w.completed_at).toISOString() : null,
            durationSec: w.duration_sec ?? 0,
            sets: byWorkout.get(w.id) ?? [],
        })),
    });
});

/**
 * Upsert a workout. Keyed on (user_id, client_id) so replaying a queued
 * mutation is idempotent — no server-side duplicates, and no need for the
 * client to keep a local id map.
 */
app.put('/workouts/:clientId', async (c) => {
    const { user, response } = await requireUser(c);
    if (response) return response;

    const clientId = c.req.param('clientId');
    let body;
    try {
        body = await c.req.json();
    } catch {
        return c.json({ error: 'Invalid JSON' }, 400);
    }

    const sets = Array.isArray(body.sets) ? body.sets.slice(0, 500) : [];
    const startedAt = toMillis(body.startedAt) ?? Date.now();
    const now = Date.now();

    const existing = await c.env.DB.prepare(
        'SELECT id FROM workouts WHERE user_id = ? AND client_id = ?',
    )
        .bind(user.id, clientId)
        .first();

    const workoutId = existing?.id ?? uid();

    const statements = [
        existing
            ? c.env.DB.prepare(
                  `UPDATE workouts SET name = ?, notes = ?, started_at = ?, completed_at = ?,
                   duration_sec = ?, updated_at = ? WHERE id = ?`,
              ).bind(
                  body.name ?? null,
                  body.notes ?? null,
                  startedAt,
                  toMillis(body.completedAt),
                  Number(body.durationSec) || 0,
                  now,
                  workoutId,
              )
            : c.env.DB.prepare(
                  `INSERT INTO workouts (id, user_id, client_id, name, notes, started_at,
                   completed_at, duration_sec, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              ).bind(
                  workoutId,
                  user.id,
                  clientId,
                  body.name ?? null,
                  body.notes ?? null,
                  startedAt,
                  toMillis(body.completedAt),
                  Number(body.durationSec) || 0,
                  now,
              ),
        // Sets are owned wholesale by the client document, so replace rather
        // than diff — simpler and it cannot drift.
        c.env.DB.prepare('DELETE FROM workout_sets WHERE workout_id = ?').bind(workoutId),
        ...sets.map((s, i) =>
            c.env.DB.prepare(
                `INSERT INTO workout_sets (id, workout_id, exercise_id, set_number,
                 weight, reps, rpe, is_warmup, completed_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            ).bind(
                uid(),
                workoutId,
                String(s.exerciseId ?? ''),
                Number(s.setNumber) || i + 1,
                Number.isFinite(Number(s.weight)) ? Number(s.weight) : null,
                Number.isFinite(Number(s.reps)) ? Number(s.reps) : null,
                Number.isFinite(Number(s.rpe)) && Number(s.rpe) > 0 ? Number(s.rpe) : null,
                s.isWarmup ? 1 : 0,
                toMillis(s.completedAt),
            ),
        ),
    ];

    await c.env.DB.batch(statements);
    return c.json({ data: { id: clientId, serverId: workoutId } });
});

app.delete('/workouts/:clientId', async (c) => {
    const { user, response } = await requireUser(c);
    if (response) return response;
    await c.env.DB.prepare('DELETE FROM workouts WHERE user_id = ? AND client_id = ?')
        .bind(user.id, c.req.param('clientId'))
        .run();
    return c.json({ message: 'Deleted' });
});

app.all('*', (c) => c.json({ error: 'Not found' }, 404));

app.onError((err, c) => {
    console.error('[api]', err?.message ?? err);
    return c.json({ error: 'Internal server error' }, 500);
});

export const onRequest = handle(app);
