-- Liftit — Cloudflare D1 schema.
--
-- Deliberately much smaller than the old MySQL/Prisma schema. The client is
-- local-first and owns the canonical document; the server is only a backup
-- and cross-device relay. So we store what the client actually syncs and
-- nothing else — no programs, mesocycles, progression rules or exercise
-- catalogue (all of those are computed on-device by src/engine/*).
--
-- Exercise ids are stored as plain TEXT exactly as the client knows them
-- ("barbell-bench-press", or "custom-x7f2" for user-defined lifts). There is
-- no server-side exercise table and no id mapping, which is what previously
-- made sync silently drop sets for custom exercises.

CREATE TABLE IF NOT EXISTS users (
    id          TEXT PRIMARY KEY,
    email       TEXT NOT NULL UNIQUE,
    name        TEXT,
    image       TEXT,
    provider    TEXT NOT NULL,
    provider_id TEXT NOT NULL,
    created_at  INTEGER NOT NULL,
    updated_at  INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_users_provider ON users (provider, provider_id);

CREATE TABLE IF NOT EXISTS workouts (
    id           TEXT PRIMARY KEY,
    user_id      TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    -- The client's own uid. Sync is keyed on this so replaying the same
    -- mutation upserts instead of duplicating — which also means a user who
    -- clears site data can no longer create phantom copies of every workout.
    client_id    TEXT NOT NULL,
    name         TEXT,
    notes        TEXT,
    started_at   INTEGER NOT NULL,
    completed_at INTEGER,
    duration_sec INTEGER,
    updated_at   INTEGER NOT NULL,
    UNIQUE (user_id, client_id)
);

CREATE INDEX IF NOT EXISTS idx_workouts_user_started ON workouts (user_id, started_at DESC);

CREATE TABLE IF NOT EXISTS workout_sets (
    id           TEXT PRIMARY KEY,
    workout_id   TEXT NOT NULL REFERENCES workouts (id) ON DELETE CASCADE,
    exercise_id  TEXT NOT NULL,
    set_number   INTEGER NOT NULL,
    weight       REAL,
    reps         INTEGER,
    rpe          REAL,
    is_warmup    INTEGER NOT NULL DEFAULT 0,
    completed_at INTEGER
);

CREATE INDEX IF NOT EXISTS idx_sets_workout ON workout_sets (workout_id);

-- Entitlements — the substrate for Liftit Pro. One row per paying or
-- grandfathered user; no row means the free plan. Dormant by design: the API
-- treats every account as Pro until the BILLING_ENFORCED env var is "true"
-- (see wrangler.toml), so applying this migration changes nothing for beta.
--
-- expires_at NULL = never lapses (lifetime purchases, beta grandfathers).
-- source: 'beta-grandfather' | 'stripe' | 'apple' | 'google' | 'comp'.
CREATE TABLE IF NOT EXISTS entitlements (
    user_id    TEXT PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
    plan       TEXT NOT NULL DEFAULT 'free',
    source     TEXT NOT NULL DEFAULT 'none',
    expires_at INTEGER,
    -- Stripe linkage: lets the API open the customer portal and reuse the
    -- customer on repeat checkouts. NULL for non-Stripe entitlements.
    stripe_customer_id     TEXT,
    stripe_subscription_id TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);
