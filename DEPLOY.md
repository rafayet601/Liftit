# Deploying Liftit

Liftit runs on **Cloudflare Pages** — static app plus a `/api/*` Pages Function
backed by D1. Everything below fits inside Cloudflare's free tier.

| Piece | Service | Free tier | Cost |
|---|---|---|---|
| React app | Pages | unlimited bandwidth, 500 builds/mo | $0 |
| `/api/*` | Pages Functions | 100,000 requests/day | $0 |
| Database | D1 (SQLite) | 5 GB, 5M row reads/day, 100k writes/day | $0 |
| AI Coach | user's own API key | n/a — billed to the user, not you | $0 |

At roughly 20 API calls per active user per day, the Functions limit is the
first ceiling you'd hit, around 5,000 daily actives. A custom domain is the
only thing that ever costs money (~$10/yr, at cost through Cloudflare).

The app is local-first, so **the backend is optional**. Skip to
[Static-only](#static-only-no-accounts) if you don't want accounts yet — the
tracker, program generator, and BYO-AI coach all work without it.

---

## Full stack (accounts + cross-device sync)

### 1. Create the database

```bash
npx wrangler login
npx wrangler d1 create liftit
```

Copy the `database_id` it prints into `wrangler.toml`, replacing
`REPLACE_WITH_YOUR_D1_DATABASE_ID`. Then create the tables:

```bash
npm run cf:db:migrate
```

### 2. Create the Pages project

Push the branch, then in the Cloudflare dashboard: **Workers & Pages → Create →
Pages → Connect to Git**, pick the repo, and set:

- **Build command:** `npm run build`
- **Build output directory:** `dist`

Cloudflare then redeploys on every push to the production branch.

### 3. Set environment variables

**Settings → Environment variables**, for both Production and Preview:

| Variable | Value |
|---|---|
| `VITE_API_URL` | `/api` — **required**, or the app runs with no backend |
| `JWT_SECRET` | 64 random chars — mark as **Secret** |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | optional, enables Google sign-in |
| `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` | optional, enables GitHub sign-in |
| `APP_URL` | optional; pins the OAuth redirect origin |

Generate a secret with:

```bash
node -e "console.log(crypto.randomUUID().replace(/-/g,'')+crypto.randomUUID().replace(/-/g,''))"
```

`VITE_API_URL` is read at **build** time, not runtime — set it before the build
that goes live, and redeploy after changing it.

### 4. Bind D1 to the Pages project

**Settings → Bindings → Add → D1 database**: variable name `DB`, database
`liftit`. Add it to Production and Preview.

### 5. Register the OAuth apps

Only for the providers you want. Omit a provider's variables and its button
disappears rather than breaking.

**Google** — [console.cloud.google.com](https://console.cloud.google.com) →
APIs & Services → Credentials → OAuth client ID → Web application.
Authorised redirect URI:

```
https://<your-domain>/api/auth/google/callback
```

**GitHub** — Settings → Developer settings → OAuth Apps → New.
Authorisation callback URL:

```
https://<your-domain>/api/auth/github/callback
```

Add your `*.pages.dev` URL too if you want sign-in on preview deployments.

### 6. Deploy and verify

```bash
npm run cf:deploy      # or just push, if Git integration is connected
```

Then check:

```bash
curl https://<your-domain>/api/health          # {"status":"ok",...}
curl -i https://<your-domain>/api/workouts     # 401 — auth is enforced
curl -o /dev/null -w '%{http_code}\n' https://<your-domain>/progress   # 200 — deep links work
```

Sign in, log a set, open the app on a second device, and confirm the workout
appears.

---

## Static-only (no accounts)

Do steps 2 and 6 only, and **leave `VITE_API_URL` unset**. The Account & sync
card hides itself, no network calls are made, and everything stays on-device.
Adding the backend later is just steps 1, 3, 4, 5 and a redeploy — no code
changes.

---

## Local development

```bash
npm run dev                  # app only, port 5173
npm run cf:db:migrate:local  # once, creates the local D1
npm run cf:dev               # full stack incl. /api, port 8788
```

For local sign-in, put secrets in `.dev.vars` (gitignored):

```
JWT_SECRET=any-long-random-string
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
```

`npm run cf:dev` builds first, so re-run it after changing frontend code.
Logs from a live deployment: `npm run cf:tail`.

---

## Notes and gotchas

- **Run the API on the same origin.** The session cookie is `httpOnly` +
  `SameSite=Lax`. Splitting the API onto its own domain makes it a third-party
  cookie, which Safari's ITP blocks — sign-in would fail for those users with
  no error. That's why this is a Pages Function and not a standalone Worker.
- **`wrangler pages dev` warns about an infinite loop in `_redirects`.** It's
  benign — see the comment in `public/_redirects`.
- **The AI Coach never touches the backend.** Keys stay in the user's browser,
  so inference is never billed to you. `_headers` permits `connect-src https:`
  so users can reach any provider; plain `http:` stays blocked.
- **Tests can't run from a path containing a curly apostrophe** (`’`), which the
  current checkout has. Vitest fails to start its workers and dies after a
  10-minute timeout with zero tests collected. Clone to an ASCII path to run
  them locally; CI is unaffected.
