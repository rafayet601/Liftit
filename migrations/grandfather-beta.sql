-- One-time launch script — deliberately NOT part of schema.sql: schema.sql is
-- safe to re-run forever, while this grants Pro to whoever exists at the
-- moment it runs. Run it once, right before billing enforcement flips on:
--
--   npm run cf:db:grandfather
--
-- Every account created before that moment (the beta cohort) keeps Pro for
-- life ('beta-grandfather', no expiry); accounts created after start on the
-- free plan. Re-running is harmless for already-granted users (ON CONFLICT
-- DO NOTHING) but would also grandfather anyone who signed up in between —
-- so run it once, at launch, then leave it alone.

INSERT INTO entitlements (user_id, plan, source, expires_at, created_at, updated_at)
SELECT id,
       'pro',
       'beta-grandfather',
       NULL,
       CAST(strftime('%s', 'now') AS INTEGER) * 1000,
       CAST(strftime('%s', 'now') AS INTEGER) * 1000
FROM users
ON CONFLICT (user_id) DO NOTHING;
